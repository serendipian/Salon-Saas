import { Loader2 } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import type { Service, ViewState } from '../../types';
import { ServiceForm } from './components/ServiceForm';
import { ServiceList } from './components/ServiceList';
import { useServices } from './hooks/useServices';

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
  const { role } = useAuth();
  const { can } = usePermissions(role);
  const canEditServices = can('edit', 'services');

  const [view, setView] = useState<ViewState>('LIST');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

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

  if (servicesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (view !== 'LIST') {
    return (
      <div className="w-full">
        <ServiceForm
          existingService={services.find((s) => s.id === selectedServiceId)}
          categories={serviceCategories}
          onSave={handleSaveService}
          onDelete={(id) => {
            deleteService(id);
            setView('LIST');
          }}
          onCancel={() => setView('LIST')}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      <ServiceList
        services={services}
        categories={serviceCategories}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onToggleFavorite={
          canEditServices
            ? (type, id, isFavorite) => toggleFavorite({ type, id, isFavorite })
            : undefined
        }
      />
    </div>
  );
};
