import { Plus } from 'lucide-react';
import type React from 'react';
import { useCallback, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { DateRangePicker } from '../../components/DateRangePicker';
import { useAccounting } from './hooks/useAccounting';

export type RevenueTab = 'SERVICES' | 'PRODUCTS';
export type ExpenseTab = 'COURANTES' | 'RECURRENTES';

export type FinancesOutletContext = ReturnType<typeof useAccounting> & {
  revenueTab: RevenueTab;
  setRevenueTab: React.Dispatch<React.SetStateAction<RevenueTab>>;
  expenseTab: ExpenseTab;
  setExpenseTab: React.Dispatch<React.SetStateAction<ExpenseTab>>;
  /** Pages can register a handler so the layout can render their primary action in the header. */
  registerNewExpenseHandler: (handler: (() => void) | null) => void;
};

export const FinancesLayout: React.FC = () => {
  const location = useLocation();
  const accounting = useAccounting();
  const [revenueTab, setRevenueTab] = useState<RevenueTab>('SERVICES');
  const [expenseTab, setExpenseTab] = useState<ExpenseTab>('COURANTES');
  const [newExpenseHandler, setNewExpenseHandler] =
    useState<(() => void) | null>(null);

  const registerNewExpenseHandler = useCallback((handler: (() => void) | null) => {
    // Wrap in a function so useState doesn't execute it as an updater
    setNewExpenseHandler(() => handler);
  }, []);

  const path = location.pathname;
  let pageTitle = 'Finances';
  const isRevenus = path.includes('/revenus');
  const isDepenses = path.includes('/depenses');
  if (isRevenus) {
    pageTitle = 'Revenus';
  } else if (isDepenses) {
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
            <div className="inline-flex gap-1 bg-slate-100/80 p-1 rounded-xl ring-1 ring-slate-200/60">
              {[
                { id: 'SERVICES' as RevenueTab, label: 'Services' },
                { id: 'PRODUCTS' as RevenueTab, label: 'Produits' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setRevenueTab(tab.id)}
                  className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    revenueTab === tab.id
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          {isDepenses && (
            <div className="inline-flex gap-1 bg-slate-100/80 p-1 rounded-xl ring-1 ring-slate-200/60">
              {[
                { id: 'COURANTES' as ExpenseTab, label: 'Courantes' },
                { id: 'RECURRENTES' as ExpenseTab, label: 'Récurrentes' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setExpenseTab(tab.id)}
                  className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    expenseTab === tab.id
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker dateRange={accounting.dateRange} onChange={accounting.setDateRange} />
          {isDepenses && expenseTab === 'COURANTES' && newExpenseHandler && (
            <button
              onClick={newExpenseHandler}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-sm"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Nouvelle Dépense</span>
            </button>
          )}
        </div>
      </div>
      <Outlet
        context={{
          ...accounting,
          revenueTab,
          setRevenueTab,
          expenseTab,
          setExpenseTab,
          registerNewExpenseHandler,
        }}
      />
    </div>
  );
};
