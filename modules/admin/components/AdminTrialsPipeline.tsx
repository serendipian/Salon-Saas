// modules/admin/components/AdminTrialsPipeline.tsx
import React from 'react';
import { Clock } from 'lucide-react';
import { useAdminTrials, useAdminExtendTrial, type AdminTrial } from '../hooks/useAdmin';

const DaysChip: React.FC<{ days: number }> = ({ days }) => {
  const cls = days <= 3
    ? 'bg-rose-100 text-rose-700'
    : days <= 7
    ? 'bg-amber-100 text-amber-700'
    : 'bg-blue-100 text-blue-700';
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cls}`}>
      {days === 0 ? "Expire aujourd'hui" : `${days}j restants`}
    </span>
  );
};

const TrialRow: React.FC<{ trial: AdminTrial }> = ({ trial }) => {
  const extend = useAdminExtendTrial(trial.id);
  return (
    <tr className="border-b border-slate-50">
      <td className="px-6 py-3 font-semibold text-slate-900">{trial.name}</td>
      <td className="px-4 py-3">
        <DaysChip days={trial.days_remaining} />
      </td>
      <td className="px-4 py-3 text-slate-500 text-sm">
        {new Date(trial.trial_ends_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          {[7, 14, 30].map(days => (
            <button
              key={days}
              onClick={() => extend.mutate(days)}
              disabled={extend.isPending}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              +{days}j
            </button>
          ))}
        </div>
      </td>
    </tr>
  );
};

export const AdminTrialsPipeline: React.FC = () => {
  const { data: trials = [], isLoading } = useAdminTrials();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Essais en cours</h1>
        <p className="text-sm text-slate-500 mt-1">
          {trials.length} essai(s) expirant dans les 14 prochains jours
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Chargement...</div>
        ) : trials.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Aucun essai n'expire dans les 14 prochains jours</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide">
                <th className="text-left px-6 py-3">Salon</th>
                <th className="text-left px-4 py-3">Délai</th>
                <th className="text-left px-4 py-3">Expire le</th>
                <th className="text-left px-4 py-3">Prolonger</th>
              </tr>
            </thead>
            <tbody>
              {trials.map(trial => <TrialRow key={trial.id} trial={trial} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
