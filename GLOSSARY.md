# Glossary

The shared language of the El Camino storefront. Terms only: no implementation
detail.

## Catalog

**Item**
A catalog entry as Square holds it. "Item" is the Square-side word only; on the
storefront the same thing is a Product.
_Avoid_: using "item" for what a customer browses or buys.

**Product**
What a customer sees and browses on the shop: one thing for sale, with its
name, images and description. Each Product is built from exactly one Item.
_Avoid_: "item" (Square-side), "listing".

**Variation**
One purchasable form of a Product, such as a size or a color. The Variation,
not the Product, is what holds a price and a stock count, and is what goes in a
cart.
_Avoid_: "variant", "SKU", "option".
