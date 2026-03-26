
import { useState, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { Service } from '../../../types';

export const useServices = () => {
  const { 
    services, 
    serviceCategories, 
    addService, 
    updateService, 
    updateServiceCategories 
  } = useAppContext();
  
  const [searchTerm, setSearchTerm] = useState('');

  const filteredServices = useMemo(() => {
    return services.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [services, searchTerm]);

  return {
    services: filteredServices,
    serviceCategories,
    searchTerm,
    setSearchTerm,
    addService,
    updateService,
    updateServiceCategories
  };
};
