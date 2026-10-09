// Generates the HTML entry documents (RF-1, decision D-01).
//
// The first eight are the origin's own pages. `/teacher/` and `/central/` are
// added by the exam-management addendum (D-56) and are not replicas: they take
// the enterprise surface and the console webfont the other four consoles use,
// but point their favicon at an asset this build actually serves.
// Run: node tools/gen-entries.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/Users/USER/Documents/laaec-audit';

// Titles are verbatim from PRD §3.1, including the incorrect /ict/ title (replicate, D-11 context).
// body class = surface root + page class, so tokens scope to their own pages from first paint.
// font: exactly what the live original loads (D-25 — /login/ and /control/ declare Inter
// but never load a webfont; replicated as observed). Favicon: /laec%20logo.png on every
// page in the original — the reference must fail, because we do not serve that file (D-13).
const FONTS = {
  inter: '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">',
  admin:
    '<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">',
  none: '',
};

// /config.js is the shared first-party library: loaded by every origin page
// except / (grep of origin-pages). Served from public/ as-is (D-03).
const CFG = '<script src="/config.js"></script>';

/*
 * The console pages' remaining first-party assets, in the origin's own head
 * order (origin-pages/ca.html lines 1-40). They are served from public/ as-is
 * (D-03). `admin-sidebar.css` is linked last on purpose: the sidebar library
 * relocates the navigation into the body at runtime and its stylesheet has to
 * win against the page stylesheet, so it is the final link in the head.
 */
const CONSOLE_STYLES = [
  '<link rel="stylesheet" href="/exam-session-controls.css">',
  '<link rel="stylesheet" href="/dashboard-registration.css?v=20260608-photo-upload">',
];
const CONSOLE_SCRIPTS = [
  '<script src="/config.js"></script>',
  '<script src="/dashboard-overview.js"></script>',
  '<script src="/exam-session-controls.js"></script>',
  '<script src="/question-management.js"></script>',
  '<script src="/admin-sidebar.js"></script>',
];
const SIDEBAR_CSS = '<link rel="stylesheet" href="/admin-sidebar.css">';

/** Which first-party assets each page kind loads in its head. */
const ASSETS = {
  console: { styles: CONSOLE_STYLES, scripts: CONSOLE_SCRIPTS, sidebarCss: true },
  exam: {
    styles: '<link rel="stylesheet" href="/exam-session-controls.css">',
    scripts: '<script src="/config.js"></script><script src="/exam-session-controls.js"></script>',
    sidebarCss: false,
  },
  addendum: {
    /* The two addendum consoles are not origin pages: no sidebar library, no
       registration portal and no question manager, because they are not part
       of the portal the capture shows. config.js still backs their subject
       humanising. */
    styles: '',
    scripts: '<script src="/config.js"></script>',
    sidebarCss: false,
  },
};

const PAGES = [
  /* head assets: the four consoles get the full set, /exam/ only the paper-queue
     pair, the three public pages only /config.js (and / not even that). */
  { dir: '', title: 'LAEC | Official CBT Portal', surface: 'surface-glass', page: 'page-home', font: FONTS.inter, cfg: false },
  { dir: 'login', title: 'LAEC | Examination Login', surface: 'surface-glass', page: 'page-login', font: FONTS.none, cfg: true },
  { dir: 'exam', title: 'LAEC | Secure Examination Hall', surface: 'surface-nj', page: 'page-exam', font: FONTS.none, assets: 'exam' },
  { dir: 'control', title: 'LAEC | Admin Command Center', surface: 'surface-glass', page: 'page-control', font: FONTS.none, cfg: true },
  { dir: 'admin', title: 'LAEC | Master Command Center', surface: 'surface-enterprise', page: 'page-admin', font: FONTS.admin, assets: 'console' },
  { dir: 'ca', title: 'LAEC | School Admin Portal', surface: 'surface-enterprise', page: 'page-ca', font: FONTS.admin, assets: 'console' },
  { dir: 'ict', title: 'LAEC | School Admin Portal', surface: 'surface-enterprise', page: 'page-ict', font: FONTS.admin, assets: 'console' },
  { dir: 'comm', title: 'LAEC | Exam Committee Portal', surface: 'surface-enterprise', page: 'page-comm', font: FONTS.admin, assets: 'console' },
  /* Added by the addendum, not origin pages (D-56). */
  { dir: 'teacher', title: 'LAEC | Teacher Portal', surface: 'surface-enterprise', page: 'page-teacher', font: FONTS.admin, favicon: '/nicegene_logo.png', assets: 'addendum' },
  { dir: 'central', title: 'LAEC | Central Administration', surface: 'surface-enterprise', page: 'page-central', font: FONTS.admin, favicon: '/nicegene_logo.png', assets: 'addendum' },
  /* D-64: the calendar and the notice board, also not origin pages. */
  { dir: 'calendar', title: 'LAEC | Academic Calendar', surface: 'surface-enterprise', page: 'page-calendar', font: FONTS.admin, favicon: '/nicegene_logo.png', assets: 'addendum' },
  { dir: 'notices', title: 'LAEC | Notice Board', surface: 'surface-enterprise', page: 'page-notices', font: FONTS.admin, favicon: '/nicegene_logo.png', assets: 'addendum' },
];

/*
 * `styles` and `scripts` are arrays, and interpolating an array into a template
 * literal stringifies it with `Array.prototype.toString` — which joins the
 * elements with COMMAS. That is the source of the `,<link ...>` and
 * `,<script ...>` sequences in the four console entries: the commas are not in
 * the document by accident, they are what the generator emits.
 *
 * In the HTML parser that matters more than it looks. A `,` in <head> is
 * character data, and character data in <head> closes the head element and
 * forces the parser to reopen <body> — so the stray commas became the first
 * text node in the body of /admin/, /ca/, /ict/ and /comm/, rendering as a
 * visible "ᴵᴵᴵᴵ"-like mark above the header and pushing the whole shell 20px
 * down the page. The array is now joined explicitly, one tag per line.
 */
const joinLines = (parts) => (Array.isArray(parts) ? parts.join('\n    ') : parts || '');

const tpl = (title, surface, page, font, cfg, favicon, assets) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="${favicon || '/laec%20logo.png'}" type="image/png" />
    <title>${title}</title>
    ${font}
    ${joinLines(ASSETS[assets] ? ASSETS[assets].styles : '')}
    ${cfg ? CFG : ''}
    ${joinLines(ASSETS[assets] ? ASSETS[assets].scripts : '')}
    ${ASSETS[assets] && ASSETS[assets].sidebarCss ? SIDEBAR_CSS : ''}
  </head>
  <body class="${surface} ${page}">
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;

for (const p of PAGES) {
  const dir = p.dir ? path.join(ROOT, p.dir) : ROOT;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), tpl(p.title, p.surface, p.page, p.font, p.cfg, p.favicon, p.assets), 'utf8');
  console.log('wrote', path.relative(ROOT, path.join(dir, 'index.html')), '—', p.title);
}
