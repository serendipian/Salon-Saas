# Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone user profile page (`/profile`) with avatar upload, personal info editing, role display, schedule view, performance stats, password change, preferences, and danger zone — all conditionally rendered by role and staff linkage.

**Architecture:** New route at `/profile` inside the Layout shell. Profile data is read/written via TanStack Query hooks against the `profiles` table. Avatar uploads go to a Supabase Storage `avatars` bucket. A linked staff member query connects the profile to salon-level data (schedule, appointments). The topbar gets an avatar dropdown menu replacing the inline logout button.

**Tech Stack:** React 19, TypeScript, TanStack Query, Supabase (Postgres, Auth, Storage, Realtime), Tailwind CSS, Lucide React icons, existing FormElements components.

---

## Task 1: Database Migration — Profile Fields + Invitation Linking

**Files:**
- Create: `supabase/migrations/20260404100000_profile_page.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Add profile fields for user preferences
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'fr';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_email BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_sms BOOLEAN NOT NULL DEFAULT false;

-- Add staff_member_id to invitations for linking
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS staff_member_id UUID REFERENCES staff_members(id);

-- Update accept_invitation to link existing staff member when staff_member_id is set
CREATE OR REPLACE FUNCTION accept_invitation(p_token TEXT)
RETURNS UUID AS $$
DECLARE
  v_invitation RECORD;
  v_membership_id UUID;
  v_profile_id UUID;
BEGIN
  v_profile_id := auth.uid();

  SELECT * INTO v_invitation FROM invitations
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > now();

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  IF EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = v_invitation.salon_id AND profile_id = v_profile_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'You are already a member of this salon';
  END IF;

  INSERT INTO salon_memberships (salon_id, profile_id, role, status, invited_by, invited_at, accepted_at)
  VALUES (v_invitation.salon_id, v_profile_id, v_invitation.role, 'active', v_invitation.invited_by, v_invitation.created_at, now())
  RETURNING id INTO v_membership_id;

  -- Link existing staff member OR create new one
  IF v_invitation.staff_member_id IS NOT NULL THEN
    UPDATE staff_members SET membership_id = v_membership_id
    WHERE id = v_invitation.staff_member_id AND salon_id = v_invitation.salon_id;
  ELSIF v_invitation.role = 'stylist' THEN
    DECLARE
      v_profile RECORD;
    BEGIN
      SELECT first_name, last_name, email INTO v_profile FROM profiles WHERE id = v_profile_id;
      INSERT INTO staff_members (salon_id, membership_id, first_name, last_name, email, role, color, active, commission_rate)
      VALUES (
        v_invitation.salon_id, v_membership_id,
        COALESCE(v_profile.first_name, ''), COALESCE(v_profile.last_name, ''),
        v_profile.email, 'Stylist',
        '#' || lpad(to_hex(floor(random() * 16777215)::int), 6, '0'),
        true, 0
      );
    END;
  END IF;

  UPDATE invitations SET accepted_at = now() WHERE id = v_invitation.id;
  RETURN v_membership_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can manage their own avatar folder
CREATE POLICY avatars_insert ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY avatars_update ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY avatars_delete ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY avatars_select ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`

Verify: Check Supabase dashboard that `profiles` has the new columns, `invitations` has `staff_member_id`, and the `avatars` bucket exists.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260404100000_profile_page.sql
git commit -m "feat: add profile fields, invitation linking, and avatars bucket migration"
```

---

## Task 2: Update Profile Type & AuthContext

**Files:**
- Modify: `lib/auth.types.ts`
- Modify: `context/AuthContext.tsx`

- [ ] **Step 1: Extend the Profile type**

In `lib/auth.types.ts`, update the `Profile` interface:

```typescript
export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  bio: string | null;
  language: string;
  notification_email: boolean;
  notification_sms: boolean;
}
```

- [ ] **Step 2: Update AuthContext fetchProfile to select new fields**

In `context/AuthContext.tsx`, update the `fetchProfile` function's select clause (line ~66):

```typescript
const { data, error } = await supabase
  .from('profiles')
  .select('id, email, first_name, last_name, avatar_url, phone, bio, language, notification_email, notification_sms')
  .eq('id', userId)
  .single();
```

- [ ] **Step 3: Add updateProfile and refreshProfile to AuthContext**

Add to the `AuthContextType` interface:

```typescript
updateProfile: (data: Partial<Profile>) => Promise<{ error: string | null }>;
refreshProfile: () => Promise<void>;
```

Add implementations inside `AuthProvider`:

```typescript
const updateProfile = useCallback(async (data: Partial<Profile>) => {
  if (!user) return { error: 'Not authenticated' };
  const { error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', user.id);
  if (error) return { error: error.message };
  // Refresh local profile state
  const updated = await fetchProfile(user.id);
  if (updated) setProfile(updated);
  return { error: null };
}, [user, fetchProfile]);

const refreshProfile = useCallback(async () => {
  if (!user) return;
  const updated = await fetchProfile(user.id);
  if (updated) setProfile(updated);
}, [user, fetchProfile]);
```

Add both to the `value` object and the `AuthContextType` interface.

- [ ] **Step 4: Commit**

```bash
git add lib/auth.types.ts context/AuthContext.tsx
git commit -m "feat: extend Profile type and add updateProfile to AuthContext"
```

---

## Task 3: Avatar Upload Hook

**Files:**
- Create: `hooks/useAvatarUpload.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function useAvatarUpload() {
  const { user, updateProfile } = useAuth();
  const { addToast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const uploadAvatar = async (file: File) => {
    if (!user) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      addToast({ type: 'error', message: 'Format accepté : JPEG, PNG ou WebP' });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      addToast({ type: 'error', message: 'La photo ne doit pas dépasser 2 Mo' });
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      // Append timestamp to bust cache
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: profileError } = await updateProfile({ avatar_url: avatarUrl });

      if (profileError) throw new Error(profileError);

      addToast({ type: 'success', message: 'Photo mise à jour' });
    } catch (err) {
      console.error('Avatar upload failed:', err);
      addToast({ type: 'error', message: 'Impossible de mettre à jour la photo' });
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadAvatar, isUploading };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useAvatarUpload.ts
git commit -m "feat: add useAvatarUpload hook for profile avatar uploads"
```

---

## Task 4: Linked Staff Member Hook

**Files:**
- Create: `hooks/useLinkedStaffMember.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toStaffMember } from '../modules/team/mappers';
import type { StaffMember } from '../types';

export function useLinkedStaffMember() {
  const { activeSalon, memberships, user } = useAuth();
  const salonId = activeSalon?.id ?? '';

  // Find the current user's membership ID for the active salon
  const membershipId = memberships.find(m => m.salon_id === salonId)?.id ?? '';

  const { data: linkedStaff = null, isLoading } = useQuery<StaffMember | null>({
    queryKey: ['linked-staff', salonId, membershipId],
    queryFn: async () => {
      if (!membershipId) return null;
      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .eq('salon_id', salonId)
        .eq('membership_id', membershipId)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return toStaffMember(data);
    },
    enabled: !!salonId && !!membershipId,
  });

  return { linkedStaff, isLoading };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useLinkedStaffMember.ts
git commit -m "feat: add useLinkedStaffMember hook to find staff record linked to current user"
```

---

## Task 5: Profile Identity Section (Photo + Personal Info)

**Files:**
- Create: `pages/profile/ProfileIdentity.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React, { useState, useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAvatarUpload } from '../../hooks/useAvatarUpload';
import { useToast } from '../../context/ToastContext';
import { Input, TextArea, Section } from '../../components/FormElements';

export const ProfileIdentity: React.FC = () => {
  const { profile, updateProfile } = useAuth();
  const { uploadAvatar, isUploading } = useAvatarUpload();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');

  const initials = `${(profile?.first_name || '?')[0]}${(profile?.last_name || '?')[0]}`.toUpperCase();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAvatar(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      addToast({ type: 'error', message: 'Le prénom et le nom sont requis' });
      return;
    }
    setIsSaving(true);
    const { error } = await updateProfile({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim() || null,
      bio: bio.trim() || null,
    });
    setIsSaving(false);
    if (error) {
      addToast({ type: 'error', message: 'Impossible de mettre à jour le profil' });
    } else {
      addToast({ type: 'success', message: 'Profil mis à jour' });
    }
  };

  return (
    <Section title="Identité">
      {/* Avatar */}
      <div className="flex items-center gap-6 mb-6">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative group w-24 h-24 rounded-full shrink-0 overflow-hidden"
          disabled={isUploading}
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-slate-900 text-white flex items-center justify-center">
              <span className="font-bold text-2xl">{initials}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {isUploading ? (
              <Loader2 size={24} className="text-white animate-spin" />
            ) : (
              <Camera size={24} className="text-white" />
            )}
          </div>
        </button>
        <div>
          <p className="text-sm font-medium text-slate-900">Photo de profil</p>
          <p className="text-xs text-slate-500 mt-0.5">JPEG, PNG ou WebP. Max 2 Mo.</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Prénom"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <Input
          label="Nom"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
      </div>
      <Input
        label="Email"
        value={profile?.email ?? ''}
        disabled
        className="mt-4"
      />
      <Input
        label="Téléphone"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="mt-4"
      />
      <TextArea
        label="Bio"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        rows={3}
        placeholder="Décrivez votre spécialité, votre expérience..."
        className="mt-4"
      />

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {isSaving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </Section>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add pages/profile/ProfileIdentity.tsx
git commit -m "feat: add ProfileIdentity section with avatar upload and personal info form"
```

---

## Task 6: Profile Salon & Role Section

**Files:**
- Create: `pages/profile/ProfileSalonRole.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React from 'react';
import { Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Section } from '../../components/FormElements';
import type { Role } from '../../lib/auth.types';

const ROLE_LABELS: Record<Role, string> = {
  owner: 'Propriétaire',
  manager: 'Manager',
  stylist: 'Styliste',
  receptionist: 'Réceptionniste',
};

const ROLE_COLORS: Record<Role, string> = {
  owner: 'bg-slate-100 text-slate-700',
  manager: 'bg-blue-50 text-blue-700',
  stylist: 'bg-pink-50 text-pink-700',
  receptionist: 'bg-amber-50 text-amber-700',
};

export const ProfileSalonRole: React.FC = () => {
  const { activeSalon, role, memberships } = useAuth();

  return (
    <Section title="Salon & Rôle">
      {/* Active salon */}
      {activeSalon && role && (
        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
            {activeSalon.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{activeSalon.name}</p>
            <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[role]}`}>
              {ROLE_LABELS[role]}
            </span>
          </div>
        </div>
      )}

      {/* All memberships (if multiple) */}
      {memberships.length > 1 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Tous mes salons</p>
          <div className="space-y-2">
            {memberships.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                <div className="flex items-center gap-3 min-w-0">
                  <Building2 size={16} className="text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-700 truncate">{m.salon.name}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${ROLE_COLORS[m.role]}`}>
                  {ROLE_LABELS[m.role]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add pages/profile/ProfileSalonRole.tsx
git commit -m "feat: add ProfileSalonRole section showing salon memberships and roles"
```

---

## Task 7: Profile Schedule Section

**Files:**
- Create: `pages/profile/ProfileSchedule.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React from 'react';
import { Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Section } from '../../components/FormElements';
import type { StaffMember } from '../../types';
import type { WorkSchedule } from '../../types';

const DAY_LABELS: Record<keyof WorkSchedule, string> = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
};

const DAY_ORDER: (keyof WorkSchedule)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

interface ProfileScheduleProps {
  linkedStaff: StaffMember;
}

export const ProfileSchedule: React.FC<ProfileScheduleProps> = ({ linkedStaff }) => {
  const navigate = useNavigate();
  const schedule = linkedStaff.schedule;

  return (
    <Section
      title="Mon Planning"
      action={
        <button
          onClick={() => navigate('/calendar')}
          className="text-xs font-medium text-pink-600 hover:text-pink-700 flex items-center gap-1"
        >
          <Calendar size={14} />
          Voir mon agenda
        </button>
      }
    >
      {schedule ? (
        <div className="space-y-1.5">
          {DAY_ORDER.map((day) => {
            const d = schedule[day];
            return (
              <div key={day} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50">
                <span className="text-sm font-medium text-slate-700 w-24">{DAY_LABELS[day]}</span>
                {d.isOpen ? (
                  <span className="text-sm text-slate-600">{d.start} — {d.end}</span>
                ) : (
                  <span className="text-sm text-slate-400 italic">Repos</span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-500 italic">Aucun planning défini. Contactez votre responsable.</p>
      )}
    </Section>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add pages/profile/ProfileSchedule.tsx
git commit -m "feat: add ProfileSchedule section showing linked staff weekly schedule"
```

---

## Task 8: Profile Performance Section

**Files:**
- Create: `pages/profile/ProfilePerformance.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Section } from '../../components/FormElements';
import { formatPrice } from '../../lib/format';
import type { StaffMember } from '../../types';

interface ProfilePerformanceProps {
  linkedStaff: StaffMember;
}

export const ProfilePerformance: React.FC<ProfilePerformanceProps> = ({ linkedStaff }) => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';

  // Current month boundaries
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const { data: stats } = useQuery({
    queryKey: ['profile-performance', salonId, linkedStaff.id, now.getMonth()],
    queryFn: async () => {
      // Count completed appointments this month
      const { count: appointmentCount, error: apptError } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('salon_id', salonId)
        .eq('staff_id', linkedStaff.id)
        .eq('status', 'COMPLETED')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .is('deleted_at', null);
      if (apptError) throw apptError;

      // Sum revenue from completed appointments
      const { data: revenueData, error: revError } = await supabase
        .from('appointments')
        .select('price')
        .eq('salon_id', salonId)
        .eq('staff_id', linkedStaff.id)
        .eq('status', 'COMPLETED')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .is('deleted_at', null);
      if (revError) throw revError;

      const revenue = (revenueData ?? []).reduce((sum, a) => sum + parseFloat(String(a.price)), 0);

      return {
        appointments: appointmentCount ?? 0,
        revenue,
      };
    },
    enabled: !!salonId,
  });

  return (
    <Section title="Mes Performances">
      <p className="text-xs text-slate-500 mb-4">Ce mois-ci</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <CalendarCheck size={16} className="text-pink-500" />
            <span className="text-xs font-medium text-slate-500">Rendez-vous</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats?.appointments ?? '—'}</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-emerald-500" />
            <span className="text-xs font-medium text-slate-500">Chiffre d'affaires</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {stats ? formatPrice(stats.revenue) : '—'}
          </p>
        </div>
      </div>
    </Section>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add pages/profile/ProfilePerformance.tsx
git commit -m "feat: add ProfilePerformance section with monthly appointment and revenue stats"
```

---

## Task 9: Profile Security Section

**Files:**
- Create: `pages/profile/ProfileSecurity.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Input, Section } from '../../components/FormElements';

export const ProfileSecurity: React.FC = () => {
  const { updatePassword } = useAuth();
  const { addToast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      addToast({ type: 'error', message: 'Le mot de passe doit contenir au moins 8 caractères' });
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast({ type: 'error', message: 'Les mots de passe ne correspondent pas' });
      return;
    }

    setIsSaving(true);
    const { error } = await updatePassword(newPassword);
    setIsSaving(false);

    if (error) {
      addToast({ type: 'error', message: error });
    } else {
      addToast({ type: 'success', message: 'Mot de passe mis à jour' });
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <Section title="Sécurité">
      <div className="space-y-4 max-w-sm">
        <Input
          label="Nouveau mot de passe"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Minimum 8 caractères"
          icon={Shield}
        />
        <Input
          label="Confirmer le mot de passe"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <button
          onClick={handleChangePassword}
          disabled={isSaving || !newPassword}
          className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {isSaving ? 'Mise à jour...' : 'Changer le mot de passe'}
        </button>
      </div>
    </Section>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add pages/profile/ProfileSecurity.tsx
git commit -m "feat: add ProfileSecurity section with password change form"
```

---

## Task 10: Profile Preferences Section

**Files:**
- Create: `pages/profile/ProfilePreferences.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React from 'react';
import { Globe, Mail, MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Section, Select } from '../../components/FormElements';

const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' },
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
];

export const ProfilePreferences: React.FC = () => {
  const { profile, updateProfile } = useAuth();
  const { addToast } = useToast();

  const handleLanguageChange = async (value: string | number) => {
    const { error } = await updateProfile({ language: String(value) });
    if (error) {
      addToast({ type: 'error', message: 'Impossible de modifier la langue' });
    } else {
      addToast({ type: 'success', message: 'Langue mise à jour' });
    }
  };

  const handleToggle = async (field: 'notification_email' | 'notification_sms', current: boolean) => {
    const { error } = await updateProfile({ [field]: !current });
    if (error) {
      addToast({ type: 'error', message: 'Impossible de modifier les préférences' });
    }
  };

  return (
    <Section title="Préférences">
      <div className="space-y-6">
        {/* Language */}
        <div className="max-w-xs">
          <Select
            label="Langue"
            value={profile?.language ?? 'fr'}
            onChange={handleLanguageChange}
            options={LANGUAGE_OPTIONS}
          />
        </div>

        {/* Notification toggles */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">Notifications</p>

          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <Mail size={16} className="text-slate-400" />
              <span className="text-sm text-slate-700">Notifications par email</span>
            </div>
            <input
              type="checkbox"
              checked={profile?.notification_email ?? true}
              onChange={() => handleToggle('notification_email', profile?.notification_email ?? true)}
              className="w-5 h-5 rounded border-slate-300 text-pink-500 focus:ring-pink-500"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <MessageSquare size={16} className="text-slate-400" />
              <span className="text-sm text-slate-700">Notifications par SMS</span>
            </div>
            <input
              type="checkbox"
              checked={profile?.notification_sms ?? false}
              onChange={() => handleToggle('notification_sms', profile?.notification_sms ?? false)}
              className="w-5 h-5 rounded border-slate-300 text-pink-500 focus:ring-pink-500"
            />
          </label>
        </div>
      </div>
    </Section>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add pages/profile/ProfilePreferences.tsx
git commit -m "feat: add ProfilePreferences section with language and notification toggles"
```

---

## Task 11: Profile Danger Zone Section

**Files:**
- Create: `pages/profile/ProfileDangerZone.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React, { useState } from 'react';
import { AlertTriangle, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const ProfileDangerZone: React.FC = () => {
  const { activeSalon, memberships, user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const salonId = activeSalon?.id ?? '';
  const currentMembership = memberships.find(m => m.salon_id === salonId);

  // Check if the user is the sole owner
  const isSoleOwner = currentMembership?.role === 'owner' &&
    !memberships.some(m => m.salon_id === salonId && m.role === 'owner' && m.profile_id !== user?.id);

  // Don't render for sole owners
  if (isSoleOwner || !currentMembership) return null;

  const handleLeave = async () => {
    setIsLeaving(true);
    const { error } = await supabase
      .from('salon_memberships')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', currentMembership.id);

    setIsLeaving(false);

    if (error) {
      addToast({ type: 'error', message: 'Impossible de quitter le salon' });
      return;
    }

    addToast({ type: 'success', message: 'Vous avez quitté le salon' });

    // Navigate to salon picker or create salon
    const remainingMemberships = memberships.filter(m => m.id !== currentMembership.id);
    if (remainingMemberships.length > 0) {
      navigate('/select-salon');
    } else {
      navigate('/create-salon');
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border-2 border-red-200 space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} className="text-red-500" />
        <h2 className="text-sm font-bold text-red-700 uppercase tracking-wide">Zone Dangereuse</h2>
      </div>

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-all"
        >
          <LogOut size={16} />
          Quitter ce salon
        </button>
      ) : (
        <div className="p-4 bg-red-50 rounded-xl space-y-3">
          <p className="text-sm text-red-700">
            Vous perdrez l'accès à <strong>{activeSalon?.name}</strong>. Cette action est irréversible.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirm(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              onClick={handleLeave}
              disabled={isLeaving}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50"
            >
              {isLeaving ? 'En cours...' : 'Quitter'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add pages/profile/ProfileDangerZone.tsx
git commit -m "feat: add ProfileDangerZone section with leave salon confirmation"
```

---

## Task 12: Profile Page (Main Container)

**Files:**
- Create: `pages/ProfilePage.tsx`

- [ ] **Step 1: Create the page component**

```typescript
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLinkedStaffMember } from '../hooks/useLinkedStaffMember';
import { ProfileIdentity } from './profile/ProfileIdentity';
import { ProfileSalonRole } from './profile/ProfileSalonRole';
import { ProfileSchedule } from './profile/ProfileSchedule';
import { ProfilePerformance } from './profile/ProfilePerformance';
import { ProfileSecurity } from './profile/ProfileSecurity';
import { ProfilePreferences } from './profile/ProfilePreferences';
import { ProfileDangerZone } from './profile/ProfileDangerZone';

export const ProfilePage: React.FC = () => {
  const { role } = useAuth();
  const { linkedStaff } = useLinkedStaffMember();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Mon Profil</h1>

      <ProfileIdentity />
      <ProfileSalonRole />

      {linkedStaff && <ProfileSchedule linkedStaff={linkedStaff} />}
      {linkedStaff && role === 'stylist' && <ProfilePerformance linkedStaff={linkedStaff} />}

      <ProfileSecurity />
      <ProfilePreferences />
      <ProfileDangerZone />
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add pages/ProfilePage.tsx
git commit -m "feat: add ProfilePage container with conditional section rendering"
```

---

## Task 13: Add Route and Navigation

**Files:**
- Modify: `App.tsx`
- Modify: `components/Layout.tsx`
- Modify: `components/MobileDrawer.tsx`

- [ ] **Step 1: Add the route in App.tsx**

Add the import at the top with other page imports (after line 18):

```typescript
import { ProfilePage } from './pages/ProfilePage';
```

Add the route inside `AppContent`'s `<Routes>`, after the settings route (after line 93):

```typescript
<Route path="/profile" element={
  <ErrorBoundary moduleName="Profil"><ProfilePage /></ErrorBoundary>
} />
```

Note: no `ProtectedRoute` wrapper with resource/action — all authenticated users can access their own profile.

- [ ] **Step 2: Add avatar dropdown to Layout.tsx topbar**

Add `User, ChevronDown` to the existing lucide imports if not already present. Add `useNavigate` import from react-router-dom. Add `UserCircle` to imports:

```typescript
import { UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
```

Inside the `Layout` component, add state and refs for the dropdown:

```typescript
const navigate = useNavigate();
const [showProfileMenu, setShowProfileMenu] = useState(false);
const profileMenuRef = useRef<HTMLDivElement>(null);
```

Add an effect to close on outside click and Escape:

```typescript
useEffect(() => {
  if (!showProfileMenu) return;

  const handleClickOutside = (e: MouseEvent) => {
    if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
      setShowProfileMenu(false);
    }
  };
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setShowProfileMenu(false);
  };

  document.addEventListener('mousedown', handleClickOutside);
  document.addEventListener('keydown', handleEscape);
  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
    document.removeEventListener('keydown', handleEscape);
  };
}, [showProfileMenu]);
```

Replace the desktop user info block (lines 335-350, the `<div className="flex items-center gap-3">` through the logout button) with:

```typescript
<div className="relative" ref={profileMenuRef}>
  <button
    onClick={() => setShowProfileMenu(!showProfileMenu)}
    className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-50 transition-all"
  >
    <div className="text-right hidden sm:block leading-tight">
      <div className="text-sm font-bold text-slate-800">{displayName}</div>
      <div className="text-[11px] text-slate-500 font-medium">{roleLabel}</div>
    </div>
    {profile?.avatar_url ? (
      <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-md" />
    ) : (
      <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md ring-2 ring-white">
        <span className="font-bold text-sm">{initials}</span>
      </div>
    )}
    <ChevronDown size={14} className={`text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
  </button>

  {showProfileMenu && (
    <div
      className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200/60 py-2 animate-in fade-in slide-in-from-top-1 duration-150"
      style={{ zIndex: 'var(--z-dropdown, 50)' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-900">{displayName}</p>
        <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
        <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
          role === 'owner' ? 'bg-slate-100 text-slate-700' :
          role === 'manager' ? 'bg-blue-50 text-blue-700' :
          role === 'stylist' ? 'bg-pink-50 text-pink-700' :
          'bg-amber-50 text-amber-700'
        }`}>
          {roleLabel}
        </span>
      </div>

      {/* Mon profil */}
      <button
        onClick={() => {
          navigate('/profile');
          setShowProfileMenu(false);
        }}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-all"
      >
        <UserCircle size={16} className="text-slate-400" />
        Mon profil
      </button>

      {/* Divider */}
      <div className="my-1 border-t border-slate-100" />

      {/* Déconnexion */}
      <button
        onClick={() => {
          signOut();
          setShowProfileMenu(false);
        }}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-all"
      >
        <LogOut size={16} />
        Déconnexion
      </button>
    </div>
  )}
</div>
```

- [ ] **Step 3: Add "Mon profil" to MobileDrawer**

In `components/MobileDrawer.tsx`, add a `profileItem` prop and a navigate handler.

Add to `MobileDrawerProps`:

```typescript
onProfilePress?: () => void;
```

Before the settings item rendering (after line 198), add:

```typescript
{onProfilePress && (
  <>
    <div className="my-3 border-t border-slate-100 mx-2" />
    <button
      onClick={() => { onProfilePress(); onClose(); }}
      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all min-h-[44px]"
    >
      Mon profil
    </button>
  </>
)}
```

In `Layout.tsx`, pass the prop to `MobileDrawer`:

```typescript
<MobileDrawer
  ...
  onProfilePress={() => { navigate('/profile'); }}
/>
```

- [ ] **Step 4: Commit**

```bash
git add App.tsx components/Layout.tsx components/MobileDrawer.tsx
git commit -m "feat: add /profile route, topbar avatar dropdown, and mobile drawer profile link"
```

---

## Task 14: Display Avatars in Layout Topbar

The topbar already shows initials. Task 13 Step 2 replaces this with avatar image support. Verify it works by checking:

- [ ] **Step 1: Verify the `profile` variable is available in Layout**

In `Layout.tsx`, confirm `profile` is destructured from `useAuth()`. Look for the existing destructuring (should be around line ~52):

```typescript
const { profile, activeSalon, role, signOut, memberships } = useAuth();
```

If `profile` is not already destructured, add it. Also add `useRef` to the React import and `useEffect` if not present.

- [ ] **Step 2: Verify `navigate` is available**

Add `useNavigate` import if not already present:

```typescript
import { useNavigate } from 'react-router-dom';
```

Call it inside the component:

```typescript
const navigate = useNavigate();
```

- [ ] **Step 3: Commit (if any changes were needed)**

```bash
git add components/Layout.tsx
git commit -m "fix: ensure profile and navigate are available in Layout for avatar dropdown"
```

---

## Task 15: Verify and Test

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`

Expected: Server starts on port 3000 with no TypeScript errors.

- [ ] **Step 2: Run the build**

Run: `npm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 3: Manual verification checklist**

1. Navigate to the app, log in
2. Click the avatar in the topbar → dropdown should appear with name, email, role, "Mon profil", and "Déconnexion"
3. Click "Mon profil" → navigates to `/profile`
4. Profile page shows: Identity section with avatar upload, Salon & Role, Security, Preferences
5. Upload a photo → avatar updates in both the profile page and the topbar
6. Edit first name, last name, phone, bio → click "Enregistrer" → toast "Profil mis à jour"
7. Change password → toast "Mot de passe mis à jour"
8. Toggle notification preferences → auto-saves
9. If you're a linked stylist: Schedule and Performance sections should appear
10. "Quitter ce salon" should show for non-sole-owners
11. On mobile: "Mon profil" appears in the drawer menu

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete profile page implementation"
```
