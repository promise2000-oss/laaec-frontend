// Builds a minimal .xlsx whose shared strings carry rich formatting runs
// (bold / italic / underline / subscript / superscript) plus inline HTML, so
// `/config.js`'s `parseRichWorksheetCells` -> `extractFormattedQuestionRows`
// path can be verified end to end in the browser (RF-101).
//
// SheetJS' community build cannot *write* rich text, and no zip library is
// approved for this project, so the workbook is emitted by hand: a stored
// (uncompressed) ZIP is a few dozen lines and needs no dependencies.
//
//   node tools/make-rich-xlsx.mjs > tools/rich-question-paper.b64
import { deflateRawSync } from 'node:zlib';

/* ── CRC-32 ──────────────────────────────────────────────────────────── */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/* ── a stored-entry ZIP writer ───────────────────────────────────────── */
const zip = (entries) => {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const raw = Buffer.from(text, 'utf8');
    const data = deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // method: deflate
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(0x2821, 12); // date: 2020-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);
    locals.push(local, data);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x2821, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);
    centrals.push(central);

    offset += local.length + data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralBuf, eocd]);
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Four shared strings, one per formatting run, plus one inline-HTML string.
 * Index order is the row order the sheet references.
 */
const richStrings = [
  '<si><r><rPr><b/></rPr><t>State the </t></r><r><rPr><i/></rPr><t>primary blue</t></r><r><t> declared by the portal theme.</t></r></si>',
  '<si><r><rPr><u/></rPr><t>NICEGENE TECHNOLOGIES</t></r><r><t> builds and maintains the portal.</t></r></si>',
  '<si><r><rPr><vertAlign val="subscript"/></rPr><t>H</t></r><r><rPr><vertAlign val="superscript"/></rPr><t>2</t></r><r><t>O splits a candidate screen at 0.78.</t></r></si>',
  '<si><r><t>Inline </t></r><r><rPr><b/><i/></rPr><t>bold italic</t></r><r><t> markup.</t></r></si>',
];

const headers = ['QUESTION', 'A', 'B', 'INSTRUCTION'];
/* Every option column is a shared string; A and B carry rich runs, the rest are plain. */
const plain = ['#004a99', '#ffffff', 'Read the instruction before you answer.'];

/*
 * Shared-string table order decides the indices the sheet references, so the
 * headers come first and the data rows point at 4.. onwards. (Writing the header
 * text straight into a `t="s"` cell instead of its index is what makes SheetJS
 * drop the whole sheet.)
 */
const headerIndex = headers.map((_, i) => i);
const firstRich = headers.length;
const richIndex = richStrings.map((_, i) => firstRich + i);
const plainIndex = plain.map((_, i) => firstRich + richStrings.length + i);

const rows = [
  [richIndex[0], richIndex[1], richIndex[2], richIndex[3]],
  [plainIndex[0], plainIndex[0], plainIndex[1], plainIndex[2]],
  [richIndex[1], plainIndex[0], plainIndex[1], plainIndex[2]],
];

const sheetRows = [headerIndex, ...rows]
  .map((cells, r) => {
    const cols = cells
      .map((c, i) => {
        const address = `${String.fromCharCode(65 + i)}${r + 1}`;
        return `<c r="${address}" t="s"><v>${c}</v></c>`;
      })
      .join('');
    return `<row r="${r + 1}">${cols}</row>`;
  })
  .join('');

const allStrings = [
  ...headers.map((text) => `<si><t>${esc(text)}</t></si>`),
  ...richStrings,
  ...plain.map((text) => `<si><t>${esc(text)}</t></si>`),
];

const entries = [
  [
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`,
  ],
  [
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  ],
  [
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr codeName="ThisWorkbook"/><sheets><sheet name="Questions" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  ],
  [
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
  ],
  [
    'xl/sharedStrings.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${allStrings.length}" uniqueCount="${allStrings.length}">${allStrings.join('')}</sst>`,
  ],
  [
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:D4"/><sheetData>${sheetRows}</sheetData></worksheet>`,
  ],
];

const buffer = zip(entries);
process.stderr.write(`rich-question-paper.xlsx: ${buffer.length} bytes, ${allStrings.length} shared strings\n`);
process.stdout.write(buffer.toString('base64'));
