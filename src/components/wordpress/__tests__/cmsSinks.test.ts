/**
 * Plan 170: CMS-derived text that reaches `set:html` in the WordPress block
 * components must go through stripUnsafeHtml. The block parser strips
 * `<...>` pairs from captions and quotes, but a fragment that never closes
 * (`<img src=x onerror=...` with no `>`) survives it and would pick up the
 * `>` of whatever markup follows.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import WPQuote from '@/components/wordpress/blocks/WPQuote.astro';
import WPImage from '@/components/wordpress/blocks/WPImage.astro';
import WPGallery from '@/components/wordpress/blocks/WPGallery.astro';
import JetpackSlideshow from '@/components/wordpress/blocks/JetpackSlideshow.astro';

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

const render = (
  c: Parameters<AstroContainer['renderToString']>[0],
  props: Record<string, unknown>
) => container.renderToString(c, { props });

// Unclosed tag with a handler, an embedded script, and a javascript: link.
const HOSTILE =
  'nice <img src=x onerror=alert(1) and <script>alert(2)</script><a href="javascript:alert(3)">x</a>';

function expectClean(html: string) {
  expect(html).not.toMatch(/onerror/i);
  // Not /<script/: the gallery components ship their own client <script>.
  expect(html).not.toContain('alert(2)');
  expect(html).not.toMatch(/javascript:/i);
}

describe('WordPress block components sanitize CMS text', () => {
  it('WPQuote quote and cite', async () => {
    const html = await render(WPQuote, { quote: HOSTILE, cite: HOSTILE });
    expectClean(html);
    expect(html).toContain('nice');
  });

  it('WPImage caption', async () => {
    const html = await render(WPImage, {
      src: 'https://example.com/a.jpg',
      alt: 'a',
      caption: HOSTILE,
    });
    expectClean(html);
    expect(html).toContain('nice');
  });

  it('WPGallery caption', async () => {
    const html = await render(WPGallery, {
      images: [
        { src: 'https://example.com/a.jpg', alt: 'a', caption: HOSTILE },
      ],
    });
    expectClean(html);
    expect(html).toContain('nice');
  });

  it('JetpackSlideshow caption', async () => {
    const html = await render(JetpackSlideshow, {
      images: [
        { src: 'https://example.com/a.jpg', alt: 'a', caption: HOSTILE },
      ],
    });
    expectClean(html);
    expect(html).toContain('nice');
  });

  it('keeps an ordinary caption intact', async () => {
    const html = await render(WPImage, {
      src: 'https://example.com/a.jpg',
      alt: 'a',
      caption: 'Photo by <em>Sam</em> &amp; friends',
    });
    expect(html).toContain('Photo by <em>Sam</em> &amp; friends');
  });
});
