# H-1 Fix: ClientDetails Targeted Appointment Query

> Replace the unbounded `useAppointments()` call in `ClientDetails` with a targeted `useClientAppointments(clientId)` hook.

## Problem

`ClientDetails` calls `useAppointments()` which fetches every appointment for the entire salon, then filters client-side with `.filter(apt => apt.clientId === client.id)`. This loads all appointments + sets up a realtime subscription for the full table, just to display one client's history.

## Design

### New Hook: `useClientAppointments(clientId)`

**File:** `modules/clients/hooks/useClientAppointments.ts`

```ts
useClientAppointments(clientId: string)
```

- **DB query:** `supabase.from('appointments').select('*, services(name), service_variants(name), staff_members(first_name, last_name)').eq('salon_id', salonId).eq('client_id', clientId).is('deleted_at', null).order('date', { ascending: false })`
- **Query key:** `['appointments', salonId, 'client', clientId]` — prefixed with `['appointments', salonId]` so all existing invalidation patterns (mutations, realtime) automatically cover it via TanStack Query prefix matching
- **Realtime:** Calls `useRealtimeSync('appointments')` — needed because `ClientDetails` is the only appointment-aware component on the clients page. The ref-counted subscription manager deduplicates if `useAppointments` is also mounted elsewhere.
- **Returns:** `{ appointments, isLoading }` — read-only, no mutations
- **Mapper:** Reuses existing `toAppointment` from `modules/appointments/mappers.ts`. The client join is omitted from the query since we already know the client — the mapper handles missing client data gracefully (falls back to empty string for `clientName`).

### Consumer Change: `ClientDetails`

- Replace `useAppointments()` with `useClientAppointments(client.id)`
- Remove the client-side `.filter(apt => apt.clientId === client.id)` — the DB already filters
- Remove `useAppointments` import

### What Doesn't Change

- `useAppointments` hook — untouched, all other 9 consumers keep using it
- Realtime invalidation — prefix matching covers the new query key automatically
- `ClientDetails` UI — same timeline rendering, same data shape
