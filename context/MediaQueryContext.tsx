import React, { createContext, useContext, useMemo, useRef, useSyncExternalStore } from 'react';

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

function readSnapshot(): MediaQueryState {
  return {
    isMobile: window.matchMedia(QUERIES.mobile).matches,
    isTablet: window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches,
    isTabletPortrait: window.matchMedia(QUERIES.tabletPortrait).matches,
    isTabletLandscape: window.matchMedia(QUERIES.tabletLandscape).matches,
    isDesktop: window.matchMedia(QUERIES.desktop).matches,
  };
}

function getServerSnapshot(): MediaQueryState {
  return {
    isMobile: false,
    isTablet: false,
    isTabletPortrait: false,
    isTabletLandscape: false,
    isDesktop: true,
  };
}

const MediaQueryContext = createContext<MediaQueryState>(getServerSnapshot());

// L-20: Cache + subscribe live inside the provider via refs instead of being
// declared at module scope. The previous module-level `let cachedState` was a
// shared mutable global, which broke under HMR (stale state survived reloads)
// and would have produced inconsistent reads if more than one provider was
// ever mounted. Per-provider refs eliminate both problems.
export const MediaQueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cacheRef = useRef<MediaQueryState | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = readSnapshot();
  }

  const { subscribe, getSnapshot } = useMemo(() => {
    const sub = (callback: () => void): (() => void) => {
      const queries = Object.values(QUERIES).map((q) => window.matchMedia(q));
      const handler = () => {
        cacheRef.current = readSnapshot();
        callback();
      };
      queries.forEach((mq) => mq.addEventListener('change', handler));
      return () => queries.forEach((mq) => mq.removeEventListener('change', handler));
    };
    const snap = (): MediaQueryState => {
      if (cacheRef.current === null) {
        cacheRef.current = readSnapshot();
      }
      return cacheRef.current;
    };
    return { subscribe: sub, getSnapshot: snap };
  }, []);

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return <MediaQueryContext.Provider value={state}>{children}</MediaQueryContext.Provider>;
};

export const useMediaQuery = (): MediaQueryState => useContext(MediaQueryContext);
