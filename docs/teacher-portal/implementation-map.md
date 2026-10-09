# Implementation Map

Feature → what existed locally before → status → what was built.

| Existing feature | Local implementation before | Status | Work done |
|---|---|---|---|
| Teacher login door | `login/teacher/index.html` → `ControlView` | COMPLETE | untouched |
| Role guard on `/teacher/` | `router.beforeEach` `CONSOLE_ROLE.teacher` | COMPLETE | untouched |
| Permission vocabulary | 28 codes | PARTIAL | +38 codes, +46 action mappings |
| Teacher role grants | 9 codes | PARTIAL | +33 codes; the 7 the origin's nav needs but its defaults omit are granted |
| Teacher nav | 3 panels + 2 shared documents | PARTIAL | 16 panels + 2 shared documents, 18 rail entries |
| Dashboard | — | MISSING | `TeacherDashboardPanel.vue` — 10 tiles, each linking to its panel |
| Lesson plans | — | MISSING | `LessonPlansPanel.vue` + 6 contract actions |
| Weekly reports | — | MISSING | `WeeklyReportsPanel.vue` + 4 contract actions |
| Class-teacher reports | — | MISSING | `ClassTeacherReportsPanel.vue` + 3 contract actions |
| Review Inbox | — | MISSING | `LessonApprovalPanel.vue` + `REVIEW_LESSON_PLAN` |
| Leave | — | MISSING | `LeavePanel.vue` + 3 contract actions |
| HR queries | — | MISSING | `HrQueriesPanel.vue` + 2 contract actions |
| Counselling | — | MISSING | `CounsellingPanel.vue` + 6 contract actions |
| Disciplinary | — | MISSING | `DisciplinaryPanel.vue` + 8 contract actions |
| Messaging | — | MISSING | `MessagingPanel.vue` + 3 contract actions |
| Events | — | MISSING | `EventsPanel.vue` + `GET_SCHOOL_EVENTS`, `PUBLISH_SCHOOL_EVENT` |
| Notifications | AppShell bell + `GET_NOTIFICATIONS` | PARTIAL | `NotificationsPanel.vue` with the origin's nine tabs; added optional `Kind` so per-module tabs discriminate |
| Profile | account menu only | MISSING | `ProfilePanel.vue` + `GET_MY_PROFILE`, `UPDATE_TEACHER_PROFILE` |
| Notice board | `/notices/` document (D-64) | COMPLETE | reused, not duplicated |
| Academic calendar | `/calendar/` document (D-64) | COMPLETE | reused, not duplicated |
| Exam-paper authoring | `TeacherView.vue` drafts/compose/notices | COMPLETE | **untouched** — kept side by side, per the agreed scope |
| Notification raising | `raiseNotification` in `mock.ts` | PARTIAL | bridged so every teacher-portal action raises a real notification |

## Files added

```
src/types/teacher.ts                            14 entities + status vocabularies
src/api/mockTeacher.ts                          49 actions, seed data, origin validation
src/components/teacher/
  teacher-panel.css                             shared table / form / button vocabulary
  TeacherModuleShell.vue                        heading + toolbar + loading/error/empty + banner
  TeacherStatusBadge.vue                        per-module status badges
  TeacherReviewerPicker.vue                     300 ms debounced reviewer picker
  useTeacherSession.ts                          schoolID / username / role
  TeacherDashboardPanel.vue
  LessonPlansPanel.vue
  WeeklyReportsPanel.vue
  ClassTeacherReportsPanel.vue
  LessonApprovalPanel.vue
  LeavePanel.vue
  HrQueriesPanel.vue
  CounsellingPanel.vue
  DisciplinaryPanel.vue
  MessagingPanel.vue
  EventsPanel.vue
  NotificationsPanel.vue
  ProfilePanel.vue
docs/teacher-portal/*.md                        this documentation set
docs/teacher-portal/screenshots/*.png           13 panel captures
```

## Files changed

| File | Change |
|---|---|
| `src/types/index.ts` | optional `PortalNotification.Kind` |
| `src/api/contract.ts` | +49 actions in `ApiMap`, `GET_ACTIONS`, `POST_ACTIONS` |
| `src/api/mock.ts` | `attachTeacherHandlers` bridge; `Handlers` became `Partial` with an explicit no-handler branch; notification-kind map |
| `src/lib/permissions.ts` | +38 codes, +46 action mappings, labels, module labels |
| `src/lib/roles.ts` | teacher defaults extended; documented divergences |
| `src/lib/nav.ts` | teacher rail rebuilt into 5 groups; breadcrumb `Question Studio` → `Teacher Portal` |
| `src/views/TeacherView.vue` | 13 panel mounts; `TABS` mirror of the rail ids; per-panel data loading |
| `src/components/AppShell.vue` | two icons (`file`, `pen`) |
| `teacher/index.html` | document title |
| `tools/gen-entries.mjs`, `tools/gen-build-log.mjs` | console name |

## Architecture decisions

**Panels, not routes.** The origin has 50 nested Next.js routes; this portal is a
flat Vite multi-page app where each role is one document with a panel rail. Each
origin module became a panel; each module's status tabs became filters on one
table. Documented in `routes.md`.

**Both lifecycles kept.** LAEC's `DRAFT → PENDING_REVIEW → LIVE | REJECTED` exam-paper
flow and the origin's `draft → pending → approved | rejected` lesson-plan flow are
separate entities with separate vocabularies. Merging them would lose the
distinction between authoring a paper and authoring a plan.

**No new dependencies.** The origin uses TipTap, KaTeX, jsPDF, socket.io-client,
xlsx and zustand. LAEC has none of them and gained none.

## What was deliberately not built

| Omission | Reason |
|---|---|
| PDF export | needs `jsPDF` and a blob transport |
| File upload / download | `callApi` returns a typed envelope, not a `Blob` |
| Realtime messaging | needs a socket; LAEC's transport is request/response |
| Rich-text editor | needs TipTap; plain textareas carry the same field values |
| Signature scripts | needs a webfont pipeline |
| Weekly-planner board | same data, available as a status filter |
| Bulk review actions | PDF/forward/share dependencies |
| Committee member add/remove | admin-shaped; the teacher read view is kept |
| Payroll profile fields | no payroll surface or role to read one |