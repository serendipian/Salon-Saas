
import React from 'react';
import { Search, Scissors, ShoppingBag, Plus, Calendar, Star } from 'lucide-react';
import { Service, Product, ServiceCategory, ProductCategory, Appointment, FavoriteItem } from '../../../types';
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
  onServiceClick: (s: Service) => void;
  onProductClick: (p: Product) => void;
  pendingAppointments: Appointment[];
  onImportAppointment: (appointment: Appointment) => void;
  linkedAppointmentId: string | null;
  favorites: FavoriteItem[];
  onAddToCart: (item: import('../../../types').CartItem) => void;
}

export const POSCatalog: React.FC<POSCatalogProps> = ({
  viewMode, setViewMode,
  searchTerm, setSearchTerm,
  selectedCategory, setSelectedCategory,
  serviceCategories, productCategories,
  filteredItems,
  onServiceClick,
  onProductClick,
  pendingAppointments,
  onImportAppointment,
  linkedAppointmentId,
  favorites,
  onAddToCart,
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
                placeholder="Rechercher..."
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
        {viewMode !== 'APPOINTMENTS' && !(isMobile && searchTerm.length > 0) && (
          <div
            className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
            style={{ scrollSnapType: 'x mandatory' }}
          >
             {viewMode === 'SERVICES' && favorites.length > 0 && (
               <button
                 onClick={() => setSelectedCategory('FAVORITES')}
                 className={`flex items-center gap-1.5 px-4 ${isMobile ? 'py-2' : 'py-1.5'} rounded-lg text-xs font-medium whitespace-nowrap transition-colors border shrink-0 ${
                   selectedCategory === 'FAVORITES'
                     ? 'bg-amber-500 text-white border-amber-500'
                     : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                 }`}
                 style={{ scrollSnapAlign: 'start' }}
               >
                 <Star size={12} className={selectedCategory === 'FAVORITES' ? 'fill-white' : ''} />
                 Favoris
               </button>
             )}
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
            {/* Favorites view: render all favorites in unified sort order */}
            {selectedCategory === 'FAVORITES' && favorites.map(fav => {
              if (fav.type === 'variant') {
                return (
                  <button
                    key={`fav-var-${fav.variant.id}`}
                    onClick={() => {
                      onAddToCart({
                        id: crypto.randomUUID(),
                        referenceId: fav.variant.id,
                        type: 'SERVICE',
                        name: fav.parentService.name,
                        variantName: fav.variant.name,
                        price: fav.variant.price,
                        originalPrice: fav.variant.price,
                        quantity: 1,
                      });
                    }}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all text-left flex flex-col h-40 group relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-400" />
                    <div className="flex-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 border bg-amber-50 text-amber-600 border-amber-200">
                        <Star size={9} className="fill-amber-400 text-amber-400" /> Favori
                      </span>
                      <h3 className="font-semibold text-slate-900 leading-tight mb-1 group-hover:text-slate-700 transition-colors line-clamp-2">
                        {fav.parentService.name}
                      </h3>
                      <span className="text-xs text-slate-500">{fav.variant.name}</span>
                    </div>
                    <div className="mt-auto flex justify-between items-end">
                      <span className="text-lg font-bold text-slate-800">{formatPrice(fav.variant.price)}</span>
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                        <Plus size={18} />
                      </div>
                    </div>
                  </button>
                );
              }
              // Service-type favorite — render as regular service card
              const service = fav.service;
              const category = serviceCategories.find(c => c.id === service.categoryId);
              const prices = service.variants.map(v => v.price);
              const min = Math.min(...prices);
              let priceDisplay = formatPrice(min);
              if (prices.length > 1) priceDisplay += '+';
              return (
                <button
                  key={`fav-svc-${service.id}`}
                  onClick={() => onServiceClick(service)}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all text-left flex flex-col h-40 group relative overflow-hidden"
                >
                  <div className={`absolute top-0 left-0 w-1 h-full ${category?.color.split(' ')[0] || 'bg-slate-200'}`} />
                  <div className="flex-1">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 border bg-white text-slate-600">
                      {category?.name || 'General'}
                    </span>
                    <h3 className="font-semibold text-slate-900 leading-tight mb-1 group-hover:text-slate-700 transition-colors line-clamp-2">
                      {service.name}
                    </h3>
                    {service.variants.length > 1 && (
                      <span className="text-xs text-slate-400">{service.variants.length} options</span>
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
            {selectedCategory !== 'FAVORITES' && filteredItems.map((item) => {
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
