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
