import { beforeEach, describe, expect, it } from 'vitest';
import { formatDuration, formatPrice, setSalonCurrency } from './format';

describe('formatPrice', () => {
  beforeEach(() => {
    setSalonCurrency('MAD');
  });

  it('formats integer amount in MAD', () => {
    expect(formatPrice(100)).toBe('100,00\u00A0MAD');
  });

  it('formats decimal amount', () => {
    expect(formatPrice(49.5)).toBe('49,50\u00A0MAD');
  });

  it('formats zero', () => {
    expect(formatPrice(0)).toBe('0,00\u00A0MAD');
  });

  it('formats negative amount', () => {
    expect(formatPrice(-15)).toMatch(/-15,00\u00A0MAD/);
  });

  it('formats large amount with thousand separator', () => {
    const out = formatPrice(1234567);
    expect(out).toContain('234');
    expect(out).toContain('567');
  });

  it('respects explicit currency override', () => {
    expect(formatPrice(100, 'EUR')).toBe('100,00\u00A0€');
  });

  it('uses the last setSalonCurrency call', () => {
    setSalonCurrency('USD');
    expect(formatPrice(100)).toBe('100,00\u00A0$US');
  });
});

describe('formatDuration', () => {
  it('formats minutes under 60', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(30)).toBe('30 min');
    expect(formatDuration(59)).toBe('59 min');
  });

  it('formats whole hours', () => {
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(180)).toBe('3h');
  });

  it('formats hours with minutes', () => {
    expect(formatDuration(90)).toBe('1h30');
    expect(formatDuration(105)).toBe('1h45');
    expect(formatDuration(125)).toBe('2h05');
  });
});
