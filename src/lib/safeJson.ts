// JSON for an inline <script> tag.
//
// JSON.stringify output is safe as JavaScript but not as HTML: it leaves "<"
// alone, so a value containing "</script>" closes the tag it was written into
// and the rest is parsed as markup. Structured data and inline JSON on this
// site are built from product names, post titles and admin settings, so a
// stray angle bracket would break the page and a compromised catalog or CMS
// account would turn it into script injection.
//
// Escaping "<" as \u003c keeps the text valid JSON (and valid JavaScript) that
// parses back to the same value. U+2028 and U+2029 are escaped too: they are
// legal inside a JSON string but end a line in older JavaScript parsers.
//
// Use this for every `set:html` into a <script>. A test in
// src/lib/__tests__/safeJson.test.ts fails if a raw JSON.stringify sink
// reappears.

export function safeJsonForScript(value: unknown): string {
  // JSON.stringify(undefined) is undefined, which set:html would render as
  // nothing or as the text "undefined"; "null" is at least valid JSON.
  const json = JSON.stringify(value) ?? 'null';
  return json
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
