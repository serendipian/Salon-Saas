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

const TIER_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  trial:    { label: 'ESSAI',   color: '#1565c0', bg: '#e3f2fd' },
  free:     { label: 'FREE',    color: '#697386', bg: '#f0f0f0' },
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
      <div className="flex items-center justify-center gap-2 p-12 text-[14px]" style={{ fontFamily: "'Inter', -apple-system, sans-serif", color: '#697386' }}>
        <div className="w-4 h-4 border-2 border-[#e3e8ef] border-t-[#635bff] rounded-full animate-spin" />
        Chargement...
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-8 text-[14px]" style={{ fontFamily: "'Inter', -apple-system, sans-serif", color: '#697386' }}>
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
    <div className="p-8 max-w-4xl" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
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
            Inscrit le {new Date(account.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stats — 3-col */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Membres', value: account.staff_count },
          { label: 'Clients', value: account.client_count },
          { label: 'Statut abonnement', value: account.subscription_status ?? 'Aucun' },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-white rounded-[8px] border border-[#e3e8ef] p-5"
          >
            <div className="text-[11px] font-medium uppercase tracking-[0.05em] mb-1" style={{ color: '#697386' }}>{label}</div>
            <div className="text-[24px] font-bold" style={{ color: '#1a1f36' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Subscription info */}
      {(account.current_period_end || account.trial_ends_at) && (
        <div className="bg-white rounded-[8px] border border-[#e3e8ef] p-5 mb-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.05em] mb-3" style={{ color: '#697386' }}>Abonnement</div>
          {account.current_period_end && (
            <p className="text-[14px]" style={{ color: '#697386' }}>
              Fin de période :{' '}
              <span className="font-semibold" style={{ color: '#1a1f36' }}>
                {new Date(account.current_period_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </p>
          )}
          {account.trial_ends_at && (
            <p className="text-[14px] mt-1" style={{ color: '#697386' }}>
              Fin d'essai :{' '}
              <span className="font-semibold" style={{ color: '#1a1f36' }}>
                {new Date(account.trial_ends_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-[8px] border border-[#e3e8ef] p-5 mb-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.05em] mb-4" style={{ color: '#697386' }}>Actions admin</div>
        <div className="flex flex-wrap gap-2">

          {/* Extend trial */}
          {[7, 14, 30].map(days => (
            <button
              key={days}
              onClick={() => {
                if (window.confirm(`Prolonger l'essai de ${days} jours ?`)) extendTrial.mutate(days);
              }}
              disabled={extendTrial.isPending}
              className="h-8 px-3 text-[12px] font-medium border border-[#e3e8ef] rounded-[6px] hover:bg-[#f7fafc] disabled:opacity-50 transition-colors"
              style={{ color: '#697386' }}
            >
              Essai +{days}j
            </button>
          ))}

          {/* Set plan */}
          <button
            onClick={() => setShowSetPlan(v => !v)}
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
              className="h-8 px-3 text-[12px] font-medium rounded-[6px] disabled:opacity-50 transition-colors"
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
              className="h-8 px-3 text-[12px] font-medium rounded-[6px] disabled:opacity-50 transition-colors"
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
              className="h-8 px-3 text-[12px] font-medium rounded-[6px] disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#fff0f0', color: '#df1b41' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#ffe4e6')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fff0f0')}
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
              className="h-8 px-3 text-[13px] bg-white border border-[#e3e8ef] rounded-[6px] outline-none transition-all"
              style={{ color: '#1a1f36' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#635bff'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,91,255,0.15)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e3e8ef'; e.currentTarget.style.boxShadow = 'none'; }}
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
              className="inline-flex items-center gap-2 px-4 py-2 text-white text-[14px] font-medium rounded-[6px] hover:bg-[#5850ec] disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#635bff' }}
            >
              {setPlan.isPending ? '...' : 'Confirmer'}
            </button>
            <button
              onClick={() => { setShowSetPlan(false); setPlanInput(''); }}
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
          <div className="px-6 py-3.5 border-b border-[#e3e8ef]" style={{ backgroundColor: '#f7fafc' }}>
            <span className="text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: '#697386' }}>Factures</span>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #e3e8ef' }}>
                <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: '#697386' }}>Date</th>
                <th className="text-right px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: '#697386' }}>Montant</th>
                <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: '#697386' }}>Statut</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {account.invoices.map(inv => (
                <tr
                  key={inv.id}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid #e3e8ef' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f7fafc')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                >
                  <td className="px-6 py-3 text-[14px]" style={{ color: '#697386' }}>
                    {new Date(inv.paid_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-3 text-right text-[14px] font-semibold" style={{ color: '#1a1f36' }}>
                    {(inv.amount_cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: inv.currency.toUpperCase() })}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                      style={{ color: '#0d7c3d', backgroundColor: '#d3f4e3' }}
                    >
                      {inv.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {inv.hosted_invoice_url && (
                      <a
                        href={inv.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors"
                        style={{ color: '#c1cfe0' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#697386')}
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
          <div className="px-6 py-3 text-[13px] border-t border-[#e3e8ef]" style={{ color: '#697386' }}>
            {account.invoices.length} facture{account.invoices.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
};
