import type React from 'react';
import { useAuth } from '../../../context/AuthContext';
import type { StaffMember } from '../../../types';
import { ProfileActivityPreview } from './ProfileActivityPreview';
import { ProfileClientPortfolio } from './ProfileClientPortfolio';
import { ProfileContactCard } from './ProfileContactCard';
import { ProfileContractSection } from './ProfileContractSection';
import { ProfileDangerZone } from './ProfileDangerZone';
import { ProfileEmergencyCard } from './ProfileEmergencyCard';
import { ProfileIdentityCard } from './ProfileIdentityCard';
import { ProfilePiiSection } from './ProfilePiiSection';

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
      {/* --- LEFT SIDEBAR --- */}
      <div className="space-y-6">
        <ProfileIdentityCard staff={staff} onSave={onSave} isSaving={isSaving} />
        <ProfileContactCard staff={staff} onSave={onSave} isSaving={isSaving} />
        <ProfileEmergencyCard staff={staff} onSave={onSave} isSaving={isSaving} />
        {canSeePii && (
          <ProfilePiiSection
            staff={staff}
            loadPii={loadPii}
            onSave={onSave}
            isSaving={isSaving}
            currencySymbol={currencySymbol}
          />
        )}
        <ProfileDangerZone staff={staff} onArchive={onArchive} />
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="lg:col-span-2 space-y-6">
        <ProfileContractSection staff={staff} onSave={onSave} isSaving={isSaving} />
        <ProfileClientPortfolio staffId={staff.id} />
        <ProfileActivityPreview staffId={staff.id} onSwitchTab={onSwitchTab} />
      </div>
    </div>
  );
};
