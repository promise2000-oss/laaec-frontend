# Parity report — every deliberate divergence, and why

This project's goal was **functional parity** with the live Saint Finbarr's
College admin portal, not a pixel clone of it. Functional parity means an operator
can do the same job; it does not mean reproducing the live app's bugs. This
document lists every place the two differ on purpose, so "differs" is never a
surprise found later.

Labels are per `README.md`.

## 1. Two dashboards, not one

**Live.** One `/dashboard`. **OBSERVED**

**Here.** Two: the pre-existing LAEC exam overview, and a Saint Finbarr's summary
with school-management tiles. They are not alternatives — the first answers
"how are the joint exams going", the second answers "how is the school doing" —
and collapsing them would have meant deleting a panel this project already owned.

## 2. Leave approvals are permission-gated

**Live.** `LeaveDetailPage` renders Approve and Reject for any `PENDING` row with
**no permission check at all**. **SOURCE**

**Here.** Both buttons are gated on `leave.approve`, and a session without it sees
neither. **Verified W16** — the buttons leave the DOM rather than being disabled,
and each affected row falls back to a View button.

This is the one place where reproducing the live behaviour would have been the
wrong call. The live gap is a bug in a *teacher-facing* page, where a teacher may
legitimately see their own request and the page cannot tell the difference. In an
admin console, where the permission exists and is granted, shipping ungated
buttons would mean shipping a control the rail already says this session does not
hold. The teacher-portal port of the same page already flagged this gap
(`docs/teacher-portal/permissions.md` §4).

## 3. Daily Attendance Trend is tallies, not a chart

**Live.** `/attendance/reports` shows a "Daily Attendance Trend". **OBSERVED**

**Here.** A per-week tally table. The mock's attendance data has a **week**
dimension and no day series, so a trend chart would have to invent the days it
plots. A chart of invented data is worse than a table of real data.

## 4. The three broken settings pages stay broken

**Live.** `/system/academic-settings`, `/system/branding` and
`/system/notification-settings` each fail their own read and show *"Couldn't load
… settings"*. **OBSERVED**

**Here.** The same error cards, with no form fields. **Verified W17** — all three,
message and field count.

Inventing a grading-scale form on `academic-settings` would document a feature the
live deployment does not have. The grading scale that *does* exist is at
`/results/grading`, and it is reproduced in full as the `grading` panel.

## 5. The 33 school roles do not gate the console

**Live.** 33 roles, each with its own permission set; the rail filters on a
permission, not on a role name. **SOURCE**

**Here.** The 33 roles are seed data — readable, editable, and rendered by the
`roles` panel — but the console gate is `permission` codes, not role names.

The two are different axes. A session in this project carries one LAEC claim
(`SUPER_ADMIN`, `SCHOOL_ADMIN`, …), not one of 33 school job roles; and LAEC's
model has no equivalent of "Bursary". Wiring the 33 in would mean reconciling two
role models in one predicate, which is the failure this project already had to undo
once — the SUPER_ADMIN exemption, where navigation and function disagreed because
only navigation knew about it.

## 6. A generic panel instead of 58 components

**Live.** Each list page is its own component. **OBSERVED**

**Here.** 13 of the 59 panels are rendered by `AdminResourcePanel.vue` from a
registry entry. **Not a divergence in behaviour** — the rendered page is the same
page — but a divergence in structure, and the reason 59 panels needed 21
components rather than 59.

## 7. The refund queue is one queue, not two lists

**Live.** `/store/queue` and its refund state. **SOURCE**

**Here.** One `queue` panel with `?status=REFUND_PENDING`, carried on the rail as
a separate entry pointing at the same list. Two independent lists could disagree
about which orders are awaiting a refund decision; one list cannot.

## 8. Store checkout is absent

**Live.** `/store/cart` → `/store/checkout` → payment verification. **SOURCE**

**Here.** `store` and `cart` render the catalogue and the cart; **checkout is not
issued**. The button is absent rather than wired to a mock that would be inventing
a payment flow and a payment-reference verification. Recorded as **Partial** in
`feature-matrix.md`.

## 9. Live data defects: recorded, not reproduced

| Defect | Handling |
|---|---|
| `MAX CA: 40` while CA 1 (20) + CA 2 (10) = 30 | **Reproduced.** The mock carries `maxCA: 40`, so the page contradicts itself here exactly as it does live. A silent correction would hide a real problem from whoever reads this portal. |
| `JSS 1` and `JSS1` both offered as class names | **Not reproduced.** The mock's class list is deduplicated. 23 live class names have near-duplicates; reproducing the ambiguity would make the picker unusable for no gain. |
| `/awards` fails to load while `/awards/new` works | **Not reproduced.** The mock serves both. |
| Four routes render *Under construction* | **Not reproduced.** There is nothing to reproduce, and a stub would be a feature that does not exist. |
| Four `/parent/*` routes 404 | **Not reproduced.** Recorded in `route-inventory.md`. |

## 10. Modules not built

Named in full in `feature-matrix.md`. In short: the teacher-portal surfaces
already exist here on `/teacher/`; the notice board and events calendar already
exist on `/notices/` and `/calendar/`; **Disciplinary and Counselling are two
whole modules and are the largest remaining scope**; messaging is a
per-conversation surface outside an admin console's remit.

## 11. One id renamed

The LAEC `/admin/` panel `students` was renamed `student-directory`, because the
Saint Finbarr's student module already wanted `students` and two rail entries
cannot share an id. The LAEC markup, its ids and its behaviour are otherwise
untouched; only the id changed, and only the rail label that named it.

## What was NOT verified

**No non-admin role was ever signed in on the live portal.** The supplied account
holds a single claim, `SUPER ADMIN`. Every statement here about what a teacher,
parent, bursary officer or house parent sees is either SOURCE-derived or absent,
and where the live source shows a permission gate it is labelled SOURCE rather
than presented as observed behaviour.

## Read next

`feature-matrix.md` for the per-panel status, `verification-checklist.md` for what
was proven.