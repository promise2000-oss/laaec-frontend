import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = 'C:/Users/USER/AppData/Local/Temp/opencode/sfc-audit';
const seen = new Map();
for (const f of readdirSync(dir)) {
  if (!f.startsWith('routes-')) continue;
  for (const r of JSON.parse(readFileSync(dir + '/' + f, 'utf8'))) seen.set(r.route, r);
}
const all = [...seen.values()].sort((a, b) => a.route.localeCompare(b.route));
console.log('unique routes:', all.length);
for (const r of all) {
  const t = (r.title || '').replace(" | Saint Finbarr's College", '').replace(' | School Management System', '');
  console.log(
    r.route.padEnd(50),
    t.padEnd(32),
    'rows=' + String(r.rowCount).padEnd(4),
    'fields=' + String(r.fields.length).padEnd(4),
    'btns=' + String(r.buttons.length).padEnd(4),
    'links=' + String(r.inPageLinks.length),
  );
}
writeFileSync(dir + '/../sfc-all-routes.json', JSON.stringify(all, null, 1));
