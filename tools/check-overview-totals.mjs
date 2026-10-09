/**
 * tools/check-overview-totals.mjs — the DASHBOARD "two numbers must agree"
 * invariant (Super Admin Overview, /admin/).
 *
 * THE BUG IT GUARDS
 * -----------------
 * The Overview panel shows "Total Registered Students" and a "School Population
 * Histogram" side by side, over the *same* roster — `loadPieStats()` in
 * src/views/AdminView.vue fetches `GET_STUDENTS { schoolID: 'ALL' } once and
 * hands the identical array to both. The card read `list.length`; the note under
 * the chart read the sum of the bars. They are only equal if the aggregation
 * partitions the roster, and it did not:
 *
 *   public/dashboard-overview.js → buildSchoolPopulationMetrics()
 *     tallied into `counts` keyed by each student's own `SchoolID`, but built
 *     the returned list from `Object.keys(schoolNames)` — the fixed roster of
 *     ten known college codes. Every mock student carries SchoolID "001", so
 *     all nine were counted into a bucket that was never rendered:
 *
 *       card = 9,  sum of bars = 0,  "0 student(s) across 10 bars"
 *
 *   and a student with no school at all was dropped before any tally, with no
 *   bucket to account for the loss.
 *
 * THE INVARIANT
 * -------------
 *     sum(metric.count) === students.length
 *
 * for every roster. The view now derives its headline total from that sum, so
 * the card and the note are the same number by construction; this check is what
 * keeps a future change to the aggregation from quietly reintroducing a
 * partition that loses students.
 *
 * Run: node tools/check-overview-totals.mjs    (exit 1 on any violation)
 */
import fs from 'node:fs';
import path from 'node:path';

import { MOCK_RESULTS, MOCK_STUDENTS } from '../src/api/mockData.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

/*
 * The aggregation ships as a browser IIFE that publishes itself on `window`, so
 * it is exercised here exactly as the page runs it — the real file, not a
 * re-implementation that could drift from it.
 */
function loadAnalytics() {
  const source = fs.readFileSync(
    path.join(ROOT, 'public', 'dashboard-overview.js'),
    'utf8',
  );
  const fakeWindow = {};
  new Function('window', source)(fakeWindow);
  const analytics = fakeWindow.LAECDashboardAnalytics;
  if (!analytics) throw new Error('dashboard-overview.js published no LAECDashboardAnalytics');
  return analytics;
}

/** The ten colleges the Overview panel names, mirrored from AdminView.vue. */
const SCHOOL_NAMES = {
  SFC: "St. Finbarr's College",
  SGC: 'St. Gregory College',
  HCC: 'Holy Child College',
  MCSS: 'Maryland Comprehensive',
  STAC: 'St. Thomas Aquinas College',
  OLASS: 'Our Lady of Apostles',
  MEC: 'Mater Ecclesia College',
  SKC: "St. Kizito's College",
  MGC: 'Marywood Girls College',
  SHC: 'Sacred Heart College',
};

const analytics = loadAnalytics();
const failures = [];
const checks = [];

const sumOf = (metrics) => metrics.reduce((total, m) => total + m.count, 0);
const ids = (metrics) => metrics.map((m) => m.id).join(', ');

/** The property under test, restated per case so a failure names its roster. */
function assertPartitions(label, roster) {
  const metrics = analytics.buildSchoolPopulationMetrics(roster, { schoolNames: SCHOOL_NAMES });
  const total = sumOf(metrics);

  if (total !== roster.length) {
    failures.push(
      `${label}: sum of bars is ${total} but the roster holds ${roster.length} student(s)` +
        (roster.length
          ? ` — ${roster.length - total} lost. bars: ${ids(metrics)}`
          : ' — bars were emitted for an empty roster'),
    );
    return metrics;
  }

  for (const metric of metrics) {
    if (!Number.isInteger(metric.count) || metric.count < 0) {
      failures.push(`${label}: bar "${metric.id}" has a non-count value ${metric.count}`);
    }
    if (!metric.label) {
      failures.push(`${label}: bar "${metric.id}" has no label`);
    }
  }
  checks.push(label);
  return metrics;
}

/* Bar ids must be unique: a duplicate would make chart.js key two datasets'
   ticks off the same label and one of them would be unreachable by tooltip. */
function assertUniqueIds(label, metrics) {
  const seen = new Set();
  for (const metric of metrics) {
    if (seen.has(metric.id)) failures.push(`${label}: duplicate bar id "${metric.id}"`);
    seen.add(metric.id);
  }
  checks.push(label);
}

const student = (schoolID, schoolName) => ({
  PK: `MOCK#STUDENT#${schoolID || 'NONE'}`,
  RegNo: 'LAEC/TEST/2025/0000',
  FullName: 'MOCK TEST STUDENT',
  SchoolID: schoolID,
  Class: 'SSS1',
  Arm: 'SCIENCE',
  Subjects: [],
  PassportURL: '',
  ...(schoolName ? { SchoolName: schoolName } : {}),
});

/* ── 1. the real fixture, which is the 9-against-0 case ──────────────────── */
const fixtureMetrics = assertPartitions('mock roster', MOCK_STUDENTS);

/* The specific regression: a code outside SCHOOL_NAMES must still get a bar. */
const fixtureCodes = new Set(
  MOCK_STUDENTS.map((s) => String(s.SchoolID || '').trim().toUpperCase()).filter(Boolean),
);
for (const code of fixtureCodes) {
  if (code in SCHOOL_NAMES) continue;
  if (!fixtureMetrics.some((m) => m.id === code)) {
    failures.push(
      `mock roster: SchoolID "${code}" is in the directory but has no bar — its students are counted nowhere`,
    );
  }
}

/* An unknown code is labelled by the directory's own name, not just the code. */
for (const metric of fixtureMetrics) {
  if (metric.id in SCHOOL_NAMES) continue;
  if (metric.label === metric.id) {
    failures.push(
      `mock roster: bar "${metric.id}" fell back to its raw code; SchoolName should label it`,
    );
  }
}

assertUniqueIds('mock roster', fixtureMetrics);

/* ── 2. the cases the invariant has to survive ────────────────────────────── */

/* Every student carries a code the name map knows. */
assertPartitions('all known codes', [
  student('SFC'), student('SGC'), student('SFC'),
]);

/* No school at all: one Unassigned bar, nothing dropped. */
const unassigned = assertPartitions('no school', [student(''), student(''), student('')]);
if (unassigned.filter((m) => m.label === 'Unassigned').length !== 1) {
  failures.push('no school: expected exactly one "Unassigned" bar');
}

/* Mixed: known codes, an unknown code and a blank, in one roster. */
const mixed = assertPartitions('mixed roster', [
  student('SFC'), student('001', 'MOCK EXAMPLE SCHOOLS'), student(''), student('MGC'),
]);
assertUniqueIds('mixed roster', mixed);

/* Two unknown codes must not collapse into one bar, and each keeps its own
   directory-supplied name. */
const twoUnknown = assertPartitions('two unknown codes', [
  student('001', 'MOCK EXAMPLE SCHOOLS'),
  student('002', 'SECOND MOCK SCHOOL'),
  student(''),
]);
if (!twoUnknown.some((m) => m.id === '001' && m.label === 'MOCK EXAMPLE SCHOOLS')) {
  failures.push('two unknown codes: bar "001" lost its directory-supplied name');
}
if (!twoUnknown.some((m) => m.id === '002' && m.label === 'SECOND MOCK SCHOOL')) {
  failures.push('two unknown codes: bar "002" lost its directory-supplied name');
}

/* The Unassigned bar must not be emitted when nothing is unassigned. */
assertPartitions('nothing unassigned', [student('SFC')]);
const clean = analytics.buildSchoolPopulationMetrics([student('SFC')], {
  schoolNames: SCHOOL_NAMES,
});
if (clean.some((m) => m.label === 'Unassigned')) {
  failures.push('nothing unassigned: an "Unassigned" bar was emitted anyway');
}

/* Every college in the name map keeps a zero-filled bar, so an empty college
   reads as zero rather than silently vanishing from the chart. */
if (clean.length !== Object.keys(SCHOOL_NAMES).length) {
  failures.push(
    `nothing unassigned: expected ${Object.keys(SCHOOL_NAMES)} bars from the name map, got ${clean.length}`,
  );
}

/* An empty roster is all-zero bars, not a 0-to-1 axis: the ten colleges stay
   visible and summing to 0 satisfies the invariant. Whether that is *drawn* as
   bars or as an empty state is the chart layer's decision, not this one's. */
const none = analytics.buildSchoolPopulationMetrics([], { schoolNames: SCHOOL_NAMES });
if (sumOf(none) !== 0) {
  failures.push(`empty roster: bars sum to ${sumOf(none)}, expected 0`);
}
if (none.some((m) => m.label === 'Unassigned')) {
  failures.push('empty roster: an "Unassigned" bar was emitted for no students');
}

/* No name map at all: the roster itself is the bar list. */
const unmapped = analytics.buildSchoolPopulationMetrics(
  [student('ZZZ'), student('AAA'), student('')],
  {},
);
if (sumOf(unmapped) !== 3) {
  failures.push('no name map: sum of bars does not match the roster');
}

/* ── the same key-space bug in the pass-rate pie ─────────────────────────── */

/*
 * buildSchoolPassMetrics had the identical defect, one layer up. It assembled
 * candidates from `Object.keys(schoolNames)` and then filtered to
 * `attempts > 0`, so results carrying a code the name map does not list were
 * tallied and then discarded for having "no attempts" they demonstrably had.
 * The pie rendered empty, which on screen is identical to a session with no
 * results at all — the card and the histogram now agree, but the pie beside
 * them was still silently blank. This asserts results are never dropped.
 */
function assertKeepsEverySchoolWithResults(label, rows) {
  const metrics = analytics.buildSchoolPassMetrics(rows, { schoolNames: SCHOOL_NAMES });
  const withResults = new Set(
    rows
      .map((r) => String(r.SchoolID || '').trim().toUpperCase())
      .filter((code) => code !== ''),
  );

  for (const code of withResults) {
    if (!metrics.some((m) => m.id === code)) {
      failures.push(
        `${label}: SchoolID "${code}" has results but no pass-rate slice — its results are counted nowhere`,
      );
    }
  }

  for (const metric of metrics) {
    if (metric.attempts <= 0) {
      failures.push(`${label}: slice "${metric.id}" reached the chart with 0 attempts`);
    }
    if (!Number.isFinite(metric.passRate)) {
      failures.push(`${label}: slice "${metric.id}" has a non-finite pass rate`);
    }
    if (!metric.label) {
      failures.push(`${label}: slice "${metric.id}" has no label`);
    }
  }
  checks.push(label);
  return metrics;
}

const result = (schoolID, percentage) => ({
  PK: 'MOCK#RESULT#x',
  RegNo: 'LAEC/001/2025/0000',
  SchoolID: schoolID,
  Subject: 'MATHEMATICS',
  Percentage: percentage,
});

/* The real shape: every mock result carries SchoolID "001" and a percentage. */
const fixtureResults = MOCK_RESULTS.map((r) => ({ ...r }));
const passMetrics = assertKeepsEverySchoolWithResults('mock results', fixtureResults);

if (!passMetrics.length) {
  failures.push(
    'mock results: the pass-rate pie has no slices although GET_RESULTS returns scored rows',
  );
}

/* Known code, unknown code and a school with nothing — the last must be absent. */
assertKeepsEverySchoolWithResults('mixed results', [
  result('SFC', 80),
  result('001', 55),
  result('SGC', 20),
]);

/* A school that sat nothing gets no slice: that is what the filter is for. */
const partial = assertKeepsEverySchoolWithResults('one school only', [result('001', 60)]);
if (partial.some((m) => m.id === 'HCC')) {
  failures.push('one school only: a school with no results was given a slice');
}

/* No name map at all: the results themselves are the slice list. */
const unmappedPass = analytics.buildSchoolPassMetrics([result('ZZZ', 70)], {});
if (unmappedPass.length !== 1 || unmappedPass[0].id !== 'ZZZ') {
  failures.push('no name map: pass-rate slices were lost');
}

/* A result with no school code cannot be attributed, so it is skipped — and
   unlike a population count there is no total here to keep reconciled. */
const noSchool = analytics.buildSchoolPassMetrics([{ Percentage: 70 }], { schoolNames: SCHOOL_NAMES });
if (noSchool.length !== 0) {
  failures.push('no name map: a result with no school code produced a slice');
}
checks.push('result with no school');

/* ── the same key-space bug in the class histogram ───────────────────────── */

/*
 * buildClassPopulationMetrics had it too, and the three school consoles
 * (/ca/, /comm/, /ict/) all report "Total: <students.length>" beside this
 * chart. The function returned only the six levels of DEFAULT_CLASS_ORDER, so
 * the mock roster — SSS1, SSS2, JSS3, GRADUATED, JSS2 — reported 3 students
 * across 6 bars while the caption said 9.
 *
 * This is the same failure as the school histogram (a fixed skeleton that
 * silently drops everything outside it), so it is asserted the same way.
 */
function assertClassLevelsPartition(label, roster) {
  const metrics = analytics.buildClassPopulationMetrics(roster, {});
  const total = metrics.reduce((sum, m) => sum + m.count, 0);

  if (total !== roster.length) {
    failures.push(
      `${label}: class bars sum to ${total} but the roster holds ${roster.length} student(s) — ` +
        `${roster.length - total} lost. bars: ${metrics.map((m) => `${m.key}=${m.count}`).join(' ')}`,
    );
  }

  /* Every bar in the class order is present even when empty, so a level with no
     students reads as zero instead of vanishing from the chart. */
  for (const level of ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3']) {
    if (!metrics.some((m) => m.key === level)) {
      failures.push(`${label}: level "${level}" is missing from the bars entirely`);
    }
  }

  for (const metric of metrics) {
    if (!Number.isInteger(metric.count) || metric.count < 0) {
      failures.push(`${label}: class bar "${metric.key}" has a non-count value ${metric.count}`);
    }
    if (!metric.label) failures.push(`${label}: class bar "${metric.key}" has no label`);
  }

  checks.push(label);
  return metrics;
}

/* The real fixture — the case that read "3 across 6 bars" against a total of 9. */
const fixtureClassBars = assertClassLevelsPartition('mock class levels', MOCK_STUDENTS);
const fixtureClassTotal = fixtureClassBars.reduce((sum, m) => sum + m.count, 0);

/* Off-list levels each get their own bar rather than being dropped. */
const offList = assertClassLevelsPartition('off-list levels', [
  { Class: 'SSS1' }, { Class: 'SSS2' }, { Class: 'JSS1' }, { Class: 'GRADUATED' },
]);
if (!offList.some((m) => m.key === 'SSS1' && m.count === 1)) {
  failures.push('off-list levels: "SSS1" did not get its own bar');
}
if (!offList.some((m) => m.key === 'GRADUATED' && m.count === 1)) {
  failures.push('off-list levels: "GRADUATED" did not get its own bar');
}

/* A student with no readable class still has to be counted somewhere. */
const unclassified = assertClassLevelsPartition('unclassified', [
  { Class: '' }, { Class: null }, { Class: 'JSS1' },
]);
if (!unclassified.some((m) => m.count === 2)) {
  failures.push('unclassified: two students with no class were not tallied on any bar');
}

/* An empty roster is all-zero bars, not a missing chart. */
const noClasses = analytics.buildClassPopulationMetrics([], {});
if (noClasses.reduce((sum, m) => sum + m.count, 0) !== 0) {
  failures.push('empty roster: class bars do not sum to 0');
}
checks.push('empty class roster');

/* ── the results fan-out the pie is built from ───────────────────────────── */

/*
 * `fetchJointOverviewResults` queries all ten colleges and concatenates. That
 * only produces one row per result if GET_RESULTS honours the school scope. The
 * mock's does not (it filters on regNo only), so every batch returns the same
 * nine rows and the naive concatenation counts each result ten times.
 *
 * It was invisible on the pie because pass *rate* is a ratio and a uniform
 * 10× cancels out of it — the chart looked right while `attempts` (and the
 * "N joint result(s)" tooltip) were ten times the truth. The view deduplicates
 * by record key; this asserts the deduplication is complete and lossless.
 */
function dedupeByKey(rows) {
  const seen = new Set();
  const unique = [];
  for (const row of rows) {
    const key = String(row.PK ?? row.pk ?? `${row.RegNo ?? ''}#${row.Subject ?? ''}`);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

const fanned = Object.keys(SCHOOL_NAMES).flatMap(() =>
  fixtureResults.map((r) => ({ ...r, SchoolID: r.SchoolID || 'SFC' })),
);
const deduped = dedupeByKey(fanned);
if (deduped.length !== fixtureResults.length) {
  failures.push(
    `results fan-out: dedup kept ${deduped.length} of ${fixtureResults.length} distinct results`,
  );
}
/* Lossless: the survivors must still be the original records, not truncated. */
if (deduped.some((r) => r.PK !== fixtureResults.find((o) => o.PK === r.PK)?.PK)) {
  failures.push('results fan-out: dedup altered a record');
}
checks.push('results fan-out dedup');

/* With the duplicate batches removed, the pie's attempt count must equal the
   number of results actually returned — not a multiple of it. */
const realMetrics = analytics.buildSchoolPassMetrics(deduped, { schoolNames: SCHOOL_NAMES });
const totalAttempts = realMetrics.reduce((sum, m) => sum + m.attempts, 0);
if (totalAttempts !== deduped.length) {
  failures.push(
    `pass-rate slices: attempts sum to ${totalAttempts} but ${deduped.length} result(s) were fetched`,
  );
}

/* And the fanned-out version must NOT reconcile, which is the bug being fixed. */
const inflated = analytics.buildSchoolPassMetrics(fanned, { schoolNames: SCHOOL_NAMES });
const inflatedAttempts = inflated.reduce((sum, m) => sum + m.attempts, 0);
if (inflatedAttempts === deduped.length) {
  failures.push(
    'results fan-out: expected the raw concatenation to inflate the attempt count',
  );
}

/* ── report ──────────────────────────────────────────────────────────────── */

console.log('Overview total reconciliation (P1)');
console.log(`  roster                 ${MOCK_STUDENTS.length} student(s)`);
console.log(`  distinct SchoolID      ${[...fixtureCodes].join(', ') || '(none)'}`);
console.log(`  bars emitted           ${fixtureMetrics.length}`);
console.log(`  sum of bars            ${sumOf(fixtureMetrics)}`);
console.log(`  reconciled             ${sumOf(fixtureMetrics) === MOCK_STUDENTS.length ? 'yes' : 'NO'}`);
console.log(`  class-level bars       ${fixtureClassBars.length} (${fixtureClassBars.map((m) => `${m.key}=${m.count}`).join(' ')})`);
console.log(`  class total            ${fixtureClassTotal} of ${MOCK_STUDENTS.length}`);
console.log(`  pass-rate slices       ${passMetrics.length} (${passMetrics.map((m) => m.id).join(', ') || 'none'})`);
console.log(`  pie attempts           ${totalAttempts} of ${deduped.length} result(s) (raw fan-out: ${inflatedAttempts})`);
console.log(`  cases checked          ${checks.length}`);

if (failures.length) {
  console.error('\nFAIL — a caption and the bars beside it can disagree again:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  '\n  every roster partitions: sum of bars === roster length' +
    ' (school population, class levels, pass-rate slices)',
);
