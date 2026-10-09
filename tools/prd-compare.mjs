// Compares the requirement inventory of the source PRD PDF against the Markdown
// copy this build was implemented from, so "did we build everything the PRD
// asks for?" can be answered from the two documents rather than from memory.
//
//   node tools/prd-compare.mjs <pdf> <prd.md> <build-log.md>
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

const [pdfPath, mdPath, logPath] = process.argv.slice(2);
if (!pdfPath || !mdPath || !logPath) {
  console.error('usage: node tools/prd-compare.mjs <file.pdf> <prd.md> <BUILD-LOG.md>');
  process.exit(1);
}

/** Identifier runs in PDF text are split across lines, so tolerate whitespace. */
const ids = (text, prefix) => {
  const found = new Set();
  const re = new RegExp(`${prefix}-\\s*(\\d+)`, 'g');
  let m;
  while ((m = re.exec(text)) !== null) found.add(Number(m[1]));
  return [...found].sort((a, b) => a - b);
};

const parser = new PDFParse({ data: fs.readFileSync(pdfPath) });
const pdfText = (await parser.getText()).text;
const md = fs.readFileSync(mdPath, 'utf8');
const log = fs.readFileSync(logPath, 'utf8');

const show = (label, list) => (list.length ? list.join(',') : '(none)');
const ranges = (list) => {
  if (!list.length) return '(none)';
  const out = [];
  let start = list[0];
  let prev = list[0];
  for (const n of list.slice(1)) {
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    out.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = n;
    prev = n;
  }
  out.push(start === prev ? `${start}` : `${start}-${prev}`);
  return out.join(',');
};

const sets = {
  rf: { pdf: ids(pdfText, 'RF'), md: ids(md, 'RF') },
  uc: { pdf: ids(pdfText, 'UC'), md: ids(md, 'UC') },
  rec: { pdf: ids(pdfText, 'REC'), md: ids(md, 'REC') },
};

for (const [key, s] of Object.entries(sets)) {
  const inPdfOnly = s.pdf.filter((n) => !s.md.includes(n));
  const inMdOnly = s.md.filter((n) => !s.pdf.includes(n));
  console.log(`\n${key.toUpperCase()}  pdf=${s.pdf.length} (${ranges(s.pdf)})  md=${s.md.length} (${ranges(s.md)})`);
  console.log(`  only in PDF : ${show('', inPdfOnly)}`);
  console.log(`  only in MD  : ${show('', inMdOnly)}`);
}

/* how the PDF's page sections line up with the Markdown's */
const pdfPages = [...pdfText.matchAll(/3\.(\d)\s+(\/[a-z]*\/|[a-z]+)\s+—\s+([^\n]+)/g)].map(
  (m) => `3.${m[1]} ${m[2]} ${m[3].trim()}`,
);
console.log('\nPDF page sections:');
for (const p of pdfPages) console.log('  ' + p);

/* requirement status as recorded in the build ledger */
const status = (rf) => {
  const line = log
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.includes(`**RF-${rf}**`) && /^- \[/.test(l));
  if (!line) return 'absent from ledger';
  if (/^- \[x\] verified/.test(line)) return 'verified';
  if (/^- \[x\] done/.test(line)) return 'done';
  if (/^- \[ \] in progress/.test(line)) return 'in progress';
  return 'not started';
};
const tally = {};
const open = [];
for (const rf of sets.rf.md) {
  const state = status(rf);
  tally[state] = (tally[state] || 0) + 1;
  if (state !== 'verified' && state !== 'done') open.push(`RF-${rf} (${state})`);
}
console.log('\nMarkdown RF ledger status:');
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
if (open.length) {
  console.log('\nnot yet verified/done:');
  for (const o of open) console.log('  ' + o);
}
