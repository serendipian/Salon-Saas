import React from 'react';
import { Calendar, Clock, Users } from 'lucide-react';
import { StaffMember, Appointment, ServiceCategory } from '../../../types';
import { EmptyState } from '../../../components/EmptyState';
// L-22: shared contract chip labels + colors (was duplicated here).
import { CONTRACT_LABELS, CONTRACT_COLORS } from './profile-shared';

interface TeamCardProps {
  team: StaffMember[];
  appointments: Appointment[];
  serviceCategories: ServiceCategory[];
  onSelect: (id: string) => void;
}

function formatStartDate(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const TeamCard: React.FC<TeamCardProps> = ({
  team,
  appointments,
  serviceCategories,
  onSelect,
}) => {
  const getMemberStats = (memberId: string) => {
    const memberAppointments = appointments.filter((a) => a.staffId === memberId);
    const today = new Date().toISOString().slice(0, 10);
    const todaysAppointments = memberAppointments.filter((a) => a.date.startsWith(today));
    const totalRevenue = memberAppointments
      .filter((a) => a.status === 'COMPLETED')
      .reduce((sum, a) => sum + a.price, 0);
    return {
      totalAppointments: memberAppointments.length,
      todayCount: todaysAppointments.length,
      totalRevenue,
    };
  };

  const categoryMap = new Map(serviceCategories.map((c) => [c.id, c]));

  const resolveSkills = (skills: string[]) =>
    skills.map((id) => categoryMap.get(id)).filter((c): c is ServiceCategory => !!c);

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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
      {team.map((member) => {
        const stats = getMemberStats(member.id);
        const initials = `${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`;
        const skills = resolveSkills(member.skills || []);

        return (
          <button
            key={member.id}
            type="button"
            onClick={() => onSelect(member.slug)}
            aria-label={`Voir le profil de ${member.firstName} ${member.lastName}`}
            className={`bg-white rounded-xl border border-slate-200 text-left transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 overflow-hidden group ${member.deletedAt ? 'opacity-50' : ''}`}
          >
            <div className={`h-2 ${member.color}`}></div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-lg font-bold text-slate-600 border-2 border-white shadow-sm relative overflow-hidden">
                    {member.photoUrl ? (
                      <img src={member.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      initials
                    )}
                    <div
                      className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${member.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    ></div>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">
                      {member.firstName} {member.lastName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                        {member.role}
                      </span>
                      {member.contractType && (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${CONTRACT_COLORS[member.contractType] || 'bg-slate-100 text-slate-600'}`}
                        >
                          {CONTRACT_LABELS[member.contractType] || member.contractType}
                        </span>
                      )}
                      {member.deletedAt && (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">
                          Archivé
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {member.startDate && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Calendar size={14} /> Depuis {formatStartDate(member.startDate)}
                  </div>
                )}
                {member.weeklyHours && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Clock size={14} /> {member.weeklyHours}h/sem
                  </div>
                )}
              </div>

              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {skills.map((cat) => (
                    <span
                      key={cat.id}
                      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
                    >
                      {cat.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100">
                <div className="text-center">
                  <div className="text-xs text-slate-400 uppercase font-bold mb-1">RDV Auj.</div>
                  <div className="font-bold text-slate-900">{stats.todayCount}</div>
                </div>
                <div className="text-center border-l border-slate-100">
                  <div className="text-xs text-slate-400 uppercase font-bold mb-1">Total</div>
                  <div className="font-bold text-slate-900">{stats.totalAppointments}</div>
                </div>
                <div className="text-center border-l border-slate-100">
                  <div className="text-xs text-slate-400 uppercase font-bold mb-1">Com.</div>
                  <div className="font-bold text-slate-900">{member.commissionRate}%</div>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
