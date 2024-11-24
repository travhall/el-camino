/* empty css                                     */
import { c as createComponent, r as renderTemplate, d as renderComponent, b as createAstro, m as maybeRenderHead, a as addAttribute } from '../../chunks/astro/server_wNtMDreN.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../../chunks/Layout_qf2jlJw4.mjs';
import { $ as $$Button } from '../../chunks/Button_DuQAYb4o.mjs';
import { f as fetchProduct } from '../../chunks/client_DxUFhajx.mjs';
import { M as MoneyUtils } from '../../chunks/money_BhdmIw14.mjs';
export { renderers } from '../../renderers.mjs';

const $$Astro = createAstro();
const $$id = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$id;
  const { id } = Astro2.params;
  const product = id ? await fetchProduct(id) : null;
  if (!product) {
    return Astro2.redirect("/404");
  }
  const formattedPrice = MoneyUtils.format(MoneyUtils.fromFloat(product.price));
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": product.title }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"> <div class="lg:grid lg:grid-cols-2 lg:gap-x-8 items-center"> <div class="aspect-w-4 aspect-h-3 border-4 border-surface-secondary overflow-hidden bg-surface-secondary rounded-sm"> <img${addAttribute(product.image, "src")}${addAttribute(product.title, "alt")} class="w-full h-full object-cover" onerror="this.src='/images/placeholder.png'"> </div> <div class="mt-10 lg:mt-0"> <h1 class="text-3xl font-display mb-4 text-content-heading"> ${product.title} </h1> <div class="mt-3"> <p class="text-2xl font-display text-content-emphasis"> ${formattedPrice} </p> </div> ${product.description && renderTemplate`<div class="mt-6"> <p class="text-base text-content-body">${product.description}</p> </div>`} <div class="mt-8"> ${renderComponent($$result2, "Button", $$Button, { "type": "button", "variant": "primary", "size": "lg", "classes": "w-full md:w-auto", "data-product": JSON.stringify({
    id: product.id,
    catalogObjectId: product.catalogObjectId,
    variationId: product.variationId,
    title: product.title,
    price: product.price,
    image: product.image
  }) }, { "default": ($$result3) => renderTemplate`
Add to Cart
` })} </div> </div> </div> </section>  ` })}`;
}, "/Users/travishall/GitHub/el-camino/src/pages/product/[id].astro", void 0);

const $$file = "/Users/travishall/GitHub/el-camino/src/pages/product/[id].astro";
const $$url = "/product/[id]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$id,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
