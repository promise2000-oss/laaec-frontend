/**
 * Typed mock adapter covering all 38 actions of PRD §3.6 (decision D-05).
 *
 * - No network access of any kind: every response is fabricated locally.
 * - Latency is simulated (80–220 ms) so asynchronous UI states are exercised.
 * - `failNextCall(action, …)` injects a failure for the next call only:
 *   with `httpStatus` it throws ApiHttpError (exercising RF-98 retries),
 *   without it returns a `{ status: 'error' }` envelope (exercising UC-10).
 */

import type { ActionName, ApiMap, ApiRequest, ApiResponse } from './contract';
import { POST_ACTIONS } from './contract';
import { ApiHttpError } from './errors';
import type {
  AdminAccount,
  AdminRole,
  CalendarEvent,
  NoticeBoardItem,
  Paper,
  PortalNotification,
  Question,
  QuestionStatus,
  QuestionSubmissionRecord,
  SchoolRecord,
  TeacherNotice,
} from '../types';
import { STORAGE_KEYS } from '../types';
import { useSessionStore } from '../stores/session';

/**
 * The school roles held by this session, for the transport's permission gate.
 *
 * Read from the store rather than from storage directly, because the store is
 * where `setSchoolRole` writes and it is what the rail reads — so all three
 * consumers see the same list in the same tick. Falling back to storage covers
 * the first paint, before Pinia has hydrated; a role granted a moment earlier
 * is in storage by then either way.
 */
const readSchoolRoles = (): string[] => {
  try {
    const store = useSessionStore();
    if (store.schoolRoles.length) return store.schoolRoles;
  } catch {
    // Pinia not active yet — storage is the fallback below.
  }
  const raw = localStorage.getItem(STORAGE_KEYS.AdminSchoolRoles);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((e): e is string => typeof e === 'string') : [];
  } catch {
    return [];
  }
};
import { SCHOOL_NAMES, SCHOOL_ORDER } from '../lib/console';
import {
  bypassesPermissions,
  hasAdminPlaceholder,
  hasPermission,
  registerAdminModuleLookup,
  resolveAdminPermission,
} from '../lib/permissions';
import { ADMIN_MODULES } from '../types/admin-registry';
import { effectivePermissions } from '../lib/roles';
import { teacherHandlers } from './mockTeacher';
import { adminHandlers } from './mockAdmin';
import {
  MOCK_ADMINS,
  MOCK_CALENDAR_EVENTS,
  MOCK_CONFIG,
  MOCK_DEMOTION_COUNTS,
  MOCK_DEMOTION_LOGS,
  MOCK_INVENTORY,
  MOCK_NOTICES,
  MOCK_NOTIFICATIONS,
  MOCK_QUESTIONS,
  MOCK_RESULTS,
  MOCK_SCHOOL_ID,
  MOCK_STUDENTS,
  MOCK_SUBMISSIONS,
  MOCK_TEACHER_NOTICES,
} from './mockData';

const LATENCY_MIN_MS = 80;
const LATENCY_MAX_MS = 220;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface FailureInjection {
  message: string;
  /** When set, the call rejects with ApiHttpError(status) instead of returning an error envelope. */
  httpStatus?: number;
  /**
   * How many calls the injection survives (default 1 = one-shot). Raise it to
   * outlive RF-98's retry attempts and exercise an ultimate-failure path.
   */
  attemptsRemaining?: number;
}

const pendingFailures = new Map<ActionName, FailureInjection>();

/** Arm a failure for the next call of `action` (one-shot). */
export function failNextCall(
  action: ActionName,
  failure: FailureInjection = { message: 'Mock failure injected.' },
): void {
  pendingFailures.set(action, failure);
}

/** Clear every armed failure (test teardown). */
export function resetMockFailures(): void {
  pendingFailures.clear();
}

/**
 * Dev-only override for the portal-state fixture. `/login/` removes the login
 * interface when `portalActive === false` or `isOffline === true` (RF-8), and
 * routes a student to the migration picker when `isPromotionActive === true`
 * (RF-16); the shipped fixture has both the portal open and the promotion
 * window open, so one of those two branches is unreachable from any single
 * browser run without a way to flip them. Exposed on `window.__LAEC_MOCK__` and
 * tree-shaken out of production builds with the rest of the mock.
 *
 * It is kept in `localStorage` rather than a module variable because the
 * portal-state check runs on mount, before any `page.evaluate` can reach the
 * mock: a run has to be able to set the override and then reload.
 */
const PORTAL_STATE_KEY = 'LAEC_MOCK_PORTAL_STATE';

interface PortalStateOverride {
  portalActive?: boolean;
  isOffline?: boolean;
  isPromotionActive?: boolean;
  /** Replaces `StartTime` / `EndTime` on every live paper (RF-19). */
  liveWindow?: { StartTime: string; EndTime: string };
}

function readPortalStateOverride(): PortalStateOverride | null {
  // `import.meta.env.DEV` folds to `false` in a production build, so the
  // override and its storage key are dropped from `dist/` along with the rest
  // of the mock seam.
  if (!import.meta.env.DEV) return null;
  try {
    const raw = window.localStorage.getItem(PORTAL_STATE_KEY);
    return raw ? (JSON.parse(raw) as PortalStateOverride) : null;
  } catch {
    return null;
  }
}

export function setPortalStateOverride(next: PortalStateOverride | null): void {
  if (next) window.localStorage.setItem(PORTAL_STATE_KEY, JSON.stringify(next));
  else window.localStorage.removeItem(PORTAL_STATE_KEY);
}

const ok = (message: string) => ({ status: 'success' as const, message });

/**
 * Live windows that always qualify as "now" (full ISO timestamps either side
 * of any real clock). JSS3 is deliberately absent so the hallway's red
 * "no active examination" panel is reachable with a JSS3 mock student.
 */
const LIVE_WINDOW = {
  StartTime: '2020-01-01T00:00:00+01:00',
  EndTime: '2099-12-31T23:59:59+01:00',
} as const;

/** Seeded passwords. A working copy below is what onboarding mutates. */
const MOCK_ADMIN_PASSWORDS: Record<string, string> = {
  mocksuper: 'MockAdminPass1',
  /* The two addendum roles (D-55) — review console and authoring console. */
  'central@nicegeneco.com': 'Admin@2026',
  'teacher@nicegeneco.com': 'Teacher@2026',
  'teacher2@nicegeneco.com': 'Teacher@2026',
  mockschool: 'MockAdminPass1',
  mockict: 'MockAdminPass1',
  mockcommittee: 'MockAdminPass1',
  /** Temporary-password account that triggers the forced change (RF-59). */
  mocktemp: 'TempAdmin1!',
  /** Seeded operator account (D-52) — see MOCK_ADMINS. */
  'admin@nicegeneco.com': 'Admin@2026',
};

/**
 * Session persistence for the mutable state (D-54).
 *
 * The mock is in-memory by design, but the authoring workflow is multi-page by
 * nature: a teacher drafts on /teacher/, hands the browser to a reviewer, and
 * comes back to read the decision. If the working copies reset on every route
 * change the draft is gone before it is ever reviewed, so the submissions,
 * notices, staff directory and password table are seeded from the fixtures once
 * and then kept in sessionStorage for the life of the tab. It clears with the
 * session, exactly like the rest of the mock.
 */
const STATE_KEY = 'LAEC_MOCK_LIFECYCLE';

interface PersistedState {
  submissions: QuestionSubmissionRecord[];
  teacherNotices: TeacherNotice[];
  staffDirectory: AdminAccount[];
  adminPasswords: Record<string, string>;
  submissionCounter: number;
  notifications: PortalNotification[];
  calendarEvents: CalendarEvent[];
  notices: NoticeBoardItem[];
  notificationCounter: number;
  /** The archdiocesan school registry, seeded from the ten hardcoded schools. */
  schools: SchoolRecord[];
}

const seedState = (): PersistedState => ({
  submissions: MOCK_SUBMISSIONS.map((item) => ({ ...item, Questions: item.Questions.map((q) => ({ ...q })) })),
  teacherNotices: MOCK_TEACHER_NOTICES.map((item) => ({ ...item })),
  staffDirectory: MOCK_ADMINS.map((item) => ({ ...item })),
  adminPasswords: { ...MOCK_ADMIN_PASSWORDS },
  submissionCounter: MOCK_SUBMISSIONS.length,
  notifications: MOCK_NOTIFICATIONS.map((item) => ({ ...item })),
  calendarEvents: MOCK_CALENDAR_EVENTS.map((item) => ({ ...item })),
  notices: MOCK_NOTICES.map((item) => ({ ...item })),
  notificationCounter: MOCK_NOTIFICATIONS.length,
  /* The school registry (D23 runtime extension) is seeded from the ten schools
     the origin hardcodes, marked builtin so the panel can protect them. */
  schools: SCHOOL_ORDER.map((code) => ({
    Code: code,
    Name: SCHOOL_NAMES[code],
    builtin: true,
  })),
});

const loadState = (): PersistedState => {
  try {
    const raw = window.sessionStorage.getItem(STATE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!Array.isArray(parsed.submissions) || !Array.isArray(parsed.staffDirectory)) return seedState();
    const seeded = seedState();
    /* An older session (or a corrupt one) may carry no school registry, so fall
       back to the seeded ten rather than rendering an empty dropdown. */
    const schools = Array.isArray(parsed.schools) && parsed.schools.length
      ? parsed.schools
      : seeded.schools;
    return { ...seeded, ...parsed, schools } as PersistedState;
  } catch {
    return seedState();
  }
};

const initialState = loadState();

const saveState = (): void => {
  try {
    window.sessionStorage.setItem(
      STATE_KEY,
      JSON.stringify({
        submissions: initialState.submissions,
        teacherNotices: initialState.teacherNotices,
        staffDirectory: initialState.staffDirectory,
        adminPasswords: initialState.adminPasswords,
        submissionCounter: initialState.submissionCounter,
        notifications: initialState.notifications,
        calendarEvents: initialState.calendarEvents,
        notices: initialState.notices,
        notificationCounter: initialState.notificationCounter,
        schools: initialState.schools,
      } satisfies PersistedState),
    );
  } catch {
    /* storage unavailable - the in-memory copies still hold for this page */
  }
};

/**
 * Working copies of the authoring fixtures (D-53). The teacher, reviewer and
 * onboarding actions mutate these in place, so they are loaded once from the
 * fixtures (or from the session copy) rather than the read-only exports.
 */
const submissions: QuestionSubmissionRecord[] = initialState.submissions;
const teacherNotices: TeacherNotice[] = initialState.teacherNotices;

/**
 * Staff directory as a working copy too: Central Admin onboarding (D-55) creates and
 * removes real rows, and /central/ must see the same list the four consoles read
 * through GET_COGNITO_ADMINS.
 */
const staffDirectory: AdminAccount[] = initialState.staffDirectory;
const adminPasswords: Record<string, string> = initialState.adminPasswords;

let submissionCounter = initialState.submissionCounter;

/**
 * The notification centre, the calendar and the notice board are working copies
 * for the same reason the authoring fixtures are (D-54): a review decision, a
 * published notice or an added event has to survive the handoff between two
 * roles in one session, so they persist with the rest of the session state.
 */
const notifications: PortalNotification[] = initialState.notifications;
const calendarEvents: CalendarEvent[] = initialState.calendarEvents;
const noticeBoard: NoticeBoardItem[] = initialState.notices;

/**
 * The archdiocesan school registry (D23 runtime extension). Seeded from the ten
 * hardcoded schools and extended at runtime by ADD_SCHOOL, so a super
 * administrator's new school survives the rest of the session exactly like a
 * published notice or an added event does.
 */
const schools: SchoolRecord[] = initialState.schools;

let notificationCounter = notifications.length;

/** Raise a notification. Used by the review decisions as well as the fixtures. */
const raiseNotification = (input: Omit<PortalNotification, 'NotificationID' | 'CreatedAt' | 'Read'>): PortalNotification => {
  notificationCounter += 1;
  const record: PortalNotification = {
    ...input,
    NotificationID: 'NTF-' + String(notificationCounter).padStart(4, '0'),
    CreatedAt: new Date().toISOString(),
    Read: false,

  };
  notifications.unshift(record);
  return record;
};

/**
 * Bridges the teacher-portal handlers (D-72) into the portal's own
 * notification model.
 *
 * The teacher modules were written against a flat `{Title, Body, Audience,
 * RefType, RefID}` shape because that is what `mockTeacher.ts` needs and it must
 * not import this module (which imports it). The translation happens here, in
 * the one place that already owns `PortalNotification`, so a submit/approve/
 * launch in any teacher module raises a real notification the notification
 * centre and the AppShell bell both render — rather than a parallel list that
 * nothing reads.
 *
 * `Audience` is an LAEC `NoticeAudience`: `TEACHER`, `STAFF`, `ICT` etc. A
 * teacher-module notice is addressed to the TEACHER role, or to one `Username`
 * when the module named a specific reviewer or superior.
 *
 * `Kind` carries the module in the deployed app's own vocabulary so the teacher
 * portal's nine filter tabs can discriminate between a disciplinary case and a
 * counselling report. `Category` is left alone: stretching one of LAEC's six
 * coarse categories to do that job would show the same rows under two tabs and
 * would change what `Category` means everywhere else in the portal.
 */
const TEACHER_NOTIFICATION_KIND: Record<string, string> = {
  LESSON_PLAN: 'LESSON',
  WEEKLY_REPORT: 'WEEKLY_REPORT',
  CLASS_TEACHER_REPORT: 'CLASS_REPORT',
  LEAVE: 'LEAVE',
  COUNSELLING_REPORT: 'COUNSELLING',
  DISCIPLINARY_CASE: 'DISCIPLINE',
};

const attachAdminHandlers = (): void => {
  // Same arrangement as the teacher handlers below, one file over: the admin
  // portal's 33 actions live in `mockAdmin.ts` so this file does not grow by
  // three thousand lines, and so the two St Finbarr's ports stay separable.
  Object.assign(handlers, adminHandlers() as unknown as Handlers);
};

/**
 * Lets the permission gate resolve a generic admin write to the permission its
 * module declares. The registry is keyed by module id and indexed by resource
 * here, because `ADMIN_MODULES` names both and the two are not the same set:
 * one module can own several resources (`stock` and `clinic-stock`, `queue` and
 * `orders`), and several modules share one (`arms` serves the arms tab while
 * `classes` lists the classes).
 *
 * First match wins, and the map is built once at load, so a module cannot be
 * shadowed by a later one with the same resource — the order in
 * `ADMIN_MODULES` is the declaration order and is the tie-break.
 */
const ADMIN_RESOURCE_PERMISSIONS = new Map<
  string,
  { permission: string; writePermission?: string; deletePermission?: string }
>();
for (const module of Object.values(ADMIN_MODULES)) {
  const existing = ADMIN_RESOURCE_PERMISSIONS.get(module.resource);
  if (existing) continue;
  ADMIN_RESOURCE_PERMISSIONS.set(module.resource, {
    permission: module.permission,
    writePermission: module.writePermission,
    deletePermission: module.deletePermission,
  });
}

registerAdminModuleLookup((resource) => ADMIN_RESOURCE_PERMISSIONS.get(resource));

const attachTeacherHandlers = (): void => {
  const extra = teacherHandlers((entry) => {
    raiseNotification({
      // `ANNOUNCEMENT` is the closest fit: a submitted plan, a leave decision
      // and a launched case are all news about the portal's own work rather
      // than an exam, a result or a security event.
      Category: 'ANNOUNCEMENT',
      Kind: TEACHER_NOTIFICATION_KIND[entry.RefType] ?? 'SYSTEM',
      Title: entry.Title,
      Body: entry.Body,
      Link: entry.RefID ? `/teacher/?panel=${entry.RefType.toLowerCase()}` : undefined,
      Username: entry.Audience && entry.Audience !== 'TEACHER' ? entry.Audience : undefined,
      Role: entry.Audience === 'TEACHER' ? 'TEACHER' : undefined,
    });
  });
  // Cast through `unknown`: `TeacherHandlers` types its responses loosely (see
  // the note there) while `handlers` is keyed to each action's declared
  // response. `callApi` asserts at the boundary.
  Object.assign(handlers, extra as unknown as Handlers);
};

const statusCounts = (list: QuestionSubmissionRecord[]): Record<QuestionStatus, number> => {
  const counts: Record<QuestionStatus, number> = { DRAFT: 0, PENDING_REVIEW: 0, LIVE: 0, REJECTED: 0 };
  for (const item of list) counts[item.Status] = (counts[item.Status] || 0) + 1;
  return counts;
};

/**
 * Questions a LIVE submission publishes into the exam hall (D-53). A submission
 * is visible to a school when its own SchoolID matches or when it was authored
 * centrally (GLOBAL), which is the same joint/internal split the live schedule
 * already uses.
 */
const liveSubmissionQuestions = (req: {
  schoolID?: string;
  subject?: string;
  class?: string;
  term?: string;
  type?: string;
}): Question[] => {
  const subject = String(req.subject || '').toUpperCase();
  const studentClass = String(req.class || '').toUpperCase();
  const term = String(req.term || '').toUpperCase();
  const category = String(req.type || '').toUpperCase();
  return submissions
    .filter((item) => item.Status === 'LIVE')
    .filter((item) => !req.schoolID || item.SchoolID === req.schoolID || item.SchoolID === 'GLOBAL')
    .filter((item) => !subject || item.Subject === subject)
    .filter((item) => !studentClass || item.Class === studentClass)
    .filter((item) => !term || item.Term === term)
    .filter((item) => !category || item.Category === category)
    .flatMap((item) => item.Questions);
};

const MOCK_LIVE_PAPERS: Paper[] = [
  { Subject: 'MATHEMATICS', Class: 'SSS1', ...LIVE_WINDOW, DurationMinutes: MOCK_CONFIG.examDuration },
  { Subject: 'ENGLISH_LANGUAGE', Class: 'SSS1', ...LIVE_WINDOW, DurationMinutes: MOCK_CONFIG.examDuration },
  { Subject: 'PHYSICS', Class: 'SSS1', ...LIVE_WINDOW, DurationMinutes: MOCK_CONFIG.examDuration },
  { Subject: 'CHEMISTRY', Class: 'SSS1', ...LIVE_WINDOW, DurationMinutes: MOCK_CONFIG.examDuration },
  { Subject: 'BIOLOGY', Class: 'SSS1', ...LIVE_WINDOW, DurationMinutes: MOCK_CONFIG.examDuration },
  { Subject: 'MATHEMATICS', Class: 'SSS2', ...LIVE_WINDOW, DurationMinutes: MOCK_CONFIG.examDuration },
  { Subject: 'ENGLISH_LANGUAGE', Class: 'SSS2', ...LIVE_WINDOW, DurationMinutes: MOCK_CONFIG.examDuration },
  { Subject: 'LITERATURE_IN_ENGLISH', Class: 'SSS2', ...LIVE_WINDOW, DurationMinutes: MOCK_CONFIG.examDuration },
  { Subject: 'COMMERCE', Class: 'SSS2', ...LIVE_WINDOW, DurationMinutes: MOCK_CONFIG.examDuration },
  /* No JSS3 paper: ECHO / FOXTROT fall through to the no-live panel. */
];

/** Subjects the mock can serve question sets for (the rest raise Diagnostic Report). */
const KNOWN_SUBJECTS = new Set<string>([
  ...MOCK_LIVE_PAPERS.map((p) => p.Subject ?? ''),
  ...MOCK_STUDENTS.flatMap((s) => s.Subjects),
]);

type Handler<A extends ActionName> = (
  req: ApiMap[A]['req'],
) => ApiMap[A]['res'] | Promise<ApiMap[A]['res']>;

/**
 * Partial because the 49 teacher-portal actions (D-72) are merged in at runtime
 * by `attachTeacherHandlers` from `mockTeacher.ts` rather than written inline.
 * The compiler no longer proves that every action has a handler, so
 * `callApi` reports a missing one as a `status: 'error'` envelope instead of
 * throwing — an unmapped action fails visibly rather than crashing the console.
 */
type Handlers = {
  [A in ActionName]?: Handler<A>;
};

const handlers: Handlers = {
  /* ── GET ─────────────────────────────────────────────────────────────── */

  GET_PORTAL_STATE: (_req) => {
    const override = readPortalStateOverride();
    /*
     * `isPromotionActive` and `config.promotionActive` are two keys for the
     * same window, and `/login/` accepts either, so an override has to move both
     * together or the page still routes to the picker.
     */
    const config =
      override && (override.portalActive !== undefined || override.isPromotionActive !== undefined)
        ? {
            ...MOCK_CONFIG,
            portalActive: override.portalActive ?? MOCK_CONFIG.portalActive,
            promotionActive: override.isPromotionActive ?? MOCK_CONFIG.promotionActive,
          }
        : MOCK_CONFIG;
    return {
      ...ok('Portal state retrieved (mock).'),
      config,
      isPromotionActive: config.promotionActive,
      isOffline: override ? override.isOffline === true : false,
      localMode: 'NOT_SET',
      globalMode: MOCK_CONFIG.mode,
    };
  },
  GET_STUDENT_PROFILE: (req) => {
    const student = MOCK_STUDENTS.find((s) => s.RegNo === req.regID && s.SchoolID === req.schoolID);
    return student
      ? { ...ok('Profile retrieved (mock).'), student }
      : { status: 'error', message: 'Student profile not found (mock).' };
  },
  GET_LIVE_SCHEDULE: (_req) => {
    /*
     * The shipped papers carry a window that is live against any real clock, so
     * the hallway's per-paper timestamp comparison is only observable with a
     * stale or future window. `liveWindow` in the dev override replaces both
     * ends of every paper (RF-19).
     */
    const liveWindow = readPortalStateOverride()?.liveWindow;
    return {
      ...ok('Live schedule retrieved (mock).'),
      activePapers: liveWindow
        ? MOCK_LIVE_PAPERS.map((paper) => ({
            ...paper,
            StartTime: liveWindow.StartTime,
            EndTime: liveWindow.EndTime,
          }))
        : MOCK_LIVE_PAPERS,
    };
  },
  GET_RESULTS: (req) => ({
    ...ok('Results retrieved (mock).'),
    results: MOCK_RESULTS.filter((r) => (req.regNo ? r.pk.includes(req.regNo) : true)),
  }),
  GET_SECURE_QUESTIONS: (req) => {
    const subject = String(req.subject ?? '');
    /*
     * An accepted submission's questions are prepended (D-53): the review
     * decision is what publishes them, so they are the first rows a candidate
     * in that coordinate sees. The base fixture follows unchanged, which keeps
     * every count the origin evidence cites.
     */
    const published = liveSubmissionQuestions(req);
    if (KNOWN_SUBJECTS.has(subject) || published.length > 0) {
      return {
        ...ok('Questions retrieved (mock).'),
        /* Stored rows carry their partition keys (config.js
           normalizeQuestionRows drops rows without Subject/Class). Stamp the
           requested coordinates, as the server's records would carry them. */
        questions: [
          ...published.map((q) => ({
            ...q,
            Subject: subject,
            Class: String(req.class ?? ''),
            PublishedByReview: true,
          })),
          ...MOCK_QUESTIONS.map((q) => ({
            ...q,
            Subject: subject,
            Class: String(req.class ?? ''),
          })),
        ],
      };
    }
    /* Unknown paper: no message, so /login/ builds the Diagnostic Report
       from config.js's own candidate attempts (observed behaviour). */
    return {
      status: 'success',
      questions: [],
      completed: false,
      debug: {
        searchedPK: `MOCK#QUESTIONS#${req.schoolID}#${req.class ?? ''}`,
      },
    };
  },
  GET_QUESTION_INVENTORY: (_req) => ({
    ...ok('Inventory retrieved (mock).'),
    /* Read by the first-party /exam-session-controls.js paper queue, which
       passes each row through and reads Subject / Class / questionCount. */
    inventory: MOCK_INVENTORY,
  }),
  GET_STUDENTS: (req) => ({
    ...ok('Students retrieved (mock).'),
    /* One mock college. The roster is served for the session's own school code
       whatever it is (the consoles fall back to "SFC" when storage is empty and
       the mock login stores "001"), and for the global/joint scope, so no
       console renders an empty directory just because of the code it inherited
       (D-43). */
    students:
      req.schoolID === 'ALL' || req.schoolID === 'GLOBAL' || MOCK_SCHOOL_CODES.has(req.schoolID)
        ? MOCK_STUDENTS
        : [],
  }),
  GET_CONFIG: () => ({
    ...ok('Configuration retrieved (mock).'),
    // /admin/ `loadGlobalStats` reads these flat off the envelope, not from a
    // nested config object (origin-pages/admin.html lines 2137–2184).
    mode: MOCK_CONFIG.mode,
    portalActive: MOCK_CONFIG.portalActive,
    academicYear: MOCK_CONFIG.academicYear,
    currentTerm: MOCK_CONFIG.currentTerm,
    activeExamType: MOCK_CONFIG.activeExamType,
    examDuration: MOCK_CONFIG.examDuration,
    promotionActive: MOCK_CONFIG.promotionActive,
    config: MOCK_CONFIG,
  }),
  /* ── notification centre, calendar, notices (D-64) ───────────────── */

  /**
   * A notification reaches an operator three ways: addressed to their username,
   * addressed to their role, or addressed to nobody in particular. The read
   * returns all three, pinned first, then newest, which is the order the
   * reference application shows them in.
   */
  GET_NOTIFICATIONS: (req) => {
    const username = req.username || '';
    const role = String(req.role || '').toUpperCase();
    const mine = notifications.filter((n) => {
      if (n.Username) return n.Username === username;
      if (n.Role) return n.Role === role;
      return true;
    });
    const narrowed = req.category
      ? mine.filter((n) => n.Category === String(req.category).toUpperCase())
      : mine;
    const sorted = [...narrowed].sort((a, b) => {
      if (a.Pinned !== b.Pinned) return a.Pinned ? -1 : 1;
      return b.CreatedAt.localeCompare(a.CreatedAt);
    });
    const counts: Record<string, number> = {};
    for (const n of mine) counts[n.Category] = (counts[n.Category] || 0) + 1;
    return {
      ...ok('Notifications retrieved (mock).'),
      notifications: sorted,
      unread: mine.filter((n) => !n.Read).length,
      counts: counts,
    };
  },
  GET_ACADEMIC_CALENDAR: (req) => {
    const year = req.year || '';
    /* A GLOBAL caller is a cross-school role and reads every school's calendar,
       the same rule the review queue uses (D-55). */
    const scope = String(req.schoolID || '').toUpperCase();
    const crossSchool = scope === 'GLOBAL' || scope === 'ALL';
    const events = calendarEvents.filter((e) => {
      if (year && e.Session && !e.Session.startsWith(year)) return false;
      if (crossSchool || !req.schoolID) return true;
      return e.SchoolID === req.schoolID || e.SchoolID === 'GLOBAL';
    });
    const sessions = [...new Set(calendarEvents.map((e) => e.Session || ''))].filter(Boolean).sort();
    return { ...ok('Calendar retrieved (mock).'), events: events, sessions: sessions };
  },
  /** A notice is readable by its audience, and by the portal at large. */
  GET_NOTICES: (req) => {
    const role = String(req.role || '').toUpperCase();
    const mine = noticeBoard.filter((n) => {
      if (n.Audience === 'ALL') return true;
      if (n.Audience === role) return true;
      /* the two publishing roles can always read the board back */
      return role === 'SUPER_ADMIN' || role === 'CENTRAL_ADMIN';
    });
    const sorted = [...mine].sort((a, b) => {
      if (a.Pinned !== b.Pinned) return a.Pinned ? -1 : 1;
      return b.PublishedAt.localeCompare(a.PublishedAt);
    });
    return { ...ok('Notices retrieved (mock).'), notices: sorted };
  },

  /**
   * The operator's role and the permissions it implies (D-71).
   *
   * The counterpart of the reference implementation's `GET /auth/me`. The role
   * is resolved from the admin roster rather than from the request, so a claim
   * edited in storage is corrected the next time the session syncs — which is
   * the property that makes the rail and the transport agree. The request's
   * role is only consulted for an account the roster does not know.
   */
  GET_MY_PERMISSIONS: (req) => {
    const username = req.username || '';
    const record = staffDirectory.find((a) => a.Username === username);
    const role = (record?.Role ?? (req.role || 'TEACHER')) as AdminRole;
    /* The claim AND the held school roles, so the payload the session store
       hydrates from agrees with the transport gate that read the same two
       things. Returning only the claim's half here is what would leave the rail
       offering a school role's pages while every call behind them was refused. */
    const schoolRoles = readSchoolRoles();
    return {
      ...ok('Permissions retrieved (mock).'),
      username: username,
      name: record?.FullName || '',
      schoolID: record?.SchoolID || '',
      role: role,
      schoolRoles,
      permissions: effectivePermissions([], role, schoolRoles),
    };
  },

  /** A teacher's own papers, whatever state they are in (D-54). */
  GET_MY_SUBMISSIONS: (req) => {
    const mine = submissions.filter(
      (item) => item.SubmittedBy === req.teacherUsername && item.SchoolID === req.schoolID,
    );
    return {
      ...ok('Submissions retrieved (mock).'),
      submissions: mine,
      counts: statusCounts(mine),
    };
  },
  /** The review team's queue: PENDING_REVIEW unless a state is named. */
  GET_REVIEW_QUEUE: (req) => {
    /*
     * A Central Admin holds scope GLOBAL and sits above the school consoles
     * (D-55), so GLOBAL is a request for every school's queue rather than only
     * the papers authored centrally. A school-scoped caller still sees its own
     * papers plus any authored centrally for it.
     */
    const isCentral = String(req.schoolID || '').toUpperCase() === 'GLOBAL' || String(req.schoolID || '').toUpperCase() === 'ALL';
    const scoped = submissions.filter(
      (item) => isCentral || item.SchoolID === req.schoolID || item.SchoolID === 'GLOBAL',
    );
    const wanted = (req.status ? String(req.status).toUpperCase() : 'PENDING_REVIEW') as QuestionStatus;
    return {
      ...ok('Review queue retrieved (mock).'),
      submissions: scoped.filter((item) => item.Status === wanted),
      counts: statusCounts(scoped),
    };
  },
  GET_TEACHER_NOTICES: (req) => {
    const mine = teacherNotices.filter(
      (item) => item.TeacherUsername === req.teacherUsername && item.SchoolID === req.schoolID,
    );
    return {
      ...ok('Notices retrieved (mock).'),
      notices: mine,
      unread: mine.filter((item) => !item.Read).length,
    };
  },

  GET_COGNITO_ADMINS: (req) => {
    const wanted = String(req.roles || '')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);
    /* A GLOBAL caller is the Central Admin and reads every school (D-55); a
       school console keeps its own-directory read. */
    const school = String(req.schoolID || '').toUpperCase();
    const isCentral = school === 'GLOBAL' || school === 'ALL';
    const scoped = !req.schoolID || isCentral ? staffDirectory : staffDirectory.filter((a) => a.SchoolID === req.schoolID);
    return {
      ...ok('Administrator directory retrieved (mock).'),
      admins: wanted.length ? scoped.filter((a) => wanted.includes(a.Role)) : scoped,
    };
  },
  /**
   * The archdiocesan school registry (D23 runtime extension). Returns the ten
   * seeded schools plus anything a super administrator has added this session,
   * in registry order. Every console's school dropdown can read this list
   * instead of a hardcoded constant.
   */
  GET_SCHOOLS: () => ({
    ...ok('School registry retrieved (mock).'),
    schools: schools.map((s) => ({ ...s })),
  }),
  GET_EXAM_CONFIG: () => ({
    ...ok('Exam configuration retrieved (mock).'),
    config: MOCK_CONFIG,
    effectiveMode: MOCK_CONFIG.currentMode ?? MOCK_CONFIG.mode,
  }),
  GET_DEMOTION_LOGS: () => ({
    ...ok('Demotion logs retrieved (mock).'),
    logs: MOCK_DEMOTION_LOGS,
    counts: MOCK_DEMOTION_COUNTS,
  }),

  /* ── POST ────────────────────────────────────────────────────────────── */

  SUBMIT_EXAM_RESULT: () => ok('Result submitted (mock).'),
  END_STUDENT_SESSION: () => ok('Session ended (mock).'),
  UPDATE_STUDENT_SUBJECTS: () => ok('Subjects updated (mock).'),
  UPDATE_MODE: (req) => ok(`Mode set to ${req.mode} (mock).`),
  UPDATE_PORTAL: () => ok('Portal state updated (mock).'),
  UPDATE_EXAM_SETTINGS: () => ok('Exam settings updated (mock).'),
  UPDATE_SESSION_CONFIG: () => ok('Session configuration updated (mock).'),
  EXECUTE_PROMOTION: () => ok('Promotion executed (mock).'),
  TRIGGER_ARCHIVE: () => ok('Archive triggered (mock).'),
  /**
   * Central Admin onboarding across schools (D-55). The origin only ever created
   * same-school accounts from a school's own console; this widens the target school and
   * admits the TEACHER role, which is what the addendum asks for.
   */
  CREATE_ADMIN_ACCESS: (req) => {
    if (staffDirectory.some((a) => a.Username === req.username)) {
      return { status: 'error', message: `${req.username} already exists.` };
    }
    const account: AdminAccount = {
      Username: req.username,
      Email: req.email,
      FullName: req.fullName,
      Role: req.targetRole,
      SchoolID: req.schoolID,
      Timestamp: new Date().toISOString(),
      Status: 'ACTIVE',
      CreatedByUsername: req.creatorUsername,
    };
    staffDirectory.push(account);
    adminPasswords[req.username] = req.password;
    saveState();
    return {
      ...ok(`Administrator ${req.username} created (mock).`),
      message: `${req.username} onboarded to ${req.schoolID} as ${req.targetRole}. Temporary login details emailed.`,
    };
  },
  DELETE_ADMIN_ACCESS: (req) => {
    const index = staffDirectory.findIndex((a) => a.Username === req.username);
    if (index < 0) return { status: 'error', message: `${req.username} not found.` };
    const [removed] = staffDirectory.splice(index, 1);
    delete adminPasswords[req.username];
    saveState();
    return { ...ok(`Administrator ${req.username} deleted (mock).`), message: `${removed.FullName} removed from ${removed.SchoolID}.` };
  },
  UPDATE_ADMIN_STATUS: (req) => ok(`Status set to ${req.newStatus} (mock).`),
  REQUEST_ADMIN_PASSWORD_RESET: () => ok('Password reset requested (mock).'),
  CONFIRM_ADMIN_PASSWORD_RESET: () => ok('Password reset confirmed (mock).'),
  /**
   * Register a new archdiocesan school (D23 runtime extension). The origin's
   * ten schools are hardcoded with no way to add one; this is that way. The
   * code is normalised to uppercase and must be unique and non-reserved, so a
   * new school cannot shadow an existing SchoolID or the GLOBAL scope every
   * console's cross-school reads depend on.
   */
  ADD_SCHOOL: (req) => {
    const code = String(req.code || '').trim().toUpperCase();
    const name = String(req.name || '').trim();
    if (!code || !name) {
      return { status: 'error', message: 'Both a school code and a school name are required.' };
    }
    /* SFC-style codes: letters and digits only, so the code stays a clean
       SchoolID in registration numbers, export filenames and S3 keys. */
    if (!/^[A-Z0-9]{2,10}$/.test(code)) {
      return {
        status: 'error',
        message: 'School code must be 2–10 letters or numbers, with no spaces or punctuation.',
      };
    }
    /* GLOBAL is the archdiocese's own scope and ALL is the cross-school
       wildcard; either as a code would make every scoped read ambiguous. */
    if (code === 'GLOBAL' || code === 'ALL') {
      return { status: 'error', message: `"${code}" is a reserved scope and cannot be a school code.` };
    }
    if (schools.some((s) => s.Code === code)) {
      return { status: 'error', message: `School code ${code} already exists.` };
    }
    const record: SchoolRecord = {
      Code: code,
      Name: name,
      ...(String(req.address || '').trim() ? { Address: String(req.address).trim() } : {}),
      builtin: false,
    };
    schools.push(record);
    saveState();
    return {
      ...ok(`School ${code} registered (mock).`),
      message: `${name} (${code}) added to the archdiocesan registry. It is now selectable across every console.`,
      school: { ...record },
    };
  },
  SEND_ADMIN_PASSWORD_CHANGED_EMAIL: () => ok('Password change email dispatched (mock).'),
  BULK_UPLOAD_QUESTIONS: (req) => ({
    ...ok(`${req.questions.length} questions uploaded (mock).`),
    count: req.questions.length,
  }),
  UPLOAD_QUESTION_IMAGE: (req) => ({
    ...ok(`Image ${req.fileName} uploaded (mock).`),
    /* The hosting card shows the returned link; no real S3 object is created. */
    imageUrl: `https://laec-assets.example.test/questions/${req.fileName}`,
  }),
  ADD_QUESTION: () => ok('Question added (mock).'),
  UPDATE_QUESTION: () => ok('Question updated (mock).'),
  DELETE_QUESTION: () => ok('Question deleted (mock).'),
  DELETE_QUESTION_PAPER: () => ok('Question paper deleted (mock).'),
  REMARK_STUDENT_RESULTS: (req) => ok(`${req.records.length} results remarked (mock).`),
  DELETE_SUBJECT_RESULTS: (req) => ok(`${req.records.length} results deleted (mock).`),
  DELETE_STUDENT_RESULT: () => ok('Student result deleted (mock).'),
  DELETE_STUDENT: (req) => ok(`Student ${req.regNo} deleted (mock).`),
  DELETE_FLAGGED_RESULTS: (req) => ok(`${req.records.length} flagged results deleted (mock).`),
  /* ── notification centre, calendar, notices (D-64) ───────────────── */

  MARK_NOTIFICATION_READ: (req) => {
    const ids = new Set(req.notificationIds || []);
    let updated = 0;
    for (const n of notifications) {
      if (ids.has(n.NotificationID) && !n.Read) {
        n.Read = true;
        updated += 1;
      }
    }
    saveState();
    return { ...ok('Marked as read (mock).'), updated: updated };
  },
  MARK_ALL_NOTIFICATIONS_READ: (req) => {
    const username = req.username || '';
    const role = String(req.role || '').toUpperCase();
    let updated = 0;
    for (const n of notifications) {
      if (n.Read) continue;
      if (n.Username && n.Username !== username) continue;
      if (n.Role && n.Role !== role) continue;
      n.Read = true;
      updated += 1;
    }
    saveState();
    return { ...ok('All notifications marked as read (mock).'), updated: updated };
  },
  UPSERT_ACADEMIC_EVENT: (req) => {
    if (!req.title || !req.start || !req.end) {
      return { status: 'error', message: 'An event needs a title and a start and end.' };
    }
    const existing = req.eventId ? calendarEvents.find((e) => e.EventID === req.eventId) : undefined;
    if (existing) {
      existing.Kind = req.kind;
      existing.Title = req.title;
      existing.Description = req.description;
      existing.Start = req.start;
      existing.End = req.end;
      existing.AllDay = req.allDay;
      existing.Session = req.session;
      saveState();
      return { ...ok('Event updated (mock).'), event: existing };
    }
    const event: CalendarEvent = {
      EventID: 'EVT-' + String(calendarEvents.length + 1).padStart(4, '0'),
      Kind: req.kind,
      Title: req.title,
      Description: req.description,
      Start: req.start,
      End: req.end,
      AllDay: req.allDay,
      Session: req.session,
      SchoolID: req.schoolID,
    };
    calendarEvents.push(event);
    saveState();
    return { ...ok('Event added (mock).'), event: event };
  },
  DELETE_ACADEMIC_EVENT: (req) => {
    const index = calendarEvents.findIndex((e) => e.EventID === req.eventId);
    if (index < 0) return { status: 'error', message: 'Event not found.' };
    calendarEvents.splice(index, 1);
    saveState();
    return ok('Event deleted (mock).');
  },
  PUBLISH_NOTICE: (req) => {
    const title = String(req.title || '').trim();
    const body = String(req.body || '').trim();
    if (!title || !body) {
      return { status: 'error', message: 'A notice needs both a title and a body.' };
    }
    const notice: NoticeBoardItem = {
      NoticeID: 'NTC-' + String(noticeBoard.length + 1).padStart(4, '0'),
      Title: title,
      Body: body,
      Audience: req.audience,
      AuthorUsername: req.authorUsername,
      AuthorName: req.authorName || req.authorUsername,
      PublishedAt: new Date().toISOString(),
      Pinned: Boolean(req.pinned),
      SchoolID: req.schoolID,
    };
    noticeBoard.unshift(notice);
    /* Publishing is itself news, so it raises a notification for the audience. */
    raiseNotification({
      Category: 'ANNOUNCEMENT',
      Title: title,
      Body: body.slice(0, 160),
      Link: '/notices/',
      Role: req.audience === 'ALL' ? 'SUPER_ADMIN' : (req.audience as PortalNotification['Role']),
    });
    saveState();
    return { ...ok('Notice published (mock).'), notice: notice };
  },
  DELETE_NOTICE: (req) => {
    const index = noticeBoard.findIndex((n) => n.NoticeID === req.noticeId);
    if (index < 0) return { status: 'error', message: 'Notice not found.' };
    const [removed] = noticeBoard.splice(index, 1);
    saveState();
    return ok('"' + removed.Title + '" withdrawn (mock).');
  },

  /* ── question authoring lifecycle (D-54) ─────────────────────────── */

  /** Create or overwrite a teacher's own draft. Never publishes. */
  SAVE_QUESTION_SUBMISSION: (req) => {
    const teacher = MOCK_ADMINS.find((a) => a.Username === req.teacherUsername);
    const questions = (req.questions || []) as Question[];
    if (questions.length === 0) {
      return { status: 'error', message: 'Add at least one question before saving.' };
    }
    if (!req.subject || !req.class) {
      return { status: 'error', message: 'A submission needs a subject and a class.' };
    }
    const now = new Date().toISOString();
    const existing = req.submissionId
      ? submissions.find((item) => item.SubmissionID === req.submissionId)
      : undefined;

    if (existing) {
      if (existing.Status !== 'DRAFT') {
        return {
          status: 'error',
          message: `Only drafts can be edited. ${existing.SubmissionID} is ${existing.Status}.`,
        };
      }
      if (existing.SubmittedBy !== req.teacherUsername) {
        return { status: 'error', message: 'A submission can only be edited by the teacher who authored it.' };
      }
      existing.Subject = String(req.subject).toUpperCase();
      existing.Class = String(req.class).toUpperCase();
      existing.Term = req.term;
      existing.Category = req.category;
      existing.Questions = questions;
      existing.QuestionCount = questions.length;
      existing.UpdatedAt = now;
      return {
        ...ok('Draft saved (mock).'),
        submission: existing,
        message: `Draft ${existing.SubmissionID} saved.`,
      };
    }

    submissionCounter += 1;
    const submission: QuestionSubmissionRecord = {
      SubmissionID: `SUB-${String(submissionCounter).padStart(4, '0')}`,
      SchoolID: req.schoolID,
      Subject: String(req.subject).toUpperCase(),
      Class: String(req.class).toUpperCase(),
      Term: req.term,
      Category: req.category,
      Status: 'DRAFT',
      SubmittedBy: req.teacherUsername,
      SubmittedByName: req.teacherName || teacher?.FullName || req.teacherUsername,
      SubmittedAt: '',
      UpdatedAt: now,
      QuestionCount: questions.length,
      Questions: questions,
    };
    submissions.push(submission);
    saveState();
    return {
      ...ok('Draft saved (mock).'),
      submission,
      message: `Draft ${submission.SubmissionID} saved with ${questions.length} question(s).`,
    };
  },

  /** DRAFT -> PENDING_REVIEW. Nothing is published by this call. */
  SUBMIT_QUESTION_FOR_REVIEW: (req) => {
    const submission = submissions.find((item) => item.SubmissionID === req.submissionId);
    if (!submission) return { status: 'error', message: 'Submission not found.' };
    if (submission.SubmittedBy !== req.teacherUsername) {
      return { status: 'error', message: 'Only the author can submit this paper for review.' };
    }
    if (submission.Status !== 'DRAFT') {
      return { status: 'error', message: `${submission.SubmissionID} is already ${submission.Status}.` };
    }
    if (submission.QuestionCount === 0) {
      return { status: 'error', message: 'An empty paper cannot go to review.' };
    }
    const now = new Date().toISOString();
    submission.Status = 'PENDING_REVIEW';
    submission.SubmittedAt = now;
    submission.UpdatedAt = now;
    saveState();
    return {
      ...ok('Submitted for review (mock).'),
      submission,
      message: `${submission.SubmissionID} sent to the review team. It stays unpublished until accepted.`,
    };
  },

  /** PENDING_REVIEW -> LIVE. This is the only call that publishes questions. */
  ACCEPT_QUESTION_SUBMISSION: (req) => {
    const ids = req.submissionIds || [];
    const now = new Date().toISOString();
    let accepted = 0;
    for (const id of ids) {
      const submission = submissions.find((item) => item.SubmissionID === id);
      if (!submission || submission.Status !== 'PENDING_REVIEW') continue;
      submission.Status = 'LIVE';
      submission.ReviewedBy = req.reviewerUsername;
      submission.ReviewedAt = now;
      submission.ReviewNote = req.note || '';
      submission.UpdatedAt = now;
      accepted += 1;
      /* the decision is also news in the notification centre (D-64) */
      raiseNotification({
        Category: 'REVIEW',
        Title: submission.SubmissionID + ' was accepted',
        Body: submission.Subject.replace(/_/g, ' ') + ' ' + submission.Class + ' is now live for candidates.',
        Link: '/teacher/',
        Username: submission.SubmittedBy,
      });
      teacherNotices.unshift({
        NoticeID: `NOT-${String(teacherNotices.length + 1).padStart(4, '0')}`,
        SchoolID: submission.SchoolID,
        TeacherUsername: submission.SubmittedBy,
        SubmissionID: submission.SubmissionID,
        Subject: submission.Subject,
        Class: submission.Class,
        Decision: 'ACCEPTED',
        Note: req.note || 'Accepted. Your questions are now live.',
        CreatedAt: now,
        Read: false,
      });
    }
    saveState();
    if (accepted === 0) {
      return { status: 'error', message: 'None of those submissions were awaiting review.' };
    }
    return {
      ...ok('Accepted (mock).'),
      accepted,
      message: `${accepted} submission(s) accepted and published. The author(s) have been notified.`,
    };
  },

  /** PENDING_REVIEW -> REJECTED. The questions stay unpublished. */
  REJECT_QUESTION_SUBMISSION: (req) => {
    const ids = req.submissionIds || [];
    const note = String(req.note || '').trim();
    if (!note) return { status: 'error', message: 'A rejection needs a reason for the teacher.' };
    const now = new Date().toISOString();
    let rejected = 0;
    for (const id of ids) {
      const submission = submissions.find((item) => item.SubmissionID === id);
      if (!submission || submission.Status !== 'PENDING_REVIEW') continue;
      submission.Status = 'REJECTED';
      submission.ReviewedBy = req.reviewerUsername;
      submission.ReviewedAt = now;
      submission.ReviewNote = note;
      submission.UpdatedAt = now;
      rejected += 1;
      raiseNotification({
        Category: 'REVIEW',
        Title: submission.SubmissionID + ' was rejected',
        Body: note,
        Link: '/teacher/',
        Username: submission.SubmittedBy,
      });
      teacherNotices.unshift({
        NoticeID: `NOT-${String(teacherNotices.length + 1).padStart(4, '0')}`,
        SchoolID: submission.SchoolID,
        TeacherUsername: submission.SubmittedBy,
        SubmissionID: submission.SubmissionID,
        Subject: submission.Subject,
        Class: submission.Class,
        Decision: 'REJECTED',
        Note: note,
        CreatedAt: now,
        Read: false,
      });
    }
    saveState();
    if (rejected === 0) {
      return { status: 'error', message: 'None of those submissions were awaiting review.' };
    }
    return {
      ...ok('Rejected (mock).'),
      rejected,
      message: `${rejected} submission(s) rejected. They remain unpublished and the author(s) have been notified.`,
    };
  },

  /** Raised by a decision, the way the origin notifies by action (D-58). */
  SEND_QUESTION_DECISION_EMAIL: (req) => ({
    ...ok('Decision email dispatched (mock).'),
    sentTo: req.teacherEmail,
    decision: req.decision,
  }),

  UPDATE_STUDENT_CLASS_ARM: (req) => ok(`Class and arm updated to ${req.studentClass} ${req.studentArm} (mock).`),
};

/**
 * The St Finbarr's teacher-portal handlers (D-72) are folded in after the
 * literal map is built, because they live in `mockTeacher.ts` and that file
 * must not import this one. `Object.assign` over a `Partial` map is deliberate:
 * every action is still declared in `ApiMap` and listed in `GET_ACTIONS` /
 * `POST_ACTIONS`, and `callApi`'s permission gate reads those lists, so an
 * unmapped write still fails closed.
 */
attachAdminHandlers();
attachTeacherHandlers();

/**
 * Dev-test capture: every call invoked through `callApi`, exposed on
 * `window.__LAEC_MOCK__` (D-27) so browser verification can assert request
 * payloads — e.g. SUBMIT_EXAM_RESULT grading (`score/total/percentage`) and
 * RF-98 retry counts. Bounded; cleared via clearMockCalls.
 */
/** The school codes a session can carry; each maps to the same mock college. */
const MOCK_SCHOOL_CODES = new Set<string>([MOCK_SCHOOL_ID, ...SCHOOL_ORDER]);

const callLog: Array<{ action: ActionName; request: unknown; at: number }> = [];

export function getMockCalls(): ReadonlyArray<{ action: ActionName; request: unknown; at: number }> {
  return callLog;
}

export function clearMockCalls(): void {
  callLog.length = 0;
}

/**
 * Invoke a mocked action. This is the single entry point pages use; the real
 * transport stays behind the same signature if the backend is ever wired up.
 */
export async function callApi<A extends ActionName>(
  action: A,
  request: ApiRequest<A>,
): Promise<ApiResponse<A>> {
  callLog.push({ action, request: JSON.parse(JSON.stringify(request)) as unknown, at: Date.now() });
  if (callLog.length > 100) callLog.shift();

  await delay(LATENCY_MIN_MS + Math.random() * (LATENCY_MAX_MS - LATENCY_MIN_MS));

  const failure = pendingFailures.get(action);
  if (failure) {
    const remaining = failure.attemptsRemaining ?? 1;
    if (remaining <= 1) pendingFailures.delete(action);
    else failure.attemptsRemaining = remaining - 1;
    if (failure.httpStatus !== undefined) {
      throw new ApiHttpError(failure.message, failure.httpStatus);
    }
    return { status: 'error', message: failure.message } as ApiResponse<A>;
  }

  const handler = handlers[action] as
    | ((req: ApiRequest<A>) => ApiResponse<A> | Promise<ApiResponse<A>>)
    | undefined;

  /*
   * The permission gate (D-71) — the single point every mutating action
   * passes. Gating here rather than only hiding buttons means the six
   * consoles, the two new surfaces, and the four first-party library bridges
   * in src/lib/console.ts are all covered by one rule, the way a backend
   * gates its own endpoints instead of trusting the client.
   *
   * The claim is resolved from the admin roster, not from storage, so an
   * `AdminRole` edited in devtools does not widen access. Reads are not
   * gated here: a read is reachable only through a route and a rail item the
   * same permissions already decide.
   */
  if ((POST_ACTIONS as readonly string[]).includes(action)) {
    /*
     * `resolveAdminPermission`, not `permissionForAction`: three admin-portal
     * actions carry a placeholder rather than a code, because one contract
     * action serves forty registry resources whose permissions differ. The
     * resolver substitutes the right code from the request, and returns `null`
     * for a request it cannot resolve — which the gate below refuses. Reading
     * the static map here instead would see those placeholders as `null`, and
     * `null` means "no permission needed", which would grant them to everyone.
     */
    const required = resolveAdminPermission(action, request);
    const username = localStorage.getItem(STORAGE_KEYS.AdminUsername) || '';
    const record = staffDirectory.find((a) => a.Username === username);
    const role = (record?.Role ??
      (localStorage.getItem(STORAGE_KEYS.AdminRole) || '')) as AdminRole;
    const granted =
      required === undefined
        ? false // an unmapped write has no permission — fail closed
        : required === null
          ? /* Outside the admin model: the two candidate-session actions. An
               unresolvable admin placeholder also lands here and is refused —
               `hasAdminPlaceholder` is what separates the two cases, since
               `null` on its own means "no permission needed". */
            !hasAdminPlaceholder(action)
          : bypassesPermissions(role) ||
            /* Both authorisation axes, and the same two the rail is filtered
               by. Reading only the claim here is what made a school role
               decorative: granting one could change the navigation but not
               whether the transport would perform the action the navigation
               offered, which is the disagreement `SUPER_ADMIN_PERMISSIONS` was
               introduced to eliminate for a different reason. */
            hasPermission(effectivePermissions([], role, readSchoolRoles()), required);

    if (!granted) {
      return {
        status: 'error',
        message:
          required === undefined
            ? `Permission denied: ${action} is not mapped to a permission.`
            : `Permission denied: this session may not perform ${action}.`,
      } as ApiResponse<A>;
    }
  }

  if (!handler) {
    return {
      status: 'error',
      message: `No handler is registered for ${action}.`,
    } as ApiResponse<A>;
  }

  return handler(request);
}

/** Resolved authentication result, shaped like Cognito's onSuccess payload. */
export interface MockAuthSuccess {
  /** Stands in for `result.getIdToken().getJwtToken()` (PRD §4.2 step 5). */
  jwtToken: string;
  /** Stands in for `result.getIdToken().payload`. */
  payload: { 'custom:SchoolID'?: string };
}

/**
 * Cognito-shaped authentication against the mock roster. The real user pool
 * is never contacted (brief: mock API only). Mirrors `authenticateUser`'s
 * onSuccess / onFailure split: resolves for a matching RegNo + password pair,
 * rejects with a Cognito-style `message` otherwise.
 */
export async function mockAuthenticate(regNo: string, password: string): Promise<MockAuthSuccess> {
  await delay(LATENCY_MIN_MS + Math.random() * (LATENCY_MAX_MS - LATENCY_MIN_MS));
  const student = MOCK_STUDENTS.find((s) => s.RegNo.toUpperCase() === regNo.toUpperCase());
  if (!student) throw new Error('User does not exist.');
  if (student.Password !== password) throw new Error('Incorrect username or password.');
  return {
    jwtToken: `mock-id-token.${student.RegNo}`,
    payload: { 'custom:SchoolID': student.SchoolID },
  };
}

/* ── Administrator authentication (PRD §4.4, RF-58…RF-66; D-31) ───────── */

/**
 * Claim names as the page reads them: `processLoginSuccess` takes the role from
 * `custom:Role` / `custom:role` and the school from `custom:SchoolID` /
 * `custom:schoolID` / `custom:schoolId`, and the display name from `name`
 * (origin-pages/control.html lines 513–516).
 */
export interface MockAdminClaims {
  name: string;
  'custom:Role': string;
  'custom:SchoolID': string;
}

/** Stands in for Cognito's `authenticateUser` success result. */
export interface MockAdminAuthSuccess {
  /** Stands in for `result.getAccessToken().getJwtToken()` (RF-64 `LAEC_Session`). */
  accessToken: string;
  /** Stands in for `result.getIdToken().payload`. */
  idPayload: MockAdminClaims;
}

export type MockAdminAuthOutcome =
  | { kind: 'success'; result: MockAdminAuthSuccess }
  /** Cognito's `newPasswordRequired` challenge (RF-59). */
  | { kind: 'newPasswordRequired' };

/** Fictional credentials for the four rostered administrators (RF-58). */

/**
 * Accounts that authenticate successfully but carry no console role, so the
 * rejection path of RF-66 stays reachable. The password is carried here too —
 * a missing entry must not read as "wrong password".
 */
const MOCK_ADMIN_NO_ROLE: Record<string, { name: string; role: string; password: string }> = {
  mockguest: { name: 'MOCK GUEST ACCOUNT', role: 'GUEST_USER', password: 'MockAdminPass1' },
};

/** Passwords accepted after `completeNewPasswordChallenge` in this page session. */
const completedAdminChallenges = new Map<string, string>();

const adminClaims = (account: { FullName: string; Role: string; SchoolID: string }): MockAdminClaims => ({
  name: account.FullName,
  'custom:Role': account.Role,
  'custom:SchoolID': account.SchoolID,
});

const adminSuccess = (username: string, claims: MockAdminClaims): MockAdminAuthSuccess => ({
  accessToken: `mock-admin-access-token.${username}.${Date.now()}`,
  idPayload: claims,
});

/**
 * Cognito-shaped administrator authentication. The real user pool is never
 * contacted (brief: mock API only). Mirrors `authenticateUser`'s three
 * outcomes: `success`, `newPasswordRequired`, and a thrown Cognito-style
 * message for an unknown user or a wrong password.
 */
export async function mockAuthenticateAdmin(
  username: string,
  password: string,
): Promise<MockAdminAuthOutcome> {
  await delay(LATENCY_MIN_MS + Math.random() * (LATENCY_MAX_MS - LATENCY_MIN_MS));
  const key = username.trim().toLowerCase();

  const completed = completedAdminChallenges.get(key);
  if (completed !== undefined) {
    if (completed !== password) throw new Error('Incorrect username or password.');
    const account = staffDirectory.find((a) => a.Username.toLowerCase() === key);
    return {
      kind: 'success',
      result: adminSuccess(
        key,
        adminClaims({
          FullName: account?.FullName ?? 'Admin',
          Role: account?.Role ?? 'SUPER_ADMIN',
          SchoolID: account?.SchoolID ?? MOCK_SCHOOL_ID,
        }),
      ),
    };
  }

  const expected = adminPasswords[key] ?? MOCK_ADMIN_NO_ROLE[key]?.password;
  if (expected === undefined) throw new Error('User does not exist.');
  if (expected !== password) throw new Error('Incorrect username or password.');

  const noRole = MOCK_ADMIN_NO_ROLE[key];
  if (noRole) {
    return {
      kind: 'success',
      result: adminSuccess(key, {
        name: noRole.name,
        'custom:Role': noRole.role,
        'custom:SchoolID': MOCK_SCHOOL_ID,
      }),
    };
  }

  if (expected === 'TempAdmin1!') return { kind: 'newPasswordRequired' };

  const account = MOCK_ADMINS.find((a) => a.Username.toLowerCase() === key);
  return {
    kind: 'success',
    result: adminSuccess(
      key,
      adminClaims({
        FullName: account?.FullName ?? 'Admin',
        Role: account?.Role ?? 'SUPER_ADMIN',
        SchoolID: account?.SchoolID ?? MOCK_SCHOOL_ID,
      }),
    ),
  };
}

/**
 * Stands in for `CognitoUser.completeNewPasswordChallenge(newPass, {}, …)`:
 * the new password is remembered for this page session so the follow-up
 * `processLoginSuccess` carries the same claims.
 */
export async function mockCompleteAdminPasswordChallenge(
  username: string,
  newPassword: string,
): Promise<MockAdminAuthSuccess> {
  await delay(LATENCY_MIN_MS + Math.random() * (LATENCY_MAX_MS - LATENCY_MIN_MS));
  const key = username.trim().toLowerCase();
  if (adminPasswords[key] === undefined && MOCK_ADMIN_NO_ROLE[key] === undefined) {
    throw new Error('User does not exist.');
  }
  completedAdminChallenges.set(key, newPassword);
  const account = MOCK_ADMINS.find((a) => a.Username.toLowerCase() === key);
  return adminSuccess(
    key,
    adminClaims({
      FullName: account?.FullName ?? 'Admin',
      Role: account?.Role ?? 'SUPER_ADMIN',
      SchoolID: account?.SchoolID ?? MOCK_SCHOOL_ID,
    }),
  );
}
