import { c as createComponent, r as renderTemplate, m as maybeRenderHead, a as addAttribute, d as renderComponent, b as createAstro } from './astro/server_wNtMDreN.mjs';
import 'kleur/colors';
import { a as $$Icon } from './Layout_qf2jlJw4.mjs';

const $$Astro = createAstro();
const $$ArticleNavigation = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$ArticleNavigation;
  const { currentSlug, articles } = Astro2.props;
  const sortedArticles = [...articles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const currentIndex = sortedArticles.findIndex(
    (article) => article.slug === currentSlug
  );
  const previousArticle = currentIndex < sortedArticles.length - 1 ? sortedArticles[currentIndex + 1] : null;
  const nextArticle = currentIndex > 0 ? sortedArticles[currentIndex - 1] : null;
  return renderTemplate`${maybeRenderHead()}<nav class="border-t border-border-primary mt-12 pt-8" aria-label="Article navigation"> <div class="grid grid-cols-1 md:grid-cols-2 gap-8"> ${previousArticle && renderTemplate`<a${addAttribute(`/article/${previousArticle.slug}`, "href")} class="group flex flex-col space-y-3 hover:text-ui-nav-hover"> <div class="flex items-center text-sm text-content-meta group-hover:text-ui-nav-hover"> ${renderComponent($$result, "Icon", $$Icon, { "name": "uil:arrow-left", "class": "w-4 h-4 mr-2" })} <span>Previous Article</span> </div> <p class="font-semibold line-clamp-2 text-content-body"> ${previousArticle.title} </p> </a>`} ${nextArticle && renderTemplate`<a${addAttribute(`/article/${nextArticle.slug}`, "href")}${addAttribute(`group flex flex-col space-y-3 hover:text-ui-nav-hover ${!previousArticle ? "md:col-start-2" : ""}`, "class")}> <div class="flex items-center justify-end text-sm text-content-meta group-hover:text-ui-nav-hover"> <span>Next Article</span> ${renderComponent($$result, "Icon", $$Icon, { "name": "uil:arrow-right", "class": "w-4 h-4 ml-2" })} </div> <p class="font-semibold text-right line-clamp-2 text-content-body"> ${nextArticle.title} </p> </a>`} </div> </nav>`;
}, "/Users/travishall/GitHub/el-camino/src/components/ArticleNavigation.astro", void 0);

function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

export { $$ArticleNavigation as $, formatDate as f };
