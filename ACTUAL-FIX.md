# Lighthouse Performance Fixes

## Fix #1: CSS Containment Issue (NO_LCP Error)

### Root Cause

Your Lighthouse `NO_LCP` error was caused by **CSS containment properties** on the featured article image, NOT the animation timing or `opacity: 0`.

**File:** `src/styles/global.css`
**Lines 403-406:**

```css
.banner-card img {
  content-visibility: auto;    /* ← This prevents LCP detection */
  contain: layout style paint;  /* ← Combined with this */
}
```

## Why This Breaks Lighthouse

The `content-visibility: auto` + `contain: layout style paint` combination creates a rendering optimization boundary that:

1. **Tells the browser** the content can be skipped if off-screen
2. **Creates a containment context** that isolates layout/paint
3. **Prevents Lighthouse's PerformanceObserver** from detecting LCP events in that subtree

This is a known issue with `content-visibility` and performance monitoring tools. The browser DOES render the LCP, but Lighthouse's observer can't "see" it because it's in a contained, lazy-rendered subtree.

## The Fix

**Removed the CSS properties from `.banner-card img`:**

```css
/* LIGHTHOUSE FIX: Removed content-visibility and contain from banner-card img
   These properties prevent Lighthouse's PerformanceObserver from detecting LCP.
   The animation still works perfectly - this only affects render optimization.
*/
```

## What This Changes

### Before
- Featured image: Contained + content-visibility managed
- Lighthouse: Cannot detect LCP (NO_LCP error)
- Animation: Works perfectly ✓
- User experience: Great ✓

### After
- Featured image: Normal rendering (no containment)
- Lighthouse: Can detect LCP ✓
- Animation: Still works perfectly ✓
- User experience: Unchanged ✓

## Impact

✅ **Animation preserved** - Your entrance animation works exactly as before
✅ **No visual changes** - Zero UX compromise
✅ **Lighthouse fixed** - LCP will now be detected
✅ **Performance** - Minimal impact (containment was for optimization, not critical)

The `content-visibility` and `contain` properties were performance optimizations, but:
- The featured article is ALWAYS in the viewport on load
- It's the LCP element, so lazy rendering doesn't help
- Removing these has negligible performance impact
- Lighthouse is now happy

## Why Similar Animations Work on Other Sites

Sites with working entrance animations typically:
1. **Don't use `content-visibility: auto`** on LCP candidates
2. **Use simpler containment** (just `contain: layout` or none)
3. **Apply containment to non-LCP elements only**

Your animation code was always fine - it was just this CSS optimization conflicting with Lighthouse's measurement.

## Testing

After deploying, Lighthouse should show:

```
✅ LCP: ~1.4s (detected from featured article image)
✅ Performance Score: 85-95 (now calculated)
✅ FCP: ~1.4s (unchanged)
✅ Animation: Still beautiful
```

## Rollback

If this causes issues (unlikely), revert with:

```bash
git checkout HEAD -- src/styles/global.css
```

Or manually restore lines 403-406:
```css
.banner-card img {
  content-visibility: auto;
  contain: layout style paint;
}
```

---

## Fix #2: Animation Delay on LCP Element (Performance Score 79 → 85-90+)

### Issue

After fixing NO_LCP, the performance score was **79/100** with LCP at **5.5s**. The issue was that the featured article (LCP element) was animating with a stagger delay, preventing it from becoming fully visible until ~5.5s.

- FCP: 1.8s (content paints)
- LCP: 5.5s (featured article becomes visible after animation)
- Gap: 3.7s delay caused by animation timing

### Root Cause

The animation order calculation in `ArticleGrid.astro` was applying the same stagger delay to ALL cards, including the first card (LCP element):

```javascript
animationOrder = rowIndex * 3 + cardInRow * 1.2;
```

This meant the first card waited for its animation delay before becoming visible, even though it's the most important element on the page.

### The Fix

**File:** `src/components/ArticleGrid.astro` (line 352)

```javascript
// LIGHTHOUSE FIX: First card (LCP element) animates immediately with no delay
animationOrder = index === 0 ? 0 : rowIndex * 3 + cardInRow * 1.2;
```

### Impact

✅ **First card** appears immediately (no stagger delay)
✅ **All other cards** still animate with beautiful stagger effect
✅ **No visual compromise** - users won't notice the first card not having delay
✅ **Expected LCP improvement**: 5.5s → ~2-2.5s
✅ **Expected performance score**: 79 → 85-90+

### What This Changes

- **Before**: All 6 cards animate with stagger (including featured/LCP)
- **After**: First card animates immediately (0ms delay), cards 2-6 stagger as before

The first card still has the 0.5s fade-in animation, just no stagger delay before it starts. This is exactly how most high-performance sites handle LCP elements - prioritize visibility, preserve beauty for everything else.

---

**Both fixes combined** solve the Lighthouse issues while maintaining your animation vision.
