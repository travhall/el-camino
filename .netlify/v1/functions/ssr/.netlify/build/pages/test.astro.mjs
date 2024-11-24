/* empty css                                  */
import { c as createComponent, r as renderTemplate, d as renderComponent, m as maybeRenderHead } from '../chunks/astro/server_wNtMDreN.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_qf2jlJw4.mjs';
export { renderers } from '../renderers.mjs';

const $$Test = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Test Page" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<main class="p-4"> <h1 class="text-2xl">Test Page</h1> <p>If you can see this, SSR is working.</p> </main> ` })}`;
}, "/Users/travishall/GitHub/el-camino/src/pages/test.astro", void 0);

const $$file = "/Users/travishall/GitHub/el-camino/src/pages/test.astro";
const $$url = "/test";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Test,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
