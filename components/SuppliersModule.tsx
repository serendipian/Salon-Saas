
import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  ArrowLeft, 
  Save, 
  Truck,
  Globe,
  Mail,
  Phone,
  ChevronRight
} from 'lucide-react';
import { Supplier, ViewState } from '../types';
import { useAppContext } from '../context/AppContext';

// Export Mock for Context
export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: 's1',
    name: 'L\'Oréal Professionnel',
    contactName: 'Jean Dupont',
    email: 'contact@loreal-pro.com',
    phone: '01 45 67 89 10',
    website: 'www.lorealprofessionnel.fr',
    category: 'Produits Coiffure',
    paymentTerms: '30 jours fin de mois',
    active: true,
    notes: 'Fournisseur principal pour les colorations.'
  },
  {
    id: 's2',
    name: 'GHD France',
    contactName: 'Sophie Martin',
    email: 'support@ghdhair.com',
    phone: '04 78 90 12 34',
    category: 'Matériel Électrique',
    paymentTerms: 'Paiement à la commande',
    active: true,
    address: '12 Rue de la République, Lyon'
  },
  {
    id: 's3',
    name: 'Ikea Business',
    contactName: 'Service Pro',
    email: 'business.fr@ikea.com',
    phone: '09 69 36 20 06',
    category: 'Mobilier',
    active: true,
  }
];

export const SuppliersModule: React.FC = () => {
  const { suppliers, addSupplier, updateSupplier } = useAppContext();
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
    <div className="h-full w-full">
      {view === 'LIST' && (
        <SupplierList 
          suppliers={suppliers} 
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

const SupplierList: React.FC<{ 
  suppliers: Supplier[], 
  onAdd: () => void, 
  onEdit: (id: string) => void 
}> = ({ suppliers, onAdd, onEdit }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contactName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Fournisseurs</h1>
        <button 
          onClick={onAdd}
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
        >
          <Plus size={16} />
          Nouveau Fournisseur
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Filter Bar */}
        <div className="p-3 border-b border-slate-200 flex gap-3 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Rechercher un fournisseur..." 
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm"
            />
          </div>
          <button className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2 font-medium text-sm shadow-sm">
            <Filter size={16} />
            Filtres
          </button>
        </div>

        {/* List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-3">Entreprise</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Catégorie</th>
                <th className="px-6 py-3">Statut</th>
                <th className="px-6 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.map((supplier) => (
                <tr 
                  key={supplier.id} 
                  className="hover:bg-slate-50 transition-colors group cursor-pointer" 
                  onClick={() => onEdit(supplier.id)}
                >
                  <td className="px-6 py-4 align-top">
                    <div className="flex items-start gap-3">
                       <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200 shrink-0">
                          <Truck size={20} />
                       </div>
                       <div>
                          <div className="font-semibold text-slate-900 text-sm">{supplier.name}</div>
                          {supplier.website && (
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5 hover:text-brand-600">
                               <Globe size={10} />
                               {supplier.website}
                            </div>
                          )}
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="text-sm font-medium text-slate-700">{supplier.contactName}</div>
                    <div className="text-xs text-slate-500 flex flex-col gap-0.5 mt-1">
                       <span className="flex items-center gap-1"><Mail size={10}/> {supplier.email}</span>
                       <span className="flex items-center gap-1"><Phone size={10}/> {supplier.phone}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <span className="inline-flex px-2.5 py-0.5 rounded border bg-slate-50 border-slate-200 text-slate-600 text-xs font-medium">
                      {supplier.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-top">
                    {supplier.active ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                        Actif
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                        Inactif
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 align-top text-right">
                    <button className="p-1 text-slate-300 hover:text-slate-900 transition-colors">
                      <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SupplierForm: React.FC<{ 
  existingSupplier?: Supplier, 
  onSave: (s: Supplier) => void,
  onCancel: () => void
}> = ({ existingSupplier, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Supplier>(existingSupplier || {
    id: '',
    name: '',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    category: 'Produits',
    paymentTerms: '30 jours',
    active: true,
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 pb-10">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">
          {existingSupplier ? 'Modifier le Fournisseur' : 'Nouveau Fournisseur'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Main Info */}
        <div className="lg:col-span-2 space-y-6">
           
           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">Informations Entreprise</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom de l'entreprise</label>
                  <input 
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white"
                    placeholder="Ex: L'Oréal Pro"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Site Web</label>
                  <input 
                    value={formData.website}
                    onChange={e => setFormData({...formData, website: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white"
                    placeholder="www.exemple.com"
                  />
                </div>
              </div>

              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1.5">Adresse</label>
                 <textarea 
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white resize-none"
                    placeholder="Adresse postale complète..."
                 />
              </div>
           </div>

           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">Contact Principal</h2>
              
              <div className="grid grid-cols-1 gap-5">
                 <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom du contact</label>
                  <input 
                    required
                    value={formData.contactName}
                    onChange={e => setFormData({...formData, contactName: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white"
                    placeholder="Ex: Jean Dupont"
                  />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                    <div className="relative">
                       <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                       <input 
                        type="email"
                        required
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white"
                        placeholder="contact@email.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Téléphone</label>
                    <div className="relative">
                       <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                       <input 
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white"
                        placeholder="01 23 45 67 89"
                      />
                    </div>
                  </div>
                </div>
              </div>
           </div>
        </div>

        {/* Right Column: Settings & Logistics */}
        <div className="lg:col-span-1 space-y-6">
           
           <div className="flex flex-col gap-3 sticky top-6 z-10">
             <button 
              type="submit"
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-sm transition-all flex justify-center items-center gap-2 text-sm"
            >
               <Save size={16} />
               Enregistrer
             </button>
             <button 
              type="button"
              onClick={onCancel}
              className="w-full py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-all text-sm"
            >
               Annuler
             </button>
           </div>

           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">Paramètres</h3>
              
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700 font-medium">Fournisseur Actif</span>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, active: !formData.active})}
                    className={`w-10 h-5 rounded-full transition-colors relative ${formData.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                     <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${formData.active ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>

                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1.5">Catégorie</label>
                   <select 
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white text-sm shadow-sm"
                   >
                      <option>Produits Coiffure</option>
                      <option>Produits Esthétique</option>
                      <option>Matériel</option>
                      <option>Mobilier</option>
                      <option>Charges & Services</option>
                      <option>Autre</option>
                   </select>
                </div>

                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1.5">Conditions de Paiement</label>
                   <input 
                      value={formData.paymentTerms}
                      onChange={e => setFormData({...formData, paymentTerms: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white"
                      placeholder="Ex: 30 jours"
                   />
                </div>
              </div>
           </div>

           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3">Notes Internes</h3>
              <textarea 
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm shadow-sm bg-white resize-none"
                placeholder="Notes sur le fournisseur..."
              />
           </div>

        </div>
      </form>
    </div>
  );
};
