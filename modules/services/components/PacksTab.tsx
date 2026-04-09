import React, { useState } from 'react';
import type { Pack } from '../../../types';
import { useServices } from '../hooks/useServices';
import { usePacks } from '../hooks/usePacks';
import { useAuth } from '../../../context/AuthContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { PackList } from './PackList';
import { PackForm } from './PackForm';

type View = 'list' | 'add' | 'edit';

export function PacksTab() {
  const { services, serviceCategories } = useServices();
  const {
    packs,
    addPackAsync,
    updatePackAsync,
    deletePack,
    toggleActive,
    toggleFavorite,
    isAdding,
    isUpdating,
  } = usePacks();
  const { role } = useAuth();
  const { can } = usePermissions(role);
  const canEdit = can('edit', 'services');

  const [view, setView] = useState<View>('list');
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);

  const handleAdd = () => {
    setSelectedPack(null);
    setView('add');
  };

  const handleEdit = (pack: Pack) => {
    setSelectedPack(pack);
    setView('edit');
  };

  const handleSave = async (data: { id?: string; name: string; description: string; price: number; items: Array<{ serviceId: string; serviceVariantId: string }> }) => {
    try {
      if (data.id) {
        await updatePackAsync({ id: data.id, ...data });
      } else {
        await addPackAsync(data);
      }
      setView('list');
    } catch {
      // Toast is shown by the mutation's onError; keep the form open so the user can retry.
    }
  };

  if (view !== 'list') {
    return (
      <PackForm
        existingPack={selectedPack ?? undefined}
        services={services}
        categories={serviceCategories}
        onSave={handleSave}
        onCancel={() => setView('list')}
        isSaving={isAdding || isUpdating}
      />
    );
  }

  return (
    <PackList
      packs={packs}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onDelete={(id) => deletePack(id)}
      onToggleActive={(id, active) => toggleActive({ packId: id, active })}
      onToggleFavorite={canEdit ? (id, isFavorite) => toggleFavorite({ packId: id, isFavorite }) : undefined}
    />
  );
}
