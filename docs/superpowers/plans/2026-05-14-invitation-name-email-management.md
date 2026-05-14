# Invitation: Capture Name + Email + Manage List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture Prénom + Nom + Email + Rôle at invitation creation, persist them on the `invitations` table, surface them in the settings management list with a copy-link button, and patch both `accept_invitation` RPCs with auto-link-by-email (FOR UPDATE) + invitation-row fallback + Tailwind color palette.

**Architecture:** Single Postgres migration adds two columns and replaces three RPCs (`get_invitation_info`, `accept_invitation`, `accept_invitation_admin`). The React frontend updates one hook (`useTeamSettings`) and one component (`InvitationsTab`); a small pure utility (`getInvitationDisplayInfo`) carries the only unit-tested logic. The Edge Function and `AcceptInvitationPage` are unchanged.

**Tech Stack:** React 19 + TypeScript + Vite, Supabase Postgres + Auth, TanStack Query, Tailwind CSS, Vitest, Biome.

**Spec:** `docs/superpowers/specs/2026-05-14-invitation-name-email-management-design.md`

---

## Pre-flight

- [ ] **Read the spec end-to-end.** Path: `docs/superpowers/specs/2026-05-14-invitation-name-email-management-design.md`. The plan below assumes you've read it; SQL fragments here match the spec verbatim.
- [ ] **Confirm working in the correct branch / worktree.** Run `git status` — you should be on `claude/nervous-wiles-b9f639` (or a similar feature branch). Spec commit `0f61ff9` should already be on the branch (run `git log --oneline -5`).
- [ ] **Confirm the dev server is NOT already running on port 3000.** Run `lsof -i:3000`. If something is bound, stop it before Task 7's manual verification.

---

## Task 1: Write the database migration

**Files:**
- Create: `supabase/migrations/20260514120000_invitation_capture_name_email.sql`

This single migration adds two columns, then `CREATE OR REPLACE`s three functions. No data backfill needed — legacy rows have NULL first_name/last_name/email and gracefully fall back via COALESCE.

- [ ] **Step 1: Create the migration file with schema change**

Create `supabase/migrations/20260514120000_invitation_capture_name_email.sql` with the following content. Write the full file in one shot — do not split across multiple Write calls.

```sql
-- Invitation flow: capture invitee name + email at creation time, replacing
-- the broken assumption that staff_members.email always exists. Patches both
-- accept_invitation variants with auto-link-by-email (FOR UPDATE for race
-- safety), invitation-row fallback, and the correct Tailwind color format.

-- 1. Schema: capture invitee name on the invitation row itself.
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT;

-- 2. get_invitation_info: invitation row wins over linked staff record so
-- the manager's typed email is authoritative; legacy invitations with NULL
-- captured values fall back to the linked staff record.
CREATE OR REPLACE FUNCTION get_invitation_info(p_token TEXT)
RETURNS TABLE (
  staff_first_name TEXT,
  staff_last_name TEXT,
  staff_email TEXT,
  salon_name TEXT,
  role TEXT,
  is_valid BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inv RECORD;
BEGIN
  SELECT
    i.*,
    s.name AS sn,
    sm.first_name AS sm_first_name,
    sm.last_name AS sm_last_name,
    sm.email AS sm_email
  INTO v_inv
  FROM invitations i
  JOIN salons s ON s.id = i.salon_id
  LEFT JOIN staff_members sm
    ON sm.id = i.staff_member_id AND sm.deleted_at IS NULL
  WHERE i.token = p_token;

  IF v_inv IS NULL THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    COALESCE(v_inv.first_name, v_inv.sm_first_name),
    COALESCE(v_inv.last_name,  v_inv.sm_last_name),
    COALESCE(v_inv.email,      v_inv.sm_email),
    v_inv.sn,
    v_inv.role,
    (v_inv.accepted_at IS NULL AND v_inv.expires_at > now());
END;
$$;

-- Re-grant: CREATE OR REPLACE preserves grants but be explicit for clarity.
GRANT EXECUTE ON FUNCTION get_invitation_info(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_invitation_info(TEXT) TO authenticated;

-- 3. accept_invitation (auth.uid variant): used when an already-signed-in
-- user clicks the invitation link.
CREATE OR REPLACE FUNCTION accept_invitation(p_token TEXT)
RETURNS UUID AS $$
DECLARE
  v_invitation           RECORD;
  v_membership_id        UUID;
  v_profile_id           UUID;
  v_auto_linked_staff_id UUID;
  v_color                TEXT;
BEGIN
  v_profile_id := auth.uid();

  SELECT * INTO v_invitation FROM invitations
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > now();

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  IF EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = v_invitation.salon_id
      AND profile_id = v_profile_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'You are already a member of this salon';
  END IF;

  -- Auto-link by email: if no explicit staff_member_id but the invitation
  -- carries an email matching an active, unlinked staff record, lock and
  -- adopt that row so we don't create a duplicate.
  IF v_invitation.staff_member_id IS NULL AND v_invitation.email IS NOT NULL THEN
    SELECT id INTO v_auto_linked_staff_id
    FROM staff_members
    WHERE salon_id = v_invitation.salon_id
      AND lower(email) = lower(v_invitation.email)
      AND membership_id IS NULL
      AND deleted_at IS NULL
    LIMIT 1
    FOR UPDATE;

    IF v_auto_linked_staff_id IS NOT NULL THEN
      v_invitation.staff_member_id := v_auto_linked_staff_id;
    END IF;
  END IF;

  INSERT INTO salon_memberships (
    salon_id, profile_id, role, status, invited_by, invited_at, accepted_at
  ) VALUES (
    v_invitation.salon_id, v_profile_id, v_invitation.role, 'active',
    v_invitation.invited_by, v_invitation.created_at, now()
  )
  RETURNING id INTO v_membership_id;

  -- Link existing staff member OR create new one for stylist
  IF v_invitation.staff_member_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM staff_members
      WHERE id = v_invitation.staff_member_id
        AND membership_id IS NOT NULL
        AND membership_id != v_membership_id
    ) THEN
      RAISE EXCEPTION 'Staff member is already linked to another account';
    END IF;

    UPDATE staff_members SET membership_id = v_membership_id
    WHERE id = v_invitation.staff_member_id
      AND salon_id = v_invitation.salon_id
      AND (membership_id IS NULL OR membership_id = v_membership_id);

  ELSIF v_invitation.role = 'stylist' THEN
    v_color := (ARRAY[
      'bg-rose-100 text-rose-800',
      'bg-blue-100 text-blue-800',
      'bg-emerald-100 text-emerald-800',
      'bg-purple-100 text-purple-800',
      'bg-amber-100 text-amber-800',
      'bg-slate-100 text-slate-800'
    ])[1 + floor(random() * 6)::int];

    INSERT INTO staff_members (
      salon_id, membership_id, first_name, last_name, email, role, color, active, commission_rate
    ) VALUES (
      v_invitation.salon_id,
      v_membership_id,
      COALESCE(v_invitation.first_name, ''),
      COALESCE(v_invitation.last_name, ''),
      v_invitation.email,
      'Stylist',
      v_color,
      true,
      0
    );
  END IF;

  UPDATE invitations SET accepted_at = now() WHERE id = v_invitation.id;
  RETURN v_membership_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. accept_invitation_admin (service-role variant): used by the
-- accept-invitation-signup Edge Function. Identical logic except the profile
-- id is passed in (the auth user was just created server-side).
CREATE OR REPLACE FUNCTION accept_invitation_admin(p_token TEXT, p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_invitation           RECORD;
  v_membership_id        UUID;
  v_auto_linked_staff_id UUID;
  v_color                TEXT;
BEGIN
  SELECT * INTO v_invitation FROM invitations
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > now();

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  IF EXISTS (
    SELECT 1 FROM salon_memberships
    WHERE salon_id = v_invitation.salon_id
      AND profile_id = p_user_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'You are already a member of this salon';
  END IF;

  IF v_invitation.staff_member_id IS NULL AND v_invitation.email IS NOT NULL THEN
    SELECT id INTO v_auto_linked_staff_id
    FROM staff_members
    WHERE salon_id = v_invitation.salon_id
      AND lower(email) = lower(v_invitation.email)
      AND membership_id IS NULL
      AND deleted_at IS NULL
    LIMIT 1
    FOR UPDATE;

    IF v_auto_linked_staff_id IS NOT NULL THEN
      v_invitation.staff_member_id := v_auto_linked_staff_id;
    END IF;
  END IF;

  INSERT INTO salon_memberships (
    salon_id, profile_id, role, status, invited_by, invited_at, accepted_at
  ) VALUES (
    v_invitation.salon_id, p_user_id, v_invitation.role, 'active',
    v_invitation.invited_by, v_invitation.created_at, now()
  )
  RETURNING id INTO v_membership_id;

  IF v_invitation.staff_member_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM staff_members
      WHERE id = v_invitation.staff_member_id
        AND membership_id IS NOT NULL
        AND membership_id != v_membership_id
    ) THEN
      RAISE EXCEPTION 'Staff member is already linked to another account';
    END IF;

    UPDATE staff_members SET membership_id = v_membership_id
    WHERE id = v_invitation.staff_member_id
      AND salon_id = v_invitation.salon_id
      AND (membership_id IS NULL OR membership_id = v_membership_id);

  ELSIF v_invitation.role = 'stylist' THEN
    v_color := (ARRAY[
      'bg-rose-100 text-rose-800',
      'bg-blue-100 text-blue-800',
      'bg-emerald-100 text-emerald-800',
      'bg-purple-100 text-purple-800',
      'bg-amber-100 text-amber-800',
      'bg-slate-100 text-slate-800'
    ])[1 + floor(random() * 6)::int];

    INSERT INTO staff_members (
      salon_id, membership_id, first_name, last_name, email, role, color, active, commission_rate
    ) VALUES (
      v_invitation.salon_id,
      v_membership_id,
      COALESCE(v_invitation.first_name, ''),
      COALESCE(v_invitation.last_name, ''),
      v_invitation.email,
      'Stylist',
      v_color,
      true,
      0
    );
  END IF;

  UPDATE invitations SET accepted_at = now() WHERE id = v_invitation.id;
  RETURN v_membership_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 2: Sanity-check the SQL syntax visually**

Open the file you just wrote and verify:
1. Three `CREATE OR REPLACE FUNCTION` blocks
2. Both `accept_invitation` and `accept_invitation_admin` declare `v_auto_linked_staff_id UUID` and `v_color TEXT`
3. Both have the same `FOR UPDATE` block before the membership insert
4. Both use the Tailwind array for `v_color`, not a hex string
5. Final lines: `RETURN v_membership_id;` then `END;` then `$$ LANGUAGE plpgsql SECURITY DEFINER;`

If anything is off, fix and re-verify before moving on.

- [ ] **Step 3: Commit the migration**

```bash
git add supabase/migrations/20260514120000_invitation_capture_name_email.sql
git commit -m "$(cat <<'EOF'
feat(invitations): migration — capture name/email + patched accept RPCs

Adds first_name/last_name columns to invitations. Replaces get_invitation_info
with invitation-row-wins COALESCE precedence. Replaces accept_invitation and
accept_invitation_admin with auto-link-by-email (FOR UPDATE), invitation-row
fallback for stylist staff creation, and Tailwind color palette (fixes the
pre-existing hex-string color bug).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Apply the migration to remote Supabase + regenerate types

**Files:**
- Modify: `lib/database.types.ts`

> ⚠️ This task touches **production Supabase**. Pause for explicit user confirmation before pushing the migration. Do not run `supabase db push` autonomously.

- [ ] **Step 1: Ask the user to apply the migration**

Tell the user: *"Migration is staged at `supabase/migrations/20260514120000_invitation_capture_name_email.sql`. Ready to push to remote Supabase. Should I run `npx supabase db push --linked`, or will you apply it manually via the Supabase dashboard?"*

Wait for the user's answer. If they say to run it, proceed to Step 2. If they say they'll apply it themselves, skip to Step 3 only after they confirm the migration succeeded.

- [ ] **Step 2: Push the migration (only if user explicitly approved running `db push`)**

```bash
npx supabase db push --linked
```

Expected output: `Applying migration 20260514120000_invitation_capture_name_email.sql...` followed by `Finished supabase db push.` If anything fails (linked project mismatch, auth, etc.), surface the error to the user — do NOT retry or work around it.

- [ ] **Step 3: Regenerate TypeScript types from remote schema**

The local dev `db:types` script targets the local Supabase; we need the remote project. Use the project id directly per CLAUDE.md:

```bash
npx supabase gen types typescript --project-id izsycdmrwscdnxebptsx > lib/database.types.ts
```

Expected: file modified, no stderr output.

- [ ] **Step 4: Verify the new columns appear in the types**

```bash
grep -A 30 "invitations:" lib/database.types.ts | head -50
```

Expected to see `first_name: string | null` and `last_name: string | null` in the Row/Insert/Update shapes for `invitations`.

- [ ] **Step 5: Commit regenerated types**

```bash
git add lib/database.types.ts
git commit -m "chore(types): regenerate database.types.ts after invitation migration

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Update the `useTeamSettings` hook

**Files:**
- Modify: `modules/settings/hooks/useTeamSettings.ts:31-39` (InvitationRow type)
- Modify: `modules/settings/hooks/useTeamSettings.ts:95-105` (invitations query select list)
- Modify: `modules/settings/hooks/useTeamSettings.ts:169-194` (createInvitation mutation)
- Modify: `modules/settings/hooks/useTeamSettings.ts:229` (return type)

- [ ] **Step 1: Extend the InvitationRow interface**

Find the existing block at [modules/settings/hooks/useTeamSettings.ts:31](modules/settings/hooks/useTeamSettings.ts:31):

```typescript
export interface InvitationRow {
  id: string;
  role: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  staff_member_id: string | null;
}
```

Replace with:

```typescript
export interface InvitationRow {
  id: string;
  role: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  staff_member_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}
```

- [ ] **Step 2: Update the invitations query select list**

Find the select-string param at [modules/settings/hooks/useTeamSettings.ts:99](modules/settings/hooks/useTeamSettings.ts:99):

```typescript
params.append('select', 'id,role,token,created_at,expires_at,accepted_at,staff_member_id');
```

Replace with (note: alphabetical-ish ordering preserved, new fields appended):

```typescript
params.append(
  'select',
  'id,role,token,created_at,expires_at,accepted_at,staff_member_id,first_name,last_name,email',
);
```

- [ ] **Step 3: Update the createInvitation mutation signature**

Find the existing mutation at [modules/settings/hooks/useTeamSettings.ts:169](modules/settings/hooks/useTeamSettings.ts:169):

```typescript
const createInvitationMutation = useMutation({
  mutationFn: async (role: string) => {
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    const inserted = await rawInsertReturning<{ token: string }>(
      'invitations',
      {
        salon_id: salonId!,
        role,
        token,
        invited_by: profile!.id,
        expires_at: expiresAt.toISOString(),
      },
      'token',
    );
    const returnedToken = inserted[0]?.token;
    if (!returnedToken) throw new Error('Invitation insert returned no token');
    return returnedToken;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['team-settings-invitations', salonId] });
  },
  onError: toastOnError("Erreur lors de la création de l'invitation"),
});
```

Replace with:

```typescript
interface CreateInvitationInput {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

const createInvitationMutation = useMutation({
  mutationFn: async (input: CreateInvitationInput) => {
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    const inserted = await rawInsertReturning<{ token: string }>(
      'invitations',
      {
        salon_id: salonId!,
        role: input.role,
        token,
        invited_by: profile!.id,
        expires_at: expiresAt.toISOString(),
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        email: input.email.trim().toLowerCase(),
      },
      'token',
    );
    const returnedToken = inserted[0]?.token;
    if (!returnedToken) throw new Error('Invitation insert returned no token');
    return returnedToken;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['team-settings-invitations', salonId] });
  },
  onError: toastOnError("Erreur lors de la création de l'invitation"),
});
```

Move the `CreateInvitationInput` interface ABOVE the `useTeamSettings` function (just below the `InvitationRow` interface). Export it so the component can import it:

```typescript
export interface CreateInvitationInput {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}
```

- [ ] **Step 4: Update the return shape**

Find the existing line at [modules/settings/hooks/useTeamSettings.ts:229](modules/settings/hooks/useTeamSettings.ts:229):

```typescript
createInvitation: (role: string) => createInvitationMutation.mutateAsync(role),
```

Replace with:

```typescript
createInvitation: (input: CreateInvitationInput) =>
  createInvitationMutation.mutateAsync(input),
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: passes, OR fails ONLY in `InvitationsTab.tsx` (because we haven't updated the caller yet — that's Task 5). Any other failure means something else is wrong; investigate before continuing.

- [ ] **Step 6: Lint**

```bash
npm run lint -- modules/settings/hooks/useTeamSettings.ts
```

Expected: passes.

- [ ] **Step 7: Commit**

```bash
git add modules/settings/hooks/useTeamSettings.ts
git commit -m "feat(invitations): hook captures firstName/lastName/email on create

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Create the `getInvitationDisplayInfo` utility + test

**Files:**
- Create: `modules/settings/utils/getInvitationDisplayInfo.ts`
- Create: `modules/settings/utils/getInvitationDisplayInfo.test.ts`

This is the only pure-logic surface in the change set — it handles initials extraction and the name-or-email fallback for the list row's primary line. Other modules use co-located `*.test.ts` files run by Vitest (see `modules/settings/mappers.test.ts`).

- [ ] **Step 1: Write the failing test**

Create `modules/settings/utils/getInvitationDisplayInfo.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { getInvitationDisplayInfo } from './getInvitationDisplayInfo';

describe('getInvitationDisplayInfo', () => {
  it('returns initials from first + last name', () => {
    const info = getInvitationDisplayInfo({
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane.doe@test.local',
    });
    expect(info.initials).toBe('JD');
    expect(info.primaryLine).toBe('Jane Doe');
    expect(info.secondaryLine).toBe('jane.doe@test.local');
  });

  it('falls back to first letter of first name when last name missing', () => {
    const info = getInvitationDisplayInfo({
      first_name: 'Jane',
      last_name: null,
      email: 'j@test.local',
    });
    expect(info.initials).toBe('J');
    expect(info.primaryLine).toBe('Jane');
  });

  it('uses email when both names are missing', () => {
    const info = getInvitationDisplayInfo({
      first_name: null,
      last_name: null,
      email: 'lone@test.local',
    });
    expect(info.initials).toBe('L');
    expect(info.primaryLine).toBe('lone@test.local');
    expect(info.secondaryLine).toBe('');
  });

  it('uses em-dash when name and email are all null (legacy rows)', () => {
    const info = getInvitationDisplayInfo({
      first_name: null,
      last_name: null,
      email: null,
    });
    expect(info.initials).toBe('—');
    expect(info.primaryLine).toBe('—');
    expect(info.secondaryLine).toBe('');
  });

  it('handles whitespace-only name as missing', () => {
    const info = getInvitationDisplayInfo({
      first_name: '   ',
      last_name: '',
      email: 'ws@test.local',
    });
    expect(info.initials).toBe('W');
    expect(info.primaryLine).toBe('ws@test.local');
  });

  it('uppercases initials regardless of input casing', () => {
    const info = getInvitationDisplayInfo({
      first_name: 'jane',
      last_name: 'doe',
      email: 'j@test.local',
    });
    expect(info.initials).toBe('JD');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
npx vitest run modules/settings/utils/getInvitationDisplayInfo.test.ts
```

Expected: FAIL with `Failed to resolve import "./getInvitationDisplayInfo"`.

- [ ] **Step 3: Write the minimal implementation**

Create `modules/settings/utils/getInvitationDisplayInfo.ts`:

```typescript
interface InvitationDisplayInput {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export interface InvitationDisplayInfo {
  initials: string;
  primaryLine: string;
  secondaryLine: string;
}

export function getInvitationDisplayInfo(
  row: InvitationDisplayInput,
): InvitationDisplayInfo {
  const firstName = row.first_name?.trim() || '';
  const lastName = row.last_name?.trim() || '';
  const email = row.email?.trim() || '';

  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  if (fullName) {
    const initials = (
      (firstName[0] || '') + (lastName[0] || '')
    ).toUpperCase();
    return {
      initials,
      primaryLine: fullName,
      secondaryLine: email,
    };
  }

  if (email) {
    return {
      initials: email[0]!.toUpperCase(),
      primaryLine: email,
      secondaryLine: '',
    };
  }

  return { initials: '—', primaryLine: '—', secondaryLine: '' };
}
```

- [ ] **Step 4: Run the test and verify all pass**

```bash
npx vitest run modules/settings/utils/getInvitationDisplayInfo.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Lint**

```bash
npm run lint -- modules/settings/utils/
```

Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add modules/settings/utils/getInvitationDisplayInfo.ts modules/settings/utils/getInvitationDisplayInfo.test.ts
git commit -m "feat(invitations): add getInvitationDisplayInfo utility + tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Update the `InvitationsTab` form

**Files:**
- Modify: `modules/settings/components/InvitationsTab.tsx` (entire form section, lines 30–168)

This task replaces only the creation-form half of the component. Task 6 handles the list-rendering half. Split because each piece is large enough on its own.

- [ ] **Step 1: Update component props**

Find the existing `InvitationsTabProps` at [modules/settings/components/InvitationsTab.tsx:30](modules/settings/components/InvitationsTab.tsx:30):

```typescript
interface InvitationsTabProps {
  invitations: InvitationRow[];
  onCreate: (role: string) => Promise<string>;
  isCreating: boolean;
  onCancel: (id: string) => Promise<void>;
  isCancelling: boolean;
}
```

Replace with:

```typescript
import type { CreateInvitationInput } from '../hooks/useTeamSettings';

interface InvitationsTabProps {
  invitations: InvitationRow[];
  onCreate: (input: CreateInvitationInput) => Promise<string>;
  isCreating: boolean;
  onCancel: (id: string) => Promise<void>;
  isCancelling: boolean;
}
```

The `import type` line goes alongside the existing `import { INVITATION_EXPIRY_DAYS, type InvitationRow } from '../hooks/useTeamSettings';` at the top of the file — merge into a single import:

```typescript
import {
  INVITATION_EXPIRY_DAYS,
  type CreateInvitationInput,
  type InvitationRow,
} from '../hooks/useTeamSettings';
```

- [ ] **Step 2: Replace form state**

Find at [modules/settings/components/InvitationsTab.tsx:46-49](modules/settings/components/InvitationsTab.tsx:46):

```typescript
const [showForm, setShowForm] = useState(false);
const [selectedRole, setSelectedRole] = useState('stylist');
const [generatedLink, setGeneratedLink] = useState<string | null>(null);
const [copied, setCopied] = useState(false);
```

Replace with:

```typescript
const [showForm, setShowForm] = useState(false);
const [firstName, setFirstName] = useState('');
const [lastName, setLastName] = useState('');
const [email, setEmail] = useState('');
const [selectedRole, setSelectedRole] = useState('stylist');
const [formError, setFormError] = useState<string | null>(null);
const [generatedLink, setGeneratedLink] = useState<string | null>(null);
const [copied, setCopied] = useState(false);

// Same email pattern used elsewhere in the app (signup/profile).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

- [ ] **Step 3: Replace `handleCreate`**

Find at [modules/settings/components/InvitationsTab.tsx:51-63](modules/settings/components/InvitationsTab.tsx:51):

```typescript
const handleCreate = async () => {
  // M-4: mutation's onError already toasts via useMutationToast, but we
  // catch here so an unexpected rejection (network blip, auth lock) can't
  // leave the async call dangling and so the generated-link UI only
  // appears on success.
  try {
    const token = await onCreate(selectedRole);
    setGeneratedLink(`${window.location.origin}/accept-invitation?token=${token}`);
  } catch {
    // Error is already surfaced via the mutation's toastOnError; swallow
    // so the promise chain stays clean.
  }
};
```

Replace with:

```typescript
const handleCreate = async () => {
  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();
  const trimmedEmail = email.trim();

  if (!trimmedFirst || !trimmedLast) {
    setFormError('Prénom et nom sont obligatoires.');
    return;
  }
  if (!EMAIL_RE.test(trimmedEmail)) {
    setFormError('Email invalide.');
    return;
  }
  setFormError(null);

  // Mutation's onError already toasts via useMutationToast, but we catch
  // here so an unexpected rejection can't leave the async call dangling
  // and so the generated-link UI only appears on success.
  try {
    const token = await onCreate({
      firstName: trimmedFirst,
      lastName: trimmedLast,
      email: trimmedEmail,
      role: selectedRole,
    });
    setGeneratedLink(`${window.location.origin}/accept-invitation?token=${token}`);
  } catch {
    // Error already surfaced via toastOnError; swallow.
  }
};
```

- [ ] **Step 4: Update `handleClose` to reset all fields**

Find at [modules/settings/components/InvitationsTab.tsx:81-86](modules/settings/components/InvitationsTab.tsx:81):

```typescript
const handleClose = () => {
  setShowForm(false);
  setGeneratedLink(null);
  setSelectedRole('stylist');
  setCopied(false);
};
```

Replace with:

```typescript
const handleClose = () => {
  setShowForm(false);
  setGeneratedLink(null);
  setFirstName('');
  setLastName('');
  setEmail('');
  setSelectedRole('stylist');
  setFormError(null);
  setCopied(false);
};
```

- [ ] **Step 5: Replace the form fields JSX**

Find the existing role-only form block at [modules/settings/components/InvitationsTab.tsx:103-137](modules/settings/components/InvitationsTab.tsx:103) — everything between `{!generatedLink ? (` and the closing `) : (` of that ternary's first branch:

```jsx
<>
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">Rôle</label>
    <select
      value={selectedRole}
      onChange={(e) => setSelectedRole(e.target.value)}
      className="w-full sm:w-48 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
    >
      <option value="manager">Manager</option>
      <option value="stylist">Styliste</option>
      <option value="receptionist">Réceptionniste</option>
    </select>
  </div>
  <div className="flex gap-2">
    <button
      onClick={handleCreate}
      disabled={isCreating}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
    >
      {isCreating ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <LinkIcon className="w-4 h-4" />
      )}
      Générer le lien
    </button>
    <button
      onClick={handleClose}
      className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
    >
      Annuler
    </button>
  </div>
</>
```

Replace with:

```jsx
<>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        Prénom
      </label>
      <input
        type="text"
        value={firstName}
        onChange={(e) => {
          setFirstName(e.target.value);
          if (formError) setFormError(null);
        }}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
        autoFocus
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        Nom
      </label>
      <input
        type="text"
        value={lastName}
        onChange={(e) => {
          setLastName(e.target.value);
          if (formError) setFormError(null);
        }}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
      />
    </div>
  </div>
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">
      Email
    </label>
    <input
      type="email"
      value={email}
      onChange={(e) => {
        setEmail(e.target.value);
        if (formError) setFormError(null);
      }}
      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
      autoComplete="email"
    />
  </div>
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">Rôle</label>
    <select
      value={selectedRole}
      onChange={(e) => setSelectedRole(e.target.value)}
      className="w-full sm:w-48 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
    >
      <option value="manager">Manager</option>
      <option value="stylist">Styliste</option>
      <option value="receptionist">Réceptionniste</option>
    </select>
  </div>
  {formError && <p className="text-sm text-red-600">{formError}</p>}
  <div className="flex gap-2">
    <button
      onClick={handleCreate}
      disabled={isCreating}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
    >
      {isCreating ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <LinkIcon className="w-4 h-4" />
      )}
      Générer le lien
    </button>
    <button
      onClick={handleClose}
      className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
    >
      Annuler
    </button>
  </div>
</>
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: passes (or only the list-render errors that Task 6 will fix — but the form changes should not introduce any new errors of their own).

- [ ] **Step 7: Lint**

```bash
npm run lint -- modules/settings/components/InvitationsTab.tsx
```

Expected: passes.

- [ ] **Step 8: Commit**

```bash
git add modules/settings/components/InvitationsTab.tsx
git commit -m "feat(invitations): form captures firstName/lastName/email at creation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Update the `InvitationsTab` list rendering

**Files:**
- Modify: `modules/settings/components/InvitationsTab.tsx` (list section + new copy-link handler)

- [ ] **Step 1: Add the display utility import**

At the top of `modules/settings/components/InvitationsTab.tsx`, alongside existing imports:

```typescript
import { getInvitationDisplayInfo } from '../utils/getInvitationDisplayInfo';
```

- [ ] **Step 2: Add a per-row copy-link handler**

Inside the `InvitationsTab` component, after `handleCopy` (which copies the freshly-generated link), add:

```typescript
const [copiedRowId, setCopiedRowId] = useState<string | null>(null);

const handleCopyRowLink = async (token: string, rowId: string) => {
  const url = `${window.location.origin}/accept-invitation?token=${token}`;
  try {
    await navigator.clipboard.writeText(url);
    setCopiedRowId(rowId);
    setTimeout(() => setCopiedRowId(null), 2000);
  } catch {
    addToast({
      type: 'error',
      message: 'Impossible de copier le lien. Réessayez ou recréez une invitation.',
    });
  }
};
```

- [ ] **Step 3: Replace the list row JSX**

Find the existing list-row block at [modules/settings/components/InvitationsTab.tsx:175-209](modules/settings/components/InvitationsTab.tsx:175):

```jsx
invitations.map((inv) => {
  const status = getStatus(inv);
  return (
    <div key={inv.id} className="flex items-center gap-4 p-4">
      <span
        className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[inv.role] || 'bg-slate-100 text-slate-600'}`}
      >
        {ROLE_LABELS[inv.role] || inv.role}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500">
          Créée le {formatDate(inv.created_at)} · Expire le {formatDate(inv.expires_at)}
        </p>
      </div>

      <span
        className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.className}`}
      >
        {status.label}
      </span>

      {isPending(inv) && (
        <button
          onClick={() => onCancel(inv.id)}
          disabled={isCancelling}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Annuler l'invitation"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
})
```

Replace with:

```jsx
invitations.map((inv) => {
  const status = getStatus(inv);
  const display = getInvitationDisplayInfo(inv);
  const pending = isPending(inv);
  const wasCopied = copiedRowId === inv.id;
  return (
    <div key={inv.id} className="flex items-center gap-4 p-4">
      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-medium shrink-0">
        {display.initials}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">
          {display.primaryLine}
        </p>
        {display.secondaryLine && (
          <p className="text-xs text-slate-500 truncate">
            {display.secondaryLine}
          </p>
        )}
        <p className="text-xs text-slate-400 mt-0.5">
          Créée le {formatDate(inv.created_at)} · Expire le {formatDate(inv.expires_at)}
        </p>
      </div>

      <span
        className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[inv.role] || 'bg-slate-100 text-slate-600'}`}
      >
        {ROLE_LABELS[inv.role] || inv.role}
      </span>

      <span
        className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.className}`}
      >
        {status.label}
      </span>

      {pending && (
        <>
          <button
            onClick={() => handleCopyRowLink(inv.token, inv.id)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Copier le lien d'invitation"
          >
            {wasCopied ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <LinkIcon className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => onCancel(inv.id)}
            disabled={isCancelling}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Annuler l'invitation"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
})
```

- [ ] **Step 4: TypeScript check (full)**

```bash
npx tsc --noEmit
```

Expected: passes with NO errors.

- [ ] **Step 5: Lint (full)**

```bash
npm run lint
```

Expected: passes.

- [ ] **Step 6: Run all unit tests**

```bash
npm test
```

Expected: all pass, including the new `getInvitationDisplayInfo` tests from Task 4.

- [ ] **Step 7: Commit**

```bash
git add modules/settings/components/InvitationsTab.tsx
git commit -m "feat(invitations): list rows show name + email + copy-link button

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Manual end-to-end verification

**Files:** none — this task validates the running app.

> ⚠️ This task interacts with **production Supabase data**. Use test email addresses (e.g. `*@test.local` or your own personal emails you control), not real customer addresses. Clean up the test invitations and any auto-created auth users + staff_members rows after verification.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

The server should be on http://localhost:3000. Keep this running for the rest of the task.

- [ ] **Step 2: Test step 1 — fill the new form**

In a browser logged in as the salon owner:
1. Navigate to Settings → Équipe & Permissions → Invitations tab.
2. Click **Inviter un membre**.
3. Verify the form now shows four fields: Prénom, Nom, Email, Rôle.
4. Fill: `Prénom=Jane`, `Nom=Doe`, `Email=jane.doe.<timestamp>@test.local` (use a unique suffix), `Rôle=Réceptionniste`.
5. Click **Générer le lien**.

Expected: link is generated and displayed in a copy box.

- [ ] **Step 3: Test step 2 — list shows full info**

Close the link panel. In the invitation list verify the new row shows:
- Avatar circle with `JD`
- Primary line: `Jane Doe`
- Secondary line: the email you just used
- Role badge: `Réceptionniste`
- Status badge: `En attente`
- Two icon buttons: link (copy) and X (cancel)

- [ ] **Step 4: Test step 3 — open invitation in incognito**

Copy the link from the form's copy box. Open an incognito/private window and paste the URL.

Expected: the AcceptInvitation page shows:
- Heading: `Bienvenue chez {your salon name}`
- Display block with Nom (`Jane Doe`), Email (`jane.doe.<timestamp>@test.local`), Rôle (`receptionist`)
- A password input field (NOT the "Email manquant" error block)

- [ ] **Step 5: Test step 4 — set password, signs in, lands on dashboard**

Enter a password ≥8 chars. Click **Créer mon compte**.

Expected: redirected to `/dashboard`, logged in as the new receptionist, role-appropriate sidebar visible (no Comptabilité, Fournisseurs, Réglages).

- [ ] **Step 6: Test step 5 — repeat with stylist, verify staff record + Tailwind color**

Back in the owner browser, create a second invitation: `Prénom=Sam`, `Nom=Smith`, `Email=sam.smith.<timestamp>@test.local`, `Rôle=Styliste`. Accept in incognito.

After acceptance, in the owner browser navigate to Équipe and confirm a new staff record `Sam Smith` exists. Open Supabase dashboard → SQL editor and run:

```sql
SELECT first_name, last_name, email, color
FROM staff_members
WHERE email LIKE 'sam.smith.%@test.local'
ORDER BY created_at DESC
LIMIT 1;
```

Expected: `color` value matches one of the six Tailwind palette strings (e.g. `bg-rose-100 text-rose-800`), NOT a `#abc123` hex string.

- [ ] **Step 7: Test step 6 — auto-link to existing staff by email**

In the owner browser, in the Équipe module, manually add a staff member: `Prénom=Lee`, `Nom=Park`, `Email=lee.park.<timestamp>@test.local`, role Stylist. Confirm the staff row exists with `membership_id = NULL`.

Then create an invitation with the same email (`lee.park.<timestamp>@test.local`). Accept in incognito.

After acceptance, run in Supabase SQL editor:

```sql
SELECT COUNT(*) AS row_count, COUNT(membership_id) AS linked_count
FROM staff_members
WHERE email = 'lee.park.<timestamp>@test.local'
  AND deleted_at IS NULL;
```

Expected: `row_count = 1`, `linked_count = 1`. (One staff row, now linked to the new membership — no duplicate.)

- [ ] **Step 8: Test step 7 — already-authenticated user accept path**

In a third browser session, sign in as an existing user who is NOT yet a member of this salon (use any spare test account). In the owner browser, create another invitation: `Prénom=Pat`, `Nom=Lin`, `Email=<the signed-in test user's auth email>`, `Rôle=Styliste`.

Copy the link, paste it into the third browser's URL bar (the one already signed in as the test user).

Expected: the page briefly shows "Création en cours…", then "Invitation acceptée!", then redirects to dashboard. Confirm in SQL:

```sql
SELECT first_name, last_name, email, color, membership_id
FROM staff_members
WHERE email = '<the email>'
ORDER BY created_at DESC
LIMIT 1;
```

Expected: staff row exists (created by `accept_invitation` auth.uid variant), Tailwind color, `membership_id` non-NULL.

- [ ] **Step 9: Test step 8 — cancel a pending invitation**

In the owner browser, create one more invitation (any role). In the list, click the **X** (cancel) button on the new row.

Expected:
- Status badge changes from `En attente` to `Expirée`
- The copy-link button (LinkIcon) disappears
- The cancel button (X) disappears
- Toast: `Invitation annulée`

- [ ] **Step 10: Test step 9 — copy-link button**

Create yet another invitation. In the list row, click the **LinkIcon** button.

Expected: the LinkIcon flashes to a green check for ~2s. Paste the clipboard into an external editor — the URL should be `http://localhost:3000/accept-invitation?token=<uuid>` matching the token on that row.

- [ ] **Step 11: Cleanup test data**

In Supabase dashboard SQL editor, remove the test invitations and auth users:

```sql
DELETE FROM invitations WHERE email LIKE '%@test.local';
```

For the auth users created during test — delete them via Supabase dashboard → Authentication → Users (search for `@test.local`) and click delete on each.

For the linked staff_members and salon_memberships — they will be removed via the cascading deletes when the auth user is removed, but verify manually:

```sql
SELECT id, email FROM staff_members WHERE email LIKE '%@test.local';
SELECT id, profile_id FROM salon_memberships WHERE profile_id NOT IN (SELECT id FROM auth.users);
```

Both queries should return empty.

- [ ] **Step 12: Stop the dev server**

Press `Ctrl-C` in the terminal running `npm run dev`.

- [ ] **Step 13: Final commit (if any cleanup changes were needed)**

If steps in this task surfaced any small fixes (e.g. a typo in an error message), commit them separately with a `fix(invitations): …` prefix. Otherwise, no commit needed.

---

## Done criteria

- Migration `20260514120000_invitation_capture_name_email.sql` applied to remote Supabase.
- `lib/database.types.ts` regenerated and committed.
- `useTeamSettings.createInvitation` accepts `{ firstName, lastName, email, role }` and persists all four.
- `InvitationsTab` form has four fields with validation; list rows show avatar + name + email + role + status + copy-link + cancel.
- Vitest suite passes, including six new `getInvitationDisplayInfo` cases.
- All nine manual end-to-end steps from the spec's test plan succeed.
- No `tsc --noEmit` errors. No `npm run lint` errors.

## Out of scope (do not implement)

- Auto-sending invitation emails (no email provider).
- "Pick existing staff member" picker in the form (auto-link by email covers it).
- Resend or regenerate token UI (cancel + create new is the workaround).
- Warning the manager when creating a second pending invitation for the same email (acknowledged gap in the spec).
- Sentry / observability additions.
