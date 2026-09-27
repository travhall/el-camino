/**
 * Tests for the grid entrance arming helpers (plan 202). Pure DOM, so these
 * exercise real DOM via happy-dom with no mocking.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  armInitialCardsForEntrance,
  restoreCards,
} from '@/lib/ui/gridEntrance';

function card(
  index: number,
  opts: {
    state?: 'opacity-0' | 'opacity-100';
    style?: string;
    filterHidden?: boolean;
  } = {}
): HTMLElement {
  const el = document.createElement('article');
  el.className = `product-card-wrapper grid ${opts.state ?? 'opacity-100'}`;
  el.dataset.initialIndex = String(index);
  if (opts.style) el.setAttribute('style', opts.style);
  if (opts.filterHidden) el.dataset.filterHidden = 'true';
  return el;
}

function setupGrid(...cards: HTMLElement[]): HTMLElement {
  const grid = document.createElement('div');
  grid.id = 'filterable-product-grid';
  cards.forEach((c) => grid.appendChild(c));
  document.body.appendChild(grid);
  return grid;
}

describe('armInitialCardsForEntrance', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('hides visible initial cards with transitions suppressed and returns them', () => {
    const a = card(0);
    const b = card(15);
    setupGrid(a, b);

    const armed = armInitialCardsForEntrance(document);

    expect(armed).toEqual([a, b]);
    for (const c of [a, b]) {
      expect(c.classList.contains('opacity-0')).toBe(true);
      expect(c.classList.contains('opacity-100')).toBe(false);
      expect(c.style.transition).toBe('none');
    }
  });

  it('leaves cards at or beyond maxIndex untouched', () => {
    const late = card(16);
    setupGrid(late);

    expect(armInitialCardsForEntrance(document)).toEqual([]);
    expect(late.classList.contains('opacity-100')).toBe(true);
    expect(late.style.transition).toBe('');
  });

  it('honours a custom maxIndex', () => {
    const a = card(1);
    const b = card(2);
    setupGrid(a, b);

    expect(armInitialCardsForEntrance(document, 2)).toEqual([a]);
    expect(b.classList.contains('opacity-100')).toBe(true);
  });

  it('leaves display:none and filter-hidden cards untouched', () => {
    const hidden = card(1, { style: 'display: none' });
    const filtered = card(2, { filterHidden: true });
    setupGrid(hidden, filtered);

    expect(armInitialCardsForEntrance(document)).toEqual([]);
    for (const c of [hidden, filtered]) {
      expect(c.classList.contains('opacity-100')).toBe(true);
      expect(c.classList.contains('opacity-0')).toBe(false);
      expect(c.style.transition).toBe('');
    }
  });

  it('does not return cards that are already opacity-0', () => {
    const already = card(0, { state: 'opacity-0' });
    setupGrid(already);

    expect(armInitialCardsForEntrance(document)).toEqual([]);
    expect(already.style.transition).toBe('');
  });

  it('returns an empty list for an empty grid without throwing', () => {
    setupGrid();
    expect(armInitialCardsForEntrance(document)).toEqual([]);
    expect(armInitialCardsForEntrance(document.body)).toEqual([]);
  });
});

describe('restoreCards', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns armed cards to opacity-100 and clears transition and animating', () => {
    const a = card(0);
    const b = card(1);
    setupGrid(a, b);
    const armed = armInitialCardsForEntrance(document);
    armed.forEach((c) => c.classList.add('animating'));

    restoreCards(armed);

    for (const c of [a, b]) {
      expect(c.classList.contains('opacity-100')).toBe(true);
      expect(c.classList.contains('opacity-0')).toBe(false);
      expect(c.classList.contains('animating')).toBe(false);
      expect(c.style.transition).toBe('');
    }
  });

  it('is a no-op for an empty list', () => {
    expect(() => restoreCards([])).not.toThrow();
  });
});
