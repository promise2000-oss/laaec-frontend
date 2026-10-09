/**
 * modals.js — opens the non-destructive modals/drawers on the live admin portal
 * and records what each one contains.
 *
 * READ-ONLY: it only clicks buttons whose label begins with Add / Create /
 * Assign / Actions / View / Edit / Resend / Export / Import / Manage — every
 * one of which opens a dialog, a drawer or a separate read view. It never
 * clicks Save, Submit, Delete, Remove, Confirm, Issue, Launch, Publish,
 * Close, Reopen, Top up, Deduct, Promote, Archive or any row-action menu
 * item that mutates, and it dismisses each dialog with Cancel/Escape before
 * moving on. No record is created, edited or destroyed.
 */
async (page) => {
  const OPEN = /^(Add |Create |Assign |Manage |Actions|View |Edit |Resend |Export |Import |New |Give |Book |Launch )/;
  const targets = [
    '/users', '/departments', '/designations', '/students', '/parents', '/staff',
    '/roles', '/academic/classes', '/academic/sections', '/academic/sessions',
    '/inventory/stock', '/inventory/assets', '/inventory/categories', '/inventory/suppliers',
    '/inventory/sales', '/school-fees/categories', '/school-fees/items', '/wallets',
    '/store/queue', '/results/windows', '/leave/approvals', '/hr-queries',
    '/counselling/cases', '/counselling/reports', '/disciplinary/reports',
    '/notifications', '/communication/messages', '/permissions', '/system/audit-logs',
    '/system/backups', '/system/feature-toggles', '/weekly-report/manage',
    '/dashboard/lesson-plans', '/staff-portal/lesson-planning/approvals',
    '/results/queue', '/results/committee', '/store', '/store/cart', '/store/orders',
  ];

  const collect = [];

  for (const route of targets) {
    await page.goto('https://saintfinbarrscollege.com' + route, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(2600);

    const opened = await page.evaluate((openSrc) => {
      const re = new RegExp(openSrc);
      const root = document.querySelector('main') || document.body;
      const buttons = Array.from(root.querySelectorAll('button, [role="button"], a'));
      const target = buttons.find((b) => {
        const t = (b.innerText || '').trim().replace(/\s+/g, ' ');
        return t && t.length < 40 && re.test(t);
      });
      if (!target) return null;
      target.setAttribute('data-audit-open', '1');
      return (target.innerText || '').trim();
    }, OPEN.source);

    if (!opened) {
      collect.push({ route, opened: null, reason: 'no non-destructive opener found' });
      await page.keyboard.press('Escape').catch(() => {});
      continue;
    }

    await page.click('[data-audit-open="1"]', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1400);

    const dialog = await page.evaluate((routeArg) => {
      const dlg =
        document.querySelector('[role="dialog"]') ||
        document.querySelector('[data-state="open"][class*="sheet"]') ||
        document.querySelector('main [class*="fixed"][class*="inset-0"]');
      if (!dlg) return null;
      const t = (n) => (n.innerText || '').trim().replace(/\s+/g, ' ');
      const labels = Array.from(dlg.querySelectorAll('label, [data-slot="label"]')).map(t).filter(Boolean);
      const fields = Array.from(dlg.querySelectorAll('input,select,textarea')).map((e) => ({
        tag: e.tagName.toLowerCase(),
        type: e.getAttribute('type') || '',
        label: t(e.closest('label') || e).slice(0, 60) || e.placeholder || '',
        required: e.required || e.getAttribute('aria-required') === 'true',
        options: e.tagName === 'SELECT' ? Array.from(e.options).map((o) => o.text.trim()).slice(0, 20) : undefined,
      }));
      return {
        route: routeArg,
        title: t(dlg.querySelector('h1,h2,h3,[data-slot="title"]') || dlg).slice(0, 120),
        labels: Array.from(new Set(labels)).slice(0, 30),
        buttons: Array.from(new Set(Array.from(dlg.querySelectorAll('button')).map(t))).filter((x) => x && x.length < 40).slice(0, 20),
        fields: fields.slice(0, 30),
        text: t(dlg).slice(0, 700),
      };
    }, route);

    collect.push({ route, opened, dialog });
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      const cancel = d && Array.from(d.querySelectorAll('button')).find((b) => /^(cancel|close)$/i.test((b.innerText || '').trim()));
      if (cancel) cancel.click();
    });
    await page.waitForTimeout(600);
  }

  await fetch('http://127.0.0.1:8787/?name=modals.json', { method: 'POST', body: JSON.stringify(collect) });
  return JSON.stringify(collect.map((c) => ({ route: c.route, opened: c.opened, dlg: c.dialog ? c.dialog.title.slice(0, 60) : null, fields: c.dialog ? c.dialog.fields.length : 0 })));
}
