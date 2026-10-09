async (page) => {
  await page.goto('https://saintfinbarrscollege.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(3200);
  const out = await page.evaluate(() => {
    const t = (n) => ((n && n.innerText) || '').trim().replace(/\s+/g, ' ');
    const root = document.querySelector('main') || document.body;
    const sections = [];
    root.querySelectorAll('section, [class*="rounded-2xl"]').forEach((sec) => {
      const heading = t(sec.querySelector('h1,h2,h3')).slice(0, 60);
      if (!heading) return;
      const cards = Array.from(sec.querySelectorAll('a[href]')).map((a) => ({ href: a.getAttribute('href'), text: t(a).slice(0, 70) }));
      if (cards.length) sections.push({ heading, cards });
    });
    const side = document.querySelector('[class*="sidebar"]');
    const nav = [];
    if (side) {
      let group = '';
      for (const el of Array.from(side.querySelectorAll('*'))) {
        if (el.children.length !== 0) continue;
        const label = t(el);
        if (!label || label.length > 40) continue;
        const a = el.closest('a');
        if (a) nav.push({ group, label, href: a.getAttribute('href') });
        else group = label;
      }
    }
    return { sections, nav };
  });
  await fetch('http://127.0.0.1:8787/?name=dashnav.json', { method: 'POST', body: JSON.stringify(out) });
  return 'sections=' + out.sections.length + ' nav=' + out.nav.length;
}
