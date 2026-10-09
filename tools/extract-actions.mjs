// Extracts every `action: "NAME"` payload from the original front-end code
// (origin-pages/*.html inline scripts + public/*.js) and reports the object
// fields observed for each. Feeds the typed mock adapter (decision D-05).
// Run: node tools/extract-actions.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/Users/USER/Documents/laaec-audit';

const htmlFiles = fs.readdirSync(path.join(ROOT, 'origin-pages')).filter((f) => f.endsWith('.html'));
const jsFiles = fs.readdirSync(path.join(ROOT, 'public')).filter((f) => f.endsWith('.js'));

function scriptsOf(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.js')) return [text];
  return [...text.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

function enclosingObject(src, at) {
  // walk backwards to the '{' that opens the literal containing `at`
  let depth = 0;
  let open = -1;
  for (let i = at; i >= 0; i--) {
    const c = src[i];
    if (c === '}') depth++;
    else if (c === '{') {
      if (depth === 0) { open = i; break; }
      depth--;
    }
  }
  if (open < 0) return null;
  // walk forward to its match
  depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

function topLevelKeys(obj) {
  const keys = [];
  let depth = 0;
  let lastEnd = 1;
  const take = (seg) => {
    const s = seg.trim();
    if (!s) return;
    const k = /^(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))\s*:/.exec(s);
    if (k) { keys.push(k[1] ?? k[2] ?? k[3]); return; }
    if (/^[A-Za-z_$][\w$]*$/.test(s)) keys.push(s); // shorthand: { records }
  };
  for (let i = 1; i < obj.length - 1; i++) {
    const c = obj[i];
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
    else if (depth === 0 && c === ',') {
      take(obj.slice(lastEnd, i));
      lastEnd = i + 1;
    }
  }
  take(obj.slice(lastEnd, obj.length - 1));
  return keys;
}

const report = new Map(); // action -> { files:Set, fields:Map<field, count>, snippets:[] }

for (const name of [...htmlFiles.map((f) => path.join(ROOT, 'origin-pages', f)), ...jsFiles.map((f) => path.join(ROOT, 'public', f))]) {
  for (const script of scriptsOf(name)) {
    // style 1: POST bodies — { action: 'X', ... } (single OR double quotes)
    for (const m of script.matchAll(/action:\s*['"]([A-Z_]+)['"]/g)) {
      const action = m[1];
      const obj = enclosingObject(script, m.index);
      const rec = report.get(action) ?? { files: new Set(), fields: new Map(), via: new Set() };
      rec.files.add(path.basename(name));
      rec.via.add('POST-body');
      if (obj) for (const k of topLevelKeys(obj)) rec.fields.set(k, (rec.fields.get(k) ?? 0) + 1);
      else rec.fields.set('(object not parsed)', 1);
      report.set(action, rec);
    }
    // style 2: GET query strings — ?action=X&param=…
    for (const m of script.matchAll(/\?action=([A-Z_]+)(&[A-Za-z0-9_]+=[^'"`\s)]*)*/g)) {
      const action = m[1];
      const rec = report.get(action) ?? { files: new Set(), fields: new Map(), via: new Set() };
      rec.files.add(path.basename(name));
      rec.via.add('GET-query');
      rec.fields.set('action', (rec.fields.get('action') ?? 0) + 1);
      const qs = m[0].slice(m[0].indexOf('&') + 1);
      if (m[0].includes('&')) {
        for (const p of qs.matchAll(/([A-Za-z0-9_]+)=/g)) rec.fields.set(p[1], (rec.fields.get(p[1]) ?? 0) + 1);
      }
      report.set(action, rec);
    }
  }
}

const PRD_ACTIONS = [
  'GET_PORTAL_STATE', 'GET_STUDENT_PROFILE', 'GET_LIVE_SCHEDULE', 'GET_RESULTS', 'GET_SECURE_QUESTIONS',
  'GET_QUESTION_INVENTORY', 'GET_STUDENTS', 'GET_CONFIG', 'GET_COGNITO_ADMINS', 'GET_EXAM_CONFIG', 'GET_DEMOTION_LOGS',
  'SUBMIT_EXAM_RESULT', 'END_STUDENT_SESSION', 'UPDATE_STUDENT_SUBJECTS', 'UPDATE_MODE', 'UPDATE_PORTAL',
  'UPDATE_EXAM_SETTINGS', 'UPDATE_SESSION_CONFIG', 'EXECUTE_PROMOTION', 'TRIGGER_ARCHIVE', 'CREATE_ADMIN_ACCESS',
  'DELETE_ADMIN_ACCESS', 'UPDATE_ADMIN_STATUS', 'REQUEST_ADMIN_PASSWORD_RESET', 'CONFIRM_ADMIN_PASSWORD_RESET',
  'SEND_ADMIN_PASSWORD_CHANGED_EMAIL', 'BULK_UPLOAD_QUESTIONS', 'UPLOAD_QUESTION_IMAGE', 'ADD_QUESTION',
  'UPDATE_QUESTION', 'DELETE_QUESTION', 'DELETE_QUESTION_PAPER', 'REMARK_STUDENT_RESULTS', 'DELETE_SUBJECT_RESULTS',
  'DELETE_STUDENT_RESULT', 'DELETE_STUDENT', 'DELETE_FLAGGED_RESULTS', 'UPDATE_STUDENT_CLASS_ARM',
];

console.log('PRD actions:', PRD_ACTIONS.length, '| observed in code:', report.size);
console.log('\n=== OBSERVED PAYLOADS ===');
for (const [action, rec] of [...report].sort()) {
  const inPrd = PRD_ACTIONS.includes(action);
  console.log(`${action}${inPrd ? '' : '  <-- NOT in PRD §3.6 list'}  [${[...rec.files].join(', ')}]  (${[...rec.via].join('+')})`);
  console.log(`   keys: ${[...rec.fields].map(([k, n]) => (n > 1 ? `${k}(${n}x)` : k)).join(', ')}`);
}
console.log('\n=== NOT OBSERVED (shapes unknown -> unconfirmed) ===');
console.log(PRD_ACTIONS.filter((a) => !report.has(a)).join(', '));
