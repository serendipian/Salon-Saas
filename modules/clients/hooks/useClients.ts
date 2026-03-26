
import { useState, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';

export const useClients = () => {
  const { clients, addClient, updateClient, deleteClient } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');

  // Filtering logic
  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      c.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
    );
  }, [clients, searchTerm]);

  return {
    clients: filteredClients,
    searchTerm,
    setSearchTerm,
    addClient,
    updateClient,
    deleteClient
  };
};
