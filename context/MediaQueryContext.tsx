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
