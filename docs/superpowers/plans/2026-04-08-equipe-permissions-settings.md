# Equipe & Permissions Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "Equipe & Permissions" settings tab so salon owners/managers can view members, change roles, revoke access, manage invitations, and transfer ownership.

**Architecture:** New `useTeamSettings` hook queries `salon_memberships` (joined with `profiles`) and `invitations`. Six new UI components render the two sub-tabs (Membres, Invitations), a permissions reference card, and confirmation modals. The existing `SettingsModule.tsx` gets a one-line wiring change.

**Tech Stack:** React 19, TypeScript, TanStack Query, Supabase, Tailwind CSS, Lucide icons

---

## File Structure

| File | Responsibility |
|------|---------------|
| `modules/settings/hooks/useTeamSettings.ts` | Queries memberships+profiles, invitations. Mutations for role change, revoke, transfer, create/cancel invitation |
| `modules/settings/components/TeamPermissionsSettings.tsx` | Container: back button, sub-tab nav (Membres/Invitations), renders active tab + PermissionsReference |
| `modules/settings/components/MembersTab.tsx` | List of salon members with role dropdowns and revoke buttons |
| `modules/settings/components/InvitationsTab.tsx` | List of invitations + "Inviter un membre" flow with link generation |
| `modules/settings/components/PermissionsReference.tsx` | Collapsible read-only role→permission matrix table |
| `modules/settings/components/TransferOwnershipModal.tsx` | Dangerous-action modal for ownership transfer |
| `modules/settings/components/RevokeAccessModal.tsx` | Confirmation modal for revoking a member |
| `modules/settings/SettingsModule.tsx` | Wire `activeSection === 'team'` to `TeamPermissionsSettings` (modify lines 103-106) |

---

### Task 1: Data Hook — `useTeamSettings.ts`

**Files:**
- Create: `modules/settings/hooks/useTeamSettings.ts`

**Context:** This hook provides all data and mutations for the settings tab. It queries `salon_memberships` joined with `profiles` and `invitations`. Mutations use TanStack Query's `useMutation` with toast feedback via `useMutationToast`.

- [ ] **Step 1: Create the hook file with member and invitation queries**

```typescript
// modules/settings/hooks/useTeamSettings.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import type { Role } from '../../../lib/auth.types';

export interface MemberRow {
  id: string;
  role: Role;
  status: string;
  created_at: string;
  accepted_at: string | null;
  profile_id: string;
  profile: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export interface InvitationRow {
  id: string;
  role: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  staff_member_id: string | null;
}

const STAFF_ROLE_MAP: Record<string, string> = {
  owner: 'Manager',
  manager: 'Manager',
  stylist: 'Stylist',
  receptionist: 'Receptionist',
};

export function useTeamSettings() {
  const { activeSalon, profile, role: currentUserRole } = useAuth();
  const salonId = activeSalon?.id;
  const queryClient = useQueryClient();
  const { toastOnError, toastOnSuccess } = useMutationToast();

  // --- Queries ---

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['team-settings-members', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salon_memberships')
        .select('id, role, status, created_at, accepted_at, profile_id, profiles:profile_id(id, first_name, last_name, email, avatar_url)')
        .eq('salon_id', salonId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        profile: row.profiles,
      })) as MemberRow[];
    },
    enabled: !!salonId,
  });

  const { data: invitations = [], isLoading: invitationsLoading } = useQuery({
    queryKey: ['team-settings-invitations', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('id, role, token, created_at, expires_at, accepted_at, staff_member_id')
        .eq('salon_id', salonId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as InvitationRow[];
    },
    enabled: !!salonId,
  });

  // --- Mutations ---

  const changeRoleMutation = useMutation({
    mutationFn: async ({ membershipId, newRole }: { membershipId: string; newRole: Role }) => {
      // 1. Update salon_memberships.role
      const { error: membershipError } = await supabase
        .from('salon_memberships')
        .update({ role: newRole })
        .eq('id', membershipId)
        .eq('salon_id', salonId!);
      if (membershipError) throw membershipError;

      // 2. Sync linked staff_members.role
      const { error: staffError } = await supabase
        .from('staff_members')
        .update({ role: STAFF_ROLE_MAP[newRole] || 'Stylist' })
        .eq('membership_id', membershipId)
        .eq('salon_id', salonId!)
        .is('deleted_at', null);
      if (staffError) throw staffError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-settings-members', salonId] });
      toastOnSuccess('Rôle mis à jour')();
    },
    onError: toastOnError('Erreur lors du changement de rôle'),
  });

  const revokeMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabase.rpc('revoke_membership', { p_membership_id: membershipId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-settings-members', salonId] });
      toastOnSuccess('Accès révoqué')();
    },
    onError: toastOnError('Impossible de retirer ce membre'),
  });

  const transferMutation = useMutation({
    mutationFn: async (newOwnerProfileId: string) => {
      const { error } = await supabase.rpc('transfer_ownership', {
        p_salon_id: salonId!,
        p_new_owner_id: newOwnerProfileId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-settings-members', salonId] });
      toastOnSuccess('Propriété transférée')();
      // Force full page reload to refresh auth context with new role
      window.location.reload();
    },
    onError: toastOnError('Impossible de transférer la propriété'),
  });

  const createInvitationMutation = useMutation({
    mutationFn: async (role: string) => {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data, error } = await supabase
        .from('invitations')
        .insert({
          salon_id: salonId!,
          role,
          token,
          invited_by: profile!.id,
          expires_at: expiresAt.toISOString(),
        })
        .select('token')
        .single();
      if (error) throw error;
      return data.token;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-settings-invitations', salonId] });
    },
    onError: toastOnError("Erreur lors de la création de l'invitation"),
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('invitations')
        .update({ expires_at: new Date().toISOString() })
        .eq('id', invitationId)
        .eq('salon_id', salonId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-settings-invitations', salonId] });
      toastOnSuccess('Invitation annulée')();
    },
    onError: toastOnError("Erreur lors de l'annulation"),
  });

  return {
    members,
    invitations,
    membersLoading,
    invitationsLoading,
    currentUserRole,
    currentUserId: profile?.id,
    changeRole: (membershipId: string, newRole: Role) =>
      changeRoleMutation.mutateAsync({ membershipId, newRole }),
    isChangingRole: changeRoleMutation.isPending,
    revokeMember: (membershipId: string) => revokeMutation.mutateAsync(membershipId),
    isRevoking: revokeMutation.isPending,
    transferOwnership: (newOwnerProfileId: string) => transferMutation.mutateAsync(newOwnerProfileId),
    isTransferring: transferMutation.isPending,
    createInvitation: (role: string) => createInvitationMutation.mutateAsync(role),
    isCreatingInvitation: createInvitationMutation.isPending,
    cancelInvitation: (id: string) => cancelInvitationMutation.mutateAsync(id),
    isCancellingInvitation: cancelInvitationMutation.isPending,
  };
}
```

- [ ] **Step 2: Verify the hook compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep useTeamSettings || echo "OK"`
Expected: No errors referencing useTeamSettings, or "OK"

- [ ] **Step 3: Commit**

```bash
git add modules/settings/hooks/useTeamSettings.ts
git commit -m "feat(settings): add useTeamSettings hook for members and invitations"
```

---

### Task 2: RevokeAccessModal

**Files:**
- Create: `modules/settings/components/RevokeAccessModal.tsx`

**Context:** Simple confirmation modal. Uses the same overlay pattern as `InvitationModal` (fixed inset-0, z-50, bg-black/50). Shows member name and a warning about what revoke does.

- [ ] **Step 1: Create the modal component**

```typescript
// modules/settings/components/RevokeAccessModal.tsx
import React from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface RevokeAccessModalProps {
  memberName: string;
  onConfirm: () => void;
  onClose: () => void;
  isLoading: boolean;
}

export const RevokeAccessModal: React.FC<RevokeAccessModalProps> = ({
  memberName, onConfirm, onClose, isLoading,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
    <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Révoquer l'accès</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-lg mb-4">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <p className="text-sm text-red-700">
          Cette action supprimera l'accès de <strong>{memberName}</strong> au salon et archivera son profil équipe associé. Cette action est irréversible.
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          Annuler
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 flex items-center gap-2"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          Confirmer la révocation
        </button>
      </div>
    </div>
  </div>
);
```

- [ ] **Step 2: Commit**

```bash
git add modules/settings/components/RevokeAccessModal.tsx
git commit -m "feat(settings): add RevokeAccessModal component"
```

---

### Task 3: TransferOwnershipModal

**Files:**
- Create: `modules/settings/components/TransferOwnershipModal.tsx`

**Context:** Dangerous action modal. Dropdown of active non-owner members. Requires typing the salon name to confirm. Calls `transferOwnership` mutation.

- [ ] **Step 1: Create the modal component**

```typescript
// modules/settings/components/TransferOwnershipModal.tsx
import React, { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import type { MemberRow } from '../hooks/useTeamSettings';

interface TransferOwnershipModalProps {
  members: MemberRow[];
  salonName: string;
  onConfirm: (newOwnerProfileId: string) => void;
  onClose: () => void;
  isLoading: boolean;
}

export const TransferOwnershipModal: React.FC<TransferOwnershipModalProps> = ({
  members, salonName, onConfirm, onClose, isLoading,
}) => {
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const eligibleMembers = members.filter(m => m.role !== 'owner' && m.status === 'active');
  const canConfirm = selectedProfileId && confirmText === salonName && !isLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Transférer la propriété</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            Vous serez rétrogradé au rôle de <strong>manager</strong>. Le nouveau propriétaire aura un contrôle total sur le salon.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nouveau propriétaire</label>
            <select
              value={selectedProfileId}
              onChange={e => setSelectedProfileId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              <option value="">Sélectionner un membre...</option>
              {eligibleMembers.map(m => (
                <option key={m.profile.id} value={m.profile.id}>
                  {m.profile.first_name} {m.profile.last_name} — {m.role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tapez <strong>{salonName}</strong> pour confirmer
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder={salonName}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(selectedProfileId)}
            disabled={!canConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Transférer
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/settings/components/TransferOwnershipModal.tsx
git commit -m "feat(settings): add TransferOwnershipModal component"
```

---

### Task 4: PermissionsReference

**Files:**
- Create: `modules/settings/components/PermissionsReference.tsx`

**Context:** Collapsible card showing the role→permission matrix. Read-only, informational. Uses the same data as `usePermissions.ts` but rendered as a human-readable French table.

- [ ] **Step 1: Create the component**

```typescript
// modules/settings/components/PermissionsReference.tsx
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check, X as XIcon } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  manager: 'Manager',
  stylist: 'Styliste',
  receptionist: 'Réceptionniste',
};

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Tableau de bord',
  appointments: 'Rendez-vous',
  clients: 'Clients',
  pos: 'Caisse',
  services: 'Services',
  products: 'Produits',
  team: 'Équipe',
  accounting: 'Comptabilité',
  suppliers: 'Fournisseurs',
  settings: 'Réglages',
  billing: 'Facturation',
};

const ACCESS_MATRIX: Record<string, Record<string, string>> = {
  dashboard:    { owner: 'Complet', manager: 'Complet', stylist: 'Personnel', receptionist: 'Résumé' },
  appointments: { owner: 'Complet', manager: 'Complet', stylist: 'Personnel', receptionist: 'Complet' },
  clients:      { owner: 'Complet', manager: 'Complet', stylist: 'Assignés', receptionist: 'Complet' },
  pos:          { owner: 'Complet', manager: 'Complet', stylist: 'Complet', receptionist: 'Complet' },
  services:     { owner: 'Complet', manager: 'Complet', stylist: 'Lecture', receptionist: 'Lecture' },
  products:     { owner: 'Complet', manager: 'Complet', stylist: 'Lecture', receptionist: 'Lecture' },
  team:         { owner: 'Complet', manager: 'Complet', stylist: 'Personnel', receptionist: 'Personnel' },
  accounting:   { owner: 'Complet', manager: 'Complet', stylist: '—', receptionist: '—' },
  suppliers:    { owner: 'Complet', manager: 'Complet', stylist: '—', receptionist: '—' },
  settings:     { owner: 'Complet', manager: 'Complet', stylist: '—', receptionist: '—' },
  billing:      { owner: 'Complet', manager: '—', stylist: '—', receptionist: '—' },
};

const roles = ['owner', 'manager', 'stylist', 'receptionist'] as const;

function AccessBadge({ level }: { level: string }) {
  if (level === '—') return <XIcon className="w-4 h-4 text-slate-300 mx-auto" />;
  if (level === 'Complet') return <Check className="w-4 h-4 text-emerald-500 mx-auto" />;
  return <span className="text-xs text-slate-500">{level}</span>;
}

export const PermissionsReference: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-slate-200 rounded-xl bg-white">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors rounded-xl"
      >
        <span className="font-medium text-sm text-slate-700">Matrice des permissions par rôle</span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {isOpen && (
        <div className="border-t border-slate-200 p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 pr-4 font-medium text-slate-500">Module</th>
                {roles.map(r => (
                  <th key={r} className="py-2 px-3 font-medium text-slate-500 text-center">{ROLE_LABELS[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(MODULE_LABELS).map(([key, label]) => (
                <tr key={key} className="border-b border-slate-50">
                  <td className="py-2 pr-4 text-slate-700">{label}</td>
                  {roles.map(r => (
                    <td key={r} className="py-2 px-3 text-center">
                      <AccessBadge level={ACCESS_MATRIX[key]?.[r] || '—'} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/settings/components/PermissionsReference.tsx
git commit -m "feat(settings): add PermissionsReference collapsible matrix"
```

---

### Task 5: MembersTab

**Files:**
- Create: `modules/settings/components/MembersTab.tsx`

**Context:** Main member list. Shows all active salon memberships with role dropdowns and revoke buttons. Access rules: owner can edit all non-owner/non-self rows; manager can edit stylist/receptionist rows only. Danger zone with transfer ownership at bottom (owner only). Uses `MemberRow` type from useTeamSettings.

- [ ] **Step 1: Create the MembersTab component**

```typescript
// modules/settings/components/MembersTab.tsx
import React, { useState } from 'react';
import { Shield, UserMinus, Loader2 } from 'lucide-react';
import type { Role } from '../../../lib/auth.types';
import type { MemberRow } from '../hooks/useTeamSettings';
import { RevokeAccessModal } from './RevokeAccessModal';
import { TransferOwnershipModal } from './TransferOwnershipModal';
import { useAuth } from '../../../context/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  manager: 'Manager',
  stylist: 'Styliste',
  receptionist: 'Réceptionniste',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-blue-100 text-blue-700',
  manager: 'bg-purple-100 text-purple-700',
  stylist: 'bg-emerald-100 text-emerald-700',
  receptionist: 'bg-amber-100 text-amber-700',
};

interface MembersTabProps {
  members: MemberRow[];
  currentUserRole: Role | null;
  currentUserId: string | undefined;
  onChangeRole: (membershipId: string, newRole: Role) => Promise<void>;
  isChangingRole: boolean;
  onRevoke: (membershipId: string) => Promise<void>;
  isRevoking: boolean;
  onTransfer: (newOwnerProfileId: string) => Promise<void>;
  isTransferring: boolean;
}

export const MembersTab: React.FC<MembersTabProps> = ({
  members, currentUserRole, currentUserId,
  onChangeRole, isChangingRole,
  onRevoke, isRevoking,
  onTransfer, isTransferring,
}) => {
  const { activeSalon } = useAuth();
  const [revokeTarget, setRevokeTarget] = useState<MemberRow | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);

  const isOwner = currentUserRole === 'owner';
  const isManager = currentUserRole === 'manager';

  function canEditRole(member: MemberRow): boolean {
    // Can't edit yourself
    if (member.profile_id === currentUserId) return false;
    // Can't edit owner rows
    if (member.role === 'owner') return false;
    // Owner can edit anyone else
    if (isOwner) return true;
    // Manager can only edit stylist/receptionist
    if (isManager && (member.role === 'stylist' || member.role === 'receptionist')) return true;
    return false;
  }

  function canRevoke(member: MemberRow): boolean {
    if (member.profile_id === currentUserId) return false;
    if (member.role === 'owner') return false;
    if (isOwner) return true;
    if (isManager && member.role !== 'manager') return true;
    return false;
  }

  function getRoleOptions(): Role[] {
    if (isOwner) return ['manager', 'stylist', 'receptionist'];
    if (isManager) return ['stylist', 'receptionist'];
    return [];
  }

  const memberName = (m: MemberRow) =>
    [m.profile.first_name, m.profile.last_name].filter(Boolean).join(' ') || m.profile.email;

  const initials = (m: MemberRow) => {
    const f = m.profile.first_name?.charAt(0) || '';
    const l = m.profile.last_name?.charAt(0) || '';
    return (f + l).toUpperCase() || m.profile.email.charAt(0).toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div className="border border-slate-200 rounded-xl bg-white divide-y divide-slate-100">
        {members.map(member => (
          <div key={member.id} className="flex items-center gap-4 p-4">
            {/* Avatar */}
            {member.profile.avatar_url ? (
              <img
                src={member.profile.avatar_url}
                alt={memberName(member)}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <span className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600 shrink-0">
                {initials(member)}
              </span>
            )}

            {/* Name + email */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {memberName(member)}
                {member.profile_id === currentUserId && (
                  <span className="text-xs text-slate-400 ml-2">(vous)</span>
                )}
              </p>
              <p className="text-xs text-slate-500 truncate">{member.profile.email}</p>
            </div>

            {/* Role */}
            {canEditRole(member) ? (
              <select
                value={member.role}
                onChange={e => onChangeRole(member.id, e.target.value as Role)}
                disabled={isChangingRole}
                className="text-xs font-medium px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
              >
                {/* Show current role even if not in options (e.g. owner viewing a manager) */}
                <option value={member.role}>{ROLE_LABELS[member.role]}</option>
                {getRoleOptions()
                  .filter(r => r !== member.role)
                  .map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
              </select>
            ) : (
              <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${ROLE_COLORS[member.role] || 'bg-slate-100 text-slate-600'}`}>
                {ROLE_LABELS[member.role] || member.role}
              </span>
            )}

            {/* Revoke button */}
            {canRevoke(member) && (
              <button
                onClick={() => setRevokeTarget(member)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Révoquer l'accès"
              >
                <UserMinus className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}

        {members.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-400">Aucun membre</div>
        )}
      </div>

      {/* Danger zone — owner only */}
      {isOwner && (
        <div className="border border-red-200 rounded-xl bg-red-50/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-red-500" />
            <h4 className="text-sm font-semibold text-red-700">Zone dangereuse</h4>
          </div>
          <p className="text-xs text-red-600 mb-3">
            Transférer la propriété du salon à un autre membre. Vous deviendrez manager.
          </p>
          <button
            onClick={() => setShowTransfer(true)}
            className="px-3 py-1.5 text-xs font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-100 transition-colors"
          >
            Transférer la propriété
          </button>
        </div>
      )}

      {/* Modals */}
      {revokeTarget && (
        <RevokeAccessModal
          memberName={memberName(revokeTarget)}
          onConfirm={async () => {
            await onRevoke(revokeTarget.id);
            setRevokeTarget(null);
          }}
          onClose={() => setRevokeTarget(null)}
          isLoading={isRevoking}
        />
      )}

      {showTransfer && (
        <TransferOwnershipModal
          members={members}
          salonName={activeSalon?.name || ''}
          onConfirm={async (profileId) => {
            await onTransfer(profileId);
            setShowTransfer(false);
          }}
          onClose={() => setShowTransfer(false)}
          isLoading={isTransferring}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/settings/components/MembersTab.tsx
git commit -m "feat(settings): add MembersTab with role management and revoke"
```

---

### Task 6: InvitationsTab

**Files:**
- Create: `modules/settings/components/InvitationsTab.tsx`

**Context:** Shows all invitations (pending/accepted/expired). "Inviter un membre" button opens an inline form with a role picker that generates a shareable link. Cancel button on pending invitations.

- [ ] **Step 1: Create the InvitationsTab component**

```typescript
// modules/settings/components/InvitationsTab.tsx
import React, { useState } from 'react';
import { Plus, Copy, Check, X, Loader2, Link as LinkIcon } from 'lucide-react';
import type { InvitationRow } from '../hooks/useTeamSettings';

const ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  stylist: 'Styliste',
  receptionist: 'Réceptionniste',
};

const ROLE_COLORS: Record<string, string> = {
  manager: 'bg-purple-100 text-purple-700',
  stylist: 'bg-emerald-100 text-emerald-700',
  receptionist: 'bg-amber-100 text-amber-700',
};

function getStatus(inv: InvitationRow): { label: string; className: string } {
  if (inv.accepted_at) return { label: 'Acceptée', className: 'bg-emerald-100 text-emerald-700' };
  if (new Date(inv.expires_at) < new Date()) return { label: 'Expirée', className: 'bg-slate-100 text-slate-500' };
  return { label: 'En attente', className: 'bg-orange-100 text-orange-700' };
}

function isPending(inv: InvitationRow): boolean {
  return !inv.accepted_at && new Date(inv.expires_at) > new Date();
}

interface InvitationsTabProps {
  invitations: InvitationRow[];
  onCreate: (role: string) => Promise<string>;
  isCreating: boolean;
  onCancel: (id: string) => Promise<void>;
  isCancelling: boolean;
}

export const InvitationsTab: React.FC<InvitationsTabProps> = ({
  invitations, onCreate, isCreating, onCancel, isCancelling,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [selectedRole, setSelectedRole] = useState('stylist');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    const token = await onCreate(selectedRole);
    setGeneratedLink(`${window.location.origin}/accept-invitation?token=${token}`);
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setShowForm(false);
    setGeneratedLink(null);
    setSelectedRole('stylist');
    setCopied(false);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Create invitation */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Inviter un membre
        </button>
      ) : (
        <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-4">
          {!generatedLink ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rôle</label>
                <select
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value)}
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
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
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
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Lien d'invitation ({ROLE_LABELS[selectedRole]}) — expire dans 7 jours.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={generatedLink}
                  readOnly
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-700 truncate"
                />
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium shrink-0"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copié' : 'Copier'}
                </button>
              </div>
              <button onClick={handleClose} className="text-sm text-slate-500 hover:text-slate-700">
                Fermer
              </button>
            </>
          )}
        </div>
      )}

      {/* Invitations list */}
      <div className="border border-slate-200 rounded-xl bg-white divide-y divide-slate-100">
        {invitations.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Aucune invitation</div>
        ) : (
          invitations.map(inv => {
            const status = getStatus(inv);
            return (
              <div key={inv.id} className="flex items-center gap-4 p-4">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[inv.role] || 'bg-slate-100 text-slate-600'}`}>
                  {ROLE_LABELS[inv.role] || inv.role}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500">
                    Créée le {formatDate(inv.created_at)} · Expire le {formatDate(inv.expires_at)}
                  </p>
                </div>

                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.className}`}>
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
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/settings/components/InvitationsTab.tsx
git commit -m "feat(settings): add InvitationsTab with link generation"
```

---

### Task 7: TeamPermissionsSettings Container

**Files:**
- Create: `modules/settings/components/TeamPermissionsSettings.tsx`

**Context:** Container component with back button and sub-tab navigation (Membres/Invitations). Renders the active tab plus the PermissionsReference card at the bottom. Follows the same layout pattern as `GeneralSettings` (back arrow + title at top).

- [ ] **Step 1: Create the container component**

```typescript
// modules/settings/components/TeamPermissionsSettings.tsx
import React, { useState } from 'react';
import { ArrowLeft, Users, Mail } from 'lucide-react';
import { useTeamSettings } from '../hooks/useTeamSettings';
import { MembersTab } from './MembersTab';
import { InvitationsTab } from './InvitationsTab';
import { PermissionsReference } from './PermissionsReference';

const tabs = [
  { id: 'members', label: 'Membres', icon: Users },
  { id: 'invitations', label: 'Invitations', icon: Mail },
] as const;

type TabId = (typeof tabs)[number]['id'];

export const TeamPermissionsSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<TabId>('members');
  const {
    members, invitations, membersLoading, invitationsLoading,
    currentUserRole, currentUserId,
    changeRole, isChangingRole,
    revokeMember, isRevoking,
    transferOwnership, isTransferring,
    createInvitation, isCreatingInvitation,
    cancelInvitation, isCancellingInvitation,
  } = useTeamSettings();

  const isLoading = membersLoading || invitationsLoading;

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-300 w-full">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Équipe & Permissions</h1>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === 'members' && (
            <MembersTab
              members={members}
              currentUserRole={currentUserRole}
              currentUserId={currentUserId}
              onChangeRole={changeRole}
              isChangingRole={isChangingRole}
              onRevoke={revokeMember}
              isRevoking={isRevoking}
              onTransfer={transferOwnership}
              isTransferring={isTransferring}
            />
          )}

          {activeTab === 'invitations' && (
            <InvitationsTab
              invitations={invitations}
              onCreate={createInvitation}
              isCreating={isCreatingInvitation}
              onCancel={cancelInvitation}
              isCancelling={isCancellingInvitation}
            />
          )}

          <PermissionsReference />
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add modules/settings/components/TeamPermissionsSettings.tsx
git commit -m "feat(settings): add TeamPermissionsSettings container with tabs"
```

---

### Task 8: Wire into SettingsModule

**Files:**
- Modify: `modules/settings/SettingsModule.tsx:2-21,87-106`

**Context:** Add import for `TeamPermissionsSettings` and replace the placeholder fallthrough for `activeSection === 'team'` with the real component.

- [ ] **Step 1: Add import and routing**

Add the import at line 20 (after OpeningHoursSettings import):

```typescript
import { TeamPermissionsSettings } from './components/TeamPermissionsSettings';
```

Add a new condition block **before** the generic placeholder fallthrough (before line 103). Insert after the billing block (line 101):

```typescript
  if (activeSection === 'team') {
    return <TeamPermissionsSettings onBack={() => setActiveSection(null)} />;
  }
```

The existing generic placeholder at lines 103-106 will no longer trigger for 'team' since the new block catches it first.

- [ ] **Step 2: Verify the app compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`
1. Navigate to Settings
2. Click "Équipe & Permissions"
3. Verify: Members tab loads showing salon members with roles
4. Verify: Role dropdown appears on eligible members
5. Switch to Invitations tab, click "Inviter un membre", generate a link
6. Expand permissions matrix at bottom

- [ ] **Step 4: Commit**

```bash
git add modules/settings/SettingsModule.tsx
git commit -m "feat(settings): wire Equipe & Permissions tab into SettingsModule"
```
