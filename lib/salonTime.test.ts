import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addDaysInSalon,
  endOfDayInSalon,
  endOfMonthInSalon,
  getHourInSalon,
  isSameDayInSalon,
  isTodayInSalon,
  isTomorrowInSalon,
  salonDateString,
  startOfDayInSalon,
  startOfMonthInSalon,
  startOfYearInSalon,
  todayInSalon,
} from './salonTime';

describe('salonTime', () => {
  describe('salonDateString', () => {
    it('formats UTC instants into salon-local YYYY-MM-DD', () => {
      // 2026-05-13 23:50 UTC is 2026-05-14 in Casablanca (UTC+1, no DST)
      expect(salonDateString('2026-05-13T23:50:00Z', 'Africa/Casablanca')).toBe('2026-05-14');
      // Same instant is still 2026-05-13 in New York (UTC-4 with DST)
      expect(salonDateString('2026-05-13T23:50:00Z', 'America/New_York')).toBe('2026-05-13');
    });

    it('pads single-digit months and days', () => {
      expect(salonDateString('2026-01-05T12:00:00Z', 'UTC')).toBe('2026-01-05');
    });

    it('accepts Date and number inputs', () => {
      const d = new Date('2026-05-14T10:00:00Z');
      expect(salonDateString(d, 'Africa/Casablanca')).toBe('2026-05-14');
      expect(salonDateString(d.getTime(), 'Africa/Casablanca')).toBe('2026-05-14');
    });
  });

  describe('isSameDayInSalon', () => {
    it('returns true for two instants on the same salon-local day', () => {
      // Both are 2026-05-14 in Casablanca even though one is 2026-05-13 UTC
      expect(
        isSameDayInSalon('2026-05-13T23:50:00Z', '2026-05-14T10:00:00Z', 'Africa/Casablanca'),
      ).toBe(true);
    });

    it('returns false across the salon-local midnight boundary', () => {
      // 2026-05-13 22:00 UTC = 2026-05-13 23:00 Casablanca (still day 13)
      // 2026-05-14 00:30 UTC = 2026-05-14 01:30 Casablanca (now day 14)
      expect(
        isSameDayInSalon('2026-05-13T22:00:00Z', '2026-05-14T00:30:00Z', 'Africa/Casablanca'),
      ).toBe(false);
    });

    it('respects DST in Paris', () => {
      // Last Sunday of March 2026 = 2026-03-29 (CET → CEST switch at 01:00 UTC)
      // 2026-03-28 23:30 UTC = 2026-03-29 00:30 CET (day 29, still CET)
      // 2026-03-29 01:30 UTC = 2026-03-29 03:30 CEST (day 29, now CEST)
      expect(
        isSameDayInSalon('2026-03-28T23:30:00Z', '2026-03-29T01:30:00Z', 'Europe/Paris'),
      ).toBe(true);
    });
  });

  describe('isTodayInSalon / isTomorrowInSalon / todayInSalon', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Wall-clock: 2026-05-14 00:30 in Casablanca (UTC+1) = 2026-05-13 23:30 UTC
      vi.setSystemTime(new Date('2026-05-13T23:30:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("isTodayInSalon picks up the salon's calendar day, not UTC's", () => {
      // The actual now() in Casablanca is 2026-05-14 00:30
      expect(isTodayInSalon('2026-05-14T01:00:00Z', 'Africa/Casablanca')).toBe(true);
      // A sale at 2026-05-13 23:00 Casablanca-local = 2026-05-13 22:00 UTC
      expect(isTodayInSalon('2026-05-13T22:00:00Z', 'Africa/Casablanca')).toBe(false);
    });

    it('isTomorrowInSalon is correct around the local midnight', () => {
      // It is 2026-05-14 in Casablanca, so tomorrow is 2026-05-15
      expect(isTomorrowInSalon('2026-05-15T12:00:00Z', 'Africa/Casablanca')).toBe(true);
      expect(isTomorrowInSalon('2026-05-14T12:00:00Z', 'Africa/Casablanca')).toBe(false);
    });

    it('todayInSalon returns the salon-local YYYY-MM-DD', () => {
      expect(todayInSalon('Africa/Casablanca')).toBe('2026-05-14');
      // Same wall clock in New York (UTC-4) is still 2026-05-13 evening
      expect(todayInSalon('America/New_York')).toBe('2026-05-13');
    });
  });

  describe('getHourInSalon', () => {
    it('returns the hour as observed in the salon TZ', () => {
      // 2026-05-14 10:30 UTC = 11:30 Casablanca (UTC+1) = 06:30 NY (UTC-4 DST)
      expect(getHourInSalon('2026-05-14T10:30:00Z', 'Africa/Casablanca')).toBe(11);
      expect(getHourInSalon('2026-05-14T10:30:00Z', 'America/New_York')).toBe(6);
    });

    it('handles midnight correctly', () => {
      // 23:30 UTC May 13 = 00:30 May 14 in Casablanca
      expect(getHourInSalon('2026-05-13T23:30:00Z', 'Africa/Casablanca')).toBe(0);
    });
  });

  describe('startOfDayInSalon / endOfDayInSalon', () => {
    it('returns the UTC instant for salon-local midnight', () => {
      // 2026-05-14 00:00 Casablanca (UTC+1) = 2026-05-13 23:00 UTC
      const start = startOfDayInSalon('2026-05-14T12:00:00Z', 'Africa/Casablanca');
      expect(start.toISOString()).toBe('2026-05-13T23:00:00.000Z');
    });

    it('returns the UTC instant for salon-local end-of-day', () => {
      // 2026-05-14 23:59:59.999 Casablanca = 2026-05-14 22:59:59.999 UTC
      const end = endOfDayInSalon('2026-05-14T12:00:00Z', 'Africa/Casablanca');
      expect(end.toISOString()).toBe('2026-05-14T22:59:59.999Z');
    });

    it('round-trips across DST boundary (Paris spring-forward)', () => {
      // 2026-03-29: Europe/Paris jumps from CET (UTC+1) to CEST (UTC+2) at 01:00 UTC.
      // start-of-day for 2026-03-29 in Paris is 00:00 CET = 2026-03-28 23:00 UTC.
      const start = startOfDayInSalon('2026-03-29T12:00:00Z', 'Europe/Paris');
      expect(start.toISOString()).toBe('2026-03-28T23:00:00.000Z');
      // end-of-day for 2026-03-29 in Paris is 23:59:59.999 CEST = 21:59:59.999 UTC.
      const end = endOfDayInSalon('2026-03-29T12:00:00Z', 'Europe/Paris');
      expect(end.toISOString()).toBe('2026-03-29T21:59:59.999Z');
    });

    it('round-trips across DST boundary (Paris fall-back)', () => {
      // 2026-10-25: Europe/Paris falls from CEST (UTC+2) to CET (UTC+1) at 01:00 UTC.
      // start-of-day in Paris is 00:00 CEST = 2026-10-24 22:00 UTC.
      const start = startOfDayInSalon('2026-10-25T12:00:00Z', 'Europe/Paris');
      expect(start.toISOString()).toBe('2026-10-24T22:00:00.000Z');
      // end-of-day in Paris is 23:59:59.999 CET = 22:59:59.999 UTC.
      const end = endOfDayInSalon('2026-10-25T12:00:00Z', 'Europe/Paris');
      expect(end.toISOString()).toBe('2026-10-25T22:59:59.999Z');
    });
  });

  describe('addDaysInSalon', () => {
    it('shifts by salon-local days, not 24h chunks', () => {
      // 2026-05-14 in Casablanca → +1 day = 2026-05-15 00:00 Casablanca = 2026-05-14 23:00 UTC
      const next = addDaysInSalon('2026-05-14T12:00:00Z', 1, 'Africa/Casablanca');
      expect(next.toISOString()).toBe('2026-05-14T23:00:00.000Z');
    });

    it('crosses Paris spring-forward DST correctly', () => {
      // From 2026-03-28 to 2026-03-29 in Paris spans the spring-forward.
      // 2026-03-28 00:00 CET = 2026-03-27 23:00 UTC; +1 day = 2026-03-29 00:00 CET
      // (still CET, the jump happens at 01:00 UTC, before our 23:00 anchor) = 2026-03-28 23:00 UTC
      const next = addDaysInSalon('2026-03-28T12:00:00Z', 1, 'Europe/Paris');
      expect(next.toISOString()).toBe('2026-03-28T23:00:00.000Z');
    });

    it('supports negative deltas (yesterday)', () => {
      const prev = addDaysInSalon('2026-05-14T12:00:00Z', -1, 'Africa/Casablanca');
      expect(prev.toISOString()).toBe('2026-05-12T23:00:00.000Z');
    });
  });

  describe('startOfMonthInSalon / endOfMonthInSalon / startOfYearInSalon', () => {
    it('startOfMonth returns first-of-month at salon-local midnight', () => {
      const start = startOfMonthInSalon('2026-05-14T12:00:00Z', 'Africa/Casablanca');
      // 2026-05-01 00:00 Casablanca = 2026-04-30 23:00 UTC
      expect(start.toISOString()).toBe('2026-04-30T23:00:00.000Z');
    });

    it('endOfMonth returns last-of-month at salon-local end-of-day', () => {
      // May has 31 days. 2026-05-31 23:59:59.999 Casablanca = 2026-05-31 22:59:59.999 UTC.
      const end = endOfMonthInSalon('2026-05-14T12:00:00Z', 'Africa/Casablanca');
      expect(end.toISOString()).toBe('2026-05-31T22:59:59.999Z');
    });

    it('endOfMonth handles February in a leap year', () => {
      // 2028 is a leap year; Feb has 29 days. (Africa/Casablanca is awkward
      // here because it falls back to UTC during Ramadan, so use UTC for
      // a clean assertion about the day-29 boundary specifically.)
      const end = endOfMonthInSalon('2028-02-15T12:00:00Z', 'UTC');
      expect(end.toISOString()).toBe('2028-02-29T23:59:59.999Z');
    });

    it('startOfYear returns Jan 1 at salon-local midnight', () => {
      const start = startOfYearInSalon('2026-05-14T12:00:00Z', 'Africa/Casablanca');
      // 2026-01-01 00:00 Casablanca = 2025-12-31 23:00 UTC
      expect(start.toISOString()).toBe('2025-12-31T23:00:00.000Z');
    });
  });
});
