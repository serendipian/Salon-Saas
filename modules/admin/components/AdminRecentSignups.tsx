// modules/admin/components/AdminRecentSignups.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, ChevronRight, Search } from 'lucide-react';
import { useAdminRecentSignups } from '../hooks/useAdmin';
import { TIER_BADGE, ADMIN_FONT } from '../constants';
import { AdminLoadingState, AdminErrorState, AdminTableFooter } from './AdminShared';

export const AdminRecentSignups: React.FC = () => {
  const { data: signups = [], isLoading, isError } = useAdminRecentSignups();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filtered = signups.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-8" style={ADMIN_FONT}>
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-[#1a1f36]">Nouvelles inscriptions</h1>
        <p className="text-[14px] text-[#697386] mt-1">
          {signups.length} salon{signups.length !== 1 ? 's' : ''} inscrit
          {signups.length !== 1 ? 's' : ''} ces 30 derniers jours
        </p>
      </div>

      <div className="flex items-center justify-end mb-4">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: '#c1cfe0' }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un salon..."
            className="h-9 pl-9 pr-3 text-[13px] bg-white border border-[#e3e8ef] rounded-[6px] outline-none w-56 placeholder:text-[#c1cfe0] focus:border-[#635bff] focus:ring-2 focus:ring-[rgba(99,91,255,0.15)] transition-all"
            style={{ color: '#1a1f36' }}
          />
        </div>
      </div>

      <div className="bg-white rounded-[8px] border border-[#e3e8ef] overflow-hidden">
        {isLoading ? (
          <AdminLoadingState />
        ) : isError ? (
          <AdminErrorState />
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <UserPlus className="w-8 h-8 mx-auto mb-3" style={{ color: '#c1cfe0' }} />
            <p className="text-[14px]" style={{ color: '#697386' }}>
              Aucune inscription ces 30 derniers jours
            </p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#f7fafc', borderBottom: '1px solid #e3e8ef' }}>
                  <th
                    className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]"
                    style={{ color: '#697386' }}
                  >
                    Salon
                  </th>
                  <th
                    className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]"
                    style={{ color: '#697386' }}
                  >
                    Plan
                  </th>
                  <th
                    className="text-right px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]"
                    style={{ color: '#697386' }}
                  >
                    Membres
                  </th>
                  <th
                    className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]"
                    style={{ color: '#697386' }}
                  >
                    Inscrit le
                  </th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const badge = TIER_BADGE[s.subscription_tier] ?? TIER_BADGE.free;
                  return (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/admin/accounts/${s.id}`)}
                      className="cursor-pointer hover:bg-[#f7fafc] transition-colors"
                      style={{ borderBottom: '1px solid #e3e8ef' }}
                    >
                      <td
                        className="px-6 py-3 text-[14px] font-semibold"
                        style={{ color: '#1a1f36' }}
                      >
                        {s.name}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                          style={{ color: badge.color, backgroundColor: badge.bg }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-[14px]" style={{ color: '#697386' }}>
                        {s.staff_count}
                      </td>
                      <td className="px-6 py-3 text-[14px]" style={{ color: '#697386' }}>
                        {new Date(s.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                        })}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <ChevronRight size={14} style={{ color: '#c1cfe0' }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <AdminTableFooter count={filtered.length} />
          </>
        )}
      </div>
    </div>
  );
};
