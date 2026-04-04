// modules/admin/components/AdminChurnLog.tsx
import React from 'react';
import { TrendingDown } from 'lucide-react';
import { useAdminChurn } from '../hooks/useAdmin';

export const AdminChurnLog: React.FC = () => {
  const { data: churn = [], isLoading } = useAdminChurn();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Résiliations</h1>
        <p className="text-sm text-slate-500 mt-1">{churn.length} résiliation(s)</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Chargement...</div>
        ) : churn.length === 0 ? (
          <div className="p-8 text-center">
            <TrendingDown className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Aucune résiliation enregistrée</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wide">
                <th className="text-left px-6 py-3">Salon</th>
                <th className="text-left px-4 py-3">Résilié le</th>
              </tr>
            </thead>
            <tbody>
              {churn.map(c => (
                <tr key={c.id} className="border-b border-slate-50">
                  <td className="px-6 py-3 font-semibold text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500">
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
