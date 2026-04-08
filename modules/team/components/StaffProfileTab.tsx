import React from 'react';
import type { StaffMember } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { ProfilePersonalSection } from './ProfilePersonalSection';
import { ProfileContractSection } from './ProfileContractSection';
import { ProfilePiiSection } from './ProfilePiiSection';
import { ProfileClientPortfolio } from './ProfileClientPortfolio';
import { ProfileActivityPreview } from './ProfileActivityPreview';
import { ProfileDangerZone } from './ProfileDangerZone';

interface StaffProfileTabProps {
  staff: StaffMember;
  loadPii: () => Promise<Partial<StaffMember>>;
  onSave: (updates: Partial<StaffMember>) => Promise<void>;
  isSaving: boolean;
  currencySymbol: string;
  onArchive: () => void;
  onSwitchTab?: (tab: string) => void;
}

export const StaffProfileTab: React.FC<StaffProfileTabProps> = ({
  staff,
  loadPii,
  onSave,
  isSaving,
  currencySymbol,
  onArchive,
  onSwitchTab,
}) => {
  const { role } = useAuth();
  const canSeePii = role === 'owner' || role === 'manager';

  return (
    <div className="space-y-6">
      <ProfilePersonalSection staff={staff} onSave={onSave} isSaving={isSaving} />
      <ProfileContractSection staff={staff} onSave={onSave} isSaving={isSaving} />
      {canSeePii && (
        <ProfilePiiSection
          staff={staff}
          loadPii={loadPii}
          onSave={onSave}
          isSaving={isSaving}
          currencySymbol={currencySymbol}
        />
      )}
      <ProfileClientPortfolio staffId={staff.id} />
      <ProfileActivityPreview staffId={staff.id} onSwitchTab={onSwitchTab} />
      <ProfileDangerZone staff={staff} onArchive={onArchive} />
    </div>
  );
};
