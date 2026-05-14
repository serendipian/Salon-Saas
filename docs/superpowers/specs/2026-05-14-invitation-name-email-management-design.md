# Invitation: Capture Name + Email at Creation, Surface in Management List

**Status:** Draft
**Date:** 2026-05-14
**Owner:** ecomlab.solutions@gmail.com

## Problem

Two related issues with the team-invitation flow in **Settings → Équipe & Permissions → Invitations**:

1. **Acceptance is blocked by "Email manquant".** The creation form only asks for `role`. The `AcceptInvitationPage` and the `accept-invitation-signup` Edge Function both require `staff_email`, which is sourced from `staff_members.email` via the optional `invitations.staff_member_id` join. Because the form never sets that link and never captures an email, the join is always NULL and every invitation dead-ends at *"Demandez au gérant d'ajouter votre email à votre fiche"*.

2. **The invitation list is functionally invisible.** `InvitationsTab.tsx` does render existing invitations with a cancel button, but each row shows only a role badge and dates — no name, no email — so the manager can't identify which row is which and the list reads as unusable.

## Goals

- Manager can invite any role (manager, stylist, receptionist) by entering Prénom + Nom + Email + Rôle and copying a link. Recipient opens the link, sets a password, and is in.
- Pending invitations are listed with enough identifying information that the manager can act on them (cancel, copy link again).
- No duplicate `staff_members` rows when the invitee's email matches an existing active staff record.

## Non-Goals

- Sending the invitation email automatically. The mechanism stays "copy link".
- A "link to existing staff member" picker in the form. Auto-link-by-email covers the common case.
- Resending or regenerating tokens. Cancel + create new is the workaround.
- Bulk invite, CSV upload, or invitation templates.

## Design

### 1. Schema

Migration `20260514120000_invitation_capture_name_email.sql`:

```sql
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT;
```

`email` is already nullable on `invitations` (since `20260406150000`). We keep it nullable at the DB level for backwards-compatibility with any historical rows, but the app enforces it as required at creation time.

### 2. RPC updates

**`get_invitation_info(p_token)`** — fall back from `invitations` (manager's explicit input) to `staff_members` (linked-staff backstop). Note the precedence: the invitation row wins over the linked staff record because the invitation captures what the manager typed at link-creation time, and a staff record's email/name could have drifted since. Only legacy invitations with NULL captured values fall back to the linked staff record:

```sql
RETURN QUERY SELECT
  COALESCE(i.first_name, sm.first_name),
  COALESCE(i.last_name,  sm.last_name),
  COALESCE(i.email,      sm.email),
  s.name,
  i.role,
  (i.accepted_at IS NULL AND i.expires_at > now())
FROM invitations i
JOIN salons s ON s.id = i.salon_id
LEFT JOIN staff_members sm
  ON sm.id = i.staff_member_id AND sm.deleted_at IS NULL
WHERE i.token = p_token;
```

**`accept_invitation_admin(p_token, p_user_id)` AND `accept_invitation(p_token)`** — both functions get the same three additive changes (the migration must `CREATE OR REPLACE` both; they share the post-membership logic but differ in how the profile id is obtained — `auth.uid()` vs parameter).

1. **Auto-link existing staff by email, with row lock to prevent races.** Before the existing `staff_member_id IS NOT NULL` branch, when it's NULL and `i.email` is non-NULL, try to find a single matching active `staff_members` row with no membership and lock it:

   ```sql
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
   ```

   `FOR UPDATE` serializes concurrent accepts on the same staff row. The second transaction either sees `membership_id IS NULL` is no longer true (after the first commits) and falls through to the create-new path, or blocks on the lock until the first commits and then finds nothing matching its predicate.

2. **Use invitation columns when creating a new staff record** (stylist fallback path) — pull `first_name`/`last_name`/`email` from the invitation row, not the profile. This matches the manager's recorded intent and keeps the staff record's source of truth consistent with the invitation that produced it.

3. **Fix the staff color format** — pre-existing bug fixed while we're rewriting this block. The current code writes `'#' || lpad(to_hex(random...), 6, '0')`, producing a hex string like `'#a3f4c1'`. CLAUDE.md requires the column to be a Tailwind class string (`'bg-rose-100 text-rose-800'`). Use a fixed palette matching `modules/team/components/TeamForm.tsx`:

   ```sql
   v_color := (ARRAY[
     'bg-rose-100 text-rose-800',
     'bg-blue-100 text-blue-800',
     'bg-emerald-100 text-emerald-800',
     'bg-purple-100 text-purple-800',
     'bg-amber-100 text-amber-800',
     'bg-slate-100 text-slate-800'
   ])[1 + floor(random() * 6)::int];
   ```

**Implementer note** — the SQL shown above is a fragment, not a full function body. When wiring it into the `CREATE OR REPLACE FUNCTION` blocks, the DECLARE section of both `accept_invitation` and `accept_invitation_admin` must add:

```sql
DECLARE
  -- existing declarations unchanged (v_invitation, v_membership_id, v_profile_id, etc.)
  v_auto_linked_staff_id UUID;
  v_color                TEXT;
```

Without these, the function bodies won't compile.

### 3. Form (`InvitationsTab.tsx`)

Replace the role-only block with a four-field form, all required:

```
Prénom *              Nom *
[__________]          [__________]

Email *
[__________________________________]

Rôle *
[Manager ▾]
```

- Email regex validated client-side (same pattern as `LoginPage`).
- Submit button: **"Générer le lien"** → calls `createInvitation({ firstName, lastName, email, role })`.
- On success, the existing "link generated" sub-view appears with the copy box. The four input values are reset when the panel closes.
- Plan-limit check: invitations don't count against `staff_members` limit at creation time (they create no staff row until accept). No change to `check_plan_limits` trigger.

### 4. List rendering

Each row becomes:

```
[ JD ]  Jane Doe                      [ Manager ]  [ En attente ]   [ 🔗 ] [ ✕ ]
        jane.doe@example.com
        Créée le 14 mai · Expire le 21 mai
```

- Avatar circle: initials from first+last name, slate background.
- Primary line: `{first_name} {last_name}` if present, otherwise the email.
- Secondary line: email (smaller, slate-500), then dates (smaller still, slate-400).
- Role badge: same color map as today.
- Status badge: same logic as today.
- **Copy link** button (LinkIcon): visible only when status is `En attente`. Copies `${origin}/accept-invitation?token=${token}` and flashes a check for 2 s. Same clipboard-failure toast as the creation flow.
- **Cancel** button (X): unchanged behavior.

Old rows with no `first_name`/`last_name`/`email` show the email (or a "—" if also missing) as the primary line and still work.

### 5. Hook (`useTeamSettings.ts`)

- `createInvitation` signature changes to `(input: { firstName: string; lastName: string; email: string; role: string }) => Promise<string>`.
- Insert payload adds `first_name`, `last_name`, `email`.
- `InvitationRow` adds `first_name | null`, `last_name | null`, `email | null` (select list updated).

### 6. Edge Function

No changes. The function reads `info.staff_email` from `get_invitation_info`, which now resolves via the new fallback chain. Existing behavior — reject if `staff_email` is still null — remains as a defense-in-depth check.

### 7. AcceptInvitationPage

No structural changes. The "Email manquant" branch stays as a guard for legacy/malformed rows but should never trigger for invitations created via the new form.

## Data Flow

```
Manager fills form ──▶ INSERT invitations (first_name, last_name, email, role, token)
                       │
                       └─▶ Copy link to clipboard
                                │
                                ▼
Recipient opens /accept-invitation?token=… ──▶ get_invitation_info(token)
                                                  │
                                                  └─▶ returns staff_email
                                                        (COALESCE i.email, sm.email)
                                                  │
                                  Form shows name + email + role + password input
                                                  │
                  ┌───────────────────────────────┴───────────────────────────────┐
                  │  Recipient is NEW (no auth user)                              │  Recipient is ALREADY signed in
                  │                                                               │
                  ▼                                                               ▼
   Edge fn createUser(staff_email, password)                          accept_invitation(token)
                  │                                                               │
                  └─▶ accept_invitation_admin(token, new_user_id)                 │
                                       │                                          │
                                       ▼                                          ▼
                                    [shared post-auth logic]
                                       │
                                       ├─ FOR UPDATE lookup: existing staff_members
                                       │   row with matching email, no membership?
                                       │   → set staff_member_id, link it
                                       │
                                       ├─ else if staff_member_id was already set:
                                       │   link that existing row
                                       │
                                       └─ else if role=stylist:
                                          create staff_members from invitation row
                                          (first_name, last_name, email, Tailwind color)
```

## Edge Cases

- **Duplicate email in active invitations**: not blocked. The DB had a `UNIQUE (salon_id, email)` constraint historically but the 2026-04-06 migration dropped it. Multiple pending invitations to the same email can coexist; first one to be accepted wins, the rest will fail with "already a member of this salon" when the recipient tries them.
- **Email already belongs to an existing auth user**: existing flow handles this (`existing: true` response, message "Un compte existe déjà…").
- **Email matches a staff_member but that staff is already linked to a membership**: auto-link does NOT fire (constraint `membership_id IS NULL` in the lookup), a new staff record is created. Manager can clean up duplicates manually — out of scope.
- **Whitespace / casing**: trim both ends on email, lowercase before insert. First/last name trimmed only.
- **Cancelling an invitation**: unchanged — sets `expires_at = now()`, row stays in the list as "Expirée" until cleaned up.
- **Copy-link button on expired/accepted rows**: hidden — the link is useless and would mislead.

## Testing

- **Unit (mappers / hook helpers)**: validate the new form input shape and the resulting insert payload.
- **Manual end-to-end**:
  1. Manager (owner role) opens Settings → Invitations → fills form with `prenom=Jane`, `nom=Doe`, `email=jane.doe@test.local`, `role=receptionist` → generates link.
  2. List shows "Jane Doe · jane.doe@test.local · Réceptionniste · En attente" with copy and cancel buttons.
  3. Open link in an incognito window → page shows "Bienvenue chez {Salon}", Nom + Email + Rôle filled, password field present (no "Email manquant").
  4. Set password → auto-signed-in → lands on `/dashboard` as receptionist.
  5. Repeat with role=stylist → confirm a `staff_members` row is created with the form's first_name/last_name/email and a Tailwind-class `color` value (not a hex string).
  6. Repeat with role=stylist where a matching `staff_members.email` already exists with no membership → confirm auto-link (no duplicate row, existing staff row gets `membership_id`).
  7. **Already-authenticated user path**: in another browser, sign in as a user who already has a different account; open the invitation link → `accept_invitation` (auth.uid variant) fires; confirm auto-link + Tailwind-color behavior matches step 5/6.
  8. Cancel a pending invitation from the list → status flips to "Expirée", copy-link button disappears.
  9. Copy-link button on a pending row → clipboard populated with the right URL.

## Rollout

Single PR / commit on `main` (per user's branching preference). Migration applied to remote Supabase via standard `db push`. No backfill needed — existing invitation rows have null name/email and will either be accepted by existing-user flow (where `auth.uid()` is already known) or expire naturally.

## Open Questions

None.
