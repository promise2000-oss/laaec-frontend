// Generates COLOUR-SPEC.md from LAEC-Colour-Spec.pdf (approved: D-02, pdf-parse dev-only).
// Run: node tools/extract-colour-spec.mjs
import fs from 'node:fs';
import { PDFParse } from 'pdf-parse';

const SRC = 'C:/Users/USER/Desktop/LAEC-Colour-Spec.pdf';
const OUT = 'C:/Users/USER/Documents/laaec-audit/COLOUR-SPEC.md';

const parser = new PDFParse({ data: fs.readFileSync(SRC) });
const r = await parser.getText();

const pageText = Array.isArray(r.pages) && r.pages.length && typeof r.pages[0]?.text === 'string'
  ? r.pages.map((p, i) => `## Page ${i + 1}\n\n${p.text.trim()}`)
  : [`## Extracted text (${r.total} pages)\n\n${r.text}`];

const head = `# COLOUR-SPEC — LAEC Exact Colour Specification

> Generated 2026-09-28 from \`LAEC-Colour-Spec.pdf\` (12 pages) with pdf-parse 2.4.5, per decision D-02.
> Source document extracted 2026-09-26 by reading declared CSS custom properties, literal colour values and
> \`getComputedStyle()\` on live rendered elements.
> This file is the colour and typography source of truth for the build. Review before use — extraction is
> verbatim text and does not reconstruct the PDF's tables; where layout is lost, the PDF governs.

`;

fs.writeFileSync(OUT, head + pageText.join('\n\n---\n\n') + '\n', 'utf8');
console.log('wrote', OUT, '| pages:', r.total, '| chars:', pageText.join('').length);

// cross-check: hex values present here vs REF-2 (colors.md)
const hex = s => new Set([...s.toLowerCase().matchAll(/#[0-9a-f]{6}\b/g)].map(m => m[0]));
const spec = hex(pageText.join('\n'));
const ref = hex(fs.readFileSync('C:/Users/USER/Desktop/colors.md', 'utf8'));
const inBoth = [...spec].filter(h => ref.has(h));
console.log('COLOUR-SPEC hex:', spec.size, '| colors.md hex:', ref.size, '| shared:', inBoth.length);
console.log('in spec not in colors.md:', [...spec].filter(h => !ref.has(h)).join(' ') || '(none)');
