
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ViewState, Service } from '../../types';
import { useServices } from './hooks/useServices';
import { ServiceList } from './components/ServiceList';
import { ServiceForm } from './components/ServiceForm';

export const ServicesModule: React.FC = () => {
  const {
    services,
    serviceCategories,
    isLoading,
    searchTerm,
    setSearchTerm,
    addService,
    updateService,
    deleteService,
  } = useServices();

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

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
        />
      )}
      {(view === 'ADD' || view === 'EDIT') && (
        <ServiceForm
          existingService={services.find(s => s.id === selectedServiceId)}
          categories={serviceCategories}
          onSave={handleSaveService}
          onDelete={(id) => { deleteService(id); setView('LIST'); }}
          onCancel={() => setView('LIST')}
        />
      )}
    </div>
  );
};
