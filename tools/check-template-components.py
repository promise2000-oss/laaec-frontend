"""
check-template-components.py — every PascalCase tag used in a template must be
imported or declared locally.

Run:  python tools/check-template-components.py

WHY
---
A component referenced in a template but never imported is a RENDER-TIME warning,
not a build error and not a type error: `vue-tsc` passes, `vite build` passes, and
the page renders with the component silently missing. That is exactly how
`AdminStudentsPanel` lost its `AdminDialog` import and the enrolment form
disappeared without any check failing.

The check is deliberately narrow, because a naive version of it is useless:

  - Only the `<template>` block is scanned. The script block is full of
    `Array<...>`, `Record<...>` and type names that look like components.
  - Vue's own built-ins (`Teleport`, `Transition`, `KeepAlive`, `Suspense`,
    `Component`, `Slot`) and the router's (`RouterLink`, `RouterView`) are exempt
    — they resolve without an import.
  - A locally declared `const X = ...` counts, because `<script setup>` exposes
    top-level bindings to the template.
"""

from __future__ import annotations

import glob
import io
import re
import sys

# Components Vue and vue-router resolve without an import.
BUILTINS = {
    "Teleport", "Transition", "TransitionGroup", "KeepAlive", "Suspense",
    "Component", "Slot", "RouterLink", "RouterView",
}

TEMPLATE = re.compile(r"<template>(.*)\n</template>", re.S)
TAG = re.compile(r"<([A-Z][A-Za-z0-9]*)\b")
IMPORTED = r"\bimport\s+%s\b"
DECLARED = r"\bconst\s+%s\b"


def main() -> int:
    unresolved: list[tuple[str, str]] = []
    scanned = 0

    for path in glob.glob("src/**/*.vue", recursive=True):
        source = io.open(path, encoding="utf-8").read()
        block = TEMPLATE.search(source)
        if not block:
            continue
        scanned += 1
        for tag in sorted(set(TAG.findall(block.group(1)))):
            if tag in BUILTINS:
                continue
            if re.search(IMPORTED % tag, source):
                continue
            if re.search(DECLARED % tag, source):
                continue
            unresolved.append((path, tag))

    for path, tag in unresolved:
        print(f"UNRESOLVED  {path}  <{tag}>")
    print(f"\n{scanned} template(s) scanned, {len(unresolved)} unresolved component(s).")
    if unresolved:
        print("FAIL — a component used in a template is neither imported nor declared.")
        return 1
    print("OK — every component used in a template is imported or declared.")
    return 0


if __name__ == "__main__":
    sys.exit(main())