import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Save, Search } from 'lucide-react';
import { IconPicker } from './IconPicker';
import { ColorPicker } from './ColorPicker';
import { useServices } from '../hooks/useServices';
import type { ServiceCategory, Service } from '../../../types';

export function CategoriesTab() {
  const { allServices, serviceCategories, updateServiceCategories } = useServices();

  const [localCategories, setLocalCategories] = useState<ServiceCategory[]>(serviceCategories);
  const [localAssignments, setLocalAssignments] = useState<Record<string, string | null>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    setSearchTerm('');
  };

  useEffect(() => {
    setLocalCategories(serviceCategories);
    setLocalAssignments({});
  }, [serviceCategories]);

  // Build effective categoryId map: start from current service data, overlay local assignments
  const getEffectiveCategoryId = (service: Service): string | null => {
    if (service.id in localAssignments) return localAssignments[service.id];
    return service.categoryId || null;
  };

  const servicesForCategory = (categoryId: string) =>
    allServices.filter((s) => getEffectiveCategoryId(s) === categoryId);

  const unassignedServices = allServices.filter((s) => getEffectiveCategoryId(s) === null);

  const filteredServices = (services: Service[]) => {
    if (!searchTerm) return services;
    const term = searchTerm.toLowerCase();
    return services.filter((s) => s.name.toLowerCase().includes(term));
  };

  const handleAddCategory = () => {
    const newCat: ServiceCategory = {
      id: crypto.randomUUID(),
      name: '',
      color: 'bg-slate-100 text-slate-800 border-slate-200',
      icon: undefined,
    };
    setLocalCategories([...localCategories, newCat]);
    setExpandedId(newCat.id);
  };

  const handleDeleteCategory = (id: string) => {
    // Unassign all services from this category
    const affected = allServices.filter((s) => getEffectiveCategoryId(s) === id);
    const newAssignments = { ...localAssignments };
    affected.forEach((s) => { newAssignments[s.id] = null; });
    setLocalAssignments(newAssignments);
    setLocalCategories(localCategories.filter((c) => c.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleUpdateCategory = (id: string, updates: Partial<ServiceCategory>) => {
    setLocalCategories(localCategories.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleMoveCategory = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= localCategories.length) return;
    const updated = [...localCategories];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setLocalCategories(updated);
  };

  const handleToggleService = (serviceId: string, categoryId: string) => {
    const current = getEffectiveCategoryId(allServices.find((s) => s.id === serviceId)!);
    setLocalAssignments({
      ...localAssignments,
      [serviceId]: current === categoryId ? null : categoryId,
    });
  };

  const hasChanges =
    JSON.stringify(localCategories) !== JSON.stringify(serviceCategories) ||
    Object.keys(localAssignments).length > 0;

  const handleSave = () => {
    updateServiceCategories({
      categories: localCategories,
      assignments: Object.keys(localAssignments).length > 0 ? localAssignments : undefined,
    });
  };

  const findPreviousCategory = (serviceId: string): string | null => {
    const service = allServices.find((s) => s.id === serviceId);
    if (!service?.categoryId) return null;
    if (service.id in localAssignments && localAssignments[service.id] !== service.categoryId) {
      return serviceCategories.find((c) => c.id === service.categoryId)?.name ?? null;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {localCategories.map((cat, index) => (
        <div key={cat.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Category row header */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => handleMoveCategory(index, 'up')}
                disabled={index === 0}
                className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleMoveCategory(index, 'down')}
                disabled={index === localCategories.length - 1}
                className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowDown size={14} />
              </button>
            </div>

            <IconPicker
              selectedIcon={cat.icon}
              onSelect={(iconName) => handleUpdateCategory(cat.id, { icon: iconName })}
            />

            <ColorPicker
              selectedColor={cat.color}
              onSelect={(color) => handleUpdateCategory(cat.id, { color })}
            />

            <input
              type="text"
              value={cat.name}
              onChange={(e) => handleUpdateCategory(cat.id, { name: e.target.value })}
              placeholder="Nom de la catégorie"
              className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
            />

            {(() => {
              const count = servicesForCategory(cat.id).length;
              return <span className="text-xs text-slate-500 whitespace-nowrap">
                {count} service{count !== 1 ? 's' : ''}
              </span>;
            })()}

            <button
              type="button"
              onClick={() => handleDeleteCategory(cat.id)}
              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
              title="Supprimer"
            >
              <Trash2 size={16} />
            </button>

            <button
              type="button"
              onClick={() => toggleExpand(cat.id)}
              className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {expandedId === cat.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>

          {/* Expanded: service assignment */}
          {expandedId === cat.id && (
            <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher un service..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {filteredServices(allServices).map((service) => {
                  const isAssigned = getEffectiveCategoryId(service) === cat.id;
                  const prevCat = !isAssigned ? null : findPreviousCategory(service.id);
                  return (
                    <label
                      key={service.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isAssigned}
                        onChange={() => handleToggleService(service.id, cat.id)}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <span className="text-sm text-slate-700">{service.name}</span>
                      {prevCat && (
                        <span className="text-xs text-slate-400 italic">(depuis {prevCat})</span>
                      )}
                    </label>
                  );
                })}
                {filteredServices(allServices).length === 0 && (
                  <p className="text-sm text-slate-400 py-2 text-center">Aucun service trouvé</p>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Unassigned services section */}
      {unassignedServices.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-3">
          <p className="text-sm font-medium text-amber-800 mb-2">
            Services non classés ({unassignedServices.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {unassignedServices.map((s) => (
              <span key={s.id} className="text-xs bg-white px-2 py-1 rounded border border-amber-200 text-amber-700">
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleAddCategory}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Plus size={16} />
          Ajouter une catégorie
        </button>

        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            hasChanges
              ? 'bg-slate-900 text-white hover:bg-slate-800'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Save size={16} />
          Enregistrer
        </button>
      </div>
    </div>
  );
}
