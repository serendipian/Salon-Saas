
import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Layers,
  X,
  Filter,
  ChevronRight,
  Trash2,
  Clock,
  DollarSign,
  Sparkles,
  ArrowLeft,
  Save
} from 'lucide-react';
import { Service, ServiceCategory, ServiceVariant, ViewState } from '../types';
import { generateServiceDescription } from '../services/geminiService';
import { useAppContext } from '../context/AppContext';

// Constants for color palette (UI only)
const COLOR_PALETTE = [
  { label: 'Blue', class: 'bg-blue-100 text-blue-800 border-blue-200' },
  { label: 'Green', class: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { label: 'Purple', class: 'bg-purple-100 text-purple-800 border-purple-200' },
  { label: 'Pink', class: 'bg-rose-100 text-rose-800 border-rose-200' },
  { label: 'Orange', class: 'bg-amber-100 text-amber-800 border-amber-200' },
  { label: 'Slate', class: 'bg-slate-100 text-slate-800 border-slate-200' },
];

// Export initial data for Context initialization (Backwards compatibility if needed)
export const INITIAL_SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: 'cat1', name: 'Coiffure', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'cat2', name: 'Soins Visage', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'cat3', name: 'Manucure', color: 'bg-purple-100 text-purple-800 border-purple-200' },
];

export const INITIAL_SERVICES: Service[] = [
  {
    id: 'srv1',
    name: 'Coupe Brushing',
    categoryId: 'cat1',
    description: 'Une coupe rafraîchissante suivie d\'un brushing volumateur pour un style impeccable.',
    active: true,
    variants: [
      { id: 'v1', name: 'Cheveux Courts', durationMinutes: 30, price: 45, cost: 10 },
      { id: 'v2', name: 'Cheveux Longs', durationMinutes: 45, price: 65, cost: 15 },
    ]
  },
  {
    id: 'srv2',
    name: 'Soin Hydratant Intense',
    categoryId: 'cat2',
    description: 'Un soin profond pour redonner éclat et souplesse à votre peau.',
    active: true,
    variants: [
      { id: 'v3', name: 'Standard', durationMinutes: 60, price: 90, cost: 25 },
    ]
  }
];

export const ServicesModule: React.FC = () => {
  const { services, serviceCategories, addService, updateService, updateServiceCategories } = useAppContext();
  
  const [view, setView] = useState<ViewState>('LIST');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const handleEdit = (id: string) => {
    setSelectedServiceId(id);
    setView('EDIT');
  };

  const handleAdd = () => {
    setSelectedServiceId(null);
    setView('ADD');
  };

  const handleSaveService = (service: Service) => {
    if (selectedServiceId) {
      updateService(service);
    } else {
      addService(service);
    }
    setView('LIST');
  };

  return (
    <div className="h-full w-full">
      {view === 'LIST' && (
        <ServiceList 
          services={services} 
          categories={serviceCategories}
          onAdd={handleAdd} 
          onEdit={handleEdit}
          onManageCategories={() => setShowCategoryManager(true)}
        />
      )}
      {(view === 'ADD' || view === 'EDIT') && (
        <ServiceForm 
          existingService={services.find(s => s.id === selectedServiceId)} 
          categories={serviceCategories}
          onSave={handleSaveService}
          onCancel={() => setView('LIST')}
        />
      )}

      {showCategoryManager && (
        <CategoryManagerModal 
          categories={serviceCategories}
          onClose={() => setShowCategoryManager(false)}
          onSave={updateServiceCategories}
        />
      )}
    </div>
  );
};

const ServiceList: React.FC<{ 
  services: Service[], 
  categories: ServiceCategory[],
  onAdd: () => void, 
  onEdit: (id: string) => void,
  onManageCategories: () => void
}> = ({ services, categories, onAdd, onEdit, onManageCategories }) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Services</h1>
        <div className="flex gap-3">
           <button 
            onClick={onManageCategories}
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
          >
            <Layers size={16} />
            Catégories
          </button>
          <button 
            onClick={onAdd}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
          >
            <Plus size={16} />
            Nouveau Service
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Filter Bar */}
        <div className="p-3 border-b border-slate-200 flex gap-3 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Rechercher un service..." 
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm"
            />
          </div>
          <button className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2 font-medium text-sm shadow-sm">
            <Filter size={16} />
            Filtres
          </button>
        </div>

        {/* List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Service</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Catégorie</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Variants</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prix</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.map((service) => {
                const category = categories.find(c => c.id === service.categoryId);
                const prices = service.variants.map(v => v.price);
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);

                return (
                  <tr key={service.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onEdit(service.id)}>
                    <td className="px-6 py-4 align-top">
                      <div className="font-semibold text-slate-900 text-sm">{service.name}</div>
                      <div className="text-xs text-slate-500 mt-1 max-w-xs line-clamp-2">{service.description}</div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      {category ? (
                        <span className={`inline-flex px-2.5 py-0.5 rounded text-xs font-medium border ${category.color}`}>
                          {category.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Non classé</span>
                      )}
                    </td>
                    <td className="px-6 py-4 align-top text-sm text-slate-600">
                      {service.variants.length} variant{service.variants.length > 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-4 align-top text-sm font-medium text-slate-900">
                      {minPrice === maxPrice ? `${minPrice} €` : `${minPrice} - ${maxPrice} €`}
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      <button 
                        className="p-1 text-slate-300 hover:text-slate-900 transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- Category Manager Modal ---
const CategoryManagerModal: React.FC<{
  categories: ServiceCategory[],
  onClose: () => void,
  onSave: (cats: ServiceCategory[]) => void
}> = ({ categories, onClose, onSave }) => {
  const [localCategories, setLocalCategories] = useState<ServiceCategory[]>(categories);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(COLOR_PALETTE[0]);

  const handleAdd = () => {
    if (!newCatName.trim()) return;
    const newCat: ServiceCategory = {
      id: `cat${Date.now()}`,
      name: newCatName,
      color: newCatColor.class
    };
    setLocalCategories([...localCategories, newCat]);
    setNewCatName('');
  };

  const handleDelete = (id: string) => {
    if (confirm('Êtes-vous sûr ?')) {
      setLocalCategories(localCategories.filter(c => c.id !== id));
    }
  };

  const handleSaveAndClose = () => {
    onSave(localCategories);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-900 text-sm">Gérer les Catégories</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-5 space-y-6">
          {/* Add New */}
          <div className="flex gap-2 items-start">
             <div className="flex-1 space-y-2">
               <input 
                 value={newCatName}
                 onChange={e => setNewCatName(e.target.value)}
                 placeholder="Nouvelle catégorie..."
                 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm bg-white"
               />
               <div className="flex gap-2">
                 {COLOR_PALETTE.map((pal) => (
                   <button 
                    key={pal.label}
                    onClick={() => setNewCatColor(pal)}
                    className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${pal.class} ${newCatColor.label === pal.label ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
                   />
                 ))}
               </div>
             </div>
             <button 
               onClick={handleAdd}
               disabled={!newCatName.trim()}
               className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
             >
               <Plus size={20} />
             </button>
          </div>

          {/* List */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {localCategories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 group hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${cat.color.split(' ')[0].replace('bg-', 'bg-')}`}></div>
                  <span className="font-medium text-slate-700 text-sm">{cat.name}</span>
                </div>
                <button 
                  onClick={() => handleDelete(cat.id)}
                  className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {localCategories.length === 0 && (
              <p className="text-center text-slate-400 text-xs py-4">Aucune catégorie.</p>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 border border-slate-300 text-slate-700 font-medium text-sm hover:bg-white rounded-lg transition-colors shadow-sm">Annuler</button>
          <button onClick={handleSaveAndClose} className="px-3 py-1.5 bg-slate-900 text-white font-medium text-sm rounded-lg hover:bg-slate-800 shadow-sm transition-colors">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

// --- Form Component (Add/Edit) ---

const ServiceForm: React.FC<{ 
  existingService?: Service, 
  categories: ServiceCategory[],
  onSave: (s: Service) => void,
  onCancel: () => void
}> = ({ existingService, categories, onSave, onCancel }) => {
  
  const [formData, setFormData] = useState<Service>(existingService || {
    id: '',
    name: '',
    categoryId: categories[0]?.id || '',
    description: '',
    variants: [{ id: `var${Date.now()}`, name: 'Standard', durationMinutes: 30, price: 0, cost: 0 }],
    active: true
  });

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const handleAiGenerate = async () => {
    if (!formData.name || !formData.categoryId) return;
    setIsGeneratingAi(true);
    const catName = categories.find(c => c.id === formData.categoryId)?.name || "General";
    const desc = await generateServiceDescription(formData.name, catName, "premium, relaxant");
    setFormData(prev => ({ ...prev, description: desc }));
    setIsGeneratingAi(false);
  };

  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, { id: `var${Date.now()}`, name: '', durationMinutes: 30, price: 0, cost: 0 }]
    }));
  };

  const removeVariant = (id: string) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter(v => v.id !== id)
    }));
  };

  const updateVariant = (id: string, field: keyof ServiceVariant, value: any) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map(v => v.id === id ? { ...v, [field]: value } : v)
    }));
  };

  return (
    <div className="max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 pb-10">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">
          {existingService ? 'Modifier le Service' : 'Nouveau Service'}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* General Info Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">Informations</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom du service</label>
                <input 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white"
                  placeholder="Ex: Balayage Californien"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Catégorie</label>
                <select 
                  value={formData.categoryId}
                  onChange={e => setFormData({...formData, categoryId: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white"
                >
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <button 
                  type="button"
                  onClick={handleAiGenerate}
                  disabled={isGeneratingAi || !formData.name}
                  className="text-xs flex items-center gap-1 text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50 transition-colors"
                >
                  <Sparkles size={12} />
                  {isGeneratingAi ? 'Génération...' : 'Générer avec IA'}
                </button>
              </div>
              <textarea 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm resize-none bg-white"
                placeholder="Description marketing pour la réservation en ligne..."
              />
            </div>
          </div>

          {/* Variants Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-4">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Variants & Tarifs</h2>
                <button onClick={addVariant} className="text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded transition-colors shadow-sm">
                  + Ajouter
                </button>
             </div>

             <div className="space-y-3">
               {formData.variants.map((variant, index) => (
                 <div key={variant.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200/60 group">
                    <div className="flex-1 grid grid-cols-12 gap-3">
                      <div className="col-span-4">
                        <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1 block">Nom</label>
                        <input 
                          value={variant.name}
                          onChange={e => updateVariant(variant.id, 'name', e.target.value)}
                          placeholder="Ex: Cheveux Longs"
                          className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                        />
                      </div>
                      <div className="col-span-3">
                         <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1 block">Durée</label>
                         <div className="relative">
                           <Clock size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"/>
                           <input 
                            type="number"
                            value={variant.durationMinutes}
                            onChange={e => updateVariant(variant.id, 'durationMinutes', parseInt(e.target.value))}
                            className="w-full bg-white border border-slate-300 rounded pl-6 pr-2 py-1 text-sm focus:ring-1 focus:ring-slate-900"
                          />
                         </div>
                      </div>
                      <div className="col-span-3">
                         <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1 block">Prix</label>
                         <div className="relative">
                           <DollarSign size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"/>
                           <input 
                            type="number"
                            value={variant.price}
                            onChange={e => updateVariant(variant.id, 'price', parseFloat(e.target.value))}
                            className="w-full bg-white border border-slate-300 rounded pl-6 pr-2 py-1 text-sm font-semibold text-slate-900 focus:ring-1 focus:ring-slate-900"
                          />
                         </div>
                      </div>
                      <div className="col-span-2">
                         <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1 block">Coût</label>
                         <input 
                            type="number"
                            value={variant.cost}
                            onChange={e => updateVariant(variant.id, 'cost', parseFloat(e.target.value))}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm text-slate-500 focus:ring-1 focus:ring-slate-900"
                          />
                      </div>
                    </div>
                    {formData.variants.length > 1 && (
                      <button onClick={() => removeVariant(variant.id)} className="mt-6 text-slate-400 hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    )}
                 </div>
               ))}
             </div>
          </div>
        </div>

        {/* Sidebar Settings Column */}
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">Paramètres</h3>
              
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-slate-700 font-medium">Actif</span>
                <button 
                  onClick={() => setFormData({...formData, active: !formData.active})}
                  className={`w-10 h-5 rounded-full transition-colors relative ${formData.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                   <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${formData.active ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
           </div>

           <div className="flex flex-col gap-3 sticky top-6">
             <button 
              onClick={() => onSave(formData)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-sm transition-all flex justify-center items-center gap-2 text-sm"
            >
               <Save size={16} />
               Enregistrer
             </button>
             <button 
              onClick={onCancel}
              className="w-full py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-all text-sm"
            >
               Annuler
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};
