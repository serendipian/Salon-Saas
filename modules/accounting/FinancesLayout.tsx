import type React from 'react';
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { DateRangePicker } from '../../components/DateRangePicker';
import { useAccounting } from './hooks/useAccounting';

export type RevenueTab = 'SERVICES' | 'PRODUCTS';

export type FinancesOutletContext = ReturnType<typeof useAccounting> & {
  revenueTab: RevenueTab;
  setRevenueTab: React.Dispatch<React.SetStateAction<RevenueTab>>;
};

export const FinancesLayout: React.FC = () => {
  const location = useLocation();
  const accounting = useAccounting();
  const [revenueTab, setRevenueTab] = useState<RevenueTab>('SERVICES');

  const path = location.pathname;
  let pageTitle = 'Finances';
  const isRevenus = path.includes('/revenus');
  if (isRevenus) {
    pageTitle = 'Revenus';
  } else if (path.includes('/depenses')) {
    pageTitle = 'Dépenses';
  } else if (path.includes('/journal')) {
    pageTitle = 'Journal';
  } else if (path.includes('/annulations')) {
    pageTitle = 'Annulations & Remboursements';
  }

  return (
    <div className="w-full relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pt-2">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900">{pageTitle}</h1>
          {isRevenus && (
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              {[
                { id: 'SERVICES' as RevenueTab, label: 'Services' },
                { id: 'PRODUCTS' as RevenueTab, label: 'Produits' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setRevenueTab(tab.id)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    revenueTab === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker dateRange={accounting.dateRange} onChange={accounting.setDateRange} />
        </div>
      </div>
      <Outlet context={{ ...accounting, revenueTab, setRevenueTab }} />
    </div>
  );
};
