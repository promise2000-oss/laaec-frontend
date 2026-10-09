/**
 * rowactions.js — opens the per-row action menus and the tab strips on the
 * live admin portal.
 *
 * READ-ONLY: it clicks a single row's action trigger, or a tab, and records the
 * resulting menu / tab panel. It dismisses with Escape. It never clicks an item
 * inside a menu, so no mutation is ever issued.
 */
async (page) => {
  const targets = [
    { route: '/users', rowSelector: 'table tbody tr' },
    { route: '/staff', rowSelector: 'table tbody tr' },
    { route: '/students', rowSelector: 'table tbody tr' },
    { route: '/parents', rowSelector: 'table tbody tr' },
    { route: '/roles', rowSelector: 'table tbody tr' },
    { route: '/academic/subjects', rowSelector: 'table tbody tr' },
    { route: '/academic/sessions', rowSelector: 'table tbody tr' },
    { route: '/academic/classes', rowSelector: 'table tbody tr' },
    { route: '/inventory/stock', rowSelector: 'table tbody tr' },
    { route: '/inventory/assets', rowSelector: 'table tbody tr' },
    { route: '/inventory/sales', rowSelector: 'table tbody tr' },
    { route: '/inventory/categories', rowSelector: 'table tbody tr' },
    { route: '/inventory/suppliers', rowSelector: 'table tbody tr' },
    { route: '/school-fees/categories', rowSelector: 'table tbody tr' },
    { route: '/wallets', rowSelector: 'table tbody tr' },
    { route: '/store/queue', rowSelector: 'table tbody tr' },
    { route: '/leave/approvals', rowSelector: 'table tbody tr' },
    { route: '/hr-queries', rowSelector: 'table tbody tr' },
    { route: '/results/windows', rowSelector: 'table tbody tr' },
    { route: '/weekly-report/manage', rowSelector: 'table tbody tr' },
    { route: '/disciplinary/reports', rowSelector: 'table tbody tr' },
    { route: '/counselling/cases', rowSelector: 'table tbody tr' },
    { route: '/counselling/reports', rowSelector: 'table tbody tr' },
    { route: '/disciplinary/incidents', rowSelector: 'table tbody tr' },
    { route: '/academic/class-teachers', rowSelector: 'table tbody tr' },
    { route: '/results/enter', rowSelector: 'table tbody tr' },
  ];

  const out = [];

  for (const target of targets) {
    await page.goto('https://saintfinbarrscollege.com' + target.route, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(2600);

    const menu = await page.evaluate((sel) => {
      const t = (n) => (n.innerText || '').trim().replace(/\s+/g, ' ');
      const row = document.querySelector('main ' + sel);
      if (!row) return null;
      const btns = Array.from(row.querySelectorAll('button, [role="button"]'));
      // Prefer a trigger with no text (a kebab/caret), else the last button.
      const trigger = btns.find((b) => !t(b)) || btns[btns.length - 1];
      if (!trigger) return null;
      const before = document.querySelectorAll('[role="menu"], [data-radix-menu-content], [role="listbox"]').length;
      trigger.setAttribute('data-audit-row', '1');
      return { label: t(trigger) || '(icon)', before };
    }, target.rowSelector);

    if (!menu) {
      out.push({ route: target.route, menu: null, reason: 'no row-level trigger found' });
      continue;
    }

    await page.click('[data-audit-row="1"]', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1100);

    const items = await page.evaluate(() => {
      const t = (n) => (n.innerText || '').trim().replace(/\s+/g, ' ');
      const menus = Array.from(document.querySelectorAll('[role="menu"], [data-radix-menu-content], [role="listbox"]'));
      if (!menus.length) return null;
      const m = menus[menus.length - 1];
      return {
        items: Array.from(m.querySelectorAll('[role="menuitem"], button, li')).map(t).filter((x) => x && x.length < 40),
      };
    });

    out.push({ route: target.route, trigger: menu.label, items: items ? items.items : null });
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
  }

  /* Tab strips: record what each tab renders. */
  const tabs = [];
  const tabTargets = [
    '/permissions', '/leave', '/leave/approvals', '/hr-queries', '/notifications',
    '/results/queue', '/dashboard/lesson-plans', '/staff-portal/lesson-planning/approvals',
    '/weekly-report/manage', '/teacher/class-teacher-weekly-report', '/inventory/sales',
    '/store/queue', '/communication/messages', '/academic/calendar', '/communication/calendar',
  ];
  for (const route of tabTargets) {
    await page.goto('https://saintfinbarrscollege.com' + route, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(2600);
    const labels = await page.evaluate(() => {
      const t = (n) => (n.innerText || '').trim().replace(/\s+/g, ' ');
      const root = document.querySelector('main') || document.body;
      return Array.from(new Set(Array.from(root.querySelectorAll('[role="tab"], [role="tablist"] button')).map(t))).filter((x) => x && x.length < 40);
    });
    tabs.push({ route, tabs: labels });
  }

  await fetch('http://127.0.0.1:8787/?name=row-actions.json', { method: 'POST', body: JSON.stringify({ rowActions: out, tabs }) });
  return JSON.stringify({ rows: out.length, withMenus: out.filter((o) => o.items).length, tabbed: tabs.filter((t) => t.tabs.length).length });
}
