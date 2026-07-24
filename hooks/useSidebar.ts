import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useMediaQuery } from '../context/MediaQueryContext';
import {
  getSidebarPinned,
  setSidebarPinned,
  subscribeSidebarPinned,
} from '../lib/appearancePrefs';

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

  // Persisted preference, editable from Réglages → Apparence.
  const expanded = useSyncExternalStore(subscribeSidebarPinned, getSidebarPinned, () => false);

  const mode: SidebarMode = useMemo(() => {
    if (isMobile) return 'drawer';
    if (isTabletPortrait) return 'collapsed';
    return expanded ? 'expanded' : 'collapsed';
  }, [isMobile, isTabletPortrait, expanded]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const toggleExpanded = useCallback(() => setSidebarPinned(!getSidebarPinned()), []);

  return {
    isDrawerOpen: drawerOpen,
    isExpanded: mode === 'expanded',
    mode,
    openDrawer,
    closeDrawer,
    toggleExpanded,
  };
};
