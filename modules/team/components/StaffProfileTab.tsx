import React from 'react';
import { StaffMember } from '../../../types';

interface StaffProfileTabProps {
  staff: StaffMember;
  loadPii: () => Promise<Partial<StaffMember>>;
  onSave: (updates: Partial<StaffMember>) => Promise<void>;
  isSaving: boolean;
  currencySymbol: string;
  onArchive: () => void;
}

export const StaffProfileTab: React.FC<StaffProfileTabProps> = ({ staff }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-6 text-slate-500">
    Profil de {staff.firstName} {staff.lastName} — à implémenter
  </div>
);
