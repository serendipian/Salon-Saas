// modules/admin/components/AdminChurnLog.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingDown } from 'lucide-react';
import { useAdminChurn } from '../hooks/useAdmin';
import { ADMIN_FONT } from '../constants';
import { AdminLoadingState, AdminErrorState, AdminTableFooter } from './AdminShared';

export const AdminChurnLog: React.FC = () => {
  const { data: churn = [], isLoading, isError } = useAdminChurn();
  const navigate = useNavigate();
  const count = churn.length;

  return (
    <div className="p-8" style={ADMIN_FONT}>
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-[#1a1f36]">Résiliations</h1>
        <p className="text-[14px] text-[#697386] mt-1">
          {count} résiliation{count !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="bg-white rounded-[8px] border border-[#e3e8ef] overflow-hidden">
        {isLoading ? (
          <AdminLoadingState />
        ) : isError ? (
          <AdminErrorState />
        ) : churn.length === 0 ? (
          <div className="p-12 text-center">
            <TrendingDown className="w-8 h-8 mx-auto mb-3" style={{ color: '#c1cfe0' }} />
            <p className="text-[14px]" style={{ color: '#697386' }}>
              Aucune résiliation enregistrée
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
                    Résilié le
                  </th>
                </tr>
              </thead>
              <tbody>
                {churn.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/admin/accounts/${c.id}`)}
                    className="cursor-pointer hover:bg-[#f7fafc] transition-colors"
                    style={{ borderBottom: '1px solid #e3e8ef' }}
                  >
                    <td
                      className="px-6 py-3 text-[14px] font-semibold"
                      style={{ color: '#1a1f36' }}
                    >
                      {c.name}
                    </td>
                    <td className="px-6 py-3 text-[14px]" style={{ color: '#697386' }}>
                      {new Date(c.cancelled_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <AdminTableFooter count={count} />
          </>
        )}
      </div>
    </div>
  );
};
