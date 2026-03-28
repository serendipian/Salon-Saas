# Plan 1B: Auth & App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up Supabase Auth (email+password, magic link), create AuthContext with salon switching, add permission-gated routing, and update the app shell (sidebar + topbar) to reflect real user/salon data.

**Architecture:** Replace the hardcoded user identity in Layout.tsx with a real auth system. AuthContext wraps the entire app, providing user/session/salon/role state. A `usePermissions()` hook gates sidebar items and routes by role. The existing AppContext (mock data) remains untouched — module migration to Supabase happens in Plans 2-4. TanStack Query is installed but only used for auth-related queries in this plan.

**Tech Stack:** @supabase/supabase-js, @tanstack/react-query, React Router DOM 7 (already installed), TypeScript

---

## File Structure

### New Files
```
lib/supabase.ts                          # Supabase client singleton + typed helper
lib/auth.types.ts                        # Auth-specific TypeScript types (Role, Profile, etc.)
context/AuthContext.tsx                   # Auth state: user, session, salon, role, memberships
hooks/usePermissions.ts                  # Role-based permission checks (can/accessLevel)
hooks/useSessionContext.ts               # Sets Supabase session variables before every query
components/ProtectedRoute.tsx            # Route guard: redirects unauthenticated/unauthorized
pages/LoginPage.tsx                      # Email+password login + magic link
pages/SignupPage.tsx                     # Registration form (name, email, password)
pages/CreateSalonPage.tsx                # Post-signup: create first salon
pages/SalonPickerPage.tsx                # Multi-salon users: choose active salon
pages/AcceptInvitationPage.tsx           # Token-based invitation acceptance
```

### Modified Files
```
App.tsx                                  # Add AuthProvider, QueryClientProvider, auth routes
index.tsx                                # Add QueryClientProvider wrapper
components/Layout.tsx                    # Real user name/role, permission-gated sidebar
package.json                             # Add @supabase/supabase-js, @tanstack/react-query
```

### Untouched
```
context/AppContext.tsx                    # Mock data stays — migrated in Plans 2-4
modules/**                               # All module components unchanged
types.ts                                 # Existing frontend types unchanged
```

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Supabase JS client and TanStack Query**

```bash
cd "/Users/sims/Casa de Chicas/Salon-Saas"
npm install @supabase/supabase-js @tanstack/react-query
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('@supabase/supabase-js'); console.log('supabase-js OK')"
node -e "require('@tanstack/react-query'); console.log('react-query OK')"
```

Expected: Both print OK without errors.

- [ ] **Step 3: Verify build still works**

```bash
npm run build
```

Expected: Build succeeds with no errors (new deps are tree-shaken since nothing imports them yet).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @supabase/supabase-js and @tanstack/react-query dependencies"
```

---

## Task 2: Supabase Client Singleton

**Files:**
- Create: `lib/supabase.ts`

- [ ] **Step 1: Create the Supabase client module**

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds. The env vars are present in `.env.local` (set up in Plan 1A).

- [ ] **Step 3: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat: create typed Supabase client singleton"
```

---

## Task 3: Auth Types

**Files:**
- Create: `lib/auth.types.ts`

- [ ] **Step 1: Create auth-specific types**

```typescript
// lib/auth.types.ts
import type { Session, User } from '@supabase/supabase-js';

export type Role = 'owner' | 'manager' | 'stylist' | 'receptionist';

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface SalonMembership {
  id: string;
  salon_id: string;
  profile_id: string;
  role: Role;
  status: 'pending' | 'active' | 'suspended';
  salon: {
    id: string;
    name: string;
    slug: string | null;
    logo_url: string | null;
    currency: string;
    timezone: string;
  };
}

export interface ActiveSalon {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  currency: string;
  timezone: string;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  activeSalon: ActiveSalon | null;
  role: Role | null;
  memberships: SalonMembership[];
  isLoading: boolean;
  isAuthenticated: boolean;
}

export type AuthAction = 'view' | 'create' | 'edit' | 'delete' | 'manage';
export type AuthResource =
  | 'dashboard'
  | 'appointments'
  | 'clients'
  | 'pos'
  | 'services'
  | 'products'
  | 'team'
  | 'accounting'
  | 'suppliers'
  | 'settings'
  | 'billing'
  | 'invitations'
  | 'audit_log';

export type AccessLevel = 'full' | 'own' | 'linked' | 'summary' | 'none';
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add lib/auth.types.ts
git commit -m "feat: add auth-specific TypeScript types (Role, Profile, Membership, Permissions)"
```

---

## Task 4: usePermissions Hook

**Files:**
- Create: `hooks/usePermissions.ts`

- [ ] **Step 1: Create the permissions hook**

This is a static permission map — no database calls. It reads the role from context and returns permission checks.

```typescript
// hooks/usePermissions.ts
import { useMemo } from 'react';
import type { Role, AuthAction, AuthResource, AccessLevel } from '../lib/auth.types';

interface PermissionResult {
  can: (action: AuthAction, resource: AuthResource) => boolean;
  accessLevel: (resource: AuthResource) => AccessLevel;
  role: Role | null;
}

// Static permission matrix — RLS is the authoritative enforcement layer.
// This hook is for UX only (hiding sidebar items, disabling buttons).
const PERMISSIONS: Record<Role, Record<AuthResource, { actions: AuthAction[]; level: AccessLevel }>> = {
  owner: {
    dashboard:    { actions: ['view'], level: 'full' },
    appointments: { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    clients:      { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    pos:          { actions: ['view', 'create'], level: 'full' },
    services:     { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    products:     { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    team:         { actions: ['view', 'create', 'edit', 'delete', 'manage'], level: 'full' },
    accounting:   { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    suppliers:    { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    settings:     { actions: ['view', 'edit'], level: 'full' },
    billing:      { actions: ['view', 'manage'], level: 'full' },
    invitations:  { actions: ['view', 'create', 'delete'], level: 'full' },
    audit_log:    { actions: ['view'], level: 'full' },
  },
  manager: {
    dashboard:    { actions: ['view'], level: 'full' },
    appointments: { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    clients:      { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    pos:          { actions: ['view', 'create'], level: 'full' },
    services:     { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    products:     { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    team:         { actions: ['view', 'create', 'edit', 'delete', 'manage'], level: 'full' },
    accounting:   { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    suppliers:    { actions: ['view', 'create', 'edit', 'delete'], level: 'full' },
    settings:     { actions: ['view', 'edit'], level: 'full' },
    billing:      { actions: [], level: 'none' },
    invitations:  { actions: ['view', 'create', 'delete'], level: 'full' },
    audit_log:    { actions: ['view'], level: 'full' },
  },
  stylist: {
    dashboard:    { actions: ['view'], level: 'own' },
    appointments: { actions: ['view'], level: 'own' },
    clients:      { actions: ['view'], level: 'linked' },
    pos:          { actions: ['view', 'create'], level: 'full' },
    services:     { actions: ['view'], level: 'full' },
    products:     { actions: ['view'], level: 'full' },
    team:         { actions: ['view', 'edit'], level: 'own' },
    accounting:   { actions: [], level: 'none' },
    suppliers:    { actions: [], level: 'none' },
    settings:     { actions: [], level: 'none' },
    billing:      { actions: [], level: 'none' },
    invitations:  { actions: [], level: 'none' },
    audit_log:    { actions: [], level: 'none' },
  },
  receptionist: {
    dashboard:    { actions: ['view'], level: 'summary' },
    appointments: { actions: ['view', 'create', 'edit'], level: 'full' },
    clients:      { actions: ['view', 'create', 'edit'], level: 'full' },
    pos:          { actions: ['view', 'create'], level: 'full' },
    services:     { actions: ['view'], level: 'full' },
    products:     { actions: ['view'], level: 'full' },
    team:         { actions: ['view'], level: 'own' },
    accounting:   { actions: [], level: 'none' },
    suppliers:    { actions: [], level: 'none' },
    settings:     { actions: [], level: 'none' },
    billing:      { actions: [], level: 'none' },
    invitations:  { actions: [], level: 'none' },
    audit_log:    { actions: [], level: 'none' },
  },
};

export function usePermissions(role: Role | null): PermissionResult {
  return useMemo(() => ({
    role,
    can: (action: AuthAction, resource: AuthResource): boolean => {
      if (!role) return false;
      const resourcePerms = PERMISSIONS[role]?.[resource];
      if (!resourcePerms) return false;
      return resourcePerms.actions.includes(action);
    },
    accessLevel: (resource: AuthResource): AccessLevel => {
      if (!role) return 'none';
      return PERMISSIONS[role]?.[resource]?.level ?? 'none';
    },
  }), [role]);
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add hooks/usePermissions.ts
git commit -m "feat: add usePermissions hook with static role-based permission matrix"
```

---

## Task 5: AuthContext

**Files:**
- Create: `context/AuthContext.tsx`... wait, this file already exists as `context/AppContext.tsx`. We create a NEW file alongside it.
- Create: `context/AuthContext.tsx`

- [ ] **Step 1: Create AuthContext with full auth state management**

```typescript
// context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type {
  Role,
  Profile,
  SalonMembership,
  ActiveSalon,
} from '../lib/auth.types';

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
  signOut: () => Promise<void>;

  // Salon actions
  switchSalon: (salonId: string) => void;
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

  // Fetch profile from public.profiles
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, avatar_url')
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
        id, salon_id, profile_id, role, status,
        salon:salons!inner(id, name, slug, logo_url, currency, timezone)
      `)
      .eq('profile_id', userId)
      .eq('status', 'active')
      .is('deleted_at', null);

    if (error) {
      console.error('Failed to fetch memberships:', error.message);
      return [];
    }

    // Supabase returns salon as object (not array) due to !inner
    return (data || []).map((m: any) => ({
      id: m.id,
      salon_id: m.salon_id,
      profile_id: m.profile_id,
      role: m.role as Role,
      status: m.status,
      salon: m.salon,
    }));
  }, []);

  // Set salon context for RLS
  const setSalonContext = useCallback(async (salonId: string, userRole: string) => {
    const { error } = await supabase.rpc('set_session_context', {
      p_salon_id: salonId,
      p_user_role: userRole,
    });
    if (error) {
      console.error('Failed to set session context:', error.message);
    }
  }, []);

  // Switch active salon
  const switchSalon = useCallback((salonId: string) => {
    const membership = memberships.find(m => m.salon_id === salonId);
    if (!membership) {
      console.error('No membership found for salon:', salonId);
      return;
    }
    setActiveSalon(membership.salon);
    setRole(membership.role);
    // Persist last salon choice
    localStorage.setItem('lastSalonId', salonId);
    // Set RLS context (fire-and-forget, next query will use it)
    setSalonContext(salonId, membership.role);
  }, [memberships, setSalonContext]);

  // Initialize auth state on mount
  const initializeAuth = useCallback(async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();

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
        await setSalonContext(m.salon_id, m.role);
      } else if (userMemberships.length > 1) {
        // Try to restore last salon
        const lastSalonId = localStorage.getItem('lastSalonId');
        const lastMembership = lastSalonId
          ? userMemberships.find(m => m.salon_id === lastSalonId)
          : null;
        if (lastMembership) {
          setActiveSalon(lastMembership.salon);
          setRole(lastMembership.role);
          await setSalonContext(lastMembership.salon_id, lastMembership.role);
        }
        // If no last salon, user will be shown the salon picker
      }
    } catch (err) {
      console.error('Auth initialization failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile, fetchMemberships, setSalonContext]);

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
            await setSalonContext(m.salon_id, m.role);
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
  }, [initializeAuth, fetchProfile, fetchMemberships, setSalonContext]);

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

          // If active salon membership was revoked, clear it
          if (activeSalon) {
            const stillMember = updated.find(m => m.salon_id === activeSalon.id);
            if (!stillMember) {
              setActiveSalon(null);
              setRole(null);
              localStorage.removeItem('lastSalonId');
            } else if (stillMember.role !== role) {
              // Role changed
              setRole(stillMember.role);
              await setSalonContext(activeSalon.id, stillMember.role);
            }
          }
        }
      )
      .subscribe();

    membershipChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeSalon, role, fetchMemberships, setSalonContext]);

  // --- Auth Actions ---

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, firstName: string, lastName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
      },
    });
    return { error: error?.message ?? null };
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const createSalon = useCallback(async (name: string, timezone = 'Europe/Paris', currency = 'EUR') => {
    const { data, error } = await supabase.rpc('create_salon', {
      p_name: name,
      p_timezone: timezone,
      p_currency: currency,
    });

    if (error) {
      return { salonId: null, error: error.message };
    }

    // Refetch memberships after salon creation
    if (user) {
      const updated = await fetchMemberships(user.id);
      setMemberships(updated);
      const newMembership = updated.find(m => m.salon_id === data);
      if (newMembership) {
        setActiveSalon(newMembership.salon);
        setRole(newMembership.role);
        await setSalonContext(newMembership.salon_id, newMembership.role);
        localStorage.setItem('lastSalonId', newMembership.salon_id);
      }
    }

    return { salonId: data as string, error: null };
  }, [user, fetchMemberships, setSalonContext]);

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
    signOut,
    switchSalon,
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
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add context/AuthContext.tsx
git commit -m "feat: add AuthContext with Supabase auth, salon switching, real-time membership tracking"
```

---

## Task 6: ProtectedRoute Component

**Files:**
- Create: `components/ProtectedRoute.tsx`

- [ ] **Step 1: Create the route guard component**

```typescript
// components/ProtectedRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import type { AuthAction, AuthResource } from '../lib/auth.types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Optional permission check. If omitted, only checks authentication + active salon. */
  action?: AuthAction;
  resource?: AuthResource;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, action, resource }) => {
  const { isAuthenticated, isLoading, activeSalon, memberships } = useAuth();
  const { can } = usePermissions(useAuth().role);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  // Not logged in → login page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but no active salon
  if (!activeSalon) {
    // If user has memberships but none selected → salon picker
    if (memberships.length > 0) {
      return <Navigate to="/select-salon" replace />;
    }
    // No memberships at all → create salon page
    return <Navigate to="/create-salon" replace />;
  }

  // Permission check (if specified)
  if (action && resource && !can(action, resource)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/ProtectedRoute.tsx
git commit -m "feat: add ProtectedRoute component with auth, salon, and permission guards"
```

---

## Task 7: Login Page

**Files:**
- Create: `pages/LoginPage.tsx`

- [ ] **Step 1: Create the login page**

```typescript
// pages/LoginPage.tsx
import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Loader2, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { signIn, signInWithMagicLink, isAuthenticated, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [mode, setMode] = useState<'password' | 'magic'>('password');

  // If already authenticated, redirect
  if (!authLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError(signInError);
    }
    setIsSubmitting(false);
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: linkError } = await signInWithMagicLink(email);
    if (linkError) {
      setError(linkError);
    } else {
      setMagicLinkSent(true);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white font-bold text-2xl shadow-lg mb-4">
            L
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Lumière Beauty</h1>
          <p className="text-sm text-slate-500 mt-1">Connectez-vous à votre espace</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8">
          {magicLinkSent ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mb-4">
                <Mail size={24} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Vérifiez votre email</h2>
              <p className="text-sm text-slate-500">
                Un lien de connexion a été envoyé à <strong>{email}</strong>.
                Cliquez sur le lien dans l'email pour vous connecter.
              </p>
              <button
                onClick={() => setMagicLinkSent(false)}
                className="mt-6 text-sm text-slate-600 hover:text-slate-900 underline"
              >
                Renvoyer ou utiliser un autre email
              </button>
            </div>
          ) : (
            <>
              {/* Mode tabs */}
              <div className="flex rounded-xl bg-slate-50 p-1 mb-6">
                <button
                  onClick={() => { setMode('password'); setError(null); }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === 'password'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Mot de passe
                </button>
                <button
                  onClick={() => { setMode('magic'); setError(null); }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === 'magic'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Lien magique
                </button>
              </div>

              <form onSubmit={mode === 'password' ? handlePasswordLogin : handleMagicLink}>
                {/* Email */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vous@exemple.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all"
                    />
                  </div>
                </div>

                {/* Password (only in password mode) */}
                {mode === 'password' && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : mode === 'magic' ? (
                    <>
                      <Sparkles size={18} />
                      Envoyer le lien magique
                    </>
                  ) : (
                    'Se connecter'
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-slate-500 mt-6">
          Pas encore de compte ?{' '}
          <Link to="/signup" className="text-slate-900 font-medium hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add pages/LoginPage.tsx
git commit -m "feat: add login page with password and magic link modes"
```

---

## Task 8: Signup Page

**Files:**
- Create: `pages/SignupPage.tsx`

- [ ] **Step 1: Create the signup page**

```typescript
// pages/SignupPage.tsx
import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, Loader2 } from 'lucide-react';

export const SignupPage: React.FC = () => {
  const { signUp, isAuthenticated, isLoading: authLoading } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!authLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: signUpError } = await signUp(email, password, firstName, lastName);
    if (signUpError) {
      setError(signUpError);
    } else {
      setSuccess(true);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white font-bold text-2xl shadow-lg mb-4">
            L
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Créer un compte</h1>
          <p className="text-sm text-slate-500 mt-1">Commencez à gérer votre salon</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8">
          {success ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mb-4">
                <Mail size={24} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Vérifiez votre email</h2>
              <p className="text-sm text-slate-500">
                Un email de confirmation a été envoyé à <strong>{email}</strong>.
                Cliquez sur le lien pour activer votre compte.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Prénom</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Marie"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Dupont"
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 caractères"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Créer mon compte'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-slate-900 font-medium hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add pages/SignupPage.tsx
git commit -m "feat: add signup page with name, email, password form"
```

---

## Task 9: Create Salon Page

**Files:**
- Create: `pages/CreateSalonPage.tsx`

- [ ] **Step 1: Create the salon creation page**

This page is shown after signup when the user has no salon memberships.

```typescript
// pages/CreateSalonPage.tsx
import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Store, Loader2, Globe, Banknote } from 'lucide-react';

export const CreateSalonPage: React.FC = () => {
  const { isAuthenticated, isLoading, memberships, activeSalon, createSalon, signOut } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('Europe/Paris');
  const [currency, setCurrency] = useState('EUR');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8fafc]">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If user already has a salon, go to dashboard
  if (activeSalon) {
    return <Navigate to="/dashboard" replace />;
  }

  // If user has memberships but none active, go to picker
  if (memberships.length > 0) {
    return <Navigate to="/select-salon" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: createError } = await createSalon(name, timezone, currency);
    if (createError) {
      setError(createError);
    } else {
      navigate('/dashboard');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-lg mb-4">
            <Store size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Créer votre salon</h1>
          <p className="text-sm text-slate-500 mt-1">Configurez votre espace de travail</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom du salon</label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mon Salon Beauté"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Fuseau horaire</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all appearance-none"
                  >
                    <option value="Europe/Paris">Paris (GMT+1)</option>
                    <option value="Africa/Casablanca">Casablanca (GMT+1)</option>
                    <option value="Europe/London">Londres (GMT)</option>
                    <option value="America/New_York">New York (GMT-5)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Devise</label>
                <div className="relative">
                  <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all appearance-none"
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="MAD">MAD (د.م.)</option>
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Créer le salon'}
            </button>
          </form>
        </div>

        <button
          onClick={signOut}
          className="block mx-auto mt-6 text-sm text-slate-500 hover:text-slate-700 underline"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add pages/CreateSalonPage.tsx
git commit -m "feat: add create salon page with name, timezone, currency form"
```

---

## Task 10: Salon Picker Page

**Files:**
- Create: `pages/SalonPickerPage.tsx`

- [ ] **Step 1: Create the salon picker page**

```typescript
// pages/SalonPickerPage.tsx
import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Store, ChevronRight, Plus } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  manager: 'Manager',
  stylist: 'Styliste',
  receptionist: 'Réceptionniste',
};

export const SalonPickerPage: React.FC = () => {
  const { isAuthenticated, isLoading, memberships, activeSalon, switchSalon, signOut } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8fafc]">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (memberships.length === 0) {
    return <Navigate to="/create-salon" replace />;
  }

  // If salon already selected, go to dashboard
  if (activeSalon) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSelect = (salonId: string) => {
    switchSalon(salonId);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Choisir un salon</h1>
          <p className="text-sm text-slate-500 mt-1">Sélectionnez l'espace de travail</p>
        </div>

        <div className="space-y-3">
          {memberships.map((m) => (
            <button
              key={m.id}
              onClick={() => handleSelect(m.salon_id)}
              className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:border-slate-300 hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-md">
                {m.salon.logo_url ? (
                  <img src={m.salon.logo_url} alt="" className="w-full h-full rounded-xl object-cover" />
                ) : (
                  m.salon.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold text-slate-900">{m.salon.name}</div>
                <div className="text-xs text-slate-500">{ROLE_LABELS[m.role] || m.role}</div>
              </div>
              <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
            </button>
          ))}

          {/* Create new salon button */}
          <button
            onClick={() => navigate('/create-salon')}
            className="w-full flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-100 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-slate-600 shrink-0">
              <Plus size={20} />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-slate-600">Créer un nouveau salon</div>
            </div>
          </button>
        </div>

        <button
          onClick={signOut}
          className="block mx-auto mt-8 text-sm text-slate-500 hover:text-slate-700 underline"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add pages/SalonPickerPage.tsx
git commit -m "feat: add salon picker page for multi-salon users"
```

---

## Task 11: Accept Invitation Page

**Files:**
- Create: `pages/AcceptInvitationPage.tsx`

- [ ] **Step 1: Create the invitation acceptance page**

```typescript
// pages/AcceptInvitationPage.tsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export const AcceptInvitationPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  // If not logged in, redirect to signup with return URL
  if (!authLoading && !isAuthenticated) {
    const returnUrl = `/accept-invitation?token=${token}`;
    return <Navigate to={`/signup?redirect=${encodeURIComponent(returnUrl)}`} replace />;
  }

  // No token
  if (!token) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    if (!user || accepted) return;

    const acceptInvitation = async () => {
      const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });

      if (error) {
        setStatus('error');
        setErrorMessage(
          error.message.includes('expired')
            ? "Cette invitation a expiré. Demandez une nouvelle invitation."
            : error.message.includes('already')
            ? "Vous êtes déjà membre de ce salon."
            : error.message
        );
      } else {
        setStatus('success');
        setAccepted(true);
      }
    };

    acceptInvitation();
  }, [user, token, accepted]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8fafc]">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 size={40} className="animate-spin text-slate-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-900">Acceptation en cours...</h2>
              <p className="text-sm text-slate-500 mt-1">Vérification de votre invitation</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 mx-auto mb-4">
                <CheckCircle2 size={28} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Invitation acceptée !</h2>
              <p className="text-sm text-slate-500 mt-1">Vous avez rejoint le salon avec succès.</p>
              <button
                onClick={() => navigate('/select-salon')}
                className="mt-6 px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all"
              >
                Continuer
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-rose-50 text-rose-600 mx-auto mb-4">
                <XCircle size={28} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Erreur</h2>
              <p className="text-sm text-slate-500 mt-1">{errorMessage}</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="mt-6 px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all"
              >
                Retour à l'accueil
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add pages/AcceptInvitationPage.tsx
git commit -m "feat: add invitation acceptance page with token validation"
```

---

## Task 12: Update Layout with Real User Data and Permission-Gated Sidebar

**Files:**
- Modify: `components/Layout.tsx`

- [ ] **Step 1: Update Layout.tsx to use AuthContext and permissions**

Replace the entire content of `components/Layout.tsx` with:

```typescript
// components/Layout.tsx
import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Scissors,
  Calendar,
  ShoppingBag,
  CreditCard,
  BarChart3,
  Search,
  Settings,
  Truck,
  Smile,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import type { AuthResource } from '../lib/auth.types';

interface LayoutProps {
  children: React.ReactNode;
  activeModule: string;
  onNavigate: (module: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  resource: AuthResource;
}

interface SidebarItemProps {
  icon: any;
  label: string;
  active: boolean;
  onClick: () => void;
  collapsed: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  manager: 'Manager',
  stylist: 'Styliste',
  receptionist: 'Réceptionniste',
};

const SidebarItem: React.FC<SidebarItemProps> = ({
  icon: Icon,
  label,
  active,
  onClick,
  collapsed,
}) => (
  <button
    onClick={onClick}
    className={`
      group relative flex items-center w-full rounded-xl transition-all duration-200 ease-out my-1
      ${collapsed ? 'justify-center px-0 py-3' : 'px-4 py-3 gap-3.5'}
      ${active
        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }
    `}
    title={collapsed ? label : ''}
  >
    <Icon
      size={collapsed ? 24 : 20}
      strokeWidth={active ? 2 : 1.5}
      className={`
        shrink-0 transition-colors duration-200
        ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}
      `}
    />
    {!collapsed && (
      <span className={`text-sm font-medium tracking-wide whitespace-nowrap ${active ? 'font-semibold' : ''}`}>
        {label}
      </span>
    )}
    {collapsed && active && (
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-slate-900 rounded-l-full" />
    )}
  </button>
);

export const Layout: React.FC<LayoutProps> = ({ children, activeModule, onNavigate }) => {
  const { profile, activeSalon, role, memberships, switchSalon, signOut } = useAuth();
  const { can } = usePermissions(role);
  const [collapsed, setCollapsed] = useState(false);
  const [showSalonMenu, setShowSalonMenu] = useState(false);

  const mainNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard, resource: 'dashboard' },
    { id: 'calendar', label: 'Agenda', icon: Calendar, resource: 'appointments' },
    { id: 'clients', label: 'Clients', icon: Users, resource: 'clients' },
    { id: 'pos', label: 'Caisse', icon: CreditCard, resource: 'pos' },
    { id: 'accounting', label: 'Finances', icon: BarChart3, resource: 'accounting' },
  ];

  const managementNavItems: NavItem[] = [
    { id: 'team', label: 'Équipe', icon: Smile, resource: 'team' },
    { id: 'services', label: 'Services', icon: Scissors, resource: 'services' },
    { id: 'products', label: 'Produits', icon: ShoppingBag, resource: 'products' },
    { id: 'suppliers', label: 'Fournisseurs', icon: Truck, resource: 'suppliers' },
  ];

  // Filter nav items by permission
  const visibleMainNav = mainNavItems.filter(item => can('view', item.resource));
  const visibleMgmtNav = managementNavItems.filter(item => can('view', item.resource));
  const canViewSettings = can('view', 'settings');

  // User display
  const displayName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
    : '...';
  const initials = profile
    ? `${(profile.first_name || '?')[0]}${(profile.last_name || '?')[0]}`.toUpperCase()
    : '??';
  const roleLabel = role ? ROLE_LABELS[role] || role : '';

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans text-slate-900">
      {/* Sidebar */}
      <aside
        className={`
          bg-white border-r border-slate-100 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] z-30 relative shadow-[4px_0_24px_-12px_rgba(0,0,0,0.02)]
          ${collapsed ? 'w-24' : 'w-72'}
        `}
      >
        {/* Header: Salon name + switcher */}
        <div className={`h-20 flex items-center transition-all shrink-0 ${collapsed ? 'justify-center px-0' : 'justify-between px-6'}`}>
          {!collapsed && (
            <div className="relative flex items-center gap-3 animate-in fade-in duration-300">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white font-bold text-base shrink-0 shadow-md shadow-slate-900/20">
                {activeSalon?.name ? activeSalon.name.charAt(0) : 'L'}
              </div>
              <div className="flex flex-col">
                {memberships.length > 1 ? (
                  <button
                    onClick={() => setShowSalonMenu(!showSalonMenu)}
                    className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                  >
                    <span className="font-bold text-lg tracking-tight text-slate-900 leading-none">
                      {activeSalon?.name || 'Salon'}
                    </span>
                    <ChevronDown size={14} className="text-slate-400" />
                  </button>
                ) : (
                  <span className="font-bold text-lg tracking-tight text-slate-900 leading-none">
                    {activeSalon?.name || 'Salon'}
                  </span>
                )}
              </div>

              {/* Salon dropdown */}
              {showSalonMenu && memberships.length > 1 && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-lg z-50 py-2">
                  {memberships.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        switchSalon(m.salon_id);
                        setShowSalonMenu(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                        m.salon_id === activeSalon?.id ? 'bg-slate-50 font-medium' : ''
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {m.salon.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-slate-900">{m.salon.name}</div>
                        <div className="text-xs text-slate-400">{ROLE_LABELS[m.role]}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all ${collapsed ? 'mx-auto' : ''}`}
          >
            {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.5} /> : <PanelLeftClose size={18} strokeWidth={1.5} />}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-6 px-4 custom-scrollbar space-y-1">
          {!collapsed && (
            <div className="px-4 mb-4 text-[11px] font-bold uppercase text-slate-400 tracking-widest">
              Menu Principal
            </div>
          )}
          {visibleMainNav.map(item => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeModule === item.id}
              onClick={() => onNavigate(item.id)}
              collapsed={collapsed}
            />
          ))}
        </div>

        {/* Footer: Management & Settings */}
        <div className="p-4 border-t border-slate-100 bg-white space-y-1">
          {!collapsed && visibleMgmtNav.length > 0 && (
            <div className="px-4 mb-2 text-[11px] font-bold uppercase text-slate-400 tracking-widest">
              Gestion
            </div>
          )}
          {visibleMgmtNav.map(item => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeModule === item.id}
              onClick={() => onNavigate(item.id)}
              collapsed={collapsed}
            />
          ))}

          {canViewSettings && (
            <>
              {visibleMgmtNav.length > 0 && <div className="my-2 border-t border-slate-50 mx-2" />}
              <SidebarItem
                icon={Settings}
                label="Réglages"
                active={activeModule === 'settings'}
                onClick={() => onNavigate('settings')}
                collapsed={collapsed}
              />
            </>
          )}
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
        {/* Top Bar */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-6 shrink-0 z-20 sticky top-0">
          <div className="relative max-w-md w-full hidden md:block group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-600 transition-colors" size={18} strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Rechercher (Clients, Services, Factures...)"
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm outline-none ring-1 ring-transparent focus:ring-slate-200 focus:bg-white transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-5 ml-auto">
            <button className="relative p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-full transition-all">
              <Bell size={20} strokeWidth={1.5} />
            </button>

            <div className="h-8 w-px bg-slate-200" />

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block leading-tight">
                <div className="text-sm font-bold text-slate-800">{displayName}</div>
                <div className="text-[11px] text-slate-500 font-medium">{roleLabel}</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md ring-2 ring-white">
                <span className="font-bold text-sm">{initials}</span>
              </div>
              <button
                onClick={signOut}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-full transition-all"
                title="Se déconnecter"
              >
                <LogOut size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-auto relative p-6 scroll-smooth custom-scrollbar">
          {children}
        </main>
      </div>

      {/* Click-outside to close salon menu */}
      {showSalonMenu && (
        <div className="fixed inset-0 z-20" onClick={() => setShowSalonMenu(false)} />
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/Layout.tsx
git commit -m "feat: update Layout with real user data, permission-gated sidebar, salon switcher"
```

---

## Task 13: Wire Up App.tsx with Auth Routes

**Files:**
- Modify: `App.tsx`
- Modify: `index.tsx`

- [ ] **Step 1: Update index.tsx to add QueryClientProvider**

Replace the entire content of `index.tsx`:

```typescript
// index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './src/index.css';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 2: Update App.tsx with auth routes**

Replace the entire content of `App.tsx`:

```typescript
// App.tsx
import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

// Auth pages
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { CreateSalonPage } from './pages/CreateSalonPage';
import { SalonPickerPage } from './pages/SalonPickerPage';
import { AcceptInvitationPage } from './pages/AcceptInvitationPage';

// Module imports (unchanged)
import { DashboardModule } from './modules/dashboard/DashboardModule';
import { ServicesModule } from './modules/services/ServicesModule';
import { ClientsModule } from './modules/clients/ClientsModule';
import { TeamModule } from './modules/team/TeamModule';
import { ProductsModule } from './modules/products/ProductsModule';
import { AppointmentsModule } from './modules/appointments/AppointmentsModule';
import { SuppliersModule } from './modules/suppliers/SuppliersModule';
import { SettingsModule } from './modules/settings/SettingsModule';
import { AccountingModule } from './modules/accounting/AccountingModule';
import { POSModule } from './modules/pos/POSModule';

const AppContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentModule = location.pathname.substring(1) || 'dashboard';

  return (
    <Layout activeModule={currentModule} onNavigate={(path) => navigate(`/${path}`)}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardModule />} />
        <Route path="/services" element={<ServicesModule />} />
        <Route path="/clients" element={<ClientsModule />} />
        <Route path="/team" element={<TeamModule />} />
        <Route path="/calendar" element={<AppointmentsModule />} />
        <Route path="/products" element={<ProductsModule />} />
        <Route path="/suppliers" element={
          <ProtectedRoute action="view" resource="suppliers"><SuppliersModule /></ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute action="view" resource="settings"><SettingsModule /></ProtectedRoute>
        } />
        <Route path="/pos" element={<POSModule />} />
        <Route path="/accounting" element={
          <ProtectedRoute action="view" resource="accounting"><AccountingModule /></ProtectedRoute>
        } />
      </Routes>
    </Layout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <HashRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/accept-invitation" element={<AcceptInvitationPage />} />

            {/* Auth-required, no-salon routes */}
            <Route path="/create-salon" element={<CreateSalonPage />} />
            <Route path="/select-salon" element={<SalonPickerPage />} />

            {/* Protected app routes */}
            <Route path="/*" element={
              <ProtectedRoute>
                <AppContent />
              </ProtectedRoute>
            } />
          </Routes>
        </HashRouter>
      </AppProvider>
    </AuthProvider>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds. The app now has auth routing, but modules still use mock AppContext data (unchanged until Plans 2-4).

- [ ] **Step 4: Commit**

```bash
git add App.tsx index.tsx
git commit -m "feat: wire up auth routes, QueryClientProvider, and ProtectedRoute guards"
```

---

## Task 14: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add Auth section to CLAUDE.md**

Add the following section after the "Database" section in CLAUDE.md:

```markdown
## Authentication & Authorization

- **Auth Provider**: Supabase Auth (email+password, magic link)
- **Auth Context**: `context/AuthContext.tsx` — provides user, session, profile, activeSalon, role, memberships
- **Access Hook**: `useAuth()` — access auth state from any component
- **Permissions**: `hooks/usePermissions.ts` — static role-based permission matrix (UX only, RLS is authoritative)
- **Route Guards**: `components/ProtectedRoute.tsx` — redirects unauthorized users
- **Supabase Client**: `lib/supabase.ts` — typed singleton, uses `Database` from `lib/database.types.ts`
- **Auth Types**: `lib/auth.types.ts` — Role, Profile, SalonMembership, permission types

### Auth Flow
1. Unauthenticated → `/login` or `/signup`
2. Authenticated, no salon → `/create-salon`
3. Authenticated, multiple salons → `/select-salon`
4. Authenticated + active salon → main app (Layout + modules)

### Role-Based Sidebar Visibility
- **owner/manager**: All items visible
- **stylist**: No accounting, suppliers, settings
- **receptionist**: No accounting, suppliers, settings

### Session Context
Every Supabase query requires salon context set first:
```typescript
await supabase.rpc('set_session_context', { p_salon_id: salonId, p_user_role: role });
```
AuthContext calls this automatically on salon selection. The `get_active_salon()` and `get_user_role()` Postgres functions read these session variables for RLS.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add auth & authorization section to CLAUDE.md"
```

---

## Task 15: Smoke Test

**No files created.** Verification only.

- [ ] **Step 1: Build the project**

```bash
npm run build
```

Expected: Build succeeds with zero errors. Warnings about unused imports are acceptable.

- [ ] **Step 2: Start dev server and verify routes**

```bash
npm run dev
```

Open browser to `http://localhost:3000`. Verify:

1. **Redirect to login**: App should redirect to `/#/login` since no session exists
2. **Login page renders**: Should show email/password form with "Mot de passe" and "Lien magique" tabs
3. **Signup link works**: Click "Créer un compte" → navigates to `/#/signup`
4. **Signup page renders**: Should show first name, last name, email, password fields
5. **Back to login**: Click "Se connecter" → navigates back to `/#/login`

- [ ] **Step 3: Test auth flow (manual)**

1. Go to `/#/signup`, create an account with a real email
2. Check Supabase dashboard → Authentication → Users → verify user was created
3. Check `profiles` table → verify auto-created profile row
4. If email confirmation is disabled: should auto-redirect to `/#/create-salon`
5. Create a salon → should redirect to `/#/dashboard`
6. Verify sidebar shows your name and "Propriétaire" role
7. Sign out → returns to `/#/login`

- [ ] **Step 4: Commit any fixes needed**

If the smoke test revealed any issues, fix them and commit with a descriptive message.
