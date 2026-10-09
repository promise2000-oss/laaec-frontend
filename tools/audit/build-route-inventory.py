"""
build-route-inventory.py — generates docs/saint-finbarrs-admin/route-inventory.md
from the live crawl data.

Run:  python tools/audit/build-route-inventory.py

WHY A GENERATOR
---------------
131 routes is 131 rows, and the alternative is transcribing them by hand — which
is how a route list silently disagrees with the crawl it came from. The route
assignment below is the only judgement in it (which module owns a route, and
which panel here implements it); everything else is read from the data.

INPUT
-----
The crawl recorded at
C:\\Users\\USER\\AppData\\Local\\Temp\\opencode\\sfc-all-routes.json — one record
per route, captured live on 2026-10-07 with a signed-in Super Admin session.
"""

from __future__ import annotations

import io
import json
import os

CRAWL = os.path.join(
    os.environ.get("TEMP", "C:/Users/USER/AppData/Local/Temp"),
    "opencode",
    "sfc-all-routes.json",
)
OUT = os.path.join("docs", "saint-finbarrs-admin", "route-inventory.md")

# ── which module owns a route ────────────────────────────────────────────────────
# Ordered, first match wins. `r.startswith` is deliberate: `/students/...` is
# Students & Parents while `/parent/...` is the parent-facing surface.

MODULES = [
    ("Dashboards", lambda r: r == "/dashboard"),
    (
        "User & Roles",
        lambda r: r in ("/users", "/users/new", "/roles", "/roles/new",
                        "/permissions", "/permissions/overrides"),
    ),
    (
        "Staff & HR",
        # `/staff-portal/...` is the teacher portal's review inbox, not an HR
        # page, and `"/staff"` is a prefix of it — so the HR predicate excludes
        # it explicitly rather than relying on a longer prefix.
        lambda r: not r.startswith("/staff-portal")
        and r.startswith(("/staff", "/attendance", "/leave", "/hr-queries",
                          "/departments", "/designations", "/awards")),
    ),
    ("Students & Parents", lambda r: r.startswith(("/students", "/parents", "/parent/"))),
    ("Academic", lambda r: r.startswith("/academic/")),
    (
        "Teacher Portal",
        lambda r: r.startswith(("/lesson-planning", "/weekly-report", "/teacher/",
                                "/staff-portal/")) or r == "/dashboard/lesson-plans",
    ),
    ("Communication", lambda r: r.startswith("/communication/") or r == "/notifications"),
    ("Disciplinary", lambda r: r.startswith("/disciplinary/")),
    ("Counselling", lambda r: r.startswith("/counselling/")),
    ("Inventory", lambda r: r.startswith("/inventory/")),
    ("Store", lambda r: r.startswith("/store")),
    ("School Fees", lambda r: r.startswith("/school-fees")),
    ("Student Wallet", lambda r: r.startswith("/wallets")),
    ("Results Management", lambda r: r.startswith("/results")),
    ("System", lambda r: r.startswith("/system/")),
    ("Auth / misc", lambda r: True),
]

# ── which panel here implements each live route ──────────────────────────────────
# A live `new`/`edit` route folds into the list panel that owns it: this project
# is a single-page console, so a create form is a dialog on the list, not a route.
# `None` means not implemented.

PANEL_FOR = {
    "/dashboard": "school-dashboard",
    "/users": "users", "/users/new": "users",
    "/roles": "roles", "/roles/new": "roles",
    "/permissions": "permissions", "/permissions/overrides": "permissions",
    "/staff": "staff", "/staff/new": "staff", "/staff/import": "staff",
    "/departments": "departments", "/departments/new": "departments",
    "/designations": "designations", "/designations/new": "designations",
    "/attendance": "staff-attendance", "/attendance/new": "staff-attendance",
    "/attendance/reports": "staff-attendance-report",
    "/leave": "leave", "/leave/new": "leave", "/leave/apply": "leave",
    "/leave/approvals": "leave-approvals",
    "/hr-queries": "hr-queries", "/hr-queries/new": "hr-queries",
    "/awards": "awards", "/awards/new": "awards",
    "/students": "students", "/students/new": "students", "/students/import": "students",
    "/students/attendance": "student-attendance",
    "/students/attendance/new": "student-attendance",
    "/students/attendance/report": "student-attendance-report",
    "/parents": "parents", "/parents/new": "parents",
    "/academic/sessions": "sessions", "/academic/sessions/new": "sessions",
    "/academic/terms": "sessions", "/academic/terms/new": "sessions",
    "/academic/classes": "classes", "/academic/classes/new": "classes",
    "/academic/sections": "classes", "/academic/sections/new": "classes",
    "/academic/subjects": "subjects", "/academic/subjects/new": "subjects",
    "/academic/timetables": "timetables", "/academic/timetables/new": "timetables",
    "/academic/assignments": "assignments",
    "/academic/class-teachers": "class-teachers",
    "/academic/subject-teachers": "subject-teachers",
    "/inventory/stock": "stock", "/inventory/categories": "inventory-categories",
    "/inventory/suppliers": "suppliers", "/inventory/assets": "assets",
    "/inventory/reports": "inventory-reports",
    "/inventory/settings": "inventory-settings",
    "/inventory/clinic": "clinic-store", "/inventory/sales": "sales",
    "/store": "store", "/store/cart": "cart", "/store/orders": "orders",
    "/store/queue": "queue",
    "/school-fees": "fee-breakdown", "/school-fees/categories": "fee-categories",
    "/school-fees/items": "fee-items", "/school-fees/payments": "fee-payments",
    "/school-fees/reports": "fee-reports",
    "/wallets": "wallets", "/wallets/reports": "wallet-reports",
    "/results/windows": "upload-windows", "/results/enter": "enter-results",
    "/results/queue": "results-queue", "/results/committee": "committee-review",
    "/results/grading": "grading", "/results/students": "student-results",
    "/results/report-cards": "report-cards",
    "/system/general-settings": "general-settings",
    "/system/academic-settings": "academic-settings",
    "/system/branding": "branding",
    "/system/notification-settings": "notification-settings",
    "/system/system-configuration": "system-configuration",
    "/system/audit-logs": "audit-logs", "/system/backups": "backups",
    "/system/feature-toggles": "feature-toggles",
}

# Routes carrying an observed live defect, marked in the table.
DEFECTED = {"/results/enter"}


def live_status(rec: dict) -> tuple[str, str]:
    """(status, why) for one crawled route."""
    title = rec.get("title") or ""
    text = (rec.get("text") or "").lower()
    if "404 - page not found" in title.lower():
        return ("BROKEN — 404", "the app's own 404 page; nothing is mounted at this path")
    if "couldn't load" in text or "couldn’t load" in text:
        return ("BROKEN (live)", "the page's own read fails on the live deployment")
    if "under construction" in text:
        return ("SCAFFOLD", "an 'Under construction' placeholder with no controls")
    if (
        not rec.get("hasTable")
        and not (rec.get("buttons") or [])
        and not (rec.get("fields") or [])
        and not (rec.get("cards") or [])
    ):
        return ("EMPTY", "renders its heading and nothing else for this session")
    return ("OK", "")


def controls(rec: dict) -> str:
    """buttons : tabs : fields : table rows."""
    return "{}:{}:{}:{}".format(
        len(rec.get("buttons") or []),
        len(rec.get("tabs") or []),
        len(rec.get("fields") or []),
        rec.get("rowCount") or 0,
    )


def assign_modules(by_route: dict) -> dict[str, str]:
    """Route -> module, first match winning.

    A single pass over MODULES rather than one pass per module. Asking each
    module "which routes are yours" independently double-counts every route two
    predicates both match — `/staff-portal/lesson-planning/approvals` is claimed by
    both Staff & HR (on `/staff`) and Teacher Portal — and the totals then exceed
    the number of routes crawled, which is the failure this pass exists to prevent.
    """
    owner: dict[str, str] = {}
    for name, owns in MODULES:
        for route in by_route:
            if route in owner:
                continue
            if owns(route):
                owner[route] = name
    return owner


def main() -> None:
    with io.open(CRAWL, encoding="utf-8") as handle:
        crawled = json.load(handle)
    by_route = {r["route"]: r for r in crawled}
    owner_of = assign_modules(by_route)

    out: list[str] = []
    add = out.append

    add("# Route inventory — all 131 audited routes")
    add("")
    add("Every route reached in the signed-in Super Admin session on 2026-10-07, what it")
    add("renders there, and where this project put it. Labels are per `README.md`.")
    add("")
    add("Generated by `tools/audit/build-route-inventory.py` from the crawl record, so")
    add("this table cannot drift from the data it describes.")
    add("")
    add("## Columns")
    add("")
    add("| Column | Meaning |")
    add("|---|---|")
    add("| **Route** | The live path, as crawled. |")
    add(
        "| **Live status** | `OK`; `EMPTY` (heading only, no controls); `SCAFFOLD` "
        "(an *Under construction* placeholder); `BROKEN (live)` (the page's own read "
        "fails); `BROKEN — 404` (nothing mounted at the path). |"
    )
    add(
        "| **Controls** | `buttons:tabs:fields:table-rows` observed on the page. |"
    )
    add(
        "| **Panel** | The `/admin/?panel=<id>` that implements it here. A live "
        "`new`/`edit` route folds into its list panel — this console is one page per "
        "module, so a create form is a dialog rather than a route. `—` means not "
        "implemented. |"
    )
    add("")

    totals: dict[str, int] = {}
    panel_total = 0
    for name, _owns in MODULES:
        members = sorted(r for r in by_route if owner_of[r] == name)
        if not members:
            continue
        add(f"## {name} ({len(members)})")
        add("")
        add("| Route | Live status | Controls | Panel |")
        add("|---|---|---|---|")
        for route in members:
            rec = by_route[route]
            status, _ = live_status(rec)
            totals[status] = totals.get(status, 0) + 1
            panel = PANEL_FOR.get(route)
            if panel is None:
                panel = "—"
            else:
                panel_total += 1
            mark = " ⚠" if route in DEFECTED else ""
            add(f"| `{route}`{mark} | {status} | {controls(rec)} | `{panel}` |")
        add("")

    add("## Status totals")
    add("")
    add("| Status | Routes |")
    add("|---|---|")
    for key in sorted(totals):
        add(f"| {key} | {totals[key]} |")
    add(f"| **Total** | **{sum(totals.values())}** |")
    add("")
    add("## Panel totals")
    add("")
    add(f"- Live routes mapped onto a panel here: **{panel_total}**")
    add(f"- Live routes not implemented: **{len(by_route) - panel_total}**")
    add(
        "- The unimplemented ones are the Teacher Portal (lesson planning, weekly "
        "reports), Communication (messaging, notice board, events), Disciplinary, "
        "Counselling, the parent-facing `/parent/*` surface, `/forgot-password`, "
        "`/profile` and `/unauthorized`. They belong to other consoles in this "
        "project — `/teacher/`, `/calendar/`, `/notices/` — and to roles this audit "
        "did not verify. See `feature-matrix.md`."
    )
    add("")
    add("⚠ marks the observed defect on `/results/enter`: the class dropdown offers both")
    add("`JSS 1` and `JSS1` as distinct values. See `ui-audit.md`.")
    add("")

    with io.open(OUT, "w", encoding="utf-8", newline="\n") as handle:
        handle.write("\n".join(out))

    print("wrote", OUT)
    print("routes", sum(totals.values()), totals)
    print("mapped", panel_total, "unmapped", len(by_route) - panel_total)


if __name__ == "__main__":
    main()