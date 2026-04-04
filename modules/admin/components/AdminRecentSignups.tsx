// modules/admin/components/AdminRecentSignups.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAdminRecentSignups } from '../hooks/useAdmin';

const TIER_BADGE: Record<string, { label: string; className: string }> = {
  trial:    { label: 'ESSAI',   className: 'bg-blue-100 text-blue-700' },
  free:     { label: 'FREE',    className: 'bg-slate-100 text-slate-600' },
  premium:  { label: 'PREMIUM', className: 'bg-brand-100 text-brand-700' },
  pro:      { label: 'PRO',     className: 'bg-purple-100 text-purple-700' },
  past_due: { label: 'IMPAYÉ',  className: 'bg-rose-100 text-rose-700' },
};

export const AdminRecentSignups: React.FC = () => {
  const { data: signups = [], isLoading } = useAdminRecentSignups();
  const navigate = useNavigate();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Nouvelles inscriptions</h1>
        <p className="text-sm text-slate-500 mt-1">{signups.length} salon(s) inscrit(s) ces 30 derniers jours</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Chargement...</div>
        ) : signups.length === 0 ? (
          <div className="p-8 text-center">
            <UserPlus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Aucune inscription ces 30 derniers jours</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide">
                <th className="text-left px-6 py-3">Salon</th>
                <th className="text-left px-4 py-3">Plan</th>
                <th className="text-right px-4 py-3">Membres</th>
                <th className="text-left px-4 py-3">Inscrit le</th>
              </tr>
            </thead>
            <tbody>
              {signups.map(s => {
                const badge = TIER_BADGE[s.subscription_tier] ?? TIER_BADGE.free;
                return (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/admin/accounts/${s.id}`)}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3 font-semibold text-slate-900">{s.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{s.staff_count}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(s.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
