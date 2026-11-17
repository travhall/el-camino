/**
 * Characterization tests for EnhancedImageOptimizer's URL output (plan 161).
 * Written against the code before the image-URL builders were consolidated, to
 * show the consolidation changes no server-rendered URL: every expectation here
 * is the exact string the old implementation produced.
 */
import { describe, it, expect } from 'vitest';
import { EnhancedImageOptimizer } from '../enhanced-optimizer';

const SQUARE =
  'https://items-images-sandbox.s3.us-west-2.amazonaws.com/files/abc/original.jpeg';
const SQUARECDN =
  'https://items-images-production.squarecdn.com/files/def/x.jpg';
const WP =
  'https://elcaminoskateshop.wordpress.com/wp-content/uploads/2026/03/el-co-02.jpg';

describe('generateResponsiveSrcSet', () => {
  it('Square product image, avif, square crop (the PDP hero)', () => {
    expect(
      EnhancedImageOptimizer.generateResponsiveSrcSet(SQUARE, 'avif', {
        width: 800,
        height: 800,
        quality: 85,
      })
    ).toMatchInlineSnapshot(
      `"/.netlify/images?url=https%3A%2F%2Fitems-images-sandbox.s3.us-west-2.amazonaws.com%2Ffiles%2Fabc%2Foriginal.jpeg&w=320&q=85&fit=cover&h=320&fm=avif 320w, /.netlify/images?url=https%3A%2F%2Fitems-images-sandbox.s3.us-west-2.amazonaws.com%2Ffiles%2Fabc%2Foriginal.jpeg&w=640&q=85&fit=cover&h=640&fm=avif 640w, /.netlify/images?url=https%3A%2F%2Fitems-images-sandbox.s3.us-west-2.amazonaws.com%2Ffiles%2Fabc%2Foriginal.jpeg&w=768&q=85&fit=cover&h=768&fm=avif 768w, /.netlify/images?url=https%3A%2F%2Fitems-images-sandbox.s3.us-west-2.amazonaws.com%2Ffiles%2Fabc%2Foriginal.jpeg&w=1024&q=85&fit=cover&h=1024&fm=avif 1024w"`
    );
  });

  it('Square product image, webp and jpeg', () => {
    const o = { width: 800, height: 800, quality: 85 };
    expect(
      EnhancedImageOptimizer.generateResponsiveSrcSet(SQUARE, 'webp', o)
    ).toMatchInlineSnapshot(
      `"/.netlify/images?url=https%3A%2F%2Fitems-images-sandbox.s3.us-west-2.amazonaws.com%2Ffiles%2Fabc%2Foriginal.jpeg&w=320&q=85&fit=cover&h=320&fm=webp 320w, /.netlify/images?url=https%3A%2F%2Fitems-images-sandbox.s3.us-west-2.amazonaws.com%2Ffiles%2Fabc%2Foriginal.jpeg&w=640&q=85&fit=cover&h=640&fm=webp 640w, /.netlify/images?url=https%3A%2F%2Fitems-images-sandbox.s3.us-west-2.amazonaws.com%2Ffiles%2Fabc%2Foriginal.jpeg&w=768&q=85&fit=cover&h=768&fm=webp 768w, /.netlify/images?url=https%3A%2F%2Fitems-images-sandbox.s3.us-west-2.amazonaws.com%2Ffiles%2Fabc%2Foriginal.jpeg&w=1024&q=85&fit=cover&h=1024&fm=webp 1024w"`
    );
    expect(
      EnhancedImageOptimizer.generateResponsiveSrcSet(SQUARE, 'jpeg', o)
    ).toMatchInlineSnapshot(
      `"/.netlify/images?url=https%3A%2F%2Fitems-images-sandbox.s3.us-west-2.amazonaws.com%2Ffiles%2Fabc%2Foriginal.jpeg&w=320&q=85&fit=cover&h=320 320w, /.netlify/images?url=https%3A%2F%2Fitems-images-sandbox.s3.us-west-2.amazonaws.com%2Ffiles%2Fabc%2Foriginal.jpeg&w=640&q=85&fit=cover&h=640 640w, /.netlify/images?url=https%3A%2F%2Fitems-images-sandbox.s3.us-west-2.amazonaws.com%2Ffiles%2Fabc%2Foriginal.jpeg&w=768&q=85&fit=cover&h=768 768w, /.netlify/images?url=https%3A%2F%2Fitems-images-sandbox.s3.us-west-2.amazonaws.com%2Ffiles%2Fabc%2Foriginal.jpeg&w=1024&q=85&fit=cover&h=1024 1024w"`
    );
  });

  it('squarecdn.com host is treated as a Square image', () => {
    expect(
      EnhancedImageOptimizer.generateResponsiveSrcSet(SQUARECDN, 'avif', {
        width: 400,
        height: 400,
      })
    ).toMatchInlineSnapshot(
      `"/.netlify/images?url=https%3A%2F%2Fitems-images-production.squarecdn.com%2Ffiles%2Fdef%2Fx.jpg&w=320&q=48&fit=cover&h=320&fm=avif 320w"`
    );
  });

  it('WordPress image: width only, quality capped at 75, avif forced', () => {
    expect(
      EnhancedImageOptimizer.generateResponsiveSrcSet(WP, 'jpeg', {
        width: 800,
        quality: 90,
      })
    ).toMatchInlineSnapshot(
      `"/.netlify/images?url=https%3A%2F%2Felcaminoskateshop.wordpress.com%2Fwp-content%2Fuploads%2F2026%2F03%2Fel-co-02.jpg&w=320&q=75&fm=avif 320w, /.netlify/images?url=https%3A%2F%2Felcaminoskateshop.wordpress.com%2Fwp-content%2Fuploads%2F2026%2F03%2Fel-co-02.jpg&w=640&q=75&fm=avif 640w, /.netlify/images?url=https%3A%2F%2Felcaminoskateshop.wordpress.com%2Fwp-content%2Fuploads%2F2026%2F03%2Fel-co-02.jpg&w=768&q=75&fm=avif 768w, /.netlify/images?url=https%3A%2F%2Felcaminoskateshop.wordpress.com%2Fwp-content%2Fuploads%2F2026%2F03%2Fel-co-02.jpg&w=1024&q=75&fm=avif 1024w"`
    );
    expect(
      EnhancedImageOptimizer.generateResponsiveSrcSet(WP, 'webp', {
        width: 800,
        quality: 60,
      })
    ).toMatchInlineSnapshot(
      `"/.netlify/images?url=https%3A%2F%2Felcaminoskateshop.wordpress.com%2Fwp-content%2Fuploads%2F2026%2F03%2Fel-co-02.jpg&w=320&q=60&fm=webp 320w, /.netlify/images?url=https%3A%2F%2Felcaminoskateshop.wordpress.com%2Fwp-content%2Fuploads%2F2026%2F03%2Fel-co-02.jpg&w=640&q=60&fm=webp 640w, /.netlify/images?url=https%3A%2F%2Felcaminoskateshop.wordpress.com%2Fwp-content%2Fuploads%2F2026%2F03%2Fel-co-02.jpg&w=768&q=60&fm=webp 768w, /.netlify/images?url=https%3A%2F%2Felcaminoskateshop.wordpress.com%2Fwp-content%2Fuploads%2F2026%2F03%2Fel-co-02.jpg&w=1024&q=60&fm=webp 1024w"`
    );
  });

  it('passes unsupported hosts and invalid URLs through unchanged', () => {
    expect(
      EnhancedImageOptimizer.generateResponsiveSrcSet(
        'https://example.com/a.jpg',
        'avif',
        { width: 320 }
      )
    ).toMatchInlineSnapshot(`"https://example.com/a.jpg 320w"`);
    expect(
      EnhancedImageOptimizer.generateResponsiveSrcSet('not a url', 'avif', {
        width: 320,
      })
    ).toMatchInlineSnapshot(`"not a url 320w"`);
  });
});

describe('generateOptimizedSources', () => {
  it('Square image with a height', () => {
    expect(
      EnhancedImageOptimizer.generateOptimizedSources(SQUARE, {
        width: 600,
        height: 600,
        quality: 85,
      })
    ).toMatchInlineSnapshot(`
      {
        "aspectRatio": 1,
        "jpeg": "https://items-images-sandbox.s3.us-west-2.amazonaws.com/files/abc/original.jpeg",
        "placeholder": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA4MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGRlZnM+CjxsaW5lYXJHcmFkaWVudCBpZD0ic2hpbW1lciIgeDE9IjAiIHkxPSIwIiB4Mj0iMSIgeTI9IjAiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZjBmMGYwIi8+CjxzdG9wIG9mZnNldD0iNTAlIiBzdG9wLWNvbG9yPSIjZTBlMGUwIi8+CjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI2YwZjBmMCIvPgo8L2xpbmVhckdyYWRpZW50Pgo8L2RlZnM+CjxyZWN0IHdpZHRoPSI4MCIgaGVpZ2h0PSI2MCIgZmlsbD0idXJsKCNzaGltbWVyKSIvPgo8L3N2Zz4K",
        "sizes": "100vw",
      }
    `);
  });

  it('WordPress image, default quality, with a blur placeholder', () => {
    expect(
      EnhancedImageOptimizer.generateOptimizedSources(WP, {
        width: 1024,
        placeholder: 'blur',
      })
    ).toMatchInlineSnapshot(`
      {
        "aspectRatio": 1.7777777777777777,
        "avif": "/.netlify/images?url=https%3A%2F%2Felcaminoskateshop.wordpress.com%2Fwp-content%2Fuploads%2F2026%2F03%2Fel-co-02.jpg&w=1024&q=48&fm=avif",
        "jpeg": "/.netlify/images?url=https%3A%2F%2Felcaminoskateshop.wordpress.com%2Fwp-content%2Fuploads%2F2026%2F03%2Fel-co-02.jpg&w=1024&q=75&fm=avif",
        "placeholder": "/.netlify/images?url=https%3A%2F%2Felcaminoskateshop.wordpress.com%2Fwp-content%2Fuploads%2F2026%2F03%2Fel-co-02.jpg&w=40&q=20&fm=avif",
        "sizes": "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
        "webp": "/.netlify/images?url=https%3A%2F%2Felcaminoskateshop.wordpress.com%2Fwp-content%2Fuploads%2F2026%2F03%2Fel-co-02.jpg&w=1024&q=68&fm=webp",
      }
    `);
  });
});
