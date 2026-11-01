<script setup lang="ts">
/**
 * PRD §4.5 — `/admin/` — Master Command Center (Super Administrator).
 *
 * STAGE 2 of this page's build (see BUILD-LOG). Shipped so far:
 *  - the document shell, all seven tab panels with the origin's ids, the
 *    guard, RF-5 idle timer, tab switching, custom alert, back-to-top and
 *    the first-party library wiring (stage 1);
 *  - the origin's shell semantics corrected to the served source — winAlert's
 *    `confirm` type, the confirm-then-clear logout, `activeLAECTab` in
 *    `localStorage`, `--header-offset` sync, the `.visible` back-to-top
 *    class, the "MASTER ADMIN: <name>" header title, and the page's own
 *    three-minute idle tracker alongside the five-minute one in `<head>`;
 *  - the data layer for DASHBOARD (config sync, both charts, latency ping),
 *    STUDENTS (directory, filters, datalists, identity card), ADMINS
 *    (directory table) and the EXAM MGT controls (mode, portal, promotion,
 *    global settings push).
 *
 * Still pending (stage 3): the RESULTS table and its filters, PAST
 * QUESTIONS, the question-manager and exam-session library surfaces, the
 * question blaster, diagram hosting, the archive trigger, the invigilation
 * feed and the admin create/revoke actions. Those buttons stay inert rather
 * than being wired to invented behaviour.
 *
 * Fidelity notes (all logged in BUILD-LOG):
 *  - The origin's page stylesheet is generated into `src/styles/admin-page.css`
 *    and re-scoped under `.page-admin` by `tools/extract-admin-css.mjs`; the
 *    15 tokens and the body rule stay in `enterprise.css`.
 *  - `GET_CONFIG` is read flat (mode, portalActive, academicYear,
 *    currentTerm, activeExamType, examDuration, promotionActive) exactly as
 *    `loadGlobalStats` does; the mock returns those keys at the envelope root.
 *  - The first-party modules read this page's element ids and call
 *    `window.winAlert` / `window.toggleNav`, which the origin provided as
 *    top-level declarations; the entry installs a dispatcher and the view
 *    fulfils it (see admin/index.html).
 *  - `checkHealth` pings the origin's public S3 favicon — a public asset
 *    request, not an API call, and kept verbatim.
 *  - `viewStudentProfile` prints the student's plaintext password, the
 *    RF-29-class defect on this surface (D-07), replicated as served.
 */

import { Chart } from 'chart.js/auto';
import * as XLSX from 'xlsx';
import { computed, defineComponent, h, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { callApi } from '../api';
import AppShell from '../components/AppShell.vue';
import AppAlert from '../components/AppAlert.vue';
import AppLoading from '../components/AppLoading.vue';
import ChartEmptyState from '../components/ChartEmptyState.vue';
import { canOpenPanel, filterNav, navFor, takePendingPanel } from '../lib/nav';
import AdminPanelRouter from '../components/admin/AdminPanelRouter.vue';
import SchoolGroupsPanel from '../components/schools/SchoolGroupsPanel.vue';
import { ADMIN_MODULE_IDS } from '../types/admin-registry';
import { useSessionStore } from '../stores/session';
import { bypassesPermissions, hasPermission } from '../lib/permissions';
import {
  createMockGetFetch,
  installLibraryFetchBridge,
  installResultScriptViewer,
} from '../lib/console';
import { useIdleTimeout } from '../composables/useIdleTimeout';
import { STORAGE_KEYS } from '../types';
import type {
  AdminRole,
  ExamCategory,
  ExamTerm,
  LaecUtils,
  Question,
  ResultRecord,
  SchoolGroup,
  SchoolRecord,
  SchoolStats,
  Student,
} from '../types';
import { schoolPortalUrl } from '../lib/tenant';
import '../styles/admin-page.css';
import '../styles/overview-charts.css';
/* The Saint Finbarr's College admin modules' overrides, scoped to `.ap-admin-panel`.
   Loaded after the origin stylesheet so it wins on the rules it restates. */
import '../styles/admin-panel-page.css';

/* ── origin globals (lines 1584–1610) ─────────────────────────────────── */

const LAEC = window.LAEC_UTILS as LaecUtils;

/*
 * The origin loads SheetJS from a CDN <script> (admin.html line 50, pinned to
 * 0.18.5 — the same version this project depends on), so `window.XLSX` exists
 * for the first-party `/config.js` helpers, which bail out with
 * `typeof XLSX === "undefined"` otherwise. This build bundles the same
 * library, so the global is published here to keep those helpers working
 * against the identical version rather than reimplementing them.
 */
(window as unknown as { XLSX: typeof XLSX }).XLSX = XLSX;

/**
 * The ten schools the origin hardcodes (D23). Kept for the chart code below,
 * which reads names by code. The school DROPDOWNS no longer use this — they
 * read the live registry (`schoolRows`, loaded via GET_SCHOOLS) so a school a
 * super administrator adds at runtime is selectable everywhere immediately.
 */
const SCHOOL_NAMES: Record<string, string> = {
  SFC: "St. Finbarr's College",
  SGC: 'St. Gregory College',
  HCC: 'Holy Child College',
  MCSS: 'Maryland Comprehensive',
  STAC: 'St. Thomas Aquinas College',
  OLASS: 'Our Lady of Apostles',
  MEC: 'Mater Ecclesia College',
  SKC: "St. Kizito's College",
  MGC: 'Marywood Girls College',
  SHC: 'Sacred Heart College',
};

const ACADEMIC_YEARS = [2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034] as const;

/* The flat tab strip is gone (D-60, D-62): its sections and their order now live
   in src/lib/nav.ts, which every console reads, so a role's navigation has one
   definition rather than one per view. The tab ids are unchanged, so showTab(),
   refreshTabData() and the saved-tab restore all still address the same panels. */

const msgOf = (e: unknown): string =>
  e instanceof Error
    ? e.message
    : typeof e === 'object' && e !== null && 'message' in e
      ? String((e as { message: unknown }).message)
      : '';

/* ── reactive mirrors of the elements the origin writes to ────────────── */

/* AppShell wiring (D-62). `currentRole` is read once, like the origin's own
   session reads, and `navFor` turns it into this role's sections. */
const currentRole = localStorage.getItem(STORAGE_KEYS.AdminRole) || 'SUPER_ADMIN';
const navMeta = navFor(currentRole);

/* The rail is permission-filtered (D-71): SUPER_ADMIN sees every
   section, every other session only the ones it actually holds.
   `navPermissions`, not `permissions`: while the roles page is previewing a
   school role the rail is filtered by that role's grants alone. The transport
   keeps reading `permissions`, so the preview narrows what is offered without
   touching what is permitted — see `setPreviewRole`. */
const sessionStore = useSessionStore();
const navGroups = computed(() =>
  filterNav(navMeta, sessionStore.navPermissions, currentRole, {
    /* A super administrator is exempt from the rail filter, so a preview would
       be a no-op without this. The transport still enforces the claim, so the
       exemption being lifted here widens nothing. */
    ignoreSuperAdmin: sessionStore.previewRole !== '',
  }).groups,
);
/*
 * While a preview is on, the page's own gate follows the rail, so a panel does
 * not stay open behind a rail entry the preview removed. `canPerform` is
 * deliberately NOT swapped: it is the predicate that mirrors the transport, and
 * a preview must not be able to make the UI and the transport disagree in the
 * permissive direction.
 */
const sessionCan = (permission?: string | null): boolean => {
  if (sessionStore.previewRole) {
    if (!permission) return true;
    if (bypassesPermissions(sessionStore.role)) return true;
    return hasPermission(sessionStore.navPermissions, permission);
  }
  return sessionStore.can(permission);
};
/* The scope chip reads GLOBAL for a cross-school role and the school's own code
   for a school console, which is the only visible difference between them. */
const SHELL_SCOPE =
  navMeta.scopeKind === 'global' ? 'GLOBAL' : localStorage.getItem(STORAGE_KEYS.SchoolID) || '—';

const activeTab = ref<string>(
  takePendingPanel(navMeta, 'activeLAECTab') || 'dashboard',
);

/*
 * ── the Saint Finbarr's admin modules ────────────────────────────────────
 *
 * The LAEC panels above are transcribed from the origin and are addressed by
 * their own ids. The school-management modules below are the Saint Finbarr's
 * College admin portal, and they mount through `AdminPanelRouter`, which picks
 * the component for a registry module id.
 *
 * A panel is mounted only while it is the active one (`v-if`), which is what the
 * origin does — it navigates to a route, so only that route's component exists.
 * It is also what makes `AppShell`'s first-panel shortcut work, since the shell
 * activates an item by clicking it.
 *
 * `ADMIN_PANEL_IDS` is the set the router may address. A tab id outside it falls
 * back to the LAEC dashboard rather than rendering an empty content area, which
 * is the blank-page failure `lib/nav.ts` already documents for route-backed rail
 * items.
 */
/*
 * The panel ids the router may address: every registry module id, plus the
 * dashboard.
 *
 * The dashboard is here and not in the registry because it is a bespoke page with
 * no list behind it — and a registry entry is a description of a list. It is
 * mounted through `AdminPanelRouter` exactly like the rest, so it gets the same
 * wrapper, the same loading/error/empty frame and the same `data-admin-panel`
 * hook; only the columns-and-fields declaration does not apply to it.
 */
const ADMIN_PANEL_IDS = new Set<string>(['school-dashboard', ...ADMIN_MODULE_IDS]);

/** The St Finbarr's modules, for the `isAdminPanel` test below. */
const isAdminPanel = (id: string): boolean => ADMIN_PANEL_IDS.has(id);

/**
 * The session's permission predicate, passed down to every panel rather than
 * imported from the store inside them. That is what lets a panel be verified
 * against an arbitrary permission set without signing in as six roles — and it is
 * the same predicate `callApi` enforces, so a control that renders is a control
 * that works.
 *
 * It is defined further down, beside `navGroups`, because while the roles page
 * previews a school role it has to follow the preview. See the note there.
 */

/** `?panel=` on the URL addresses a module directly, as the dashboard tiles do. */
const route = useRoute();
const panelFromQuery = (): string => {
  const match = /[?&]panel=([a-z0-9-]+)/i.exec(window.location.search);
  return match && ADMIN_PANEL_IDS.has(match[1]) ? match[1] : '';
};
const navOpen = ref(false);
const backToTopVisible = ref(false);
const loadingVisible = ref(false);
const headerTitle = ref('LAEC SUPER ADMIN');
const copyrightYear = ref('');

/**
 * "Total Registered Students" on the DASHBOARD panel. Owned by
 * `renderSchoolPopulationChart` and set to the sum of the histogram's bars, so
 * the card and the histogram cannot disagree. Deliberately NOT the same ref the
 * STUDENTS directory used to write: that fetch is school-filtered, so one
 * writer for a filtered count and one for the whole roster on a single heading
 * is exactly how the card came to contradict the chart beside it.
 */
const overviewStudentTotal = ref('0');
const globalSessionDisplay = ref('SYNCING...');
const currentModeDisplay = ref('LOADING...');
const pingMs = ref('-- ms');
const pingLarge = ref('--');
const pingStatus = ref('Monitoring Region us-east-1...');
const pingStatusColor = ref('');
/*
 * Latency card caption and colour. `pingWhat` names what is being measured —
 * the card's own header says "AWS Latency" but not what the ping does, and the
 * value is a round-trip to a public S3 asset rather than to the API, which is
 * the more surprising thing to learn. `pingCheckedAt` makes a stale reading
 * distinguishable from a fresh one, which matters because the poll runs on a
 * ten-second interval and a number that stops changing otherwise looks live.
 *
 * Thresholds mirror the ones `checkHealth` already applied to the System Health
 * panel's status line, so the two surfaces cannot disagree about what counts as
 * healthy.
 */
type PingTone = 'unknown' | 'good' | 'warn' | 'bad';
const pingTone = ref<PingTone>('unknown');
const pingCheckedAt = ref('checking…');
const pingWhat = 'Round-trip to AWS us-east-1';

/** Short token for the mode card; the long form is the subtitle. */
const currentModeShort = ref('LOADING');
const jointPerformanceNote = ref(
  'Comparing school pass rates across the selected joint-exam year.',
);
const schoolPopulationNote = ref(
  'Showing student population distribution across all archdiocesan schools.',
);
/*
 * Whether each Overview chart has anything to draw. These are what the template
 * branches on to decide between the canvas and <ChartEmptyState>, so the two
 * render paths are driven by the same numbers the charts were built from and
 * cannot disagree about whether there is data.
 */
const jointPerformanceEmpty = ref(true);
const schoolPopulationEmpty = ref(true);
/* The pie's empty-state copy, owned by renderJointPerformanceChart so the text
   and the branch that produced it cannot disagree. */
const jointEmptyTitle = ref('No results yet');
const jointEmptyDesc = ref('');
/* Distinguishes "we have not loaded yet" from "we loaded and it is zero" — the
   empty state copy differs, and a spinner is right for the first. */
const overviewLoading = ref(false);
const modeHint = ref('Current: LOADING...');
const portalBadge = ref('SYSTEM ONLINE');
const portalBadgeColor = ref('var(--success)');
const promoStatusHint = ref('Status: STANDBY (Promotion Undo active)');
/**
 * `refreshArchiveNotice` (origin line 3007) rewrites this paragraph at load —
 * the served page never shows the "archives automatically" wording.
 */
const archiveNotice = ref(
  '🚨 <b>Warning:</b> Changing the Term or Year will trigger an automatic cloud archive of all current session data to S3.',
);
const refreshArchiveNotice = (): void => {
  archiveNotice.value =
    '<b>Warning:</b> Updating the active session does not archive automatically anymore. Use the standalone archive trigger whenever you want to move the current Questions and Results from DynamoDB into S3.';
};

const modeA = ref(false);
const modeB = ref(false);
const portalOn = ref(true);
const portalOff = ref(false);
const promoOn = ref(false);
const promoOff = ref(true);

const students = ref<Student[]>([]);
const visibleStudents = ref<Student[]>([]);
const adminRows = ref<{ FullName: string; Username?: string; Email: string; Role: string; SchoolID: string }[]>([]);

/* Results (RF-72…RF-74) */
const masterResultList = ref<ResultRecord[]>([]);
const renderedResultList = ref<ResultRecord[]>([]);
const resTerm = ref('#');
const resCategory = ref('EXAM');
const resRegFilter = ref('');
const resClassFilter = ref('ALL');
const resArmFilter = ref('ALL');
const resSchoolFilter = ref('ALL');
const resSubjectInput = ref('');

/* Past questions (RF-97) */
const pqSubject = ref('#');
const pqType = ref('#');
const pqClass = ref('JSS1');
const pastQuestionRows = ref<Question[]>([]);

/* Blaster + diagram hosting (RF-77, RF-78) */
const blastSession = ref('#');
const blastH = ref<number | string>('');
const blastM = ref<number | string>('');
const blastS = ref<number | string>('');
const blastInstruction = ref('');
const blastShuffle = ref(true);
const generatedUrl = ref('');
const hostingResultVisible = ref(false);

/* Administrators (RF-97) */
const admName = ref('');
const admUsername = ref('');
const admRole = ref('#');
const admEmail = ref('');
const admSchool = ref('#');
const admPass = ref('');

/* ── archdiocesan school registry (D23 runtime extension) ──────────────── */
/* The ten origin schools are the seed; a super administrator can add more.
   `schoolRows` drives both this panel's table and the "College Assignment"
   dropdown above, so a school added here is immediately assignable. */
const schoolRows = ref<SchoolRecord[]>([]);
const newSchoolCode = ref('');
const newSchoolName = ref('');
const newSchoolAddress = ref('');

/* Invigilation monitor (RF-101) */
const invigSchool = ref('ALL');
const invigMode = ref('MODE_A');
const invigClass = ref('ALL');
const invigSubject = ref('');
const invigilatorRows = ref<ResultRecord[]>([]);

/* Config-driven selects (the origin assigns .value directly) */
const globalExamType = ref('#');
const globalAcademicYear = ref('2025/2026');
const globalActiveTerm = ref('TERM1');
const pieYearFilter = ref('YEAR#2025');
const resYear = ref('2025/2026');
const pqYear = ref('2025/2026');
const invigilatorYearFilter = ref('2025/2026');
const invigilatorTermFilter = ref('TERM1');
const timerH = ref<number | string>('');
const timerM = ref<number | string>('');
const timerS = ref<number | string>('');
const dirSchoolFilter = ref('ALL');
const dirSearch = ref('');

/** Years added on demand so a config year outside the served range shows up. */
const extraYears = ref<number[]>([]);
const yearOptions = computed<number[]>(() =>
  [...new Set([...ACADEMIC_YEARS, ...extraYears.value])].sort((a, b) => a - b),
);

/* ── custom alert (origin winAlert / closeAlert) ───────────────────────── */

const alertVisible = ref(false);
const alertTitle = ref('Notice');
const alertBodyHtml = ref('');
const alertMsg = ref('');
const alertCancelVisible = ref(false);
const alertConfirmVisible = ref(false);
let alertConfirmHandler: (() => void) | null = null;

type AlertType = 'info' | 'confirm';

const winAlert = (
  title: string,
  msg: string,
  type: AlertType = 'info',
  onConfirm: (() => void) | null = null,
): void => {
  alertTitle.value = title;
  alertMsg.value = msg;
  const isConfirm = type === 'confirm';
  alertCancelVisible.value = isConfirm;
  alertConfirmVisible.value = isConfirm;
  alertConfirmHandler = isConfirm ? onConfirm : null;
  alertVisible.value = true;
};

const closeAlert = (): void => {
  alertVisible.value = false;
  alertBodyHtml.value = '';
  alertMsg.value = '';
  alertConfirmHandler = null;
};

const confirmAlert = (): void => {
  const handler = alertConfirmHandler;
  closeAlert();
  handler?.();
};

/* ── navigation and chrome ────────────────────────────────────────────── */

const toggleNav = (): void => {
  navOpen.value = !navOpen.value;
};

const scrollToTopPage = (): void => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const syncHeaderOffset = (): void => {
  const header = document.querySelector('header');
  if (!header) return;
  document.documentElement.style.setProperty(
    '--header-offset',
    `${header.offsetHeight + 28}px`,
  );
};

const toggleBackToTopButton = (): void => {
  backToTopVisible.value = window.scrollY > 320;
};

/**
 * RF-67 / D-10 — both session helpers are plain no-ops on this page
 * (origin lines 1648–1654); administrator single-session locking is not
 * enforced here (Q8).
 */
const releaseAdminSession = async (): Promise<void> => {
  return;
};
const refreshAdminSessionLock = async (): Promise<void> => {
  return;
};

const handleLogout = (): void => {
  winAlert('LOGOUT', 'End your master session?', 'confirm', () => {
    void releaseAdminSession();
    localStorage.clear();
    window.location.href = '/control/';
  });
};

/**
 * Switch panels.
 *
 * The `document.getElementById` guard is the origin's own test and it still holds
 * for the seven LAEC panels, which are real elements. It CANNOT hold for the
 * Saint Finbarr's modules: those mount through `AdminPanelRouter` only while
 * active, so the element for an inactive one does not exist yet. So the guard is
 * `is a LAEC panel with an element` OR `is a registry module id` — which is the
 * same union the rail itself offers, and why clicking a rail item can never land
 * on an id that renders nothing.
 */
const showTab = (tabId: string): void => {
  if (!isAdminPanel(tabId) && !document.getElementById(tabId)) return;
  activeTab.value = tabId;
  localStorage.setItem('activeLAECTab', tabId);
  if (window.innerWidth <= 900) navOpen.value = false;
};

const restoreActiveTab = (): void => {
  const fallbackTab = 'dashboard';
  /* A `?panel=` on the URL wins over the persisted tab, because the dashboard
     tiles and the Quick Access links address modules that way and a reload of
     such a link has to land where it pointed. The rail's own permission filter is
     still applied to it — a link to a module this session cannot open falls back
     rather than rendering it. */
  const fromQuery = panelFromQuery();
  const savedTab = fromQuery || localStorage.getItem('activeLAECTab') || fallbackTab;
  showTab(
    canOpenPanel(navMeta, sessionStore.permissions, currentRole, savedTab)
      ? savedTab
      : fallbackTab,
  );
};

/*
 * A client-side navigation that changes `?panel=` must switch the mounted module.
 *
 * `restoreActiveTab` runs once, on mount, and a router navigation to the SAME
 * route does not remount this view — so a `<RouterLink>` carrying `?panel=` (the
 * fee panel's "New Payment", the dashboard's Quick Access) changed the address bar
 * and left the previous module on screen. The link looked like it worked while the
 * operator was still looking at the wrong list, and a full page load of the same
 * URL worked, which is why a document-load test would never have caught it.
 *
 * The permission filter is applied exactly as on mount: a link to a module this
 * session cannot open falls back rather than rendering it.
 */
watch(
  () => route.query.panel,
  () => {
    const requested = panelFromQuery();
    if (requested) showTab(requested);
  },
);

/* ── the origin's own three-minute idle tracker (startAdminIdleTracking) ─ */

const ADMIN_IDLE_TIMEOUT_MS = 3 * 60 * 1000;
let adminIdleTimer: ReturnType<typeof setTimeout> | null = null;
let adminSessionHeartbeat: ReturnType<typeof setInterval> | null = null;

const startAdminIdleTracking = (): void => {
  const resetIdleTimer = (): void => {
    if (adminIdleTimer !== null) clearTimeout(adminIdleTimer);
    adminIdleTimer = setTimeout(() => {
      void releaseAdminSession();
      localStorage.clear();
      window.location.replace('/control/');
    }, ADMIN_IDLE_TIMEOUT_MS);
  };

  for (const eventName of ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']) {
    window.addEventListener(eventName, resetIdleTimer);
  }
  resetIdleTimer();
  void refreshAdminSessionLock();
  if (adminSessionHeartbeat !== null) clearInterval(adminSessionHeartbeat);
  adminSessionHeartbeat = setInterval(() => void refreshAdminSessionLock(), 60 * 1000);
};

/* ── shared helpers (origin lines 1698–1880, condensed) ───────────────── */

let ACTIVE_SYNC_TERM = 'TERM1';
let ACTIVE_SYNC_YEAR = '2025/2026';

const formatTermLabel = (term: string): string =>
  term ? term.replace('TERM', 'Term ') : 'current term';

const sessionFilterToAcademicYear = (value: string): string => {
  if (!value) return ACTIVE_SYNC_YEAR;
  if (value.startsWith('YEAR#')) {
    const startYear = parseInt(value.split('#')[1], 10);
    if (Number.isFinite(startYear)) return `${startYear}/${startYear + 1}`;
  }
  return value;
};

/* The session and term the empty state names in its copy. Derived rather than
   captured, so the text follows the year <select> without a second write. */
const selectedPieYear = computed(() => sessionFilterToAcademicYear(pieYearFilter.value));
const activeTermLabel = computed(() => formatTermLabel(ACTIVE_SYNC_TERM));

const academicYearToSessionFilter = (year: string): string => {
  const startYear = parseInt(String(year || '').split('/')[0], 10);
  return Number.isFinite(startYear) ? `YEAR#${startYear}` : '';
};

const getAcademicYearStart = (value: string): number => {
  if (!value) return NaN;
  if (String(value).startsWith('YEAR#')) return parseInt(String(value).split('#')[1], 10);
  return parseInt(String(value).split('/')[0], 10);
};

/** `ensureAcademicYearOptions` / `syncAcademicYearSelect`, kept in Vue state. */
const syncAcademicYear = (year: string): void => {
  const start = getAcademicYearStart(year);
  if (!Number.isFinite(start)) return;
  if (!yearOptions.value.includes(start)) {
    extraYears.value = [...extraYears.value, start];
  }
};

const getStudentArmValue = (student?: Student | null): string =>
  String(student?.Arm ?? '').toUpperCase();

const getArmOptionsMarkup = (selected = 'ALL'): string => {
  const current = String(selected || 'ALL').toUpperCase();
  const options = [`<option value="ALL"${current === 'ALL' ? ' selected' : ''}>All Arms</option>`];
  for (let code = 65; code <= 90; code += 1) {
    const arm = String.fromCharCode(code);
    options.push(`<option value="${arm}"${current === arm ? ' selected' : ''}>${arm}</option>`);
  }
  return options.join('');
};

/* ── exports and filters (origin lines 1773–1835, 2866–2900, 3005) ─────── */

const slugifyExportToken = (value: unknown, fallback = 'ALL'): string => {
  const normalized = String(value || '')
    .replace(/[^\w\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '_');
  return normalized || fallback;
};

const getSelectedText = (id: string, fallback = 'ALL'): string => {
  const element = document.getElementById(id) as HTMLSelectElement | HTMLInputElement | null;
  if (!element) return fallback;
  if (!(element as HTMLSelectElement).options) {
    const typedValue = element.value || fallback;
    const option = Array.from(
      document.querySelectorAll<HTMLOptionElement>(`#${id}-options option`),
    ).find((item) => item.value === typedValue || item.textContent === typedValue);
    return option ? option.textContent || option.value : typedValue;
  }
  const select = element as HTMLSelectElement;
  return select.options[select.selectedIndex]?.text || select.value || fallback;
};

/**
 * `normalizeResultSubjectInput` / `normalizeInvigilatorSubjectInput` — both
 * read the filter input and map a typed label back to its stored value, and
 * both resolve against the shared `#res-subject-options` datalist.
 */
const normalizeSubjectInput = (raw: string): string => {
  const rawValue = String(raw || 'ALL').trim();
  if (!rawValue || rawValue.toUpperCase() === 'ALL' || rawValue.toUpperCase() === 'ALL SUBJECTS') {
    return 'ALL';
  }
  const option = Array.from(
    document.querySelectorAll<HTMLOptionElement>('#res-subject-options option'),
  ).find(
    (item) =>
      item.value.toUpperCase() === rawValue.toUpperCase() ||
      item.textContent?.toUpperCase() === rawValue.toUpperCase(),
  );
  if (option) return option.value.toUpperCase();
  return typeof LAEC?.normalizeSubjectValue === 'function'
    ? LAEC.normalizeSubjectValue(rawValue)
    : rawValue.toUpperCase().replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '');
};

const buildExportFilename = (tableID: string, fallbackName: string): string => {
  if (tableID === 'resultsTable') {
    const subjectToken =
      normalizeSubjectInput(resSubjectInput.value) === 'ALL'
        ? 'All_Subjects'
        : slugifyExportToken(getSelectedText('res-subject'));
    const classValue = (document.getElementById('res-class') as HTMLSelectElement | null)?.value;
    const classToken = classValue === 'ALL' ? 'All_Classes' : slugifyExportToken(classValue);
    const armValue = (document.getElementById('res-arm') as HTMLSelectElement | null)?.value || 'ALL';
    const armToken = armValue === 'ALL' ? 'All_Arms' : slugifyExportToken(armValue);
    const schoolValue = (document.getElementById('res-school') as HTMLSelectElement | null)?.value;
    const schoolToken = schoolValue === 'ALL' ? 'All_Schools' : slugifyExportToken(schoolValue);
    return `${subjectToken}_Result_${classToken}_${armToken}_${schoolToken}`;
  }
  if (tableID === 'pqTable') {
    const subjectToken = slugifyExportToken(getSelectedText('pq-subject'), 'Questions');
    const classToken = slugifyExportToken(getSelectedText('pq-class'), 'All_Classes');
    const typeToken = slugifyExportToken(getSelectedText('pq-type'), 'All_Types');
    return `${subjectToken}_Questions_${classToken}_${typeToken}`;
  }
  return fallbackName;
};

/** SheetJS export, as the origin performs it (line 3005). */
const exportToExcel = (tableID: string, fallbackName: string): void => {
  const table = document.getElementById(tableID) as HTMLTableElement | null;
  if (!table) return;
  const wb = XLSX.utils.table_to_book(table, { sheet: 'Export' });
  XLSX.writeFile(wb, `${buildExportFilename(tableID, fallbackName)}.xlsx`);
};

/** The origin's `new Date(s.CreatedAt || Date.now()).toLocaleDateString()`. */
const studentDate = (s: Student): string =>
  new Date((s as unknown as { CreatedAt?: string }).CreatedAt || Date.now()).toLocaleDateString();

/* ── exam-control UI (origin lines 2192–2250, 2288–2318) ──────────────── */

const handleCategoryChange = (): void => {
  const cat = globalExamType.value;
  if (cat === '#') {
    timerH.value = 0;
    timerM.value = 0;
    timerS.value = 0;
  }
  timerDisabled.value = cat === '#';
};
const timerDisabled = ref(true);

/*
 * The mode card shows a short token as its value and the long form as a
 * subtitle. "INTERNAL (Colleges)" is 19 characters and the value is set in the
 * same 2.1rem display face as "2025/2026", so the card was shrunk to 1.2rem
 * inline to fit — which is why one stat read visibly smaller than its three
 * neighbours. Splitting the label from the caption lets the value stay at the
 * row's type size. Both the token and the caption derive from the same mode, so
 * they cannot disagree.
 */
const MODE_LABELS: Record<string, { short: string; full: string }> = {
  MODE_A: { short: 'JOINT', full: 'JOINT (Archdiocesan Commission)' },
  MODE_B: { short: 'INTERNAL', full: 'INTERNAL (Colleges)' },
};

const setModeDisplay = (mode: string): void => {
  const label = MODE_LABELS[mode] ?? { short: String(mode), full: String(mode) };
  currentModeShort.value = label.short;
  currentModeDisplay.value = label.full;
};

const updateModeUI = (mode: string): void => {
  const joint = mode === 'MODE_A';
  modeA.value = joint;
  modeB.value = !joint;
  modeHint.value = joint
    ? 'Current: JOINT MODE ACTIVE'
    : 'Current: LOCAL INTERNAL MODE ACTIVE';
};

const updatePortalUI = (isActive: boolean): void => {
  portalOn.value = isActive;
  portalOff.value = !isActive;
  portalBadge.value = isActive ? 'SYSTEM ONLINE' : 'PORTAL CLOSED';
  portalBadgeColor.value = isActive ? 'var(--success)' : 'var(--danger)';
};

const updatePromotionUI = (state: 'on' | 'off'): void => {
  promoOn.value = state === 'on';
  promoOff.value = state === 'off';
  promoStatusHint.value =
    state === 'on'
      ? 'Status: PROMOTIONS COMPLETE (Session Migration Finished)'
      : 'Status: STANDBY (Promotion Undo active)';
};

const restoreCachedModeUI = (): void => {
  const cachedMode = localStorage.getItem('LAEC_Global_Mode');
  if (!cachedMode) return;
  updateModeUI(cachedMode);
  setModeDisplay(cachedMode);
};

const toggleSystemMode = async (mode: 'MODE_A' | 'MODE_B'): Promise<void> => {
  loadingVisible.value = true;
  try {
    await callApi('UPDATE_MODE', { mode });
    localStorage.setItem('LAEC_Global_Mode', mode);
    updateModeUI(mode);
    setModeDisplay(mode);
    winAlert('Mode Switch', `System moved to ${mode}.`);
  } catch (e) {
    winAlert('Error', msgOf(e) || 'Mode switch failed.');
  }
  loadingVisible.value = false;
};

const togglePortal = async (isActive: boolean): Promise<void> => {
  loadingVisible.value = true;
  try {
    await callApi('UPDATE_PORTAL', { active: isActive });
    updatePortalUI(isActive);
    winAlert('System Update', isActive ? 'Portal OPEN.' : 'Portal CLOSED.');
  } catch (e) {
    winAlert('Error', msgOf(e) || 'Portal update failed.');
  }
  loadingVisible.value = false;
};

const confirmPromotion = (state: 'on' | 'off'): void => {
  const title = state === 'on' ? 'INITIATE PROMOTION' : 'ROLLBACK PROMOTION';
  const msg = state === 'on' ? 'Move all students to the next class levels?' : 'Undo class promotions?';
  winAlert(title, msg, 'confirm', () => {
    void (async () => {
      loadingVisible.value = true;
      try {
        await callApi('EXECUTE_PROMOTION', { state });
        updatePromotionUI(state);
        winAlert('Master Action', 'Student classes updated in DynamoDB.');
      } catch (e) {
        winAlert('Database Error', msgOf(e) || 'Promotion update failed.');
      }
      loadingVisible.value = false;
    })();
  });
};

const updateExamGlobal = (): void => {
  const type = globalExamType.value;
  const h = parseInt(String(timerH.value), 10) || 0;
  const m = parseInt(String(timerM.value), 10) || 0;
  const s = parseInt(String(timerS.value), 10) || 0;
  const totalMinutes = h * 60 + m + s / 60;

  const session = (window as unknown as { LAECExamSession?: PaperQueueApi }).LAECExamSession;
  const selectedPapers = session ? session.getSelectedPapers('exam-session-root') : [];
  const liveWindow = session
    ? session.getWindowPayload('exam-session-root')
    : { startTime: '', endTime: '' };

  if (type === '#') {
    winAlert('Validation Error', 'Select the active category first.');
    return;
  }
  if (
    (liveWindow.startTime && !liveWindow.endTime) ||
    (!liveWindow.startTime && liveWindow.endTime)
  ) {
    winAlert('Validation Error', 'Set both live window values or leave both blank.');
    return;
  }
  if (
    liveWindow.startTime &&
    liveWindow.endTime &&
    new Date(liveWindow.endTime) <= new Date(liveWindow.startTime)
  ) {
    winAlert('Validation Error', 'Live end time must be later than live start time.');
    return;
  }

  void (async () => {
    loadingVisible.value = true;
    try {
      await callApi('UPDATE_EXAM_SETTINGS', {
        type: type as 'EXAM',
        duration: totalMinutes,
        activePapers: selectedPapers,
        livePapers: selectedPapers,
        startTime: liveWindow.startTime || '',
        endTime: liveWindow.endTime || '',
      });
      winAlert(
        'Success',
        `Global session settings published. ${selectedPapers.length} paper slot(s) prepared for live access.`,
      );
    } catch (e) {
      winAlert('Error', msgOf(e) || 'Push failed.');
    }
    loadingVisible.value = false;
  })();
};

interface PaperQueueApi {
  getSelectedPapers(rootId: string): string[];
  getWindowPayload(rootId: string): { startTime: string; endTime: string };
}

/* ── dashboard (origin lines 1962–2131) ───────────────────────────────── */

let schoolPopulationChart: Chart | null = null;
let jointPerformanceChart: Chart | null = null;

type SchoolMetric = { id: string; label: string; count: number };
/** `buildSchoolPopulationMetrics` — one bar per school, summing to the roster. */
type SchoolPopulationMetric = SchoolMetric;
/** `buildSchoolPassMetrics` — one slice per school that has scored results. */
type SchoolPassMetric = SchoolMetric & {
  attempts: number;
  passCount: number;
  scoreTotal: number;
  averageScore: number;
  passRate: number;
};
interface DashboardAnalyticsApi {
  /**
   * Invariant relied on by `renderSchoolPopulationChart`:
   * `sum(count) === students.length`. See the comment on the function in
   * public/dashboard-overview.js for what used to break it.
   */
  buildSchoolPopulationMetrics(
    students: Student[],
    options: { schoolNames: Record<string, string> },
  ): SchoolPopulationMetric[];
  buildSchoolPassMetrics(
    results: unknown[],
    options: { schoolNames: Record<string, string> },
  ): SchoolPassMetric[];
  getColors(count: number): string[];
}
const DashboardAnalytics = (window as unknown as { LAECDashboardAnalytics?: DashboardAnalyticsApi })
  .LAECDashboardAnalytics;

const fetchOverviewStudents = async (): Promise<Student[]> => {
  const data = await callApi('GET_STUDENTS', { schoolID: 'ALL' });
  return data.status === 'success' ? data.students : [];
};

const fetchJointOverviewResults = async (year: string): Promise<unknown[]> => {
  const batches = await Promise.all(
    Object.keys(SCHOOL_NAMES).map(async (schoolID) => {
      try {
        const data = await callApi('GET_RESULTS', {
          schoolID,
          year,
          term: ACTIVE_SYNC_TERM as 'TERM1',
          mode: 'MODE_A',
        });
        if (data.status !== 'success') return [];
        return data.results.map((result) => ({
          ...result,
          SchoolID: result.SchoolID || schoolID,
        }));
      } catch {
        return [];
      }
    }),
  );

  /*
   * Deduplicate the fan-out.
   *
   * The joint view queries each of the ten colleges and concatenates the
   * batches, on the assumption that a college-scoped GET_RESULTS returns only
   * that college's rows. When the backend honours the scope that is true and
   * this is a no-op. When it does not — a global store, or a scope the response
   * ignores — every batch returns the same rows and each result is counted once
   * per college, so the pie's "attempts" and "joint result(s)" tooltip read ten
   * times the real figure. The pass *rate* survives it, because a uniform
   * multiplier cancels in the ratio, which is exactly why the inflation was not
   * obvious: the pie looked plausible while every count beside it was wrong.
   *
   * A result is identified by its record key, falling back to the
   * registration/subject coordinates the records carry.
   */
  const seen = new Set<string>();
  const unique: unknown[] = [];
  for (const result of batches.flat()) {
    const record = result as Record<string, unknown>;
    const key = String(
      record.PK ?? record.pk ?? `${record.RegNo ?? ''}#${record.Subject ?? ''}`,
    );
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(result);
  }
  return unique;
};

/*
 * Longest label drawn on an Overview histogram's category axis. The axis is
 * truncated to this and the full name is carried in the tooltip, so a long
 * college or class name can never be drawn over its neighbours. See the axis
 * callback in renderSchoolPopulationChart.
 */
const POPULATION_AXIS_LABEL_MAX = 14;

/** "St. Thomas Aquinas College" -> "St. Thomas A…", for the axis only. */
const truncateChartLabel = (value: string, max: number): string =>
  value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;

const renderSchoolPopulationChart = (list: Student[]): void => {
  const metrics = DashboardAnalytics?.buildSchoolPopulationMetrics(list, {
    schoolNames: SCHOOL_NAMES,
  }) ?? [];

  /*
   * The dashboard's headline total IS the sum of these bars, assigned here in
   * the one function that owns the aggregation. It was `list.length` set by the
   * caller instead, which made the card a second, independent count of the same
   * roster: whenever the aggregation dropped or hid a student the two drifted
   * apart (9 against 0), and nothing in the template could detect it. Deriving
   * it here makes the two agree by construction rather than by coincidence.
   * Computed before the early return so a missing canvas cannot leave the card
   * showing the previous session's number.
   */
  const total = metrics.reduce((sum, m) => sum + m.count, 0);
  overviewStudentTotal.value = String(total);

  /* The state the template branches on, decided by the same `total` the card
     shows — a zero population is a genuinely empty chart, and drawing ten
     zero-height bars against Chart.js's default 0-to-1 axis made "no students"
     look like a measured result. */
  schoolPopulationEmpty.value = total === 0;

  const canvas = document.getElementById('schoolPopulationChart') as HTMLCanvasElement | null;
  if (!canvas || !DashboardAnalytics) return;

  schoolPopulationChart?.destroy();
  schoolPopulationChart = null;

  if (schoolPopulationEmpty.value) {
    schoolPopulationNote.value =
      'No students are registered, so there is no population to distribute across the schools yet.';
    return;
  }

  const maxCount = Math.max(...metrics.map((m) => m.count));
  /*
   * Integer-only Y scale, sized to the data. `precision: 0` alone still let
   * Chart.js choose a 0.5 step for a max of 9, which put half-students on a
   * head count; stepping by whole numbers from 0 keeps every tick a real
   * possible population.
   */
  const yStep = Math.max(1, Math.ceil(maxCount / 4));

  schoolPopulationChart = new Chart(canvas.getContext('2d') as CanvasRenderingContext2D, {
    type: 'bar',
    data: {
      labels: metrics.map((m) => m.id),
      datasets: [
        {
          label: 'Students',
          data: metrics.map((m) => m.count),
          backgroundColor: metrics.map((m) =>
            m.count === maxCount && maxCount > 0 ? '#4ec6ff' : '#123a63',
          ),
          borderRadius: 10,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const metric = metrics[items[0]?.dataIndex ?? -1];
              return metric ? metric.label : '';
            },
            label: (item) => {
              const metric = metrics[item.dataIndex];
              return metric
                ? `${metric.count} student(s) at ${metric.label}`
                : '';
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            stepSize: yStep,
            maxTicksLimit: 6,
          },
        },
        x: {
          ticks: {
            autoSkip: false,
            maxRotation: 45,
            minRotation: 45,
            /*
             * Truncated to a fixed width and rotated 45°, so eleven college
             * codes cannot run into each other. The full name is not lost: the
             * tooltip's `title` returns `metric.label` untruncated, and the
             * `label` callback names it again alongside the count.
             */
            callback(_value: string | number, index: number): string {
              const metric = metrics[index];
              return metric ? truncateChartLabel(metric.id, POPULATION_AXIS_LABEL_MAX) : '';
            },
          },
        },
      },
    },
  });

  schoolPopulationNote.value = `<strong>${total}</strong> student(s) currently distributed across ${metrics.length} school population bars. The tallest bar marks the largest active directory.`;
};

const renderJointPerformanceChart = (results: unknown[], year: string): void => {
  const metrics = DashboardAnalytics?.buildSchoolPassMetrics(results, {
    schoolNames: SCHOOL_NAMES,
  }) ?? [];

  /*
   * A pie is only drawable if its slices have a positive total. Two ways that
   * fails, and the old code conflated them with "no results":
   *   - no metrics at all (no school has a scored result), and
   *   - metrics exist but every passRate is 0, i.e. every candidate sat the
   *     exam and none passed. A pie of all-zero values has a 0 total, and
   *     Chart.js divides by it — the arcs came out as NaN and the canvas went
   *     blank behind the legend.
   * Both are "nothing to show" for a pass-rate pie, so both take the empty
   * state, but the copy differs: the second is a real (and bad) result, not an
   * absence of one. The old placeholder handled the first by drawing a single
   * pale slice with `data: [1]`, which is a full disc with a white seam down
   * the middle — visually a chart, reporting nothing.
   */
  const finiteRates = metrics
    .map((m) => m.passRate)
    .filter((rate): rate is number => Number.isFinite(rate) && rate > 0);
  const sliceTotal = finiteRates.reduce((sum, rate) => sum + rate, 0);
  const hasNoResults = metrics.length === 0;
  const hasNoPasses = !hasNoResults && sliceTotal === 0;

  jointPerformanceEmpty.value = hasNoResults || hasNoPasses;

  /* The empty state has to distinguish "nobody sat this" from "everybody sat it
     and failed", because the second is a result and the first is an absence —
     and the copy is the only thing carrying that. A single generic "no results"
     line here would misreport a failed cohort as a missing one. */
  jointEmptyTitle.value = overviewLoading.value
    ? 'Loading results…'
    : hasNoPasses
      ? 'No passes recorded'
      : 'No results yet';
  jointEmptyDesc.value = overviewLoading.value
    ? 'Fetching joint-exam results for the selected session.'
    : hasNoPasses
      ? 'Every candidate who sat this session fell below the pass mark, so there is no pass rate to chart. Results are still listed under Results Center.'
      : `No scored joint-exam results were found for ${selectedPieYear.value} in ${activeTermLabel.value}. The pie appears here once at least one school has a pass rate above zero.`;

  const canvas = document.getElementById('jointPerformanceChart') as HTMLCanvasElement | null;
  if (!canvas || !DashboardAnalytics) return;

  jointPerformanceChart?.destroy();
  jointPerformanceChart = null;

  if (jointPerformanceEmpty.value) {
    jointPerformanceNote.value = hasNoResults
      ? `No scored joint-exam results were found for <strong>${year}</strong> in ${formatTermLabel(ACTIVE_SYNC_TERM)}.`
      : `Every scored candidate fell below the pass mark in <strong>${year}</strong> for ${formatTermLabel(ACTIVE_SYNC_TERM)}, so there is no pass rate to chart.`;
    return;
  }

  /*
   * Only the positive, finite rates are charted. Passing a 0 into the dataset
   * is legal and draws nothing, but keeping the slice out means the legend and
   * the arcs cannot disagree about how many schools are represented.
   */
  const charted = metrics.filter(
    (m): m is (typeof metrics)[number] & { passRate: number } =>
      Number.isFinite(m.passRate) && m.passRate > 0,
  );

  jointPerformanceChart = new Chart(canvas.getContext('2d') as CanvasRenderingContext2D, {
    type: 'pie',
    data: {
      labels: charted.map((m) => m.id),
      datasets: [
        {
          data: charted.map((m) => m.passRate),
          backgroundColor: DashboardAnalytics.getColors(charted.length),
          borderColor: '#ffffff',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14 } },
        tooltip: {
          callbacks: {
            title: (items) => {
              const metric = charted[items[0]?.dataIndex ?? -1];
              return metric ? metric.label : '';
            },
            label: (item) => {
              const metric = charted[item.dataIndex];
              return metric
                ? `${metric.passRate}% pass from ${metric.attempts} joint result(s)`
                : '';
            },
          },
        },
      },
    },
  });

  /* `buildSchoolPassMetrics` sorts by pass rate descending, so the head of the
     full list is the leader whether or not its rate was chartable. */
  const leader = metrics[0];
  jointPerformanceNote.value = leader
    ? `<strong>${leader.label}</strong> currently leads with a ${leader.passRate}% joint-exam pass rate in <strong>${year}</strong> for ${formatTermLabel(ACTIVE_SYNC_TERM)}.`
    : '';
};

const loadPieStats = async (): Promise<void> => {
  const selectedYear = sessionFilterToAcademicYear(pieYearFilter.value);
  loadingVisible.value = true;
  /*
   * While the fetch is in flight both charts are treated as "not loaded yet"
   * rather than "empty", so a year change does not flash "No results yet" for
   * the ~200ms before the new data lands. The previous render is also torn down
   * here, because a chart.js instance on a canvas that is about to be hidden by
   * v-if keeps its own animation frame alive otherwise.
   */
  overviewLoading.value = true;
  try {
    const [list, results] = await Promise.all([
      fetchOverviewStudents(),
      fetchJointOverviewResults(selectedYear),
    ]);
    renderSchoolPopulationChart(list);
    renderJointPerformanceChart(results, selectedYear);
  } catch {
    renderSchoolPopulationChart([]);
    renderJointPerformanceChart([], selectedYear);
  }
  overviewLoading.value = false;
  loadingVisible.value = false;
};

const loadGlobalStats = async (): Promise<void> => {
  try {
    const data = await callApi('GET_CONFIG', {});
    if (data.status !== 'success') return;

    const currentMode = data.mode || 'MODE_A';
    const portalActive = data.portalActive ?? true;
    localStorage.setItem('LAEC_Global_Mode', currentMode);
    updateModeUI(currentMode);
    updatePortalUI(portalActive);

    if (data.academicYear) {
      ACTIVE_SYNC_YEAR = data.academicYear;
      globalSessionDisplay.value = data.academicYear;
      syncAcademicYear(data.academicYear);
      globalAcademicYear.value = data.academicYear;
      resYear.value = data.academicYear;
      pqYear.value = data.academicYear;
      invigilatorYearFilter.value = data.academicYear;
      pieYearFilter.value = academicYearToSessionFilter(data.academicYear);
    }

    if (data.currentTerm) {
      globalActiveTerm.value = data.currentTerm;
      ACTIVE_SYNC_TERM = data.currentTerm.toUpperCase();
      invigilatorTermFilter.value = ACTIVE_SYNC_TERM;
    }

    globalExamType.value = data.activeExamType || '#';
    handleCategoryChange();

    if (data.examDuration) {
      const totalMinutes = parseInt(String(data.examDuration), 10) || 0;
      timerH.value = Math.floor(totalMinutes / 60);
      timerM.value = totalMinutes % 60;
      timerS.value = 0;
    }

    updatePromotionUI(data.promotionActive ? 'on' : 'off');
    setModeDisplay(currentMode);

    const session = (window as unknown as { LAECExamSession?: { syncConfig: (rootId: string, cfg: unknown) => void } })
      .LAECExamSession;
    session?.syncConfig('exam-session-root', data);

    await loadPieStats();
  } catch {
    console.warn('Background Sync Failed');
  }
};

/* ── students (origin lines 2838–2852, 2382–2403, 3003) ───────────────── */

const getStudentsFromLambda = async (): Promise<void> => {
  loadingVisible.value = true;
  try {
    const data = await callApi('GET_STUDENTS', { schoolID: dirSchoolFilter.value });
    if (data.status === 'success') {
      students.value = data.students;
      visibleStudents.value = data.students;
      populateDataLists(students.value);
    }
  } catch {
    winAlert('Cloud Error', 'Fetch failed.');
  }
  loadingVisible.value = false;
};

const localSearch = (): void => {
  const q = dirSearch.value.toLowerCase();
  visibleStudents.value = students.value.filter(
    (s) =>
      String(s.FullName ?? '').toLowerCase().includes(q) ||
      String(s.RegNo ?? '').toLowerCase().includes(q),
  );
};

/** Datalist options, built in Vue instead of by innerHTML (origin 2382). */
const regNumberOptions = ref<{ value: string; label: string }[]>([]);
const studentNameOptions = ref<{ value: string; label: string }[]>([]);

const populateDataLists = (list: Student[]): void => {
  regNumberOptions.value = list.map((s) => ({
    value: String(s.FullName || s.RegNo),
    label: String(s.RegNo || ''),
  }));
  studentNameOptions.value = list.flatMap((s) => [
    { value: String(s.FullName), label: String(s.RegNo || '') },
    { value: String(s.RegNo), label: String(s.FullName || '') },
  ]);
};

const viewStudentProfile = (s: Student): void => {
  alertBodyHtml.value = `<img src="${s.PassportURL || '/nicegene_logo.png'}" style="width:150px; height:150px; object-fit:cover; border: 5px solid var(--laec-blue); border-radius:10px; margin-bottom:15px;">`;
  const student = s as unknown as { Password?: string };
  winAlert(
    'IDENTITY CARD',
    `NAME: ${s.FullName}\nID: ${s.RegNo}\nPASSWORD: ${student.Password || 'PROTECTED'}`,
  );
};

/* ── admins (origin lines 2405–2424) ──────────────────────────────────── */

const loadAdministratorDirectory = async (): Promise<void> => {
  try {
    const data = await callApi('GET_COGNITO_ADMINS', {
      schoolID: 'ALL',
      roles: 'SCHOOL_ADMIN,ICT_ADMIN,SUPER_ADMIN,EXAM_COMMITTEE',
    });
    adminRows.value =
      data.status === 'success' && data.admins.length
        ? data.admins
        : [];
  } catch {
    winAlert('Cloud Error', 'Administrator directory sync failed.');
  }
};

/* ── archdiocesan school registry (D23 runtime extension) ──────────────── */

/**
 * Load the school registry. The seeded ten are always first; anything added
 * this session follows. This list also feeds the "College Assignment"
 * dropdown, so a school added here is immediately assignable to an admin.
 */
const loadSchools = async (): Promise<void> => {
  try {
    const data = await callApi('GET_SCHOOLS', { schoolID: 'ALL' });
    schoolRows.value = data.status === 'success' ? data.schools : [];
  } catch {
    winAlert('Cloud Error', 'School registry sync failed.');
  }
};

/**
 * Register a new school. The response carries the created record, which is
 * appended locally so the table and the dropdown update without a second read.
 */
const addSchool = async (): Promise<void> => {
  const code = newSchoolCode.value.trim();
  const name = newSchoolName.value.trim();
  const address = newSchoolAddress.value.trim();

  if (!code || !name) {
    winAlert('Missing Data', 'Enter both a school code and a school name.');
    return;
  }

  loadingVisible.value = true;
  try {
    const data = await callApi('ADD_SCHOOL', {
      code,
      name,
      address,
      creatorUsername: localStorage.getItem(STORAGE_KEYS.AdminUsername) || '',
      creatorRole: (localStorage.getItem(STORAGE_KEYS.AdminRole) || 'SUPER_ADMIN') as AdminRole,
    });
    if (data.status !== 'success') {
      throw new Error(data.message || 'School could not be registered.');
    }
    if (data.school) schoolRows.value = [...schoolRows.value, data.school];
    newSchoolCode.value = '';
    newSchoolName.value = '';
    newSchoolAddress.value = '';
    winAlert('School Added', data.message || `${name} (${code}) added to the registry.`);
  } catch (e) {
    winAlert('Registration Failed', msgOf(e) || 'School could not be registered.');
  }
  loadingVisible.value = false;
};

/* ── multi-school platform: lifecycle, URLs, groups, stats (spec §1–§3, §5) ── */

/*
 * The multi-school surface builds on the registry above. `schoolRows` already
 * drives the College Assignment dropdown, so it stays the single list the
 * dropdowns read; the additions here are the lifecycle (status), the subdomain
 * URL, group membership and per-school statistics the spec asks the
 * administrator to manage from one place.
 *
 * `groupRows` mirrors the registry for groups: each carries its members'
 * codes, derived server-side (in the mock) from `SchoolRecord.groupId`, so the
 * panel never has to join the two lists by hand.
 */
const groupRows = ref<Array<SchoolGroup & { schoolCodes: string[] }>>([]);
const schoolSearch = ref('');
const schoolPage = ref(1);
const SCHOOL_PAGE_SIZE = 8;

/* Edit state for the details drawer. Branding is a flat object so the form can
   bind each field directly; an empty string clears that field on save. */
const editingSchool = ref<SchoolRecord | null>(null);
const editName = ref('');
const editAddress = ref('');
const editBranding = ref<Record<string, string>>({});

/* The stats drawer: which school's statistics are open, and the counts. */
const statsSchool = ref<SchoolRecord | null>(null);
const statsData = ref<SchoolStats | null>(null);
const statsLoading = ref(false);

/** Load the school groups so the registry can show each school's group. */
const loadGroups = async (): Promise<void> => {
  try {
    const data = await callApi('GET_SCHOOL_GROUPS', { schoolID: 'ALL' });
    groupRows.value = data.status === 'success' ? data.groups : [];
  } catch {
    /* Groups are decorative on this panel; a failure must not break the table. */
    groupRows.value = [];
  }
};

/** The registry filtered by the search box, then sliced for the current page. */
const filteredSchools = computed<SchoolRecord[]>(() => {
  const needle = schoolSearch.value.trim().toLowerCase();
  if (!needle) return schoolRows.value;
  return schoolRows.value.filter((s) => {
    const group = groupRows.value.find((g) => g.id === s.groupId)?.name || '';
    return (
      s.Code.toLowerCase().includes(needle) ||
      s.Name.toLowerCase().includes(needle) ||
      (s.Address || '').toLowerCase().includes(needle) ||
      s.slug.toLowerCase().includes(needle) ||
      group.toLowerCase().includes(needle)
    );
  });
});

const schoolPageCount = computed(() =>
  Math.max(1, Math.ceil(filteredSchools.value.length / SCHOOL_PAGE_SIZE)),
);

const pagedSchools = computed<SchoolRecord[]>(() => {
  const start = (schoolPage.value - 1) * SCHOOL_PAGE_SIZE;
  return filteredSchools.value.slice(start, start + SCHOOL_PAGE_SIZE);
});

const gotoSchoolPage = (page: number): void => {
  schoolPage.value = Math.min(Math.max(1, page), schoolPageCount.value);
};

/** The full public URL for a school's portal. */
const schoolUrlOf = (s: SchoolRecord): string => schoolPortalUrl(s.slug);

/** A CSS colour for a lifecycle status, for the status pill. */
const statusTone = (status: string): string =>
  status === 'ACTIVE' ? '#14532d' : status === 'SUSPENDED' ? '#8f2a2a' : '#8a6104';

/** A soft background tint matching `statusTone`. */
const statusBg = (status: string): string =>
  status === 'ACTIVE' ? '#e6f6ed' : status === 'SUSPENDED' ? '#fbe9e9' : '#fdf3dd';

/* ── edit drawer ──────────────────────────────────────────────────────── */

const startEditSchool = (s: SchoolRecord): void => {
  editingSchool.value = s;
  editName.value = s.Name;
  editAddress.value = s.Address || '';
  editBranding.value = {
    logoUrl: s.branding?.logoUrl || '',
    primaryColor: s.branding?.primaryColor || '',
    secondaryColor: s.branding?.secondaryColor || '',
    contactEmail: s.branding?.contactEmail || '',
    contactPhone: s.branding?.contactPhone || '',
    address: s.branding?.address || '',
    examInstructions: s.branding?.examInstructions || '',
  };
};

const cancelEditSchool = (): void => {
  editingSchool.value = null;
};

const saveSchoolEdit = async (): Promise<void> => {
  const school = editingSchool.value;
  if (!school) return;
  if (!editName.value.trim()) {
    winAlert('Missing Name', 'A school name is required.');
    return;
  }
  loadingVisible.value = true;
  try {
    /* Only the branding fields the administrator actually filled are sent, so
       clearing one is an explicit empty string and leaving one alone keeps the
       value already stored. */
    const branding: Record<string, string> = {};
    for (const [key, value] of Object.entries(editBranding.value)) {
      if (value !== undefined && value !== null) branding[key] = value;
    }
    const data = await callApi('UPDATE_SCHOOL', {
      code: school.Code,
      name: editName.value.trim(),
      address: editAddress.value.trim(),
      branding,
      creatorUsername: localStorage.getItem(STORAGE_KEYS.AdminUsername) || '',
      creatorRole: (localStorage.getItem(STORAGE_KEYS.AdminRole) || 'SUPER_ADMIN') as AdminRole,
    });
    if (data.status !== 'success') throw new Error(data.message || 'School could not be updated.');
    if (data.school) {
      schoolRows.value = schoolRows.value.map((s) => (s.Code === data.school!.Code ? data.school! : s));
    }
    editingSchool.value = null;
    winAlert('School Updated', data.message || `${editName.value} updated.`);
    await loadGroups();
  } catch (e) {
    winAlert('Update Failed', msgOf(e) || 'School could not be updated.');
  }
  loadingVisible.value = false;
};

/* ── lifecycle ────────────────────────────────────────────────────────── */

/*
 * Activate, deactivate or suspend a school. The confirmation names the exact
 * consequence, because SUSPENDED is the one state that also blocks the school's
 * own portal and its examination services (spec §4) — an administrator should
 * never trip it by accident.
 */
const requestStatusChange = (s: SchoolRecord, next: 'ACTIVE' | 'SUSPENDED'): void => {
  const restoring = next === 'ACTIVE';
  winAlert(
    restoring ? 'Restore School' : next === 'SUSPENDED' ? 'Suspend School' : 'Deactivate School',
    restoring
      ? `Restore ${s.Name}? Its portal and services become reachable again.`
      : next === 'SUSPENDED'
        ? `Suspend ${s.Name}? Its portal and protected examination services will be blocked until it is restored.`
        : `Deactivate ${s.Name}? It stays registered but its portal will not serve.`,
    'confirm',
    () => void applyStatus(s, next),
  );
};

const applyStatus = async (s: SchoolRecord, status: 'ACTIVE' | 'SUSPENDED'): Promise<void> => {
  loadingVisible.value = true;
  try {
    const data = await callApi('SET_SCHOOL_STATUS', {
      code: s.Code,
      status,
      creatorUsername: localStorage.getItem(STORAGE_KEYS.AdminUsername) || '',
      creatorRole: (localStorage.getItem(STORAGE_KEYS.AdminRole) || 'SUPER_ADMIN') as AdminRole,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Status could not be changed.');
    if (data.school) {
      schoolRows.value = schoolRows.value.map((row) => (row.Code === data.school!.Code ? data.school! : row));
    }
    winAlert('Status Changed', data.message || `${s.Name} is now ${status}.`);
  } catch (e) {
    winAlert('Status Change Failed', msgOf(e) || 'Status could not be changed.');
  }
  loadingVisible.value = false;
};

/* ── URLs ─────────────────────────────────────────────────────────────── */

/*
 * Regenerate a school's subdomain. The mock returns the new record and URL;
 * the school's row is swapped in place so the copy/open links update at once.
 */
const regenerateUrl = (s: SchoolRecord): void => {
  winAlert(
    'Regenerate URL',
    `Generate a new subdomain for ${s.Name}? The current address (${schoolUrlOf(s)}) will stop being used.`,
    'confirm',
    () => void applyRegenerate(s),
  );
};

const applyRegenerate = async (s: SchoolRecord): Promise<void> => {
  loadingVisible.value = true;
  try {
    const data = await callApi('REGENERATE_SCHOOL_URL', {
      code: s.Code,
      creatorUsername: localStorage.getItem(STORAGE_KEYS.AdminUsername) || '',
      creatorRole: (localStorage.getItem(STORAGE_KEYS.AdminRole) || 'SUPER_ADMIN') as AdminRole,
    });
    if (data.status !== 'success') throw new Error(data.message || 'URL could not be regenerated.');
    if (data.school) {
      schoolRows.value = schoolRows.value.map((row) => (row.Code === data.school!.Code ? data.school! : row));
    }
    winAlert('URL Regenerated', data.message || `${s.Name} now lives at ${data.url}.`);
  } catch (e) {
    winAlert('Regeneration Failed', msgOf(e) || 'URL could not be regenerated.');
  }
  loadingVisible.value = false;
};

/* Copy and open are client-side only; they need no transport. */
const copySchoolUrl = async (s: SchoolRecord): Promise<void> => {
  const url = schoolUrlOf(s);
  try {
    await navigator.clipboard.writeText(url);
    winAlert('Copied', `${url} copied to the clipboard.`);
  } catch {
    winAlert('Copy Failed', `Could not copy automatically. The URL is: ${url}`);
  }
};

/* ── group membership (spec §2) ───────────────────────────────────────── */

/*
 * Set a school's group from the row's dropdown. Passing the group id adds or
 * transfers the school; passing an empty string removes it — because a school's
 * `groupId` is a single exclusive column, moving it can never leave it in two
 * groups (spec §7).
 */
const setSchoolGroup = async (s: SchoolRecord, groupId: string): Promise<void> => {
  loadingVisible.value = true;
  try {
    const data = await callApi('SET_SCHOOL_GROUP', {
      code: s.Code,
      groupId: groupId || null,
      creatorUsername: localStorage.getItem(STORAGE_KEYS.AdminUsername) || '',
      creatorRole: (localStorage.getItem(STORAGE_KEYS.AdminRole) || 'SUPER_ADMIN') as AdminRole,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Group could not be changed.');
    if (data.school) {
      schoolRows.value = schoolRows.value.map((row) => (row.Code === data.school!.Code ? data.school! : row));
    }
    await loadGroups();
  } catch (e) {
    winAlert('Group Change Failed', msgOf(e) || 'Group could not be changed.');
    /* Reload so the dropdown snaps back to the true membership after a failure. */
    await loadGroups();
  }
  loadingVisible.value = false;
};

/* ── statistics (spec §1) ─────────────────────────────────────────────── */

const openSchoolStats = async (s: SchoolRecord): Promise<void> => {
  statsSchool.value = s;
  statsData.value = null;
  statsLoading.value = true;
  try {
    const data = await callApi('GET_SCHOOL_STATS', { code: s.Code });
    statsData.value = data.status === 'success' && data.stats ? data.stats : null;
    if (data.status !== 'success') throw new Error(data.message || 'Statistics unavailable.');
  } catch (e) {
    winAlert('Statistics Failed', msgOf(e) || 'School statistics could not be loaded.');
    statsSchool.value = null;
  }
  statsLoading.value = false;
};

const closeSchoolStats = (): void => {
  statsSchool.value = null;
  statsData.value = null;
};

/* ── results (origin lines 1742–1835, 1882–1959, 2595–2604, 2783–2836) ── */

const getResultClassValue = (result: ResultRecord): string =>
  String(result.StudentClass || result.Class || '').toUpperCase();

const getResultArmValue = (result: ResultRecord): string => {
  const direct = String(result.Arm || result.StudentArm || '').toUpperCase();
  if (direct) return direct;
  const student = students.value.find(
    (item) => String(item.RegNo || '').toUpperCase() === String(result.RegNo || '').toUpperCase(),
  );
  return getStudentArmValue(student);
};

const parseResultScriptForScore = (result: ResultRecord): Record<string, unknown>[] => {
  if (Array.isArray(result.AnswerScript)) return result.AnswerScript as Record<string, unknown>[];
  if (Array.isArray(result.answerScript)) return result.answerScript as Record<string, unknown>[];
  if (Array.isArray(result.Script)) return result.Script as Record<string, unknown>[];
  if (typeof result.AnswerScript === 'string' && result.AnswerScript.trim()) {
    try {
      const parsed: unknown = JSON.parse(result.AnswerScript);
      return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const getResultPercentage = (result: ResultRecord): number => {
  const explicit = Number(result.Percentage);
  if (Number.isFinite(explicit)) return explicit;
  const score = Number(result.Score);
  const total = Number(result.Total);
  if (Number.isFinite(score) && Number.isFinite(total) && total > 0) {
    return Math.round((score / total) * 100);
  }
  return 0;
};

const getCorrectQuestionCount = (
  result: ResultRecord,
  script: Record<string, unknown>[],
  totalUploaded: number,
  percentage: number,
): number => {
  if (script.length > 0) return script.filter((item) => item.IsCorrect).length;
  const score = Number(result.Score);
  if (Number.isFinite(score)) return score;
  if (Number.isFinite(percentage) && totalUploaded > 0) {
    return Math.round((percentage / 100) * totalUploaded);
  }
  return NaN;
};

const getAttemptedQuestionCount = (
  _result: ResultRecord,
  script: Record<string, unknown>[],
  fallbackTotal: number,
): number => {
  if (script.length > 0) {
    return script.filter((item) => {
      if (String(item.QuestionType || '').toUpperCase() === 'THEORY') return false;
      const answer = String(item.StudentAnswer ?? '').trim();
      return answer !== '' && answer.toUpperCase() !== 'BLANK';
    }).length;
  }
  return Number.isFinite(fallbackTotal) ? fallbackTotal : 0;
};

/** `correct / attempted / uploaded (percentage%)`, as the origin formats it. */
const formatResultScore = (result: ResultRecord): string => {
  const total = Number(result.Total);
  const percentage = getResultPercentage(result);
  const script = parseResultScriptForScore(result);
  const totalUploaded = Number.isFinite(total) && total > 0 ? total : script.length;
  const attempted = getAttemptedQuestionCount(result, script, totalUploaded);
  const correct = getCorrectQuestionCount(result, script, totalUploaded, percentage);

  if (
    Number.isFinite(correct) &&
    Number.isFinite(attempted) &&
    Number.isFinite(totalUploaded) &&
    totalUploaded > 0
  ) {
    return `${correct} / ${attempted} / ${totalUploaded} (${percentage}%)`;
  }
  return Number.isFinite(percentage) ? `${percentage}%` : String(result.Score || 'N/A');
};

const formatResultStatus = (result: ResultRecord): string => {
  const status = String(result.Status || '').toUpperCase();
  if (status === 'FLAGGED') {
    return '<span style="color:var(--warning); font-weight:bold">FLAGGED</span>';
  }
  const percentage = getResultPercentage(result);
  const isPass = percentage >= 50;
  return `<span style="color:${isPass ? 'green' : 'red'}">${isPass ? 'PASS' : 'FAIL'}</span>`;
};

const applyCurrentResultFilters = (results: ResultRecord[] = masterResultList.value): ResultRecord[] => {
  const query = resRegFilter.value.toLowerCase();
  const classFilter = resClassFilter.value;
  const armFilter = (resArmFilter.value || 'ALL').toUpperCase();
  return results.filter((result) => {
    const regNo = String(result.RegNo || '').toLowerCase();
    const name = String(result.FullName || '').toLowerCase();
    const matchesQuery = !query || regNo.includes(query) || name.includes(query);
    const matchesClass = classFilter === 'ALL' || getResultClassValue(result) === classFilter;
    const matchesArm = armFilter === 'ALL' || getResultArmValue(result) === armFilter;
    return matchesQuery && matchesClass && matchesArm;
  });
};

const localResultSearch = (): void => {
  renderedResultList.value = applyCurrentResultFilters();
};

const renderResultsTable = (list: ResultRecord[]): void => {
  renderedResultList.value = list || [];
};

const loadExamResults = async (): Promise<void> => {
  loadingVisible.value = true;
  const year = resYear.value;
  const school = resSchoolFilter.value;
  const category = resCategory.value;
  const subject = normalizeSubjectInput(resSubjectInput.value);
  const term = resTerm.value;
  try {
    const data = await callApi('GET_RESULTS', {
      schoolID: 'ALL',
      targetSchool: school,
      category: category as ExamCategory,
      subject,
      term: term as ExamTerm,
      year,
      mode: 'MODE_B',
    });
    if (data.status === 'success') {
      masterResultList.value = data.results;
      populateDataLists(students.value);
      renderResultsTable(applyCurrentResultFilters(data.results));
    }
  } catch {
    winAlert('Sync Error', 'Fetch failed.');
  }
  loadingVisible.value = false;
};

const scrollResultsTable = (direction: number): void => {
  const table = document.getElementById('resultsTable');
  const container = table?.closest('.table-responsive') as HTMLElement | null;
  if (!container) return;
  container.scrollBy({
    left: direction * Math.max(260, container.clientWidth * 0.75),
    behavior: 'smooth',
  });
};

/**
 * The origin's PRINT PDF button calls `downloadResultsPDF()`, which is never
 * defined in the document (origin-pages/admin.html line 1192 with no
 * definition) — the click raises an uncaught error and nothing happens.
 * Replicated rather than papered over with an invented export.
 */
const downloadResultsPDF = (): never => {
  const missing = (globalThis as unknown as Record<string, unknown>).downloadResultsPDF;
  if (typeof missing === 'function') {
    (missing as () => void)();
  }
  throw new Error('downloadResultsPDF is not defined');
};

/*
 * The answer-script viewer and its modal (RF-73, RF-109). The origin keeps this
 * block in each console's inline script and wires no control to it, so it is dead
 * code there and here (DEV-3); it is installed so the modal's own inline
 * `onclick="closeResultScriptModal()"` resolves, exactly as the page globals did
 * on the origin. The cloud re-fetch rides the mock transport, never the live
 * address the URL is built from (D-04, D-39).
 */
installResultScriptViewer({
  getMasterResults: () => masterResultList.value,
  getRenderedResults: () => renderedResultList.value,
  winAlert,
  getSchoolId: () => localStorage.getItem(STORAGE_KEYS.SchoolID) || 'GLOBAL',
  readFilter: (id) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? '',
  fetchImpl: createMockGetFetch(),
});

const remarkLoadedResults = (): void => {
  const list = applyCurrentResultFilters();
  const records = list
    .filter((item) => item.PK && item.SK)
    .map((item) => ({ pk: item.PK as string, sk: item.SK as string }));
  if (records.length === 0) {
    winAlert('No Results', 'Load results with database keys before remarking.');
    return;
  }
  winAlert(
    'REMARK RESULTS',
    `Remark ${records.length} loaded result(s) from the stored student scripts?`,
    'confirm',
    () => {
      void (async () => {
        loadingVisible.value = true;
        try {
          const data = await callApi('REMARK_STUDENT_RESULTS', { records });
          if (data.status !== 'success') throw new Error(data.message || 'Remark failed.');
          winAlert('Remark Complete', data.message || 'Results remarked successfully.');
          void loadExamResults();
        } catch (e) {
          winAlert('Remark Error', msgOf(e) || 'Could not remark results.');
        }
        loadingVisible.value = false;
      })();
    },
  );
};

const deleteSelectedSubjectResults = (): void => {
  const subject = normalizeSubjectInput(resSubjectInput.value);
  if (!subject || subject === 'ALL') {
    winAlert('Select Subject', 'Choose one subject before deleting subject results.');
    return;
  }
  const list = applyCurrentResultFilters().filter(
    (item) => String(item.Subject || '').toUpperCase() === subject,
  );
  const records = list
    .filter((item) => item.PK && item.SK)
    .map((item) => ({ pk: item.PK as string, sk: item.SK as string, subject: item.Subject as string }));
  if (records.length === 0) {
    winAlert('No Results', 'No loaded result records match the selected subject.');
    return;
  }
  winAlert(
    'DELETE SUBJECT RESULTS',
    `Delete ${records.length} loaded ${subject} result record(s)? This cannot be undone.`,
    'confirm',
    () => {
      void (async () => {
        loadingVisible.value = true;
        try {
          const data = await callApi('DELETE_SUBJECT_RESULTS', { subject, records });
          if (data.status !== 'success') throw new Error(data.message || 'Delete failed.');
          winAlert('Deleted', data.message || 'Subject results deleted.');
          void loadExamResults();
        } catch (e) {
          winAlert('Delete Error', msgOf(e) || 'Could not delete subject results.');
        }
        loadingVisible.value = false;
      })();
    },
  );
};

/* ── past questions (origin lines 2606–2634) ──────────────────────────── */

const loadPastQuestions = async (): Promise<void> => {
  const subject = pqSubject.value;
  const type = pqType.value;
  const year = pqYear.value.replace('/', '-');
  const studentClass = LAEC.normalizeClassValue(pqClass.value);
  if (subject === '#' || type === '#') {
    winAlert('Selection Required', 'Pick subject and category.');
    return;
  }
  loadingVisible.value = true;
  try {
    const { data } = await LAEC.fetchQuestionSet({
      baseUrl: 'http://mock.local/students',
      params: {
        action: 'GET_SECURE_QUESTIONS',
        schoolID: 'GLOBAL',
        year,
        term: 'TERM1',
        class: studentClass,
        subject,
        type,
        mode: 'MODE_A',
        pastOnly: '1',
      },
      fetchImpl: createMockGetFetch(),
    });
    pastQuestionRows.value = (data.questions ?? []) as Question[];
  } catch {
    winAlert('Database Error', 'Failed.');
  }
  loadingVisible.value = false;
};

/* ── question blaster + diagram hosting (origin lines 2497–2593) ──────── */

const handleBulkBlast = (): void => {
  const fileInput = document.getElementById('excel-blast') as HTMLInputElement | null;
  const sessionType = blastSession.value;

  if (sessionType === '#') {
    winAlert('Validation Error', 'Select a Target Category.');
    return;
  }
  if (!blastH.value && !blastM.value && !blastS.value) {
    winAlert('Validation Error', 'Set the Student Exam Duration.');
    return;
  }
  if (!fileInput?.files?.[0]) {
    winAlert('File Missing', 'Select your Excel question pool.');
    return;
  }

  const totalMinutes =
    (parseInt(String(blastH.value), 10) || 0) * 60 +
    (parseInt(String(blastM.value), 10) || 0) +
    (parseInt(String(blastS.value), 10) || 0) / 60;

  if (totalMinutes <= 0) {
    winAlert('Validation Error', 'Exam duration must be greater than 0.');
    return;
  }

  loadingVisible.value = true;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, {
        type: 'array',
        cellHTML: true,
        cellStyles: true,
        bookFiles: true,
      });
      const json = LAEC.extractFormattedQuestionRows(workbook);
      const normalizedQuestions = LAEC.normalizeQuestionRows(json);
      const synchronizedQuestions = normalizedQuestions.map((q) => ({
        ...q,
        Term: ACTIVE_SYNC_TERM,
        ShuffleQuestions: blastShuffle.value,
      }));

      if (json.length === 0) throw new Error('Excel file is empty.');
      if (!Object.prototype.hasOwnProperty.call(json[0], 'Class')) {
        throw new Error("Column 'Class' missing in Excel.");
      }
      if (normalizedQuestions.length === 0) {
        throw new Error('No valid question rows were found after normalization.');
      }

      const result = await callApi('BULK_UPLOAD_QUESTIONS', {
        schoolID: 'GLOBAL',
        testType: sessionType,
        questions: synchronizedQuestions,
        durationMinutes: totalMinutes,
        assessmentInstruction: blastInstruction.value.trim(),
        shuffleQuestions: blastShuffle.value,
      });
      loadingVisible.value = false;

      if (result.status === 'success') {
        winAlert(
          'Blast Complete',
          `Successfully deployed ${result.count} normalized joint questions with a ${totalMinutes}-minute timer. Use the session settings card to choose which papers go live.`,
        );
        if (fileInput) fileInput.value = '';
        blastH.value = '';
        blastM.value = '';
        blastS.value = '';
        blastInstruction.value = '';
      } else {
        throw new Error(result.message || 'Cloud rejected the upload.');
      }
    } catch (err) {
      loadingVisible.value = false;
      winAlert('Import Failure', msgOf(err));
    }
  };
  reader.readAsArrayBuffer(fileInput.files[0]);
};

const uploadQuestionImage = (): void => {
  const fileInput = document.getElementById('img-hosting') as HTMLInputElement | null;
  const file = fileInput?.files?.[0];
  if (!file) {
    winAlert('No File', 'Select an image.');
    return;
  }
  loadingVisible.value = true;
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = async () => {
    try {
      const base64 = String(reader.result ?? '').split(',')[1] ?? '';
      const data = await callApi('UPLOAD_QUESTION_IMAGE', {
        fileName: file.name,
        fileType: file.type,
        imageBase64: base64,
      });
      if (data.status === 'success') {
        hostingResultVisible.value = true;
        generatedUrl.value = data.imageUrl ?? '';
      }
    } catch {
      winAlert('Cloud Error', 'Failed.');
    }
    loadingVisible.value = false;
  };
};

const copyHostingURL = (): void => {
  const urlInput = document.getElementById('generated-url') as HTMLInputElement | null;
  if (!urlInput) return;
  urlInput.select();
  void navigator.clipboard?.writeText(urlInput.value);
  winAlert('Copied', 'URL ready.');
};

/* ── academic session, archive (origin lines 2320–2380) ───────────────── */

const updateAcademicSession = (): void => {
  const year = globalAcademicYear.value;
  const term = globalActiveTerm.value;
  const isFirstTerm = term === 'TERM1';

  winAlert(
    'CRITICAL ACTION',
    `Switching the active session to ${year} - ${term}. ${
      !isFirstTerm ? 'Note: This will also close the Promotion Exception window.' : ''
    } Proceed?`,
    'confirm',
    () => {
      void (async () => {
        loadingVisible.value = true;
        try {
          const data = await callApi('UPDATE_SESSION_CONFIG', {
            year,
            term: term as ExamTerm,
            promotionActive: isFirstTerm,
          });
          if (data.status !== 'success') throw new Error(data.message || 'Update failed.');
          globalSessionDisplay.value = year;
          winAlert(
            'Success',
            `Academic session updated to ${term}. Use the standalone archive trigger whenever you want to clean and archive the current session records.`,
          );
        } catch (e) {
          winAlert('Error', msgOf(e) || 'Update failed.');
        }
        loadingVisible.value = false;
      })();
    },
  );
};

const triggerArchiveCleanup = (): void => {
  const year = globalAcademicYear.value;
  const term = globalActiveTerm.value;

  winAlert(
    'TRIGGER ARCHIVE',
    `Archive all Questions and Results for ${year} - ${term} into S3 and clear them from DynamoDB?`,
    'confirm',
    () => {
      void (async () => {
        loadingVisible.value = true;
        try {
          const data = await callApi('TRIGGER_ARCHIVE', { year, term: term as ExamTerm });
          if (data.status !== 'success') {
            throw new Error(data.message || 'Archive trigger failed.');
          }
          const counts = data as unknown as {
            resultsArchived?: number;
            questionsArchived?: number;
          };
          winAlert(
            'Archive Complete',
            `Archived ${counts.resultsArchived || 0} result record(s) and ${
              counts.questionsArchived || 0
            } question record(s) for ${year} - ${term}.`,
          );
        } catch (e) {
          winAlert('Archive Error', msgOf(e) || 'Archive trigger failed.');
        }
        loadingVisible.value = false;
      })();
    },
  );
};

/* ── administrator access (origin lines 2426–2495) ────────────────────── */

const confirmRevokeAdmin = (username: string, email = ''): void => {
  winAlert(
    'REVOKE ACCESS',
    `Are you sure you want to permanently delete the admin account for ${username}?`,
    'confirm',
    () => void revokeAdminAccess(username, email),
  );
};

const revokeAdminAccess = async (username: string, email = ''): Promise<void> => {
  loadingVisible.value = true;
  try {
    const data = await callApi('DELETE_ADMIN_ACCESS', {
      username,
      email,
      requestorUsername: localStorage.getItem(STORAGE_KEYS.AdminUsername) || '',
      requestorRole: (localStorage.getItem(STORAGE_KEYS.AdminRole) || 'SUPER_ADMIN') as AdminRole,
      requestorSchoolID: localStorage.getItem(STORAGE_KEYS.SchoolID) || 'GLOBAL',
    });
    if (data.status === 'success') {
      winAlert('Revoked', data.message || 'Administrator access removed successfully.');
      void loadAdministratorDirectory();
    } else {
      throw new Error(data.message || 'Could not revoke access.');
    }
  } catch (e) {
    winAlert('Error', msgOf(e) || 'Could not revoke access.');
  }
  loadingVisible.value = false;
};

const createAuthorizedAdmin = async (): Promise<void> => {
  const name = admName.value.trim();
  const username = admUsername.value.trim();
  const email = admEmail.value.trim();
  const role = admRole.value;
  const school = admSchool.value;
  const password = admPass.value.trim();

  if (!name || !username || !email || !role || !school || !password) {
    winAlert('Missing Data', 'Fill all fields.');
    return;
  }
  if (!/^[A-Za-z0-9._@-]+$/.test(username)) {
    winAlert(
      'Invalid Username',
      'Admin username cannot contain spaces or apostrophes. Use only letters, numbers, @, underscore, hyphen, or dot.',
    );
    return;
  }

  loadingVisible.value = true;
  try {
    const data = await callApi('CREATE_ADMIN_ACCESS', {
      schoolID: school,
      fullName: name,
      username,
      email,
      password,
      targetRole: role as AdminRole,
      creatorUsername: localStorage.getItem(STORAGE_KEYS.AdminUsername) || '',
      creatorRole: (localStorage.getItem(STORAGE_KEYS.AdminRole) || 'SUPER_ADMIN') as AdminRole,
      creatorSchoolID: localStorage.getItem(STORAGE_KEYS.SchoolID) || 'GLOBAL',
    });
    if (data.status === 'success') {
      void loadAdministratorDirectory();
      const extra = data as unknown as { emailStatus?: string; status?: string };
      const title =
        extra.emailStatus === 'failed' || extra.status === 'warning' ? 'Email Warning' : 'Success';
      winAlert(
        title,
        data.message || 'Admin authorized. Temporary login details have been emailed automatically.',
      );
      admName.value = '';
      admUsername.value = '';
      admEmail.value = '';
      admPass.value = '';
    } else {
      throw new Error(data.message || 'Admin authorization failed.');
    }
  } catch (e) {
    winAlert('Gateway Error', msgOf(e) || 'Failed to connect.');
  }
  loadingVisible.value = false;
};

/* ── invigilation monitor (origin lines 2854–2876, 2901–2987) ────────── */

const INVIGILATOR_CATEGORIES: ExamCategory[] = ['CA1', 'CA2', 'EXAM'];

const dedupeInvigilatorResults = (results: ResultRecord[]): ResultRecord[] => {
  const seen = new Set<string>();
  return results.filter((item) => {
    const key = [item.PK, item.SK, item.RegNo, item.Subject, item.Timestamp]
      .filter(Boolean)
      .join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getInvigilatorClassFilter = (): string => (invigClass.value || 'ALL').toUpperCase();

const isTimeExpiryViolation = (value: unknown): boolean => {
  const text = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
  return text === 'TIME EXPIRED' || text === 'EXPIRED TIME';
};

const fetchInvigilatorResultsFor = async (params: {
  school: string;
  category: string;
  mode: string;
  year: string;
  term: string;
  subject: string;
  studentClass: string;
}): Promise<ResultRecord[]> => {
  const data = await callApi('GET_RESULTS', {
    schoolID: 'ALL',
    targetSchool: params.school,
    category: params.category as ExamCategory,
    mode: params.mode as 'MODE_A',
    year: params.year,
    term: params.term as ExamTerm,
    subject: params.subject || 'ALL',
    class: params.studentClass || 'ALL',
  });
  return data.status === 'success' ? data.results : [];
};

const refreshInvigilatorFeed = async (): Promise<void> => {
  const schoolFilter = invigSchool.value;
  const yearFilter = invigilatorYearFilter.value || ACTIVE_SYNC_YEAR;
  const termFilter = invigilatorTermFilter.value || ACTIVE_SYNC_TERM;
  const modeFilter = invigMode.value;
  const classFilter = getInvigilatorClassFilter();
  const subjectFilter = normalizeSubjectInput(invigSubject.value);
  const schools = schoolFilter === 'ALL' ? Object.keys(SCHOOL_NAMES) : [schoolFilter];
  const modes = modeFilter === 'ALL' ? ['MODE_A', 'MODE_B'] : [modeFilter];
  loadingVisible.value = true;

  try {
    const batches = await Promise.all(
      schools.flatMap((school) =>
        modes.flatMap((mode) =>
          INVIGILATOR_CATEGORIES.map((category) =>
            fetchInvigilatorResultsFor({
              school,
              category,
              mode,
              year: yearFilter,
              term: termFilter,
              subject: subjectFilter,
              studentClass: classFilter,
            }),
          ),
        ),
      ),
    );
    invigilatorRows.value = dedupeInvigilatorResults(batches.flat())
      .filter((result) => String(result.Status || '').toUpperCase() === 'FLAGGED')
      .filter((result) => classFilter === 'ALL' || getResultClassValue(result) === classFilter)
      .filter(
        (result) => subjectFilter === 'ALL' || String(result.Subject || '').toUpperCase() === subjectFilter,
      )
      .sort((a, b) => new Date(b.Timestamp || 0).getTime() - new Date(a.Timestamp || 0).getTime());
  } catch {
    winAlert('Cloud Error', 'Unable to sync proctoring feed right now.');
  }
  loadingVisible.value = false;
};

const deleteFilteredFlaggedResults = (): void => {
  void (async () => {
    await refreshInvigilatorFeed();
    const records = invigilatorRows.value
      .filter((result) => result.PK && result.SK)
      .filter((result) => !isTimeExpiryViolation(result.Violation))
      .map((result) => ({
        pk: result.PK as string,
        sk: result.SK as string,
        status: result.Status as string,
        violation: result.Violation || '',
      }));
    if (records.length === 0) {
      winAlert('No Flagged Results', 'Load flagged students for a class and subject before deleting.');
      return;
    }
    const classFilter = getInvigilatorClassFilter();
    const subjectFilter = normalizeSubjectInput(invigSubject.value);
    winAlert(
      'CONFIRM DELETION',
      `Delete ${records.length} flagged result(s) for ${classFilter} / ${subjectFilter}? Students will be able to re-write.`,
      'confirm',
      () => {
        void (async () => {
          loadingVisible.value = true;
          try {
            const data = await callApi('DELETE_FLAGGED_RESULTS', { records });
            if (data.status !== 'success') {
              throw new Error(data.message || 'Could not delete flagged results.');
            }
            winAlert('Success', data.message || 'Flagged results deleted.');
            await refreshInvigilatorFeed();
          } catch (e) {
            winAlert('Delete Error', msgOf(e) || 'Could not delete flagged results.');
          }
          loadingVisible.value = false;
        })();
      },
    );
  })();
};

/* ── latency ping (origin lines 2989–3001) ────────────────────────────── */

/* The thresholds the health panel and the latency card share. Named so the two
   surfaces cannot drift: the card colour and the status line come from the same
   numbers. `bad` is new — the origin only had good/else, so anything over 400ms
   was "LATENCY DETECTED" in the same amber whether it was 450ms or 4s. */
const PING_GOOD_MS = 400;
const PING_BAD_MS = 1200;

const checkHealth = (): void => {
  const start = Date.now();
  const img = new Image();
  img.onload = img.onerror = () => {
    const ms = Date.now() - start;
    pingMs.value = `${ms} ms`;
    pingLarge.value = `${ms} ms`;
    if (ms < PING_GOOD_MS) {
      pingStatus.value = 'STABLE CONNECTION';
      pingStatusColor.value = 'var(--success)';
      pingTone.value = 'good';
    } else if (ms < PING_BAD_MS) {
      pingStatus.value = 'LATENCY DETECTED';
      pingStatusColor.value = 'var(--warning)';
      pingTone.value = 'warn';
    } else {
      pingStatus.value = 'SEVERE LATENCY';
      pingStatusColor.value = 'var(--danger)';
      pingTone.value = 'bad';
    }
    pingCheckedAt.value = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };
  img.src = `https://s3.amazonaws.com/favicon.ico?rand=${start}`;
};

/*
 * The six subject optgroups the origin repeats in three places are kept
 * verbatim in one component so a divergence cannot creep in — including the
 * origin's own repeats and inconsistencies ("Marywood Girl's College" vs
 * "Marywood Girls College", "Further Mathematics" vs "Further Mathematics
 * (Business)", PHE / CRS / HISTORY / FRENCH in more than one group).
 */
const CORE = [
  ['MATHEMATICS', 'Mathematics'],
  ['ENGLISH_LANGUAGE', 'English Language'],
  ['CITIZENSHIP_HERITAGE', 'Citizenship & Heritage Studies'],
  ['DIGITAL_TECHNOLOGY', 'Digital Technology (ICT)'],
  ['CIVIC_EDUCATION', 'Civic Education'],
  ['CRS', 'Christian Religious Studies (CRS)'],
  ['NIGERIAN_LANGUAGE', 'Nigerian Language (Yoruba/Igbo/Hausa)'],
] as const;

const JUNIOR = [
  ['INTERMEDIATE_SCIENCE', 'Intermediate Science (B/ Science)'],
  ['BASIC_TECH', 'Basic Tech'],
  ['BUSINESS_STUDIES', 'Business Studies'],
  ['NIGERIAN_HISTORY', 'Nigerian History'],
  ['HISTORY', 'History'],
  ['NATIONAL_VALUES', 'National Values (NVE)'],
  ['BASIC_SCIENCE_TECHNOLOGY', 'Basic Science and Technology (BST)'],
  ['MUSIC', 'Music'],
  ['FINE_ART', 'Fine Art'],
  ['AGRIC_SCIENCE_JSS', 'Agric'],
  ['HOME_ECONOMICS', 'Home Economics'],
  ['CIVIC_SECURITY', 'Civic & Security Studies'],
  ['CCA', 'Cultural & Creative Arts'],
  ['PHE', 'Physical & Health Education'],
  ['PRE_VOCATIONAL_STUDIES', 'Pre-Vocational Studies (Agric/Home Ec)'],
  ['FRENCH', 'French (Optional)'],
] as const;

const SENIOR_SCIENCE = [
  ['BIOLOGY', 'Biology'],
  ['CHEMISTRY', 'Chemistry'],
  ['PHYSICS', 'Physics'],
  ['FURTHER_MATHEMATICS', 'Further Mathematics'],
  ['AGRIC_SCIENCE_SSS', 'Agricultural Science'],
  ['PHE', 'Physical Health Education'],
  ['GEOGRAPHY', 'Geography'],
  ['TECHNICAL_DRAWING', 'Technical Drawing'],
  ['BASIC_ELECTRICITY', 'Basic Electricity'],
  ['FOOD_NUTRITION', 'Foods and Nutrition'],
] as const;

const SENIOR_ARTS = [
  ['LITERATURE_IN_ENGLISH', 'Literature in English'],
  ['GOVERNMENT', 'Government'],
  ['HISTORY', 'History'],
  ['FRENCH', 'French'],
  ['YORUBA', 'Yoruba'],
  ['VISUAL_ARTS', 'Visual Arts'],
  ['MUSIC', 'Music'],
  ['HOME_MANAGEMENT', 'Home Management'],
  ['CRS', 'Christian Religious Studies (CRS)'],
] as const;

const COMMERCIAL = [
  ['ECONOMICS', 'Economics'],
  ['COMMERCE', 'Commerce'],
  ['FINANCIAL_ACCOUNTING', 'Accounting'],
  ['MARKETING', 'Marketing'],
  ['FURTHER_MATHEMATICS', 'Further Mathematics (Business)'],
  ['GOVERNMENT', 'Government'],
  ['OFFICE_PRACTICE', 'Office Practice'],
] as const;

const TRADE = [
  ['SOLAR_PV_INSTALLATION', 'Solar PV Installation & Maintenance'],
  ['FASHION_DESIGN', 'Garment Making and Fashion Designing'],
  ['LIVESTOCK_FARMING', 'Livestock Farming'],
  ['BEAUTY_COSMETOLOGY', 'Beauty & Cosmetology'],
  ['COMPUTER_GSM_REPAIR', 'Computer Hardware & GSM Repairs'],
  ['HORTICULTURE_CROP', 'Horticulture'],
  ['DATA_PROCESSING', 'Data Processing'],
  ['CATERING_CRAFT', 'Catering Craft Practice'],
  ['ANIMAL_HUSBANDRY', 'Animal Husbandry'],
  ['BOOK_KEEPING', 'Book-Keeping'],
  ['PHOTOGRAPHY', 'Photography'],
] as const;

const SUBJECT_GROUPS: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, string]>]> = [
  ['Core Compulsory Subjects', CORE],
  ['Junior Secondary Subjects', JUNIOR],
  ['Senior Science & Maths', SENIOR_SCIENCE],
  ['Senior Arts & Humanities', SENIOR_ARTS],
  ['Senior Commercial', COMMERCIAL],
  ['New Trade & Entrepreneurship', TRADE],
];

const SubjectOptions = defineComponent({
  name: 'SubjectOptions',
  setup() {
    return () =>
      SUBJECT_GROUPS.map(([label, options]) =>
        h('optgroup', { label }, options.map(([value, text]) => h('option', { value }, text))),
      );
  },
});

/* ── RF-5 idle timeout (head guard) + RF-3 guard ──────────────────────── */

useIdleTimeout({ mode: 'admin' });

onMounted(async () => {
  // RF-3 (origin parity, unreachable while the router guard runs first)
  const session = localStorage.getItem(STORAGE_KEYS.LAEC_Session);
  const role = String(localStorage.getItem(STORAGE_KEYS.AdminRole) || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (!session || role !== 'SUPER_ADMIN') {
    document.documentElement.style.display = 'none';
    window.location.replace('/control/');
    throw new Error('Administrator session required.');
  }

  /*
   * The account pill shows the operator's name on its own. It used to be
   * prefixed "MASTER ADMIN: ", which restated the role badge sitting beside it
   * and, at the pill's max-width, meant the truncated part was the prefix and
   * the name was cut to "LAE…". The role is carried by `.topbar-role` and the
   * breadcrumb; the name is what this slot is for.
   */
  const adminName = localStorage.getItem(STORAGE_KEYS.AdminName);
  if (adminName) headerTitle.value = adminName;
  copyrightYear.value = String(new Date().getFullYear());

  await nextTick();
  startAdminIdleTracking();
  syncHeaderOffset();
  toggleBackToTopButton();
  window.addEventListener('resize', syncHeaderOffset);
  window.addEventListener('scroll', toggleBackToTopButton, { passive: true });
  handleCategoryChange();

  refreshArchiveNotice();
  restoreCachedModeUI();
  restoreActiveTab();

  // `LAECExamSession` — the paper queue in #exam-session-root. The origin
  // passes the live `AWS_CONFIG.getStudentsEndpoint`; the library's only
  // network call is `utils.fetchQuestionInventory`, which accepts a
  // `fetchImpl`, so the mock stands in and the library's own rendering,
  // selection and pruning logic is unchanged (D-39).
  const examSession = (window as unknown as {
    LAECExamSession?: { init: (config: Record<string, unknown>) => void };
  }).LAECExamSession;
  /*
   * The question manager (RF-79). The library is loaded first-party and hard-codes
   * the live endpoints from /config.js, so the bridge answers its five actions
   * from the typed mock; `init()` is called here because the library's own
   * DOMContentLoaded listener fires before this view mounts (D-46).
   */
  installLibraryFetchBridge();
  window.LAECQuestionManager?.init();

  examSession?.init({
    rootId: 'exam-session-root',
    categorySelectId: 'global-exam-type',
    schoolID: 'GLOBAL',
    mode: 'MODE_A',
    baseUrl: 'http://mock.local/students',
    getCategory: () => globalExamType.value,
    getYear: () => ACTIVE_SYNC_YEAR,
    getTerm: () => ACTIVE_SYNC_TERM,
    utils: {
      ...LAEC,
      fetchQuestionSet: (options: Parameters<typeof LAEC.fetchQuestionSet>[0]) =>
        LAEC.fetchQuestionSet({ ...options, fetchImpl: createMockGetFetch() }),
      fetchQuestionInventory: (options: Parameters<typeof LAEC.fetchQuestionInventory>[0]) =>
        LAEC.fetchQuestionInventory({ ...options, fetchImpl: createMockGetFetch() }),
    } as typeof LAEC,
  });

  void getStudentsFromLambda();
  void loadGlobalStats();
  void loadAdministratorDirectory();
  void loadSchools();
  void loadGroups();
  checkHealth();
  setInterval(checkHealth, 10000);

  // The first-party modules reach for these page globals, exactly as the
  // origin's top-level function declarations provided them. They are fulfilled
  // through the entry's dispatcher so `admin-sidebar.js` keeps the
  // `window.toggleNav` wrapper it installed before this bundle ran.
  const hooks = ((window as unknown as Record<string, unknown>).__LAEC_ADMIN_HOOKS__ ??=
    {}) as Record<string, unknown>;
  Object.assign(hooks, {
    winAlert,
    closeAlert,
    toggleNav,
    showTab,
    scrollToTopPage,
    handleLogout,
  });

  // The origin's sidebar enhancement runs against a parsed document; here the
  // DOM only exists after mount, so the module is loaded now (single run).
  const sidebarScript = document.createElement('script');
  sidebarScript.src = '/admin-sidebar.js';
  document.head.appendChild(sidebarScript);
});
</script>

<template>
  <!-- §2.4 bubble field (identical to the glass surfaces) -->
  <div class="bubble-field" aria-hidden="true">
    <span class="bubble" style="--size: 72px; --left: 6%; --duration: 19s; --delay: -4s; --drift: 34px"></span>
    <span class="bubble" style="--size: 46px; --left: 14%; --duration: 15s; --delay: -10s; --drift: -26px"></span>
    <span class="bubble" style="--size: 118px; --left: 24%; --duration: 24s; --delay: -7s; --drift: 52px"></span>
    <span class="bubble" style="--size: 58px; --left: 38%; --duration: 17s; --delay: -2s; --drift: -42px"></span>
    <span class="bubble" style="--size: 92px; --left: 52%; --duration: 22s; --delay: -13s; --drift: 30px"></span>
    <span class="bubble" style="--size: 40px; --left: 63%; --duration: 14s; --delay: -5s; --drift: -18px"></span>
    <span class="bubble" style="--size: 132px; --left: 72%; --duration: 27s; --delay: -15s; --drift: -58px"></span>
    <span class="bubble" style="--size: 64px; --left: 84%; --duration: 18s; --delay: -8s; --drift: 36px"></span>
    <span class="bubble" style="--size: 34px; --left: 93%; --duration: 13s; --delay: -1s; --drift: -24px"></span>
  </div>

  <AppLoading :visible="loadingVisible" text="LAEC Secure Synchronizing..." />

  <AppAlert
    :visible="alertVisible"
    :title="alertTitle"
    :msg="alertMsg"
    :cancel-visible="alertCancelVisible"
    :confirm-visible="alertConfirmVisible"
    @close="closeAlert"
    @confirm="confirmAlert"
  >
    <template #media>
      <div id="alert-body" v-html="alertBodyHtml"></div>
    </template>
  </AppAlert>

  <AppShell
    :role="currentRole"
    :role-label="navMeta.roleLabel"
    :breadcrumb="navMeta.breadcrumb"
    :groups="navGroups"
    :scope="SHELL_SCOPE"
    :scope-kind="navMeta.scopeKind"
    :active-id="activeTab"
    :identity="headerTitle"
    @select="showTab"
    @logout="handleLogout"
  >

  <button
    class="back-to-top"
    id="backToTopBtn"
    aria-label="Back to top"
    :class="{ visible: backToTopVisible }"
    @click="scrollToTopPage"
  >
    ↑
  </button>

  <div class="view-well">
    <!--
      ── the Saint Finbarr's College admin modules ────────────────────────
      Mounted here, before the seven transcribed LAEC panels, so the LAEC markup
      keeps its own sequence and this is clearly an addition to the page rather
      than a rewrite of it.

      `v-if` on the active panel and one router for all of them: the origin
      navigates to a route, so only the route it navigated to has a component, and
      this is that. It is also what makes `AppShell`'s first-panel shortcut work,
      since the shell activates an item by clicking it.

      The wrapper carries the id and the `tab-panel active` class so the panel sits
      inside the same `.view-well` box the LAEC panels use, and `data-admin-panel`
      so a browser test can assert which module is mounted without reading the
      rail.
    -->
    <div
      v-if="isAdminPanel(activeTab)"
      :id="activeTab"
      class="tab-panel active ap-admin-panel"
      :data-admin-panel="activeTab"
    >
      <AdminPanelRouter :panel-id="activeTab" :can="sessionCan" />
    </div>

    <datalist id="reg-numbers-list">
      <option v-for="o in regNumberOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
    </datalist>
    <datalist id="student-names-list">
      <option v-for="o in studentNameOptions" :key="o.value + o.label" :value="o.value">{{ o.label }}</option>
    </datalist>

    <!-- ── DASHBOARD ────────────────────────────────────────────────── -->
    <div id="dashboard" class="tab-panel" :class="{ active: activeTab === 'dashboard' }">
      <!--
        All four stat cards share one value treatment.

        Each value used to carry its own inline `font-size` (2.1rem by default,
        1.8rem for the session, 1.2rem for the mode), so the row read as four
        different cards at four different sizes — and the mode card was the worst
        of them, its "INTERNAL (Colleges)" shrunk to 1.2rem purely to fit a long
        string. The size now comes from the class below; the only per-card
        difference left is a colour, which is a semantic choice rather than a
        sizing workaround.

        The mode card also no longer shrinks to fit: the value is the short
        "INTERNAL" / "JOINT" token and the long form is a subtitle underneath,
        which is what a caption is for.
      -->
      <div class="stats-grid">
        <div class="stat-card">
          <h4>Total Registered Students</h4>
          <div class="value" id="count-total">{{ overviewStudentTotal }}</div>
          <p class="stat-sub">
            {{ overviewStudentTotal === '1' ? 'student in the directory' : 'students in the directory' }}
          </p>
        </div>
        <div class="stat-card">
          <h4>Active Academic Session</h4>
          <div class="value stat-value-accent" id="global-session-display">
            {{ globalSessionDisplay }}
          </div>
        </div>
        <div class="stat-card">
          <h4>System Mode</h4>
          <div class="value stat-value-accent" id="current-mode-display">
            {{ currentModeShort }}
          </div>
          <p class="stat-sub">{{ currentModeDisplay }}</p>
        </div>
        <div class="stat-card">
          <h4>AWS Latency</h4>
          <div class="value" id="ping-ms" :class="`stat-tone-${pingTone}`">{{ pingMs }}</div>
          <!--
            What the number is, and how fresh it is. The card previously showed
            a bare "1211 ms" with no unit of measurement and no timestamp, so a
            stale reading and a fresh one looked identical.
          -->
          <p
            class="stat-sub"
            :title="`${pingWhat} Last checked ${pingCheckedAt || 'not yet'}.`"
          >
            {{ pingWhat }} · {{ pingCheckedAt }}
          </p>
        </div>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="overview-card-header">
            <div>
              <h3>Joint Exam School Performance</h3>
              <p id="joint-performance-note" class="overview-chart-note" v-html="jointPerformanceNote"></p>
            </div>
          </div>
          <!--
            The canvas is kept mounted and hidden with v-show rather than
            removed, so chart.js keeps the same context across the
            data/empty-state swap. Removing it left the old instance attached to
            a detached node, still running its resize observer.
          -->
          <div class="overview-chart-frame">
            <div class="overview-chart-canvas" v-show="!jointPerformanceEmpty">
              <canvas id="jointPerformanceChart"></canvas>
            </div>
            <ChartEmptyState
              v-if="jointPerformanceEmpty"
              :title="jointEmptyTitle"
              :description="jointEmptyDesc"
            />
          </div>
          <div class="overview-filter-row">
            <label for="pie-year-filter">Academic Year</label>
            <select id="pie-year-filter" v-model="pieYearFilter" @change="loadPieStats()">
              <option v-for="y in yearOptions" :key="y" :value="'YEAR#' + y">{{ y }}/{{ y + 1 }} Session</option>
            </select>
          </div>
        </div>
        <div class="card">
          <div class="overview-card-header">
            <div>
              <h3>School Population Histogram</h3>
              <p id="school-population-note" class="overview-chart-note" v-html="schoolPopulationNote"></p>
            </div>
          </div>
          <div class="overview-chart-frame">
            <div class="overview-chart-canvas overview-chart-canvas-bars" v-show="!schoolPopulationEmpty">
              <canvas id="schoolPopulationChart"></canvas>
            </div>
            <ChartEmptyState
              v-if="schoolPopulationEmpty"
              :title="overviewLoading ? 'Loading population…' : 'No students yet'"
              :description="
                overviewLoading
                  ? 'Fetching the student directory for the current session.'
                  : 'No students are registered, so there is no population to distribute across the schools. The histogram appears here as soon as the directory has entries.'
              "
            />
          </div>
        </div>
      </div>
    </div>

    <!-- ── STUDENT DIRECTORY (LAEC) ────────────────────────────────────
         The panel id was `students` before the Saint Finbarr's admin addendum and
         is `student-directory` now, because the school-management module that took
         the `students` id needed it (see the collision note in lib/nav.ts). The
         markup below is unchanged; only the id, its `activeTab` test and its
         `showTab` address moved. -->
    <div id="student-directory" class="tab-panel" :class="{ active: activeTab === 'student-directory' }">
      <div class="card">
        <div class="grid-2">
          <div>
            <label>Filter By College</label>
            <select id="dir-school-filter" v-model="dirSchoolFilter" @change="getStudentsFromLambda()">
              <option value="ALL">All Schools</option>
              <option v-for="s in schoolRows" :key="s.Code" :value="s.Code">{{ s.Name }} ({{ s.Code }})</option>
            </select>
          </div>
          <div>
            <label>Filter By Class</label>
            <select id="dir-class-filter">
              <option value="ALL">All Classes</option>
              <option value="JSS1">JSS 1</option><option value="JSS2">JSS 2</option><option value="JSS3">JSS 3</option>
              <option value="SS1">SS 1</option><option value="SS2">SS 2</option><option value="SS3">SS 3</option>
            </select>
          </div>
          <div>
            <label>Quick Search</label>
            <input type="text" id="dir-search" list="student-names-list" placeholder="Search Name or ID..." v-model="dirSearch" @keyup="localSearch()" />
          </div>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 15px">
          <button class="btn-primary" @click="getStudentsFromLambda()">LOAD DIRECTORY</button>
          <button class="btn-success" @click="exportToExcel('studentTable', 'Student_Directory')">DOWNLOAD EXCEL</button>
        </div>
      </div>
      <div class="table-responsive">
        <table id="studentTable">
          <thead>
            <tr>
              <th>S/N</th><th>Photo</th><th>Full Name</th><th>Reg ID</th><th>College</th>
              <th>Class</th><th>Arm</th><th>Date</th><th>Action</th>
            </tr>
          </thead>
          <tbody id="student-table-body">
            <tr v-for="(s, index) in visibleStudents" :key="s.RegNo || index">
              <td>{{ index + 1 }}</td>
              <td><img :src="s.PassportURL || '/nicegene_logo.png'" class="photo-circle" /></td>
              <td><b>{{ s.FullName }}</b></td>
              <td style="color: var(--laec-blue); font-weight: bold">{{ s.RegNo }}</td>
              <td>{{ s.SchoolID || 'N/A' }}</td>
              <td>{{ s.Class }}</td>
              <td>{{ getStudentArmValue(s) || 'N/A' }}</td>
              <td>{{ studentDate(s) }}</td>
              <td>
                <button style="font-size: 9px; padding: 4px 8px; cursor: pointer" @click="viewStudentProfile(s)">
                  VIEW
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── RESULTS ──────────────────────────────────────────────────── -->
    <div id="results" class="tab-panel" :class="{ active: activeTab === 'results' }">
      <div class="card">
        <h3>Cumulative Results Processor</h3>
        <div class="grid-2">
          <div>
            <label>Academic Year</label>
            <select id="res-year" v-model="resYear">
              <option v-for="y in yearOptions" :key="y" :value="`${y}/${y + 1}`">{{ y }}/{{ y + 1 }}</option>
            </select>
          </div>
          <div>
            <label>Term</label>
            <select id="res-term" v-model="resTerm">
              <option value="#">....Select Term....</option><option value="TERM1">1st TERM</option><option value="TERM2">2nd TERM</option><option value="TERM3">3rd TERM</option>
            </select>
          </div>
          <div>
            <label>Target Category</label>
            <select id="res-category" v-model="resCategory">
              <option value="#">....Select Category....</option><option value="CA1">CA 1</option><option value="CA2">CA 2</option>
              <option value="EXAM" selected>EXAM</option>
              <option value="ALL_CUMULATIVE" style="font-weight: bold; color: var(--laec-blue)">All Results (Cumulative)</option>
            </select>
          </div>
          <div>
            <label>Filter By Student Name</label>
            <input type="text" id="res-reg-filter" list="reg-numbers-list" placeholder="Type student name" v-model="resRegFilter" @keyup="localResultSearch()" />
          </div>
          <div>
            <label>Filter By Class</label>
            <select id="res-class" v-model="resClassFilter" @change="localResultSearch()">
              <option value="ALL">All Classes</option>
              <option value="JSS1">JSS 1</option><option value="JSS2">JSS 2</option><option value="JSS3">JSS 3</option>
              <option value="SS1">SS 1</option><option value="SS2">SS 2</option><option value="SS3">SS 3</option>
            </select>
          </div>
          <div>
            <label>Filter By Arm</label>
            <select id="res-arm" v-model="resArmFilter" @change="localResultSearch()" v-html="getArmOptionsMarkup('ALL')"></select>
          </div>
          <div>
            <label>Select School</label>
            <select id="res-school" v-model="resSchoolFilter">
              <option value="ALL">...Select School...</option>
              <option v-for="s in schoolRows" :key="s.Code" :value="s.Code">{{ s.Name }}</option>
            </select>
          </div>
          <div>
            <label>Subject</label>
            <input type="text" id="res-subject" list="res-subject-options" placeholder="Type or choose a subject" v-model="resSubjectInput" @input="localResultSearch()" />
            <datalist id="res-subject-options"><SubjectOptions /></datalist>
          </div>
        </div>
        <div class="filter-action-cell">
          <label>&nbsp;</label>
          <div class="filter-action-buttons">
            <button class="btn-primary" @click="loadExamResults()">LOAD RESULTS</button>
            <button class="btn-warning" v-if="sessionStore.can('results.remark')" @click="remarkLoadedResults()">REMARK</button>
            <button class="btn-success" @click="exportToExcel('resultsTable', 'Termly_Results_Sheet')">
              DOWNLOAD SPREADSHEET
            </button>
            <button class="btn-danger" v-if="sessionStore.can('results.delete')" @click="deleteSelectedSubjectResults()">DELETE SUBJECT RESULTS</button>
            <!-- the origin calls a function that does not exist — see downloadResultsPDF -->
            <button class="btn-secondary" @click="downloadResultsPDF()">PRINT PDF</button>
          </div>
        </div>
      </div>
      <div class="result-scroll-shell">
        <button type="button" class="result-scroll-btn result-scroll-left" aria-label="Scroll results left" @click="scrollResultsTable(-1)">&lt;</button>
        <button type="button" class="result-scroll-btn result-scroll-right" aria-label="Scroll results right" @click="scrollResultsTable(1)">&gt;</button>
        <div class="table-responsive">
          <table id="resultsTable">
            <thead id="results-thead">
              <tr>
                <th>S/N</th><th>Name</th><th>ID</th><th>School</th><th>Class</th><th>Arm</th>
                <th>Subject</th><th>Score</th><th>Status</th>
              </tr>
            </thead>
            <tbody id="results-table-body">
              <tr v-for="(r, index) in renderedResultList" :key="(r.PK || '') + (r.SK || '') + index">
                <td>{{ index + 1 }}</td>
                <td>{{ r.FullName }}</td>
                <td>{{ r.RegNo }}</td>
                <td>{{ r.SchoolID }}</td>
                <td>{{ getResultClassValue(r) || 'N/A' }}</td>
                <td>{{ getResultArmValue(r) || 'N/A' }}</td>
                <td>{{ r.Subject }}</td>
                <td><b>{{ formatResultScore(r) }}</b></td>
                <td v-html="formatResultStatus(r)"></td>
              </tr>
              <tr v-if="!renderedResultList.length">
                <td colspan="9" style="text-align: center; color: #999">No results found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── EXAM MGT ─────────────────────────────────────────────────── -->
    <div id="exam-mgt" class="tab-panel" :class="{ active: activeTab === 'exam-mgt' }">
      <div class="control-box">
        <div>
          <h2 style="margin: 0">Exam Control Center</h2>
          <p id="mode-hint" style="opacity: 0.8; margin: 5px 0 0">{{ modeHint }}</p>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap">
          <div class="mode-toggle-group">
            <button id="mode-a-btn" class="mode-btn" :class="{ 'active-a': modeA }" @click="toggleSystemMode('MODE_A')">
              MODE A (JOINT)
            </button>
            <button id="mode-b-btn" class="mode-btn" :class="{ 'active-b': modeB }" @click="toggleSystemMode('MODE_B')">
              MODE B (INTERNAL)
            </button>
          </div>
          <div class="mode-toggle-group">
            <button id="portal-off-btn" class="mode-btn" :class="{ 'active-off': portalOff }" @click="togglePortal(false)">
              PORTAL OFF
            </button>
            <button id="portal-on-btn" class="mode-btn" :class="{ 'active-on': portalOn }" @click="togglePortal(true)">
              PORTAL ON
            </button>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Examination Settings</h3>
        <div class="grid-2">
          <div>
            <label>Active Category</label>
            <select id="global-exam-type" v-model="globalExamType" @change="handleCategoryChange()">
              <option value="#">....Select Category....</option><option value="CA1">CA 1</option><option value="CA2">CA 2</option><option value="EXAM">Exam</option>
            </select>
          </div>
          <div>
            <label>Default Safety Timer (Optional HH:MM:SS)</label>
            <div style="display: flex; gap: 5px">
              <input type="number" id="timer-h" placeholder="HH" min="0" max="23" v-model="timerH" :disabled="timerDisabled" />
              <input type="number" id="timer-m" placeholder="MM" min="0" max="59" v-model="timerM" :disabled="timerDisabled" />
              <input type="number" id="timer-s" placeholder="SS" min="0" max="59" v-model="timerS" :disabled="timerDisabled" />
            </div>
          </div>
        </div>
        <!-- rendered by the first-party /exam-session-controls.js module -->
        <div id="exam-session-root"></div>
        <button class="btn-primary" style="margin-top: 20px; width: 100%" @click="updateExamGlobal()">
          SYNC GLOBAL SESSION SETTINGS
        </button>
      </div>

      <div class="grid-2">
        <div class="card" style="border-top: 5px solid var(--success)">
          <h3 style="color: var(--success)">🚀 Question Blaster (Joint)</h3>
          <label>Target Category</label>
          <select id="blast-session" v-model="blastSession" style="border-left: 4px solid var(--success)">
            <option value="#">....Select Category....</option><option value="CA1">CA 1</option><option value="CA2">CA 2</option><option value="EXAM">EXAM</option>
          </select>

          <div style="margin-top: 15px; padding: 12px; background: #f0fff4; border-radius: 8px; border: 1px dashed var(--success)">
            <label style="color: var(--success)">Joint Exam Duration (HH:MM:SS)</label>
            <div style="display: flex; gap: 8px; margin-top: 5px">
              <input type="number" id="blast-h" placeholder="HH" v-model="blastH" style="text-align: center; background: white" />
              <input type="number" id="blast-m" placeholder="MM" v-model="blastM" style="text-align: center; background: white" />
              <input type="number" id="blast-s" placeholder="SS" v-model="blastS" style="text-align: center; background: white" />
            </div>
            <p style="font-size: 10px; color: #555; margin-top: 8px; font-style: italic">
              * Mandatory: Paper-specific duration for students.
            </p>
          </div>

          <label style="margin-top: 10px">Upload Question Pool (Excel)</label>
          <input type="file" id="excel-blast" accept=".xlsx, .xls" style="margin-bottom: 10px" />
          <label style="margin-top: 10px">Assessment Specific Instruction</label>
          <textarea
            id="blast-instruction"
            v-model="blastInstruction"
            rows="4"
            placeholder="Example: Answer all questions. Use the diagram supplied for questions 4-6."
            style="width: 100%; box-sizing: border-box; margin-bottom: 10px; resize: vertical"
          ></textarea>
          <label style="display: flex; align-items: center; gap: 10px; margin: 0 0 10px; text-transform: none; color: #2d3748">
            <input type="checkbox" id="blast-shuffle" v-model="blastShuffle" style="width: 18px; height: 18px" />
            <span style="font-size: 0.78rem; font-weight: 800">Shuffle questions for students</span>
          </label>
          <p style="margin: 0 0 10px; font-size: 0.78rem; color: #5f7087; line-height: 1.5">
            Go-live subject control now lives in the global session settings card above. Use this blaster only
            to upload the question batch and set the compulsory student timer for that paper.
          </p>
          <button class="btn-success" style="width: 100%; font-weight: 800; padding: 15px" @click="handleBulkBlast()">
            START SYNCHRONIZED BLAST
          </button>
        </div>

        <div class="card">
          <h3>Diagram Hosting</h3>
          <label>Upload Image</label>
          <input type="file" id="img-hosting" accept="image/*" />
          <button class="btn-primary" style="width: 100%; margin-top: 10px" @click="uploadQuestionImage()">
            GET CLOUD LINK
          </button>

          <div id="hosting-result" :class="{ hidden: !hostingResultVisible }" style="margin-top: 15px; padding: 12px; background: #eef5ff; border-radius: 8px; border: 1px solid var(--laec-blue)">
            <label style="color: var(--laec-blue); font-size: 10px">Generated Link (Copy to Excel):</label>
            <div style="display: flex; gap: 5px">
              <input type="text" id="generated-url" v-model="generatedUrl" readonly style="flex: 1; padding: 8px; font-size: 11px" />
              <button class="btn-success" style="padding: 5px 12px; font-size: 11px" @click="copyHostingURL()">COPY</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="border-left: 5px solid var(--laec-accent); border-top: 3px solid var(--danger)">
        <h3>Academic Session &amp; Promotion (CRITICAL ACTION)</h3>
        <p style="font-size: 0.8rem; color: #666; margin-bottom: 1.5rem" v-html="archiveNotice"></p>
        <div class="grid-2">
          <div>
            <label>Active Academic Year</label>
            <select id="global-academic-year" v-model="globalAcademicYear">
              <option v-for="y in yearOptions" :key="y" :value="`${y}/${y + 1}`">{{ y }}/{{ y + 1 }}</option>
            </select>
          </div>
          <div>
            <label>Active Term</label>
            <select id="global-active-term" v-model="globalActiveTerm">
              <option value="TERM1">1st Term</option><option value="TERM2">2nd Term</option><option value="TERM3">3rd Term</option>
            </select>
          </div>
        </div>
        <div style="margin-top: 15px">
          <button class="btn-primary" style="width: 100%; margin-bottom: 10px" @click="updateAcademicSession()">
            UPDATE SESSION
          </button>
          <button class="btn-danger" style="width: 100%" v-if="sessionStore.can('exam.schedule.manage')" @click="triggerArchiveCleanup()">TRIGGER ARCHIVE</button>
        </div>

        <div style="margin-top: 20px; padding: 2rem; background: linear-gradient(135deg, var(--laec-blue), #003366); border-radius: 15px; color: white">
          <label style="color: white; opacity: 0.9; margin-bottom: 15px">Session Migration Control</label>
          <div class="mode-toggle-group" style="width: fit-content; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2)">
            <button id="promo-on-btn" class="mode-btn" :class="{ 'active-on': promoOn }" @click="confirmPromotion('on')">
              PROMOTE ALL CLASSES
            </button>
            <button id="promo-off-btn" class="mode-btn" :class="{ 'active-off': promoOff }" @click="confirmPromotion('off')">
              UNDO PROMOTIONS
            </button>
          </div>
          <p id="promo-status-hint" style="font-size: 0.7rem; color: white; opacity: 0.8; margin-top: 15px; font-weight: bold">
            {{ promoStatusHint }}
          </p>
        </div>
      </div>

    </div>

    <!-- ── PAST QUESTIONS ───────────────────────────────────────────── -->
    <div id="past-questions" class="tab-panel" :class="{ active: activeTab === 'past-questions' }">
      <div class="card">
        <h3>Question Archive</h3>
        <div class="grid-2">
          <div>
            <label>Subject</label>
            <select id="pq-subject" v-model="pqSubject">
              <option value="#">....Select Subject....</option>
              <SubjectOptions />
            </select>
          </div>
          <div>
            <label>Target Category</label>
            <select id="pq-type" v-model="pqType">
              <option value="#">....Select Category....</option><option value="CA1">CA 1</option><option value="CA2">CA 2</option><option value="EXAM">EXAM</option>
            </select>
          </div>
          <div>
            <label>Year</label>
            <select id="pq-year" v-model="pqYear">
              <option v-for="y in yearOptions" :key="y" :value="`${y}/${y + 1}`">{{ y }}/{{ y + 1 }}</option>
            </select>
          </div>
          <div>
            <label>Target Class</label>
            <select id="pq-class" v-model="pqClass">
              <option value="JSS1">JSS1</option><option value="JSS2">JSS2</option><option value="JSS3">JSS3</option>
              <option value="SS1">SS1</option><option value="SS2">SS2</option><option value="SS3">SS3</option>
            </select>
          </div>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 20px">
          <button class="btn-primary" @click="loadPastQuestions()">LOAD QUESTIONS</button>
          <button class="btn-success" @click="exportToExcel('pqTable', 'Past_Questions_Audit')">DOWNLOAD AUDIT</button>
        </div>
      </div>
      <div class="table-responsive">
        <table id="pqTable">
          <thead><tr><th>SN</th><th>Subject</th><th>Class</th><th>Type</th><th>Question text</th></tr></thead>
          <tbody id="pq-table-body">
            <tr v-for="(q, index) in pastQuestionRows" :key="index">
              <td>{{ index + 1 }}</td>
              <td>{{ LAEC.humanizeSubject(q.Subject || '') }}</td>
              <td>{{ q.Class }}</td>
              <td>{{ pqType }}</td>
              <td style="font-size: 11px">{{ q.Question || q.Text }}</td>
            </tr>
            <tr v-if="!pastQuestionRows.length">
              <td colspan="5" style="text-align: center; color: #999">No questions found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── SCHOOLS ──────────────────────────────────────────────────── -->
    <!-- The archdiocesan school registry (D23 runtime extension), extended
         into the multi-school platform's Schools Management surface (spec §1).
         The origin hardcodes ten schools with no way to add one; this panel
         registers, edits, activates/suspends and hands out each school's
         subdomain URL, and is super-administrator-only via the `schools.*`
         codes. -->
    <div id="schools" class="tab-panel" :class="{ active: activeTab === 'schools' }">
      <div class="card">
        <h3>Register a School</h3>
        <p style="font-size: 0.75rem; color: #666; margin-bottom: 1.5rem">
          Register a new archdiocesan school. Its subdomain URL is generated automatically from the name. A new
          school becomes selectable across every console — in the College Assignment dropdown, the directory
          filters and the joint-exam reports — as soon as it is added.
        </p>
        <div class="grid-2">
          <div>
            <label>School Code</label>
            <input type="text" id="school-code" v-model="newSchoolCode" placeholder="e.g. ABC" maxlength="10" />
            <p style="font-size: 0.68rem; color: #777; margin: 6px 0 0">
              2–10 letters or numbers, no spaces or punctuation. This is the SchoolID used in registration
              numbers and export filenames.
            </p>
          </div>
          <div>
            <label>School Name</label>
            <input type="text" id="school-name" v-model="newSchoolName" placeholder="e.g. Archdiocese College" />
          </div>
          <div>
            <label>Address (optional)</label>
            <input type="text" id="school-address" v-model="newSchoolAddress" placeholder="e.g. Akoka, Yaba, Lagos" />
          </div>
        </div>
        <button class="btn-primary" style="margin-top: 20px" @click="addSchool()">ADD SCHOOL</button>
      </div>

      <!-- ── edit drawer (spec §1 edit, §5 branding) ─────────────────── -->
      <div class="card" v-if="editingSchool">
        <h3>Edit {{ editingSchool.Name }}</h3>
        <p style="font-size: 0.72rem; color: #666; margin-bottom: 1.25rem">
          Update the school's profile and the branding shown on its own portal. Leave a branding field empty to
          clear it; the URL, status and group are managed from the table below.
        </p>
        <div class="grid-2">
          <div>
            <label>School Name</label>
            <input type="text" v-model="editName" />
          </div>
          <div>
            <label>Address</label>
            <input type="text" v-model="editAddress" placeholder="e.g. Akoka, Yaba, Lagos" />
          </div>
        </div>
        <h4 style="margin: 1.5rem 0 0.75rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #666">
          Portal Branding
        </h4>
        <div class="grid-2">
          <div>
            <label>Logo URL</label>
            <input type="text" v-model="editBranding.logoUrl" placeholder="/logo.png" />
          </div>
          <div>
            <label>Primary Colour</label>
            <input type="text" v-model="editBranding.primaryColor" placeholder="#123456" />
          </div>
          <div>
            <label>Secondary Colour</label>
            <input type="text" v-model="editBranding.secondaryColor" placeholder="#654321" />
          </div>
          <div>
            <label>Contact Email</label>
            <input type="text" v-model="editBranding.contactEmail" placeholder="office@school.edu" />
          </div>
          <div>
            <label>Contact Phone</label>
            <input type="text" v-model="editBranding.contactPhone" placeholder="+234…" />
          </div>
          <div>
            <label>Branding Address</label>
            <input type="text" v-model="editBranding.address" placeholder="Shown in the portal footer" />
          </div>
          <div style="grid-column: 1 / -1">
            <label>Examination Instructions</label>
            <textarea v-model="editBranding.examInstructions" rows="3" placeholder="Shown to candidates before a paper starts"></textarea>
          </div>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 20px">
          <button class="btn-primary" @click="saveSchoolEdit()">SAVE CHANGES</button>
          <button class="btn-secondary" style="background: #eee; color: #333; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer" @click="cancelEditSchool()">CANCEL</button>
        </div>
      </div>

      <!-- ── statistics drawer (spec §1 school-specific statistics) ──── -->
      <div class="card" v-if="statsSchool">
        <div style="display: flex; justify-content: space-between; align-items: center">
          <h3>{{ statsSchool.Name }} — Statistics</h3>
          <button style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #666" @click="closeSchoolStats()">×</button>
        </div>
        <p style="font-size: 0.72rem; color: #666; margin: 0.5rem 0 1.25rem">
          School-scoped figures for {{ statsSchool.Code }}. These are derived from the platform's own records for
          this school; a school with no data yet reports zeros rather than a guess.
        </p>
        <div v-if="statsLoading" style="color: #777; font-size: 0.8rem">Loading statistics…</div>
        <div v-else-if="statsData" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px">
          <div v-for="item in [
            { label: 'Students', value: statsData.students },
            { label: 'Teachers', value: statsData.teachers },
            { label: 'Exams', value: statsData.exams },
            { label: 'Questions', value: statsData.questions },
            { label: 'Results', value: statsData.results },
          ]" :key="item.label" style="border: 1px solid #e5e5e5; border-radius: 8px; padding: 14px; text-align: center">
            <div style="font-size: 1.5rem; font-weight: bold; color: var(--laec-blue)">{{ item.value }}</div>
            <div style="font-size: 0.7rem; color: #777; text-transform: uppercase; letter-spacing: 0.05em">{{ item.label }}</div>
          </div>
        </div>
      </div>

      <!-- ── registry table ──────────────────────────────────────────── -->
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 1rem">
          <h3 style="margin: 0">Registered Schools</h3>
          <input type="text" v-model="schoolSearch" @input="gotoSchoolPage(1)" placeholder="Search by code, name, address, URL or group…" style="max-width: 320px; width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.8rem" />
        </div>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Code</th><th>School Name</th><th>Status</th><th>Subdomain URL</th><th>Group</th><th>Type</th><th>Actions</th>
              </tr>
            </thead>
            <tbody id="school-table-body">
              <tr v-for="s in pagedSchools" :key="s.Code">
                <td style="font-weight: bold; color: var(--laec-blue)">{{ s.Code }}</td>
                <td>{{ s.Name }}</td>
                <td>
                  <span :style="{ fontSize: '0.68rem', fontWeight: 'bold', color: statusTone(s.status), background: statusBg(s.status), padding: '3px 8px', borderRadius: '10px' }">{{ s.status }}</span>
                </td>
                <td style="font-size: 0.72rem">
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
                    <code style="color: #444">{{ schoolUrlOf(s) }}</code>
                    <button title="Copy URL" style="background: none; border: none; cursor: pointer; color: var(--laec-blue); font-size: 0.9rem" @click="copySchoolUrl(s)">⧉</button>
                    <a :href="schoolUrlOf(s)" target="_blank" rel="noopener" title="Open portal" style="color: var(--laec-blue); text-decoration: none">↗</a>
                    <button title="Regenerate URL" style="background: none; border: none; cursor: pointer; color: #8a6104; font-size: 0.9rem" @click="regenerateUrl(s)">↻</button>
                  </div>
                </td>
                <td>
                  <select :value="s.groupId || ''" @change="setSchoolGroup(s, ($event.target as HTMLSelectElement).value)" style="font-size: 0.72rem; padding: 4px 6px; border: 1px solid #ddd; border-radius: 5px; max-width: 140px">
                    <option value="">— None —</option>
                    <option v-for="g in groupRows" :key="g.id" :value="g.id">{{ g.name }}</option>
                  </select>
                </td>
                <td><span style="font-size: 0.7rem; font-weight: bold">{{ s.builtin ? 'BUILT-IN' : 'ADDED' }}</span></td>
                <td style="font-size: 0.72rem; white-space: nowrap">
                  <button style="background: none; border: none; cursor: pointer; color: var(--laec-blue); font-size: 0.72rem; margin-right: 8px" @click="openSchoolStats(s)">Stats</button>
                  <button style="background: none; border: none; cursor: pointer; color: var(--laec-blue); font-size: 0.72rem; margin-right: 8px" @click="startEditSchool(s)">Edit</button>
                  <button v-if="s.status !== 'ACTIVE'" style="background: none; border: none; cursor: pointer; color: #14532d; font-size: 0.72rem; font-weight: bold" @click="requestStatusChange(s, 'ACTIVE')">Restore</button>
                  <button v-else style="background: none; border: none; cursor: pointer; color: #8f2a2a; font-size: 0.72rem; font-weight: bold" @click="requestStatusChange(s, 'SUSPENDED')">Suspend</button>
                </td>
              </tr>
              <tr v-if="!pagedSchools.length">
                <td colspan="7" style="text-align: center; color: #999">{{ schoolSearch ? 'No schools match your search.' : 'No schools loaded.' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Pagination (spec §9). Hidden when a single page suffices. -->
        <div v-if="schoolPageCount > 1" style="display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 1rem">
          <button :disabled="schoolPage <= 1" style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; background: #fff" @click="gotoSchoolPage(schoolPage - 1)">Prev</button>
          <span style="font-size: 0.78rem; color: #666">Page {{ schoolPage }} of {{ schoolPageCount }}</span>
          <button :disabled="schoolPage >= schoolPageCount" style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; background: #fff" @click="gotoSchoolPage(schoolPage + 1)">Next</button>
        </div>
      </div>
    </div>

    <!-- ── SCHOOL GROUPS ─────────────────────────────────────────────── -->
    <!-- The multi-school platform's grouping surface (spec §2). Mounted as a
         standalone component inside this always-present div, which is what
         lets `showTab`'s element guard open the panel; the component owns the
         group CRUD and membership and reports back through its own banner.
         `v-if` defers its data load until the panel is actually opened. -->
    <div id="school-groups" class="tab-panel" :class="{ active: activeTab === 'school-groups' }">
      <SchoolGroupsPanel v-if="activeTab === 'school-groups'" />
    </div>

    <!-- ── ADMINS ───────────────────────────────────────────────────── -->
    <div id="admins" class="tab-panel" :class="{ active: activeTab === 'admins' }">
      <div class="card">
        <h3>Administrator Access Portal</h3>
        <p style="font-size: 0.75rem; color: #666; margin-bottom: 1.5rem">
          Create and manage credentials for College and Archdiocese Administrators. The directory below now
          lists School Admin accounts only.
        </p>
        <div class="grid-2">
          <div><label>Admin Full Name</label><input type="text" id="adm-name" v-model="admName" placeholder="Enter Full Name" /></div>
          <div>
            <label>Username / Admin ID</label>
            <input type="text" id="adm-username" v-model="admUsername" placeholder="e.g. yourrole@schoolname" />
            <p style="font-size: 0.68rem; color: #777; margin: 6px 0 0">
              No spaces or apostrophes. Use letters, numbers, @, underscore, hyphen, or dot. Example:
              eugene@finbarrscollege.
            </p>
          </div>
          <div>
            <label>Assigned Administrative Role</label>
            <select id="adm-role" v-model="admRole">
              <option value="#">....Select Role....</option>
              <option value="SCHOOL_ADMIN">SCHOOL_ADMIN (College Dashboard)</option>
              <option value="EXAM_COMMITTEE">EXAM_COMMITTEE (Joint Committee)</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN (Master Access)</option>
            </select>
          </div>
          <div>
            <label>Official Email Address</label>
            <input type="email" id="adm-email" v-model="admEmail" placeholder="admin@nicegeneco.com" />
            <p style="font-size: 0.68rem; color: #777; margin: 6px 0 0">
              Use a dedicated email. An email already used by a student cannot be used for admin access.
            </p>
          </div>
          <div>
            <label>College Assignment (Custom SchoolID)</label>
            <select id="adm-school-list" v-model="admSchool">
              <option value="#">....Select School....</option>
              <option value="GLOBAL">Archdiocese (Master Level)</option>
              <option v-for="s in schoolRows" :key="s.Code" :value="s.Code">{{ s.Name }} ({{ s.Code }})</option>
            </select>
          </div>
          <div>
            <label>Temporary Password</label>
            <!-- D7: the origin ships this as a plaintext input -->
            <input type="text" id="adm-pass" v-model="admPass" placeholder="Enter Temporary Password" />
          </div>
        </div>
        <button class="btn-primary" style="margin-top: 20px" @click="createAuthorizedAdmin()">
          GRANT ACCESS PERMISSION
        </button>
      </div>
      <div class="table-responsive">
        <table>
          <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>School</th><th>Action</th></tr></thead>
          <tbody id="admin-table-body">
            <tr v-for="adm in adminRows" :key="adm.Username || adm.Email">
              <td>{{ adm.FullName }}</td>
              <td style="font-weight: bold; color: var(--laec-blue)">{{ adm.Username || 'N/A' }}</td>
              <td>{{ adm.Email }}</td>
              <td><span style="font-size: 0.7rem; font-weight: bold">{{ adm.Role || 'SCHOOL_ADMIN' }}</span></td>
              <td>{{ adm.SchoolID || 'GLOBAL' }}</td>
              <td>
                <button
                  class="btn-danger"
                  style="padding: 4px 8px; font-size: 10px"
                  @click="confirmRevokeAdmin(adm.Username || '', adm.Email)"
                >
                  REVOKE
                </button>
              </td>
            </tr>
            <tr v-if="!adminRows.length">
              <td colspan="6" style="text-align: center; color: #999">No school administrators found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── SYSTEM HEALTH ────────────────────────────────────────────── -->
    <div id="health" class="tab-panel" :class="{ active: activeTab === 'health' }">
      <div class="card" style="text-align: center; padding: 2rem 1rem">
        <h3>Cloud Heartbeat details (Latency Nigeria to USA)</h3>
        <h1 id="ping-large" style="font-size: 5rem; margin: 0; color: var(--laec-blue)">{{ pingLarge }}</h1>
        <p id="ping-status" style="font-weight: bold" :style="pingStatusColor ? { color: pingStatusColor } : undefined">{{ pingStatus }}</p>
      </div>

      <div class="card" style="border-top: 5px solid var(--danger)">
        <h3>Real-Time Proctoring &amp; Invigilation Monitor (Global)</h3>
        <p style="font-size: 0.8rem; color: #666; margin-bottom: 1.5rem">
          🚨 <b>Security Oversight:</b> This feed strictly monitors only flagged students across the
          Archdiocese.
        </p>

        <div class="grid-2" style="margin-bottom: 20px">
          <div>
            <label>Filter By School</label>
            <select id="invigilator-school-filter" v-model="invigSchool">
              <option value="ALL">All Schools</option>
              <option v-for="s in schoolRows" :key="s.Code" :value="s.Code">{{ s.Name }}</option>
            </select>
          </div>
          <div>
            <label>Academic Year</label>
            <select id="invigilator-year-filter" v-model="invigilatorYearFilter">
              <option v-for="y in yearOptions" :key="y" :value="`${y}/${y + 1}`">{{ y }}/{{ y + 1 }}</option>
            </select>
          </div>
          <div>
            <label>Term</label>
            <select id="invigilator-term-filter" v-model="invigilatorTermFilter">
              <option value="TERM1">1st Term</option><option value="TERM2">2nd Term</option><option value="TERM3">3rd Term</option>
            </select>
          </div>
          <div>
            <label>Mode</label>
            <select id="invigilator-mode-filter" v-model="invigMode">
              <option value="MODE_A">Joint Exam (Mode A)</option>
            </select>
          </div>
          <div>
            <label>Class</label>
            <select id="invigilator-class-filter" v-model="invigClass" @change="refreshInvigilatorFeed()">
              <option value="ALL">All Classes</option>
              <option value="JSS1">JSS 1</option><option value="JSS2">JSS 2</option><option value="JSS3">JSS 3</option>
              <option value="SS1">SS 1</option><option value="SS2">SS 2</option><option value="SS3">SS 3</option>
            </select>
          </div>
          <div>
            <label>Subject</label>
            <input type="text" id="invigilator-subject-filter" list="res-subject-options" placeholder="Type or choose subject" v-model="invigSubject" @change="refreshInvigilatorFeed()" />
          </div>
          <div style="display: flex; align-items: flex-end; gap: 10px">
            <button class="btn-primary" style="flex: 1; border-radius: 4px; padding: 10px 14px" @click="refreshInvigilatorFeed()">
              LOAD FLAGGED STUDENTS
            </button>
            <button class="btn-danger" style="flex: 1; border-radius: 4px; padding: 10px 14px" @click="deleteFilteredFlaggedResults()">
              DELETE FILTERED FLAGGED RESULTS
            </button>
            <button class="btn-success" style="flex: 1; border-radius: 4px; padding: 10px 14px" @click="exportToExcel('invigilatorTable', 'Security_Violation_Log')">
              DOWNLOAD VIOLATION LOG
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table id="invigilatorTable">
            <thead>
              <tr>
                <th>Time</th><th>Student Name</th><th>School</th><th>Class</th><th>Subject</th>
                <th>Exam Category</th><th>Violation Reason</th>
              </tr>
            </thead>
            <tbody id="invigilator-feed-body">
              <tr v-for="(result, index) in invigilatorRows" :key="(result.PK || '') + (result.SK || '') + index">
                <td>{{ result.Timestamp ? new Date(result.Timestamp).toLocaleString() : '---' }}</td>
                <td>
                  <b>{{ result.FullName || 'UNKNOWN' }}</b><br /><span style="font-size: 0.72rem; color: #777">{{ result.RegNo || '' }}</span>
                </td>
                <td>{{ result.SchoolID || 'N/A' }}</td>
                <td>{{ getResultClassValue(result) || 'N/A' }}</td>
                <td>{{ LAEC.humanizeSubject(result.Subject || '') }}</td>
                <td>{{ result.Category || 'N/A' }} ({{ result.Mode || 'MODE_A' }})</td>
                <td style="color: var(--danger); font-weight: bold">{{ result.Violation || 'Tab Switch/Focus Lost' }}</td>
              </tr>
              <tr v-if="!invigilatorRows.length">
                <td colspan="7" style="text-align: center; color: var(--success); font-weight: bold">
                  No violations found for the selected filters.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
  </AppShell>

  <footer class="system-footer" style="width: 100%; padding: 20px 0; background: var(--border); border-top: 1px solid var(--border); margin-top: auto; text-align: center">
    <div style="max-width: 1200px; margin: 0 auto; padding: 0 20px">
      <p style="margin: 5px 0 0; font-size: 0.65rem; font-weight: 500; color: #55606b; text-transform: uppercase; letter-spacing: 2px">
        LAEC CLOUD-BASED INTEGRATED EXAMINATION MANAGEMENT SYSTEM
      </p>
      <p style="margin: 0; font-size: 0.8rem; color: #55606b; font-weight: 500; letter-spacing: 0.5px">
        &copy; <span id="copyright-year">{{ copyrightYear }}</span>
        <span style="color: var(--laec-blue); font-weight: 700">NICEGENE TECHNOLOGIES</span>. All Rights
        Reserved.
      </p>
    </div>
  </footer>
</template>

