import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { DateRangePicker } from '../../components/DateRangePicker';
import type { DateRange } from '../../types';

export interface FinancesOutletContext {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
}

export const FinancesLayout: React.FC = () => {
  const location = useLocation();

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(new Date().setHours(23, 59, 59, 999)),
      label: 'Ce mois-ci',
    };
  });

  // Determine page title based on route
  const path = location.pathname;
  let pageTitle = 'Finances';
  let pageSubtitle = 'Vue d\'ensemble financière';
  if (path.includes('/revenus')) { pageTitle = 'Revenus'; pageSubtitle = 'Analyse des revenus par service et produit'; }
  else if (path.includes('/depenses')) { pageTitle = 'Dépenses'; pageSubtitle = 'Suivi des dépenses courantes et récurrentes'; }
  else if (path.includes('/journal')) { pageTitle = 'Journal'; pageSubtitle = 'Historique complet des écritures'; }

  return (
    <div className="w-full relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pt-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{pageTitle}</h1>
          <p className="text-sm text-slate-500">{pageSubtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker dateRange={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Page content */}
      <Outlet context={{ dateRange, setDateRange } satisfies FinancesOutletContext} />
    </div>
  );
};
