import React, { useState } from 'react';
import type { Pack, PackGroup } from '../../../types';
import { useServices } from '../hooks/useServices';
import { usePacks } from '../hooks/usePacks';
import { usePackGroups } from '../hooks/usePackGroups';
import { useAuth } from '../../../context/AuthContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { PackList } from './PackList';
import { PackForm } from './PackForm';
import { PackGroupForm } from './PackGroupForm';

type View = 'list' | 'add' | 'edit' | 'add-group' | 'edit-group';

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
  const {
    packGroups,
    addPackGroup,
    updatePackGroup,
    deletePackGroup,
    toggleActive: toggleGroupActive,
  } = usePackGroups();
  const { role } = useAuth();
  const { can } = usePermissions(role);
  const canEdit = can('edit', 'services');

  const [view, setView] = useState<View>('list');
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<PackGroup | null>(null);

  const handleAdd = () => {
    setSelectedPack(null);
    setView('add');
  };

  const handleEdit = (pack: Pack) => {
    setSelectedPack(pack);
    setView('edit');
  };

  const handleAddGroup = () => {
    setSelectedGroup(null);
    setView('add-group');
  };

  const handleEditGroup = (group: PackGroup) => {
    setSelectedGroup(group);
    setView('edit-group');
  };

  const handleSave = async (data: { id?: string; name: string; description: string; price: number; groupId: string | null; items: Array<{ serviceId: string; serviceVariantId: string }> }) => {
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

  const handleSaveGroup = (data: { id?: string; name: string; description: string; color: string | null; startsAt: string | null; endsAt: string | null }) => {
    if (data.id) {
      updatePackGroup({ id: data.id, ...data });
    } else {
      addPackGroup(data);
    }
    setView('list');
  };

  if (view === 'add' || view === 'edit') {
    return (
      <PackForm
        existingPack={selectedPack ?? undefined}
        services={services}
        categories={serviceCategories}
        packGroups={packGroups}
        onSave={handleSave}
        onCancel={() => setView('list')}
        isSaving={isAdding || isUpdating}
      />
    );
  }

  if (view === 'add-group' || view === 'edit-group') {
    return (
      <PackGroupForm
        existingGroup={selectedGroup ?? undefined}
        onSave={handleSaveGroup}
        onCancel={() => setView('list')}
      />
    );
  }

  return (
    <PackList
      packs={packs}
      packGroups={packGroups}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onDelete={(id) => deletePack(id)}
      onToggleActive={(id, active) => toggleActive({ packId: id, active })}
      onToggleFavorite={canEdit ? (id, isFavorite) => toggleFavorite({ packId: id, isFavorite }) : undefined}
      onAddGroup={canEdit ? handleAddGroup : undefined}
      onEditGroup={canEdit ? handleEditGroup : undefined}
      onDeleteGroup={canEdit ? (id) => deletePackGroup(id) : undefined}
      onToggleGroupActive={canEdit ? (id, active) => toggleGroupActive({ groupId: id, active }) : undefined}
    />
  );
}
