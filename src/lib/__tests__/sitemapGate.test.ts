import { describe, it, expect } from 'vitest';
import { shouldFetchSitemapPages, sitemapFailureIsFatal } from '../sitemapGate';

const astro = (command: string) => [
  'node',
  '/x/node_modules/.bin/astro',
  command,
];

describe('shouldFetchSitemapPages', () => {
  it('fetches for astro build', () => {
    expect(shouldFetchSitemapPages(astro('build'), {})).toBe(true);
  });

  it.each(['check', 'dev', 'preview', 'sync'])(
    'does not fetch for astro %s',
    (command) => {
      expect(shouldFetchSitemapPages(astro(command), {})).toBe(false);
    }
  );

  it('does not fetch under Vitest, whatever the arguments', () => {
    expect(
      shouldFetchSitemapPages(['node', 'vitest', 'run', 'build'], {
        VITEST: 'true',
      })
    ).toBe(false);
  });
});

describe('sitemapFailureIsFatal', () => {
  it('fails a Netlify production deploy', () => {
    expect(sitemapFailureIsFatal({ CONTEXT: 'production' })).toBe(true);
  });

  it.each(['deploy-preview', 'branch-deploy', 'dev'])(
    'falls back to an empty list on a %s build',
    (context) => {
      expect(sitemapFailureIsFatal({ CONTEXT: context })).toBe(false);
    }
  );

  it('falls back on a local build', () => {
    expect(sitemapFailureIsFatal({})).toBe(false);
  });

  it('can be overridden for a production deploy', () => {
    expect(
      sitemapFailureIsFatal({
        CONTEXT: 'production',
        SITEMAP_ALLOW_EMPTY: 'true',
      })
    ).toBe(false);
  });
});
