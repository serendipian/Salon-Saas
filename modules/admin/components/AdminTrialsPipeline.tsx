// modules/admin/components/AdminTrialsPipeline.tsx
import React from 'react';
import { Clock } from 'lucide-react';
import { useAdminTrials, useAdminExtendTrial, type AdminTrial } from '../hooks/useAdmin';

const CARD_SHADOW = '0 2px 5px 0 rgba(60,66,87,.08), 0 0 0 1px rgba(60,66,87,.16)';

const DaysChip: React.FC<{ days: number }> = ({ days }) => {
  const color = days <= 3 ? '#df1b41' : days <= 7 ? '#b45309' : '#1565c0';
  const bg    = days <= 3 ? '#fff0f0' : days <= 7 ? '#fef3c7' : '#e3f2fd';
  return (
    <span
      className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
      style={{ color, backgroundColor: bg }}
    >
      {days === 0 ? "Expire aujourd'hui" : `${days}j restants`}
    </span>
  );
};

const TrialRow: React.FC<{ trial: AdminTrial }> = ({ trial }) => {
  const extend = useAdminExtendTrial(trial.id);
  return (
    <tr className="hover:bg-[#f6f9fc] transition-colors border-b border-[#f6f9fc] last:border-0">
      <td className="px-6 py-3.5 text-[13px] font-semibold text-[#30313d]">{trial.name}</td>
      <td className="px-4 py-3.5">
        <DaysChip days={trial.days_remaining} />
      </td>
      <td className="px-4 py-3.5 text-[13px] text-[#6b7c93]">
        {new Date(trial.trial_ends_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
      </td>
      <td className="px-4 py-3.5">
        <div className="flex gap-1.5">
          {[7, 14, 30].map(days => (
            <button
              key={days}
              onClick={() => extend.mutate(days)}
              disabled={extend.isPending}
              className="h-8 px-3 text-[12px] font-semibold border border-[#e3e8ef] text-[#6b7c93] rounded-[6px] hover:bg-[#f6f9fc] disabled:opacity-50 transition-colors"
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
    <div className="p-8" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-[#30313d]">Essais en cours</h1>
        <p className="text-[13px] text-[#6b7c93] mt-0.5">
          {trials.length} essai(s) expirant dans les 14 prochains jours
        </p>
      </div>

      <div className="bg-white rounded-[8px] border border-[#e3e8ef] overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
        {isLoading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-[13px] text-[#6b7c93]">
            <div className="w-4 h-4 border-2 border-[#e3e8ef] border-t-[#635bff] rounded-full animate-spin" />
            Chargement...
          </div>
        ) : trials.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="w-8 h-8 mx-auto mb-3" style={{ color: '#c1cfe0' }} />
            <p className="text-[13px] text-[#6b7c93]">Aucun essai n'expire dans les 14 prochains jours</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-[#f6f9fc] border-b border-[#e3e8ef]">
                <th className="text-left px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Salon</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Délai</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Expire le</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Prolonger</th>
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
