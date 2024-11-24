import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_BUvNToH9.mjs';
import { manifest } from './manifest_CJAVBj2m.mjs';

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/api/cart-actions.astro.mjs');
const _page2 = () => import('./pages/api/create-checkout.astro.mjs');
const _page3 = () => import('./pages/api/list-catalog.astro.mjs');
const _page4 = () => import('./pages/api/square-webhook.astro.mjs');
const _page5 = () => import('./pages/api/ssr-verify.astro.mjs');
const _page6 = () => import('./pages/article/_slug_.astro.mjs');
const _page7 = () => import('./pages/articles.astro.mjs');
const _page8 = () => import('./pages/cart.astro.mjs');
const _page9 = () => import('./pages/debug.astro.mjs');
const _page10 = () => import('./pages/order-confirmation.astro.mjs');
const _page11 = () => import('./pages/product/_id_.astro.mjs');
const _page12 = () => import('./pages/styleguide.astro.mjs');
const _page13 = () => import('./pages/test.astro.mjs');
const _page14 = () => import('./pages/index.astro.mjs');


const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/api/cart-actions.ts", _page1],
    ["src/pages/api/create-checkout.ts", _page2],
    ["src/pages/api/list-catalog.ts", _page3],
    ["src/pages/api/square-webhook.ts", _page4],
    ["src/pages/api/ssr-verify.ts", _page5],
    ["src/pages/article/[slug].astro", _page6],
    ["src/pages/articles.astro", _page7],
    ["src/pages/cart.astro", _page8],
    ["src/pages/debug.astro", _page9],
    ["src/pages/order-confirmation.astro", _page10],
    ["src/pages/product/[id].astro", _page11],
    ["src/pages/styleguide.astro", _page12],
    ["src/pages/test.astro", _page13],
    ["src/pages/index.astro", _page14]
]);
const serverIslandMap = new Map();
const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    middleware: undefined
});
const _args = {
    "middlewareSecret": "3b43fd2e-bb92-4f80-9424-bec9fbbdb2ca"
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (_start in serverEntrypointModule) {
	serverEntrypointModule[_start](_manifest, _args);
}

export { __astrojsSsrVirtualEntry as default, pageMap };
