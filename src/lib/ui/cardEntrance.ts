// src/lib/ui/cardEntrance.ts
// Arms each `.article-card-wrapper` (adds "entrance-armed") once its image is
// ready, so the CSS entrance animation carries content instead of firing at
// parse time against an empty box. See plans/148.

const WRAPPER_SELECTOR = '.article-grid .article-card-wrapper';

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
