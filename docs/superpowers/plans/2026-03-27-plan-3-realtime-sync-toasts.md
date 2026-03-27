# Plan 3: Real-Time Sync & Toast Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time cache invalidation via Supabase Realtime, a toast notification system, and a connection status indicator so all connected clients stay in sync.

**Architecture:** A shared `useRealtimeSync` hook with reference-counted subscriptions is called as a one-liner in each module hook. A split-context toast system (`ToastDispatchContext` + `ToastStateContext`) provides `useToast()` for user feedback. A `useConnectionStatus` hook monitors WebSocket health and shows a dot indicator + disconnect banner.

**Tech Stack:** React 19, TypeScript, Supabase JS v2 (Realtime), TanStack Query v5, Tailwind CSS, Lucide React icons

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `hooks/useRealtimeSync.ts` | Shared hook + module-level subscription manager with ref counting |
| `hooks/useConnectionStatus.ts` | Monitor Supabase Realtime WebSocket state, expose `'connected' \| 'reconnecting' \| 'disconnected'` |
| `context/ToastContext.tsx` | `ToastProvider` with split dispatch/state contexts, `useToast()` hook |
| `components/Toast.tsx` | Presentational toast renderer, portal to `#toast-root` |
| `components/ConnectionStatus.tsx` | Green/orange/red dot in top bar + disconnect banner |

### Modified Files

| File | Change |
|------|--------|
| `index.html` | Add `<div id="toast-root">` |
| `App.tsx` | Wrap with `ToastProvider` |
| `components/Layout.tsx` | Add `ConnectionStatus` to top bar |
| `hooks/useTransactions.ts` | Add `useRealtimeSync('transactions')` |
| `modules/clients/hooks/useClients.ts` | Add `useRealtimeSync('clients')` |
| `modules/services/hooks/useServices.ts` | Add `useRealtimeSync('services')` + `useRealtimeSync('service_categories')` |
| `modules/products/hooks/useProducts.ts` | Add `useRealtimeSync('products')` + `useRealtimeSync('product_categories')` |
| `modules/suppliers/hooks/useSuppliers.ts` | Add `useRealtimeSync('suppliers')` |
| `modules/team/hooks/useTeam.ts` | Add `useRealtimeSync('staff_members')` |
| `modules/appointments/hooks/useAppointments.ts` | Add `useRealtimeSync('appointments')` + toast on new appointments |
| `modules/settings/hooks/useSettings.ts` | Add `useRealtimeSync('salons')` + `useRealtimeSync('expense_categories')` |
| `modules/accounting/hooks/useAccounting.ts` | Add `useRealtimeSync('expenses')` |

---

### Task 1: Toast Context and Provider

**Files:**
- Create: `context/ToastContext.tsx`

This is the foundation — other tasks depend on `useToast()` being available.

- [ ] **Step 1: Create the toast context with split dispatch/state pattern**

Create `context/ToastContext.tsx` with the following complete content:

```tsx
import React, { createContext, useCallback, useContext, useReducer, useRef } from 'react';

// --- Types ---

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

export interface AddToastInput {
  type: ToastType;
  message: string;
  duration?: number;
}

// --- State & Actions ---

interface ToastState {
  toasts: Toast[];
}

type ToastAction =
  | { type: 'ADD'; toast: Toast }
  | { type: 'REMOVE'; id: string };

const MAX_VISIBLE = 3;
const MAX_QUEUE = 10;

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD': {
      const updated = [...state.toasts, action.toast];
      // Cap total (visible + queued) at MAX_VISIBLE + MAX_QUEUE
      if (updated.length > MAX_VISIBLE + MAX_QUEUE) {
        // Drop oldest queued (index MAX_VISIBLE is first queued)
        updated.splice(MAX_VISIBLE, 1);
      }
      return { toasts: updated };
    }
    case 'REMOVE':
      return { toasts: state.toasts.filter(t => t.id !== action.id) };
    default:
      return state;
  }
}

// --- Contexts ---

const ToastDispatchContext = createContext<{
  addToast: (input: AddToastInput) => void;
  removeToast: (id: string) => void;
} | null>(null);

const ToastStateContext = createContext<ToastState>({ toasts: [] });

// --- Provider ---

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 5000,
  info: 5000,
  warning: 5000,
  error: 0, // errors don't auto-dismiss
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(toastReducer, { toasts: [] });
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    dispatch({ type: 'REMOVE', id });
  }, []);

  const addToast = useCallback((input: AddToastInput) => {
    const id = crypto.randomUUID();
    const duration = input.duration ?? DEFAULT_DURATIONS[input.type];
    const toast: Toast = { id, type: input.type, message: input.message, duration };

    dispatch({ type: 'ADD', toast });

    if (duration > 0) {
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        dispatch({ type: 'REMOVE', id });
      }, duration);
      timersRef.current.set(id, timer);
    }
  }, []);

  // Stable dispatch ref — never changes, prevents consumer re-renders
  const dispatchValue = useRef({ addToast, removeToast }).current;

  return (
    <ToastDispatchContext.Provider value={dispatchValue}>
      <ToastStateContext.Provider value={state}>
        {children}
      </ToastStateContext.Provider>
    </ToastDispatchContext.Provider>
  );
};

// --- Hooks ---

export const useToast = () => {
  const ctx = useContext(ToastDispatchContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const useToastState = () => {
  return useContext(ToastStateContext);
};
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds (file is created but not yet imported anywhere)

- [ ] **Step 3: Commit**

```bash
git add context/ToastContext.tsx
git commit -m "feat(plan-3): add toast context with split dispatch/state pattern"
```

---

### Task 2: Toast Presentational Component

**Files:**
- Create: `components/Toast.tsx`
- Modify: `index.html` — add `<div id="toast-root">`

- [ ] **Step 1: Add toast-root div to index.html**

In `index.html`, add `<div id="toast-root"></div>` after the `<div id="root">` div:

```html
    <div id="root"></div>
    <div id="toast-root"></div>
```

- [ ] **Step 2: Create the Toast component**

Create `components/Toast.tsx` with the following complete content:

```tsx
import React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastState, useToast } from '../context/ToastContext';
import type { ToastType } from '../context/ToastContext';

const TOAST_STYLES: Record<ToastType, { border: string; icon: string; bg: string }> = {
  success: { border: 'border-l-emerald-500', icon: 'text-emerald-500', bg: 'bg-white' },
  error: { border: 'border-l-red-500', icon: 'text-red-500', bg: 'bg-white' },
  warning: { border: 'border-l-amber-500', icon: 'text-amber-500', bg: 'bg-white' },
  info: { border: 'border-l-blue-500', icon: 'text-blue-500', bg: 'bg-white' },
};

const TOAST_ICONS: Record<ToastType, React.FC<{ size: number; className: string }>> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export const ToastContainer: React.FC = () => {
  const { toasts } = useToastState();
  const { removeToast } = useToast();

  const portalTarget = document.getElementById('toast-root');
  if (!portalTarget) return null;

  // Show only first MAX_VISIBLE toasts
  const visible = toasts.slice(0, 3);

  return createPortal(
    <div
      className="fixed top-20 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {visible.map((toast) => {
        const styles = TOAST_STYLES[toast.type];
        const Icon = TOAST_ICONS[toast.type];

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border border-slate-200 border-l-4 ${styles.border} ${styles.bg} min-w-[320px] max-w-[420px] animate-in slide-in-from-right duration-300`}
            role="alert"
          >
            <Icon size={18} className={`${styles.icon} shrink-0 mt-0.5`} />
            <p className="text-sm text-slate-700 flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Fermer"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>,
    portalTarget
  );
};
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add components/Toast.tsx index.html
git commit -m "feat(plan-3): add Toast component with portal rendering"
```

---

### Task 3: Wire ToastProvider into App

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add ToastProvider and ToastContainer to App.tsx**

Add these imports at the top of `App.tsx`, after the existing imports:

```typescript
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/Toast';
```

Then wrap the `<AuthProvider>` content with `<ToastProvider>` and add `<ToastContainer />`. Change the `App` component from:

```tsx
export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
```

To:

```tsx
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
```

And the closing from:

```tsx
        </Routes>
      </HashRouter>
    </AuthProvider>
```

To:

```tsx
          </Routes>
        </HashRouter>
        <ToastContainer />
      </ToastProvider>
    </AuthProvider>
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add App.tsx
git commit -m "feat(plan-3): wire ToastProvider and ToastContainer into App"
```

---

### Task 4: useRealtimeSync Hook with Subscription Manager

**Files:**
- Create: `hooks/useRealtimeSync.ts`

This is the core real-time hook. All module hooks will call this.

- [ ] **Step 1: Create the useRealtimeSync hook**

Create `hooks/useRealtimeSync.ts` with the following complete content:

```typescript
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// --- Subscription Manager (module-level singleton) ---

interface Subscription {
  channel: RealtimeChannel;
  refCount: number;
}

const subscriptions = new Map<string, Subscription>();

function subscribe(
  tableName: string,
  salonId: string,
  onEvent: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
): () => void {
  const key = `${tableName}:${salonId}`;

  const existing = subscriptions.get(key);
  if (existing) {
    existing.refCount++;
    return () => unsubscribe(key);
  }

  const channel = supabase
    .channel(`realtime:${key}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: tableName,
        filter: `salon_id=eq.${salonId}`,
      },
      onEvent,
    )
    .subscribe();

  subscriptions.set(key, { channel, refCount: 1 });

  return () => unsubscribe(key);
}

function unsubscribe(key: string) {
  const sub = subscriptions.get(key);
  if (!sub) return;

  sub.refCount--;
  if (sub.refCount <= 0) {
    supabase.removeChannel(sub.channel);
    subscriptions.delete(key);
  }
}

// --- Public Hook ---

export interface RealtimeSyncOptions {
  onEvent?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
}

export function useRealtimeSync(tableName: string, options?: RealtimeSyncOptions) {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();

  // Store onEvent in a ref to avoid re-subscribing when the callback changes
  const onEventRef = useRef(options?.onEvent);
  onEventRef.current = options?.onEvent;

  useEffect(() => {
    if (!salonId) return;

    const unsub = subscribe(tableName, salonId, (payload) => {
      // Invalidate TanStack Query cache for this table
      queryClient.invalidateQueries({ queryKey: [tableName, salonId] });

      // Call optional per-module event handler
      onEventRef.current?.(payload);
    });

    return unsub;
  }, [tableName, salonId, queryClient]);
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add hooks/useRealtimeSync.ts
git commit -m "feat(plan-3): add useRealtimeSync hook with ref-counted subscription manager"
```

---

### Task 5: useConnectionStatus Hook

**Files:**
- Create: `hooks/useConnectionStatus.ts`

- [ ] **Step 1: Create the useConnectionStatus hook**

Create `hooks/useConnectionStatus.ts` with the following complete content:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

const DISCONNECT_THRESHOLD_MS = 30_000;

export function useConnectionStatus(): ConnectionState {
  const [state, setState] = useState<ConnectionState>('connected');
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const disconnectedAtRef = useRef<number | null>(null);
  const wasDisconnectedRef = useRef(false);

  const evaluateState = useCallback(() => {
    if (disconnectedAtRef.current === null) {
      // Connected
      if (wasDisconnectedRef.current) {
        wasDisconnectedRef.current = false;
        // Reconnected — invalidate active queries to catch up
        queryClient.invalidateQueries({ refetchType: 'active' });
        addToast({ type: 'success', message: 'Connexion rétablie' });
      }
      setState('connected');
      return;
    }

    const elapsed = Date.now() - disconnectedAtRef.current;
    if (elapsed >= DISCONNECT_THRESHOLD_MS) {
      setState('disconnected');
    } else {
      setState('reconnecting');
    }
  }, [queryClient, addToast]);

  useEffect(() => {
    const channel = supabase
      .channel('connection-monitor')
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          disconnectedAtRef.current = null;
          evaluateState();
        } else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          if (disconnectedAtRef.current === null) {
            disconnectedAtRef.current = Date.now();
            wasDisconnectedRef.current = true;
          }
          evaluateState();
        }
      });

    // Timer to transition from reconnecting → disconnected after 30s
    const interval = setInterval(() => {
      if (disconnectedAtRef.current !== null) {
        evaluateState();
      }
    }, 5000);

    // Re-evaluate on tab visibility change (timers may have drifted)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        evaluateState();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [evaluateState]);

  return state;
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add hooks/useConnectionStatus.ts
git commit -m "feat(plan-3): add useConnectionStatus hook with timestamp-based tracking"
```

---

### Task 6: ConnectionStatus Component

**Files:**
- Create: `components/ConnectionStatus.tsx`
- Modify: `components/Layout.tsx`

- [ ] **Step 1: Create the ConnectionStatus component**

Create `components/ConnectionStatus.tsx` with the following complete content:

```tsx
import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import type { ConnectionState } from '../hooks/useConnectionStatus';

const DOT_STYLES: Record<ConnectionState, string> = {
  connected: 'bg-emerald-500',
  reconnecting: 'bg-amber-500 animate-pulse',
  disconnected: 'bg-red-500',
};

const TOOLTIP: Record<ConnectionState, string> = {
  connected: 'Connecté',
  reconnecting: 'Reconnexion en cours...',
  disconnected: 'Connexion perdue',
};

export const ConnectionStatusDot: React.FC = () => {
  const status = useConnectionStatus();

  return (
    <div className="relative group" title={TOOLTIP[status]}>
      <div className={`w-2 h-2 rounded-full ${DOT_STYLES[status]}`} />
    </div>
  );
};

export const ConnectionBanner: React.FC = () => {
  const status = useConnectionStatus();
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (status === 'connected') setRetrying(false);
  }, [status]);

  if (status !== 'disconnected') return null;

  const handleRetry = () => {
    setRetrying(true);
    // Force reconnect by removing and re-subscribing the monitor channel
    // The useConnectionStatus hook handles this automatically on reconnect
    // We just need to trigger Supabase's internal reconnect
    supabase.realtime.connect();
    setTimeout(() => setRetrying(false), 3000);
  };

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-center gap-3 text-sm animate-in slide-in-from-top duration-300">
      <WifiOff size={16} className="text-amber-600 shrink-0" />
      <p className="text-amber-800">
        Connexion perdue — les données affichées peuvent être obsolètes
      </p>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="px-3 py-1 rounded-md bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {retrying ? 'Reconnexion...' : 'Réessayer'}
      </button>
    </div>
  );
};

// Need supabase import for the retry button
import { supabase } from '../lib/supabase';
```

- [ ] **Step 2: Add ConnectionStatus to Layout.tsx**

In `components/Layout.tsx`, add the import at the top with the other imports (after the `usePermissions` import on line 22):

```typescript
import { ConnectionStatusDot, ConnectionBanner } from './ConnectionStatus';
```

Then in the top bar header section, add the dot before the Bell button. Find this section (around line 261):

```tsx
          <div className="flex items-center gap-5 ml-auto">
            <button className="relative p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-full transition-all">
              <Bell size={20} strokeWidth={1.5} />
            </button>
```

And change it to:

```tsx
          <div className="flex items-center gap-5 ml-auto">
            <ConnectionStatusDot />
            <button className="relative p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-full transition-all">
              <Bell size={20} strokeWidth={1.5} />
            </button>
```

Then add the `ConnectionBanner` right after the `</header>` closing tag and before the scrollable content section. Find (around line 285-288):

```tsx
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-auto relative p-6 scroll-smooth custom-scrollbar">
```

And change to:

```tsx
        </header>

        <ConnectionBanner />

        {/* Scrollable Content */}
        <main className="flex-1 overflow-auto relative p-6 scroll-smooth custom-scrollbar">
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add components/ConnectionStatus.tsx components/Layout.tsx
git commit -m "feat(plan-3): add connection status dot and disconnect banner to Layout"
```

---

### Task 7: Wire useRealtimeSync into shared useTransactions hook

**Files:**
- Modify: `hooks/useTransactions.ts`

- [ ] **Step 1: Add useRealtimeSync to useTransactions**

In `hooks/useTransactions.ts`, add the import after the existing imports (after line 6):

```typescript
import { useRealtimeSync } from './useRealtimeSync';
```

Then add the hook call inside `useTransactions()`, right after the `const queryClient = useQueryClient();` line (after line 11):

```typescript
  useRealtimeSync('transactions');
```

The top of the function should look like:

```typescript
export const useTransactions = () => {
  const { activeSalon } = useAuth();
  const salonId = activeSalon?.id ?? '';
  const queryClient = useQueryClient();

  useRealtimeSync('transactions');

  const { data: transactions = [], isLoading } = useQuery({
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add hooks/useTransactions.ts
git commit -m "feat(plan-3): add real-time sync to shared useTransactions hook"
```

---

### Task 8: Wire useRealtimeSync into useClients

**Files:**
- Modify: `modules/clients/hooks/useClients.ts`

- [ ] **Step 1: Add useRealtimeSync to useClients**

In `modules/clients/hooks/useClients.ts`, add the import after line 5 (after the `useAuth` import):

```typescript
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
```

Then add the hook call inside `useClients()`, right after the `const [searchTerm, setSearchTerm] = useState('');` line (after line 13):

```typescript
  useRealtimeSync('clients');
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add modules/clients/hooks/useClients.ts
git commit -m "feat(plan-3): add real-time sync to useClients"
```

---

### Task 9: Wire useRealtimeSync into useServices

**Files:**
- Modify: `modules/services/hooks/useServices.ts`

- [ ] **Step 1: Add useRealtimeSync to useServices**

In `modules/services/hooks/useServices.ts`, add the import after line 4 (after the `useAuth` import):

```typescript
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
```

Then add two hook calls inside `useServices()`, right after the `const [searchTerm, setSearchTerm] = useState('');` line (after line 15):

```typescript
  useRealtimeSync('services');
  useRealtimeSync('service_categories');
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add modules/services/hooks/useServices.ts
git commit -m "feat(plan-3): add real-time sync to useServices"
```

---

### Task 10: Wire useRealtimeSync into useProducts

**Files:**
- Modify: `modules/products/hooks/useProducts.ts`

- [ ] **Step 1: Add useRealtimeSync to useProducts**

In `modules/products/hooks/useProducts.ts`, add the import after line 4 (after the `useAuth` import):

```typescript
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
```

Then add two hook calls inside `useProducts()`, right after the `const [searchTerm, setSearchTerm] = useState('');` line (after line 12):

```typescript
  useRealtimeSync('products');
  useRealtimeSync('product_categories');
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add modules/products/hooks/useProducts.ts
git commit -m "feat(plan-3): add real-time sync to useProducts"
```

---

### Task 11: Wire useRealtimeSync into useSuppliers, useTeam, useSettings, useAccounting

**Files:**
- Modify: `modules/suppliers/hooks/useSuppliers.ts`
- Modify: `modules/team/hooks/useTeam.ts`
- Modify: `modules/settings/hooks/useSettings.ts`
- Modify: `modules/accounting/hooks/useAccounting.ts`

These are all identical mechanical changes — add import + one-liner call.

- [ ] **Step 1: Add useRealtimeSync to useSuppliers**

In `modules/suppliers/hooks/useSuppliers.ts`, add the import after line 4 (after the `useAuth` import):

```typescript
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
```

Then add the hook call inside `useSuppliers()`, right after the `const [searchTerm, setSearchTerm] = useState('');` line (after line 13):

```typescript
  useRealtimeSync('suppliers');
```

- [ ] **Step 2: Add useRealtimeSync to useTeam**

In `modules/team/hooks/useTeam.ts`, add the import after line 4 (after the `useAuth` import):

```typescript
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
```

Then add the hook call inside `useTeam()`, right after the `const [searchTerm, setSearchTerm] = useState('');` line (after line 12):

```typescript
  useRealtimeSync('staff_members');
```

- [ ] **Step 3: Add useRealtimeSync to useSettings**

In `modules/settings/hooks/useSettings.ts`, add the import after line 4 (after the `useAuth` import):

```typescript
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
```

Then add two hook calls inside `useSettings()`, right after the `const queryClient = useQueryClient();` line (after line 18):

```typescript
  useRealtimeSync('salons');
  useRealtimeSync('expense_categories');
```

Note: The query key for salon settings is `['salon_settings', salonId]`, not `['salons', salonId]`. The `useRealtimeSync` hook invalidates `['salons', salonId]` which won't match. To fix this, the `useRealtimeSync` hook call needs to specify the correct query key. However, the simplest fix is to call it with the table name and add a manual invalidation. Instead, change the `useRealtimeSync` call for salons to use the `onEvent` callback:

```typescript
  const queryClient = useQueryClient();

  useRealtimeSync('salons', {
    onEvent: () => {
      queryClient.invalidateQueries({ queryKey: ['salon_settings', salonId] });
    },
  });
  useRealtimeSync('expense_categories');
```

Wait — the `useRealtimeSync` hook already invalidates `[tableName, salonId]` which would be `['salons', salonId]`. But `useSettings` uses query key `['salon_settings', salonId]`. The table name `salons` doesn't match the query key `salon_settings`. We need to handle this.

**Better approach:** Add an optional `queryKey` override to the `useRealtimeSync` hook. But to keep Task 4 clean, we'll use the `onEvent` callback here which already gets called alongside the default invalidation:

Actually, looking at the hook again — it calls `queryClient.invalidateQueries({ queryKey: [tableName, salonId] })` AND `options?.onEvent?.(payload)`. So the default invalidation would target `['salons', salonId]` which doesn't exist as a query. The actual query key is `['salon_settings', salonId]`.

**Simplest fix for useSettings:** Don't use the default invalidation — use `onEvent` to invalidate the correct key. But the default invalidation still runs (harmlessly targeting a non-existent key `['salons', salonId]`). This is fine — invalidating a non-existent key is a no-op.

So the code is (note `useCallback` import and wrapping):

In `modules/settings/hooks/useSettings.ts`, update line 1 from:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
```

To:

```typescript
import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
```

Then add after the `useRealtimeSync` import:

```typescript
  const handleSalonChange = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['salon_settings', salonId] });
  }, [queryClient, salonId]);

  useRealtimeSync('salons', { onEvent: handleSalonChange });
  useRealtimeSync('expense_categories');
```

This way, when the `salons` table changes, the `onEvent` callback invalidates `['salon_settings', salonId]` (the correct key), and the default invalidation of `['salons', salonId]` is a harmless no-op. The `useCallback` prevents the effect from re-subscribing on every render.

- [ ] **Step 4: Add useRealtimeSync to useAccounting**

In `modules/accounting/hooks/useAccounting.ts`, add the import after the existing imports (after the `useSettings` import, around line 7):

```typescript
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
```

Then add the hook call inside `useAccounting()`, right after the `const queryClient = useQueryClient();` line (after line 14):

```typescript
  useRealtimeSync('expenses');
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add modules/suppliers/hooks/useSuppliers.ts modules/team/hooks/useTeam.ts modules/settings/hooks/useSettings.ts modules/accounting/hooks/useAccounting.ts
git commit -m "feat(plan-3): add real-time sync to suppliers, team, settings, and accounting"
```

---

### Task 12: Wire useRealtimeSync into useAppointments with Toast

**Files:**
- Modify: `modules/appointments/hooks/useAppointments.ts`

This is the one module that gets a real-time toast notification (new appointments).

- [ ] **Step 1: Add useRealtimeSync with onEvent toast to useAppointments**

In `modules/appointments/hooks/useAppointments.ts`, add these imports after the existing imports (after line 5):

```typescript
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useToast } from '../../../context/ToastContext';
import { useCallback } from 'react';
```

Update the `useState` import on line 1 to also include `useCallback` if not already there. Actually, since we're adding a separate import for `useCallback`, update line 1 from:

```typescript
import { useState, useMemo } from 'react';
```

To:

```typescript
import { useState, useMemo, useCallback } from 'react';
```

And remove the separate `useCallback` import if you added it.

Then add the toast integration inside `useAppointments()`, right after `const [statusFilter, setStatusFilter] = useState<string>('ALL');` (after line 13):

```typescript
  const { addToast } = useToast();

  const handleAppointmentEvent = useCallback((payload: { eventType: string }) => {
    if (payload.eventType === 'INSERT') {
      addToast({ type: 'info', message: 'Nouveau rendez-vous ajouté' });
    }
  }, [addToast]);

  useRealtimeSync('appointments', { onEvent: handleAppointmentEvent });
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add modules/appointments/hooks/useAppointments.ts
git commit -m "feat(plan-3): add real-time sync to appointments with toast on new bookings"
```

---

### Task 13: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md to document real-time and toast infrastructure**

In `CLAUDE.md`, add a new section after the "Data Layer (Supabase + TanStack Query)" section and before "Dead Code". Add:

```markdown
### Real-Time Sync
- `hooks/useRealtimeSync.ts` — shared hook with ref-counted subscription manager
- Each module hook calls `useRealtimeSync('tableName')` to subscribe to Postgres changes
- On any INSERT/UPDATE/DELETE: invalidates TanStack Query cache for that table
- Subscription manager avoids duplicate channels when multiple components sync the same table
- Optional `onEvent` callback for per-module reactions (e.g., toast on new appointment)

### Toast Notifications
- `context/ToastContext.tsx` — split dispatch/state contexts (prevents consumer re-renders)
- `components/Toast.tsx` — portal-rendered to `#toast-root`, top-right position
- `useToast()` hook provides `addToast({ type, message, duration? })` and `removeToast(id)`
- Types: success (green), error (red), warning (amber), info (blue)
- Errors don't auto-dismiss; all others dismiss after 5s

### Connection Status
- `hooks/useConnectionStatus.ts` — monitors Supabase Realtime WebSocket state
- `components/ConnectionStatus.tsx` — dot indicator in top bar + disconnect banner
- States: connected (green), reconnecting (orange), disconnected after 30s (red + banner)
- On reconnect: invalidates active queries, shows "Connexion rétablie" toast
```

Also update the "Known Issues to Fix" section — real-time sync is now done. No specific item to mark, but the infrastructure is in place.

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(plan-3): update CLAUDE.md with real-time sync, toast, and connection status docs"
```
