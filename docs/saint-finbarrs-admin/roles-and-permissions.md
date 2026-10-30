# Roles and permissions

Labels are per `README.md`. **Only admin-level behaviour was directly verified**:
the supplied account holds a single claim, `SUPER ADMIN`, so every statement
about what a session *sees* is super-admin behaviour. Statements about other
roles come from the deployed source and are labelled **SOURCE**.

## The two models

The live admin portal and this project each have a permission model, and they are
not the same one.

| | Live portal | This project (LAEC) |
|---|---|---|
| Shape | 180 dotted codes, e.g. `users.create`, `results.grading.manage` | PascalCase codes, e.g. `MANAGE_USERS`, `VIEW_QUESTIONS` |
| Groups | 32 named modules in the Roles UI | Implicit, per-console |
| Roles | 33 named school roles (`Vice Principal`, `House Parent`, `Sanitation`…) | 6 claims (`SUPER_ADMIN`, `CENTRAL_ADMIN`, `SCHOOL_ADMIN`, `ICT_ADMIN`, `EXAM_COMMITTEE`, `TEACHER`) |
| Enforcement | Server-side, per endpoint | Client-side, in `callApi` |

The live vocabulary is dotted and grouped; LAEC's is flat PascalCase with no
groups. Adding the live modules to this project therefore meant adding a second
vocabulary rather than bending the first. `src/lib/permissions.ts` now holds
both, and one predicate (`hasPermission`) serves both.

## The permission catalogue as observed

The live `/permissions` page shows a module-grouped matrix. **OBSERVED** — 32
groups read from the live page in the signed-in session, cross-checked against
`lib/permissions.ts`'s `MODULE_LABELS`, which is the same list the Roles UI
renders:

| Group | Group | Group | Group |
|---|---|---|---|
| Users | Roles | Permissions | Staff |
| Departments | Designations | Students | Parents |
| Teacher portal | Lesson planning | Weekly reports | Communication |
| Academic | Results | Inventory | Store |
| School fees | Wallet | HR | Leave |
| Attendance | Disciplinary | Counselling | Awards |
| Categories | System | Dashboards | Authentication |
| Audit log | Notifications | | |

## The 33 roles as observed

Read off the live `/roles` table (33 rows) and the `/permissions` role cards. The
live app's own vocabulary mixes school-office roles with job roles. **OBSERVED**:

| # | Role | # | Role |
|---|---|---|---|
| R01 | Vice Principal | R18 | Management |
| R02 | Teacher & Parent | R19 | Facility & Maintenance |
| R03 | Counsellor Team | R20 | Parent |
| R04 | HR Officer | R21 | Sanitation |
| R05 | Accountant | R22 | Secretary |
| R06 | Bursary | R23 | Staff |
| R07 | Clinicals | R24 | Teacher |
| R08 | House Parent | R25 | Store/Sales Staff |
| R09 | ICT | R26 | Special Lesson Formator |
| R10 | Inventory/Stock | R27 | Asst. Admin Sec. |
| R11 | Kitchen | R28 | Super Admin |
| R12 | Librarian | R29 | Admin |
| R13 | College Administrator | R30 | Administrator |
| R14 | Assistant College Administrator | R31 | Assistant Admin |
| R15 | Head Teacher | R32 | Assistant Administrator |
| R16 | Sectional Head (Senior) | R33 | Principal |
| R17 | Sectional Head (Junior) | | |
| R18 | Management | | |
| R19 | Facility & Maintenance | | |
| R20 | Parent | | |
| R21 | Sanitation | | |
| R22 | Secretary | | |
| R23 | Staff | | |
| R24 | Teacher | | |
| R25 | Store/Sales Staff | | |
| R26 | Special Lesson Formator | | |
| R27 | Asst. Admin Sec. | | |
| R28 | Super Admin | | |
| R29 | Admin | | |

The crawl's heading extraction captured 29 of these (R01–R29); R31–R33
(`Assistant Admin`, `Assistant Administrator`, `Principal`) came from the live
`/roles` table, which lists all 33. The authoritative list is `SEED_ROLES` in
`src/types/admin-registry.ts`, carrying all 33 with their seeded permission
counts. Those counts are **seed data for this project's mock**, not observed live
values — the live role table shows a permission count per role, but the audit read
the names, not every count.

## How this project's Super Admin gets its grants

This is the one design decision in the whole audit that needs justifying, so it
is stated in full.

`SUPER_ADMIN` reaches `/admin/`, and that page now contains 58 registered
Saint Finbarr's modules plus a summary dashboard. Each declares a `permission`, a `writePermission` and optionally a
`deletePermission`. If SUPER_ADMIN did not hold those codes, the page would
render a rail full of items behind which nothing worked.

There were two ways to fix that:

1. **An exemption.** `bypassesPermissions(role)` returns `true` for
   SUPER_ADMIN. This is what the project already did, and it is why it was
   removed.
2. **A grant.** `SUPER_ADMIN_PORTAL_DEFAULTS` declares the 180 codes it holds,
   and `SUPER_ADMIN_PERMISSIONS` is the computed union of every role's defaults
   minus two deliberate exclusions.

**Why the exemption had to go.** Exemption lets the *navigation filter* show every
item, while each console still filters its own *controls*. So a super
administrator admitted to `/teacher/` saw a rail full of entries and could not
act on any of them: navigation and function disagreed, and only navigation had
been told about the exemption. `src/lib/permissions.ts` documents the same class
of gap in the notification popup, where `z-index` on an unpositioned flex item
produced the identical shape of bug.

The grant removes the disagreement rather than working around it: `can()` and the
nav filter now answer identically for SUPER_ADMIN, because the codes the filter
asks about are the codes the controls check.

**The two exclusions** (`SUPER_ADMIN_SUPERSET_EXCLUSIONS`):

| Code | Why not granted |
|---|---|
| `password.reset` | Reachable from the *unauthenticated* control page. A blanket grant would widen account recovery. |
| `review.decide` | Sits with the Central Admin, which chairs the review queue. SUPER_ADMIN inherits the queue's *visibility* via `review.read`, not the decision. |

Both are judgement calls about accountability, not convenience. A superset that
granted everything would be a lie about who owns what.

## The 33 Saint Finbarr's roles are not LAEC claims

The live app's roles are per-school job roles with per-role permission sets. This
project's six are LAEC cross-role claims that gate whole consoles. They are
different axes and neither subsumes the other.

So: the 33 roles are **seed data** — `SEED_ROLES`, rendered by the `roles` panel
and editable through `ADMIN_DECIDE`/`SAVE_ADMIN_ROLE`. They are not wired to the
console guard, because a session in this project carries one LAEC claim, not one
of 33 school roles. **This is a deliberate scope decision, not an oversight**, and
it is recorded in `parity-report.md`.

## What was verified, and how

| Claim | How | Result |
|---|---|---|
| A module's rail entry is gated on its permission | `tools/check-rbac.mjs` cross-checks every registry permission against `PERMISSION_CODES` and every rail entry against the registry | PASS |
| A generic write action resolves to a real code | `check-rbac.mjs` resolves each of the three sentinels (`__ADMIN_WRITE__`, `__ADMIN_DELETE__`, `__ADMIN_DECIDE__`) against every module and fails closed on an unresolvable one | PASS |
| A module SUPER_ADMIN cannot hold is not offered | Walked the rail as SUPER_ADMIN and asserted no permission-gated control was missing | PASS |
| A missing permission removes the **control**, not just the write | Workflow check **W16**: narrowed the live session's grants, watched Approve/Reject disappear from the DOM while View remained, then restored them and watched the buttons return without a reload | PASS |
| Another claim cannot reach `/admin/` | Workflow check **W16c**: signed in as a school-admin fixture, asked for `/admin/?panel=leave-approvals`, landed on `/control/` with no module mounted | PASS |
| A grant made in the permissions dialog is really persisted | Workflow check **W11**: toggled one permission, watched the dialog's live count move 0 → 1, saved, and read the banner and the list's own count back | PASS |
| The permission dialog is usable by keyboard and by touch | Measured in a browser: 178 checkboxes, **all 178 named**; Tab wraps from the last of 182 focusable controls to the first and Shift+Tab back; a Tab in the middle is not intercepted; every target in the dialog is ≥44 px at 390 px wide | PASS |

The dialog's behaviour is recorded in `ui-audit.md`; what it cost to get there,
and the six origin stylesheet rules that had to be outranked, is in
`verification-checklist.md`.

W16 is the load-bearing one. It is the difference between "the button is there
and the write is refused" and "the button is not there" — and the second is what
an operator has to be able to trust.

## What was NOT verified

**No non-admin role was ever signed in on the live portal.** Every statement
about what a teacher, parent, bursary officer or house parent sees is either
SOURCE-derived or absent. Specifically:

- The live `/leave/approvals` Approve/Reject buttons carry **no permission check
  in the deployed source** — they render for any `PENDING` row. **SOURCE**
  (`LeaveDetailPage`). This project gates them on `leave.approve`, because this is
  the admin console where that permission exists and is held. Reproducing the gap
  would ship a control the rail already says this session does not hold.
  Recorded in `parity-report.md`.
- `isAdminLike()` in the live source treats any role whose name *contains* "admin"
  or "principal" as an administrator, as a UX fallback for actions the backend
  enforces. **SOURCE.** Not reproduced: substring matching over free-text role
  names is the mechanism this project rejected when it replaced its own
  role matching with an enum (see `src/lib/roles.ts`).

## Read next

`workflows.md` for what an operator actually does, `api-observations.md` for the
boundary, `feature-matrix.md` for what was built.
## 5. The 33 school roles as a second authorisation axis

**BEFORE.** A session carried one LAEC claim and nothing else. That claim gated
whether `/admin/` opened; inside it, every module was reachable. The 33 school
roles were a table: 33 rows, assignable to other accounts, and inert for the
operator in front of the console. That was recorded as a scope decision rather
than hidden, but it was a real gap — on the live portal the roles *are* the
authorisation surface.

**NOW.** Two axes.

| Axis | What it decides | Source of truth | Where it is read |
|---|---|---|---|
| LAEC claim | Whether `/admin/` opens at all | `AdminRole` in storage | router guard |
| School roles | What is reachable once open | `SCHOOL_ROLE_PERMISSIONS`, `session.schoolRoles` | rail filter, `sessionCan`, and the `callApi` gate |

`effectivePermissions` unions both, and **all three consumers read that same
union** — the rail, the page's own control gate, and the transport. That
agreement is the point: an earlier shape let a role change the navigation while
leaving the gate untouched, which is the same navigation-versus-function
disagreement `SUPER_ADMIN_PERMISSIONS` was introduced to remove for a different
reason, and it was fixed the same way.

**What is OBSERVED.** The live `/roles` table, 33 rows: each role's name, its
user count, and its permission count. Those figures are in `SEED_ROLES`.

**What is NOT VERIFIED.** The permissions each role actually holds. They sit
behind a per-role drilldown this audit did not open, so `SCHOOL_ROLE_PERMISSIONS`
is a **reconstruction**, not a transcription:

- **Membership** is this console's own — each role's documented remit (its
  `description` in `SEED_ROLES`) mapped against the 29 permission modules the
  live `/permissions` page groups by. The *codes* are the real ones.
- **Counts are not forced to match.** Truncating a role's module membership to
  its observed count would have produced the right total and the wrong codes — a
  nicer number and less truth. Four roles match exactly; the rest do not, and the
  gap is below rather than hidden.

The roles panel shows both numbers on every row, so the divergence is visible
where it matters and each figure has a `title` explaining it.

### Observed count against what this console grants

| Kitchen | 0 | 0 | exact |
| Librarian | 0 | 0 | exact |
| Management | 0 | 0 | exact |
| Sanitation | 0 | 0 | exact |
| Bursary | 18 | 17 | live higher by 1 |
| Accountant | 10 | 8 | live higher by 2 |
| Store/Sales Staff | 6 | 8 | live lower by 2 |
| Secretary | 34 | 37 | live lower by 3 |
| Teacher | 55 | 58 | live lower by 3 |
| Clinicals | 14 | 18 | live lower by 4 |
| Counsellor Team | 27 | 23 | live higher by 4 |
| House Parent | 23 | 27 | live lower by 4 |
| Inventory/Stock | 13 | 17 | live lower by 4 |
| Facility & Maintenance | 17 | 22 | live lower by 5 |
| Special Lesson Formator | 17 | 23 | live lower by 6 |
| Super Admin | 154 | 147 | live higher by 7 |
| Teacher & Parent | 28 | 35 | live lower by 7 |
| Staff | 15 | 23 | live lower by 8 |
| Assistant College Administrator | 137 | 147 | live lower by 10 |
| ICT | 137 | 147 | live lower by 10 |
| Assistant Admin | 3 | 14 | live lower by 11 |
| Assistant Administrator | 3 | 14 | live lower by 11 |
| Parent | 21 | 33 | live lower by 12 |
| Asst. Admin Sec. | 16 | 29 | live lower by 13 |
| College Administrator | 132 | 147 | live lower by 15 |
| HR Officer | 46 | 27 | live higher by 19 |
| Vice Principal | 91 | 68 | live higher by 23 |
| Principal | 91 | 67 | live higher by 24 |
| Head Teacher | 50 | 79 | live lower by 29 |
| Sectional Head (Senior) | 47 | 79 | live lower by 32 |
| Sectional Head (Junior) | 40 | 79 | live lower by 39 |
| Admin | 113 | 73 | live higher by 40 |
| Administrator | 115 | 73 | live higher by 42 |

### The two controls

**Hold this role** grants a role to *this* session, taking effect immediately:
the rail re-filters and every gated control re-evaluates in the same tick, because
`setSchoolRole` re-derives `permissions` rather than appending a code.

**Preview this role** exists because of a structural fact, not convenience.
`/admin/` is `SUPER_ADMIN`-only (router guard, D-11) and a super administrator
holds a superset of every other role **by design**. So holding Bursary cannot
narrow a super administrator's rail — correctly, because a super administrator is
entitled to everything. Without the preview the 33 roles would still be
unobservable in this console.

The preview applies the chosen role's grants *instead of* the session's own, and
is marked in the UI as a preview. The asymmetry is deliberate and is the safety
property: `navPermissions` is read by the rail and `sessionCan`, while the
transport gate keeps reading `permissions` and the held roles. A preview can
therefore narrow what is offered and can never widen what a call would be
permitted to do. Verified in `workflows.md`, W26.

`filterNav` grew an explicit `ignoreSuperAdmin` flag for this. It exists because
`filterNav` short-circuits for `SUPER_ADMIN`, which would have made the preview a
no-op; the flag is named rather than inferred from the permission list, because
"this session is a super admin" and "ignore that" are different requests.

### What is still NOT VERIFIED, and cannot be

**No non-admin session was ever signed in on the live portal.** Every claim about
what another role sees there remains SOURCE or absent. What is verified now is
narrower and stated as such: this console's own model, under this console's own
grant, with the divergence from the live figures tabulated above.
