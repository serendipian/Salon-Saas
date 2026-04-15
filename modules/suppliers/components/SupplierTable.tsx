import React from 'react';
import { Truck, Globe, Mail, Phone, ChevronRight } from 'lucide-react';
import { Supplier, SupplierCategory } from '../../../types';
import { EmptyState } from '../../../components/EmptyState';

interface SupplierTableProps {
  suppliers: Supplier[];
  categories?: SupplierCategory[];
  onEdit: (id: string) => void;
}

export const SupplierTable: React.FC<SupplierTableProps> = ({
  suppliers,
  categories = [],
  onEdit,
}) => {
  if (suppliers.length === 0) {
    return (
      <EmptyState
        icon={<Truck size={24} />}
        title="Aucun bénéficiaire trouvé"
        description="Essayez de modifier vos critères de recherche."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold">
            <th className="px-6 py-3">Entreprise</th>
            <th className="px-6 py-3 hidden md:table-cell">Contact</th>
            <th className="px-6 py-3 hidden lg:table-cell">Catégorie</th>
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
              <td className="px-6 py-4 align-top hidden md:table-cell">
                <div className="text-sm font-medium text-slate-700">{supplier.contactName}</div>
                <div className="text-xs text-slate-500 flex flex-col gap-0.5 mt-1">
                  <span className="flex items-center gap-1">
                    <Mail size={10} /> {supplier.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone size={10} /> {supplier.phone}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 align-top hidden lg:table-cell">
                {(() => {
                  const cat = categories.find((c) => c.id === supplier.categoryId);
                  return cat ? (
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded border text-xs font-medium ${cat.color}`}
                    >
                      {cat.name}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  );
                })()}
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
  );
};
