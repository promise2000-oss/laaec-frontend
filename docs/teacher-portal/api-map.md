# API Map

## Origin transport

`lib/api/client.ts`:

```
API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api"
MOCK_ENABLED = !process.env.NEXT_PUBLIC_API_URL
```

- `apiFetch<T>(path, {body, public?, ...})`, `apiUpload<T>(path, file, extraFields?)`,
  `apiDownload(path) → {blob, contentType, filename}`.
- Auth header omitted for `PUBLIC_PATHS` (`/auth/login`, `/auth/refresh`,
  `/auth/forgot-password`, `/auth/reset-password`, `/auth/invite/accept`).
- Single-flight refresh on 401 → `POST /auth/refresh` → retry once → else
  `clearSession()` + `/login`.
- Envelope: `ApiResponse<T> = {success, message, data}`. Three unwrap conventions
  coexist in the origin (`use-api-resource` auto-unwraps; `lesson-plans.ts` /
  `weekly-reports.ts` unwrap `.data`; `communication.ts` / `counselling.ts` /
  `disciplinary.ts` read `.data` off a `{data:T}` type).
- `useApiResource` treats **404 as success with no data** unless
  `treat404AsError` — it logs
  `[api] <path> -> 404 (endpoint unavailable); treating as empty`.

## Live responses observed (unauthenticated)

`https://api.saintfinbarrscollege.com` — every request from the unauthenticated
portal shell answers `401`, which is the evidence that the base URL is live and the
token gate is real:

| Endpoint (as called) | Status |
|---|---|
| `GET /dashboard/stats` | 401 |
| `GET /notifications` | 401 |
| `GET /academic/sessions` | 401 (called twice on mount) |

---

## Origin endpoint → LAEC contract action

LAEC has no HTTP endpoints; it has the 38-action `callApi(action, req)` contract
(`src/api/contract.ts`), which mirrors LAEC's own Lambda `action` parameter. The
teacher portal therefore gets new actions rather than new URLs.

Every action below is added to `ApiMap` and to `GET_ACTIONS` / `POST_ACTIONS`.
Every POST action is additionally listed in `ACTION_PERMISSIONS`
(`src/lib/permissions.ts`), which `callApi` uses as its single enforcement point.

### Reads — `GET_ACTIONS`

| LAEC action | Origin endpoint | Payload / query |
|---|---|---|
| `GET_TEACHER_DASHBOARD` | `/dashboard/stats` | aggregate counts |
| `GET_LESSON_PLANS` | `GET /lesson-plans` | `status?`, `page`, `limit` |
| `GET_LESSON_PLAN_QUEUE` | `GET /lesson-plans/manage` | `status?`, `search?`, `page`, `limit`, `assignedToMe` |
| `GET_WEEKLY_REPORTS` | `GET /weekly-reports` | `status?`, `page`, `limit` |
| `GET_WEEKLY_REPORT_QUEUE` | `GET /weekly-reports/manage` | `status?`, `search?`, `page`, `limit` |
| `GET_CLASS_TEACHER_REPORTS` | `GET /class-teacher-weekly-reports` | `status?`, `page`, `limit` |
| `GET_MY_CLASS_TEACHING` | `GET /class-teacher-weekly-reports/my-classes` | — |
| `GET_ATTENDANCE_PREVIEW` | `GET …/attendance-preview` | `className`, `from`, `to` |
| `GET_CLASS_TEACHER_SUPERIORS` | `GET …/superiors` | — |
| `GET_LEAVE_REQUESTS` | `GET /leave/requests` | `status?`, `search?` |
| `GET_HR_QUERIES` | `GET /hr-queries` | `status?`, `search?` |
| `GET_COUNSELLING_COMMITTEES` | `GET /counselling/committees` | — |
| `GET_COUNSELLING_CASES` | `GET /counselling/cases` | `search`, `status`, `academicSessionId`, `page` |
| `GET_COUNSELLING_REPORTS` | `GET /counselling/reports` | `search`, `caseId`, `status`, `page`, `limit` |
| `GET_DISCIPLINARY_INCIDENT_TYPES` | `GET /disciplinary/incidents` | — |
| `GET_DISCIPLINARY_COMMITTEES` | `GET /disciplinary/committees` | — |
| `GET_DISCIPLINARY_CASES` | `GET /disciplinary/cases` | `search`, `studentId`, `caseTypeId`, `status`, `academicSessionId`, `from`, `to`, `page` |
| `GET_TEACHER_DIRECTORY` | `GET /communication/users` | `search?`, excludes self, `status === 'active'`, cap 20 |
| `GET_TEACHER_CONVERSATIONS` | `GET /communication/conversations` | — |
| `GET_TEACHER_MESSAGES` | `GET …/:id/messages` | `limit=50`, `cursor?` |
| `GET_SCHOOL_EVENTS` | `GET /communication/events` | — |
| `GET_MY_PROFILE` | `GET /auth/me` | — |

### Writes — `POST_ACTIONS`

| LAEC action | Origin endpoint | Permission | Body |
|---|---|---|---|
| `SAVE_LESSON_PLAN` | `POST /lesson-plans`, `PATCH /lesson-plans/:id` | `lesson-plans.create` / `lesson-plans.update` | lesson plan + `status` |
| `DELETE_LESSON_PLAN` | `DELETE /lesson-plans/:id` | `lesson-plans.delete` | — |
| `SUBMIT_LESSON_PLAN` | `POST /lesson-plans/:id/submit` | `lesson-plans.submit` | `{reviewerUsername?}` |
| `REVIEW_LESSON_PLAN` | `POST /lesson-plans/:id/review` | `lesson-plans.review` | `{status:'approved'\|'rejected', remark?, signature?, signatureStyle?}` |
| `SAVE_WEEKLY_REPORT` | `POST /weekly-reports`, `PATCH /weekly-reports/:id` | `weekly-reports.create` / `.update` | weekly report + `status` |
| `DELETE_WEEKLY_REPORT` | `DELETE /weekly-reports/:id` | `weekly-reports.delete` | — |
| `SUBMIT_WEEKLY_REPORT` | `POST /weekly-reports/:id/submit` | `weekly-reports.submit` | `{reviewerUsername?}` |
| `REVIEW_WEEKLY_REPORT` | `POST /weekly-reports/:id/review` | `weekly-reports.review` | `{level:'hod'\|'head', comment, signature?, signatureStyle?}` |
| `SAVE_CLASS_TEACHER_REPORT` | `POST`/`PATCH /class-teacher-weekly-reports` | `class-reports.create` / `.update` | class-teacher report + `status` |
| `DELETE_CLASS_TEACHER_REPORT` | `DELETE /class-teacher-weekly-reports/:id` | `class-reports.delete` | — |
| `SUBMIT_CLASS_TEACHER_REPORT` | `POST /class-teacher-weekly-reports` (status) | `class-reports.submit` | `{id, status}` |
| `SHARE_CLASS_TEACHER_REPORT` | `POST …/:id/share` | `class-reports.read` | `{username}` |
| `APPLY_FOR_LEAVE` | `POST /leave/requests` | `leave.create` | `{staffId, leaveType, startDate, endDate, days, reason}` |
| `DECIDE_LEAVE` | `PATCH /leave/requests/:id/{approve,reject}` | `leave.approve` | `{decision, comment?}` |
| `DELETE_LEAVE_REQUEST` | `DELETE /leave/requests/:id` | `leave.approve` | — |
| `RAISE_HR_QUERY` | `POST /hr-queries` | `queries.issue` | `{title, description, targetUsername, category, priority}` |
| `UPDATE_HR_QUERY` | `PATCH /hr-queries/:id` | `queries.read` | `{status?, assigneeUsername?}` |
| `SAVE_COUNSELLING_COMMITTEE` | `POST`/`PATCH /counselling/committees` | `counselling.committees.manage` | committee |
| `DELETE_COUNSELLING_COMMITTEE` | `DELETE /counselling/committees/:id` | `counselling.committees.manage` | — |
| `LAUNCH_COUNSELLING_CASE` | `POST /counselling/cases` | `counselling.cases.book` | booking payload |
| `UPDATE_COUNSELLING_CASE_STATUS` | `PATCH /counselling/cases/:id/status` | `counselling.cases.view` | `{status}` |
| `ADD_COUNSELLING_CASE_COMMENT` | `POST /counselling/cases/:id/comments` | `counselling.cases.view` | `{comment}` |
| `SAVE_COUNSELLING_REPORT` | `POST`/`PATCH /counselling/reports` | `counselling.reports.manage` | report |
| `SHARE_COUNSELLING_REPORT` | `POST /counselling/reports/:id/share` | `counselling.reports.view` | `{conversationId?}` |
| `SAVE_DISCIPLINARY_INCIDENT_TYPE` | `POST`/`PATCH /disciplinary/incidents` | `disciplinary.incidents.manage` | `{title, description?}` |
| `DELETE_DISCIPLINARY_INCIDENT_TYPE` | `DELETE /disciplinary/incidents/:id` | `disciplinary.incidents.manage` | — |
| `SAVE_DISCIPLINARY_COMMITTEE` | `POST`/`PATCH /disciplinary/committees` | `disciplinary.committees.manage` | committee |
| `DELETE_DISCIPLINARY_COMMITTEE` | `DELETE /disciplinary/committees/:id` | `disciplinary.committees.manage` | — |
| `LAUNCH_DISCIPLINARY_CASE` | `POST /disciplinary/cases` | `disciplinary.cases.launch` | launch payload |
| `UPDATE_DISCIPLINARY_CASE_STATUS` | `PATCH /disciplinary/cases/:id/status` | `disciplinary.cases.view` | `{status}` |
| `ADD_DISCIPLINARY_CASE_COMMENT` | `POST /disciplinary/cases/:id/comments` | `disciplinary.cases.view` | `{comment}` |
| `SHARE_DISCIPLINARY_CASE` | `POST /disciplinary/cases/:id/share` | `disciplinary.cases.view` | `{method:'PARENT'\|'CHAT', conversationId?}` |
| `SEND_TEACHER_MESSAGE` | `POST /communication/conversations/:id/messages` | `communication.messages.send` | `{body}` |
| `CREATE_TEACHER_CONVERSATION` | `POST /communication/conversations/direct` | `communication.messages.send` | `{username}` |
| `MARK_TEACHER_CONVERSATION_READ` | `POST /communication/conversations/:id/read` | `communication.messages.send` | — |
| `UPDATE_TEACHER_PROFILE` | `PATCH /auth/profile` | `teacher.read` | profile fields |
| `PUBLISH_SCHOOL_EVENT` | `POST /communication/events` | `communication.events.create` | event |

## Origin endpoints with no teacher-portal equivalent

| Endpoint | Why not ported |
|---|---|
| `GET /lesson-plans/:id/document`, `POST`/`DELETE /lesson-plans/:id/document` | File upload/download. LAEC's console has no attachment surface; the supporting-document field is captured as a **filename string** only. Recorded as a deliberate divergence. |
| `POST …/:id/messages/lesson-plan` | Lesson-plan sharing into a chat. Skipped: no document-to-chat attachment model locally. |
| `POST …/:id/messages/upload`, `DELETE …/:id/messages/:messageId`, `…/forward`, `GET …/:id/files/:messageId` | Attachment and message-management actions. Messaging is ported text-only. |
| `DELETE /communication/conversations/:id/group`, `POST …/group`, `DELETE …/:id/members/:userId` | Group-conversation administration is not exposed to a teacher in the origin's own nav. |
| `/disciplinary/parent/**`, `/counselling/…/parent/**` | Parent portal. |
| `/staff`, `/staff/import`, `/users/**`, `/roles/**`, `/permissions/**` | Admin/HR. |
| `/attendance/**`, `/results/**`, `/store/**`, `/school-fees/**`, `/wallets/**`, `/inventory/**` | Other roles. Note `RESULTS_UPLOAD_PERMISSIONS` and `STORE_BROWSE_PERMISSIONS` **are** in the origin's teacher default grant but have no teacher UI. |
| Socket.IO transport | LAEC's mock adapter is request/response only. Realtime is documented and mocked via a `SET_MOCK_DELAY`/event-emitter seam rather than a live socket. |

## Origin mock-runtime gaps that shaped this port

`lib/api/mock-data.ts` has **no handler for `/lesson-plans/**` or
`/class-teacher-weekly-reports/**`** and no `db.lessonPlans` collection at all, so
in the origin's own mock mode the two largest teacher modules are non-functional
(their requests fall through to a real fetch and `useApiResource` silently swallows
the 404 as empty). `db.weeklyReports` is seeded empty. The mock also seeds only
three roles (`super admin`, `admin`, `hr`) and login always signs in as
Adaeze Okafor, so **there is no teacher identity to exercise the portal against**.

Consequence for this port: the LAEC mock must seed a **teacher** session and must
provide real handlers and seed rows for all three document modules, otherwise the
same failure mode is reproduced locally.

## Envelope

LAEC keeps its observed flat envelope `{status: 'success'|'error', message?, <payload>}`
rather than adopting the origin's `{success, message, data}`. Every handler therefore
returns `status` and the payload at the top level, matching the existing 38 actions.