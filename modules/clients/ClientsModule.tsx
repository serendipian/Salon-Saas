
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Client, ViewState } from '../../types';
import { useClients } from './hooks/useClients';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { ClientList } from './components/ClientList';
import { ClientDetails } from './components/ClientDetails';
import { ClientForm } from './components/ClientForm';

export const ClientsModule: React.FC = () => {
  const { clients, isLoading, addClient, updateClient, deleteClient } = useClients();
  const navigate = useNavigate();
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

  const handleSchedule = (id: string) => {
    navigate(`/calendar/new?clientId=${id}`);
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

  const handleSave = async (client: Client) => {
    try {
      if (selectedClientId && view === 'EDIT') {
        await updateClient(client);
        setView('DETAILS');
      } else {
        await addClient(client);
        setView('LIST');
      }
    } catch {
      // Error toast handled by mutation's onError — stay on form
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

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
