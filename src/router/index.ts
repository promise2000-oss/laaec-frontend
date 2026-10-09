import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { ROLE_PORTALS } from '../lib/portals';
import ControlView from '../views/ControlView.vue';

/**
 * Eight routes matching PRD §3.1 (the brief's §2.1).
 * Guards: RF-2 on /exam/, RF-3 on /admin/. Per decision D-11 (RF-95 replicated
 * as observed) /ca/, /ict/ and /comm/ carry NO client-side role guard.
 *
 * `/teacher/` and `/central/` are the tenth and eleventh, added by the
 * exam-management addendum (D-56). They are not origin pages, so RF-1's
 * "exactly eight documents" no longer holds — see the deviation entry, which
 * records that the eight origin pages are untouched and the two new ones are
 * additions.
 *
 * The six /login/<role>/ doors (2026-10-02) are generated from ROLE_PORTALS so
 * a door cannot exist in `lib/portals.ts` without a route to serve it. They all
 * render the existing ControlView with a `portal` prop, which is what scopes
 * the login to one claim. `/control/` itself is untouched.
 */
const ROLE_DOOR_ROUTES: RouteRecordRaw[] = ROLE_PORTALS.map((portal) => ({
  path: `login/${portal.slug}/`,
  name: `login-${portal.slug}`,
  component: ControlView,
  props: { portal },
}));

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('../layouts/PublicLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('../views/HomeView.vue') },
      { path: 'login/', name: 'login', component: () => import('../views/LoginView.vue') },
      { path: 'control/', name: 'control', component: () => import('../views/ControlView.vue') },
      // Unscoped on purpose: no `portal` prop, so this keeps the origin's
      // role-agnostic behaviour.
      ...ROLE_DOOR_ROUTES,
    ],
  },
  {
    path: '/',
    component: () => import('../layouts/ExamLayout.vue'),
    children: [{ path: 'exam/', name: 'exam', component: () => import('../views/ExamView.vue') }],
  },
  {
    path: '/',
    component: () => import('../layouts/AdminLayout.vue'),
    children: [
      { path: 'admin/', name: 'admin', component: () => import('../views/AdminView.vue') },
      { path: 'ca/', name: 'ca', component: () => import('../views/CaView.vue') },
      { path: 'ict/', name: 'ict', component: () => import('../views/IctView.vue') },
      { path: 'comm/', name: 'comm', component: () => import('../views/CommView.vue') },
      // Added by the exam-management addendum, not origin pages (D-56).
      { path: 'teacher/', name: 'teacher', component: () => import('../views/TeacherView.vue') },
      { path: 'central/', name: 'central', component: () => import('../views/CentralView.vue') },
      // Notification centre, academic calendar and notice board (D-64). Not
      // origin pages; the notification centre itself lives in the AppShell.
      { path: 'calendar/', name: 'calendar', component: () => import('../views/CalendarView.vue') },
      { path: 'notices/', name: 'notices', component: () => import('../views/NoticesView.vue') },
    ],
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

// RF-2: /exam/ redirects to /login/ unless sessionStorage holds both keys.
router.beforeEach((to) => {
  if (to.name === 'exam') {
    const active = sessionStorage.getItem('activeStudent');
    const subject = sessionStorage.getItem('selectedSubject');
    if (!active || !subject) return { name: 'login' };
    return true;
  }

  const session = localStorage.getItem('LAEC_Session');
  const role = (localStorage.getItem('AdminRole') || '').toUpperCase();

  /*
   * D-71 revises D-11. The origin gave /ca/, /ict/ and /comm/ no client-side
   * guard at all (RF-95, replicated as observed), and D-61 kept the nav
   * filtering cosmetic. The client asked for the reference application's
   * model instead, so each console now declares the role it belongs to and
   * an operator without it is returned to /control/ — the same redirect the
   * origin already used for a rejected SUPER_ADMIN on /admin/ (RF-3).
   *
   * SUPER_ADMIN reaches every console. That is the client's requirement, and it
   * is now backed by a real grant rather than an exemption: `roles.ts` gives
   * SUPER_ADMIN the union of the other five roles' default permissions, so a
   * console's own controls and its rail agree for that session. Under the old
   * exemption they did not — the rail showed every item and the controls behind
   * them stayed filtered — which is why the exemption was removed rather than
   * relied upon.
   *
   * The reference application would confine a super administrator to its own
   * dashboard; that is not transplanted, because /ca/ owns Registration Portal
   * and Examination Center, which no other console has, so confining would
   * remove access rather than focus it.
   */
  const CONSOLE_ROLE: Record<string, string> = {
    admin: 'SUPER_ADMIN',
    ca: 'SCHOOL_ADMIN',
    ict: 'ICT_ADMIN',
    comm: 'EXAM_COMMITTEE',
    teacher: 'TEACHER',
    central: 'CENTRAL_ADMIN',
  };

  const name = String(to.name || '');

  if (name in CONSOLE_ROLE) {
    if (!session) return { name: 'control' };
    if (role !== 'SUPER_ADMIN' && role !== CONSOLE_ROLE[name]) return { name: 'control' };
    return true;
  }

  // /calendar/ and /notices/ are shared surfaces: any signed-in operator.
  if (name === 'calendar' || name === 'notices') {
    if (!session || !role) return { name: 'control' };
    return true;
  }

  // D-11 (RF-95): /ca/, /ict/ and /comm/ no longer carry this exception.
  return true;
});

/*
 * Keep <body>'s surface and page class in step with the route.
 *
 * Every one of the twelve pages is its own HTML entry (D-01), and each entry
 * declares its own static `<body class="surface-X page-Y">`. That is correct
 * for a document load but not for Vue Router, which moves between those routes
 * without reloading — so the class stayed whatever document the session was
 * opened on. Every per-page stylesheet is gated on exactly that pair
 * (`styles/ca-page.css`, `admin-page.css`, `comm-page.css`, `ict-page.css`,
 * `glass.css`, and the Calendar/Notices/Central/Teacher views), which made the
 * gates silently fail: opening Notice Board from the school console applied
 * the console rules to the notice board and none of its own, so its header
 * spanned the sidebar and its search field stretched the full width.
 *
 * The mapping mirrors the twelve `<body>` tags one for one; a route missing
 * from it keeps whatever it has rather than being blanked.
 */
const BODY_CLASS: Record<string, string> = {
  home: 'surface-glass page-home',
  login: 'surface-glass page-login',
  control: 'surface-glass page-control',
  // The six role-scoped doors. `page-control-door` stacks and scrolls so the
  // door switcher can sit under the card; see styles/glass.css.
  'login-school': 'surface-glass page-control page-control-door',
  'login-ict': 'surface-glass page-control page-control-door',
  'login-committee': 'surface-glass page-control page-control-door',
  'login-teacher': 'surface-glass page-control page-control-door',
  'login-central': 'surface-glass page-control page-control-door',
  'login-super': 'surface-glass page-control page-control-door',
  exam: 'surface-nj page-exam',
  admin: 'surface-enterprise page-admin',
  ca: 'surface-enterprise page-ca',
  ict: 'surface-enterprise page-ict',
  comm: 'surface-enterprise page-comm',
  teacher: 'surface-enterprise page-teacher',
  central: 'surface-enterprise page-central',
  calendar: 'surface-enterprise page-calendar',
  notices: 'surface-enterprise page-notices',
};

router.afterEach((to) => {
  const next = BODY_CLASS[String(to.name || '')];
  if (!next) return;
  // Only the two families this hook owns are replaced, so a class another
  // feature has put on the body (a modal lock, for instance) survives.
  const retained = [...document.body.classList].filter(
    (cls) => !cls.startsWith('surface-') && !cls.startsWith('page-'),
  );
  const applied = [...retained, ...next.split(' ')].join(' ');
  if (document.body.className !== applied) document.body.className = applied;
});
