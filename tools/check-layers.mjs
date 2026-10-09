/*
 * tools/check-layers.mjs — enforces the stacking contract declared in
 * src/styles/layers.css (D-74).
 *
 * Two invariants:
 *   1. Every numeric `z-index` in src/ is a reference to a layers.css token.
 *      `z-index: auto` and `z-index: var(--z-*)` are the only other forms
 *      permitted — `auto` means "no stacking context", which is not a layer.
 *   2. The tokens in layers.css are strictly ascending, so no two layers can
 *      silently collide.
 *
 * Writes .rbac-check-style state to .layer-check for CI/agent inspection.
 * Exit code 1 on any violation.
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(process.cwd(), 'src');
const LAYERS = path.join(SRC, 'styles', 'layers.css');

/** declared token values, in file order */
const declared = [];
for (const m of fs.readFileSync(LAYERS, 'utf8').matchAll(/(--z-[a-z-]+):\s*(-?\d+)\s*;/g)) {
  declared.push({ token: m[1], value: Number(m[2]) });
}

const errors = [];

// ── invariant 2: strictly ascending ─────────────────────────────────────────
for (let i = 1; i < declared.length; i++) {
  if (declared[i].value <= declared[i - 1].value) {
    errors.push(
      `layers.css not ascending: ${declared[i].token} (${declared[i].value}) ` +
        `does not sit above ${declared[i - 1].token} (${declared[i - 1].value})`,
    );
  }
}

// ── invariant 1: no bare numeric z-index outside layers.css ─────────────────
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(vue|css)$/.test(e.name) && !p.endsWith('layers.css') ? [p] : [];
  });
}

let scanned = 0;
let tokens = 0;
let autos = 0;

for (const file of walk(SRC)) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/z-index:\s*([^;]+);/);
    if (!m) return;
    scanned++;
    /* `var(--z-…) !important` is a legitimate form: AppAlert/AppLoading need
       `!important` to outrank the transcribed origin stylesheets, which is the
       same documented exception AppShell uses for its page-box reset. The
       invariant is "the value must be a token", not "the value must be alone". */
    const value = m[1].replace('!important', '').trim();
    if (value === 'auto') {
      autos++;
      return;
    }
    const varMatch = value.match(/^var\((--z-[a-z-]+)\)$/);
    if (varMatch) {
      tokens++;
      if (!declared.some((d) => d.token === varMatch[1])) {
        errors.push(`${path.relative(SRC, file)}:${i + 1}  unknown token ${varMatch[1]}`);
      }
      return;
    }
    errors.push(
      `${path.relative(SRC, file)}:${i + 1}  bare z-index: ${value} — ` +
        `must be var(--z-…) (see src/styles/layers.css) or \`auto\``,
    );
  });
}

const state = {
  tokensDeclared: declared.length,
  ascending: errors.every((e) => !e.startsWith('layers.css not ascending')),
  zIndexDeclarations: scanned,
  tokenised: tokens,
  auto: autos,
  violations: errors.length,
};
fs.writeFileSync(path.resolve(process.cwd(), '.layer-check'), JSON.stringify(state, null, 2));

if (errors.length) {
  console.error('Layer contract violated:\n');
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error(`\n${errors.length} violation(s).`);
  process.exit(1);
}

console.log('Layer contract');
console.log(`  tokens     ${declared.length} declared, strictly ascending`);
console.log(`  z-index    ${scanned} declarations — ${tokens} tokenised, ${autos} \`auto\``);
console.log('\nall layer invariants hold');
