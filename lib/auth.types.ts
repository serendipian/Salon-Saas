import type { Session, User } from '@supabase/supabase-js';

export type Role = 'owner' | 'manager' | 'stylist' | 'receptionist';

export type SubscriptionTier = 'trial' | 'free' | 'pro' | 'enterprise' | 'past_due';

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
    subscription_tier: SubscriptionTier;
  };
}

export interface ActiveSalon {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  currency: string;
  timezone: string;
  subscription_tier: SubscriptionTier;
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

export interface Subscription {
  id: string;
  salon_id: string;
  plan_id: string;
  status: 'trial' | 'active' | 'past_due' | 'cancelled';
  billing_cycle: 'monthly' | 'yearly';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  currency: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}
