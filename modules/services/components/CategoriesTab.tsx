// Thin wrapper around the shared CategoriesManager generic. The previously
// duplicated 258-LOC implementation moved to components/CategoriesManager.tsx
// during M-25 — see audit-remaining-items.md for the rationale.

import { CategoriesManager } from '../../../components/CategoriesManager';
import type { ServiceCategory } from '../../../types';
import { useServices } from '../hooks/useServices';

export function CategoriesTab() {
  const { allServices, serviceCategories, updateServiceCategories } = useServices();

  const createCategory = (): ServiceCategory => ({
    id: crypto.randomUUID(),
    name: '',
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    icon: undefined,
  });

  return (
    <CategoriesManager
      items={allServices}
      categories={serviceCategories}
      onSave={updateServiceCategories}
      createCategory={createCategory}
      supportsIcons
      itemLabel={{ singular: 'service', plural: 'services' }}
      searchPlaceholder="Rechercher un service..."
      noItemsFoundLabel="Aucun service trouvé"
      unassignedSectionLabel="Services non classés"
    />
  );
}
