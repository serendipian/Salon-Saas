# Profile Page — Design Spec

## Overview

Standalone user profile page (`/profile`) for the Lumiere Beauty SaaS app. Allows users to manage their personal identity, view their role and schedule, change their password, and set preferences. Accessible from a topbar avatar dropdown. Sections are conditionally rendered based on the user's role and staff linkage.

## 1. Database Changes

### 1.1 Migration: Add fields to `profiles`

```sql
ALTER TABLE profiles ADD COLUMN phone TEXT;
ALTER TABLE profiles ADD COLUMN bio TEXT;
ALTER TABLE profiles ADD COLUMN language TEXT NOT NULL DEFAULT 'fr';
ALTER TABLE profiles ADD COLUMN notification_email BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN notification_sms BOOLEAN NOT NULL DEFAULT false;
```

### 1.2 Migration: Add `staff_member_id` to `invitations`

```sql
ALTER TABLE invitations ADD COLUMN staff_member_id UUID REFERENCES staff_members(id);
```

This allows an invitation to be linked to an existing staff member record. When the invited person accepts, the RPC links them instead of creating a duplicate staff record.

### 1.3 Migration: Update `accept_invitation` RPC

Updated logic:

```
IF v_invitation.staff_member_id IS NOT NULL THEN
  -- Link existing staff member to the new membership
  UPDATE staff_members SET membership_id = v_membership_id
  WHERE id = v_invitation.staff_member_id;
ELSIF v_invitation.role = 'stylist' THEN
  -- Create new staff member (current behavior)
  INSERT INTO staff_members (...)
END IF;
```

### 1.4 Supabase Storage: `avatars` bucket

- Public bucket (avatars are not sensitive)
- Path convention: `{user_id}/avatar.{ext}`
- RLS policies:
  - `INSERT/UPDATE/DELETE`: authenticated users, only their own `{user_id}/` folder (`(bucket_id = 'avatars') AND (auth.uid()::text = (storage.foldername(name))[1])`)
  - `SELECT`: public (anyone can read avatar URLs)
- Max file size: 2MB
- Accepted MIME types: `image/jpeg`, `image/png`, `image/webp`

### 1.5 RLS

The `profiles_update` policy already exists (migration `20260328120000`): `FOR UPDATE USING (id = auth.uid())`. No new RLS policy needed for profile self-editing.

## 2. Topbar Avatar Dropdown

### Current behavior
- Topbar shows initials circle + name + role + logout button inline

### New behavior
- Clicking the avatar/name area opens a dropdown menu
- Dropdown contents:
  - **Header**: full name + email (non-clickable)
  - **Role badge**: translated role label
  - **"Mon profil"**: navigates to `/profile`
  - **Divider**
  - **"Deconnexion"**: signs out
- Closes on click outside or Escape key
- Positioned below avatar, right-aligned

### Mobile
- "Mon profil" link added to the MobileDrawer "Plus" menu
- No dropdown on mobile (drawer pattern instead)

## 3. Profile Page Layout

Route: `/profile` — rendered inside the Layout shell (sidebar + topbar visible).

Single-column layout with max-width (`max-w-2xl`), centered. Each section is a card with heading.

### Section 1 — Photo & Identite (all roles)

- Large avatar (96px) with hover overlay "Changer la photo"
- Click triggers hidden file input (`accept="image/jpeg,image/png,image/webp"`)
- On file select: upload to `avatars/{user_id}/avatar.{ext}`, update `profiles.avatar_url`
- Form fields:
  - Prenom (first_name) — text input, required
  - Nom (last_name) — text input, required
  - Email — read-only display (styled as disabled input)
  - Telephone (phone) — text input, optional
  - Bio — textarea, optional, 3 rows
- "Enregistrer" button — saves to `profiles` table via `useProfile` mutation
- Shows toast on success/error

### Section 2 — Salon & Role (all roles, read-only)

- Active salon name (from `activeSalon`)
- Role badge with color coding:
  - owner: slate
  - manager: blue
  - stylist: pink
  - receptionist: amber
- "Membre depuis" date (from `salon_memberships.created_at`)
- If user has multiple memberships, list all salons with their role
- No edit controls — role changes happen through team management

### Section 3 — Mon Planning (linked staff members only)

- **Condition**: only rendered if the user's `salon_membership` has a linked `staff_members` record with a `schedule`
- Displays weekly schedule grid (read-only) using the existing `WorkScheduleEditor` component in read-only mode, or a simple table
- "Voir mon agenda" link button navigating to `/appointments`
- If no schedule set: "Aucun planning defini. Contactez votre responsable."

### Section 4 — Mes Performances (linked stylists only)

- **Condition**: only rendered if linked staff member exists AND role is stylist
- Stat cards (same style as dashboard KPIs):
  - Rendez-vous ce mois: count of completed appointments this month
  - Chiffre d'affaires ce mois: sum of transaction amounts this month
- Data sourced from existing appointment and transaction queries, filtered by `staff_member_id`
- Period: current calendar month

### Section 5 — Securite (all roles)

- Change password form:
  - "Nouveau mot de passe" — password input
  - "Confirmer le mot de passe" — password input
  - Validation: min 8 chars, must match
- "Changer le mot de passe" button
- Uses `supabase.auth.updateUser({ password })`
- Toast on success ("Mot de passe mis a jour") or error

### Section 6 — Preferences (all roles)

- **Langue**: select dropdown (Francais / العربية / English)
  - Saves to `profiles.language`
  - Note: actual i18n is out of scope — this stores the preference for future use
- **Notifications**:
  - Toggle: "Notifications par email" (profiles.notification_email)
  - Toggle: "Notifications par SMS" (profiles.notification_sms)
- Auto-saves on toggle change (optimistic update with toast)

### Section 7 — Zone Dangereuse (all roles, conditional)

- Red-bordered card at the bottom
- "Quitter ce salon" button
- **Hidden if**: user is the sole owner of the active salon (query: no other owner membership exists)
- On click: confirmation modal
  - Title: "Quitter le salon ?"
  - Message: "Vous perdrez l'acces a [salon name]. Cette action est irreversible."
  - "Annuler" + "Quitter" (red) buttons
- Action: soft-delete the membership (`UPDATE salon_memberships SET deleted_at = now() WHERE ...`)
- After leaving: redirect to `/select-salon` or `/create-salon` if no remaining memberships

## 4. Staff-Profile Linking (Team Module Enhancement)

### Invite from staff card

On a staff member's detail/card where `membership_id IS NULL`:
- Show "Inviter a rejoindre" button (Mail icon)
- Opens the existing invitation creation flow, pre-filled with:
  - Email: staff member's email (if set)
  - Role: derived from staff member's role
  - `staff_member_id`: the staff member's ID
- The invitation record stores `staff_member_id`
- On acceptance, the updated `accept_invitation` RPC links them

### Already linked indicator

On staff members where `membership_id IS NOT NULL`:
- Show a "Compte lie" badge (green, with check icon)
- No invite button needed

## 5. Auth Context & Hooks

### AuthContext additions

- Extend `Profile` type with: `phone`, `bio`, `language`, `notification_email`, `notification_sms`
- `updateProfile(data: Partial<Profile>)` — updates `profiles` row, refreshes local profile state
- `uploadAvatar(file: File)` — uploads to storage, gets public URL, calls `updateProfile({ avatar_url })`

### New hooks

- `hooks/useProfile.ts` — TanStack Query hook:
  - `useProfileQuery()` — reads current user's profile (already available via AuthContext, but useful for mutations)
  - `useUpdateProfile()` — mutation to update profile fields
  - `useUploadAvatar()` — mutation for avatar upload flow
- `hooks/useLinkedStaffMember.ts` — queries `staff_members` where `membership_id` matches current user's membership ID. Returns the linked staff record or null. Used to conditionally render sections 3 and 4.

### Query keys

- `['profile', userId]`
- `['linked-staff', salonId, membershipId]`

## 6. File Structure

```
pages/
  ProfilePage.tsx                    # Main page, renders sections conditionally
  profile/
    ProfileIdentity.tsx              # Section 1: photo + personal info form
    ProfileSalonRole.tsx             # Section 2: salon & role display
    ProfileSchedule.tsx              # Section 3: weekly schedule (linked staff)
    ProfilePerformance.tsx           # Section 4: monthly stats (linked stylist)
    ProfileSecurity.tsx              # Section 5: change password
    ProfilePreferences.tsx           # Section 6: language + notification toggles
    ProfileDangerZone.tsx            # Section 7: leave salon
hooks/
  useProfile.ts                      # Profile CRUD mutations
  useAvatarUpload.ts                 # Avatar upload to Supabase Storage
  useLinkedStaffMember.ts            # Query linked staff_members record
```

## 7. Routing

- Add `/profile` route in `App.tsx`, inside the authenticated layout, wrapped with `ProtectedRoute`
- No permission restriction — all authenticated users with an active salon can access their own profile

## 8. Mobile Responsiveness

- All sections use the existing responsive patterns (full-width cards on mobile, `min-h-[44px]` touch targets)
- Avatar upload: same tap interaction as desktop
- Forms use existing `FormElements` components which are already mobile-optimized
- Stat cards in Section 4: stack vertically on mobile (`grid-cols-1`), side-by-side on desktop (`grid-cols-2`)

## 9. Out of Scope

- Actual i18n/localization (language preference is stored but UI stays French for now)
- Email change flow (requires Supabase email confirmation — separate feature)
- 2FA / MFA setup
- Activity log / login history
- Profile visibility to other salon members (future: public staff profiles for booking pages)
