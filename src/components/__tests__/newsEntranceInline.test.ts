/**
 * Plan 230. The first news cards fade in with the home page's entrance, armed by
 * the inline script in ArticleGrid.astro. It has to be inline: the module script
 * that arms cards via armCardsOnImageReady runs only after about 39 script
 * requests, and measured on throttled mobile the cards then waited for the
 * 2.5 s safety timer (Speed Index 3.5 s, no better than before the fix). An
 * inline script arms each card the moment its own image has loaded.
 *
 * The script text is read from the component and run against a real DOM.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync(resolve(__dirname, '../ArticleGrid.astro'), 'utf8');
const code =
  /<script is:inline nonce=\{nonce\}>([\s\S]*?)<\/script>/.exec(source)?.[1] ??
  '';

function card(className: string, complete: boolean): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = `article-card-wrapper ${className}`;
  const img = document.createElement('img');
  Object.defineProperty(img, 'complete', { value: complete });
  wrapper.appendChild(img);
  document.body.appendChild(wrapper);
  return wrapper;
}

const run = () => new Function(code)();
const armed = (el: HTMLElement) => el.classList.contains('entrance-armed');

describe('ArticleGrid inline arming script', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('is found in the component', () => {
    expect(code).toContain('news-entrance');
  });

  it('arms a news card whose image is already loaded, immediately', () => {
    const el = card('news-entrance', true);
    run();
    expect(armed(el)).toBe(true);
  });

  it('arms a news card when its image loads, long before the safety timer', () => {
    const el = card('news-entrance', false);
    run();
    expect(armed(el)).toBe(false);

    el.querySelector('img')!.dispatchEvent(new Event('load'));

    expect(armed(el)).toBe(true);
  });

  it('arms a news card when its image fails to load', () => {
    const el = card('news-entrance', false);
    run();

    el.querySelector('img')!.dispatchEvent(new Event('error'));

    expect(armed(el)).toBe(true);
  });

  it('still arms every card after 2.5 s if no image ever settles', () => {
    const el = card('news-entrance', false);
    run();

    vi.advanceTimersByTime(2499);
    expect(armed(el)).toBe(false);
    vi.advanceTimersByTime(1);
    expect(armed(el)).toBe(true);
  });

  it('does not arm cards that use the scroll-in reveal', () => {
    const el = card('opacity-0', true);
    run();
    vi.advanceTimersByTime(3000);
    expect(armed(el)).toBe(false);
  });
});
