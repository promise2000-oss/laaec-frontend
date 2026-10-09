# Implementation plan — what was preserved, what was added, and in what order

Labels are per `README.md`.

## The decision that shapes everything else

**The live portal is a full school management system, not an examination portal
with extra pages.** 14 modules, 131 routes, 33 roles, 180 permission codes. Its
overlap with this project is three things: results, users and roles. **OBSERVED**

So there were two plausible shapes:

| | Option A: merge into the LAEC consoles | Option B: extend the Super Admin console |
|---|---|---|
| What | Fold each module into `/ca/`, `/teacher/`, `/comm/` as new panels | Add the modules to `/admin/` alongside the existing exam panels |
| Cost | Every one of the six consoles grows; the rail for each role changes | One console grows |
| Risk | A school admin's console becomes unrecognisable; the LAEC role model and the school role model are different axes and would have to be reconciled in six places | `/admin/` becomes large |
| Precedent | — | The teacher portal was added to `/teacher/` the same way (D-72) |

**Option B was taken.** The seven pre-existing `/admin/` panels keep their ids,
their markup and their behaviour; the Saint Finbarr's modules are added beside
them in the same rail. The one id change was `students` → `student-directory` on
the LAEC side, because the Saint Finbarr's module already wanted `students` and
two panels cannot share an id in one rail.

The seven LAEC panels are carried through verification as a **regression pass**,
so "we did not break them" is a checked claim rather than an assumption.

## What was preserved

| Thing | How it was preserved |
|---|---|
| The 7 LAEC `/admin/` panels | Untouched. Their ids, markup and ids-in-JS are unchanged. `AdminView` mounts the new panels *before* them, so the origin's own DOM sequence is intact. |
| All 6 LAEC consoles | Untouched. `src/components/teacher/*` and the `/ca/`, `/ict/`, `/comm/`, `/central/`, `/exam/` views were not edited. |
| The LAEC permission vocabulary | Untouched. `src/lib/permissions.ts` gained 98 codes; no existing code changed meaning. |
| The role model | Untouched, except that `bypassesPermissions` no longer exempts SUPER_ADMIN. |
| The route guard | Untouched in shape. `/admin/` still admits SUPER_ADMIN only; the other five consoles keep their own claim. |
| The API contract | Additive. 42 actions were added to a 163-action map; none changed shape. |

## What was added

| Layer | File | What |
|---|---|---|
| Types | `src/types/admin.ts` | The module-specific shapes (wallet, attendance sheet, fee, result entry, audit log) |
| Registry | `src/types/admin-registry.ts` | 58 modules as data; 33 seed roles; the permission-module catalogue; the three unavailable-settings entries |
| Contract | `src/api/contract.ts` | 42 actions (17 reads, 25 writes) |
| Mock | `src/api/mockAdmin.ts` | Seed data for every list, and a handler per action |
| Permissions | `src/lib/permissions.ts` | +98 codes, three sentinels and their resolution, `registerAdminModuleLookup` |
| Roles | `src/lib/roles.ts` | `SUPER_ADMIN_PORTAL_DEFAULTS`, the computed superset, and the two exclusions |
| Nav | `src/lib/nav.ts` | 11 new rail groups; the refund-queue entry |
| View | `src/views/AdminView.vue` | `AdminPanelRouter` mount, `isAdminPanel`, `panelFromQuery`, the `?panel=` watcher |
| Style | `src/styles/admin-panel-page.css` | Overrides for the origin rules that reach into a module |
| Components | `src/components/admin/` (21 files) | 16 panel renderers plus the shell, the dialog, the badge and the router |
| Verification | `tools/check-admin-parity.mjs`, `tools/check-rbac.mjs`, `tools/check-template-components.py`, `tools/audit/verify-walk.js`, `tools/audit/verify-workflows.js`, `tools/audit/cdp-walk.mjs`, `tools/audit/cdp-workflows.mjs` | The checks below |

## The order it was built in, and why

**1. Registry first, components later.** Every list module is the same page
differing by a column list and a field list. Describing that as data *first* meant
a new module needed no component at all, and it meant the 16 bespoke components
were written only for the pages that genuinely are something else. Writing the
components first would have produced 58 near-identical files.

**2. Permissions before panels.** `check-rbac.mjs` resolves every module's read,
write and delete permission against the vocabulary and fails closed on an
unresolvable one. Building that first meant no panel could ever ship gated on a
code that does not exist — the failure mode where a button renders for everyone
because its permission is `undefined`.

**3. The rail after the registry.** `check-admin-parity.mjs` asserts that every
registry module has a rail entry, every rail entry names a registry module (or is
one of the seven LAEC panels), and every bespoke component in `admin-panels.ts` is
reachable. Editing the rail without the check would let the two drift silently.

**4. The Super Admin grant before the panels rendered.** A panel behind a
permission SUPER_ADMIN does not hold renders a rail entry that leads nowhere. The
grant is in `roles.ts` from the start; the exemption was removed first.

**5. Verification last, and it found the bugs.** This is the part worth
emphasising: five of the defects fixed during this audit were found by the
workflow checks, not by reading the code. They are listed in `ui-audit.md` and
`parity-report.md`.

## How each claim was verified

| Claim | Check | Script |
|---|---|---|
| Every panel mounts; none logs an error | 66-panel walk, 0 console / 0 page / 0 request failures | `verify-walk.js`, `cdp-walk.mjs` |
| Every module has a rail entry and a panel | registry ↔ rail ↔ panel-map cross-check | `check-admin-parity.mjs` |
| Every permission resolves, and unknown actions fail closed | sentinel resolution against every module | `check-rbac.mjs` |
| Every template component is imported | template-tag scan | `check-template-components.py` |
| The pre-existing LAEC panels still work | 7-panel regression pass inside the walk | same |
| The doors, the layering, the dashboard totals | existing checks, unchanged and still passing | `check-doors`, `check-layers`, `check-overview-totals` |
| Each workflow actually works | 22 before/after checks | `verify-workflows.js`, `cdp-workflows.mjs` |
| Types and the build | `vue-tsc --noEmit` and `vite build` | `npm run build` |

## The CDP driver, and why it exists

`verify-walk.js` and `verify-workflows.js` run under the Playwright MCP. When
that server became unavailable mid-task, the checks became unrunnable — and a
check that can only be run once proves nothing. So `tools/audit/cdp-walk.mjs` and
`tools/audit/cdp-workflows.mjs` drive a headless Chrome over the DevTools
Protocol instead, with no dependency beyond Node's global `WebSocket`.

They are not a second opinion on the same assertions; they are the same
assertions, re-expressible. Both were run after every fix in this task, and the
workflow run is what found the `?panel=` deep-link defect that a document-load
test could not.

## What was deliberately not built

Named in `feature-matrix.md` with reasons. In short: the teacher-portal surfaces
already exist on `/teacher/`; the notice board and events calendar already exist
on `/notices/` and `/calendar/`; Disciplinary and Counselling are two whole
modules and are the largest remaining scope; and the store's checkout flow is
absent rather than wired to an invented payment.

## Read next

`verification-checklist.md` for the results, `parity-report.md` for the
divergences, `feature-matrix.md` for the per-panel status.