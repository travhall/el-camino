# Plan 238: A cart line's subtotal did not update when its quantity changed

> **Executor instructions**: Done (2026-11-18). Kept as a record.

## Status

- **Priority**: P2
- **Effort**: XS
- **Risk**: LOW
- **Category**: bug
- **Depends on**: 229 (found while extracting the cart page script; shipped on the same branch to save a Netlify build)
- **Outcome**: Fixed, tested

## The bug

On `/cart`, changing a line's quantity (+, - or typing) updated the order summary
but not the line's own total. After one increase of a $60 item the line still said
`$60.00` and the summary `$120.00`. The charge was never wrong (the server computes
it); the display disagreed with itself until the next full render.

## Cause

`updateCartItemQuantity` looked for the line total with
`.font-display.font-bold.text-2xl`, but the markup is `font-display font-bold text-xl
md:text-2xl`, so nothing matched and the update was skipped silently. It was the same
before plan 229 moved the script.

## Fix

The line total gets a `data-line-subtotal` attribute in `createCartItem`, and
`updateCartItemQuantity` selects it, so a class change cannot break it silently
again.

## Verification

- Tests first: 5 in `cart-page-client.test.ts` (+, -, typed quantity, sale price,
  only the edited line changes) failed on the old code for this reason and pass now.
- Mutations, all killed: attribute removed from the template, selector pointing at a
  different attribute, sale price ignored on the update path, `*` replaced by `+`.
- `check`, `lint`, `format:check`, coverage (2011 tests), `build`, stub e2e (117) and
  `money-path` e2e on Chromium and Mobile Chrome (11 passed) pass.
- Not verified: a browser pass of the fix itself (the dev server's inventory
  API reports the stub items as out of stock, so + cannot be clicked there).
