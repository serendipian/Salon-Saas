import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * PageHeaderContext coordinates the shared page title bar rendered in Layout.
 *
 * - Layout renders the bar container and registers its DOM element via `setSlot`.
 * - Each page mounts a single `<PageHeader>` (see components/PageHeader.tsx) which
 *   portals its styled content into `slot` and bumps `count` so the bar knows it
 *   has content to show (an empty bar stays hidden).
 *
 * This generalizes the register-handler pattern already used by FinancesLayout,
 * so page-specific buttons stay wired to each page's own state/modals.
 */
interface PageHeaderContextValue {
  /** The bar's inner DOM element — the portal target. Null until Layout mounts. */
  slot: HTMLElement | null;
  setSlot: (el: HTMLElement | null) => void;
  /** Number of currently-mounted PageHeaders (normally 0 or 1). */
  count: number;
  register: () => void;
  unregister: () => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export const PageHeaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [count, setCount] = useState(0);

  const register = useCallback(() => setCount((c) => c + 1), []);
  const unregister = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);

  const value = useMemo(
    () => ({ slot, setSlot, count, register, unregister }),
    [slot, count, register, unregister],
  );

  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
};

export const usePageHeaderSlot = (): PageHeaderContextValue => {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) {
    throw new Error('usePageHeaderSlot must be used within a PageHeaderProvider');
  }
  return ctx;
};
