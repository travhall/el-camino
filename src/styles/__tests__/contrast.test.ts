import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the OKLCH palette in global.css: recomputes WCAG 2.x contrast for
 * the semantic token pairs in both themes so a palette tweak can't silently
 * drop below AA (text, 4.5:1) or the non-text minimum (1.4.11, 3:1).
 */

const css = readFileSync(resolve(__dirname, '../global.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  ''
);

/** Returns the body of the first top-level block whose selector matches. */
function blockBody(selectorPattern: RegExp): string {
  const match = selectorPattern.exec(css);
  if (!match) throw new Error(`Block not found: ${selectorPattern}`);
  let depth = 1;
  let i = match.index + match[0].length;
  const start = i;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  return css.slice(start, i - 1);
}

function parseDeclarations(body: string): Map<string, string> {
  const decls = new Map<string, string>();
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    decls.set(m[1], m[2].trim());
  }
  return decls;
}

const themeDecls = parseDeclarations(blockBody(/^@theme inline\s*\{/m));
const darkDecls = parseDeclarations(blockBody(/^\.dark\s*\{/m));

type Rgb = [number, number, number];

// Björn Ottosson's OKLab -> linear sRGB. Values are already linear, so no
// sRGB gamma decoding before computing luminance.
function oklchToLinearRgb(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return [
    clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function parseOklch(value: string): Rgb | null {
  const m = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value);
  if (!m) return null;
  return oklchToLinearRgb(Number(m[1]) / 100, Number(m[2]), Number(m[3]));
}

function themeTokens(theme: 'light' | 'dark'): Map<string, string> {
  const tokens = new Map(themeDecls);
  if (theme === 'dark') {
    for (const [k, v] of darkDecls) tokens.set(k, v);
  }
  return tokens;
}

function resolveToken(
  tokens: Map<string, string>,
  name: string,
  seen: string[] = []
): Rgb {
  if (seen.includes(name)) {
    throw new Error(`Circular var() chain: ${[...seen, name].join(' -> ')}`);
  }
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`Token not found: ${name}`);
  const varRef = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value);
  if (varRef) return resolveToken(tokens, varRef[1], [...seen, name]);
  const rgb = parseOklch(value);
  if (!rgb) throw new Error(`Cannot resolve ${name}: "${value}"`);
  return rgb;
}

describe('contrast converter', () => {
  it('computes 21:1 for white on black', () => {
    const white = parseOklch('oklch(100% 0 0)')!;
    const black = parseOklch('oklch(0% 0 0)')!;
    expect(Math.abs(contrastRatio(white, black) - 21)).toBeLessThan(0.05);
  });
});

const TEXT_MIN = 4.5;
const NON_TEXT_MIN = 3.0;

const textTokens = [
  '--content-heading',
  '--content-body',
  '--content-meta',
  '--content-meta-small',
  '--content-emphasis',
  '--content-link',
  '--content-caption',
  '--product-category',
];
const surfaces = ['--surface-primary', '--surface-secondary'];

const pairs: { fg: string; bg: string; min: number }[] = [
  ...textTokens.flatMap((fg) =>
    surfaces.map((bg) => ({ fg, bg, min: TEXT_MIN }))
  ),
  { fg: '--ui-button-text', bg: '--ui-button-surface', min: TEXT_MIN },
  {
    fg: '--ui-button-secondary-text',
    bg: '--ui-button-secondary-surface',
    min: TEXT_MIN,
  },
  {
    fg: '--ui-variant-selected-text',
    bg: '--ui-variant-selected-surface',
    min: TEXT_MIN,
  },
  { fg: '--ui-nav-text', bg: '--ui-nav-surface', min: TEXT_MIN },
  { fg: '--ui-input-border', bg: '--ui-input-surface', min: NON_TEXT_MIN },
];

describe.each(['light', 'dark'] as const)(
  '%s theme palette contrast',
  (theme) => {
    const tokens = themeTokens(theme);

    it.each(pairs)('$fg on $bg >= $min:1', ({ fg, bg, min }) => {
      const ratio = contrastRatio(
        resolveToken(tokens, fg),
        resolveToken(tokens, bg)
      );
      expect(
        ratio,
        `${fg} on ${bg} = ${ratio.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(min);
    });
  }
);
