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

// ---------------------------------------------------------------------------
// Wall-clock → UTC instant helpers
// ---------------------------------------------------------------------------
// Date-range filters need actual UTC instants (passed to the server as ISO
// strings), not just calendar-day strings. The presets in DateRangePicker
// used `setHours(0,0,0,0)` against `new Date()`, which gives browser-local
// midnight — wrong whenever the browser TZ ≠ salon TZ. These helpers
// compute the UTC instant that corresponds to a given salon-local wall clock,
// which is the only correct way to bound a server-side query by salon-local
// calendar days.
// ---------------------------------------------------------------------------

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const PARTS_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timezone: string): Intl.DateTimeFormat {
  let fmt = PARTS_FORMATTER_CACHE.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    PARTS_FORMATTER_CACHE.set(timezone, fmt);
  }
  return fmt;
}

function extractParts(date: Date, timezone: string): Parts {
  const out: Partial<Parts> = {};
  for (const p of partsFormatter(timezone).formatToParts(date)) {
    if (p.type === 'year') out.year = Number(p.value);
    else if (p.type === 'month') out.month = Number(p.value);
    else if (p.type === 'day') out.day = Number(p.value);
    else if (p.type === 'hour') out.hour = Number(p.value) === 24 ? 0 : Number(p.value);
    else if (p.type === 'minute') out.minute = Number(p.value);
    else if (p.type === 'second') out.second = Number(p.value);
  }
  return out as Parts;
}

/**
 * Return the hour (0-23) of `value` as observed in `timezone`. Use for
 * bucketing transactions/appointments by hour-of-day from the salon's
 * point of view.
 */
export function getHourInSalon(value: DateLike, timezone: string): number {
  return extractParts(toDate(value), timezone).hour;
}

/** Day-of-month (1-31) of `value` in the salon's timezone. */
export function getDayOfMonthInSalon(value: DateLike, timezone: string): number {
  return extractParts(toDate(value), timezone).day;
}

/** Month (1-12) of `value` in the salon's timezone. */
export function getMonthInSalon(value: DateLike, timezone: string): number {
  return extractParts(toDate(value), timezone).month;
}

/** Year of `value` in the salon's timezone. */
export function getYearInSalon(value: DateLike, timezone: string): number {
  return extractParts(toDate(value), timezone).year;
}

/**
 * Day-of-week (0 = Sunday, 1 = Monday, … 6 = Saturday) for the salon-local
 * calendar day of `value`. Day-of-week is intrinsic to the calendar date so
 * we can compute it from the YYYY-MM-DD without further TZ math.
 */
export function getDayOfWeekInSalon(value: DateLike, timezone: string): number {
  const iso = salonDateString(value, timezone);
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/**
 * UTC instant of the given wall-clock time in `timezone`. Two-iteration
 * fixed-point: DST-safe (Paris spring-forward / fall-back), tolerant of any
 * IANA zone supported by the browser. Lands on the "first" instant when a
 * wall clock is repeated by a fall-back transition.
 */
function zonedToUTC(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timezone: string,
): Date {
  // Initial guess: treat the requested wall clock as if it were UTC. Then
  // measure how far that instant is from the requested wall clock when
  // expressed in `timezone`, and correct.
  let guess = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  for (let i = 0; i < 2; i++) {
    const actual = extractParts(new Date(guess), timezone);
    const target = Date.UTC(year, month - 1, day, hour, minute, second, ms);
    const observed = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
      ms,
    );
    const delta = target - observed;
    if (delta === 0) break;
    guess += delta;
  }
  return new Date(guess);
}

/** UTC instant for 00:00:00.000 salon-local on the calendar day of `value`. */
export function startOfDayInSalon(value: DateLike, timezone: string): Date {
  const p = extractParts(toDate(value), timezone);
  return zonedToUTC(p.year, p.month, p.day, 0, 0, 0, 0, timezone);
}

/** UTC instant for 23:59:59.999 salon-local on the calendar day of `value`. */
export function endOfDayInSalon(value: DateLike, timezone: string): Date {
  const p = extractParts(toDate(value), timezone);
  return zonedToUTC(p.year, p.month, p.day, 23, 59, 59, 999, timezone);
}

/**
 * Shift `value` by `days` salon-local days, preserving 00:00:00.000. Use for
 * "yesterday", "N days ago", etc. — handles DST transitions correctly
 * (24-hour math would drift by an hour on spring/fall switch days).
 */
export function addDaysInSalon(value: DateLike, days: number, timezone: string): Date {
  const p = extractParts(toDate(value), timezone);
  return zonedToUTC(p.year, p.month, p.day + days, 0, 0, 0, 0, timezone);
}

/** UTC instant for the first-of-month at 00:00 salon-local for `value`'s month. */
export function startOfMonthInSalon(value: DateLike, timezone: string): Date {
  const p = extractParts(toDate(value), timezone);
  return zonedToUTC(p.year, p.month, 1, 0, 0, 0, 0, timezone);
}

/** UTC instant for the last-of-month at 23:59:59.999 salon-local for `value`'s month. */
export function endOfMonthInSalon(value: DateLike, timezone: string): Date {
  const p = extractParts(toDate(value), timezone);
  // Day 0 of next month = last day of this month.
  return zonedToUTC(p.year, p.month + 1, 0, 23, 59, 59, 999, timezone);
}

/** UTC instant for Jan 1 at 00:00 salon-local for `value`'s year. */
export function startOfYearInSalon(value: DateLike, timezone: string): Date {
  const p = extractParts(toDate(value), timezone);
  return zonedToUTC(p.year, 1, 1, 0, 0, 0, 0, timezone);
}

/** UTC instant for Dec 31 at 23:59:59.999 salon-local for `value`'s year. */
export function endOfYearInSalon(value: DateLike, timezone: string): Date {
  const p = extractParts(toDate(value), timezone);
  return zonedToUTC(p.year, 12, 31, 23, 59, 59, 999, timezone);
}

/**
 * Construct a UTC instant from explicit salon-local wall-clock parts. Use this
 * when the y/m/d come from a UI calendar grid — passing a browser-local Date
 * through `startOfDayInSalon` would shift the calendar day for users whose
 * browser TZ is far from the salon TZ (e.g. >12h offset).
 *
 * Month is 1-indexed (1 = January) to match how humans write dates.
 */
export function salonInstantFromParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timezone: string,
): Date {
  return zonedToUTC(year, month, day, hour, minute, second, ms, timezone);
}
