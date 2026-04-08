
import React from 'react';
import {
  MapPin,
  ArrowLeft,
  Phone,
  Mail,
  AlertCircle,
  MessageCircle,
  Instagram,
  Globe,
  Star,
  Shield,
  Check,
  X as XIcon,
  Briefcase,
  Building2,
  UserPlus,
  Calendar,
  CalendarDays,
  Edit,
  Trash2,
  Clock,
  ShoppingBag,
  User
} from 'lucide-react';
import { Client, AppointmentStatus } from '../../../types';
import { useClientAppointments } from '../hooks/useClientAppointments';
import { useTeam } from '../../team/hooks/useTeam';
import { formatPrice } from '../../../lib/format';

interface ClientDetailsProps {
  client: Client;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const ClientDetails: React.FC<ClientDetailsProps> = ({ client, onBack, onEdit, onDelete }) => {
  const { appointments: clientAppointments } = useClientAppointments(client.id);
  const { allStaff: team } = useTeam();
  const initials = `${client.firstName?.[0] ?? ''}${client.lastName?.[0] ?? ''}`.toUpperCase();

  const preferredStaff = team.find(t => t.id === client.preferredStaffId);

  const PermissionItem = ({ label, value, detail }: { label: string, value?: boolean, detail?: string }) => (
    <div className="flex items-start justify-between text-sm py-2 border-b border-slate-50 last:border-0">
      <span className="text-slate-600">{label}</span>
      <div className="flex flex-col items-end">
        {value ? (
          <span className="flex items-center gap-1 text-emerald-700 font-medium">
            <Check size={14} /> Oui
          </span>
        ) : (
          <span className="flex items-center gap-1 text-slate-400">
            <XIcon size={14} /> Non
          </span>
        )}
        {value && detail && <span className="text-xs text-slate-500 mt-0.5">{detail}</span>}
      </div>
    </div>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 pb-10">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Profil Client</h1>
        <div className="ml-auto flex items-center gap-2">
           <button
              onClick={onDelete}
              className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg font-medium text-sm hover:bg-red-50 transition-all flex items-center gap-2"
            >
              <Trash2 size={16} />
              Supprimer
            </button>
           <button
              onClick={onEdit}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 shadow-sm transition-all flex items-center gap-2"
            >
              <Edit size={16} />
              Modifier
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* --- LEFT SIDEBAR --- */}
        <div className="space-y-6">

          {/* Profile Card */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-600 border border-slate-200 shrink-0 overflow-hidden">
                  {client.photoUrl ? (
                    <img src={client.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-slate-900 truncate">{[client.firstName, client.lastName].filter(Boolean).join(' ')}</h2>
                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                       <MapPin size={12} />
                       {client.city || '-'}
                    </p>
                  </div>
                  <div className="shrink-0">
                     {client.status === 'VIP' && <span className="px-3 py-1 bg-purple-100 text-purple-700 border border-purple-200 rounded-md text-xs font-bold">VIP</span>}
                     {(!client.status || client.status === 'ACTIF') && <span className="px-3 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md text-xs font-medium">Actif</span>}
                     {client.status === 'INACTIF' && <span className="px-3 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-md text-xs font-medium">Inactif</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2x2 grid: Coordonnées, Identité, Professionnel, Préférences */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Coordonnées */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Coordonnées</h3>
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
                     <Phone size={14} />
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-sm font-medium text-slate-900">{client.phone || '-'}</div>
                    <div className="text-xs text-slate-500">Mobile</div>
                  </div>
                </li>
                <li className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
                     <Mail size={14} />
                  </div>
                  <div className="overflow-hidden">
                     <div className="text-sm font-medium text-slate-900 truncate">{client.email || '-'}</div>
                     <div className="text-xs text-slate-500">Email</div>
                  </div>
                </li>
                {client.whatsapp && (
                  <li className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                       <MessageCircle size={14} />
                    </div>
                    <div className="overflow-hidden">
                       <div className="text-sm font-medium text-slate-900">{client.whatsapp}</div>
                       <div className="text-xs text-slate-500">WhatsApp</div>
                    </div>
                  </li>
                )}
                {client.instagram && (
                  <li className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                       <Instagram size={14} />
                    </div>
                    <div className="overflow-hidden">
                       <div className="text-sm font-medium text-slate-900">{client.instagram}</div>
                       <div className="text-xs text-slate-500">Instagram</div>
                    </div>
                  </li>
                )}
              </ul>
              </div>
            </div>

            {/* Identité */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Identité</h3>
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
                     <User size={14} />
                  </div>
                  <div className="overflow-hidden">
                     <div className="text-sm font-medium text-slate-900">{client.gender || '-'}</div>
                     <div className="text-xs text-slate-500">Genre</div>
                  </div>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
                     <CalendarDays size={14} />
                  </div>
                  <div className="overflow-hidden">
                     <div className="text-sm font-medium text-slate-900">{client.ageGroup || '-'}</div>
                     <div className="text-xs text-slate-500">Tranche d'âge</div>
                  </div>
                </li>
              </ul>
              </div>
            </div>

            {/* Professionnel */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Professionnel</h3>
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
                     <Briefcase size={14} />
                  </div>
                  <div className="overflow-hidden">
                     <div className="text-sm font-medium text-slate-900">{client.profession || '-'}</div>
                     <div className="text-xs text-slate-500">Métier</div>
                  </div>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
                     <Building2 size={14} />
                  </div>
                  <div className="overflow-hidden">
                     <div className="text-sm font-medium text-slate-900">{client.company || '-'}</div>
                     <div className="text-xs text-slate-500">Société</div>
                  </div>
                </li>
              </ul>
              </div>
            </div>

            {/* Préférences */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Préférences</h3>
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
                     <Globe size={14} />
                  </div>
                  <div className="overflow-hidden">
                     <div className="text-sm font-medium text-slate-900">{client.preferredLanguage || '-'}</div>
                     <div className="text-xs text-slate-500">Langue</div>
                  </div>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
                     <MessageCircle size={14} />
                  </div>
                  <div className="overflow-hidden">
                     <div className="text-sm font-medium text-slate-900">
                       {client.preferredChannel || '-'}
                       {client.preferredChannel === 'Autre' && client.otherChannelDetail && ` (${client.otherChannelDetail})`}
                     </div>
                     <div className="text-xs text-slate-500">Canal favori</div>
                  </div>
                </li>
              </ul>
              </div>
            </div>

          </div>

          {/* Praticien Favori */}
          {preferredStaff && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Praticien Favori</h3>
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
                 {preferredStaff.photoUrl ? (
                   <img src={preferredStaff.photoUrl} className="w-8 h-8 rounded-full object-cover" alt="" />
                 ) : (
                   <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                     {preferredStaff.firstName[0]}{preferredStaff.lastName[0]}
                   </div>
                 )}
                 <div>
                    <div className="text-sm font-bold text-slate-900">{preferredStaff.firstName} {preferredStaff.lastName}</div>
                    <div className="text-xs text-slate-500">{preferredStaff.role}</div>
                 </div>
                 <div className="ml-auto text-amber-400">
                    <Star size={16} fill="currentColor" />
                 </div>
              </div>
              </div>
            </div>
          )}

          {/* Acquisition & Autorisations side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Acquisition & Origine */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Acquisition & Origine</h3>
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
                      <Calendar size={14} />
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-sm font-medium text-slate-900">
                        {client.contactDate ? new Date(client.contactDate).toLocaleDateString('fr-FR') : '-'}
                      </div>
                      <div className="text-xs text-slate-500">Premier Contact</div>
                    </div>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
                      <Phone size={14} />
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-sm font-medium text-slate-900">
                        {client.contactMethod || '-'}
                        {client.contactMethod === 'Message' && client.messageChannel && ` (${client.messageChannel})`}
                      </div>
                      <div className="text-xs text-slate-500">Méthode</div>
                    </div>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
                      <UserPlus size={14} />
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-sm font-medium text-slate-900">
                        {client.acquisitionSource || '-'}
                        {(client.acquisitionSource === 'Influenceur' || client.acquisitionSource === 'Autre') && client.acquisitionDetail && (
                          <span className="text-slate-500 text-xs block">{client.acquisitionDetail}</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">Source</div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            {/* Autorisations */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Autorisations</h3>
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <div className="space-y-1">
                  <PermissionItem label="Réseaux Sociaux" value={client.permissions?.socialMedia} />
                  <PermissionItem label="Marketing" value={client.permissions?.marketing} />
                  <PermissionItem label="Autres" value={client.permissions?.other} detail={client.permissions?.otherDetail} />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* --- MAIN CONTENT --- */}
        <div className="lg:col-span-2 space-y-6">

          {/* Medical / Allergies Alert */}
          {client.allergies && (
             <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex gap-3 items-start">
                <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <h3 className="text-sm font-bold text-red-800">Allergies & Contre-indications</h3>
                  <p className="text-sm text-red-700 mt-1">{client.allergies}</p>
                </div>
             </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm text-center">
              <div className="text-2xl font-bold text-slate-900">{client.totalVisits}</div>
              <div className="text-xs text-slate-500 mt-1">Visites</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm text-center">
              <div className="text-2xl font-bold text-slate-900">{client.totalVisits > 0 ? formatPrice(client.totalSpent / client.totalVisits) : formatPrice(0)}</div>
              <div className="text-xs text-slate-500 mt-1">Panier Moyen</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm text-center">
              <div className="text-2xl font-bold text-slate-900">{formatPrice(client.totalSpent)}</div>
              <div className="text-xs text-slate-500 mt-1">Total Dépensé</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm text-center">
              <div className="text-2xl font-bold text-slate-900">0</div>
              <div className="text-xs text-slate-500 mt-1">Points Fidélité</div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
             <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3">Notes Internes</h3>
             <div className="text-sm text-slate-600 leading-relaxed bg-amber-50 p-4 rounded-lg border border-amber-100 italic whitespace-pre-wrap">
               {client.notes || "Aucune note enregistrée pour ce client."}
             </div>
          </div>

          {/* Timeline / History */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Historique & Activité</h3>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <CalendarDays size={12} />
                  <span>Première visite:</span>
                  <span className="font-medium text-slate-900">{client.firstVisitDate ? new Date(client.firstVisitDate).toLocaleDateString('fr-FR') : '-'}</span>
                </div>
                <div className="h-3 w-px bg-slate-200"></div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Calendar size={12} />
                  <span>Dernière visite:</span>
                  <span className="font-medium text-slate-900">{client.lastVisitDate ? new Date(client.lastVisitDate).toLocaleDateString('fr-FR') : '-'}</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50/30 max-h-[500px] overflow-y-auto custom-scrollbar">
              {clientAppointments.length > 0 ? (
                  <div className="relative border-l-2 border-slate-200 ml-3 space-y-8 py-2">
                    {clientAppointments.map((appt) => {
                      const isCompleted = appt.status === AppointmentStatus.COMPLETED;
                      const date = new Date(appt.date);
                      return (
                        <div key={appt.id} className="relative pl-8 group">
                           {/* Timeline Dot */}
                           <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${isCompleted ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>

                           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group-hover:border-slate-300">
                              <div className="flex justify-between items-start mb-2">
                                 <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-0.5">
                                      {date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-900">{appt.serviceName}</h4>
                                 </div>
                                 <span className="text-sm font-bold text-slate-900">{formatPrice(appt.price)}</span>
                              </div>

                              <div className="flex items-center justify-between pt-3 border-t border-slate-50 mt-3">
                                 <div className="flex items-center gap-3 text-xs text-slate-500">
                                    <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                      <Clock size={12} /> {date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                    <span>•</span>
                                    <span>{appt.staffName}</span>
                                 </div>
                                 <div className="flex items-center gap-1 text-xs font-medium">
                                    {isCompleted ? (
                                      <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Terminé</span>
                                    ) : (
                                      <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Planifié</span>
                                    )}
                                 </div>
                              </div>
                           </div>
                        </div>
                      );
                    })}
                  </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                     <ShoppingBag size={24} />
                  </div>
                  <p className="text-slate-500 text-sm font-medium">Aucune activité récente.</p>
                  <p className="text-slate-400 text-xs mt-1">L'historique des rendez-vous et achats apparaîtra ici.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
