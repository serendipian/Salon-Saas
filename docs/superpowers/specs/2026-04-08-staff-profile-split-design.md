# H-2 Fix: Split StaffProfileTab into Self-Contained Sections

> Extract the 719 LOC monolithic `StaffProfileTab` into 6 focused section components with self-contained state, eliminating the fragile shared `draft` pattern.

## Problem

`StaffProfileTab.tsx` handles 6 concerns in one file: personal info editing, contract editing, PII editing, photo upload, client portfolio, activity preview, and danger zone. A single shared `draft` state object is used across 3 editable sections — fields from different sections can leak if the state machine isn't perfectly managed.

## Design

### Shared Helpers — `profile-shared.tsx`

Extracted from the top of the current file:

- `Field` — read-only field display component
- `SectionHeader` — edit/save/cancel header with loading state
- `DAY_LABELS`, `ORDERED_DAYS` — schedule display constants
- `CONTRACT_LABELS` — contract type display labels
- `formatDate` — date formatting helper

### 6 Section Components

Each editable section (1-3) owns its own local `editing` boolean and `draft` state. No mutual exclusion coordination needed — sections are independent.

#### `ProfilePersonalSection.tsx`

- **Props:** `staff`, `onSave`, `isSaving`
- **Local state:** `editing`, `draft`, `localPhotoUrl`, `photoInputRef`
- **Contains:** photo upload, personal info form (name, role, email, phone, birthDate, address, bio, emergency contact), read-only display mode
- Absorbs `useStaffPhotoUpload` hook call (currently in parent)

#### `ProfileContractSection.tsx`

- **Props:** `staff`, `onSave`, `isSaving`
- **Local state:** `editing`, `draft`
- **Contains:** contract type, hours, dates, skills multi-select, schedule editor, read-only display mode
- Absorbs `useServices` hook call for `serviceCategories` (needed for skills display)

#### `ProfilePiiSection.tsx`

- **Props:** `staff`, `loadPii`, `onSave`, `isSaving`, `currencySymbol`
- **Local state:** `editing`, `draft`, `piiLoaded`, `piiLoading`
- **Contains:** PII async load flow, salary/IBAN/SSN form, masked read-only display
- Only rendered when `canSeePii` is true (role check stays in orchestrator)

#### `ProfileClientPortfolio.tsx`

- **Props:** `staffId`
- **Local state:** none (uses `useStaffClients` hook)
- **Contains:** client table with visits, revenue, last visit

#### `ProfileActivityPreview.tsx`

- **Props:** `staffId`, `onSwitchTab?`
- **Local state:** none (uses `useStaffActivity` hook)
- **Contains:** recent events list, "Voir toute l'activité" link

#### `ProfileDangerZone.tsx`

- **Props:** `staff`, `onArchive`
- **Local state:** `dangerOpen`, `showArchiveConfirm`
- **Contains:** collapsible danger zone, archive confirmation

### Orchestrator — `StaffProfileTab.tsx`

~80 LOC thin wrapper that renders all 6 sections:

```tsx
export const StaffProfileTab = ({ staff, loadPii, onSave, isSaving, currencySymbol, onArchive, onSwitchTab }) => {
  const { role } = useAuth();
  const canSeePii = role === 'owner' || role === 'manager';

  return (
    <div className="space-y-6">
      <ProfilePersonalSection staff={staff} onSave={onSave} isSaving={isSaving} />
      <ProfileContractSection staff={staff} onSave={onSave} isSaving={isSaving} />
      {canSeePii && <ProfilePiiSection staff={staff} loadPii={loadPii} onSave={onSave} isSaving={isSaving} currencySymbol={currencySymbol} />}
      <ProfileClientPortfolio staffId={staff.id} />
      <ProfileActivityPreview staffId={staff.id} onSwitchTab={onSwitchTab} />
      <ProfileDangerZone staff={staff} onArchive={onArchive} />
    </div>
  );
};
```

### What Doesn't Change

- `StaffProfileTabProps` interface — same props from `StaffDetailPage`
- `StaffDetailPage` — no changes, still renders `<StaffProfileTab>` with same props
- No new hooks, no DB changes, no new dependencies
- UI appearance — pixel-identical rendering
