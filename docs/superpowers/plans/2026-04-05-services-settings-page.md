# Services Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings page for the services module with category management (CRUD + service assignment) and general service defaults.

**Architecture:** New route `#/services/settings` with two tabs. Categories tab extends existing CRUD with service assignment checkboxes. Général tab stores 4 settings in a new JSONB column on `salons`. Existing `CategoryManagerModal` is removed and replaced.

**Tech Stack:** React 19, TypeScript, TanStack Query, Supabase, Tailwind CSS, Lucide React, React Router DOM 7

**Spec:** `docs/superpowers/specs/2026-04-05-services-settings-page-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `supabase/migrations/20260405120000_service_settings_column.sql` | Add `service_settings` JSONB column to `salons` |
| Create | `modules/services/hooks/useServiceSettings.ts` | Read/write `service_settings` JSONB column |
| Create | `modules/services/components/GeneralTab.tsx` | Four service settings form |
| Create | `modules/services/components/ColorPicker.tsx` | Category color preset picker |
| Create | `modules/services/components/CategoriesTab.tsx` | Category CRUD + service assignment |
| Create | `modules/services/ServiceSettingsPage.tsx` | Container with tabs + back nav |
| Modify | `App.tsx:73-77` | Add nested route for `/services/settings` |
| Modify | `modules/services/ServicesModule.tsx` | Remove CategoryManagerModal, export IconPicker |
| Modify | `modules/services/components/ServiceList.tsx:33-51` | Replace "Catégories" button with gear icon link |
| Modify | `modules/services/hooks/useServices.ts:140-185` | Extend mutation with service reassignment |
| Modify | `modules/services/components/ServiceTable.tsx` | Add conditional Cost/Margin columns |
| Modify | `modules/services/components/ServiceForm.tsx` | Pre-fill defaults from settings |
| Modify | `types.ts` | Add `ServiceSettings` type |
| Modify | `lib/database.types.ts` | Regenerate after migration (or manually add field) |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260405120000_service_settings_column.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Add service_settings JSONB column to salons table
ALTER TABLE salons ADD COLUMN IF NOT EXISTS service_settings JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN salons.service_settings IS 'Service module settings: defaultDuration, defaultVariantName, showCostsInList, defaultView';
```

- [ ] **Step 2: Apply migration to remote database**

Run: `npx supabase db push --linked`

Expected: Migration applied successfully.

- [ ] **Step 3: Regenerate database types**

Run: `npx supabase gen types typescript --project-id izsycdmrwscdnxebptsx > lib/database.types.ts`

Expected: `lib/database.types.ts` now includes `service_settings: Json | null` in the `salons` Row type.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260405120000_service_settings_column.sql lib/database.types.ts
git commit -m "feat: add service_settings JSONB column to salons table"
```

---

### Task 2: ServiceSettings Type + Hook

**Files:**
- Modify: `types.ts`
- Create: `modules/services/hooks/useServiceSettings.ts`

- [ ] **Step 1: Add ServiceSettings type to types.ts**

Add after the `ServiceCategory` interface (around line 62):

```typescript
export interface ServiceSettings {
  defaultDuration: number;
  defaultVariantName: string;
  showCostsInList: boolean;
  defaultView: 'card' | 'table';
}
```

- [ ] **Step 2: Create useServiceSettings hook**

Create `modules/services/hooks/useServiceSettings.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useMutationToast } from '../../../hooks/useMutationToast';
import type { ServiceSettings } from '../../../types';

const DEFAULTS: ServiceSettings = {
  defaultDuration: 60,
  defaultVariantName: 'Standard',
  showCostsInList: false,
  defaultView: 'table',
};

export function useServiceSettings() {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();
  const { toastOnError, toastOnSuccess } = useMutationToast();

  const { data: serviceSettings = DEFAULTS, isLoading } = useQuery({
    queryKey: ['service_settings', salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salons')
        .select('service_settings')
        .eq('id', salonId)
        .single();
      if (error) throw error;
      const raw = data?.service_settings as Record<string, unknown> | null;
      if (!raw || Object.keys(raw).length === 0) return DEFAULTS;
      return {
        defaultDuration: typeof raw.defaultDuration === 'number' ? raw.defaultDuration : DEFAULTS.defaultDuration,
        defaultVariantName: typeof raw.defaultVariantName === 'string' ? raw.defaultVariantName : DEFAULTS.defaultVariantName,
        showCostsInList: typeof raw.showCostsInList === 'boolean' ? raw.showCostsInList : DEFAULTS.showCostsInList,
        defaultView: raw.defaultView === 'card' || raw.defaultView === 'table' ? raw.defaultView : DEFAULTS.defaultView,
      } satisfies ServiceSettings;
    },
    enabled: !!salonId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: ServiceSettings) => {
      const { error } = await supabase
        .from('salons')
        .update({ service_settings: settings as unknown as Record<string, unknown> })
        .eq('id', salonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service_settings', salonId] });
      toastOnSuccess('Paramètres des services enregistrés')();
    },
    onError: toastOnError('Impossible de modifier les paramètres des services'),
  });

  return {
    serviceSettings,
    isLoading,
    updateServiceSettings: (settings: ServiceSettings) => updateSettingsMutation.mutate(settings),
  };
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: No type errors. Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add types.ts modules/services/hooks/useServiceSettings.ts
git commit -m "feat: add ServiceSettings type and useServiceSettings hook"
```

---

### Task 3: Général Tab Component

**Files:**
- Create: `modules/services/components/GeneralTab.tsx`

- [ ] **Step 1: Create GeneralTab component**

```typescript
import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Input, Select } from '../../../components/FormElements';
import { useServiceSettings } from '../hooks/useServiceSettings';
import type { ServiceSettings } from '../../../types';

export function GeneralTab() {
  const { serviceSettings, updateServiceSettings } = useServiceSettings();
  const [form, setForm] = useState<ServiceSettings>(serviceSettings);

  useEffect(() => {
    setForm(serviceSettings);
  }, [serviceSettings]);

  const handleSave = () => {
    updateServiceSettings(form);
  };

  const hasChanges = JSON.stringify(form) !== JSON.stringify(serviceSettings);

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
          Paramètres généraux
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Durée par défaut
            </label>
            <div className="relative">
              <input
                type="number"
                min={5}
                max={480}
                step={5}
                value={form.defaultDuration}
                onChange={(e) => setForm({ ...form, defaultDuration: parseInt(e.target.value) || 60 })}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm min-h-[44px]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">min</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nom de variante par défaut
            </label>
            <input
              type="text"
              value={form.defaultVariantName}
              onChange={(e) => setForm({ ...form, defaultVariantName: e.target.value })}
              placeholder="Standard"
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm min-h-[44px]"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Afficher les coûts et marges</p>
              <p className="text-xs text-slate-500">Affiche les colonnes Coût et Marge dans la vue tableau des services</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.showCostsInList}
              onClick={() => setForm({ ...form, showCostsInList: !form.showCostsInList })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.showCostsInList ? 'bg-emerald-500' : 'bg-slate-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                form.showCostsInList ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Vue par défaut</p>
              <p className="text-xs text-slate-500">Mode d'affichage par défaut de la liste des services</p>
            </div>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setForm({ ...form, defaultView: 'card' })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  form.defaultView === 'card'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Cartes
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, defaultView: 'table' })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  form.defaultView === 'table'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Tableau
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
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
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add modules/services/components/GeneralTab.tsx
git commit -m "feat: add GeneralTab component for service settings"
```

---

### Task 4: Extract IconPicker + Create ColorPicker

**Files:**
- Modify: `modules/services/ServicesModule.tsx`
- Create: `modules/services/components/IconPicker.tsx`
- Create: `modules/services/components/ColorPicker.tsx`

- [ ] **Step 1: Extract IconPicker into its own file**

Create `modules/services/components/IconPicker.tsx` with the IconPicker component currently at lines 11-64 of `ServicesModule.tsx`:

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { ICON_PICKER_LIST, RegistryIcon } from '../../../lib/categoryIcons';

interface IconPickerProps {
  selectedIcon?: string;
  onSelect: (iconName: string) => void;
}

export function IconPicker({ selectedIcon, onSelect }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedEntry = ICON_PICKER_LIST.find((i) => i.name === selectedIcon);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
        title={selectedEntry?.label ?? 'Choisir une icône'}
      >
        {selectedIcon ? (
          <RegistryIcon name={selectedIcon} size={18} className="text-slate-700" />
        ) : (
          <span className="text-slate-400 text-lg">+</span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-2 grid grid-cols-5 gap-1 w-56">
          {ICON_PICKER_LIST.map((icon) => (
            <button
              key={icon.name}
              type="button"
              onClick={() => { onSelect(icon.name); setOpen(false); }}
              title={icon.label}
              className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                selectedIcon === icon.name
                  ? 'bg-pink-100 text-pink-600'
                  : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              <RegistryIcon name={icon.name} size={18} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create ColorPicker component**

Create `modules/services/components/ColorPicker.tsx`:

```typescript
import React, { useState, useRef, useEffect } from 'react';

const COLOR_PRESETS = [
  { value: 'bg-slate-100 text-slate-800 border-slate-200', dot: 'bg-slate-400' },
  { value: 'bg-pink-100 text-pink-800 border-pink-200', dot: 'bg-pink-400' },
  { value: 'bg-rose-100 text-rose-800 border-rose-200', dot: 'bg-rose-400' },
  { value: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-400' },
  { value: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-400' },
  { value: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-400' },
  { value: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-400' },
  { value: 'bg-lime-100 text-lime-800 border-lime-200', dot: 'bg-lime-400' },
  { value: 'bg-green-100 text-green-800 border-green-200', dot: 'bg-green-400' },
  { value: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-400' },
  { value: 'bg-teal-100 text-teal-800 border-teal-200', dot: 'bg-teal-400' },
  { value: 'bg-cyan-100 text-cyan-800 border-cyan-200', dot: 'bg-cyan-400' },
  { value: 'bg-sky-100 text-sky-800 border-sky-200', dot: 'bg-sky-400' },
  { value: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-400' },
  { value: 'bg-indigo-100 text-indigo-800 border-indigo-200', dot: 'bg-indigo-400' },
  { value: 'bg-violet-100 text-violet-800 border-violet-200', dot: 'bg-violet-400' },
  { value: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-400' },
  { value: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200', dot: 'bg-fuchsia-400' },
];

interface ColorPickerProps {
  selectedColor: string;
  onSelect: (color: string) => void;
}

export function ColorPicker({ selectedColor, onSelect }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentDot = COLOR_PRESETS.find((c) => c.value === selectedColor)?.dot ?? 'bg-slate-400';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
        title="Choisir une couleur"
      >
        <span className={`w-4 h-4 rounded-full ${currentDot}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-2 grid grid-cols-6 gap-1 w-48">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => { onSelect(color.value); setOpen(false); }}
              className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                selectedColor === color.value
                  ? 'ring-2 ring-slate-900 ring-offset-1'
                  : 'hover:ring-2 hover:ring-slate-300'
              }`}
            >
              <span className={`w-4 h-4 rounded-full ${color.dot}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update ServicesModule.tsx to import IconPicker from new file**

In `ServicesModule.tsx`, remove the inline `IconPicker` component definition (lines 11-64) and replace with an import:

```typescript
import { IconPicker } from './components/IconPicker';
```

The `CategoryManagerModal` (lines 67-158) still references `IconPicker` — it will be removed in Task 8, but this import keeps it working in the interim.

- [ ] **Step 4: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add modules/services/components/IconPicker.tsx modules/services/components/ColorPicker.tsx modules/services/ServicesModule.tsx
git commit -m "feat: extract IconPicker and create ColorPicker components"
```

---

### Task 5: Extend useServices Mutation for Service Reassignment

**Files:**
- Modify: `modules/services/hooks/useServices.ts:140-185`

- [ ] **Step 1: Extend the updateServiceCategories mutation**

The current `updateServiceCategoriesMutation` only handles category CRUD. It needs to also accept and persist service-to-category reassignments.

Change the mutation type and logic. In `useServices.ts`, update the mutation (around line 140):

```typescript
interface CategoryUpdatePayload {
  categories: ServiceCategory[];
  assignments?: Record<string, string | null>; // serviceId → categoryId (or null for unassigned)
}

const updateServiceCategoriesMutation = useMutation({
  mutationFn: async (payload: CategoryUpdatePayload) => {
    const { categories, assignments } = payload;

    // --- Existing category CRUD logic (unchanged) ---
    const { data: existing } = await supabase
      .from('service_categories')
      .select('id')
      .eq('salon_id', salonId)
      .is('deleted_at', null);

    const existingIds = new Set((existing ?? []).map((c) => c.id));
    const newIds = new Set(categories.map((c) => c.id));

    const toDelete = [...existingIds].filter((id) => !newIds.has(id));
    if (toDelete.length > 0) {
      const { error } = await supabase
        .from('service_categories')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', toDelete)
        .eq('salon_id', salonId);
      if (error) throw error;
    }

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      const row = toServiceCategoryInsert({ ...cat, sortOrder: i }, salonId);
      if (existingIds.has(cat.id)) {
        const { error } = await supabase
          .from('service_categories')
          .update({ name: row.name, color: row.color, icon: row.icon, sort_order: row.sort_order })
          .eq('id', cat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('service_categories')
          .insert(row);
        if (error) throw error;
      }
    }

    // --- NEW: Batch-update service category assignments ---
    if (assignments) {
      for (const [serviceId, categoryId] of Object.entries(assignments)) {
        const { error } = await supabase
          .from('services')
          .update({ category_id: categoryId })
          .eq('id', serviceId)
          .eq('salon_id', salonId);
        if (error) throw error;
      }
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['service_categories', salonId] });
    queryClient.invalidateQueries({ queryKey: ['services', salonId] });
  },
  onError: toastOnError('Impossible de modifier les catégories de services'),
});
```

Update the return value to match the new signature:

```typescript
updateServiceCategories: (payload: CategoryUpdatePayload) =>
  updateServiceCategoriesMutation.mutate(payload),
```

Export the type from the hook file:

```typescript
export type { CategoryUpdatePayload };
```

- [ ] **Step 2: Update existing callers**

The `CategoryManagerModal` in `ServicesModule.tsx` calls `updateServiceCategories(categories)` with just an array. Update it to pass the new shape:

```typescript
// In ServicesModule.tsx, the onSave callback for CategoryManagerModal
onSave={(cats) => updateServiceCategories({ categories: cats })}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add modules/services/hooks/useServices.ts modules/services/ServicesModule.tsx
git commit -m "feat: extend category mutation with service reassignment support"
```

---

### Task 6: CategoriesTab Component

**Files:**
- Create: `modules/services/components/CategoriesTab.tsx`

- [ ] **Step 1: Create CategoriesTab component**

```typescript
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Save, Search } from 'lucide-react';
import { IconPicker } from './IconPicker';
import { ColorPicker } from './ColorPicker';
import { CategoryIcon } from '../../../lib/categoryIcons';
import { useServices, type CategoryUpdatePayload } from '../hooks/useServices';
import type { ServiceCategory, Service } from '../../../types';

export function CategoriesTab() {
  const { allServices, serviceCategories, updateServiceCategories } = useServices();

  const [localCategories, setLocalCategories] = useState<ServiceCategory[]>(serviceCategories);
  const [localAssignments, setLocalAssignments] = useState<Record<string, string | null>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

            <span className="text-xs text-slate-500 whitespace-nowrap">
              {servicesForCategory(cat.id).length} service{servicesForCategory(cat.id).length !== 1 ? 's' : ''}
            </span>

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
              onClick={() => setExpandedId(expandedId === cat.id ? null : cat.id)}
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
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add modules/services/components/CategoriesTab.tsx
git commit -m "feat: add CategoriesTab with category CRUD and service assignment"
```

---

### Task 7: ServiceSettingsPage + Route

**Files:**
- Create: `modules/services/ServiceSettingsPage.tsx`
- Modify: `App.tsx:73-77`

- [ ] **Step 1: Create ServiceSettingsPage**

```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, Settings } from 'lucide-react';
import { CategoriesTab } from './components/CategoriesTab';
import { GeneralTab } from './components/GeneralTab';

type Tab = 'categories' | 'general';

export function ServiceSettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('categories');

  return (
    <div className="space-y-6">
      {/* Header with back link */}
      <div>
        <button
          onClick={() => navigate('/services')}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-3"
        >
          <ArrowLeft size={16} />
          Services
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres des services</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('categories')}
            className={`inline-flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'categories'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layers size={16} />
            Catégories
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`inline-flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Settings size={16} />
            Général
          </button>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'categories' ? <CategoriesTab /> : <GeneralTab />}
    </div>
  );
}
```

- [ ] **Step 2: Add route in App.tsx**

In `App.tsx`, add an import for `ServiceSettingsPage`:

```typescript
import { ServiceSettingsPage } from './modules/services/ServiceSettingsPage';
```

Then change the `/services` route from a self-closing element to a parent route with children (similar to the `/team` pattern):

Replace the current `/services` route (lines 73-77):

```typescript
<Route path="/services" element={
  <ProtectedRoute action="view" resource="services">
    <ErrorBoundary moduleName="Services"><ServicesModule /></ErrorBoundary>
  </ProtectedRoute>
} />
```

With nested routes:

```typescript
<Route path="/services" element={
  <ProtectedRoute action="view" resource="services">
    <ErrorBoundary moduleName="Services"><ServicesModule /></ErrorBoundary>
  </ProtectedRoute>
} />
<Route path="/services/settings" element={
  <ProtectedRoute action="edit" resource="services">
    <ErrorBoundary moduleName="Paramètres des services"><ServiceSettingsPage /></ErrorBoundary>
  </ProtectedRoute>
} />
```

Note: These are two sibling routes, not nested with `<Outlet>`. The settings page renders independently from ServicesModule, wrapped in the same Layout shell via the existing `AppContent` wrapper. We use `action="edit"` to restrict to owner/manager.

- [ ] **Step 3: Verify build and manual test**

Run: `npm run build`

Expected: Build succeeds. Navigate to `#/services/settings` in the browser — page renders with two tabs.

- [ ] **Step 4: Commit**

```bash
git add modules/services/ServiceSettingsPage.tsx App.tsx
git commit -m "feat: add ServiceSettingsPage route with tab navigation"
```

---

### Task 8: Update ServiceList + Remove CategoryManagerModal

**Files:**
- Modify: `modules/services/components/ServiceList.tsx`
- Modify: `modules/services/ServicesModule.tsx`

- [ ] **Step 1: Replace "Catégories" button with gear icon in ServiceList**

In `ServiceList.tsx`, add the navigation import and permission check:

```typescript
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { usePermissions } from '../../../hooks/usePermissions';
```

Inside the component, add:

```typescript
const navigate = useNavigate();
const { role } = useAuth();
const { can } = usePermissions(role);
const canEditServices = can('edit', 'services');
```

Replace the "Catégories" button (the `onManageCategories` button) with a gear icon link:

```typescript
{canEditServices && (
  <button
    onClick={() => navigate('/services/settings')}
    className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
    title="Paramètres des services"
  >
    <Settings size={18} className="text-slate-600" />
  </button>
)}
```

Add `Settings` to the Lucide import. Remove the `onManageCategories` prop from the component's props interface.

- [ ] **Step 2: Remove CategoryManagerModal from ServicesModule**

In `ServicesModule.tsx`:

1. Remove the `CategoryManagerModal` component definition (lines ~67-158)
2. Remove the `showCategoryManager` state
3. Remove the `onManageCategories` prop passed to `ServiceList`
4. Remove the `{showCategoryManager && <CategoryManagerModal ... />}` render
5. Keep the `IconPicker` import (it's now in its own file from Task 4)

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: Build succeeds. No references to `CategoryManagerModal` remain.

- [ ] **Step 4: Commit**

```bash
git add modules/services/components/ServiceList.tsx modules/services/ServicesModule.tsx
git commit -m "feat: replace categories button with settings gear icon, remove CategoryManagerModal"
```

---

### Task 9: Integrate Settings into ServiceTable (Cost/Margin Columns)

**Files:**
- Modify: `modules/services/components/ServiceTable.tsx`

- [ ] **Step 1: Add conditional Cost and Margin columns**

In `ServiceTable.tsx`, import the settings hook:

```typescript
import { useServiceSettings } from '../hooks/useServiceSettings';
import { formatPrice } from '../../../lib/format';
```

Inside the component, read the setting:

```typescript
const { serviceSettings } = useServiceSettings();
const showCosts = serviceSettings.showCostsInList;
```

Add two new `<th>` columns after the Prix column (conditionally rendered):

```typescript
{showCosts && <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Coût</th>}
{showCosts && <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Marge</th>}
```

Add matching `<td>` cells in each row. For cost, show the min-max range of variant costs. For margin, compute `price - cost - additionalCost` per variant and show the range:

```typescript
{showCosts && (
  <td className="hidden sm:table-cell px-4 py-3 text-sm text-slate-600">
    {(() => {
      const costs = service.variants.map((v) => v.cost + v.additionalCost);
      const minCost = Math.min(...costs);
      const maxCost = Math.max(...costs);
      return minCost === maxCost ? formatPrice(minCost) : `${formatPrice(minCost)} - ${formatPrice(maxCost)}`;
    })()}
  </td>
)}
{showCosts && (
  <td className="hidden sm:table-cell px-4 py-3 text-sm font-medium text-emerald-600">
    {(() => {
      const margins = service.variants.map((v) => v.price - v.cost - v.additionalCost);
      const minMargin = Math.min(...margins);
      const maxMargin = Math.max(...margins);
      return minMargin === maxMargin ? formatPrice(minMargin) : `${formatPrice(minMargin)} - ${formatPrice(maxMargin)}`;
    })()}
  </td>
)}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add modules/services/components/ServiceTable.tsx
git commit -m "feat: add conditional Cost and Margin columns to service table"
```

---

### Task 10: Integrate Settings into ServiceForm (Defaults)

**Files:**
- Modify: `modules/services/components/ServiceForm.tsx`

- [ ] **Step 1: Pre-fill defaults when creating a new service**

In `ServiceForm.tsx`, import the settings hook:

```typescript
import { useServiceSettings } from '../hooks/useServiceSettings';
```

Inside the component:

```typescript
const { serviceSettings } = useServiceSettings();
```

Find where the initial `formData` state is set for a new service. When the `service` prop is empty/new (i.e., creating, not editing), the initial variant should use `serviceSettings.defaultDuration` for `durationMinutes` and `serviceSettings.defaultVariantName` for `name`.

Locate the initial state setup — it likely looks like:

```typescript
const [formData, setFormData] = useState(() => {
  if (service) return service; // editing existing
  return {
    id: crypto.randomUUID(),
    name: '',
    categoryId: '',
    description: '',
    active: true,
    variants: [{
      id: crypto.randomUUID(),
      name: '',
      durationMinutes: 60,
      price: 0,
      cost: 0,
      additionalCost: 0,
    }],
  };
});
```

Update the default variant to use settings:

```typescript
variants: [{
  id: crypto.randomUUID(),
  name: serviceSettings.defaultVariantName,
  durationMinutes: serviceSettings.defaultDuration,
  price: 0,
  cost: 0,
  additionalCost: 0,
}],
```

Also update the "add variant" handler to use the same defaults for new variants.

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add modules/services/components/ServiceForm.tsx
git commit -m "feat: pre-fill service form defaults from service settings"
```

---

### Task 11: Integrate defaultView Setting into useViewMode

**Files:**
- Modify: `hooks/useViewMode.ts`

- [ ] **Step 1: Accept an optional server-side default**

Update `useViewMode` to accept an optional `serverDefault` parameter that overrides the hardcoded `'table'` fallback when no localStorage value exists:

```typescript
export const useViewMode = (moduleName: string, serverDefault?: ViewMode): {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
} => {
```

In the initialization logic, change the fallback from `'table'` to `serverDefault ?? 'table'`:

```typescript
const stored = localStorage.getItem(`${STORAGE_PREFIX}${moduleName}`);
const initial = stored === 'card' || stored === 'table' ? stored : (serverDefault ?? 'table');
```

- [ ] **Step 2: Pass server default from ServiceList**

In `ServiceList.tsx`, import and use the setting:

```typescript
import { useServiceSettings } from '../hooks/useServiceSettings';
```

```typescript
const { serviceSettings } = useServiceSettings();
const { viewMode, setViewMode } = useViewMode('services', serviceSettings.defaultView);
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add hooks/useViewMode.ts modules/services/components/ServiceList.tsx
git commit -m "feat: integrate server-side defaultView setting into useViewMode"
```

---

### Task 12: Final Verification + Cleanup

**Files:** None new

- [ ] **Step 1: Full build check**

Run: `npm run build`

Expected: Zero errors, zero warnings.

- [ ] **Step 2: Manual smoke test checklist**

Open the app in browser and verify:

1. Navigate to Services page — gear icon visible (for owner/manager)
2. Click gear icon — navigates to `#/services/settings`
3. Back arrow returns to services list
4. **Catégories tab**: categories load, can add/edit name/icon/color, reorder with arrows, expand to see service checkboxes, save persists
5. **Catégories tab**: assign a service to a category, save, verify it moved
6. **Catégories tab**: delete a category, services become unassigned
7. **Catégories tab**: unassigned services section shows at bottom
8. **Général tab**: all 4 settings render with correct defaults
9. **Général tab**: change settings, save, reload page — settings persist
10. Create new service — variant pre-fills with configured default name and duration
11. Toggle "Afficher les coûts et marges" on — service table shows Cost and Margin columns
12. Change "Vue par défaut" — new incognito tab uses that default

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "fix: final adjustments for services settings page"
```
