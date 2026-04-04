// modules/admin/components/AdminTrialsPipeline.tsx
import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { useAdminTrials, useAdminExtendTrial, type AdminTrial } from '../hooks/useAdmin';
import { ADMIN_FONT } from '../constants';
import { AdminLoadingState, AdminErrorState, AdminTableFooter } from './AdminShared';

const DaysChip: React.FC<{ days: number }> = ({ days }) => {
  const color = days <= 3 ? '#df1b41' : days <= 7 ? '#b45309' : '#1565c0';
  const bg    = days <= 3 ? '#fff0f0' : days <= 7 ? '#fef3c7' : '#e3f2fd';
  return (
    <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full" style={{ color, backgroundColor: bg }}>
      {days === 0 ? "Expire aujourd'hui" : `${days}j restants`}
    </span>
  );
};

// key={trial.id} on TrialRow ensures fresh hook instance when list reorders — fixes stale salonId closure
const TrialRow: React.FC<{ trial: AdminTrial }> = ({ trial }) => {
  const extend = useAdminExtendTrial(trial.id);
  return (
    <tr className="hover:bg-[#f7fafc] transition-colors" style={{ borderBottom: '1px solid #e3e8ef' }}>
      <td className="px-6 py-3 text-[14px] font-semibold" style={{ color: '#1a1f36' }}>{trial.name}</td>
      <td className="px-6 py-3"><DaysChip days={trial.days_remaining} /></td>
      <td className="px-6 py-3 text-[14px]" style={{ color: '#697386' }}>
        {new Date(trial.trial_ends_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
      </td>
      <td className="px-6 py-3">
        <div className="flex gap-1.5">
          {[7, 14, 30].map(days => (
            <button
              key={days}
              onClick={() => extend.mutate(days)}
              disabled={extend.isPending}
              className="h-8 px-3 text-[12px] font-medium border border-[#e3e8ef] rounded-[6px] hover:bg-[#f7fafc] disabled:opacity-50 transition-colors"
              style={{ color: '#697386' }}
            >
              {extend.isPending ? <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : `+${days}j`}
            </button>
          ))}
        </div>
      </td>
    </tr>
  );
};

type TabKey = 'all' | 'critical' | 'week' | 'ok';

export const AdminTrialsPipeline: React.FC = () => {
  const { data: trials = [], isLoading, isError } = useAdminTrials();
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const critical = trials.filter(t => t.days_remaining <= 3);
  const week     = trials.filter(t => t.days_remaining > 3 && t.days_remaining <= 7);
  const ok       = trials.filter(t => t.days_remaining > 7);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all',      label: 'Tous',       count: trials.length },
    { key: 'critical', label: 'Critique ≤3j', count: critical.length },
    { key: 'week',     label: 'Cette semaine', count: week.length },
    { key: 'ok',       label: 'OK',          count: ok.length },
  ];

  const filtered = activeTab === 'critical' ? critical : activeTab === 'week' ? week : activeTab === 'ok' ? ok : trials;

  return (
    <div className="p-8" style={ADMIN_FONT}>
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-[#1a1f36]">Essais en cours</h1>
        <p className="text-[14px] text-[#697386] mt-1">{trials.length} essai{trials.length !== 1 ? 's' : ''} actif{trials.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="bg-white rounded-[8px] border border-[#e3e8ef] overflow-hidden">
        <div className="flex border-b border-[#e3e8ef]">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-4 py-3 text-[14px] font-medium transition-colors"
              style={{ color: activeTab === tab.key ? '#635bff' : '#697386', borderBottom: activeTab === tab.key ? '2px solid #635bff' : '2px solid transparent', marginBottom: -1 }}
            >
              {tab.label}
              {tab.count > 0 && <span className="ml-1.5 text-[12px]">{tab.count}</span>}
            </button>
          ))}
        </div>

        {isLoading ? <AdminLoadingState />
          : isError ? <AdminErrorState />
          : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Clock className="w-8 h-8 mx-auto mb-3" style={{ color: '#c1cfe0' }} />
              <p className="text-[14px]" style={{ color: '#697386' }}>Aucun essai dans cette catégorie</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#f7fafc', borderBottom: '1px solid #e3e8ef' }}>
                    <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: '#697386' }}>Salon</th>
                    <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: '#697386' }}>Délai</th>
                    <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: '#697386' }}>Expire le</th>
                    <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: '#697386' }}>Prolonger</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(trial => <TrialRow key={trial.id} trial={trial} />)}
                </tbody>
              </table>
              <AdminTableFooter count={filtered.length} />
            </>
          )}
      </div>
    </div>
  );
};
