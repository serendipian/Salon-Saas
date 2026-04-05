
import React, { useState } from 'react';
import { ViewState, Service } from '../../types';
import { useServices } from './hooks/useServices';
import { ServiceList } from './components/ServiceList';
import { ServiceForm } from './components/ServiceForm';

export const ServicesModule: React.FC = () => {
  const {
    services,
    serviceCategories,
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
