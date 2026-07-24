/**
 * Appearance preferences shared between the app shell and the Réglages → Apparence page.
 *
 * The sidebar pin used to be local state inside Layout, which meant no other route
 * could read or change it. Backing it with a tiny external store (localStorage +
 * subscribers) lets `useSidebar` and the settings page stay in sync without
 * threading a context through the whole tree.
 */

const SIDEBAR_PINNED_KEY = 'appearance:sidebarPinned';
const ACCENT_KEY = 'appearance:accent';

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

/* ------------------------------------------------------------------ */
/* Accent colour                                                       */
/* ------------------------------------------------------------------ */

export interface AccentPalette {
  id: string;
  label: string;
  /** Shades 50→700, applied to the --accent-* custom properties on :root. */
  shades: [string, string, string, string, string, string, string, string];
}

/** Tailwind palettes, so the shades stay tonally consistent with the rest of the UI. */
export const ACCENT_PALETTES: AccentPalette[] = [
  {
    id: 'blue',
    label: 'Bleu',
    shades: [
      '#eff6ff',
      '#dbeafe',
      '#bfdbfe',
      '#93c5fd',
      '#60a5fa',
      '#3b82f6',
      '#2563eb',
      '#1d4ed8',
    ],
  },
  {
    id: 'rose',
    label: 'Rose',
    shades: [
      '#fdf2f8',
      '#fce7f3',
      '#fbcfe8',
      '#f9a8d4',
      '#f472b6',
      '#ec4899',
      '#db2777',
      '#be185d',
    ],
  },
  {
    id: 'violet',
    label: 'Violet',
    shades: [
      '#f5f3ff',
      '#ede9fe',
      '#ddd6fe',
      '#c4b5fd',
      '#a78bfa',
      '#8b5cf6',
      '#7c3aed',
      '#6d28d9',
    ],
  },
  {
    id: 'emerald',
    label: 'Émeraude',
    shades: [
      '#ecfdf5',
      '#d1fae5',
      '#a7f3d0',
      '#6ee7b7',
      '#34d399',
      '#10b981',
      '#059669',
      '#047857',
    ],
  },
  {
    id: 'amber',
    label: 'Ambre',
    shades: [
      '#fffbeb',
      '#fef3c7',
      '#fde68a',
      '#fcd34d',
      '#fbbf24',
      '#f59e0b',
      '#d97706',
      '#b45309',
    ],
  },
  {
    id: 'slate',
    label: 'Graphite',
    shades: [
      '#f8fafc',
      '#f1f5f9',
      '#e2e8f0',
      '#cbd5e1',
      '#94a3b8',
      '#475569',
      '#334155',
      '#1e293b',
    ],
  },
];

const DEFAULT_ACCENT = 'blue';

export const getAccentId = (): string => {
  try {
    const stored = localStorage.getItem(ACCENT_KEY);
    return ACCENT_PALETTES.some((p) => p.id === stored) ? (stored as string) : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
};

/** Writes the palette onto :root so every `accent-*` utility updates at once. */
export const applyAccent = (id: string): void => {
  const palette = ACCENT_PALETTES.find((p) => p.id === id) ?? ACCENT_PALETTES[0];
  const steps = [50, 100, 200, 300, 400, 500, 600, 700];
  const root = document.documentElement;
  palette.shades.forEach((hex, i) => {
    root.style.setProperty(`--accent-${steps[i]}`, hex);
  });
};

export const setAccentId = (id: string): void => {
  try {
    localStorage.setItem(ACCENT_KEY, id);
  } catch {
    // Ignore write failures; the applied styles below still update this tab.
  }
  applyAccent(id);
  notify();
};

export const subscribeAccent = subscribeSidebarPinned;
