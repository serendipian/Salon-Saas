import React, { useState } from 'react';
import { Plus, Search, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Supplier, SupplierCategory } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { useViewMode } from '../../../hooks/useViewMode';
import { useSupplierSettings } from '../hooks/useSupplierSettings';
import { ViewToggle } from '../../../components/ViewToggle';
import { SupplierTable } from './SupplierTable';
import { SupplierCard } from './SupplierCard';

interface SupplierListProps {
  suppliers: Supplier[];
  categories: SupplierCategory[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
}

export const SupplierList: React.FC<SupplierListProps> = ({
  suppliers,
  categories,
  searchTerm,
  onSearchChange,
  onAdd,
  onEdit,
}) => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { can } = usePermissions(role);
  const canEditSuppliers = can('edit', 'suppliers');
  const { supplierSettings } = useSupplierSettings();
  const { viewMode, setViewMode } = useViewMode('suppliers', supplierSettings.defaultView);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const displayedSuppliers = selectedCategoryId
    ? suppliers.filter(s => s.categoryId === selectedCategoryId)
    : suppliers;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Fournisseurs</h1>
        <div className="flex gap-3">
          {canEditSuppliers && (
            <button
              onClick={() => navigate('/suppliers/settings')}
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
              title="Paramètres des fournisseurs"
            >
              <Settings size={18} className="text-slate-600" />
            </button>
          )}
          <button
            onClick={onAdd}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
          >
            <Plus size={16} />
            Nouveau Fournisseur
          </button>
        </div>
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
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        {/* Category filter pills */}
        {categories.length > 0 && (
          <div className="px-3 py-2 border-b border-slate-200 flex gap-2 overflow-x-auto scrollbar-none bg-slate-50">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategoryId === null
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tous ({suppliers.length})
            </button>
            {categories.map(cat => {
              const count = suppliers.filter(s => s.categoryId === cat.id).length;
              if (count === 0) return null;
              const isActive = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(isActive ? null : cat.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900'
                      : `${cat.color} hover:opacity-80`
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        )}

        {viewMode === 'table' ? (
          <SupplierTable suppliers={displayedSuppliers} categories={categories} onEdit={onEdit} />
        ) : (
          <SupplierCard suppliers={displayedSuppliers} categories={categories} onEdit={onEdit} />
        )}
      </div>
    </div>
  );
};
