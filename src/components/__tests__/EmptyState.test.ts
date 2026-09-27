/**
 * Render tests for EmptyState (plan 192) via AstroContainer.
 *
 * @vitest-environment node
 *
 * The repo-wide happy-dom environment makes Vite treat `.astro` imports as
 * browser modules (stubs that throw), so this file opts into node.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import EmptyState from '@/components/EmptyState.astro';

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

function render(props: Record<string, unknown>): Promise<string> {
  return container.renderToString(EmptyState, { props });
}

describe('EmptyState', () => {
  it('renders the heading at the default h2 level', async () => {
    const html = await render({ heading: 'Nothing here' });

    expect(html).toMatch(/<h2[^>]*>\s*Nothing here\s*<\/h2>/);
  });

  it('honours headingLevel', async () => {
    const html = await render({ heading: 'Nothing here', headingLevel: 'h3' });

    expect(html).toMatch(/<h3[^>]*>\s*Nothing here\s*<\/h3>/);
    expect(html).not.toContain('<h2');
  });

  it('renders the CTA as a link with the given href', async () => {
    const html = await render({
      heading: 'Empty',
      ctaLabel: 'Go Home',
      ctaHref: '/home',
    });

    expect(html).toMatch(/<a[^>]*href="\/home"[^>]*>\s*Go Home\s*<\/a>/);
  });

  it('renders the CTA as a button when no href is given', async () => {
    const html = await render({ heading: 'Empty', ctaLabel: 'Do it' });

    expect(html).toMatch(/<button[^>]*>\s*Do it\s*<\/button>/);
  });

  it('marks the emoji glyph aria-hidden', async () => {
    const html = await render({ heading: 'Empty', emoji: '🛹' });

    expect(html).toMatch(/<div[^>]*aria-hidden="true"[^>]*>[\s\S]*🛹/);
  });

  it('marks the icon glyph aria-hidden', async () => {
    const html = await render({
      heading: 'Empty',
      icon: 'uil:shopping-cart',
    });

    expect(html).toMatch(/<div[^>]*aria-hidden="true"[^>]*>\s*<svg/);
  });

  it('renders no glyph when neither icon nor emoji is given', async () => {
    const html = await render({ heading: 'Empty' });

    expect(html).not.toContain('aria-hidden');
  });

  it('renders no CTA when ctaLabel is omitted', async () => {
    const html = await render({
      heading: 'Empty',
      ctaHref: '/home',
      ctaId: 'nope',
    });

    expect(html).not.toContain('<a');
    expect(html).not.toContain('<button');
  });

  it('passes ctaId through to the CTA', async () => {
    const html = await render({
      heading: 'Empty',
      ctaLabel: 'Continue Shopping',
      ctaId: 'continue-shopping',
    });

    expect(html).toMatch(/<button[^>]*id="continue-shopping"/);
  });

  it('renders body text only when provided', async () => {
    const withBody = await render({ heading: 'Empty', body: 'Check back' });
    const without = await render({ heading: 'Empty' });

    expect(withBody).toContain('Check back');
    expect(without).not.toContain('<p');
  });

  it('adds full-height centering only when fill is set', async () => {
    const filled = await render({ heading: 'Empty', fill: true });
    const plain = await render({ heading: 'Empty' });

    expect(filled).toContain('lg:min-h-[90dvh]');
    expect(plain).not.toContain('lg:min-h-[90dvh]');
  });
});
