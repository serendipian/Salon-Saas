import { Loader2 } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import type { Client, ViewState } from '../../types';
import { ClientDetails } from './components/ClientDetails';
import { ClientForm } from './components/ClientForm';
import { ClientList } from './components/ClientList';
import { useClients } from './hooks/useClients';

export const ClientsModule: React.FC = () => {
  const { clients, isLoading, addClient, updateClient, deleteClient } = useClients();
  const navigate = useNavigate();
  const { role } = useAuth();
  const permissions = usePermissions(role);
  const canDelete = permissions.can('delete', 'clients');
  const [view, setView] = useState<ViewState>('LIST');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  // M-27: in-app confirmation modal instead of window.confirm
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    void navigate(`/calendar/new?clientId=${id}`);
  };

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    setIsDeleting(true);
    try {
      await deleteClient(pendingDeleteId);
      setPendingDeleteId(null);
      setView('LIST');
    } catch {
      // Error toast handled by mutation's onError — keep the modal open so
      // the user can retry or cancel.
    } finally {
      setIsDeleting(false);
    }
  };

  const pendingDeleteClient = pendingDeleteId
    ? clients.find((c) => c.id === pendingDeleteId)
    : null;

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

  const selectedClient = clients.find((c) => c.id === selectedClientId);

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
          onCancel={() => (view === 'EDIT' ? setView('DETAILS') : setView('LIST'))}
          onDelete={
            view === 'EDIT' && selectedClient && canDelete
              ? () => handleDelete(selectedClient.id)
              : undefined
          }
        />
      )}

      <ConfirmModal
        isOpen={pendingDeleteId !== null}
        title="Supprimer ce client"
        tone="danger"
        confirmLabel="Supprimer"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!isDeleting) setPendingDeleteId(null);
        }}
        message={
          pendingDeleteClient ? (
            <>
              Cette action est irréversible.{' '}
              <strong>
                {pendingDeleteClient.firstName} {pendingDeleteClient.lastName}
              </strong>{' '}
              et tout son historique seront définitivement supprimés.
            </>
          ) : (
            'Cette action est irréversible.'
          )
        }
      />
    </div>
  );
};
