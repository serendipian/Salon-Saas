import React from 'react';
import { Truck, Globe, Mail, Phone } from 'lucide-react';
import { Supplier } from '../../../types';
import { EmptyState } from '../../../components/EmptyState';

interface SupplierCardProps {
  suppliers: Supplier[];
  onEdit: (id: string) => void;
}

export const SupplierCard: React.FC<SupplierCardProps> = ({ suppliers, onEdit }) => {
  if (suppliers.length === 0) {
    return (
      <EmptyState
        icon={<Truck size={24} />}
        title="Aucun fournisseur trouvé"
        description="Essayez de modifier vos critères de recherche."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
      {suppliers.map((supplier) => (
        <button
          key={supplier.id}
          type="button"
          onClick={() => onEdit(supplier.id)}
          aria-label={`Voir le fournisseur ${supplier.name}`}
          className="bg-white rounded-xl border border-slate-200 p-4 text-left transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
        >
          {/* Header: icon + name + status */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200 shrink-0">
              <Truck size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-900 text-sm truncate">
                {supplier.name}
              </div>
              <div className="mt-0.5">
                {supplier.active ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                    Actif
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                    Inactif
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Contact info */}
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <span className="font-medium">{supplier.contactName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Mail size={14} className="shrink-0" />
              <span className="truncate">{supplier.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Phone size={14} className="shrink-0" />
              <span className="truncate">{supplier.phone}</span>
            </div>
            {supplier.website && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Globe size={14} className="shrink-0" />
                <span className="truncate">{supplier.website}</span>
              </div>
            )}
          </div>

          {/* Category badge */}
          <div className="pt-3 border-t border-slate-100">
            <span className="inline-flex px-2.5 py-0.5 rounded border bg-slate-50 border-slate-200 text-slate-600 text-xs font-medium">
              {supplier.category}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
};
