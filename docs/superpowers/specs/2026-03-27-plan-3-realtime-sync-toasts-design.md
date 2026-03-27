# Plan 3: Real-Time Sync & Toast Notifications — Design Spec

> **Status:** Approved
> **Date:** 2026-03-27
> **Scope:** Per-table real-time cache invalidation, toast notification system, connection status indicator

---

## 1. Overview

### What We're Building

All 10 modules are now on Supabase + TanStack Query (Plans 1–2C). But data only refreshes when the current user triggers a mutation or the 5-minute stale time expires. If a receptionist books an appointment, a stylist viewing the calendar won't see it until they manually refresh.

Plan 3 adds:
1. **Real-time cache invalidation** — Supabase Realtime Postgres changes trigger TanStack Query cache invalidations, so all connected clients stay in sync.
2. **Toast notification system** — lightweight, top-right notification toasts for user feedback on real-time events and (later) mutation results.
3. **Connection status indicator** — visual indicator in the top bar showing WebSocket health, with a warning banner on prolonged disconnect.

### What We're NOT Building

- Offline mode / offline queue
- Direct cache merging from payloads (invalidation-only for V1)
- Toast-based mutation error handling (deferred to Plan 4)
- Notification center / history
- Sound effects or desktop notifications

---

## 2. Real-Time Sync: `useRealtimeSync` Hook

### 2.1 API

A shared hook at `hooks/useRealtimeSync.ts`. Module hooks add a one-liner:

```typescript
// In useClients():
useRealtimeSync('clients');

// In useServices() (two tables):
useRealtimeSync('services');
useRealtimeSync('service_categories');
```

### 2.2 Behavior

- Subscribes to `postgres_changes` on the given table, filtered by `salon_id=eq.{activeSalonId}`
- On any INSERT/UPDATE/DELETE event: calls `queryClient.invalidateQueries({ queryKey: [tableName, salonId] })`
- Unsubscribes when the last consumer unmounts (reference counting)
- No-ops when `salonId` is empty

### 2.3 Shared Subscription Manager

Multiple components may subscribe to the same table simultaneously (e.g., POS, accounting, and dashboard all use `useTransactions`, which calls `useRealtimeSync('transactions')`). Creating duplicate Supabase channels is wasteful.

The hook uses a **module-level subscription manager** — a `Map<string, { channel, refCount }>` keyed by `${tableName}:${salonId}`:

- First subscriber: creates the Supabase channel and sets `refCount = 1`
- Additional subscribers: increments `refCount` (no new channel)
- Unsubscribe: decrements `refCount`. When it reaches 0, removes the Supabase channel.

This is internal to the hook — consumers just call `useRealtimeSync('tableName')` and don't think about it.

**Salon switch:** When `salonId` changes (user switches salon), the hook's `useEffect` cleanup runs, decrementing refCounts for the old salon's channels. The new effect creates channels for the new salon. The subscription manager handles this naturally since the key includes `salonId`.

### 2.4 Self-Triggered Double Invalidation

When the current user creates a record, the mutation's `onSuccess` already invalidates the cache. Then ~100ms later, the real-time event fires and invalidates again. This causes a redundant refetch.

**Decision:** Accept the double refetch. TanStack Query deduplicates in-flight requests, so the actual network cost is zero if the first refetch hasn't completed. Adding debounce logic is not worth the complexity.

### 2.5 Module Subscription Map

| Module Hook | Tables Synced |
|-------------|---------------|
| `useClients` | `clients` |
| `useServices` | `services`, `service_categories` |
| `useProducts` | `products`, `product_categories` |
| `useSuppliers` | `suppliers` |
| `useTeam` | `staff_members` |
| `useAppointments` | `appointments` |
| `useSettings` | `salons`, `expense_categories` |
| `useAccounting` | `expenses` |
| `useTransactions` (shared) | `transactions` |

Note: `useTransactions` is consumed by POS, dashboard, and accounting. Thanks to reference counting, only one channel is created for `transactions` regardless of how many consumers are mounted.

Note: POS also calls `useProducts` (for the product catalog), so `products` is synced when POS is active — stock changes from other terminals appear automatically.

### 2.6 Supabase Realtime + RLS

Supabase v2 enforces RLS on Realtime `postgres_changes` subscriptions. The `salon_id=eq.{salonId}` filter is enforced server-side, not just client-side. Users cannot receive events from other salons.

---

## 3. Toast Notification System

### 3.1 Architecture

Two files:

- **`context/ToastContext.tsx`** — Two split contexts for performance:
  - `ToastDispatchContext` — provides the `addToast` function (stable ref, never triggers re-renders in consumers)
  - `ToastStateContext` — provides the toast array (only consumed by the `Toast.tsx` renderer)
- **`components/Toast.tsx`** — Presentational component that reads from `ToastStateContext` and renders toasts via `createPortal` to a dedicated `<div id="toast-root">` in `index.html`

### 3.2 API

```typescript
const { addToast } = useToast();

addToast({
  type: 'success',      // 'success' | 'error' | 'warning' | 'info'
  message: 'Client ajouté avec succès',
  duration: 5000,       // optional, defaults below
});
```

### 3.3 Toast Types and Behavior

| Type | Color | Auto-dismiss | Default duration |
|------|-------|-------------|-----------------|
| `success` | Green accent | Yes | 5000ms |
| `info` | Blue accent | Yes | 5000ms |
| `warning` | Amber accent | Yes | 5000ms |
| `error` | Red accent | **No** — must be manually closed | N/A |

### 3.4 Display Rules

- **Position:** Top-right, below the top bar
- **Max visible:** 3 toasts stacked vertically
- **Queue:** Additional toasts queue behind. Max queue size: 10. When exceeded, oldest queued (not visible) toasts are dropped.
- **Animation:** Slide in from right, fade out on dismiss
- **Close button:** Every toast has an X button for manual dismissal
- **Z-index:** Above all content, including modals (rendered via portal)

### 3.5 Styling

Follows the existing design system:
- Tailwind utility classes
- Slate color palette base with colored left border accent
- `rounded-lg`, `shadow-lg`, `border` consistent with existing card styling
- Icons from Lucide React: `CheckCircle` (success), `AlertCircle` (error), `AlertTriangle` (warning), `Info` (info)

### 3.6 Real-Time Toast Policy

Real-time cache invalidations are **silent by default**. Most table changes just refresh the data without notifying the user — the updated data appearing on screen is notification enough.

**Toasts are opt-in per module.** For Plan 3 scope:

| Event | Toast? | Message |
|-------|--------|---------|
| New appointment (by another user) | Yes | "Nouveau rendez-vous ajouté" |
| All other real-time events | No (silent) | — |

Additional real-time toasts can be added per-module in future plans. The `useRealtimeSync` hook accepts an optional `onEvent` callback for modules that want to react to specific events:

```typescript
useRealtimeSync('appointments', {
  onEvent: (payload) => {
    if (payload.eventType === 'INSERT') {
      addToast({ type: 'info', message: 'Nouveau rendez-vous ajouté' });
    }
  }
});
```

---

## 4. Connection Status Indicator

### 4.1 Hook: `useConnectionStatus`

Located at `hooks/useConnectionStatus.ts`.

```typescript
const status = useConnectionStatus();
// 'connected' | 'reconnecting' | 'disconnected'
```

**How it monitors connection state:**

Uses a dedicated Supabase channel subscription to track connection health:

```typescript
supabase.channel('connection-monitor').subscribe((status) => {
  // status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR'
});
```

**State transitions:**
- `SUBSCRIBED` → `'connected'`
- `TIMED_OUT` / `CLOSED` / `CHANNEL_ERROR` → `'reconnecting'`
- Still not `SUBSCRIBED` after 30s → `'disconnected'`

**30-second threshold:** Uses a `disconnectedAt` timestamp (not `setTimeout`) to avoid timer drift in backgrounded tabs. Listens to `document.visibilitychange` to re-evaluate status when the user tabs back.

**On reconnect (transition to `'connected'`):**
- Calls `queryClient.invalidateQueries({ refetchType: 'active' })` — only refetches queries for currently mounted components. Inactive queries are marked stale and refetch on next mount.
- Fires a toast: `{ type: 'success', message: 'Connexion rétablie' }`

### 4.2 Component: `ConnectionStatus`

Located at `components/ConnectionStatus.tsx`. Rendered in `Layout.tsx` top bar, next to the user avatar.

| State | Top Bar | Banner |
|-------|---------|--------|
| `connected` | Small green dot (8px), no text | None |
| `reconnecting` | Orange dot + tooltip "Reconnexion en cours..." | None |
| `disconnected` | Red dot | Full-width amber banner below top bar: "Connexion perdue — les données affichées peuvent être obsolètes" + "Réessayer" button |

**Banner behavior:**
- Slides down with CSS transition, pushes content down (not overlay)
- "Réessayer" button forces a reconnect attempt. Disabled during attempt with 3s cooldown to prevent spam.
- Auto-dismisses when connection restores

---

## 5. File Inventory

### New Files

| File | Purpose |
|------|---------|
| `hooks/useRealtimeSync.ts` | Shared hook + subscription manager with ref counting |
| `hooks/useConnectionStatus.ts` | WebSocket connection state monitoring |
| `context/ToastContext.tsx` | Split dispatch/state contexts + ToastProvider |
| `components/Toast.tsx` | Presentational toast renderer (portal) |
| `components/ConnectionStatus.tsx` | Dot indicator + disconnect banner |

### Modified Files

| File | Change |
|------|--------|
| `hooks/useTransactions.ts` | Add `useRealtimeSync('transactions')` |
| `modules/clients/hooks/useClients.ts` | Add `useRealtimeSync('clients')` |
| `modules/services/hooks/useServices.ts` | Add `useRealtimeSync('services')`, `useRealtimeSync('service_categories')` |
| `modules/products/hooks/useProducts.ts` | Add `useRealtimeSync('products')`, `useRealtimeSync('product_categories')` |
| `modules/suppliers/hooks/useSuppliers.ts` | Add `useRealtimeSync('suppliers')` |
| `modules/team/hooks/useTeam.ts` | Add `useRealtimeSync('staff_members')` |
| `modules/appointments/hooks/useAppointments.ts` | Add `useRealtimeSync('appointments')` + toast on INSERT |
| `modules/settings/hooks/useSettings.ts` | Add `useRealtimeSync('salons')`, `useRealtimeSync('expense_categories')` |
| `modules/accounting/hooks/useAccounting.ts` | Add `useRealtimeSync('expenses')` |
| `components/Layout.tsx` | Add `ConnectionStatus` component to top bar |
| `App.tsx` | Wrap app with `ToastProvider` |
| `index.html` | Add `<div id="toast-root">` |

---

## 6. Dependencies

No new packages required. `@supabase/supabase-js` (already installed) includes the Realtime client. `@tanstack/react-query` (already installed) provides `useQueryClient` for invalidation.
