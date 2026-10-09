import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import type { Connect } from 'vite';
import vue from '@vitejs/plugin-vue';

// RF-1: the build serves exactly eight HTML documents at the documented
// paths (decision D-01: Vite multi-page build).
const entry = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// RF-1 alias behaviour: the live origin answers 308 Permanent Redirect for
// /admin -> /admin/ (and every other page directory). Verified 2026-09-28.
const PAGE_DIRS = ['login', 'exam', 'control', 'admin', 'ca', 'ict', 'comm'];

const trailingSlashAlias: Connect.NextHandleFunction = (req, res, next) => {
  const url = req.url ?? '';
  const m = /^\/([a-z]+)(\?.*)?$/.exec(url);
  if (m && PAGE_DIRS.includes(m[1])) {
    res.statusCode = 308;
    res.setHeader('Location', `/${m[1]}/${m[2] ?? ''}`);
    res.end();
    return;
  }
  next();
};

const aliasPlugin = () => ({
  name: 'laec-trailing-slash-alias',
  configureServer(server: { middlewares: { use: typeof trailingSlashAlias } }) {
    server.middlewares.use(trailingSlashAlias);
  },
  configurePreviewServer(server: { middlewares: { use: typeof trailingSlashAlias } }) {
    server.middlewares.use(trailingSlashAlias);
  },
});

export default defineConfig({
  plugins: [vue(), aliasPlugin()],
  // amazon-cognito-identity-js (approved, D-11) references Node's `global`
  // at module scope; alias it to `globalThis` so it runs in the browser.
  define: { global: 'globalThis' },
  server: {
    // origin-pages/ and origin-assets/ hold read-only reference copies of the
    // live site (never served, never built) — keep them out of the watcher.
    watch: { ignored: ['**/origin-pages/**', '**/origin-assets/**'] },
  },
  build: {
    rollupOptions: {
      input: {
        main: entry('./index.html'),
        login: entry('./login/index.html'),
        exam: entry('./exam/index.html'),
        control: entry('./control/index.html'),
        admin: entry('./admin/index.html'),
        ca: entry('./ca/index.html'),
        ict: entry('./ict/index.html'),
        comm: entry('./comm/index.html'),
        // Added by the exam-management addendum (D-56), not origin pages.
        teacher: entry('./teacher/index.html'),
        central: entry('./central/index.html'),
        // D-64 additions, not origin pages.
        calendar: entry('./calendar/index.html'),
        notices: entry('./notices/index.html'),
        // The six role-scoped login doors (2026-10-02). Nested under the
        // existing login/ entry because they are the same page component; the
        // slugs come from lib/portals.ts and are repeated here only because
        // rollupOptions.input has to be static. tools/check-doors.mjs verifies
        // this list against portals.ts, the router and the documents on disk —
        // run it alongside the other tools/check-*.mjs contracts, none of which
        // are wired into the build script.
        'login-school': entry('./login/school/index.html'),
        'login-ict': entry('./login/ict/index.html'),
        'login-committee': entry('./login/committee/index.html'),
        'login-teacher': entry('./login/teacher/index.html'),
        'login-central': entry('./login/central/index.html'),
        'login-super': entry('./login/super/index.html'),
      },
    },
  },
});
