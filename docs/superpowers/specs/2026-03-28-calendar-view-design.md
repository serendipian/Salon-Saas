# Appointments Calendar View — Design Spec

## Overview

Add a calendar view to the appointments module with Day, Week, and Month views. Read-only calendar (no drag-and-drop or slot clicking). Appointments are color-coded by service category, with completed appointments greyed out. Clicking an appointment shows a popover with quick info and action buttons.

UI matches the provided screenshots' structure and layout, with pink (#ec4899) replacing blue as the accent color.

## View Switching

The `AppointmentList` header gains a **List | Calendar** toggle (two buttons matching the screenshots' top-right "List | Calendar" toggle). Selecting "Calendar" replaces the list/table area with the calendar layout. The existing card/table `ViewToggle` only shows in List mode.

`ViewState` type gains a `'CALENDAR'` value.

## Calendar Layout

Two-panel layout:

### Left Sidebar (~280px fixed)

**Mini Calendar:**
- Reuse existing `InlineCalendar` component
- Clicking a date updates `currentDate` and switches to Day view

**Filters section** (collapsible with chevron, label "Filtres"):
- **Service Categories:** checkbox + colored dot + category name for each category. All checked by default.
- **Team Members:** checkbox + staff color dot + staff name for each staff member. All checked by default.
- Unchecking a filter hides matching appointments completely from the calendar.

**Separator:** `border-slate-200` between sidebar and main area.

### Main Area (flex-1)

**Calendar Header Bar:**
- Left: "Today" button (outlined, `border-slate-300`) + prev/next chevron buttons
- Center: Dynamic title
  - Day: "March 28, 2026"
  - Week: "March 23 - 29, 2026"
  - Month: "March 2026"
- Right: Day | Week | Month toggle buttons (outlined, selected = filled pink)

**Navigation:**
- Prev/next shift by 1 day/week/month respectively
- "Today" resets `currentDate` to now

## Day View

**Day header:** Large date number + 3-letter day abbreviation + "Today" pink pill badge if applicable. E.g., "28 SAT Today"

**Time grid:**
- Left gutter (~60px): hour labels 8 AM - 8 PM
- Horizontal dashed lines (`border-dashed border-slate-200`) at each hour
- Each hour row: ~64px tall (16px per 15-min slot)

**Appointment blocks:**
- Positioned absolutely based on start time and duration
- Left border (3px) in service category color
- Light category-colored background (e.g., `bg-pink-50` for Coiffure)
- Content: service name (bold, truncated) + time range ("11:00 AM - 12:00 PM")
- Height proportional to duration
- Completed appointments: `opacity-40`, no colored border
- Overlapping appointments: split column width 50/50 side by side

## Week View

**Column headers:** 3-letter day abbreviation + date number ("MON 23", "TUE 24", etc.)
- Today's date number gets a pink filled circle
- Left gutter shows timezone label ("GMT+1") at top

**Time grid:**
- Same hour labels and row height as Day view (8 AM - 8 PM)
- 7 equal-width columns, separated by `border-slate-100` vertical borders
- Horizontal lines at each hour

**Appointment blocks:**
- Same styling as Day view, positioned within their day column
- Text truncates with ellipsis more aggressively due to narrower width
- Completed: `opacity-40`
- Overlapping: 50/50 split within a single day column

## Month View

**Column headers:** "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"
- Saturday header highlighted in pink text

**Date cells:**
- 6 rows x 7 columns, including overflow days from prev/next months
- Date number top-left; `text-slate-400` for days outside current month
- Today: pink filled circle behind date number
- Fixed cell height (~120px), overflow hidden

**Appointment indicators:**
- Compact bars: left colored border (3px, category color) + truncated text ("10:00 AM Coupe Bru...")
- Max 2-3 visible per cell, then "+N more" text if overflow
- Completed: `opacity-40`

**Clicking a date:** Navigates to Day view for that date.

## Appointment Popover

Triggered by clicking any appointment block in any view.

**Content:**
- Header: service name (bold) + StatusBadge (existing component)
- Details list:
  - Clock icon + time range
  - User icon + client name
  - Scissors icon + staff name
  - Tag icon + formatted price
- Footer: "Voir details" button (navigates to DETAILS view) + "Modifier" button (navigates to EDIT view)

**Behavior:**
- Anchored to the clicked block
- Smart positioning (flips above if near viewport bottom)
- Dismiss: click outside or Escape key

**Styling:** White card, `shadow-lg`, `rounded-xl`, `border border-slate-200`, ~280px wide. Pink accent on action buttons.

## Color Coding

**Service categories** determine the appointment block color:
- Each category has an assigned color (from existing `serviceCategories` data)
- Block gets a left border in that color + a light tinted background

**Completed appointments:** `opacity-40` applied to the entire block, colored border removed. Provides a greyed-out effect while preserving the position in the grid.

## New Files

```
modules/appointments/components/
  CalendarView.tsx          — Main container (sidebar + calendar area)
  CalendarHeader.tsx        — Today/prev/next + title + Day/Week/Month toggle
  CalendarDayView.tsx       — Single day time grid
  CalendarWeekView.tsx      — 7-column time grid
  CalendarMonthView.tsx     — Month grid with compact event bars
  CalendarSidebar.tsx       — Mini calendar + filters
  CalendarEventBlock.tsx    — Styled appointment block (reused in day/week views)
  CalendarEventPopover.tsx  — Click popover with details + actions
  useCalendar.ts            — Hook: currentDate, calendarView, navigation, filters
```

## Modified Files

- `types.ts` — Add `'CALENDAR'` to `ViewState`
- `modules/appointments/AppointmentsModule.tsx` — Pass through to CalendarView when view is CALENDAR
- `modules/appointments/components/AppointmentList.tsx` — Add List/Calendar toggle, conditionally render CalendarView vs list/table

## Data Flow

- `CalendarView` receives `allAppointments`, `serviceCategories`, `allStaff`, `allClients` from parent module
- `useCalendar` hook manages: `currentDate`, `calendarView` ('day'|'week'|'month'), `categoryFilters` (Set of category IDs), `staffFilters` (Set of staff IDs)
- Filtered appointments: computed by intersecting category + staff filters with appointment data
- No new Supabase queries — reuses `useAppointments().allAppointments`
- Popover actions (view details, edit) call existing view navigation callbacks from the parent module

## No Changes To

- Existing hooks (`useAppointments`, `useStaffAvailability`)
- Mappers, schemas, validation
- AppointmentBuilder, AppointmentDetails, ServiceBlock components
- Database schema or queries
