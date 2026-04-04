import React from 'react';
import { Mail, Phone, Clock, UserCheck, Send, RotateCcw } from 'lucide-react';
import { StaffMember } from '../../../types';
import { formatPrice } from '../../../lib/format';

interface StaffHeaderProps {
  staff: StaffMember;
  isArchived: boolean;
  monthlyRevenue: number;
  monthlyAppointments: number;
  currencySymbol: string;
  hasPendingInvitation: boolean;
  invitationExpiresAt?: string;
  onInvite: () => void;
  onArchive: () => void;
  onRestore: () => void;
}

export const StaffHeader: React.FC<StaffHeaderProps> = ({
  staff, isArchived, monthlyRevenue, monthlyAppointments,
  currencySymbol, hasPendingInvitation, invitationExpiresAt,
  onInvite, onArchive, onRestore,
}) => {
  const seniority = staff.startDate
    ? Math.floor((Date.now() - new Date(staff.startDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const roleColors: Record<string, string> = {
    Manager: 'bg-purple-100 text-purple-700',
    Stylist: 'bg-pink-100 text-pink-700',
    Assistant: 'bg-blue-100 text-blue-700',
    Receptionist: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-6 ${isArchived ? 'opacity-60' : ''}`}>
      {isArchived && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <span className="text-sm text-amber-800">
            Ce membre a été archivé le {new Date(staff.deletedAt!).toLocaleDateString('fr-FR')}
          </span>
          <button onClick={onRestore} className="flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-900">
            <RotateCcw className="w-4 h-4" /> Restaurer
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-6">
        <div className="flex items-start gap-4 flex-1">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
            style={{ backgroundColor: staff.color || '#64748b' }}>
            {staff.firstName[0]}{staff.lastName?.[0] || ''}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{staff.firstName} {staff.lastName}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[staff.role] || 'bg-slate-100 text-slate-700'}`}>
                {staff.role}
              </span>
              {isArchived ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Archivé</span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Actif</span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 flex-wrap">
              {staff.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{staff.email}</span>}
              {staff.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{staff.phone}</span>}
            </div>
          </div>
        </div>

        {!isArchived && (
          <div className="flex items-start gap-2 shrink-0">
            {staff.membershipId ? (
              <span className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg">
                <UserCheck className="w-3.5 h-3.5" /> Compte lié
              </span>
            ) : hasPendingInvitation ? (
              <span className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg">
                <Clock className="w-3.5 h-3.5" /> Invitation en attente
                {invitationExpiresAt && (
                  <span className="text-amber-500 ml-1">(expire le {new Date(invitationExpiresAt).toLocaleDateString('fr-FR')})</span>
                )}
              </span>
            ) : (
              <button onClick={onInvite} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-pink-600 bg-pink-50 hover:bg-pink-100 rounded-lg transition-colors">
                <Send className="w-4 h-4" /> Inviter par lien
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">RDV ce mois</p>
          <p className="text-lg font-semibold text-slate-900 mt-0.5">{monthlyAppointments}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">CA ce mois</p>
          <p className="text-lg font-semibold text-slate-900 mt-0.5">{formatPrice(monthlyRevenue)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Commission</p>
          <p className="text-lg font-semibold text-slate-900 mt-0.5">{staff.commissionRate}%</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Ancienneté</p>
          <p className="text-lg font-semibold text-slate-900 mt-0.5">
            {seniority !== null ? `${seniority} an${seniority !== 1 ? 's' : ''}` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
};
