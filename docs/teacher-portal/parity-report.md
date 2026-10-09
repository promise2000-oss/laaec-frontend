# Parity Report

Original (`saintfinbarrscollege.com`) vs local (`laaec-audit`, `/teacher/`).

**Read the caveat first.** The original could not be observed at runtime: every
`api.saintfinbarrscollege.com` endpoint answers `401`, `/login` offers no demo
account, and no credentials were supplied. Ground truth is therefore the deployed
application's **own source**, which is present locally and whose routes, titles
and API base match the deployment. Every row below compares source-derived
behaviour to the port. No row is a live side-by-side capture, and none claims to
be. Where source could not settle a question, the row says `UNKNOWN`.

`MATCH` = reproduced · `DIVERGENT (declared)` = differs, with the reason given ·
`PARTIAL` = the module works but omits named capabilities · `NOT PORTED`.

## Module parity

| Module | Match | Notes |
|---|---|---|
| Dashboard | DIVERGENT (declared) | 10 tiles vs the origin's `unified-dashboard`; the origin's `results.upload`/`store.browse` tiles have no UI behind them and were omitted |
| Lesson planning — list | MATCH | columns, week/date fallbacks, no search/sort/pagination, edit/delete gating, delete copy, empty copy |
| Lesson planning — validation | MATCH | three rules, in order, **on submit only** so a draft saves empty |
| Lesson planning — form | PARTIAL | fields and the class select match; the repeaters, the 2500 ms autosave and the file upload are not built |
| Lesson planning — detail | PARTIAL | content and the `—` fallback match; the Times New Roman print layout does not |
| Lesson planning — reviewer picker | MATCH | 300 ms debounce, self-exclusion, `"No users found."`, both footer sentences |
| Lesson planning — weekly planner | NOT PORTED | same data, available as a status filter |
| Review Inbox | PARTIAL | tabs, caption, 400 ms search, `canActOn` gate and tooltip, approve/reject copy, success banners; PDF, bulk, forward and chat-share are not built |
| Weekly report — list | MATCH | columns, delete confirmation and its 4000 ms auto-hide, empty copy |
| Weekly report — validation | MATCH | four rules **on every save**, which is the asymmetry against lesson plans |
| Weekly report — checklists | MATCH | five banners, 4 seeded rows, add/remove, comment fields, trim-and-drop-unticked |
| Weekly report — review | MATCH | level toggle, head-pre-selection, required comment, `hod` vs `head` semantics |
| Weekly report — manage | MATCH | including rendering as cards rather than a table, because the origin has no table there |
| Class-teacher report | MATCH | **including the absent validation** — a blank form saves, which is the deliberate contrast |
| Class-teacher report — attendance | MATCH | 400 ms debounce, abort, refire on class/range, error copy |
| Class-teacher report — share | MATCH | superiors list, client-side filter, empty copy |
| Class-teacher report — review step | MATCH | **there is none, in both** |
| Leave — list | MATCH | uppercase status vocabulary, tabs, search, empty copy |
| Leave — validation | MATCH | five messages in order, inclusive day count, `min` on end date |
| Leave — decide | MATCH | approve/reject on `PENDING` with **no permission check** |
| HR queries — list | MATCH | four tabs, subject+category cell, priority/status badges |
| HR queries — form | MATCH | **Offence** label, recipient typeahead, three validation messages |
| HR queries — manage card | MATCH | and its missing permission check |
| Counselling — book | MATCH | ≥2-char typeaheads, auto-select, **silent refusal** |
| Counselling — New Report gate | MATCH | `You do not have permission to create counselling reports.` |
| Counselling — committees | PARTIAL | list and create; member add/remove not built |
| Counselling — reports | PARTIAL | list, create, detail; no blob download |
| Disciplinary — case types | MATCH | the misnamed route's real behaviour, soft delete, `Inactive` badge, the origin's empty copy |
| Disciplinary — launch | MATCH | typeaheads, silent refusal, auto case number, notification |
| Disciplinary — cases | PARTIAL | filters, statuses, severities; no blob download or share |
| Messaging — layout | MATCH | two panes, tabs, search, `initials()`, all four preview strings, mark-read on open |
| Messaging — realtime | DIVERGENT (declared) | the origin is socket-driven; this portal is request/response, so nothing arrives live |
| Messaging — attachments | NOT PORTED | no blob transport |
| Events | MATCH | category labels, date badge, create gated on a permission the button removes |
| Notice board | COMPLETE | already existed at `/notices/` (D-64); reached as a document, not duplicated |
| Academic calendar | COMPLETE | already existed at `/calendar/` (D-64) |
| Notifications | MATCH | nine tabs, mark-all-read **on mount**, per-item read, deep links |
| Profile | PARTIAL | identity fields, both option lists; payroll and avatar omitted |

## Cross-cutting parity

| Behaviour | Match |
|---|---|
| Lifecycle vocabularies kept distinct (`pending` vs `PENDING_REVIEW`; `submitted` vs `pending`) | MATCH |
| Status badge inconsistency preserved (raw string in the class-teacher module) | MATCH |
| Uppercase leave statuses despite a lowercase type | MATCH |
| Ownership gates on edit and delete | MATCH |
| Assigned-reviewer gate on approve/reject, with its tooltip | MATCH |
| Silent refusals reproduced rather than "fixed" | MATCH |
| LAEC's exam-paper flow kept alongside, not replaced | MATCH (per the agreed scope) |
| Origin's permission gaps that would hide HR Queries and Counselling | DIVERGENT (declared) — closed here; see `permissions.md` §3 |
| `isAdminLike` fallback | DIVERGENT (declared) — LAEC has no exempt role by design |

## Where parity was impossible, and why

1. **API-level parity.** LAEC's backend contract has no lesson-plan, leave,
   counselling or disciplinary endpoints. The port is UI and behavioural parity
   over mock actions. There is nothing to be at parity *with*.
2. **Realtime.** No socket transport.
3. **Binary output.** No blob transport, so no PDF and no attachment upload.
4. **Typography.** The print-shaped lesson-plan document and the signature scripts
   need a font pipeline LAEC does not have.

## Remaining work

Ordered by what a reviewer would notice first.

| | Item |
|---|---|
| 1 | Lesson-plan repeaters — objectives, lesson content, presentation steps, student activities — and the 2500 ms autosave. These are the largest content gap in the largest module. |
| 2 | A blob transport, which unlocks PDF export, the file upload and the case-report downloads in one change. |
| 3 | Realtime messaging, if a socket or long-poll is ever added to the transport. |
| 4 | The Weekly Planner board. |
| 5 | Committee member add/remove. |
| 6 | Rich-text editing, if TipTap is ever adopted. |
| 7 | Committee add/remove and bulk actions in the Review Inbox — the same PDF/forward/share dependencies as row 2. |
| 8 | Authenticated comparison against the live portal, the moment authorized teacher credentials exist. Until then no row in this report is a live capture, and every one of them says so. |