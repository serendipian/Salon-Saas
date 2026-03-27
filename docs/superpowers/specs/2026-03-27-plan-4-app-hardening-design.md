# Plan 4: App Hardening — Design Spec

## Goal

Make the app robust and production-ready by adding form validation, user-facing mutation error handling, and error boundaries. No new features — this is about reliability and UX quality.

## Scope

| In scope | Out of scope (Plan 5) |
|----------|----------------------|
| Zod-based form validation on all forms | Mobile responsiveness |
| Toast-based mutation error handling | Gemini API security |
| React error boundaries per module | New features |

## Dependencies

- **Zod** — new dependency (~13KB gzipped), schema-based validation
- **Plan 3 toast system** — already implemented (`context/ToastContext.tsx`, `components/Toast.tsx`)
- **Existing FormElements** — already support `error` prop for field-level error display

---

## Section 1: Zod Schemas & Validation Hook

### Architecture

**Shared hook:** `hooks/useFormValidation.ts`

```typescript
function useFormValidation<T>(schema: ZodSchema<T>): {
  errors: Record<string, string>;
  validate: (data: unknown) => T | null;
  clearErrors: () => void;
  clearFieldError: (field: string) => void;
}
```

- `validate(formData)` — parses with Zod. Returns typed parsed data on success, or `null` on failure (populating `errors`).
- `errors` — `Record<string, string>` mapping field names to French error messages.
- `clearErrors()` — resets all errors. Call when closing/reopening a form.
- `clearFieldError(field)` — removes a single field's error. Call on field value change for immediate feedback.

**Schemas:** Co-located per module at `modules/{module}/schemas.ts`. Each schema defines French error messages inline via Zod's `.message()`.

### Schemas by Module

**`modules/clients/schemas.ts`** — `clientSchema`
- `firstName`: string, required (`"Le prénom est requis"`)
- `lastName`: string, required (`"Le nom est requis"`)
- `email`: string, optional, valid email format (`"L'email n'est pas valide"`)
- `phone`: string, optional

**`modules/services/schemas.ts`** — `serviceSchema`
- `name`: string, required (`"Le nom du service est requis"`)
- `price`: number, ≥ 0 (`"Le prix doit être positif"`)
- `duration`: number, > 0 (`"La durée doit être supérieure à 0"`)
- `categoryId`: string, required (`"La catégorie est requise"`)

**`modules/products/schemas.ts`** — `productSchema`
- `name`: string, required (`"Le nom du produit est requis"`)
- `price`: number, ≥ 0 (`"Le prix doit être positif"`)
- `stock`: number, ≥ 0, integer (`"Le stock doit être un nombre entier positif"`)
- `categoryId`: string, required (`"La catégorie est requise"`)

**`modules/team/schemas.ts`** — `staffMemberSchema`
- `firstName`: string, required (`"Le prénom est requis"`)
- `lastName`: string, required (`"Le nom est requis"`)
- `email`: string, required, valid format (`"L'email n'est pas valide"`)
- `phone`: string, optional
- `role`: enum (`"Le rôle est requis"`)

**`modules/suppliers/schemas.ts`** — `supplierSchema`
- `name`: string, required (`"Le nom du fournisseur est requis"`)
- `email`: string, optional, valid format (`"L'email n'est pas valide"`)
- `phone`: string, optional
- `contactName`: string, optional

**`modules/appointments/schemas.ts`** — `appointmentSchema`
- `clientId`: string, required (`"Le client est requis"`)
- `staffId`: string, required (`"Le membre de l'équipe est requis"`)
- `serviceId`: string, required (`"Le service est requis"`)
- `date`: string, required (`"La date est requise"`)
- `startTime`: string, required (`"L'heure de début est requise"`)
- Cross-field: `.refine()` to validate date+time produce a parseable datetime (not necessarily future — appointments can be backdated for record-keeping), with `path: ['date']`

**`modules/settings/schemas.ts`** — `salonSettingsSchema`, `expenseCategorySchema`, `recurringExpenseSchema`
- `salonSettingsSchema`: name required, email optional but valid, vatRate 0–100
- `expenseCategorySchema`: name required, color required (hex format)
- `recurringExpenseSchema`: name required, amount > 0, frequency required, nextDate required

**`modules/accounting/schemas.ts`** — `expenseSchema`
- `description`: string, required (`"La description est requise"`)
- `amount`: number, > 0 (`"Le montant doit être supérieur à 0"`)
- `date`: string, required (`"La date est requise"`)
- `categoryId`: string, required (`"La catégorie est requise"`)

### Wiring Pattern

Every form follows this pattern:

```typescript
const { errors, validate, clearErrors, clearFieldError } = useFormValidation(clientSchema);

// On submit:
const handleSubmit = () => {
  const validated = validate(formData);
  if (validated) onSave(validated);
};

// On field change:
const handleChange = (field: string, value: string) => {
  setFormData(prev => ({ ...prev, [field]: value }));
  clearFieldError(field);
};

// On form inputs:
<Input label="Prénom" value={formData.firstName} error={errors.firstName} ... />
```

### Validation Policy

- **When:** Validate on submit only. Do not validate on blur.
- **Clear on change:** When a field value changes, clear that field's error immediately (via `clearFieldError`).
- **Clear on close:** Call `clearErrors()` when the form modal/panel closes.
- **Cross-field errors:** Use Zod `.refine()` with explicit `path` option to attach error to a specific field.

---

## Section 2: Toast-Based Mutation Error Handling

### Architecture

**Hook:** `hooks/useMutationToast.ts`

```typescript
function useMutationToast(): {
  toastOnError: (fallbackMessage: string) => (error: Error) => void;
  toastOnSuccess: (message: string) => () => void;
}
```

- `toastOnError(fallbackMessage)` — returns an `onError` callback for `useMutation`. Inspects Supabase error codes, falls back to the provided French message.
- `toastOnSuccess(message)` — returns an `onSuccess` callback. Used sparingly — most mutations are silent on success.

### Error Classification

`toastOnError` inspects `error.code` before falling back:

| Supabase error | French toast message |
|----------------|---------------------|
| RLS violation (`42501`) | `"Vous n'avez pas les droits pour cette action"` |
| Unique constraint (`23505`) | `"Cet élément existe déjà"` |
| Network/fetch error | `"Problème de connexion, veuillez réessayer"` |
| Everything else | Provided `fallbackMessage` |

All error toasts use `type: 'error'` which does not auto-dismiss (Plan 3 toast policy).

### Wiring Pattern

Each module hook swaps `console.error` for `toastOnError`:

```typescript
const { toastOnError } = useMutationToast();

const addClientMutation = useMutation({
  mutationFn: async (client: Client) => { ... },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients', salonId] }),
  onError: toastOnError("Impossible d'ajouter le client"),
});
```

### Mutations to Update

| Module | Hook | Mutations | Count |
|--------|------|-----------|-------|
| clients | useClients | add, update | 2 |
| services | useServices | add, update | 2 |
| products | useProducts | add, update | 2 |
| team | useTeam | add, update | 2 |
| suppliers | useSuppliers | add, update | 2 |
| settings | useSettings | settings, categories, recurring | 3 |
| accounting | useAccounting | add, update | 2 |
| appointments | useAppointments | add, update | 2 |
| transactions | useTransactions | add | 1 |
| **Total** | | | **18** |

### Success Toast Policy

- **Default:** Silent. The UI update via query invalidation is sufficient feedback.
- **Opt-in:** Pass `toastOnSuccess("Message")` only where explicit confirmation helps (e.g., settings save).

---

## Section 3: Error Boundaries

### Architecture

**Component:** `components/ErrorBoundary.tsx` — React class component (required by React's error boundary API).

```typescript
interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  moduleName?: string;
  onReset?: () => void;
}
```

### Behavior

- **On error:** Renders a fallback UI instead of the crashed component. Logs error via `componentDidCatch`.
- **Reset mechanism:** Increments an internal `resetKey` counter. This key is applied to the children wrapper, forcing React to remount the entire subtree. Remount triggers fresh `useQuery` calls → fresh data from Supabase (TanStack Query's default `staleTime` is 0).
- **`onReset` prop:** Called alongside the remount for custom cleanup. Optional — the remount handles the common case.

### Default Fallback UI

- Centered card using existing Tailwind/brand palette
- `AlertTriangle` icon from Lucide (already installed)
- Text: `"Une erreur est survenue dans {moduleName}"`
- Subtext: `"Veuillez réessayer ou revenir au tableau de bord"`
- "Réessayer" button — clears error, triggers remount
- "Retour au tableau de bord" link — navigates to `/dashboard`

### Placement

Wrap each module route in `App.tsx`, inside `ProtectedRoute` but outside the module:

```typescript
<Route path="/clients" element={
  <ProtectedRoute action="view" resource="clients">
    <ErrorBoundary moduleName="Clients">
      <ClientsModule />
    </ErrorBoundary>
  </ProtectedRoute>
} />
```

**Why module-level:**
- Layout (sidebar, header, connection status) survives any module crash
- User can navigate away without refreshing
- Each boundary is independent — a crash in Clients doesn't affect Services

### Error Logging

`componentDidCatch(error, errorInfo)` logs to `console.error`. Single call site — easy to wire to Sentry/LogRocket later.

### Scope

10 routes in App.tsx, one `<ErrorBoundary>` wrapper each: dashboard, services, clients, team, calendar, products, suppliers, settings, pos, accounting.

---

## File Structure Summary

```
hooks/
  useFormValidation.ts          # Generic Zod validation hook
  useMutationToast.ts           # Toast callbacks for mutations

components/
  ErrorBoundary.tsx             # Module-level error boundary

modules/
  clients/schemas.ts            # clientSchema
  services/schemas.ts           # serviceSchema
  products/schemas.ts           # productSchema
  team/schemas.ts               # staffMemberSchema
  suppliers/schemas.ts          # supplierSchema
  appointments/schemas.ts       # appointmentSchema
  settings/schemas.ts           # salonSettingsSchema, expenseCategorySchema, recurringExpenseSchema
  accounting/schemas.ts         # expenseSchema
```

## Known Issues Resolved by This Plan

- ~~No form validation~~ → Zod schemas on all forms
- ~~No error boundaries~~ → Module-level error boundaries
- ~~Mutation errors logged to console only~~ → User-facing toast notifications
