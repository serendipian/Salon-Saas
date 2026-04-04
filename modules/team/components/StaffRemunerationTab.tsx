import React from 'react';
import { StaffMember } from '../../../types';

interface StaffRemunerationTabProps {
  staff: StaffMember;
  currencySymbol: string;
  onSave: (updates: Partial<StaffMember>) => Promise<void>;
}

export const StaffRemunerationTab: React.FC<StaffRemunerationTabProps> = () => (
  <div className="bg-white rounded-xl border border-slate-200 p-6 text-slate-500">Rémunération — à implémenter</div>
);
