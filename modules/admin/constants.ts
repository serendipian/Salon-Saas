// modules/admin/constants.ts

export const TIER_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  trial: { label: 'ESSAI', color: '#1565c0', bg: '#e3f2fd' },
  free: { label: 'FREE', color: '#697386', bg: '#f0f0f0' },
  premium: { label: 'PREMIUM', color: '#5850ec', bg: '#ede9fe' },
  pro: { label: 'PRO', color: '#6d28d9', bg: '#f5f3ff' },
  past_due: { label: 'IMPAYÉ', color: '#df1b41', bg: '#fff0f0' },
};

export const ADMIN_FONT = { fontFamily: "'Inter', -apple-system, sans-serif" };
