async (page) => {
  await page.goto('https://saintfinbarrscollege.com/roles/new', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(3200);
  return await page.evaluate(() => {
    const t = (n) => (n.innerText || '').trim().replace(/\s+/g, ' ');
    const root = document.querySelector('main') || document.body;
    // Each permission module renders a heading followed by its checkbox labels.
    const groups = [];
    let current = null;
    root.querySelectorAll('h3, h4, [class*="font-semibold"], label').forEach((el) => {
      const label = t(el);
      if (!label || label.length > 70) return;
      const isInput = el.querySelector('input[type="checkbox"]');
      if (!isInput) {
        // A group heading is a bold label with no checkbox of its own.
        if (!/^(Select all|0 permissions)/.test(label)) {
          current = { module: label, items: [] };
          groups.push(current);
        }
        return;
      }
      if (!current) {
        current = { module: '(ungrouped)', items: [] };
        groups.push(current);
      }
      const raw = (isInput.getAttribute('aria-label') || label).replace(/^Select\s+/, '');
      current.items.push(raw);
    });
    return JSON.stringify(groups.filter((g) => g.items.length), null, 1);
  });
}
