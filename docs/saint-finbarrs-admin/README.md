# Saint Finbarr's College — Admin Portal Audit

Target: `https://saintfinbarrscollege.com/` — the "NICEGENE DAILYAPP" school
management portal.

Implementation target: **this project**, `laaec-audit` — a Vue 3 + Vite
multi-page CBT portal for the Lagos Archdiocesan Education Commission (LAEC).

Audit date: 2026-10-07. Audit account: the supplied **Super Admin**
(`SUPER ADMIN`, the only claim the live app grants to the supplied account).

## How ground truth was established

Two independent sources, and every statement below is labelled with which one
it came from:

| Label | Meaning |
|---|---|
| **OBSERVED** | Read directly off the live deployment in a signed-in Super Admin session with Playwright: HTTP 200, DOM read, button/dialog opened, tab clicked. |
| **SOURCE** | Read from the deployed application's own source, present locally at `C:\Users\USER\Documents\saintfinbarrs-frontend`. Its `package.json`, route tree, page titles and API base (`https://api.saintfinbarrscollege.com`) match the live deployment. Used for behaviour the DOM cannot show: validation strings, client-side rules, endpoint paths. |
| **NOT VERIFIED** | Neither source could settle it. Stated as such rather than guessed. |

The live app was reachable and authenticated successfully, so unlike the earlier
teacher-portal audit (`docs/teacher-portal/README.md`, where every endpoint
answered `401` and all observations had to be source-derived) this audit is
**live-verified**. `131` routes were opened in the authenticated console and
`42` API calls observed.

**Only admin-level behaviour was directly verified.** The supplied account holds
a single claim — `SUPER ADMIN` — so every observation is super-admin behaviour.
No teacher, parent, staff or other role was signed in, and nothing is claimed
about what a non-admin session sees. Where the live app's own source shows a
permission gate, that gate is documented as SOURCE, not as observed behaviour.

## Safety rules observed

- **No production data was changed.** Every interaction was a `GET` navigation
  or an open-and-dismiss of a dialog, tab, drawer or menu. The one place a
  destructive action was reachable — a row action menu offering `Delete`,
  `Deactivate`, `Suspend` — was opened and read, then dismissed with `Escape`
  without choosing an item.
- **Credentials are not in this repository.** They were typed into the live
  login form at run time and are not reproduced in any file, screenshot, log or
  report. Authentication succeeded and the session was then used only to read.
- **No token, cookie or session value was recorded.** The network probe recorded
  method, host, path, query-parameter *names* and body *key names* only — never a
  header, never a value.

## Documents

| File | Contents |
|---|---|
| `modules.md` | The 14 discovered modules and what each one owns |
| `route-inventory.md` | All 131 audited routes, their live status, and the panel that implements each |
| `feature-inventory.md` | Per-feature record: purpose, UI, actions, validation, data, permissions |
| `workflows.md` | 20 end-to-end workflows, each traced on the live UI and driven here |
| `roles-and-permissions.md` | The authorization model, the 33 roles, the 180-code vocabulary |
| `ui-audit.md` | Layout, chrome, tables, forms, states, responsive behaviour, observed defects |
| `api-observations.md` | The 42 observed API calls, and the endpoint map from source |
| `feature-matrix.md` | Master matrix: every panel, its renderer, its permissions, its status |
| `implementation-plan.md` | What was preserved, what was added, and in what order |
| `verification-checklist.md` | Every check, its result, and how it was run |
| `parity-report.md` | Every deliberate divergence from the live app, and why |

## The headline finding

The live admin portal is **not** an examination portal with a school-management
skin. It is a full school management system — 14 modules, 131 routes, users and
roles, HR, students, academics, results, inventory, a store, fees, wallets,
counselling and disciplinary, and a system-settings area — that happens to
carry the school name. The only overlap with this project's existing LAEC
functionality is results, users and roles.

That is why the implementation is a **Super Admin console extension** rather
than a change to the LAEC exam consoles: the existing `/admin/` panels (exam
management, question bank, results centre, student directory, school admins,
system health) stay exactly as they are, and the Saint Finbarr's modules are
added alongside them in the same rail, the same way the teacher portal was
added to `/teacher/`.

## Reading order

Start with `modules.md` for the shape of the system, then `feature-matrix.md` for
what was built, then `verification-checklist.md` for what was proven. `workflows.md`
says what an operator actually does. `api-observations.md` and
`roles-and-permissions.md` explain the two boundaries that shape the
implementation: there is no LAEC-side backend for these modules, and the
permission model is the live app's own, not LAEC's. `parity-report.md` lists
every place this build deliberately differs from the live one.

## What was verified, in one line

Type check, build, six static cross-checks, a 66-panel walk with zero console or
page errors, and 22 workflow checks driven end to end against the mock — all
passing. Five real defects were found by those workflow checks and fixed; they
are listed in `verification-checklist.md`.
