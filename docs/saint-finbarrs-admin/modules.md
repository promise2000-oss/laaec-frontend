# Modules — what the live admin portal actually is

All statements are labelled per `README.md`: **OBSERVED** (read off the live
deployment in a signed-in Super Admin session) or **SOURCE** (read from the
deployed application's own source at
`C:\Users\USER\Documents\saintfinbarrs-frontend`).

## The finding that reframes the task

The live portal is not an examination system with extra pages. It is a **full
school management system** — 14 modules, 131 routes, 33 roles, 180 permission
codes — that shares exactly three concepts with this project: results, users and
roles. **OBSERVED**.

Its own navigation declares 11 sections (**SOURCE**, `lib/nav-config.ts`) and the
audit reached 131 routes behind them. The module list below is that navigation,
regrouped by what each module *owns* rather than by rail position, because two
rail sections (`Academic Settings`, `Store`) are cross-cutting and one
(`General`) mixes four unrelated domains.

## The 14 modules

| # | Module | Live routes | What it owns |
|---|---|---|---|
| 1 | **Dashboards** | 1 | The admin landing page: stat tiles, activity, shortcuts. Calls `GET /dashboard/stats`. **OBSERVED** |
| 2 | **User & Roles** | 5 | `/users`, `/roles`, `/permissions` and their two `new` routes. Account lifecycle, the 33-role catalogue, and a role→permission matrix grouped by module. **OBSERVED** |
| 3 | **Staff & HR** | 16 | `/staff`, `/departments`, `/designations`, `/attendance`, `/attendance/reports`, `/leave`, `/leave/apply`, `/leave/new`, `/leave/approvals`, `/hr-queries`, `/hr-queries/new`, `/awards`, `/awards/new`, `/staff/new`, `/staff/import`. Staff records, organisation structure, attendance, leave, staff-to-HR queries and recognition. **OBSERVED** |
| 4 | **Students & Parents** | 8 | `/students`, `/students/new`, `/students/import`, `/students/export`, `/students/promotion`, `/students/attendance`, `/students/attendance/new`, `/students/attendance/report`, `/parents`, `/parents/new`, and the per-student detail routes. Enrolment, guardian linkage, promotion, per-class attendance. **OBSERVED** |
| 5 | **Academic** | 16 | `/academic/sessions`, `/academic/terms`, `/academic/classes`, `/academic/sections`, `/academic/subjects`, `/academic/timetables`, `/academic/assignments`, `/academic/class-routines`, `/academic/class-teachers`, `/academic/subject-teachers`, `/academic/calendar`, and each `new` route. Sessions and terms, the class tree, subjects, timetabling, homework. **OBSERVED** |
| 6 | **Teacher Portal** | 10 | `/lesson-planning` (5 status routes), `/dashboard/lesson-plans`, `/staff-portal/lesson-planning/approvals`, `/weekly-report` (4 routes), `/teacher/class-teacher-weekly-report` (2 routes). Lesson-plan authoring and review; weekly reports and class-teacher reports. **OBSERVED** |
| 7 | **Communication** | 9 | `/communication/messages`, `/communication/notice-board` (+`new`), `/communication/events` (+`new`), `/communication/logs`, `/communication/templates` (+`new`), plus `/notifications`. Messaging, the notice board, the events calendar. **OBSERVED** |
| 8 | **Disciplinary** | 5 | `/disciplinary/incidents`, `/disciplinary/committees`, `/disciplinary/launch-case`, `/disciplinary/reports`. Incident log, committee membership, case launch, case reporting. **OBSERVED** |
| 9 | **Counselling** | 5 | `/counselling/cases`, `/counselling/book-session`, `/counselling/committee`, `/counselling/reports`, `/counselling/report`. Case file, session booking, committee, reports. **OBSERVED** |
| 10 | **Inventory** | 8 | `/inventory/stock`, `/inventory/categories`, `/inventory/suppliers`, `/inventory/assets`, `/inventory/reports`, `/inventory/settings`, `/inventory/clinic`, `/inventory/sales`. Stock, catalogue, supply chain, fixed assets, a separate clinic store, sales and invoicing. **OBSERVED** |
| 11 | **Store** | 5 | `/store`, `/store/cart`, `/store/orders`, `/store/queue` (+`?status=REFUND_PENDING`). A parent-facing storefront with a cart, an order list and a bursary confirmation queue. **OBSERVED** |
| 12 | **School Fees** | 5 | `/school-fees`, `/school-fees/categories`, `/school-fees/items`, `/school-fees/payments`, `/school-fees/reports`. Fee structure, per-class breakdown, payment history, collection reports. **OBSERVED** |
| 13 | **Student Wallet** | 2 | `/wallets`, `/wallets/reports`. A per-student balance with a top-up and deduction, plus aggregate reports. **OBSERVED** |
| 14 | **Results Management** | 7 | `/results/windows`, `/results/enter`, `/results/queue`, `/results/committee`, `/results/grading`, `/results/students`, `/results/report-cards`. Upload windows, mark entry, a vetting queue, committee tagging, the grading scale, published results, report cards. **OBSERVED** |
| — | **System** | 8 | `/system/general-settings`, `/system/academic-settings`, `/system/branding`, `/system/notification-settings`, `/system/system-configuration`, `/system/audit-logs`, `/system/backups`, `/system/feature-toggles`. Not in the app's own rail — reached from the dashboard. **OBSERVED** |

### The two modules built on shared components

**Disciplinary** and **Counselling** are the same three page shapes with different
nouns: a standing catalogue or team list, a committee with seats, a sectioned
referral form, and a filtered case list. The deployed app is written the same way —
`counselling-cases.tsx` and `disciplinary-reports.tsx` are siblings, and both
reach for the same `ApiCommitteeMember`.

So they are eight panels on **two** components:

| Component | Panels | Page shape |
|---|---|---|
| `AdminCaseModulePanel.vue` | `disciplinary-incidents`, `disciplinary-committees`, `disciplinary-launch-case`, `counselling-book-session`, `counselling-committee` | catalogue, committee, sectioned form |
| `AdminCaseWorkPanel.vue` | `disciplinary-reports`, `counselling-cases`, `counselling-reports` | filtered list + detail dialog |

Which module a panel is serving is read from **its own panel id**, never from a
prop. That is deliberate: a prop kept in step with the id by hand is a prop that
will eventually be wrong, and the failure would be a counselling panel saving a
disciplinary case.

Their actions are not new either. Both modules were already built for this
project's `/teacher/` console, with handlers and types in `types/teacher.ts`; the
admin panels issue those same actions against the same records. Only the two case
deletes are new. See `parity-report.md` §10.

### Not a rail section

**System** (`/system/*`) is reachable and fully populated but is **not** in the
live app's `navSections`. It is linked from the dashboard. That is why this
project's rail carries a `System` group that the live one does not. **SOURCE**
(`lib/nav-config.ts` has no System section) + **OBSERVED** (all eight routes
render).

## What the modules have in common

Every list-shaped module in the live app is the same page: a heading, a
description, a search box, zero to two filters, a table, a row-action menu and a
create/edit dialog. The differences are a column list and a field list. That
observation is what makes the implementation tractable, and it is why
`src/types/admin-registry.ts` describes 66 modules as data while one component
renders the 13 of them that are plain table-and-form. A 59th panel — the summary
dashboard — mounts through the same router but has no registry entry, because a
registry entry describes a list and the dashboard is not one. The other 46 are
bespoke, drawn by 16 components.

The exceptions — modules whose behaviour is genuinely something else — are the
permission matrix (`/permissions`), the grading scale (`/results/grading`), the
attendance register, the five-column attendance report, the results-entry sheet,
the summary dashboard, the timetable grid, the sectioned enrolment form and the
card grids. Sixteen bespoke components exist for these; see
`feature-matrix.md`.

## Two boundaries that shape everything

**1. There is no LAEC backend for any of this.** The live app's API base is
`https://api.saintfinbarrscollege.com` — a separate service from LAEC's. **SOURCE**
(`lib/api/endpoints.ts`, plus the observed API host). Nothing in this project can
call it, and nothing should: this is a mock-backed reconstruction, and the
contract in `src/api/contract.ts` is the local stand-in.

**2. The permission model is the live app's, not LAEC's.** The live app's
vocabulary is 180 dotted codes (`users.create`, `results.grading.manage`) grouped
into 32 modules. LAEC's is a different one. `src/lib/permissions.ts` carries both:
LAEC's existing codes untouched, and 98 new ones for these modules, so the two
live in one predicate. See `roles-and-permissions.md`.

## Read next

`route-inventory.md` for the 131 routes one by one, `feature-matrix.md` for what
was built from this.