/*
 * tools/check-doors.mjs — enforces that the seven portal doors are declared
 * once and wired everywhere they have to be (2026-10-02).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * A door is a login page under /login/<role>/. Nothing forces the four places
 * that must agree to agree:
 *
 *   1. src/lib/portals.ts        — the door itself (label, role, path)
 *   2. src/router/index.ts       — the route that serves it
 *   3. vite.config.ts            — the HTML document the build emits for it
 *   4. src/router/index.ts       — BODY_CLASS, the <body> classes on navigation
 *   5. login/<slug>/index.html   — the document on disk
 *
 * A door added to (1) alone builds cleanly and then 404s when a portal card
 * links to it. A door added to (3) alone builds a document nothing routes to.
 * Neither is a compile error, so neither is caught by `vue-tsc`.
 *
 * THE INVARIANT
 * -------------
 * The staff slugs in `lib/portals.ts` and the slugs the router, the build and
 * the filesystem know about are the same set — and each one's body class
 * carries `page-control-door`, without which the switcher cannot sit under the
 * card (see styles/glass.css).
 *
 * Exit code 1 on any violation. Writes .door-check for CI/agent inspection.
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(process.cwd(), 'src');
const PORTALS = path.join(SRC, 'lib', 'portals.ts');
const ROUTER = path.join(SRC, 'router', 'index.ts');
const VITE = path.resolve(process.cwd(), 'vite.config.ts');

const read = (p) => fs.readFileSync(p, 'utf8');
const errors = [];

/* ── 1. the doors, from portals.ts ────────────────────────────────────────────
 * Parsed rather than imported: this file runs before any build, in plain
 * Node, and portals.ts is TypeScript. The Staff portals literal is the only
 * place slugs, paths and roles are written, so a regex over it is exact. */
const portalSrc = read(PORTALS);
const STAFF_BLOCK = portalSrc.slice(
  portalSrc.indexOf('export const STAFF_PORTALS'),
  portalSrc.indexOf('/** All seven doors'),
);

const doors = [];
for (const m of STAFF_BLOCK.matchAll(
  /slug:\s*'([a-z]+)',\s*\n\s*path:\s*'\/login\/([a-z]+)\/',\s*\n\s*role:\s*'([A-Z_]+)'/g,
)) {
  const [, slug, pathSlug, role] = m;
  if (slug !== pathSlug) {
    errors.push(`portals.ts: slug '${slug}' does not match its path segment '${pathSlug}'`);
  }
  doors.push({ slug, role, route: `/login/${slug}/`, name: `login-${slug}` });
}

if (!doors.length) {
  errors.push('portals.ts: no staff doors found — has STAFF_PORTALS been renamed or emptied?');
}

/** Every staff role must be claimed by exactly one door. */
const roles = new Set(doors.map((d) => d.role));
for (const expected of [
  'SUPER_ADMIN',
  'CENTRAL_ADMIN',
  'SCHOOL_ADMIN',
  'ICT_ADMIN',
  'EXAM_COMMITTEE',
  'TEACHER',
]) {
  if (!roles.has(expected)) errors.push(`portals.ts: no door claims the role ${expected}`);
}
if (roles.size !== doors.length) {
  errors.push(`portals.ts: two doors claim the same role (${doors.length} doors, ${roles.size} roles)`);
}

/* ── 2/3. the router routes and the build inputs ─────────────────────────── */
const routerSrc = read(ROUTER);
const viteSrc = read(VITE);

for (const door of doors) {
  // The router generates its routes from ROLE_PORTALS, so its *name* is what
  // has to be right — it must reach BODY_CLASS and the switcher.
  if (!routerSrc.includes(`'${door.name}':`)) {
    errors.push(
      `router/index.ts: no BODY_CLASS entry for '${door.name}' — the door would render ` +
        `on <body> without page-control-door, so its switcher cannot sit under the card.`,
    );
  }

  if (!viteSrc.includes(`entry('./login/${door.slug}/index.html')`)) {
    errors.push(
      `vite.config.ts: no build input for '${door.slug}' — the document would not be ` +
        `emitted and a direct visit to ${door.route} would 404.`,
    );
  }
}

/* ── 4. the documents on disk ────────────────────────────────────────────── */
for (const door of doors) {
  const file = path.resolve(process.cwd(), 'login', door.slug, 'index.html');
  if (!fs.existsSync(file)) {
    errors.push(`login/${door.slug}/index.html: missing — vite.config.ts declares a build input for it.`);
    continue;
  }
  const html = read(file);
  if (!html.includes('page-control-door')) {
    errors.push(`login/${door.slug}/index.html: <body> is missing page-control-door.`);
  }
  if (!html.includes('/src/main.ts')) {
    errors.push(`login/${door.slug}/index.html: does not mount the app.`);
  }
}

/* ── report ──────────────────────────────────────────────────────────────── */
const state = {
  doors: doors.length,
  roles: [...roles].sort(),
  errors: errors.length,
};
fs.writeFileSync(path.resolve(process.cwd(), '.door-check'), JSON.stringify(state, null, 2));

if (errors.length) {
  console.error('Portal door contract violated:\n');
  for (const e of errors) console.error(`  x ${e}`);
  console.error(`\n${errors.length} violation(s).`);
  process.exit(1);
}

console.log('Portal door contract');
console.log(`  doors      ${doors.length} — ${doors.map((d) => d.slug).join(', ')}`);
console.log(`  roles      ${state.roles.length} claimed, one door each`);
console.log('  wired      routes, body classes, build inputs and documents all agree');
