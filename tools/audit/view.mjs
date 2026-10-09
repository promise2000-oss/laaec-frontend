import { readFileSync } from 'node:fs';
const all = JSON.parse(readFileSync('C:/Users/USER/AppData/Local/Temp/opencode/sfc-digest.json', 'utf8'));
for (const pat of process.argv.slice(2)) {
  for (const r of all) {
    if (!r.route.includes(pat)) continue;
    console.log('\n########## ' + r.route + '  [' + r.title + ']');
    if (r.headings.length) console.log('H:', r.headings.join(' | '));
    if (r.tabs.length) console.log('TABS:', r.tabs.join(' | '));
    if (r.tableHeaders.length) console.log('TH:', r.tableHeaders.join(' | '), '(rows', r.rowCount + ')');
    if (r.buttons.length) console.log('BTN:', r.buttons.join(' | '));
    for (const f of r.fields) {
      console.log(
        '  F ' + f.tag + (f.type ? ':' + f.type : '') + ' "' + (f.label || f.placeholder) + '"' + (f.required ? ' *' : '') + (f.options ? ' OPTS[' + f.options.length + ']=' + f.options.slice(0, 12).join(',') : ''),
      );
    }
    console.log('TXT:', r.text.slice(0, 900));
  }
}
