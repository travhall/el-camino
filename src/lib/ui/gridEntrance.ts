// src/lib/ui/gridEntrance.ts
// Re-arms the server-visible initial product cards for an entrance animation
// on client-side navigation. The server renders the first cards `opacity-100`
// (plan 177) so cold loads never wait on JS; on a soft navigation we can hide
// them again *synchronously* (transitions suppressed) and let the existing
// reveal logic fade them back in. Pure DOM in / DOM out: no timers, no
// globals, no `window` access — the caller owns scheduling and the safety nets.

const CARD_SELECTOR = '.product-card-wrapper.opacity-100';

export function armInitialCardsForEntrance(
  root: ParentNode,
  maxIndex = 16
): HTMLElement[] {
  const cards = Array.from(root.querySelectorAll<HTMLElement>(CARD_SELECTOR));
  const armed = cards.filter(
    (card) =>
      Number(card.dataset.initialIndex) < maxIndex &&
      card.style.display !== 'none' &&
      card.dataset.filterHidden !== 'true'
  );

  armed.forEach((card) => {
    // Suppress the transition for this swap only, so the card snaps to hidden
    // instead of fading out; the reveal removes this override.
    card.style.transition = 'none';
    card.classList.remove('opacity-100');
    card.classList.add('opacity-0');
  });

  return armed;
}

export function restoreCards(cards: HTMLElement[]): void {
  cards.forEach((card) => {
    card.classList.remove('opacity-0', 'animating');
    card.classList.add('opacity-100');
    card.style.removeProperty('transition');
  });
}
