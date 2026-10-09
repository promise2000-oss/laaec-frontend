# UI Specification

## Chrome (unchanged — LAEC's own)

The teacher portal uses the portal's existing enterprise surface, not the
origin's shadcn shell. The target for parity is the *teacher portal's content*;
the surrounding chrome is LAEC's and was not restyled.

- **Rail** — 248 px, five groups (Overview, Teacher Portal, Exam Papers, General,
  School), collapsing to icons under 1100 px and to a drawer under 900 px.
- **Topbar** — breadcrumb (`Teacher Portal / <group> / <panel>`), a disabled
  search box, the notification bell with unread badge, the school-scope chip, the
  role chip, and the account menu with logout.
- **Content well** — `.view-well`, one card per block.
- **Z-layers** — modal `var(--z-modal)`, loading `var(--z-loading)`,
  topbar `var(--z-topbar)`, rail `var(--z-rail)`. `tools/check-layers.mjs`
  enforces that no z-index is declared bare; all 72 declarations are tokenised.

## Panel shell (`TeacherModuleShell.vue`)

Every panel renders the same skeleton, so twelve modules cannot drift:

```
[heading]  [description]                    [actions]
[filters: tabs / search / selects]
[success banner — emerald, dismissible, only when there is text]
  loading   → spinner + label, replacing everything below
  error     → destructive panel + Retry
  empty     → dashed panel, when emptyCount === 0
  else      → content
```

Tokens reused rather than invented: `--laec-blue`, `--laec-line`,
`--z-modal`. Type scale 0.625–1.5 rem, matching the rail.

## Tables

| Property | Value |
|---|---|
| Border | 1 px `var(--laec-line)`, 12 px radius, horizontal scroll on overflow |
| Header | 0.6875 rem, 700, uppercase, 0.05 em, `--text-muted`, on `#f7f9fc` |
| Cell | 0.8125 rem, 0.625/0.875 rem padding, top-aligned |
| Row | hover `#f7f9fc`, `cursor: pointer`, visible focus ring |
| Caption | item count, 0.75 rem, top-left |

Column sets are the origin's, transcribed in `features.md`.

## Status badges

Four variants matching the origin's shadcn badges, at the rail's type scale:

| Variant | Fill / border / text |
|---|---|
| `default` | `#eaf2fb` / `#bcd6f0` / `#16457c` |
| `secondary` | `#f1f3f6` / `#d7dee8` / `#46505f` |
| `outline` | transparent / `#c6cfdb` / `#5b6472` |
| `destructive` | `#fdf0f0` / `#f0c8c8` / `#8f2a2a` |

The label is passed explicitly rather than derived, because the origin is
inconsistent: lesson plans and weekly reports map their statuses to labels, while
the class-teacher module renders the raw string.

## Forms

Label above, 0.75 rem / 600, control 0.8125 rem in an 8 px-radius box with a
2 px blue focus ring. Textareas are resizable with a 4 rem minimum. Selects
appear where the origin uses one (class, severity, status) because several of its
validation rules check the *id* a select would carry.

Succession sections use a `tp-band` header: 0.6875 rem, uppercase, `#16457c` on
`#eaf2fb`. The five weekly-report checklists render as
`checkbox | text input | remove`, four rows seeded, `Add Item` beneath.

## Buttons

`tp-btn` base, 0.8125 rem / 600, 8 px radius; `--primary` filled blue,
`--danger` filled red, `--ghost` borderless, `--xs` for row actions. In-flight
labels match the origin (`Deleting...`, `Saving...`, `Submitting review...`).

## Dialogs

Centred, `rgb(11 34 66 / 0.72)` scrim with a 6 px backdrop blur, 12 px radius,
`min(92%, 440–480px)`, `var(--z-modal)`. Focus is trapped by the dialog element
and `Escape` is native. Copy is the origin's, verbatim, including
`Delete lesson plan?` / `"<topic>" will be permanently deleted. This cannot be undone.`
and `Approve lesson plan?`.

## States

| State | Treatment |
|---|---|
| Loading | spinner + label; content replaced |
| Empty | dashed panel, the origin's copy, plus the module's create action |
| Error | destructive panel, the message, and `Retry` when `retryable` |
| Success | emerald banner, dismissible, cleared by the panel's next load |
| Silent | counselling/disciplinary launch forms, and notifications-page mount — reproduced from the origin |

## Responsive

- `≥1100 px` — full rail.
- `900–1100 px` — icon-only rail; descriptions truncate.
- `<900 px` — rail becomes a drawer behind the burger; the topbar collapses;
  the panel header wraps and its actions move below the heading.
- `<860 px` — the messaging panel's two panes stack.
- Grids (`tp-form`, `tp-fields`, `tp-tiles`) use `auto-fit` with a 180–210 px
  minimum, so they reflow without a media query.

## Known visual divergences

| | Reason |
|---|---|
| No print-shaped Times New Roman document view for a lesson plan | the origin renders a printable document; plain textareas cannot reproduce its typography |
| No signature script rendering | needs a webfont pipeline |
| Messaging is not live | no socket transport |
| No PDF/attachment affordances | no blob transport |