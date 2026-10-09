import { readFileSync, writeFileSync } from 'node:fs';
const all = JSON.parse(readFileSync('C:/Users/USER/AppData/Local/Temp/opencode/sfc-all-routes.json', 'utf8'));
// Compact digest: per route, the observable structure without the noisy field
// checkbox rows (roles/new alone contributes 184 identical "Select all" boxes).
const out = all.map((r) => {
  const seen = new Set();
  const fields = [];
  for (const f of r.fields) {
    const key = `${f.tag}|${f.type}|${f.label}|${f.required}|${(f.options || []).join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    fields.push({ ...f, options: f.options ? f.options.slice(0, 24) : undefined });
  }
  return {
    route: r.route,
    title: r.title,
    headings: r.headings,
    tabs: r.tabs,
    tableHeaders: r.tableHeaders,
    rowCount: r.rowCount,
    buttons: r.buttons,
    fields,
    links: r.inPageLinks,
    text: r.text.slice(0, 1400),
  };
});
writeFileSync('C:/Users/USER/AppData/Local/Temp/opencode/sfc-digest.json', JSON.stringify(out, null, 1));
console.log('routes', out.length);
