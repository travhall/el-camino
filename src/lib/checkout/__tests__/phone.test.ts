import { describe, it, expect } from 'vitest';
import { normalizePhoneE164 } from '../phone';

describe('normalizePhoneE164', () => {
  it('leaves an already-E.164 number unchanged', () => {
    expect(normalizePhoneE164('+14155551234')).toBe('+14155551234');
  });

  it('strips internal non-digit chars from an E.164-prefixed number', () => {
    expect(normalizePhoneE164('+1 (415) 555-1234')).toBe('+14155551234');
  });

  it('converts a plain 10-digit US number', () => {
    expect(normalizePhoneE164('4155551234')).toBe('+14155551234');
  });

  it('converts an 11-digit number with leading country code 1', () => {
    expect(normalizePhoneE164('14155551234')).toBe('+14155551234');
  });

  it.each([
    ['(415) 555-1234', '+14155551234'],
    ['415-555-1234', '+14155551234'],
    ['415.555.1234', '+14155551234'],
  ])('normalizes formatted input %s', (input, expected) => {
    expect(normalizePhoneE164(input)).toBe(expected);
  });

  it('trims surrounding whitespace before normalizing', () => {
    expect(normalizePhoneE164('  4155551234  ')).toBe('+14155551234');
  });

  // phone.ts:22 fallback — the code's own comment calls this "hope for the
  // best". A digit count that isn't 10 or 11 (leading 1) falls through to a
  // bare "+" + digits with no validation. Characterizing current behavior,
  // not endorsing it — see STOP condition in plans/165.
  it("falls back to '+' plus digits for a non-US digit count (characterizes the 'hope for the best' path)", () => {
    expect(normalizePhoneE164('123')).toBe('+123');
  });

  it("falls back to a bare '+' for input with no digits at all", () => {
    expect(normalizePhoneE164('abc')).toBe('+');
  });

  it("returns '+' for an empty string", () => {
    expect(normalizePhoneE164('')).toBe('+');
  });
});
