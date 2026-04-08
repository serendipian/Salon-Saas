# Equipe & Permissions Settings Tab

## Overview

Implement the "Equipe & Permissions" section in the Settings module. This is the **access control center** for the salon — managing who can log in, their role, and invitations. Distinct from `/team` which handles HR/operational staff management.

## Architecture

### New Files

```
modules/settings/components/
  TeamPermissionsSettings.tsx    # Main container with sub-tab navigation
  MembersTab.tsx                 # Active membership list with role management
  InvitationsTab.tsx             # Invitation list + create new invitation
  PermissionsReference.tsx       # Collapsible role→permission matrix
  TransferOwnershipModal.tsx     # Confirmation modal for ownership transfer
  RevokeAccessModal.tsx          # Confirmation modal for revoking a member

modules/settings/hooks/
  useTeamSettings.ts             # Queries memberships + profiles + invitations
```

### Modified Files

```
modules/settings/SettingsModule.tsx   # Wire 'team' section to TeamPermissionsSettings
```

## Data Layer — `useTeamSettings.ts`

### Queries

**Members query:** `salon_memberships` joined with `profiles` for the active salon.

```typescript
supabase
  .from('salon_memberships')
  .select('*, profiles:profile_id(id, first_name, last_name, email, avatar_url)')
  .eq('salon_id', salonId)
  .is('deleted_at', null)
  .order('created_at', { ascending: true })
```

Returns: `{ id, role, status, created_at, accepted_at, profile: { id, first_name, last_name, email, avatar_url } }[]`

**Invitations query:**

```typescript
supabase
  .from('invitations')
  .select('*')
  .eq('salon_id', salonId)
  .order('created_at', { ascending: false })
```

### Mutations

**Change role:** Updates both `salon_memberships.role` and linked `staff_members.role` to keep them in sync.

```typescript
async function changeRole(membershipId: string, newRole: Role) {
  // 1. Update salon_memberships.role
  await supabase
    .from('salon_memberships')
    .update({ role: newRole })
    .eq('id', membershipId)
    .eq('salon_id', salonId)

  // 2. Sync staff_members.role if linked
  const staffRoleMap = { owner: 'Manager', manager: 'Manager', stylist: 'Stylist', receptionist: 'Receptionist' }
  await supabase
    .from('staff_members')
    .update({ role: staffRoleMap[newRole] })
    .eq('membership_id', membershipId)
    .eq('salon_id', salonId)
    .is('deleted_at', null)

  // 3. Invalidate queries
}
```

**Revoke access:** Calls existing `revoke_membership` RPC.

```typescript
await supabase.rpc('revoke_membership', { p_membership_id: membershipId })
```

**Transfer ownership:** Calls existing `transfer_ownership` RPC.

```typescript
await supabase.rpc('transfer_ownership', {
  p_salon_id: salonId,
  p_new_owner_id: targetProfileId
})
```

**Create invitation (standalone):** New flow without `staff_member_id`.

```typescript
await supabase.from('invitations').insert({
  salon_id: salonId,
  role: selectedRole,  // 'manager' | 'stylist' | 'receptionist'
  token: crypto.randomUUID(),
  invited_by: profile.id,
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  // staff_member_id omitted (NULL) — new person, no existing staff record
})
```

**Cancel invitation:** Expire a pending invitation.

```typescript
await supabase
  .from('invitations')
  .update({ expires_at: new Date().toISOString() })
  .eq('id', invitationId)
  .eq('salon_id', salonId)
```

## UI Components

### TeamPermissionsSettings.tsx

Container component. Back button (like other settings sections) + two sub-tabs:
- **Membres** (default) — `MembersTab`
- **Invitations** — `InvitationsTab`

Below the tabs: collapsible `PermissionsReference` card.

### MembersTab.tsx

Table/list of active salon memberships:

| Column | Content |
|--------|---------|
| Membre | Avatar + full name + email |
| Role | Badge (owner=blue, manager=purple, stylist=green, receptionist=amber) |
| Depuis | `accepted_at` formatted as relative date |
| Actions | Role dropdown + Revoke button |

**Access rules:**
- **Owner sees:** Role dropdown on all non-owner rows, revoke button, transfer ownership in danger zone
- **Manager sees:** Role dropdown on stylist/receptionist rows only (not on owner or other manager rows), revoke button on stylist/receptionist rows only
- Owner row is always read-only (no self-demotion)
- Current user's own row: read-only (can't change own role or revoke self)

**Role dropdown options:**
- For owner: `manager`, `stylist`, `receptionist` (on non-owner members)
- For manager: `stylist`, `receptionist` (cannot promote to manager or owner)

**Danger zone (owner only):**
- "Transférer la propriété" button
- Opens `TransferOwnershipModal` with dropdown of active non-owner members
- Warning text: current owner will be demoted to manager
- Requires typing salon name to confirm

### InvitationsTab.tsx

List of invitations (newest first):

| Column | Content |
|--------|---------|
| Role | Badge matching the invited role |
| Lien | Copyable invitation URL (truncated) |
| Créée le | Creation date |
| Expire le | Expiry date |
| Statut | Pending (orange) / Accepted (green) / Expired (gray) |
| Actions | Cancel button (pending only) |

**"Inviter un membre" button:**
- Opens inline form or small modal
- Role picker: `manager`, `stylist`, `receptionist` (no owner)
- Generates link immediately on submit
- Shows copyable link with copy-to-clipboard button

### RevokeAccessModal.tsx

Confirmation modal:
- Shows member name and role
- Warning: "Cette action supprimera l'accès de {name} au salon et archivera son profil équipe associé."
- "Confirmer" (red) / "Annuler" buttons
- On confirm: calls `revoke_membership` RPC

### TransferOwnershipModal.tsx

Dangerous action modal:
- Dropdown of active non-owner members
- Warning: "Vous serez rétrogradé au rôle de manager. Cette action est irréversible."
- Type salon name to confirm
- On confirm: calls `transfer_ownership` RPC
- On success: refreshes auth context (role changes for current user)

### PermissionsReference.tsx

Collapsible card (collapsed by default), title: "Matrice des permissions".

Read-only table built from the permission matrix in `usePermissions.ts`:

| Module | Propriétaire | Manager | Styliste | Réceptionniste |
|--------|-------------|---------|----------|----------------|
| Tableau de bord | Complet | Complet | Personnel | Résumé |
| Rendez-vous | Complet | Complet | Personnel | Complet |
| ... | ... | ... | ... | ... |

Uses check/cross icons and access level labels. Informational only.

## Integration with SettingsModule

In `SettingsModule.tsx`, replace the placeholder rendering for `activeSection === 'team'` with:

```typescript
case 'team':
  return <TeamPermissionsSettings onBack={() => setActiveSection(null)} />;
```

## Permission Guards

- Only `owner` and `manager` roles can access this settings section (matches existing settings access in `usePermissions`)
- Within the section, owner has full control; manager has limited control (cannot edit owner rows, cannot transfer ownership)
- All mutations are additionally protected by RLS policies server-side

## Error Handling

- `revoke_membership` on sole owner → RPC raises exception → toast: "Impossible de retirer le dernier propriétaire"
- Role update on owner row → should never reach server (UI guard), but RLS + trigger protect
- `transfer_ownership` by non-owner → RPC raises exception → toast: "Seul le propriétaire peut transférer"
- Expired/invalid invitation cancel → no-op (already expired)

## Not In Scope (v1)

- **Suspend/unsuspend members** — DB column exists but no RPC; add in v2
- **Custom permissions** — roles are fixed, matching RLS model
- **Email invitations** — invitation is a shareable link (consistent with existing flow)
- **Invitation resend** — cancel + create new instead
