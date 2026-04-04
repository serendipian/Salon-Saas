import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLinkedStaffMember } from '../hooks/useLinkedStaffMember';
import { ProfileIdentity } from './profile/ProfileIdentity';
import { ProfileSalonRole } from './profile/ProfileSalonRole';
import { ProfileSchedule } from './profile/ProfileSchedule';
import { ProfilePerformance } from './profile/ProfilePerformance';
import { ProfileSecurity } from './profile/ProfileSecurity';
import { ProfilePreferences } from './profile/ProfilePreferences';
import { ProfileDangerZone } from './profile/ProfileDangerZone';

export const ProfilePage: React.FC = () => {
  const { role } = useAuth();
  const { linkedStaff } = useLinkedStaffMember();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Mon Profil</h1>

      <ProfileIdentity />
      <ProfileSalonRole />

      {linkedStaff && <ProfileSchedule linkedStaff={linkedStaff} />}
      {linkedStaff && role === 'stylist' && <ProfilePerformance linkedStaff={linkedStaff} />}

      <ProfileSecurity />
      <ProfilePreferences />
      <ProfileDangerZone />
    </div>
  );
};
