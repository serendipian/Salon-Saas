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

const TIER_BADGE: Record<string, { label: string; className: string }> = {
  trial:    { label: 'ESSAI',   className: 'bg-blue-100 text-blue-700' },
  free:     { label: 'FREE',    className: 'bg-slate-100 text-slate-600' },
  premium:  { label: 'PREMIUM', className: 'bg-brand-100 text-brand-700' },
  pro:      { label: 'PRO',     className: 'bg-purple-100 text-purple-700' },
  past_due: { label: 'IMPAYÉ',  className: 'bg-rose-100 text-rose-700' },
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
    return <div className="p-8 text-sm text-slate-400">Chargement...</div>;
  }

  if (!account) {
    return <div className="p-8 text-sm text-slate-400">Compte introuvable.</div>;
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
    <div className="p-8 max-w-4xl">
      {/* Back */}
      <button
        onClick={() => navigate('/admin/accounts')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux comptes
      </button>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-extrabold text-slate-900">{account.name}</h1>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${badge.className}`}>
              {badge.label}
            </span>
            {account.is_suspended && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-200 text-rose-800">
                SUSPENDU
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Inscrit le {new Date(account.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Membres', value: account.staff_count },
          { label: 'Clients', value: account.client_count },
          { label: 'Statut abonnement', value: account.subscription_status ?? 'Aucun' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</div>
            <div className="text-2xl font-extrabold text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      {/* Subscription info */}
      {(account.current_period_end || account.trial_ends_at) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 text-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Abonnement</div>
          {account.current_period_end && (
            <p className="text-slate-600">
              Fin de période : <span className="font-semibold text-slate-900">
                {new Date(account.current_period_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </p>
          )}
          {account.trial_ends_at && (
            <p className="text-slate-600 mt-1">
              Fin d'essai : <span className="font-semibold text-slate-900">
                {new Date(account.trial_ends_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Actions admin</div>
        <div className="flex flex-wrap gap-3">

          {/* Extend trial */}
          <div className="flex gap-1">
            {[7, 14, 30].map(days => (
              <button
                key={days}
                onClick={() => {
                  if (window.confirm(`Prolonger l'essai de ${days} jours ?`)) extendTrial.mutate(days);
                }}
                disabled={extendTrial.isPending}
                className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Essai +{days}j
              </button>
            ))}
          </div>

          {/* Set plan */}
          <button
            onClick={() => setShowSetPlan(v => !v)}
            className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Changer plan
          </button>

          {/* Suspend / Reactivate */}
          {account.is_suspended ? (
            <button
              onClick={() => reactivate.mutate()}
              disabled={reactivate.isPending}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
            >
              {reactivate.isPending ? '...' : 'Réactiver'}
            </button>
          ) : (
            <button
              onClick={handleSuspend}
              disabled={suspend.isPending}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
            >
              {suspend.isPending ? '...' : 'Suspendre'}
            </button>
          )}

          {/* Cancel subscription */}
          {account.stripe_subscription_id && (
            <button
              onClick={handleCancel}
              disabled={cancelSub.isPending}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition-colors"
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
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {setPlan.isPending ? '...' : 'Confirmer'}
            </button>
            <button
              onClick={() => { setShowSetPlan(false); setPlanInput(''); }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* Invoice history */}
      {account.invoices && account.invoices.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Factures</div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide">
                <th className="text-left px-6 py-3">Date</th>
                <th className="text-right px-4 py-3">Montant</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {account.invoices.map(inv => (
                <tr key={inv.id} className="border-b border-slate-50">
                  <td className="px-6 py-3 text-slate-600">
                    {new Date(inv.paid_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {(inv.amount_cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: inv.currency.toUpperCase() })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      {inv.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {inv.hosted_invoice_url && (
                      <a
                        href={inv.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
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
