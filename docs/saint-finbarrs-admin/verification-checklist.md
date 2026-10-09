# Verification checklist — every check, its result, and how it was run

Everything below was executed on 2026-10-07 against the local dev server
(`npm run dev`, `http://localhost:5173`) with the project's own published mock
fixture `mocksuper`. **No live credential appears in any check, script, log or
output.**

## Two drivers, one set of claims

| Script | Driver | What it is |
|---|---|---|
| `tools/audit/verify-walk.js` | Playwright MCP | The 66-panel walk |
| `tools/audit/verify-workflows.js` | Playwright MCP | The workflow checks, sliced A–H |
| `tools/audit/cdp-walk.mjs` | DevTools Protocol | The same walk, dependency-free |
| `tools/audit/cdp-workflows.mjs` | DevTools Protocol | The same checks in one pass |

Both drivers were written because a check that can only be run once proves
nothing about whether it still passes, and the MCP server became unavailable part
way through. The CDP scripts assert the same things and were run after every fix.

## Static checks

| Check | Command | Result |
|---|---|---|
| Types | `npx vue-tsc --noEmit` | **PASS** — 0 errors |
| Build | `npm run build` | **PASS** — 983 modules, built in 7.5 s |
| Registry ↔ rail ↔ panels ↔ permissions | `node tools/check-admin-parity.mjs` | **PASS** — 58 modules, 67 rail entries, 16 bespoke panels, 180 codes, 9 option lists |
| Permission resolution, fail-closed | `node tools/check-rbac.mjs` | **PASS** |
| Login doors | `node tools/check-doors.mjs` | **PASS** |
| CSS layering | `node tools/check-layers.mjs` | **PASS** |
| Dashboard totals | `node tools/check-overview-totals.mjs` | **PASS** |
| Template components resolved | `python tools/check-template-components.py` | **PASS** — 57 templates, 0 unresolved |

### A check that was itself wrong

`check-admin-parity.mjs` bounded the registry slice at a marker (`} as const`)
that does not exist in the file. `String.indexOf` returns −1 for an absent
marker and `slice(start, -1)` then runs to the end of the file — so the slice
silently included `UNAVAILABLE_SETTINGS`, and the check reported **61 modules
where there are 58**, and still said OK, because those three also have rail
entries and panels.

Fixed: the slice is now bounded at the next `export const`, which exists, and the
check throws rather than guessing if the file is reordered.

A check that computes the wrong thing and passes is worse than no check.

## The panel walk

`node tools/audit/cdp-walk.mjs`

```
sign-in: /admin/ role=SUPER_ADMIN
panels walked: 66, mounted: 66
  (admin modules: 59, LAEC regression: 7)
console errors: 0
page errors: 0
PASS — 66/66 panels mounted, no console or page errors.
```

Per panel it records: whether it mounted, and under which id; its heading; table
and row counts; control counts; dialogs; and how many console errors, page errors
and failed requests occurred while it was open.

**The two panel families are addressed differently**, and conflating them produces
a false pass:

- A Saint Finbarr's module carries `data-admin-panel="<id>"` and is reached with
  `?panel=<id>`. "Did a wrapper for the id I asked for mount?" is the whole
  question.
- A LAEC panel is origin markup — a `<div id="…" class="tab-panel">` shown by
  carrying `active` — and `?panel=` does not address it. Those rows are seeded
  through `activeLAECTab` and asserted by id **and** by the `active` class.

The first version of this walk probed LAEC panels with `?panel=` and reported all
seven as OK while rendering the previously visited module. The fix is above; it is
recorded because the failure mode was a checker that could not fail.

## Workflow checks

`node tools/audit/cdp-workflows.mjs` — **22 checks, 22 PASS**.

| Id | Claim | Evidence |
|---|---|---|
| W1 | An empty create is refused with a required-field message | refused with "Name is required", dialog stayed open |
| W1b | A valid create persists and banners | rows 5 → 6, banner "Created." |
| W2 | The search box refetches and narrows the table | rows 5 → 0 for "Sash" |
| W3 | The row action menu lists the declared actions and dismisses on an outside click | [View details, Edit, Deactivate, Suspend, Delete], dismissed |
| W4 | Approving leave moves it from Pending to Decided | Pending 1 → 0, Decided 2 → 3, banner "Leave request approved." |
| W5 | Both leave validation rules refuse with the deployed source wording | "Select the staff member", then "End date must be after the start date" |
| W6 | Blanking School name refuses the save with no write issued | "School name is required", no banner |
| W7 | A minimum password length below 8 is refused | "Minimum password length must be at least 8." |
| W8 | An inverted grading band is refused before any save | "Each band needs a minimum score at or below its maximum." |
| W9 | Results entry recomputes TOTAL and GRADE; submit is gated on a class | 18+9+8+57 = 92, grade F → A, submit disabled |
| W10 | A wallet top-up of 5,000 moves the balance | ₦0.00 → ₦5,000.00, banner "Topped up ₦5,000.00" |
| W10b | An amount of zero is refused | "Amount must be greater than zero", dialog stayed open |
| W11 | Adding a permission grant changes the in-dialog count and saves | Vice Principal 0 → 1, banner "Saved 1 permission(s)" |
| W12 | An attendance mark survives a save, a close and a reopen | 22-row register, "Saved 22 mark(s)", Escape closed it, still present on reopen |
| W13 | Pagination reports its range and moves | "Showing 1–20 of 32" → "Showing 21–32 of 32", Prev disabled on page 1 |
| W14 | Export writes a CSV whose header is the module's column set | `staff.csv`: "Employee,Roles,Department,Designation,Status" + 10 rows |
| W15 | A status tab filters the table | "3 leave request(s)" → "1 leave request(s)" |
| W16 | Without `leave.approve` the decision buttons are **not rendered** | Approve/Reject 1/1 → 0/0, View rose 2 → 3; restoring the grants brought Approve back |
| W16c | `/admin/` refuses a SCHOOL_ADMIN claim | landed on `/control/` with no module mounted |
| W17 | The three broken live settings pages stay broken, with no invented form | all three: the origin's message, 0 fields |
| W18 | The panel reflows at 390 px | page 390 ≤ viewport 390, panel 362 ≤ 362 |
| W19 | A deep-link lands on its module with the create dialog open | `?panel=fee-payments` → panel `fee-payments`, dialog "Record Payment" |

### Two checks that were themselves wrong first

Both were the check's fault, not the product's, and both are recorded because a
check that fails for the wrong reason trains you to ignore it.

- **W14 read the exported CSV back through its blob URL** and got `-1` rows,
  because the export revokes the URL as soon as it is created. The check now
  intercepts `URL.createObjectURL` and reads the Blob it was handed.
- **W10 held a `<tr>` reference across a write** and read the balance from it
  afterwards. `load()` swaps the records array, Vue has already replaced that
  node, and the check read a stale element showing the pre-write value — which
  is indistinguishable from a write that did not land. The check now re-reads the
  rows.

## The defects these checks found

All five were found by the workflow checks. None would have been caught by the
type checker, the build, a screenshot, or the panel walk.

| # | Defect | Found by | Fix |
|---|---|---|---|
| 1 | `.page-admin header` is a bare element selector, so every module's heading row was pinned over the rail and its toolbar buttons could not be clicked | W3 | reset `.page-admin .ap-admin-panel header` in `admin-panel-page.css` |
| 2 | The wallet adjust dialog rendered an empty form, because the module declares no fields and the amount is the operator's input, not a record attribute | W10 | `AdminDialog.fields`, `WALLET_ADJUST_FIELDS`, and a `positive` field rule for the zero check |
| 3 | `ADJUST_WALLET` decided its direction from the confirm button's label, so changing that label to the origin's "Credit wallet" would have made a top-up deduct | W10 | direction read from the action's own label |
| 4 | `AdminDialog` registered its Escape handler in a `watch` with no `immediate`, so a dialog that mounted already open never got one — and the attendance register reloads after a save, remounting it | W12 | `{ immediate: true }` |
| 5 | A client-side link changing `?panel=` did not switch the mounted module, because `AdminView` read the query once on mount | W19 | a `watch` on `route.query.panel` |

A sixth was found by a static check rather than a workflow: the missing
`AdminDialog` import in `AdminStudentsPanel`, which is a render-time warning
rather than a build error. `tools/check-template-components.py` now fails on that
class of defect.

## Not verified, and why

| Claim | Why not |
|---|---|
| Behaviour of any non-admin role on the live portal | The supplied account holds one claim. Every such statement here is SOURCE or absent. |
| Any write against the live portal | The audit's safety rule was navigation and open-and-dismiss only. |
| Server-side enforcement | The live API is a separate service; this project cannot call it. |
| Disciplinary and Counselling modules | Not built. Named in `feature-matrix.md`. |
| Store checkout | Not built. Named in `feature-matrix.md`. |

## Read next

`feature-matrix.md` for the per-panel status, `parity-report.md` for the
divergences, `workflows.md` for what each check was driving.