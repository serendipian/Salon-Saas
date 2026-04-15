// modules/admin/components/AdminAccountDetail.tsx
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronRight, ExternalLink } from 'lucide-react';
import {
  useAdminAccount,
  useAdminExtendTrial,
  useAdminSetPlan,
  useAdminSuspend,
  useAdminReactivate,
  useAdminCancelSubscription,
} from '../hooks/useAdmin';
import { TIER_BADGE, ADMIN_FONT } from '../constants';
import { AdminErrorState, ConfirmModal } from './AdminShared';

const INVOICE_STATUS_BADGE: Record<string, { color: string; bg: string }> = {
  paid: { color: '#0d7c3d', bg: '#d3f4e3' },
  open: { color: '#b45309', bg: '#fef3c7' },
  draft: { color: '#697386', bg: '#f0f0f0' },
  void: { color: '#697386', bg: '#f0f0f0' },
  uncollectible: { color: '#df1b41', bg: '#fff0f0' },
};

export const AdminAccountDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: account, isLoading, isError } = useAdminAccount(id!);

  const extendTrial = useAdminExtendTrial(id!);
  const setPlan = useAdminSetPlan(id!);
  const suspend = useAdminSuspend(id!);
  const reactivate = useAdminReactivate(id!);
  const cancelSub = useAdminCancelSubscription(id!);

  const [planInput, setPlanInput] = useState('');
  const [showSetPlan, setShowSetPlan] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    label: string;
    danger?: boolean;
    action: () => void;
  } | null>(null);

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center gap-2 p-12 text-[14px]"
        style={{ ...ADMIN_FONT, color: '#697386' }}
      >
        <div className="w-4 h-4 border-2 border-[#e3e8ef] border-t-[#635bff] rounded-full animate-spin" />
        Chargement...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8">
        <AdminErrorState />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-8 text-[14px]" style={{ ...ADMIN_FONT, color: '#697386' }}>
        Compte introuvable.
      </div>
    );
  }

  const badge = TIER_BADGE[account.subscription_tier] ?? TIER_BADGE.free;

  return (
    <div className="p-8 max-w-4xl" style={ADMIN_FONT}>
      {/* Confirm modal */}
      {confirm && (
        <ConfirmModal
          isOpen
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.label}
          danger={confirm.danger}
          onConfirm={() => {
            confirm.action();
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[13px] mb-6" style={{ color: '#697386' }}>
        <Link
          to="/admin/accounts"
          className="hover:text-[#1a1f36] transition-colors"
          style={{ color: '#697386' }}
        >
          Comptes
        </Link>
        <ChevronRight className="w-3.5 h-3.5" style={{ color: '#c1cfe0' }} />
        <span style={{ color: '#1a1f36' }}>{account.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[28px] font-bold text-[#1a1f36]">{account.name}</h1>
            <span
              className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
              style={{ color: badge.color, backgroundColor: badge.bg }}
            >
              {badge.label}
            </span>
            {account.is_suspended && (
              <span
                className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                style={{ color: '#df1b41', backgroundColor: '#fff0f0' }}
              >
                SUSPENDU
              </span>
            )}
          </div>
          <p className="text-[14px] mt-1" style={{ color: '#697386' }}>
            Inscrit le{' '}
            {new Date(account.created_at).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Membres', value: account.staff_count },
          { label: 'Clients', value: account.client_count },
          { label: 'Statut abonnement', value: account.subscription_status ?? 'Aucun' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-[8px] border border-[#e3e8ef] p-5">
            <div
              className="text-[11px] font-medium uppercase tracking-[0.05em] mb-1"
              style={{ color: '#697386' }}
            >
              {label}
            </div>
            <div className="text-[24px] font-bold" style={{ color: '#1a1f36' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Subscription info */}
      {(account.current_period_end || account.trial_ends_at) && (
        <div className="bg-white rounded-[8px] border border-[#e3e8ef] p-5 mb-4">
          <div
            className="text-[11px] font-medium uppercase tracking-[0.05em] mb-3"
            style={{ color: '#697386' }}
          >
            Abonnement
          </div>
          {account.current_period_end && (
            <p className="text-[14px]" style={{ color: '#697386' }}>
              Fin de période :{' '}
              <span className="font-semibold" style={{ color: '#1a1f36' }}>
                {new Date(account.current_period_end).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </p>
          )}
          {account.trial_ends_at && (
            <p className="text-[14px] mt-1" style={{ color: '#697386' }}>
              Fin d'essai :{' '}
              <span className="font-semibold" style={{ color: '#1a1f36' }}>
                {new Date(account.trial_ends_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-[8px] border border-[#e3e8ef] p-5 mb-6">
        <div
          className="text-[11px] font-medium uppercase tracking-[0.05em] mb-4"
          style={{ color: '#697386' }}
        >
          Actions admin
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Extend trial */}
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              onClick={() =>
                setConfirm({
                  title: "Prolonger l'essai",
                  message: `Prolonger l'essai de ${days} jours ?`,
                  label: `+${days} jours`,
                  action: () => extendTrial.mutate(days),
                })
              }
              disabled={extendTrial.isPending}
              className="h-8 px-3 text-[12px] font-medium border border-[#e3e8ef] rounded-[6px] hover:bg-[#f7fafc] disabled:opacity-50 transition-colors"
              style={{ color: '#697386' }}
            >
              Essai +{days}j
            </button>
          ))}

          {/* Set plan */}
          <button
            onClick={() => setShowSetPlan((v) => !v)}
            className="h-8 px-3 text-[12px] font-medium border border-[#e3e8ef] rounded-[6px] hover:bg-[#f7fafc] transition-colors"
            style={{ color: '#697386' }}
          >
            Changer plan
          </button>

          {/* Suspend / Reactivate */}
          {account.is_suspended ? (
            <button
              onClick={() => reactivate.mutate()}
              disabled={reactivate.isPending}
              className="h-8 px-3 text-[12px] font-medium rounded-[6px] disabled:opacity-50 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: '#f0fdf4', color: '#166534' }}
            >
              {reactivate.isPending ? '...' : 'Réactiver'}
            </button>
          ) : (
            <button
              onClick={() =>
                setConfirm({
                  title: 'Suspendre le compte',
                  message: `Suspendre l'accès à "${account.name}" ? Les utilisateurs ne pourront plus se connecter.`,
                  label: 'Suspendre',
                  danger: true,
                  action: () => suspend.mutate(),
                })
              }
              disabled={suspend.isPending}
              className="h-8 px-3 text-[12px] font-medium rounded-[6px] disabled:opacity-50 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: '#fffbeb', color: '#92400e' }}
            >
              {suspend.isPending ? '...' : 'Suspendre'}
            </button>
          )}

          {/* Cancel subscription */}
          {account.stripe_subscription_id && (
            <button
              onClick={() =>
                setConfirm({
                  title: "Annuler l'abonnement",
                  message: `Annuler l'abonnement Stripe de "${account.name}" ? Le salon passera en Free à la fin de la période en cours.`,
                  label: "Annuler l'abonnement",
                  danger: true,
                  action: () => cancelSub.mutate(),
                })
              }
              disabled={cancelSub.isPending}
              className="h-8 px-3 text-[12px] font-medium rounded-[6px] disabled:opacity-50 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: '#fff0f0', color: '#df1b41' }}
            >
              {cancelSub.isPending ? '...' : 'Annuler abonnement Stripe'}
            </button>
          )}
        </div>

        {/* Set plan inline form */}
        {showSetPlan && (
          <div className="mt-4 flex gap-2 items-center">
            <select
              value={planInput}
              onChange={(e) => setPlanInput(e.target.value)}
              className="h-8 px-3 text-[13px] bg-white border border-[#e3e8ef] rounded-[6px] outline-none focus:border-[#635bff] focus:ring-2 focus:ring-[rgba(99,91,255,0.15)] transition-all"
              style={{ color: '#1a1f36' }}
            >
              <option value="">Choisir un plan</option>
              <option value="free">Free</option>
              <option value="trial">Trial</option>
              <option value="premium">Premium</option>
              <option value="pro">Pro</option>
            </select>
            <button
              onClick={() => {
                if (!planInput) return;
                setConfirm({
                  title: 'Changer de plan',
                  message: `Changer le plan de "${account.name}" vers "${planInput}" ?`,
                  label: 'Confirmer',
                  action: () =>
                    setPlan.mutate(planInput, {
                      onSuccess: () => {
                        setShowSetPlan(false);
                        setPlanInput('');
                      },
                    }),
                });
              }}
              disabled={!planInput || setPlan.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-white text-[14px] font-medium rounded-[6px] hover:bg-[#5850ec] disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#635bff' }}
            >
              {setPlan.isPending ? '...' : 'Confirmer'}
            </button>
            <button
              onClick={() => {
                setShowSetPlan(false);
                setPlanInput('');
              }}
              className="text-[12px] hover:text-[#1a1f36] transition-colors"
              style={{ color: '#697386' }}
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* Invoice history */}
      {account.invoices && account.invoices.length > 0 && (
        <div className="bg-white rounded-[8px] border border-[#e3e8ef] overflow-hidden">
          <div
            className="px-6 py-3.5 border-b border-[#e3e8ef]"
            style={{ backgroundColor: '#f7fafc' }}
          >
            <span
              className="text-[11px] font-medium uppercase tracking-[0.05em]"
              style={{ color: '#697386' }}
            >
              Factures
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #e3e8ef' }}>
                <th
                  className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]"
                  style={{ color: '#697386' }}
                >
                  Date
                </th>
                <th
                  className="text-right px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]"
                  style={{ color: '#697386' }}
                >
                  Montant
                </th>
                <th
                  className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]"
                  style={{ color: '#697386' }}
                >
                  Statut
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {account.invoices.map((inv) => {
                const invBadge = INVOICE_STATUS_BADGE[inv.status] ?? INVOICE_STATUS_BADGE.paid;
                return (
                  <tr
                    key={inv.id}
                    className="hover:bg-[#f7fafc] transition-colors"
                    style={{ borderBottom: '1px solid #e3e8ef' }}
                  >
                    <td className="px-6 py-3 text-[14px]" style={{ color: '#697386' }}>
                      {new Date(inv.paid_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td
                      className="px-6 py-3 text-right text-[14px] font-semibold"
                      style={{ color: '#1a1f36' }}
                    >
                      {(inv.amount_cents / 100).toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: inv.currency.toUpperCase(),
                      })}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                        style={{ color: invBadge.color, backgroundColor: invBadge.bg }}
                      >
                        {inv.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {inv.hosted_invoice_url?.startsWith('https://') && (
                        <a
                          href={inv.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#c1cfe0] hover:text-[#697386] transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div
            className="px-6 py-3 text-[13px] border-t border-[#e3e8ef]"
            style={{ color: '#697386' }}
          >
            {account.invoices.length} facture{account.invoices.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
};
