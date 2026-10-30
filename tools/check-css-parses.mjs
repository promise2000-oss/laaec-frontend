/*
 * tools/check-css-parses.mjs — every stylesheet in src/ actually parses.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE BUILD
 * -----------------------------------------
 * A CSS comment that is opened and never closed is not a build-time error in
 * development: Vite serves it, the browser's error-tolerant parser swallows the
 * orphan, and the page renders. Production does not forgive it — `vite build`
 * runs lightningcss, which rejects the file outright. That gap is how a token
 * block pasted into `admin-panel-page.css` broke the production build while the
 * dev server, the panel walk, the workflow checks and the dev-server log all
 * reported success.
 *
 * The build is the authority and it runs in CI, so this is not a replacement for
 * it. It is the fast signal: a whole CSS parse of every stylesheet, with no
 * bundler, in about a second, and it names the file and line.
 *
 * WHAT IS CHECKED
 *   - brace balance, ignoring braces inside comments and strings
 *   - comment balance: every comment opener has a closer
 *   - an unterminated string
 *   - stray text at declaration level
 *
 * THE FOURTH ONE IS THE ONE THAT BIT
 * ----------------------------------
 * A token block pasted into the middle of a file's header comment swallowed the
 * comment's closing lines and left them as text inside the new `:root` block --
 * three orphaned lines, each beginning with an asterisk, sitting among the
 * custom-property declarations.
 *
 * The braces are balanced, so a brace counter reports it clean -- and so did this
 * script on its first run. Vite serves it, the browser's forgiving parser copes,
 * and the dev server, the panel walk and the workflow checks all pass. Only
 * `vite build` rejects it, via lightningcss, which is why a production build
 * failed on a file every other check had cleared.
 *
 * So an asterisk sitting at declaration level -- not inside a comment, not inside
 * a string, not part of a comment delimiter -- is reported. That is exactly the
 * shape an orphaned comment tail takes, and it is cheap and specific.
 *
 * Run:  node tools/check-css-parses.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(process.cwd(), 'src');

/** Every .css file, plus the <style> block of every .vue file. */
function collect() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.css')) files.push({ file: full, embedded: false });
      else if (entry.name.endsWith('.vue')) files.push({ file: full, embedded: true });
    }
  };
  walk(SRC);
  return files;
}

/**
 * Strip comments and strings, returning the code with offsets preserved so a
 * finding can still be located by line.
 *
 * Stripping before counting is what makes this correct rather than a brace
 * counter: a `}` inside a comment, or a `{` inside a quoted font family name,
 * would otherwise read as structure that does not exist.
 */
function analyse(code) {
  let depth = 0;
  let paren = 0;
  let line = 1;
  const problems = [];
  let i = 0;

  while (i < code.length) {
    const c = code[i];
    const next = code[i + 1];

    if (c === '\n') line += 1;

    if (c === '/' && next === '*') {
      const close = code.indexOf('*/', i + 2);
      if (close === -1) {
        problems.push({ line, what: 'comment opened and never closed' });
        break;
      }
      for (let k = i; k < close; k += 1) if (code[k] === '\n') line += 1;
      i = close + 2;
      continue;
    }

    if (c === '*' && next === '/') {
      /*
       * A comment terminator with no opener — the direct symptom of the defect
       * this script exists for. When a block is pasted into a file's header
       * comment, the comment's OWN closing marker is left stranded after the new
       * block, so there is one more terminator than opener in the file.
       *
       * Counting the two markers is the reliable signal, and it is why this is
       * checked before the line-shape test below: once the header comment has
       * swallowed everything down to this stray terminator, the text after it no
       * longer looks like an orphaned tail at all, because there is no longer a
       * block around it to be inside.
       */
      problems.push({ line, what: "a comment terminator with no opener" });
      i += 2;
      continue;
    }

    if (c === '"' || c === "'") {
      const quote = c;
      let closed = false;
      i += 1;
      while (i < code.length) {
        if (code[i] === '\\') { i += 2; continue; }
        if (code[i] === '\n') { line += 1; i += 1; continue; }
        if (code[i] === quote) { closed = true; i += 1; break; }
        i += 1;
      }
      if (!closed) {
        problems.push({ line, what: `unterminated ${quote === '"' ? 'double' : 'single'} quote` });
        break;
      }
      continue;
    }

    if (c === '(') {
      paren += 1;
    } else if (c === ')') {
      paren = Math.max(0, paren - 1);
    } else if (c === '{') {
      depth += 1;
    } else if (c === '}') {
      depth -= 1;
      if (depth < 0) {
        problems.push({ line, what: 'a } with no matching {' });
        depth = 0;
      }
    } else if (c === '*' && depth > 0 && paren === 0) {
      /*
       * An orphaned comment tail: a line whose content so far is an asterisk
       * followed by whitespace and then prose.
       *
       * The shape is specific on purpose. Two things it must NOT report, and did
       * on the first run:
       *
       *   - `calc(var(--drift) * -0.45)`. A legal star inside a function, so the
       *     check applies only when `paren` is 0.
       *   - `.control-actions > * { ... }`. A universal selector, and perfectly
       *     legal -- including nested inside an `@media` block, where a naive
       *     "inside a block" test fires on it. A selector line never BEGINS with
       *     the asterisk; a comment continuation always does.
       *
       * So the test is line-shape: from the start of the line, is it an asterisk,
       * then space, then text rather than a brace?
       */
      let start = i;
      while (start > 0 && code[start - 1] !== '\n') start -= 1;
      /* `i + 1`, not `i`: the slice has to INCLUDE the asterisk, or the pattern
         below is being tested against the leading whitespace alone and matches
         nothing. */
      const soFar = code.slice(start, i + 1);
      if (/^\s*\*\s+\S/.test(soFar)) {
        problems.push({
          line,
          what: "orphaned comment tail -- a line of prose starting with '*' inside a block",
        });
      }
    }
    i += 1;
  }

  if (depth > 0) {
    problems.push({ line, what: `${depth} block(s) opened and never closed` });
  }
  return problems;
}

const problems = [];
let scanned = 0;

for (const { file, embedded } of collect()) {
  const raw = fs.readFileSync(file, 'utf8');
  const blocks = embedded
    ? [...raw.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1])
    : [raw];

  for (const block of blocks) {
    scanned += 1;
    for (const p of analyse(block)) {
      problems.push({
        file: path.relative(process.cwd(), file),
        line: p.line,
        what: p.what,
        embedded,
      });
    }
  }
}

for (const p of problems) {
  console.error(`  ✗ ${p.file}:${p.line}${p.embedded ? ' (in <style>)' : ''} — ${p.what}`);
}

console.log(`\n${scanned} stylesheet block(s) parsed, ${problems.length} problem(s).`);
if (problems.length) {
  console.error('FAIL — a stylesheet does not parse. Vite serves it; production build rejects it.');
  process.exit(1);
}
console.log('OK — every stylesheet parses.');