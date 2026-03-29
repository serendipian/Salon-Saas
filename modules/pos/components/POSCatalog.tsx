
import React from 'react';
import { Search, Scissors, ShoppingBag, History, Plus, Receipt, Calendar } from 'lucide-react';
import { Service, Product, ServiceCategory, ProductCategory, Transaction, Appointment } from '../../../types';
import { PendingAppointments } from './PendingAppointments';
import { POSViewMode } from '../hooks/usePOS';
import { formatPrice } from '../../../lib/format';
import { useMediaQuery } from '../../../context/MediaQueryContext';

interface POSCatalogProps {
  viewMode: POSViewMode;
  setViewMode: (mode: POSViewMode) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  serviceCategories: ServiceCategory[];
  productCategories: ProductCategory[];
  filteredItems: (Service | Product)[];
  transactions: Transaction[];
  onServiceClick: (s: Service) => void;
  onProductClick: (p: Product) => void;
  onReceiptClick: (t: Transaction) => void;
  pendingAppointments: Appointment[];
  onImportAppointment: (appointment: Appointment) => void;
  linkedAppointmentId: string | null;
}

export const POSCatalog: React.FC<POSCatalogProps> = ({
  viewMode, setViewMode,
  searchTerm, setSearchTerm,
  selectedCategory, setSelectedCategory,
  serviceCategories, productCategories,
  filteredItems,
  transactions,
  onServiceClick,
  onProductClick,
  onReceiptClick,
  pendingAppointments,
  onImportAppointment,
  linkedAppointmentId,
}) => {
  const { isMobile } = useMediaQuery();

  return (
    <div className={`flex-1 flex flex-col h-full ${isMobile ? '' : 'border-r border-slate-200'}`}>
      {/* Top Bar */}
      <div className="bg-white p-4 shadow-sm z-10">
        <div className="flex items-center gap-4 mb-4">
           <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={viewMode === 'HISTORY' ? "Rechercher une transaction..." : "Rechercher..."}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all text-sm placeholder:text-slate-400 shadow-sm"
              />
           </div>
           <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
              <button 
                onClick={() => { setViewMode('SERVICES'); setSelectedCategory('ALL'); }}
                className={`px-4 py-2 min-h-[44px] rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${viewMode === 'SERVICES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Scissors size={16} />
                <span className="hidden sm:inline">Services</span>
              </button>
              <button 
                onClick={() => { setViewMode('PRODUCTS'); setSelectedCategory('ALL'); }}
                className={`px-4 py-2 min-h-[44px] rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${viewMode === 'PRODUCTS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <ShoppingBag size={16} />
                <span className="hidden sm:inline">Produits</span>
              </button>
               <button 
                onClick={() => { setViewMode('HISTORY'); }}
                className={`px-4 py-2 min-h-[44px] rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${viewMode === 'HISTORY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <History size={16} />
                <span className="hidden sm:inline">Historique</span>
              </button>
              <button
                onClick={() => { setViewMode('APPOINTMENTS'); }}
                className={`px-4 py-2 min-h-[44px] rounded-lg font-medium text-sm transition-all flex items-center gap-2 relative ${viewMode === 'APPOINTMENTS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Calendar size={16} />
                <span className="hidden sm:inline">Rendez-vous</span>
                {pendingAppointments.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {pendingAppointments.length > 9 ? '9+' : pendingAppointments.length}
                  </span>
                )}
              </button>
           </div>
        </div>

        {/* Categories */}
        {viewMode !== 'HISTORY' && viewMode !== 'APPOINTMENTS' && !(isMobile && searchTerm.length > 0) && (
          <div
            className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
            style={{ scrollSnapType: 'x mandatory' }}
          >
             <button
               onClick={() => setSelectedCategory('ALL')}
               className={`px-4 ${isMobile ? 'py-2' : 'py-1.5'} rounded-lg text-xs font-medium whitespace-nowrap transition-colors border shrink-0 ${selectedCategory === 'ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
               style={{ scrollSnapAlign: 'start' }}
             >
               Tout
             </button>
             {(viewMode === 'SERVICES' ? serviceCategories : productCategories).map(cat => (
               <button
                 key={cat.id}
                 onClick={() => setSelectedCategory(cat.id)}
                 className={`px-4 ${isMobile ? 'py-2' : 'py-1.5'} rounded-lg text-xs font-medium whitespace-nowrap transition-colors border shrink-0 ${selectedCategory === cat.id ? 'bg-slate-200 text-slate-900 border-slate-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                 style={{ scrollSnapAlign: 'start' }}
               >
                 {cat.name}
               </button>
             ))}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className={`flex-1 overflow-y-auto p-6 bg-slate-50 ${isMobile ? 'pb-24' : ''}`}>
        
        {/* Grid View */}
        {(viewMode === 'SERVICES' || viewMode === 'PRODUCTS') && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map((item: any) => {
               const isService = viewMode === 'SERVICES';
               const category = isService 
                  ? serviceCategories.find(c => c.id === item.categoryId)
                  : productCategories.find(c => c.id === item.categoryId);
               
               let priceDisplay = '';
               if (isService) {
                 const prices = item.variants.map((v: any) => v.price);
                 const min = Math.min(...prices);
                 priceDisplay = formatPrice(min);
                 if (prices.length > 1) priceDisplay += '+';
               } else {
                 priceDisplay = formatPrice(item.price);
               }

               return (
                 <button 
                   key={item.id}
                   onClick={() => isService ? onServiceClick(item as Service) : onProductClick(item as Product)}
                   className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all text-left flex flex-col h-40 group relative overflow-hidden"
                 >
                   <div className={`absolute top-0 left-0 w-1 h-full ${category?.color.split(' ')[0] || 'bg-slate-200'}`} />
                   
                   <div className="flex-1">
                     <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 border bg-white text-slate-600">
                       {category?.name || 'General'}
                     </span>
                     <h3 className="font-semibold text-slate-900 leading-tight mb-1 group-hover:text-slate-700 transition-colors line-clamp-2">
                       {item.name}
                     </h3>
                     {isService && item.variants.length > 1 && (
                       <span className="text-xs text-slate-400">{item.variants.length} options</span>
                     )}
                     {!isService && (
                       <span className="text-xs text-slate-400">Stock: {item.stock}</span>
                     )}
                   </div>
                   
                   <div className="mt-auto flex justify-between items-end">
                     <span className="text-lg font-bold text-slate-800">{priceDisplay}</span>
                     <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                       <Plus size={18} />
                     </div>
                   </div>
                 </button>
               );
            })}
          </div>
        )}

        {/* History View */}
        {viewMode === 'HISTORY' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-bold text-slate-900 text-sm">Transactions du jour</h3>
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{new Date().toLocaleDateString()}</span>
             </div>

             {transactions.length === 0 ? (
               <div className="p-12 text-center text-slate-400">
                  <History size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Aucune transaction enregistrée.</p>
               </div>
             ) : isMobile ? (
               /* Mobile: card layout */
               <div className="p-3 space-y-3">
                 {transactions.map((trx) => (
                   <button
                     key={trx.id}
                     type="button"
                     onClick={() => onReceiptClick(trx)}
                     className="w-full text-left bg-white rounded-lg border border-slate-200 p-4 shadow-sm hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus:outline-none"
                     aria-label={`Transaction ${trx.clientName || 'Client de passage'}, ${formatPrice(trx.total)}`}
                   >
                     <div className="flex justify-between items-start mb-2">
                       <div>
                         <div className="font-semibold text-slate-900 text-sm">
                           {trx.clientName || <span className="text-slate-400 italic">Client de passage</span>}
                         </div>
                         <div className="text-xs text-slate-500 mt-0.5">
                           {new Date(trx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </div>
                       </div>
                       <span className="font-bold text-slate-900">{formatPrice(trx.total)}</span>
                     </div>
                     <div className="text-xs text-slate-500 truncate">
                       {trx.items.length} article{trx.items.length > 1 ? 's' : ''} · {trx.items.map(i => i.name).join(', ')}
                     </div>
                   </button>
                 ))}
               </div>
             ) : (
               /* Desktop: table layout */
               <table className="w-full text-left">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Heure</th>
                      <th className="px-6 py-4">Client</th>
                      <th className="px-6 py-4">Détails</th>
                      <th className="px-6 py-4 text-right">Total</th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((trx) => (
                      <tr key={trx.id} className="hover:bg-slate-50/80 transition-colors">
                         <td className="px-6 py-4 font-medium text-slate-700">
                           {new Date(trx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </td>
                         <td className="px-6 py-4">
                           {trx.clientName ? (
                             <span className="text-slate-900 font-medium text-sm">{trx.clientName}</span>
                           ) : (
                             <span className="text-slate-400 italic text-sm">Client de passage</span>
                           )}
                         </td>
                         <td className="px-6 py-4">
                            <div className="text-sm text-slate-600 max-w-xs truncate">
                              {trx.items.map(i => i.name).join(', ')}
                            </div>
                         </td>
                         <td className="px-6 py-4 text-right font-bold text-slate-900">
                           {formatPrice(trx.total)}
                         </td>
                         <td className="px-6 py-4 text-right">
                           <button
                              onClick={() => onReceiptClick(trx)}
                              className="p-2 text-slate-300 hover:text-slate-900 transition-colors"
                              title="Imprimer ticket"
                           >
                             <Receipt size={16} />
                           </button>
                         </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
             )}
          </div>
        )}

        {/* Appointments View */}
        {viewMode === 'APPOINTMENTS' && (
          <PendingAppointments
            appointments={pendingAppointments}
            onImport={onImportAppointment}
            linkedAppointmentId={linkedAppointmentId}
          />
        )}
      </div>
    </div>
  );
};
