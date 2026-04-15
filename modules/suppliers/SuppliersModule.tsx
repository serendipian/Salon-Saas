import { Loader2 } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import type { Supplier, ViewState } from '../../types';
import { SupplierForm } from './components/SupplierForm';
import { SupplierList } from './components/SupplierList';
import { useSuppliers } from './hooks/useSuppliers';

export const SuppliersModule: React.FC = () => {
  const {
    suppliers,
    supplierCategories,
    isLoading,
    searchTerm,
    setSearchTerm,
    addSupplier,
    updateSupplier,
    deleteSupplier,
  } = useSuppliers();
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
        <SupplierList
          suppliers={suppliers}
          categories={supplierCategories}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAdd={handleAdd}
          onEdit={handleEdit}
        />
      )}
      {(view === 'ADD' || view === 'EDIT') && (
        <SupplierForm
          existingSupplier={suppliers.find((s) => s.id === selectedSupplierId)}
          categories={supplierCategories}
          onSave={handleSave}
          onCancel={() => setView('LIST')}
          onDelete={
            selectedSupplierId
              ? (id) => {
                  deleteSupplier(id);
                  setView('LIST');
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
