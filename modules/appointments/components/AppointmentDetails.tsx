
import React, { useState } from 'react';
import { ArrowLeft, Calendar, User, Scissors, Trash2 } from 'lucide-react';
import { Appointment, AppointmentStatus } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { StatusBadge } from './StatusBadge';

interface AppointmentDetailsProps {
  appointment: Appointment;
  allAppointments?: Appointment[];
  onBack: () => void;
  onEdit: () => void;
  onDelete?: (id: string) => void;
}

export const AppointmentDetails: React.FC<AppointmentDetailsProps> = ({ appointment, allAppointments = [], onBack, onEdit, onDelete }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const date = new Date(appointment.date);

  const groupedAppointments = appointment.groupId
    ? allAppointments.filter((a) => a.groupId === appointment.groupId)
    : [appointment];

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Détails du Rendez-vous</h1>
        <div className="ml-auto flex gap-3">
           {onDelete && (
             <button
               onClick={() => setShowConfirm(true)}
               className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded-lg font-medium text-sm hover:bg-red-50 shadow-sm transition-all flex items-center gap-2"
             >
               <Trash2 size={16} />
               Supprimer
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
        <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex justify-between items-start">
           <div>
             <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Référence # {appointment.id.toUpperCase()}</div>
             <h2 className="text-xl font-bold text-slate-900 mb-2">{appointment.serviceName}</h2>
             <StatusBadge status={appointment.status} />
           </div>
           <div className="text-right">
             <div className="text-2xl font-bold text-slate-900">{formatPrice(appointment.price)}</div>
             <div className="text-sm text-slate-500">{appointment.durationMinutes} min</div>
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
                    {date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
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
                 <div className="font-semibold text-slate-900">{appointment.clientName}</div>
               </div>
             </div>

             <div className="flex gap-4 items-start">
               <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
                 <Scissors size={20} />
               </div>
               <div>
                 <div className="text-sm font-medium text-slate-500">Réalisé par</div>
                 <div className="font-semibold text-slate-900">{appointment.staffName}</div>
               </div>
             </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-6 border border-slate-200/60">
             <h3 className="font-bold text-slate-900 text-sm mb-3 uppercase tracking-wide">Notes internes</h3>
             <p className="text-sm text-slate-600 italic leading-relaxed">
               {appointment.notes || "Aucune note pour ce rendez-vous."}
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
              {groupedAppointments.map((appt, i) => (
                <div
                  key={appt.id}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex items-center gap-3"
                >
                  {/* L-15: Numbered badge instead of hardcoded 5-digit unicode
                      string. Previously rendered nothing for the 6th+ row. */}
                  <span
                    aria-label={`Prestation ${i + 1}`}
                    className="w-5 h-5 shrink-0 rounded-full bg-slate-200 text-slate-600 inline-flex items-center justify-center text-[10px] font-bold tabular-nums"
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-slate-800 text-sm font-medium">{appt.serviceName}</span>
                    <span className="text-slate-500 text-xs ml-2">
                      {appt.staffName} · {appt.durationMinutes} min
                    </span>
                  </div>
                  <span className="text-blue-600 text-sm font-semibold shrink-0">
                    {formatPrice(appt.price)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {showConfirm && onDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Supprimer ce rendez-vous ?</h3>
            <p className="text-sm text-slate-600 mb-5">
              {groupedAppointments.length > 1
                ? `Ce rendez-vous contient ${groupedAppointments.length} services. Tous seront supprimés.`
                : 'Cette action est irréversible.'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={() => { onDelete(appointment.id); setShowConfirm(false); }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
