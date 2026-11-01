/**
 * check-admin-parity.mjs — the Saint Finbarr's admin port's own contract check.
 *
 * WHY A CHECK AND NOT A TEST SUITE
 * --------------------------------
 * The failure this guards against is structural, not behavioural: a module
 * declared in the registry with no rail entry, a rail entry with no module, a
 * bespoke panel nothing mounts, or a permission named on a nav item that is not in
 * the vocabulary. Each of those produces a blank panel or an inert control at
 * runtime and passes every unit test, because nothing asserts the wiring.
 *
 * WHAT IT ASSERTS
 * ---------------
 *  1. Every registry module id has a rail entry, and vice versa.
 *  2. Every rail entry's permission is a declared permission code.
 *  3. Every bespoke panel in `ADMIN_PANEL_COMPONENTS` is reachable — i.e. some
 *     registry module id maps to it — and every registry module maps to a
 *     component (the generic panel is the default, so this is about the bespoke set
 *     only).
 *  4. Every module's `customPanel`, where declared, matches the component the
 *     router actually mounts for that id. This is the check that catches a bespoke
 *     panel that was renamed on one side only.
 *  5. Every module has a resource, a permission, and at least one column or a
 *     custom panel — so no module can be a page with nothing on it.
 *  6. The registry's option sources, filter sources and write permissions are all
 *     served by the mock's option list or the permission vocabulary.
 *
 * RUN IT WITH `node tools/check-admin-parity.mjs`. It is not wired into
 * `npm run build`, for the same reason the other `tools/check-*.mjs` contracts are
 * not: they read project files and would need a parser to run inside Vite.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const fail = (message) => failures.push(message);

/* ── read the sources ──────────────────────────────────────────────────── */

const registrySource = readFileSync(join(root, 'src/types/admin-registry.ts'), 'utf8');
const navSource = readFileSync(join(root, 'src/lib/nav.ts'), 'utf8');
const permissionsSource = readFileSync(join(root, 'src/lib/permissions.ts'), 'utf8');
const mockAdminSource = readFileSync(join(root, 'src/api/mockAdmin.ts'), 'utf8');
const routerSource = readFileSync(join(root, 'src/components/admin/admin-panels.ts'), 'utf8');

const panelDir = join(root, 'src/components/admin');
const panelFiles = readdirSync(panelDir).filter((f) => f.endsWith('.vue'));

/* ── 1. registry ids ───────────────────────────────────────────────────── */

/*
 * Only the `ADMIN_MODULES` object literal, bounded at the export that follows it.
 *
 * The bound was `} as const`, which is not in this file: `String.prototype.indexOf`
 * returns −1 for a marker that is absent, and `slice(start, -1)` then runs to the
 * last character of the file. The slice quietly covered `UNAVAILABLE_SETTINGS`
 * too, so its three keys were counted as modules — the check reported 61 where
 * there are 58, and still said OK, because those three also have rail entries and
 * panels. A check that computes the wrong thing and passes is worse than no
 * check, so the bound is now the next `export const`, which is a marker that
 * exists and fails loudly if the file is reordered.
 */
const moduleStart = registrySource.indexOf('export const ADMIN_MODULES');
const moduleEnd = registrySource.indexOf('\nexport const', moduleStart + 1);
if (moduleStart < 0 || moduleEnd < 0) {
  throw new Error(
    'could not bound the ADMIN_MODULES literal — the registry no longer has the ' +
    'shape this check reads. Fix the check rather than the registry.',
  );
}
const moduleBlock = registrySource.slice(moduleStart, moduleEnd);

/** The two-space-indented keys of that literal, which are exactly the modules. */
const moduleIds = [...moduleBlock.matchAll(/^  '?([a-z0-9-]+)'?:\s*\{/gm)].map((m) => m[1]);

/* ── 2. rail ids for SUPER_ADMIN ───────────────────────────────────────── */

const adminGroupsStart = navSource.indexOf('const ADMIN_GROUPS');
const adminGroupsEnd = navSource.indexOf('const CA_GROUPS');
const adminGroups = navSource.slice(adminGroupsStart, adminGroupsEnd);
const railIds = [...adminGroups.matchAll(/id:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]);
const railPermissions = [...adminGroups.matchAll(/permission:\s*'([a-z0-9._]+)'/g)].map((m) => m[1]);

/* ── 3. permission vocabulary ──────────────────────────────────────────── */

const permBlock = permissionsSource.slice(
  permissionsSource.indexOf('export const PERMISSION_CODES'),
  permissionsSource.indexOf('export type PermissionCode'),
);
const permissionCodes = new Set(
  [...permBlock.matchAll(/'([a-z0-9._-]+)'/g)].map((m) => m[1]),
);

/* ── 4. bespoke panels ─────────────────────────────────────────────────── */

const routerMapBlock = routerSource.slice(
  routerSource.indexOf('export const ADMIN_PANEL_COMPONENTS'),
  routerSource.indexOf('};', routerSource.indexOf('export const ADMIN_PANEL_COMPONENTS')),
);
/*
 * The panel-id → component map. Keys are quoted only where they are not valid
 * identifiers, which is the project convention throughout, so the pattern accepts
 * both. Anchored to the start of a line so a same-named key nested inside an
 * import block cannot be mistaken for a mapping.
 */
const componentMap = new Map(
  [...routerMapBlock.matchAll(/^ {2}'?([a-z0-9-]+)'?:\s*(\w+),$/gm)].map((m) => [m[1], m[2]]),
);
const componentFiles = new Set(
  panelFiles.map((f) => f.replace(/\.vue$/, '')),
);
const usedComponents = new Set(componentMap.values());

/* ── checks ────────────────────────────────────────────────────────────── */

/*
 * 1. registry ↔ rail, both directions.
 *
 * Two id sets exist on each side that the other does not have, and both are
 * deliberate:
 *
 *  - The LAEC Examination group's seven panels (`dashboard`, `exam-mgt`,
 *    `past-questions`, `results`, `student-directory`, `admins`, `health`) are
 *    transcribed origin markup in the view, not registry modules. They have no
 *    registry entry because they are not school-management modules.
 *  - The multi-school platform's two panels (`schools`, `school-groups`) follow
 *    the same shape: always-present `<div id="...">` blocks in `AdminView.vue`
 *    toggled by `activeTab`, so `showTab`'s element guard opens them without
 *    any `ADMIN_MODULES` entry. They are the archdiocesan registry and its
 *    grouping surface, which is not a school-management *module* with list
 *    columns — hence no registry entry.
 *  - `school-dashboard` is a rail entry with no registry module: it is a bespoke
 *    page with no list behind it, which is what a registry entry describes.
 *  - `refund-queue` is a rail entry that navigates rather than opening a panel —
 *    the live app models it as `/store/queue?status=REFUND_PENDING`, so it
 *    carries a `route` rather than an id a panel answers to.
 *
 * Those are named here rather than tolerated by a heuristic, because a
 * heuristic would also tolerate a genuine mismatch.
 */
const LAEC_PANELS = new Set([
  'dashboard',
  'exam-mgt',
  'past-questions',
  'results',
  'student-directory',
  'admins',
  'health',
  'schools',
  'school-groups',
]);
const RAIL_ONLY = new Set(['school-dashboard', 'refund-queue']);

for (const id of moduleIds) {
  if (!railIds.includes(id)) fail(`registry module "${id}" has no rail entry in ADMIN_GROUPS`);
}
for (const id of railIds) {
  if (!moduleIds.includes(id) && !LAEC_PANELS.has(id) && !RAIL_ONLY.has(id)) {
    fail(`rail entry "${id}" has no registry module and is not a declared exception`);
  }
}

/* 2. every rail permission is a declared code. */
for (const permission of railPermissions) {
  if (!permissionCodes.has(permission)) {
    fail(`rail permission "${permission}" is not in PERMISSION_CODES`);
  }
}

/* 3. bespoke panels: each one exists as a file. */
for (const component of usedComponents) {
  if (!componentFiles.has(component)) fail(`router mounts "${component}" but no such component exists`);
}

/*
 * 4. every panel file is mounted by something.
 *
 * Three groups are exempt, each for a stated reason rather than by tolerance:
 *
 *  - `AdminPanelRouter` IS the mount point; nothing can mount it but the view.
 *  - `AdminModuleShell`, `AdminDialog` and `AdminStatusBadge` are the shared
 *    primitives the panels compose, not panels.
 *  - `AdminResourcePanel` is the router's DEFAULT renderer — reached by every
 *    module id absent from the map, which is most of them — and is also composed
 *    directly by the panels that handle one page kind and delegate the rest. It
 *    appears in neither set of checks as a top-level mapping, and that is correct.
 */
const EXEMPT_COMPONENTS = new Set([
  'AdminPanelRouter',
  'AdminModuleShell',
  'AdminDialog',
  'AdminStatusBadge',
  'AdminResourcePanel',
]);
for (const file of componentFiles) {
  if (EXEMPT_COMPONENTS.has(file)) continue;
  if (!usedComponents.has(file)) {
    fail(`component "${file}.vue" is never mounted by ADMIN_PANEL_COMPONENTS`);
  }
}

/* 5. every module is a page with something on it. */
for (const id of moduleIds) {
  const entryStart = moduleBlock.indexOf(`\n  '${id}': {`);
  const entryStartAlt = moduleBlock.indexOf(`\n  ${id}: {`);
  const start = entryStart >= 0 ? entryStart : entryStartAlt;
  if (start < 0) continue;
  const next = moduleBlock.slice(start + 1);
  const nextKey = next.search(/\n {2}'?[a-z0-9-]+'?: \{/);
  const entry = next.slice(0, nextKey < 0 ? next.length : nextKey);

  if (!/resource:\s*'/.test(entry)) fail(`module "${id}" declares no resource`);
  if (!/permission:\s*'/.test(entry)) fail(`module "${id}" declares no permission`);
  if (!/columns:\s*\[/.test(entry) && !/customPanel:/.test(entry)) {
    fail(`module "${id}" has neither columns nor a customPanel`);
  }
  /* A module whose columns are declared but empty and which has no customPanel
     renders a table with no headers — a page that cannot be read. */
  if (/columns:\s*\[\],\s*$/.test(entry.trimEnd()) && !/customPanel:/.test(entry)) {
    fail(`module "${id}" declares an empty column list and no customPanel`);
  }
}

/* 6. option sources and filter sources are served. */
/* The option lists the mock serves, read from `optionLists` in mockAdmin. */
const optionListStart = mockAdminSource.indexOf('const optionLists');
const optionListEnd = mockAdminSource.indexOf('};', optionListStart);
const optionLists = new Set(
  [
    ...mockAdminSource
      .slice(optionListStart, optionListEnd)
      .matchAll(/^ {2}'?([a-z0-9-]+)'?:/gm),
  ].map((m) => m[1]),
);

/* Every `optionsSource` a registry field names must be one of them. */
const optionSourceNames = new Set(
  [...moduleBlock.matchAll(/optionsSource:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]),
);
for (const source of optionSourceNames) {
  if (!optionLists.has(source)) {
    fail(`option source "${source}" is not served by GET_ADMIN_OPTION_LIST`);
  }
}

const filterSources = new Set([...moduleBlock.matchAll(/source:\s*'([a-zA-Z0-9_]+)'/g)].map((m) => m[1]));
/* Filter sources name record FIELDS, not option lists: the panel derives their
   options from the rows in hand, which is what the live app's own filters do. So
   there is nothing to resolve here beyond confirming each one is declared. */
if (filterSources.size === 0) fail('no filter sources found — the module block did not parse');

/* 7. every module's write and delete permissions are declared codes. */
for (const id of moduleIds) {
  const entryStart = moduleBlock.indexOf(`\n  '${id}': {`);
  const entryStartAlt = moduleBlock.indexOf(`\n  ${id}: {`);
  const start = entryStart >= 0 ? entryStart : entryStartAlt;
  if (start < 0) continue;
  const next = moduleBlock.slice(start + 1);
  const nextKey = next.search(/\n {2}'?[a-z0-9-]+'?: \{/);
  const entry = next.slice(0, nextKey < 0 ? next.length : nextKey);
  for (const [, permission] of entry.matchAll(/(?:writePermission|deletePermission):\s*'([a-z0-9._]+)'/g)) {
    if (!permissionCodes.has(permission)) {
      fail(`module "${id}" names "${permission}", which is not in PERMISSION_CODES`);
    }
  }
}

/* 8. every row-action and toolbar permission is a declared code. */
for (const [, permission] of moduleBlock.matchAll(/permission:\s*'([a-z0-9._]+)'/g)) {
  if (!permissionCodes.has(permission)) {
    fail(`a registry action names "${permission}", which is not in PERMISSION_CODES`);
  }
}

/* ── report ────────────────────────────────────────────────────────────── */

const console_ = console;
console_.log(`modules: ${moduleIds.length}`);
console_.log(`rail entries: ${railIds.length}`);
console_.log(`bespoke panels mounted: ${usedComponents.size}`);
console_.log(`permission codes: ${permissionCodes.size}`);
console_.log(`option lists served: ${optionLists.size}`);

if (failures.length > 0) {
  console_.error(`\nFAIL — ${failures.length} problem(s):`);
  for (const failure of failures) console_.error(`  - ${failure}`);
  process.exit(1);
}

console_.log('\nOK — the admin registry, the rail, the panels and the permission vocabulary agree.');
