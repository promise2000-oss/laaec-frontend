# API observations — the boundary

Labels are per `README.md`.

## The one thing that decides the implementation

**The live admin portal does not talk to LAEC.** Its API base is
`https://api.saintfinbarrscollege.com` — a separate service, with its own auth
and its own data model. This project is a LAEC CBT portal with a mock API
(`src/api/mock.ts`). There is no endpoint here that can reach
`api.saintfinbarrscollege.com`, and nothing should try.

**SOURCE** — `lib/api/endpoints.ts` in the deployed application hard-codes that
base, and **OBSERVED** — the network probe recorded 42 calls, every one of them
either to that host or to the app's own origin.

So the 42 observed calls are documentation of a contract this project mirrors
rather than calls it makes, and the contract in `src/api/contract.ts` is the local
stand-in.

## What was observed

42 calls, deduplicated to 42 unique method+host+path pairs, captured in the
signed-in session. **Only method, host, path, query-parameter *names* and body
*key names* were recorded** — never a header, never a value, never a token. See
`README.md` § Safety rules.

### To the API host

| Method | Path | Query keys |
|---|---|---|
| GET | `/auth/me` | — |
| GET | `/notifications` | — |
| GET | `/academic/sessions` | — |
| GET | `/academic/classes` | — |
| GET | `/academic/subjects` | — |
| GET | `/communication/conversations` | — |
| GET | `/communication/unread-count` | — |
| GET | `/dashboard/stats` | — |
| GET | `/inventory/reports/summary` | — |
| GET | `/results/grading-scale` | — |
| GET | `/roles` | — |
| GET | `/students` | `page`, `limit` |
| GET | `/users` | `page`, `limit` |

Thirteen distinct API calls. **OBSERVED**

### To the app's own origin

The other 29 are Next.js App Router **RSC** requests: `GET /students?_rsc`,
`GET /leave/approvals?_rsc` and so on, one per route visited, each carrying the
`_rsc` query parameter. These are the framework fetching route payloads, not the
application calling its API. They are listed in `route-inventory.md` by route.

One `POST /cdn-cgi/rum` to the app origin is a Cloudflare RUM beacon. Not an
application call.

## The endpoint map from source

The deployed application's `lib/api/endpoints.ts` is a single object of path
templates — 622 lines, no logic. Grouped by domain, with the count of templates
per group:

| Group | Templates | Shape |
|---|---|---|
| `auth` | 9 | login, refresh, logout, me, profile, forgot/reset/change password, select-role, accept-invite |
| `users` | 10 | list, byId, activate, deactivate, suspend, delete, pending-invitations, resend-invitations, activity *(not wired to a backend — the comment says so)* |
| `roles` | 4 | list, byId, assign, remove |
| `permissions` | 9 | list, byId, assign, remove, assign-user, remove-user, assign-many, remove-many, assign-user-many, remove-user-many |
| `departments`, `designations` | 2 + 2 | list, byId |
| `staff` | 8 | list, byId, import, importConfirm, resendInvitation, delete |
| `students` | 8 | list, byId, import, importConfirm, parentChildren, myChildren, guardianLookup, delete, linkParent |
| `parents` | 3 | list, byId, delete |
| `notifications` | 3 | list, markRead, markAllRead |
| `attendance` | 6 | register, sheets, createSheet, sheetById, weeks, weekById, marks |
| `leave` | 6 | types, requests, requestById, approve, reject, delete |
| `academic` | 24 | sessions, classes, sections, subjects, users, calendar, timetables, assignments, class-routines, class-teachers, subject-teachers, each with byId and the verbs |
| `lessonPlans` | 8 | list, review-queue, manage, byId, submit, review, document |
| `weeklyReports` | 6 | list, manage, byId, submit, review |
| `classTeacherWeeklyReports` | 8 | list, my-classes, attendance-preview, byId, superiors, share |
| `messaging` | 17 | conversations, direct, group, messages, share, upload, delete, forward, file, read, members |
| `calendar`, `noticeBoard`, `events` | 2 + 5 + 4 | list, byId, markRead, unreadCount |
| `disciplinary` | 24 | incidents, committees, members, students, users, cases, status, comments, share, download, plus a parent-scoped subtree |
| `counselling` | 20 | committees, members, students, users, cases, status, comments, reports, share, download |
| `system` | 12 | audit-logs, feature-toggles, backups, backup-history, integrations, and a `settings` group of 8 keyed sub-paths |
| `inventory` | 16 | categories, stock, low, restock, clinic, suppliers, reports/summary, assets, images, sales, next-invoice |
| `results` | 28 | windows, upload (csv/pdf), queue, vet/publish/decline/tag-committee, student results, report cards, attendance, domain ratings, comments, grading scale, prior-term data, compute-stats |
| `store` | 20 | browse, cart, checkout, mark-paid, pay, verify, orders, queue, confirm, resolve-refund |
| `schoolFees` | 18 | categories, items, breakdown, payments, children, initiate, verify, reports summary |
| `wallets` | 12 | list, mine, child, topup, deduct, transactions, threshold, funding, reports summary |
| `payments` | 1 | checkout session |

**SOURCE.** Two observations worth drawing out:

1. **Three settings sub-paths exist for pages that fail.** `system.settings` has
   `general`, `academic`, `notifications`, `branding`, `limits`, `security`,
   `maintenance` and `all`. The three that fail live are three of the eight. So
   the failure is in those three specific reads, not in the settings surface —
   which is why reproducing them as error cards is right and reproducing them as
   working forms would be wrong.
2. **`users.activity` is annotated in the source as not wired to a backend.** The
   app calls an endpoint that does not exist. That is why the audit's row-action
   probe found `users` offering five actions but could not open an activity view:
   there is nothing behind the fifth.

## How this project's contract is shaped

`src/api/contract.ts` declares 163 actions in one map, each with a request and a
response shape. `src/api/mock.ts` enforces a permission on every POST before a
handler runs. The admin modules added **42 actions** on top of the existing LAEC
set — **17 reads and 25 writes**:

### Reads (17)

| Group | Actions |
|---|---|
| Generic engine | `LIST_ADMIN_RECORDS`, `GET_ADMIN_RECORD`, `GET_ADMIN_OPTION_LIST` |
| Attendance | `LIST_ADMIN_ATTENDANCE_SHEETS`, `GET_ADMIN_ATTENDANCE_REPORT` |
| Academics | `LIST_CLASSES`, `LIST_ARMS`, `LIST_TIMETABLES`, `GET_DASHBOARD_SUMMARY`, `LIST_QUICK_ACTIONS` |
| Inventory / store / fees | `GET_ADMIN_INVENTORY_REPORTS`, `LIST_ORDERS`, `GET_ADMIN_FEE_BREAKDOWN`, `GET_ADMIN_FEE_REPORTS`, `GET_ADMIN_WALLET_REPORTS` |
| Results | `LIST_UPLOAD_WINDOWS`, `GET_RESULTS_ENTRY`, `LIST_RESULTS_QUEUE`, `GET_GRADING_SETTINGS`, `GET_STUDENT_RESULTS`, `GET_REPORT_CARD` |
| System | `GET_ADMIN_GENERAL_SETTINGS`, `GET_ADMIN_SYSTEM_CONFIGURATION` |

### Writes (25)

| Group | Actions |
|---|---|
| Generic engine | `SAVE_ADMIN_RECORD`, `DELETE_ADMIN_RECORD`, `ADMIN_DECIDE`, `ADMIN_SET_STATUS`, `DELETE_ADMIN_ACCESS`, `SAVE_ADMIN_ROLE`, `ASSIGN_ROLE`, `UNASSIGN_ROLE`, `SAVE_ADMIN_PERMISSION_GRANT`, `RESEND_INVITATION`, `IMPORT_STAFF`, `IMPORT_STUDENTS`, `CONFIRM_IMPORT` |
| Attendance | `CREATE_ATTENDANCE_SHEET`, `SAVE_ATTENDANCE_SHEET`, `SAVE_ATTENDANCE_MARKS` |
| HR | `LIST_HR_QUERIES`, `ISSUE_HR_QUERY`, `RESOLVE_HR_QUERY`, `LIST_AWARDS`, `SAVE_AWARD` |
| Inventory / store / fees | `SAVE_STOCK_MOVEMENT`, `ADD_TO_CART`, `SET_ORDER_STATUS`, `RECORD_FEE_PAYMENT` |
| Money | `ADJUST_WALLET` |
| Results | `SAVE_UPLOAD_WINDOW`, `SAVE_RESULT_ENTRIES`, `DECIDE_RESULT`, `SAVE_GRADING_SETTINGS` |
| System | `SAVE_GENERAL_SETTINGS`, `SAVE_SYSTEM_CONFIGURATION`, `SAVE_ADMIN_BRANDING` |

### One place, enforced once

The permission each write requires is declared once, in
`src/lib/permissions.ts`, and enforced in `callApi` — one place, for all six
consoles and both new surfaces. `tools/check-rbac.mjs` resolves every write
against the registry and **fails closed** on any that cannot be resolved, which is
the check that makes "the button is not there" and "the write is refused" the
same fact rather than two.

## What was NOT observed

- **No write request was observed.** The safety rule for this audit was
  navigation and open-and-dismiss only, so every captured call is a GET. The
  write paths documented above are **SOURCE**, not observed traffic.
- **No non-200, no error body, no pagination beyond page/limit.** The probe
  recorded shapes, not statuses beyond the route's own.
- **No authentication call.** The login request was made by the audit's own
  tooling before observation began, and is deliberately not reproduced here.

## Read next

`roles-and-permissions.md` for the enforcement model, `api-observations.md`'s
sibling `workflows.md` for what was driven against the mock.