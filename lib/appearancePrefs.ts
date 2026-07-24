/**
 * Appearance preferences shared between the app shell and the Réglages → Apparence page.
 *
 * The sidebar pin used to be local state inside Layout, which meant no other route
 * could read or change it. Backing it with a tiny external store (localStorage +
 * subscribers) lets `useSidebar` and the settings page stay in sync without
 * threading a context through the whole tree.
 */

const SIDEBAR_PINNED_KEY = 'appearance:sidebarPinned';

const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

export const getSidebarPinned = (): boolean => {
  try {
    return localStorage.getItem(SIDEBAR_PINNED_KEY) === 'true';
  } catch {
    // Private mode / storage disabled — fall back to the collapsed rail.
    return false;
  }
};

export const setSidebarPinned = (pinned: boolean): void => {
  try {
    localStorage.setItem(SIDEBAR_PINNED_KEY, String(pinned));
  } catch {
    // Ignore write failures; the in-memory notify below still updates this tab.
  }
  notify();
};

export const subscribeSidebarPinned = (onChange: () => void): (() => void) => {
  listeners.add(onChange);
  // `storage` fires only in *other* tabs, which is exactly the cross-tab case.
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
};
