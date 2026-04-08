
import React, { useState } from 'react';
import { Client, ViewState } from '../../types';
import { useClients } from './hooks/useClients';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { ClientList } from './components/ClientList';
import { ClientDetails } from './components/ClientDetails';
import { ClientForm } from './components/ClientForm';

export const ClientsModule: React.FC = () => {
  const { clients, addClient, updateClient, deleteClient } = useClients();
  const { role } = useAuth();
  const permissions = usePermissions(role);
  const canDelete = permissions.can('delete', 'clients');
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

  const handleSchedule = (_id: string) => {
    // TODO: Navigate to /calendar?clientId=id to pre-select this client
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce client ? Cette action est irréversible.')) {
      try {
        await deleteClient(id);
        setView('LIST');
      } catch {
        // Error toast handled by mutation's onError
      }
    }
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
          onDelete={canDelete ? handleDelete : undefined}
        />
      )}
      
      {view === 'DETAILS' && selectedClient && (
        <ClientDetails
          client={selectedClient}
          onBack={() => setView('LIST')}
          onEdit={() => setView('EDIT')}
          onDelete={canDelete ? () => handleDelete(selectedClient.id) : undefined}
        />
      )}

      {(view === 'ADD' || view === 'EDIT') && (
        <ClientForm
          existingClient={view === 'EDIT' ? selectedClient : undefined}
          onSave={handleSave}
          onCancel={() => view === 'EDIT' ? setView('DETAILS') : setView('LIST')}
          onDelete={view === 'EDIT' && selectedClient && canDelete ? () => handleDelete(selectedClient.id) : undefined}
        />
      )}
    </div>
  );
};
