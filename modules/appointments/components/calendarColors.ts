interface CalendarColorTokens {
  bg: string;
  border: string;
  text: string;
  dot: string;
}

const COLOR_MAP: Record<string, CalendarColorTokens> = {
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-400',    text: 'text-blue-800',    dot: 'bg-blue-400' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-800', dot: 'bg-emerald-400' },
  purple:  { bg: 'bg-purple-50',  border: 'border-purple-400',  text: 'text-purple-800',  dot: 'bg-purple-400' },
  pink:    { bg: 'bg-pink-50',    border: 'border-pink-400',    text: 'text-pink-800',    dot: 'bg-pink-400' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-400',   text: 'text-amber-800',   dot: 'bg-amber-400' },
  red:     { bg: 'bg-red-50',     border: 'border-red-400',     text: 'text-red-800',     dot: 'bg-red-400' },
  cyan:    { bg: 'bg-cyan-50',    border: 'border-cyan-400',    text: 'text-cyan-800',    dot: 'bg-cyan-400' },
  rose:    { bg: 'bg-rose-50',    border: 'border-rose-400',    text: 'text-rose-800',    dot: 'bg-rose-400' },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-400',  text: 'text-indigo-800',  dot: 'bg-indigo-400' },
  teal:    { bg: 'bg-teal-50',    border: 'border-teal-400',    text: 'text-teal-800',    dot: 'bg-teal-400' },
};

const DEFAULT_TOKENS: CalendarColorTokens = {
  bg: 'bg-slate-50',
  border: 'border-slate-400',
  text: 'text-slate-800',
  dot: 'bg-slate-400',
};

function extractColorName(tailwindClasses: string): string | null {
  const match = tailwindClasses.match(/bg-(\w+)-\d+/);
  return match ? match[1] : null;
}

export function getCategoryCalendarColors(categoryColor: string): CalendarColorTokens {
  const colorName = extractColorName(categoryColor);
  if (colorName && COLOR_MAP[colorName]) return COLOR_MAP[colorName];
  return DEFAULT_TOKENS;
}

export function getStaffDotColor(staffColor: string): string {
  const colorName = extractColorName(staffColor);
  if (colorName && COLOR_MAP[colorName]) return COLOR_MAP[colorName].dot;
  return DEFAULT_TOKENS.dot;
}
