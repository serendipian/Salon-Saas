let _salonCurrency = 'MAD';

export function setSalonCurrency(currency: string) {
  _salonCurrency = currency;
}

export function formatPrice(amount: number, currency = _salonCurrency): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export function formatTicketNumber(n: number): string {
  return `n°${n.toString().padStart(6, '0')}`;
}

/**
 * Title-case a person's name for UI display only (does not mutate stored data).
 * Capitalises the first letter after any whitespace, hyphen, or apostrophe;
 * lowercases the rest. Unicode-aware.
 *
 *   "JOHN DOE"      → "John Doe"
 *   "marie-claire"  → "Marie-Claire"
 *   "o'brien"       → "O'Brien"
 */
export function formatName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/(^|[\s\-'])(\p{L})/gu, (_m, sep: string, c: string) => sep + c.toUpperCase());
}

/**
 * Format a YYYY-MM-DD string as a long French date.
 *   "2026-04-25" → "25 avril 2026"
 * Parses as local midnight (matches the rest of the form's date handling).
 */
export function formatLongDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Format an hour (0-23) and optional minute (0-59) as "HH:MM".
 *   formatHour(10)        → "10:00"
 *   formatHour(10, 30)    → "10:30"
 */
export function formatHour(hour: number, minute = 0): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
