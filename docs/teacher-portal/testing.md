# Testing

## Method

Browser verification with Playwright against `npm run dev`, driven as a signed-in
teacher session. Static contracts re-run after every change.

**Credentials** (mock, seeded in `src/api/mock.ts`):
`teacher@nicegeneco.com` / `Teacher@2026`.

## Automated contracts

| Command | Result |
|---|---|
| `npx vue-tsc --noEmit` | clean |
| `npm run build` | clean, 18 HTML entries |
| `node tools/check-doors.mjs` | 6 doors, 6 roles, routes/body classes/build inputs/documents all agree |
| `node tools/check-rbac.mjs` | 66 codes, 6 roles, 112 grants, 21 guarded nav entries, 75 mapped writes, all invariants hold |
| `node tools/check-layers.mjs` | 15 tokens ascending, 72 z-index declarations all tokenised |

## Workflow results

| # | Workflow | Cases exercised | Result |
|---|---|---|---|
| W1 | Login + guard | valid login; no session → `/control/` | **PASS** |
| W2 | Lesson plan: draft saves empty | `Save Draft` on a blank form | **PASS** — saved, banner shown |
| W2 | Lesson plan: submit validation | empty → class+subject → all three | **PASS** — `Class is required` → `Topic is required` → success; row appears under Pending Review |
| W3 | Review Inbox: approve | dialog → confirm | **PASS** — banner `Approved "Sets" by MOCK TEACHER ONE.`, row leaves Pending, empty state shown |
| W4 | Weekly report: draft validation | blank `Save Draft` | **PASS** — refused with `Week of report is required` |
| W4 | Weekly report: save | four required fields filled | **PASS** — `Weekly report saved as a draft.`, list 1 → 2 |
| W5 | Class report: no validation | blank `Save Draft` | **PASS** — saved with no message, as the origin does |
| W6 | Leave: validation order | 3 partial submissions | **PASS** — `Enter a leave type` → `Select the leave dates` → `Provide a reason for the leave` |
| W6 | Leave: duration + submit | single-day range | **PASS** — `1 working day(s) requested`; success card with the origin's sentence |
| W7 | HR query: validation | blank submit | **PASS** — `Select the recipient` |
| W7 | HR query: typeahead | query `MOCK` | **PASS** — 5 results, caller excluded |
| W7 | HR query: submit | recipient + subject + description + offence + priority | **PASS** — banner; row shows `Facilities` / `high` / `OPEN` |
| W8 | Counselling: silent refusal | incomplete `Book session` | **PASS** — no alert, no banner, form stays |
| W8 | Counselling: book | complete | **PASS** — `Case CNS-002 launched.` |
| W9 | Disciplinary: add case type | title + description | **PASS** — `"Theft" saved.`; 3 types listed |
| W9 | Disciplinary: silent refusal | incomplete `Launch case` | **PASS** — no feedback |
| W9 | Disciplinary: launch | complete | **PASS** — `Case DISC-002 launched.` |
| W10 | Message send | typed and sent | **PASS** — appended with sender and timestamp |
| W11 | Notification tabs | all nine | **PASS** — Leave and Discipline each show only their own module's items |
| W12 | Profile | loads and renders | **PASS** |
| — | All 13 panels | render with seeded data | **PASS** |

## Defects found and fixed during testing

| # | Defect | Fix |
|---|---|---|
| 1 | An empty success banner rendered on every panel (a `<template #banner>` slot is always *present*, so the presence test never failed) | `banner` became a prop on `TeacherModuleShell`; the test is now on content |
| 2 | `New Lesson` opened nothing — the form was keyed on `openId`, which is empty for an unsaved plan | added a separate `draft` ref; the form keys on `subject = draft ?? openPlan` |
| 3 | Class could never satisfy `Class is required`, because the field was free text bound to `className` while the rule checks `classId` | restored the origin's class `<select>` of ids with a change handler that sets the name |
| 4 | Teacher-portal notifications never reached the notification centre | `GET_NOTIFICATIONS` was called without `role`, and role-addressed items require it |
| 5 | Discipline and Counselling filter tabs were indistinguishable — both mapped to the same LAEC category | added an optional `PortalNotification.Kind` rather than distorting `Category`; tabs now match on `Kind` or `Category` |
| 6 | Teacher-portal mock data was owned by a hard-coded username no session held, so every count read 0 | derived from `MOCK_ADMINS`; the directory is built from the roster too |
| 7 | Four modals used `var(--z-modal, 8000)`, violating the layer contract | `var(--z-modal)` |

## Not tested / UNKNOWN

| | Why |
|---|---|
| The deployed portal's runtime behaviour | every endpoint returns 401; no credentials were supplied and bypassing auth is out of scope |
| Refresh, back/forward and deep-link persistence inside a panel | panels hold their sub-view in component state; verified by re-navigation only |
| Session expiry mid-task | the admin idle timeout fired during inspection and behaved correctly (`/control/`), but no long-running task was observed through it |
| Narrow-viewport layout | reasoned from the CSS and the portal's own breakpoints, not screenshot-compared |
| Concurrent sessions | a single browser session was used throughout |