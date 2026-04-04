// modules/admin/components/AdminRecentSignups.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, ChevronRight } from 'lucide-react';
import { useAdminRecentSignups } from '../hooks/useAdmin';

const CARD_SHADOW = '0 2px 5px 0 rgba(60,66,87,.08), 0 0 0 1px rgba(60,66,87,.16)';

const TIER_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  trial:    { label: 'ESSAI',   color: '#1565c0', bg: '#e3f2fd' },
  free:     { label: 'FREE',    color: '#6b7c93', bg: '#f6f9fc' },
  premium:  { label: 'PREMIUM', color: '#5850ec', bg: '#ede9fe' },
  pro:      { label: 'PRO',     color: '#6d28d9', bg: '#f5f3ff' },
  past_due: { label: 'IMPAYÉ',  color: '#df1b41', bg: '#fff0f0' },
};

export const AdminRecentSignups: React.FC = () => {
  const { data: signups = [], isLoading } = useAdminRecentSignups();
  const navigate = useNavigate();

  return (
    <div className="p-8" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-[#30313d]">Nouvelles inscriptions</h1>
        <p className="text-[13px] text-[#6b7c93] mt-0.5">{signups.length} salon(s) inscrit(s) ces 30 derniers jours</p>
      </div>

      <div className="bg-white rounded-[8px] border border-[#e3e8ef] overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
        {isLoading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-[13px] text-[#6b7c93]">
            <div className="w-4 h-4 border-2 border-[#e3e8ef] border-t-[#635bff] rounded-full animate-spin" />
            Chargement...
          </div>
        ) : signups.length === 0 ? (
          <div className="p-12 text-center">
            <UserPlus className="w-8 h-8 mx-auto mb-3" style={{ color: '#c1cfe0' }} />
            <p className="text-[13px] text-[#6b7c93]">Aucune inscription ces 30 derniers jours</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-[#f6f9fc] border-b border-[#e3e8ef]">
                <th className="text-left px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Salon</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Plan</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Membres</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Inscrit le</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {signups.map(s => {
                const badge = TIER_BADGE[s.subscription_tier] ?? TIER_BADGE.free;
                return (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/admin/accounts/${s.id}`)}
                    className="hover:bg-[#f6f9fc] cursor-pointer transition-colors border-b border-[#f6f9fc] last:border-0"
                  >
                    <td className="px-6 py-3.5 text-[13px] font-semibold text-[#30313d]">{s.name}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: badge.color, backgroundColor: badge.bg }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-[13px] text-[#6b7c93]">{s.staff_count}</td>
                    <td className="px-4 py-3.5 text-[13px] text-[#6b7c93]">
                      {new Date(s.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <ChevronRight size={14} style={{ color: '#c1cfe0' }} />
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
