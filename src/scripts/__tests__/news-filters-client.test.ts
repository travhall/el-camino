/**
 * Characterization tests for news-filters-client (plan 226, extracted from the
 * main inline script in NewsFilters.astro). Each test does a fresh
 * `vi.resetModules()` + dynamic import because the module holds module-level
 * state (the `initialized` guard and the current NewsFiltersManager).
 *
 * The module registers listeners on `window` and `document` that outlive a
 * test, so every `addEventListener` call on them is recorded in `beforeEach`
 * and undone in `afterEach`; otherwise an earlier test's copy of the module
 * would also react to the events a later test dispatches.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { coordinateExit, navigate } = vi.hoisted(() => ({
  // Run the exit animation callback straight away.
  coordinateExit: vi.fn((callback: () => void) => callback()),
  navigate: vi.fn(),
}));

vi.mock('@/lib/filterCoordinator', () => ({
  FilterCoordinator: { coordinateExit },
  GRID_CONFIGS: { article: 'ARTICLE_GRID_CONFIG' },
}));

vi.mock('astro:transitions/client', () => ({ navigate }));

type Recorded = {
  target: Window | Document;
  type: string;
  listener: EventListenerOrEventListenerObject;
};
let recorded: Recorded[] = [];

function setViewport(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
    writable: true,
  });
}

const TAG_CLASSES =
  'inline-flex bg-(--surface-tertiary) text-(--content-body) hover:bg-(--ui-button-surface)';

function tagButton(slug: string, applied: boolean): string {
  return `<button type="button" class="tag-filter-button" data-tag-chip="${slug}" data-applied="${applied}" data-pending="false"><span class="${TAG_CLASSES}">${slug}</span></button>`;
}

function setupDom(): void {
  document.body.style.overflow = '';
  document.body.innerHTML = `
    <header id="site-header"></header>
    <button id="mobile-news-filter-toggle" type="button">Filters</button>
    <div id="mobile-news-filter-overlay" class="pointer-events-none opacity-0"></div>
    <div id="news-filter-container" class="opacity-0 pointer-events-none translate-y-full">
      <button id="mobile-news-filter-close" type="button">Close</button>
      <form id="news-filter-form" action="/news">
        <div class="filter-section">
          <button type="button" data-section-toggle="news-categories" aria-controls="news-categories-content" aria-expanded="true"></button>
          <svg class="filter-chevron"></svg>
          <button type="button" data-clear-categories>Clear categories</button>
          <div id="news-categories-content">
            <input type="checkbox" name="categories" value="shop-news">
            <input type="checkbox" name="categories" value="news">
          </div>
        </div>
        <div class="filter-section">
          <button type="button" data-section-toggle="news-tags" aria-controls="news-tags-content" aria-expanded="true"></button>
          <svg class="filter-chevron"></svg>
          <button type="button" data-clear-tags>Clear tags</button>
          <div id="news-tags-content">
            ${tagButton('event', false)}
            ${tagButton('skate', true)}
          </div>
        </div>
        <div class="hidden">
          <input type="hidden" name="tags" value="skate" data-tag-input="skate">
        </div>
        <button type="submit" id="mobile-apply-filters" data-default-text="Apply Filters">Apply Filters</button>
      </form>
      <button type="button" data-clear-all-news-filters>Clear all</button>
    </div>
  `;
}

async function freshInit() {
  vi.resetModules();
  const mod = await import('../news-filters-client');
  mod.init();
  return mod;
}

/** What the page does once Astro finishes loading: builds the manager. */
function pageLoad(): void {
  document.dispatchEvent(new Event('astro:page-load'));
}

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector(selector) as T;
const $$ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  [...document.querySelectorAll(selector)] as T[];
const category = (value: string) =>
  $<HTMLInputElement>(`input[name="categories"][value="${value}"]`);
const chip = (slug: string) =>
  $<HTMLButtonElement>(`[data-tag-chip="${slug}"]`);
const chipComponent = (slug: string) =>
  chip(slug).querySelector('[class*="inline-flex"]') as HTMLElement;
const tagInputs = () => $$('[data-tag-input]').map((i) => i.dataset.tagInput);
const applyButton = () => $<HTMLButtonElement>('#mobile-apply-filters');
const formAction = () => $<HTMLFormElement>('#news-filter-form').action;

function tick(box: HTMLInputElement, checked: boolean): void {
  box.checked = checked;
  box.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('news-filters-client', () => {
  beforeEach(() => {
    recorded = [];
    for (const target of [window, document] as const) {
      const original = target.addEventListener.bind(target) as (
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
      ) => void;
      vi.spyOn(target, 'addEventListener').mockImplementation(
        (type: string, listener: unknown, options?: unknown) => {
          recorded.push({
            target,
            type,
            listener: listener as EventListenerOrEventListenerObject,
          });
          original(
            type,
            listener as EventListenerOrEventListenerObject,
            options as boolean | AddEventListenerOptions
          );
        }
      );
    }
    coordinateExit.mockClear();
    navigate.mockClear();
    sessionStorage.clear();
    window.history.pushState({}, '', '/news');
    setViewport(1280);
    setupDom();
  });

  afterEach(() => {
    for (const { target, type, listener } of recorded) {
      target.removeEventListener(type, listener);
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
    document.body.style.overflow = '';
  });

  describe('init', () => {
    it('registers the page-load and before-preparation handlers', async () => {
      await freshInit();

      expect(recorded.map((r) => r.type).sort()).toEqual([
        'astro:before-preparation',
        'astro:page-load',
      ]);
    });

    it('is guarded: a second init() registers nothing further', async () => {
      const mod = await freshInit();
      const before = recorded.length;
      mod.init();

      expect(recorded).toHaveLength(before);
    });

    it('does nothing for a page with no filter form', async () => {
      $('#news-filter-form').remove();
      await freshInit();

      expect(() => pageLoad()).not.toThrow();
      expect(
        $('#news-filter-container').classList.contains('translate-y-full')
      ).toBe(true);
    });
  });

  describe('the instance', () => {
    it('parks the drawer off-screen for the viewport: bottom on a phone, right on a tablet, neither on desktop', async () => {
      const container = () => $('#news-filter-container');
      await freshInit();

      setViewport(500);
      pageLoad();
      expect(container().classList.contains('translate-y-full')).toBe(true);
      expect(container().classList.contains('translate-x-full')).toBe(false);

      setViewport(900);
      pageLoad();
      expect(container().classList.contains('translate-x-full')).toBe(true);
      expect(container().classList.contains('translate-y-full')).toBe(false);

      setViewport(1280);
      pageLoad();
      expect(container().classList.contains('translate-x-full')).toBe(false);
      expect(container().classList.contains('translate-y-full')).toBe(false);
    });

    it('a second page-load destroys the previous instance instead of stacking listeners', async () => {
      vi.useFakeTimers();
      await freshInit();
      pageLoad();
      pageLoad();

      tick(category('news'), true);
      vi.advanceTimersByTime(150);

      expect(navigate).toHaveBeenCalledTimes(1);
    });
  });

  describe('the mobile drawer', () => {
    async function setupPhone() {
      setViewport(500);
      await freshInit();
      pageLoad();
    }

    it('opens from the toggle: lowers the header, reveals panel and overlay, locks scroll', async () => {
      await setupPhone();

      $('#mobile-news-filter-toggle').click();

      expect($('#site-header').style.zIndex).toBe('9');
      const overlay = $('#mobile-news-filter-overlay');
      expect(overlay.classList.contains('opacity-0')).toBe(false);
      expect(overlay.classList.contains('pointer-events-none')).toBe(false);
      const panel = $('#news-filter-container');
      expect(panel.classList.contains('translate-y-full')).toBe(false);
      expect(panel.classList.contains('opacity-0')).toBe(false);
      expect(panel.classList.contains('pointer-events-none')).toBe(false);
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('opens a tablet panel from the right instead of the bottom', async () => {
      setViewport(900);
      await freshInit();
      pageLoad();

      $('#mobile-news-filter-toggle').click();

      expect(
        $('#news-filter-container').classList.contains('translate-x-full')
      ).toBe(false);
    });

    it.each([
      ['the close button', '#mobile-news-filter-close'],
      ['the overlay', '#mobile-news-filter-overlay'],
    ])(
      'closes from %s and restores the header after the transition',
      async (_name, selector) => {
        vi.useFakeTimers();
        await setupPhone();
        $('#mobile-news-filter-toggle').click();

        $(selector).click();

        expect(
          $('#news-filter-container').classList.contains('translate-y-full')
        ).toBe(true);
        expect(
          $('#news-filter-container').classList.contains('opacity-0')
        ).toBe(true);
        expect(document.body.style.overflow).toBe('');
        // Until the transition ends (or the 350 ms fallback fires) the header
        // stays lowered.
        expect($('#site-header').style.zIndex).toBe('9');

        vi.advanceTimersByTime(350);

        expect($('#site-header').style.zIndex).toBe('');
        expect(
          $('#news-filter-container').classList.contains('pointer-events-none')
        ).toBe(true);
        expect(
          $('#mobile-news-filter-overlay').classList.contains(
            'pointer-events-none'
          )
        ).toBe(true);
      }
    );

    it('completes the close once even if both transitionend and the fallback fire', async () => {
      vi.useFakeTimers();
      await setupPhone();
      $('#mobile-news-filter-toggle').click();
      $('#mobile-news-filter-close').click();

      $('#news-filter-container').dispatchEvent(new Event('transitionend'));
      expect($('#site-header').style.zIndex).toBe('');

      // Reopen: the late 350 ms fallback must not touch the header again.
      $('#mobile-news-filter-toggle').click();
      vi.advanceTimersByTime(350);
      expect($('#site-header').style.zIndex).toBe('9');
    });

    it('re-parks a closed drawer when the viewport crosses the phone/tablet boundary, but not an open one', async () => {
      await setupPhone();
      setViewport(900);
      window.dispatchEvent(new Event('resize'));
      expect(
        $('#news-filter-container').classList.contains('translate-x-full')
      ).toBe(true);

      $('#mobile-news-filter-toggle').click();
      setViewport(500);
      window.dispatchEvent(new Event('resize'));
      expect(
        $('#news-filter-container').classList.contains('translate-y-full')
      ).toBe(false);
    });
  });

  describe('accordions', () => {
    const content = (id: string) => document.getElementById(id) as HTMLElement;

    it('toggles a section, updates aria-expanded and the chevron, and remembers the state under its own key', async () => {
      await freshInit();
      pageLoad();
      const toggle = $('[data-section-toggle="news-tags"]');

      toggle.click();
      expect(content('news-tags-content').classList.contains('is-closed')).toBe(
        true
      );
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(
        toggle
          .closest('.filter-section')!
          .querySelector('.filter-chevron')!
          .classList.contains('is-collapsed')
      ).toBe(true);
      expect(sessionStorage.getItem('news-filter-section-tags')).toBe('closed');
      expect(
        sessionStorage.getItem('news-filter-section-categories')
      ).toBeNull();

      toggle.click();
      expect(content('news-tags-content').classList.contains('is-closed')).toBe(
        false
      );
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(sessionStorage.getItem('news-filter-section-tags')).toBe('open');
    });

    it('restores a saved closed state without animating, then re-enables the transition', async () => {
      vi.useFakeTimers();
      sessionStorage.setItem('news-filter-section-categories', 'closed');
      await freshInit();
      pageLoad();

      const el = content('news-categories-content');
      expect(el.classList.contains('is-closed')).toBe(true);
      expect(
        $('[data-section-toggle="news-categories"]').getAttribute(
          'aria-expanded'
        )
      ).toBe('false');
      expect(el.style.transition).toBe('none');

      vi.advanceTimersByTime(100);
      expect(el.style.transition).toBe('');
      expect(content('news-tags-content').classList.contains('is-closed')).toBe(
        false
      );
    });
  });

  describe('desktop: filtering as you click', () => {
    it('submits a category change after a 150 ms debounce, navigating through the coordinator', async () => {
      vi.useFakeTimers();
      await freshInit();
      pageLoad();

      tick(category('shop-news'), true);
      expect(navigate).not.toHaveBeenCalled();
      vi.advanceTimersByTime(150);

      expect(coordinateExit).toHaveBeenCalledTimes(1);
      const [, targetUrl, config] = coordinateExit.mock.calls[0] as unknown[];
      expect(config).toBe('ARTICLE_GRID_CONFIG');
      expect(targetUrl).toBe(`${formAction()}?categories=shop-news&tags=skate`);
      expect(navigate).toHaveBeenCalledWith(targetUrl);
    });

    it('collapses a burst of changes into one navigation', async () => {
      vi.useFakeTimers();
      await freshInit();
      pageLoad();

      tick(category('shop-news'), true);
      vi.advanceTimersByTime(100);
      tick(category('news'), true);
      vi.advanceTimersByTime(100);
      expect(navigate).not.toHaveBeenCalled();
      vi.advanceTimersByTime(50);

      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(
        `${formAction()}?categories=shop-news&categories=news&tags=skate`
      );
    });

    it('navigates to the bare form action when nothing is selected', async () => {
      vi.useFakeTimers();
      $('[data-tag-input]').remove();
      await freshInit();
      pageLoad();

      tick(category('news'), true);
      tick(category('news'), false);
      vi.advanceTimersByTime(150);

      expect(navigate).toHaveBeenCalledWith(formAction());
    });

    it('a tablet (below 1024 px) still waits for Apply: no live filtering, tag changes stay pending', async () => {
      vi.useFakeTimers();
      setViewport(900);
      await freshInit();
      pageLoad();

      tick(category('news'), true);
      chip('event').click();
      vi.advanceTimersByTime(500);

      expect(navigate).not.toHaveBeenCalled();
      expect(chip('event').dataset.pending).toBe('true');
      expect(applyButton().textContent).toBe('Apply Filters (1)');
    });

    it('shrinking from desktop to a tablet width switches to pending-until-Apply', async () => {
      vi.useFakeTimers();
      await freshInit();
      pageLoad();

      setViewport(900);
      window.dispatchEvent(new Event('resize'));
      chip('event').click();
      vi.advanceTimersByTime(500);

      expect(navigate).not.toHaveBeenCalled();
      expect(chip('event').dataset.pending).toBe('true');
    });

    it('a checkbox change on a phone does nothing until the filters are applied', async () => {
      vi.useFakeTimers();
      setViewport(500);
      await freshInit();
      pageLoad();

      tick(category('news'), true);
      vi.advanceTimersByTime(500);

      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('tag chips', () => {
    it('desktop: clicking an unselected tag adds it to the form, restyles it and submits', async () => {
      vi.useFakeTimers();
      await freshInit();
      pageLoad();

      chip('event').click();

      expect(tagInputs()).toEqual(['skate', 'event']);
      expect($('[data-tag-input="event"]').closest('.hidden')).not.toBeNull();
      expect(chip('event').dataset.applied).toBe('true');
      expect(chip('event').dataset.pending).toBe('false');
      expect(
        chipComponent('event').classList.contains('bg-(--ui-button-surface)')
      ).toBe(true);
      expect(
        chipComponent('event').classList.contains('bg-(--surface-tertiary)')
      ).toBe(false);

      vi.advanceTimersByTime(150);
      expect(navigate).toHaveBeenCalledWith(
        `${formAction()}?tags=skate&tags=event`
      );
    });

    it('desktop: clicking an applied tag removes it, restores its style and submits', async () => {
      vi.useFakeTimers();
      await freshInit();
      pageLoad();

      chip('skate').click();

      expect(tagInputs()).toEqual([]);
      expect(chip('skate').dataset.applied).toBe('false');
      expect(
        chipComponent('skate').classList.contains('bg-(--surface-tertiary)')
      ).toBe(true);
      expect(
        chipComponent('skate').classList.contains('bg-(--ui-button-surface)')
      ).toBe(false);

      vi.advanceTimersByTime(150);
      expect(navigate).toHaveBeenCalledWith(formAction());
    });

    it('desktop: removes a tag whose slug contains a quote, without breaking the selector', async () => {
      vi.useFakeTimers();
      const slug = 'say"hi';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tag-filter-button';
      button.dataset.tagChip = slug;
      button.dataset.applied = 'true';
      button.dataset.pending = 'false';
      button.innerHTML = `<span class="${TAG_CLASSES}">x</span>`;
      $('#news-tags-content').appendChild(button);
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'tags';
      input.value = slug;
      input.setAttribute('data-tag-input', slug);
      $('.hidden').appendChild(input);
      await freshInit();
      pageLoad();

      button.click();

      expect(tagInputs()).toEqual(['skate']);
      vi.advanceTimersByTime(150);
      expect(navigate).toHaveBeenCalledWith(`${formAction()}?tags=skate`);
    });

    describe('on a phone, changes are pending until Apply', () => {
      beforeEach(async () => {
        setViewport(500);
        await freshInit();
        pageLoad();
      });

      it('marks a tag pending-add and counts it on the Apply button', () => {
        chip('event').click();

        expect(chip('event').dataset.pending).toBe('true');
        expect(chip('event').dataset.applied).toBe('false');
        expect(
          chipComponent('event').classList.contains('bg-(--ui-accent)')
        ).toBe(true);
        expect(applyButton().textContent).toBe('Apply Filters (1)');
        expect(applyButton().classList.contains('bg-(--ui-accent)')).toBe(true);
        // Nothing is added to the form or submitted yet.
        expect(tagInputs()).toEqual(['skate']);
        expect(navigate).not.toHaveBeenCalled();
      });

      it('clicking a pending tag again cancels it and restores the Apply button', () => {
        chip('event').click();
        chip('event').click();

        expect(chip('event').dataset.pending).toBe('false');
        expect(
          chipComponent('event').classList.contains('bg-(--surface-tertiary)')
        ).toBe(true);
        expect(applyButton().textContent).toBe('Apply Filters');
        expect(applyButton().classList.contains('bg-(--ui-accent)')).toBe(
          false
        );
      });

      it('marks an applied tag pending-remove, and clicking again restores it', () => {
        chip('skate').click();
        expect(chip('skate').dataset.pending).toBe('true');
        expect(chip('skate').dataset.applied).toBe('true');
        expect(applyButton().textContent).toBe('Apply Filters (1)');

        chip('skate').click();
        expect(chip('skate').dataset.pending).toBe('false');
        expect(
          chipComponent('skate').classList.contains('bg-(--ui-button-surface)')
        ).toBe(true);
        expect(applyButton().textContent).toBe('Apply Filters');
      });

      it('Apply adds and removes the pending tags and navigates once', () => {
        chip('event').click();
        chip('skate').click();
        expect(applyButton().textContent).toBe('Apply Filters (2)');

        const click = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        });
        applyButton().dispatchEvent(click);

        expect(click.defaultPrevented).toBe(true);
        expect(tagInputs()).toEqual(['event']);
        expect(navigate).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith(`${formAction()}?tags=event`);
      });

      it('once applied, the pending changes are spent: a second Apply is not intercepted', () => {
        chip('event').click();
        applyButton().dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true })
        );
        expect(navigate).toHaveBeenCalledTimes(1);

        const second = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        });
        applyButton().dispatchEvent(second);

        expect(second.defaultPrevented).toBe(false);
        expect(navigate).toHaveBeenCalledTimes(1);
      });

      it('Apply with nothing pending is left to submit the form normally', () => {
        const click = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        });
        applyButton().dispatchEvent(click);

        expect(click.defaultPrevented).toBe(false);
        expect(navigate).not.toHaveBeenCalled();
      });

      it('growing to a desktop width discards the pending changes', () => {
        chip('event').click();
        expect(applyButton().textContent).toBe('Apply Filters (1)');

        setViewport(1280);
        window.dispatchEvent(new Event('resize'));

        expect(applyButton().textContent).toBe('Apply Filters');
      });
    });
  });

  describe('clearing', () => {
    it('Clear categories unticks them and, on desktop, submits', async () => {
      vi.useFakeTimers();
      await freshInit();
      pageLoad();
      category('shop-news').checked = true;
      category('news').checked = true;

      $('[data-clear-categories]').click();

      expect(category('shop-news').checked).toBe(false);
      expect(category('news').checked).toBe(false);
      vi.advanceTimersByTime(150);
      expect(navigate).toHaveBeenCalledWith(`${formAction()}?tags=skate`);
    });

    it('Clear categories only unticks on a phone', async () => {
      vi.useFakeTimers();
      setViewport(500);
      await freshInit();
      pageLoad();
      category('news').checked = true;

      $('[data-clear-categories]').click();
      vi.advanceTimersByTime(500);

      expect(category('news').checked).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('Clear tags removes the tag inputs, resets every chip and any pending changes, and submits on desktop', async () => {
      vi.useFakeTimers();
      await freshInit();
      pageLoad();

      $('[data-clear-tags]').click();

      expect(tagInputs()).toEqual([]);
      expect(chip('skate').dataset.applied).toBe('false');
      expect(chip('event').dataset.applied).toBe('false');
      expect(
        chipComponent('skate').classList.contains('bg-(--surface-tertiary)')
      ).toBe(true);
      expect(applyButton().textContent).toBe('Apply Filters');
      vi.advanceTimersByTime(150);
      expect(navigate).toHaveBeenCalledWith(formAction());
    });

    it('Clear tags on a phone discards pending changes without navigating', async () => {
      vi.useFakeTimers();
      setViewport(500);
      await freshInit();
      pageLoad();
      chip('event').click();
      expect(applyButton().textContent).toBe('Apply Filters (1)');

      $('[data-clear-tags]').click();
      vi.advanceTimersByTime(500);

      expect(applyButton().textContent).toBe('Apply Filters');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('Clear all goes to /news through the coordinator', async () => {
      await freshInit();
      pageLoad();

      $('[data-clear-all-news-filters]').click();

      expect(coordinateExit).toHaveBeenCalledTimes(1);
      const [, targetUrl, config] = coordinateExit.mock.calls[0] as unknown[];
      expect(targetUrl).toBe('/news');
      expect(config).toBe('ARTICLE_GRID_CONFIG');
      expect(navigate).toHaveBeenCalledWith('/news');
    });
  });

  describe('lifecycle', () => {
    it('astro:before-preparation destroys the instance: listeners stop and scroll and header are restored', async () => {
      vi.useFakeTimers();
      setViewport(500);
      await freshInit();
      pageLoad();
      $('#mobile-news-filter-toggle').click();
      expect(document.body.style.overflow).toBe('hidden');
      expect($('#site-header').style.zIndex).toBe('9');

      document.dispatchEvent(new Event('astro:before-preparation'));

      expect(document.body.style.overflow).toBe('');
      expect($('#site-header').style.zIndex).toBe('');
      // Aborted: the toggle no longer opens the drawer.
      $('#mobile-news-filter-toggle').click();
      expect(document.body.style.overflow).toBe('');

      // The checkbox listeners are gone as well.
      setViewport(1280);
      tick(category('news'), true);
      vi.advanceTimersByTime(500);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('navigating away cancels a filter change that is still inside its debounce', async () => {
      vi.useFakeTimers();
      await freshInit();
      pageLoad();

      tick(category('news'), true);
      vi.advanceTimersByTime(100);
      document.dispatchEvent(new Event('astro:before-preparation'));
      vi.advanceTimersByTime(500);

      expect(navigate).not.toHaveBeenCalled();
    });

    it('a new page-load after a swap builds a fresh working instance', async () => {
      vi.useFakeTimers();
      await freshInit();
      pageLoad();
      document.dispatchEvent(new Event('astro:before-preparation'));

      setupDom();
      pageLoad();
      tick(category('news'), true);
      vi.advanceTimersByTime(150);

      expect(navigate).toHaveBeenCalledTimes(1);
    });
  });
});
