# Route Map

## Origin (`saintfinbarrscollege.com`)

Discovered from `app/(teacher)/teacher/**`, `app/(dashboard)/**`, `lib/navigation/teacher-nav.ts`.

### Enforced on the origin

| Layer | Mechanism |
|---|---|
| Route group layout | `app/(teacher)/layout.tsx` → `TeacherShell`, which blocks on `useAuthHydrated()` + `useSessionSync()` then renders `SidebarProvider` + `TeacherSidebar` + `DashboardNavbar` |
| Session | zustand + `persist` in `sessionStorage`, key `sfb.auth` |
| Re-sync | `GET /auth/me` on mount, every `pathname` change, on `visibilitychange`, and every 30 s |
| Authorisation | **component-level `hasPermission()` only.** `RoleGuard` (`src/components/role-guard.tsx`) exists but is imported nowhere in `app/` — there is no route-level role gate |
| Refresh | `POST /auth/refresh` on any 401, single-flight, retries once, else clears session → `/login` |

### Teacher-specific routes — `app/(teacher)/teacher/**`

| Route | Purpose |
|---|---|
| `/teacher/lesson-planning` | My lesson plans |
| `/teacher/lesson-planning/my-plans` | My lesson plans (alias) |
| `/teacher/lesson-planning/create` | New lesson plan (`lesson-plans.create`) |
| `/teacher/lesson-planning/drafts` | `LessonTable status="draft"` |
| `/teacher/lesson-planning/pending-review` | `LessonTable status="pending"` |
| `/teacher/lesson-planning/approved` | `LessonTable status="approved"` |
| `/teacher/lesson-planning/rejected` | `LessonTable status="rejected"` |
| `/teacher/lesson-planning/weekly-planner` | Week-grouped board |
| `/teacher/lesson-planning/[id]` | Print-shaped document view |
| `/teacher/lesson-planning/[id]/edit` | Edit (`lesson-plans.update`) |
| `/teacher/lesson-approval` | Review Inbox — `LessonPlanManagement assignedToMeOnly` |
| `/teacher/weekly-report` | My weekly reports |
| `/teacher/weekly-report/create` | New weekly report |
| `/teacher/weekly-report/manage` | Review reports (`weekly-reports.review`; **page does not check**) |
| `/teacher/weekly-report/[id]` | Report + review form |
| `/teacher/weekly-report/[id]/edit` | Edit |
| `/teacher/class-teacher-weekly-report` | Class-teacher reports list |
| `/teacher/class-teacher-weekly-report/create` | New class-teacher report |
| `/teacher/class-teacher-weekly-report/[id]` | Detail + share (share gated on ownership + `status === "submitted"`) |
| `/teacher/class-teacher-weekly-report/[id]/edit` | Edit |
| `/teacher/leave` | My permission requests |
| `/teacher/leave/apply` | Apply |
| `/teacher/leave/[id]` | Detail — **approve/reject render on `status === "PENDING"` with no permission check** |
| `/teacher/leave/approvals` | Approvals queue — **not in teacher-nav**, reachable by direct URL only |
| `/teacher/hr-queries` | My queries |
| `/teacher/hr-queries/new` | New query |
| `/teacher/hr-queries/[id]` | Detail — **assign/resolve/archive have no permission check** |
| `/teacher/profile` | My profile |
| `/teacher/notifications` | Notification centre + inline lesson-plan review |
| `/teacher/messaging` | Messages |
| `/teacher/notice-board` | Notice board (read-only for teachers) |
| `/teacher/events` | Events |
| `/teacher/academic-calendar` | Academic calendar (`readOnly`) |
| `/teacher/counselling/book-session` | Book a session |
| `/teacher/counselling/cases` | Case list |
| `/teacher/counselling/cases/[id]` | Case detail |
| `/teacher/counselling/committee` | Counselling committees |
| `/teacher/counselling/reports` | Report list |
| `/teacher/counselling/reports/[id]` | Report detail |
| `/teacher/counselling/report` | New report (`counselling.reports.manage \|\| isAdminLike`) |
| `/teacher/disciplinary/incidents` | Case types (`disciplinary.incidents.manage` for writes) |
| `/teacher/disciplinary/committees` | Committees (`disciplinary.committees.manage` for writes) |
| `/teacher/disciplinary/launch-case` | Launch a case |
| `/teacher/disciplinary/reports` | Case list + download + share |
| `/teacher/disciplinary/reports/[id]` | Case detail |

### Shared routes the teacher nav points at — `app/(dashboard)/**`

These resolve to the **AdminShell** layout, not the teacher layout:
`/lesson-planning` (+ `create`, `drafts`, `pending-review`, `approved`, `rejected`,
`weekly-planner`, `[id]`, `[id]/edit`), `/weekly-report` (+ `create`, `manage`,
`[id]`, `[id]/edit`), `/leave` (+ `apply`), `/hr-queries` (+ `new`),
`/communication/messages`, `/notifications`, `/communication/notice-board`,
`/communication/events`, `/disciplinary/{incidents,committees,launch-case,reports}`,
`/counselling/{book-session,cases,committee,reports,report}`, `/academic/calendar`,
and `/dashboard` (the landing page for **every** role — `roleHref()` and
`dashboardForRoleName()` both hardcode `/dashboard`).

> **Origin defect, reproduced not corrected:** `teacher-nav.ts` links `/lesson-planning*`
> and `/weekly-report*` at the `(dashboard)` group, while `WeeklyPlanner` and the
> class-teacher components hardcode `/teacher/...` hrefs. The same `WeeklyPlanner`
> therefore emits cross-layout links depending on which route rendered it.

### Not teacher-reachable

- `app/(parent)/parent/**` — parent portal.
- `app/(staff)/staff-portal/**` — HR portal. `teacher-nav.ts` contains no
  `/staff-portal/**` URL, though the same components are reused.
- Admin-only: `/users`, `/roles`, `/permissions`, `/departments`, `/designations`,
  `/inventory/**`, `/store/**`, `/school-fees/**`, `/wallets/**`, `/results/**`,
  `/system/**`, `/attendance/**`, `/students/**`, `/parents`, `/awards`,
  `/academic/{classes,sessions,terms,subjects,timetables,class-routines,…}`.

### Unauthenticated routes — `app/(auth)/**`

`/login`, `/forgot-password`, `/reset-password`, `/change-password`,
`/complete-profile`, `/invitation`. Plus `/unauthorized` and `not-found.tsx`.

---

## Local mapping — this project

**Chosen shape: one route, 17 panels.** This portal is a Vite multi-page app where
each role is a single HTML document with a panel rail (`src/lib/nav.ts`). Every origin
module below becomes a panel inside `/teacher/`, rendered by `TeacherView.vue`.

| Panel id | Rail label | Origin route(s) collapsed | Group |
|---|---|---|---|
| `dashboard` | Dashboard | `/dashboard` | Overview |
| `drafts` | My Papers | — (LAEC-native) | Overview |
| `compose` | Compose | — (LAEC-native) | Authoring |
| `notices` | Decisions | — (LAEC-native) | Decisions |
| `lesson-plans` | Lesson Planning | `/teacher/lesson-planning/*` (10 routes) | Authoring |
| `weekly-reports` | Weekly Report | `/teacher/weekly-report/*` (6 routes) | Authoring |
| `class-reports` | Class Teacher Report | `/teacher/class-teacher-weekly-report/*` (5 routes) | Authoring |
| `lesson-approval` | Review Inbox | `/teacher/lesson-approval` | Decisions |
| `leave` | My Permission | `/teacher/leave/*` (3 routes) | School |
| `hr-queries` | HR Queries | `/teacher/hr-queries/*` (3 routes) | School |
| `counselling` | Guidance & Counselling | `/teacher/counselling/*` (6 routes) | School |
| `disciplinary` | Disciplinary | `/teacher/disciplinary/*` (5 routes) | School |
| `messaging` | Messages | `/teacher/messaging` | Communication |
| `events` | Events | `/teacher/events` | Communication |
| `notifications` | Notifications | `/teacher/notifications` | Communication |
| `profile` | Profile | `/teacher/profile` | Communication |
| `calendar` | Calendar | `/teacher/academic-calendar` | School *(shared document)* |
| `notice-board` | Notice Board | `/teacher/notice-board` | School *(shared document)* |

`calendar` and `notice-board` keep `route: '/calendar/'` and `route: '/notices/'` in
`nav.ts` — they are already separate documents here (D-64), so they navigate rather
than switch panels. The other 15 switch the panel.

**Sub-navigation inside a panel** replaces the origin's nested routes: e.g. Lesson
Planning carries the origin's five status tabs (My Plans / Drafts / Pending Review /
Approved / Rejected) as a `status` filter on one table, and its `[id]` / `[id]/edit`
detail screens become an in-panel detail view and an in-panel form.

### Local routes unchanged

`/`, `/login/`, `/login/<role>/` ×6, `/control/`, `/exam/`, `/admin/`, `/ca/`, `/ict/`,
`/comm/`, `/teacher/`, `/central/`, `/calendar/`, `/notices/`.

### Guard

`router.beforeEach` → `CONSOLE_ROLE.teacher = 'TEACHER'`. No session → `{name:'control'}`.
Wrong role and not `SUPER_ADMIN` → `{name:'control'}`. `SUPER_ADMIN` is admitted by the
`SUPER_ADMIN_PERMISSIONS` superset in `src/lib/roles.ts`, so its rail and its controls agree.