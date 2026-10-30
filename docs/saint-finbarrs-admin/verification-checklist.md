# Verification checklist — every check, its result, and how it was run

Everything below was executed on 2026-10-07 and re-run on 2026-10-12 against the
local dev server
(`npm run dev`, `http://localhost:5173`) with the project's own published mock
fixture `mocksuper`. **No live credential appears in any check, script, log or
output.**

## Two drivers, one set of claims

| Script | Driver | What it is |
|---|---|---|
| `tools/audit/verify-walk.js` | Playwright MCP | The 74-panel walk |
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
| Build | `npm run build` | **PASS** — 990 modules, built in 9.8 s |
| Registry ↔ rail ↔ panels ↔ permissions | `node tools/check-admin-parity.mjs` | **PASS** — 66 modules, 75 rail entries, 18 bespoke panels, 180 codes, 9 option lists |
| Permission resolution, fail-closed | `node tools/check-rbac.mjs` | **PASS** — 181 codes, 6 roles, 229 grants, SUPER_ADMIN a 177-code superset with no exemption, 61 nav entries, 114 write actions mapped |
| Login doors | `node tools/check-doors.mjs` | **PASS** |
| CSS layering | `node tools/check-layers.mjs` | **PASS** |
| Dashboard totals | `node tools/check-overview-totals.mjs` | **PASS** |
| Media rules | `node tools/check-media-rules.mjs` | **PASS** |
| Template components resolved **and templates compile** | `python tools/check-template-components.py` | **PASS** — 59 templates, 0 unresolved, 0 the Vue compiler rejects |
| Stylesheets parse | `node tools/check-css-parses.mjs` | **PASS** — 65 blocks, 0 problems |
| No dead controls | `python tools/find-dead-controls.py` | **PASS** — 59 templates, 0 controls that cannot act |

## Browser checks

| Check | Script | Result |
|---|---|---|
| Every panel mounts, no console or page errors | `node tools/audit/cdp-walk.mjs` | **PASS** — 74/74 panels (67 admin modules + 7 LAEC regression), 0 console errors, 0 page errors |
| Workflow behaviour | `node tools/audit/cdp-workflows.mjs` | **PASS** — 32/32 checks |
| Shell scrolling, at three viewports | `node tools/audit/measure-layout.mjs` | **PASS** — 17/17 checks |
| Accessibility, in the browser | `node tools/audit/audit-a11y.mjs` | **PASS** — 6/6 checks, 343 controls named |

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
PASS — 74/74 panels mounted, no console or page errors.
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

## Defects found by measuring the permissions dialog

Found by rendering it and reading computed styles, not by reading the markup.
Every one of them was invisible to the type checker, the build and all eleven
workflow checks.

| # | Defect | Measured | Fix |
|---|---|---|---|
| 8 | `admin-page.css:702` sets `.page-admin input { width: 100%; padding: 13px 14px }` for text fields and never narrows it, so **every checkbox in the console rendered 102 px wide** — including all 178 in the permissions dialog. The neutralising block in `admin-panel-page.css` is narrowed to types and `checkbox` was not on its list | 102.6 × 13 px in a 264 px row | a checkbox primitive on `.page-admin input[type=checkbox]`, keyed on `.page-admin` rather than `.ap-admin-panel` because a dialog is a sibling overlay |
| 9 | `.page-admin label` sets `text-transform: uppercase; letter-spacing: .1em; font-weight: 800`, both inherited properties, so the permission labels rendered as tracked-out small caps — and a `margin-bottom: .45rem` the matrix's own gap never asked for | `uppercase`, `1.216px` letter-spacing | explicit `text-transform: none` / `letter-spacing: normal` on the label, `margin-bottom: 0` on the row |
| 10 | `.page-admin header` sets `flex-direction: column` and `justify-content: space-between`, so each group header **stacked its select-all checkbox above the group name**; and `.page-admin .ap-admin-panel header`'s blanket `border: 0` erased the divider | `flex-direction: column`, `border-bottom: 0px none` | overrides written with an extra class ahead of the child combinator, so they win on specificity |
| 11 | The matrix capped itself at 22 rem with `overflow-y: auto` inside `.ap-dialog__body`, which is itself the scroller — **two nested scrollers**, so the footer was unreachable | 352 px of visible against 6000 px of content, inside a second scroller | matrix renders at full height; **1 scrollable element** in the dialog now, the body |
| 12 | `AdminDialog`'s docstring claimed a focus trap and there was none — the handler only handled Escape, so Tab walked out of the dialog while `aria-modal="true"` declared the page inert | Tab from the last of 182 controls left the dialog | trap implemented at both ends only; verified that a Tab in the middle is not intercepted |
| 13 | The close control was a text `&times;` in a button sized by font metrics, not by its box | 24 × 27 px | a fixed 32 × 32 with a 1.7-stroke icon, 44 × 44 on a coarse pointer or a narrow viewport |

Two harness defects were fixed at the same time, because a check that cannot
report *where* it failed is how #11 stayed hidden:

- `cdp-workflows.mjs` aborted with `TypeError: ... (reading 'click')` and nothing
  else. Its catch now dumps the URL, the mounted panel, its row and button
  counts, the open dialog, and the captured console and page errors. That dump
  is what identified #13's cousin immediately: the panel was loaded with 33 rows
  and its Edit buttons present, a dialog was already open, and the abort was the
  **last** line of W11, not the first — it was clicking a button whose text is
  exactly `'Save'` after the label became `'Save changes'`.
- Both W11 implementations now find the confirm button by its position in
  `.ap-dialog__foot` rather than by label, so the check survives the wording
  improving.

## Defects found by a static check rather than a workflow

Two, and both are classes of error that no other check in this project reported.

| # | Defect | Found by | Fix |
|---|---|---|---|
| 6 | The missing `AdminDialog` import in `AdminStudentsPanel` — a render-time warning, not a build error | `check-template-components.py` | the script now fails on unresolved template components |
| 7 | A duplicated `<template #actions />` in `AdminCaseModulePanel` — a dev-server 500 on every panel that mounts the file | `check-template-components.py` | removed; the script now compiles every template through Vue's own compiler |

Defect 7 is the more interesting one, and it is why the script was extended rather
than a new check written. **`vue-tsc` reported the file as clean.** The type
checker has nothing to say about slot names, so a template Vue cannot compile was
invisible to every check in this project — including `vite build`, which was not
run at the time, and including the panel walk, which reported all 74 panels MISS
with no explanation. The walk's output was the only symptom.

The script now calls `parse()` **and** `compileTemplate()` on every `.vue` file.
`parse()` alone is not enough: a duplicated slot is well-formed as far as the
parser is concerned, and is only rejected when the template is compiled. Verified
by re-introducing the defect — the script fails on it, and `vue-tsc` still says
nothing.

## Defects found in the second pass

The remaining work was store checkout, two modules and the roles axis. Writing
checks for them surfaced five more, of which two were in the mock and one was a
feature that had been documented as a gap while actively lying.

| # | Defect | Found by | Fix |
|---|---|---|---|
| 8 | **Checkout reported success for nothing.** `placeOrder` looped `ADD_TO_CART` over the cart's own lines — adding to the thing it had just emptied — then set the banner *"Order placed. It is now in the bursary confirmation queue."* No order was created. | W20 | `PLACE_STORE_ORDER`, a mock-owned `StoreCart`, and an assertion on the **queue gaining a row** rather than on the banner |
| 9 | `AdminInventoryPanel` only loaded in `onMounted`, so switching between two of its eleven panels through the rail mounted the second with no read behind it — the queue rendered its empty state over four orders | W20 | a `watch` on `props.module.id` |
| 10 | `orderSeq` was seeded to 2, so the first order placed collided with a seeded order number and the two were indistinguishable | W22 | derived from the seed, so it cannot fall out of step |
| 11 | The panel walk read each panel after a fixed delay, landing mid-load and reporting 0 tables / 0 rows for panels that work | walk output | two quiet samples, because the panel element exists before its read is issued |
| 12 | `check-rbac.mjs` transpiled without `--bundle`, leaving runtime imports as bare specifiers that resolved to the wrong directory. It only surfaced once `roles.ts` took a runtime import rather than type-only ones — with type-only imports esbuild erased them and the output happened to be self-contained | check-rbac | `--bundle`, so the check no longer depends on which files import what at runtime |

Defect 8 deserves emphasis. It had been documented as *"the button is absent rather
than wired to a mock that would be inventing a payment flow"* — which understated
it. A missing control is noticed; a control that reports an outcome it did not
produce is not. Documenting a lying button as an absent one is its own kind of
failure, and it survived a full audit because every existing check asserted on
things that were present rather than on what a control claimed.

## Not verified, and why

| Claim | Why not |
|---|---|
| Behaviour of any non-admin role on the live portal | The supplied account holds one claim. Every such statement is SOURCE or absent. What *is* verified now is this console's own role model — see `roles-and-permissions.md` §5. |
| The permissions each of the 33 school roles actually holds | The live `/roles` table publishes a **count** per role, not the list; the lists sit behind a per-role drilldown this audit did not open. `SCHOOL_ROLE_PERMISSIONS` is a reconstruction from each role's documented remit, and the roles panel shows both numbers per row so the divergence is visible. |
| 24 of the 33 incident types | The crawl truncated at 3000 characters and the catalogue is server-side data, absent from the deployed frontend source too. The 9 captured verbatim are seeded exactly; no placeholder offences were invented. |
| The live cart's online payment redirect | Reproducing it would mean inventing a payment provider's redirect and its verification. The bursary path — the one the queue exists to serve — is complete. |
| Any write against the live portal | The audit's safety rule was navigation and open-and-dismiss only. |
| Server-side enforcement | The live API is a separate service; this project cannot call it. |

## Read next

`feature-matrix.md` for the per-panel status, `parity-report.md` for the
