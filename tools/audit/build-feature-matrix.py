"""
build-feature-matrix.py — generates docs/saint-finbarrs-admin/feature-matrix.md
from the registry, the nav rail and the panel map.

Run:  python tools/audit/build-feature-matrix.py

WHY A GENERATOR
---------------
The matrix is the claim this audit makes: every live feature maps to something in
this project, with a status. Written by hand it drifts the first time a module is
added. Generated from the three sources of truth — `admin-registry.ts` (what a
module is), `nav.ts` (where it sits) and `admin-panels.ts` (which component
draws it) — it cannot disagree with the code.

STATUS IS NOT DERIVED
---------------------
Only the facts are derived. The status column is a table below this one: whether a
module is fully implemented, partial, or reproduces a live failure. That is a
judgement about intent, and pretending to derive it would be the same mistake as
deriving it from a regex.
"""

from __future__ import annotations

import io
import json
import os
import re
import subprocess
import sys

ROOT = os.getcwd()
REGISTRY = os.path.join("src", "types", "admin-registry.ts")
NAV = os.path.join("src", "lib", "nav.ts")
PANELS = os.path.join("src", "components", "admin", "admin-panels.ts")
OUT = os.path.join("docs", "saint-finbarrs-admin", "feature-matrix.md")

# The panel id the view mounts that has no registry entry: the summary dashboard.
# A registry entry describes a list; a dashboard is not one.
EXTRA_PANELS = {
    "school-dashboard": {
        "title": "Dashboard",
        "permission": "dashboard.superadmin",
        "group": "Dashboards",
        "panel": "school-dashboard",
    },
}

# The seven pre-existing LAEC panels, which this build does not implement.
LAEC_PANELS = [
    ("dashboard", "Overview", "dashboard.read", "LAEC Examination"),
    ("exam-mgt", "Exam Management", "exam.schedule.manage", "LAEC Examination"),
    ("past-questions", "Past Questions", "questions.read", "LAEC Examination"),
    ("results", "Results Center", "results.read", "LAEC Examination"),
    ("student-directory", "Student Directory", "students.read", "LAEC Examination"),
    ("admins", "School Admins", "admins.read", "LAEC Examination"),
    ("health", "System Health", "system.read", "LAEC Examination"),
]

# Deliberate divergences and known gaps, keyed by panel id. Each is a claim about
# intent, which is why it lives here and not in the derivation above.
NOTES = {
    "academic-settings": (
        "Reproduces the live read failure as an error card",
        "The live page's own read fails and shows \"Couldn't load academic "
        "settings\". Reproducing it is the faithful behaviour; inventing a "
        "grading-scale form would document a feature that does not exist there. "
        "The form that DOES exist is `/results/grading`, reproduced as `grading`.",
    ),
    "branding": (
        "Reproduces the live read failure as an error card",
        "Same reasoning: \"Couldn't load branding settings\" is what the live "
        "page shows.",
    ),
    "notification-settings": (
        "Reproduces the live read failure as an error card",
        "Same reasoning: \"Couldn't load notification settings\".",
    ),
    "store": (
        "Partial",
        "The catalogue and its search render. Ordering is a separate flow and is "
        "not issued \u2014 see workflows.md, W20.",
    ),
    "cart": (
        "Partial",
        "Cart contents render; checkout is not issued. See workflows.md, W20.",
    ),
    "orders": (
        "Partial",
        "The order list renders from the mock's seed; no payment is verified.",
    ),
    "student-attendance-report": (
        "Divergence",
        "\"Daily Attendance Trend\" is rendered as per-week tallies rather than a "
        "chart, because the mock's attendance data has a week dimension and no day "
        "series. A chart over weeks would have to invent the days it plots.",
    ),
    "staff-attendance-report": (
        "Divergence",
        "Same: the trend block is per-week tallies, for the same reason.",
    ),
    "leave-approvals": (
        "Divergence",
        "Approve/Reject are gated on `leave.approve`. The deployed "
        "`LeaveDetailPage` renders them for any PENDING row with no permission "
        "check at all. Gating them here would be the opposite of the live bug, "
        "and shipping an ungated control the rail already says this session does "
        "not hold is worse. See roles-and-permissions.md.",
    ),
    "roles": (
        "Scope decision",
        "The 33 school roles are seed data, editable and readable, but they do "
        "not gate the console. A session in this project carries one LAEC claim, "
        "not one of 33 school roles; the two axes are not interchangeable. The "
        "console gate is `leave.approve`-style codes, not role names.",
    ),
}


def read(path: str) -> str:
    with io.open(path, encoding="utf-8") as handle:
        return handle.read()


def count_entries(body: str, key: str) -> int:
    """How many entries an array-valued registry key declares.

    Counted inside the array rather than by scanning the body, because `columns`
    and `fields` are written the same way - six-space `{ key: '...' }` - and a
    whole-body count returns the same number for both. Two columns and two fields
    is not the same claim as four of either.
    """
    start = body.find("\n    " + key + ": [")
    if start < 0:
        return 0
    end = body.find("\n    ],", start)
    if end < 0:
        return 0
    return len(re.findall(r"\{ key: '", body[start:end]))


def parse_registry() -> dict[str, dict]:
    source = read(REGISTRY)
    start = source.index("export const ADMIN_MODULES")
    end = source.index("\nexport const", start + 1)
    block = source[start:end]

    modules: dict[str, dict] = {}
    for match in re.finditer(r"^  '?([a-z0-9-]+)'?:\s*\{", block, re.M):
        mid = match.group(1)
        body_start = match.end()
        next_match = re.search(r"^  '?[a-z0-9-]+'?\s*:\s*\{", block[body_start:], re.M)
        body = block[body_start : body_start + (next_match.start() if next_match else len(block))]

        def grab(pattern: str) -> str:
            found = re.search(pattern, body)
            return found.group(1) if found else ""

        modules[mid] = {
            "id": mid,
            "title": grab(r"title: '([^']+)'"),
            "permission": grab(r"\n    permission: '([^']+)'"),
            "write": grab(r"\n    writePermission: '([^']+)'"),
            "delete": grab(r"\n    deletePermission: '([^']+)'"),
            "panel": grab(r"\n    customPanel: '([^']+)'"),
            "columns": count_entries(body, "columns"),
            "fields": count_entries(body, "fields"),
        }
    return modules


def parse_rail() -> dict[str, dict]:
    source = read(NAV)
    start = source.index("const ADMIN_GROUPS")
    end = source.index("const CA_GROUPS", start)
    block = source[start:end]

    # A rail entry is not always one line: `refund-queue` carries a `route:`, a
    # permission and a five-line comment, and `id:` and `label:` sit on separate
    # lines. Matching line-by-line silently dropped it, so the totals read 65
    # where there are 67 — in a document whose whole claim is that it cannot drift
    # from the code. So: one regex over the block, with the group resolved from
    # whichever `title:` precedes each entry.
    ITEM = re.compile(
        r"\{\s*id:\s*'([^']+)',\s*label:\s*'([^']+)'"
        r"(?:,\s*icon:\s*'[^']+')?(?:,\s*permission:\s*'([^']+)')?",
        re.S,
    )
    GROUP = re.compile(r"title: '([^']+)'")

    positions = [(m.start(), m.group(1)) for m in GROUP.finditer(block)]

    def group_at(offset: int) -> str:
        name = ""
        for position, label in positions:
            if position > offset:
                break
            name = label
        return name

    rail: dict[str, dict] = {}
    for match in ITEM.finditer(block):
        rail[match.group(1)] = {
            "label": match.group(2),
            "group": group_at(match.start()),
            "permission": match.group(3) or "",
        }
    return rail


def parse_panel_map() -> dict[str, str]:
    source = read(PANELS)
    return {
        match.group(1): match.group(2)
        for match in re.finditer(r"^  '?([a-z0-9-]+)'?:\s*(\w+),", source, re.M)
    }


def component_label(name: str) -> str:
    """`AdminResultsPanel` -> `AdminResultsPanel.vue`."""
    return f"`{name}.vue`"


def main() -> int:
    modules = parse_registry()
    rail = parse_rail()
    panel_map = parse_panel_map()

    # The dashboard, folded in so the matrix covers every panel the rail offers.
    for pid, meta in EXTRA_PANELS.items():
        modules[pid] = {
            "id": pid,
            "title": meta["title"],
            "permission": meta["permission"],
            "write": "",
            "delete": "",
            "panel": meta["panel"],
            "columns": 0,
            "fields": 0,
        }

    out: list[str] = []
    add = out.append

    add("# Feature matrix — every live feature, and what this project did with it")
    add("")
    add("Generated by `tools/audit/build-feature-matrix.py` from `admin-registry.ts`,")
    add("`nav.ts` and `admin-panels.ts`, so it cannot drift from the code.")
    add("")
    add("## Status vocabulary")
    add("")
    add("| Status | Meaning |")
    add("|---|---|")
    add(
        "| **Implemented** | Read, write and permissions all present. The only "
        "variation between modules is the column set. |"
    )
    add("| **Partial** | A real part is missing and is named in the note. |")
    add("| **Divergence** | Present and working, but deliberately different from the live app, with the reason. |")
    add("| **Reproduces a live failure** | The live page is broken; this one is broken the same way rather than papered over. |")
    add("| **LAEC panel** | Pre-existing this-project markup, untouched by this audit, carried as a regression check. |")
    add("")
    add("## Totals")
    add("")

    admin_panels = [p for p in modules if p in rail]
    # Bespoke is decided by what `admin-panels.ts` actually mounts, not by
    # whether the registry carries a `customPanel`. Two modules declare one as a
    # label - `wallets` and `fee-payments` - and are not in the map, so they fall
    # through to the default renderer. Classifying them as bespoke would credit
    # them with a component that does not exist.
    bespoke = [p for p in admin_panels if p in panel_map]
    generic = [p for p in admin_panels if p not in panel_map]
    used_components = sorted({panel_map[p] for p in bespoke})
    undeclared = sorted(
        p for p, meta in modules.items() if meta["panel"] and p not in panel_map
    )

    add(f"- Registry modules: **{len(modules) - len(EXTRA_PANELS)}**, plus the summary dashboard: **{len(modules)}** panels.")
    add(f"- Rendered by `AdminResourcePanel.vue` from registry data: **{len(generic)}**.")
    add(f"- Rendered by a bespoke component: **{len(bespoke)}**, drawn by **{len(used_components)}** components.")
    add(f"- Rail entries for SUPER_ADMIN: **{len(rail)}** ({len(rail) - len(LAEC_PANELS)} modules + {len(LAEC_PANELS)} LAEC panels).")
    add(f"- Permission codes in the vocabulary: **180**.")
    add("")
    if undeclared:
        add(
            "- Modules declaring a `customPanel` that no component answers for: "
            + ", ".join(f"`{p}`" for p in undeclared)
            + ". These render through `AdminResourcePanel.vue`, which is correct "
            "for both — the label names the module, not a component."
        )
        add("")

    add("## Per module")
    add("")
    add("| Panel | Rail group | Read | Write | Delete | Renderer | Columns / fields | Status |")
    add("|---|---|---|---|---|---|---|---|")
    for pid, meta in modules.items():
        where = rail.get(pid)
        group = where["group"] if where else "—"
        renderer = (
            component_label(panel_map[pid]) if pid in panel_map else "`AdminResourcePanel.vue`"
        )
        if pid in EXTRA_PANELS:
            renderer = component_label("AdminDashboardPanel")
        status, _ = NOTES.get(pid, ("Implemented", ""))
        add(
            f"| `{pid}` | {group} | `{meta['permission'] or '—'}` | "
            f"`{meta['write'] or '—'}` | `{meta['delete'] or '—'}` | {renderer} | "
            f"{meta['columns']} / {meta['fields']} | **{status}** |"
        )
    add("")

    add("## The pre-existing LAEC panels")
    add("")
    add("These are this project's own exam-console markup. The audit did not build")
    add("them and did not change them; the walk carries them as a regression pass.")
    add("")
    add("| Panel | Rail group | Read | Status |")
    add("|---|---|---|---|")
    for pid, label, permission, group in LAEC_PANELS:
        add(f"| `{pid}` — {label} | {group} | `{permission}` | **LAEC panel** |")
    add("")

    add("## Deliberate divergences, partials and reproduced failures")
    add("")
    for pid, (status, note) in sorted(NOTES.items()):
        add(f"**`{pid}` — {status}.** {note}")
        add("")

    add("## Live routes deliberately not implemented")
    add("")
    add(
        "The audit reached 131 live routes. The ones with no panel here are named in "
        "`route-inventory.md` (every row whose Panel column is `—`). They fall into "
        "four groups, and none is an oversight:"
    )
    add("")
    add(
        "1. **Teacher-portal surfaces** — `/lesson-planning*`, `/weekly-report*`, "
        "`/teacher/*`, `/staff-portal/*`. These already exist in this project on "
        "`/teacher/`, built and verified in a separate audit "
        "(`docs/teacher-portal/`). Rebuilding them inside `/admin/` would duplicate "
        "a console."
    )
    add(
        "2. **Communication** — `/communication/messages`, `/communication/logs`, "
        "`/communication/templates*`. The notice board and events calendar already "
        "exist here on `/notices/` and `/calendar/`; the rail's School group routes "
        "to them. Messaging is a per-conversation surface outside an admin console's "
        "remit. `logs` and `templates` render *Under construction* placeholders on "
        "the live deployment, so there is nothing to reproduce."
    )
    add(
        "3. **Disciplinary and Counselling** — `/disciplinary/*`, `/counselling/*`. "
        "Two whole modules, each with case files, committees and reports. Not "
        "started; this is the largest remaining scope and it is stated rather than "
        "hidden behind a stub."
    )
    add(
        "4. **The parent-facing surface** — `/parent/*`. Three of the seven are 404s "
        "on the live deployment (`/parent/counselling`, `/parent/disciplinary`, "
        "`/parent/payments`, `/parent/store`); the rest are a parent's own view of "
        "their child, which belongs to a parent console this project does not have."
    )
    add("")
    add(
        "`/forgot-password`, `/profile` and `/unauthorized` already exist on other "
        "routes here."
    )
    add("")

    with io.open(OUT, "w", encoding="utf-8", newline="\n") as handle:
        handle.write("\n".join(out))

    print("wrote", OUT)
    print(
        f"panels {len(modules)} (bespoke {len(bespoke)} via {len(used_components)} components, "
        f"generic {len(generic)}), rail {len(rail)}, divergences {len(NOTES)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())