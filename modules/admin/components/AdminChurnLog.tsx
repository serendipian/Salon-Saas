// modules/admin/components/AdminChurnLog.tsx
import React from 'react';
import { TrendingDown } from 'lucide-react';
import { useAdminChurn } from '../hooks/useAdmin';

const CARD_SHADOW = '0 2px 5px 0 rgba(60,66,87,.08), 0 0 0 1px rgba(60,66,87,.16)';

export const AdminChurnLog: React.FC = () => {
  const { data: churn = [], isLoading } = useAdminChurn();

  return (
    <div className="p-8" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-[#30313d]">Résiliations</h1>
        <p className="text-[13px] text-[#6b7c93] mt-0.5">{churn.length} résiliation(s)</p>
      </div>

      <div className="bg-white rounded-[8px] border border-[#e3e8ef] overflow-hidden" style={{ boxShadow: CARD_SHADOW }}>
        {isLoading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-[13px] text-[#6b7c93]">
            <div className="w-4 h-4 border-2 border-[#e3e8ef] border-t-[#635bff] rounded-full animate-spin" />
            Chargement...
          </div>
        ) : churn.length === 0 ? (
          <div className="p-12 text-center">
            <TrendingDown className="w-8 h-8 mx-auto mb-3" style={{ color: '#c1cfe0' }} />
            <p className="text-[13px] text-[#6b7c93]">Aucune résiliation enregistrée</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-[#f6f9fc] border-b border-[#e3e8ef]">
                <th className="text-left px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Salon</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6b7c93]">Résilié le</th>
              </tr>
            </thead>
            <tbody>
              {churn.map(c => (
                <tr key={c.id} className="hover:bg-[#f6f9fc] transition-colors border-b border-[#f6f9fc] last:border-0">
                  <td className="px-6 py-3.5 text-[13px] font-semibold text-[#30313d]">{c.name}</td>
                  <td className="px-4 py-3.5 text-[13px] text-[#6b7c93]">
                    {new Date(c.cancelled_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
