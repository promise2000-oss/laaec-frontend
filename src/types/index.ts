/**
 * LAEC CBT portal — typed domain model.
 *
 * Evidence sources: PRD.md §1.4 (glossary), §2.2 (academic model), §2.3
 * (runtime configuration), §6 (requirements), and field usage observed in the
 * original front-end code (origin-pages/*.html, public/*.js — summarised in
 * tools/actions-report.txt).
 *
 * Convention: a field whose name could not be confirmed carries an
 * `unconfirmed` marker in its doc comment. Nothing is invented silently
 * (decision D-05).
 */

export type ExamMode = 'MODE_A' | 'MODE_B';

/** Local per-school mode adds NOT_SET to the global pair (PRD §2.2). */
export type LocalMode = ExamMode | 'NOT_SET';

export type ExamTerm = 'TERM1' | 'TERM2' | 'TERM3';

export type ExamCategory = 'EXAM' | 'CA1' | 'CA2';

/**
 * Roles as they stand after the exam-management addendum (D-55).
 *
 * The first four are the origin's own (`AdminRole` observed in every console's
 * `custom:Role` claim). `TEACHER` and `CENTRAL_ADMIN` are new: a teacher is
 * school staff who authors question papers, and the Central Admin sits above
 * the school consoles, owning staff onboarding across all schools and the
 * question-review queue.
 */
export type AdminRole =
  | 'SUPER_ADMIN'
  | 'SCHOOL_ADMIN'
  | 'ICT_ADMIN'
  | 'EXAM_COMMITTEE'
  | 'TEACHER'
  | 'CENTRAL_ADMIN';

/** Attested value: 'ACTIVE' (RF-63). The full status set was not observed — unconfirmed. */
export type AdminStatus = string;

/** Attested values come from element hints (OBJECTIVE / THEORY / SUB_OBJECTIVE class
 *  names on /exam/); the complete enumeration on the wire is unconfirmed. */
export type QuestionType = string;

/**
 * The four-part academic coordinate passed to nearly every API call (PRD §2.2).
 */
export interface AcademicCoordinate {
  /** e.g. `2025/2026` */
  year: string;
  term: ExamTerm;
  category: ExamCategory;
  mode: ExamMode;
}

/**
 * Runtime configuration state governing every session (PRD §2.3).
 */
export interface PortalConfig {
  /** e.g. `2025/2026` */
  academicYear: string;
  currentTerm: ExamTerm;
  activeExamType: ExamCategory;
  /** Effective mode, resolved by `resolveEffectiveMode` (PRD §2.2). */
  mode: ExamMode;
  portalActive: boolean;
  promotionActive: boolean;
  /** Default paper duration in minutes (RF-41). */
  examDuration: number;
  /** Live window bounds. Exact wire format unconfirmed; carried as strings. */
  StartTime: string;
  EndTime: string;
  /** Subjects with a paper scheduled inside the current window (PRD §2.3). */
  activeSubjects: string[];
  /**
   * Observed keys read by /login/ (origin-pages/login.html):
   * `resolveEffectiveMode` uses `currentMode`; `isPaperLiveNow` falls back to
   * `startTime` / `liveStartTime` / `endTime` / `liveEndTime`.
   */
  currentMode?: ExamMode;
  startTime?: string;
  liveStartTime?: string;
  endTime?: string;
  liveEndTime?: string;
}

/**
 * Student record — field names observed in origin-pages/login.html and
 * origin-pages/exam.html.
 */
export interface Student {
  PK: string;
  /** Format `LAEC/<school>/<year>/<serial>` (PRD §1.4). */
  RegNo: string;
  FullName: string;
  SchoolID: string;
  Class: string;
  /** Requests spell this `studentArm` (UPDATE_STUDENT_SUBJECTS payload). */
  Arm: string;
  Subjects: string[];
  PassportURL: string;
  SchoolName?: string;
  /**
   * Alternate spellings read by /login/ helpers (`getStudentSchoolLabel`,
   * `getStudentArmValue`) — observed in origin-pages/login.html. The
   * migration flow also writes `StudentArm`.
   */
  schoolName?: string;
  School?: string;
  school?: string;
  StudentArm?: string;
  /**
   * Plaintext password carried in the response and printed on the slip (D7,
   * RF-29). Present in the as-built system; replicated as observed.
   */
  Password?: string;
  RequiresSubjectUpdate?: boolean;
  SubjectUpdateReason?: string;
  /** unconfirmed: session and status fields may also be present in responses. */
}

/**
 * Question record — field names observed in origin-pages/exam.html,
 * public/question-management.js and public/config.js.
 */
export interface Question {
  QuestionID?: string;
  SK?: string;
  QuestionType: QuestionType;
  Question: string;
  QuestionHTML?: string;
  Text?: string;
  TextHTML?: string;
  /**
   * `A`–`D` are typed optional because the exam hall renders only the letters a
   * question actually carries (RF-35): the origin's own option filter checks
   * each letter for presence, so a question missing one of them is a shape the
   * renderer is written for, even though every question in the capture carried
   * all four.
   */
  A?: string;
  B?: string;
  C?: string;
  D?: string;
  AHTML?: string;
  BHTML?: string;
  CHTML?: string;
  DHTML?: string;
  /** `A`–`D` observed for objective items; theory scoring shape unconfirmed. */
  Correct: string;
  /**
   * Mark columns read by /exam/ grading as `q[activeTestType]`
   * (`parseFloat(q[activeTestType])`, origin-pages/exam.html
   * `processSubmission`) — attested by the shipped front-end; wire values are
   * strings. `activeTestType` comes from `currentExamCategory` (hallway) and
   * resolves to `EXAM` for every observed session.
   */
  EXAM?: string;
  CA1?: string;
  CA2?: string;
  ImageURL?: string;
  /** Truthy flag gates deterministic FNV-1a shuffling (RF-53). */
  ShuffleQuestions?: boolean;
  /**
   * Paper coordinates: `normalizeQuestionRow` (config.js) reads
   * `row.Subject || row.subject` / `row.Class || row.class`, and
   * `normalizeQuestionRows` filters out rows missing them — so stored records
   * are attested to carry both (field-set beyond these two unconfirmed).
   */
  Subject?: string;
  Class?: string;
  /**
   * Paper coordinates read by /exam/ off `questions[0]` ("the paper"):
   * `DurationMinutes` (RF-41 override, logged as
   * "Applying Paper-Specific Timer"), `EndTime` (RF-43 hard cut-off) and the
   * Stage-1 instruction chain — attested by origin-pages/exam.html
   * `fetchQuestions`. Mock rows carry all of them (fixtures in mockData).
   */
  DurationMinutes?: number;
  EndTime?: string;
  AssessmentInstruction?: string;
  Instruction?: string;
  Instructions?: string;
}

/**
 * Stored result line — `pk`/`sk` observed in DELETE and remark payloads; the
 * three mark columns CA1, CA2 and EXAM are attested by PRD §1.4. Wire names of
 * the mark columns are unconfirmed.
 */
export interface ResultRecord {
  pk: string;
  sk: string;
  /** Observed: the subject hallway reads `r.Subject` for completion state. */
  Subject?: string;
  CA1?: number; // unconfirmed name
  CA2?: number; // unconfirmed name
  EXAM?: number; // unconfirmed name
  /**
   * Administrator-side fields, attested in origin-pages/admin.html by its
   * renderers (`renderInvigilatorRows`, `getResultPercentage`,
   * `formatResultScore`, `getResultClassValue`, `getResultArmValue` and
   * `dedupeInvigilatorResults`): the record carries the student identity, the
   * examination coordinate, the score triple and the violation payload.
   */
  PK?: string;
  SK?: string;
  FullName?: string;
  RegNo?: string;
  SchoolID?: string;
  Class?: string;
  /** The origin reads `StudentClass` first, then `Class`. */
  StudentClass?: string;
  Arm?: string;
  StudentArm?: string;
  Category?: string;
  Mode?: string;
  Term?: string;
  Year?: string;
  Timestamp?: string;
  Percentage?: number;
  Score?: number;
  Total?: number;
  Status?: string;
  Violation?: string;
  /**
   * Per-question script for the results answer-sheet viewer. The origin's
   * `getResultAnswerScript` accepts an array, a JSON string, or the lowercase
   * `answerScript` / `Script` aliases, so the string form is attested too.
   */
  AnswerScript?: unknown[] | string;
  answerScript?: unknown[];
  Script?: unknown[];
}

/**
 * Administrator directory entry — field names observed in admin.html.
 */
export interface AdminAccount {
  Username: string;
  Email: string;
  FullName: string;
  Role: AdminRole;
  SchoolID: string;
  Timestamp?: string;
  /** Record-side name unconfirmed; requests send `newStatus`. */
  Status?: AdminStatus;
  /** Read by the /ca/ internal-admin table: `Enabled === false` renders DISABLED. */
  Enabled?: boolean;
  /** Read by `canRevokeInternalAdmin`: only self-created admins stay revocable. */
  CreatedByUsername?: string;
}

/**
 * Lifecycle state of a school in the multi-school platform (multi-school spec §1).
 *
 * ACTIVE    — reachable at its subdomain, appears in dropdowns.
 * INACTIVE  — registered but not yet switched on; the portal refuses it.
 * SUSPENDED — administratively blocked; the portal refuses it and protected
 *             examination services are denied until it is restored.
 *
 * The three are kept distinct rather than collapsed into a boolean because the
 * spec treats "not yet live" and "blocked" as different administrative acts with
 * different restore paths (activate vs. restore).
 */
export type SchoolStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

/**
 * Per-school identity shown when a user loads the school's own subdomain
 * (multi-school spec §5). Every field is optional: a school with no branding
 * configured falls back to the platform's own defaults rather than rendering
 * empty controls.
 */
export interface SchoolBranding {
  /** Absolute or app-relative logo URL. */
  logoUrl?: string;
  /** Primary brand colour, as any CSS colour value (`#123456`, `blue`, …). */
  primaryColor?: string;
  /** Secondary/accent brand colour. */
  secondaryColor?: string;
  /** Public contact email shown in the school portal footer. */
  contactEmail?: string;
  /** Public contact phone. */
  contactPhone?: string;
  /** Postal address; overrides the record's top-level `Address` when set. */
  address?: string;
  /** Examination instructions rendered before a candidate starts a paper. */
  examInstructions?: string;
}

/**
 * School-scoped counters shown on the school-specific dashboard (spec §1,
 * "view school-specific statistics"). The mock derives these from its own
 * fixtures where it can and reports zeros where the fixture set has no data for
 * a school; a real backend would aggregate them per tenant.
 */
export interface SchoolStats {
  students: number;
  teachers: number;
  exams: number;
  questions: number;
  results: number;
}

/**
 * An archdiocesan school (PRD D23), extended into a multi-school tenant
 * (multi-school spec §1, §3, §5).
 *
 * The origin hardcodes ten schools in `SCHOOL_NAMES` / `SCHOOL_ORDER` (see
 * `src/lib/console.ts`). That list is the SEED for this record: the ten served
 * schools are always present, and a super administrator can add more at
 * runtime from the `/admin/` Schools panel. `Code` is the short SchoolID every
 * console already keys on (SFC, SGC, …); `Name` is the display name shown in
 * the school dropdowns and on the population charts.
 *
 * `builtin` marks the ten seeded schools so the panel can label them and, if a
 * delete is ever added, protect them the way the origin protects the original
 * School Admin account.
 *
 * The multi-school fields are what turn the registry into tenants:
 *   - `slug` is the URL-friendly subdomain (`greenfield-international`) that
 *     `lib/tenant.ts` resolves from a request hostname; it is generated
 *     automatically at onboarding and is unique across the registry.
 *   - `status` gates whether the subdomain serves the portal at all.
 *   - `groupId` is the school's SINGLE group membership (spec §7 exclusive
 *     foreign key): `null` means ungrouped, and a school is never in two groups
 *     at once. Group membership is derived from this column, not stored twice.
 *   - `branding` and `stats` are the school-specific identity and counters.
 */
export interface SchoolRecord {
  /** Short SchoolID, uppercased: SFC, SGC, or a newly added code. */
  Code: string;
  /** Display name shown in the school dropdowns. */
  Name: string;
  /** Optional address, carried for the school's profile row. */
  Address?: string;
  /** True for the ten schools hardcoded on the origin. */
  builtin?: boolean;
  /** Unique subdomain label; the school's portal URL is `https://<slug>.laaec.com`. */
  slug: string;
  /** Lifecycle state; defaults to ACTIVE so the seeded ten stay reachable. */
  status: SchoolStatus;
  /** Exclusive group membership (spec §7); `null` when the school is ungrouped. */
  groupId: string | null;
  /** Optional school-specific identity for its own portal (spec §5). */
  branding?: SchoolBranding;
  /** School-scoped dashboard counters (spec §1). */
  stats?: SchoolStats;
  /** ISO timestamp the school was onboarded. */
  createdAt: string;
  /** ISO timestamp of the last edit, status change or URL regeneration. */
  updatedAt: string;
}

/**
 * A named group of schools (multi-school spec §2).
 *
 * Membership is NOT stored here: a school's `groupId` is the single source of
 * truth (spec §7 exclusive foreign key), and `GET_SCHOOL_GROUPS` derives each
 * group's members from the registry. Storing the member list on both sides is
 * exactly how a group and its schools drift apart — so there is one column, and
 * deleting a group simply nulls it on its schools, never touching the schools
 * themselves (spec §2, "delete groups without accidentally deleting the
 * schools").
 */
export interface SchoolGroup {
  /** Stable identifier; also the value of `SchoolRecord.groupId`. */
  id: string;
  /** Display name, e.g. "Group A". */
  name: string;
  /** Optional human description of the group's purpose. */
  description?: string;
  /** ISO timestamp the group was created. */
  createdAt: string;
  /** ISO timestamp of the last rename/description edit. */
  updatedAt: string;
}

/**
 * Scheduled paper inside the live window. Field names are the union observed
 * in `normalizeLivePaper` (origin-pages/login.html): identity aliases are
 * tried in order, then time aliases. Duration and EndTime are RF-41/RF-43.
 */
export interface Paper {
  Subject?: string;
  subject?: string;
  Name?: string;
  name?: string;
  Class?: string;
  class?: string;
  StudentClass?: string;
  studentClass?: string;
  Level?: string;
  level?: string;
  /** RF-41: overrides `config.examDuration` where present. */
  DurationMinutes?: number;
  /**
   * Paper-specific instruction shown in Stage 1 — the exam page reads
   * `paper.AssessmentInstruction || paper.Instruction || paper.Instructions`
   * (origin-pages/exam.html `fetchQuestions`), falling back to its own
   * "No additional subject-specific instruction…" copy.
   */
  AssessmentInstruction?: string;
  Instruction?: string;
  Instructions?: string;
  /** RF-43: future value becomes `hardCutOffTime`. */
  EndTime?: string;
  endTime?: string;
  liveEndTime?: string;
  end?: string;
  /** Observed live-window start aliases (origin-pages/login.html). */
  StartTime?: string;
  startTime?: string;
  liveStartTime?: string;
  start?: string;
}

/**
 * Demotion/migration audit line. Only the response key (`data.logs`) was
 * observed — the record shape is unconfirmed.
 */
/**
 * One row of the `/ca/` Promotion Exception register. The origin's
 * `loadDemotionLog` (ca.html line 2473) reads exactly these fields, plus a
 * `counts` map keyed by RegNo beside the log array.
 */
export interface DemotionLog {
  DemotedAt: string;
  FullName: string;
  RegNo: string;
  PreviousClass: string;
  NewClass: string;
}

/**
 * One line of the `answerScript` array inside SUBMIT_EXAM_RESULT — field
 * names observed verbatim in origin-pages/exam.html `processSubmission`
 * (attested 2026-09-28).
 */
export interface ExamAnswerScriptLine {
  QuestionNo: number;
  QuestionID: string;
  QuestionType: string;
  Question: string;
  QuestionHTML: string;
  A: string;
  B: string;
  C: string;
  D: string;
  AHTML: string;
  BHTML: string;
  CHTML: string;
  DHTML: string;
  StudentAnswer: string;
  CorrectAnswer: string;
  Mark: number;
  Awarded: number;
  IsCorrect: boolean;
}

/**
 * SUBMIT_EXAM_RESULT payload — field names observed verbatim in
 * origin-pages/exam.html `processSubmission` (attested 2026-09-28). The
 * outer envelope is `{ action, result }` (contract.ts).
 */
export interface ExamResultSubmission {
  regNo: string;
  testType: string;
  term: string;
  mode: string;
  academicYear: string;
  fullName: string;
  schoolID: string;
  studentClass: string;
  studentArm: string;
  subject: string;
  score: number;
  total: number;
  percentage: number;
  answerScript: ExamAnswerScriptLine[];
  status: 'FLAGGED' | 'CLEAN';
  violation: string;
}

/**
 * Nested `question` object sent by ADD_QUESTION / UPDATE_QUESTION. Its field
 * set was not observed — unconfirmed.
 */
export type QuestionSubmission = Record<string, unknown>;

/* ── question authoring lifecycle (exam-management addendum, D-53) ──────── */

/**
 * The lifecycle a teacher's paper moves through. The origin has no equivalent:
 * `ADD_QUESTION` / `UPDATE_QUESTION` write straight into the live set, which is
 * what the school consoles still do. The addendum asks for mediation, so a
 * submission carries a state and only `LIVE` questions reach the exam hall.
 */
export type QuestionStatus = 'DRAFT' | 'PENDING_REVIEW' | 'LIVE' | 'REJECTED';

/** One paper's worth of questions, authored by a teacher for one coordinate. */
export interface QuestionSubmissionRecord {
  SubmissionID: string;
  SchoolID: string;
  Subject: string;
  Class: string;
  Term: string;
  Category: string;
  Status: QuestionStatus;
  SubmittedBy: string;
  SubmittedByName: string;
  SubmittedAt: string;
  UpdatedAt: string;
  ReviewedBy?: string;
  ReviewedAt?: string;
  ReviewNote?: string;
  QuestionCount: number;
  Questions: Question[];
}

/* ── portal notifications, calendar and notices (D-64) ───────────────────── */

/**
 * Notification categories. The source application this was taken from groups its
 * centre by department (Leave, Attendance, Discipline, Counselling), which does
 * not map onto an exam portal; these are the six kinds of thing an examination
 * administrator or an author actually needs to be told about.
 */
export type NoticeCategory =
  | 'EXAM'
  | 'REVIEW'
  | 'RESULTS'
  | 'ANNOUNCEMENT'
  | 'SYSTEM'
  | 'SECURITY';

/** One item in the notification centre. */
export interface PortalNotification {
  NotificationID: string;
  Category: NoticeCategory;
  Title: string;
  Body: string;
  CreatedAt: string;
  Read: boolean;
  /** Route the item links to, when it links anywhere. */
  Link?: string;
  /** Set when the item is addressed to one account rather than a whole role. */
  Username?: string;
  /** Set when the item is addressed to a whole role. */
  Role?: AdminRole;
  Pinned?: boolean;
  /**
   * Finer-grained origin for the item, used by the teacher portal's filter tabs
   * (D-72).
   *
   * `Category` is deliberately NOT stretched for this. LAEC has six coarse
   * categories and the deployed portal's notification centre has per-module
   * types — `DISCIPLINE`, `COUNSELLING`, `LEAVE`, `EVENT` and so on — so
   * mapping a disciplinary case onto a category that another module also uses
   * would make the Discipline and Counselling tabs show the same rows. This
   * optional field carries the module and the category stays what it means
   * elsewhere in the portal. Absent on LAEC's own notifications, which are
   * filtered by `Category`.
   */
  Kind?: string;
}

/* ── academic calendar ─────────────────────────────────────────────────── */

/** The three things a calendar day can hold. */
export type CalendarEventKind = 'TERM' | 'EXAM' | 'EVENT' | 'HOLIDAY';

export interface CalendarEvent {
  EventID: string;
  Kind: CalendarEventKind;
  Title: string;
  Description: string;
  /** ISO date, or ISO datetime for a timed event. */
  Start: string;
  End: string;
  AllDay: boolean;
  /** The exam year/term the event belongs to, e.g. `2025/2026 TERM1`. */
  Session?: string;
  SchoolID: string;
}

/* ── notice board ──────────────────────────────────────────────────────── */

/** Who a notice is addressed to. `ALL` is the whole portal. */
export type NoticeAudience = 'ALL' | 'SCHOOL_ADMIN' | 'ICT_ADMIN' | 'TEACHER' | 'EXAM_COMMITTEE' | 'CENTRAL_ADMIN' | 'SUPER_ADMIN';

export interface NoticeBoardItem {
  NoticeID: string;
  Title: string;
  Body: string;
  Audience: NoticeAudience;
  AuthorUsername: string;
  AuthorName: string;
  PublishedAt: string;
  Pinned: boolean;
  SchoolID: string;
}

/** In-app notice a decision raises for the teacher who submitted the paper. */
export interface TeacherNotice {
  NoticeID: string;
  SchoolID: string;
  TeacherUsername: string;
  SubmissionID: string;
  Subject: string;
  Class: string;
  Decision: 'ACCEPTED' | 'REJECTED';
  Note: string;
  CreatedAt: string;
  Read: boolean;
}

/**
 * Byte-exact storage keys. Do not rename, merge or abbreviate.
 */
export const STORAGE_KEYS = {
  LAEC_Session: 'LAEC_Session',
  AdminName: 'AdminName',
  SchoolID: 'SchoolID',
  AdminRole: 'AdminRole',
  AdminUsername: 'AdminUsername',
  AdminSessionID: 'AdminSessionID',
  /**
   * The 33 school roles this session holds, as a JSON array of their live names.
   *
   * Separate from `AdminRole` because the two answer different questions: the
   * claim gates the console, these gate what is reachable inside it. A session
   * carries both, and `effectivePermissions` unions the two axes.
   */
  AdminSchoolRoles: 'AdminSchoolRoles',
  activeStudent: 'activeStudent',
  selectedSubject: 'selectedSubject',
  studentToken: 'studentToken',
  /* Observed in origin-pages/login.html (session flow, PRD §4.2 sequence). */
  studentSessionID: 'studentSessionID',
  studentSessionLocked: 'studentSessionLocked',
  currentEffectiveMode: 'currentEffectiveMode',
  currentExamCategory: 'currentExamCategory',
  currentExamTerm: 'currentExamTerm',
  currentExamYear: 'currentExamYear',
} as const;

/**
 * RF-52 answer key — byte-exact: `ans_{RegNo}_{subject}`.
 * Observed usage: `localStorage` holding `JSON.stringify(answers)`.
 */
export const answerStorageKey = (regNo: string, subject: string): string =>
  `ans_${regNo}_${subject}`;

/**
 * One candidate probe recorded by `fetchQuestionSet` (config.js) — feeds the
 * /login/ "Diagnostic Report" alert (`${a.subject} @ ${a.class}`).
 */
export interface QuestionSetAttempt {
  subject: string;
  class: string;
  count: number;
  searchedPK: string;
}

/** Return shape of `window.LAEC_UTILS.fetchQuestionSet` (read from config.js). */
export interface FetchQuestionSetResult {
  data: {
    status: 'success' | 'error';
    message?: string;
    questions?: unknown[];
    completed?: boolean;
    debug?: { attempts?: QuestionSetAttempt[]; searchedPK?: string };
  };
  attempts: QuestionSetAttempt[];
  resolvedSubject: string;
  resolvedClass: string;
}

/**
 * Pure helpers from `/config.js` — exposed as `window.LAEC_UTILS` (line 829
 * of the served file; consumed as `const LAEC = window.LAEC_UTILS` in
 * origin-pages/login.html). The library also ships transport helpers
 * (`fetchJsonWithRetry`, `fetchWithRetry`, `buildApiUrl`); pages route plain
 * GET/POST actions through the mock adapter instead (D-05), EXCEPT
 * `fetchQuestionSet`, which is invoked with a `fetchImpl` shim so its
 * subject/class candidate expansion and Diagnostic Report attempts stay
 * byte-authentic without touching the network.
 */
export interface LaecUtils {
  humanizeSubject(value: string): string;
  /**
   * `extractFormattedQuestionRows(workbook)` (config.js line 399) — reads the
   * first sheet of a SheetJS workbook into formatted question rows, honouring
   * rich-text cells. Used by the /admin/ question blaster.
   */
  extractFormattedQuestionRows(workbook: unknown): Record<string, unknown>[];
  /**
   * `normalizeQuestionRows(rows)` (config.js line 478) — normalises each row
   * and drops those without Subject, Class or Question. The blaster asserts on
   * the `Class` column of the raw rows before calling it.
   */
  normalizeQuestionRows(rows?: Record<string, unknown>[]): Question[];
  normalizeSubjectValue(value: unknown): string;
  normalizeClassValue(value: unknown): string;
  /**
   * `sanitizeRichTextHtml(html, fallbackText = "")` — read from config.js;
   * /exam/ feeds it `renderSafeQuestionHtml` for question, option and diagram
   * markup (origin-pages/exam.html).
   */
  sanitizeRichTextHtml(html: string | null | undefined, fallbackText?: string): string;
  fetchQuestionSet(options: {
    baseUrl: string;
    params: Record<string, string>;
    fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  }): Promise<FetchQuestionSetResult>;
  /**
   * `fetchQuestionInventory({...})` (config.js line 684) — the paper-inventory
   * read behind `LAECExamSession` on the four consoles. It takes the same
   * `fetchImpl` seam as `fetchQuestionSet`, which is how the first-party
   * library is driven from the mock instead of the live endpoint.
   */
  fetchQuestionInventory(options: {
    baseUrl: string;
    schoolID: string;
    year: string;
    term: string;
    type: string;
    mode: string;
    fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
    forceRefresh?: boolean;
  }): Promise<{ status?: string; papers?: unknown[]; inventory?: unknown[]; message?: string }>;
}

declare global {
  interface Window {
    LAEC_UTILS?: LaecUtils;
  }
}

/**
 * `/question-management.js` (first-party, served on all four consoles). It
 * self-initialises on DOMContentLoaded, which in a module-rendered page fires
 * before the view mounts, so the view calls `init()` itself once the exam panel
 * exists (D-46).
 */
interface LaecQuestionManagerApi {
  init: () => void;
  load: () => Promise<void>;
  save: (index: number) => Promise<void>;
  add: () => Promise<void>;
  remove: (index: number) => Promise<void>;
  removePaper: () => Promise<void>;
  syncFromSession: () => void;
}

declare global {
  interface Window {
    LAECQuestionManager?: LaecQuestionManagerApi;
  }
}

/**
 * `/config.js` (first-party, served as-is) publishes its endpoint table as a
 * global. Read for the base URL only — the answer-script viewer's cloud
 * re-fetch is routed to the mock transport (D-39), so no request built from
 * these addresses leaves the browser (D-04).
 */
interface AwsConfig {
  region: string;
  tableName: string;
  userPoolId: string;
  clientId: string;
  registerEndpoint: string;
  getStudentsEndpoint: string;
}

declare global {
  interface Window {
    AWS_CONFIG?: AwsConfig;
  }
}

