import React from 'react';
import { Phone, ChevronRight, Users } from 'lucide-react';
import { StaffMember, Appointment } from '../../../types';
import { EmptyState } from '../../../components/EmptyState';

interface TeamTableProps {
  team: StaffMember[];
  appointments: Appointment[];
  onSelect: (id: string) => void;
}

export const TeamTable: React.FC<TeamTableProps> = ({ team, appointments, onSelect }) => {
  const getMemberStats = (memberId: string) => {
    const memberAppointments = appointments.filter(a => a.staffId === memberId);
    const today = new Date().toISOString().slice(0, 10);
    const todaysAppointments = memberAppointments.filter(a => a.date.startsWith(today));
    const totalRevenue = memberAppointments.reduce((sum, a) => sum + a.price, 0);
    return {
      totalAppointments: memberAppointments.length,
      todayCount: todaysAppointments.length,
      totalRevenue,
    };
  };

  if (team.length === 0) {
    return (
      <EmptyState
        icon={<Users size={24} />}
        title="Aucun membre trouvé"
        description="Essayez de modifier vos critères de recherche."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Membre</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Contact</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Activité</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Commission</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
            <th className="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {team.map((member) => {
            const stats = getMemberStats(member.id);
            const initials = `${member.firstName[0]}${member.lastName[0]}`;

            return (
              <tr
                key={member.id}
                onClick={() => onSelect(member.id)}
                className="hover:bg-slate-50 transition-colors group cursor-pointer"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 border border-slate-200 relative overflow-hidden shrink-0">
                      {member.photoUrl ? (
                        <img src={member.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        initials
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{member.firstName} {member.lastName}</div>
                      <div className="text-xs text-slate-500">{member.role}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 hidden md:table-cell">
                  <div className="text-sm text-slate-600 flex flex-col gap-1">
                    <span className="flex items-center gap-2"><Phone size={14} /> {member.phone}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-4 text-center">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{stats.todayCount}</div>
                      <div className="text-[10px] text-slate-400 uppercase">Auj.</div>
                    </div>
                    <div className="w-px h-6 bg-slate-200"></div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{stats.totalAppointments}</div>
                      <div className="text-[10px] text-slate-400 uppercase">Total</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 hidden lg:table-cell">
                  <span className="text-sm font-bold text-slate-900">{member.commissionRate}%</span>
                </td>
                <td className="px-6 py-4">
                  {member.active ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                      Actif
                    </span>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                      Inactif
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-1 text-slate-300 hover:text-slate-900 transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
