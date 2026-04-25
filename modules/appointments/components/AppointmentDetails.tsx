import { ArrowLeft, ArrowRight, Calendar, Receipt, Scissors, Trash2, User } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useLinkedTransaction } from '../../../hooks/useLinkedTransaction';
import { formatName, formatPrice } from '../../../lib/format';
import { type Appointment, AppointmentStatus } from '../../../types';
import { LinkedReceiptModal } from '../../pos/components/LinkedReceiptModal';
import { useTeam } from '../../team/hooks/useTeam';
import { StatusBadge } from './StatusBadge';

interface AppointmentDetailsProps {
  appointment: Appointment;
  allAppointments?: Appointment[];
  onBack: () => void;
  onEdit: () => void;
  /** Opens a confirm-with-reason modal. Callers handle the modal state themselves. */
  onRequestCancel?: (appointmentIds: string[]) => void;
}

/**
 * Renders a price as either a single number (when nothing changed) or a
 * "was → became" diff with a Modifié badge. Used in both the header card and
 * inside the grouped services list.
 */
const PriceDisplay: React.FC<{
  price: number;
  originalPrice?: number | null;
  cancelled?: boolean;
  large?: boolean;
}> = ({ price, originalPrice, cancelled, large }) => {
  const changed = originalPrice != null && originalPrice !== price;
  if (cancelled) {
    return (
      <span
        className={`${large ? 'text-2xl font-bold' : 'text-sm font-semibold'} text-slate-400 line-through`}
      >
        {formatPrice(price)}
      </span>
    );
  }
  if (!changed) {
    return (
      <span className={large ? 'text-2xl font-bold text-slate-900' : 'text-sm font-semibold text-blue-600'}>
        {formatPrice(price)}
      </span>
    );
  }
  return (
    <span className="flex items-baseline gap-2 justify-end flex-wrap">
      <span className={`${large ? 'text-base' : 'text-xs'} text-slate-400 line-through`}>
        {formatPrice(originalPrice)}
      </span>
      <span className={large ? 'text-2xl font-bold text-slate-900' : 'text-sm font-semibold text-blue-600'}>
        {formatPrice(price)}
      </span>
      <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">
        Modifié
      </span>
    </span>
  );
};

export const AppointmentDetails: React.FC<AppointmentDetailsProps> = ({
  appointment,
  allAppointments = [],
  onBack,
  onEdit,
  onRequestCancel,
}) => {
  const { allStaff } = useTeam(true); // include archived so renamed/deleted staff still resolve
  const { data: linkedTransaction } = useLinkedTransaction(appointment, allAppointments);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const date = new Date(appointment.date);

  const groupedAppointments = appointment.groupId
    ? allAppointments.filter((a) => a.groupId === appointment.groupId)
    : [appointment];

  const cancellableIds = groupedAppointments
    .filter(
      (a) => a.status !== AppointmentStatus.COMPLETED && a.status !== AppointmentStatus.CANCELLED,
    )
    .map((a) => a.id);
  const canCancel = onRequestCancel && cancellableIds.length > 0;

  const resolveStaffName = (id: string | null | undefined): string | null => {
    if (!id) return null;
    const s = allStaff.find((t) => t.id === id);
    return s ? `${s.firstName} ${s.lastName}`.trim() : null;
  };

  const originalStaffName = resolveStaffName(appointment.originalStaffId);
  const staffChanged =
    appointment.originalStaffId &&
    appointment.staffId &&
    appointment.originalStaffId !== appointment.staffId;

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Détails du Rendez-vous</h1>
        <div className="ml-auto flex gap-3">
          {linkedTransaction && (
            <button
              type="button"
              onClick={() => setIsReceiptOpen(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 shadow-sm transition-all flex items-center gap-2"
            >
              <Receipt size={16} />
              Voir le reçu · Ticket #{linkedTransaction.ticketNumber}
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => onRequestCancel?.(cancellableIds)}
              className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded-lg font-medium text-sm hover:bg-red-50 shadow-sm transition-all flex items-center gap-2"
            >
              <Trash2 size={16} />
              {cancellableIds.length > 1 ? 'Annuler la visite' : 'Annuler'}
            </button>
          )}
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 shadow-sm transition-all"
          >
            Modifier
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex justify-between items-start gap-4">
          <div className="min-w-0">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">
              Référence # {appointment.id.toUpperCase()}
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{appointment.serviceName}</h2>
            <StatusBadge
              status={appointment.status}
              deletionReason={appointment.deletionReason ?? null}
            />
            {appointment.status === AppointmentStatus.CANCELLED && appointment.deletionNote && (
              <p className="mt-2 text-xs text-slate-500 italic max-w-md">
                {appointment.deletionNote}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <PriceDisplay
              price={appointment.price}
              originalPrice={appointment.originalPrice}
              large
            />
            <div className="text-sm text-slate-500 mt-1">{appointment.durationMinutes} min</div>
          </div>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
                <Calendar size={20} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Date & Heure</div>
                <div className="font-semibold text-slate-900">
                  {date.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
                <div className="text-slate-600">
                  {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
                <User size={20} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Client</div>
                <div className="font-semibold text-slate-900">
                  {formatName(appointment.clientName)}
                </div>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
                <Scissors size={20} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-500">Réalisé par</div>
                {staffChanged && originalStaffName ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-400 line-through">{originalStaffName}</span>
                    <ArrowRight size={14} className="text-slate-400" />
                    <span className="font-semibold text-slate-900">{appointment.staffName}</span>
                    <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">
                      Modifié
                    </span>
                  </div>
                ) : (
                  <div className="font-semibold text-slate-900">{appointment.staffName}</div>
                )}
              </div>
            </div>

            {appointment.changeNote && (
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 shrink-0" />
                <div className="text-xs text-slate-500 italic">
                  Motif : {appointment.changeNote}
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-50 rounded-xl p-6 border border-slate-200/60">
            <h3 className="font-bold text-slate-900 text-sm mb-3 uppercase tracking-wide">
              Notes internes
            </h3>
            <p className="text-sm text-slate-600 italic leading-relaxed">
              {appointment.notes || 'Aucune note pour ce rendez-vous.'}
            </p>
          </div>
        </div>

        {/* Grouped services (if multi-service booking) */}
        {groupedAppointments.length > 1 && (
          <div className="px-8 pb-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">
              Services dans ce rendez-vous ({groupedAppointments.length})
            </h4>
            <div className="space-y-2">
              {groupedAppointments.map((appt, i) => {
                const isCancelled = appt.status === AppointmentStatus.CANCELLED;
                const apptOriginalStaffName = resolveStaffName(appt.originalStaffId);
                const apptStaffChanged =
                  appt.originalStaffId &&
                  appt.staffId &&
                  appt.originalStaffId !== appt.staffId;
                return (
                  <div
                    key={appt.id}
                    className={`border rounded-lg px-4 py-3 flex items-center gap-3 ${
                      isCancelled
                        ? 'bg-slate-100 border-slate-200 opacity-75'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <span
                      aria-label={`Prestation ${i + 1}`}
                      className="w-5 h-5 shrink-0 rounded-full bg-slate-200 text-slate-600 inline-flex items-center justify-center text-[10px] font-bold tabular-nums"
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-medium ${
                            isCancelled ? 'text-slate-500 line-through' : 'text-slate-800'
                          }`}
                        >
                          {appt.serviceName}
                        </span>
                        {isCancelled && (
                          <StatusBadge
                            status={appt.status}
                            deletionReason={appt.deletionReason ?? null}
                          />
                        )}
                      </div>
                      <div className="text-slate-500 text-xs mt-0.5 flex flex-wrap items-center gap-x-2">
                        {apptStaffChanged && apptOriginalStaffName ? (
                          <span className="flex items-center gap-1">
                            <span className="line-through">{apptOriginalStaffName}</span>
                            <ArrowRight size={10} />
                            <span className="font-medium text-slate-700">{appt.staffName}</span>
                          </span>
                        ) : (
                          <span>{appt.staffName}</span>
                        )}
                        <span>·</span>
                        <span>{appt.durationMinutes} min</span>
                        {appt.deletionNote && (
                          <span className="italic">« {appt.deletionNote} »</span>
                        )}
                        {appt.changeNote && !isCancelled && (
                          <span className="italic text-amber-700">
                            Motif : {appt.changeNote}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <PriceDisplay
                        price={appt.price}
                        originalPrice={appt.originalPrice}
                        cancelled={isCancelled}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {isReceiptOpen && linkedTransaction && (
        <LinkedReceiptModal
          transactionId={linkedTransaction.id}
          onClose={() => setIsReceiptOpen(false)}
        />
      )}
    </div>
  );
};
