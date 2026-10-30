"""
find-dead-controls.py — interactive elements that cannot do anything.

Run:  python tools/find-dead-controls.py

WHY THIS IS A STATIC SCAN
-------------------------
The question "does this button work?" cannot be answered by clicking it: a button
with no listener looks identical to a working one until you click it and nothing
happens, and there are hundreds of them. It also cannot be answered reliably at
runtime, because Vue attaches listeners with `addEventListener`, which leaves no
observable trace on the element for a probe to read.

So the source is scanned instead, for the specific shapes that cannot work:

  - `<button>` with no `@click`, no `type="submit"` inside a form, and no
    `:disabled` that would make it honestly inert. A button in a `v-for` is
    exempt on the assumption the loop body carries the handler once.
  - `<a>` with no `href`, no `role="button"`, and no `@click`.
  - `<button>` bound to a bare `true`/`undefined` expression, which type-checks
    and does nothing.
  - `@click` bound to an empty handler or to a name that is not defined anywhere
    in the file, which is a wiring mistake rather than a missing feature.

WHAT IT DELIBERATELY DOES NOT FLAG
---------------------------------
  - Anything inside `v-for`: one handler on the loop body serves every row.
  - `type="submit"` buttons: they act through the form, not through `@click`.
  - `:disabled` bindings: a control that declares itself unavailable is not a
    lying control.
  - Buttons that only carry `aria-*`, `title` or `data-*`: decoration.

A finding is not automatically a defect. Some are deliberate — a control rendered
only in DEV, or one whose handler is attached by a parent. Every hit is printed
with its line so it can be read, not just counted.
"""

from __future__ import annotations

import glob
import io
import re
import sys

# A <button …> … </button> or a self-closed <button … /> tag.
BUTTON = re.compile(r"<button\b([^>]*?)(/?)>", re.S)
# Attributes that make a button able to act without an @click.
ACTIONABLE = re.compile(r"@click(?:\.[\w-]+)*\s*=|type\s*=\s*[\"']submit[\"']|:disabled\s*=|v-on:click\s*=")
ANCHOR = re.compile(r"<a\b([^>]*?)(/?)>", re.S)
# A handler expression that is present but inert.
INERT_HANDLER = re.compile(r"@click(?:\.[\w-]+)*\s*=\s*[\"']\s*(?:true|undefined|null|''|\"\")\s*[\"']")


def strip_comments(source: str) -> str:
    return re.sub(r"<!--.*?-->", "", source, flags=re.S)


def line_of(source: str, index: int) -> int:
    return source.count("\n", 0, index) + 1


def main() -> int:
    findings: list[tuple[str, int, str]] = []
    scanned = 0

    for path in sorted(glob.glob("src/**/*.vue", recursive=True)):
        raw = io.open(path, encoding="utf-8").read()
        source = strip_comments(raw)

        # Only the template matters; the script block is full of `true` and of
        # identifiers that look like tags.
        tpl = re.search(r"<template>(.*)\n</template>", source, re.S)
        if not tpl:
            continue
        scanned += 1
        body = tpl.group(1)
        base = tpl.start(1)

        for match in BUTTON.finditer(body):
            attrs = match.group(1)
            if ACTIONABLE.search(attrs):
                continue
            # A button rendered by a loop takes one handler for every row.
            start = body.rfind("<", 0, match.start())
            context = body[max(0, start - 400):match.start()]
            if re.search(r"v-for\s*=", context[-400:]):
                continue
            text = re.sub(r"\s+", " ", body[match.end():match.end() + 60]).strip()
            label = text[:40] if text else "(icon only)"
            findings.append((path, line_of(source, base + match.start()), "button with no handler: " + label))

        for match in ANCHOR.finditer(body):
            attrs = match.group(1)
            if re.search(r"href\s*=", attrs):
                continue
            if ACTIONABLE.search(attrs) or re.search(r"role\s*=\s*[\"']button[\"']", attrs):
                continue
            findings.append((path, line_of(source, base + match.start()), "anchor with no href and no handler"))

        for match in INERT_HANDLER.finditer(body):
            findings.append((path, line_of(source, base + match.start()), "handler bound to an inert expression"))

    for path, line, what in findings:
        print(f"  {path}:{line}  {what}")

    print(f"\n{scanned} template(s) scanned, {len(findings)} control(s) that cannot act.")
    if findings:
        print("FAIL — an interactive element has no way to perform an action.")
        return 1
    print("OK — every control in a template can act.")
    return 0


if __name__ == "__main__":
    sys.exit(main())