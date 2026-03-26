
import React, { useState } from 'react';
import { Client, ViewState } from '../../types';
import { useClients } from './hooks/useClients';
import { ClientList } from './components/ClientList';
import { ClientDetails } from './components/ClientDetails';
import { ClientForm } from './components/ClientForm';

export const ClientsModule: React.FC = () => {
  const { clients, addClient, updateClient } = useClients();
  const [view, setView] = useState<ViewState>('LIST');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const handleAdd = () => {
    setSelectedClientId(null);
    setView('ADD');
  };

  const handleEdit = (id: string) => {
    setSelectedClientId(id);
    setView('EDIT');
  };

  const handleViewDetails = (id: string) => {
    setSelectedClientId(id);
    setView('DETAILS');
  };

  const handleSchedule = (id: string) => {
    // Logic to open calendar or appointment modal with client pre-selected
    console.log("Schedule appointment for client:", id);
    // In a full implementation, this would navigate to /calendar?clientId=id
  };

  const handleSave = (client: Client) => {
    if (selectedClientId && view === 'EDIT') {
      updateClient(client);
      setView('DETAILS'); 
    } else {
      addClient(client);
      setView('LIST');
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="w-full">
      {view === 'LIST' && (
        <ClientList 
          clients={clients} 
          onAdd={handleAdd} 
          onViewDetails={handleViewDetails}
          onEdit={handleEdit}
          onSchedule={handleSchedule}
        />
      )}
      
      {view === 'DETAILS' && selectedClient && (
        <ClientDetails 
          client={selectedClient} 
          onBack={() => setView('LIST')}
          onEdit={() => setView('EDIT')}
        />
      )}

      {(view === 'ADD' || view === 'EDIT') && (
        <ClientForm 
          existingClient={view === 'EDIT' ? selectedClient : undefined}
          onSave={handleSave}
          onCancel={() => view === 'EDIT' ? setView('DETAILS') : setView('LIST')}
        />
      )}
    </div>
  );
};
