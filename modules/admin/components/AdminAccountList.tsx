// modules/admin/components/AdminAccountList.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, Plus } from 'lucide-react';
import { useAdminAccounts, type AdminAccount } from '../hooks/useAdmin';

const TIER_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  trial:    { label: 'ESSAI',   color: '#1565c0', bg: '#e3f2fd' },
  free:     { label: 'FREE',    color: '#697386', bg: '#f0f0f0' },
  premium:  { label: 'PREMIUM', color: '#5850ec', bg: '#ede9fe' },
  pro:      { label: 'PRO',     color: '#6d28d9', bg: '#f5f3ff' },
  past_due: { label: 'IMPAYÉ',  color: '#df1b41', bg: '#fff0f0' },
};

const FilterChip: React.FC<{ label: string }> = ({ label }) => (
  <button
    className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] border border-[#e3e8ef] rounded-full hover:bg-[#f7fafc] transition-colors"
    style={{ color: '#3c4257' }}
  >
    <Plus className="w-3 h-3" />
    {label}
  </button>
);

export const AdminAccountList: React.FC = () => {
  const { data: accounts = [], isLoading } = useAdminAccounts();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const filtered = accounts.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const count = filtered.length;

  return (
    <div className="p-8" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-[#1a1f36]">Comptes</h1>
        <p className="text-[14px] text-[#697386] mt-1">{accounts.length} salon{accounts.length !== 1 ? 's' : ''} au total</p>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 mb-4">
        <FilterChip label="Plan" />
        <FilterChip label="Statut" />
        <FilterChip label="Date d'inscription" />
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#c1cfe0' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un salon..."
            className="h-9 pl-9 pr-3 text-[13px] bg-white border border-[#e3e8ef] rounded-[6px] outline-none w-56 transition-all placeholder:text-[#c1cfe0]"
            style={{ color: '#1a1f36' }}
            onFocus={e => { e.currentTarget.style.borderColor = '#635bff'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,91,255,0.15)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#e3e8ef'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[8px] border border-[#e3e8ef] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-[14px]" style={{ color: '#697386' }}>
            <div className="w-4 h-4 border-2 border-[#e3e8ef] border-t-[#635bff] rounded-full animate-spin" />
            Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-[14px]" style={{ color: '#697386' }}>Aucun salon trouvé</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#f7fafc', borderBottom: '1px solid #e3e8ef' }}>
                  <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: '#697386' }}>Salon</th>
                  <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: '#697386' }}>Plan</th>
                  <th className="text-right px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: '#697386' }}>Membres</th>
                  <th className="text-right px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: '#697386' }}>Clients</th>
                  <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: '#697386' }}>Inscrit le</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((account: AdminAccount) => {
                  const badge = TIER_BADGE[account.subscription_tier] ?? TIER_BADGE.free;
                  return (
                    <tr
                      key={account.id}
                      onClick={() => navigate(`/admin/accounts/${account.id}`)}
                      className="cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid #e3e8ef' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f7fafc')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                    >
                      <td className="px-6 py-3 text-[14px]">
                        <span className="font-semibold" style={{ color: '#1a1f36' }}>{account.name}</span>
                        {account.is_suspended && (
                          <span
                            className="ml-2 text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                            style={{ color: '#df1b41', backgroundColor: '#fff0f0' }}
                          >
                            SUSPENDU
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-[14px]">
                        <span
                          className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                          style={{ color: badge.color, backgroundColor: badge.bg }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-[14px]" style={{ color: '#697386' }}>{account.staff_count}</td>
                      <td className="px-6 py-3 text-right text-[14px]" style={{ color: '#697386' }}>{account.client_count}</td>
                      <td className="px-6 py-3 text-[14px]" style={{ color: '#697386' }}>
                        {new Date(account.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <ChevronRight size={14} style={{ color: '#c1cfe0' }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-6 py-3 text-[13px] border-t border-[#e3e8ef]" style={{ color: '#697386' }}>
              {count} élément{count !== 1 ? 's' : ''}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
