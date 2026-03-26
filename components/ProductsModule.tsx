
import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Package, 
  AlertTriangle, 
  ArrowLeft, 
  Save, 
  Layers, 
  Sparkles,
  Barcode,
  Box,
  DollarSign,
  ChevronRight,
  Trash2,
  X
} from 'lucide-react';
import { Product, ProductCategory, ViewState } from '../types';
import { generateServiceDescription } from '../services/geminiService';
import { useAppContext } from '../context/AppContext';

// Constants
const COLOR_PALETTE = [
  { label: 'Blue', class: 'bg-blue-100 text-blue-800 border-blue-200' },
  { label: 'Green', class: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { label: 'Purple', class: 'bg-purple-100 text-purple-800 border-purple-200' },
  { label: 'Pink', class: 'bg-rose-100 text-rose-800 border-rose-200' },
  { label: 'Orange', class: 'bg-amber-100 text-amber-800 border-amber-200' },
  { label: 'Slate', class: 'bg-slate-100 text-slate-800 border-slate-200' },
];

// Export initial data for context
export const INITIAL_PRODUCT_CATEGORIES: ProductCategory[] = [
  { id: 'cat1', name: 'Shampoing', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'cat2', name: 'Soin', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'cat3', name: 'Accessoire', color: 'bg-amber-100 text-amber-800 border-amber-200' },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Shampoing Réparateur Kératine',
    description: 'Un shampoing doux enrichi en kératine pour réparer les cheveux abîmés.',
    categoryId: 'cat1',
    price: 24.90,
    cost: 12.50,
    sku: 'SHP-KER-250',
    stock: 45,
    supplier: 'L\'Oréal Pro',
    active: true
  },
  {
    id: 'p2',
    name: 'Masque Hydratant Intense',
    description: 'Masque profond pour une hydratation longue durée.',
    categoryId: 'cat2',
    price: 32.00,
    cost: 15.00,
    sku: 'MSK-HYD-500',
    stock: 8,
    supplier: 'Kérastase',
    active: true
  },
  {
    id: 'p3',
    name: 'Brosse Demelante',
    description: 'Brosse ergonomique qui ne casse pas le cheveu.',
    categoryId: 'cat3',
    price: 18.50,
    cost: 6.00,
    sku: 'ACC-BRS-01',
    stock: 0,
    supplier: 'GHD',
    active: true
  }
];

export const ProductsModule: React.FC = () => {
  const { products, productCategories, addProduct, updateProduct, updateProductCategories } = useAppContext();
  
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

  const handleSaveProduct = (product: Product) => {
    if (selectedProductId) {
      updateProduct(product);
    } else {
      addProduct(product);
    }
    setView('LIST');
  };

  return (
    <div className="h-full flex flex-col w-full relative">
      {view === 'LIST' && (
        <ProductList 
          products={products} 
          categories={productCategories}
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

const ProductList: React.FC<{ 
  products: Product[], 
  categories: ProductCategory[],
  onAdd: () => void, 
  onEdit: (id: string) => void,
  onManageCategories: () => void
}> = ({ products, categories, onAdd, onEdit, onManageCategories }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Produits</h1>
        <div className="flex gap-3">
           <button 
            onClick={onManageCategories}
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
          >
            <Layers size={16} />
            Catégories
          </button>
          <button 
            onClick={onAdd}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
          >
            <Plus size={16} />
            Nouveau Produit
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full max-h-[calc(100vh-12rem)]">
        {/* Filter Bar */}
        <div className="p-3 border-b border-slate-200 flex gap-3 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Rechercher par nom, SKU..." 
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm"
            />
          </div>
           <button className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2 font-medium text-sm shadow-sm">
            <Filter size={16} />
            Filtres
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-slate-50 shadow-sm z-10 border-b border-slate-200">
              <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-3">Produit</th>
                <th className="px-6 py-3">État du stock</th>
                <th className="px-6 py-3">Inventaire</th>
                <th className="px-6 py-3">Prix</th>
                <th className="px-6 py-3">Fournisseur</th>
                <th className="px-6 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((product) => {
                const category = categories.find(c => c.id === product.categoryId);
                let stockStatus = <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-xs font-medium">En stock</span>;
                if (product.stock === 0) stockStatus = <span className="text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded text-xs font-medium">Épuisé</span>;
                else if (product.stock < 10) stockStatus = <span className="text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded text-xs font-medium">Faible</span>;

                return (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onEdit(product.id)}>
                    <td className="px-6 py-4 align-top">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shrink-0">
                          <Package size={20} />
                        </div>
                        <div>
                           <div className="font-medium text-slate-900 text-sm">{product.name}</div>
                           {category ? (
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border mt-1 ${category.color}`}>
                              {category.name}
                            </span>
                           ) : (
                            <span className="text-xs text-slate-400 italic mt-1 block">Sans catégorie</span>
                           )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      {stockStatus}
                    </td>
                    <td className="px-6 py-4 align-top text-sm text-slate-600">
                      <div className="font-medium text-slate-900">{product.stock} unités</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">SKU: {product.sku}</div>
                    </td>
                    <td className="px-6 py-4 align-top font-medium text-slate-900 text-sm">
                      {product.price.toFixed(2)} €
                    </td>
                     <td className="px-6 py-4 align-top text-sm text-slate-500">
                      {product.supplier || '-'}
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      <button 
                        className="p-1 text-slate-300 hover:text-slate-900 transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ProductForm: React.FC<{ 
  existingProduct?: Product, 
  categories: ProductCategory[],
  onSave: (p: Product) => void,
  onCancel: () => void
}> = ({ existingProduct, categories, onSave, onCancel }) => {
  
  const [formData, setFormData] = useState<Product>(existingProduct || {
    id: '',
    name: '',
    description: '',
    categoryId: categories[0]?.id || '',
    price: 0,
    cost: 0,
    sku: '',
    barcode: '',
    stock: 0,
    supplier: '',
    active: true
  });

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const handleAiGenerate = async () => {
    if (!formData.name) return;
    setIsGeneratingAi(true);
    const catName = categories.find(c => c.id === formData.categoryId)?.name || "Produit";
    const desc = await generateServiceDescription(formData.name, catName, "vente, produit, avantages, utilisation");
    setFormData(prev => ({ ...prev, description: desc }));
    setIsGeneratingAi(false);
  };

  const calculateMargin = () => {
    if (formData.price <= 0) return 0;
    return ((formData.price - formData.cost) / formData.price) * 100;
  };

  const margin = calculateMargin();

  return (
    <div className="max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 pb-10">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">
          {existingProduct ? 'Modifier le Produit' : 'Nouveau Produit'}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Column (Left) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Title & Description */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Titre</label>
                <input 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm font-medium shadow-sm bg-white"
                  placeholder="Ex: Shampoing Volumateur"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">Description</label>
                  <button 
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={isGeneratingAi || !formData.name}
                    className="text-xs flex items-center gap-1 text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50 transition-colors"
                  >
                    <Sparkles size={12} />
                    {isGeneratingAi ? 'Rédaction...' : 'Rédiger avec IA'}
                  </button>
                </div>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  rows={5}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm resize-none bg-white"
                  placeholder="Description du produit..."
                />
              </div>
          </div>

          {/* Media (Placeholder) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <label className="block text-sm font-medium text-slate-700 mb-3">Média</label>
             <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-slate-400 hover:border-slate-400 hover:bg-slate-50 transition-all cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                   <Plus size={20} />
                </div>
                <span className="text-sm font-medium text-slate-600">Ajouter une image</span>
                <span className="text-xs mt-1">ou glisser-déposer</span>
             </div>
          </div>

          {/* Pricing */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                <DollarSign size={16} className="text-slate-400" />
                Prix
             </h3>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1.5">Prix (€)</label>
                 <input 
                    type="number"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white"
                  />
               </div>
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1.5">Coût par article (€)</label>
                 <input 
                    type="number"
                    value={formData.cost}
                    onChange={e => setFormData({...formData, cost: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white"
                  />
                 <p className="text-[10px] text-slate-400 mt-1">Visible uniquement en interne.</p>
               </div>
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1.5">Marge</label>
                 <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 flex justify-between items-center text-sm shadow-sm">
                    <span>{isNaN(margin) ? '-' : margin.toFixed(1)}%</span>
                    {margin > 50 && <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">BON</span>}
                 </div>
               </div>
             </div>
          </div>

          {/* Inventory */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Box size={16} className="text-slate-400" />
                Inventaire
             </h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1.5">SKU (Référence)</label>
                 <input 
                    value={formData.sku}
                    onChange={e => setFormData({...formData, sku: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white"
                  />
               </div>
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1.5">Code-barres (ISBN, UPC)</label>
                 <div className="relative">
                    <Barcode size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        value={formData.barcode || ''}
                        onChange={e => setFormData({...formData, barcode: e.target.value})}
                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white"
                    />
                 </div>
               </div>
             </div>

             <div className="border-t border-slate-100 pt-4">
                <div className="flex justify-between items-center mb-3">
                   <label className="block text-sm font-medium text-slate-700">Quantité</label>
                </div>
                <div className="flex items-center gap-4">
                   <input 
                      type="number"
                      value={formData.stock}
                      onChange={e => setFormData({...formData, stock: parseInt(e.target.value)})}
                      className="w-32 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent font-bold text-slate-800 text-sm shadow-sm bg-white"
                    />
                    {formData.stock <= 5 && (
                      <div className="flex items-center gap-2 text-amber-700 text-xs bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                         <AlertTriangle size={14} />
                         <span>Stock faible</span>
                      </div>
                    )}
                </div>
             </div>
          </div>
        </div>

        {/* Sidebar (Right) */}
        <div className="lg:col-span-1 space-y-6">
          
           {/* Save Actions */}
           <div className="flex flex-col gap-3 sticky top-6 z-10">
             <button 
              onClick={() => onSave(formData)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-sm transition-all flex justify-center items-center gap-2 text-sm"
            >
               <Save size={16} />
               Enregistrer
             </button>
             <button 
              onClick={onCancel}
              className="w-full py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-all text-sm"
            >
               Annuler
             </button>
           </div>

          {/* Status */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">Statut</h3>
             <div className="relative">
                <select 
                  value={formData.active ? 'active' : 'draft'}
                  onChange={e => setFormData({...formData, active: e.target.value === 'active'})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent appearance-none bg-white text-sm shadow-sm"
                >
                  <option value="active">Actif</option>
                  <option value="draft">Brouillon</option>
                </select>
                <div className={`absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${formData.active ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
             </div>
             <p className="text-xs text-slate-500 mt-2">
               {formData.active ? 'Ce produit est visible dans la caisse.' : 'Ce produit est caché.'}
             </p>
          </div>

          {/* Organization */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
             <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2 mb-2">Organisation</h3>
             
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Catégorie</label>
                <select 
                  value={formData.categoryId}
                  onChange={e => setFormData({...formData, categoryId: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white text-sm shadow-sm"
                >
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
             </div>

             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Fournisseur</label>
                <input 
                  value={formData.supplier || ''}
                  onChange={e => setFormData({...formData, supplier: e.target.value})}
                  placeholder="Ex: L'Oréal"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white"
                />
             </div>

             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tags</label>
                <input 
                  placeholder="Vintage, Bio, Été..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white"
                />
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

const CategoryManagerModal: React.FC<{
  categories: ProductCategory[],
  onClose: () => void,
  onSave: (cats: ProductCategory[]) => void
}> = ({ categories, onClose, onSave }) => {
  const [localCategories, setLocalCategories] = useState<ProductCategory[]>(categories);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(COLOR_PALETTE[0]);

  const handleAdd = () => {
    if (!newCatName.trim()) return;
    const newCat: ProductCategory = {
      id: `pcat${Date.now()}`,
      name: newCatName,
      color: newCatColor.class
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
             <div className="flex-1 space-y-2">
               <input 
                 value={newCatName}
                 onChange={e => setNewCatName(e.target.value)}
                 placeholder="Nouvelle catégorie..."
                 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white"
               />
               <div className="flex gap-2">
                 {COLOR_PALETTE.map((pal) => (
                   <button 
                    key={pal.label}
                    onClick={() => setNewCatColor(pal)}
                    className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${pal.class} ${newCatColor.label === pal.label ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
                   />
                 ))}
               </div>
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
