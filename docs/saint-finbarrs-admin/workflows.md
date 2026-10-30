# Workflows — what an operator actually does

Every workflow below was **traced on the live deployment** in the signed-in Super
Admin session (labels per `README.md`), then **reproduced in this project** and
**driven end to end** by `tools/audit/verify-workflows.js`. The check id in each
row is that script's own label; the "Verified" column is the result of the run
recorded in `verification-checklist.md`.

Two rules held throughout the live trace: no destructive action was executed, and
a dialog opened to read its copy was dismissed without choosing an item.

## The workflows that exist

| # | Workflow | Live route | Panel here | Verified |
|---|---|---|---|---|
| W1 | Enrol a student and their guardian in one form | `/students/new` | `students` | PASS |
| W2 | Search and filter any list | every list page | all | PASS |
| W3 | Act on a row through its action menu | `/users`, `/staff`, `/students` | all | PASS |
| W4 | Approve or reject a leave request | `/leave/approvals` | `leave-approvals` | PASS |
| W5 | Apply for leave | `/leave/new` | `leave` | PASS |
| W6 | Mark attendance for a register | `/attendance` → a sheet | `staff-attendance`, `student-attendance` | PASS |
| W7 | Read an attendance report across classes | `/attendance/reports` | `staff-attendance-report`, `student-attendance-report` | PASS |
| W8 | Manage the grading scale and pass mark | `/results/grading` | `grading` | PASS |
| W9 | Enter results for a class | `/results/enter` | `enter-results` | PASS |
| W10 | Vet, publish or decline a queued result | `/results/queue` | `results-queue` | PASS |
| W11 | Grant a permission to a role | `/permissions` | `permissions` | PASS |
| W12 | Create a user, invite, suspend, delete | `/users` | `users` | PASS |
| W13 | Top up or deduct a student wallet | `/wallets` | `wallets` | PASS |
| W14 | Record a school-fee payment | `/school-fees/payments` | `fee-payments` | PASS |
| W15 | Grant a role to a user | `/roles` | `roles` | PASS |
| W16 | Change school settings | `/system/general-settings` | `general-settings` | PASS |
| W17 | Maintain stock and restock | `/inventory/stock` | `stock` | PASS |
| W18 | Take an order from the queue and confirm payment | `/store/queue` | `queue` | PASS |
| W19 | Review the audit trail | `/system/audit-logs` | `audit-logs` | PASS |
| W20 | Browse the store and check out | `/store`, `/store/cart` | `store`, `cart` | PASS |
| W20b | Bursary refuses a confirmation with no reference | `/store/queue` | `queue` | PASS |
| W20c | Bursary confirms against a reference | `/store/queue` | `queue` | PASS |
| W21 | Read the school's disciplinary rule book | `/disciplinary/incidents` | `disciplinary-incidents` | PASS |
| W22 | Launch a disciplinary case | `/disciplinary/launch-case` | `disciplinary-launch-case` | PASS |
| W23 | Move a case through its statuses | `/disciplinary/reports` | `disciplinary-reports` | PASS |
| W24 | Refer a student for counselling | `/counselling/book-session` | `counselling-book-session` | PASS |
| W25 | Create a counselling committee with a chair | `/counselling/committee` | `counselling-committee` | PASS |
| W26 | Hold and preview a school role | `/roles` | `roles` | PASS |

Thirty-one checks, all passing. W21–W26 are the two modules and the roles axis;
W20b and W20c are the bursary's two decisions, which were previously one
confirmation that needed no input.

## The four that carry the most behaviour

### W1 · Enrol a student and their guardian in one form

**Live.** `/students/new` — 8 buttons, 17 fields. The form collects the
student's academic placement (admission number, session, class, arm), identity
(first name, last name, email, phone), category, date of birth, and a **nested
guardian block**: first name, last name, email, phone, relationship, occupation,
address. **OBSERVED**

The nesting is the point. A student cannot exist without a linked guardian in
this app, so the form is one submit rather than a student followed by a parent.
A blank admission number means the portal generates one. **SOURCE**
(`students/new` form).

**Here.** `students` (bespoke `AdminStudentsPanel`), with the same field list and
the same two sections — *Academic Details* and *Guardian Details*. Create is
gated on `students.add`, Edit on `students.update`, Delete on `students.delete`,
Import on `students.import`. **Verified W1, W12.**

### W4 · Approve or reject a leave request

**Live.** `/leave/approvals` — two tables, `Pending` and `Decided`, no filter and
no search. Each pending row carries Approve and Reject. **OBSERVED**

The leave *form* has five validation rules, taken verbatim from the deployed
source and reproduced exactly:

| Rule | Message |
|---|---|
| staff member not chosen | `Select the staff member` |
| leave type empty | `Enter a leave type` |
| dates missing | `Select the leave dates` |
| end not after start (inclusive day count ≤ 0) | `End date must be after the start date` |
| reason empty | `Provide a reason for the leave` |

The form also **derives** the duration rather than storing it — the line reads
`Select dates to calculate the duration.` until both dates are set — and sets the
end date's `min` from the start date. Both reproduced, because both are what
stops an invalid request reaching the server instead of being caught after it.
**SOURCE**.

**Here.** `leave` (list, tabs, apply dialog) and `leave-approvals` (the two
tables). **Verified W4, W5, W5b.**

**One deliberate difference.** The live approve/reject buttons carry no
permission check at all. **SOURCE** (`LeaveDetailPage` renders them for any
`PENDING` row). Here they are gated on `leave.approve`, because this is the admin
console where that permission is granted — shipping an ungated control the rail
already says this session does not hold would be worse than the live bug. Recorded
in `parity-report.md`.

### W9 · Enter results for a class

**Live.** `/results/enter` — 10 buttons, 6 filters, a 13-column sheet. Filters are
session, term and class. The sheet has one row per student with four mark inputs
(`CA 1 (20)`, `CA 2 (10)`, `PROJ/ASS (10)`, `EXAM (60)`) and four computed
columns (`TOTAL (100)`, `AVG. (100)`, `GRADE`), plus a class summary block
(population, session, class average, highest, lowest, pass mark, max CA, max exam)
and a `GRADES & RATINGS` table. **OBSERVED**

**An observed defect on this page**, recorded and not fixed: the summary block
reads `MAX CA: 40` while the two CA column headers sum to 30 (`CA 1 (20)` +
`CA 2 (10)`). The page contradicts itself. The mock carries the same `maxCA: 40`
so the divergence is reproduced rather than silently corrected. **OBSERVED**.

**Here.** `enter-results` in `AdminResultsPanel`, same 13 columns, same summary
block, same bands table. `Submit Results` is disabled until a class is chosen.
**Verified W9, W9b** — W9 sets 18 / 9 / 8 / 57 and asserts the TOTAL cell reads
92 and the grade moves F → A.

### W13 · Top up or deduct a student wallet

**Live.** `/wallets` — 2 buttons, a table, a search box. Each row's menu offers
`Deduct`; a top-up sits beside it. **OBSERVED**

The adjust dialog's fields come from the deployed source verbatim:

| Field | Notes |
|---|---|
| `Amount (NGN)` | required, placeholder `e.g. 5000` |
| `Type` | **deduct only** — `Spend (expense)` / `Cash withdrawal` |
| `Narration (optional)` | placeholder `Cash received at Bursary` |

The dialog title is `Cash top-up` or `Deduct from wallet`; the confirm button is
`Credit wallet` or `Deduct`; and an amount of zero or less is refused with
`Amount must be greater than zero`. **SOURCE**
(`wallet-adjust-dialog.tsx`).

**Here.** The same dialog, same copy, same zero-rule. These fields are declared on
the *dialog*, not on the module, because the amount and the narration belong to
the operator's action rather than to the student's record — declaring them as
module fields would have put them on every wallet edit, which the origin does not
offer. **Verified W10** — a 5,000 top-up moved a balance from ₦0.00 to ₦5,000.00.

## The generic loop, and why it is one component

Every remaining list workflow — search, filter, sort, page, open a row, edit,
delete, export — is the same sequence on every module. The live app proves this:
`/users` and `/students` and `/inventory/stock` differ by a column list and a
field list and nothing else. **OBSERVED**

So here it is one component. `src/types/admin-registry.ts` declares each module's
columns, filters, fields, toolbar and row actions as data;
`AdminResourcePanel.vue` renders any of the 13 that no bespoke component answers
for.

A new table-shaped module is a registry entry and **no component at all**. That is
the whole reason 67 panels needed only 23 components - and 13 of them needed none.

## Workflows deliberately NOT implemented

These are live features with no counterpart here. Each is named rather than
quietly omitted.

| Workflow | Live route | Why not |
|---|---|---|
| Lesson-plan authoring and review | `/lesson-planning*`, `/staff-portal/lesson-planning/approvals` | Belongs to this project's `/teacher/` console, already built in a separate audit (`docs/teacher-portal/`). Reimplementing it in `/admin/` would duplicate a console that exists. |
| Weekly and class-teacher reports | `/weekly-report*`, `/teacher/class-teacher-weekly-report*` | Same — a teacher-portal surface. |
| Messaging | `/communication/messages` | A per-conversation surface with file upload and message deletion. Out of scope for an admin console; the notice board and events are the admin-facing part of this module and are not in `/admin/` either. |
| Notice board and events calendar | `/communication/notice-board`, `/communication/events` | Already exist in this project as `/notices/` and `/calendar/`. See the nav entry that routes to them rather than to a panel. |
| Disciplinary cases | `/disciplinary/*` | Case launch, committee membership and incident management. A whole module; not started. |
| Counselling cases | `/counselling/*` | Same. |
| Student promotion | `/students/promotion` | Renders an *Under construction* placeholder on the live deployment. **OBSERVED.** Reproducing a scaffold would document a feature that does not exist. |
| Student CSV export page | `/students/export` | Same — *Under construction*. Export is available from the student list instead. |
| Password reset, profile, unauthorized | `/forgot-password`, `/profile`, `/unauthorized` | Already exist in this project on other routes. |

## Three findings that came out of writing the checks

### W20 · Checkout was not absent — it was reporting success for nothing

This entry previously read "the button is absent rather than wired to a mock that
would be inventing a payment flow". That was wrong about the code.
`AdminInventoryPanel` **did** have a Checkout button. It looped `ADD_TO_CART` over
its own cart lines — adding to the thing it had just emptied, which cannot create
an order even in principle — and then set the banner *"Order placed. It is now in
the bursary confirmation queue."*

A control that claims an outcome it did not produce is worse than a missing one:
a missing control is noticed, a lying one is not. The check asserts on the **queue
gaining a row**, not on the banner, precisely because a banner is a claim and a
queue row is evidence.

It is now a real transaction. Two things it exposed while being written:

- **The cart has to be the server's.** It used to be a panel-local array, so there
  was nothing to check out *against*. The mock owns `StoreCart` now.
- **`onMounted` was the only load.** `AdminInventoryPanel` serves eleven panels
  from one component, so switching from `store` to `queue` through the rail
  mounted the queue with no read behind it and rendered its empty state over four
  orders. Only a full page reload papered over that — which is not how anyone
  moves around a console. Now a `watch` on the module id.

W20b and W20c are the same dialog with opposite outcomes, so the refusal in W20b
is the mock refusing rather than the dialog being unusable. `"Payment reference is
required."` is enforced in the mock, not in the panel.

### W23 · Reading a button's disabled state needs a tick

The probe set a `<select>`, dispatched `change`, and immediately read the Update
button's `disabled`. It reported `true` — because Vue re-renders on the microtask
queue, so that read still saw the pre-change value. The control looked broken and
was not. The check now waits before reading.

### W22 · The mock lives in page memory, so the write has to be read back without a reload

W20 and W22 both assert on a list that only changes because of the action under
test. Reaching it by URL reloads the page, which resets the mock to its seed — so
the check would pass or fail for the wrong reason. Both go through `.rail-item`
clicks instead, which is also how a person moves between panels.

W22 found a second mock bug this way: `orderSeq` was seeded to 2, left over from
when only two orders existed, so the first order placed came out as
`ORD-2026-0006` colliding with a seeded order of that number — two indistinguishable
rows under the same number. It is now derived from the seed, so adding a seeded
order cannot reintroduce it.

### W26 · Two halves, because the honest behaviour splits in two

Holding a role cannot narrow a super administrator's rail, and that is correct:
`/admin/` is `SUPER_ADMIN`-only and a super administrator holds a superset by
design. So "did the role do anything" has two different right answers — holding
extends the effective set, previewing narrows the rail — and a check asserting
either alone would read as the other.

The check therefore asserts both, plus the safety asymmetry: previewing cut the
rail from 77 entries to 13 while the transport kept enforcing the claim.

## Read next

`verification-checklist.md` for how each of these was proven, and
`feature-matrix.md` for the per-panel status.