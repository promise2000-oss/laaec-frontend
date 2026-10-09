/*
 * tools/map-layers.mjs — one-shot codemod (kept for auditability).
 *
 * Rewrites every bare `z-index: <n>` in src/ into its layers.css token, chosen
 * from the *owning selector* so context survives: a 1200 on `.back-to-top` and
 * a 900 on `.result-scroll-btn` both mean furniture, while a 1000 on
 * `.nav-container` means a sticky banner.
 *
 * Re-runnable: declarations already using var() are skipped.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');

/**
 * Resolve the full selector of the rule owning line `i`, including every
 * comma-continued selector line. Returns '' when no rule opener is found and
 * 'KEYFRAME' when the declaration sits inside @keyframes (never tokenise).
 */
function owningSelector(lines, i) {
  for (let j = i; j >= 0; j--) {
    const t = lines[j].trimEnd();
    if (!t.endsWith('{')) continue;

    // gather comma-continued selector lines above the opener
    const parts = [lines[j]];
    for (let k = j - 1; k >= 0 && lines[k].trimEnd().endsWith(','); k--) {
      parts.unshift(lines[k]);
      if (parts.length > 8) break;
    }
    const sel = parts.join(' ').trim();
    if (/^(from|to|\d+(\.\d+)?%)\s*\{/.test(sel)) return 'KEYFRAME';
    return sel;
  }
  return '';
}

/** selector-substring checks first (value alone is ambiguous), then by value. */
function tokenFor(selector, value) {
  const sel = selector.replace(/\s+/g, ' ');

  if (value === 'auto') return null; // "no stacking context" — not a layer

  // An alert must outrank a loading overlay. When one rule styles both, the
  // alert wins by DOM order, so classifying it as modal preserves the tie.
  if (/custom-alert/.test(sel)) return '--z-modal';
  if (/loading-overlay/.test(sel)) return '--z-loading';
  if (/identity-popup|laec-alert-overlay|modal-overlay|start-overlay/.test(sel)) return '--z-modal';

  if (/nav-container/.test(sel)) return '--z-sticky';
  if (/back-to-top|result-scroll-btn/.test(sel)) return '--z-furniture';
  if (/page-header/.test(sel)) return '--z-sticky';
  if (/question-actions-top/.test(sel)) return '--z-sticky-sm';
  if (/\.app-rail/.test(sel)) return '--z-rail';
  if (/\.app-topbar/.test(sel)) return '--z-topbar';
  if (/account-menu|bell-panel/.test(sel)) return '--z-dropdown';
  if (/app-scrim/.test(sel)) return '--z-scrim';

  const table = {
    '-3': '--z-under',
    '-2': '--z-under-near',
    '0': '--z-base',
    '1': '--z-content',
    '2': '--z-content-lift',
    '20': '--z-sticky-sm',
    '400': '--z-sticky',
    '500': '--z-furniture',
    '550': '--z-topbar',
    '590': '--z-scrim',
    '600': '--z-rail',
    '700': '--z-dropdown',
    '900': '--z-furniture',
    '1000': '--z-sticky',
    '1200': '--z-furniture',
    '2000': '--z-loading',
    '5000': '--z-modal',
    '8000': '--z-modal',
    '9000': '--z-modal',
    '9999': '--z-modal',
    '10000': '--z-modal',
    '10001': '--z-modal',
  };
  return table[value] ?? null;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(vue|css)$/.test(e.name) ? [p] : [];
  });
}

let changed = 0;
let untouched = 0;

for (const file of walk(ROOT)) {
  if (file.endsWith('layers.css')) continue;
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  let dirty = false;

  for (let i = 0; i < lines.length; i++) {
    if (/^\s*z-index:\s*var\(/.test(lines[i])) continue; // already done

    /*
     * Three real shapes occur in this codebase:
     *   1. `  z-index: 700;`            — own line
     *   2. `  z-index: 5000;\r`         — CRLF files (these pages are mixed
     *                                     CRLF/LF, so `$` alone never matched)
     *   3. `...; z-index: 9999; ...`    — shares its line with siblings
     * The lazy prefix handles all three; the CR is captured so it is put back.
     */
    const m = lines[i].match(/^([\s\S]*?)z-index:\s*(-?\d+)\s*;([^\r\n]*)(\r?)$/);
    if (!m) {
      if (/z-index:\s*(auto|var\()/.test(lines[i])) untouched++;
      continue;
    }

    const selector = owningSelector(lines, i);
    if (selector === 'KEYFRAME') {
      console.warn(`  ~ ${file}:${i + 1}  keyframe z-index left alone`);
      untouched++;
      continue;
    }

    const token = tokenFor(selector, m[2]);
    if (!token) {
      console.warn(
        `  ! ${file}:${i + 1}  no rule for ${m[2]} in ${selector.replace(/\s+/g, ' ').slice(0, 70)}`,
      );
      untouched++;
      continue;
    }

    lines[i] = `${m[1]}z-index: var(${token});${m[3]}${m[4]}`;
    dirty = true;
    changed++;
  }

  if (dirty) fs.writeFileSync(file, lines.join('\n'));
}

console.log(`mapped ${changed} declarations, left ${untouched} untouched`);
