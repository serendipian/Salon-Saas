import React from 'react';
import {
  Mail,
  Phone,
  Clock,
  UserCheck,
  Send,
  RotateCcw,
  XCircle,
  CalendarDays,
  TrendingUp,
  Percent,
  Award,
} from 'lucide-react';
import { StaffMember } from '../../../types';
import { formatPrice } from '../../../lib/format';
import { StaffAvatar } from '../../../components/StaffAvatar';

interface StaffHeaderProps {
  staff: StaffMember;
  isArchived: boolean;
  monthlyRevenue: number;
  monthlyAppointments: number;
  hasPendingInvitation: boolean;
  invitationExpiresAt?: string;
  onInvite: () => void;
  onCancelInvitation: () => void;
  isCancellingInvitation?: boolean;
  onArchive: () => void;
  onRestore: () => void;
}

const roleColors: Record<string, string> = {
  Manager: 'bg-purple-100 text-purple-700 border-purple-200',
  Stylist: 'bg-violet-100 text-violet-700 border-violet-200',
  Assistant: 'bg-blue-100 text-blue-700 border-blue-200',
  Receptionist: 'bg-amber-100 text-amber-700 border-amber-200',
};

export const StaffHeader: React.FC<StaffHeaderProps> = ({
  staff,
  isArchived,
  monthlyRevenue,
  monthlyAppointments,
  hasPendingInvitation,
  invitationExpiresAt,
  onInvite,
  onCancelInvitation,
  isCancellingInvitation,
  onArchive,
  onRestore,
}) => {
  const seniorityMonths = staff.startDate
    ? Math.floor((Date.now() - new Date(staff.startDate).getTime()) / (30.44 * 24 * 60 * 60 * 1000))
    : null;
  const seniorityLabel =
    seniorityMonths !== null
      ? seniorityMonths >= 12
        ? `${Math.floor(seniorityMonths / 12)} an${Math.floor(seniorityMonths / 12) !== 1 ? 's' : ''}`
        : `${seniorityMonths} mois`
      : '—';

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-sm ${isArchived ? 'opacity-60' : ''}`}
    >
      {isArchived && (
        <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200 rounded-t-xl p-3">
          <span className="text-sm text-amber-800">
            Ce membre a été archivé le {new Date(staff.deletedAt!).toLocaleDateString('fr-FR')}
          </span>
          <button
            onClick={onRestore}
            className="flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-900"
          >
            <RotateCcw className="w-4 h-4" /> Restaurer
          </button>
        </div>
      )}

      <div className="p-6">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Left: Avatar + Info */}
          <div className="flex items-start gap-4 flex-1">
            <div className="shrink-0">
              <StaffAvatar
                firstName={staff.firstName}
                lastName={staff.lastName}
                photoUrl={staff.photoUrl}
                size={72}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">
                  {staff.firstName} {staff.lastName}
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${roleColors[staff.role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}
                >
                  {staff.role}
                </span>
                {isArchived ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                    Archivé
                  </span>
                ) : staff.active ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                    Actif
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                    Inactif
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                {staff.email && (
                  <span className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                    </span>
                    {staff.email}
                  </span>
                )}
                {staff.phone && (
                  <span className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                    </span>
                    {staff.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Invitation / Account Status */}
          {!isArchived && (
            <div className="flex flex-col items-end gap-2 shrink-0">
              {staff.membershipId ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
                  <UserCheck className="w-3.5 h-3.5" /> Compte lié
                </span>
              ) : hasPendingInvitation ? (
                <>
                  <span className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
                    <Clock className="w-3.5 h-3.5" /> Invitation en attente
                    {invitationExpiresAt && (
                      <span className="text-amber-500 ml-1">
                        (expire le {new Date(invitationExpiresAt).toLocaleDateString('fr-FR')})
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onCancelInvitation}
                      disabled={isCancellingInvitation}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Annuler
                    </button>
                    <button
                      onClick={onInvite}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" /> Réinviter
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={onInvite}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <Send className="w-4 h-4" /> Inviter par lien
                </button>
              )}
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">RDV ce mois</p>
              <p className="text-lg font-bold text-slate-900">{monthlyAppointments}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">CA ce mois</p>
              <p className="text-lg font-bold text-slate-900">{formatPrice(monthlyRevenue)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
              <Percent className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Commission</p>
              <p className="text-lg font-bold text-slate-900">{staff.commissionRate}%</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Ancienneté</p>
              <p className="text-lg font-bold text-slate-900">{seniorityLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
