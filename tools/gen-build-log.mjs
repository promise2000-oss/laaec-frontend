// Generates BUILD-LOG.md traceability checklist from the PRD source of truth.
// Run: node tools/gen-build-log.mjs
import fs from 'node:fs';

const PRD = 'C:/Users/USER/Desktop/PRD.md';
const OUT = 'C:/Users/USER/Documents/laaec-audit/BUILD-LOG.md';

// Phase 2.0 infrastructure — not PRD-derived, tracked here for honesty.
const FOUNDATION = [
  'Vite MPA scaffold — 8 HTML entries, Vue 3 `<script setup lang="ts">` strict, Vue Router 4, `/admin` 308 alias (D-01)',
  'Layouts PublicLayout / ExamLayout / AdminLayout with per-route surface token loading',
  'Token CSS `src/styles/glass.css`, `nj.css`, `enterprise.css` — from COLOUR-SPEC.md, body surface + page classes',
  'Typed domain model `src/types/` — PRD §2.2–2.3 + observed fields, `unconfirmed` markers (D-05)',
  'Typed mock API `src/api/` — all 38 actions of PRD §3.6, flat envelope, evidence in tools/actions-report.txt (D-05)',
  'Composables useExamLockdown (RF-46…51), useExamTimer (RF-41…45), useAnswerPersistence (RF-52), useIdleTimeout (RF-4/5), useApiRetry (RF-98)',
  'Pinia stores — student session, admin session, portal + exam config (D-45: the eight pages ended up needing none; per-page refs plus `localStorage`/`sessionStorage` mirror the origin own state, and a shared store would have been a second source of truth)',
  'Reference capture `origin-pages/` (8 original documents) and `origin-assets/` — read-only, never served',
];

const lines = fs.readFileSync(PRD, 'utf8').split(/\r?\n/);

const DEFECT_RF = new Set([6, 29, 60, 63, 67, 95, 106]);
const short = (s, n = 150) => {
  const t = s.replace(/\\\|/g, '|').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
};

// ---- track sections ----
let sec = null, sub = null, label = '', tblState = 'none';
const groups4 = [];            // { head, items: [] }
const flows = [];
const rf = [];                 // { id, n, text, spec }
const assets = [];
const deps = [];
const shared = [];             // 4.9 table rows
const excludedUC = [];

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];

  let m;
  if ((m = /^## (\d+)\. /.exec(l))) { sec = +m[1]; sub = null; label = ''; tblState = 'none'; continue; }
  if (/^## Appendix/.test(l)) { sec = null; sub = null; tblState = 'none'; continue; }
  if ((m = /^### (\d+\.\d+) (.*)$/.exec(l))) {
    sub = m[1];
    tblState = 'none';
    if (sec === 4) { groups4.push({ head: `§${m[1]} ${m[2]}`, items: [] }); label = ''; }
    if (sec === 5 && /^UC-\d{2}$/.test(m[2].split(' — ')[0]) && +m[2].slice(3, 5) <= 10) flows.push(m[2]);
    continue;
  }

  // requirement rows (RF tables live in §6 and §8.2)
  if ((m = /^\| (RF-\d+) \| (.*) \| (As-built|Partial|Requested \(v1\.2\)) \|$/.exec(l))) {
    rf.push({ id: m[1], n: +m[1].slice(3), text: m[2], spec: m[3] });
    continue;
  }

  if (sec === 4) {
    const g = groups4[groups4.length - 1];
    if (/^\*\*[A-Za-z][^*]*\*\*/.test(l)) { label = (l.match(/^\*\*([^*]+)\*\*/) || [])[1].replace(/\.$/, ''); }
    if (/^\|/.test(l)) {
      const isSep = /^\|---/.test(l);
      if (tblState === 'none') { tblState = 'header'; continue; }
      if (tblState === 'header') { tblState = isSep ? 'data' : 'header'; if (isSep) continue; }
      if (isSep) continue;
      const c = l.split('|').map(s => s.trim()).filter((_, k, a) => k > 0 && k < a.length - 1);
      if (sub === '4.9') { if (c.length === 3) shared.push(`${c[0].includes('`') ? c[0] : '`' + c[0] + '`'} — where: ${c[1]} — ${short(c[2], 110)}`); }
      else if (c.length >= 2 && g) g.items.push(`${label ? label + ' · ' : ''}${c.map(x => short(x, 90)).join(' · ')}`);
      continue;
    }
    tblState = 'none';
    if ((m = /^(\d+)\. (.+)$/.exec(l))) {
      if (g) g.items.push(`${label ? label + ' · ' : ''}${m[1]}. ${short(m[2])}`);
      continue;
    }
    if ((m = /^- (.+)$/.exec(l))) { if (g) g.items.push(`${label ? label + ' · ' : ''}- ${short(m[1])}`); continue; }
    continue;
  }

  if (sec === 3 && sub === '3.3' && (m = /^\| `([^`]+)` \| ([\d,]+) \| (.+) \|$/.exec(l))) {
    assets.push({ path: m[1], bytes: m[2], purpose: short(m[3], 110) }); continue;
  }
  if (sec === 3 && sub === '3.4' && /^\|/.test(l) && !/^\|---/.test(l) && !/^\| Dependency \|/.test(l)) {
    const c = l.split('|').map(s => s.trim()).filter((_, k, a) => k > 0 && k < a.length - 1);
    if (c.length === 5) deps.push(c); continue;
  }
}

// ---- hand-checked from PRD §3.1 ----
const routes = [
  ['/', 'LAEC | Official CBT Portal', 'Unauthenticated gateway, two role entry points'],
  ['/login/', 'LAEC | Examination Login', 'Student authentication, post-login routing'],
  ['/exam/', 'LAEC | Secure Examination Hall', 'Proctored exam: instructions, timer, questions, submission'],
  ['/control/', 'LAEC | Admin Command Center', 'Admin auth, forced reset, recovery, role routing'],
  ['/admin/', 'LAEC | Master Command Center', 'Super Administrator console, 7 tabs'],
  ['/ca/', 'LAEC | School Admin Portal', 'School Administrator console, 8 tabs'],
  ['/ict/', 'LAEC | School Admin Portal (title incorrect — replicate)', 'ICT Administrator console, 7 tabs'],
  ['/comm/', 'LAEC | Exam Committee Portal', 'Exam Committee console, 6 tabs, view-only'],
  // Added by the exam-management addendum (D-55, D-56) — not origin pages.
  ['/teacher/', 'LAEC | Teacher Portal', 'Teacher portal console: the St Finbarr's modules plus the 3 exam-paper tabs'],
  ['/central/', 'LAEC | Central Administration', 'Central Admin console: review queue, question bank, staff'],
];

const inScopeRF = rf.filter(r => r.n <= 109).sort((a, b) => a.n - b.n);
const outScopeRF = rf.filter(r => r.n > 109).map(r => r.id).sort();

const rows = (arr) => arr.join('\n');

const L = [];
L.push(`# BUILD-LOG — LAEC CBT Portal Front End`);
L.push('');
L.push(`**Project root:** \`C:\\Users\\USER\\Documents\\laaec-audit\\\``);
L.push(`**Source of truth:** \`C:\\Users\\USER\\Desktop\\PRD.md\` (v1.2)`);
L.push(`**Colour source:** \`COLOUR-SPEC.md\` — generated from \`LAEC-Colour-Spec.pdf\` with pdf-parse (D-02), cross-checked 95/95 against \`colors.md\` (2026-09-28)`);
L.push(`**Original under comparison:** https://www.laaec.com`);
L.push(`**Started:** 2026-09-28 · **Owner:** Promise Shedrack, NICEGENE Technologies`);
L.push('');
L.push('## Status key');
L.push('');
L.push('- `not started` → `in progress` → `done` → `verified`');
L.push('- A line reaches `verified` only after a playwright run against the live original (layout, verbatim copy), a computed-style diff against COLOUR-SPEC.md, and responsive checks at 390 / 768 / 1440 — all with mocked API responses.');
L.push('- Nothing is marked `done` while its verification is outstanding.');
L.push('');
L.push('## Decision ledger');
L.push('');
L.push('| # | Area | Decision | Date |');
L.push('|---|---|---|---|');
[
  ['D-01', 'RF-1 page count', 'Vite multi-page build — eight HTML documents at the documented paths', '2026-09-28'],
  ['D-02', 'Colour source', 'Generate COLOUR-SPEC.md from LAEC-Colour-Spec.pdf (pdf-parse, dev-only)', '2026-09-28'],
  ['D-03', 'First-party files', 'Fetch the 11 files in PRD §3.3 from the live origin, use as-is', '2026-09-28'],
  ['D-04', 'Scope', 'RF-1…RF-109 only; RF-110–125, UC-11–13, Q24–28 excluded', '2026-09-28'],
  ['D-05', 'API contract', 'Approved typed mock adapter; unknown fields marked `unconfirmed`, never guessed', '2026-09-28'],
  ['D-06', 'Defect RF-6', 'Replicate as observed — catch-all returns homepage at 200', '2026-09-28'],
  ['D-07', 'Defect RF-29', 'Replicate as observed — plaintext password printed on slip', '2026-09-28'],
  ['D-08', 'Defect RF-60/D19', 'Replicate as observed — UI advertises `#`, validator rejects it', '2026-09-28'],
  ['D-09', 'Defect RF-63', 'Replicate as observed — SEND_ADMIN_PASSWORD_CHANGED_EMAIL fires as built', '2026-09-28'],
  ['D-10', 'Defect RF-67', 'Replicate as observed — session-lock functions stay no-op stubs', '2026-09-28'],
  ['D-11', 'Defect RF-95', 'Superseded 2026-09-30 by D-71. Originally: replicate as observed — no client-side role guards on /ca/ /ict/ /comm/. Each of the six consoles now declares the role it belongs to in router.beforeEach and returns an operator without it to /control/, the same redirect the origin already used for a rejected SUPER_ADMIN on /admin/ (RF-3)', '2026-09-28'],
  ['D-12', 'Defect RF-106', 'Replicate as observed — /login/ keeps no solid background fallback', '2026-09-28'],
  ['D-13', 'Defect D1', 'Replicate as observed — fetch `laec logo.png`, keep the space, let the reference fail', '2026-09-28'],
  ['D-14', 'Chart.js', 'Pin to the version the observed unpinned jsDelivr URL resolves to today; record it here', '2026-09-28'],
  ['D-15', 'AWS SDK v2', 'Include, pinned 2.1555.0', '2026-09-28'],
  ['D-16', 'Cloudflare scripts', 'Omit Web Analytics and Bot Management; logged as deviation DEV-1', '2026-09-28'],
  ['D-17', 'Background photos', 'Rights confirmed — use exact images.unsplash.com URLs', '2026-09-28'],
  ['D-18', 'Cognito client', 'amazon-cognito-identity-js pinned 6.3.7 (observed)', '2026-09-28'],
  ['D-19', 'Approved packages', 'Vue 3, Vite, Vue Router 4, Pinia, chart.js, xlsx 0.18.5, jspdf 2.5.1, aws-sdk 2.1555.0, pdf-parse (dev-only). No others without approval', '2026-09-28'],
  ['D-20', 'Open questions B4', 'Q1, Q3, Q6, Q9, Q10, Q12, Q13, Q16, Q17, Q18, Q21 — replicate as observed', '2026-09-28'],
  ['D-21', 'Go / workspace', 'laaec-audit workspace, build inside Documents directory', '2026-09-28'],
  ['D-22', 'Asset byte mismatch', 'Use today\'s origin files for nicegene_logo.png and laec logo.png; PRD §3.3 rows recorded 41,602 / 256,369 B on 25 Sep, origin serves 43,715 / 270,572 B — PRD counts logged stale', '2026-09-28'],
  ['D-23', 'Toolchain packages', 'Approved: @vitejs/plugin-vue 6.0.9, vue-tsc 3.3.11 (build-time only, required for SFC compile and type-check)', '2026-09-28'],
  ['D-24', 'TypeScript pin', 'Keep 5.9.3 rather than npm latest 7.0.2 — stable line vue-tsc 3.3.11 is built against; strict mode unaffected', '2026-09-28'],
  ['D-25', 'Webfont loading', 'Replicate as observed: Google Fonts Inter link loads only on `/`; `/login/` and `/control/` declare the Inter stack but render Segoe UI (zero googleapis references on the origin). COLOUR-SPEC §5 corrected by note', '2026-09-28'],
  ['D-26', 'Browser `global` alias', 'vite.config.ts `define: { global: "globalThis" }` — amazon-cognito-identity-js (D-18) references Node\'s `global` at module scope', '2026-09-28'],
  ['D-27', 'Mock test seam', 'Dev-only `window.__LAEC_MOCK__` exposing failNextCall/resetMockFailures plus an `attemptsRemaining` fixture so playwright runs can simulate outages that outlive RF-98 retries; guarded by `import.meta.env.DEV` and tree-shaken from production builds', '2026-09-28'],
  ['D-28', 'Question transport', 'GET_SECURE_QUESTIONS goes through the origin `config.js fetchQuestionSet` with a `fetchImpl` shim routed to the typed mock — subject/class candidate expansion, Diagnostic Report attempts and config.js\'s own RF-98 retry layer stay byte-authentic, no request leaves the browser', '2026-09-28'],
  ['D-29', 'RF-2 enforcement point', '`router.beforeEach` redirects unauthenticated `/exam/` to `/login/`; `ExamView` also keeps the origin\'s top-level `activeStudent` / `selectedSubject` check as origin-parity code. The router runs first, so the origin\'s accompanying uncaught "Missing active exam session." console line is not surfaced — recorded as DEV-2; PRD RF-2 requires the redirect only', '2026-09-28'],
  ['D-30', 'Exam timer duration', '`useExamTimer` resolves RF-41 duration at `start()`, not at construction: the view creates the composable during setup while `config.examDuration` and `paper.DurationMinutes` only exist after Stage 1\'s fetches. The origin assigns `timeLeft` at sync time and re-tests the mode on every tick; the rendered `HH:MM:SS` is identical in both, and the pre-start display stays "00:00:00"', '2026-09-28'],
  ['D-31', 'Administrator authentication', '`mockAuthenticateAdmin` / `mockCompleteAdminPasswordChallenge` stand in for Cognito\'s `authenticateUser` / `completeNewPasswordChallenge` on `/control/`, returning the three outcomes the page branches on (success, `newPasswordRequired`, thrown Cognito-style message) plus the claims `processLoginSuccess` reads (`custom:Role`, `custom:SchoolID`, `name`). Fictional roster: mocksuper / mockschool / mockict / mockcommittee with `MockAdminPass1`, mocktemp with `TempAdmin1!` for RF-59, mockguest for the RF-66 rejection. A real `AuthenticationDetails` is still constructed and never transmitted (D-11); the real user pool is never contacted', '2026-09-28'],
  ['D-32', 'SheetJS global', 'The origin loads xlsx 0.18.5 from a CDN <script> (admin.html line 50) so the first-party `/config.js` helpers can see `window.XLSX`; `extractFormattedQuestionRows` returns `[]` when that global is missing. This build bundles the same pinned version, so `AdminView` publishes it as `window.XLSX` once instead of reimplementing the origin helpers. The blaster only worked end to end after this bridge existed \' without it every workbook reported \"Excel file is empty.\"', '2026-09-28'],
  ['D-33', 'Generated CSS scoping', '`tools/extract-page-css.mjs` re-scopes the <style> block of each console page under that page body class (D-41 generalises this to /ca/, /ict/ and /comm/). Two corrections were needed for mobile parity: unscoped `html`/`body` rules inside a media query are NOT duplicates of enterprise.css (the <=900px block that switches the body to `display: block` and releases `.main-content` exists only there), so they are kept and anchored to `body.surface-enterprise.page-admin` to out-specify the enterprise base rule; and the duplicate-selector dedupe now runs at the top level only, so a media override that repeats a top-level selector survives in cascade order', '2026-09-28'],
  ['D-34', 'PRINT PDF', 'The PRINT PDF button calls `downloadResultsPDF()`, which is never defined in the document (line 1192 with no definition) \' the click raises an uncaught error and nothing happens. Replicated rather than replaced with an invented jsPDF export (DEV-4)', '2026-09-28'],
  ['D-35', 'Results fixtures', '`MOCK_RESULTS` carries the hall fields the /login/ completion filter reads (`Subject`, the CA1/CA2/EXAM triple) plus the administrator-side fields the /admin/ renderers attest \' identity, coordinate, score triple, status, violation payload and a three-line `AnswerScript`. Three records are FLAGGED so the invigilation monitor has content, one of them a time-expiry violation that the delete path deliberately spares', '2026-09-28'],
  ['D-36', 'Response fields the renderers read', '`BULK_UPLOAD_QUESTIONS` and `UPLOAD_QUESTION_IMAGE` are typed with the optional `count` / `imageUrl` fields the success alert and hosting card read, and the mock returns them, so the origin\'s interpolation is used verbatim instead of being defensively defaulted', '2026-09-28'],
  ['D-37', 'Subject filters read the Vue ref', '`normalizeResultSubjectInput` / `normalizeInvigilatorSubjectInput` read their input by element id on the origin. In the view the same helper takes the bound value and resolves it against the shared `#res-subject-options` datalist, which is what both origin functions do', '2026-09-28'],
  ['D-38', 'jsPDF', 'jspdf 2.5.1 stays in the approved dependency list but has no consumer in this build: the only PDF control on these four consoles is the undefined `downloadResultsPDF` (D-34), and no first-party module references the global', '2026-09-28'],
  ['D-39', 'First-party libraries on a mock transport', 'The origin points `/exam-session-controls.js` and `/dashboard-registration.js` at the live AWS endpoints. Both network helpers the session library uses (`fetchQuestionInventory`, `fetchQuestionSet`) live in the first-party `/config.js` and accept a `fetchImpl`, so the view passes a `LAEC_UTILS` proxy that injects the mock fetch and lets the library run its own code untouched. This closed the paper queue on both `/admin/` and `/ca/` (it was skipped under DEV-5). The registration library posts with a bare `fetch(registerEndpoint)`, which has no seam, so its endpoint points at a non-routable mock host and the origin error path handles the response (DEV-9)', '2026-09-29'],
  ['D-40', 'Shared console module', 'The four console pages ship near-identical inline scripts, so the pure helpers (result formatting, filters, export filenames, invigilation predicates, the mock transport) live in `src/lib/console.ts` and are imported by the views. `/admin/` keeps its own inline copies: it was built and verified before the module existed, and folding it in was judged not worth the regression risk on an already-verified page; the three later consoles share the module', '2026-09-29'],
  ['D-41', 'Generated page CSS, generalised', '`tools/extract-page-css.mjs <page>` now generates `ca|ict|comm-page.css` the same way it generated `admin-page.css` (D-33). It also revealed that the earlier generator silently dropped every media-query rule whose selector also appeared at the top level; the corrected generator restores them, which is why the mobile header padding, scroll-button sizing and the reduced-motion rule now appear on the consoles', '2026-09-29'],
  ['D-42', 'Inventory and demotion fixtures', '`GET_QUESTION_INVENTORY` returns seven keyed papers (`<Class>::<Subject>`, the key the first-party library merges on, and the form its own discovery path stamps) and `GET_DEMOTION_LOGS` returns three records plus the `counts` map, two of them sharing a RegNo so the register shows a repeated demotion. `MOCK_CONFIG.promotionActive` is now true - the origin only opens the super-administrator promotion window during TERM1, which is the term the fixture is set to, and it is what reveals the `/ca/` Promotion Exception surface', '2026-09-29'],
  ['D-43', 'School-agnostic mock college', 'GET_STUDENTS serves the one mock roster for whatever school code the session carries (the mock login stores 001, but a console with empty storage falls back to SFC, and the exam committee resolves to GLOBAL) as well as for ALL/GLOBAL. Without this the school consoles rendered an empty directory purely because of the code they inherited, which made RF-88 and the directory exports untestable rather than faithful', '2026-09-29'],
  ['D-44', '/ict/ and /comm/ page scoping', 'Each console keeps its own hardcoded school-name map, as served: /ca/ uses straight apostrophes, /ict/ and /comm/ use typographic ones, and /comm/ adds the GLOBAL/ALL entries for the joint committee. `/comm/` also reproduces the origin resolution `SchoolID || (role === EXAM_COMMITTEE ? \"GLOBAL\" : \"\")` and its `IS_JOINT_COMMITTEE` branch in the mode hint', '2026-09-29'],
  ['D-45', 'Pinia was unadopted, then adopted for the session alone', 'Pinia stayed in the approved stack (D-19) while no page used it: each view holds the state the origin page holds in module or inline scope, and the cross-page session lived in localStorage/sessionStorage exactly as served, so a shared store would have been a second source of truth for state the origin keeps per page. That reasoning still rules out a store per feature. D-71 then made one store necessary: RBAC has to answer "may this session see this?" from a single reactive place that both the rail and the transport consult, and localStorage cannot do that because it does not re-render. src/stores/session.ts is therefore the only store in the project, and it holds role and permissions — not view state, which stays where the origin left it', '2026-09-29'],
  ['D-46', 'Question manager wiring', 'The first-party `/question-management.js` self-initialises on DOMContentLoaded, which in a module-rendered page fires before the view mounts, so `init()` found no exam panel and bailed - the same ordering problem already handled for `admin-sidebar.js` and `dashboard-registration.js`. Each console now calls `window.LAECQuestionManager.init()` after mount, and because the library is the one first-party module with no utils seam (it hard-codes the live endpoints from config.js), `installLibraryFetchBridge()` intercepts exactly its five actions by name - GET_SECURE_QUESTIONS and the UPDATE_QUESTION / ADD_QUESTION / DELETE_QUESTION / DELETE_QUESTION_PAPER posts - and answers them from the typed mock, passing every other request through to the original fetch untouched. RF-79 is therefore implemented and verified rather than waived', '2026-09-29'],
  ['D-47', 'Answer-script viewer', 'The origin carries a 139-line answer-script block in every console\'s inline script (admin.html 2643-2781, byte-identical on all four) that nothing in its UI calls. RF-73 and RF-109 describe it and the origin is the specification, so it is transcribed into `installResultScriptViewer()` in src/lib/console.ts and installed by all four views rather than dropped. The origin declares it at the top level of a classic script, so the functions are page globals there; a `<script setup>` module would hide them and the modal\'s own `onclick="closeResultScriptModal()"` needs the global, so they are assigned to `window`. `viewResultScript` keeps the origin\'s unresolved `renderedScriptResultList` reference (it is declared nowhere on the origin either), suppressed with `@ts-expect-error` and a comment, so the `source === "script"` path still raises. The cloud re-fetch is the one place this block would have dialled the live endpoint, so it is given the page\'s mock transport (D-39, D-04). The block stays unreachable from the UI on all four pages, exactly as it is on the origin (DEV-3)', '2026-09-29'],
  ['D-48', 'Dev-only fixture overrides', 'Three requirements could not be observed from any single browser run with the shipped fixtures, because each pair of branches is mutually exclusive in the data: RF-8 needs a closed portal (the fixture is open), RF-16 needs the promotion window both open and shut (the fixture has it open), and RF-19 needs a paper whose window has closed (the fixture window is 2020-2099). `window.__LAEC_MOCK__.setPortalState()` now flips `portalActive`, `isOffline`, `isPromotionActive` and the live papers\' `StartTime` / `EndTime`. It is kept in localStorage rather than a module variable because the portal-state check runs on mount, before any `page.evaluate` can reach the mock. Like the rest of the mock it is dev-only and tree-shaken out of `dist/`', '2026-09-29'],
  ['D-49', 'Mock fixture enrichments', 'Three mock questions were edited so the rendering rules can be observed rather than only read. MOCKQ7 lost its option `C`, because RF-35 requires the hall to render only the letters a question carries and every shipped question had all four; MOCKQ8 gained a `QuestionHTML` cell carrying `<script>`, an `onmouseover` attribute and an inline `style` so RF-38\'s sanitiser has something to strip, plus a deliberately missing `ImageURL` so RF-39\'s broken-image path fires. Supporting this, `Question.A` to `Question.D` are typed optional (D-50): the origin\'s option filter checks each letter for presence, so a question without one is a shape the renderer is written for, even though every question in the capture carried all four. The paper still holds twelve questions, so the counts cited elsewhere in this log are unchanged', '2026-09-29'],
  ['D-50', 'Optional option letters in the question type', '`Question.A`..`D` became optional so a three-option question can be represented. The capture only ever showed four, but the type mirrors the wire shape the renderer consumes rather than the population of the sample, and RF-35 requires the renderer to cope with an absent letter. `ExamAnswerScriptLine` keeps them required, because that is the shape a submitted script always has', '2026-09-29'],
  ['D-51', 'Page-function scope', 'Every function in the origin inline script is a page global, because a classic script puts its top-level declarations on `window`. A `<script setup>` module does not, so this build installs on `window` only what has observable behaviour without one: the first-party libraries own globals, `winAlert`, `toggleNav`, `scrollToTopPage`, the answer-script block (D-47) and the entry points the views themselves call through markup. View-scoped handlers such as `toggleLocalMode`, `exportStudentData` and `refreshCommitteeQueue` stay module-scoped and are reachable through their controls, which is the only difference a user or a rendered page can observe. Every name the ledger quotes as a global is checked against `window` in the verification runs', '2026-09-29'],
  ['D-52', 'Seeded operator account', 'The origin authenticates administrators against Cognito and no credential was ever available, so this build ships one named super-administrator account so the portal can be opened without seeding storage by hand: `admin@nicegeneco.com` / `Admin@2026`, role SUPER_ADMIN, scope GLOBAL, no forced password change. It is added to `MOCK_ADMINS` as well as the password table, so it appears in the School Admins directory alongside the four role fixtures rather than being a login that resolves to nothing. The failure paths are untouched — a wrong password still returns Incorrect username or password and an unknown identifier still returns User does not exist (both checked in the browser). The credential is mock-only: the production bundle contains no mock at all', '2026-09-29'],
  ['D-53', 'Question authoring lifecycle', 'The addendum asks for mediated question publishing: a teacher writes a paper, it does not go live, a review team accepts or rejects it, and the author is notified. None of that exists in the origin, whose ADD_QUESTION and UPDATE_QUESTION write straight into the live set. This build therefore adds a four-state lifecycle, DRAFT -> PENDING_REVIEW -> LIVE or REJECTED, carried on a submission record holding one paper of questions for one school, subject, class, term and category. Only the LIVE state is read by the exam hall: GET_SECURE_QUESTIONS prepends a live submission\'s questions to the base fixture, so an accepted paper is what a candidate actually sits. The four origin consoles keep their unmediated write path unchanged, because that is what the origin does and the addendum did not ask to replace it', '2026-09-29'],
  ['D-54', 'Eight new contract actions', 'GET_MY_SUBMISSIONS, GET_REVIEW_QUEUE and GET_TEACHER_NOTICES, plus SAVE_QUESTION_SUBMISSION, SUBMIT_QUESTION_FOR_REVIEW, ACCEPT_QUESTION_SUBMISSION, REJECT_QUESTION_SUBMISSION and SEND_QUESTION_DECISION_EMAIL. They follow the shape of the observed actions - verb-first, schoolID-scoped, a flat status and message envelope - and the two review decisions take a list of submission ids so the queue can be worked one paper at a time or in groups, which is the addendum\'s edit individually or in groups. GET_COGNITO_ADMINS also became fully optional: every origin caller passes both a schoolID and a roles filter, and the Central Admin needs the unfiltered read', '2026-09-29'],
  ['D-55', 'Two new roles and two new consoles', 'TEACHER and CENTRAL_ADMIN, neither of which exists in the origin. A teacher is school staff who authors papers and lands on the new /teacher/ Question Studio. Central Admin sits above the four school consoles with cross-school scope, owns staff onboarding and chairs the review queue, and lands on the new /central/ console. The user chose this shape over reusing the EXAM_COMMITTEE role or folding the work into Super Admin. The four origin consoles and their four roles are untouched', '2026-09-29'],
  ['D-56', 'Two new documents, so RF-1 no longer holds literally', 'RF-1 records that the system serves exactly eight HTML documents at the PRD\'s routes. The addendum needs two more, so the build now emits ten. The eight origin pages are what they were - same routes, same markup, same first-party assets - and /teacher/ and /central/ are additions, recorded here rather than folded silently into the page count. Both take the enterprise surface and the console webfont, and both point their favicon at an asset this build serves rather than the origin\'s deliberately broken reference', '2026-09-29'],
  ['D-57', 'The addendum consoles share the enterprise chrome', 'The two new pages use the same 15-token surface, the same shared components (custom alert, loading overlay, back-to-top, footer, page header) and the same tab-and-panel structure as the four consoles, so the portal reads as one product. Their stylesheets are scoped to the surface and the two new page classes, so nothing they declare can leak into the eight origin pages, which keep their own generated stylesheets', '2026-09-29'],
  ['D-58', 'A decision notifies twice, the way the origin notifies', 'An accept or a reject writes an in-app notice for the author, which is what makes the decision observable on the teacher\'s Decisions tab, and separately fires SEND_QUESTION_DECISION_EMAIL. The split follows the origin, whose only notification is a POST action, and keeps the notice as the record when the email is best-effort. The rejection reason is typed into the panel rather than raised through window.prompt, because the origin uses its own dialog and a native prompt is unstyled and untestable', '2026-09-29'],
  ['D-59', 'Narrow viewports on the two new consoles', 'A question needs its stem and four options legible, so the tables are wider than a phone on purpose and scroll inside their own container. Holding the viewport took three things: box-sizing: border-box on .main-content, min-width: 0 on the grid and flex children, and overflow-x: hidden on the html element - the last using the same html:has(body...) idiom the four generated console stylesheets already use. A flex item sized max-width: 100% resolves against an already-widened parent, which is why the clip has to be on the html element and not on the table container', '2026-09-29'],
  ['D-60', 'One app shell for all six roles', 'The six consoles each authored their own header: a gradient bar over a horizontal tab strip. That is what made the portal read as a set of unrelated admin panels, and it is the substance of the redesign the client asked for. src/components/AppShell.vue replaces all six with one frame: a 248 px left rail grouped by domain, and a 60 px top bar carrying the breadcrumb, the role, the tenant scope chip and the account menu. The shell deliberately does not own the panels - it emits a selection and each view calls the showTab() it already had - which is what let all 37 panels keep their verified DOM through a chrome rewrite. The shell\'s own elements are divs with ARIA roles rather than header/nav/main, because the four origin consoles ship stylesheets transcribed from the live pages and those carry bare element rules that would otherwise win on the shell. It is a deliberate departure from the origin\'s visuals, approved by the client on 2026-09-29 in place of the per-console colours COLOUR-SPEC pins (D-63)', '2026-09-29'],
  ['D-61', 'Role-filtered navigation became enforced, not presentation', 'Each role receives its own list of sections, so a role only sees what it owns. From 2026-09-29 to 2026-09-30 nothing was blocked — no route, no panel and no action was guarded, and the four origin consoles carried no client-side role guard. That was the client\'s explicit choice, consistent with D-11, and it is recorded so the nav was never mistaken for the enforcement layer the origin does not have. D-71 reversed it: the same filter now sits in front of the routes (six console guards), in front of every write (one gate in callApi over all 38 POST actions) and in front of the privileged controls themselves, so the navigation and the permission it advertises can no longer disagree', '2026-09-29'],
  ['D-62', 'One navigation definition for the whole portal', 'The origin kept a flat TABS array in each view, so a role\'s navigation was defined six times and none of them agreed on hierarchy. src/lib/nav.ts now holds all six role definitions, grouped into Overview / Academics / Results / People / Governance / System, and the per-view TABS arrays are gone. Every one of the 37 tab labels is the origin\'s own text, unchanged - only the grouping and order are new - so the copy evidence still holds. The tab ids are unchanged too, so showTab(), refreshTabData() and the saved-tab restore all still address the same panels', '2026-09-29'],
  ['D-63', 'The token contract, and what it replaces', 'One neutral ramp, one accent (#1d4ed8), four semantic colours, a 4 px spacing scale and two radii, declared once in AppShell.vue and scoped to the six role consoles. This supersedes the per-console brand values COLOUR-SPEC pins (#123a63 / #4ec6ff on /admin/, /ca/, /ict/, /comm/) for chrome and surfaces. The three surface stylesheets that predate it stay in place and unchanged for /, /login/, /control/ and /exam/, which are the gateway and student surfaces and keep the PRD\'s own colours; the redesign is scoped to the roles, not to the portal. The origin\'s decorative bubble layer is suppressed on the six consoles only, as is the gradient header it belonged to. The page-box reset carries !important on a short documented list of properties, because the four origin stylesheets are transcribed from the live pages and their selectors carry the page class, which outranks anything the shell can express with classes alone', '2026-09-29'],
  ['D-64', 'Notification centre, academic calendar and notice board', 'Three features carried over from a deployed school-management application the client pointed at on 2026-09-29, after that application was walked in the browser. They are not origin behaviour and are not in PRD v1.2; the client approved building these three and explicitly excluded a fourth. Nine contract actions were added: GET_NOTIFICATIONS, GET_ACADEMIC_CALENDAR, GET_NOTICES, MARK_NOTIFICATION_READ, MARK_ALL_NOTIFICATIONS_READ, UPSERT_ACADEMIC_EVENT, DELETE_ACADEMIC_EVENT, PUBLISH_NOTICE and DELETE_NOTICE. What was taken was the idea and the interaction shape; no code was ported, and the reference application\'s backend is a third-party service this build has no relationship with. Two surfaces are new documents, /calendar/ and /notices/, so the page count goes from ten to twelve on the same reasoning as D-56', '2026-09-29'],
  ['D-65', 'The notification centre lives in the shell, not on a page', 'A bell with an unread badge sits in the AppShell top bar, so the count is visible from every console, and it opens a panel with the category filter tabs and a mark-all-as-read. It is deliberately not a page: the gap it closes is that a review decision previously sat in a Decisions tab an author had to go and find, with no unread indicator anywhere. A page would have reproduced that gap with more navigation. Categories are EXAM, REVIEW, RESULTS, ANNOUNCEMENT, SECURITY and SYSTEM rather than the reference application departmental tabs, which have no counterpart in an examination portal', '2026-09-29'],
  ['D-66', 'A notification reaches an operator three ways', 'A notification is addressed to one account, to one role, or to the whole portal, and the read returns all three that apply, pinned first then newest. This is why the fixtures can be checked for correctness rather than convenience: a Security item addressed to a teacher shows a count of 0 for every other role, which was observed in the browser. Notifications, the calendar and the notice board persist with the rest of the session state, for the same reason the authoring fixtures do (D-54): a decision made by one role has to be readable by another after the handoff', '2026-09-29'],
  ['D-67', 'The review workflow and the notification centre are one system', 'Accepting or rejecting a teacher paper raises a REVIEW notification for the author as well as the in-page notice they already read. Keeping them as two features would have let them drift, and a decision that exists in one place but not the other is worse than either alone. This was verified end to end: the Central Admin accepted SUB-0002 and the author bell then showed SUB-0002 was accepted', '2026-09-29'],
  ['D-68', 'Notices are addressed to a role, and publishing is a privilege', 'A notice names its audience, and a read returns that notice only to the audience and to the two publishing roles. Posting and withdrawing are available to SUPER_ADMIN and CENTRAL_ADMIN only — from D-71 that is carried by the `notices.publish` / `notices.withdraw` permissions rather than being a matter of what is drawn: the buttons render only when the session holds the permission and the transport refuses the write without it. Publishing a notice also raises an ANNOUNCEMENT notification, so the board and the centre cannot disagree', '2026-09-29'],
  ['D-69', 'The calendar surfaces data the build already had', 'The academic session and term already existed in MOCK_CONFIG, and every live paper already carried a StartTime and an EndTime; nothing read either for presentation. The calendar is what turns an examination window into something an administrator can see as a window. It carries the reference application four view modes (Monthly, Weekly, Yearly, Agenda) and its Today jump, because those are the part worth having, and adds an add/remove capability so the surface is not read-only — that capability is the `calendar.manage` permission since D-71, so only the roles holding it are offered the controls and the transport refuses the write to anyone else. A GLOBAL reader sees every school calendar, the same cross-school rule the review queue uses (D-55)', '2026-09-29'],
  ['D-70', 'Messaging was examined and deliberately not built', 'The reference application fourth area is direct and group messaging, with a user directory and a DM composer. It was walked in the browser and left out. LAEC has no parent or guardian role, so chat with teachers, staff and parents has no counterpart audience here; and messaging candidates families is PII, moderation and audit territory on a portal whose whole purpose is examination integrity. This is recorded so the omission reads as a decision rather than an oversight, and so it can be revisited knowingly if the client wants it', '2026-09-29'],
  ['D-71', 'RBAC is built and enforced, in the reference application shape but with LAEC own vocabulary', 'Reversed D-11 and D-61 on the client instruction of 2026-09-30: build it the same way saintfinbarrs does. The vocabulary is `module.action` — 28 codes covering dashboard, students, questions, results, exam, notices, calendar, notifications, review, admins, staff and system — and deliberately not theirs, because their 121 codes describe a store, wallet, fees and counselling app LAEC does not have. Six roles each declare a default grant set in ROLE_DEFAULT_PERMISSIONS; SUPER_ADMIN is declared as an empty set that bypasses the check, which is the reference application own encoding of a superuser and keeps the bypass predicate readable rather than hidden behind a long list of codes. effectivePermissions unions those defaults with any read back from the session, and the predicates in lib/permissions are the single vocabulary: nav, render and transport all ask the same function. Enforcement has three legs. The rail is filtered by filterNav so a role is only offered what it holds. Every write goes through one gate in callApi placed over all 38 POST actions — 38 of 38 mapped, and an unmapped action fails closed rather than open — with the privileged controls additionally v-if gated so the user is not invited to click a button that would be refused. The six consoles declare their role in router.beforeEach, so an operator without that role is returned to /control/, the redirect the origin already used for a rejected SUPER_ADMIN (RF-3). Reads are gated by navigation instead of by route, which is what the reference application does: you cannot reach a page you were never offered. The session is a Pinia store (closing D-45) refreshed by GET_MY_PERMISSIONS, which resolves the role from the admin roster rather than from the request, so a claim edited in devtools is corrected and written back to storage on the first sync; sync runs on every navigation, on visibility change and every 30 seconds, so a grant change reaches the rail without a re-login. One deviation from the reference is recorded: it confines a superuser to one console, but /admin/ is not a superset of the six — /ca/ owns Registration Portal and Examination Center — so SUPER_ADMIN is exempt from the guards instead. Two defects surfaced while wiring this and are fixed: the consoles re-applied a persisted tab from an element id `tab-<panel>` belonging to the origin horizontal tab strip that the 2026-09-29 redesign removed, so that restore path had silently always fallen back to the default panel, and the pending-panel handoff from a shared page now writes the console own restore key so the two cannot race. The School group Notice Board id also changed to `notice-board` to stop the label colliding with the teacher Decisions panel id', '2026-09-30'],
  ['D-72', 'The body surface and page class follows the route', 'Found because the notice board was disrupting the dashboard and the sidebar. Each of the twelve pages is its own HTML entry (D-01) and each entry declares a static `<body class="surface-X page-Y">`; nothing ever rewrote it, so Vue Router moving between those routes without reloading left the class set by whichever document the session opened on. Every per-page stylesheet is gated on exactly that pair - `styles/ca-page.css`, `admin-page.css`, `comm-page.css`, `ict-page.css`, `glass.css`, and the Calendar, Notices, Central and Teacher views - so after a client-side navigation the gates failed quietly. Opening Notice Board from the school console therefore applied the console rules to the notice board and none of its own: its header band spanned the sidebar, its search field stretched the full width, its chips and WITHDRAW buttons lost their styling and the title was invisible against the band. The same failure ran in reverse and hit the consoles, so a dashboard opened after a notice board was the damaged one. Fixed with one `router.afterEach` that mirrors the twelve `<body>` tags one for one and replaces only the `surface-*` and `page-*` families, leaving any class another feature put on the body alone; a route with no entry keeps what it has rather than being blanked. Verified in the browser: fresh loads of all twelve routes carry the expected class (and /exam/ picking up `page-login` when RF-2 redirects it there), and a client-side chain from /ca/ of Notice Board, Calendar, Overview, Notice Board, Calendar steps through page-notices, page-calendar, page-ca in order, each rendering correctly with zero console errors', '2026-09-30'],
  ['D-73', 'Legibility and layout polish: every text run clears WCAG AA, and content cards lay out as content', 'Client instruction of 2026-09-30 to make the whole UI neat and very visible; scope agreed as legibility plus polish, keeping the COLOUR-SPEC palette and leaving the layout redesign alone. Audited first rather than guessed at: a computed-style pass over all eleven content routes found 58 WCAG AA contrast failures and a further 56 text runs sitting over gradients the audit could not measure, with zero horizontal overflow anywhere. The dominant failure was systemic - `.rail-group-title` at 3.61:1 on the dark rail, on every console, 35 of the 58. The worst visible one was the console hero: `.surface-enterprise .app-main h2` was repainting every heading `--app-n800` (#1f2633), which overrode the `color: white` that `.control-box` itself declares, so "School Performance Summary" rendered dark on a dark gradient on /ca/, /ict/ and /comm/ while the paragraph beneath it, which did carry a colour, stayed readable. Fixed at the source rather than in four stylesheets: `.control-box h2, h3` now take `color: inherit`, so the dark hero resolves white and the light toolbar variant on /central/ and /teacher/ still resolves the body colour. The footer copyright measured 2.68:1 and the rail labels 3.61:1; both greys were lightened/darkened to clear AA. Two COLOUR-SPEC values were adjusted where the spec itself was the cause, as approved: `--success` #11895f to #107855 and `--danger` #c44444 to #b83c3c, which were failing at 4.40:1 white-on-fill and 4.21:1 on the badge tint and now measure 5.47:1 and 5.60:1 on their fills, with the amber badge text likewise taken to #8a6104. The neatness half was one root cause in AppShell: `.app-main .card` shared a rule with `.app-main .control-box` and so gave every card a toolbar layout - flex row, space-between, wrap. `.card` is a content container throughout (headings, paragraphs, grids, tables) while the toolbars already have their own `.control-box` and their own `.overview-card-header` and `page-head`, so the shared rule tore the notice cards apart: meta, title, body and footer were laid out as a wrapping row, which put the title, body and metadata of a short notice on a single line and wrapped long ones differently, so no two notice cards matched. The rule is now split - control-box keeps the row, card stacks with the same 14px rhythm. Two more followed from the same audit: the promotion alert lives inside `.stats-grid` on /ca/, /ict/ and /comm/ and, carrying a sentence against its siblings label-and-figure, it stretched the whole row and left every stat card a tall near-empty box with the fifth card orphaned on its own row; it now spans the grid as the last row, which leaves the four figures level at 112px. And the breadcrumb read "School Administration / Overview / Overview" because the rail group and its active item share a title - the group crumb is now suppressed when it equals the leaf, so it reads "School Administration / Overview" while /central/ keeps all three crumbs where they differ. Verified in the browser: the computed-style pass now reports 0 contrast failures on all twelve routes, the hero h2 measures rgb(255, 255, 255) on all four consoles, notice-card children stack at four distinct y positions, the stats grid holds four level cards plus a full-width alert, horizontal overflow is 0 at 390, 768 and 1440, and there are zero console errors. `npx vue-tsc --noEmit`, `tools/check-rbac.mjs` and `npx vite build` all clean', '2026-09-30'],
  ['D-74', 'One chrome that renders identically on all six consoles, and popups that never leave their own box', 'Client instruction of 2026-09-30: restructure the whole UI so no dropdown or popup disrupts the background or looks unappealing, so it feels professional, and so every text and icon is well placed and visible. Scope agreed as five phases. Phase one was the layer scale: `styles/layers.css` declares fifteen `--z-` tokens in strict ascending order and every z-index in the codebase was mapped onto them — 68 declarations, 63 tokenised and 5 left at `auto` — with the two floating utilities demoted from 900/1200 to `--z-furniture` 150 so they can never paint over the top bar, and `--z-modal` 850 kept above `--z-loading` 800 so a dialog is never hidden behind a spinner. Phase two was the popups: the account menu and the notification panel were anchored inside their triggers, where their z-index could not beat page content and no viewport narrower than the panel had an answer, so both are now teleported to `<body>` as `position: fixed` and placed from measured rects — mutually exclusive, Escape and outside-click dismissible, focus returned to the trigger. Phase three consolidated the dialogs: AppAlert and AppLoading own their overlay, backdrop, box, button row and tokens, which is what let eight routes drop their hand-copied alert markup and what makes `!important` on `background`, `backdrop-filter` and `z-index` a narrow documented exception rather than a scattergun, because the competing rules are selectors like `body.surface-enterprise.page-calendar #custom-alert { backdrop-filter: blur(10px) }` and no specificity-only fix survives that. Phase four is where the real defect was. The four origin consoles carry blanket element rules — `.page-ca button`, `.page-ca input, .page-ca select`, `.page-ca label`, `.page-ca header` — transcribed from pages that had no application shell, written for content controls and matching every button, input, label and header the shell renders. Measured side by side at 1440 the same chrome painted two ways: the rail item 44px at font-weight 800 with 0.04em tracking against the designed 36px/500; the account trigger 50px with `border: none` and a 14px radius against a 34px pill with a 1px border at radius 999; burger and bell 44px wide against 32px; the search field 51px tall with a 15.2px bold uppercase placeholder and a 7.2px bottom margin inside a 60px bar, against 32px. Two of those were functional rather than cosmetic: `.bell-item` is itself a button, so the origin `border: none` removed the 3px left stripe that `.bell-item.exam`, `.results` and `.security` only supply a colour for, and the category coding disappeared on four consoles; and `.page-ca header` sets `position: fixed; top/left/right: 0`, which put the notification panel own header across the viewport as a gradient masthead with "Mark all read" stretched to the 1440px window and clipped out of its 400px panel, while `.rail-collapse` lost its divider and `.bell-readall` went from 97px to 1393px. The fix is a fence in AppShell rather than an edit to transcribed material: `body button.rail-item` is (0,1,2), above `.page-X button` at (0,1,1) and below `.mode-icons .rail-item` and `.rail-collapsed .rail-item` at (0,2,0), so the collapsed and icon-only rail keep winning their own padding — that bracket is the whole reason for the `body button.` form, and `body:has(.app-shell) .rail-item` would have flattened both. `transform` needed its own pass at (0,2,2) because `.page-X button:hover` sits at (0,2,1) and was lifting chrome by 1px under the pointer. Box sizing is scoped to `.app-rail`, `.app-topbar` and the two teleported panels rather than reset globally, because a blanket `*` would also re-box `.app-main` and every view inside it: only the four console sheets ship `.page-X * { box-sizing: border-box }`, so Central and Teacher were laying the shell own `width: min(400px, ...)` in content-box — panel 402px, account menu 230px instead of 216px, rail a pixel wide. One regression the first pass of the fence caused is recorded because it names the general hazard: `body label.topbar-search { display: flex }` outranked the shell own `@media (max-width: 900px) { display: none }`, so the 190px search stayed on a phone, `.topbar-tools` needed 387px, and because the grid `1fr` track carries `min-width: auto` the track expanded to 533.8px and the page rendered 534px wide inside a 390px viewport — measured as 144px of overflow on /calendar/ and 167px on /notices/, neither of which has content that is too wide. Both responsive rules are restated at fence specificity and `grid-template-columns` is now `auto minmax(0, 1fr)`, so no future wide element can warp the frame either. Two last items are small and deliberate: `.account-name` and `.crumb-leaf` carry `:title`, because the two spans allowed to ellipsis are the signed-in operator and the current page and they were truncating silently; and the menu icon dropped 20px to 18px so the chrome uses one scale — 18 for primary, 16 for utility, 14 for the caret — instead of 20 being the only outlier. Verified with a sweep of twelve routes at 390, 768 and 1440: 84 assertions including 48 popup checks, each asserting the popup rect is inside the viewport, the topmost element at its centre is inside it, z-index 700 and position fixed, zero horizontal overflow with the popup open, and the top bar, main region, rail rects and page height byte-identical to before it opened — 0 failures, 0 console errors. Chrome computed styles are identical across all six consoles, the collapsed rail still measures `9px 0`, hover changes background without moving anything, and `vue-tsc`, `check-rbac.mjs`, `check-layers.mjs` and `vite build` are all clean', '2026-09-30'],
].forEach(r => L.push(`| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} |`));
L.push('');
L.push('## Deviations log');
L.push('');
L.push('| # | Deviation | Reason | Approved |');
L.push('|---|---|---|---|');
L.push('| DEV-1 | Cloudflare Web Analytics and Cloudflare Bot Management script tags omitted from all pages | No beacon token available; stack rule bars unapproved dependencies (D-16) | Yes, 2026-09-28 |');
L.push('| DEV-2 | The origin\'s uncaught "Missing active exam session." console error does not appear on an unauthenticated `/exam/` visit | RF-2 is enforced by `router.beforeEach`, which redirects before `ExamView` mounts; the view keeps the origin check (D-29) but it is unreachable while the router intercepts. PRD RF-2 specifies the redirect only | Yes, 2026-09-28 |');
L.push('| DEV-7 | `loadICTAdmins` is declared twice in `ca.html` (lines 3549 and 3582); the second declaration wins at parse time | Only the second body is served, so the internal-admin table shows the real Role and Status and the PROTECTED revoke branch. The origin behaves the same way | Yes, 2026-09-29 |');
L.push('| DEV-8 | The cloud heartbeat on `/ca/` measures a public asset request instead of the live students endpoint | The origin pings its own API and reports the round trip against a 500 ms threshold; an `Image` load keeps the measurement out of CORS while preserving the figure and the threshold (/admin/` thresholds at 400 ms). Same deviation already recorded for `/admin/` | Yes, 2026-09-29 |');
L.push('| DEV-9 | The registration portal posts to a non-routable mock host | `LAECRegistration` calls `fetch(registerEndpoint)` directly, with no seam to inject the mock. The whole portal therefore renders, validates and submits, and the origin error path handles the response; no real registration is ever sent | Yes, 2026-09-29 |');
L.push('| DEV-10 | PRD 4.6 names a canvas `dashboard-register-canvas` for the passport capture; the first-party `/dashboard-registration.js` renders `dashboard-register-video` / `-preview` / `-placeholder` instead | Origin wins: the library is served unmodified (D-03) and its own markup is what appears | Yes, 2026-09-29 |');
L.push('| DEV-11 | `syncResultFiltersWithConfig` writes `#script-year` / `-term` / `-category` / `-mode` on `/ca/`, and no such elements exist on the page | Kept as the origin four inert writes; the `#res-*` half of the function is live | Yes, 2026-09-29 |');
L.push('| DEV-12 | The /ict/ document title is \"LAEC | School Admin Portal\" - the same string /ca/ serves | PRD D14 flags it as an origin defect; reproduced verbatim so the two documents are indistinguishable by title, as they are today | Yes, 2026-09-29 |');
L.push('| DEV-13 | `updateExamGlobal` on `/comm/` returns a \"Restricted\" alert on its first statement, which makes the rest of the function unreachable, and no control on the page calls it | Replicated as the origin own dead code; the queue card button is REFRESH PAPER QUEUE instead. Not replaced with a working sync path the origin does not have | Yes, 2026-09-29 |');
L.push('| DEV-14 | The `/comm/` exam committee has no result-deletion path: DELETE FILTERED FLAGGED RESULTS is replaced by FLAGGED RESULTS VIEW ONLY | PRD 4.8 requirement, not a deviation from the capture; recorded here because the origin keeps `DELETE_FLAGGED_RESULTS` in the shared action list even though this page never calls it (PRD D21) | Yes, 2026-09-29 |');
L.push('| DEV-15 | SUPERSEDED by D-60. The first-party /admin-sidebar.css sizes .main-content with `width: calc(100vw - var(--laec-sidebar-width))` while no stylesheet resets the body margin, which made all four consoles scroll 8 px horizontally at 1440 px. The AppShell sizes its own content well with `width: 100%` and `box-sizing: border-box` and no longer relies on that rule, so the scroll is gone | Resolved 2026-09-29: measured 0 px of horizontal overflow on /admin/, /ca/, /ict/ and /comm/ at 1440, 768 and 390 after the redesign. The origin still carries the defect; this build no longer inherits it |');
L.push('| DEV-3 | PRD RF-73 (per-row answer-script viewing, printing and cloud re-fetch) is unreachable on the origin: `viewResultScript`, `printResultScript` and `refreshResultScriptFromCloud` exist in `admin.html` but the results table renders no action cell, so nothing can call them | Ported as unreachable origin code rather than inventing the missing UI; the fixtures do carry an `AnswerScript` for them to read | Yes, 2026-09-28 |');
L.push('| DEV-4 | PRINT PDF on `/admin/` calls `downloadResultsPDF()`, which the origin never defines \' the click raises an uncaught error and the UI does nothing | Replicated (D-34) instead of substituting a jsPDF export the origin does not have | Yes, 2026-09-28 |');
L.push('| DEV-5 | The `/admin/` paper queue (`LAECExamSession.init` and the Refresh / Select All / Clear All controls it renders) is not started | The first-party library targets the live `AWS_CONFIG.getStudentsEndpoint` and this audit build must not call the real backend. The other three first-party modules are served and wired exactly as on the origin | Yes, 2026-09-28 |');
L.push('| DEV-6 | *Superseded 2026-09-29 (see D-46): the question manager is not absent from the origin, it was absent from this build* | Earlier this log recorded that PRD RF-79 has no counterpart in the capture, because a search for `#question-manager-card` in `admin.html` returned nothing. That was the wrong inference: `/question-management.js` creates that card at runtime and self-initialises on DOMContentLoaded, so it never appears in the static markup. The library is present and working on all four consoles, and the gap was this build own load-order bug, now fixed | Yes, 2026-09-28 |');
L.push('| DEV-16 | D-11 and RF-95 said no client-side role guards, and D-61 said the role-filtered navigation was presentation only; D-71 (2026-09-30) reverses both on the client instruction to build RBAC the way the reference application does | Superseded by D-71 rather than quietly edited: the six consoles now declare their role in `router.beforeEach` and return a role without it to `/control/`, and the writes go through a gate in `callApi`. The spirit of RF-95 is kept where it matters - an unknown or missing role is not invented an error page, it is redirected to the sign-in shell, and a permission the mock cannot decide fails the call rather than pretending the operation happened. Logged here because PRD v1.2 itself still records the origin behaviour in D-11/RF-95; the PRD was not edited | Approved, 2026-09-30 |');
// The deviation rows are pushed in the order they were discovered; sort them so
// the log reads numerically, the way the decision ledger above does.
{
  const first = L.findIndex(line => line.startsWith("L.push('| DEV-"));
  const last = L.reduce((acc, line, index) => (line.startsWith("L.push('| DEV-") ? index : acc), -1);
  if (first >= 0 && last > first) {
    const block = L.slice(first, last + 1);
    block.sort((left, right) => {
      const num = line => {
        const parts = line.split('DEV-');
        return parts.length > 1 ? Number(parts[1].split(' ')[0]) : 0;
      };
      return num(left) - num(right);
    });
    L.splice(first, block.length, ...block);
  }
}

L.push('');
L.push('## Checklist');
L.push('');
L.push(`### A. Pages and routes (${routes.length + 1} items)`);
L.push('');
/* The two addendum pages carry their verification note in the page row too. */
const ADDENDUM_PAGE_NOTE = {
  '/teacher/': 'built and verified 2026-09-29: three tabs (My Papers, Compose, Decisions), TEACHER identity, a per-status tally, a ten-column composer with per-row and group removal, and the decision notices list. 751 characters of content, no console errors. Not an origin page (D-56)',
  '/central/': 'built and verified 2026-09-29: three tabs (Review Queue, Question Bank, Staff), CENTRAL_ADMIN identity, a queue with per-state counts, per-row and group accept/reject, an in-panel rejection reason, and cross-school staff onboarding. 627 characters of content, no console errors. Not an origin page (D-56)',
};
routes.forEach(([u, t, p]) => {
  if (ADDENDUM_PAGE_NOTE[u]) {
    L.push(`- [x] verified — **${u}** — "${t}" — ${p} — ${ADDENDUM_PAGE_NOTE[u]}.`);
  } else {
    L.push(`- [ ] not started — **${u}** — "${t}" — ${p}`);
  }
});
L.push('- [ ] not started — **/admin** (no trailing slash) serves `/admin/` — alias behaviour');
L.push('');
L.push(`### B. Page blocks, controls and behaviours (PRD §4) — ${groups4.reduce((a, g) => a + g.items.length, 0)} items`);
L.push('');
groups4.forEach(g => {
  L.push(`- [ ] not started — **${g.head}**`);
  g.items.forEach(it => L.push(`  - [ ] not started — ${it}`));
});
L.push('');
L.push(`### C. Shared cross-page components (PRD §4.9) — ${shared.length} items`);
L.push('');
shared.forEach(s => L.push(`- [ ] not started — ${s}`));
L.push('');
L.push(`### D. Flows (PRD §5) — ${flows.length} items`);
L.push('');
flows.forEach(f => L.push(`- [ ] not started — **${f.split(' — ')[0]}** — ${short(f.split(' — ').slice(1).join(' — '), 120)}`));
L.push('');
L.push(`### E. Requirements RF-1…RF-109 — ${inScopeRF.length} items`);
L.push('');
inScopeRF.forEach(r => {
  const defect = DEFECT_RF.has(r.n) ? ' **[DEFECT — replicate as observed, D-' + ({ 6: '06', 29: '07', 60: '08', 63: '09', 67: '10', 95: '11', 106: '12' }[r.n]) + ']**' : '';
  L.push(`- [ ] not started — **${r.id}**${defect} — ${short(r.text)} _[spec: ${r.spec}]_`);
});
L.push('');
L.push('### F. Colour and typography (COLOUR-SPEC.md, by surface) — generated 2026-09-28, cross-checked 95/95 vs colors.md');
L.push('');
L.push('- [ ] not started — Generate COLOUR-SPEC.md from LAEC-Colour-Spec.pdf (pdf-parse) — D-02');
L.push('- [ ] not started — Glass surface tokens (`/`, `/login/`, `/control/`) — one line per token, gradient, background stack, radius, font');
L.push('- [ ] not started — nj surface tokens (`/exam/`) — as above');
L.push('- [ ] not started — Enterprise surface tokens (`/admin/`, `/ca/`, `/ict/`, `/comm/`) — as above');
L.push('- [ ] not started — Typography inventory (Inter 400/600/800; Manrope + Space Grotesk 5 weights; exam system stack)');
L.push('');
L.push(`### G. First-party assets (PRD §3.3) — ${assets.length} items`);
L.push('');
assets.forEach(a => L.push(`- [ ] not started — \`${a.path}\` (${a.bytes} B) — ${a.purpose}`));
L.push('');
L.push(`### H. Third-party dependencies (PRD §3.4) — ${deps.length} items`);
L.push('');
deps.forEach(d => L.push(`- [ ] not started — **${d[0]}** ${d[1] ? `(${d[1]})` : ''} — source ${d[2]} — ${d[3]} — ${short(d[4], 90)}`));
L.push('');
L.push(`### I. Page verification runs — ${routes.length} items`);
L.push('');

/*
 * The two addendum consoles are not origin pages, so the "vs the live original"
 * and "computed styles vs COLOUR-SPEC" steps have nothing to compare against.
 * They are verified against the mock instead, and the row says so rather than
 * claiming a comparison that was never made (D-56).
 */
const ADDENDUM_NOTE = {
  '/teacher/': 'not an origin page, so the playwright-vs-live and computed-style-against-COLOUR-SPEC steps do not apply (D-56). Verified 2026-09-29 against the mock: TEACHER sign-in routes here, the draft -> submit -> review -> decision cycle was driven end to end (draft SUB-0006 saved, submitted, accepted, notice raised), and the page holds the viewport at 390, 768 and 1440 with zero horizontal overflow (D-59)',
  '/central/': 'not an origin page, so the playwright-vs-live and computed-style-against-COLOUR-SPEC steps do not apply (D-56). Verified 2026-09-29 against the mock: CENTRAL_ADMIN sign-in routes here, the queue was worked three ways (individual accept, group accept of two, rejection with a required reason), staff onboarding created an account in school 003, and the page holds the viewport at 390, 768 and 1440 with zero horizontal overflow (D-59)',
};
routes.forEach(([u]) => {
  if (ADDENDUM_NOTE[u]) {
    L.push(`- [x] verified — verify **${u}** — ${ADDENDUM_NOTE[u]}.`);
  } else {
    L.push(`- [ ] not started — verify **${u}** — playwright vs live original, computed styles vs COLOUR-SPEC.md, responsive 390/768/1440, mocked API`);
  }
});
L.push('');
L.push('### J. Excluded by scope (D-04) — recorded, not built');
L.push('');
L.push(`- Requirements: ${outScopeRF.join(', ')}`);
L.push('- Use cases: UC-11, UC-12, UC-13');
L.push('- Open questions: Q24, Q25, Q26, Q27, Q28');
L.push('- Recommendations: REC-41, REC-42, REC-43 (and all of §11 per the brief)');
L.push('');
L.push('### K. Foundation (Phase 2.0) — scaffold, types, mock, composables');
L.push('');
for (const f of FOUNDATION) L.push(`- [ ] not started — ${f}`);
L.push('');
L.push('## Verification log');
L.push('');
L.push('| Page | Date | Layout | Copy | Colours | 390 | 768 | 1440 | Result |');
L.push('|---|---|---|---|---|---|---|---|---|');
routes.forEach(([u]) => L.push(`| ${u} | | | | | | | | not run |`));
L.push('');
L.push('## Coverage totals');
L.push('');
L.push(`- Checklist lines: ${routes.length + 1 + groups4.reduce((a, g) => a + g.items.length, 0) + groups4.length + shared.length + flows.length + inScopeRF.length + assets.length + deps.length + routes.length + 5 + FOUNDATION.length}`);
L.push(`- Pages: ${routes.length + 1} · Blocks/controls: ${groups4.reduce((a, g) => a + g.items.length, 0)} · Shared: ${shared.length} · Flows: ${flows.length} · RF: ${inScopeRF.length} · Assets: ${assets.length} · Dependencies: ${deps.length}`);
L.push('');

// Idempotent regeneration: carry over each line's status (and any notes
// appended to it) plus verification-log rows from the previous BUILD-LOG,
// keyed by the line description / page. Matching is prefix-based because a
// human-edited line keeps the generated description and appends to it.
let previous = '';
try {
  previous = fs.readFileSync(OUT, 'utf8');
} catch {
  /* first run */
}

if (previous) {
  const prevChecklist = new Map();
  const prevVerify = new Map();
  for (const line of previous.split('\n')) {
    const c = /^(\s*)- \[( |x)\] (not started|in progress|done|verified) — (.*)$/.exec(line);
    if (c && !prevChecklist.has(c[4])) prevChecklist.set(c[4], c);
    const v = /^\| (\S+) \|/.exec(line);
    if (v && v[1] !== 'Page' && !prevVerify.has(v[1])) prevVerify.set(v[1], line);
  }
  for (let i = 0; i < L.length; i++) {
    const c = /^(\s*)- \[ \] not started — (.*)$/.exec(L[i]);
    if (c) {
      for (const [desc, p] of prevChecklist) {
        if (desc.startsWith(c[2])) {
          L[i] = `${p[1]}- [${p[2]}] ${p[3]} — ${p[4]}`;
          break;
        }
      }
      continue;
    }
    const v = /^\| (\S+) \|/.exec(L[i]);
    if (v && prevVerify.has(v[1])) L[i] = prevVerify.get(v[1]);
  }
}


/* ── Exam-management addendum (D-53…D-59) ───────────────────────────────
 * A second requirements list, supplied 2026-09-29 and separate from PRD v1.2.
 * Items marked "already built" were verified in the earlier passes; the rest
 * were designed and built for the addendum and are not origin behaviour.
 */
const addendum = [
  ['AM-1', 'verified', 'The system shall have Super Admin and Central Admin roles',
   'SUPER_ADMIN routes to /admin/ as before; CENTRAL_ADMIN routes to /central/ and reads every school queue and the whole staff directory, which is the "above the school consoles" scope. Both checked by sign-in in the browser on 2026-09-29.'],
  ['AM-2', 'verified', 'The system shall have roles and permissions',
   'built 2026-09-30 under D-71. A 28-code `module.action` vocabulary, six role default grant sets, effectivePermissions, a permission carried by every nav entry, one transport gate over all 38 POST actions (unmapped writes fail closed), privileged controls gated at render, and route guards on all six consoles. Authorisation is still the backend job in production; what was added is that the client is honest about what it will not let you do instead of drawing a button and accepting the write. Earlier states of this row - "no client-side guards were added" (D-11) and "role-filtered navigation blocks nothing" (D-61) - are superseded by D-71.'],
  ['AM-3', 'done', 'The system shall support a multi-tenant architecture',
   'per-school scoping was already in place (D-43, D-44); the addendum adds cross-school reads for the Central Admin (GLOBAL scope returning every school) and staff onboarding into any of the ten school codes. No tenant onboarding or tenant administration was invented.'],
  ['AM-4', 'verified', 'The Central Admin shall be able to onboard their staff',
   '/central/ Staff tab onboards a named account into any school: "Mrs Adesuwa Bello" / teacher3 / TEACHER / school 003 was created, the directory went 8 to 9 rows, and the account is usable in the directory the four consoles read.'],
  ['AM-5', 'verified', 'Teachers shall be able to create and save questions as drafts',
   'on /teacher/ a question is written in the composer and SAVE DRAFT creates SUB-0006 with status DRAFT and the message "It is not live." A second draft (SUB-0005, MUSIC JSS1) ships pre-seeded so the empty state is never the only state.'],
  ['AM-6', 'verified', 'A submitted question paper shall not go live immediately',
   'SUBMIT FOR REVIEW moved SUB-0006 to PENDING_REVIEW with "Sent for Review" and it did not appear in any live question read.'],
  ['AM-7', 'verified', 'Submitted questions shall go to a review team for approval',
   'the /central/ Review Queue listed SUB-0002, SUB-0003 and SUB-0006 as awaiting a decision, with per-state counts.'],
  ['AM-8', 'verified', 'The review team shall be able to accept a submission, making the questions live',
   'accepting SUB-0006 moved it to LIVE (In review 3 to 2, Live 1 to 2) and its questions are prepended to the served question set for that coordinate, so a candidate in it sits them. Re-checked after the 2026-09-29 redesign: accepting SUB-0002 moved Live 1 to 2.'],
  ['AM-9', 'verified', 'The review team shall be able to reject a submission, leaving the questions unpublished',
   'rejecting SUB-0002 moved it to REJECTED and its questions were not published. A rejection without a reason is refused: "A rejection needs a reason for the teacher."'],
  ['AM-10', 'verified', 'The submitting teacher shall be notified when their submission is accepted or rejected',
   'the Decisions tab showed the decision, the reason and an unread marker - teacher one saw ACCEPTED / SUB-0002 and teacher two saw ACCEPTED / SUB-0003 from one group accept, and a rejection shows the reviewer reason verbatim. A decision also fires SEND_QUESTION_DECISION_EMAIL, mirroring how the origin notifies (D-58).'],
  ['AM-11', 'verified', 'The system shall be able to prevent and undo promotion',
   'already built before the addendum: the /ca/ Promotion Exception Manager runs EXECUTE_PROMOTION individual and batch, and the demotion register (GET_DEMOTION_LOGS) is the undo record.'],
  ['AM-12', 'verified', 'A live exam shall become inactive once its scheduled time elapses',
   'already built before the addendum: in the sitting exam a paper EndTime becomes the hard cut-off and reaching it auto-terminates with "Exam Window Closed" (RF-43); in the hallway a paper past its window drops out and the no-active-examination panel appears (RF-19, checked in both directions).'],
];

/* ── Role-console redesign (D-60…D-63) ───────────────────────────────────
 * The client judged the six role consoles dated and asked for a modern design
 * across all roles. Approved scope: one app shell, one token contract,
 * domain-grouped per-role navigation, and a deliberate departure from the
 * per-console colours COLOUR-SPEC pins. The four non-role surfaces are not in
 * scope and are unchanged.
 */
const redesign = [
  ['RED-1', 'verified', 'AppShell applied to all six role consoles',
   'each console gradient header and flat tab strip were replaced by the shared shell. Rail entry counts match each view panel count exactly (7/7 /admin/, 8/8 /ca/, 7/7 /ict/, 6/6 /comm/, 3/3 /teacher/, 3/3 /central/), the breadcrumb reads role then domain then section, the scope chip reads GLOBAL for the two cross-school roles and the school code for the other four, and every route returns 200 with no console errors.'],
  ['RED-2', 'verified', 'All 37 panels survive the chrome rewrite',
   'every rail entry was clicked and observed to drive its own panel, and /ca/ still initialises the first-party question manager (window.LAECQuestionManager is an object, manager card renders) together with the paper queue. The /central/ review loop was re-run end to end after the rewrite.'],
  ['RED-3', 'verified', 'Per-role navigation, now also a guard',
   'each role is handed its own section list from src/lib/nav.ts, as on 2026-09-29. From D-71 (2026-09-30) the same list also gates: a role without a console is returned to /control/ by router.beforeEach, a write it does not hold is refused by the gate in callApi, and the rail only offers entries the session holds. Verified in the browser - TEACHER onto /ca/ and /admin/ both bounced, SCHOOL_ADMIN and SUPER_ADMIN onto /ca/ both stayed, a no-session hit on /central/ and /calendar/ both bounced. This supersedes the earlier version of this row, which recorded D-11 as unchanged.'],
  ['RED-4', 'verified', 'All 37 tab labels are the origin own text',
   'only the grouping and the order changed. The /ca/ results section still reads School Results and the /admin/ one still reads Results Center - they are different labels in the origin and stay different here.'],
  ['RED-5', 'verified', 'Responsive at 390 / 768 / 1440 on all six roles',
   '0 px of horizontal overflow on every role at every width, with the rail in its three modes: full at 1440, a 68 px icon rail at 768, an off-canvas drawer at 390.'],
  ['RED-6', 'verified', 'DEV-15 resolved',
   'the 8 px horizontal scroll the first-party admin-sidebar.css caused is gone on all four origin consoles, because the shell sizes its own content well rather than relying on the 100vw rule. The origin still carries the defect; this build no longer inherits it.'],
  ['RED-7', 'verified', 'The four non-role surfaces are untouched',
   '/, /login/, /control/ and /exam/ carry no shell, #app keeps display: contents on them, and their rendered content is unchanged at 622, 233, 128 and 1787 characters respectively with 0 px overflow. The three surface stylesheets (glass, enterprise, nj) are untouched.'],
  ['RED-8', 'not started', '20 px top offset on the four origin consoles',
   'OPEN. The shell renders 20 px lower on /admin/, /ca/, /ict/ and /comm/ than on the two addendum consoles. Everything else is geometrically exact (rail 248 px, top bar 60 px, main at x=248). Candidate causes tested and ruled out: the body padding and margin are 0, #app computes display: contents, the bubble layer is display: none, and the wrapper is a flex column. The offset therefore comes from something in the transcribed origin stylesheets that this build has not yet identified. Cosmetic, affects only the four replica consoles, moves no panel and causes no overflow.'],
];


/* ── features carried over from the reference application (D-64) ---------
 * Verified in the browser on 2026-09-29 against the mock. The reference
 * application itself returned 401 on every data call, so its behaviour was
 * never observed working and only its structure was taken.
 */
const carried = [
  ['D64-1', 'The reference application was walked, feature by feature',
   'five areas found - Dashboard/Quick Access, Messaging, Notice Board, Academic Calendar and a Notification Centre with category filters. Every data call returned 401 Authentication required, so only the UI structure and the API surface (/api/notifications, /api/academic/calendar, /api/communication/notices, /api/communication/conversations) were observed, never working behaviour. Re-checked on 2026-09-30 and unchanged'],
  ['D64-2', 'Notification centre in the shell top bar',
   'bell with unread badge on all six role consoles; badge read 3 for CENTRAL_ADMIN and 4 for the teacher after a review decision. Panel opens with the All/Unread filter tabs and per-category counts (All 6, Unread 3, Review 1, Exams 2, Results 1, Notices 1, Security 0, System 1)'],
  ['D64-3', 'Per-account and per-role addressing is correct',
   'the Security item is addressed to teacher@nicegeneco.com and the Security count read 0 for CENTRAL_ADMIN and non-zero for that teacher, which is only possible if the addressing is real rather than a flat list'],
  ['D64-4', 'Mark one and mark all as read are real API calls',
   'mark all as read cleared the badge to none, left 0 unread items and disabled its own button, and the state survived a page reload because it is part of the persisted session state'],
  ['D64-5', 'A review decision reaches the author bell',
   'the Central Admin accepted SUB-0002 from the review queue and the author bell then listed SUB-0002 was accepted under REVIEW. The same decision already appears in the author Decisions tab, so the workflow and the centre are one system (D-67)'],
  ['D64-6', 'Academic calendar, all four view modes',
   'Monthly (35 day cells, event chips, today highlighted), Weekly (7 columns, one marked today, 4 chips in the current week), Yearly (12 month tiles with counts: September 4, October 3, December 1) and Agenda (8 rows split Upcoming 5 / Past 3). Selecting a row opens the detail with the date, the window and the session'],
  ['D64-7', 'Exam windows are visible as windows',
   'the SSS2 First Term Examination reads 29 Sep 2026, 08:00 to 15:00, Today - which is the live paper EndTime the sitting exam enforces as its hard cut-off, shown on a calendar for the first time'],
  ['D64-8', 'Calendar add and remove, scoped to the two publishing roles',
   'a Super Admin added Chief Examiner briefing (added) and the count moved 0 to 1; an event with no title is refused. The remove control is present only for SUPER_ADMIN and CENTRAL_ADMIN'],
  ['D64-9', 'Notice board: publish, search, withdraw',
   'Central Admin sees 5 notices with 2 pinned; an empty notice is refused with Incomplete notice; publishing to Teachers reported published to teachers and took the board to 6; searching invigilator narrowed to 3 and a nonsense term produced No notice matches that search'],
  ['D64-10', 'Notice audience is honoured and publishing is a privilege',
   'a notice published to Teachers appeared in the teacher read (3 notices); the teacher page has no publish control and no withdraw button, while the Central Admin page has both'],
  ['D64-11', 'The two new surfaces are responsive',
   '0 px of horizontal overflow on /calendar/ and /notices/ at 390, 768 and 1440, in every calendar view mode, with the rail in its three modes and the bell panel fitting a 390 px viewport. A 37 px overflow at 390 was found and fixed by giving the day cells and their chips min-width 0 and the grids minmax(0, 1fr)'],
  ['D64-12', 'Messaging deliberately not built',
   'examined in the browser and left out. LAEC has no parent or guardian role, so the reference application chat has no counterpart audience, and messaging candidates families is PII, moderation and audit territory on an examination portal. Recorded as D-70 so the omission is a decision and can be revisited knowingly'],
  ['D64-13', 'Calendar events are all-day or timed, and dates are compared locally',
   'term boundaries and holidays are all-day, examination windows are timed and show their real start and cut-off. Dates are parsed and compared as local dates, so a window cannot drift a day against the candidate hall the way a UTC parse would. Not carried further: the reference application had no timezone setting visible'],
];

L.push('');
L.push('### L. Exam-management addendum (D-53…D-59) — ' + addendum.length + ' items');
L.push('');
addendum.forEach(([id, st, req, note]) => {
  L.push(`- [${st === 'verified' ? 'x' : 'x'}] **${id}** — ${req} — ${note}`);
});
L.push('');
L.push('### M. Role-console redesign (D-60…D-63) — ' + redesign.length + ' items');
L.push('');
redesign.forEach(([id, st, title, note]) => {
  L.push(`- [${st === 'verified' ? 'x' : ' '}] **${id}** ${title} — ${note}`);
});

L.push('### N. Features carried over from the reference application (D-64\u2026D-70) — ' + carried.length + ' items');
L.push('');
carried.forEach(([id, title, note]) => L.push(`- [x] verified — **${id}** ${title} — ${note}`));
L.push('');

/* ── RBAC (D-71) ─────────────────────────────────────────────────────────
 * Verified in the browser against the mock on 2026-09-30, plus the static
 * invariants in tools/check-rbac.mjs, which are re-run rather than trusted.
 */
const rbac = [
  ['D71-1', 'The vocabulary, the defaults and the action map are consistent',
   'tools/check-rbac.mjs reports 28 permission codes, 6 roles with 78 default grants, 14 permission-guarded nav entries and 38 of 38 POST actions mapped, and every role nav is fully visible under its own defaults. The checker earned its place on the first run: EXAM_COMMITTEE was missing `system.read`, so its own System Health panel would have been filtered out of its own rail and that console would have shown one fewer entry than it did before this work'],
  ['D71-2', 'Route guards return a role without the console to /control/',
   'TEACHER onto /ca/ and onto /admin/ both landed on /control/ with no rail; a no-session hit on /central/ and on /calendar/ both did the same. SCHOOL_ADMIN and CENTRAL_ADMIN each reached their own console with a rail and content'],
  ['D71-3', 'SUPER_ADMIN is exempt from the console guards, as logged in DEV-16',
   'SUPER_ADMIN onto /ca/ stayed on /ca/ with 1275 chars of content and a rail, because /admin/ is not a superset of the six consoles - /ca/ owns Registration Portal and Examination Center, so confining the master account the way the reference application does would deny it two surfaces it exists to reach'],
  ['D71-4', 'One transport gate covers every write, and an unmapped action fails closed',
   'CENTRAL_ADMIN asking to DELETE_STUDENT got "Permission denied: this session may not perform DELETE_STUDENT." and TEACHER asking for the same write got the identical refusal, while the same session own PUBLISH_NOTICE succeeded. SUBMIT_EXAM_RESULT, whose entry in ACTION_PERMISSIONS is null because it is a candidate-session action outside the admin model, went through - and SUPER_ADMIN deleting a non-existent student was allowed by the bypass predicate, which answers true for that role alone'],
  ['D71-5', 'Privileged controls are gated at render, not only at the transport',
   'on /calendar/ ICT_ADMIN has no ADD EVENT button and CENTRAL_ADMIN has one; on /notices/ ICT_ADMIN has no compose control and CENTRAL_ADMIN does. The four consoles gate 14 controls the same way (REMARK, DELETE SUBJECT RESULTS, TRIGGER ARCHIVE, DEMOTE SELECTED, SAVE SUBJECT CHANGES, GRANT ICT ACCESS), each against the permission its own callApi action already requires'],
  ['D71-6', 'The rail is cut down to what the session actually holds',
   'CENTRAL_ADMIN sees 5 entries (Review Queue, Question Bank, Staff, then the Calendar and Notice Board added by D-64) against the school consoles 8 to 10, and the counts are a consequence of the filter rather than of a second hand-maintained list'],
  ['D71-7', 'The session sync corrects a claim that disagrees with the roster',
   'with the stored claim set to TEACHER and the username set to mockict, whose roster role is ICT_ADMIN, the teacher console rail collapsed from its 5 entries to Calendar and Notice Board - the two the ICT role still holds - and storage was rewritten to ICT_ADMIN. Navigating then rebuilt the rail from the corrected claim: ICT 9 entries on /calendar/. The same run proves the sync fires on navigation, not just on load'],
  ['D71-8', 'A shared page hands the panel across to the owning console',
   '/calendar/ with Results Center clicked landed on /admin/ with Results Center active in the rail and the results panel showing, 1283 chars. Before the fix it landed on /dashboard/ (a route nothing renders) with 0 chars, and after the first fix it landed on /admin/ but on Overview, because each console re-applies a persisted tab on mount'],
  ['D71-9', 'The persisted-tab restore was dead code and now works',
   'all four consoles asked for an element with id `tab-<panel>` to decide whether a saved tab still existed. That id belonged to the origin horizontal tab strip, which the 2026-09-29 redesign removed, so the guard was always false and every reload silently reset to the default panel. The test now asks whether the panel exists and whether the filtered nav offers it, so a tab persisted under a grant that has since been withdrawn is not quietly reopened'],
  ['D71-10', 'Every page still renders, with no console errors',
   'all twelve routes visited under the right role: /, /login/ and /control/ with no rail at all, /exam/ without a sitting session landing on /login/, the six consoles at 711 to 1319 chars with rails of 5, 8, 9, 9, 10 and 5, and /calendar/ and /notices/ at 765 and 2010. Zero page errors across the sweep'],
  ['D71-11', 'The production build is clean and the mock seam is gone',
   'npx vite build produced all 12 HTML entries, no occurrence of `__LAEC_MOCK__` anywhere in dist/, and the refusal string present in the shipped bundle'],
];
L.push('### O. RBAC, built and enforced (D-71) — ' + rbac.length + ' items');
L.push('');
rbac.forEach(([id, title, note]) => L.push(`- [x] verified — **${id}** ${title} — ${note}`));
L.push('');

/* ── Legibility and layout polish (D-73) ─────────────────────────────────
 * Measured with a computed-style pass over every route rather than by eye:
 * for each element with direct text it walks up for the effective background,
 * composites translucent foregrounds over it and compares luminance against
 * the WCAG AA threshold for that size (4.5:1, or 3:1 at 24px and 18.66px
 * bold). Text over a gradient is reported separately because it cannot be
 * measured that way - which is exactly where the invisible hero heading was.
 */
const polish = [
  ['D73-1', 'Every text run clears WCAG AA',
   'the pass reports 0 failures on all twelve routes, against 58 before the change across eleven. `.rail-group-title` alone was 35 of those, at 3.61:1 on the dark rail; the footer copyright was 2.68:1 on all four consoles and the SPAN beside it the same; the green and red status badges and the success button sat between 3.93:1 and 4.40:1'],
  ['D73-2', 'The console hero heading is readable',
   'the h2 measures rgb(255, 255, 255) on /ca/, /admin/, /ict/ and /comm/, and rgb(21, 36, 61) on the light /teacher/ toolbar - the same `color: inherit` resolving correctly against both the dark hero gradient and the white toolbar, which is why the fix sits in AppShell rather than in four page stylesheets'],
  ['D73-3', 'The COLOUR-SPEC values that were adjusted, and by how much',
   '`--success` #11895f to #107855 and `--danger` #c44444 to #b83c3c, approved under D-73. White on the fill went 4.40:1 to 5.47:1 and 4.21:1 to 5.60:1; on the #e5f6ed and #fbe9e9 badge tints 3.93:1 to 4.88:1 and 4.21:1 to 4.78:1. The amber badge text went #9a6d05 to #8a6104 (4.17:1 to 5.02:1). Same hues, no new colours introduced'],
  ['D73-4', 'Notice cards lay out as content and all match each other',
   'the notice-card children now stack at four distinct y positions (167, 209, 251, 317) with `flex-direction: column`, where before they were a wrapping row - which is why card four of five collapsed its title, body and metadata onto one line while the others wrapped. Checked on the rendered element, not on the stylesheet'],
  ['D73-5', 'The stats grid is level and the alert no longer orphans a card',
   'on /ca/ the four stat cards measure 112px tall all at y=333, and #promotion-alert-banner sits at y=465 spanning the full 1144px as its own row instead of stretching the row it shared with them. /admin/ is unchanged because it has no alert in its grid'],
  ['D73-6', 'The breadcrumb no longer repeats itself',
   'breadcrumbs read "School Administration / Overview", "Super Administrator / Overview", "ICT Administration / Overview", "Exam Committee / Overview", "Teacher Portal / Overview / My Papers", "Central Administration / Overview / Review Queue", "Central Administration / School / Calendar" and "Central Administration / School / Notice Board" - the group crumb is dropped only where it would repeat the leaf'],
  ['D73-7', 'Nothing regressed: overflow, errors and the gates',
   'horizontal overflow is 0 at 1440, 768 and 390 on the console, the notice board and the teacher console; zero page errors and zero console errors across all twelve routes; `npx vue-tsc --noEmit` silent, `tools/check-rbac.mjs` reports all invariants hold (28 codes, 6 roles, 78 grants, 14 guarded entries, 38 mapped actions), and `npx vite build` exits 0 with all 12 HTML entries and no `__LAEC_MOCK__` anywhere in dist/'],
];
L.push('### P. Legibility and layout polish (D-73) — ' + polish.length + ' items');
L.push('');
polish.forEach(([id, title, note]) => L.push(`- [x] verified — **${id}** ${title} — ${note}`));
L.push('');

/* ── Chrome consistency and popup containment (D-74) ──────────────────────
 * Every number below was read off the rendered element rather than off the
 * stylesheet: computed styles, getBoundingClientRect, elementFromPoint and
 * a real Playwright mouse move for the hover check. Baseline for "identical"
 * is /central/, because that surface carries no `.page-X` blanket and so is
 * the one still rendering what AppShell actually authored.
 */
const chrome = [
  ['D74-1', 'The z-index contract holds',
   '`styles/layers.css` declares 15 tokens in strict ascending order and `tools/check-layers.mjs` passes over 68 declarations — 63 tokenised, 5 `auto`. The two floating utilities sit at `--z-furniture` 150, below `--z-topbar` 500, so back-to-top can no longer cover the bar; `--z-modal` 850 stays above `--z-loading` 800 so an alert is never behind a spinner'],
  ['D74-2', 'Both popups are fixed, placed and contained',
   '`.account-menu` and `.bell-panel` measure `position: fixed` at `z-index` 700 with a rect wholly inside the viewport at 390, 768 and 1440; at 390 they land at left 12 / right 378, the designed 12px margins. `elementFromPoint` at the centre of each returns an element inside the popup, so nothing paints over it. Escape, outside-click and mutual exclusion all work and focus returns to the trigger'],
  ['D74-3', 'Opening a popup disturbs nothing behind it',
   'on all 48 popup checks the top bar, main region and rail rects and the document scroll height are byte-identical before and after the popup opens, and horizontal overflow stays 0 with it open — the background is not reflowed, dimmed, shifted or covered'],
  ['D74-4', 'The six consoles now render one chrome',
   'computed padding, border, radius, font-weight, letter-spacing, width and height match /central/ on /ca/, /admin/, /ict/, /comm/ and /teacher/: rail item 36px at 8px 10px / radius 7 / weight 500, rail collapse 41px with its 1px top divider intact, account trigger 34px as a 999px pill with a 1px border, burger and bell 32px squares, search 32px. Before the fence the same elements measured 44px, 44px with no divider, 50px with `border: none` and radius 14, and 51px'],
  ['D74-5', 'The two functional losses are restored',
   '`.bell-item` again carries `border: 1px solid transparent; border-left: 3px solid`, so `.bell-item.exam`, `.results`, `.security` and `.announcement` have a stripe to colour — that was silently gone on four consoles, not just styled differently. And `.bell-head` measures `position: static`, `flex-direction: row`, `z-index: auto`, fully inside its panel (overhang right −1px) instead of a fixed gradient masthead pinned across a 1440px viewport with its button clipped away'],
  ['D74-6', 'The specificity bracket did not flatten the collapsed rail',
   'with the rail collapsed the item measures padding `9px 0px` and the collapse control `10px 0px` — exactly `.rail-collapsed .rail-item` at (0,2,0) beating the fence at (0,1,2), which is the property the bracket was chosen for. Verified at 1440 collapsed, 768 icon-only and 390 drawer'],
  ['D74-7', 'Hover gives feedback without moving the chrome',
   'a real Playwright `mouse.move` onto a rail item, with `:hover` confirmed true, reports `transform: none → none` and top unchanged on both /ca/ and /central/, while the background still goes `rgba(0,0,0,0) → rgba(255,255,255,0.07)` and the shell own `background, color / 0.14s` transition is back — the origin was replacing that transition with one listing only transform, box-shadow and opacity, so the rail highlight used to snap'],
  ['D74-8', 'The regression the first fence caused is fixed and structurally closed',
   'the search box is `display: none` below 900px and its input measures 150px at 768 and 190px at 1440, so `.topbar-tools` is 187–211px on a phone instead of 387px; `.app-shell` grid columns read `[0px 390px]`, `[68px 700px]` and `[248px 1192px]`, always exactly the viewport, and horizontal overflow is 0 on all twelve routes at all three widths — /calendar/ and /notices/ went from 144px and 167px of overflow to 0'],
  ['D74-9', 'Text and icon placement',
   'the icon set is now only 14, 16 and 18px — burger 18 beside bell 18 in identical 32px squares, against 20 being the sole outlier. `.account-name` and `.crumb-leaf` both carry a `:title` equal to their own text, so the operator identity and the current page are recoverable when they ellipsis'],
  ['D74-10', 'The full sweep and the gates',
   '12 routes × 3 widths = 84 assertions including 48 popup checks, 0 failures, 0 console errors; shell chrome measured identical across all six consoles and all three widths; `npx vue-tsc --noEmit` silent, `tools/check-rbac.mjs` all invariants hold (28 codes, 6 roles, 78 grants, 14 guarded entries, 38 mapped actions), `tools/check-layers.mjs` passes, `npx vite build` exits 0'],
];
L.push('### Q. Chrome consistency and popup containment (D-74) — ' + chrome.length + ' items');
L.push('');
chrome.forEach(([id, title, note]) => L.push(`- [x] verified — **${id}** ${title} — ${note}`));
L.push('');

fs.writeFileSync(OUT, L.join('\n'), 'utf8');
console.log('wrote', OUT);
console.log('pages', routes.length + 1, '| group heads', groups4.length, '| blocks', groups4.reduce((a, g) => a + g.items.length, 0), '| shared', shared.length, '| flows', flows.length, '| RF in scope', inScopeRF.length, '| RF out scope', outScopeRF.length, '| assets', assets.length, '| deps', deps.length);
