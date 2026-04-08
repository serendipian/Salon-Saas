
import React, { useState } from 'react';
import { ViewState, Product } from '../../types';
import { useProducts } from './hooks/useProducts';
import { useBilling } from '../billing/hooks/useBilling';
import { useToast } from '../../context/ToastContext';
import { ProductList } from './components/ProductList';
import { ProductForm } from './components/ProductForm';

export const ProductsModule: React.FC = () => {
  const {
    products,
    productCategories,
    brands,
    searchTerm,
    setSearchTerm,
    addProduct,
    updateProduct,
  } = useProducts();
  const { canAddProduct } = useBilling();
  const { addToast } = useToast();

  const [view, setView] = useState<ViewState>('LIST');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!canAddProduct(products.length)) {
      addToast({ type: 'warning', message: 'Limite de produits atteinte pour votre forfait. Passez au forfait supérieur pour en ajouter davantage.' });
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
          existingProduct={products.find(p => p.id === selectedProductId)}
          categories={productCategories}
          onSave={handleSaveProduct}
          onCancel={() => setView('LIST')}
        />
      )}
    </div>
  );
};
