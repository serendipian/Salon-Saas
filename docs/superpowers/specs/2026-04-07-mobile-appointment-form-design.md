# Mobile Appointment Form Redesign

## Goal

Drastically improve the mobile UX of the appointment creation/edit form. Target a native app feel (Fresha/Booksy level) with a hybrid two-screen flow, bottom sheets, and proper touch interactions.

## Architecture: Shared Hook + Two Shells

### useAppointmentForm Hook

Extract all form state and logic from `AppointmentBuilder.tsx` into `hooks/useAppointmentForm.ts`.

**State:**
- `clientId`, `newClient` (inline creation data)
- `serviceBlocks`, `activeBlockIndex`
- `status`, `notes`, `reminderMinutes`
- `isSaving`

**Derived:**
- `activeBlock`, `activeStaff`, `activeVariant`, `activeService`, `effectiveDuration`
- `unavailableHours` (via `useStaffAvailability`)
- `availabilityAppointments` (filtered by `excludeAppointmentIds`)

**Actions:**
- `updateBlock(index, updates)`, `removeBlock(index)`, `addBlock()`
- `setClientId`, `setNewClient`, `setStatus`, `setNotes`, `setReminderMinutes`
- `setActiveBlockIndex`, `clearFieldError`

**Helpers:**
- `getBlockSummary(block)` — formatted text for collapsed blocks
- `handleSubmit()` — validates via Zod, builds payload, calls `onSave`

**Validation:**
- `errors` object from `useFormValidation(appointmentGroupSchema)`

**Props the hook receives:**
- `services`, `categories`, `team`, `clients`, `appointments`
- `onSave`, `excludeAppointmentIds`, `initialData`

**Return type:** All state + derived + actions + helpers + `errors` + `isSaving`.

### Desktop Shell: AppointmentBuilder.tsx (Refactored)

- Calls `useAppointmentForm` directly
- Renders the existing two-column layout using the hook's return value
- No logic changes, only state removal — all existing sub-components (`ServiceBlock`, `ClientField`, `SchedulingPanel`, etc.) remain unchanged

### Mobile Shell: AppointmentBuilderMobile.tsx (New)

- Calls `useAppointmentForm` directly
- Two-screen flow managed by internal `screen` state (`'services' | 'scheduling'`)
- Renders mobile-optimized UI with bottom sheets

### Page Components

`AppointmentNewPage.tsx` and `AppointmentEditPage.tsx` check `isMobile` from `MediaQueryContext` and render the appropriate shell.

## Mobile Form Flow

### Screen 1: "Qui & Quoi" (Client + Services + Staff + Options)

Full-screen mobile page. No card wrappers — content fills edge-to-edge with comfortable padding.

**Header (sticky):**
- Back arrow (left) + "Nouveau rendez-vous" title
- Delete button (edit mode only, right side)
- No save button on this screen

**Client Section:**
- Tap area: search icon + "Rechercher un client..." placeholder
- Tapping opens `MobileClientSearch` bottom sheet (half-screen):
  - Search input auto-focused, keyboard opens
  - Scrollable client list: avatar initials + name + phone
  - "Nouveau client" button at bottom of sheet
  - Tapping "Nouveau client" expands inline fields within the sheet (prenom, nom, telephone)
  - Selecting a client or completing new client creation auto-closes the sheet
- Selected client: compact chip with avatar + name + phone + clear X

**Service Blocks:**
- Collapsed blocks: summary chip (number badge + service name + price + staff name)
- Active/empty block: tap opens `MobileServicePicker` bottom sheet:
  - Category pills as horizontal scrollable row at top
  - Service list below: service name + variant count + base price per row
  - Tapping a service shows variants inline as radio-style options
  - Selecting a variant auto-closes the sheet
- Staff pills appear directly below each service block on the main screen (horizontal scroll)
  - "N'importe qui" default pill + eligible staff with avatar + first name
  - Reuses existing `StaffPills` component

**Add Service Button:**
- Full-width dashed border button: "+ Ajouter un service"

**Options Section (always visible):**
- Status: horizontal scrollable pills (Planifie, En cours, Complete, Annule, Absent)
- Notes: textarea
- Reminder: toggle + preset options

**Sticky Footer:**
- Summary text: "2 services . 1h30 . 85,00 EUR"
- "Continuer" button: full-width, blue, min-h-[52px]
- Disabled until at least one service block has service + variant selected

### Screen 2: "Quand" (Scheduling)

Navigated via "Continuer" button. Back arrow returns to screen 1 (state preserved).

**Per-Block Scheduling:**
- If multiple service blocks: horizontal pill strip at top to switch blocks ("Service 1", "Service 2")
- Context header: active block's service name + assigned staff

**Calendar:**
- Full-width `InlineCalendar` (reused as-is)

**Time Picker:**
- `TimePicker` component (reused as-is), larger container padding for touch

**Sticky Footer:**
- Full summary: "Fatima . Coupe + Brushing . lun. 7 avr. . 10h00-11h30 . 85,00 EUR"
- "Confirmer" button: full-width, blue, min-h-[52px]
- Disabled until all blocks have date + time
- Shows "Enregistrement..." while saving

## New Components

### MobileBottomSheet.tsx

Reusable bottom sheet used by client search and service picker.

**Behavior:**
- Portal-rendered to `document.body`
- Half-screen by default (50vh), draggable handle to expand to ~90vh
- Backdrop overlay, tap to close
- Escape key closes
- Body scroll lock when open
- CSS transition (transform translateY)

**Structure:**
- Drag handle bar (40px wide rounded pill, centered)
- Optional title in header
- Scrollable content area

**Props:**
```typescript
interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}
```

Two visual states: half-screen and expanded. Drag past threshold to close.

### MobileServicePicker.tsx

Bottom sheet content for service selection.

- Receives: `services`, `categories`, current `categoryId`
- Category pills (horizontal scroll) at top
- Filtered service list below
- Tapping service reveals variants inline
- Selecting variant calls `onChange({ serviceId, variantId, categoryId })` and closes

### MobileClientSearch.tsx

Bottom sheet content for client search/creation.

- Receives: `clients`, `onSelectClient`, `onNewClient`
- Search input (auto-focus)
- Filtered client list with avatar + name + phone
- "Nouveau client" button at bottom
- New client inline form (prenom, nom, telephone) with "Ajouter" confirm button

## Files Changed

| File | Change |
|---|---|
| `hooks/useAppointmentForm.ts` | NEW: extracted form state + logic |
| `components/AppointmentBuilderMobile.tsx` | NEW: mobile two-screen shell |
| `components/MobileBottomSheet.tsx` | NEW: reusable bottom sheet |
| `components/MobileServicePicker.tsx` | NEW: service picker bottom sheet content |
| `components/MobileClientSearch.tsx` | NEW: client search bottom sheet content |
| `components/AppointmentBuilder.tsx` | REFACTORED: state removed, calls useAppointmentForm |
| `pages/AppointmentNewPage.tsx` | MODIFIED: isMobile check, renders mobile or desktop shell |
| `pages/AppointmentEditPage.tsx` | MODIFIED: isMobile check, renders mobile or desktop shell |

## Files NOT Changed

- `ServiceBlock.tsx`, `ServiceGrid.tsx`, `StaffPills.tsx`, `ClientField.tsx` — desktop-only, untouched
- `SchedulingPanel.tsx`, `InlineCalendar.tsx`, `TimePicker.tsx` — reused by mobile shell as-is
- `AppointmentSummary.tsx`, `ReminderToggle.tsx` — reused by mobile shell as-is
- `schemas.ts`, `mappers.ts`, `hooks/useAppointments.ts`, `hooks/useStaffAvailability.ts` — untouched
- All shared components (`FormElements`, `MobileSelect`, `MobileDrawer`, etc.) — untouched
