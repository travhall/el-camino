# Flicker Diagnosis Guide

## Quick Checks

### 1. **Dev Server Restart Required?**
The SSR metadata injection requires a **full dev server restart** to take effect.

```bash
# Stop current server (Ctrl+C)
npm run dev
```

**Why:** Astro caches the build, so changes to page-level scripts need a restart.

---

### 2. **Check Browser Console**

Open `http://localhost:4321/shop/all` and check console for:

**✅ Expected (working):**
```
[SSR Metadata] ✅ Injected 200 products
[ClientFilterEngine] 🚀 PHASE 4: Using SSR-injected metadata (instant!)
[ClientFiltering] 🖥️ Desktop - enabling instant filtering with debouncing
```

**❌ Problem (not working):**
```
[ClientFilterEngine] 📡 No SSR metadata, fetching from API...
```
This means the SSR metadata isn't being injected.

---

### 3. **Types of Flicker You Might See**

#### **A. Initial Page Load Flicker**
- **Symptom:** Products flicker when page first loads
- **Cause:** CSS transitions apply before JS initializes
- **Fix:** Add this CSS (already in ProductFilters.astro):
  ```css
  .product-card-wrapper {
    opacity: 1; /* Default visible */
  }
  ```

#### **B. Filter Click Flicker**
- **Symptom:** Quick flash when clicking filters
- **Possible Causes:**
  1. SSR metadata not loading (falling back to API)
  2. Race condition between server-side and client-side handlers
  3. CSS transition timing

---

### 4. **Test SSR Metadata Injection**

```bash
# Check if metadata is in page source
curl -s http://localhost:4321/shop/all | grep "window.__FILTER_METADATA__"
```

**Expected:** Should output the line with the script tag
**If empty:** Restart dev server

---

### 5. **Check for CSS Conflicts**

The Phase 8 CSS might conflict with existing ProductGrid CSS. Check DevTools:

1. Open DevTools → Elements
2. Inspect a `.product-card-wrapper`
3. Check Computed styles for:
   - `transition` property
   - `opacity` property
   - `transform` property

**Expected:** Should show the Phase 8 transitions
**If overridden:** There's a CSS specificity conflict

---

### 6. **Disable Phase 8 Temporarily**

To isolate if Phase 8 animations are causing the flicker:

**ProductFilters.astro line 116-147:**
```css
/* TEMPORARILY COMMENT OUT */
/*
.product-card-wrapper {
  transition: ...
}
*/
```

Restart dev server and test filtering.

- **If flicker gone:** Phase 8 CSS is the culprit
- **If flicker remains:** Issue is elsewhere (likely SSR metadata)

---

### 7. **Common Issues & Fixes**

| Issue | Symptom | Fix |
|-------|---------|-----|
| **Server not restarted** | No SSR metadata in console | Restart `npm run dev` |
| **CSS too broad** | All cards animating on page load | Add `.product-filtering-active` class |
| **Race condition** | Flicker during first 200ms | Check loading state indicator |
| **API fallback** | Slow first click | SSR metadata not injecting |

---

### 8. **Debug: Enable All Console Logs**

Uncomment all console.log statements to see full flow:

**ProductFilters.astro:**
- Line 471: `console.log("[ClientFiltering] 🔄 Loading...")`
- Line 602: `console.log("[ClientFiltering] ⚡ Filtered...")`

**clientFilterEngine.ts:**
- Line 36-37: SSR metadata detection
- Line 56-57: API fallback

---

### 9. **Test Reduced Motion**

If you have "Reduce Motion" enabled in your OS:
- macOS: System Preferences → Accessibility → Display → Reduce motion
- Windows: Settings → Ease of Access → Display → Show animations

The Phase 8 CSS should disable ALL animations. If it doesn't, that's a bug.

---

### 10. **Nuclear Option: Clean Build**

If nothing works:

```bash
# Stop server
# Clear Astro cache
rm -rf node_modules/.astro
rm -rf dist

# Restart
npm run dev
```

---

## What to Report Back

Please check these and let me know:

1. ✅ / ❌ Console shows `[SSR Metadata] ✅ Injected`?
2. ✅ / ❌ Console shows `Using SSR-injected metadata (instant!)`?
3. ✅ / ❌ Console shows `batched X changes` when clicking multiple filters?
4. ✅ / ❌ Smooth animations or instant pop?
5. ✅ / ❌ Flicker happens on: **first click** / **every click** / **page load**?

This will help me pinpoint the exact issue!
