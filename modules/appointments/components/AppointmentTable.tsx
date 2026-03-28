
import React, { useMemo } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Appointment, StaffMember, Service, ServiceCategory } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { CategoryIcon } from '../../../lib/categoryIcons';
import { EmptyState } from '../../../components/EmptyState';
import { StaffAvatar } from '../../../components/StaffAvatar';
import { StatusBadge } from './StatusBadge';

interface AppointmentTableProps {
  appointments: Appointment[];
  team: StaffMember[];
  services: Service[];
  categories: ServiceCategory[];
  onDetails: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

/** Group appointments by day, then by client within each day */
function groupByDayAndClient(appointments: Appointment[]) {
  const dayMap = new Map<string, Appointment[]>();

  for (const appt of appointments) {
    const d = new Date(appt.date);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const list = dayMap.get(dayKey) ?? [];
    list.push(appt);
    dayMap.set(dayKey, list);
  }

  // Sort days descending
  const sortedDays = [...dayMap.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return sortedDays.map(([dayKey, dayAppts]) => {
    // Group by client within the day
    const clientMap = new Map<string, Appointment[]>();
    for (const appt of dayAppts) {
      const clientKey = appt.clientId || appt.id; // ungrouped if no client
      const list = clientMap.get(clientKey) ?? [];
      list.push(appt);
      clientMap.set(clientKey, list);
    }

    // Sort appointments within each client group by time
    const clientGroups = [...clientMap.values()].map(group => {
      group.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return group;
    });

    // Sort client groups by earliest appointment time
    clientGroups.sort((a, b) => new Date(a[0].date).getTime() - new Date(b[0].date).getTime());

    return { dayKey, dayAppts, clientGroups };
  });
}

const COL_COUNT = 10; // Date, Heure, Client, Service, Variante, Durée, Prix, Staff, Statut, Actions

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

export const AppointmentTable: React.FC<AppointmentTableProps> = ({ appointments, team, services, categories, onDetails, onEdit, onDelete }) => {
  const staffMap = useMemo(() => new Map(team.map(s => [s.id, s])), [team]);
  const serviceMap = useMemo(() => new Map(services.map(s => [s.id, s])), [services]);
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const grouped = useMemo(() => groupByDayAndClient(appointments), [appointments]);

  if (appointments.length === 0) {
    return <EmptyState title="Aucun rendez-vous" description="Aucun rendez-vous ne correspond aux filtres." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200 shadow-sm">
          <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Heure</th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Service</th>
            <th className="px-4 py-3 hidden lg:table-cell">Variante</th>
            <th className="px-4 py-3 hidden md:table-cell">Durée</th>
            <th className="px-4 py-3 hidden md:table-cell">Prix</th>
            <th className="px-4 py-3 hidden lg:table-cell">Staff</th>
            <th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3 text-right"></th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(({ dayKey, clientGroups }) => {
            const dayDate = new Date(dayKey + 'T00:00:00');
            const dayLabel = dayDate.toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });

            return (
              <React.Fragment key={dayKey}>
                {/* Day header */}
                <tr className="bg-slate-100 border-t-2 border-slate-200">
                  <td colSpan={COL_COUNT} className="px-4 py-2">
                    <span className="text-sm font-bold text-slate-700 capitalize">{dayLabel}</span>
                  </td>
                </tr>

                {clientGroups.map((clientAppts, groupIdx) => {
                  const clientName = clientAppts[0].clientName || 'Sans client';
                  const isMulti = clientAppts.length > 1;

                  return (
                    <React.Fragment key={clientAppts[0].clientId || groupIdx}>
                      {/* Client subgroup separator — only show when multiple appointments for this client */}
                      {isMulti && (
                        <tr className="bg-pink-50/50 border-t border-slate-100">
                          <td colSpan={COL_COUNT} className="px-4 py-1.5">
                            <span className="text-xs font-semibold text-pink-700">{clientName} — {clientAppts.length} services</span>
                          </td>
                        </tr>
                      )}

                      {clientAppts.map((appt) => {
                        const date = new Date(appt.date);
                        return (
                          <tr
                            key={appt.id}
                            className="hover:bg-slate-50 transition-colors group cursor-pointer border-t border-slate-50"
                            onClick={() => onDetails(appt.id)}
                          >
                            <td className="px-4 py-3 align-top">
                              <span className="text-sm text-slate-500 capitalize">
                                {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <span className="text-sm font-semibold text-slate-900">
                                {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <span className="text-sm font-medium text-slate-900">{appt.clientName || '—'}</span>
                            </td>
                            <td className="px-4 py-3 align-top">
                              {(() => {
                                const svc = serviceMap.get(appt.serviceId);
                                const cat = svc ? categoryMap.get(svc.categoryId) : undefined;
                                return (
                                  <span className="flex items-center gap-1.5 text-sm text-slate-800">
                                    {cat && <CategoryIcon categoryName={cat.name} size={14} className="text-slate-400 shrink-0" />}
                                    {appt.serviceName || '—'}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3 align-top hidden lg:table-cell">
                              <span className="text-sm text-slate-500">{appt.variantName || '—'}</span>
                            </td>
                            <td className="px-4 py-3 align-top hidden md:table-cell">
                              <span className="text-sm text-slate-500">{formatDuration(appt.durationMinutes)}</span>
                            </td>
                            <td className="px-4 py-3 align-top text-sm font-medium text-slate-900 hidden md:table-cell">
                              {formatPrice(appt.price)}
                            </td>
                            <td className="px-4 py-3 align-top hidden lg:table-cell">
                              {appt.staffId ? (() => {
                                const staff = staffMap.get(appt.staffId);
                                return (
                                  <span className="flex items-center gap-1.5">
                                    <StaffAvatar
                                      firstName={staff?.firstName ?? appt.staffName.split(' ')[0] ?? ''}
                                      lastName={staff?.lastName ?? appt.staffName.split(' ')[1] ?? ''}
                                      photoUrl={staff?.photoUrl}
                                      color={staff?.color}
                                      size={22}
                                    />
                                    <span className="text-sm text-slate-500">{appt.staffName}</span>
                                  </span>
                                );
                              })() : <span className="text-sm text-slate-500">—</span>}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <StatusBadge status={appt.status} />
                            </td>
                            <td className="px-4 py-3 align-top text-right">
                              <div className="flex items-center justify-end gap-1">
                                {onEdit && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onEdit(appt.id); }}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors rounded-md hover:bg-slate-100"
                                    title="Modifier"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                )}
                                {onDelete && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(appt.id); }}
                                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors rounded-md hover:bg-red-50"
                                    title="Supprimer"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
