// src/lib/ui/cardEntrance.ts
// Arms each `.article-card-wrapper` (adds "entrance-armed") once its image is
// ready, so the CSS entrance animation carries content instead of firing at
// parse time against an empty box. See plans/archive/148.

// `.article-grid` is the home masonry. `.news-entrance` marks the first cards of
// the news grid (plan 230), which is not inside `.article-grid`.
const WRAPPER_SELECTOR =
  '.article-grid .article-card-wrapper, .article-card-wrapper.news-entrance';

function arm(wrapper: HTMLElement): void {
  wrapper.classList.add('entrance-armed');
}

export function armCardsOnImageReady(
  root: ParentNode,
  timeoutMs: number
): void {
  const wrappers = root.querySelectorAll<HTMLElement>(WRAPPER_SELECTOR);

  wrappers.forEach((wrapper) => {
    const img = wrapper.querySelector('img');

    if (!img || img.complete) {
      arm(wrapper);
      return;
    }

    const onSettle = () => arm(wrapper);
    img.addEventListener('load', onSettle, { once: true });
    img.addEventListener('error', onSettle, { once: true });

    setTimeout(() => arm(wrapper), timeoutMs);
  });
}
