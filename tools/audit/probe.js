async (page) => {
  const seen = [];
  const handler = (msg) => {
    try {
      const r = msg.request();
      const u = r.url();
      if (u.includes('saintfinbarrscollege') || u.includes('/api/')) {
        seen.push({ m: r.method(), u, pt: (msg.request().postData() || '').slice(0, 300) });
      }
    } catch {}
  };
  page.on('request', handler);
  for (const r of ['/dashboard', '/users', '/roles', '/students', '/staff', '/results/enter', '/school-fees/payments', '/wallets', '/inventory/sales', '/store/queue', '/notifications', '/permissions']) {
    await page.goto('https://saintfinbarrscollege.com' + r, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
    await page.waitForTimeout(2600);
  }
  page.off('request', handler);
  // Strip cookies / auth headers entirely: only method + path + a body shape summary.
  const out = seen.map((s) => ({
    method: s.m,
    path: s.u.replace('https://saintfinbarrscollege.com', '').split('?')[0],
    queryKeys: (s.u.split('?')[1] || '').split('&').filter(Boolean).map((kv) => kv.split('=')[0]),
    bodyKeys: s.pt ? (() => { try { const o = JSON.parse(s.pt); return Object.keys(o); } catch { return ['<non-json>']; } })() : [],
  }));
  const uniq = [];
  const seenKey = new Set();
  for (const o of out) {
    const k = o.method + ' ' + o.path;
    if (seenKey.has(k)) continue;
    seenKey.add(k);
    uniq.push(o);
  }
  await fetch('http://127.0.0.1:8787/?name=api-observations.json', { method: 'POST', body: JSON.stringify(uniq) });
  return JSON.stringify(uniq);
}
