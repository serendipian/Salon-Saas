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
  const toggleExpanded = useCallback(() => setExpanded((prev) => !prev), []);

  return {
    isDrawerOpen: drawerOpen,
    isExpanded: mode === 'expanded',
    mode,
    openDrawer,
    closeDrawer,
    toggleExpanded,
  };
};
