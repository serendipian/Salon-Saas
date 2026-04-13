import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { setSalonCurrency } from '../lib/format';
import { useRealtimeEpoch } from '../lib/realtimeReset';
import type {
  Role,
  Profile,
  SalonMembership,
  ActiveSalon,
  SubscriptionTier,
} from '../lib/auth.types';

export type ProfileUpdates = Omit<Partial<Profile>, 'is_admin' | 'id' | 'email' | 'created_at' | 'updated_at'>;

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
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: string | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;

  // Profile actions
  updateProfile: (data: ProfileUpdates) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;

  // Salon actions
  switchSalon: (salonId: string) => Promise<void>;
  refreshActiveSalon: (updates: Partial<ActiveSalon>) => void;
  createSalon: (name: string, timezone?: string, currency?: string) => Promise<{ salonId: string | null; error: string | null }>;
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

  const epoch = useRealtimeEpoch();

  // Sync global currency for formatPrice()
  useEffect(() => {
    if (activeSalon?.currency) {
      setSalonCurrency(activeSalon.currency);
    }
  }, [activeSalon?.currency]);

  // Fetch profile from public.profiles
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, avatar_url, phone, bio, language, notification_email, notification_sms, is_admin')
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
  const switchSalon = useCallback(async (salonId: string) => {
    const membership = memberships.find(m => m.salon_id === salonId);
    if (!membership) {
      console.error('No membership found for salon:', salonId);
      return;
    }
    setActiveSalon(membership.salon);
    setRole(membership.role);
    localStorage.setItem('lastSalonId', salonId);
  }, [memberships]);

  // Initialize auth state on mount
  const initializeAuth = useCallback(async () => {
    try {
      // Timeout to prevent infinite loading if getSession() hangs
      const sessionResult = await Promise.race([
        supabase.auth.getSession(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Session fetch timed out')), 5000)
        ),
      ]);
      const { data: { session: currentSession } } = sessionResult;

      if (!currentSession?.user) {
        setIsLoading(false);
        return;
      }

      setSession(currentSession);
      setUser(currentSession.user);

      const [userProfile, userMemberships] = await Promise.all([
        fetchProfile(currentSession.user.id),
        fetchMemberships(currentSession.user.id),
      ]);

      setProfile(userProfile);
      setMemberships(userMemberships);

      // Auto-select salon
      if (userMemberships.length === 1) {
        const m = userMemberships[0];
        setActiveSalon(m.salon);
        setRole(m.role);
      } else if (userMemberships.length > 1) {
        // Try to restore last salon
        const lastSalonId = localStorage.getItem('lastSalonId');
        const lastMembership = lastSalonId
          ? userMemberships.find(m => m.salon_id === lastSalonId)
          : null;
        if (lastMembership) {
          setActiveSalon(lastMembership.salon);
          setRole(lastMembership.role);
        }
        // If no last salon, user will be shown the salon picker
      }
    } catch (err) {
      console.error('Auth initialization failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile, fetchMemberships]);

  // Listen for auth state changes
  useEffect(() => {
    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        if (event === 'SIGNED_IN' && newSession) {
          setSession(newSession);
          setUser(newSession.user);
          const [userProfile, userMemberships] = await Promise.all([
            fetchProfile(newSession.user.id),
            fetchMemberships(newSession.user.id),
          ]);
          setProfile(userProfile);
          setMemberships(userMemberships);

          if (userMemberships.length === 1) {
            const m = userMemberships[0];
            setActiveSalon(m.salon);
            setRole(m.role);
          } else if (userMemberships.length > 1) {
            // Try to restore last salon (same logic as initializeAuth)
            const lastSalonId = localStorage.getItem('lastSalonId');
            const lastMembership = lastSalonId
              ? userMemberships.find(m => m.salon_id === lastSalonId)
              : null;
            if (lastMembership) {
              setActiveSalon(lastMembership.salon);
              setRole(lastMembership.role);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          setProfile(null);
          setActiveSalon(null);
          setRole(null);
          setMemberships([]);
          localStorage.removeItem('lastSalonId');
        } else if (event === 'TOKEN_REFRESHED' && newSession) {
          setSession(newSession);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [initializeAuth, fetchProfile, fetchMemberships]);

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
          setActiveSalon(prev => {
            if (!prev) return prev;
            const patch: Partial<ActiveSalon> = {};
            if (updated.subscription_tier !== undefined) patch.subscription_tier = updated.subscription_tier as SubscriptionTier;
            if (updated.is_suspended !== undefined) patch.is_suspended = updated.is_suspended as boolean;
            return Object.keys(patch).length > 0 ? { ...prev, ...patch } : prev;
          });
        }
      )
      .subscribe();

    salonChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSalon?.id, epoch]);

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
            const stillMember = updated.find(m => m.salon_id === currentSalon.id);
            if (!stillMember) {
              setActiveSalon(null);
              setRole(null);
              localStorage.removeItem('lastSalonId');
            } else if (stillMember.role !== currentRole) {
              // Role changed
              setRole(stillMember.role);
            }
          }
        }
      )
      .subscribe();

    membershipChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchMemberships, epoch]);

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
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    if (lower.includes('network') || lower.includes('fetch'))
      return 'Erreur de connexion. Vérifiez votre connexion internet.';
    return 'Une erreur est survenue. Veuillez réessayer.';
  };

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? sanitizeAuthError(error.message) : null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, firstName: string, lastName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
      },
    });
    return { error: error ? sanitizeAuthError(error.message) : null };
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error: error ? sanitizeAuthError(error.message) : null };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error ? sanitizeAuthError(error.message) : null };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error ? sanitizeAuthError(error.message) : null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const updateProfile = useCallback(async (data: ProfileUpdates) => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', user.id);
    if (error) return { error: error.message };
    const updated = await fetchProfile(user.id);
    if (updated) setProfile(updated);
    return { error: null };
  }, [user, fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const updated = await fetchProfile(user.id);
    if (updated) setProfile(updated);
  }, [user, fetchProfile]);

  const refreshActiveSalon = useCallback((updates: Partial<ActiveSalon>) => {
    setActiveSalon(prev => prev ? { ...prev, ...updates } : prev);
  }, []);

  const createSalon = useCallback(async (name: string, timezone = 'Europe/Paris', currency = 'MAD') => {
    const { data, error } = await supabase.rpc('create_salon', {
      p_name: name,
      p_timezone: timezone,
      p_currency: currency,
    });

    if (error) {
      return { salonId: null, error: error.message };
    }

    // Initialize 14-day Pro trial for the new salon
    const { error: trialError } = await supabase.rpc('initialize_salon_trial', { p_salon_id: data });
    if (trialError) {
      console.error('Failed to initialize salon trial:', trialError.message);
    }

    // Refetch memberships after salon creation
    if (user) {
      const updated = await fetchMemberships(user.id);
      setMemberships(updated);
      const newMembership = updated.find(m => m.salon_id === data);
      if (newMembership) {
        setActiveSalon(newMembership.salon);
        setRole(newMembership.role);
        localStorage.setItem('lastSalonId', newMembership.salon_id);
      }
    }

    return { salonId: data as string, error: null };
  }, [user, fetchMemberships]);

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
