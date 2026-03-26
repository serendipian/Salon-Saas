# Lumiere Beauty SaaS - Casa de Chicas

## Project Overview

Salon management SaaS application for beauty salons. Built with React 19, TypeScript, Vite, Tailwind CSS, Recharts, and Lucide React icons. French-language UI targeting the Moroccan/French beauty salon market.

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build**: Vite 6
- **Styling**: Tailwind CSS (needs migration from CDN to proper install)
- **Charts**: Recharts 3
- **Icons**: Lucide React
- **Routing**: React Router DOM 7 (HashRouter)
- **AI**: Google Gemini API (via @google/genai) for service description generation

## Architecture

### Module Structure (Active Code)
```
modules/
  {module}/
    {Module}Module.tsx    # Container component, manages view state
    hooks/use{Module}.ts  # Custom hook wrapping useAppContext()
    components/           # Presentational components
    data.ts               # Mock/initial data (where applicable)
```

Active modules: `dashboard`, `clients`, `services`, `products`, `appointments`, `pos`, `team`, `suppliers`, `accounting`, `settings`

### Shared Components (Active)
```
components/
  Layout.tsx              # App shell: sidebar + topbar
  FormElements.tsx        # Input, Select, TextArea, Section
  DatePicker.tsx          # Single date picker
  DateRangePicker.tsx     # Range picker with presets
  WorkScheduleEditor.tsx  # Weekly schedule grid
  BonusSystemEditor.tsx   # Tiered bonus configuration
```

### State Management
- Single `AppContext` in `context/AppContext.tsx` provides all state
- Each module accesses state via `useAppContext()` hook
- No persistence - all state is in-memory (useState)

### Dead Code (DO NOT USE)
These files in `components/` are old monolithic versions replaced by `modules/`:
- `components/AccountingModule.tsx`
- `components/AppointmentsModule.tsx`
- `components/ClientsModule.tsx`
- `components/Dashboard.tsx`
- `components/POSModule.tsx`
- `components/ProductsModule.tsx`
- `components/ServicesModule.tsx`
- `components/SettingsModule.tsx`
- `components/SuppliersModule.tsx`
- `services/store.ts` (legacy singleton store, broken import)

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server on port 3000
npm run build        # Production build
npm run preview      # Preview production build
```

## Code Conventions

- **Language**: UI text is in French. Code (variables, comments) in English.
- **Styling**: Tailwind utility classes. Design system uses slate color palette with brand-500 (#ec4899) as accent.
- **Components**: Functional components with hooks. No class components.
- **Types**: All domain types in `types.ts`. Use proper TypeScript types, avoid `any`.
- **IDs**: Use `crypto.randomUUID()` for generating IDs (not `Date.now()`).
- **State**: Access shared state via `useAppContext()`. Local UI state (view, search, selection) stays in the component.
- **Forms**: Use controlled React state. Never use `document.getElementById()`.
- **File naming**: PascalCase for components, camelCase for hooks/utilities.

## Known Issues to Fix

1. No data persistence (needs localStorage or backend)
2. Tailwind via CDN (needs proper PostCSS setup)
3. Import maps in index.html point to aistudiocdn.com (not needed with Vite)
4. Gemini API key exposed client-side
5. No authentication system
6. Appointment form uses hardcoded staff names instead of team data
7. Dashboard KPI trends are hardcoded percentages
8. No form validation
9. No error boundaries
10. Not responsive for mobile

## Environment Variables

```
GEMINI_API_KEY=     # Google Gemini API key (in .env.local)
```
