/**
 * Salon-timezone-aware date helpers.
 *
 * Every "what calendar day is this?" decision in the app must use the salon's
 * IANA timezone (`activeSalon.timezone`, e.g. `Africa/Casablanca`), not the
 * browser's local timezone. Otherwise:
 *   - a sale made at 00:30 local time in Casablanca (23:30 UTC yesterday)
 *     gets bucketed into yesterday by server code that compares against UTC;
 *   - a manager opening the app from a phone set to a different region sees
 *     "today" labels that disagree with what's actually happening in the salon;
 *   - Paris/Casablanca diverge by 1 hour every summer when Paris is on DST.
 *
 * Internally we lean on `Intl.DateTimeFormat` with `timeZone` rather than
 * pulling in a date library. The browser already ships full IANA data.
 *
 * For display formatting use `toLocaleString` with `{ timeZone }` directly —
 * these helpers cover the day-bucketing logic that's silently UTC/local
 * otherwise.
 */

type DateLike = Date | string | number;

function toDate(value: DateLike): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Return the YYYY-MM-DD string of `value` as seen in `timezone`. Stable across
 * machines because `en-CA` formats as ISO-style `YYYY-MM-DD`.
 */
export function salonDateString(value: DateLike, timezone: string): string {
  return toDate(value).toLocaleDateString('en-CA', { timeZone: timezone });
}

/** True if `a` and `b` fall on the same calendar day in `timezone`. */
export function isSameDayInSalon(a: DateLike, b: DateLike, timezone: string): boolean {
  return salonDateString(a, timezone) === salonDateString(b, timezone);
}

/** True if `value` falls on the salon's current calendar day. */
export function isTodayInSalon(value: DateLike, timezone: string): boolean {
  return isSameDayInSalon(value, new Date(), timezone);
}

/** True if `value` falls on the salon's next calendar day. */
export function isTomorrowInSalon(value: DateLike, timezone: string): boolean {
  const tomorrow = new Date(Date.now() + 86_400_000);
  return isSameDayInSalon(value, tomorrow, timezone);
}

/**
 * Today's date in the salon's timezone, as a YYYY-MM-DD string. Useful as
 * the upper bound on date-picker validation (e.g. "no future expense dates").
 */
export function todayInSalon(timezone: string): string {
  return salonDateString(new Date(), timezone);
}
