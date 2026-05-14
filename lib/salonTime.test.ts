import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isSameDayInSalon,
  isTodayInSalon,
  isTomorrowInSalon,
  salonDateString,
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
});
