// Extracts the text of a PDF so its inventory can be compared with the Markdown
// copy this build was implemented from. Diagnostic only - writes a .txt next to
// the PDF and prints a short structural summary.
//
//   node tools/pdf-text.mjs <path-to.pdf>
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

const target = process.argv[2];
if (!target) {
  console.error('usage: node tools/pdf-text.mjs <file.pdf>');
  process.exit(1);
}

const buffer = fs.readFileSync(target);
const parser = new PDFParse({ data: buffer });
const parsed = await parser.getText();
const numpages = parsed.total;
const text = parsed.text;
const out = target.replace(/\.pdf$/i, '.txt');
fs.writeFileSync(out, text, 'utf8');

const lines = text.split('\n');
const rfIds = [...new Set((text.match(/RF-\d+/g) || []))].sort(
  (a, b) => Number(a.slice(3)) - Number(b.slice(3)),
);
const ucIds = [...new Set((text.match(/UC-\d+/g) || []))].sort(
  (a, b) => Number(a.slice(3)) - Number(b.slice(3)),
);
const recIds = [...new Set((text.match(/REC-\d+/g) || []))].sort(
  (a, b) => Number(a.slice(4)) - Number(b.slice(4)),
);
const qIds = [...new Set((text.match(/\bQ\d+\b/g) || []))].sort(
  (a, b) => Number(a.slice(1)) - Number(b.slice(1)),
);
const versions = [...new Set((text.match(/v\d+\.\d+/g) || []))];

console.log(`pages            ${numpages}`);
console.log(`versions seen    ${versions.join(', ') || '(none)'}`);
console.log(`characters       ${text.length}`);
console.log(`RF ids           ${rfIds.length}  (${rfIds[0]}..${rfIds[rfIds.length - 1]})`);
console.log(`UC ids           ${ucIds.length}  (${ucIds[0]}..${ucIds[ucIds.length - 1]})`);
console.log(`REC ids          ${recIds.length}  (${recIds[0]}..${recIds[recIds.length - 1]})`);
console.log(`Q ids            ${qIds.length}`);
console.log(`text written to  ${out}`);
