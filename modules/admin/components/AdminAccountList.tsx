// modules/admin/components/AdminAccountList.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import { useAdminAccounts, type AdminAccount } from '../hooks/useAdmin';

const CARD_SHADOW = '0 2px 5px 0 rgba(60,66,87,.08), 0 0 0 1px rgba(60,66,87,.16)';

const TIER_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  trial:    { label: 'ESSAI',   color: '#1565c0', bg: '#e3f2fd' },
  free:     { label: 'FREE',    color: '#6b7c93', bg: '#f6f9fc' },
  premium:  { label: 'PREMIUM', color: '#5850ec', bg: '#ede9fe' },
  pro:      { label: 'PRO',     color: '#6d28d9', bg: '#f5f3ff' },
  past_due: { label: 'IMPAYÉ',  color: '#df1b41', bg: '#fff0f0' },
};

export const AdminAccountList: React.FC = () => {
  const { data: accounts = [], isLoading } = useAdminAccounts();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const filtered = accounts.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-[#30313d]">Comptes</h1>
          <p className="text-[13px] text-[#6b7c93] mt-0.5">{accounts.length} salon(s) au total</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#6b7c93' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un salon..."
            className="h-8 pl-8 pr-3 text-[13px] bg-white border border-[#e3e8ef] rounded-[6px] outline-none focus:ring-2 focus:ring-[#635bff]/20 focus:border-[#635bff] w-56 transition-all placeholder:text-[#c1cfe0]"
            style={{ color: '#30313d' }}
          />
        </div>
      </div>

      <div className="bg-white rounded-[8px] border border-[#e3e8ef] overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
        {isLoading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-[13px] text-[#6b7c93]">
            <div className="w-4 h-4 border-2 border-[#e3e8ef] border-t-[#635bff] rounded-full animate-spin" />
            Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-[13px] text-[#6b7c93]">Aucun salon trouvé</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-[#f6f9fc] border-b border-[#e3e8ef]">
                <th className="text-left px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Salon</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Plan</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Membres</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Clients</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Inscrit le</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((account: AdminAccount) => {
                const badge = TIER_BADGE[account.subscription_tier] ?? TIER_BADGE.free;
                return (
                  <tr
                    key={account.id}
                    onClick={() => navigate(`/admin/accounts/${account.id}`)}
                    className="hover:bg-[#f6f9fc] cursor-pointer transition-colors border-b border-[#f6f9fc] last:border-0"
                  >
                    <td className="px-6 py-3.5">
                      <span className="text-[13px] font-semibold text-[#30313d]">{account.name}</span>
                      {account.is_suspended && (
                        <span
                          className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ color: '#df1b41', backgroundColor: '#fff0f0' }}
                        >
                          SUSPENDU
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: badge.color, backgroundColor: badge.bg }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-[13px] text-[#6b7c93]">{account.staff_count}</td>
                    <td className="px-4 py-3.5 text-right text-[13px] text-[#6b7c93]">{account.client_count}</td>
                    <td className="px-4 py-3.5 text-[13px] text-[#6b7c93]">
                      {new Date(account.created_at).toLocaleDateString('fr-FR')}
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
