import React, { useState } from 'react';
import { User, Building2, Shield, Settings2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLinkedStaffMember } from '../hooks/useLinkedStaffMember';
import { ProfileIdentity } from './profile/ProfileIdentity';
import { ProfileSalonRole } from './profile/ProfileSalonRole';
import { ProfileSchedule } from './profile/ProfileSchedule';
import { ProfilePerformance } from './profile/ProfilePerformance';
import { ProfileSecurity } from './profile/ProfileSecurity';
import { ProfilePreferences } from './profile/ProfilePreferences';
import { ProfileDangerZone } from './profile/ProfileDangerZone';

type TabId = 'personal' | 'salon' | 'security' | 'preferences';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const TABS: Tab[] = [
  { id: 'personal', label: 'Informations', icon: User },
  { id: 'salon', label: 'Salon & Rôle', icon: Building2 },
  { id: 'security', label: 'Sécurité', icon: Shield },
  { id: 'preferences', label: 'Préférences', icon: Settings2 },
];

export const ProfilePage: React.FC = () => {
  const { role } = useAuth();
  const { linkedStaff } = useLinkedStaffMember();
  const [activeTab, setActiveTab] = useState<TabId>('personal');

  return (
    <div className="w-full pb-10 animate-in fade-in duration-500">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Mon Profil</h1>
        <p className="text-slate-500 mt-1">Gérez vos informations personnelles et préférences</p>
      </div>

      {/* Horizontal Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-slate-900' : 'text-slate-400'} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in duration-300">
        {activeTab === 'personal' && (
          <div className="space-y-6">
            <ProfileIdentity />
          </div>
        )}

        {activeTab === 'salon' && (
          <div className="space-y-6">
            <ProfileSalonRole />
            {linkedStaff && <ProfileSchedule linkedStaff={linkedStaff} />}
            {linkedStaff && role === 'stylist' && <ProfilePerformance linkedStaff={linkedStaff} />}
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <ProfileSecurity />
            <ProfileDangerZone />
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="space-y-6">
            <ProfilePreferences />
          </div>
        )}
      </div>
    </div>
  );
};
