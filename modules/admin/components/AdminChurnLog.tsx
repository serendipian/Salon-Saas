// modules/admin/components/AdminChurnLog.tsx
import React from 'react';
import { TrendingDown } from 'lucide-react';
import { useAdminChurn } from '../hooks/useAdmin';

export const AdminChurnLog: React.FC = () => {
  const { data: churn = [], isLoading } = useAdminChurn();
  const count = churn.length;

  return (
    <div className="p-8" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-[#1a1f36]">Résiliations</h1>
        <p className="text-[14px] text-[#697386] mt-1">{count} résiliation{count !== 1 ? 's' : ''}</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[8px] border border-[#e3e8ef] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-[14px]" style={{ color: '#697386' }}>
            <div className="w-4 h-4 border-2 border-[#e3e8ef] border-t-[#635bff] rounded-full animate-spin" />
            Chargement...
          </div>
        ) : churn.length === 0 ? (
          <div className="p-12 text-center">
            <TrendingDown className="w-8 h-8 mx-auto mb-3" style={{ color: '#c1cfe0' }} />
            <p className="text-[14px]" style={{ color: '#697386' }}>Aucune résiliation enregistrée</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#f7fafc', borderBottom: '1px solid #e3e8ef' }}>
                  <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: '#697386' }}>Salon</th>
                  <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: '#697386' }}>Résilié le</th>
                </tr>
              </thead>
              <tbody>
                {churn.map(c => (
                  <tr
                    key={c.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid #e3e8ef' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f7fafc')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                  >
                    <td className="px-6 py-3 text-[14px] font-semibold" style={{ color: '#1a1f36' }}>{c.name}</td>
                    <td className="px-6 py-3 text-[14px]" style={{ color: '#697386' }}>
                      {new Date(c.cancelled_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
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
