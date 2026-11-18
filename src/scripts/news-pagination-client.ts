import { createNewsAwareURL } from '@/utils/newsNavigation';

class NewsAjaxPagination {
  constructor() {
    this.setupPaginationHandlers();
  }

  private setupPaginationHandlers(): void {
    const paginationContainer = document.getElementById(
      'news-pagination-controls'
    );
    if (!paginationContainer) return;

    paginationContainer.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const link = target.closest('[data-news-page]') as HTMLAnchorElement;

      if (!link) return;

      e.preventDefault();

      const page = parseInt(link.dataset.newsPage || '1', 10);
      await this.loadPage(page);
    });
  }

  private async loadPage(page: number): Promise<void> {
    try {
      this.showLoadingState();

      // Build URL with current filters + new page
      const currentParams = new URLSearchParams(window.location.search);

      if (page > 1) {
        currentParams.set('page', page.toString());
      } else {
        currentParams.delete('page');
      }

      const newUrl = createNewsAwareURL(
        window.location.pathname,
        currentParams
      );

      const response = await fetch(newUrl, {
        headers: {
          Accept: 'text/html',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      await this.updatePageContent(html);

      // Update URL without page reload
      history.pushState(null, '', newUrl);

      // Scroll to top of results
      document.querySelector('main')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    } catch (error) {
      console.error('News pagination error:', error);
      this.showErrorState();
      // Fallback to normal navigation
      window.location.href = this.buildFallbackURL(page);
    } finally {
      this.hideLoadingState();
    }
  }

  private buildFallbackURL(page: number): string {
    const currentParams = new URLSearchParams(window.location.search);

    if (page > 1) {
      currentParams.set('page', page.toString());
    } else {
      currentParams.delete('page');
    }

    return createNewsAwareURL(window.location.pathname, currentParams);
  }

  private async updatePageContent(html: string): Promise<void> {
    const parser = new DOMParser();
    const newDoc = parser.parseFromString(html, 'text/html');

    // Update main content area
    const newMain = newDoc.querySelector('main');
    const currentMain = document.querySelector('main');

    if (newMain && currentMain) {
      currentMain.style.opacity = '0';
      await new Promise((resolve) => setTimeout(resolve, 150));
      currentMain.innerHTML = newMain.innerHTML;
      currentMain.style.opacity = '1';
    }

    // Update pagination controls
    const newPagination = newDoc.querySelector('#news-pagination-controls');
    const currentPagination = document.querySelector(
      '#news-pagination-controls'
    );

    if (newPagination && currentPagination) {
      currentPagination.innerHTML = newPagination.innerHTML;
      this.setupPaginationHandlers(); // Re-bind events
    }

    // Update search results summary
    const newSearchSort = newDoc.querySelector(
      '.text-sm.text-(--content-meta)'
    );
    const currentSearchSort = document.querySelector(
      '.text-sm.text-(--content-meta)'
    );

    if (newSearchSort && currentSearchSort) {
      currentSearchSort.textContent = newSearchSort.textContent;
    }
  }

  private showLoadingState(): void {
    const main = document.querySelector('main') as HTMLElement;
    if (main) {
      main.style.opacity = '0.6';
      main.style.pointerEvents = 'none';
    }

    // Add loading indicator
    const pagination = document.querySelector('#news-pagination-controls');
    if (pagination) {
      const loader = document.createElement('div');
      loader.id = 'pagination-loader';
      loader.className = 'flex items-center justify-center mt-4';
      loader.innerHTML = `
        <div class="animate-spin rounded-full h-6 w-6 border-2 border-(--ui-accent) border-t-transparent"></div>
        <span class="ml-2 text-sm text-(--content-meta)">Loading...</span>
      `;
      pagination.appendChild(loader);
    }
  }

  private hideLoadingState(): void {
    const main = document.querySelector('main') as HTMLElement;
    if (main) {
      main.style.opacity = '1';
      main.style.pointerEvents = '';
    }

    // Remove loading indicator
    const loader = document.querySelector('#pagination-loader');
    if (loader) {
      loader.remove();
    }
  }

  private showErrorState(): void {
    const loader = document.querySelector('#pagination-loader');
    if (loader) {
      loader.innerHTML = `
        <span class="text-sm text-(--state-error-text)">Failed to load page. Redirecting...</span>
      `;
      setTimeout(() => loader.remove(), 2000);
    }
  }
}

let initialized = false;

// Called once from NewsPaginationControls.astro's script tag. This module does
// NOT re-execute on a view-transition swap, so the astro:page-load listener is
// registered once here and builds a fresh NewsAjaxPagination for each page.
export function init(): void {
  if (initialized) return;
  initialized = true;

  document.addEventListener('astro:page-load', () => {
    new NewsAjaxPagination();
  });
}
