
import React from 'react';
import { Search, Scissors, ShoppingBag, Plus, Calendar, Star, Package } from 'lucide-react';
import { Service, Product, ServiceCategory, ProductCategory, Appointment, FavoriteItem, Pack } from '../../../types';
import { getPackDiscount } from '../../services/utils/packExpansion';
import { PendingAppointments } from './PendingAppointments';
import { POSViewMode } from '../hooks/usePOS';
import { formatPrice } from '../../../lib/format';
import { useMediaQuery } from '../../../context/MediaQueryContext';
import { CategoryIcon } from '../../../lib/categoryIcons';

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
  packs: Pack[];
  onPackClick: (pack: Pack) => void;
}

// Map category color class strings to their accent dot color (bg-{color}-400)
// Must use full class names so Tailwind can detect them at build time
const ACCENT_COLOR_MAP: Record<string, string> = {
  'bg-slate-100 text-slate-800 border-slate-200': 'bg-slate-400',
  'bg-pink-100 text-pink-800 border-pink-200': 'bg-pink-400',
  'bg-rose-100 text-rose-800 border-rose-200': 'bg-rose-400',
  'bg-red-100 text-red-800 border-red-200': 'bg-red-400',
  'bg-orange-100 text-orange-800 border-orange-200': 'bg-orange-400',
  'bg-amber-100 text-amber-800 border-amber-200': 'bg-amber-400',
  'bg-yellow-100 text-yellow-800 border-yellow-200': 'bg-yellow-400',
  'bg-lime-100 text-lime-800 border-lime-200': 'bg-lime-400',
  'bg-green-100 text-green-800 border-green-200': 'bg-green-400',
  'bg-emerald-100 text-emerald-800 border-emerald-200': 'bg-emerald-400',
  'bg-teal-100 text-teal-800 border-teal-200': 'bg-teal-400',
  'bg-cyan-100 text-cyan-800 border-cyan-200': 'bg-cyan-400',
  'bg-sky-100 text-sky-800 border-sky-200': 'bg-sky-400',
  'bg-blue-100 text-blue-800 border-blue-200': 'bg-blue-400',
  'bg-indigo-100 text-indigo-800 border-indigo-200': 'bg-indigo-400',
  'bg-violet-100 text-violet-800 border-violet-200': 'bg-violet-400',
  'bg-purple-100 text-purple-800 border-purple-200': 'bg-purple-400',
  'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200': 'bg-fuchsia-400',
};

const getAccentColor = (colorClasses?: string): string => {
  if (!colorClasses) return 'bg-slate-400';
  return ACCENT_COLOR_MAP[colorClasses] ?? 'bg-slate-400';
};

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
  packs,
  onPackClick,
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
                 className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                   selectedCategory === 'FAVORITES'
                     ? 'bg-amber-400 text-slate-900'
                     : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                 }`}
                 style={{ scrollSnapAlign: 'start' }}
               >
                 <Star size={14} className={selectedCategory === 'FAVORITES' ? 'fill-white text-white' : ''} />
                 Favoris
               </button>
             )}
             {viewMode === 'SERVICES' && packs.length > 0 && (
               <button
                 onClick={() => setSelectedCategory('PACKS')}
                 className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0 bg-slate-900 text-white border border-slate-900"
                 style={{ scrollSnapAlign: 'start' }}
               >
                 <Package size={14} />
                 Packs
               </button>
             )}
             <button
               onClick={() => setSelectedCategory('ALL')}
               className={`flex items-center px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border shrink-0 overflow-hidden relative ${selectedCategory === 'ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
               style={{ scrollSnapAlign: 'start' }}
             >
               <div className="absolute left-0 top-0 w-1 h-full bg-slate-900" />
               Tout
             </button>
             {(viewMode === 'SERVICES' ? serviceCategories : productCategories).map(cat => (
               <button
                 key={cat.id}
                 onClick={() => setSelectedCategory(cat.id)}
                 className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border shrink-0 overflow-hidden relative ${selectedCategory === cat.id ? 'bg-slate-200 text-slate-900 border-slate-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                 style={{ scrollSnapAlign: 'start' }}
               >
                 <div className={`absolute left-0 top-0 w-1 h-full ${getAccentColor(cat.color)}`} />
                 {viewMode === 'SERVICES' && <CategoryIcon categoryName={cat.name} iconName={(cat as ServiceCategory).icon} size={14} />}
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
              if (fav.type === 'pack') {
                const pack = fav.pack;
                const discount = getPackDiscount(pack);
                return (
                  <button
                    key={`fav-pack-${pack.id}`}
                    onClick={() => onPackClick(pack)}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all text-left flex flex-col h-40 group relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400" />
                    <div className="flex-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 border bg-emerald-100 text-emerald-800 border-emerald-200">
                        <Package size={10} />
                        Pack
                      </span>
                      <h3 className="font-semibold text-slate-900 leading-tight mb-1 group-hover:text-slate-700 transition-colors line-clamp-2">
                        {pack.name}
                      </h3>
                      <span className="text-xs text-slate-400">
                        {pack.items.length} service{pack.items.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="mt-auto flex justify-between items-end">
                      <div>
                        <span className="text-lg font-bold text-slate-800">{formatPrice(pack.price)}</span>
                        {discount > 0 && (
                          <span className="ml-1.5 text-xs text-emerald-600 font-medium">-{discount}%</span>
                        )}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                        <Plus size={18} />
                      </div>
                    </div>
                  </button>
                );
              }
              if (fav.type === 'variant') {
                const category = serviceCategories.find(c => c.id === fav.parentService.categoryId);
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
                    <div className={`absolute top-0 left-0 w-1 h-full ${getAccentColor(category?.color)}`} />
                    <div className="flex-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 border ${category?.color || 'bg-white text-slate-600'}`}>
                        <CategoryIcon categoryName={category?.name || ''} iconName={category?.icon} size={10} />
                        {category?.name || 'General'}
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
                  <div className={`absolute top-0 left-0 w-1 h-full ${getAccentColor(category?.color)}`} />
                  <div className="flex-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 border ${category?.color || 'bg-white text-slate-600'}`}>
                      <CategoryIcon categoryName={category?.name || ''} iconName={category?.icon} size={10} />
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
            {/* Packs view */}
            {selectedCategory === 'PACKS' && packs.map((pack) => {
              const discount = getPackDiscount(pack);
              return (
                <button
                  key={`pack-${pack.id}`}
                  onClick={() => onPackClick(pack)}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all text-left flex flex-col h-40 group relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400" />
                  <div className="flex-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 border bg-emerald-100 text-emerald-800 border-emerald-200">
                      <Package size={10} />
                      Pack
                    </span>
                    <h3 className="font-semibold text-slate-900 leading-tight mb-1 group-hover:text-slate-700 transition-colors line-clamp-2">
                      {pack.name}
                    </h3>
                    <span className="text-xs text-slate-400">
                      {pack.items.length} service{pack.items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="mt-auto flex justify-between items-end">
                    <div>
                      <span className="text-lg font-bold text-slate-800">{formatPrice(pack.price)}</span>
                      {discount > 0 && (
                        <span className="ml-1.5 text-xs text-emerald-600 font-medium">-{discount}%</span>
                      )}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                      <Plus size={18} />
                    </div>
                  </div>
                </button>
              );
            })}
            {selectedCategory !== 'FAVORITES' && selectedCategory !== 'PACKS' && filteredItems.map((item) => {
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
                   <div className={`absolute top-0 left-0 w-1 h-full ${getAccentColor(category?.color)}`} />

                   <div className="flex-1">
                     <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 border ${category?.color || 'bg-white text-slate-600'}`}>
                       {isService && <CategoryIcon categoryName={category?.name || ''} iconName={(category as ServiceCategory)?.icon} size={10} />}
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
