/**
 * make-batches.mjs — generates one crawl file per batch of admin routes.
 *
 * Playwright's `browser_run_code_unsafe` loads a file whose contents are a
 * single arrow function, so each batch is a self-contained file that crawls its
 * own slice and POSTs the result to the loopback collector.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const ROUTES = [
  // Dashboards
  '/dashboard', '/dashboard/lesson-plans', '/profile',
  // User & roles
  '/users', '/users/new', '/roles', '/roles/new', '/permissions', '/permissions/overrides',
  // Staff & HR
  '/staff', '/staff/new', '/staff/import', '/departments', '/departments/new',
  '/designations', '/designations/new',
  '/attendance', '/attendance/new', '/attendance/reports',
  '/leave', '/leave/new', '/leave/apply', '/leave/approvals',
  '/hr-queries', '/hr-queries/new', '/awards', '/awards/new',
  // Students & parents
  '/students', '/students/new', '/students/import', '/students/export', '/students/promotion',
  '/students/attendance', '/students/attendance/new', '/students/attendance/report',
  '/parents', '/parents/new',
  // Academic settings
  '/academic/sessions', '/academic/sessions/new', '/academic/terms', '/academic/terms/new',
  '/academic/classes', '/academic/classes/new', '/academic/sections', '/academic/sections/new',
  '/academic/subjects', '/academic/subjects/new',
  '/academic/timetables', '/academic/timetables/new', '/academic/class-routines',
  '/academic/assignments', '/academic/class-teachers', '/academic/subject-teachers',
  '/academic/calendar',
  // Teacher portal surfaces reachable by admin
  '/lesson-planning', '/lesson-planning/create', '/lesson-planning/drafts',
  '/lesson-planning/pending-review', '/lesson-planning/approved', '/lesson-planning/rejected',
  '/lesson-planning/weekly-planner',
  '/staff-portal/lesson-planning/approvals',
  '/weekly-report', '/weekly-report/create', '/weekly-report/manage',
  '/teacher/class-teacher-weekly-report', '/teacher/class-teacher-weekly-report/create',
  // Communication
  '/communication/notice-board', '/communication/notice-board/new', '/communication/events',
  '/communication/events/new', '/communication/messages', '/communication/templates',
  '/communication/templates/new', '/communication/logs', '/communication/calendar',
  '/notifications',
  // Disciplinary & counselling
  '/disciplinary/incidents', '/disciplinary/committees', '/disciplinary/launch-case',
  '/disciplinary/reports',
  '/counselling/book-session', '/counselling/cases', '/counselling/committee',
  '/counselling/report', '/counselling/reports',
  // Inventory
  '/inventory/stock', '/inventory/categories', '/inventory/suppliers', '/inventory/assets',
  '/inventory/reports', '/inventory/settings', '/inventory/clinic', '/inventory/sales',
  // Store
  '/store', '/store/cart', '/store/orders', '/store/queue',
  // Fees & wallets
  '/school-fees', '/school-fees/categories', '/school-fees/items', '/school-fees/payments',
  '/school-fees/reports', '/wallets', '/wallets/reports',
  // Results
  '/results/windows', '/results/enter', '/results/queue', '/results/committee',
  '/results/grading', '/results/students', '/results/report-cards',
  // System
  '/system/general-settings', '/system/academic-settings', '/system/audit-logs',
  '/system/backups', '/system/branding', '/system/feature-toggles',
  '/system/notification-settings', '/system/system-configuration',
  // Parent surfaces the admin dashboard links into
  '/parent/manage-child', '/parent/fees', '/parent/payments', '/parent/wallet',
  '/parent/notice-board', '/parent/events', '/parent/store', '/parent/counselling',
  '/parent/disciplinary',
  // Auth surfaces (reference only; no credentials used)
  '/forgot-password', '/unauthorized',
];

const PER = 8;
const batches = [];
for (let i = 0; i < ROUTES.length; i += PER) batches.push(ROUTES.slice(i, i + PER));

const body = (routes, name) => `async (page) => {
  const ROUTES = ${JSON.stringify(routes, null, 2)};
  const NAME = ${JSON.stringify(name)};
  const collected = [];
  for (const route of ROUTES) {
    let status = 'ok';
    let httpStatus = null;
    try {
      const resp = await page.goto('https://saintfinbarrscollege.com' + route, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      httpStatus = resp ? resp.status() : null;
    } catch (e) {
      status = 'navigation-error';
    }
    await page.waitForTimeout(2600);
    const record = await page.evaluate((routeArg) => {
      const navHrefs = new Set(
        Array.from(document.querySelectorAll('[class*="sidebar"] a, aside a, nav a'))
          .map((a) => a.getAttribute('href'))
          .filter(Boolean),
      );
      const root =
        document.querySelector('main [class*="overflow-y-auto"]') ||
        document.querySelector('main') ||
        document.body;
      const text = (n) => (n.innerText || '').trim().replace(/\\s+/g, ' ');
      const all = (sel) => Array.from(root.querySelectorAll(sel)).map(text).filter(Boolean);
      const uniq = (arr) => Array.from(new Set(arr));
      const fieldLabel = (el) => {
        const aria = el.getAttribute('aria-label');
        if (aria) return aria;
        if (el.id) {
          const lab = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
          if (lab) return text(lab);
        }
        const w = el.closest('div');
        if (w) {
          const lab = w.querySelector('label');
          if (lab && text(lab)) return text(lab);
        }
        if (el.placeholder) return '[placeholder] ' + el.placeholder;
        return '';
      };
      const fields = Array.from(root.querySelectorAll('input,select,textarea')).map((el) => ({
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || '',
        label: fieldLabel(el),
        placeholder: el.getAttribute('placeholder') || '',
        required: el.required === true || el.getAttribute('aria-required') === 'true',
        options: el.tagName === 'SELECT' ? Array.from(el.options).map((o) => o.text.trim()).slice(0, 60) : undefined,
      }));
      const inPageLinks = uniq(
        Array.from(root.querySelectorAll('a[href]'))
          .map((a) => a.getAttribute('href'))
          .filter((h) => !h.startsWith('http') && !h.includes('cdn-cgi') && !navHrefs.has(h)),
      );
      const cards = uniq(
        Array.from(root.querySelectorAll('[class*="card"], article'))
          .map((c) => text(c).slice(0, 70))
          .filter((c) => c && c.length > 3),
      );
      return {
        route: routeArg,
        title: document.title,
        headings: uniq(all('h1, h2, h3')).slice(0, 30),
        buttons: uniq(all('button, [role="button"]')).slice(0, 70),
        tableHeaders: uniq(all('table thead th')).slice(0, 40),
        tabs: uniq(all('[role="tab"], [role="tablist"] button')).slice(0, 30),
        fields,
        inPageLinks: inPageLinks.slice(0, 50),
        cards: cards.slice(0, 20),
        chartCanvases: root.querySelectorAll('canvas').length,
        hasTable: root.querySelectorAll('table').length,
        rowCount: root.querySelectorAll('table tbody tr').length,
        text: text(root).slice(0, 3000),
      };
    }, route);
    record.status = status;
    record.httpStatus = httpStatus;
    collected.push(record);
  }
  await fetch('http://127.0.0.1:8787/?name=' + encodeURIComponent(NAME), {
    method: 'POST',
    body: JSON.stringify(collected),
  });
  return collected.map((c) => c.route + ' :: ' + c.title + ' :: rows=' + c.rowCount + ' :: fields=' + c.fields.length);
}`;

mkdirSync(join(here, 'batches'), { recursive: true });
batches.forEach((routes, i) => {
  const name = `routes-${String(i + 1).padStart(2, '0')}.json`;
  writeFileSync(join(here, 'batches', `b${String(i + 1).padStart(2, '0')}.js`), body(routes, name));
});
console.log('routes:', ROUTES.length, 'batches:', batches.length);
