import { Loader2 } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useToast } from '../../context/ToastContext';
import type { Product, ViewState } from '../../types';
import { useBilling } from '../billing/hooks/useBilling';
import { ProductForm } from './components/ProductForm';
import { ProductList } from './components/ProductList';
import { useProducts } from './hooks/useProducts';

export const ProductsModule: React.FC = () => {
  const {
    products,
    allProducts,
    productCategories,
    brands,
    isLoading,
    searchTerm,
    setSearchTerm,
    addProduct,
    updateProduct,
    deleteProduct,
  } = useProducts();
  const { canAddProduct } = useBilling();
  const { addToast } = useToast();

  const [view, setView] = useState<ViewState>('LIST');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!canAddProduct(allProducts.length)) {
      addToast({
        type: 'warning',
        message:
          'Limite de produits atteinte pour votre forfait. Passez au forfait supérieur pour en ajouter davantage.',
      });
      return;
    }
    setSelectedProductId(null);
    setView('ADD');
  };

  const handleEdit = (id: string) => {
    setSelectedProductId(id);
    setView('EDIT');
  };

  const handleSaveProduct = (product: Product, supplierId?: string | null) => {
    if (selectedProductId) {
      updateProduct(product, supplierId);
    } else {
      addProduct(product, supplierId);
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
    <div className="w-full relative">
      {view === 'LIST' && (
        <ProductList
          products={products}
          categories={productCategories}
          brands={brands}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAdd={handleAdd}
          onEdit={handleEdit}
        />
      )}
      {(view === 'ADD' || view === 'EDIT') && (
        <ProductForm
          existingProduct={products.find((p) => p.id === selectedProductId)}
          categories={productCategories}
          onSave={handleSaveProduct}
          onCancel={() => setView('LIST')}
          onDelete={
            view === 'EDIT' && selectedProductId
              ? () => setPendingDeleteId(selectedProductId)
              : undefined
          }
        />
      )}
      <ConfirmModal
        isOpen={pendingDeleteId !== null}
        title="Supprimer ce produit"
        message="Cette action est irréversible."
        confirmLabel="Supprimer"
        tone="danger"
        onConfirm={() => {
          if (pendingDeleteId) {
            deleteProduct(pendingDeleteId);
            setPendingDeleteId(null);
            setView('LIST');
          }
        }}
        onClose={() => setPendingDeleteId(null)}
      />
    </div>
  );
};
