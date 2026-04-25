import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type {
  ActiveSalon,
  Profile,
  Role,
  SalonMembership,
  SubscriptionTier,
} from '../lib/auth.types';
import { setSalonCurrency } from '../lib/format';
import { useRealtimeEpoch } from '../lib/realtimeReset';
import { Sentry } from '../lib/sentry';
import { supabase } from '../lib/supabase';
import { rawRpc, rawUpdate } from '../lib/supabaseRaw';

export type ProfileUpdates = Omit<
  Partial<Profile>,
  'is_admin' | 'id' | 'email' | 'created_at' | 'updated_at'
>;

interface AuthContextType {
  // State
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  activeSalon: ActiveSalon | null;
  role: Role | null;
  memberships: SalonMembership[];
  isLoading: boolean;
  isAuthenticated: boolean;

  // Auth actions
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => Promise<{ error: string | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (
    newPassword: string,
    currentPassword?: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;

  // Profile actions
  updateProfile: (data: ProfileUpdates) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;

  // Salon actions
  switchSalon: (salonId: string) => Promise<void>;
  refreshActiveSalon: (updates: Partial<ActiveSalon>) => void;
  createSalon: (
    name: string,
    timezone?: string,
    currency?: string,
  ) => Promise<{ salonId: string | null; error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeSalon, setActiveSalon] = useState<ActiveSalon | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [memberships, setMemberships] = useState<SalonMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const membershipChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const salonChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const activeSalonRef = useRef(activeSalon);
  const roleRef = useRef(role);
  activeSalonRef.current = activeSalon;
  roleRef.current = role;

  const _epoch = useRealtimeEpoch();

  // Sync global currency for formatPrice()
  useEffect(() => {
    if (activeSalon?.currency) {
      setSalonCurrency(activeSalon.currency);
    }
  }, [activeSalon?.currency]);

  // Sync user + salon identity to Sentry for error attribution
  useEffect(() => {
    if (user) {
      Sentry.setUser({ id: user.id, email: user.email });
    } else {
      Sentry.setUser(null);
    }
  }, [user]);

  useEffect(() => {
    Sentry.setTag('salon_id', activeSalon?.id ?? null);
    Sentry.setTag('role', role ?? null);
  }, [activeSalon?.id, role]);

  // Fetch profile from public.profiles
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, email, first_name, last_name, avatar_url, phone, bio, language, notification_email, notification_sms, is_admin',
      )
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Failed to fetch profile:', error.message);
      return null;
    }
    return data as Profile;
  }, []);

  // Fetch all salon memberships for the current user
  const fetchMemberships = useCallback(async (userId: string): Promise<SalonMembership[]> => {
    const { data, error } = await supabase
      .from('salon_memberships')
      .select(`
        id, salon_id, profile_id, role, status, created_at,
        salon:salons!inner(id, name, slug, logo_url, currency, timezone, subscription_tier, is_suspended)
      `)
      .eq('profile_id', userId)
      .eq('status', 'active')
      .is('deleted_at', null);

    if (error) {
      console.error('Failed to fetch memberships:', error.message);
      return [];
    }

    // Supabase returns salon as object (not array) due to !inner
    return (data || []).map((m) => ({
      id: m.id,
      salon_id: m.salon_id,
      profile_id: m.profile_id,
      role: m.role as Role,
      status: m.status as SalonMembership['status'],
      created_at: m.created_at,
      salon: m.salon as unknown as SalonMembership['salon'],
    }));
  }, []);

  // Switch active salon
  const switchSalon = useCallback(
    async (salonId: string) => {
      const membership = memberships.find((m) => m.salon_id === salonId);
      if (!membership) {
        console.error('No membership found for salon:', salonId);
        return;
      }
      setActiveSalon(membership.salon);
      setRole(membership.role);
      localStorage.setItem('lastSalonId', salonId);
    },
    [memberships],
  );

  const clearAuthState = useCallback(() => {
    setUser(null);
    setSession(null);
    setProfile(null);
    setActiveSalon(null);
    setRole(null);
    setMemberships([]);
    localStorage.removeItem('lastSalonId');
  }, []);

  // Hydrate user-scoped state (profile + memberships + active salon) from a session.
  // Runs under a ref guard so concurrent auth events can't double-fetch or race.
  // Retries transient failures (e.g. token still propagating after refresh) before
  // giving up — if all retries fail, clear auth so the user lands on /login
  // rather than staring at an infinite spinner.
  const hydratingFor = useRef<string | null>(null);
  const hydrateFromSession = useCallback(
    async (newSession: Session) => {
      if (hydratingFor.current === newSession.user.id) return;
      hydratingFor.current = newSession.user.id;

      const delays = [0, 800, 2000]; // ms between attempts
      let userProfile: Profile | null = null;
      let userMemberships: SalonMembership[] = [];
      let lastError: unknown = null;

      try {
        for (let attempt = 0; attempt < delays.length; attempt++) {
          if (delays[attempt] > 0) {
            await new Promise((r) => setTimeout(r, delays[attempt]));
          }
          try {
            [userProfile, userMemberships] = await Promise.all([
              fetchProfile(newSession.user.id),
              fetchMemberships(newSession.user.id),
            ]);
            if (userProfile) break; // success
          } catch (err) {
            lastError = err;
          }
        }

        if (!userProfile) {
          if (lastError) console.error('Profile hydration failed after retries:', lastError);
          else console.error('Profile row missing for user', newSession.user.id);
          clearAuthState();
          return;
        }

        setProfile(userProfile);
        setMemberships(userMemberships);

        if (userMemberships.length === 1) {
          const m = userMemberships[0];
          setActiveSalon(m.salon);
          setRole(m.role);
        } else if (userMemberships.length > 1) {
          const lastSalonId = localStorage.getItem('lastSalonId');
          const lastMembership = lastSalonId
            ? userMemberships.find((m) => m.salon_id === lastSalonId)
            : null;
          if (lastMembership) {
            setActiveSalon(lastMembership.salon);
            setRole(lastMembership.role);
          }
        }
      } finally {
        hydratingFor.current = null;
      }
    },
    [fetchProfile, fetchMemberships, clearAuthState],
  );

  // Initial load: read the persisted session directly from localStorage.
  // supabase.auth.getSession() awaits the client's internal init lock, which
  // can stall for many seconds if a background token-refresh network call is
  // slow. We don't need to wait for that — the session payload is already in
  // localStorage and ready to use. The onAuthStateChange listener below will
  // reconcile state once init completes (token refreshed, user updated, etc.).
  useEffect(() => {
    let cancelled = false;

    const storageKey = `sb-${new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Session | null;
        // Accept the session if it has the required fields and isn't expired.
        // If expired, supabase-js will refresh it and fire TOKEN_REFRESHED.
        if (parsed?.access_token && parsed.user) {
          const notExpired = !parsed.expires_at || parsed.expires_at * 1000 > Date.now();
          if (notExpired) {
            setSession(parsed);
            setUser(parsed.user);
            void hydrateFromSession(parsed);
          }
        }
      }
    } catch (err) {
      console.error('Failed to read persisted session:', err);
    }
    if (!cancelled) setIsLoading(false);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        if (event === 'SIGNED_IN' && newSession) {
          setSession(newSession);
          setUser(newSession.user);
          await hydrateFromSession(newSession);
        } else if (event === 'TOKEN_REFRESHED' && newSession) {
          setSession(newSession);
        } else if (event === 'USER_UPDATED' && newSession) {
          setSession(newSession);
          setUser(newSession.user);
        } else if (event === 'SIGNED_OUT') {
          clearAuthState();
        }
      },
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [hydrateFromSession, clearAuthState]);

  // Real-time salon tracking (detect subscription_tier changes pushed by Stripe webhook)
  useEffect(() => {
    if (!activeSalon) {
      if (salonChannelRef.current) {
        supabase.removeChannel(salonChannelRef.current);
        salonChannelRef.current = null;
      }
      return;
    }

    if (salonChannelRef.current) {
      supabase.removeChannel(salonChannelRef.current);
    }

    const channel = supabase
      .channel(`salon-tier:${activeSalon.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'salons',
          filter: `id=eq.${activeSalon.id}`,
        },
        (payload) => {
          const updated = payload.new as Record<string, unknown>;
          setActiveSalon((prev) => {
            if (!prev) return prev;
            const patch: Partial<ActiveSalon> = {};
            if (updated.subscription_tier !== undefined)
              patch.subscription_tier = updated.subscription_tier as SubscriptionTier;
            if (updated.is_suspended !== undefined)
              patch.is_suspended = updated.is_suspended as boolean;
            return Object.keys(patch).length > 0 ? { ...prev, ...patch } : prev;
          });
        },
      )
      .subscribe();

    salonChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSalon?.id, activeSalon]);

  // Real-time membership tracking (detect revocation / role changes)
  useEffect(() => {
    if (!user) return;

    // Clean up previous channel
    if (membershipChannelRef.current) {
      supabase.removeChannel(membershipChannelRef.current);
    }

    const channel = supabase
      .channel(`memberships:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'salon_memberships',
          filter: `profile_id=eq.${user.id}`,
        },
        async () => {
          // Refetch memberships on any change
          const updated = await fetchMemberships(user.id);
          setMemberships(updated);

          // Use refs to avoid stale closures and unnecessary channel reconnections
          const currentSalon = activeSalonRef.current;
          const currentRole = roleRef.current;

          // If active salon membership was revoked, clear it
          if (currentSalon) {
            const stillMember = updated.find((m) => m.salon_id === currentSalon.id);
            if (!stillMember) {
              setActiveSalon(null);
              setRole(null);
              localStorage.removeItem('lastSalonId');
            } else if (stillMember.role !== currentRole) {
              // Role changed
              setRole(stillMember.role);
            }
          }
        },
      )
      .subscribe();

    membershipChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchMemberships]);

  // --- Auth Actions ---

  const sanitizeAuthError = (message: string): string => {
    const lower = message.toLowerCase();
    if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials'))
      return 'Email ou mot de passe incorrect.';
    if (lower.includes('email not confirmed'))
      return 'Veuillez confirmer votre email avant de vous connecter.';
    if (lower.includes('user already registered') || lower.includes('already been registered'))
      return 'Un compte existe déjà avec cet email.';
    if (lower.includes('rate limit') || lower.includes('too many requests'))
      return 'Trop de tentatives. Veuillez réessayer dans quelques minutes.';
    if (lower.includes('password') && lower.includes('least'))
      return 'Le mot de passe doit contenir au moins 8 caractères.';
    if (lower.includes('network') || lower.includes('fetch'))
      return 'Erreur de connexion. Vérifiez votre connexion internet.';
    return 'Une erreur est survenue. Veuillez réessayer.';
  };

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ? sanitizeAuthError(error.message) : null };
    },
    [sanitizeAuthError],
  );

  const signUp = useCallback(
    async (email: string, password: string, firstName: string, lastName: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: firstName, last_name: lastName },
        },
      });
      return { error: error ? sanitizeAuthError(error.message) : null };
    },
    [sanitizeAuthError],
  );

  const signInWithMagicLink = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.signInWithOtp({ email });
      return { error: error ? sanitizeAuthError(error.message) : null };
    },
    [sanitizeAuthError],
  );

  const resetPassword = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return { error: error ? sanitizeAuthError(error.message) : null };
    },
    [sanitizeAuthError],
  );

  const updatePassword = useCallback(
    async (newPassword: string, currentPassword?: string) => {
      // Raw fetch — supabase.auth.updateUser() can hang indefinitely after
      // background-tab throttling (same SDK lock issue as getUser/signOut).
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1];
      const storageKey = projectRef ? `sb-${projectRef}-auth-token` : null;

      let accessToken: string | null = null;
      try {
        const raw = storageKey ? localStorage.getItem(storageKey) : null;
        if (raw) {
          const parsed = JSON.parse(raw) as { access_token?: string };
          accessToken = parsed.access_token ?? null;
        }
      } catch {
        // fall through
      }
      if (!accessToken) {
        return { error: 'Session introuvable, veuillez vous reconnecter.' };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
          method: 'PUT',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            currentPassword
              ? { password: newPassword, current_password: currentPassword }
              : { password: newPassword },
          ),
          signal: controller.signal,
        });
        if (!response.ok) {
          let message = `HTTP ${response.status}`;
          try {
            const body = (await response.json()) as { msg?: string; message?: string };
            message = body.msg ?? body.message ?? message;
          } catch {
            // ignore
          }
          return { error: sanitizeAuthError(message) };
        }
        // Notify SDK so in-memory state + onAuthStateChange listeners catch up.
        // Fire-and-forget — if the SDK hangs, the password was already changed.
        void supabase.auth.refreshSession().catch(() => {});
        return { error: null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { error: sanitizeAuthError(msg) };
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [sanitizeAuthError],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const updateProfile = useCallback(
    async (data: ProfileUpdates) => {
      if (!user) return { error: 'Not authenticated' };
      try {
        const params = new URLSearchParams();
        params.append('id', `eq.${user.id}`);
        await rawUpdate('profiles', params.toString(), data);
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
      const updated = await fetchProfile(user.id);
      if (updated) setProfile(updated);
      return { error: null };
    },
    [user, fetchProfile],
  );

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const updated = await fetchProfile(user.id);
    if (updated) setProfile(updated);
  }, [user, fetchProfile]);

  const refreshActiveSalon = useCallback((updates: Partial<ActiveSalon>) => {
    setActiveSalon((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const createSalon = useCallback(
    async (name: string, timezone = 'Europe/Paris', currency = 'MAD') => {
      let data: string;
      try {
        data = await rawRpc<string>('create_salon', {
          p_name: name,
          p_timezone: timezone,
          p_currency: currency,
        });
      } catch (err) {
        return {
          salonId: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      // Initialize 14-day Pro trial for the new salon
      try {
        await rawRpc('initialize_salon_trial', { p_salon_id: data });
      } catch (trialError) {
        console.error(
          'Failed to initialize salon trial:',
          trialError instanceof Error ? trialError.message : trialError,
        );
      }

      // Refetch memberships after salon creation
      if (user) {
        const updated = await fetchMemberships(user.id);
        setMemberships(updated);
        const newMembership = updated.find((m) => m.salon_id === data);
        if (newMembership) {
          setActiveSalon(newMembership.salon);
          setRole(newMembership.role);
          localStorage.setItem('lastSalonId', newMembership.salon_id);
        }
      }

      return { salonId: data as string, error: null };
    },
    [user, fetchMemberships],
  );

  const value: AuthContextType = {
    user,
    session,
    profile,
    activeSalon,
    role,
    memberships,
    isLoading,
    isAuthenticated: !!session && !!user,
    signIn,
    signUp,
    signInWithMagicLink,
    resetPassword,
    updatePassword,
    signOut,
    updateProfile,
    refreshProfile,
    switchSalon,
    refreshActiveSalon,
    createSalon,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
