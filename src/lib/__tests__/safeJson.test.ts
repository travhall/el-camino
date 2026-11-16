import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { safeJsonForScript } from '../safeJson';

describe('safeJsonForScript', () => {
  it('leaves no "<" for the HTML parser to act on', () => {
    const out = safeJsonForScript({
      name: '</script><script>alert(1)</script>',
    });
    expect(out).not.toContain('<');
    expect(out).not.toContain('</script>');
  });

  it('round-trips through JSON.parse unchanged', () => {
    const value = {
      name: '</script><!-- <b>Deck</b> & "quotes"',
      nested: [1, null, { ok: true }],
      separators: 'a\u2028b\u2029c',
    };
    expect(JSON.parse(safeJsonForScript(value))).toEqual(value);
  });

  it('escapes the two line separators that end a JavaScript string', () => {
    const out = safeJsonForScript('a\u2028b\u2029c');
    expect(out).not.toContain('\u2028');
    expect(out).not.toContain('\u2029');
  });

  it('serializes plain values like JSON.stringify', () => {
    expect(safeJsonForScript({ a: 1, b: 'x' })).toBe('{"a":1,"b":"x"}');
    expect(safeJsonForScript([])).toBe('[]');
  });

  it('gives "null" for undefined instead of the text "undefined"', () => {
    expect(safeJsonForScript(undefined)).toBe('null');
  });
});

// JSON.stringify does not escape "<", so writing its output into a <script>
// tag with set:html lets a value containing "</script>" end the tag early.
// Every such sink must go through safeJsonForScript instead.
describe('inline JSON script tags', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith('.astro')) files.push(full);
    }
  };
  walk(join(process.cwd(), 'src'));

  it('never write raw JSON.stringify output with set:html', () => {
    const offenders = files.filter((file) =>
      /set:html=\{\s*JSON\.stringify\(/.test(readFileSync(file, 'utf8'))
    );
    expect(offenders).toEqual([]);
  });
});
