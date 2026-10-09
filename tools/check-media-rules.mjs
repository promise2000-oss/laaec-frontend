// Compares the @media blocks in an origin capture's <style> with the generated
// page stylesheet: every inner rule of the origin must appear (scoped) in the
// output, and every @media prelude must be present. Diagnostic only.
import fs from 'node:fs';

const ROOT = 'C:/Users/USER/Documents/laaec-audit';
const PAGES = {
  admin: ['admin.html', 'admin-page.css'],
  ca: ['ca.html', 'ca-page.css'],
  ict: ['ict.html', 'ict-page.css'],
  comm: ['comm.html', 'comm-page.css'],
};
const page = process.argv[2] || 'admin';
const [srcName, outName] = PAGES[page];
if (!srcName) throw new Error(`unknown page ${page}`);

const html = fs.readFileSync(`${ROOT}/origin-pages/${srcName}`, 'utf8');
const css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
const gen = fs.readFileSync(`${ROOT}/src/styles/${outName}`, 'utf8');

/** Top-level chunks of a stylesheet, at-rules kept whole. */
const splitTopLevel = (source) => {
  const out = [];
  let depth = 0;
  let buf = '';
  for (const ch of source) {
    buf += ch;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        out.push(buf.trim());
        buf = '';
      }
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
};

const innerSelectors = (source) =>
  splitTopLevel(source)
    .filter((c) => !c.startsWith('@keyframes'))
    .map((c) => c.slice(0, c.indexOf('{')).trim())
    .flatMap((p) => p.split(',').map((s) => s.trim()))
    .filter(Boolean);

let checked = 0;
const missing = [];
for (const chunk of splitTopLevel(css)) {
  if (!chunk.startsWith('@media') && !chunk.startsWith('@supports')) continue;
  const prelude = chunk.slice(0, chunk.indexOf('{')).trim();
  if (!gen.includes(prelude)) {
    missing.push(`${prelude} — prelude absent`);
    continue;
  }
  for (const sel of innerSelectors(chunk.slice(chunk.indexOf('{') + 1, chunk.lastIndexOf('}')))) {
    checked++;
    const tail = sel.replace(/^html,?\s*/, '').replace(/^body\.?/, '').replace(/^:root$/, '');
    const bare = tail.replace(/^[a-z]+\s+/, '').trim();
    if (!bare) continue;
    // the generated file prefixes page selectors; compare the last compound
    if (!gen.includes(bare)) missing.push(`${prelude} → ${sel}`);
  }
}
console.log(`${page}: ${checked} media-rule selectors checked, ${missing.length} missing`);
for (const m of missing.slice(0, 25)) console.log('  MISSING:', m);
