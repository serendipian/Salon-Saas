
import React, { useState } from 'react';
import { Plus, Search, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Service, ServiceCategory } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { useViewMode } from '../../../hooks/useViewMode';
import { useServiceSettings } from '../hooks/useServiceSettings';
import { ViewToggle } from '../../../components/ViewToggle';
import { CategoryIcon } from '../../../lib/categoryIcons';
import { ServiceTable } from './ServiceTable';
import { ServiceCard } from './ServiceCard';

interface ServiceListProps {
  services: Service[];
  categories: ServiceCategory[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
}

export const ServiceList: React.FC<ServiceListProps> = ({
  services,
  categories,
  searchTerm,
  onSearchChange,
  onAdd,
  onEdit,
}) => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { can } = usePermissions(role);
  const canEditServices = can('edit', 'services');
  const { serviceSettings } = useServiceSettings();
  const { viewMode, setViewMode } = useViewMode('services', serviceSettings.defaultView);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const displayedServices = selectedCategoryId
    ? services.filter(s => s.categoryId === selectedCategoryId)
    : services;

  const groupByCategory = selectedCategoryId === null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-bold text-slate-900">Services</h1>
        <div className="flex gap-3">
          {canEditServices && (
            <button
              onClick={() => navigate('/services/settings')}
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
              title="Paramètres des services"
            >
              <Settings size={18} className="text-slate-600" />
            </button>
          )}
          <button
            onClick={onAdd}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm shadow-sm transition-all"
          >
            <Plus size={16} />
            Nouveau Service
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Search + View toggle */}
        <div className="p-3 border-b border-slate-100 flex gap-3 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher un service..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-all shadow-sm"
            />
          </div>
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        {/* Category filter pills */}
        <div className="px-3 py-2 border-b border-slate-200 flex gap-2 overflow-x-auto scrollbar-none bg-slate-50">
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategoryId === null
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tous ({services.length})
          </button>
          {categories.map(cat => {
            const count = services.filter(s => s.categoryId === cat.id).length;
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
                <CategoryIcon categoryName={cat.name} iconName={cat.icon} size={11} />
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Content */}
        {viewMode === 'table' ? (
          <ServiceTable
            services={displayedServices}
            categories={categories}
            onEdit={onEdit}
            groupByCategory={groupByCategory}
          />
        ) : (
          <ServiceCard
            services={displayedServices}
            categories={categories}
            onEdit={onEdit}
            groupByCategory={groupByCategory}
          />
        )}
      </div>
    </div>
  );
};
