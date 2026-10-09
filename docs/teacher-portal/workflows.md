# Workflows

End-to-end sequences as they behave in the port. Each step names the contract
action, the gate it passes, and the observable result.

---

## W1 — Teacher login

```
/login/teacher/  (the role door)
  → username + password
  → POST-less local mockAuthenticate (LAEC has no auth endpoint)
  → localStorage: LAEC_Session, AdminUsername, AdminRole, AdminName, SchoolID
  → router.beforeEach: CONSOLE_ROLE.teacher === 'TEACHER' → pass
  → GET_MY_PERMISSIONS → effectivePermissions([], 'TEACHER')
  → AppShell rail renders 18 entries in 5 groups
  → Dashboard is the default panel
```

A role other than `TEACHER` is returned to `/control/`, unless the claim is
`SUPER_ADMIN`, which holds the union of every other role's defaults.

**Verified:** login as `teacher@nicegeneco.com` lands on the Dashboard with all
ten count tiles populated; `/teacher/` with no session redirects to `/control/`.

---

## W2 — Author a lesson plan and submit it for review

```
Lesson Planning → New Lesson
  → class (select, required) / subject / topic / term / week / duration / period / dates
  → Save Draft
      validate() NOT run — a draft saves empty   [origin behaviour]
      SAVE_LESSON_PLAN {plan, teacherUsername, status:'draft'}
      → banner "Lesson plan saved as a draft."
      → draft becomes an open record; GET_LESSON_PLANS refetches
  → Save & Submit
      validate() runs, in order: Class → Subject → Topic
      SAVE_LESSON_PLAN {status:'pending'}
      notification "Lesson plan submitted" raised, Kind LESSON
      → banner "Lesson plan saved and sent for review."
  → Pending Review tab now lists it
```

**Verified:** empty submit → `Class is required`; class+subject → `Topic is
required`; all three → success and the row appears under Pending Review.

---

## W3 — Review a lesson plan

```
Review Inbox  (GET_LESSON_PLAN_QUEUE, assignedToMe, status:'pending')
  → Approve / Reject per row
      disabled unless status === 'pending' AND
      (targetReviewerUsername is null OR === session username)
      tooltip when blocked: "Only the assigned reviewer can approve or reject this plan."
  → Approve → dialog "Approve lesson plan?"
  → Reject  → sheet, Reason (optional), placeholder
      "e.g. Objectives are not measurable, please revise and resubmit."
  → REVIEW_LESSON_PLAN {decision, remark?, signature}
      raises "Lesson plan approved" / "Lesson plan rejected"
      banner: Approved "<topic>" by <teacher>. /
              Rejected "<topic>" by <teacher>. The teacher has been notified.
      queue refetches
```

**Verified:** approve round-trips; the row leaves Pending and the banner reads
`Approved "Sets" by MOCK TEACHER ONE.`

---

## W4 — Weekly report lifecycle — including the asymmetry

```
Weekly Report → Create Report
  → Save Draft with anything blank
      validate() RUNS — unlike the lesson plan
      "Week of report is required" → "Term & session is required"
      → "Subject is required" → "Class / Arm is required"
  → Save & Submit  → status 'submitted' → Submitted tab
Review Reports → status 'submitted'
  → Review → level H.O.D | Head Teacher, Comment REQUIRED
      "Please enter a comment before submitting your review."
      level 'hod'  → hodComment set, status stays 'submitted'
      level 'head' → headComment set AND status 'reviewed'
```

**Verified:** empty draft save refused with `Week of report is required`; a
filled draft saved and the list went from 1 to 2 reports.

---

## W5 — Class-teacher weekly report — no validation, no review

```
Class Teacher Report → New Report
  → any fields, or none
  → Save Draft / Save & Submit        [NO validation, origin behaviour]
  → GET_ATTENDANCE_PREVIEW on a 400 ms debounce when class or range changes
      populates absentees.monday / absentees.tuesdayFriday
  → detail → "Share with superior" (only when status === 'submitted')
      SHARE_CLASS_TEACHER_REPORT → notification
  → there is no approve/reject/finalize step
```

**Verified:** an entirely empty form saved successfully (`Draft saved.`) with no
validation message, which is the deliberate contrast with W2 and W4.

---

## W6 — Apply for leave, then decide it

```
Permission (leave) → Apply for Permission
  → staff / leave type / start / end / reason
      "Select the staff member" → "Enter a leave type"
      → "Select the leave dates" → "End date must be after the start date"
      → "Provide a reason for the leave"
      duration computed live: "{n} working day(s) requested"
  → APPLY_FOR_LEAVE → status 'PENDING'
  → success card: "Leave request submitted"
      "<name>'s <type> request for <n> day(s) has been sent for approval."
  → detail → Approve / Reject whenever status === 'PENDING'  [no permission check]
      DECIDE_LEAVE → status APPROVED | REJECTED, notification raised
```

**Verified:** validation fired in the origin's order; the duration line read
`1 working day(s) requested` for a single-day range; the success card rendered
with the origin's sentence.

---

## W7 — Raise an HR query and close it

```
HR Queries → Create Query
  → recipient typeahead (300 ms, self excluded) — "Select the recipient"
  → title — "Title is required"
  → Offence, Priority, description — "Describe your query"
  → RAISE_HR_QUERY → status OPEN, priority as chosen
  → banner: "<title>" has been sent to the HR team.
  → detail → Manage query card (hidden once ARCHIVED)
      Assign and keep open (only from OPEN)
      Mark resolved (only when not RESOLVED)
      Archive
      UPDATE_HR_QUERY, applied optimistically
```

**Verified:** typeahead returned the five other roster accounts and excluded the
caller; the query appeared with `Facilities` / `high` / `OPEN`.

---

## W8 — Book a counselling session — silent refusal

```
Guidance & Counselling → Book Session
  → student typeahead (≥2 chars, single result auto-selected)
  → reason, background, initial comment, priority, committee
  → Book session with student or reason missing
      → returns SILENTLY: no message, no field marking   [origin behaviour]
  → Book session complete → LAUNCH_COUNSELLING_CASE, caseNumber auto-incremented
      → "Case CNS-002 launched."
```

**Verified:** the incomplete submit produced no alert, no banner and left the
form in place; the complete one produced `Case CNS-002 launched.`

---

## W9 — Launch a disciplinary case

```
Disciplinary → Case Types   (manages case types, despite the route name)
  → Add case type → soft-delete keeps an "Inactive" badge
Disciplinary → Launch Case
  → student typeahead (≥2 chars), case type, severity, committee, date, location
  → incomplete → silent refusal
  → LAUNCH_DISCIPLINARY_CASE → caseNumber "DISC-00N"
      → "Case DISC-002 launched."
      → notification Kind DISCIPLINE
```

**Verified:** a `Theft` case type was added and appeared in the list; a case was
launched and the notification surfaced under the Discipline filter tab.

---

## W10 — Message a colleague

```
Messages
  → conversation list (All / Direct / Groups, search)
  → opening a conversation loads 50 messages and marks it read
  → Send → SEND_TEACHER_MESSAGE → thread and preview refresh
  → "New direct message…" → CREATE_TEACHER_CONVERSATION
NOTHING ARRIVES ON ITS OWN — the origin is socket-driven; this portal is not
```

**Verified:** a sent message appeared in the thread with sender, timestamp and
body.

---

## W11 — Notifications, and the mark-all-read-on-mount behaviour

```
Notifications (GET_NOTIFICATIONS with username AND role)
  → unconditional MARK_ALL_NOTIFICATIONS_READ on mount
  → nine tabs filter by Kind (teacher-portal items) or Category (LAEC items)
  → Mark as read (optimistic), View deep-links to the owning panel
```

**Verified:** `Leave` showed only the leave notice and `Discipline` only the
case notice, after the coarse-category-only version put both under `System`.

---

## W12 — Profile

```
Profile → GET_MY_PROFILE → edit → UPDATE_TEACHER_PROFILE
  → "First name is required" / "Last name is required" / "Email is required"
```

## W13 — Cross-role

Leave, class reports, weekly reports and lesson plans are filtered to the signed-in
teacher. Counselling and disciplinary cases are school-wide and are visible to every
teacher — matching the origin, where those queues carry no owner filter.