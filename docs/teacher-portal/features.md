# Feature Inventory — St Finbarr's Teacher Portal

Every feature discovered in the deployed portal, module by module. Field names,
status strings, validation copy and empty-state copy are transcribed from the
application's own source; nothing here is inferred.

Legend for **Ported**:
`FULL` — every observed behaviour present ·
`PARTIAL` — present, with a named divergence ·
`NO VALIDATION` — present and deliberately permissive where the origin is ·
`NOT PORTED` — observed but deliberately omitted, with the reason.

---

## 1. Dashboard

**Origin:** `/dashboard` · `src/components/unified-dashboard.tsx` · `GET /dashboard/stats`

| | |
|---|---|
| Purpose | Landing page for every role; count tiles linking into the work they count |
| Role | Teacher (and every other role) |
| Data | `GET /dashboard/stats`, plus the messaging and communication stores |
| **Ported** | **PARTIAL** — ten tiles, each linking to its panel |
| Not ported | `results.upload.*` and `store.browse` tiles: the origin grants a teacher those permissions but builds no UI for them, so there is no screen to link to |

---

## 2. Lesson planning

**Origin:** 10 routes under `/teacher/lesson-planning/` · `lib/api/lesson-plans.ts`

### 2.1 List (`LessonTable`)

| | |
|---|---|
| Columns | Subject, Teacher, Class, Topic, Week, Date, Status, Actions |
| Week cell | `Week {n}`, or `—` when unset |
| Date cell | `startDate`, falling back to `createdAt` when null |
| Search / sort / pagination | **NONE.** One unpaginated request |
| Row click | Editor when editable, reader otherwise |
| Edit shown when | `status !== 'approved'` **and** owner |
| Delete shown when | `status === 'draft'` **and** owner |
| Delete confirmation | `Delete lesson plan?` / `"<topic>" will be permanently deleted. This cannot be undone.` / `Cancel` / `Delete` (→ `Deleting...`) |
| Empty | `No lesson plans with status "<status>" yet.` + `Create a lesson plan` |
| Loading | spinner in a card |
| Error | destructive text + `Retry` |
| **Ported** | **FULL** — all of the above, including the absence of search/sort/pagination |

### 2.2 Status lifecycle

`draft → pending → approved | rejected`. `LessonStatusBadge`: approved→default,
pending→secondary, draft→outline, rejected→destructive, unknown→nothing.

### 2.3 Form (`LessonForm`, 1665 lines)

**Fields:** academicSessionId (select, `${name} — ${term}`), term, week
(`type=number min=1` default 1), classId (select), startDate/endDate (date,
joined `–`), subject (select, with a synthetic `__custom__` option for an
unlisted stored value), topic, subTopic, duration, period, teacher name
(read-only), objectives[] (dynamic rich text), instructionalMaterials,
previousKnowledge, entryBehaviour, recommendedText, referenceText,
lessonContent[] (heading + body), presentationSteps[] (stepLabel, duration,
teacherPresentation, rows labelled `STEP I…XII`), studentActivities[]
(studentActivity, expectedResponse), summary, evaluationQuestions, assignment,
remarks, supporting document (file).

**Validation — three rules, and only on submit-to-pending:**

```
Class is required
Subject is required
Topic is required
```

`validate()` runs **only when `status === 'pending'`**, so a draft saves empty.
No regex, no length rule, no date-order check anywhere in this form.

**Autosave:** 2500 ms debounce, localStorage snapshot
`lesson-plan-form-snapshot`, server-side draft id in `lesson-plan-autosave-id`,
fingerprint-guarded, status line `Autosaving…` / `Autosaved <time>` /
`Autosave failed — will retry`, resume banner `Resumed your unsaved work from
before the reload.`

| | |
|---|---|
| **Ported** | **PARTIAL** |
| Divergence | The document is reduced to the editable fields; the objective/content/step/activity repeaters are not built. The autosave snapshot, the file upload and the 1665-line rich-text editor are **NOT PORTED** — see `api-map.md` |
| Preserved | The three validation rules, the draft-saves-empty asymmetry, `week min=1`, the date pair joined `–`, the synthetic `__custom__` subject option, and the classId-as-select requirement |

### 2.4 Submit-for-approval sheet

300 ms debounced reviewer search on `GET /communication/users?search=`, self
excluded, `"No users found."`, footer `This lesson plan will be sent to <name>
for review.` / `Select a reviewer, or submit without selecting to let any
authorized reviewer pick it up.`

**Ported:** `FULL` (`TeacherReviewerPicker.vue`).

### 2.5 Detail page

A Times New Roman document: header `ST. FINBARR'S COLLEGE, LAGOS-NIGERIA.`,
`E-Lesson Plan (TERM, Session)`, an info table, a preparation table
(BEHAVIOURAL OBJECTIVES, INSTRUCTIONAL MATERIALS, PREVIOUS KNOWLEDGE, ENTRY
BEHAVIOUR, RECOMMENDED TEXT, REFERENCE TEXT), CONTENT, PRESENTATION with
roman-numeral steps, STUDENTS' ACTIVITIES with an `Expected:` line, a three-up
SUMMARY/CONCLUSION · EVALUATION · ASSIGNMENT band, `REMARKS:`, and a dashed
`H.O.D'S COMMENT / SIGNATURE` box. Missing values render `—`.

**Ported:** `PARTIAL` — the field content and the `—` fallback; the print
typography is not reproduced.

### 2.6 Weekly planner

Groups plans by `lesson.week`, weeks ascending, `0` labelled `Unassigned week`.
Empty: `No lesson plans yet. Create one to see it here.`

**Ported:** **NOT PORTED** — the plan is available as a status-tab filter, and a
separate week-grouped board over the same data was not built.

### 2.7 Review Inbox (`LessonPlanManagement assignedToMeOnly`)

Tabs `Pending review | Approved | Rejected`, caption `Only plans assigned to you
for review.`, 400 ms debounced search `Search by teacher name or email...`,
approve/reject gated on `status === 'pending'` **and** `canActOn(lesson)` with
the tooltip `Only the assigned reviewer can approve or reject this plan.`
Approve dialog `Approve lesson plan?`; reject sheet with **optional** `Reason
(optional)` and placeholder `e.g. Objectives are not measurable, please revise
and resubmit.` Success banners verbatim.

| | |
|---|---|
| **Ported** | **PARTIAL** |
| Not ported | PDF export (`jsPDF`), bulk selection + toolbar, forward-to-reviewer, share-into-chat |

---

## 3. Weekly report

**Origin:** 6 routes under `/teacher/weekly-report/`

### 3.1 List (`WeeklyReportTable`)

Columns Subject, Class / Arm, Week, Date, Status, Actions. Delete confirmation
`Delete Weekly Report` / `Are you sure you want to delete this weekly report?
This cannot be undone.`, then an emerald `Weekly report deleted successfully`
that auto-hides after **4000 ms**. Optimistic row removal.
Empty: `No weekly reports with status "<status>" yet.`

**Ported:** **FULL**, except that delete errors are surfaced rather than only
`console.error`'d — the origin silently swallows them.

### 3.2 Status lifecycle

`draft → submitted → reviewed`. `WeeklyReportStatus = draft | submitted | reviewed`.
The mock refuses re-submit of a reviewed report with `This weekly report is already reviewed`.

### 3.3 Form (`WeeklyReportForm`)

Info rows: weekOfReport, reportDate (defaults today), termSession, teacher's
name (no `onChange`), subject, classAndArm, topicCovered, topicUncovered, reasons.

Five numbered checklist sections, each with dynamic `{text, checked}` rows
(4 seeded), `Add Item`, remove, and a comment textarea:

| Banner | items | comment |
|---|---|---|
| `1. STUDENTS' PARTICIPATION AND PERFORMANCE` | participationItems | `ADDITIONAL OBSERVATIONS` |
| `2. CLASSROOM MANAGEMENT` | classroomItems | `COMMENTS` |
| `3. ASSIGNMENTS AND ASSESSMENTS` | assignmentItems | `NOTES` |
| `4. CHALLENGES ENCOUNTERED IN CLASS` | challengeItems | `OTHER CHALLENGES` |
| `5. RECOMMENDATIONS` | recommendationItems | `FURTHER RECOMMENDATIONS` |
| `6. CONCLUSION` | — | `conclusion` |

**Validation — on EVERY save, draft included:**

```
Week of report is required
Term & session is required
Subject is required
Class / Arm is required
```

`cleanItems` trims and drops rows that are empty *and* unticked.

**Ported:** **FULL** — all five sections, the seeding, the cleaning, and the
asymmetry against the lesson-plan form. This asymmetry is the single most
important detail in the module and is covered by a test in `testing.md`.

### 3.4 Review (`WeeklyReportReviewForm`)

Level toggle `H.O.D's Comment` / `Head Teacher's Comment`, initial `"head"` if a
head comment already exists. **Comment is required**:
`Please enter a comment before submitting your review.` `hod` records and leaves
the report submitted; `head` additionally sets `status = 'reviewed'`.

**Ported:** **FULL**, including the required-comment rule and the pre-selection.

### 3.5 Manage (`/weekly-report/manage`)

Filters `All | Submitted | Reviewed` (default submitted), a submit-driven search
`Search by subject, class or teacher...` + `Search` button. Loading
`Loading weekly reports...`, empty `No weekly reports match this filter.`
No pagination. The row button reads `Review` when submitted, else `View`.

**Ported:** **FULL** — including that the queue renders as cards rather than a
table, because the origin's manage view has no table markup.

---

## 4. Class teacher weekly report

**Origin:** 5 routes under `/teacher/class-teacher-weekly-report/`

Fields: weekEndingStart (`From`), weekEndingEnd (`To`), week, classId
(auto-selects when the teacher has one class), name, callsFromParents,
callsToParents, teacherResponse, dailyReports[] (one row per weekday derived from
the date range), attendance[] (present/absent, `min={0}`, all-zero rows
dropped), absentees.monday, absentees.tuesdayFriday, then ten narrative bands —
`SICK STUDENTS`, `FAULTY FACILITIES / GADGETS`, `REPORTS / COMPLAINTS FROM
TEACHERS`, `REPORTS / COMPLAINTS FROM STUDENTS`, `STUDENTS FEEDBACK ABOUT
SUBJECT TEACHERS`, `RESPONSE FROM CLASS TEACHERS`, `REMEDIAL CLASSES REPORT
(FROM SUBJECT TEACHERS)`, `CASES / ISSUES FOR MANAGEMENT'S ATTENTION`,
`CHECKING OF NOTES`, `CLASS CAPTAIN'S REPORT` — then `Mentor's Report`.
Header `ST. FINBARR'S COLLEGE, AKOKA - LAGOS.` / `Class Teacher's Weekly Report`.

**THREE ORIGIN BEHAVIOURS REPRODUCED DELIBERATELY**

1. **No `validate()` at all.** Every field is optional and blank strings are sent
   as `undefined`. A save of a wholly empty form succeeds.
2. **No review step.** `draft → submitted`, and it stops.
3. **The status badge shows the raw string** — `submitted` lowercase — because
   the origin renders the literal status with no label map, unlike the other two
   modules.

Attendance preview: 400 ms debounce, `AbortController`, refires on
`(class, from, to)`, skipped in view mode, error `Could not load attendance for
the selected week.`, loading `Loading...` beside `Refresh`.

Share dialog: `GET …/superiors`, `Share Report with Superior`, client-side filter
on name/email/roleNames, `No superiors found`, posts `{userId}`.

**Ported:** **FULL** — all three behaviours above, the attendance preview, and the
share dialog.

---

## 5. Leave ("Permission")

**Origin:** `/teacher/leave`, `/apply`, `/[id]`

List: search `Search leave requests...`, tabs `All | PENDING | APPROVED | REJECTED`
(**uppercase**), columns Staff, Leave Type, Dates, Days, Status, Details.
Empty `No leave requests match your filters.`

Form: staffId (excludes `invited`; `No staff members found. Please add staff
first.`; `Failed to load staff: {message}`), leaveType, startDate, endDate
(`min={startDate}`), a computed duration line, reason.

**Validation, verbatim and in order:**

```
Select the staff member
Enter a leave type
Select the leave dates
End date must be after the start date
Provide a reason for the leave
```

`daysBetween` is inclusive: `Math.round((end-start)/86400000)+1`, 0 when a date
is missing or reversed. Duration line: `{n} working day(s) requested` or
`Select dates to calculate the duration.` Success card: `Leave request
submitted` / `<name>'s <type> request for <n> day(s) has been sent for approval.`

Detail: Approve/Reject render whenever `status === 'PENDING'` — **with no
permission check**.

Approvals view: two tables `Pending ({n})` / `Decided ({n})`, not in the teacher nav.

**Ported:** **FULL**, including the uppercase status vocabulary and the
unguarded approve/reject.

---

## 6. HR queries

**Origin:** `/teacher/hr-queries`, `/new`, `/[id]`

List: search `Search queries...`, tabs `All | Open | Resolved | Archived`.
Subject cell carries the category as a sub-line defaulting to `General`.
Priority `high/medium/low` (default `medium`), status `Open/Assigned/Resolved/Archived`
(default `Open`). Empty `No queries match your filters.`

Form: a **recipient** typeahead (300 ms, self excluded, `No users found.`),
title, category labelled **Offence** (from `GET /offence-categories/active`, the
option's `name` is the value), priority, description. The category-manager button
is gated on `categories.manage`, which no teacher holds.

**Validation:**

```
Select the recipient
Title is required
Describe your query
```

Success card: `Query submitted` / `"<title>" has been sent to the HR team.`

Detail "Manage query" card, hidden once `ARCHIVED`: `Assign and keep open` (only
from `OPEN`), `Mark resolved` (only when not `RESOLVED`), `Archive`. **No
permission checks**; updates are optimistic and swallow failures.

**Ported:** **FULL**, minus the category-manager dialog (correctly absent — a
teacher never sees its button).

---

## 7. Counselling

**Origin:** 7 routes under `/teacher/counselling/`

| Feature | Notes | Ported |
|---|---|---|
| Book session | 3 typeaheads, each requiring ≥2 chars and auto-selecting a single result; **no `validate()`** — a missing student or reason returns silently | FULL |
| Case list | filters `{search, status, academicSessionId}`, server pagination, `Reset` | FULL |
| Case detail | GET by id, status transitions, comments | FULL |
| Committee | writes gated on `counselling.committees.manage`; members `CHAIR`/`MEMBER` | PARTIAL — the list and create form; member add/remove not built |
| Reports | list, detail, update, share, download | PARTIAL — no blob download |
| New report | the one page with an explicit gate | FULL |

Status `OPEN|SCHEDULED|IN_PROGRESS|PENDING|RESOLVED|CLOSED`; priority
`LOW|NORMAL|HIGH|URGENT`; report status `DRAFT|FINAL`.

**The gate, verbatim:** `hasPermission("counselling.reports.manage") ||
isAdminLike(roles)`, else `You do not have permission to create counselling
reports.`

---

## 8. Disciplinary

**Origin:** 5 routes under `/teacher/disciplinary/`

| Feature | Notes | Ported |
|---|---|---|
| `/incidents` | Manages **case types**, not incidents | FULL — labelled `Case Types` here |
| `/committees` | writes on `disciplinary.committees.manage`, soft delete | PARTIAL |
| `/launch-case` | 2 typeaheads, ≥2-char guard, silent refusal without student + case type | FULL |
| `/reports` | filters, pagination, download, share | PARTIAL — no blob download |
| `/reports/[id]` | case detail | FULL |

Case types soft-delete (`isActive = false`) and keep a visible `Inactive` badge.
Empty: `No incidents yet. Add the first case type to get started.` Delete banner
`Deleted successfully.` Status `OPEN|PENDING|UNDER_REVIEW|DISMISSED|RESOLVED|APPEALED`;
severity `MINOR|MODERATE|MAJOR|CRITICAL`. Case numbers auto-increment (`DISC-001`).

---

## 9. Messaging

**Origin:** `/teacher/messaging` · `CommunicationMessagesPage` (shared by 4 paths)

Two panes, conversation tabs `All | Direct | Groups`, search, `initials()`
(strips `Mr./Mrs./Ms./Dr.`), previews `[Image]` / `[Voice message]` /
`[File] <name>` / `[Lesson Plan] <topic>`, mark-read on open, 50-message pages
with a cursor.

**Realtime is the divergence.** The origin subscribes to `message:new`,
`conversation:created`, `conversation:updated`, `conversation:deleted`,
`message:read` and `notification:new` over `socket.io-client`, and bumps unread
counts live. LAEC has no socket, so this panel receives nothing: a message sent
elsewhere appears only on reload. Recorded, not faked.

**Ported:** `PARTIAL` — text messaging only; no attachments, upload, forward,
delete, file download, group administration or push.

---

## 10. Notice board / 11. Events / 12. Academic calendar

The origin's pages are `CommunicationNoticeBoardPage` (article cards, pinned
treatment, audience labels, mark-read-on-mount, `No notices yet. Publish the
first notice to get started.`), `CommunicationEventsPage` (category labels
`Academic/Event/Holiday/Meeting`, date badge, mark-read-on-mount) and
`AcademicCalendarPage readOnly` (nine event types, month grid).

**Ported:** Events **FULL**. Notice Board and Academic Calendar already exist as
LAEC documents at `/notices/` and `/calendar/` (D-64) and are reached from the
rail as documents rather than panels — not duplicated.

## 13. Notifications

Nine tabs `All, Unread, Messages, Leave, Attendance, Events, System, Discipline,
Counselling`; per-item `Mark as read` and `View`; footer `{unread} unread of
{total} total notifications.`; empty `No notifications in this view.`

**Mark-all-read fires on mount, unconditionally** — visiting the page marks
everything read server-side. Reproduced.

**Ported:** **FULL**, with LAEC's six coarse categories plus an optional `Kind`
so the per-module tabs can discriminate.

## 14. Profile

`UpdateProfilePayload` fields. `GENDER_OPTIONS` `MALE|FEMALE`;
`MARITAL_STATUS_OPTIONS` `MARRIED|UNMARRIED`. No page-level permission
requirement.

**Ported:** `PARTIAL` — the identity fields; the four payroll fields
(`bankName`, `accountName`, `accountNumber`, `monthlySalary`) and `avatarUrl`
omitted, since LAEC has neither a payroll surface nor an attachment transport.

---

## UNKNOWN

| Item | What is known | What blocked it | Needed |
|---|---|---|---|
| Authenticated runtime behaviour of every module | full source, routes, fields, copy, validation | live API returns 401 on every endpoint; no credentials supplied | authorized teacher credentials |
| Rich-text editor behaviour (TipTap, KaTeX, images) | dependencies and component names | editor not built here | a decision on whether rich text is required |
| Signature script rendering | five `SignatureStyle` values and their fonts | no webfont pipeline in LAEC | sign-off on substituting a font stack |
| Weekly planner layout | grouping and ordering rules | not built | sign-off on omitting the board |
| PDF export output | `jsPDF`, `downloadLessonPlans`, filenames | LAEC has no blob transport | a download transport |