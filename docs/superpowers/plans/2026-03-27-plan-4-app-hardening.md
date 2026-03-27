# Plan 4: App Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Zod form validation, toast-based mutation error handling, and error boundaries to make the app production-ready.

**Architecture:** Three independent layers — (1) a generic `useFormValidation` hook + per-module Zod schemas wired into each form, (2) a `useMutationToast` hook providing `toastOnError` callbacks that replace `console.error` in all 18 mutations, (3) a reusable `ErrorBoundary` class component wrapping each module route in App.tsx.

**Tech Stack:** Zod (validation), React class component (error boundary), existing TanStack Query + ToastContext

---

## File Structure

```
hooks/
  useFormValidation.ts          # NEW — Generic Zod validation hook
  useMutationToast.ts           # NEW — Toast callback factory for mutations

components/
  ErrorBoundary.tsx             # NEW — Module-level error boundary

modules/
  clients/schemas.ts            # NEW — clientSchema
  services/schemas.ts           # NEW — serviceSchema
  products/schemas.ts           # NEW — productSchema
  team/schemas.ts               # NEW — staffMemberSchema
  suppliers/schemas.ts          # NEW — supplierSchema
  appointments/schemas.ts       # NEW — appointmentSchema
  settings/schemas.ts           # NEW — salonSettingsSchema, expenseCategorySchema, recurringExpenseSchema
  accounting/schemas.ts         # NEW — expenseSchema

  clients/components/ClientForm.tsx           # MODIFY — wire validation
  services/components/ServiceForm.tsx         # MODIFY — wire validation
  products/components/ProductForm.tsx         # MODIFY — wire validation
  team/components/TeamForm.tsx                # MODIFY — wire validation
  suppliers/components/SupplierForm.tsx        # MODIFY — wire validation
  appointments/components/AppointmentForm.tsx  # MODIFY — wire validation
  accounting/components/ExpenseForm.tsx        # MODIFY — wire validation

  clients/hooks/useClients.ts                 # MODIFY — toastOnError
  services/hooks/useServices.ts               # MODIFY — toastOnError
  products/hooks/useProducts.ts               # MODIFY — toastOnError
  team/hooks/useTeam.ts                       # MODIFY — toastOnError
  suppliers/hooks/useSuppliers.ts             # MODIFY — toastOnError
  appointments/hooks/useAppointments.ts       # MODIFY — toastOnError
  settings/hooks/useSettings.ts               # MODIFY — toastOnError
  accounting/hooks/useAccounting.ts           # MODIFY — toastOnError
  hooks/useTransactions.ts                    # MODIFY — toastOnError

App.tsx                                       # MODIFY — wrap routes with ErrorBoundary
```

---

### Task 1: Install Zod

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Zod**

```bash
npm install zod
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(plan-4): install zod for form validation"
```

---

### Task 2: Create useFormValidation hook

**Files:**
- Create: `hooks/useFormValidation.ts`

- [ ] **Step 1: Create the hook**

```typescript
// hooks/useFormValidation.ts
import { useState, useCallback } from 'react';
import { ZodSchema, ZodError } from 'zod';

interface ValidationResult<T> {
  errors: Record<string, string>;
  validate: (data: unknown) => T | null;
  clearErrors: () => void;
  clearFieldError: (field: string) => void;
}

export function useFormValidation<T>(schema: ZodSchema<T>): ValidationResult<T> {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback(
    (data: unknown): T | null => {
      try {
        const result = schema.parse(data);
        setErrors({});
        return result;
      } catch (err) {
        if (err instanceof ZodError) {
          const fieldErrors: Record<string, string> = {};
          for (const issue of err.issues) {
            const key = issue.path.join('.');
            if (key && !fieldErrors[key]) {
              fieldErrors[key] = issue.message;
            }
          }
          setErrors(fieldErrors);
        }
        return null;
      }
    },
    [schema],
  );

  const clearErrors = useCallback(() => setErrors({}), []);

  const clearFieldError = useCallback(
    (field: string) =>
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      }),
    [],
  );

  return { errors, validate, clearErrors, clearFieldError };
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add hooks/useFormValidation.ts
git commit -m "feat(plan-4): add useFormValidation hook with Zod integration"
```

---

### Task 3: Create useMutationToast hook

**Files:**
- Create: `hooks/useMutationToast.ts`

- [ ] **Step 1: Create the hook**

```typescript
// hooks/useMutationToast.ts
import { useCallback } from 'react';
import { useToast } from '../context/ToastContext';

// Known Supabase / PostgREST error codes
const KNOWN_ERRORS: Record<string, string> = {
  '42501': "Vous n'avez pas les droits pour cette action",
  '23505': 'Cet élément existe déjà',
  '23503': 'Cet élément est référencé ailleurs et ne peut pas être modifié',
  '23P01': 'Ce créneau est déjà occupé',
};

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'Failed to fetch') return true;
  if (error instanceof Error && error.message.includes('NetworkError')) return true;
  return false;
}

function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code: string }).code;
  }
  return undefined;
}

export function useMutationToast() {
  const { addToast } = useToast();

  const toastOnError = useCallback(
    (fallbackMessage: string) => (error: unknown) => {
      let message: string;

      if (isNetworkError(error)) {
        message = 'Problème de connexion, veuillez réessayer';
      } else {
        const code = getErrorCode(error);
        message = (code && KNOWN_ERRORS[code]) || fallbackMessage;
      }

      addToast({ type: 'error', message });
    },
    [addToast],
  );

  const toastOnSuccess = useCallback(
    (message: string) => () => {
      addToast({ type: 'success', message });
    },
    [addToast],
  );

  return { toastOnError, toastOnSuccess };
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add hooks/useMutationToast.ts
git commit -m "feat(plan-4): add useMutationToast hook with error classification"
```

---

### Task 4: Create ErrorBoundary component

**Files:**
- Create: `components/ErrorBoundary.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/ErrorBoundary.tsx
import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  moduleName?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  resetKey: number;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, resetKey: 0 };
  }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(`[ErrorBoundary${this.props.moduleName ? `: ${this.props.moduleName}` : ''}]`, error, errorInfo);
  }

  handleReset = () => {
    this.props.onReset?.();
    this.setState((prev) => ({ hasError: false, resetKey: prev.resetKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const name = this.props.moduleName || 'ce module';

      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 max-w-md w-full text-center">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-amber-500" size={24} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">
              Une erreur est survenue dans {name}
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Veuillez réessayer ou revenir au tableau de bord.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium text-sm transition-all flex items-center gap-2"
              >
                <RefreshCw size={14} />
                Réessayer
              </button>
              <a
                href="#/dashboard"
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium text-sm transition-all flex items-center gap-2"
              >
                <Home size={14} />
                Tableau de bord
              </a>
            </div>
          </div>
        </div>
      );
    }

    return <div key={this.state.resetKey}>{this.props.children}</div>;
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/ErrorBoundary.tsx
git commit -m "feat(plan-4): add ErrorBoundary component with resetKey remount pattern"
```

---

### Task 5: Create client schema and wire ClientForm validation

**Files:**
- Create: `modules/clients/schemas.ts`
- Modify: `modules/clients/components/ClientForm.tsx`

- [ ] **Step 1: Create client schema**

```typescript
// modules/clients/schemas.ts
import { z } from 'zod';

export const clientSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  email: z.union([
    z.string().email('L\'email n\'est pas valide'),
    z.string().length(0),
  ]).optional().default(''),
  phone: z.string().optional().default(''),
});
```

- [ ] **Step 2: Wire validation into ClientForm**

In `modules/clients/components/ClientForm.tsx`, add the imports at the top:

```typescript
import { useFormValidation } from '../../../hooks/useFormValidation';
import { clientSchema } from '../schemas';
```

Replace the `handleSubmit` function (lines 64-69):

```typescript
  const { errors, validate, clearFieldError } = useFormValidation(clientSchema);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validated = validate(formData);
    if (validated) {
      onSave(formData as Client);
    }
  };
```

Add `error` prop and `clearFieldError` to the firstName Input (around line 144-151):

```typescript
                   <Input
                     label="Prénom"
                     required
                     value={formData.firstName}
                     onChange={e => {
                       setFormData({...formData, firstName: e.target.value});
                       clearFieldError('firstName');
                     }}
                     placeholder="Ex: Sophie"
                     error={errors.firstName}
                   />
```

Add `error` prop and `clearFieldError` to the lastName Input (around line 155-160):

```typescript
                   <Input
                     label="Nom"
                     required
                     value={formData.lastName}
                     onChange={e => {
                       setFormData({...formData, lastName: e.target.value});
                       clearFieldError('lastName');
                     }}
                     placeholder="Ex: Martin"
                     error={errors.lastName}
                   />
```

Add `error` prop and `clearFieldError` to the email Input (around line 306-312):

```typescript
               <Input
                  label="Email"
                  required
                  type="email"
                  value={formData.email}
                  onChange={e => {
                    setFormData({...formData, email: e.target.value});
                    clearFieldError('email');
                  }}
                  placeholder="exemple@email.com"
                  error={errors.email}
               />
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add modules/clients/schemas.ts modules/clients/components/ClientForm.tsx
git commit -m "feat(plan-4): add Zod validation to ClientForm"
```

---

### Task 6: Create service schema and wire ServiceForm validation

**Files:**
- Create: `modules/services/schemas.ts`
- Modify: `modules/services/components/ServiceForm.tsx`

- [ ] **Step 1: Create service schema**

```typescript
// modules/services/schemas.ts
import { z } from 'zod';

export const serviceVariantSchema = z.object({
  name: z.string().min(1, 'Le nom de la variante est requis'),
  durationMinutes: z.number().gt(0, 'La durée doit être supérieure à 0'),
  price: z.number().min(0, 'Le prix doit être positif'),
  cost: z.number().min(0, 'Le coût doit être positif'),
});

export const serviceSchema = z.object({
  name: z.string().min(1, 'Le nom du service est requis'),
  categoryId: z.string().min(1, 'La catégorie est requise'),
  variants: z.array(serviceVariantSchema).min(1, 'Au moins une variante est requise'),
});
```

- [ ] **Step 2: Wire validation into ServiceForm**

In `modules/services/components/ServiceForm.tsx`, add imports:

```typescript
import { useFormValidation } from '../../../hooks/useFormValidation';
import { serviceSchema } from '../schemas';
```

Add the validation hook inside the component, before `handleSubmit`:

```typescript
  const { errors, validate, clearFieldError } = useFormValidation(serviceSchema);
```

Replace the existing `handleSubmit` (or the save button's onClick) to validate first:

```typescript
  const handleSave = () => {
    const validated = validate(formData);
    if (validated) {
      onSave(formData as Service);
    }
  };
```

Wire `error` props to the name Input and categoryId Select, and add `clearFieldError` to their onChange handlers. Add `error={errors.name}` to the name Input, `error={errors.categoryId}` to the category Select.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add modules/services/schemas.ts modules/services/components/ServiceForm.tsx
git commit -m "feat(plan-4): add Zod validation to ServiceForm"
```

---

### Task 7: Create product schema and wire ProductForm validation

**Files:**
- Create: `modules/products/schemas.ts`
- Modify: `modules/products/components/ProductForm.tsx`

- [ ] **Step 1: Create product schema**

```typescript
// modules/products/schemas.ts
import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(1, 'Le nom du produit est requis'),
  categoryId: z.string().min(1, 'La catégorie est requise'),
  price: z.number().min(0, 'Le prix doit être positif'),
  cost: z.number().min(0, 'Le coût doit être positif'),
  stock: z.number().int('Le stock doit être un nombre entier').min(0, 'Le stock doit être positif'),
});
```

- [ ] **Step 2: Wire validation into ProductForm**

In `modules/products/components/ProductForm.tsx`, add imports:

```typescript
import { useFormValidation } from '../../../hooks/useFormValidation';
import { productSchema } from '../schemas';
```

Add hook and replace save handler to validate before calling `onSave`. Wire `error={errors.name}`, `error={errors.categoryId}`, `error={errors.price}`, `error={errors.stock}` to the respective inputs. Add `clearFieldError` calls to each onChange.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add modules/products/schemas.ts modules/products/components/ProductForm.tsx
git commit -m "feat(plan-4): add Zod validation to ProductForm"
```

---

### Task 8: Create team schema and wire TeamForm validation

**Files:**
- Create: `modules/team/schemas.ts`
- Modify: `modules/team/components/TeamForm.tsx`

- [ ] **Step 1: Create team schema**

```typescript
// modules/team/schemas.ts
import { z } from 'zod';

export const staffMemberSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  email: z.union([
    z.string().email('L\'email n\'est pas valide'),
    z.string().length(0),
  ]).optional().default(''),
  phone: z.string().optional().default(''),
  role: z.enum(['Manager', 'Stylist', 'Assistant', 'Receptionist'], {
    errorMap: () => ({ message: 'Le rôle est requis' }),
  }),
});
```

- [ ] **Step 2: Wire validation into TeamForm**

In `modules/team/components/TeamForm.tsx`, add imports:

```typescript
import { useFormValidation } from '../../../hooks/useFormValidation';
import { staffMemberSchema } from '../schemas';
```

Add hook inside component. Replace `handleSubmit` to validate first:

```typescript
  const { errors, validate, clearFieldError } = useFormValidation(staffMemberSchema);

  const handleSubmit = () => {
    const validated = validate(formData);
    if (validated) {
      onSave(formData as StaffMember);
    }
  };
```

Wire `error` props to firstName, lastName, email, role fields. Add `clearFieldError` to each onChange.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add modules/team/schemas.ts modules/team/components/TeamForm.tsx
git commit -m "feat(plan-4): add Zod validation to TeamForm"
```

---

### Task 9: Create supplier schema and wire SupplierForm validation

**Files:**
- Create: `modules/suppliers/schemas.ts`
- Modify: `modules/suppliers/components/SupplierForm.tsx`

- [ ] **Step 1: Create supplier schema**

```typescript
// modules/suppliers/schemas.ts
import { z } from 'zod';

export const supplierSchema = z.object({
  name: z.string().min(1, 'Le nom du fournisseur est requis'),
  email: z.union([
    z.string().email('L\'email n\'est pas valide'),
    z.string().length(0),
  ]).optional().default(''),
  phone: z.string().optional().default(''),
  contactName: z.string().optional().default(''),
  category: z.string().min(1, 'La catégorie est requise'),
});
```

- [ ] **Step 2: Wire validation into SupplierForm**

In `modules/suppliers/components/SupplierForm.tsx`, add imports:

```typescript
import { useFormValidation } from '../../../hooks/useFormValidation';
import { supplierSchema } from '../schemas';
```

Add hook inside component. Replace save handler to validate first. Wire `error` props to name, email, category fields. Add `clearFieldError` to each onChange.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add modules/suppliers/schemas.ts modules/suppliers/components/SupplierForm.tsx
git commit -m "feat(plan-4): add Zod validation to SupplierForm"
```

---

### Task 10: Create appointment schema and wire AppointmentForm validation

**Files:**
- Create: `modules/appointments/schemas.ts`
- Modify: `modules/appointments/components/AppointmentForm.tsx`

- [ ] **Step 1: Create appointment schema**

```typescript
// modules/appointments/schemas.ts
import { z } from 'zod';

export const appointmentSchema = z.object({
  clientId: z.string().min(1, 'Le client est requis'),
  staffId: z.string().min(1, "Le membre de l'équipe est requis"),
  serviceId: z.string().min(1, 'Le service est requis'),
  date: z.string().min(1, 'La date est requise').refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'La date n\'est pas valide' },
  ),
});
```

- [ ] **Step 2: Wire validation into AppointmentForm**

In `modules/appointments/components/AppointmentForm.tsx`, add imports:

```typescript
import { useFormValidation } from '../../../hooks/useFormValidation';
import { appointmentSchema } from '../schemas';
```

Add hook inside component. Modify `handleSubmit` (lines 35-57) to validate before building final data:

```typescript
  const { errors, validate, clearFieldError } = useFormValidation(appointmentSchema);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validated = validate(formData);
    if (!validated) return;

    // Ensure names are populated if using ID-based selection
    const finalData = { ...formData };

    if (finalData.clientId) {
      const c = clients.find(cl => cl.id === finalData.clientId);
      if (c) finalData.clientName = `${c.firstName} ${c.lastName}`;
    }

    if (finalData.serviceId) {
      const s = services.find(sv => sv.id === finalData.serviceId);
      if (s) finalData.serviceName = s.name;
    }

    if (finalData.staffId) {
      const t = team.find(tm => tm.id === finalData.staffId);
      if (t) finalData.staffName = `${t.firstName} ${t.lastName}`;
    }

    onSave(finalData as Appointment);
  };
```

Wire `error` props: `error={errors.date}` to the date Input, `error={errors.clientId}` to the client Select, `error={errors.serviceId}` to the service Select, `error={errors.staffId}` to the staff Select. Add `clearFieldError` calls to `handleClientChange`, `handleServiceChange`, `handleStaffChange`, and the date onChange.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add modules/appointments/schemas.ts modules/appointments/components/AppointmentForm.tsx
git commit -m "feat(plan-4): add Zod validation to AppointmentForm"
```

---

### Task 11: Create settings/accounting schemas and wire ExpenseForm validation

**Files:**
- Create: `modules/settings/schemas.ts`
- Create: `modules/accounting/schemas.ts`
- Modify: `modules/accounting/components/ExpenseForm.tsx`

- [ ] **Step 1: Create settings schemas**

```typescript
// modules/settings/schemas.ts
import { z } from 'zod';

export const salonSettingsSchema = z.object({
  name: z.string().min(1, 'Le nom du salon est requis'),
  email: z.union([
    z.string().email('L\'email n\'est pas valide'),
    z.string().length(0),
  ]).optional().default(''),
  vatRate: z.number().min(0, 'Le taux TVA doit être entre 0 et 100').max(100, 'Le taux TVA doit être entre 0 et 100'),
});

export const expenseCategorySchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale requise'),
});

export const recurringExpenseSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  amount: z.number().gt(0, 'Le montant doit être supérieur à 0'),
  frequency: z.enum(['Mensuel', 'Annuel', 'Hebdomadaire'], {
    errorMap: () => ({ message: 'La fréquence est requise' }),
  }),
  nextDate: z.string().min(1, 'La prochaine date est requise'),
});
```

- [ ] **Step 2: Create expense schema**

```typescript
// modules/accounting/schemas.ts
import { z } from 'zod';

export const expenseSchema = z.object({
  description: z.string().min(1, 'La description est requise'),
  amount: z.number().gt(0, 'Le montant doit être supérieur à 0'),
  date: z.string().min(1, 'La date est requise'),
  category: z.string().min(1, 'La catégorie est requise'),
});
```

- [ ] **Step 3: Wire validation into ExpenseForm**

In `modules/accounting/components/ExpenseForm.tsx`, add imports:

```typescript
import { useFormValidation } from '../../../hooks/useFormValidation';
import { expenseSchema } from '../schemas';
```

Add hook inside component. Replace `handleSubmit` (lines 29-43):

```typescript
  const { errors, validate, clearFieldError } = useFormValidation(expenseSchema);

  const handleSubmit = () => {
    const validated = validate(formData);
    if (!validated) return;

    const selectedSupplier = !isCustomSupplier
      ? suppliers.find(s => s.id === formData.supplier)
      : undefined;
    onSave({
      id: crypto.randomUUID(),
      description: formData.description!,
      amount: Number(formData.amount),
      date: formData.date || new Date().toISOString(),
      category: (formData.category || expenseCategories[0]?.id) as ExpenseCategory,
      supplier: selectedSupplier?.name ?? formData.supplier,
      supplierId: selectedSupplier?.id,
    });
  };
```

Wire `error` props: `error={errors.description}` to the description Input, `error={errors.amount}` to the amount Input, `error={errors.date}` to the date Input, `error={errors.category}` to the category Select. Add `clearFieldError` to each onChange.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add modules/settings/schemas.ts modules/accounting/schemas.ts modules/accounting/components/ExpenseForm.tsx
git commit -m "feat(plan-4): add Zod validation to ExpenseForm, create settings and accounting schemas"
```

---

### Task 12: Wire toastOnError to clients, services, products hooks

**Files:**
- Modify: `modules/clients/hooks/useClients.ts`
- Modify: `modules/services/hooks/useServices.ts`
- Modify: `modules/products/hooks/useProducts.ts`

- [ ] **Step 1: Update useClients**

In `modules/clients/hooks/useClients.ts`, add import:

```typescript
import { useMutationToast } from '../../../hooks/useMutationToast';
```

Inside `useClients`, add:

```typescript
  const { toastOnError } = useMutationToast();
```

Replace the three `onError` callbacks:

Line 57: `onError: (error) => console.error('Failed to add client:', error.message),`
→ `onError: toastOnError("Impossible d'ajouter le client"),`

Line 71: `onError: (error) => console.error('Failed to update client:', error.message),`
→ `onError: toastOnError("Impossible de modifier le client"),`

Line 86: `onError: (error) => console.error('Failed to delete client:', error.message),`
→ `onError: toastOnError("Impossible de supprimer le client"),`

- [ ] **Step 2: Update useServices**

In `modules/services/hooks/useServices.ts`, add import:

```typescript
import { useMutationToast } from '../../../hooks/useMutationToast';
```

Inside `useServices`, add:

```typescript
  const { toastOnError } = useMutationToast();
```

Replace the three `onError` callbacks:

Line 76: `onError: (error) => console.error('Failed to add service:', error.message),`
→ `onError: toastOnError("Impossible d'ajouter le service"),`

Line 136: `onError: (error) => console.error('Failed to update service:', error.message),`
→ `onError: toastOnError("Impossible de modifier le service"),`

Line 181: `onError: (error) => console.error('Failed to update service categories:', error.message),`
→ `onError: toastOnError("Impossible de modifier les catégories de services"),`

- [ ] **Step 3: Update useProducts**

In `modules/products/hooks/useProducts.ts`, add import:

```typescript
import { useMutationToast } from '../../../hooks/useMutationToast';
```

Inside `useProducts`, add:

```typescript
  const { toastOnError } = useMutationToast();
```

Replace the three `onError` callbacks:

Line 60: `onError: (error) => console.error('Failed to add product:', error.message),`
→ `onError: toastOnError("Impossible d'ajouter le produit"),`

Line 75: `onError: (error) => console.error('Failed to update product:', error.message),`
→ `onError: toastOnError("Impossible de modifier le produit"),`

Line 122: `onError: (error) => console.error('Failed to update product categories:', error.message),`
→ `onError: toastOnError("Impossible de modifier les catégories de produits"),`

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add modules/clients/hooks/useClients.ts modules/services/hooks/useServices.ts modules/products/hooks/useProducts.ts
git commit -m "feat(plan-4): wire toastOnError to clients, services, products mutations"
```

---

### Task 13: Wire toastOnError to team, suppliers, appointments hooks

**Files:**
- Modify: `modules/team/hooks/useTeam.ts`
- Modify: `modules/suppliers/hooks/useSuppliers.ts`
- Modify: `modules/appointments/hooks/useAppointments.ts`

- [ ] **Step 1: Update useTeam**

In `modules/team/hooks/useTeam.ts`, add import:

```typescript
import { useMutationToast } from '../../../hooks/useMutationToast';
```

Inside `useTeam`, add:

```typescript
  const { toastOnError } = useMutationToast();
```

Replace:

Line 41: `onError: (error) => console.error('Failed to add staff member:', error.message),`
→ `onError: toastOnError("Impossible d'ajouter le membre de l'équipe"),`

Line 56: `onError: (error) => console.error('Failed to update staff member:', error.message),`
→ `onError: toastOnError("Impossible de modifier le membre de l'équipe"),`

- [ ] **Step 2: Update useSuppliers**

In `modules/suppliers/hooks/useSuppliers.ts`, add import:

```typescript
import { useMutationToast } from '../../../hooks/useMutationToast';
```

Inside `useSuppliers`, add:

```typescript
  const { toastOnError } = useMutationToast();
```

Replace:

Line 42: `onError: (error) => console.error('Failed to add supplier:', error.message),`
→ `onError: toastOnError("Impossible d'ajouter le fournisseur"),`

Line 57: `onError: (error) => console.error('Failed to update supplier:', error.message),`
→ `onError: toastOnError("Impossible de modifier le fournisseur"),`

- [ ] **Step 3: Update useAppointments**

In `modules/appointments/hooks/useAppointments.ts`, add import:

```typescript
import { useMutationToast } from '../../../hooks/useMutationToast';
```

Inside `useAppointments`, add:

```typescript
  const { toastOnError } = useMutationToast();
```

Replace:

Line 58: `onError: (error) => console.error('Failed to add appointment:', error.message),`
→ `onError: toastOnError("Impossible d'ajouter le rendez-vous"),`

Line 78: `onError: (error) => console.error('Failed to update appointment:', error.message),`
→ `onError: toastOnError("Impossible de modifier le rendez-vous"),`

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add modules/team/hooks/useTeam.ts modules/suppliers/hooks/useSuppliers.ts modules/appointments/hooks/useAppointments.ts
git commit -m "feat(plan-4): wire toastOnError to team, suppliers, appointments mutations"
```

---

### Task 14: Wire toastOnError to settings, accounting, transactions hooks

**Files:**
- Modify: `modules/settings/hooks/useSettings.ts`
- Modify: `modules/accounting/hooks/useAccounting.ts`
- Modify: `hooks/useTransactions.ts`

- [ ] **Step 1: Update useSettings**

In `modules/settings/hooks/useSettings.ts`, add import:

```typescript
import { useMutationToast } from '../../../hooks/useMutationToast';
```

Inside `useSettings`, add:

```typescript
  const { toastOnError, toastOnSuccess } = useMutationToast();
```

Replace `onError` callbacks:

Line 58: `onError: (error) => console.error('Failed to update salon settings:', error.message),`
→ `onError: toastOnError("Impossible de modifier les paramètres du salon"),`

Line 121: `onError: (error) => console.error('Failed to update expense categories:', error.message),`
→ `onError: toastOnError("Impossible de modifier les catégories de dépenses"),`

Line 183: `onError: (error) => console.error('Failed to update recurring expenses:', error.message),`
→ `onError: toastOnError("Impossible de modifier les dépenses récurrentes"),`

Also add success toast to the settings mutation `onSuccess` (line 53-57). After the existing `refreshActiveSalon` call, add:

```typescript
      toastOnSuccess('Paramètres enregistrés')();
```

- [ ] **Step 2: Update useAccounting**

In `modules/accounting/hooks/useAccounting.ts`, add import:

```typescript
import { useMutationToast } from '../../../hooks/useMutationToast';
```

Inside `useAccounting`, add:

```typescript
  const { toastOnError } = useMutationToast();
```

Replace:

Lines 47-49:
```typescript
    onError: (error: Error) => {
      console.error('Failed to add expense:', error.message);
    },
```
→ `onError: toastOnError("Impossible d'ajouter la dépense"),`

- [ ] **Step 3: Update useTransactions**

In `hooks/useTransactions.ts`, add import:

```typescript
import { useMutationToast } from './useMutationToast';
```

Inside `useTransactions`, add:

```typescript
  const { toastOnError } = useMutationToast();
```

Replace the entire `onError` block (lines 48-57):

```typescript
    onError: toastOnError("Impossible de créer la transaction"),
```

Note: The specific French error messages for double-booking and permissions that were in the old `onError` handler will now be handled by the `useMutationToast` error classification — RLS violation (`42501`) maps to the permissions message, and the custom error thrown by the RPC for payment mismatch will use the fallback message.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add modules/settings/hooks/useSettings.ts modules/accounting/hooks/useAccounting.ts hooks/useTransactions.ts
git commit -m "feat(plan-4): wire toastOnError to settings, accounting, transactions mutations"
```

---

### Task 15: Wrap module routes with ErrorBoundary in App.tsx

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add ErrorBoundary import**

In `App.tsx`, add import at line 7 (after ProtectedRoute import):

```typescript
import { ErrorBoundary } from './components/ErrorBoundary';
```

- [ ] **Step 2: Wrap each route**

Replace the Routes block inside `AppContent` (lines 35-67) with:

```typescript
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={
          <ProtectedRoute action="view" resource="dashboard">
            <ErrorBoundary moduleName="Tableau de bord"><DashboardModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/services" element={
          <ProtectedRoute action="view" resource="services">
            <ErrorBoundary moduleName="Services"><ServicesModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/clients" element={
          <ProtectedRoute action="view" resource="clients">
            <ErrorBoundary moduleName="Clients"><ClientsModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/team" element={
          <ProtectedRoute action="view" resource="team">
            <ErrorBoundary moduleName="Équipe"><TeamModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/calendar" element={
          <ProtectedRoute action="view" resource="appointments">
            <ErrorBoundary moduleName="Rendez-vous"><AppointmentsModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/products" element={
          <ProtectedRoute action="view" resource="products">
            <ErrorBoundary moduleName="Produits"><ProductsModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/suppliers" element={
          <ProtectedRoute action="view" resource="suppliers">
            <ErrorBoundary moduleName="Fournisseurs"><SuppliersModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute action="view" resource="settings">
            <ErrorBoundary moduleName="Paramètres"><SettingsModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/pos" element={
          <ProtectedRoute action="view" resource="pos">
            <ErrorBoundary moduleName="Caisse"><POSModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/accounting" element={
          <ProtectedRoute action="view" resource="accounting">
            <ErrorBoundary moduleName="Comptabilité"><AccountingModule /></ErrorBoundary>
          </ProtectedRoute>
        } />
      </Routes>
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat(plan-4): wrap all module routes with ErrorBoundary"
```

---

### Task 16: Update CLAUDE.md with Plan 4 documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Known Issues**

In the `## Known Issues to Fix` section, mark items 8 and 9 as done:

```markdown
8. ~~No form validation~~ (DONE — Plan 4, Zod schemas)
9. ~~No error boundaries~~ (DONE — Plan 4, module-level ErrorBoundary)
```

- [ ] **Step 2: Add Form Validation section**

After the `### Connection Status` section, add:

```markdown
### Form Validation
- `hooks/useFormValidation.ts` — generic hook wrapping Zod schema validation
- Per-module schemas at `modules/{module}/schemas.ts`
- Validates on submit, clears individual field errors on change
- French error messages defined inline in Zod schemas
- FormElements accept `error` prop to display field-level errors

### Mutation Error Handling
- `hooks/useMutationToast.ts` — callback factory for mutation `onError`
- `toastOnError(fallbackMessage)` — inspects Supabase error codes, falls back to provided French message
- Known codes: RLS violation, unique constraint, network error
- All 18 mutations across 9 hooks use toastOnError (no more console.error)

### Error Boundaries
- `components/ErrorBoundary.tsx` — React class component wrapping each module route
- On crash: shows French error card with "Réessayer" (remount) and "Tableau de bord" (escape)
- resetKey pattern forces full subtree remount → fresh queries → fresh data
- Layout (sidebar, header, connection status) survives any module crash
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(plan-4): update CLAUDE.md with validation, error toasts, and error boundary docs"
```
