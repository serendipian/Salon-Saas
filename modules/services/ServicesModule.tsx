
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ViewState, Service, Pack } from '../../types';
import { useServices } from './hooks/useServices';
import { usePacks } from './hooks/usePacks';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { ServiceList } from './components/ServiceList';
import { ServiceForm } from './components/ServiceForm';
import { PackList } from './components/PackList';
import { PackForm } from './components/PackForm';

type ServicesTab = 'SERVICES' | 'PACKS';

export const ServicesModule: React.FC = () => {
  const {
    services,
    serviceCategories,
    isLoading: servicesLoading,
    searchTerm,
    setSearchTerm,
    addService,
    updateService,
    deleteService,
    toggleFavorite,
  } = useServices();
  const {
    packs,
    isLoading: packsLoading,
    addPack,
    updatePack,
    deletePack,
    toggleActive,
    toggleFavorite: togglePackFavorite,
    isAdding,
    isUpdating,
  } = usePacks();
  const { role } = useAuth();
  const { can } = usePermissions(role);
  const canEditServices = can('edit', 'services');

  const [activeTab, setActiveTab] = useState<ServicesTab>('SERVICES');
  const [view, setView] = useState<ViewState>('LIST');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);

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

  const handleAddPack = () => {
    setSelectedPack(null);
    setView('ADD');
  };

  const handleEditPack = (pack: Pack) => {
    setSelectedPack(pack);
    setView('EDIT');
  };

  const handleSavePack = (data: { id?: string; name: string; description: string; price: number; items: Array<{ serviceId: string; serviceVariantId: string }> }) => {
    if (data.id) {
      updatePack({ id: data.id, ...data });
    } else {
      addPack(data);
    }
    setView('LIST');
  };

  if (servicesLoading || packsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  // Show form views (no tabs)
  if (view !== 'LIST') {
    if (activeTab === 'PACKS') {
      return (
        <div className="w-full">
          <PackForm
            existingPack={selectedPack ?? undefined}
            services={services}
            categories={serviceCategories}
            onSave={handleSavePack}
            onCancel={() => setView('LIST')}
            isSaving={isAdding || isUpdating}
          />
        </div>
      );
    }
    return (
      <div className="w-full">
        <ServiceForm
          existingService={services.find(s => s.id === selectedServiceId)}
          categories={serviceCategories}
          onSave={handleSaveService}
          onDelete={(id) => { deleteService(id); setView('LIST'); }}
          onCancel={() => setView('LIST')}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        <button
          onClick={() => { setActiveTab('SERVICES'); setView('LIST'); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'SERVICES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Services
        </button>
        <button
          onClick={() => { setActiveTab('PACKS'); setView('LIST'); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'PACKS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Packs
        </button>
      </div>

      {activeTab === 'SERVICES' && (
        <ServiceList
          services={services}
          categories={serviceCategories}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onToggleFavorite={canEditServices ? (type, id, isFavorite) => toggleFavorite({ type, id, isFavorite }) : undefined}
        />
      )}

      {activeTab === 'PACKS' && (
        <PackList
          packs={packs}
          onAdd={handleAddPack}
          onEdit={handleEditPack}
          onDelete={(id) => deletePack(id)}
          onToggleActive={(id, active) => toggleActive({ packId: id, active })}
          onToggleFavorite={canEditServices ? (id, isFavorite) => togglePackFavorite({ packId: id, isFavorite }) : undefined}
        />
      )}
    </div>
  );
};
