import { armCardsOnImageReady } from '@/lib/ui/cardEntrance';

// Check for reduced motion preference
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

// Parse animation timing from CSS custom properties
function getAnimationTiming() {
  const style = getComputedStyle(document.documentElement);

  const durationStr = style
    .getPropertyValue('--card-transition-duration')
    .trim();
  let duration = 300;
  if (durationStr.includes('ms')) {
    duration = parseInt(durationStr.replace('ms', ''));
  } else if (durationStr.includes('s')) {
    duration = parseFloat(durationStr.replace('s', '')) * 1000;
  }

  const staggerStr = style.getPropertyValue('--card-stagger-delay').trim();
  const staggerDelay = parseInt(staggerStr.replace('ms', '')) || 0;

  // Parse grid entrance delay (mobile: 250ms, desktop: 0ms)
  const entranceDelayStr = style
    .getPropertyValue('--grid-entrance-delay')
    .trim();
  const entranceDelay = parseInt(entranceDelayStr.replace('ms', '')) || 0;

  return {
    duration,
    staggerDelay,
    entranceDelay,
  };
}

const ANIMATION_CONFIG = getAnimationTiming();

// Cards per row of the news grid for the current viewport. Only the grid view
// uses it: list is one column and ordered by index, and the masonry entrance is
// CSS-only and never reaches the observer.
function getCardsPerRow() {
  const width = window.innerWidth;

  // Grid view (news page) - matches xs/sm/xl/2xl breakpoints
  if (width >= 1536) return 6; // 2xl:grid-cols-6
  if (width >= 1280) return 4; // xl:grid-cols-4
  if (width >= 640) return 3; // sm:grid-cols-3
  if (width >= 384) return 2; // xs:grid-cols-2
  return 1; // mobile
}

// Initialize entrance animations for article cards and sidebar
function initializeArticleAnimations() {
  // card-entrance-ready (featured card) and opacity-0 (non-featured) are both
  // queried here. The CLS 0.238 was caused by a circular flex/h-full height
  // dependency on the image container — fixed by switching to absolute inset-0
  // on the masonry picture element. The opacity animation is safe to restore.
  const cards = document.querySelectorAll(
    '.article-card-wrapper.opacity-0, .article-card-wrapper.card-entrance-ready'
  );

  if (!cards.length) return;

  // Skip animations if reduced motion preferred
  if (prefersReducedMotion) {
    cards.forEach((card) => {
      const htmlCard = card as HTMLElement;
      htmlCard.classList.remove('opacity-0');
      htmlCard.classList.add('opacity-100');
    });
    return;
  }

  // Get current view from first card (excluding sidebar)
  const firstCard = Array.from(cards).find(
    (card) => !(card as HTMLElement).dataset.variant?.includes('sidebar')
  ) as HTMLElement;
  const view = firstCard?.dataset.variant || 'grid';
  const cardsPerRow = getCardsPerRow();

  // For masonry (home page), animate all cards immediately without intersection observer
  // For grid/list (news page), use intersection observer to animate on scroll
  const isMasonryLayout = view === 'masonry';

  if (isMasonryLayout) {
    // CSS animation handles the masonry entrance — fires at parse time,
    // synced with the header. No JS class-toggling needed.
    return;
  }

  // For grid/list views, use intersection observer
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const card = entry.target as HTMLElement;
          const index = parseInt(card.dataset.initialIndex || '0');
          const isSidebar = card.dataset.variant === 'sidebar';

          // Calculate animation order
          let animationOrder: number;
          if (isSidebar) {
            // Sidebar animates after the article cards it appears near
            animationOrder = 9;
          } else if (view === 'list') {
            // Sequential stagger for list view
            animationOrder = index * 1.5;
          } else {
            // Row-based stagger for grid/masonry view
            const rowIndex = Math.floor(index / cardsPerRow);
            const cardInRow = index % cardsPerRow;
            animationOrder = rowIndex * 3 + cardInRow * 1.2;
          }

          // Set CSS custom property for animation delay
          card.style.setProperty(
            '--animation-order',
            animationOrder.toString()
          );

          // Add animating class for temporary will-change
          card.classList.add('animating');

          // Trigger CSS animation
          card.classList.remove('opacity-0');
          card.classList.add('opacity-100');

          // Remove will-change after animation completes
          const duration = ANIMATION_CONFIG.duration;
          const totalAnimationTime =
            duration + animationOrder * ANIMATION_CONFIG.staggerDelay;

          setTimeout(() => {
            card.classList.remove('animating');
          }, totalAnimationTime);

          // Stop observing this card
          observer.unobserve(card);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '200px',
    }
  );

  // Observe all cards
  cards.forEach((card) => observer.observe(card));
}

let initialized = false;

// Called once from ArticleGrid.astro's script tag. This module does NOT
// re-execute on a view-transition swap, so the page-load, articleGridReady and
// pageshow listeners are registered once here (in the original order).
export function init(): void {
  if (initialized) return;
  initialized = true;

  // Initialize on page load
  document.addEventListener('astro:page-load', () => {
    // Check for both filterable and home page cards
    const filterableGrid = document.getElementById('filterable-article-grid');
    const homePageCards = document.querySelectorAll('.article-card-wrapper');

    if (filterableGrid) {
      // Make filterable grid visible
      filterableGrid.style.opacity = '1';
    }

    // Arm masonry cards' entrance animation once each card's own image is
    // ready (or after a bounded timeout). Selector is scoped to `.article-grid`
    // so this has no effect on the filterable (news) grid. See plan 148.
    armCardsOnImageReady(document, 1200);

    // Initialize animations for any cards found
    if (homePageCards.length > 0) {
      // On mobile, defer card entrance until after the nav close animation (400ms)
      // has had a head start. Only apply the delay on the News page (filterable grid),
      // not on the home page masonry layout where no nav close precedes the animation.
      const entranceDelay = filterableGrid ? ANIMATION_CONFIG.entranceDelay : 0;
      if (entranceDelay > 0) {
        setTimeout(() => initializeArticleAnimations(), entranceDelay);
      } else {
        initializeArticleAnimations();
      }
    }

    // SIMPLIFIED: Basic lazy loading without heavy intersection observer
    const lazyImages = document.querySelectorAll('img[data-src]');
    if (lazyImages.length > 0 && 'IntersectionObserver' in window) {
      if (lazyImages.length > 6) {
        const imageObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const img = entry.target as HTMLImageElement;
                if (img.dataset.src) {
                  img.src = img.dataset.src;
                  img.removeAttribute('data-src');
                  imageObserver.unobserve(img);
                }
              }
            });
          },
          { rootMargin: '100px' }
        );

        lazyImages.forEach((img) => imageObserver.observe(img));
      } else {
        lazyImages.forEach((img: Element) => {
          const imgEl = img as HTMLImageElement;
          if (imgEl.dataset.src) {
            imgEl.src = imgEl.dataset.src;
            imgEl.removeAttribute('data-src');
          }
        });
      }
    }
  });

  // Listen for articleGridReady event from FilterCoordinator
  window.addEventListener('articleGridReady', () => {
    initializeArticleAnimations();
  });

  // BFCache restore: DOM is preserved as-is. Cards that were mid-animation
  // when cached may still have opacity-0 or card-entrance-ready without
  // opacity-100. Show them immediately without a transition so the user
  // doesn't see half-visible cards.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      const cards = document.querySelectorAll<HTMLElement>(
        '.article-card-wrapper.opacity-0, .article-card-wrapper.card-entrance-ready:not(.opacity-100)'
      );
      cards.forEach((card) => {
        card.style.transition = 'none';
        card.classList.remove('opacity-0');
        card.classList.add('opacity-100');
        requestAnimationFrame(() => {
          card.style.transition = '';
        });
      });
    }
  });
}
