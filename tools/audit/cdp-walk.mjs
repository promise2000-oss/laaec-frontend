/**
 * cdp-walk.mjs — the panel walk, driven over the DevTools Protocol.
 *
 * Same assertions as `tools/audit/verify-walk.js` (which runs under the Playwright
 * MCP): every panel must mount, and none may log an error while it is open. The
 * CDP driver exists because that MCP server is not available in this session, and
 * the walk has to stay re-runnable — a check that can only be run once proves
 * nothing about whether it still passes.
 *
 * Run:  node tools/audit/cdp-walk.mjs
 */

import { launch } from 'file:///C:/Users/USER/AppData/Local/Temp/opencode/cdp/cdp.mjs';

const BASE = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The project's own published mock fixture. Never the live audit credential. */
const USER = 'mocksuper';
const PASS = 'MockAdminPass1';

const ADMIN_PANELS = [
  'school-dashboard', 'users', 'roles', 'permissions',
  'staff', 'departments', 'designations', 'staff-attendance', 'staff-attendance-report',
  'leave', 'leave-approvals', 'hr-queries', 'awards',
  'students', 'student-attendance', 'student-attendance-report', 'parents',
  'sessions', 'classes', 'arms', 'subjects', 'timetables', 'assignments',
  'class-teachers', 'subject-teachers',
  'stock', 'inventory-categories', 'suppliers', 'assets', 'inventory-reports',
  'inventory-settings', 'clinic-store', 'sales',
  'store', 'cart', 'orders', 'queue',
  'disciplinary-incidents', 'disciplinary-committees', 'disciplinary-launch-case',
  'disciplinary-reports', 'counselling-cases', 'counselling-book-session',
  'counselling-committee', 'counselling-reports',
  'fee-breakdown', 'fee-categories', 'fee-items', 'fee-payments', 'fee-reports',
  'wallets', 'wallet-reports',
  'upload-windows', 'enter-results', 'results-queue', 'committee-review', 'grading',
  'student-results', 'report-cards',
  'general-settings', 'academic-settings', 'audit-logs', 'backups', 'branding',
  'feature-toggles', 'notification-settings', 'system-configuration',
];

/**
 * The seven pre-existing LAEC panels, addressed the way the page addresses them.
 *
 * They are origin markup: a `<div id="..." class="tab-panel">` shown by carrying
 * `active`, seeded through `activeLAECTab`. `?panel=` does not address them —
 * `panelFromQuery` only accepts registry ids — so probing one that way silently
 * reopens whichever module was last visited. These are a REGRESSION pass over
 * markup this build did not create, not evidence that it implemented them.
 */
const LAEC_PANELS = [
  'dashboard', 'exam-mgt', 'past-questions', 'results', 'student-directory', 'admins', 'health',
];

const probe = (id, kind) => `
  const root = ${kind === 'laec'
    ? `document.getElementById(${JSON.stringify(id)})`
    : `document.querySelector('[data-admin-panel]')`};
  if (!root) return { mounted: false, missing: true };
  const panel = root;
  const h = (n) => (((n && n.textContent) || '').trim().replace(/\\s+/g, ' '));
  const wrapper = document.querySelector('[data-admin-panel]');
  const text = (panel.textContent || '').replace(/\\s+/g, ' ').trim();
  return {
    mounted: ${kind === 'laec'
      ? `root.classList.contains('active')`
      : `!!wrapper && wrapper.getAttribute('data-admin-panel') === ${JSON.stringify(id)}`},
    heading: h(panel.querySelector('h2, h3')),
    tables: panel.querySelectorAll('table').length,
    rows: panel.querySelectorAll('table tbody tr').length,
    buttons: Array.from(new Set(Array.from(panel.querySelectorAll('button')).map(h).filter((x) => x && x.length < 40))).length,
    inputs: panel.querySelectorAll('input, select, textarea').length,
    dialogs: panel.querySelectorAll('[role="dialog"]').length,
    textSample: text.slice(0, 160),
  };
`;

/**
 * Wait until the addressed panel is mounted and has stopped loading.
 *
 * Two quiet samples rather than one, and the first sample is not the panel
 * element's existence but the absence of a spinner: the wrapper renders before
 * its read is issued, so a single existence check passes against an empty
 * panel and records zero tables and zero rows for a panel that works.
 */
const settle = async (browser, id) => {
  let quiet = 0;
  for (let attempt = 0; attempt < 50 && quiet < 2; attempt += 1) {
    const busy = await browser.evaluate(`
      const root = document.querySelector('[data-admin-panel]') || document.getElementById(${JSON.stringify(id)});
      if (!root) return true;
      return !!root.querySelector('.ap-loading, .laec-spinner, [aria-busy="true"]');
    `);
    quiet = busy ? 0 : quiet + 1;
    if (quiet < 2) await sleep(250);
  }
};

async function main() {
  const browser = await launch();
  const lines = [];
  let failed = 0;

  try {
    // ── sign in ──────────────────────────────────────────────────────────
    await browser.goto(BASE + '/login/super/', 1800);
    await browser.evaluate(`
      const set = (id, v) => {
        const el = document.getElementById(id);
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('username', ${JSON.stringify(USER)});
      set('password', ${JSON.stringify(PASS)});
      return true;
    `);
    /* The submit button is found by its text, not by position: the first
       `<button>` on this card is the password-visibility toggle, so an index-0
       click hits that and the form never submits. */
    await browser.evaluate(`
      const btn = Array.from(document.querySelectorAll('button'))
        .find((b) => /AUTHORIZE SESSION/i.test(b.innerText));
      if (!btn) return false;
      btn.click();
      return true;
    `);
    await new Promise((r) => setTimeout(r, 4000));

    const session = await browser.evaluate(
      `return { url: location.pathname, ok: !!localStorage.getItem('LAEC_Session'), role: localStorage.getItem('AdminRole') };`,
    );
    if (!session.ok) {
      console.log('FATAL sign-in failed:', JSON.stringify(session));
      process.exitCode = 1;
      return;
    }
    lines.push(`sign-in: ${session.url} role=${session.role}`);

    // ── walk ─────────────────────────────────────────────────────────────
    const results = [];
    for (const id of ADMIN_PANELS) {
      const before = {
        c: browser.consoleErrors.length, p: browser.pageErrors.length,
      };
      /* Wait for the panel, then for it to settle, rather than for the clock.
         A fixed delay reads a panel mid-load and reports it as missing or empty —
         which is how a walk of 66 panels passed against reads that had not
         landed yet. Two quiet samples, because the panel element exists before
         its read is issued. */
      await browser.goto(`${BASE}/admin/?panel=${id}`, 250);
      await settle(browser, id);
      const rec = await browser.evaluate(probe(id, 'admin'));
      rec.id = id;
      rec.kind = 'admin';
      rec.consoleErrors = browser.consoleErrors.length - before.c;
      rec.pageErrors = browser.pageErrors.length - before.p;
      results.push(rec);
    }
    for (const id of LAEC_PANELS) {
      const before = {
        c: browser.consoleErrors.length, p: browser.pageErrors.length,
      };
      await browser.evaluate(`localStorage.setItem('activeLAECTab', ${JSON.stringify(id)}); return true;`);
      await browser.goto(BASE + '/admin/', 250);
      await settle(browser, id);
      const rec = await browser.evaluate(probe(id, 'laec'));
      rec.id = id;
      rec.kind = 'laec';
      rec.consoleErrors = browser.consoleErrors.length - before.c;
      rec.pageErrors = browser.pageErrors.length - before.p;
      results.push(rec);
    }

    const mounted = results.filter((r) => r.mounted).length;
    const admin = results.filter((r) => r.kind === 'admin');
    const laec = results.filter((r) => r.kind === 'laec');
    lines.push(
      `panels walked: ${results.length}, mounted: ${mounted}` +
      `  (admin modules: ${admin.length}, LAEC regression: ${laec.length})`,
    );

    for (const r of results) {
      if (!r.mounted) failed += 1;
      if (r.consoleErrors || r.pageErrors) failed += 1;
      lines.push(
        `  ${r.mounted ? 'OK  ' : 'MISS'} ${r.id.padEnd(25)} ` +
        `${String(r.tables).padEnd(3)}tbl ${String(r.rows).padEnd(5)}row ` +
        `${String(r.buttons).padEnd(4)}btn ${String(r.inputs).padEnd(4)}in  ` +
        `e${r.consoleErrors}/p${r.pageErrors}  ` +
        (r.heading || (r.textSample || '(nothing rendered)').slice(0, 60)),
      );
    }

    lines.push(`console errors: ${browser.consoleErrors.length}`);
    for (const e of browser.consoleErrors.slice(0, 10)) lines.push('  CONSOLE: ' + e);
    lines.push(`page errors: ${browser.pageErrors.length}`);
    for (const e of browser.pageErrors.slice(0, 10)) lines.push('  PAGEERROR: ' + e);

    console.log(lines.join('\n'));
    console.log(
      failed === 0
        ? `\nPASS — ${mounted}/${results.length} panels mounted, no console or page errors.`
        : `\nFAIL — ${failed} problem(s).`,
    );
    process.exitCode = failed === 0 ? 0 : 1;
  } finally {
    await browser.close();
  }
}

main();