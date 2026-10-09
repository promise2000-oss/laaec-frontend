async (page) => {
  await page.goto('https://saintfinbarrscollege.com/roles', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(3000);
  return await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table tbody tr')).map((tr) => {
      const cells = Array.from(tr.querySelectorAll('td')).map((td) => (td.innerText || '').trim().replace(/\s+/g, ' '));
      return cells.join(' :: ');
    });
    return JSON.stringify(rows, null, 1);
  });
}
