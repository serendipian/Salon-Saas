import { describe, expect, it } from 'vitest';
import type { WorkSchedule } from '../types';
import { getSalonHourRange } from './scheduleHours';

const mkDay = (isOpen: boolean, start = '', end = '') => ({ isOpen, start, end });

const FULL_WEEK = (start: string, end: string): WorkSchedule => ({
  monday: mkDay(true, start, end),
  tuesday: mkDay(true, start, end),
  wednesday: mkDay(true, start, end),
  thursday: mkDay(true, start, end),
  friday: mkDay(true, start, end),
  saturday: mkDay(true, start, end),
  sunday: mkDay(true, start, end),
});

describe('getSalonHourRange', () => {
  it('falls back to 9-20 when schedule is undefined', () => {
    expect(getSalonHourRange(undefined)).toEqual({ minHour: 9, maxHour: 20 });
  });

  it('returns start/end hours for a uniform schedule', () => {
    expect(getSalonHourRange(FULL_WEEK('10:00', '18:00'))).toEqual({
      minHour: 10,
      maxHour: 18,
    });
  });

  it('ceils end-hour up when minutes are non-zero', () => {
    expect(getSalonHourRange(FULL_WEEK('09:00', '19:30'))).toEqual({
      minHour: 9,
      maxHour: 20,
    });
  });

  it('picks the earliest start and latest end across days', () => {
    const mixed: WorkSchedule = {
      monday: mkDay(true, '08:00', '16:00'),
      tuesday: mkDay(true, '09:00', '20:00'),
      wednesday: mkDay(true, '10:00', '18:00'),
      thursday: mkDay(false),
      friday: mkDay(true, '07:30', '17:00'),
      saturday: mkDay(true, '11:00', '22:00'),
      sunday: mkDay(false),
    };
    expect(getSalonHourRange(mixed)).toEqual({ minHour: 7, maxHour: 22 });
  });

  it('falls back to 9-20 when no day is open', () => {
    const closed: WorkSchedule = {
      monday: mkDay(false),
      tuesday: mkDay(false),
      wednesday: mkDay(false),
      thursday: mkDay(false),
      friday: mkDay(false),
      saturday: mkDay(false),
      sunday: mkDay(false),
    };
    expect(getSalonHourRange(closed)).toEqual({ minHour: 9, maxHour: 20 });
  });
});
