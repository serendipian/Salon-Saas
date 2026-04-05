
import React from 'react';
import { Plus, Search, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Service, ServiceCategory } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { useViewMode } from '../../../hooks/useViewMode';
import { useServiceSettings } from '../hooks/useServiceSettings';
import { ViewToggle } from '../../../components/ViewToggle';
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
        {/* Filter Bar */}
        <div className="p-3 border-b border-slate-200 flex gap-3 bg-white">
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

        {/* Content */}
        {viewMode === 'table' ? (
          <ServiceTable
            services={services}
            categories={categories}
            onEdit={onEdit}
          />
        ) : (
          <ServiceCard
            services={services}
            categories={categories}
            onEdit={onEdit}
          />
        )}
      </div>
    </div>
  );
};
