import React, { useState } from 'react';
import { Shield, UserMinus } from 'lucide-react';
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

// L-1: extracted so the "(vous)" string has a single source of truth.
const CURRENT_USER_LABEL = '(vous)';

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
    if (member.profile_id === currentUserId) return false;
    if (member.role === 'owner') return false;
    if (isOwner) return true;
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

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {memberName(member)}
                {member.profile_id === currentUserId && (
                  <span className="text-xs text-slate-400 ml-2">{CURRENT_USER_LABEL}</span>
                )}
              </p>
              <p className="text-xs text-slate-500 truncate">{member.profile.email}</p>
            </div>

            {canEditRole(member) ? (
              <select
                value={member.role}
                onChange={e => onChangeRole(member.id, e.target.value as Role)}
                disabled={isChangingRole}
                className="text-xs font-medium px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
              >
                <option value={member.role}>{ROLE_LABELS[member.role]}</option>
                {getRoleOptions()
                  .filter(r => r !== member.role)
                  .map(r => (
                    <option key={`role-${r}`} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
              </select>
            ) : (
              <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${ROLE_COLORS[member.role] || 'bg-slate-100 text-slate-600'}`}>
                {ROLE_LABELS[member.role] || member.role}
              </span>
            )}

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
