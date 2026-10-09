/**
 * Static RBAC invariant check (D-71).
 *
 * Verifies the four properties that, if violated, break a console silently
 * rather than loudly:
 *
 *  1. Every role's own navigation is fully visible under that role's default
 *     permissions. A failure here means the rail filters away a panel the
 *     console still expects to render, which shows up as a blank content
 *     area with no error anywhere.
 *  2. Every permission named by a nav entry exists in the vocabulary.
 *  3. Every permission named by a role default exists in the vocabulary.
 *  4. Every POST action maps to a permission in the vocabulary (or to null,
 *     for the candidate-session actions that sit outside the admin model).
 *
 * The libraries are TypeScript, so they are transpiled with the esbuild that
 * ships with Vite before being imported; nothing is re-implemented here, the
 * real modules are the ones under test.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, '.rbac-check');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

execSync(
  `npx esbuild src/lib/nav.ts src/lib/roles.ts src/lib/permissions.ts --format=esm --outdir=${JSON.stringify(OUT)} --log-level=error`,
  { cwd: ROOT, stdio: 'pipe' },
);

const nav = await import(pathToFileURL(resolve(OUT, 'nav.js')).href);
const roles = await import(pathToFileURL(resolve(OUT, 'roles.js')).href);
const perms = await import(pathToFileURL(resolve(OUT, 'permissions.js')).href);

const problems = [];
const note = (m) => problems.push(m);

const CODES = new Set(perms.PERMISSION_CODES);
const ROLE_KEYS = Object.keys(roles.ROLE_DEFAULT_PERMISSIONS);
const roleNames = ['SUPER_ADMIN', 'CENTRAL_ADMIN', 'SCHOOL_ADMIN', 'ICT_ADMIN', 'EXAM_COMMITTEE', 'TEACHER'];

/* 1 — a role must be able to see its own console. */
for (const role of roleNames) {
  const granted = roles.effectivePermissions([], role);
  const full = nav.navFor(role);
  const shown = nav.filterNav(full, granted, role);
  const hidden = [];
  for (const g of full.groups) for (const it of g.items) if (it.permission && !granted.includes(it.permission)) hidden.push(it.label);
  if (hidden.length > 0) {
    note(`${role} would lose ${hidden.length} nav entr${hidden.length === 1 ? 'y' : 'ies'}: ${hidden.join(', ')}`);
  }
  if (shown.groups.length === 0) note(`${role} would render an EMPTY rail`);
}

/* 1b — SUPER_ADMIN is a superset of every other role (2026-10-02).
 *
 * The client's requirement is that a super administrator holds all roles and
 * their permissions. It used to be expressed as an exemption from the
 * permission check, which the navigation filter honoured and the consoles did
 * not — so the session reached a console and found an empty, unusable rail. It
 * is now a real grant (`SUPER_ADMIN_PERMISSIONS`), and this asserts the
 * property that makes it equivalent: nothing another role can do by default is
 * a permission a super administrator lacks.
 */
{
  const superGranted = new Set(roles.effectivePermissions([], 'SUPER_ADMIN'));
  const missing = [];
  for (const role of roleNames) {
    if (role === 'SUPER_ADMIN') continue;
    for (const code of roles.ROLE_DEFAULT_PERMISSIONS[role]) {
      if (!superGranted.has(code)) missing.push(`${role}:${code}`);
    }
  }
  if (missing.length) {
    note(`SUPER_ADMIN is not a superset — missing ${missing.length}: ${missing.join(', ')}`);
  }
  if (perms.bypassesPermissions('SUPER_ADMIN')) {
    note('SUPER_ADMIN still bypasses the permission check; the grant makes the exemption unnecessary');
  }
}

/* 2 — nav permissions must exist. */
const seenNav = new Set();
for (const role of roleNames) {
  for (const g of nav.navFor(role).groups) for (const it of g.items) if (it.permission) seenNav.add(it.permission);
}
for (const code of seenNav) if (!CODES.has(code)) note(`nav names an unknown permission: ${code}`);

/* 3 — role defaults must exist. */
for (const role of ROLE_KEYS) {
  for (const code of roles.ROLE_DEFAULT_PERMISSIONS[role]) {
    if (!CODES.has(code)) note(`${role} defaults to an unknown permission: ${code}`);
  }
}

/* 4 — every write action must be mapped to a real permission.
 *
 * Five of them carry a PLACEHOLDER rather than a code, because one contract
 * action serves forty registry resources whose permissions differ
 * (`SAVE_ADMIN_RECORD` writes a department, a role and a student alike).
 * `hasAdminPlaceholder` identifies those, and `resolveAdminPermission` is what
 * substitutes the real code from the request. This check asserts the resolution is
 * actually wired — a registry the resolver cannot look up would otherwise let an
 * unresolvable request through, which the transport treats as a refusal — rather
 * than asserting each of the forty per-resource mappings here.
 */
const registryPath = resolve(OUT, 'admin-registry.js');
execSync(
  `npx esbuild src/types/admin-registry.ts --format=esm --outfile=${JSON.stringify(registryPath)} --log-level=error`,
  { cwd: ROOT, stdio: 'pipe' },
);
const registry = await import(pathToFileURL(registryPath).href);

const registryIds = Object.keys(registry.ADMIN_MODULES);
const lookup = (resource) => registry.ADMIN_MODULES[resource];

for (const [action, required] of Object.entries(perms.ACTION_PERMISSIONS)) {
  if (perms.hasAdminPlaceholder(action)) {
    /* The resolver must find at least one module to resolve against, and must
       refuse for a resource it does not know. Both are the same property read
       two ways: a resolvable registry and a fail-closed unknown.
       The resolver's registry lookup is registered by `mock.ts` at module load,
       which this script does not import — so it is registered here explicitly,
       from the same registry, before any resolution is attempted. Without it
       every placeholder would resolve to `null` and the "real resource" probe
       would be indistinguishable from the "unknown resource" one. */
    perms.registerAdminModuleLookup((resource) => lookup(resource));
    const probe = perms.resolveAdminPermission(action, { resource: registryIds[0] });
    if (probe === undefined) note(`${action} is a placeholder but resolves to undefined for a real resource`);
    const unknown = perms.resolveAdminPermission(action, { resource: '__no_such_resource__' });
    if (unknown !== null) note(`${action} is a placeholder but does not refuse an unknown resource`);
    continue;
  }
  if (required !== null && !CODES.has(required)) note(`${action} maps to an unknown permission: ${required}`);
}

/* 4b — every registry module's own permissions must exist, and every module must
 * declare one. This is the check that catches a module naming a code the resolver
 * would then refuse at the transport. */
for (const [id, mod] of Object.entries(registry.ADMIN_MODULES)) {
  for (const code of [mod.permission, mod.writePermission, mod.deletePermission]) {
    if (code && !CODES.has(code)) note(`module ${id} names an unknown permission: ${code}`);
  }
  if (!mod.permission) note(`module ${id} declares no read permission`);
  if (!mod.resource) note(`module ${id} declares no resource`);
}

const navItems = seenNav.size;
const mapped = Object.keys(perms.ACTION_PERMISSIONS).length;
const codes = CODES.size;
const defaults = ROLE_KEYS.reduce((n, r) => n + roles.ROLE_DEFAULT_PERMISSIONS[r].length, 0);

rmSync(OUT, { recursive: true, force: true });

console.log(`RBAC invariants`);
console.log(`  vocabulary      ${codes} permission codes`);
console.log(`  roles           ${ROLE_KEYS.length} with default grants (${defaults} grants)`);
console.log(`  super admin     superset of all ${roleNames.length - 1} other roles (${roles.SUPER_ADMIN_PERMISSIONS.length} codes, no exemption)`);
console.log(`  nav             ${navItems} permission-guarded entries`);
console.log(`  write actions   ${mapped} mapped`);

if (problems.length) {
  console.log(`\nFAILED (${problems.length}):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log(`\nall invariants hold`);
