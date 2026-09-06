// The featured masonry card is full-width below Tailwind's `md` (768px, where
// .article-grid switches to md:grid-cols-6), then col-span-4 of 6 (~67vw),
// then col-span-4 of 8 (50vw) at 2xl. The homepage's LCP <link rel=preload>
// MUST use this exact string: if the preload's imagesizes and the <img>'s
// sizes resolve to different srcset candidates, the browser downloads both.
export const FEATURED_CARD_IMAGE_SIZES =
  '(max-width: 767px) 100vw, (max-width: 1535px) 67vw, 50vw';
