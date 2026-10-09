async (page) => {
  const ROUTES = [
  "/lesson-planning/drafts",
  "/lesson-planning/pending-review",
  "/lesson-planning/approved",
  "/lesson-planning/rejected",
  "/lesson-planning/weekly-planner",
  "/staff-portal/lesson-planning/approvals",
  "/weekly-report",
  "/weekly-report/create"
];
  const NAME = "routes-08.json";
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
      const text = (n) => (n.innerText || '').trim().replace(/\s+/g, ' ');
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
}