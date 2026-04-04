# Services Settings Page Design

## Overview

Add a dedicated settings page for the services module at `#/services/settings`, accessed via a gear icon on the service list header. The page has two tabs: **Catégories** (full category management with service assignment) and **Général** (service defaults and display preferences).

This replaces the current `CategoryManagerModal` in `ServicesModule.tsx`.

## Routing & Navigation

- **Route**: `#/services/settings` — nested route, standalone component (not inside ServicesModule)
- **Entry point**: Gear icon button on service list header (replaces current "Catégories" button)
- **Back navigation**: Back arrow + "Services" breadcrumb link at top, returns to `#/services`
- **Tab navigation**: Two tabs below header — "Catégories" | "Général"

## Catégories Tab

### Category Rows

Each category renders as an editable row with:
- **Icon picker** — reuses existing `IconPicker` component from ServicesModule
- **Color picker** — clickable swatch, opens preset palette of Tailwind color pairs (same options as current category colors)
- **Editable name** — inline text input
- **Service count badge** — e.g., "12 services"
- **Expand/collapse chevron**

### Expanded Service Assignment

When a category row is expanded:
- **Checkbox list** of all services with a search filter input at top
- Checked = assigned to this category
- Since services can only belong to one category (`services.category_id` FK), checking a service here auto-removes it from its previous category
- A subtle note like "(depuis Coloration)" appears next to services being moved from another category

### Actions

- **Add category** button at bottom — adds new empty row
- **Delete** trash icon per row — soft-deletes category, sets `category_id = null` on its services
- **Reorder** — up/down arrow buttons per row (no drag-and-drop)
- **Save** button — batch persists all changes (category CRUD + service `category_id` reassignments)

### Unassigned Services Section

Displayed at the bottom of the tab — lists services with `category_id = null` so users can see what still needs organizing.

## Général Tab

Simple form with four settings in a card:

| Setting | UI Control | Default | Description |
|---------|-----------|---------|-------------|
| Durée par défaut | Number input + "min" suffix | 60 | Pre-fills duration when creating a new service variant |
| Nom de variante par défaut | Text input | "Standard" | Pre-fills first variant name when creating a new service |
| Afficher les coûts et marges | Toggle switch | off | Shows/hides Cost and Margin columns in service list table view |
| Vue par défaut | Radio group: "Cartes" / "Tableau" | "table" | Salon-wide default view mode for services list |

**Save**: Single "Enregistrer" button. Updates `salons` row, invalidates settings query cache.

## Data Storage

### Général Settings

Stored as a `service_settings` JSONB column on the `salons` table:

```json
{
  "defaultDuration": 60,
  "defaultVariantName": "Standard",
  "showCostsInList": false,
  "defaultView": "table"
}
```

Requires one migration: `ALTER TABLE salons ADD COLUMN service_settings JSONB DEFAULT '{}'::jsonb;`

### Categories

Existing `service_categories` table — no schema changes. CRUD uses existing `updateServiceCategories` mutation, extended to also batch-update `services.category_id` for reassignments.

## Integration with Existing Code

### ServiceForm
- Reads `service_settings` from `useSettings()` to pre-fill `defaultDuration` and `defaultVariantName` when creating (not editing) a service.

### ServiceList / ServiceTable
- Reads `showCostsInList` to conditionally render Cost and Margin columns.
- `defaultView` setting replaces localStorage-based `useViewMode('services')` as the initial value. localStorage can still override per-browser if user toggles manually.

### ServicesModule
- "Catégories" button becomes a gear icon linking to `#/services/settings`.
- `CategoryManagerModal` is removed from ServicesModule (functionality moves to settings page).

### useServices hook
- `updateServiceCategories` mutation extended: after upserting categories, batch-updates `services.category_id` for any reassigned services.

## New Files

| File | Purpose |
|------|---------|
| `modules/services/ServiceSettingsPage.tsx` | Container with tab navigation and back link |
| `modules/services/components/CategoriesTab.tsx` | Category CRUD + service assignment UI |
| `modules/services/components/GeneralTab.tsx` | Four settings form |
| `modules/services/hooks/useServiceSettings.ts` | Read/write `service_settings` JSONB column |

## Migration

One migration file adding `service_settings` JSONB column to `salons` table with empty object default.

## Access Control

- Route `#/services/settings` is wrapped in `ProtectedRoute` requiring `manage_services` permission (owner/manager only)
- Gear icon button on service list is only visible to owner/manager roles
- Consistent with existing RLS on `service_categories` (owner/manager for writes)

## Null Handling

`useServiceSettings` must handle `service_settings` being null (existing salons without the column populated). Falls back to defaults:
- `defaultDuration`: 60
- `defaultVariantName`: "Standard"
- `showCostsInList`: false
- `defaultView`: "table"

## No Breaking Changes

- Existing `category_id` FK on services unchanged
- Existing category CRUD logic reused and extended
- Existing RLS policies on `service_categories` and `services` unchanged
- `CategoryManagerModal` removed but all its functionality preserved in new CategoriesTab
