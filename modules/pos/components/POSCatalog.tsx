
import React from 'react';
import { Search, Scissors, ShoppingBag, History, Plus, Receipt, Calendar, Eye, Ban, RotateCcw } from 'lucide-react';
import { Service, Product, ServiceCategory, ProductCategory, Transaction, Appointment } from '../../../types';
import { PendingAppointments } from './PendingAppointments';
import { POSViewMode } from '../hooks/usePOS';
import { formatPrice } from '../../../lib/format';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { getTransactionStatus, TransactionStatus } from '../mappers';

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
  onDetailClick: (t: Transaction) => void;
  onVoidClick?: (t: Transaction) => void;
  onRefundClick?: (t: Transaction) => void;
  allTransactions: Transaction[];
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
  onDetailClick,
  onVoidClick,
  onRefundClick,
  allTransactions,
  pendingAppointments,
  onImportAppointment,
  linkedAppointmentId,
}) => {
  const { isMobile } = useMediaQuery();

  const statusBadge = (status: TransactionStatus, trx: Transaction) => {
    if (trx.type === 'VOID') return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Annulation</span>;
    if (trx.type === 'REFUND') return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Remboursement</span>;
    if (status === 'voided') return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Annulé</span>;
    if (status === 'fully_refunded') return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Remboursé</span>;
    if (status === 'partially_refunded') return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Remb. partiel</span>;
    return null;
  };

  const isToday = (date: string) => new Date(date).toDateString() === new Date().toDateString();

  // Group transactions: SALE transactions as parents, VOID/REFUND as children
  const groupedTransactions = React.useMemo(() => {
    const childMap = new Map<string, Transaction[]>();
    const parentIds = new Set<string>();
    const parents: Transaction[] = [];

    // First pass: identify parents and collect children
    for (const trx of transactions) {
      if (trx.originalTransactionId) {
        const children = childMap.get(trx.originalTransactionId) || [];
        children.push(trx);
        childMap.set(trx.originalTransactionId, children);
      } else {
        parents.push(trx);
        parentIds.add(trx.id);
      }
    }

    // Collect orphaned children (parent SALE is outside the date window)
    const orphans: Transaction[] = [];
    childMap.forEach((children, parentId) => {
      if (!parentIds.has(parentId)) {
        orphans.push(...children);
      }
    });

    const grouped = parents.map(parent => ({
      parent,
      children: childMap.get(parent.id) || [],
    }));

    // Append orphans as standalone entries (no parent to nest under)
    orphans.forEach(orphan => grouped.push({ parent: orphan, children: [] }));

    return grouped;
  }, [transactions]);

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
                {pendingAppointments.length > 0 && (() => {
                  const groupCount = new Set(pendingAppointments.map(a => a.groupId ?? a.id)).size;
                  return (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {groupCount > 9 ? '9+' : groupCount}
                    </span>
                  );
                })()}
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
            {filteredItems.map((item) => {
               const isService = viewMode === 'SERVICES';
               const category = isService
                  ? serviceCategories.find(c => c.id === item.categoryId)
                  : productCategories.find(c => c.id === item.categoryId);

               let priceDisplay = '';
               if (isService && 'variants' in item) {
                 const prices = (item as Service).variants.map(v => v.price);
                 const min = Math.min(...prices);
                 priceDisplay = formatPrice(min);
                 if (prices.length > 1) priceDisplay += '+';
               } else if ('price' in item) {
                 priceDisplay = formatPrice((item as Product).price);
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
                     {isService && 'variants' in item && (item as Service).variants.length > 1 && (
                       <span className="text-xs text-slate-400">{(item as Service).variants.length} options</span>
                     )}
                     {!isService && 'stock' in item && (
                       <span className="text-xs text-slate-400">Stock: {(item as Product).stock}</span>
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
               /* Mobile: card layout with grouped sub-rows */
               <div className="p-3 space-y-3">
                 {groupedTransactions.map(({ parent: trx, children }) => {
                   const status = getTransactionStatus(trx, allTransactions);
                   const isVoided = status === 'voided';
                   const showVoid = onVoidClick && trx.type === 'SALE' && status === 'active' && isToday(trx.date);
                   const showRefund = onRefundClick && trx.type === 'SALE' && status !== 'voided' && status !== 'fully_refunded';
                   return (
                   <div key={trx.id}>
                   <div
                     className={`w-full text-left bg-white rounded-lg border border-slate-200 p-4 shadow-sm ${isVoided ? 'opacity-60' : ''}`}
                   >
                     <button
                       type="button"
                       onClick={() => onDetailClick(trx)}
                       className="w-full text-left focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus:outline-none"
                       aria-label={`Détails transaction ${trx.clientName || 'Client de passage'}, ${formatPrice(trx.total)}`}
                     >
                       <div className="flex justify-between items-start mb-2">
                         <div>
                           <div className={`font-semibold text-slate-900 text-sm ${isVoided ? 'line-through' : ''}`}>
                             {trx.clientName || <span className="text-slate-400 italic">Client de passage</span>}
                           </div>
                           <div className="flex items-center gap-2 mt-0.5">
                             <span className="text-xs text-slate-500">
                               {new Date(trx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </span>
                             {statusBadge(status, trx)}
                           </div>
                         </div>
                         <span className={`font-bold ${trx.total < 0 ? 'text-red-600' : 'text-slate-900'}`}>{formatPrice(trx.total)}</span>
                       </div>
                       <div className="text-xs text-slate-500 truncate">
                         {trx.items.length} article{trx.items.length > 1 ? 's' : ''} · {trx.items.map(i => i.name).join(', ')}
                       </div>
                     </button>
                     <div className="flex justify-end mt-2 pt-2 border-t border-slate-100 gap-2">
                       {showVoid && (
                         <button type="button" onClick={() => onVoidClick!(trx)} className="p-2 text-red-400 hover:text-red-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Annuler">
                           <Ban size={16} />
                         </button>
                       )}
                       {showRefund && (
                         <button type="button" onClick={() => onRefundClick!(trx)} className="p-2 text-orange-400 hover:text-orange-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Rembourser">
                           <RotateCcw size={16} />
                         </button>
                       )}
                       <button
                         type="button"
                         onClick={() => onReceiptClick(trx)}
                         className="p-2 text-slate-400 hover:text-slate-900 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                         aria-label="Ticket de caisse"
                       >
                         <Receipt size={16} />
                       </button>
                     </div>
                   </div>
                   {/* Child sub-rows (void/refund entries) */}
                   {children.map(child => (
                     <button
                       key={child.id}
                       type="button"
                       onClick={() => onDetailClick(child)}
                       className="w-full text-left ml-4 mt-1 bg-slate-50 rounded-lg border border-slate-100 px-3 py-2 flex justify-between items-center"
                     >
                       <div className="flex items-center gap-2">
                         {child.type === 'VOID' ? <Ban size={12} className="text-red-500" /> : <RotateCcw size={12} className="text-orange-500" />}
                         {statusBadge('active', child)}
                         <span className="text-xs text-slate-500">{new Date(child.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                       </div>
                       <span className="font-semibold text-sm text-red-600">{formatPrice(child.total)}</span>
                     </button>
                   ))}
                   </div>
                   );
                 })}
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
                    {groupedTransactions.map(({ parent: trx, children }) => {
                      const status = getTransactionStatus(trx, allTransactions);
                      const isVoided = status === 'voided';
                      const showVoid = onVoidClick && status === 'active' && isToday(trx.date);
                      const showRefund = onRefundClick && status !== 'voided' && status !== 'fully_refunded';
                      return (
                      <React.Fragment key={trx.id}>
                      <tr className={`hover:bg-slate-50/80 transition-colors ${isVoided ? 'opacity-60' : ''}`}>
                         <td className="px-6 py-4 font-medium text-slate-700">
                           {new Date(trx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </td>
                         <td className="px-6 py-4">
                           <div className="flex items-center gap-2">
                             {trx.clientName ? (
                               <span className={`text-slate-900 font-medium text-sm ${isVoided ? 'line-through' : ''}`}>{trx.clientName}</span>
                             ) : (
                               <span className="text-slate-400 italic text-sm">Client de passage</span>
                             )}
                             {statusBadge(status, trx)}
                           </div>
                         </td>
                         <td className="px-6 py-4">
                            <div className="text-sm text-slate-600 max-w-xs truncate">
                              {trx.items.map(i => i.name).join(', ')}
                            </div>
                         </td>
                         <td className={`px-6 py-4 text-right font-bold ${trx.total < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                           {formatPrice(trx.total)}
                         </td>
                         <td className="px-6 py-4 text-right">
                           <div className="flex items-center justify-end gap-1">
                             {showVoid && (
                               <button onClick={() => onVoidClick!(trx)} className="p-2 text-red-300 hover:text-red-600 transition-colors" title="Annuler">
                                 <Ban size={16} />
                               </button>
                             )}
                             {showRefund && (
                               <button onClick={() => onRefundClick!(trx)} className="p-2 text-orange-300 hover:text-orange-600 transition-colors" title="Rembourser">
                                 <RotateCcw size={16} />
                               </button>
                             )}
                             <button
                                onClick={() => onDetailClick(trx)}
                                className="p-2 text-slate-300 hover:text-slate-900 transition-colors"
                                title="Voir les détails"
                             >
                               <Eye size={16} />
                             </button>
                             <button
                                onClick={() => onReceiptClick(trx)}
                                className="p-2 text-slate-300 hover:text-slate-900 transition-colors"
                                title="Imprimer ticket"
                             >
                               <Receipt size={16} />
                             </button>
                           </div>
                         </td>
                      </tr>
                      {/* Child sub-rows (void/refund entries) */}
                      {children.map(child => (
                        <tr key={child.id} className="bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                          <td className="px-6 py-2 pl-10 text-xs text-slate-500">
                            {new Date(child.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </td>
                          <td className="px-6 py-2">
                            <div className="flex items-center gap-2">
                              {child.type === 'VOID' ? <Ban size={12} className="text-red-500" /> : <RotateCcw size={12} className="text-orange-500" />}
                              {statusBadge('active', child)}
                            </div>
                          </td>
                          <td className="px-6 py-2">
                            <div className="text-xs text-slate-500 max-w-xs truncate">
                              {child.items.map(i => i.name).join(', ')}
                            </div>
                          </td>
                          <td className="px-6 py-2 text-right font-semibold text-sm text-red-600">
                            {formatPrice(child.total)}
                          </td>
                          <td className="px-6 py-2 text-right">
                            <button onClick={() => onDetailClick(child)} className="p-1.5 text-slate-300 hover:text-slate-900 transition-colors" title="Voir les détails">
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      </React.Fragment>
                      );
                    })}
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
