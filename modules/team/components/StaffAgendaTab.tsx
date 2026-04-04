import React from 'react';
import { StaffMember } from '../../../types';

interface StaffAgendaTabProps {
  staff: StaffMember;
}

export const StaffAgendaTab: React.FC<StaffAgendaTabProps> = () => (
  <div className="bg-white rounded-xl border border-slate-200 p-6 text-slate-500">Agenda — à implémenter</div>
);
