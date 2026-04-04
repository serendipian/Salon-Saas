// modules/admin/components/AdminAccountList.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import { useAdminAccounts, type AdminAccount } from '../hooks/useAdmin';

const TIER_BADGE: Record<string, { label: string; className: string }> = {
  trial:    { label: 'ESSAI',    className: 'bg-blue-100 text-blue-700' },
  free:     { label: 'FREE',     className: 'bg-slate-100 text-slate-600' },
  premium:  { label: 'PREMIUM',  className: 'bg-brand-100 text-brand-700' },
  pro:      { label: 'PRO',      className: 'bg-purple-100 text-purple-700' },
  past_due: { label: 'IMPAYÉ',   className: 'bg-rose-100 text-rose-700' },
};

export const AdminAccountList: React.FC = () => {
  const { data: accounts = [], isLoading } = useAdminAccounts();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const filtered = accounts.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Comptes</h1>
          <p className="text-sm text-slate-500 mt-1">{accounts.length} salon(s) au total</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un salon..."
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white w-64"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Aucun salon trouvé</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide">
                <th className="text-left px-6 py-3">Salon</th>
                <th className="text-left px-4 py-3">Plan</th>
                <th className="text-right px-4 py-3">Membres</th>
                <th className="text-right px-4 py-3">Clients</th>
                <th className="text-left px-4 py-3">Inscrit le</th>
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
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3">
                      <div className="font-semibold text-slate-900">{account.name}</div>
                      {account.is_suspended && (
                        <span className="text-[10px] font-bold text-rose-600">SUSPENDU</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{account.staff_count}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{account.client_count}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(account.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-slate-300" />
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
