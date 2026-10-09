async (page) => {
  const seen = [];
  const handler = (req) => {
    try {
      const r = req.resourceType();
      if (r !== 'xhr' && r !== 'fetch') return;
      const u = req.url();
      seen.push({ m: req.method(), u, pt: (req.postData() || '').slice(0, 400) });
    } catch {}
  };
  page.on('request', handler);
  for (const r of ['/dashboard', '/users', '/students', '/results/enter']) {
    await page.goto('https://saintfinbarrscollege.com' + r, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
    await page.waitForTimeout(3000);
  }
  page.off('request', handler);
  const out = seen.map((s) => {
    const u = new URL(s.u);
    return {
      method: s.m,
      host: u.host,
      path: u.pathname,
      queryKeys: Array.from(u.searchParams.keys()),
      bodyKeys: (() => {
        if (!s.pt) return [];
        try {
          const o = JSON.parse(s.pt);
          return Object.keys(o);
        } catch {
          return ['<non-json:' + s.pt.slice(0, 40) + '>'];
        }
      })(),
    };
  });
  const seenKey = new Set();
  const uniq = [];
  for (const o of out) {
    const k = o.method + ' ' + o.host + o.path;
    if (seenKey.has(k)) continue;
    seenKey.add(k);
    uniq.push(o);
  }
  await fetch('http://127.0.0.1:8787/?name=api-observations.json', { method: 'POST', body: JSON.stringify(uniq) });
  return JSON.stringify(uniq).slice(0, 6000);
}
