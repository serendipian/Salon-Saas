
import React, { useState, useMemo, useEffect } from 'react';
import { 
  PieChart, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  FileText,
  Receipt,
  Briefcase,
  Home,
  Zap,
  Megaphone,
  ShoppingBag,
  AlertCircle,
  ShoppingCart,
  X,
  Save,
  Calendar,
  DollarSign,
  Tag,
  ChevronRight,
  Trash2,
  Filter,
  Search
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { Expense, ExpenseCategory, Transaction, LedgerEntry } from '../types';
import { useAppContext } from '../context/AppContext';

const CATEGORY_CONFIG: Record<ExpenseCategory, { label: string, icon: any, color: string }> = {
  'LOYER': { label: 'Loyer', icon: Home, color: 'bg-purple-100 text-purple-700' },
  'SALAIRE': { label: 'Salaires', icon: Briefcase, color: 'bg-blue-100 text-blue-700' },
  'STOCK': { label: 'Stock', icon: ShoppingBag, color: 'bg-amber-100 text-amber-700' },
  'MARKETING': { label: 'Marketing', icon: Megaphone, color: 'bg-pink-100 text-pink-700' },
  'IMPOTS': { label: 'Taxes', icon: FileText, color: 'bg-slate-100 text-slate-700' },
  'UTILITAIRES': { label: 'Charges', icon: Zap, color: 'bg-yellow-100 text-yellow-700' },
  'AUTRE': { label: 'Divers', icon: AlertCircle, color: 'bg-gray-100 text-gray-700' },
};

type DateRange = 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR';

// --- UI Components ---

const MetricCard = ({ title, value, trend, isPositive, prefix = '', subtitle }: any) => (
  <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col justify-between">
    <div>
      <div className="text-sm font-medium text-slate-500 mb-1 flex justify-between items-center">
        {title}
        {trend && (
           <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5 ${isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
             {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
             {trend}
           </span>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900 tracking-tight mt-2">
        {prefix}{typeof value === 'number' ? value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}
      </div>
    </div>
    {subtitle && <div className="text-xs text-slate-400 mt-2">{subtitle}</div>}
  </div>
);

const SmartListCard = ({ 
  title, 
  data, 
  renderItem 
}: { 
  title: string, 
  data: any[], 
  renderItem: (item: any) => React.ReactNode 
}) => {
  const [sortMode, setSortMode] = useState<'RECENT' | 'LARGEST'>('RECENT');

  const sortedData = useMemo(() => {
    const d = [...data];
    if (sortMode === 'RECENT') {
      return d.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      return d.sort((a, b) => (b.amount || b.total || 0) - (a.amount || a.total || 0));
    }
  }, [data, sortMode]);

  const displayData = sortedData.slice(0, 5);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
        <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
        <div className="flex bg-slate-100 p-0.5 rounded-lg">
           <button 
             onClick={() => setSortMode('RECENT')}
             className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${sortMode === 'RECENT' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
             Récents
           </button>
           <button 
             onClick={() => setSortMode('LARGEST')}
             className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${sortMode === 'LARGEST' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
             Plus Gros
           </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {displayData.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {displayData.map((item, idx) => (
              <div key={idx} className="p-3 hover:bg-slate-50 transition-colors">
                {renderItem(item)}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-slate-400 text-xs">
            Aucune donnée
          </div>
        )}
      </div>
      <div className="p-3 border-t border-slate-100 text-center">
        <button className="text-xs font-medium text-slate-500 hover:text-brand-600 transition-colors flex items-center justify-center gap-1 w-full">
          Voir tout <ArrowUpRight size={10} />
        </button>
      </div>
    </div>
  );
};

// --- Main Module ---

export const AccountingModule: React.FC = () => {
  const { transactions, expenses, addExpense } = useAppContext();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LEDGER' | 'EXPENSES'>('OVERVIEW');
  const [dateRange, setDateRange] = useState<DateRange>('MONTH');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  
  // --- Logic ---
  const { filteredTransactions, filteredExpenses } = useMemo(() => {
    const now = new Date();
    let startDate = new Date();
    
    switch (dateRange) {
      case 'TODAY': startDate.setHours(0,0,0,0); break;
      case 'WEEK': startDate.setDate(now.getDate() - 7); break;
      case 'MONTH': startDate.setDate(1); break; 
      case 'YEAR': startDate.setMonth(0, 1); break;
    }

    return {
      filteredTransactions: transactions.filter(t => new Date(t.date) >= startDate),
      filteredExpenses: expenses.filter(e => new Date(e.date) >= startDate)
    };
  }, [transactions, expenses, dateRange]);

  const financials = useMemo(() => {
    const revenue = filteredTransactions.reduce((sum, t) => sum + t.total, 0);
    const cogs = filteredTransactions.reduce((sum, t) => sum + t.items.reduce((isum, item) => isum + (item.cost || 0), 0), 0);
    const opex = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const grossMargin = revenue - cogs;
    const netProfit = grossMargin - opex;
    const vatDue = (revenue * 0.2) - (opex * 0.1); 
    const avgBasket = filteredTransactions.length > 0 ? revenue / filteredTransactions.length : 0;

    // Top Services logic
    const serviceSales: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      t.items.forEach(i => {
        if(i.type === 'SERVICE') serviceSales[i.name] = (serviceSales[i.name] || 0) + 1;
      });
    });
    const topServices = Object.entries(serviceSales).sort((a,b) => b[1] - a[1]).slice(0, 3);

    return { revenue, opex, netProfit, vatDue, avgBasket, transactionCount: filteredTransactions.length, topServices };
  }, [filteredTransactions, filteredExpenses]);

  // Ledger Data Construction
  const ledgerData: LedgerEntry[] = useMemo(() => {
    const entries: LedgerEntry[] = [];
    
    // Add Income
    filteredTransactions.forEach(t => {
      entries.push({
        id: t.id,
        date: t.date,
        type: 'INCOME',
        label: `Vente - ${t.clientName || 'Passage'}`,
        category: 'VENTE',
        amount: t.total,
        details: t
      });
    });

    // Add Expenses
    filteredExpenses.forEach(e => {
      entries.push({
        id: e.id,
        date: e.date,
        type: 'EXPENSE',
        label: e.description,
        category: e.category,
        amount: e.amount,
        details: e
      });
    });

    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredTransactions, filteredExpenses]);

  // Chart Data
  const chartData = useMemo(() => {
    const map = new Map<string, any>();
    filteredTransactions.forEach(t => {
      const d = new Date(t.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      if(!map.has(d)) map.set(d, { name: d, sales: 0, expenses: 0 });
      map.get(d).sales += t.total;
    });
    filteredExpenses.forEach(e => {
      const d = new Date(e.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      if(!map.has(d)) map.set(d, { name: d, sales: 0, expenses: 0 });
      map.get(d).expenses += e.amount;
    });
    return Array.from(map.values()).slice(-14); 
  }, [filteredTransactions, filteredExpenses]);

  const handleAddExpense = (newExpense: Expense) => {
    addExpense(newExpense);
    setShowExpenseModal(false);
  };

  return (
    <div className="h-full flex flex-col w-full relative pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pt-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Comptabilité</h1>
          <p className="text-sm text-slate-500">Vue d'ensemble financière</p>
        </div>
        
        <div className="flex items-center gap-2">
           <div className="flex bg-white border border-slate-200 rounded-md shadow-sm">
             {(['TODAY', 'WEEK', 'MONTH', 'YEAR'] as DateRange[]).map(range => (
               <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-xs font-medium transition-all first:rounded-l-md last:rounded-r-md ${dateRange === range ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50 border-l border-transparent'}`}
               >
                 {range === 'TODAY' ? 'Auj.' : range === 'WEEK' ? '7J' : range === 'MONTH' ? 'Mois' : 'Année'}
               </button>
             ))}
           </div>
           <button 
              onClick={() => setShowExpenseModal(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
            >
             <Plus size={16} />
             Nouvelle Dépense
           </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
         {[
            { id: 'OVERVIEW', label: "Vue d'ensemble", icon: PieChart },
            { id: 'LEDGER', label: "Grand Livre", icon: FileText },
            { id: 'EXPENSES', label: "Dépenses", icon: Receipt }
         ].map(tab => (
           <button 
             key={tab.id}
             onClick={() => setActiveTab(tab.id as any)}
             className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
           >
             <tab.icon size={16} />
             {tab.label}
           </button>
         ))}
      </div>

      {/* --- OVERVIEW DASHBOARD --- */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* ROW 1: Primary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <MetricCard 
               title="Ventes Brutes" 
               value={financials.revenue} 
               prefix="€" 
               trend="12%" 
               isPositive={true}
             />
             <MetricCard 
               title="Bénéfice Net" 
               value={financials.netProfit} 
               prefix="€" 
               trend="8%" 
               isPositive={financials.netProfit > 0}
               subtitle={`${((financials.netProfit / financials.revenue) * 100).toFixed(1)}% de marge`}
             />
             <MetricCard 
               title="Dépenses" 
               value={financials.opex} 
               prefix="€" 
               trend="2%" 
               isPositive={false} 
             />
             <MetricCard 
               title="Panier Moyen" 
               value={financials.avgBasket} 
               prefix="€" 
               trend="0.5%" 
               isPositive={true} 
               subtitle={`${financials.transactionCount} transactions`}
             />
          </div>

          {/* ROW 2: Main Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
             <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
               <h3 className="text-sm font-semibold text-slate-800 mb-4">Évolution des Ventes</h3>
               <div className="h-64">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} tickFormatter={(v) => `${v}€`} />
                      <Tooltip 
                        contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)'}}
                        cursor={{fill: '#f8fafc'}} 
                      />
                      <Bar dataKey="sales" fill="#0f172a" radius={[2, 2, 0, 0]} barSize={30} />
                    </BarChart>
                 </ResponsiveContainer>
               </div>
             </div>

             <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
               <h3 className="text-sm font-semibold text-slate-800 mb-4">Flux de Trésorerie</h3>
               <div className="h-64">
                 <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" hide />
                      <YAxis hide />
                      <Tooltip contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}} />
                      <Line type="monotone" dataKey="sales" stroke="#0f172a" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={false} />
                      <Legend />
                    </LineChart>
                 </ResponsiveContainer>
               </div>
             </div>
          </div>

          {/* ROW 3: Smart Lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-80">
             <SmartListCard 
               title="Dernières Transactions" 
               data={filteredTransactions} 
               renderItem={(trx: Transaction) => (
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-500">
                         <ShoppingBag size={14} />
                       </div>
                       <div>
                         <div className="text-sm font-medium text-slate-800">{trx.clientName}</div>
                         <div className="text-[10px] text-slate-400">{new Date(trx.date).toLocaleDateString()}</div>
                       </div>
                    </div>
                    <div className="text-sm font-semibold text-slate-800">+{trx.total.toFixed(2)} €</div>
                 </div>
               )}
             />

             <SmartListCard 
               title="Dernières Dépenses" 
               data={filteredExpenses} 
               renderItem={(exp: Expense) => (
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded bg-red-50 flex items-center justify-center text-red-500">
                         <Receipt size={14} />
                       </div>
                       <div>
                         <div className="text-sm font-medium text-slate-800">{exp.description}</div>
                         <div className="text-[10px] text-slate-400">{exp.supplier}</div>
                       </div>
                    </div>
                    <div className="text-sm font-semibold text-slate-800">-{exp.amount.toFixed(2)} €</div>
                 </div>
               )}
             />
          </div>
          
          {/* ROW 4: Performance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             {/* Top Services */}
             <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
               <h3 className="text-xs font-bold text-slate-400 uppercase mb-4">Top Services</h3>
               <ul className="space-y-3">
                 {financials.topServices.map(([name, count], i) => (
                   <li key={name} className="flex justify-between items-center text-sm">
                     <span className="text-slate-700 truncate pr-2">{i+1}. {name}</span>
                     <span className="font-medium text-slate-900">{count}</span>
                   </li>
                 ))}
               </ul>
             </div>
             {/* Top Staff */}
             <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
               <h3 className="text-xs font-bold text-slate-400 uppercase mb-4">Meilleur Vendeur</h3>
               <div className="flex items-center gap-3 mt-2">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">MD</div>
                  <div>
                    <div className="font-bold text-slate-800">Marie Dupont</div>
                    <div className="text-xs text-slate-500">Manager</div>
                  </div>
               </div>
               <div className="mt-4 pt-4 border-t border-slate-50 text-xs text-slate-500">
                 Génère 65% du C.A. cette semaine.
               </div>
             </div>
             {/* Tax Estimation */}
             <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
               <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">TVA Estimée</h3>
               <div className="text-3xl font-bold text-slate-900 mb-1">{financials.vatDue.toFixed(2)}€</div>
               <div className="text-xs text-slate-500">À provisionner pour ce mois</div>
             </div>
             {/* Cashflow */}
             <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
               <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Cashflow</h3>
               <div className={`text-3xl font-bold ${financials.netProfit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                 {financials.netProfit > 0 ? '+' : ''}{financials.netProfit.toFixed(2)}€
               </div>
               <div className="text-xs text-slate-500">Solde de la période</div>
             </div>
          </div>
        </div>
      )}

      {/* --- LEDGER VIEW --- */}
      {activeTab === 'LEDGER' && (
         <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
               <h3 className="font-bold text-slate-900 text-sm">Grand Livre Journalier</h3>
               <div className="flex gap-2">
                  <button className="p-2 bg-white border border-slate-300 rounded-lg text-slate-600 hover:text-slate-900 transition-colors">
                    <Filter size={16} />
                  </button>
                  <button className="p-2 bg-white border border-slate-300 rounded-lg text-slate-600 hover:text-slate-900 transition-colors">
                    <Search size={16} />
                  </button>
               </div>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
                     <tr>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Libellé</th>
                        <th className="px-6 py-4">Catégorie</th>
                        <th className="px-6 py-4 text-right">Débit (-)</th>
                        <th className="px-6 py-4 text-right">Crédit (+)</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {ledgerData.map((entry, idx) => (
                        <tr key={`${entry.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors text-sm">
                           <td className="px-6 py-4 text-slate-500">
                             {new Date(entry.date).toLocaleDateString()}
                             <span className="text-xs text-slate-400 ml-2">{new Date(entry.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                           </td>
                           <td className="px-6 py-4">
                              {entry.type === 'INCOME' ? (
                                 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-bold">
                                    <ArrowUpRight size={10} /> Recette
                                 </span>
                              ) : (
                                 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-100 text-xs font-bold">
                                    <ArrowDownRight size={10} /> Dépense
                                 </span>
                              )}
                           </td>
                           <td className="px-6 py-4 font-medium text-slate-700">{entry.label}</td>
                           <td className="px-6 py-4">
                              <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">
                                {entry.category}
                              </span>
                           </td>
                           <td className="px-6 py-4 text-right font-mono text-slate-600">
                              {entry.type === 'EXPENSE' ? entry.amount.toFixed(2) : '-'}
                           </td>
                           <td className="px-6 py-4 text-right font-mono text-emerald-700 font-bold">
                              {entry.type === 'INCOME' ? entry.amount.toFixed(2) : '-'}
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
      )}

      {/* --- EXPENSES VIEW --- */}
      {activeTab === 'EXPENSES' && (
         <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
                     <tr>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Description</th>
                        <th className="px-6 py-4">Fournisseur</th>
                        <th className="px-6 py-4">Catégorie</th>
                        <th className="px-6 py-4 text-right">Montant</th>
                        <th className="px-6 py-4 text-right"></th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {filteredExpenses.map((exp) => {
                        const catConfig = CATEGORY_CONFIG[exp.category] || CATEGORY_CONFIG['AUTRE'];
                        const Icon = catConfig.icon;
                        return (
                           <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors text-sm group">
                              <td className="px-6 py-4 text-slate-500 font-medium">{new Date(exp.date).toLocaleDateString()}</td>
                              <td className="px-6 py-4 font-bold text-slate-800">{exp.description}</td>
                              <td className="px-6 py-4 text-slate-600">{exp.supplier || '-'}</td>
                              <td className="px-6 py-4">
                                 <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border border-white/20 shadow-sm ${catConfig.color}`}>
                                    <Icon size={12} /> {catConfig.label}
                                 </span>
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-slate-900">
                                 {exp.amount.toFixed(2)} €
                              </td>
                              <td className="px-6 py-4 text-right">
                                 <button className="p-2 text-slate-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100">
                                    <Trash2 size={16} />
                                 </button>
                              </td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
            </div>
         </div>
      )}

      {/* Expense Form Modal */}
      {showExpenseModal && (
         <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
               <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-slate-900">Ajouter une dépense</h3>
                  <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
               </div>
               <div className="p-6 space-y-4">
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                     <input id="exp-desc" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none bg-white" placeholder="Ex: Facture EDF" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Montant</label>
                        <div className="relative">
                           <input id="exp-amount" type="number" className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none bg-white font-bold" placeholder="0.00" />
                           <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                        </div>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                        <input id="exp-date" type="date" defaultValue={new Date().toISOString().slice(0,10)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none bg-white" />
                     </div>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Catégorie</label>
                     <select id="exp-cat" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none bg-white">
                        {Object.entries(CATEGORY_CONFIG).map(([key, conf]) => (
                           <option key={key} value={key}>{conf.label}</option>
                        ))}
                     </select>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fournisseur (Optionnel)</label>
                     <input id="exp-supplier" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none bg-white" placeholder="Nom du fournisseur" />
                  </div>
               </div>
               <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                  <button onClick={() => setShowExpenseModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium">Annuler</button>
                  <button 
                    onClick={() => {
                       const desc = (document.getElementById('exp-desc') as HTMLInputElement).value;
                       const amount = parseFloat((document.getElementById('exp-amount') as HTMLInputElement).value);
                       const date = (document.getElementById('exp-date') as HTMLInputElement).value;
                       const cat = (document.getElementById('exp-cat') as HTMLSelectElement).value as ExpenseCategory;
                       const supplier = (document.getElementById('exp-supplier') as HTMLInputElement).value;

                       if(desc && amount) {
                          handleAddExpense({
                             id: `exp-${Date.now()}`,
                             description: desc,
                             amount,
                             date,
                             category: cat,
                             supplier
                          });
                       }
                    }}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 shadow-sm"
                  >
                     Enregistrer
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};
