import '@astrojs/internal-helpers/path';
import 'cookie';
import 'kleur/colors';
import { N as NOOP_MIDDLEWARE_FN } from './chunks/astro-designed-error-pages_B2vofioI.mjs';
import 'es-module-lexer';
import { h as decodeKey } from './chunks/astro/server_wNtMDreN.mjs';
import 'clsx';

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.normalize().replace(/#/g, "%23").replace(/\?/g, "%3F")];
      }
      return [key, value];
    })
  );
}
function getParameter(part, params) {
  if (part.spread) {
    return params[part.content.slice(3)] || "";
  }
  if (part.dynamic) {
    if (!params[part.content]) {
      throw new TypeError(`Missing parameter: ${part.content}`);
    }
    return params[part.content];
  }
  return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]");
}
function getSegment(segment, params) {
  const segmentPath = segment.map((part) => getParameter(part, params)).join("");
  return segmentPath ? "/" + segmentPath : "";
}
function getRouteGenerator(segments, addTrailingSlash) {
  return (params) => {
    const sanitizedParams = sanitizeParams(params);
    let trailing = "";
    if (addTrailingSlash === "always" && segments.length) {
      trailing = "/";
    }
    const path = segments.map((segment) => getSegment(segment, sanitizedParams)).join("") + trailing;
    return path || "/";
  };
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    }),
    isIndex: rawRouteData.isIndex
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const inlinedScripts = new Map(serializedManifest.inlinedScripts);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  const serverIslandNameMap = new Map(serializedManifest.serverIslandNameMap);
  const key = decodeKey(serializedManifest.key);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware() {
      return { onRequest: NOOP_MIDDLEWARE_FN };
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes,
    serverIslandNameMap,
    key
  };
}

const manifest = deserializeManifest({"hrefRoot":"file:///Users/travishall/GitHub/el-camino/","adapterName":"@astrojs/netlify","routes":[{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro/dist/assets/endpoint/generic.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/cart-actions","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/cart-actions\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"cart-actions","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/cart-actions.ts","pathname":"/api/cart-actions","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/create-checkout","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/create-checkout\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"create-checkout","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/create-checkout.ts","pathname":"/api/create-checkout","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/list-catalog","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/list-catalog\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"list-catalog","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/list-catalog.ts","pathname":"/api/list-catalog","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/square-webhook","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/square-webhook\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"square-webhook","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/square-webhook.ts","pathname":"/api/square-webhook","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/ssr-verify","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/ssr-verify\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"ssr-verify","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/ssr-verify.ts","pathname":"/api/ssr-verify","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/hoisted.CASh0557.js"}],"styles":[{"type":"external","src":"/_astro/_slug_.DMMQIL6v.css"}],"routeData":{"route":"/article/[slug]","isIndex":false,"type":"page","pattern":"^\\/article\\/([^/]+?)\\/?$","segments":[[{"content":"article","dynamic":false,"spread":false}],[{"content":"slug","dynamic":true,"spread":false}]],"params":["slug"],"component":"src/pages/article/[slug].astro","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/hoisted.CASh0557.js"}],"styles":[{"type":"external","src":"/_astro/_slug_.DMMQIL6v.css"}],"routeData":{"route":"/articles","isIndex":false,"type":"page","pattern":"^\\/articles\\/?$","segments":[[{"content":"articles","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/articles.astro","pathname":"/articles","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/hoisted.CHpp9IYI.js"}],"styles":[{"type":"external","src":"/_astro/_slug_.DMMQIL6v.css"}],"routeData":{"route":"/cart","isIndex":false,"type":"page","pattern":"^\\/cart\\/?$","segments":[[{"content":"cart","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/cart.astro","pathname":"/cart","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/hoisted.QsuRUN53.js"}],"styles":[{"type":"external","src":"/_astro/_slug_.DMMQIL6v.css"}],"routeData":{"route":"/debug","isIndex":false,"type":"page","pattern":"^\\/debug\\/?$","segments":[[{"content":"debug","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/debug.astro","pathname":"/debug","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/hoisted.CASh0557.js"}],"styles":[{"type":"external","src":"/_astro/_slug_.DMMQIL6v.css"}],"routeData":{"route":"/order-confirmation","isIndex":false,"type":"page","pattern":"^\\/order-confirmation\\/?$","segments":[[{"content":"order-confirmation","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/order-confirmation.astro","pathname":"/order-confirmation","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/hoisted.5OxKJbsZ.js"}],"styles":[{"type":"external","src":"/_astro/_slug_.DMMQIL6v.css"}],"routeData":{"route":"/product/[id]","isIndex":false,"type":"page","pattern":"^\\/product\\/([^/]+?)\\/?$","segments":[[{"content":"product","dynamic":false,"spread":false}],[{"content":"id","dynamic":true,"spread":false}]],"params":["id"],"component":"src/pages/product/[id].astro","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/hoisted.CASh0557.js"}],"styles":[{"type":"external","src":"/_astro/_slug_.DMMQIL6v.css"},{"type":"inline","content":".color-group[data-astro-cid-3xbz2sym]{margin-bottom:30px}.swatch-container[data-astro-cid-3xbz2sym]{display:flex;flex-wrap:wrap;gap:10px}.swatch[data-astro-cid-3xbz2sym]{width:80px;text-align:center}.color-box[data-astro-cid-3xbz2sym]{width:80px;height:80px;border-radius:8px;margin-bottom:5px;box-shadow:0 2px 4px #0000001a}.swatch-label[data-astro-cid-3xbz2sym]{font-size:14px}\n"}],"routeData":{"route":"/styleguide","isIndex":false,"type":"page","pattern":"^\\/styleguide\\/?$","segments":[[{"content":"styleguide","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/styleguide.astro","pathname":"/styleguide","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/hoisted.CASh0557.js"}],"styles":[{"type":"external","src":"/_astro/_slug_.DMMQIL6v.css"}],"routeData":{"route":"/test","isIndex":false,"type":"page","pattern":"^\\/test\\/?$","segments":[[{"content":"test","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/test.astro","pathname":"/test","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/hoisted.DfaDQIlC.js"}],"styles":[{"type":"external","src":"/_astro/_slug_.DMMQIL6v.css"}],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}}],"base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["/Users/travishall/GitHub/el-camino/src/pages/article/[slug].astro",{"propagation":"none","containsHead":true}],["/Users/travishall/GitHub/el-camino/src/pages/articles.astro",{"propagation":"none","containsHead":true}],["/Users/travishall/GitHub/el-camino/src/pages/cart.astro",{"propagation":"none","containsHead":true}],["/Users/travishall/GitHub/el-camino/src/pages/debug.astro",{"propagation":"none","containsHead":true}],["/Users/travishall/GitHub/el-camino/src/pages/index.astro",{"propagation":"none","containsHead":true}],["/Users/travishall/GitHub/el-camino/src/pages/order-confirmation.astro",{"propagation":"none","containsHead":true}],["/Users/travishall/GitHub/el-camino/src/pages/product/[id].astro",{"propagation":"none","containsHead":true}],["/Users/travishall/GitHub/el-camino/src/pages/styleguide.astro",{"propagation":"none","containsHead":true}],["/Users/travishall/GitHub/el-camino/src/pages/test.astro",{"propagation":"none","containsHead":true}]],"renderers":[],"clientDirectives":[["idle","(()=>{var l=(o,t)=>{let i=async()=>{await(await o())()},e=typeof t.value==\"object\"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};\"requestIdleCallback\"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var s=(i,t)=>{let a=async()=>{await(await i())()};if(t.value){let e=matchMedia(t.value);e.matches?a():e.addEventListener(\"change\",a,{once:!0})}};(self.Astro||(self.Astro={})).media=s;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var l=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let a of e)if(a.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=l;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000noop-middleware":"_noop-middleware.mjs","\u0000@astro-page:node_modules/astro/dist/assets/endpoint/generic@_@js":"pages/_image.astro.mjs","\u0000@astro-page:src/pages/api/cart-actions@_@ts":"pages/api/cart-actions.astro.mjs","\u0000@astro-page:src/pages/api/create-checkout@_@ts":"pages/api/create-checkout.astro.mjs","\u0000@astro-page:src/pages/api/list-catalog@_@ts":"pages/api/list-catalog.astro.mjs","\u0000@astro-page:src/pages/api/square-webhook@_@ts":"pages/api/square-webhook.astro.mjs","\u0000@astro-page:src/pages/api/ssr-verify@_@ts":"pages/api/ssr-verify.astro.mjs","\u0000@astro-page:src/pages/article/[slug]@_@astro":"pages/article/_slug_.astro.mjs","\u0000@astro-page:src/pages/articles@_@astro":"pages/articles.astro.mjs","\u0000@astro-page:src/pages/cart@_@astro":"pages/cart.astro.mjs","\u0000@astro-page:src/pages/debug@_@astro":"pages/debug.astro.mjs","\u0000@astro-page:src/pages/order-confirmation@_@astro":"pages/order-confirmation.astro.mjs","\u0000@astro-page:src/pages/product/[id]@_@astro":"pages/product/_id_.astro.mjs","\u0000@astro-page:src/pages/styleguide@_@astro":"pages/styleguide.astro.mjs","\u0000@astro-page:src/pages/test@_@astro":"pages/test.astro.mjs","\u0000@astro-page:src/pages/index@_@astro":"pages/index.astro.mjs","\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000@astrojs-ssr-adapter":"_@astrojs-ssr-adapter.mjs","/Users/travishall/GitHub/el-camino/node_modules/astro/dist/env/setup.js":"chunks/astro/env-setup_Cr6XTFvb.mjs","\u0000@astrojs-manifest":"manifest_CJAVBj2m.mjs","/Users/travishall/GitHub/el-camino/node_modules/@astrojs/react/vnode-children.js":"chunks/vnode-children_BkR_XoPb.mjs","/astro/hoisted.js?q=0":"_astro/hoisted.CHpp9IYI.js","/astro/hoisted.js?q=1":"_astro/hoisted.QsuRUN53.js","/astro/hoisted.js?q=2":"_astro/hoisted.5OxKJbsZ.js","/astro/hoisted.js?q=3":"_astro/hoisted.DfaDQIlC.js","@astrojs/react/client.js":"_astro/client.5I5BMcNS.js","/astro/hoisted.js?q=4":"_astro/hoisted.CASh0557.js","astro:scripts/before-hydration.js":""},"inlinedScripts":[],"assets":["/_astro/_slug_.DMMQIL6v.css","/favicon.svg","/_astro/client.5I5BMcNS.js","/_astro/hoisted.5OxKJbsZ.js","/_astro/hoisted.CASh0557.js","/_astro/hoisted.CHpp9IYI.js","/_astro/hoisted.DfaDQIlC.js","/_astro/hoisted.QsuRUN53.js","/fonts/AlumniSans-Italic.woff2","/fonts/AlumniSans.woff2","/fonts/Cabin-Italic.woff2","/fonts/Cabin.woff2","/images/category-accessories.png","/images/category-apparel.png","/images/category-footwear.png","/images/category-skateboarding.png","/images/placeholder.png","/images/promo-img-01.png","/images/promo-img-02.png","/images/promo-img-03.png","/images/promo-img-04.png","/images/promo-img-05.png","/images/promo-img-06.png"],"buildFormat":"directory","checkOrigin":false,"serverIslandNameMap":[],"key":"I9m+buXm4DIibci8EiRyNqmCUVHB/ZVJGXvLbRSnNUM=","experimentalEnvGetSecretEnabled":false});

export { manifest };
