import { describe, it, expect } from 'vitest';
import {
  stripUnsafeHtml,
  processRawWordPressHTML,
} from '../content-utils';

describe('stripUnsafeHtml', () => {
  it('neutralizes data:text/html URIs', () => {
    const result = stripUnsafeHtml(
      '<img src="data:text/html,<script>alert(1)</script>">'
    );
    expect(result).not.toContain('data:text/html');
  });

  it('neutralizes data:application/javascript URIs', () => {
    const result = stripUnsafeHtml(
      '<a href="data:application/javascript,alert(1)">x</a>'
    );
    expect(result).not.toContain('data:application/javascript');
  });

  it('still neutralizes javascript: URIs', () => {
    const result = stripUnsafeHtml('<a href="javascript:alert(1)">x</a>');
    expect(result).not.toContain('javascript:alert');
  });

  it('does not alter legitimate data:image/* URIs', () => {
    const input = '<img src="data:image/png;base64,iVBORw0KGgo=">';
    expect(stripUnsafeHtml(input)).toBe(input);
  });

  it('still strips <script> tags', () => {
    const result = stripUnsafeHtml('<script>alert(1)</script>');
    expect(result).not.toContain('<script>');
  });
});

describe('processRawWordPressHTML', () => {
  it('replaces a span.embed-youtube-wrapped iframe with the youtube-facade', () => {
    const input =
      '<span class="embed-youtube"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></span>';
    const result = processRawWordPressHTML(input);
    expect(result).toContain('class="youtube-facade"');
    expect(result).toContain('data-videoid="dQw4w9WgXcQ"');
    expect(result).toContain(
      '<img src="https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"'
    );
    expect(result).not.toContain('<iframe');
  });

  it('replaces a bare standalone YouTube iframe with the youtube-facade', () => {
    const input = '<iframe src="https://youtube.com/embed/xyz789ABC"></iframe>';
    const result = processRawWordPressHTML(input);
    expect(result).toContain('class="youtube-facade"');
    expect(result).toContain('data-videoid="xyz789ABC"');
    expect(result).toContain(
      '<img src="https://img.youtube.com/vi/xyz789ABC/hqdefault.jpg"'
    );
    expect(result).not.toContain('<iframe');
  });

  it('injects a title on an iframe missing one, inferred from its host', () => {
    const input = '<iframe src="https://vimeo.com/video/123"></iframe>';
    const result = processRawWordPressHTML(input);
    expect(result).toContain('title="Vimeo video player"');
  });

  it('leaves an existing iframe title unchanged', () => {
    const input =
      '<iframe src="https://vimeo.com/video/123" title="Custom"></iframe>';
    const result = processRawWordPressHTML(input);
    expect(result).toContain('title="Custom"');
    expect(result).not.toContain('Vimeo video player');
  });

  it('injects default width/height on an <img> missing them', () => {
    const input = '<img src="https://example.com/photo.jpg">';
    const result = processRawWordPressHTML(input);
    expect(result).toContain('width="800"');
    expect(result).toContain('height="600"');
  });

  it('honors options.defaultWidth/defaultHeight when injecting dimensions', () => {
    const input = '<img src="https://example.com/photo.jpg">';
    const result = processRawWordPressHTML(input, {
      defaultWidth: 300,
      defaultHeight: 200,
    });
    expect(result).toContain('width="300"');
    expect(result).toContain('height="200"');
  });

  it('keeps existing <img> dimensions unchanged', () => {
    const input =
      '<img width="200" height="150" src="https://example.com/photo.jpg">';
    const result = processRawWordPressHTML(input);
    expect(result).toContain('width="200"');
    expect(result).toContain('height="150"');
  });

  it('routes a wordpress.com image src through the Netlify Image CDN', () => {
    const input = '<img src="https://example.wordpress.com/foo.jpg">';
    const result = processRawWordPressHTML(input);
    expect(result).toMatch(/src="\/\.netlify\/images\?[^"]*"/);
  });

  it('does not double-rewrite an image already routed through the Netlify Image CDN', () => {
    const input =
      '<img src="/.netlify/images?url=https%3A%2F%2Fexample.wordpress.com%2Ffoo.jpg&w=800&q=75">';
    const result = processRawWordPressHTML(input);
    expect(result).toContain(
      'src="/.netlify/images?url=https%3A%2F%2Fexample.wordpress.com%2Ffoo.jpg&w=800&q=75"'
    );
  });

  it('leaves a non-wordpress.com/wp.com image src unchanged', () => {
    const input = '<img src="https://example.com/foo.jpg">';
    const result = processRawWordPressHTML(input);
    expect(result).toContain('src="https://example.com/foo.jpg"');
  });

  it('does not add loading="lazy" when options.isAboveFold is true', () => {
    const input = '<img src="https://example.com/foo.jpg">';
    const result = processRawWordPressHTML(input, { isAboveFold: true });
    expect(result).not.toContain('loading="lazy"');
  });

  it('adds loading="lazy" when isAboveFold is false/omitted', () => {
    const input = '<img src="https://example.com/foo.jpg">';
    const result = processRawWordPressHTML(input);
    expect(result).toContain('loading="lazy"');
  });

  it('leaves an existing loading="eager" attribute unchanged', () => {
    const input = '<img loading="eager" src="https://example.com/foo.jpg">';
    const result = processRawWordPressHTML(input);
    expect(result).toContain('loading="eager"');
    expect(result).not.toContain('loading="lazy"');
  });

  it('injects alt="" on an <img> missing alt', () => {
    const input = '<img src="https://example.com/foo.jpg">';
    const result = processRawWordPressHTML(input);
    expect(result).toContain('alt=""');
  });

  it('leaves an existing alt attribute unchanged', () => {
    const input = '<img alt="Something" src="https://example.com/foo.jpg">';
    const result = processRawWordPressHTML(input);
    expect(result).toContain('alt="Something"');
  });

  it('still strips a <script> tag embedded in the input', () => {
    const input =
      '<script>alert(1)</script><img src="https://example.com/foo.jpg">';
    const result = processRawWordPressHTML(input);
    expect(result).not.toContain('<script>');
  });
});
