import { navigate } from 'astro:transitions/client';
import { createNewsAwareURL } from '@/utils/newsNavigation';

// Page links go through the Astro router, like the news filters do, so the swap
// and the lifecycle events (astro:before-preparation, astro:after-swap,
// astro:page-load) are the router's and every script on the page re-initialises
// for the new content. This used to fetch the HTML and rewrite <main> by hand;
// that never worked (its summary selector was invalid CSS, so it always fell
// back to a full reload) and, with that fixed, it would have left the cards
// invisible and the filters dead, because nothing re-ran their scripts.
class NewsPagination {
  constructor() {
    this.setupPaginationHandlers();
  }

  private setupPaginationHandlers(): void {
    const paginationContainer = document.getElementById(
      'news-pagination-controls'
    );
    if (!paginationContainer) return;

    paginationContainer.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const link = target.closest('[data-news-page]') as HTMLElement | null;

      if (!link) return;

      e.preventDefault();

      const page = parseInt(link.dataset.newsPage || '1', 10);
      navigate(this.buildUrl(page));
    });
  }

  // Current filters + the new page (page 1 is the default, so it has no param).
  private buildUrl(page: number): string {
    const currentParams = new URLSearchParams(window.location.search);

    if (page > 1) {
      currentParams.set('page', page.toString());
    } else {
      currentParams.delete('page');
    }

    return createNewsAwareURL(window.location.pathname, currentParams);
  }
}

let initialized = false;

// Called once from NewsPaginationControls.astro's script tag. This module does
// NOT re-execute on a view-transition swap, so the astro:page-load listener is
// registered once here and builds a fresh NewsPagination for each page.
export function init(): void {
  if (initialized) return;
  initialized = true;

  document.addEventListener('astro:page-load', () => {
    new NewsPagination();
  });
}
