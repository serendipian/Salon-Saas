
import React from 'react';
import { ArrowLeft, Calendar, User, Scissors, Printer } from 'lucide-react';
import { Appointment, AppointmentStatus } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { StatusBadge } from './StatusBadge';

interface AppointmentDetailsProps {
  appointment: Appointment;
  allAppointments?: Appointment[];
  onBack: () => void;
  onEdit: () => void;
}

export const AppointmentDetails: React.FC<AppointmentDetailsProps> = ({ appointment, allAppointments = [], onBack, onEdit }) => {
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
           <button className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-50 shadow-sm transition-all flex items-center gap-2">
             <Printer size={16} />
             Imprimer Ticket
           </button>
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
                 <button className="text-sm text-slate-900 underline hover:text-slate-600 font-medium cursor-pointer">Voir le profil</button>
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
                  className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex justify-between items-center"
                >
                  <div>
                    <span className="text-slate-800 text-sm font-medium">
                      {'\u2460\u2461\u2462\u2463\u2464'[i]} {appt.serviceName}
                    </span>
                    <span className="text-slate-500 text-xs ml-2">
                      {appt.staffName} · {appt.durationMinutes} min
                    </span>
                  </div>
                  <span className="text-pink-600 text-sm font-semibold">
                    {formatPrice(appt.price)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
