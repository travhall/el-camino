/* empty css                                  */
import { c as createComponent, r as renderTemplate, d as renderComponent, b as createAstro, m as maybeRenderHead } from '../chunks/astro/server_wNtMDreN.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_C4R5laYf.mjs';
import { s as squareClient } from '../chunks/client_DxUFhajx.mjs';
import { M as MoneyUtils } from '../chunks/money_BhdmIw14.mjs';
import { c as cart } from '../chunks/index_Gtao9X5f.mjs';
export { renderers } from '../renderers.mjs';

const $$Astro = createAstro();
const $$OrderConfirmation = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$OrderConfirmation;
  const { searchParams } = Astro2.url;
  const orderId = searchParams.get("orderId");
  let orderDetails = null;
  let error = null;
  if (orderId) {
    try {
      const { result } = await squareClient.ordersApi.retrieveOrder(orderId);
      orderDetails = result.order;
      if (orderDetails) {
        cart.clear();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load order";
      console.error("Order retrieval error:", e);
    }
  }
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Order Confirmation" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="max-w-2xl mx-auto px-4 py-16"> ${error ? renderTemplate`<div class="text-center"> <h1 class="text-3xl font-display mb-4 text-content-heading">
Oops! Something went wrong
</h1> <p class="text-content-body mb-8">${error}</p> <a href="/" class="inline-block bg-ui-button-surface text-ui-button-text border-ui-button-border hover:bg-ui-button-surface/80 font-sans font-semibold transition-all duration-300 border-2 rounded-[4px] text-lg py-2 px-4">
Return to Home
</a> </div>` : orderDetails ? renderTemplate`<div> <div class="text-center mb-8"> <h1 class="text-3xl font-display mb-4 text-content-heading">
Thank You for Your Order!
</h1> <p class="text-content-body">
Your order has been confirmed and will be shipped soon.
</p> </div> <div class="bg-surface-secondary rounded-lg p-6"> <h2 class="font-display text-xl mb-4 text-content-heading">
Order Summary
</h2> <div class="space-y-4"> ${orderDetails.lineItems?.map((item) => renderTemplate`<div class="flex justify-between text-content-body"> <span> ${item.name} × ${item.quantity} </span> <span class="font-display">
$
${item.totalMoney ? MoneyUtils.format(item.totalMoney) : "$0.00"} </span> </div>`)} <div class="border-t border-surface-secondary pt-4 mt-4"> <div class="flex justify-between font-bold text-content-emphasis"> <span>Total</span> <span>
$
${orderDetails.totalMoney ? MoneyUtils.format(orderDetails.totalMoney) : "$0.00"} </span> </div> </div> </div> </div> <div class="mt-8 text-center"> <p class="text-sm text-content-meta mb-4">Order ID: ${orderId}</p> <a href="/" class="inline-block bg-ui-button-surface text-ui-button-text border-ui-button-border hover:bg-ui-button-surface/80 font-sans font-semibold transition-all duration-300 border-2 rounded-[4px] text-lg py-2 px-4">
Continue Shopping
</a> </div> </div>` : renderTemplate`<div class="text-center"> <h1 class="text-3xl font-display mb-4 text-content-heading">
Order Not Found
</h1> <p class="text-content-body mb-8">
We couldn't find the order you're looking for.
</p> <a href="/" class="inline-block bg-ui-button-surface text-ui-button-text border-ui-button-border hover:bg-ui-button-surface/80 font-sans font-semibold transition-all duration-300 border-2 rounded-[4px] text-lg py-2 px-4">
Return to Home
</a> </div>`} </section> ` })}`;
}, "/Users/travishall/GitHub/el-camino/src/pages/order-confirmation.astro", void 0);

const $$file = "/Users/travishall/GitHub/el-camino/src/pages/order-confirmation.astro";
const $$url = "/order-confirmation";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$OrderConfirmation,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
