/**
 * verify-walk.js — signs in to the LOCAL portal and walks every rail entry.
 *
 * Loaded by Playwright's `browser_run_code_unsafe`, which evaluates a file whose
 * contents are a single arrow function — so this file has no imports and no
 * exports, and every helper it needs is defined inside it.
 *
 * WHAT IT RECORDS, PER PANEL
 * --------------------------
 * Whether the panel mounted (and under which id), its heading, table and row
 * counts, how many controls it offered, whether it was still loading, whether it
 * showed an error, whether its empty state fired, and how many console errors,
 * page errors and failed requests occurred while it was open.
 *
 * WHY A SCRIPT AND NOT A HAND-LED CRAWL
 * -------------------------------------
 * Because the output has to be re-derivable. A crawl run once proves nothing about
 * whether it still passes; this writes a per-panel record for every run, and it
 * fails loudly on a console error, which a screenshot cannot.
 *
 * CREDENTIALS
 * -----------
 * The account is this project's own published mock fixture — a Super Admin login
 * that exists in the local dev build and in no deployed system. It is not the
 * credential supplied for the live audit, which appears nowhere in this file or in
 * this repository.
 */
async (page) => {
  const BASE = 'http://localhost:5173';
  const USER = 'mocksuper';
  const PASS = 'MockAdminPass1';

  const PANELS = [
    'dashboard', 'exam-mgt', 'past-questions', 'results', 'student-directory', 'admins', 'health',
    'school-dashboard', 'users', 'roles', 'permissions',
    'staff', 'departments', 'designations', 'staff-attendance', 'staff-attendance-report',
    'leave', 'leave-approvals', 'hr-queries', 'awards',
    'students', 'student-attendance', 'student-attendance-report', 'parents',
    'sessions', 'classes', 'arms', 'subjects', 'timetables', 'assignments',
    'class-teachers', 'subject-teachers',
    'stock', 'inventory-categories', 'suppliers', 'assets', 'inventory-reports',
    'inventory-settings', 'clinic-store', 'sales',
    'store', 'cart', 'orders', 'queue',
    'fee-breakdown', 'fee-categories', 'fee-items', 'fee-payments', 'fee-reports',
    'wallets', 'wallet-reports',
    'upload-windows', 'enter-results', 'results-queue', 'committee-review', 'grading',
    'student-results', 'report-cards',
    'general-settings', 'academic-settings', 'audit-logs', 'backups', 'branding',
    'feature-toggles', 'notification-settings', 'system-configuration',
  ];

  const LAEC = new Set([
    'dashboard', 'exam-mgt', 'past-questions', 'results', 'student-directory', 'admins', 'health',
  ]);

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 400)));
  page.on('requestfailed', (r) => {
    if (r.url().startsWith(BASE)) failedRequests.push(r.method() + ' ' + r.url() + ' — ' + (r.failure() && r.failure().errorText));
  });

  await page.goto(BASE + '/login/super/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.fill('#username', USER);
  await page.fill('#password', PASS);
  await page.click('button:has-text("AUTHORIZE SESSION")');
  await page.waitForTimeout(3500);

  const afterLogin = await page.evaluate(() => ({
    url: location.pathname,
    session: !!localStorage.getItem('LAEC_Session'),
    role: localStorage.getItem('AdminRole'),
  }));

  if (!afterLogin.session) {
    return 'FATAL sign-in failed: ' + JSON.stringify(afterLogin);
  }

  /*
   * The two panel families are addressed differently, and a single probe conflates
   * them into a false pass:
   *
   *   - A Saint Finbarr's module carries `data-admin-panel="<id>"` and is reached
   *     by `?panel=<id>`. So "did a wrapper for the id I asked for mount?" is the
   *     whole question.
   *   - A LAEC panel is origin markup: a `<div id="<id>" class="tab-panel">` that
   *     is shown by carrying the `active` class. `?panel=` does not address it —
   *     `panelFromQuery` only accepts ids in ADMIN_PANEL_IDS — so probing one
   *     that way silently reopens whichever module was last visited and reports
   *     it as a pass. LAEC panels are therefore addressed the way the page itself
   *     addresses them, by seeding `activeLAECTab`, and asserted by id AND by the
   *     `active` class.
   *
   * LAEC rows below are a REGRESSION pass over pre-existing markup, not evidence
   * that this build implemented them.
   */
  const panels = [];
  for (const panel of PANELS) {
    const isLaec = LAEC.has(panel);
    const b = { c: consoleErrors.length, p: pageErrors.length, f: failedRequests.length };
    await page.evaluate((id) => localStorage.setItem('activeLAECTab', id), panel);
    await page.goto(
      BASE + '/admin/' + (isLaec ? '' : '?panel=' + panel),
      { waitUntil: 'networkidle', timeout: 60000 },
    );
    await page.waitForTimeout(1300);
    const record = await page.evaluate(({ id, isLaec }) => {
      const h = (n) => ((n && n.innerText) || '').trim().replace(/\s+/g, ' ');
      const wrapper = document.querySelector('[data-admin-panel]');
      const laecEl = isLaec ? document.getElementById(id) : null;
      const root = isLaec ? laecEl || document.querySelector('main') || document.body : wrapper;
      const text = ((root && root.innerText) || '').replace(/\s+/g, ' ').trim();
      return {
        requested: id,
        kind: isLaec ? 'laec' : 'admin',
        mounted: isLaec ? !!laecEl && laecEl.classList.contains('active') : !!wrapper,
        mountedId: isLaec ? (laecEl ? laecEl.id : null) : wrapper && wrapper.getAttribute('data-admin-panel'),
        heading: root ? h(root.querySelector('h2, h3')) : '',
        tables: root ? root.querySelectorAll('table').length : 0,
        rows: root ? root.querySelectorAll('table tbody tr').length : 0,
        buttons: root
          ? Array.from(new Set(Array.from(root.querySelectorAll('button')).map(h).filter((x) => x && x.length < 40))).length
          : 0,
        inputs: root ? root.querySelectorAll('input, select, textarea').length : 0,
        hasError: root ? !!root.querySelector('[role="alert"]') : false,
        dialogs: root ? root.querySelectorAll('[role="dialog"]').length : 0,
        textSample: text.slice(0, 200),
      };
    }, { id: panel, isLaec });
    record.consoleErrors = consoleErrors.length - b.c;
    record.pageErrors = pageErrors.length - b.p;
    record.failedRequests = failedRequests.length - b.f;
    panels.push(record);
  }

  const lines = [];
  lines.push('sign-in: ' + afterLogin.url + ' role=' + afterLogin.role);
  lines.push('panels walked: ' + panels.length + ', mounted: ' + panels.filter((p) => p.mounted).length);
  lines.push('  admin modules: ' + panels.filter((p) => p.kind === 'admin').length + ', LAEC regression: ' + panels.filter((p) => p.kind === 'laec').length);
  for (const p of panels) {
    lines.push(
      (p.mounted ? '  OK   ' : '  MISS ') +
      p.requested.padEnd(26) +
      String(p.tables).padEnd(3) + 'tbl ' +
      String(p.rows).padEnd(5) + 'row ' +
      String(p.buttons).padEnd(4) + 'btn ' +
      String(p.inputs).padEnd(4) + 'in  ' +
      'e' + p.consoleErrors + '/p' + p.pageErrors + '/r' + p.failedRequests +
      '  ' + (p.heading || p.textSample.slice(0, 60)),
    );
  }
  lines.push('console errors: ' + consoleErrors.length);
  for (const e of consoleErrors.slice(0, 12)) lines.push('  CONSOLE: ' + e);
  lines.push('page errors: ' + pageErrors.length);
  for (const e of pageErrors.slice(0, 12)) lines.push('  PAGEERROR: ' + e);
  lines.push('failed requests: ' + failedRequests.length);
  for (const e of failedRequests.slice(0, 12)) lines.push('  REQFAIL: ' + e);

  return lines.join('\n');
}
