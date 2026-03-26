
import { useState, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';

export const useSuppliers = () => {
  const { suppliers, addSupplier, updateSupplier } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.contactName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [suppliers, searchTerm]);

  return {
    suppliers: filteredSuppliers,
    searchTerm,
    setSearchTerm,
    addSupplier,
    updateSupplier
  };
};
