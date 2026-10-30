# UI audit — layout, chrome, tables, forms and states

Labels are per `README.md`. This document covers both the live portal as observed
and what this project does about each item.

## The shell

**Live.** A fixed full-bleed masthead (`position: fixed; top/left/right: 0`,
`width: 100%`, navy gradient, white text, `z-index: var(--z-sticky)`), a
left-hand rail grouped into named sections, and a content well. Every page in the
audit carries the same masthead — it is one layout, not twelve. **OBSERVED**

**Rail sections and permissions.** Each rail item declares the permission required
to see it. The live rail shows all of them to a Super Admin, which is correct for
that claim and is not evidence about any other. **SOURCE** (`lib/nav-config.ts`).

**Here.** The same shape: `AppShell.vue` draws the masthead and the rail, the
rail is grouped into 12 sections, and each entry is filtered against the live
session's grants. See `roles-and-permissions.md` for why the filter and the
controls read the same predicate.

## A real defect this project had, and why it was invisible

The origin stylesheet's masthead rule is `.page-admin header` — a bare **element**
selector, not a class. `AdminModuleShell` and `AdminDialog` both use a `<header>`
for their own headings, so the masthead rule landed on them: every module's
heading row was pinned to the top-left of the viewport, 100% of the window wide,
**over the rail**, with its toolbar buttons sitting underneath it where a click
could not reach them.

It was invisible to everything except a test that clicks:

- `vue-tsc` passed — it is a stylesheet.
- `vite build` passed — it is a stylesheet.
- A screenshot passed — the heading looked present, just full-width.
- The panel walk passed — the panel mounted, and the walk counts panels, not
  clicks.

Only workflow check **W3**, which clicks a toolbar button, found it. The fix is a
reset scoped to `.ap-admin-panel header` in `src/styles/admin-panel-page.css`. The
same class of bug is already documented and handled in this codebase for the
notification popup's `<header class="bell-head">` — which is why it was found by
a test rather than by eye.

## Tables

**Live.** Every list is a `<table>` inside a horizontally scrollable wrapper, with
a header row and a body. Numeric columns are right-aligned. Identity is an avatar
circle with initials beside a name and a secondary line (an email, an admission
number, a SKU). Status is a coloured pill. Row actions are behind a per-row menu.
Counts are large in the live lists — 151 rows on `/attendance/reports`, 36 on
`/academic/subjects`, 33 on `/roles`. **OBSERVED**

**Here.** The same vocabulary, in `components/admin/admin-panel.css`:
`.ap-table`, `.ap-identity`, `.ap-avatar`, `.ap-badge`, `.ap-menu`. The generic
panel pages at 10 rows with the live app's `Showing 1–10 of N` line; the
permissions panel pages its user view at 20 because that is what the live
`/permissions` users tab shows. **Verified W13.**

One deliberate difference: the live lists render every row the API returns and
leave scrolling to the user, while the generic panel pages. The live app's own
`/permissions` and `/users` pages do page, so this is the live behaviour for the
pages that have it and a floor for the pages that do not.

## Forms

**Live.** Labelled controls, required fields marked, validation messages in the
origin's own wording, and the forms are inside a dialog rather than a route for
most modules (`/students/new` is a route; the wallet adjustment is a dialog). **OBSERVED** + **SOURCE**

**Here.** `AdminDialog` renders one shell for create, edit, detail and confirm,
differing only in body and confirm-button label. Escape closes; the backdrop
closes; focus moves into the panel on open and returns to the opener on close; a
confirm button is never the default focus, because it may delete something.

The origin's exact validation strings are reproduced rather than paraphrased —
they are what an operator reads under time pressure. They are listed per workflow
in `workflows.md` and verified one by one (W5, W5b, W6, W7, W8, W10b).

## States

Every panel renders the same four, in `AdminModuleShell`:

| State | When | Surface |
|---|---|---|
| Loading | a read is in flight | a spinner in a `role="status"` region |
| Error | a read failed | the origin's message plus a **Retry** button |
| Empty | the read succeeded and matched nothing | the module's own empty copy |
| Success | a write succeeded | a dismissible banner naming the outcome |

This is the live app's pattern (`PageSpinner`, `ErrorBanner` + retry,
`EmptyMessage`, an auto-hiding emerald banner) factored out once rather than
spelled out per module. **Verified** — W1b, W4, W6, W7, W8, W10 and W12 each
assert the banner text after a write.

**The empty state is not the same as the error state**, and that distinction is
load-bearing: a module whose read returns nothing is *empty*, and one whose read
fails is *errored*, and conflating them tells an operator their data is gone when
the server is down.

## The three broken settings pages

`/system/academic-settings`, `/system/branding` and
`/system/notification-settings` each fail their own read on the live deployment
and show *"Couldn't load … settings"*. **OBSERVED**

They are reproduced as error cards with zero form fields — verified **W17**, which
asserts both the message and the absence of any input on all three. Inventing a
grading-scale form on the academic-settings page would document a feature the live
deployment does not have; the grading scale that *does* exist lives at
`/results/grading` and is reproduced as the `grading` panel.

## Responsive behaviour

**Live.** A desktop-first layout that narrows below 900 px: the rail collapses
behind a toggle and the masthead reflows. **OBSERVED**

**Here.** The same two breakpoints. Tables scroll inside their own wrapper rather
than pushing the page sideways, which is the treatment this project already gives
its own console tables (D-59). **Verified W18** — at a 390 px viewport the page's
`scrollWidth` equals its `clientWidth` (390), and the panel does not overflow its
wrapper.

## The permissions dialog, rebuilt

The `Permissions — {Role}` dialog is the densest surface in the console — 29
groups, 149 permissions, a select-all per group — and measuring it turned up
defects that reading the markup did not.

**Every checkbox was 102 px wide.** `admin-page.css:702` writes one element rule
for the console's fields, `.page-admin input, .page-admin select { width: 100%;
padding: 13px 14px }`, written for the origin's text inputs and never narrowed
to them. It lands on `input[type=checkbox]` too. The neutralising block in
`admin-panel-page.css` *is* narrowed to types, and `checkbox` was not on its list,
so nothing overrode it: measured **102.6 × 13 px** inside a 264 px row. This read
as "the checkbox sits far from its label" and was actually a control stretched to
a third of the row. Replaced with a real checkbox primitive — `appearance: none`,
18 px, checked/indeterminate/disabled states and a focus ring that does not move
the control. Keyed on `.page-admin`, not `.ap-admin-panel`, because a dialog opened
from inside a panel is a sibling overlay and never a descendant of it.

**`<label>` and `<header>` both carry origin rules that beat a class.**
`.page-admin label` sets `font-size: .76rem; font-weight: 800; text-transform:
uppercase; letter-spacing: .1em; margin-bottom: .45rem`; `.page-admin header`
sets `position: fixed`, a navy gradient, `flex-direction: column` and
`justify-content: space-between`. Both are element-scoped, so a single class does
not outrank them, and the group header's own divider was being erased by
`.page-admin .ap-admin-panel header`'s blanket `border: 0`. The permission labels
were rendering as tracked-out small caps **and** carrying a 7.2 px margin the
matrix's own `gap` never asked for; the group header was stacking its checkbox
above the group name. Each override is written with an extra class ahead of the
child combinator, so it wins on specificity rather than on source order.

**There were two scrollers, so the footer was unreachable.** The matrix capped
itself at 22 rem with `overflow-y: auto` inside `.ap-dialog__body`, which is
itself the scroller. Wheel over the list scrolled the list, wheel over the gaps
scrolled the dialog, and neither reached the footer. The matrix now renders at
full height: measured **1 scrollable element** in the dialog — the body, with
5579 px of overflow. The edge shadows are four background layers on the body, two
`background-attachment: local` covers over two `scroll` shadows, so a shadow
appears only on the side that still has content and no scroll listener is needed.

**The focus trap was documented but absent.** `AdminDialog`'s comment claimed
one; the handler only handled Escape, so Tab walked straight out of the dialog
while `aria-modal="true"` told assistive technology the page behind was inert.
Now implemented, wrapping at both ends only. **Verified:** Tab from the last of
182 focusable controls returns to the first, Shift+Tab from the first returns to
the last, a Tab in the middle is not intercepted, and focus never leaves.

Three smaller ones: the close control was a text `&times;` in a button sized by
font metrics (24 × 27 px) and is now a fixed 32 × 32 with a 1.7-stroke icon,
growing to 44 × 44 on a coarse pointer or a narrow viewport; the selection count
was a prose line and is now a live pill plus a footer count; and `Clear all` and
the dialog search did not exist at all.

**Deliberately unchanged:** group select-all acts on the whole group even while a
search is filtering the matrix. Selecting only the visible rows is what people
expect from a filtered list, but the `2/8` badge counts the group, so the two
would disagree with no way to see which had happened. The toolbar says so
instead: *"Showing 3 of 149 permissions. A group's select all still covers the
whole group."*

**`aria-label`, not `aria-labelledby`.** `aria-labelledby` pointing at the `<h3>`
is the better pattern, but this component exposes a `#header` slot that may
replace the `<h3>` entirely. A dangling `aria-labelledby` computes an *empty*
accessible name and does not fall back to `aria-label`, so a slot consumer would
silently produce an unnamed dialog.

## Observed live defects, recorded and not reproduced as bugs

These are the live deployment's defects. They are documented rather than fixed,
because fixing someone else's data model is not this project's job — but
reproducing them silently would also be wrong, so each is either carried in the
mock (so the divergence is visible) or recorded here.

| # | Defect | Where | Handling here |
|---|---|---|---|
| 1 | `MAX CA: 40` while `CA 1 (20)` + `CA 2 (10)` = 30 | `/results/enter` | The mock carries the same `maxCA: 40`, so the page contradicts itself here exactly as it does live. |
| 2 | Duplicate class names: `JSS 1` and `JSS1` both offered | `/results/enter` | The mock's class list is deduplicated. Recorded rather than reproduced — 23 live class names have near-duplicates, and reproducing the ambiguity would make the picker unusable. |
| 3 | `/awards` shows *"This page couldn't load"* while `/awards/new` works | `/awards` | The mock serves both. |
| 4 | `/students/export`, `/students/promotion`, `/communication/logs`, `/communication/templates` render *Under construction* | four routes | Not reproduced as scaffolds. Export is available from the student list instead; the rest have no counterpart. |
| 5 | Four parent routes 404: `/parent/counselling`, `/parent/disciplinary`, `/parent/payments`, `/parent/store` | `/parent/*` | Not reproduced. Recorded in `route-inventory.md`. |

## What this project fixed that the live app also gets wrong

Two, both found by the workflow checks rather than by reading:

1. **The `?panel=` deep-link did not switch modules.** `AdminView` read the query
   once, on mount, and a router navigation to the same route does not remount the
   view — so the fee panel's *New Payment* link changed the address bar and left
   the previous list on screen. A full page load of that URL worked, which is why
   a document-load test could never have caught it. **Verified W19.**
2. **A dialog that remounts lost its Escape handler.** `AdminDialog` registered
   its keydown listener in a `watch` on `open` with no `immediate`, so a dialog
   that mounted already open never got one. The attendance register reloads its
   sheet after a save, which unmounts the dialog and brings it back with `open`
   still true — and the register then had no working dismissal except its own
   button. **Verified W12**, which asserts Escape closes it.

## Read next

`feature-inventory.md` for the per-feature record, `workflows.md` for what was
driven end to end.