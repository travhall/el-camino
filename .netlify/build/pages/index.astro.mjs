/* empty css                                  */
import { c as createComponent, r as renderTemplate, m as maybeRenderHead, a as addAttribute, d as renderComponent, b as createAstro } from '../chunks/astro/server_wNtMDreN.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_C4R5laYf.mjs';
import { $ as $$Button } from '../chunks/Button_DuQAYb4o.mjs';
import { M as MoneyUtils } from '../chunks/money_BhdmIw14.mjs';
import { a as fetchProducts } from '../chunks/client_DxUFhajx.mjs';
import { f as fetchGraphQL, b as GET_RECENT_ARTICLES } from '../chunks/queries_BMxZ0Hog.mjs';
export { renderers } from '../renderers.mjs';

const $$Astro$2 = createAstro();
const $$ProductCard = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$ProductCard;
  const { product } = Astro2.props;
  const formattedPrice = typeof product.price === "object" ? MoneyUtils.format(product.price) : MoneyUtils.format(MoneyUtils.fromFloat(product.price));
  return renderTemplate`${maybeRenderHead()}<div class="product-card bg-ui-card-surface text-ui-card-text border border-ui-card-border hover:bg-ui-card-hover relative flex flex-col aspect-[3_/_4] md:aspect-auto col-span-full md:col-span-2 md:row-span-5 2xl:row-span-4 overflow-hidden"> <!-- Only change: Added duration-300 to transition classes --> <img${addAttribute(product.image, "src")}${addAttribute(product.title, "alt")} class="card-img object-cover w-full h-full transition-all duration-300 opacity-10" onerror="console.error('Failed to load product image:', this.src)"> <!-- Rest of the component remains exactly the same --> <div class="card-content flex flex-col gap-4 lg:gap-6 px-6 py-12 xl:p-12 absolute bottom-0 w-full"> <h1 class="card-heading font-display font-black tracking-wide"> ${product.title} </h1> <span class="card-price font-display font-semibold text-base tracking-wide"> ${formattedPrice} </span> ${product.description && renderTemplate`<p class="description text-sm leading-snug md:text-base md:leading-snug 2xl:text-lg 2xl:leading-snug"> ${product.description} </p>`} <div class="flex gap-2"> ${renderComponent($$result, "Button", $$Button, { "type": "button", "variant": "primary", "size": "md", "classes": "add-to-cart-btn", "data-product": JSON.stringify({
    id: product.id,
    catalogObjectId: product.catalogObjectId,
    variationId: product.variationId,
    title: product.title,
    price: typeof product.price === "object" ? MoneyUtils.toFloat(product.price) : product.price,
    image: product.image
  }) }, { "default": ($$result2) => renderTemplate`
Add to Cart
` })} ${renderComponent($$result, "Button", $$Button, { "type": "button", "variant": "outline", "size": "md", "classes": "view-details-btn", "onclick": `window.location.href='${product.url}'` }, { "default": ($$result2) => renderTemplate`
View Details
` })} </div> </div> </div> `;
}, "/Users/travishall/GitHub/el-camino/src/components/ProductCard.astro", void 0);

const $$Astro$1 = createAstro();
const $$ArticleCard = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$ArticleCard;
  const { article, featured = false } = Astro2.props;
  const { title, description, slug, publishedAt, cover, author, category } = article;
  function getImageUrl(path) {
    const baseUrl = "http://localhost:1337";
    return path?.startsWith("http") ? path : `${baseUrl}${path}`;
  }
  return renderTemplate`${maybeRenderHead()}<article${addAttribute([
    "card relative overflow-hidden bg-ui-card-surface text-ui-card-text border-ui-card-border hover:bg-ui-card-hover flex flex-col aspect-[3_/_4] md:aspect-auto col-span-full md:first-of-type:col-span-4 md:col-span-2 md:row-span-5 md:first-of-type:row-span-4 2xl:row-span-4 2xl:first-of-type:row-span-3 transition-all",
    featured ? "banner-card" : "article-card"
  ], "class:list")}> ${cover?.url && renderTemplate`<img${addAttribute(getImageUrl(cover.url), "src")}${addAttribute(cover.alternativeText || title, "alt")}${addAttribute([
    "card-img object-cover w-full h-full transition-all duration-300",
    featured || "opacity-10"
  ], "class:list")} loading="lazy">`} <div${addAttribute([
    "card-content flex flex-col gap-4 lg:gap-6 px-6 py-12 xl:p-12 absolute bottom-0 w-full",
    featured && "bg-ui-card-surface/90 md:bg-ui-card-surface md:border-t-4 md:border-l-4 md:border-ui-card-border md:w-2/3 right-0"
  ], "class:list")}> ${category && renderTemplate`<span class="card-category font-display font-semibold text-base tracking-wide uppercase -mb-4 text-content-meta"> ${category.name} </span>`} <h2 class="card-heading font-display font-black text-6xl md:text-5xl xl:text-6xl 3xl:text-7xl leading-[0.8] text-content-heading"> ${title} </h2> ${description && renderTemplate`<p class="description text-sm md:text-base 2xl:text-lg leading-snug line-clamp-2 text-content-body"> ${description} </p>`} <div class="mt-auto flex flex-col gap-4"> <a${addAttribute(`/article/${slug}`, "href")} class="self-start card-link"> ${renderComponent($$result, "Button", $$Button, { "type": "button", "variant": "primary", "size": "md", "class": "card-btn" }, { "default": ($$result2) => renderTemplate`
Read Article
` })} </a> </div> </div> </article> `;
}, "/Users/travishall/GitHub/el-camino/src/components/ArticleCard.astro", void 0);

const $$Astro = createAstro();
const $$ArticleGrid = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$ArticleGrid;
  const { articles, featured = false } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<div class="card-grid grid justify-center grid-cols-6 2xl:grid-cols-8 md:auto-rows-[10vw] w-full gap-1 p-1"> ${articles.map((article, index) => renderTemplate`${renderComponent($$result, "ArticleCard", $$ArticleCard, { "article": article, "featured": featured && index === 0 })}`)} </div>`;
}, "/Users/travishall/GitHub/el-camino/src/components/ArticleGrid.astro", void 0);

const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  let products = [];
  try {
    console.log("Fetching Square products...");
    products = await fetchProducts();
    console.log("Products fetched successfully:", products.length);
  } catch (error) {
    console.error("Error fetching products:", error);
  }
  const response = await fetchGraphQL(GET_RECENT_ARTICLES, {
    limit: 6
  });
  const recentArticles = response.articles;
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "El Camino Skate Shop" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<section> ${renderComponent($$result2, "ArticleGrid", $$ArticleGrid, { "articles": recentArticles, "featured": true })} ${products.length > 0 && renderTemplate`<div class="flex flex-col md:flex-row p-4 md:p-8 lg:pt-12 xl:pt-16"> <h2 class="align-bottom font-display font-black text-6xl md:text-5xl lg:text-7xl xl:text-8xl 2xl:text-9xl leading-[0.8] text-content-heading">
Products
</h2> </div>
        <div class="card-grid grid justify-center grid-cols-6 2xl:grid-cols-8 md:auto-rows-[10vw] max-w-[120rem] mx-auto gap-1 p-1"> ${products.map((product) => renderTemplate`${renderComponent($$result2, "ProductCard", $$ProductCard, { "product": product })}`)} </div>`} </section> ` })}`;
}, "/Users/travishall/GitHub/el-camino/src/pages/index.astro", void 0);

const $$file = "/Users/travishall/GitHub/el-camino/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
