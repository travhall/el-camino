// @vitest-environment node
/**
 * Build-minute budget. scripts/netlify-ignore.sh decides whether Netlify builds a
 * deploy: exit 0 skips, any other exit builds. Rules:
 *   - docs-only changes (plans/, docs/, markdown) never build;
 *   - PR deploy previews and branch deploys build only when the head commit's
 *     message contains [preview], so a push is not a build by default;
 *   - production (the staging site's master) builds as before;
 *   - any doubt builds (the script cannot read the commit: build).
 * Each test runs the real script in a throwaway git repo with Netlify's env vars.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const script = resolve(__dirname, '../../scripts/netlify-ignore.sh');
let repo: string;
let base: string; // the "last built" commit (CACHED_COMMIT_REF)

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();

function commit(files: Record<string, string>, message: string): string {
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(repo, path, '..'), { recursive: true });
    writeFileSync(join(repo, path), body);
  }
  git('add', '-A');
  git('commit', '-q', '-m', message);
  return git('rev-parse', 'HEAD');
}

/** Exit code the script returns for a deploy of `head` in `context`. */
function run(context: string, head: string, cached = base): number {
  const result = spawnSync('sh', [script], {
    cwd: repo,
    env: {
      PATH: process.env.PATH,
      CONTEXT: context,
      COMMIT_REF: head,
      CACHED_COMMIT_REF: cached,
    },
  });
  return result.status ?? -1;
}

const SKIP = 0;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'netlify-ignore-'));
  git('init', '-q');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 't');
  git('config', 'commit.gpgsign', 'false');
  base = commit({ 'src/a.ts': 'a' }, 'base');
});

afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe('scripts/netlify-ignore.sh', () => {
  it('production builds a source change', () => {
    const head = commit({ 'src/b.ts': 'b' }, 'feat: change');
    expect(run('production', head)).not.toBe(SKIP);
  });

  it('production skips a docs-only change', () => {
    const cached = git('rev-parse', 'HEAD');
    const head = commit(
      { 'plans/README.md': 'x', 'docs/adr/1.md': 'y', 'NOTES.md': 'z' },
      'docs: notes'
    );
    expect(run('production', head, cached)).toBe(SKIP);
  });

  describe('deploy previews are opt-in', () => {
    it('skips a source change without [preview]', () => {
      const cached = git('rev-parse', 'HEAD');
      const head = commit({ 'src/c.ts': 'c' }, 'feat: another change');
      expect(run('deploy-preview', head, cached)).toBe(SKIP);
    });

    it('builds a source change whose message has [preview]', () => {
      const cached = git('rev-parse', 'HEAD');
      const head = commit({ 'src/d.ts': 'd' }, 'feat: measure it [preview]');
      expect(run('deploy-preview', head, cached)).not.toBe(SKIP);
    });

    it('[preview] does not build a docs-only change', () => {
      const cached = git('rev-parse', 'HEAD');
      const head = commit({ 'plans/N.md': 'n' }, 'docs: note [preview]');
      expect(run('deploy-preview', head, cached)).toBe(SKIP);
    });

    it('only the head commit counts, not earlier ones in the push', () => {
      const cached = git('rev-parse', 'HEAD');
      commit({ 'src/e.ts': 'e' }, 'wip [preview]');
      const head = commit({ 'src/f.ts': 'f' }, 'fix: later commit');
      expect(run('deploy-preview', head, cached)).toBe(SKIP);
    });

    it('branch deploys follow the same rule', () => {
      const cached = git('rev-parse', 'HEAD');
      const plain = commit({ 'src/g.ts': 'g' }, 'feat: plain');
      expect(run('branch-deploy', plain, cached)).toBe(SKIP);
      const tagged = commit({ 'src/h.ts': 'h' }, 'feat: tagged [preview]');
      expect(run('branch-deploy', tagged, plain)).not.toBe(SKIP);
    });
  });

  describe('any doubt builds', () => {
    it('a preview whose commit cannot be read builds', () => {
      expect(run('deploy-preview', 'not-a-commit')).not.toBe(SKIP);
    });

    it('a missing cached commit builds', () => {
      const head = commit({ 'src/i.ts': 'i' }, 'feat: i');
      expect(run('production', head, 'not-a-commit')).not.toBe(SKIP);
    });
  });
});
