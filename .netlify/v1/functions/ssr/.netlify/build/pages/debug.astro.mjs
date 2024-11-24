/* empty css                                  */
import { c as createComponent, r as renderTemplate, d as renderComponent, m as maybeRenderHead } from '../chunks/astro/server_wNtMDreN.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_qf2jlJw4.mjs';
export { renderers } from '../renderers.mjs';

const $$Debug = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Square Debug" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="max-w-2xl mx-auto p-8"> <h1 class="text-2xl font-bold mb-4 text-content-heading">
Square Debug Tools
</h1> <div class="space-y-4"> <button id="testConnection" class="px-4 py-2 bg-ui-button-surface text-ui-button-text rounded hover:bg-ui-button-surface/80 transition-colors">
Test Square Connection
</button> <pre id="result" class="p-4 bg-surface-secondary rounded mt-4 whitespace-pre-wrap text-content-body">Click button to test connection</pre> </div> </section>  ` })}`;
}, "/Users/travishall/GitHub/el-camino/src/pages/debug.astro", void 0);

const $$file = "/Users/travishall/GitHub/el-camino/src/pages/debug.astro";
const $$url = "/debug";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Debug,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
