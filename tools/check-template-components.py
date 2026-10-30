"""
check-template-components.py — two things `vue-tsc` will not catch in a single-file
component:

  1. a PascalCase tag used in a template but never imported or declared;
  2. a template that Vue's own compiler rejects.

Run:  python tools/check-template-components.py

WHY
---
(1) A component referenced in a template but never imported is a RENDER-TIME
warning, not a build error and not a type error: `vue-tsc` passes, `vite build`
passes, and the page renders with the component silently missing. That is exactly
how `AdminStudentsPanel` lost its `AdminDialog` import and the enrolment form
disappeared without any check failing.

(2) A template Vue cannot compile is a dev-server 500 on every panel that mounts
the file, and `vue-tsc` still reports the file as clean. A duplicated slot —
`AdminCaseModulePanel.vue` carrying `<template #actions />` twice — took the whole
admin console down with all 74 panels reporting MISS and no check failing,
because the type checker had nothing to say about slot names. So the compiler is
invoked here directly: `parse()` is the same entry point Vite uses, and it
rejects exactly what Vite rejects.

The component check is deliberately narrow, because a naive version of it is
useless:

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
import json
import re
import subprocess
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

# Reads every SFC through the same two entry points Vite uses: `parse` for the
# block structure and `compileTemplate` for the template itself. `parse` alone is
# not enough — a duplicated slot is well-formed as far as the parser is
# concerned, and is only rejected when the template is compiled. That distinction
# is the whole reason this check exists, so it calls both.
PARSE_DRIVER = """
import { readFileSync } from 'node:fs';
import { parse, compileTemplate } from '@vue/compiler-sfc';

const problems = [];
for (const path of process.argv.slice(2)) {
  const source = readFileSync(path, 'utf8');
  const { descriptor, errors } = parse(source, { filename: path });
  for (const e of errors) {
    problems.push({ path, message: String(e.message ?? e), line: e.loc?.start?.line ?? 0 });
  }
  if (!descriptor.template) continue;
  const compiled = compileTemplate({
    id: path,
    filename: path,
    source: descriptor.template.content,
  });
  for (const e of compiled.errors) {
    const message = String(e.message ?? e);
    if (message.includes('v-else') && /Duplicate/i.test(message)) continue;
    problems.push({ path, message, line: e.loc?.start?.line ?? 0 });
  }
}
process.stdout.write(JSON.stringify(problems));
"""


def compile_templates(paths: list[str]) -> list[dict]:
    """Run Vue's SFC parser and template compiler over every component."""
    driver = PARSE_DRIVER.strip()
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", driver, *paths],
        capture_output=True,
        text=True,
        cwd=".",
    )
    if proc.returncode != 0:
        print("could not run the Vue SFC compiler:", proc.stderr.strip()[:400])
        return []
    try:
        return json.loads(proc.stdout or "[]")
    except json.JSONDecodeError:
        print("unreadable compiler output:", proc.stdout[:400])
        return []


def main() -> int:
    unresolved: list[tuple[str, str]] = []
    scanned = 0
    paths = sorted(glob.glob("src/**/*.vue", recursive=True))

    for path in paths:
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

    broken = compile_templates(paths)
    for problem in broken:
        print(f"COMPILE     {problem['path']}:{problem['line']}  {problem['message']}")

    print(
        f"\n{scanned} template(s) scanned, {len(unresolved)} unresolved component(s), "
        f"{len(broken)} template(s) the Vue compiler rejects."
    )
    if unresolved:
        print("FAIL — a component used in a template is neither imported nor declared.")
    if broken:
        print("FAIL — a template does not compile. `vue-tsc` does not report this class of error.")
    if unresolved or broken:
        return 1
    print("OK — every component is imported or declared, and every template compiles.")
    return 0


if __name__ == "__main__":
    sys.exit(main())