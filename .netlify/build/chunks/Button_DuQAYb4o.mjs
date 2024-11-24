import { c as createComponent, r as renderTemplate, m as maybeRenderHead, a as addAttribute, s as spreadAttributes, e as renderSlot, b as createAstro } from './astro/server_wNtMDreN.mjs';
import 'clsx';

const $$Astro = createAstro();
const $$Button = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Button;
  const {
    type = "button",
    size = "md",
    variant = "primary",
    classes,
    ...rest
  } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<button${addAttribute(type, "type")}${addAttribute(size, "data-size")}${addAttribute(variant, "data-variant")}${addAttribute([
    "font-sans font-semibold transition-all ease-in-out duration-300 border-2 rounded-[4px] focus-visible:ring outline-0 focus-visible:ring-offset-2",
    variant === "primary" && "text-ui-button-text bg-ui-button-surface border-ui-button-border hover:bg-ui-button-surface/75 focus-visible:ring-ui-button-ring",
    variant === "secondary" && "[--ui-button-surface:var(--elco-sweet-tea-500)] dark:[--ui-button-surface:var(--elco-fig-leaf-50)] [--ui-button-border:var(--elco-sweet-tea-500)] dark:[--ui-button-border:var(--elco-fig-leaf-50)] text-ui-button-text bg-ui-button-surface border-ui-button-border hover:bg-ui-button-surface/75",
    variant === "outline" && "[--ui-button-surface:transparent] [--ui-button-text:var(--content-body)] [--ui-button-border:var(--content-body)] text-ui-button-text bg-ui-button-surface border-ui-button-border hover:bg-ui-button-surface/25",
    size === "sm" && "text-xs lg:text-sm py-1 px-2",
    size === "md" && "text-sm py-2 px-3 lg:text-base lg:py-2 lg:px-4",
    size === "lg" && "text-lg py-2 px-4 lg:text-xl lg:py-3 lg:px-5",
    classes
  ], "class:list")}${spreadAttributes(rest)}> ${renderSlot($$result, $$slots["default"])} </button>`;
}, "/Users/travishall/GitHub/el-camino/src/components/Button.astro", void 0);

export { $$Button as $ };
