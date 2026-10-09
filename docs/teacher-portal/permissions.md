# Permissions

## 1. Origin model

- Codes are `module.action` strings. `hasPermission(permissions, code)` returns
  `true` when `code` is undefined and does **not** consult role defaults.
- `isSuperAdmin(roles)` matches the literal `"super admin"`.
  `isAdminLike(roles)` substring-matches `super admin | admin | administrator |
  principal | vice principal` and is used as a UX fallback for backend-enforced
  actions.
- `effectivePermissions(permissions, roles)` unions server grants with role
  defaults. Its docstring says it exists "for nav filtering" — but `BaseSidebar`
  passes the raw `permissions` from `useAuthStore`, so **it is dead code**.
  Nav filtering therefore runs on backend grants alone.
- Session: zustand + `sessionStorage`, key `sfb.auth`. `GET /auth/me` on mount,
  every pathname change, `visibilitychange`, and every 30 s. Single-flight
  `POST /auth/refresh` on 401, one retry, else clear → `/login`.
- `RoleGuard` exists in `src/components/role-guard.tsx` and is **imported
  nowhere**. There is no route-level role gate on any page.

## 2. The teacher's grants

`ROLE_DEFAULT_PERMISSIONS["teacher"]`, verbatim:

```
teacher.read                    lesson-plans.create        class-reports.read
communication.read              lesson-plans.update        class-reports.create
communication.messages.send     lesson-plans.delete        class-reports.update
academic.read                   lesson-plans.review        class-reports.delete
disciplinary.read               weekly-reports.read        class-reports.submit
disciplinary.cases.launch       weekly-reports.create      leave.read
counselling.read                weekly-reports.update      leave.create
counselling.cases.book          weekly-reports.delete      queries.read
...DISCIPLINARY_BASIC / COUNSELLING_BASIC / RESULTS_UPLOAD / STORE_BROWSE
```

## 3. The gap that would hide most of the portal

Sixteen permission codes appear in `teacher-nav.ts`. **Seven are absent from the
role's own defaults:**

| Nav permission | In defaults? |
|---|---|
| `teacher.read`, `lesson-plans.review`, `weekly-reports.review`, `communication.read`, `academic.read`, `disciplinary.read`, `disciplinary.cases.launch`, `counselling.read`, `counselling.cases.book` | yes |
| `queries.view`, `queries.issue` | **no** |
| `disciplinary.cases.view` | **no** |
| `counselling.cases.view`, `counselling.committees.view`, `counselling.reports.view`, `counselling.reports.manage` | **no** |

So on the deployed app a teacher sees **no HR Queries section at all**, and
Guidance & Counselling collapses to `Book Session` only — unless a backend grant
supplies the missing codes. This is reproduced as a *finding*, not inherited: all
seven are granted here, so the rail and the panels agree.

## 4. Origin gaps reproduced deliberately

| Gap | Where | Why it is kept |
|---|---|---|
| Approve/Reject on a pending leave request has **no permission check** | `leave/[id]` | Observable behaviour. Tightening it would be a silent change. |
| Assign / Resolve / Archive on an HR query has **no permission check** | `hr-queries/[id]` | Same. |
| `/teacher/leave/approvals` is reachable by direct URL and is **absent from `teacher-nav.ts`** | — | Recorded, not ported as a separate route. |
| Every teacher holds `lesson-plans.review` and `weekly-reports.review`, so a Review Inbox appears even for a teacher nobody assigned work to | nav | Reproduced. |
| `NotificationsPage` marks everything read on mount | `/teacher/notifications` | Reproduced, and noted in the component. |
| `permissions.ts` and `permission-catalog.ts` use **disjoint vocabularies**; the catalog has none of the ~40 live codes | — | Recorded in `api-map.md`; the catalog is not used for nav here. |

## 5. What this portal does instead

LAEC has one enforcement point: `callApi` in `src/api/mock.ts` gates every POST
action on `ACTION_PERMISSIONS`, resolved against
`effectivePermissions([], role)`.

- 66 codes in `PERMISSION_CODES`; 6 roles; 112 default grants.
- `bypassesPermissions` returns `false` for **every** claim, including Super
  Admin. There is no exemption: `SUPER_ADMIN` is granted
  `SUPER_ADMIN_PERMISSIONS`, the union of the other five roles' defaults, so
  navigation and function answer identically.
- 75 write actions are mapped. An unmapped write fails closed with
  `Permission denied: <ACTION> is not mapped to a permission.`
- `tools/check-rbac.mjs` asserts all of the above and passes.

### Teacher portal codes added

`teacher.read`, `lesson-plans.{read,create,update,delete,submit,review}`,
`weekly-reports.{read,create,update,delete,submit,review}`,
`class-reports.{read,create,update,delete,submit}`,
`leave.{read,create,approve}`, `queries.{read,issue}`,
`communication.{read,messages.send,events.create}`,
`counselling.{read,cases.book,cases.view,committees.view,committees.manage,reports.view,reports.manage}`,
`disciplinary.{read,incidents.manage,committees.manage,cases.launch,cases.view}`.

### Notable mappings

| Action | Code | Why |
|---|---|---|
| `SAVE_LESSON_PLAN` | `lesson-plans.create` | One action covers create and update; the origin has no separate update permission for the write itself, and `lesson-plans.update` gates the editor route. |
| `UPDATE_HR_QUERY` | `queries.read` | The origin lets any teacher resolve a query, so a manage code would misrepresent it. |
| `UPDATE_TEACHER_PROFILE` | `teacher.read` | The origin gates the profile page on nothing. The chosen code reproduces that rather than inventing a stricter one. |
| `PUBLISH_SCHOOL_EVENT` | `communication.events.create` | A teacher holding only `communication.read` sees no create button — as in the origin. |
| `SHARE_CLASS_TEACHER_REPORT` | `class-reports.read` | Sharing is gated on ownership in the UI, not by a distinct permission. |

## 6. Nav filtering

`filterNav(nav, permissions, role)` drops an item without its permission and
removes a group that loses all of its items. `SUPER_ADMIN` short-circuits. The
teacher rail renders **18 entries in 5 groups**: Overview, Teacher Portal, Exam
Papers, General, School.

## 7. Deliberate divergences from the origin

| | Origin | Here | Why |
|---|---|---|---|
| Role defaults vs nav requirements | 7 nav codes missing | all 16 granted | See §3. |
| `isAdminLike` fallback | present | absent | LAEC has no exempt role by design; `bypassesPermissions` is `false` for everyone. Consequence: `counselling.reports.manage` alone decides the New Report gate, so a Super Admin with the grant sees it and one without does not. |
| `effectivePermissions` in nav filtering | documented but not wired | wired | LAEC's `filterNav` receives the effective set, so the docstring and the behaviour finally agree. |