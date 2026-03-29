
import React, { useState } from 'react';
import { ViewState, Service, ServiceCategory } from '../../types';
import { useServices } from './hooks/useServices';
import { ServiceList } from './components/ServiceList';
import { ServiceForm } from './components/ServiceForm';
import { X, Plus, Trash2, ChevronDown } from 'lucide-react';
import { CategoryIcon, RegistryIcon, ICON_PICKER_LIST, hasIcon } from '../../lib/categoryIcons';

// --- Icon Picker Dropdown ---
const IconPicker: React.FC<{
  selectedIcon?: string;
  onSelect: (iconName: string) => void;
}> = ({ selectedIcon, onSelect }) => {
  const [open, setOpen] = useState(false);
  const hasSelected = selectedIcon && hasIcon(selectedIcon);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 p-2 border border-slate-300 rounded-lg hover:border-slate-400 bg-white transition-colors"
        title="Choisir une icône"
      >
        {hasSelected ? (
          <RegistryIcon name={selectedIcon} size={16} className="text-slate-700" />
        ) : (
          <span className="w-4 h-4 rounded bg-slate-200" />
        )}
        <ChevronDown size={12} className="text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-2 w-[260px]">
            <div className="grid grid-cols-5 gap-1">
              {ICON_PICKER_LIST.map(({ name, label }) => {
                const isActive = selectedIcon === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => { onSelect(name); setOpen(false); }}
                    className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-pink-100 text-pink-600'
                        : 'hover:bg-slate-100 text-slate-500'
                    }`}
                    title={label}
                  >
                    <RegistryIcon name={name} size={18} />
                    <span className="text-[8px] leading-tight truncate w-full text-center">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
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
  const [newCatIcon, setNewCatIcon] = useState<string | undefined>(undefined);

  const handleAdd = () => {
    if (!newCatName.trim()) return;
    const newCat: ServiceCategory = {
      id: crypto.randomUUID(),
      name: newCatName,
      color: 'bg-slate-100 text-slate-800 border-slate-200',
      icon: newCatIcon,
    };
    setLocalCategories([...localCategories, newCat]);
    setNewCatName('');
    setNewCatIcon(undefined);
  };

  const handleIconChange = (catId: string, iconName: string) => {
    setLocalCategories(prev => prev.map(c => c.id === catId ? { ...c, icon: iconName } : c));
  };

  const handleDelete = (id: string) => {
    setLocalCategories(localCategories.filter(c => c.id !== id));
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
          <div className="flex gap-2 items-start">
             <IconPicker selectedIcon={newCatIcon} onSelect={setNewCatIcon} />
             <div className="flex-1">
               <input
                 value={newCatName}
                 onChange={e => setNewCatName(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleAdd()}
                 placeholder="Nouvelle catégorie..."
                 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white"
               />
             </div>
             <button
               onClick={handleAdd}
               disabled={!newCatName.trim()}
               className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
             >
               <Plus size={20} />
             </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {localCategories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 group hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-2">
                  <IconPicker selectedIcon={cat.icon} onSelect={(icon) => handleIconChange(cat.id, icon)} />
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

export const ServicesModule: React.FC = () => {
  const { 
    services, 
    serviceCategories, 
    searchTerm, 
    setSearchTerm, 
    addService, 
    updateService, 
    updateServiceCategories 
  } = useServices();

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
    <div className="w-full">
      {view === 'LIST' && (
        <ServiceList 
          services={services} 
          categories={serviceCategories}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
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
