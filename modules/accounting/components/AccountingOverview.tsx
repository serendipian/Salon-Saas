
import React, { useState, useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight, ShoppingBag, Receipt } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { Transaction, Expense } from '../../../types';
import { useAppContext } from '../../../context/AppContext';

// --- Internal Components ---

const MetricCard = ({ title, value, trend, isPositive, subtitle }: any) => {
  const { formatPrice } = useAppContext();
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col justify-between">
      <div>
        <div className="text-sm font-medium text-slate-500 mb-1 flex justify-between items-center">
          {title}
          {trend !== null && (
             <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5 ${isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
               {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
               {Math.abs(trend).toFixed(1)}%
             </span>
          )}
        </div>
        <div className="text-2xl font-bold text-slate-900 tracking-tight mt-2">
          {typeof value === 'number' ? formatPrice(value) : value}
        </div>
      </div>
      {subtitle && <div className="text-xs text-slate-400 mt-2">{subtitle}</div>}
    </div>
  );
};

const SmartListCard = ({ title, data, renderItem }: { title: string, data: any[], renderItem: (item: any) => React.ReactNode }) => {
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
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col h-[24rem]">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30 rounded-t-xl shrink-0">
        <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
        <div className="flex bg-slate-100 p-0.5 rounded-lg">
           <button onClick={() => setSortMode('RECENT')} className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${sortMode === 'RECENT' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Récents</button>
           <button onClick={() => setSortMode('LARGEST')} className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${sortMode === 'LARGEST' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Plus Gros</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {displayData.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {displayData.map((item, idx) => (
              <div key={idx} className="p-3 hover:bg-slate-50 transition-colors">
                {renderItem(item)}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs">Aucune donnée</div>
        )}
      </div>
      <div className="p-3 border-t border-slate-100 text-center rounded-b-xl shrink-0">
        <button className="text-xs font-medium text-slate-500 hover:text-brand-600 transition-colors flex items-center justify-center gap-1 w-full">
          Voir tout <ArrowUpRight size={10} />
        </button>
      </div>
    </div>
  );
};

// --- Main Component ---

interface AccountingOverviewProps {
  financials: any;
  chartData: any[];
  filteredTransactions: Transaction[];
  filteredExpenses: Expense[];
}

export const AccountingOverview: React.FC<AccountingOverviewProps> = ({ 
  financials, 
  chartData, 
  filteredTransactions, 
  filteredExpenses 
}) => {
  const { formatPrice } = useAppContext();

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         <MetricCard 
           title="Ventes Brutes" 
           value={financials.revenue} 
           trend={financials.revenueTrend} 
           isPositive={financials.revenueTrend >= 0} 
         />
         <MetricCard 
           title="Bénéfice Net" 
           value={financials.netProfit} 
           trend={financials.netProfitTrend} 
           isPositive={financials.netProfitTrend >= 0} 
           subtitle={`${financials.revenue ? ((financials.netProfit / financials.revenue) * 100).toFixed(1) : 0}% de marge`} 
         />
         <MetricCard 
           title="Dépenses" 
           value={financials.opex} 
           trend={financials.opexTrend} 
           isPositive={financials.opexTrend <= 0} // Lower expenses is positive
         />
         <MetricCard 
           title="Panier Moyen" 
           value={financials.avgBasket} 
           trend={financials.avgBasketTrend} 
           isPositive={financials.avgBasketTrend >= 0} 
           subtitle={`${financials.transactionCount} transactions`} 
         />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
         <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
           <h3 className="text-sm font-semibold text-slate-800 mb-4">Évolution des Ventes</h3>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} dy={10} minTickGap={30} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} tickFormatter={(v) => `${v}`} />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)'}} 
                    cursor={{fill: '#f8fafc'}} 
                    formatter={(value: number) => formatPrice(value)}
                  />
                  <Bar dataKey="sales" fill="#0f172a" radius={[4, 4, 0, 0]} barSize={30} animationDuration={800} />
                </BarChart>
             </ResponsiveContainer>
           </div>
         </div>

         <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
           <h3 className="text-sm font-semibold text-slate-800 mb-4">Flux de Trésorerie</h3>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" hide />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: '1px solid #e2e8f0'}} 
                    formatter={(value: number) => formatPrice(value)}
                  />
                  <Line type="monotone" dataKey="sales" stroke="#0f172a" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Legend />
                </LineChart>
             </ResponsiveContainer>
           </div>
         </div>
      </div>

      {/* Smart Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <SmartListCard 
           title="Dernières Transactions" 
           data={filteredTransactions} 
           renderItem={(trx: Transaction) => (
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-500"><ShoppingBag size={14} /></div>
                   <div>
                     <div className="text-sm font-medium text-slate-800">{trx.clientName}</div>
                     <div className="text-[10px] text-slate-400">{new Date(trx.date).toLocaleDateString()}</div>
                   </div>
                </div>
                <div className="text-sm font-semibold text-slate-800">+{formatPrice(trx.total)}</div>
             </div>
           )}
         />

         <SmartListCard 
           title="Dernières Dépenses" 
           data={filteredExpenses} 
           renderItem={(exp: Expense) => (
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded bg-red-50 flex items-center justify-center text-red-500"><Receipt size={14} /></div>
                   <div>
                     <div className="text-sm font-medium text-slate-800">{exp.description}</div>
                     <div className="text-[10px] text-slate-400">{exp.supplier}</div>
                   </div>
                </div>
                <div className="text-sm font-semibold text-slate-800">-{formatPrice(exp.amount)}</div>
             </div>
           )}
         />
      </div>
      
      {/* Extra Performance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
           <h3 className="text-xs font-bold text-slate-400 uppercase mb-4">Top Services</h3>
           <ul className="space-y-3">
             {financials.topServices.map(([name, count]: any, i: number) => (
               <li key={name} className="flex justify-between items-center text-sm">
                 <span className="text-slate-700 truncate pr-2">{i+1}. {name}</span>
                 <span className="font-medium text-slate-900">{count}</span>
               </li>
             ))}
           </ul>
         </div>
         <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
           <h3 className="text-xs font-bold text-slate-400 uppercase mb-4">Meilleur Vendeur</h3>
           <div className="flex items-center gap-3 mt-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">MD</div>
              <div>
                <div className="font-bold text-slate-800">Marie Dupont</div>
                <div className="text-xs text-slate-500">Manager</div>
              </div>
           </div>
           <div className="mt-4 pt-4 border-t border-slate-50 text-xs text-slate-500">Génère 65% du C.A.</div>
         </div>
         <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
           <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">TVA Estimée</h3>
           <div className="text-3xl font-bold text-slate-900 mb-1">{formatPrice(financials.vatDue)}</div>
           <div className="text-xs text-slate-500">À provisionner</div>
         </div>
         <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
           <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Cashflow</h3>
           <div className={`text-3xl font-bold ${financials.netProfit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
             {financials.netProfit > 0 ? '+' : ''}{formatPrice(financials.netProfit)}
           </div>
           <div className="text-xs text-slate-500">Solde de la période</div>
         </div>
      </div>
    </div>
  );
};
