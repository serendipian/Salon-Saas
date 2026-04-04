// modules/admin/components/AdminAccountDetail.tsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import {
  useAdminAccount,
  useAdminExtendTrial,
  useAdminSetPlan,
  useAdminSuspend,
  useAdminReactivate,
  useAdminCancelSubscription,
} from '../hooks/useAdmin';

const CARD_SHADOW = '0 2px 5px 0 rgba(60,66,87,.08), 0 0 0 1px rgba(60,66,87,.16)';

const TIER_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  trial:    { label: 'ESSAI',   color: '#1565c0', bg: '#e3f2fd' },
  free:     { label: 'FREE',    color: '#6b7c93', bg: '#f6f9fc' },
  premium:  { label: 'PREMIUM', color: '#5850ec', bg: '#ede9fe' },
  pro:      { label: 'PRO',     color: '#6d28d9', bg: '#f5f3ff' },
  past_due: { label: 'IMPAYÉ',  color: '#df1b41', bg: '#fff0f0' },
};

export const AdminAccountDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: account, isLoading } = useAdminAccount(id!);

  const extendTrial = useAdminExtendTrial(id!);
  const setPlan     = useAdminSetPlan(id!);
  const suspend     = useAdminSuspend(id!);
  const reactivate  = useAdminReactivate(id!);
  const cancelSub   = useAdminCancelSubscription(id!);

  const [planInput, setPlanInput] = useState('');
  const [showSetPlan, setShowSetPlan] = useState(false);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-[13px] text-[#6b7c93]" style={{ fontFamily: "'Outfit', sans-serif" }}>
        <div className="w-4 h-4 border-2 border-[#e3e8ef] border-t-[#635bff] rounded-full animate-spin" />
        Chargement...
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-8 text-[13px] text-[#6b7c93]" style={{ fontFamily: "'Outfit', sans-serif" }}>
        Compte introuvable.
      </div>
    );
  }

  const badge = TIER_BADGE[account.subscription_tier] ?? TIER_BADGE.free;

  const handleSuspend = () => {
    if (!window.confirm(`Suspendre l'accès à "${account.name}" ? Les utilisateurs ne pourront plus se connecter.`)) return;
    suspend.mutate();
  };

  const handleCancel = () => {
    if (!window.confirm(`Annuler l'abonnement Stripe de "${account.name}" ? Le salon passera en Free à la fin de la période en cours.`)) return;
    cancelSub.mutate();
  };

  const handleSetPlan = () => {
    if (!planInput) return;
    if (!window.confirm(`Changer le plan de "${account.name}" vers "${planInput}" ?`)) return;
    setPlan.mutate(planInput, { onSuccess: () => { setShowSetPlan(false); setPlanInput(''); } });
  };

  return (
    <div className="p-8 max-w-4xl" style={{ fontFamily: "'Outfit', sans-serif" }}>
      {/* Back */}
      <button
        onClick={() => navigate('/admin/accounts')}
        className="flex items-center gap-1.5 text-[13px] text-[#6b7c93] hover:text-[#30313d] mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        Retour aux comptes
      </button>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[22px] font-semibold text-[#30313d]">{account.name}</h1>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ color: badge.color, backgroundColor: badge.bg }}
            >
              {badge.label}
            </span>
            {account.is_suspended && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ color: '#df1b41', backgroundColor: '#fff0f0' }}
              >
                SUSPENDU
              </span>
            )}
          </div>
          <p className="text-[13px] text-[#6b7c93] mt-0.5">
            Inscrit le {new Date(account.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
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
          <div
            key={label}
            className="bg-white rounded-[8px] border border-[#e3e8ef] p-5"
            style={{ boxShadow: '0 2px 5px 0 rgba(60,66,87,.08)' }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93] mb-1">{label}</div>
            <div className="text-[22px] font-semibold text-[#30313d]">{value}</div>
          </div>
        ))}
      </div>

      {/* Subscription info */}
      {(account.current_period_end || account.trial_ends_at) && (
        <div
          className="bg-white rounded-[8px] border border-[#e3e8ef] p-5 mb-4"
          style={{ boxShadow: '0 2px 5px 0 rgba(60,66,87,.08)' }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93] mb-3">Abonnement</div>
          {account.current_period_end && (
            <p className="text-[13px] text-[#6b7c93]">
              Fin de période :{' '}
              <span className="font-semibold text-[#30313d]">
                {new Date(account.current_period_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </p>
          )}
          {account.trial_ends_at && (
            <p className="text-[13px] text-[#6b7c93] mt-1">
              Fin d'essai :{' '}
              <span className="font-semibold text-[#30313d]">
                {new Date(account.trial_ends_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div
        className="bg-white rounded-[8px] border border-[#e3e8ef] p-5 mb-6"
        style={{ boxShadow: '0 2px 5px 0 rgba(60,66,87,.08)' }}
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93] mb-4">Actions admin</div>
        <div className="flex flex-wrap gap-2">

          {/* Extend trial */}
          {[7, 14, 30].map(days => (
            <button
              key={days}
              onClick={() => {
                if (window.confirm(`Prolonger l'essai de ${days} jours ?`)) extendTrial.mutate(days);
              }}
              disabled={extendTrial.isPending}
              className="h-8 px-3 text-[12px] font-semibold border border-[#e3e8ef] text-[#6b7c93] rounded-[6px] hover:bg-[#f6f9fc] disabled:opacity-50 transition-colors"
            >
              Essai +{days}j
            </button>
          ))}

          {/* Set plan */}
          <button
            onClick={() => setShowSetPlan(v => !v)}
            className="h-8 px-3 text-[12px] font-semibold border border-[#e3e8ef] text-[#6b7c93] rounded-[6px] hover:bg-[#f6f9fc] transition-colors"
          >
            Changer plan
          </button>

          {/* Suspend / Reactivate */}
          {account.is_suspended ? (
            <button
              onClick={() => reactivate.mutate()}
              disabled={reactivate.isPending}
              className="h-8 px-3 text-[12px] font-semibold rounded-[6px] disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#f0fdf4', color: '#166534' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#dcfce7')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#f0fdf4')}
            >
              {reactivate.isPending ? '...' : 'Réactiver'}
            </button>
          ) : (
            <button
              onClick={handleSuspend}
              disabled={suspend.isPending}
              className="h-8 px-3 text-[12px] font-semibold rounded-[6px] disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#fffbeb', color: '#92400e' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fef3c7')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fffbeb')}
            >
              {suspend.isPending ? '...' : 'Suspendre'}
            </button>
          )}

          {/* Cancel subscription */}
          {account.stripe_subscription_id && (
            <button
              onClick={handleCancel}
              disabled={cancelSub.isPending}
              className="h-8 px-3 text-[12px] font-semibold bg-[#fff0f0] text-[#df1b41] rounded-[6px] hover:bg-[#ffe4e6] disabled:opacity-50 transition-colors"
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
              onChange={e => setPlanInput(e.target.value)}
              className="h-8 px-3 text-[13px] bg-white border border-[#e3e8ef] rounded-[6px] outline-none focus:ring-2 focus:ring-[#635bff]/20 focus:border-[#635bff] transition-all"
              style={{ color: '#30313d' }}
            >
              <option value="">Choisir un plan</option>
              <option value="free">Free</option>
              <option value="trial">Trial</option>
              <option value="premium">Premium</option>
              <option value="pro">Pro</option>
            </select>
            <button
              onClick={handleSetPlan}
              disabled={!planInput || setPlan.isPending}
              className="h-8 px-4 text-[12px] font-semibold bg-[#635bff] text-white rounded-[6px] hover:bg-[#5850ec] disabled:opacity-50 transition-colors"
            >
              {setPlan.isPending ? '...' : 'Confirmer'}
            </button>
            <button
              onClick={() => { setShowSetPlan(false); setPlanInput(''); }}
              className="text-[12px] text-[#6b7c93] hover:text-[#30313d] transition-colors"
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* Invoice history */}
      {account.invoices && account.invoices.length > 0 && (
        <div className="bg-white rounded-[8px] border border-[#e3e8ef] overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
          <div className="px-6 py-3.5 bg-[#f6f9fc] border-b border-[#e3e8ef]">
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Factures</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e3e8ef]">
                <th className="text-left px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Date</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Montant</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {account.invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-[#f6f9fc] transition-colors border-b border-[#f6f9fc] last:border-0">
                  <td className="px-6 py-3.5 text-[13px] text-[#6b7c93]">
                    {new Date(inv.paid_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3.5 text-right text-[13px] font-semibold text-[#30313d]">
                    {(inv.amount_cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: inv.currency.toUpperCase() })}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: '#166534', backgroundColor: '#dcfce7' }}
                    >
                      {inv.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {inv.hosted_invoice_url && (
                      <a
                        href={inv.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors"
                        style={{ color: '#c1cfe0' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#6b7c93')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#c1cfe0')}
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
