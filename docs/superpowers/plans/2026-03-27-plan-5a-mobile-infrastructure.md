# Plan 5A: Mobile Infrastructure, Navigation & Forms

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mobile responsiveness infrastructure (hooks, context, navigation) and form improvements to make the Lumiere Beauty SaaS usable on phones and tablets.

**Architecture:** Progressive enhancement — a `MediaQueryContext` singleton provides breakpoint flags, consumed by a new mobile navigation system (bottom tab bar + drawer) and responsive form components. Layout.tsx is refactored to conditionally render sidebar (desktop/tablet) or bottom tabs + drawer (mobile). FormElements get touch-target improvements and a fullscreen Select overlay on mobile.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Lucide React icons

**Spec:** `docs/superpowers/specs/2026-03-27-plan-5-mobile-responsiveness-design.md` (Sections 1, 2, 6)

---

## File Structure

### New Files
```
context/MediaQueryContext.tsx     # Singleton breakpoint provider + useMediaQuery hook
hooks/useSidebar.ts              # Shared sidebar/drawer state hook
hooks/useViewMode.ts             # Card/table toggle with localStorage persistence
components/ViewToggle.tsx        # Card/table toggle button pair
components/BottomTabBar.tsx      # 5-tab mobile navigation bar
components/MobileDrawer.tsx      # Slide-in overlay drawer for full nav
components/MobileSelect.tsx      # Fullscreen select overlay for mobile
```

### Modified Files
```
App.tsx                          # Wrap with MediaQueryProvider
components/Layout.tsx            # Integrate sidebar modes, bottom tabs, drawer, mobile top bar
components/FormElements.tsx      # Touch targets, input types, mobile Select routing
modules/dashboard/DashboardModule.tsx  # KPI grid 320px handling, flex-col metric cards
components/WorkScheduleEditor.tsx      # Horizontal scroll + snap on mobile
components/BonusSystemEditor.tsx       # Card layout on mobile
src/index.css                    # z-index CSS custom properties
```

---

### Task 1: MediaQueryContext Singleton

**Files:**
- Create: `context/MediaQueryContext.tsx`

- [ ] **Step 1: Create the MediaQueryContext provider and useMediaQuery hook**

```tsx
// context/MediaQueryContext.tsx
import React, { createContext, useContext, useSyncExternalStore } from 'react';

interface MediaQueryState {
  isMobile: boolean;
  isTablet: boolean;
  isTabletPortrait: boolean;
  isTabletLandscape: boolean;
  isDesktop: boolean;
}

const QUERIES = {
  mobile: '(max-width: 767px)',
  tabletPortrait: '(min-width: 768px) and (max-width: 899px)',
  tabletLandscape: '(min-width: 900px) and (max-width: 1023px)',
  desktop: '(min-width: 1024px)',
} as const;

function getSnapshot(): MediaQueryState {
  return {
    isMobile: window.matchMedia(QUERIES.mobile).matches,
    isTablet: window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches,
    isTabletPortrait: window.matchMedia(QUERIES.tabletPortrait).matches,
    isTabletLandscape: window.matchMedia(QUERIES.tabletLandscape).matches,
    isDesktop: window.matchMedia(QUERIES.desktop).matches,
  };
}

function getServerSnapshot(): MediaQueryState {
  return { isMobile: false, isTablet: false, isTabletPortrait: false, isTabletLandscape: false, isDesktop: true };
}

let cachedState = getSnapshot();

function subscribe(callback: () => void): () => void {
  const queries = Object.values(QUERIES).map(q => window.matchMedia(q));
  const handler = () => {
    cachedState = getSnapshot();
    callback();
  };
  queries.forEach(mq => mq.addEventListener('change', handler));
  return () => queries.forEach(mq => mq.removeEventListener('change', handler));
}

const MediaQueryContext = createContext<MediaQueryState>(getServerSnapshot());

export const MediaQueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const state = useSyncExternalStore(subscribe, () => cachedState, getServerSnapshot);
  return <MediaQueryContext.Provider value={state}>{children}</MediaQueryContext.Provider>;
};

export const useMediaQuery = (): MediaQueryState => useContext(MediaQueryContext);
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds (new file, no consumers yet)

- [ ] **Step 3: Commit**

```bash
git add context/MediaQueryContext.tsx
git commit -m "feat(plan-5a): add MediaQueryContext singleton with breakpoint flags"
```

---

### Task 2: z-index Scale in CSS

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add z-index CSS custom properties to the theme**

Add after the existing `@theme` block in `src/index.css` (after line 21):

```css
/* z-index scale for consistent layering */
:root {
  --z-content: 0;
  --z-peek-bar: 10;
  --z-topbar: 20;
  --z-sidebar: 30;
  --z-drawer-backdrop: 40;
  --z-drawer-panel: 50;
  --z-modal: 60;
  --z-toast: 70;
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(plan-5a): add z-index scale CSS custom properties"
```

---

### Task 3: useSidebar Hook

**Files:**
- Create: `hooks/useSidebar.ts`

- [ ] **Step 1: Create the useSidebar hook**

```ts
// hooks/useSidebar.ts
import { useState, useCallback, useMemo } from 'react';
import { useMediaQuery } from '../context/MediaQueryContext';

export type SidebarMode = 'drawer' | 'collapsed' | 'expanded';

export interface SidebarState {
  isDrawerOpen: boolean;
  isExpanded: boolean;
  mode: SidebarMode;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleExpanded: () => void;
}

export const useSidebar = (): SidebarState => {
  const { isMobile, isTabletPortrait } = useMediaQuery();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const mode: SidebarMode = useMemo(() => {
    if (isMobile) return 'drawer';
    if (isTabletPortrait) return 'collapsed';
    return expanded ? 'expanded' : 'collapsed';
  }, [isMobile, isTabletPortrait, expanded]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const toggleExpanded = useCallback(() => setExpanded(prev => !prev), []);

  return {
    isDrawerOpen: drawerOpen,
    isExpanded: mode === 'expanded',
    mode,
    openDrawer,
    closeDrawer,
    toggleExpanded,
  };
};
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add hooks/useSidebar.ts
git commit -m "feat(plan-5a): add useSidebar hook with drawer/collapsed/expanded modes"
```

---

### Task 4: useViewMode Hook + ViewToggle Component

**Files:**
- Create: `hooks/useViewMode.ts`
- Create: `components/ViewToggle.tsx`

- [ ] **Step 1: Create the useViewMode hook**

```ts
// hooks/useViewMode.ts
import { useState, useCallback } from 'react';
import { useMediaQuery } from '../context/MediaQueryContext';

export type ViewMode = 'card' | 'table';

const STORAGE_PREFIX = 'lumiere_viewMode_';

export const useViewMode = (moduleName: string): {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
} => {
  const { isMobile } = useMediaQuery();
  const storageKey = `${STORAGE_PREFIX}${moduleName}`;

  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (isMobile) return 'card';
    const saved = localStorage.getItem(storageKey);
    if (saved === 'card' || saved === 'table') return saved;
    return 'table';
  });

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(storageKey, mode);
  }, [storageKey]);

  // Force card on mobile regardless of stored preference
  const effectiveMode = isMobile ? 'card' : viewMode;

  return { viewMode: effectiveMode, setViewMode };
};
```

- [ ] **Step 2: Create the ViewToggle component**

```tsx
// components/ViewToggle.tsx
import React from 'react';
import { LayoutGrid, List } from 'lucide-react';
import type { ViewMode } from '../hooks/useViewMode';

interface ViewToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({ viewMode, onChange }) => (
  <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
    <button
      type="button"
      onClick={() => onChange('card')}
      className={`p-2 rounded-md transition-all ${
        viewMode === 'card'
          ? 'bg-white text-slate-900 shadow-sm'
          : 'text-slate-400 hover:text-slate-600'
      }`}
      aria-label="Vue carte"
      title="Vue carte"
    >
      <LayoutGrid size={16} />
    </button>
    <button
      type="button"
      onClick={() => onChange('table')}
      className={`p-2 rounded-md transition-all ${
        viewMode === 'table'
          ? 'bg-white text-slate-900 shadow-sm'
          : 'text-slate-400 hover:text-slate-600'
      }`}
      aria-label="Vue tableau"
      title="Vue tableau"
    >
      <List size={16} />
    </button>
  </div>
);
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add hooks/useViewMode.ts components/ViewToggle.tsx
git commit -m "feat(plan-5a): add useViewMode hook and ViewToggle component"
```

---

### Task 5: BottomTabBar Component

**Files:**
- Create: `components/BottomTabBar.tsx`

- [ ] **Step 1: Create the BottomTabBar component**

```tsx
// components/BottomTabBar.tsx
import React from 'react';
import { LayoutDashboard, Calendar, CreditCard, Users, Menu } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AuthResource } from '../lib/auth.types';

interface TabItem {
  id: string;
  label: string;
  icon: LucideIcon;
  resource: AuthResource;
}

const TABS: TabItem[] = [
  { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard, resource: 'dashboard' },
  { id: 'calendar', label: 'Agenda', icon: Calendar, resource: 'appointments' },
  { id: 'pos', label: 'Caisse', icon: CreditCard, resource: 'pos' },
  { id: 'clients', label: 'Clients', icon: Users, resource: 'clients' },
];

interface BottomTabBarProps {
  activeModule: string;
  onNavigate: (module: string) => void;
  onMorePress: () => void;
  can: (action: string, resource: string) => boolean;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeModule,
  onNavigate,
  onMorePress,
  can,
}) => {
  const visibleTabs = TABS.filter(tab => can('view', tab.resource));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around px-2 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]"
      style={{ zIndex: 'var(--z-topbar)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {visibleTabs.map(tab => {
        const isActive = activeModule === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            className={`flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[56px] min-h-[56px] transition-colors ${
              isActive ? 'text-brand-500' : 'text-slate-400'
            }`}
          >
            <tab.icon size={22} strokeWidth={isActive ? 2 : 1.5} />
            <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
              {tab.label}
            </span>
          </button>
        );
      })}

      {/* More tab — always visible */}
      <button
        onClick={onMorePress}
        className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[56px] min-h-[56px] text-slate-400 transition-colors"
      >
        <Menu size={22} strokeWidth={1.5} />
        <span className="text-[10px] font-medium">Plus</span>
      </button>
    </nav>
  );
};
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add components/BottomTabBar.tsx
git commit -m "feat(plan-5a): add BottomTabBar component with 5 tabs and permission filtering"
```

---

### Task 6: MobileDrawer Component

**Files:**
- Create: `components/MobileDrawer.tsx`

- [ ] **Step 1: Create the MobileDrawer component**

```tsx
// components/MobileDrawer.tsx
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface DrawerNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeModule: string;
  onNavigate: (module: string) => void;
  mainNavItems: DrawerNavItem[];
  managementNavItems: DrawerNavItem[];
  settingsItem?: DrawerNavItem;
  salonName: string;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  activeModule,
  onNavigate,
  mainNavItems,
  managementNavItems,
  settingsItem,
  salonName,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap + Escape key
  useEffect(() => {
    if (!isOpen) return;

    // Focus the close button on open
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Simple focus trap
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Set inert on main content
  useEffect(() => {
    const main = document.getElementById('main-content');
    if (isOpen && main) {
      main.setAttribute('inert', '');
      return () => main.removeAttribute('inert');
    }
  }, [isOpen]);

  const handleNavClick = (id: string) => {
    onNavigate(id);
    onClose();
  };

  const renderItem = (item: DrawerNavItem) => {
    const isActive = activeModule === item.id;
    return (
      <button
        key={item.id}
        onClick={() => handleNavClick(item.id)}
        className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
          isActive
            ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        <item.icon size={20} strokeWidth={isActive ? 2 : 1.5} />
        {item.label}
      </button>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ zIndex: 'var(--z-drawer-backdrop)' }}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={`fixed top-0 left-0 bottom-0 w-72 bg-white shadow-2xl transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ zIndex: 'var(--z-drawer-panel)' }}
      >
        {/* Drawer header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white font-bold text-sm shadow-md">
              {salonName.charAt(0) || 'L'}
            </div>
            <span className="font-bold text-lg text-slate-900 tracking-tight">{salonName || 'Salon'}</span>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Fermer la navigation"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav items */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <div className="px-4 mb-3 text-[11px] font-bold uppercase text-slate-400 tracking-widest">
            Menu Principal
          </div>
          {mainNavItems.map(renderItem)}

          {managementNavItems.length > 0 && (
            <>
              <div className="my-3 border-t border-slate-100 mx-2" />
              <div className="px-4 mb-3 text-[11px] font-bold uppercase text-slate-400 tracking-widest">
                Gestion
              </div>
              {managementNavItems.map(renderItem)}
            </>
          )}

          {settingsItem && (
            <>
              <div className="my-3 border-t border-slate-100 mx-2" />
              {renderItem(settingsItem)}
            </>
          )}
        </div>
      </div>
    </>
  );
};
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add components/MobileDrawer.tsx
git commit -m "feat(plan-5a): add MobileDrawer with focus trap, inert, and ARIA"
```

---

### Task 7: Refactor Layout.tsx

**Files:**
- Modify: `components/Layout.tsx`

This is the largest change. Layout must conditionally render:
- **Mobile (<768px):** No sidebar. Mobile top bar (hamburger + logo + bell). BottomTabBar. MobileDrawer.
- **Tablet/Desktop:** Current sidebar (collapsed/expanded). Current top bar.

- [ ] **Step 1: Update Layout imports and props**

Replace the imports and add new ones at the top of `Layout.tsx`:

```tsx
import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Scissors,
  Calendar,
  ShoppingBag,
  CreditCard,
  BarChart3,
  Search,
  Settings,
  Truck,
  Smile,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  LogOut,
  ChevronDown,
  Menu,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useMediaQuery } from '../context/MediaQueryContext';
import { useSidebar } from '../hooks/useSidebar';
import { ConnectionStatusDot, ConnectionBanner } from './ConnectionStatus';
import { BottomTabBar } from './BottomTabBar';
import { MobileDrawer } from './MobileDrawer';
import type { AuthResource } from '../lib/auth.types';
```

- [ ] **Step 2: Replace the Layout component body**

Replace the entire `Layout` component (from `export const Layout` through the end of the file) with:

```tsx
export const Layout: React.FC<LayoutProps> = ({ children, activeModule, onNavigate }) => {
  const { profile, activeSalon, role, memberships, switchSalon, signOut } = useAuth();
  const { can } = usePermissions(role);
  const { isMobile } = useMediaQuery();
  const sidebar = useSidebar();
  const [showSalonMenu, setShowSalonMenu] = useState(false);

  const mainNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard, resource: 'dashboard' },
    { id: 'calendar', label: 'Agenda', icon: Calendar, resource: 'appointments' },
    { id: 'clients', label: 'Clients', icon: Users, resource: 'clients' },
    { id: 'pos', label: 'Caisse', icon: CreditCard, resource: 'pos' },
    { id: 'accounting', label: 'Finances', icon: BarChart3, resource: 'accounting' },
  ];

  const managementNavItems: NavItem[] = [
    { id: 'team', label: 'Équipe', icon: Smile, resource: 'team' },
    { id: 'services', label: 'Services', icon: Scissors, resource: 'services' },
    { id: 'products', label: 'Produits', icon: ShoppingBag, resource: 'products' },
    { id: 'suppliers', label: 'Fournisseurs', icon: Truck, resource: 'suppliers' },
  ];

  const visibleMainNav = mainNavItems.filter(item => can('view', item.resource));
  const visibleMgmtNav = managementNavItems.filter(item => can('view', item.resource));
  const canViewSettings = can('view', 'settings');

  const displayName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
    : '...';
  const initials = profile
    ? `${(profile.first_name || '?')[0]}${(profile.last_name || '?')[0]}`.toUpperCase()
    : '??';
  const roleLabel = role ? ROLE_LABELS[role] || role : '';

  const collapsed = sidebar.mode === 'collapsed';

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans text-slate-900">
      {/* Sidebar — hidden on mobile */}
      {!isMobile && (
        <aside
          className={`bg-white border-r border-slate-100 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] relative shadow-[4px_0_24px_-12px_rgba(0,0,0,0.02)] ${
            collapsed ? 'w-24' : 'w-72'
          }`}
          style={{ zIndex: 'var(--z-sidebar)' }}
        >
          {/* Header: Salon name + switcher */}
          <div className={`h-20 flex items-center transition-all shrink-0 ${collapsed ? 'justify-center px-0' : 'justify-between px-6'}`}>
            {!collapsed && (
              <div className="relative flex items-center gap-3 animate-in fade-in duration-300">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white font-bold text-base shrink-0 shadow-md shadow-slate-900/20">
                  {activeSalon?.name ? activeSalon.name.charAt(0) : 'L'}
                </div>
                <div className="flex flex-col">
                  {memberships.length > 1 ? (
                    <button
                      onClick={() => setShowSalonMenu(!showSalonMenu)}
                      className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                    >
                      <span className="font-bold text-lg tracking-tight text-slate-900 leading-none">
                        {activeSalon?.name || 'Salon'}
                      </span>
                      <ChevronDown size={14} className="text-slate-400" />
                    </button>
                  ) : (
                    <span className="font-bold text-lg tracking-tight text-slate-900 leading-none">
                      {activeSalon?.name || 'Salon'}
                    </span>
                  )}
                </div>

                {showSalonMenu && memberships.length > 1 && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-lg py-2" style={{ zIndex: 'var(--z-drawer-panel)' }}>
                    {memberships.map(m => (
                      <button
                        key={m.id}
                        onClick={() => {
                          switchSalon(m.salon_id);
                          setShowSalonMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                          m.salon_id === activeSalon?.id ? 'bg-slate-50 font-medium' : ''
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {m.salon.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-slate-900">{m.salon.name}</div>
                          <div className="text-xs text-slate-400">{ROLE_LABELS[m.role]}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={sidebar.toggleExpanded}
              className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all ${collapsed ? 'mx-auto' : ''}`}
            >
              {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.5} /> : <PanelLeftClose size={18} strokeWidth={1.5} />}
            </button>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto py-6 px-4 custom-scrollbar space-y-1">
            {!collapsed && (
              <div className="px-4 mb-4 text-[11px] font-bold uppercase text-slate-400 tracking-widest">
                Menu Principal
              </div>
            )}
            {visibleMainNav.map(item => (
              <SidebarItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeModule === item.id}
                onClick={() => onNavigate(item.id)}
                collapsed={collapsed}
              />
            ))}
          </div>

          {/* Footer: Management & Settings */}
          <div className="p-4 border-t border-slate-100 bg-white space-y-1">
            {!collapsed && visibleMgmtNav.length > 0 && (
              <div className="px-4 mb-2 text-[11px] font-bold uppercase text-slate-400 tracking-widest">
                Gestion
              </div>
            )}
            {visibleMgmtNav.map(item => (
              <SidebarItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeModule === item.id}
                onClick={() => onNavigate(item.id)}
                collapsed={collapsed}
              />
            ))}

            {canViewSettings && (
              <>
                {visibleMgmtNav.length > 0 && <div className="my-2 border-t border-slate-50 mx-2" />}
                <SidebarItem
                  icon={Settings}
                  label="Réglages"
                  active={activeModule === 'settings'}
                  onClick={() => onNavigate('settings')}
                  collapsed={collapsed}
                />
              </>
            )}
          </div>
        </aside>
      )}

      {/* Main Content Wrapper */}
      <div id="main-content" className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
        {/* Top Bar */}
        <header
          className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-4 md:px-6 shrink-0 sticky top-0"
          style={{ zIndex: 'var(--z-topbar)' }}
        >
          {isMobile ? (
            <>
              {/* Mobile top bar: hamburger + logo + bell */}
              <button
                onClick={sidebar.openDrawer}
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Ouvrir le menu"
              >
                <Menu size={22} strokeWidth={1.5} />
              </button>
              <span className="font-bold text-lg text-slate-900 tracking-tight">
                {activeSalon?.name || 'Lumiere'}
              </span>
              <div className="flex items-center gap-1">
                <ConnectionStatusDot />
                <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <Bell size={20} strokeWidth={1.5} />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Desktop top bar */}
              <div className="relative max-w-md w-full hidden md:block group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-600 transition-colors" size={18} strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="Rechercher (Clients, Services, Factures...)"
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm outline-none ring-1 ring-transparent focus:ring-slate-200 focus:bg-white transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center gap-5 ml-auto">
                <ConnectionStatusDot />
                <button className="relative p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-full transition-all">
                  <Bell size={20} strokeWidth={1.5} />
                </button>

                <div className="h-8 w-px bg-slate-200" />

                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block leading-tight">
                    <div className="text-sm font-bold text-slate-800">{displayName}</div>
                    <div className="text-[11px] text-slate-500 font-medium">{roleLabel}</div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md ring-2 ring-white">
                    <span className="font-bold text-sm">{initials}</span>
                  </div>
                  <button
                    onClick={signOut}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-full transition-all"
                    title="Se déconnecter"
                  >
                    <LogOut size={18} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </>
          )}
        </header>

        <ConnectionBanner />

        {/* Scrollable Content */}
        <main
          className={`flex-1 overflow-auto relative p-4 md:p-6 scroll-smooth custom-scrollbar ${
            isMobile ? 'pb-[calc(56px+env(safe-area-inset-bottom)+1rem)]' : ''
          }`}
        >
          {children}
        </main>
      </div>

      {/* Mobile-only: Bottom Tab Bar */}
      {isMobile && (
        <BottomTabBar
          activeModule={activeModule}
          onNavigate={onNavigate}
          onMorePress={sidebar.openDrawer}
          can={can}
        />
      )}

      {/* Mobile-only: Drawer */}
      {isMobile && (
        <MobileDrawer
          isOpen={sidebar.isDrawerOpen}
          onClose={sidebar.closeDrawer}
          activeModule={activeModule}
          onNavigate={onNavigate}
          mainNavItems={visibleMainNav}
          managementNavItems={visibleMgmtNav}
          settingsItem={canViewSettings ? { id: 'settings', label: 'Réglages', icon: Settings } : undefined}
          salonName={activeSalon?.name || 'Salon'}
        />
      )}

      {/* Click-outside to close salon menu (desktop only) */}
      {showSalonMenu && !isMobile && (
        <div className="fixed inset-0" style={{ zIndex: 'var(--z-topbar)' }} onClick={() => setShowSalonMenu(false)} />
      )}
    </div>
  );
};
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Start dev server and verify**

Run: `npm run dev`
Verify in browser:
- At full width: sidebar, top bar, and content look the same as before
- At <768px (Chrome DevTools device mode): sidebar disappears, bottom tab bar appears, hamburger icon in top bar
- Tap hamburger: drawer slides in from left
- Tap a nav item in drawer: navigates and drawer closes

- [ ] **Step 5: Commit**

```bash
git add components/Layout.tsx
git commit -m "feat(plan-5a): refactor Layout with mobile nav, bottom tabs, and drawer"
```

---

### Task 8: Wire MediaQueryProvider into App.tsx

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add MediaQueryProvider to the provider stack**

Add the import at the top of `App.tsx`:

```tsx
import { MediaQueryProvider } from './context/MediaQueryContext';
```

Wrap the entire app with `MediaQueryProvider`. Replace the `App` function's return:

```tsx
export default function App() {
  return (
    <MediaQueryProvider>
      <AuthProvider>
        <ToastProvider>
          <HashRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/accept-invitation" element={<AcceptInvitationPage />} />

              {/* Auth-required, no-salon routes */}
              <Route path="/create-salon" element={<CreateSalonPage />} />
              <Route path="/select-salon" element={<SalonPickerPage />} />

              {/* Protected app routes */}
              <Route path="/*" element={
                <ProtectedRoute>
                  <AppContent />
                </ProtectedRoute>
              } />
            </Routes>
          </HashRouter>
          <ToastContainer />
        </ToastProvider>
      </AuthProvider>
    </MediaQueryProvider>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add App.tsx
git commit -m "feat(plan-5a): wrap App with MediaQueryProvider"
```

---

### Task 9: FormElements Touch Targets and Input Types

**Files:**
- Modify: `components/FormElements.tsx`

- [ ] **Step 1: Update Input component with min-height and dir="auto"**

In `FormElements.tsx`, replace the Input's `<input>` element className (lines 64-69) with:

```tsx
      <input
        className={`
          w-full bg-white border rounded-lg text-sm shadow-sm transition-all min-h-[44px]
          focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none
          ${Icon || prefix ? 'pl-9' : 'pl-3'} ${suffix ? 'pr-8' : 'pr-3'} py-2.5
          ${error ? 'border-red-300 focus:ring-red-500' : 'border-slate-300'}
          disabled:bg-slate-50 disabled:text-slate-500
        `}
        dir="auto"
        {...props}
      />
```

Key changes: `min-h-[44px]`, `py-2.5` (was `py-2`), `dir="auto"`.

- [ ] **Step 2: Update Select trigger button with min-height**

Replace the Select trigger button className (lines 130-136) with:

```tsx
          className={`
            w-full bg-white border rounded-lg text-sm shadow-sm transition-all min-h-[44px]
            focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none
            px-3 py-2.5 text-left flex items-center justify-between
            ${error ? 'border-red-300 focus:ring-red-500' : 'border-slate-300'}
            ${isOpen ? 'ring-2 ring-slate-900 border-transparent' : ''}
          `}
```

- [ ] **Step 3: Update Select option buttons with min-height**

Replace the option button className (lines 183-189) with:

```tsx
                    className={`
                      w-full text-left px-3 py-3 rounded-lg flex items-center justify-between transition-all duration-150 group mb-1 last:mb-0 min-h-[44px]
                      ${isSelected
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }
                    `}
```

- [ ] **Step 4: Update TextArea with min-height**

Replace the TextArea's `<textarea>` className (lines 238-242) with:

```tsx
      className={`
        w-full bg-white border rounded-lg text-sm shadow-sm transition-all resize-none min-h-[44px]
        focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none
        px-3 py-2.5
        ${error ? 'border-red-300 focus:ring-red-500' : 'border-slate-300'}
      `}
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add components/FormElements.tsx
git commit -m "feat(plan-5a): add 44px touch targets and dir=auto to FormElements"
```

---

### Task 10: MobileSelect Fullscreen Overlay

**Files:**
- Create: `components/MobileSelect.tsx`
- Modify: `components/FormElements.tsx`

- [ ] **Step 1: Create the MobileSelect component**

```tsx
// components/MobileSelect.tsx
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Check } from 'lucide-react';
import type { SelectOption } from './FormElements';

interface MobileSelectProps {
  isOpen: boolean;
  onClose: () => void;
  value?: string | number;
  onChange: (value: any) => void;
  options: SelectOption[];
  searchable?: boolean;
  placeholder?: string;
}

export const MobileSelect: React.FC<MobileSelectProps> = ({
  isOpen,
  onClose,
  value,
  onChange,
  options,
  searchable = false,
  placeholder = 'Sélectionner...',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  // Focus search on open
  useEffect(() => {
    if (isOpen && searchable) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
    if (!isOpen) setSearchTerm('');
  }, [isOpen, searchable]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (opt.subtitle && opt.subtitle.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelect = (optValue: string | number) => {
    onChange(optValue);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={placeholder}
      className="fixed inset-0 bg-white flex flex-col"
      style={{ zIndex: 'var(--z-modal)' }}
    >
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 shrink-0">
        <span className="font-semibold text-slate-900">{placeholder}</span>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Fermer"
        >
          <X size={20} />
        </button>
      </div>

      {/* Search */}
      {searchable && (
        <div className="p-3 border-b border-slate-100 shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:bg-white transition-colors placeholder:text-slate-400 min-h-[44px]"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Options list */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredOptions.length > 0 ? filteredOptions.map(option => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`w-full text-left px-4 py-4 rounded-xl flex items-center justify-between transition-all mb-1 min-h-[52px] ${
                isSelected
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden flex-1">
                {option.image ? (
                  <img src={option.image} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm shrink-0" />
                ) : option.initials ? (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border shrink-0 ${
                    isSelected ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-100 border-slate-200 text-slate-500'
                  }`}>
                    {option.initials}
                  </div>
                ) : null}
                <div className="flex flex-col min-w-0 flex-1">
                  <div className={`text-sm leading-tight ${isSelected ? 'font-medium' : ''}`}>
                    {option.label}
                  </div>
                  {option.subtitle && (
                    <div className="text-xs text-slate-400 truncate mt-0.5">
                      {option.subtitle}
                    </div>
                  )}
                </div>
              </div>
              {isSelected && (
                <div className="text-slate-900 shrink-0 ml-3">
                  <Check size={20} strokeWidth={2.5} />
                </div>
              )}
            </button>
          );
        }) : (
          <div className="py-12 text-center text-slate-500 flex flex-col items-center">
            <Search size={28} className="opacity-20 mb-3" />
            <span className="text-sm">Aucun résultat.</span>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
```

- [ ] **Step 2: Wire MobileSelect into the Select component**

In `FormElements.tsx`, add imports at the top:

```tsx
import { useMediaQuery } from '../context/MediaQueryContext';
import { MobileSelect } from './MobileSelect';
```

Inside the `Select` component, right after `const [searchTerm, setSearchTerm] = useState('');` (line 94), add:

```tsx
  const { isMobile } = useMediaQuery();
```

Then, right before the closing `</div>` of the `{error && ...}` block (before line 229), and right after the `{isOpen && (` dropdown block ends (after line 227), wrap the desktop dropdown in `{!isMobile && isOpen && (` and add the mobile overlay. The full change: replace the `{isOpen && (` block (lines 155-227) with:

```tsx
        {/* Desktop dropdown */}
        {!isMobile && isOpen && (
          <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl ring-1 ring-black/5 max-h-80 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200 origin-top" style={{ zIndex: 'var(--z-drawer-panel)' }}>
            {searchable && (
               <div className="p-3 border-b border-slate-100 sticky top-0 bg-white z-10">
                 <div className="relative">
                   <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   <input
                     ref={searchInputRef}
                     className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 focus:bg-white focus:ring-0 transition-colors placeholder:text-slate-400 text-slate-700"
                     placeholder="Rechercher..."
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                   />
                 </div>
               </div>
            )}
            <div className="overflow-y-auto p-2 custom-scrollbar">
              {filteredOptions.length > 0 ? filteredOptions.map(option => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`
                      w-full text-left px-3 py-3 rounded-lg flex items-center justify-between transition-all duration-150 group mb-1 last:mb-0 min-h-[44px]
                      ${isSelected
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                       {option.image ? (
                         <img src={option.image} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-sm shrink-0" />
                       ) : option.initials ? (
                         <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 shadow-sm transition-colors ${isSelected ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                           {option.initials}
                         </div>
                       ) : null}

                       <div className="flex flex-col min-w-0 flex-1">
                         <div className={`text-sm leading-tight ${isSelected ? 'font-medium' : 'font-normal'}`}>
                           {option.label}
                         </div>
                         {option.subtitle && (
                           <div className={`text-xs truncate mt-0.5 transition-colors font-normal ${isSelected ? 'text-slate-600' : 'text-slate-400 group-hover:text-slate-500'}`}>
                             {option.subtitle}
                           </div>
                         )}
                       </div>
                    </div>

                    {isSelected && (
                      <div className="text-slate-900 shrink-0 ml-3">
                        <Check size={18} strokeWidth={2.5} />
                      </div>
                    )}
                  </button>
                );
              }) : (
                <div className="py-8 px-4 text-center text-slate-500 flex flex-col items-center justify-center">
                  <Search size={24} className="opacity-20 mb-2" />
                  <span className="text-sm">Aucun résultat.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile fullscreen select */}
        {isMobile && (
          <MobileSelect
            isOpen={isOpen}
            onClose={() => { setIsOpen(false); setSearchTerm(''); }}
            value={value}
            onChange={(val) => { onChange(val); setIsOpen(false); setSearchTerm(''); }}
            options={options}
            searchable={searchable}
            placeholder={placeholder}
          />
        )}
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add components/MobileSelect.tsx components/FormElements.tsx
git commit -m "feat(plan-5a): add fullscreen MobileSelect overlay and wire into Select"
```

---

### Task 11: Dashboard Responsive Tweaks

**Files:**
- Modify: `modules/dashboard/DashboardModule.tsx`

- [ ] **Step 1: Update KPI grid for 320px screens**

Replace the KPI grid line (line 202):

```tsx
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-4">
```

- [ ] **Step 2: Update MetricCard for mobile flex-col**

Replace the MetricCard component (lines 22-45) with:

```tsx
const MetricCard = ({ title, value, trend, isPositive, subtitle, icon: Icon }: any) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 shadow-sm hover:shadow-md transition-all duration-200 h-full flex flex-col justify-between group">
      <div>
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xs md:text-sm font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">{title}</h3>
          {Icon && <Icon size={16} className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />}
        </div>
        <div className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight break-words">
          {typeof value === 'number' ? formatPrice(value) : value}
        </div>
      </div>
      <div className="flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-2 mt-3 md:mt-4 pt-2 md:pt-3 border-t border-slate-50">
          {trend !== null && (
             <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5 ${isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
               {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
               {Math.abs(trend).toFixed(1)}%
             </span>
          )}
          {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
      </div>
    </div>
  );
};
```

Key changes: `p-4 md:p-5`, `text-xs md:text-sm` for title, `text-xl md:text-2xl` for value, `flex-col md:flex-row` for trend area, `break-words` for long values.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add modules/dashboard/DashboardModule.tsx
git commit -m "feat(plan-5a): add Dashboard responsive KPI grid and MetricCard tweaks"
```

---

### Task 12: WorkScheduleEditor Horizontal Scroll

**Files:**
- Modify: `components/WorkScheduleEditor.tsx`

- [ ] **Step 1: Add horizontal scroll wrapper and column min-widths**

Replace the outer container and grid structure. Change the component's return (currently starts at line 53):

```tsx
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header / Toolbar */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap gap-2 items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">
          Configuration Hebdomadaire
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyMondayToWeekdays}
            className="text-xs flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium bg-white border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-all shadow-sm min-h-[36px]"
            title="Copier les horaires de Lundi sur Mardi-Vendredi"
          >
            <Copy size={12} />
            <span>Lun <span className="text-slate-400">→</span> Ven</span>
          </button>
          <button
            type="button"
            onClick={copyMondayToAll}
            className="text-xs flex items-center gap-1.5 text-brand-600 hover:text-brand-700 font-medium bg-brand-50 hover:bg-brand-100 border border-brand-100 px-3 py-1.5 rounded-lg transition-all min-h-[36px]"
            title="Copier les horaires de Lundi sur toute la semaine"
          >
            <RefreshCw size={12} />
            <span>Lun <span className="text-brand-400">→</span> Tous</span>
          </button>
        </div>
      </div>

      {/* Scrollable grid */}
      <div className="relative">
        {/* Fade gradient on right edge to signal scrollability */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none md:hidden" style={{ zIndex: 1 }} />

        <div className="overflow-x-auto scroll-smooth" style={{ scrollSnapType: 'x mandatory' }}>
          <div className="min-w-[600px]">
            {/* Grid Header */}
            <div className="grid grid-cols-12 gap-4 p-3 bg-slate-50/50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <div className="col-span-3 min-w-[64px]">Jour</div>
              <div className="col-span-3 text-center min-w-[120px]" style={{ scrollSnapAlign: 'start' }}>Statut</div>
              <div className="col-span-6 min-w-[240px]" style={{ scrollSnapAlign: 'start' }}>Plage Horaire</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {ORDERED_DAYS.map((day) => {
                const dayData = value[day];
                const isOpen = dayData.isOpen;

                return (
                  <div
                    key={day}
                    className={`
                      grid grid-cols-12 gap-4 p-4 items-center transition-all duration-200
                      ${isOpen ? 'bg-white' : 'bg-slate-50/30'}
                      group hover:bg-slate-50
                    `}
                  >
                    {/* Day Label */}
                    <div className="col-span-3 flex items-center gap-3 min-w-[64px]">
                      <div className={`w-1 h-8 rounded-full transition-colors ${isOpen ? 'bg-slate-900' : 'bg-slate-300'}`}></div>
                      <span className={`font-medium text-sm ${isOpen ? 'text-slate-900' : 'text-slate-400'}`}>
                        {DAY_LABELS[day]}
                      </span>
                    </div>

                    {/* Toggle Switch */}
                    <div className="col-span-3 flex justify-center min-w-[120px]">
                      <button
                        type="button"
                        onClick={() => handleChange(day, 'isOpen', !isOpen)}
                        className={`
                          group relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2
                          ${isOpen ? 'bg-slate-900' : 'bg-slate-200 hover:bg-slate-300'}
                        `}
                        role="switch"
                        aria-checked={isOpen}
                      >
                        <span className="sr-only">Toggle status</span>
                        <span
                          className={`
                            pointer-events-none relative inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                            ${isOpen ? 'translate-x-5' : 'translate-x-0'}
                          `}
                        >
                          <span
                            className={`absolute inset-0 flex h-full w-full items-center justify-center transition-opacity ${isOpen ? 'opacity-0 duration-100 ease-out' : 'opacity-100 duration-200 ease-in'}`}
                            aria-hidden="true"
                          >
                            <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 12 12">
                              <path d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                          <span
                            className={`absolute inset-0 flex h-full w-full items-center justify-center transition-opacity ${isOpen ? 'opacity-100 duration-200 ease-in' : 'opacity-0 duration-100 ease-out'}`}
                            aria-hidden="true"
                          >
                            <svg className="h-3 w-3 text-slate-900" fill="currentColor" viewBox="0 0 12 12">
                              <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
                            </svg>
                          </span>
                        </span>
                      </button>
                    </div>

                    {/* Time Inputs or Closed Badge */}
                    <div className="col-span-6 min-w-[240px]">
                      {isOpen ? (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                          <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                              <Clock size={14} className="text-slate-400" />
                            </div>
                            <input
                              type="time"
                              value={dayData.start}
                              onChange={(e) => handleChange(day, 'start', e.target.value)}
                              className="block w-full pl-8 pr-2 py-1.5 text-sm text-center bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:border-slate-900 shadow-sm hover:border-slate-400 transition-colors min-h-[44px]"
                            />
                          </div>

                          <span className="text-slate-400 font-medium text-sm">à</span>

                          <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                              <Clock size={14} className="text-slate-400" />
                            </div>
                            <input
                              type="time"
                              value={dayData.end}
                              onChange={(e) => handleChange(day, 'end', e.target.value)}
                              className="block w-full pl-8 pr-2 py-1.5 text-sm text-center bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:border-slate-900 shadow-sm hover:border-slate-400 transition-colors min-h-[44px]"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="w-full flex justify-center items-center h-[44px] animate-in zoom-in-95 duration-200">
                           <span className="inline-flex items-center justify-center px-4 py-1 rounded-lg bg-slate-100 text-slate-400 text-xs font-bold uppercase tracking-widest border border-slate-200/60 shadow-sm select-none">
                             Fermé
                           </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
```

Key changes:
- `overflow-x-auto` wrapper with `scroll-snap-type: x mandatory`
- `min-w-[600px]` inner container so content doesn't shrink
- Fade gradient on right edge (hidden on `md:` and up)
- `min-h-[44px]` on time inputs
- `min-w` on grid columns

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add components/WorkScheduleEditor.tsx
git commit -m "feat(plan-5a): add horizontal scroll with snap to WorkScheduleEditor"
```

---

### Task 13: BonusSystemEditor Mobile Card Layout

**Files:**
- Modify: `components/BonusSystemEditor.tsx`

- [ ] **Step 1: Add useMediaQuery and update layout**

Add import at top:

```tsx
import { useMediaQuery } from '../context/MediaQueryContext';
```

Inside the component, right after the opening, add:

```tsx
  const { isMobile } = useMediaQuery();
```

Replace the grid header (lines 33-43) with:

```tsx
      {tiers.length > 0 && !isMobile && (
        <div className="grid grid-cols-12 gap-4 mb-1 px-1">
          <div className="col-span-5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
             Objectif C.A. ({currencySymbol})
          </div>
          <div className="col-span-5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
             Prime ({currencySymbol})
          </div>
          <div className="col-span-2"></div>
        </div>
      )}
```

Replace the tiers map (lines 45-83) with:

```tsx
      <div className="space-y-2">
        {tiers.map((tier, idx) => (
          isMobile ? (
            /* Mobile: card layout */
            <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-3 animate-in slide-in-from-left-2 duration-300">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Objectif C.A. ({currencySymbol})
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={tier.target}
                  onChange={e => updateTier(idx, 'target', parseFloat(e.target.value))}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm min-h-[44px]"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Prime ({currencySymbol})
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={tier.bonus}
                  onChange={e => updateTier(idx, 'bonus', parseFloat(e.target.value))}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm font-medium min-h-[44px]"
                  placeholder="0"
                />
              </div>
              <button
                type="button"
                onClick={() => removeTier(idx)}
                className="w-full py-2.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors text-xs font-semibold border border-red-200 min-h-[44px]"
              >
                Supprimer ce palier
              </button>
            </div>
          ) : (
            /* Desktop: grid layout */
            <div key={idx} className="grid grid-cols-12 gap-4 items-center animate-in slide-in-from-left-2 duration-300 group">
              <div className="col-span-5">
                <input
                  type="number"
                  value={tier.target}
                  onChange={e => updateTier(idx, 'target', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm placeholder-slate-400"
                  placeholder="0"
                />
              </div>
              <div className="col-span-5">
                <input
                  type="number"
                  value={tier.bonus}
                  onChange={e => updateTier(idx, 'bonus', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all shadow-sm placeholder-slate-400 font-medium"
                  placeholder="0"
                />
              </div>
              <div className="col-span-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => removeTier(idx)}
                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-60 group-hover:opacity-100"
                  title="Supprimer ce palier"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )
        ))}
      </div>
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add components/BonusSystemEditor.tsx
git commit -m "feat(plan-5a): add mobile card layout to BonusSystemEditor"
```

---

### Task 14: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add Mobile Responsiveness section and update Known Issues**

Add after the "Error Boundaries" section in CLAUDE.md:

```markdown
### Mobile Responsiveness (Plan 5A)
- `context/MediaQueryContext.tsx` — singleton provider with breakpoint flags (isMobile/isTablet/isDesktop)
- `hooks/useSidebar.ts` — drawer/collapsed/expanded mode management
- `hooks/useViewMode.ts` — card/table toggle with localStorage persistence per module
- `components/BottomTabBar.tsx` — 5-tab mobile nav (Accueil, Agenda, Caisse, Clients, Plus)
- `components/MobileDrawer.tsx` — slide-in overlay with focus trap and ARIA
- `components/MobileSelect.tsx` — fullscreen select overlay for mobile
- `components/ViewToggle.tsx` — card/table switch button pair
- Layout.tsx refactored: sidebar hidden on mobile, bottom tabs + drawer shown
- FormElements: 44px touch targets, dir="auto", fullscreen Select on mobile
- WorkScheduleEditor: horizontal scroll with snap on mobile
- BonusSystemEditor: card layout on mobile
- z-index scale defined in CSS custom properties (--z-content through --z-toast)
```

Update Known Issues — mark #10 as done:

```markdown
10. ~~Not responsive for mobile~~ (DONE — Plan 5A infrastructure + nav + forms)
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(plan-5a): update CLAUDE.md with mobile responsiveness infrastructure"
```

---

## Self-Review Checklist

**Spec coverage (Sections 1, 2, 6):**
- [x] Section 1: MediaQueryContext singleton → Task 1
- [x] Section 1: useViewMode hook → Task 4
- [x] Section 1: ViewToggle component → Task 4
- [x] Section 1: useSidebar hook → Task 3
- [x] Section 1: Touch target standard → Tasks 9, 12
- [x] Section 2: Bottom tab bar → Task 5
- [x] Section 2: Overlay drawer → Task 6
- [x] Section 2: Layout refactor → Task 7
- [x] Section 2: z-index scale → Task 2
- [x] Section 2: Main content bottom padding → Task 7
- [x] Section 2: Permission filtering on tabs → Task 5
- [x] Section 2: Drawer accessibility → Task 6
- [x] Section 6: FormElements touch targets → Task 9
- [x] Section 6: Select fullscreen overlay → Task 10
- [x] Section 6: Dashboard responsive tweaks → Task 11
- [x] Section 6: WorkScheduleEditor horizontal scroll → Task 12
- [x] Section 6: BonusSystemEditor mobile cards → Task 13
- [x] Section 6: Input dir="auto" → Task 9
- [x] Section 6: Settings horizontal scroll tabs → Not in scope (SettingsModule uses a card grid, already `grid-cols-1 md:grid-cols-2` — already responsive)

**Deferred to Plan 5B:** Card/table toggle for data lists, date picker fullscreen modals
**Deferred to Plan 5C:** POS bottom sheet, peek bar, checkout fullscreen

**Placeholder scan:** No TBD, TODO, or vague requirements found.

**Type consistency:** `MediaQueryState`, `SidebarState`, `ViewMode`, `NavItem`, `DrawerNavItem` — all consistent across files.
