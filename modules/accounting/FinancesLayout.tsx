import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { DateRangePicker } from '../../components/DateRangePicker';
import { useAccounting } from './hooks/useAccounting';

export type FinancesOutletContext = ReturnType<typeof useAccounting>;

export const FinancesLayout: React.FC = () => {
  const location = useLocation();
  const accounting = useAccounting();

  const path = location.pathname;
  let pageTitle = 'Finances';
  let pageSubtitle = 'Vue d\'ensemble financière';
  if (path.includes('/revenus')) { pageTitle = 'Revenus'; pageSubtitle = 'Analyse des revenus par service et produit'; }
  else if (path.includes('/depenses')) { pageTitle = 'Dépenses'; pageSubtitle = 'Suivi des dépenses courantes et récurrentes'; }
  else if (path.includes('/journal')) { pageTitle = 'Journal'; pageSubtitle = 'Historique complet des écritures'; }
  else if (path.includes('/annulations')) { pageTitle = 'Annulations & Remboursements'; pageSubtitle = 'Suivi des annulations et remboursements'; }

  return (
    <div className="w-full relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pt-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{pageTitle}</h1>
          <p className="text-sm text-slate-500">{pageSubtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker dateRange={accounting.dateRange} onChange={accounting.setDateRange} />
        </div>
      </div>
      <Outlet context={accounting} />
    </div>
  );
};
