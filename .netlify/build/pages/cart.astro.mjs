/* empty css                                  */
import { c as createComponent, r as renderTemplate, d as renderComponent, m as maybeRenderHead } from '../chunks/astro/server_wNtMDreN.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_Bo8seM6q.mjs';
export { renderers } from '../renderers.mjs';

const $$Cart = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Shopping Cart" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="max-w-7xl mx-auto px-4 py-8"> <h1 class="font-display font-black text-5xl lg:text-6xl 2xl:text-7xl leading-[0.8] mb-8 text-content-heading">
Shopping Cart
</h1> <!-- Loading State --> <div id="cart-loading" class="text-center py-12"> <p class="text-lg animate-pulse text-content-body">Loading cart...</p> </div> <!-- Cart Content - Initially Empty --> <div id="cart-container" class="hidden"></div> <!-- Loading Indicator --> <div id="loading-overlay" class="fixed inset-0 bg-surface-primary/50 items-center justify-center hidden z-50"> <div class="bg-surface-secondary p-4 rounded-lg shadow-lg"> <p class="text-lg text-content-body">Processing...</p> </div> </div> <!-- Notification Container --> <div id="notification-container" class="fixed top-4 right-4 z-50 space-y-2"></div> </section> ` })} `;
}, "/Users/travishall/GitHub/el-camino/src/pages/cart.astro", void 0);

const $$file = "/Users/travishall/GitHub/el-camino/src/pages/cart.astro";
const $$url = "/cart";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Cart,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
