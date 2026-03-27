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
