/* empty css                                  */
import { c as createComponent, r as renderTemplate, d as renderComponent, b as createAstro, m as maybeRenderHead, a as addAttribute, F as Fragment, u as unescapeHTML } from '../chunks/astro/server_wNtMDreN.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_C4R5laYf.mjs';
import { f as formatDate, $ as $$ArticleNavigation } from '../chunks/dates_CumxCKtx.mjs';
import { f as fetchGraphQL, G as GET_ARTICLE_BY_SLUG, a as GET_ALL_ARTICLES } from '../chunks/queries_BMxZ0Hog.mjs';
export { renderers } from '../renderers.mjs';

const $$Astro = createAstro();
const $$Articles = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Articles;
  const { slug } = Astro2.params;
  const articleResponse = await fetchGraphQL(
    GET_ARTICLE_BY_SLUG,
    { slug }
  );
  const article = articleResponse.articles[0];
  if (!article) {
    return new Response(null, {
      status: 404,
      statusText: "Not found"
    });
  }
  const allArticlesResponse = await fetchGraphQL(
    GET_ALL_ARTICLES,
    {
      page: 1,
      pageSize: 100,
      sort: ["publishedAt:desc"]
    }
  );
  function getImageUrl(path) {
    if (!path) return "";
    const baseUrl = "http://localhost:1337";
    return path.startsWith("http") ? path : `${baseUrl}${path}`;
  }
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": article.title }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<section> <article class="max-w-6xl mx-auto"> <header class="mb-8"> <h1 class="font-display font-black text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl leading-[0.8] mb-4 text-content-heading"> ${article.title} </h1> <div class="flex items-center gap-4 text-content-meta mb-6"> ${article.author && renderTemplate`<div class="flex items-center"> ${article.author.avatar?.url && renderTemplate`<img${addAttribute(getImageUrl(article.author.avatar.url), "src")}${addAttribute(article.author.name, "alt")} class="w-10 h-10 rounded-full mr-3">`} <div> <p class="font-medium text-content-body"> ${article.author.name} </p> <time${addAttribute(article.publishedAt, "datetime")} class="text-sm"> ${formatDate(article.publishedAt)} </time> </div> </div>`} </div> ${article.cover?.url && renderTemplate`<img${addAttribute(getImageUrl(article.cover.url), "src")}${addAttribute(article.cover.alternativeText || article.title, "alt")} class="w-full h-auto rounded-sm shadow-lg mb-8">`} </header> <div class="prose prose-lg max-w-none text-content-body"> ${article.blocks?.map((block) => {
    switch (block.__typename) {
      case "ComponentSharedRichText":
        return renderTemplate`${renderComponent($$result2, "Fragment", Fragment, {}, { "default": ($$result3) => renderTemplate`${unescapeHTML(block.body)}` })}`;
      case "ComponentSharedMedia":
        return block.file && renderTemplate`<img${addAttribute(getImageUrl(block.file.url), "src")}${addAttribute(block.file.alternativeText || "", "alt")} class="w-full h-auto rounded-sm">`;
      case "ComponentSharedQuote":
        return renderTemplate`<blockquote class="border-l-4 border-ui-button-surface pl-4 italic"> ${block.title && renderTemplate`<p class="font-bold">${block.title}</p>`} <p>${block.body}</p> </blockquote>`;
      case "ComponentSharedSlider":
        return block.files ? renderTemplate`<div class="flex flex-col gap-4"> ${block.files.map((file) => renderTemplate`<img${addAttribute(getImageUrl(file.url), "src")}${addAttribute(file.alternativeText || "", "alt")} class="w-full h-auto rounded-sm">`)} </div>` : null;
    }
  })} </div> ${renderComponent($$result2, "ArticleNavigation", $$ArticleNavigation, { "currentSlug": article.slug, "articles": allArticlesResponse.articles })} </article> </section> ` })}`;
}, "/Users/travishall/GitHub/el-camino/src/pages/articles.astro", void 0);
const $$file = "/Users/travishall/GitHub/el-camino/src/pages/articles.astro";
const $$url = "/articles";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Articles,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
