import { readFileSync } from 'node:fs';
const all = JSON.parse(readFileSync('C:/Users/USER/AppData/Local/Temp/opencode/sfc-all-routes.json', 'utf8'));
const want = process.argv.slice(2);
for (const r of all) {
  if (want.length && !want.some((w) => r.route.includes(w))) continue;
  console.log('='.repeat(100));
  console.log('ROUTE', r.route, '|', r.title, '| http', r.httpStatus, '|', r.status);
  console.log('HEADINGS:', JSON.stringify(r.headings));
  console.log('TABS:', JSON.stringify(r.tabs));
  console.log('TABLE:', JSON.stringify(r.tableHeaders), 'rows', r.rowCount, 'canvases', r.chartCanvases);
  console.log('BUTTONS:', JSON.stringify(r.buttons));
  console.log('CARDS:', JSON.stringify(r.cards.slice(0, 8)));
  console.log('LINKS:', JSON.stringify(r.inPageLinks));
  console.log('FIELDS:');
  for (const f of r.fields) {
    console.log('  -', f.tag, f.type || '', JSON.stringify(f.label || f.placeholder), f.required ? 'REQUIRED' : '', f.options ? 'opts=' + JSON.stringify(f.options) : '');
  }
  console.log('TEXT:', r.text.slice(0, 2200));
}
