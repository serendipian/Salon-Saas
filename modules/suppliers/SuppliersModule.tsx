
import React, { useState } from 'react';
import { Supplier, ViewState } from '../../types';
import { useSuppliers } from './hooks/useSuppliers';
import { SupplierList } from './components/SupplierList';
import { SupplierForm } from './components/SupplierForm';

export const SuppliersModule: React.FC = () => {
  const { suppliers, searchTerm, setSearchTerm, addSupplier, updateSupplier } = useSuppliers();
  const [view, setView] = useState<ViewState>('LIST');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  const handleAdd = () => {
    setSelectedSupplierId(null);
    setView('ADD');
  };

  const handleEdit = (id: string) => {
    setSelectedSupplierId(id);
    setView('EDIT');
  };

  const handleSave = (supplier: Supplier) => {
    if (selectedSupplierId) {
      updateSupplier(supplier);
    } else {
      addSupplier(supplier);
    }
    setView('LIST');
  };

  return (
    <div className="w-full">
      {view === 'LIST' && (
        <SupplierList 
          suppliers={suppliers} 
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAdd={handleAdd} 
          onEdit={handleEdit} 
        />
      )}
      {(view === 'ADD' || view === 'EDIT') && (
        <SupplierForm 
          existingSupplier={suppliers.find(s => s.id === selectedSupplierId)} 
          onSave={handleSave}
          onCancel={() => setView('LIST')}
        />
      )}
    </div>
  );
};
