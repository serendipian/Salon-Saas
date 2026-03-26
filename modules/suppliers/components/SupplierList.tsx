
import React from 'react';
import { Plus, Search, Filter, Truck, Globe, Mail, Phone, ChevronRight } from 'lucide-react';
import { Supplier } from '../../../types';

interface SupplierListProps {
  suppliers: Supplier[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
}

export const SupplierList: React.FC<SupplierListProps> = ({ suppliers, searchTerm, onSearchChange, onAdd, onEdit }) => {
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
        <div className="p-3 border-b border-slate-200 flex gap-3 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Rechercher un fournisseur..." 
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm"
            />
          </div>
          <button className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2 font-medium text-sm shadow-sm">
            <Filter size={16} />
            Filtres
          </button>
        </div>

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
              {suppliers.map((supplier) => (
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
