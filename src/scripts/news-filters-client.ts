import { FilterCoordinator, GRID_CONFIGS } from '@/lib/filterCoordinator';
import { navigate } from 'astro:transitions/client';

// Section state keys in sessionStorage
const SECTION_KEYS: Record<string, string> = {
  'news-categories': 'news-filter-section-categories',
  'news-tags': 'news-filter-section-tags',
};

class NewsFiltersManager {
  private form!: HTMLFormElement | null;
  private container!: HTMLElement | null;
  private overlay!: HTMLElement | null;
  private abortController = new AbortController();

  // Simple state
  private pendingTags: Set<string> = new Set();
  private isMobile: boolean = false;

  // Simple debouncing
  private submitTimeout: number | null = null;

  constructor() {
    this.form = document.getElementById('news-filter-form') as HTMLFormElement;
    this.container = document.getElementById('news-filter-container');
    this.overlay = document.getElementById('mobile-news-filter-overlay');

    if (!this.form) return;

    this.checkMobileState();
    this.setupMobileDrawer();
    this.setupAccordions();
    this.setupDesktopFiltering();
    this.setupClearButtons();
    this.setupTagChips();
    this.setupMobileApply();
  }

  private checkMobileState(): void {
    this.isMobile = window.innerWidth < 1024;
    window.addEventListener(
      'resize',
      () => {
        this.isMobile = window.innerWidth < 1024;
        if (!this.isMobile) {
          this.pendingTags.clear();
          this.updateApplyButton();
        }
      },
      { signal: this.abortController.signal }
    );
  }

  // Mobile (< 768px): bottom drawer / Tablet (768–1023px): right panel
  private initClosedState(): void {
    if (!this.container) return;
    if (window.innerWidth >= 1024) {
      // Desktop: lg: CSS handles visibility; clear any translate classes
      this.container.classList.remove('translate-x-full', 'translate-y-full');
      return;
    }
    if (window.innerWidth < 768) {
      this.container.classList.remove('translate-x-full');
      this.container.classList.add('translate-y-full');
    } else {
      this.container.classList.remove('translate-y-full');
      this.container.classList.add('translate-x-full');
    }
  }

  private setupMobileDrawer(): void {
    const toggle = document.getElementById('mobile-news-filter-toggle');
    const close = document.getElementById('mobile-news-filter-close');
    const { signal } = this.abortController;

    this.initClosedState();

    toggle?.addEventListener('click', () => this.openMobileDrawer(), {
      signal,
    });
    close?.addEventListener('click', () => this.closeMobileDrawer(), {
      signal,
    });
    this.overlay?.addEventListener('click', () => this.closeMobileDrawer(), {
      signal,
    });

    // When crossing the mobile/tablet boundary while drawer is closed, update
    // the hidden transform so it re-enters from the correct edge.
    window.addEventListener(
      'resize',
      () => {
        if (this.container?.classList.contains('opacity-0')) {
          this.initClosedState();
        }
      },
      { signal }
    );
  }

  private openMobileDrawer(): void {
    // Lower the header below <main>'s stacking context (z-10) so the filter
    // panel and overlay — which live inside <main> — can paint above it,
    // matching MiniCart's behavior. Body overflow:hidden prevents any scroll
    // that would expose the header being temporarily behind main content.
    const header = document.getElementById('site-header');
    if (header) header.style.zIndex = '9';

    this.overlay?.classList.remove('pointer-events-none', 'opacity-0');
    if (window.innerWidth < 768) {
      this.container?.classList.remove(
        'translate-y-full',
        'opacity-0',
        'pointer-events-none'
      );
    } else {
      this.container?.classList.remove(
        'translate-x-full',
        'opacity-0',
        'pointer-events-none'
      );
    }
    document.body.style.overflow = 'hidden';
  }

  private closeMobileDrawer(): void {
    this.overlay?.classList.add('opacity-0');
    if (window.innerWidth < 768) {
      this.container?.classList.add('translate-y-full', 'opacity-0');
    } else {
      this.container?.classList.add('translate-x-full', 'opacity-0');
    }

    let hasCompleted = false;
    const handleTransitionEnd = () => {
      if (hasCompleted) return;
      hasCompleted = true;
      this.overlay?.classList.add('pointer-events-none');
      this.container?.classList.add('pointer-events-none');
      const header = document.getElementById('site-header');
      if (header) header.style.zIndex = '';
    };

    this.container?.addEventListener('transitionend', handleTransitionEnd, {
      once: true,
    });
    setTimeout(handleTransitionEnd, 350);
    document.body.style.overflow = '';
  }

  private setupAccordions(): void {
    document
      .querySelectorAll<HTMLButtonElement>('[data-section-toggle]')
      .forEach((btn) => {
        const section = btn.dataset.sectionToggle!;
        const contentId = btn.getAttribute('aria-controls')!;
        const contentEl = document.getElementById(contentId);
        if (!contentEl) return;

        const chevron = btn
          .closest('.filter-section')
          ?.querySelector<SVGElement>('.filter-chevron');
        const storageKey = SECTION_KEYS[section];
        const savedState = storageKey
          ? sessionStorage.getItem(storageKey)
          : null;

        if (savedState === 'closed') {
          // Suppress transition so state restoration doesn't animate on page load
          contentEl.style.transition = 'none';
          contentEl.classList.add('is-closed');
          btn.setAttribute('aria-expanded', 'false');
          chevron?.classList.add('is-collapsed');
          // Re-enable after two frames (browser has committed the layout)
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              contentEl.style.transition = '';
            })
          );
        }

        btn.addEventListener(
          'click',
          () => {
            const isClosed = contentEl.classList.contains('is-closed');
            if (isClosed) {
              contentEl.classList.remove('is-closed');
              btn.setAttribute('aria-expanded', 'true');
              chevron?.classList.remove('is-collapsed');
              if (storageKey) sessionStorage.setItem(storageKey, 'open');
            } else {
              contentEl.classList.add('is-closed');
              btn.setAttribute('aria-expanded', 'false');
              chevron?.classList.add('is-collapsed');
              if (storageKey) sessionStorage.setItem(storageKey, 'closed');
            }
          },
          { signal: this.abortController.signal }
        );
      });
  }

  private setupDesktopFiltering(): void {
    if (!this.form) return;

    const inputs = this.form.querySelectorAll(
      'input[type="checkbox"], input[type="radio"]'
    );
    inputs.forEach((input) => {
      input.addEventListener(
        'change',
        () => {
          if (!this.isMobile) this.debouncedSubmit();
        },
        { signal: this.abortController.signal }
      );
    });
  }

  private debouncedSubmit(): void {
    if (this.submitTimeout) clearTimeout(this.submitTimeout);
    this.submitTimeout = window.setTimeout(() => this.submitForm(), 150);
  }

  private submitForm(): void {
    if (!this.form) return;

    const formData = new FormData(this.form);
    const params = new URLSearchParams();
    formData.forEach((value, key) => params.append(key, value.toString()));

    const targetUrl = params.toString()
      ? `${this.form.action}?${params.toString()}`
      : this.form.action;

    FilterCoordinator.coordinateExit(
      () => {
        navigate(targetUrl);
      },
      targetUrl,
      GRID_CONFIGS.article
    );
  }

  private setupTagChips(): void {
    document
      .querySelectorAll<HTMLButtonElement>('.tag-filter-button')
      .forEach((button) => {
        button.addEventListener(
          'click',
          () => {
            const tagSlug = button.dataset.tagChip!;
            if (this.isMobile) {
              this.handleMobileTagClick(tagSlug, button);
            } else {
              this.handleDesktopTagClick(tagSlug, button);
            }
          },
          { signal: this.abortController.signal }
        );
      });
  }

  private handleMobileTagClick(
    tagSlug: string,
    button: HTMLButtonElement
  ): void {
    const isApplied = button.dataset.applied === 'true';
    const isPending = button.dataset.pending === 'true';

    if (isApplied) {
      if (isPending) {
        this.pendingTags.delete(`remove-${tagSlug}`);
        this.updateTagButton(button, 'applied');
      } else {
        this.pendingTags.add(`remove-${tagSlug}`);
        this.updateTagButton(button, 'pending-remove');
      }
    } else {
      if (isPending) {
        this.pendingTags.delete(`add-${tagSlug}`);
        this.updateTagButton(button, 'unselected');
      } else {
        this.pendingTags.add(`add-${tagSlug}`);
        this.updateTagButton(button, 'pending-add');
      }
    }

    this.updateApplyButton();
  }

  private handleDesktopTagClick(
    tagSlug: string,
    button: HTMLButtonElement
  ): void {
    const isApplied = button.dataset.applied === 'true';

    if (isApplied) {
      this.removeTag(tagSlug);
      this.updateTagButton(button, 'unselected');
    } else {
      this.addTag(tagSlug);
      this.updateTagButton(button, 'applied');
    }

    this.debouncedSubmit();
  }

  private updateTagButton(button: HTMLButtonElement, state: string): void {
    switch (state) {
      case 'unselected':
        button.dataset.pending = 'false';
        button.dataset.applied = 'false';
        break;
      case 'pending-add':
      case 'pending-remove':
        button.dataset.pending = 'true';
        break;
      case 'applied':
        button.dataset.pending = 'false';
        button.dataset.applied = 'true';
        break;
    }

    const tagComponent = button.querySelector<HTMLElement>(
      '[class*="inline-flex"]'
    );
    if (!tagComponent) return;

    tagComponent.className = tagComponent.className
      .replace(/tag-(unselected|pending|applied)/g, '')
      .trim();

    switch (state) {
      case 'unselected':
        tagComponent.classList.add(
          'bg-(--surface-tertiary)',
          'text-(--content-body)',
          'hover:bg-(--ui-button-surface)',
          'hover:text-(--ui-button-text)'
        );
        tagComponent.classList.remove(
          'bg-(--ui-button-surface)',
          'bg-(--ui-accent)',
          'text-white'
        );
        break;
      case 'pending-add':
      case 'pending-remove':
        tagComponent.classList.add('bg-(--ui-accent)', 'text-white');
        tagComponent.classList.remove(
          'bg-(--surface-tertiary)',
          'bg-(--ui-button-surface)'
        );
        break;
      case 'applied':
        tagComponent.classList.add(
          'bg-(--ui-button-surface)',
          'text-(--ui-button-text)'
        );
        tagComponent.classList.remove(
          'bg-(--surface-tertiary)',
          'bg-(--ui-accent)',
          'text-white'
        );
        break;
    }
  }

  private updateApplyButton(): void {
    const applyButton = document.getElementById(
      'mobile-apply-filters'
    ) as HTMLButtonElement | null;
    if (!applyButton) return;

    const pendingCount = this.pendingTags.size;
    const defaultText = applyButton.dataset.defaultText || 'Apply Filters';

    if (pendingCount > 0) {
      applyButton.textContent = `Apply Filters (${pendingCount})`;
      applyButton.classList.add('bg-(--ui-accent)', 'text-white');
      applyButton.classList.remove('bg-(--ui-button-surface)');
    } else {
      applyButton.textContent = defaultText;
      applyButton.classList.remove('bg-(--ui-accent)', 'text-white');
      applyButton.classList.add('bg-(--ui-button-surface)');
    }
  }

  private addTag(tagSlug: string): void {
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = 'tags';
    hiddenInput.value = tagSlug;
    hiddenInput.setAttribute('data-tag-input', tagSlug);
    this.form?.querySelector('.hidden')?.appendChild(hiddenInput);
  }

  private removeTag(tagSlug: string): void {
    // Compare the attribute value instead of building a selector from the slug:
    // a quote or backslash in a slug would make the selector invalid.
    document
      .querySelectorAll<HTMLElement>('[data-tag-input]')
      .forEach((input) => {
        if (input.dataset.tagInput === tagSlug) input.remove();
      });
  }

  private applyPendingChanges(): void {
    this.pendingTags.forEach((change) => {
      if (change.startsWith('add-')) {
        this.addTag(change.replace('add-', ''));
      } else if (change.startsWith('remove-')) {
        this.removeTag(change.replace('remove-', ''));
      }
    });
    this.pendingTags.clear();
    this.submitForm();
  }

  private setupClearButtons(): void {
    const { signal } = this.abortController;

    document.querySelector('[data-clear-categories]')?.addEventListener(
      'click',
      () => {
        this.form
          ?.querySelectorAll<HTMLInputElement>(
            'input[name="categories"]:checked'
          )
          .forEach((cb) => {
            cb.checked = false;
          });
        if (!this.isMobile) this.debouncedSubmit();
      },
      { signal }
    );

    document.querySelector('[data-clear-tags]')?.addEventListener(
      'click',
      () => {
        this.form
          ?.querySelectorAll('[data-tag-input]')
          .forEach((el) => el.remove());
        this.pendingTags.clear();
        this.updateApplyButton();
        document
          .querySelectorAll<HTMLButtonElement>('.tag-filter-button')
          .forEach((btn) => {
            this.updateTagButton(btn, 'unselected');
          });
        if (!this.isMobile) this.debouncedSubmit();
      },
      { signal }
    );

    document.querySelector('[data-clear-all-news-filters]')?.addEventListener(
      'click',
      () => {
        FilterCoordinator.coordinateExit(
          () => {
            navigate('/news');
          },
          '/news',
          GRID_CONFIGS.article
        );
      },
      { signal }
    );
  }

  private setupMobileApply(): void {
    const applyButton = document.getElementById('mobile-apply-filters');
    applyButton?.addEventListener(
      'click',
      (e) => {
        if (this.isMobile && this.pendingTags.size > 0) {
          e.preventDefault();
          this.applyPendingChanges();
        }
      },
      { signal: this.abortController.signal }
    );
  }

  public destroy(): void {
    this.abortController.abort();
    // A change still inside its 150 ms debounce must not navigate after the
    // router has started leaving the page.
    if (this.submitTimeout) clearTimeout(this.submitTimeout);
    document.body.style.overflow = '';
    const header = document.getElementById('site-header');
    if (header) header.style.zIndex = '';
  }
}

let currentInstance: NewsFiltersManager | null = null;

let initialized = false;

// Called once from NewsFilters.astro's script tag. This module does NOT
// re-execute on a view-transition swap, so the two document listeners are
// registered once here: a fresh NewsFiltersManager is built on every
// astro:page-load and torn down on astro:before-preparation.
export function init(): void {
  if (initialized) return;
  initialized = true;

  document.addEventListener('astro:page-load', () => {
    currentInstance?.destroy();
    currentInstance = new NewsFiltersManager();
  });

  document.addEventListener('astro:before-preparation', () => {
    currentInstance?.destroy();
    currentInstance = null;
  });
}
