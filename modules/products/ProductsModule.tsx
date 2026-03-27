
import React, { useState } from 'react';
import { ViewState, ProductCategory, Product } from '../../types';
import { useProducts } from './hooks/useProducts';
import { ProductList } from './components/ProductList';
import { ProductForm } from './components/ProductForm';
import { X, Plus, Trash2 } from 'lucide-react';

const CategoryManagerModal: React.FC<{
  categories: ProductCategory[],
  onClose: () => void,
  onSave: (cats: ProductCategory[]) => void
}> = ({ categories, onClose, onSave }) => {
  const [localCategories, setLocalCategories] = useState<ProductCategory[]>(categories);
  const [newCatName, setNewCatName] = useState('');

  const handleAdd = () => {
    if (!newCatName.trim()) return;
    const newCat: ProductCategory = {
      id: `pcat${Date.now()}`,
      name: newCatName,
      color: 'bg-slate-100 text-slate-800 border-slate-200'
    };
    setLocalCategories([...localCategories, newCat]);
    setNewCatName('');
  };

  const handleDelete = (id: string) => {
    setLocalCategories(localCategories.filter(c => c.id !== id));
  };

  const handleSaveAndClose = () => {
    onSave(localCategories);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-900 text-sm">Catégories de Produits</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-5 space-y-6">
          <div className="flex gap-2 items-start">
             <div className="flex-1">
               <input 
                 value={newCatName}
                 onChange={e => setNewCatName(e.target.value)}
                 placeholder="Nouvelle catégorie..."
                 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white"
               />
             </div>
             <button 
               onClick={handleAdd}
               disabled={!newCatName.trim()}
               className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
             >
               <Plus size={20} />
             </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {localCategories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 group hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${cat.color.split(' ')[0].replace('bg-', 'bg-')}`}></div>
                  <span className="font-medium text-slate-700 text-sm">{cat.name}</span>
                </div>
                <button 
                  onClick={() => handleDelete(cat.id)}
                  className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 border border-slate-300 text-slate-700 font-medium text-sm hover:bg-white rounded-lg transition-colors shadow-sm">Annuler</button>
          <button onClick={handleSaveAndClose} className="px-3 py-1.5 bg-slate-900 text-white font-medium text-sm rounded-lg hover:bg-slate-800 shadow-sm transition-colors">Enregistrer</button>
        </div>
      </div>
    </div>
  );
};

export const ProductsModule: React.FC = () => {
  const { 
    products, 
    productCategories, 
    searchTerm, 
    setSearchTerm, 
    addProduct, 
    updateProduct, 
    updateProductCategories 
  } = useProducts();
  
  const [view, setView] = useState<ViewState>('LIST');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const handleAdd = () => {
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
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAdd={handleAdd} 
          onEdit={handleEdit}
          onManageCategories={() => setShowCategoryManager(true)}
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

      {showCategoryManager && (
        <CategoryManagerModal 
          categories={productCategories}
          onClose={() => setShowCategoryManager(false)}
          onSave={updateProductCategories}
        />
      )}
    </div>
  );
};
