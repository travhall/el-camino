// src/scripts/imageShimmer.ts
//
// Replaces all inline onload/onerror image shimmer handlers with a single
// shared script. Each <img> opts in by carrying data-shimmer-placeholder and
// optional behaviour attributes:
//
//   data-shimmer-placeholder   ID of the skeleton element to remove on settle
//   data-shimmer-load-opacity  Inline opacity to set on load (empty string = clear)
//   data-shimmer-error-opacity Inline opacity to set on error (falls back to load value)
//   data-shimmer-load-add      Space-separated classes to add on load
//   data-shimmer-load-remove   Space-separated classes to remove on load
//   data-shimmer-error-add     Space-separated classes to add on error
//   data-shimmer-error-remove  Space-separated classes to remove on error
//   data-shimmer-stock         If present, uses data-in-stock="true/false" to pick
//                              "opacity-100" vs "opacity-75" on load (PDP only)
//   data-shimmer-fallback      Custom error fallback src (optional)
//
// MutationObserver handles images injected after the initial page paint
// (cart items, dynamically-loaded content, etc.).

import { EL_CAMINO_LOGO_DATA_URI } from "@/lib/constants/assets";

function settle(img: HTMLImageElement, isError: boolean): void {
  // Remove the skeleton placeholder
  const phId = img.dataset.shimmerPlaceholder;
  if (phId) document.getElementById(phId)?.remove();

  // On error: swap in fallback src
  if (isError) {
    img.src = img.dataset.shimmerFallback ?? EL_CAMINO_LOGO_DATA_URI;
  }

  // Which set of behaviour attrs to read
  const opacityKey = isError ? "shimmerErrorOpacity" : "shimmerLoadOpacity";
  const removeKey  = isError ? "shimmerErrorRemove"  : "shimmerLoadRemove";
  const addKey     = isError ? "shimmerErrorAdd"     : "shimmerLoadAdd";

  // Set/clear inline opacity.
  // Empty string ("") clears the inline style and lets CSS cascade take over.
  // Attribute absent → don't touch opacity at all.
  if (opacityKey in img.dataset) {
    img.style.opacity = img.dataset[opacityKey] ?? "";
  }

  // Remove classes first so add-then-remove ordering is deterministic
  img.dataset[removeKey]?.split(" ").filter(Boolean).forEach(c => img.classList.remove(c));

  // Add classes — with in-stock conditional for PDP
  if (!isError && "shimmerStock" in img.dataset) {
    img.classList.add(img.dataset.inStock === "true" ? "opacity-100" : "opacity-75");
  } else {
    img.dataset[addKey]?.split(" ").filter(Boolean).forEach(c => img.classList.add(c));
  }
}

function attach(img: HTMLImageElement): void {
  // Guard against double-binding (matters for astro:page-load re-runs and observer overlap)
  if (img.dataset.shimmerAttached) return;
  img.dataset.shimmerAttached = "1";

  if (img.complete) {
    // Image already settled (cached hit or error before script ran)
    settle(img, img.naturalWidth === 0);
  } else {
    img.addEventListener("load",  () => settle(img, false), { once: true });
    img.addEventListener("error", () => settle(img, true),  { once: true });
  }
}

function initShimmer(): void {
  document.querySelectorAll<HTMLImageElement>("img[data-shimmer-placeholder]").forEach(attach);
}

// Watch for images injected after paint (cart items, QuickView swaps, etc.)
let observerStarted = false;
const observer = new MutationObserver(mutations => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node instanceof HTMLImageElement && node.dataset.shimmerPlaceholder) {
        attach(node);
      } else if (node instanceof Element) {
        node.querySelectorAll<HTMLImageElement>("img[data-shimmer-placeholder]").forEach(attach);
      }
    }
  }
});

// astro:page-load fires on initial load AND after every View Transition navigation
document.addEventListener("astro:page-load", () => {
  initShimmer();
  if (!observerStarted) {
    // Observe the document root so the observer survives body replacements
    observer.observe(document.documentElement, { childList: true, subtree: true });
    observerStarted = true;
  }
});
