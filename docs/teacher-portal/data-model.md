# Data Model

Types live in `src/types/index.ts` (LAEC) and are extended here with the St Finbarr's
teacher entities. Origin field names are transcribed exactly.

## Document lifecycle shared by three modules

Lesson plans, weekly reports and class-teacher reports are all authored documents
with an ownership gate and a review step. LAEC already has its own version of this
shape for exam papers (`DRAFT → PENDING_REVIEW → LIVE | REJECTED`); these three are
**separate** lifecycles with the origin's own status strings, kept side by side
rather than merged.

| Entity | Statuses | Terminal |
|---|---|---|
| `LessonPlan` | `draft`, `pending`, `approved`, `rejected` | `approved` |
| `WeeklyReport` | `draft`, `submitted`, `reviewed` | `reviewed` |
| `ClassTeacherReport` | `draft`, `submitted` | none — **no review step exists** |

Transitions:

```
LessonPlan:        draft ──submit──▶ pending ──review──▶ approved
                                       └────────review──▶ rejected  (rejectionReason set; becomes editable again)
WeeklyReport:      draft ──submit──▶ submitted ──review(level=head)──▶ reviewed
                                            └─review(level=hod)──▶ stays submitted, headComment set
ClassTeacherReport: draft ──submit──▶ submitted   (no onward transition)
```

### Ownership and reviewer rules (origin, reproduced)

- A teacher may edit their own plan only while `status !== 'approved'`.
- A teacher may delete their own plan only while `status === 'draft'`.
- Row-click opens the editor when editable, otherwise the read view.
- `targetReviewerId` may be set at submit time. Approve/reject is blocked unless
  `targetReviewerId` is null or equals the current user — tooltip
  `"Only the assigned reviewer can approve or reject this plan."`
- A rejected plan is editable and can be resubmitted.
- Weekly reports: delete only while `draft`. The mock refuses submit on an
  already-reviewed report with `"This weekly report is already reviewed"`.

---

## `LessonPlan`

| Field | Type | Source field / notes |
|---|---|---|
| `id` | string | |
| `teacherId`, `teacherName` | string | teacher name also read-only in the form |
| `subject`, `topic`, `subTopic` | string | `topic`, `subject` required on submit |
| `classId`, `className` | string | `classId` required on submit |
| `term`, `week` | string / number | `week` HTML `min={1}`, default `1` |
| `startDate`, `endDate` | string | joined by `–` |
| `duration`, `period` | string | free text, e.g. `"2HRS 20MINS"`, `"4TH PERIOD"` |
| `academicSessionId` | string | options from `GET /academic/sessions`, label `${name} — ${term}` |
| `objectives[]` | string | dynamic; `ensureLeadObjectives()` applied on save |
| `instructionalMaterials`, `previousKnowledge`, `entryBehaviour`, `recommendedText`, `referenceText` | string | rich text |
| `lessonContent[]` | `{heading, body}` | dynamic |
| `presentationSteps[]` | `{stepLabel, duration, teacherPresentation}` | rows labelled `STEP I…XII` |
| `studentActivities[]` | `{studentActivity, expectedResponse}` | |
| `summary`, `evaluationQuestions`, `assignment`, `remarks` | string | banded |
| `supportingDocName` | string | shown as `${(size/1024).toFixed(1)} KB` |
| `status` | `draft｜pending｜approved｜rejected` | |
| `rejectionReason` | string | destructive banner when rejected |
| `targetReviewerId` | string \| null | assigned reviewer |
| `signature`, `signatureStyle`, `reviewedBy`, `reviewedAt` | string | `signatureStyle ∈ vibes｜allura｜dancing｜satisfy｜parisienne`, default `vibes` |

## `WeeklyReport`

| Field | Notes |
|---|---|
| `id`, `teacherId`, `teacherName` | |
| `weekOfReport` | text, e.g. `"Week 1"`, **required on every save** |
| `reportDate` | date, defaults today |
| `termSession` | text, **required** |
| `subject` | text, **required** |
| `classAndArm` | text, **required** |
| `topicCovered`, `topicUncovered`, `reasons` | text |
| `participationItems[]`, `classroomItems[]`, `assignmentItems[]`, `challengeItems[]`, `recommendationItems[]` | `{text, checked}[]`; 4 empty unchecked rows seeded per section; `cleanItems` trims and drops rows that are empty *and* unchecked |
| `additionalObservations`, `comments`, `notes`, `otherChallenges`, `furtherRecommendations` | free text, one per section |
| `conclusion` | text |
| `status` | `draft｜submitted｜reviewed` |
| `hodComment`, `hodReviewedById`, `hodReviewedAt` | set by a `level='hod'` review |
| `headComment`, `headReviewedById`, `headReviewedAt`, `signature`, `signatureStyle` | set by `level='head'`, which also sets `status='reviewed'` |

Five numbered banners, in order:
`1. STUDENTS' PARTICIPATION AND PERFORMANCE` → `2. CLASSROOM MANAGEMENT` →
`3. ASSIGNMENTS AND ASSESSMENTS` → `4. CHALLENGES ENCOUNTERED IN CLASS` →
`5. RECOMMENDATIONS` → `6. CONCLUSION`.

## `ClassTeacherReport`

No validation at all — every field optional, blank strings sent as `undefined`.

| Field | Notes |
|---|---|
| `id`, `teacherId`, `classId`, `className`, `sectionId` | class options from `GET /class-teacher-weekly-reports/my-classes`; auto-selected when exactly one class |
| `weekEndingStart`, `weekEndingEnd`, `week` | labels `From` / `To` |
| `name` | class teacher's name, defaults to current user |
| `callsFromParents`, `callsToParents`, `teacherResponse` | |
| `dailyReports[]` | one row per weekday, Monday–Friday, derived from the date range |
| `attendance[]` | `{present, absent}` per weekday, HTML `min={0}`; all-zero rows dropped by `.filter(row => row.present > 0 || row.absent > 0)`; `Number(x) \|\| 0` coercion |
| `absentees.monday`, `absentees.tuesdayFriday` | auto-filled from the attendance preview |
| 10 narrative fields | `SICK STUDENTS`, `FAULTY FACULITIES / GADGETS`, `REPORTS / COMPLAINTS FROM TEACHERS`, `REPORTS / COMPLAINTS FROM STUDENTS`, `STUDENTS FEEDBACK ABOUT SUBJECT TEACHERS`, `RESPONSE FROM CLASS TEACHERS`, `REMEDIAL CLASSES REPORT (FROM SUBJECT TEACHERS)`, `CASES / ISSUES FOR MANAGEMENT'S ATTENTION`, `CHECKING OF NOTES`, `CLASS CAPTAIN'S REPORT` |
| `mentorsReport` | |
| `status` | `draft｜submitted` |

Attendance preview: 400 ms debounce, `AbortController`, fires on
`(classId, weekEndingStart, weekEndingEnd, sectionId)` change, skipped in view mode.
Errors: `"Could not load attendance for the selected week."`

## `LeaveRequest`

| Field | Notes |
|---|---|
| `id`, `staffId`, `staffName`, `department` | picker excludes `status === 'invited'`; empty `"No staff members found. Please add staff first."`; load failure `Failed to load staff: {message}` |
| `leaveType` | free text, **required** |
| `startDate`, `endDate` | `endDate` gets `min={startDate}` |
| `days` | `Math.round((end-start)/86400000)+1`, inclusive |
| `reason` | **required** |
| `status` | type is lowercase, **UI/tabs/mock all use uppercase**: `PENDING｜APPROVED｜REJECTED` |

## `HrQuery`

| Field | Notes |
|---|---|
| `id`, `title`, `description` | both **required** |
| `issuerName`, `targetUserId`, `targetUserName` | recipient search 300 ms debounce on `GET /communication/users?search=`, self excluded, `"No users found."` |
| `category` | labelled **Offence**; options from `GET /offence-categories/active`, `value = option.name` |
| `priority` | `low｜medium｜high`, required, default `medium` |
| `status` | `OPEN｜ASSIGNED｜RESOLVED｜ARCHIVED` |
| `response` | shown when present |

Lifecycle `OPEN → ASSIGNED → RESOLVED → ARCHIVED`, each reachable directly.

## Counselling

`CounsellingCommittee { id, name, description?, isActive, members[] }`, member
`{userId, name, email, roleNames[], role: 'CHAIR'|'MEMBER'}`.

`CounsellingCase { id, caseNumber (auto-incremented), studentId, studentName,
caseNumber, referredByName, referralDate, priority: LOW|NORMAL|HIGH|URGENT,
status: OPEN|SCHEDULED|IN_PROGRESS|PENDING|RESOLVED|CLOSED, committeeId,
academicSessionId, backgroundInfo, reasonForReferral, initialComment, comments[] }`.

`CounsellingReport { id, caseId, title, status: DRAFT|FINAL, summary, findings,
recommendations, actionPlan }`. Only page with an explicit gate:
`counselling.reports.manage || isAdminLike`, else
`"You do not have permission to create counselling reports."`

## Disciplinary

`DisciplinaryIncidentType { id, title, description?, isActive }` — despite the route
name `/teacher/disciplinary/incidents`, this manages **case types**, not incidents.

`DisciplinaryCommittee` — same shape as the counselling one.

`DisciplinaryCase { id, caseNumber (auto), studentId, studentName, caseTypeId,
incidentDate, location, severity: MINOR|MODERATE|MAJOR|CRITICAL,
status: OPEN|PENDING|UNDER_REVIEW|DISMISSED|RESOLVED|APPEALED, committeeId,
academicSessionId, description, initialComment, comments[] }`. Download filename
`${caseNumber}-report.html`.

## Communication

`Conversation { id, kind: direct|group, name?, members[], lastMessageAt,
unreadCount }`, `Message { id, conversationId, senderId, senderName, body,
type: text|image|file|voice|lesson-plan, createdAt, replyTo?, attachment?,
lessonPlanPreview? }`.

Previews: `[Image]`, `[Voice message]`, `[File] <name>`, `[Lesson Plan] <topic>`.
Realtime via `socket.io-client`, subscribed to `message:new`,
`conversation:created`, `conversation:updated`, `conversation:deleted`,
`message:read`, `notification:new`.

`Notice { id, title, content, audience, pinned, published, authorName, createdAt }` —
audience labels `ALL→Everyone`, `PARENT→Parents`, `TEACHER→Teachers`, `STAFF→Staff`,
`PARENT_TEACHER→Parents & Teachers`, `PARENT_STAFF→Parents & Staff`,
`TEACHER_STAFF→Teachers & Staff`.

`Event { id, title, description?, location?, startsAt, endsAt?, audience?, category?,
allDay? }` — categories `academic→Academic`, `event→Event`, `holiday→Holiday`,
`meeting→Meeting`.

`AcademicCalendarEvent { id, title, description?, date, endDate?, eventType,
academicSessionId? }` — types `TERM_START`, `TERM_END`, `PTA_MEETING`, `EXAM`,
`HOLIDAY`, `EVENT`, `MEETING`, `DEADLINE`, `OTHER`, each with its own badge colour.

`Notification { id, type, title, body, read, createdAt, refEntity?, refId? }` —
`TYPE_MAP`: `MESSAGE→message`, `LEAVE→leave`, `ATTENDANCE→attendance`,
`EVENT→event`, `NOTICE→system`, `SYSTEM→system`, `ONBOARDING→system`,
`DISCIPLINE→discipline`.

`TeacherProfile` — `firstName`, `lastName`, `email`, `phone`, `avatarUrl`, `address`,
`gender` (`MALE｜FEMALE`), `dateOfBirth`, `maritalStatus` (`MARRIED｜UNMARRIED`),
`emergencyMobile`, `qualifications`, `bankName`, `accountName`, `accountNumber`,
`monthlySalary`.

---

## Reference data

| Entity | Fields |
|---|---|
| `AcademicSession` | `name`, `term` — form label `${name} — ${term}` |
| `AcademicClass` | `name` |
| `Subject` | `name`; a stored subject absent from the list gets a synthetic `{id:'__custom__', name}` option |
| `Teacher` (directory) | `id`, `firstName`, `lastName`, `email`, `department`, `status`; `GET /communication/users` filters `status === 'active'` and caps at 20 |
| `OffenceCategory` | `name` is the value |
| `Session` (counselling/disciplinary) | `academicSessionId` |