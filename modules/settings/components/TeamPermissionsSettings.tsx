import { ArrowLeft, Mail, Users } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeamSettings } from '../hooks/useTeamSettings';
import { InvitationsTab } from './InvitationsTab';
import { MembersTab } from './MembersTab';
import { PermissionsReference } from './PermissionsReference';

const tabs = [
  { id: 'members', label: 'Membres', icon: Users },
  { id: 'invitations', label: 'Invitations', icon: Mail },
] as const;

type TabId = (typeof tabs)[number]['id'];

export const TeamPermissionsSettings: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('members');
  const {
    members,
    invitations,
    membersLoading,
    invitationsLoading,
    currentUserRole,
    currentUserId,
    changeRole,
    isChangingRole,
    revokeMember,
    isRevoking,
    transferOwnership,
    isTransferring,
    createInvitation,
    isCreatingInvitation,
    cancelInvitation,
    isCancellingInvitation,
  } = useTeamSettings();

  const isLoading = membersLoading || invitationsLoading;

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-300 w-full">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/settings')}
          className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Équipe & Permissions</h1>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-6">
        {tabs.map((tab) => (
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
