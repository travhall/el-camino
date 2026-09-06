import { describe, it, expect } from 'vitest';
import { resolveViewableOrderId } from '../resolveViewableOrderId';

describe('resolveViewableOrderId', () => {
  it('returns the id when the URL param matches the cookie', () => {
    expect(
      resolveViewableOrderId({
        paramId: 'abc123',
        cookieId: 'abc123',
        transactionOrderId: null,
      })
    ).toBe('abc123');
  });

  it('returns null when the URL param differs from the cookie', () => {
    expect(
      resolveViewableOrderId({
        paramId: 'attacker-guess',
        cookieId: 'abc123',
        transactionOrderId: null,
      })
    ).toBeNull();
  });

  it('returns null when there is no cookie at all', () => {
    expect(
      resolveViewableOrderId({
        paramId: 'abc123',
        cookieId: null,
        transactionOrderId: null,
      })
    ).toBeNull();
  });

  it("returns the cookie's id when no URL param or transaction id is present", () => {
    expect(
      resolveViewableOrderId({
        paramId: null,
        cookieId: 'abc123',
        transactionOrderId: null,
      })
    ).toBe('abc123');
  });

  it('returns null for an empty cookie value', () => {
    expect(
      resolveViewableOrderId({
        paramId: null,
        cookieId: '',
        transactionOrderId: null,
      })
    ).toBeNull();
  });

  it('returns the id when the transactionId lookup matches the cookie', () => {
    expect(
      resolveViewableOrderId({
        paramId: null,
        cookieId: 'abc123',
        transactionOrderId: 'abc123',
      })
    ).toBe('abc123');
  });

  it('returns null when the transactionId lookup differs from the cookie', () => {
    expect(
      resolveViewableOrderId({
        paramId: null,
        cookieId: 'abc123',
        transactionOrderId: 'different',
      })
    ).toBeNull();
  });
});
