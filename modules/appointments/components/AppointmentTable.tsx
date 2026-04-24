import { Pencil, Trash2, User } from 'lucide-react';
import React, { useMemo } from 'react';
import { EmptyState } from '../../../components/EmptyState';
import { StaffAvatar } from '../../../components/StaffAvatar';
import { CategoryIcon } from '../../../lib/categoryIcons';
import { formatDuration, formatName, formatPrice } from '../../../lib/format';
import {
  type Appointment,
  AppointmentStatus,
  type Service,
  type ServiceCategory,
  type StaffMember,
} from '../../../types';
import { groupByDayAndClient } from './groupAppointments';
import { StatusBadge } from './StatusBadge';

const ClientAvatar: React.FC<{ name: string }> = ({ name }) => {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
      : name.charAt(0).toUpperCase();

  return (
    <span
      className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-semibold"
      style={{ fontSize: 10 }}
      aria-label={name}
    >
      {initials || <User size={12} />}
    </span>
  );
};

interface AppointmentTableProps {
  appointments: Appointment[];
  team: StaffMember[];
  services: Service[];
  categories: ServiceCategory[];
  onDetails: (id: string) => void;
  onEdit?: (id: string) => void;
  onRequestCancel?: (appointmentIds: string[]) => void;
  onStatusChange?: (id: string, status: AppointmentStatus) => void;
}

const COL_COUNT = 10; // Date, Heure, Client, Service, Variante, Durée, Prix, Staff, Statut, Actions

export const AppointmentTable: React.FC<AppointmentTableProps> = ({
  appointments,
  team,
  services,
  categories,
  onDetails,
  onEdit,
  onRequestCancel,
  onStatusChange,
}) => {
  const staffMap = useMemo(() => new Map(team.map((s) => [s.id, s])), [team]);
  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const grouped = useMemo(() => groupByDayAndClient(appointments), [appointments]);

  if (appointments.length === 0) {
    return (
      <EmptyState
        title="Aucun rendez-vous"
        description="Aucun rendez-vous ne correspond aux filtres."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200 shadow-sm">
          <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold">
            <th className="px-4 py-3 border-r border-slate-200">Date</th>
            <th className="px-4 py-3 border-r border-slate-200">Heure</th>
            <th className="px-4 py-3 border-r border-slate-200">Client</th>
            <th className="px-4 py-3 border-r border-slate-200">Service</th>
            <th className="px-4 py-3 border-r border-slate-200 hidden lg:table-cell">Variante</th>
            <th className="px-4 py-3 border-r border-slate-200 hidden md:table-cell">Durée</th>
            <th className="px-4 py-3 border-r border-slate-200 hidden md:table-cell">Prix</th>
            <th className="px-4 py-3 border-r border-slate-200 hidden lg:table-cell">Staff</th>
            <th className="px-4 py-3 border-r border-slate-200">Statut</th>
            <th className="px-4 py-3 text-right"></th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(({ dayKey, clientGroups }) => {
            const dayDate = new Date(`${dayKey}T00:00:00`);
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
                  const isMulti = clientAppts.length > 1;

                  return (
                    <React.Fragment key={clientAppts[0].clientId || groupIdx}>
                      {clientAppts.map((appt, apptIdx) => {
                        const date = new Date(appt.date);
                        const blockFirst = isMulti && apptIdx === 0;
                        const blockLast = isMulti && apptIdx === clientAppts.length - 1;
                        const blockMiddle = isMulti && !blockFirst && !blockLast;

                        // Row background + top border for block cohesion
                        const rowBase = 'transition-colors group cursor-pointer';
                        const rowBg = isMulti
                          ? 'bg-blue-50/40 hover:bg-blue-100/60'
                          : 'hover:bg-slate-50';
                        const rowBorder =
                          blockMiddle || blockLast
                            ? 'border-t border-transparent'
                            : 'border-t border-slate-50';
                        // 3D edge: subtle inset highlight on the first row of a block
                        const rowEdge = blockFirst
                          ? 'shadow-[inset_0_1px_0_0_rgba(96,165,250,0.35)]'
                          : '';

                        // Left rail on the first cell via ::before pseudo-element
                        const railBase = isMulti
                          ? "relative before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-gradient-to-b before:from-blue-400 before:to-indigo-500 before:shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                          : '';
                        const railTop = blockFirst ? 'before:rounded-t-full' : '';
                        const railBottom = blockLast ? 'before:rounded-b-full' : '';
                        const firstCellRail = [railBase, railTop, railBottom]
                          .filter(Boolean)
                          .join(' ');

                        return (
                          <tr
                            key={appt.id}
                            className={`${rowBase} ${rowBg} ${rowBorder} ${rowEdge}`}
                            onClick={() => onDetails(appt.id)}
                          >
                            <td
                              className={`px-4 py-3 align-top border-r border-slate-100 ${firstCellRail}`}
                            >
                              <span className="text-sm text-slate-500 capitalize">
                                {date.toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top border-r border-slate-100">
                              <span className="text-sm font-semibold text-slate-900">
                                {date.toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top border-r border-slate-100">
                              <span
                                className={`flex items-center gap-2 text-sm font-medium ${blockMiddle || blockLast ? 'text-slate-500' : 'text-slate-900'}`}
                              >
                                <ClientAvatar name={appt.clientName || '?'} />
                                <span className="truncate">
                                  {formatName(appt.clientName) || '—'}
                                </span>
                                {blockFirst && (
                                  <span
                                    className="inline-flex items-center px-1.5 py-px rounded-md bg-gradient-to-br from-blue-500 to-indigo-500 text-white text-[9px] font-bold tracking-wide shadow-sm shadow-blue-500/30 ring-1 ring-white/20"
                                    title={`${clientAppts.length} services`}
                                  >
                                    ×{clientAppts.length}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top border-r border-slate-100">
                              {(() => {
                                const svc = serviceMap.get(appt.serviceId);
                                const cat = svc ? categoryMap.get(svc.categoryId) : undefined;
                                return (
                                  <span className="flex items-center gap-1.5 text-sm text-slate-800">
                                    {cat && (
                                      <CategoryIcon
                                        categoryName={cat.name}
                                        iconName={cat.icon}
                                        size={14}
                                        className="text-slate-400 shrink-0"
                                      />
                                    )}
                                    {appt.serviceName || '—'}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3 align-top border-r border-slate-100 hidden lg:table-cell">
                              <span className="text-sm text-slate-500">
                                {appt.variantName || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top border-r border-slate-100 hidden md:table-cell">
                              <span className="text-sm text-slate-500">
                                {formatDuration(appt.durationMinutes)}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top border-r border-slate-100 text-sm font-medium text-slate-900 hidden md:table-cell">
                              {formatPrice(appt.price)}
                            </td>
                            <td className="px-4 py-3 align-top border-r border-slate-100 hidden lg:table-cell">
                              {appt.staffId ? (
                                (() => {
                                  const staff = staffMap.get(appt.staffId);
                                  return (
                                    <span className="flex items-center gap-1.5">
                                      <StaffAvatar
                                        firstName={
                                          staff?.firstName ?? appt.staffName.split(' ')[0] ?? ''
                                        }
                                        lastName={
                                          staff?.lastName ?? appt.staffName.split(' ')[1] ?? ''
                                        }
                                        photoUrl={staff?.photoUrl}
                                        color={staff?.color}
                                        size={22}
                                      />
                                      <span className="text-sm text-slate-500">
                                        {appt.staffName}
                                      </span>
                                    </span>
                                  );
                                })()
                              ) : (
                                <span className="text-sm text-slate-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top border-r border-slate-100">
                              <StatusBadge
                                status={appt.status}
                                deletionReason={appt.deletionReason ?? null}
                                onStatusChange={
                                  onStatusChange ? (s) => onStatusChange(appt.id, s) : undefined
                                }
                              />
                              {appt.deletionNote && (
                                <div className="text-[10px] text-slate-500 italic mt-1 max-w-[180px] truncate" title={appt.deletionNote}>
                                  « {appt.deletionNote} »
                                </div>
                              )}
                              {appt.deletedAt && (
                                <div className="text-[10px] text-red-500 mt-0.5">
                                  Supprimé le {new Date(appt.deletedAt).toLocaleDateString('fr-FR')}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top text-right">
                              <div className="flex items-center justify-end gap-1">
                                {onEdit && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEdit(appt.id);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors rounded-md hover:bg-slate-100"
                                    title="Modifier"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                )}
                                {onRequestCancel &&
                                  appt.status !== AppointmentStatus.COMPLETED &&
                                  appt.status !== AppointmentStatus.CANCELLED && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onRequestCancel([appt.id]);
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors rounded-md hover:bg-red-50"
                                      title="Annuler"
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
