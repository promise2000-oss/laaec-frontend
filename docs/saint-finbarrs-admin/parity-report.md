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

**Here.** 13 of the 67 panels are rendered by `AdminResourcePanel.vue` from a
registry entry. **Not a divergence in behaviour** — the rendered page is the same
page — but a divergence in structure, and the reason 67 panels needed 23
components rather than 59.

That ratio held through both modules because they are the same page shapes with
different nouns: `AdminCaseModulePanel` serves the catalogue, committee and form
panels of *both* Disciplinary and Counselling, and `AdminCaseWorkPanel` serves
their case and report lists. Two more panels added one component between them.

## 7. The refund queue is one queue, not two lists

**Live.** `/store/queue` and its refund state. **SOURCE**

**Here.** One `queue` panel with `?status=REFUND_PENDING`, carried on the rail as
a separate entry pointing at the same list. Two independent lists could disagree
about which orders are awaiting a refund decision; one list cannot.

## 8. ~~Store checkout is absent~~ → RESOLVED, and the thing it replaced was worse than absent

**Live.** `/store/cart` → `/store/checkout` → payment verification; the queue
detail confirms against a payment reference. **SOURCE**

**Here now.** `GET_CART`, `ADD_TO_CART`, `UPDATE_CART_ITEM`, `REMOVE_CART_ITEM`
and `PLACE_STORE_ORDER`; `CONFIRM_STORE_ORDER` and `RESOLVE_STORE_REFUND` for the
bursary. The cart is a record the mock owns, so checkout is a transaction against
it: every line is validated before any is reserved, stock moves at checkout and
returns when a refund is *resolved*. The two bursary decisions are behind the live
dialogs, and `"Payment reference is required."` is enforced in the mock rather
than in the panel, so the refusal is the server's. Verified in `workflows.md`,
W20–W20c.

**What the gap actually was.** This entry previously read "the button is absent
rather than wired to a mock that would be inventing a payment flow". That was
wrong about the code. `AdminInventoryPanel` *did* have a Checkout button; it
looped `ADD_TO_CART` over its own cart lines — which adds to the thing it has just
emptied, and cannot create an order even in principle — and then set the banner
`"Order placed. It is now in the bursary confirmation queue."` **A control that
reported success for something that had not happened.** Documenting that as
"absent" understated it. It is now a real transaction.

**One divergence, deliberate.** The live cart offers *Pay online*, which redirects
to a payment page and then a callback. Reproducing that would mean inventing a
payment provider's redirect and its verification, so `PLACE_STORE_ORDER` takes a
`paymentMethod` and places the order; the online path is labelled and does not
simulate a payment page. The bursary path — the one the queue exists to serve — is
complete.

## 9. Live data defects: recorded, not reproduced

| Defect | Handling |
|---|---|
| `MAX CA: 40` while CA 1 (20) + CA 2 (10) = 30 | **Reproduced.** The mock carries `maxCA: 40`, so the page contradicts itself here exactly as it does live. A silent correction would hide a real problem from whoever reads this portal. |
| `JSS 1` and `JSS1` both offered as class names | **Not reproduced.** The mock's class list is deduplicated. 23 live class names have near-duplicates; reproducing the ambiguity would make the picker unusable for no gain. |
| `/awards` fails to load while `/awards/new` works | **Not reproduced.** The mock serves both. |
| Four routes render *Under construction* | **Not reproduced.** There is nothing to reproduce, and a stub would be a feature that does not exist. |
| Four `/parent/*` routes 404 | **Not reproduced.** Recorded in `route-inventory.md`. |

## 10. ~~Modules not built~~ → Disciplinary and Counselling are now built

Both are implemented, on **two shared components** rather than four. They are the
same three page shapes with different nouns — a standing catalogue or team list, a
committee with seats, a sectioned referral form, and a filtered case list — and the
deployed app is written the same way (`counselling-cases.tsx` and
`disciplinary-reports.tsx` are siblings). Eight panels:

| Panel | Live route | Notes |
|---|---|---|
| `disciplinary-incidents` | `/disciplinary/incidents` | 9 of the live 33 entries, verbatim, sanction text intact. See §12. |
| `disciplinary-committees` | `/disciplinary/committees` | Seats carry CHAIR / MEMBER; at most one chair is accepted. |
| `disciplinary-launch-case` | `/disciplinary/launch-case` | Requires student, incident type and date — the three the live form marks. |
| `disciplinary-reports` | `/disciplinary/reports` | Filters, detail dialog, status control, comment thread. |
| `counselling-cases` | `/counselling/cases` | Same list shape, referral vocabulary. |
| `counselling-book-session` | `/counselling/book-session` | Requires student, referral date and reason. |
| `counselling-committee` | `/counselling/committee` | |
| `counselling-reports` | `/counselling/reports` | The five live narrative fields, DRAFT/FINAL. |

**Divergences, all deliberate:**

- **The actions are not new.** Both modules were already built for this project's
  `/teacher/` console, with their handlers and types in `types/teacher.ts`. The
  admin panels issue those same actions against the same records. Declaring
  admin-shaped twins would have been a second definition of one case — the drift
  this project has already had to undo once, when leave decisions existed on both
  sides. Only the two case deletes are new (`DELETE_COUNSELLING_CASE`,
  `DELETE_DISCIPLINARY_CASE`), shaped as the deployed `deleteCase(id)` is.
- **Severity is filtered client-side.** The teacher-side read takes no severity
  argument, so `disciplinary-reports` narrows after the read. The origin filters
  it in the query.
- **The student picker is a fixed list.** The live form searches students over
  the API as you type; this mock has no directory to search, so it offers the
  three students its own case fixtures refer to and says so in the hint. A search
  box that matched nothing would look broken and be worse.
- **The status control offers every state except the case's own** —
  `disciplinary-report-detail.tsx` filters `CASE_STATUS_OPTIONS` against
  `caseRecord.status`. Reproduced rather than offering the current state.
- **Case deletion is gated here and is not gated on the origin.**
  `deleteCounsellingCase(id)` carries no permission, so a blanket reproduction
  would put a delete button in front of everyone who can see a case. Gated on
  `counselling.committees.manage` / `disciplinary.committees.manage` instead —
  this console's floor, not a reproduction.

**Still absent:** messaging. It is a per-conversation surface, outside an admin
console's remit. Named in `feature-matrix.md`.

## 11. The 33 school roles are now a second authorisation axis

Previously recorded as a scope decision: a session carried one LAEC claim, so the
33 roles were a table and nothing more. They are now the second axis — rail
filter, `sessionCan` and the transport gate all read the same union — with
"hold this role" and "preview this role" on the roles page.

The per-role permission lists are a **reconstruction** from each role's documented
remit, not a transcription; the live `/roles` table publishes only a count per
role. Full comparison, including every role where the two disagree, is in
`roles-and-permissions.md` §5.

## 12. The incident catalogue carries 9 of the live 33 entries

**OBSERVED.** The live `/disciplinary/incidents` page holds 33 offences, each with
the sanction the school has attached to it written out in full.

**NOT VERIFIED, and not filled in.** The crawl captured the page's rendered text,
which truncated at 3000 characters. Nine entries were captured verbatim and are
seeded exactly; the other 24 are server-side data, not in the deployed frontend
source either, so they cannot be recovered from what is available. A tenth entry
begins at the very end of the capture and its sanction runs past the limit, so it
is left out rather than included with a description that stops mid-sentence.

No placeholder offences were invented. An invented rule in a rule book is worse
than a missing one, because someone would act on it.

These nine replaced two invented one-liners ("Fighting — physical altercation
between students") that had no counterpart in the deployed app.

## 13. One id renamed

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