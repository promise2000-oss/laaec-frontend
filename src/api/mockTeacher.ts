/**
 * Mock handlers for the St Finbarr's teacher portal (D-72).
 *
 * Kept out of `mock.ts` because that file is already the 38-action LAEC
 * contract and these are 49 more; `attachTeacherHandlers` folds them into the
 * same `handlers` map so `callApi`'s permission gate and latency simulation
 * still apply unchanged.
 *
 * WHY THIS FILE HAS SEED DATA WHERE THE ORIGIN'S MOCK HAS NONE
 * -----------------------------------------------------------
 * `lib/api/mock-data.ts` in the deployed app has **no** handler for
 * `/lesson-plans/**` or `/class-teacher-weekly-reports/**` and no `db` collection
 * for either, so in its own mock mode the two largest teacher modules fall
 * through to a real fetch and `useApiResource` silently swallows the 404 as
 * empty. `db.weeklyReports` is seeded empty. The mock also seeds three roles
 * (none of them teacher) and always signs in as the same super admin, so there
 * is no teacher identity to exercise the portal against.
 *
 * Reproducing that would reproduce a broken portal. This file therefore seeds
 * rows for all three document modules and a teacher directory, so every
 * workflow is reachable and every state (draft, pending, approved, rejected,
 * submitted, reviewed) is visible without first authoring something. The
 * divergence is deliberate and recorded in docs/teacher-portal/api-map.md.
 */

import type { ActionName, ApiMap } from './contract';
import { MOCK_ADMINS } from './mockData';
import { SEED_INCIDENT_TYPES } from './seedCaseCatalogue';
import type {
  CaseComment,
  ChatMessage,
  ClassTeacherReport,
  Conversation,
  CounsellingCase,
  CounsellingCommittee,
  CounsellingReport,
  DisciplinaryCase,
  DisciplinaryCommittee,
  DisciplinaryIncidentType,
  HrQuery,
  LeadershipEntry,
  LeaveRequest,
  LessonPlan,
  ReferenceClass,
  ReferenceSession,
  SchoolEvent,
  TeacherDirectoryEntry,
  TeacherProfile,
  WeeklyReport,
  Weekday,
} from '../types/teacher';
import { WEEKDAYS } from '../types/teacher';

type AnyRes = { status: 'success' | 'error'; message?: string; [k: string]: unknown };
type Req = Record<string, unknown>;

const ok = (message: string): AnyRes => ({ status: 'success', message });

const text = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const trimmed = (v: unknown): string => text(v).trim();

/** `YYYY-MM-DD`, the form the origin's date inputs submit. */
const today = (): string => new Date().toISOString().slice(0, 10);
const isoNow = (): string => new Date().toISOString();
const shiftDays = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/* ── seed data ──────────────────────────────────────────────────────────── */

/**
 * The seeded teacher is derived from LAEC's own roster rather than hard-coded,
 * because every teacher-portal read is filtered on the session's username. A
 * literal here would silently return zero rows for any account the roster does
 * not name — which is exactly the failure this derivation exists to prevent.
 */
const SEEDED_TEACHER = MOCK_ADMINS.find((a) => a.Role === 'TEACHER');
const TEACHER_USERNAME = SEEDED_TEACHER?.Username ?? 'teacher@nicegeneco.com';
const TEACHER_NAME = SEEDED_TEACHER?.FullName ?? 'MOCK TEACHER ONE';

/** The reviewer is a non-teacher leader, so the Review Inbox is not self-review. */
const REVIEWER = MOCK_ADMINS.find((a) => a.Role === 'EXAM_COMMITTEE') ??
  MOCK_ADMINS.find((a) => a.Role === 'SCHOOL_ADMIN');
const REVIEWER_USERNAME = REVIEWER?.Username ?? 'mockcommittee';
const REVIEWER_NAME = REVIEWER?.FullName ?? 'MOCK HEAD OF DEPARTMENT';

/**
 * The reviewer / recipient picker reads LAEC's own roster, filtered the way the
 * origin filters `GET /communication/users`: active accounts only, the caller
 * excluded, capped at 20. Building it from `MOCK_ADMINS` rather than inventing
 * entries means every name a picker offers is an account that really exists in
 * the session's school.
 */
const DIRECTORY: TeacherDirectoryEntry[] = MOCK_ADMINS.map((account) => ({
  username: account.Username,
  fullName: account.FullName,
  email: account.Email,
  department: account.Username === REVIEWER_USERNAME ? 'Examination Office' : 'Teaching Staff',
  designation: account.Role,
  status: account.Status === 'ACTIVE' ? 'active' : 'suspended',
}));

const SESSIONS: ReferenceSession[] = [
  { id: 'SES-2025-1', name: '2025/2026', term: 'First Term' },
  { id: 'SES-2025-2', name: '2025/2026', term: 'Second Term' },
  { id: 'SES-2025-3', name: '2025/2026', term: 'Third Term' },
];

/** Classes the signed-in teacher is the class teacher of. */
const MY_CLASSES: ReferenceClass[] = [
  { id: 'CLS-JSS1', name: 'JSS1', sectionId: 'SEC-A' },
  { id: 'CLS-JSS2', name: 'JSS2', sectionId: 'SEC-B' },
];

const SUPERIORS: LeadershipEntry[] = [
  {
    username: REVIEWER_USERNAME,
    fullName: REVIEWER_NAME,
    email: 'admintwo@laec.edu.ng',
    roleNames: ['Head of Department'],
  },
  {
    username: 'principal',
    fullName: 'MOCK PRINCIPAL',
    email: 'principal@laec.edu.ng',
    roleNames: ['Principal'],
  },
];

const emptyDaily = (): Record<Weekday, string> => ({
  monday: '',
  tuesday: '',
  wednesday: '',
  thursday: '',
  friday: '',
});

/** Five empty unchecked rows, which is what the origin's forms seed. */
const emptyChecklist = (): WeeklyReport['participationItems'] =>
  Array.from({ length: 4 }, () => ({ text: '', checked: false }));

const blankLesson = (over: Partial<LessonPlan> = {}): LessonPlan => ({
  id: '',
  teacherUsername: TEACHER_USERNAME,
  teacherName: TEACHER_NAME,
  academicSessionId: SESSIONS[0].id,
  term: 'First',
  week: 1,
  classId: 'CLS-JSS1',
  className: 'JSS1',
  startDate: today(),
  endDate: today(),
  subject: 'Mathematics',
  topic: '',
  subTopic: '',
  duration: '',
  period: '',
  objectives: [],
  instructionalMaterials: '',
  previousKnowledge: '',
  entryBehaviour: '',
  recommendedText: '',
  referenceText: '',
  lessonContent: [],
  presentationSteps: [],
  studentActivities: [],
  summary: '',
  evaluationQuestions: '',
  assignment: '',
  remarks: '',
  supportingDocName: '',
  status: 'draft',
  rejectionReason: '',
  targetReviewerUsername: null,
  signature: '',
  signatureStyle: 'vibes',
  reviewedBy: '',
  reviewedAt: '',
  ...over,
});

const lessonPlans: LessonPlan[] = [
  blankLesson({
    id: 'LP-0001',
    topic: 'Fractions',
    subTopic: 'Addition of fractions',
    duration: '2HRS 20MINS',
    period: '4TH PERIOD',
    week: 3,
    objectives: ['Add two proper fractions with like denominators.'],
    instructionalMaterials: 'Fraction charts, counters.',
    previousKnowledge: 'Equivalent fractions.',
    entryBehaviour: 'Recap on equivalent fractions.',
    recommendedText: 'New Scheme Mathematics JSS1',
    referenceText: 'Chapter 5, pages 41-58',
    lessonContent: [{ heading: 'Introduction', body: 'Use a fraction chart to model 1/2 + 1/3.' }],
    presentationSteps: [
      { stepLabel: 'Step I', duration: '10MINS', teacherPresentation: 'Draw the fraction chart.' },
    ],
    studentActivities: [{ studentActivity: 'Pair work on worksheet 5c.', expectedResponse: 'Correct sums.' }],
    summary: 'Fractions added by converting to like denominators.',
    evaluationQuestions: 'What is 1/2 + 1/3?',
    assignment: 'Exercise 5, questions 1-10.',
    remarks: '',
  }),
  blankLesson({ id: 'LP-0002', topic: 'Sets', subTopic: 'Union and intersection', status: 'pending' }),
  blankLesson({
    id: 'LP-0003',
    topic: 'Angles',
    subTopic: 'Angles on a straight line',
    status: 'approved',
    signature: REVIEWER_NAME,
    reviewedBy: REVIEWER_USERNAME,
    reviewedAt: shiftDays(-2),
  }),
  blankLesson({
    id: 'LP-0004',
    topic: 'Ratio',
    status: 'rejected',
    rejectionReason: 'Objectives are not measurable, please revise and resubmit.',
  }),
];

const blankWeekly = (over: Partial<WeeklyReport> = {}): WeeklyReport => ({
  id: '',
  teacherUsername: TEACHER_USERNAME,
  teacherName: TEACHER_NAME,
  weekOfReport: 'Week 1',
  reportDate: today(),
  termSession: 'First Term, 2025/2026',
  subject: 'Mathematics',
  classAndArm: 'JSS1 A & B',
  topicCovered: 'Fractions',
  topicUncovered: '',
  reasons: '',
  participationItems: emptyChecklist(),
  classroomItems: emptyChecklist(),
  assignmentItems: emptyChecklist(),
  challengeItems: emptyChecklist(),
  recommendationItems: emptyChecklist(),
  additionalObservations: '',
  comments: '',
  notes: '',
  otherChallenges: '',
  furtherRecommendations: '',
  conclusion: '',
  status: 'draft',
  hodComment: '',
  hodReviewedBy: '',
  hodReviewedAt: '',
  headComment: '',
  headReviewedBy: '',
  headReviewedAt: '',
  signature: '',
  signatureStyle: 'vibes',
  ...over,
});

const weeklyReports: WeeklyReport[] = [
  blankWeekly({ id: 'WR-0001', topicCovered: 'Fractions and equivalent fractions' }),
  /* One report failing the form's own validation, so the error path is
     reachable from the seeded data rather than only after a bad save. The
     origin validates weekly reports on every save, draft included. */
  blankWeekly({ id: 'WR-0002', topicCovered: 'Sets', status: 'submitted' }),
  blankWeekly({
    id: 'WR-0003',
    topicCovered: 'Angles',
    status: 'reviewed',
    headComment: 'Well covered. Keep the practical work.',
    headReviewedBy: REVIEWER_USERNAME,
    headReviewedAt: shiftDays(-1),
    signature: REVIEWER_NAME,
  }),
];

const blankClassReport = (over: Partial<ClassTeacherReport> = {}): ClassTeacherReport => ({
  id: '',
  teacherUsername: TEACHER_USERNAME,
  teacherName: TEACHER_NAME,
  classId: 'CLS-JSS1',
  className: 'JSS1',
  sectionId: 'SEC-A',
  weekEndingStart: shiftDays(-4),
  weekEndingEnd: today(),
  week: 'Week 1',
  callsFromParents: '',
  callsToParents: '',
  teacherResponse: '',
  dailyReports: emptyDaily(),
  attendance: WEEKDAYS.map((day) => ({ day, present: 0, absent: 0 })),
  absenteesMonday: '',
  absenteesWeek: '',
  sickStudents: '',
  faultyFacilities: '',
  reportsFromTeachers: '',
  reportsFromStudents: '',
  studentsFeedbackAboutTeachers: '',
  responseFromClassTeachers: '',
  remedialClassesReport: '',
  casesForManagement: '',
  checkingOfNotes: '',
  classCaptainsReport: '',
  mentorsReport: '',
  status: 'draft',
  ...over,
});

const classReports: ClassTeacherReport[] = [
  blankClassReport({ id: 'CR-0001' }),
  blankClassReport({
    id: 'CR-0002',
    classId: 'CLS-JSS2',
    className: 'JSS2',
    sectionId: 'SEC-B',
    week: 'Week 2',
    status: 'submitted',
  }),
];

const leaveRequests: LeaveRequest[] = [
  {
    id: 'LV-0001',
    staffUsername: TEACHER_USERNAME,
    staffName: TEACHER_NAME,
    department: 'Science',
    leaveType: 'Annual Leave',
    startDate: shiftDays(7),
    endDate: shiftDays(9),
    days: 3,
    reason: 'Family visit.',
    status: 'PENDING',
    submittedAt: isoNow(),
    decidedAt: '',
    decidedBy: '',
    decisionComment: '',
  },
  {
    id: 'LV-0002',
    staffUsername: TEACHER_USERNAME,
    staffName: TEACHER_NAME,
    department: 'Science',
    leaveType: 'Sick Leave',
    startDate: shiftDays(-20),
    endDate: shiftDays(-19),
    days: 2,
    reason: 'Malaria.',
    status: 'APPROVED',
    submittedAt: isoNow(),
    decidedAt: isoNow(),
    decidedBy: REVIEWER_USERNAME,
    decisionComment: '',
  },
];

const hrQueries: HrQuery[] = [
  {
    id: 'HQ-0001',
    title: 'Broken projector in JSS1',
    description: 'The projector in JSS1 will not power on.',
    issuerName: TEACHER_NAME,
    issuerUsername: TEACHER_USERNAME,
    targetUsername: '',
    targetUserName: '',
    category: 'Facilities',
    priority: 'high',
    status: 'OPEN',
    response: '',
    createdAt: isoNow(),
  },
  {
    id: 'HQ-0002',
    title: 'Leave allowance query',
    description: 'How many days of leave allowance remain this term?',
    issuerName: TEACHER_NAME,
    issuerUsername: TEACHER_USERNAME,
    targetUsername: 'principal',
    targetUserName: 'MOCK PRINCIPAL',
    category: 'General',
    priority: 'medium',
    status: 'RESOLVED',
    response: 'Six days remain.',
    createdAt: isoNow(),
  },
];

const counsellingCommittees: CounsellingCommittee[] = [
  {
    id: 'CC-0001',
    name: 'School Guidance Unit',
    description: 'Handles behaviour and personal concerns.',
    isActive: true,
    members: [
      { username: REVIEWER_USERNAME, fullName: REVIEWER_NAME, email: 'admintwo@laec.edu.ng', role: 'CHAIR' },
    ],
  },
  {
    id: 'CC-0002',
    name: 'Careers Committee',
    description: 'Careers guidance and university placement.',
    isActive: true,
    members: [],
  },
];

const counsellingCases: CounsellingCase[] = [
  {
    id: 'CNS-001',
    caseNumber: 'CNS-001',
    studentName: 'MOCK STUDENT ONE',
    studentUsername: 'STU-0001',
    referredByName: TEACHER_NAME,
    referralDate: today(),
    priority: 'NORMAL',
    status: 'OPEN',
    committeeId: 'CC-0001',
    committeeName: 'School Guidance Unit',
    academicSessionId: SESSIONS[0].id,
    backgroundInfo: 'Repeated lateness this term.',
    reasonForReferral: 'Needs a career conversation.',
    initialComment: 'Referred for guidance.',
    comments: [],
  },
];

const counsellingReports: CounsellingReport[] = [
  {
    id: 'CRP-0001',
    caseId: 'CNS-001',
    caseNumber: 'CNS-001',
    title: 'Career guidance session notes',
    status: 'DRAFT',
    summary: '',
    findings: '',
    recommendations: '',
    actionPlan: '',
    authorUsername: TEACHER_USERNAME,
    createdAt: isoNow(),
  },
];

/**
 * The school's conduct code, transcribed from the live catalogue.
 *
 * These replaced two invented one-liners ("Fighting — physical altercation
 * between students") which had no counterpart in the deployed app and made the
 * incident-types page look like a lookup table rather than the rule book it is.
 * See `seedCaseCatalogue.ts` for what was observed, what was not, and why the
 * ninth of the live 33 entries is absent.
 */
const incidentTypes: DisciplinaryIncidentType[] = SEED_INCIDENT_TYPES.map((entry, index) => ({
  id: `DIT-${String(index + 1).padStart(4, '0')}`,
  title: entry.title,
  description: entry.description,
  isActive: true,
}));

const disciplinaryCommittees: DisciplinaryCommittee[] = [
  {
    id: 'DC-0001',
    name: 'Disciplinary Committee',
    description: 'Investigates cases of misconduct.',
    isActive: true,
    members: [
      { username: 'principal', fullName: 'MOCK PRINCIPAL', email: 'principal@laec.edu.ng', role: 'CHAIR' },
    ],
  },
];

const disciplinaryCases: DisciplinaryCase[] = [
  {
    id: 'DC-0001',
    caseNumber: 'DISC-001',
    studentName: 'MOCK STUDENT TWO',
    studentUsername: 'STU-0002',
    caseTypeId: 'DIT-0001',
    caseTypeTitle: 'Fighting',
    incidentDate: shiftDays(-3),
    location: 'School field',
    severity: 'MODERATE',
    status: 'OPEN',
    committeeId: 'DC-0001',
    committeeName: 'Disciplinary Committee',
    academicSessionId: SESSIONS[0].id,
    description: 'Two students fought during the interval.',
    initialComment: 'Reported by the duty teacher.',
    comments: [],
  },
];

const conversations: Conversation[] = [
  {
    id: 'CV-0001',
    kind: 'direct',
    name: REVIEWER_NAME,
    members: [TEACHER_USERNAME, REVIEWER_USERNAME],
    lastMessagePreview: 'Please review the lesson plan when you can.',
    lastMessageAt: shiftDays(-1),
    unreadCount: 1,
  },
];

const messages: ChatMessage[] = [
  {
    id: 'MSG-0001',
    conversationId: 'CV-0001',
    senderUsername: REVIEWER_USERNAME,
    senderName: REVIEWER_NAME,
    body: 'Please review the lesson plan when you can.',
    type: 'text',
    createdAt: `${shiftDays(-1)}T09:15:00.000Z`,
  },
];

const events: SchoolEvent[] = [
  {
    id: 'EV-0001',
    title: 'Staff meeting',
    description: 'Monthly staff briefing in the staff room.',
    location: 'Staff room',
    startsAt: `${shiftDays(5)}T09:00:00.000Z`,
    endsAt: `${shiftDays(5)}T10:00:00.000Z`,
    category: 'meeting',
    allDay: false,
    createdBy: 'principal',
  },
];

const profile: TeacherProfile = {
  firstName: 'MOCK',
  lastName: 'TEACHER ONE',
  email: 'teacherone@laec.edu.ng',
  phone: '08030000001',
  address: 'Lagos',
  gender: 'MALE',
  dateOfBirth: '1990-01-01',
  maritalStatus: 'MARRIED',
  emergencyMobile: '08030000002',
  qualifications: 'B.Sc. Mathematics',
};

/* ── counters ───────────────────────────────────────────────────────────── */

const counters = {
  lessonPlan: lessonPlans.length,
  weeklyReport: weeklyReports.length,
  classReport: classReports.length,
  leave: leaveRequests.length,
  hrQuery: hrQueries.length,
  counsellingCommittee: counsellingCommittees.length,
  counsellingCase: counsellingCases.length,
  counsellingReport: counsellingReports.length,
  incidentType: incidentTypes.length,
  disciplinaryCommittee: disciplinaryCommittees.length,
  disciplinaryCase: disciplinaryCases.length,
  event: events.length,
  message: messages.length,
};

const pad = (n: number, width = 4): string => String(n).padStart(width, '0');

/** Pushes a notification, reusing the portal's existing notification model. */
const notify = (
  push: (n: { Title: string; Body: string; Audience: string; RefType: string; RefID: string; CreatedAt: string; Read: boolean }) => void,
  entry: { Title: string; Body: string; Audience: string; RefType: string; RefID: string; CreatedAt: string; Read: boolean },
): void => {
  push({ ...entry, Read: false });
};

const matches = (haystack: string, needle: string): boolean =>
  !needle || haystack.toLowerCase().includes(needle.toLowerCase());

/**
 * `cleanItems` from the origin's weekly-report form: trim each row and drop the
 * ones that are empty *and* unticked, so a seeded blank row never round-trips.
 */
const cleanChecklist = (
  rows: WeeklyReport['participationItems'] | undefined,
): WeeklyReport['participationItems'] =>
  (rows ?? [])
    .map((row) => ({ text: text(row?.text).trim(), checked: row?.checked === true }))
    .filter((row) => row.text !== '' || row.checked);

/**
 * Drops all-zero attendance rows, which is what the origin's form does before
 * submitting (`.filter(row => row.present > 0 || row.absent > 0)`).
 */
const cleanAttendance = (
  rows: ClassTeacherReport['attendance'] | undefined,
): ClassTeacherReport['attendance'] =>
  (rows ?? []).filter((row) => num(row?.present) > 0 || num(row?.absent) > 0);

/**
 * The origin only runs `validate()` when saving to `pending`, so a draft may be
 * saved with nothing filled in. Reproduced exactly — including the absence of
 * any regex, length or date-order rule.
 */
const lessonPlanError = (plan: Req): string => {
  if (!trimmed(plan.classId)) return 'Class is required';
  if (!trimmed(plan.subject)) return 'Subject is required';
  if (!trimmed(plan.topic)) return 'Topic is required';
  return '';
};

/** The weekly-report form validates on EVERY save, draft included. */
const weeklyReportError = (report: Req): string => {
  if (!trimmed(report.weekOfReport)) return 'Week of report is required';
  if (!trimmed(report.termSession)) return 'Term & session is required';
  if (!trimmed(report.subject)) return 'Subject is required';
  if (!trimmed(report.classAndArm)) return 'Class / Arm is required';
  return '';
};

/** Inclusive day count, matching the origin's `daysBetween`. */
const inclusiveDays = (start: string, end: string): number => {
  const a = Date.parse(start);
  const b = Date.parse(end);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  if (b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
};

/**
 * A document is owned by the teacher who authored it. Leave requests key on
 * `staffUsername` rather than `teacherUsername`, which is why the read paths
 * filter those rows directly instead of through `ownerOf`.
 */
const ownerOf = (record: { teacherUsername?: string }, username: string): boolean =>
  record.teacherUsername === username;

/** Narrows a loosely-typed form payload to a checklist, for `cleanChecklist`. */
const asChecklist = (v: unknown): WeeklyReport['participationItems'] | undefined =>
  Array.isArray(v) ? (v as WeeklyReport['participationItems']) : undefined;

const comment = (authorName: string, body: string): CaseComment => ({
  id: `C-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  authorName,
  body,
  createdAt: isoNow(),
});

/* ── handler map ────────────────────────────────────────────────────────── */

/**
 * Requests are typed exactly (`ApiMap[A]['req']`), which is where the value of
 * this map is: a handler that reads a field the contract does not declare is a
 * compile error.
 *
 * Responses are typed loosely on purpose. LAEC's envelope makes every write a
 * union of "carries a payload" and "carries only `{status, message}`", and
 * TypeScript widens a bare `{ status: 'error', message }` literal to
 * `{ status: string }` in that position — so a precisely-typed return would
 * demand a cast on every one of the ~40 error branches and hide the real
 * mistake instead. `callApi` already asserts the response to `ApiResponse<A>`
 * at its single entry point, and the payload shapes are pinned by the contract's
 * `Success<{...}>` types on the read side.
 */
export type TeacherHandlers = {
  [A in ActionName]?: (req: ApiMap[A]['req']) => unknown | Promise<unknown>;
};

/**
 * Every teacher-portal action. `pushNotification` is injected rather than
 * imported so this file has no dependency on `mock.ts` — which imports it.
 */
export const teacherHandlers = (
  pushNotification: (entry: {
    Title: string;
    Body: string;
    Audience: string;
    RefType: string;
    RefID: string;
    CreatedAt: string;
    Read: boolean;
  }) => void,
): TeacherHandlers => ({
  /* ── reads ───────────────────────────────────────────────────────────── */

  GET_TEACHER_DASHBOARD: (req) => {
    const u = text(req.teacherUsername);
    const lesson = lessonPlans.filter((p) => ownerOf(p, u));
    const weekly = weeklyReports.filter((r) => ownerOf(r, u));
    const cls = classReports.filter((r) => ownerOf(r, u));
    const leave = leaveRequests.filter((r) => r.staffUsername === u);
    const queries = hrQueries.filter((q) => q.issuerUsername === u);
    const convo = conversations.filter((c) => c.members.includes(u));
    return {
      ...ok('Dashboard retrieved (mock).'),
      counts: {
        lessonPlanDrafts: lesson.filter((p) => p.status === 'draft').length,
        lessonPlanPending: lesson.filter((p) => p.status === 'pending').length,
        weeklyReportDrafts: weekly.filter((r) => r.status === 'draft').length,
        weeklyReportSubmitted: weekly.filter((r) => r.status === 'submitted').length,
        classReportsDraft: cls.filter((r) => r.status === 'draft').length,
        openLeaveRequests: leave.filter((r) => r.status === 'PENDING').length,
        openHrQueries: queries.filter((q) => q.status === 'OPEN' || q.status === 'ASSIGNED').length,
        openCounsellingCases: counsellingCases.filter((c) => c.status !== 'CLOSED' && c.status !== 'RESOLVED')
          .length,
        openDisciplinaryCases: disciplinaryCases.filter(
          (c) => c.status !== 'DISMISSED' && c.status !== 'RESOLVED',
        ).length,
        unreadMessages: convo.reduce((sum, c) => sum + c.unreadCount, 0),
        unreadNotifications: 0,
      },
    };
  },

  GET_LESSON_PLANS: (req) => {
    const all = lessonPlans.filter((p) => ownerOf(p, text(req.teacherUsername)));
    const wanted = text(req.status);
    const rows = all.filter((p) => (!wanted || p.status === wanted) && matches(p.topic, trimmed(req.search)));
    const counts = {
      draft: all.filter((p) => p.status === 'draft').length,
      pending: all.filter((p) => p.status === 'pending').length,
      approved: all.filter((p) => p.status === 'approved').length,
      rejected: all.filter((p) => p.status === 'rejected').length,
    };
    return { ...ok('Lesson plans retrieved (mock).'), plans: rows, counts };
  },

  GET_LESSON_PLAN_QUEUE: (req) => {
    const reviewer = text(req.reviewerUsername);
    const wanted = text(req.status) || 'pending';
    const assignedOnly = req.assignedToMe === true;
    const rows = lessonPlans.filter((p) => {
      // The origin blocks approve/reject on a plan assigned to somebody else,
      // and its Review Inbox lists the same subset.
      if (assignedOnly && p.targetReviewerUsername && p.targetReviewerUsername !== reviewer) return false;
      if (assignedOnly && !wanted) return p.status === 'pending';
      return p.status === wanted;
    });
    return {
      ...ok('Review queue retrieved (mock).'),
      plans: rows.filter((p) => matches(p.topic, trimmed(req.search))),
    };
  },

  GET_WEEKLY_REPORTS: (req) => {
    const wanted = text(req.status);
    const rows = weeklyReports.filter(
      (r) => ownerOf(r, text(req.teacherUsername)) && (!wanted || r.status === wanted),
    );
    return { ...ok('Weekly reports retrieved (mock).'), reports: rows };
  },

  GET_WEEKLY_REPORT_QUEUE: (req) => {
    const wanted = text(req.status);
    const rows = weeklyReports.filter(
      (r) => (wanted ? r.status === wanted : r.status !== 'draft') && matches(r.topicCovered, trimmed(req.search)),
    );
    return { ...ok('Weekly report queue retrieved (mock).'), reports: rows };
  },

  GET_CLASS_TEACHER_REPORTS: (req) => {
    const wanted = text(req.status);
    const rows = classReports.filter(
      (r) => ownerOf(r, text(req.teacherUsername)) && (!wanted || r.status === wanted),
    );
    return { ...ok('Class teacher reports retrieved (mock).'), reports: rows };
  },

  GET_MY_CLASS_TEACHING: () => ({
    ...ok('Classes retrieved (mock).'),
    classes: MY_CLASSES.map((c) => ({ ...c })),
  }),

  GET_ATTENDANCE_PREVIEW: (req) => {
    const from = trimmed(req.from);
    const to = trimmed(req.to);
    if (!from || !to) {
      return { status: 'error', message: 'Select the week ending before loading attendance.' };
    }
    const rows = classReports.filter(
      (r) => r.className === trimmed(req.className) && r.weekEndingStart === from && r.weekEndingEnd === to,
    );
    const attendance = rows[0]?.attendance ?? [];
    const total = (key: 'present' | 'absent') => attendance.reduce((sum, row) => sum + num(row[key]), 0);
    const absentNames = attendance
      .filter((row) => num(row.absent) > 0)
      .map((row) => `${row.day}: ${num(row.absent)} absent`)
      .join('; ');
    return {
      ...ok('Attendance retrieved (mock).'),
      preview: {
        className: trimmed(req.className),
        present: total('present'),
        absent: total('absent'),
        absentees: {
          monday: rows[0]?.absenteesMonday ?? absentNames,
          tuesdayFriday: rows[0]?.absenteesWeek ?? absentNames,
        },
      },
    };
  },

  GET_CLASS_TEACHER_SUPERIORS: () => ({
    ...ok('Superiors retrieved (mock).'),
    superiors: SUPERIORS.map((s) => ({ ...s })),
  }),

  GET_LEAVE_REQUESTS: (req) => {
    const wanted = text(req.status);
    const rows = leaveRequests.filter((r) => {
      if (wanted && r.status !== wanted) return false;
      return (
        r.staffUsername === text(req.teacherUsername) &&
        (matches(r.staffName, trimmed(req.search)) || matches(r.reason, trimmed(req.search)))
      );
    });
    return { ...ok('Leave requests retrieved (mock).'), requests: rows };
  },

  GET_HR_QUERIES: (req) => {
    const wanted = text(req.status);
    const rows = hrQueries.filter((q) => {
      if (wanted && q.status !== wanted) return false;
      if (q.issuerUsername !== text(req.teacherUsername)) return false;
      const hay = `${q.title} ${q.category} ${q.targetUserName}`;
      return matches(hay, trimmed(req.search));
    });
    return { ...ok('HR queries retrieved (mock).'), queries: rows };
  },

  GET_COUNSELLING_COMMITTEES: () => ({
    ...ok('Committees retrieved (mock).'),
    committees: counsellingCommittees.map((c) => ({ ...c, members: c.members.map((m) => ({ ...m })) })),
  }),

  GET_COUNSELLING_CASES: (req) => {
    const wanted = text(req.status);
    const rows = counsellingCases.filter((c) => {
      if (wanted && c.status !== wanted) return false;
      if (trimmed(req.sessionId) && c.academicSessionId !== trimmed(req.sessionId)) return false;
      return matches(`${c.caseNumber} ${c.studentName}`, trimmed(req.search));
    });
    return { ...ok('Cases retrieved (mock).'), cases: rows };
  },

  GET_COUNSELLING_REPORTS: (req) => {
    const wanted = text(req.status);
    const rows = counsellingReports.filter(
      (r) => (!wanted || r.status === wanted) && matches(`${r.title} ${r.caseNumber}`, trimmed(req.search)),
    );
    return { ...ok('Reports retrieved (mock).'), reports: rows };
  },

  GET_DISCIPLINARY_INCIDENT_TYPES: () => ({
    ...ok('Case types retrieved (mock).'),
    incidentTypes: incidentTypes.map((i) => ({ ...i })),
  }),

  GET_DISCIPLINARY_COMMITTEES: () => ({
    ...ok('Committees retrieved (mock).'),
    committees: disciplinaryCommittees.map((c) => ({ ...c, members: c.members.map((m) => ({ ...m })) })),
  }),

  GET_DISCIPLINARY_CASES: (req) => {
    const wanted = text(req.status);
    const rows = disciplinaryCases.filter((c) => {
      if (wanted && c.status !== wanted) return false;
      if (trimmed(req.caseTypeId) && c.caseTypeId !== trimmed(req.caseTypeId)) return false;
      if (trimmed(req.sessionId) && c.academicSessionId !== trimmed(req.sessionId)) return false;
      return matches(`${c.caseNumber} ${c.studentName} ${c.caseTypeTitle}`, trimmed(req.search));
    });
    return { ...ok('Cases retrieved (mock).'), cases: rows };
  },

  GET_TEACHER_DIRECTORY: (req) => {
    const requester = text(req.requesterUsername);
    const needle = trimmed(req.search);
    const staff = DIRECTORY.filter(
      // The origin's endpoint filters `status === 'active'` and excludes self.
      (entry) => entry.status === 'active' && entry.username !== requester,
    )
      .filter((entry) => matches(`${entry.fullName} ${entry.email}`, needle))
      .slice(0, 20);
    return {
      ...ok('Directory retrieved (mock).'),
      staff,
      classes: MY_CLASSES.map((c) => ({ ...c })),
      sessions: SESSIONS.map((s) => ({ ...s })),
    };
  },

  GET_TEACHER_CONVERSATIONS: (req) => {
    const u = text(req.teacherUsername);
    return {
      ...ok('Conversations retrieved (mock).'),
      conversations: conversations.filter((c) => c.members.includes(u)).map((c) => ({ ...c })),
    };
  },

  GET_TEACHER_MESSAGES: (req) => {
    const id = text(req.conversationId);
    return {
      ...ok('Messages retrieved (mock).'),
      messages: messages
        .filter((m) => m.conversationId === id)
        .map((m) => ({ ...m }))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    };
  },

  GET_SCHOOL_EVENTS: () => ({
    ...ok('Events retrieved (mock).'),
    events: events.map((e) => ({ ...e })),
  }),

  GET_MY_PROFILE: (req) => {
    const username = text(req.username);
    const entry = DIRECTORY.find((d) => d.username === username);
    const resolved: TeacherProfile = {
      ...profile,
      firstName: entry ? entry.fullName.split(' ')[0] : profile.firstName,
      lastName: entry ? entry.fullName.split(' ').slice(1).join(' ') : profile.lastName,
      email: entry ? entry.email : profile.email,
    };
    return { ...ok('Profile retrieved (mock).'), profile: resolved };
  },

  /* ── lesson planning writes ──────────────────────────────────────────── */

  SAVE_LESSON_PLAN: (req) => {
    const status = req.status === 'pending' ? 'pending' : 'draft';
    const incoming = (req.plan ?? {}) as Req;
    if (status === 'pending') {
      const invalid = lessonPlanError(incoming);
      if (invalid) return { status: 'error', message: invalid };
    }
    const existing = text(req.planId)
      ? lessonPlans.find((p) => p.id === text(req.planId))
      : undefined;

    if (existing) {
      // Ownership gate: the origin compares `lesson.teacherId` to the session.
      if (!ownerOf(existing, text(req.teacherUsername))) {
        return { status: 'error', message: 'Only the author can edit this lesson plan.' };
      }
      // The author is immutable: an edit cannot transfer a plan to another
      // teacher, so the stored value is re-asserted after the merge.
      Object.assign(existing, incoming, { status, teacherUsername: existing.teacherUsername });
      return { ...ok('Lesson plan saved (mock).'), plan: existing };
    }

    counters.lessonPlan += 1;
    const created = blankLesson({ ...(incoming as Partial<LessonPlan>), id: `LP-${pad(counters.lessonPlan)}`, status });
    lessonPlans.unshift(created);
    return { ...ok('Lesson plan created (mock).'), plan: created };
  },

  DELETE_LESSON_PLAN: (req) => {
    const index = lessonPlans.findIndex((p) => p.id === text(req.planId));
    if (index < 0) return { status: 'error', message: 'Lesson plan not found.' };
    const [removed] = lessonPlans.splice(index, 1);
    return ok(`"${removed.topic}" will be permanently deleted (mock).`);
  },

  SUBMIT_LESSON_PLAN: (req) => {
    const plan = lessonPlans.find((p) => p.id === text(req.planId));
    if (!plan) return { status: 'error', message: 'Lesson plan not found.' };
    if (plan.status !== 'draft' && plan.status !== 'rejected') {
      return { status: 'error', message: `This lesson plan is already ${plan.status}.` };
    }
    const invalid = lessonPlanError(plan as unknown as Req);
    if (invalid) return { status: 'error', message: invalid };
    plan.status = 'pending';
    plan.targetReviewerUsername = trimmed(req.reviewerUsername) || null;
    const reviewer = trimmed(req.reviewerUsername);
    notify(pushNotification, {
      Title: 'Lesson plan submitted',
      Body: `${plan.teacherName} submitted "${plan.topic}" for review.`,
      Audience: reviewer || 'TEACHER',
      RefType: 'LESSON_PLAN',
      RefID: plan.id,
      CreatedAt: isoNow(),
      Read: false,
    });
    return {
      ...ok('Submitted for review (mock).'),
      plan,
      message: reviewer
        ? `This lesson plan will be sent to ${reviewer} for review.`
        : 'Select a reviewer, or submit without selecting to let any authorized reviewer pick it up.',
    };
  },

  REVIEW_LESSON_PLAN: (req) => {
    const plan = lessonPlans.find((p) => p.id === text(req.planId));
    if (!plan) return { status: 'error', message: 'Lesson plan not found.' };
    if (plan.status !== 'pending') {
      return { status: 'error', message: 'Only a pending lesson plan can be approved or rejected.' };
    }
    const decision = req.decision === 'approved' ? 'approved' : 'rejected';
    plan.status = decision;
    plan.rejectionReason = decision === 'rejected' ? trimmed(req.remark) : '';
    plan.signature = trimmed(req.signature);
    plan.signatureStyle = (text(req.signatureStyle) || 'vibes') as LessonPlan['signatureStyle'];
    plan.reviewedBy = TEACHER_USERNAME;
    plan.reviewedAt = isoNow();
    notify(pushNotification, {
      Title: `Lesson plan ${decision}`,
      Body:
        decision === 'approved'
          ? `"${plan.topic}" was approved.`
          : `"${plan.topic}" was rejected. The teacher has been notified.`,
      Audience: 'TEACHER',
      RefType: 'LESSON_PLAN',
      RefID: plan.id,
      CreatedAt: isoNow(),
      Read: false,
    });
    return {
      ...ok(decision === 'approved' ? 'Lesson plan approved successfully.' : 'Lesson plan rejected.'),
      plan,
    };
  },

  /* ── weekly report writes ────────────────────────────────────────────── */

  SAVE_WEEKLY_REPORT: (req) => {
    const status = req.status === 'submitted' ? 'submitted' : 'draft';
    const incoming = (req.report ?? {}) as Req;
    // The origin validates on every save, draft included.
    const invalid = weeklyReportError(incoming);
    if (invalid) return { status: 'error', message: invalid };

    const existing = text(req.reportId)
      ? weeklyReports.find((r) => r.id === text(req.reportId))
      : undefined;

    if (existing) {
      Object.assign(existing, incoming, {
        status,
        participationItems: cleanChecklist(asChecklist(incoming.participationItems)),
        classroomItems: cleanChecklist(asChecklist(incoming.classroomItems)),
        assignmentItems: cleanChecklist(asChecklist(incoming.assignmentItems)),
        challengeItems: cleanChecklist(asChecklist(incoming.challengeItems)),
        recommendationItems: cleanChecklist(asChecklist(incoming.recommendationItems)),
      });
      return { ...ok('Weekly report saved (mock).'), report: existing };
    }

    counters.weeklyReport += 1;
    const created: WeeklyReport = {
      ...blankWeekly(incoming as Partial<WeeklyReport>),
      id: `WR-${pad(counters.weeklyReport)}`,
      status,
      participationItems: cleanChecklist(asChecklist(incoming.participationItems)),
      classroomItems: cleanChecklist(asChecklist(incoming.classroomItems)),
      assignmentItems: cleanChecklist(asChecklist(incoming.assignmentItems)),
      challengeItems: cleanChecklist(asChecklist(incoming.challengeItems)),
      recommendationItems: cleanChecklist(asChecklist(incoming.recommendationItems)),
    };
    weeklyReports.unshift(created);
    return { ...ok('Weekly report created (mock).'), report: created };
  },

  DELETE_WEEKLY_REPORT: (req) => {
    const index = weeklyReports.findIndex((r) => r.id === text(req.reportId));
    if (index < 0) return { status: 'error', message: 'Weekly report not found.' };
    const [removed] = weeklyReports.splice(index, 1);
    if (removed.status !== 'draft') {
      weeklyReports.splice(index, 0, removed);
      return { status: 'error', message: 'Only a draft weekly report can be deleted.' };
    }
    return ok('Weekly report deleted successfully');
  },

  SUBMIT_WEEKLY_REPORT: (req) => {
    const report = weeklyReports.find((r) => r.id === text(req.reportId));
    if (!report) return { status: 'error', message: 'Weekly report not found.' };
    // The origin's mock refuses to re-submit a finalised report, with this text.
    if (report.status === 'reviewed') {
      return { status: 'success', report, message: 'This weekly report is already reviewed' };
    }
    if (report.status === 'submitted') {
      return { status: 'error', message: 'This weekly report is already submitted' };
    }
    report.status = 'submitted';
    notify(pushNotification, {
      Title: 'Weekly report submitted',
      Body: `${report.teacherName} submitted a weekly report for ${report.classAndArm}.`,
      Audience: trimmed(req.reviewerUsername) || 'TEACHER',
      RefType: 'WEEKLY_REPORT',
      RefID: report.id,
      CreatedAt: isoNow(),
      Read: false,
    });
    return {
      ...ok('Submitted for review (mock).'),
      report,
      message: trimmed(req.reviewerUsername)
        ? `This report will be sent to ${trimmed(req.reviewerUsername)} for review.`
        : 'Select a reviewer, or submit without selecting to let any authorized reviewer pick it up.',
    };
  },

  REVIEW_WEEKLY_REPORT: (req) => {
    const report = weeklyReports.find((r) => r.id === text(req.reportId));
    if (!report) return { status: 'error', message: 'Weekly report not found.' };
    if (report.status !== 'submitted') {
      return { status: 'error', message: 'Only a submitted weekly report can be reviewed.' };
    }
    // The origin's review form requires a comment, unlike a lesson-plan rejection.
    const commentText = trimmed(req.comment);
    if (!commentText) {
      return { status: 'error', message: 'Please enter a comment before submitting your review.' };
    }
    const level = req.level === 'head' ? 'head' : 'hod';
    report.signature = trimmed(req.signature);
    report.signatureStyle = (text(req.signatureStyle) || 'vibes') as WeeklyReport['signatureStyle'];
    if (level === 'hod') {
      // A H.O.D comment is recorded without finalising the report.
      report.hodComment = commentText;
      report.hodReviewedBy = TEACHER_USERNAME;
      report.hodReviewedAt = isoNow();
    } else {
      report.headComment = commentText;
      report.headReviewedBy = TEACHER_USERNAME;
      report.headReviewedAt = isoNow();
      report.status = 'reviewed';
    }
    return { ...ok('Review recorded (mock).'), report };
  },

  /* ── class-teacher report writes ─────────────────────────────────────── */

  SAVE_CLASS_TEACHER_REPORT: (req) => {
    // The origin's form has NO validate() at all, so nothing is checked here.
    const status = req.status === 'submitted' ? 'submitted' : 'draft';
    const incoming = (req.report ?? {}) as Req;
    const existing = text(req.reportId)
      ? classReports.find((r) => r.id === text(req.reportId))
      : undefined;

    if (existing) {
      Object.assign(existing, incoming, {
        status,
        // Blank strings are sent as undefined by the origin and dropped.
        callsFromParents: trimmed(incoming.callsFromParents) || undefined,
        attendance: cleanAttendance(incoming.attendance as ClassTeacherReport['attendance']),
      });
      return { ...ok('Class teacher report saved (mock).'), report: existing };
    }

    counters.classReport += 1;
    const created = blankClassReport({
      ...(incoming as Partial<ClassTeacherReport>),
      id: `CR-${pad(counters.classReport)}`,
      status,
      attendance: cleanAttendance(incoming.attendance as ClassTeacherReport['attendance']),
    });
    classReports.unshift(created);
    return { ...ok('Class teacher report created (mock).'), report: created };
  },

  DELETE_CLASS_TEACHER_REPORT: (req) => {
    const index = classReports.findIndex((r) => r.id === text(req.reportId));
    if (index < 0) return { status: 'error', message: 'Class teacher report not found.' };
    const [removed] = classReports.splice(index, 1);
    return ok(`"${removed.week}" report deleted (mock).`);
  },

  SHARE_CLASS_TEACHER_REPORT: (req) => {
    const report = classReports.find((r) => r.id === text(req.reportId));
    if (!report) return { status: 'error', message: 'Class teacher report not found.' };
    const username = trimmed(req.username);
    notify(pushNotification, {
      Title: 'Weekly report shared',
      Body: `${TEACHER_NAME} shared the ${report.week} class report with you.`,
      Audience: username,
      RefType: 'CLASS_TEACHER_REPORT',
      RefID: report.id,
      CreatedAt: isoNow(),
      Read: false,
    });
    return { ...ok('Report shared (mock).'), shared: true };
  },

  /* ── leave ───────────────────────────────────────────────────────────── */

  APPLY_FOR_LEAVE: (req) => {
    if (!trimmed(req.staffUsername)) return { status: 'error', message: 'Select the staff member' };
    if (!trimmed(req.leaveType)) return { status: 'error', message: 'Enter a leave type' };
    if (!trimmed(req.startDate) || !trimmed(req.endDate)) {
      return { status: 'error', message: 'Select the leave dates' };
    }
    const days = inclusiveDays(trimmed(req.startDate), trimmed(req.endDate));
    if (days <= 0) return { status: 'error', message: 'End date must be after the start date' };
    if (!trimmed(req.reason)) return { status: 'error', message: 'Provide a reason for the leave' };

    counters.leave += 1;
    const request: LeaveRequest = {
      id: `LV-${pad(counters.leave)}`,
      staffUsername: text(req.staffUsername),
      staffName: text(req.staffName),
      department: text(req.department),
      leaveType: trimmed(req.leaveType),
      startDate: trimmed(req.startDate),
      endDate: trimmed(req.endDate),
      days,
      reason: trimmed(req.reason),
      status: 'PENDING',
      submittedAt: isoNow(),
      decidedAt: '',
      decidedBy: '',
      decisionComment: '',
    };
    leaveRequests.unshift(request);
    notify(pushNotification, {
      Title: 'Leave request submitted',
      Body: `${request.staffName} requested ${request.days} day(s) of ${request.leaveType}.`,
      Audience: 'TEACHER',
      RefType: 'LEAVE',
      RefID: request.id,
      CreatedAt: isoNow(),
      Read: false,
    });
    return { ...ok('Leave request submitted (mock).'), request };
  },

  DECIDE_LEAVE: (req) => {
    const request = leaveRequests.find((r) => r.id === text(req.requestId));
    if (!request) return { status: 'error', message: 'Leave request not found.' };
    if (request.status !== 'PENDING') {
      return { status: 'error', message: `This leave request is already ${request.status}.` };
    }
    const decision = req.decision === 'REJECTED' ? 'REJECTED' : 'APPROVED';
    request.status = decision;
    request.decidedAt = isoNow();
    request.decidedBy = TEACHER_USERNAME;
    request.decisionComment = trimmed(req.comment);
    notify(pushNotification, {
      Title: `Leave ${decision.toLowerCase()}`,
      Body: `Your ${request.leaveType} request was ${decision.toLowerCase()}.`,
      Audience: request.staffUsername,
      RefType: 'LEAVE',
      RefID: request.id,
      CreatedAt: isoNow(),
      Read: false,
    });
    return { ...ok(`Leave request ${decision.toLowerCase()} (mock).`), request };
  },

  DELETE_LEAVE_REQUEST: (req) => {
    const index = leaveRequests.findIndex((r) => r.id === text(req.requestId));
    if (index < 0) return { status: 'error', message: 'Leave request not found.' };
    const [removed] = leaveRequests.splice(index, 1);
    return ok(`Leave request ${removed.id} removed (mock).`);
  },

  /* ── HR queries ──────────────────────────────────────────────────────── */

  RAISE_HR_QUERY: (req) => {
    if (!trimmed(req.targetUsername)) return { status: 'error', message: 'Select the recipient' };
    if (!trimmed(req.title)) return { status: 'error', message: 'Title is required' };
    if (!trimmed(req.description)) return { status: 'error', message: 'Describe your query' };

    counters.hrQuery += 1;
    const query: HrQuery = {
      id: `HQ-${pad(counters.hrQuery)}`,
      title: trimmed(req.title),
      description: trimmed(req.description),
      issuerName: text(req.issuerName),
      issuerUsername: text(req.issuerUsername),
      targetUsername: text(req.targetUsername),
      targetUserName: text(req.targetUserName),
      // The form labels this field "Offence" and the options' `name` is the value.
      category: trimmed(req.category) || 'General',
      priority: (text(req.priority) || 'medium') as HrQuery['priority'],
      status: 'OPEN',
      response: '',
      createdAt: isoNow(),
    };
    hrQueries.unshift(query);
    return { ...ok('Query submitted (mock).'), query };
  },

  UPDATE_HR_QUERY: (req) => {
    const query = hrQueries.find((q) => q.id === text(req.queryId));
    if (!query) return { status: 'error', message: 'Query not found.' };
    const status = trimmed(req.status);
    if (status) query.status = status as HrQuery['status'];
    if (trimmed(req.assigneeUsername)) query.targetUsername = trimmed(req.assigneeUsername);
    if (text(req.response)) query.response = text(req.response);
    return { ...ok('Query updated (mock).'), query };
  },

  /* ── counselling ─────────────────────────────────────────────────────── */

  SAVE_COUNSELLING_COMMITTEE: (req) => {
    const incoming = (req.committee ?? {}) as Partial<CounsellingCommittee>;
    if (!trimmed(incoming.name)) return { status: 'error', message: 'Enter a committee name' };
    const existing = text(req.committeeId)
      ? counsellingCommittees.find((c) => c.id === text(req.committeeId))
      : undefined;
    if (existing) {
      Object.assign(existing, incoming);
      return { ...ok('Committee saved (mock).'), committee: existing };
    }
    counters.counsellingCommittee += 1;
    const created: CounsellingCommittee = {
      id: `CC-${pad(counsellingCommittees.length + counters.counsellingCommittee - 1)}`,
      name: trimmed(incoming.name),
      description: text(incoming.description),
      isActive: incoming.isActive !== false,
      members: incoming.members ?? [],
    };
    counsellingCommittees.push(created);
    return { ...ok('Committee created (mock).'), committee: created };
  },

  DELETE_COUNSELLING_COMMITTEE: (req) => {
    const index = counsellingCommittees.findIndex((c) => c.id === text(req.committeeId));
    if (index < 0) return { status: 'error', message: 'Committee not found.' };
    const [removed] = counsellingCommittees.splice(index, 1);
    // The origin soft-deletes committees (`isActive: false`).
    removed.isActive = false;
    counsellingCommittees.push(removed);
    return ok(`"${removed.name}" removed (mock).`);
  },

  LAUNCH_COUNSELLING_CASE: (req) => {
    // The origin's book-session form silently returns when either field is
    // missing, so nothing is validated and no message is shown.
    if (!trimmed(req.studentName) || !trimmed(req.reasonForReferral)) {
      return { status: 'error', message: 'A student and a reason for referral are required.' };
    }
    counters.counsellingCase += 1;
    const caseNumber = `CNS-${pad(counters.counsellingCase, 3)}`;
    const committee = counsellingCommittees.find((c) => c.id === trimmed(req.committeeId));
    const created: CounsellingCase = {
      id: `CNS-${Date.now()}`,
      caseNumber,
      studentName: text(req.studentName),
      studentUsername: text(req.studentUsername),
      referredByName: text(req.referredByName) || TEACHER_NAME,
      referralDate: trimmed(req.referralDate) || today(),
      priority: (text(req.priority) || 'NORMAL') as CounsellingCase['priority'],
      status: (text(req.status) || 'OPEN') as CounsellingCase['status'],
      committeeId: committee?.id ?? counsellingCommittees[0]?.id ?? '',
      committeeName: committee?.name ?? '',
      academicSessionId: text(req.sessionId),
      backgroundInfo: text(req.backgroundInfo),
      reasonForReferral: text(req.reasonForReferral),
      initialComment: text(req.initialComment),
      comments: [],
    };
    counsellingCases.unshift(created);
    return { ...ok('Counselling session booked (mock).'), counsellingCase: created };
  },

  UPDATE_COUNSELLING_CASE_STATUS: (req) => {
    const found = counsellingCases.find((c) => c.id === text(req.caseId));
    if (!found) return { status: 'error', message: 'Case not found.' };
    found.status = text(req.status) as CounsellingCase['status'];
    return { ...ok('Case status updated (mock).'), counsellingCase: found };
  },

  ADD_COUNSELLING_CASE_COMMENT: (req) => {
    const found = counsellingCases.find((c) => c.id === text(req.caseId));
    if (!found) return { status: 'error', message: 'Case not found.' };
    const body = trimmed(req.comment);
    if (!body) return { status: 'error', message: 'Enter a comment.' };
    found.comments.push(comment(TEACHER_NAME, body));
    return { ...ok('Comment added (mock).'), counsellingCase: found };
  },

  SAVE_COUNSELLING_REPORT: (req) => {
    const incoming = (req.report ?? {}) as Partial<CounsellingReport>;
    if (!trimmed(incoming.title)) return { status: 'error', message: 'Title is required' };
    if (!trimmed(incoming.caseId)) return { status: 'error', message: 'Select a case' };
    const existing = text(req.reportId)
      ? counsellingReports.find((r) => r.id === text(req.reportId))
      : undefined;
    if (existing) {
      Object.assign(existing, incoming);
      return { ...ok('Report saved (mock).'), report: existing };
    }
    counters.counsellingReport += 1;
    const linked = counsellingCases.find((c) => c.id === trimmed(incoming.caseId));
    const created: CounsellingReport = {
      id: `CRP-${pad(counsellingReports.length + counters.counsellingReport - 1)}`,
      caseId: linked?.id ?? '',
      caseNumber: linked?.caseNumber ?? '',
      title: trimmed(incoming.title),
      status: (text(incoming.status) || 'DRAFT') as CounsellingReport['status'],
      summary: text(incoming.summary),
      findings: text(incoming.findings),
      recommendations: text(incoming.recommendations),
      actionPlan: text(incoming.actionPlan),
      authorUsername: TEACHER_USERNAME,
      createdAt: isoNow(),
    };
    counsellingReports.unshift(created);
    return { ...ok('Report created (mock).'), report: created };
  },

  SHARE_COUNSELLING_REPORT: (req) => {
    const report = counsellingReports.find((r) => r.id === text(req.reportId));
    if (!report) return { status: 'error', message: 'Report not found.' };
    notify(pushNotification, {
      Title: 'Counselling report shared',
      Body: `${TEACHER_NAME} shared "${report.title}" with you.`,
      Audience: trimmed(req.username),
      RefType: 'COUNSELLING_REPORT',
      RefID: report.id,
      CreatedAt: isoNow(),
      Read: false,
    });
    return { ...ok('Report shared (mock).'), shared: true };
  },

  /* ── disciplinary ────────────────────────────────────────────────────── */

  SAVE_DISCIPLINARY_INCIDENT_TYPE: (req) => {
    const title = trimmed(req.title);
    if (!title) return { status: 'error', message: 'Enter a title' };
    const existing = text(req.incidentTypeId)
      ? incidentTypes.find((i) => i.id === text(req.incidentTypeId))
      : undefined;
    if (existing) {
      existing.title = title;
      existing.description = trimmed(req.description);
      return { ...ok('Case type saved (mock).'), incidentType: existing };
    }
    counters.incidentType += 1;
    const created: DisciplinaryIncidentType = {
      id: `DIT-${pad(incidentTypes.length + counters.incidentType - 1)}`,
      title,
      description: trimmed(req.description),
      isActive: true,
    };
    incidentTypes.push(created);
    return { ...ok('Case type created (mock).'), incidentType: created };
  },

  DELETE_DISCIPLINARY_INCIDENT_TYPE: (req) => {
    const found = incidentTypes.find((i) => i.id === text(req.incidentTypeId));
    if (!found) return { status: 'error', message: 'Case type not found.' };
    // Soft delete, matching the origin (`isActive = false`, `{data:null}`).
    found.isActive = false;
    return ok('Deleted successfully.');
  },

  /**
   * Remove a case outright.
   *
   * A hard delete, not a soft one, and deliberately unlike
   * `DELETE_DISCIPLINARY_INCIDENT_TYPE` above: that one deactivates because the
   * origin does (`isActive = false`), and a deactivated incident type is still
   * referenced by every case raised under it. A case has no such reference, and
   * the deployed `deleteCase` removes the record — so this removes it, with the
   * case's own comments going with it.
   */
  DELETE_DISCIPLINARY_CASE: (req) => {
    const index = disciplinaryCases.findIndex((c) => c.id === text(req.caseId));
    if (index === -1) return { status: 'error', message: 'Case not found.' };
    disciplinaryCases.splice(index, 1);
    return ok('Case deleted.');
  },

  DELETE_COUNSELLING_CASE: (req) => {
    const index = counsellingCases.findIndex((c) => c.id === text(req.caseId));
    if (index === -1) return { status: 'error', message: 'Case not found.' };
    counsellingCases.splice(index, 1);
    /* A report belongs to exactly one case, so removing the case has to take its
       reports with it. Leaving them would leave reports pointing at a case that
       no longer exists. */
    for (let i = counsellingReports.length - 1; i >= 0; i -= 1) {
      if (counsellingReports[i].caseId === text(req.caseId)) counsellingReports.splice(i, 1);
    }
    return ok('Case deleted.');
  },

  SAVE_DISCIPLINARY_COMMITTEE: (req) => {
    const incoming = (req.committee ?? {}) as Partial<DisciplinaryCommittee>;
    if (!trimmed(incoming.name)) return { status: 'error', message: 'Enter a committee name' };
    const existing = text(req.committeeId)
      ? disciplinaryCommittees.find((c) => c.id === text(req.committeeId))
      : undefined;
    if (existing) {
      Object.assign(existing, incoming);
      return { ...ok('Committee saved (mock).'), committee: existing };
    }
    counters.disciplinaryCommittee += 1;
    const created: DisciplinaryCommittee = {
      id: `DC-${pad(disciplinaryCommittees.length + counters.disciplinaryCommittee - 1)}`,
      name: trimmed(incoming.name),
      description: text(incoming.description),
      isActive: incoming.isActive !== false,
      members: incoming.members ?? [],
    };
    disciplinaryCommittees.push(created);
    return { ...ok('Committee created (mock).'), committee: created };
  },

  DELETE_DISCIPLINARY_COMMITTEE: (req) => {
    const found = disciplinaryCommittees.find((c) => c.id === text(req.committeeId));
    if (!found) return { status: 'error', message: 'Committee not found.' };
    found.isActive = false;
    return ok('Deleted successfully.');
  },

  LAUNCH_DISCIPLINARY_CASE: (req) => {
    if (!trimmed(req.studentName) || !trimmed(req.caseTypeId)) {
      return { status: 'error', message: 'Select a student and a case type' };
    }
    counters.disciplinaryCase += 1;
    const type = incidentTypes.find((i) => i.id === trimmed(req.caseTypeId));
    const committee = disciplinaryCommittees.find((c) => c.id === trimmed(req.committeeId));
    const created: DisciplinaryCase = {
      id: `DCASE-${Date.now()}`,
      caseNumber: `DISC-${pad(counters.disciplinaryCase, 3)}`,
      studentName: text(req.studentName),
      studentUsername: text(req.studentUsername),
      caseTypeId: trimmed(req.caseTypeId),
      caseTypeTitle: type?.title ?? '',
      incidentDate: trimmed(req.incidentDate) || today(),
      location: text(req.location),
      severity: (text(req.severity) || 'MODERATE') as DisciplinaryCase['severity'],
      status: 'OPEN',
      committeeId: committee?.id ?? disciplinaryCommittees[0]?.id ?? '',
      committeeName: committee?.name ?? '',
      academicSessionId: text(req.sessionId),
      description: text(req.description),
      initialComment: text(req.initialComment),
      comments: [],
    };
    disciplinaryCases.unshift(created);
    notify(pushNotification, {
      Title: 'Disciplinary case launched',
      Body: `Case ${created.caseNumber} for ${created.studentName}. The disciplinary committee has been notified.`,
      Audience: 'TEACHER',
      RefType: 'DISCIPLINARY_CASE',
      RefID: created.id,
      CreatedAt: isoNow(),
      Read: false,
    });
    return { ...ok('Case launched (mock).'), disciplinaryCase: created };
  },

  UPDATE_DISCIPLINARY_CASE_STATUS: (req) => {
    const found = disciplinaryCases.find((c) => c.id === text(req.caseId));
    if (!found) return { status: 'error', message: 'Case not found.' };
    found.status = text(req.status) as DisciplinaryCase['status'];
    return { ...ok('Case status updated (mock).'), disciplinaryCase: found };
  },

  ADD_DISCIPLINARY_CASE_COMMENT: (req) => {
    const found = disciplinaryCases.find((c) => c.id === text(req.caseId));
    if (!found) return { status: 'error', message: 'Case not found.' };
    const body = trimmed(req.comment);
    if (!body) return { status: 'error', message: 'Enter a comment.' };
    found.comments.push(comment(TEACHER_NAME, body));
    return { ...ok('Comment added (mock).'), disciplinaryCase: found };
  },

  SHARE_DISCIPLINARY_CASE: (req) => {
    const found = disciplinaryCases.find((c) => c.id === text(req.caseId));
    if (!found) return { status: 'error', message: 'Case not found.' };
    notify(pushNotification, {
      Title: 'Disciplinary case shared',
      Body: `Case ${found.caseNumber} was shared with you.`,
      Audience: trimmed(req.username),
      RefType: 'DISCIPLINARY_CASE',
      RefID: found.id,
      CreatedAt: isoNow(),
      Read: false,
    });
    return { ...ok('Case shared (mock).'), shared: true };
  },

  /* ── messaging ───────────────────────────────────────────────────────── */

  SEND_TEACHER_MESSAGE: (req) => {
    const body = trimmed(req.body);
    if (!body) return { status: 'error', message: 'Enter a message' };
    const conversation = conversations.find((c) => c.id === trimmed(req.conversationId));
    if (!conversation) return { status: 'error', message: 'Conversation not found.' };
    counters.message += 1;
    const created: ChatMessage = {
      id: `MSG-${pad(counters.message)}`,
      conversationId: conversation.id,
      senderUsername: text(req.senderUsername),
      senderName: TEACHER_NAME,
      body,
      type: 'text',
      createdAt: isoNow(),
    };
    messages.push(created);
    conversation.lastMessagePreview = body;
    conversation.lastMessageAt = created.createdAt;
    return { ...ok('Message sent (mock).'), message: created };
  },

  CREATE_TEACHER_CONVERSATION: (req) => {
    const username = trimmed(req.username);
    const other = DIRECTORY.find((d) => d.username === username);
    if (!other) return { status: 'error', message: 'No users found.' };
    const existing = conversations.find(
      (c) => c.kind === 'direct' && c.members.includes(other.username),
    );
    if (existing) return { ...ok('Conversation opened (mock).'), conversation: existing };
    counters.message += 0;
    const conversation: Conversation = {
      id: `CV-${pad(conversations.length + 1)}`,
      kind: 'direct',
      name: other.fullName,
      members: [text(req.requesterUsername), other.username],
      lastMessagePreview: '',
      lastMessageAt: isoNow(),
      unreadCount: 0,
    };
    conversations.unshift(conversation);
    return { ...ok('Conversation created (mock).'), conversation };
  },

  MARK_TEACHER_CONVERSATION_READ: (req) => {
    const conversation = conversations.find((c) => c.id === trimmed(req.conversationId));
    if (conversation) conversation.unreadCount = 0;
    return ok('Marked as read (mock).');
  },

  /* ── profile and events ──────────────────────────────────────────────── */

  UPDATE_TEACHER_PROFILE: (req) => {
    const incoming = (req.profile ?? {}) as Partial<TeacherProfile>;
    if (!trimmed(incoming.firstName)) return { status: 'error', message: 'First name is required' };
    if (!trimmed(incoming.lastName)) return { status: 'error', message: 'Last name is required' };
    if (!trimmed(incoming.email)) return { status: 'error', message: 'Email is required' };
    Object.assign(profile, incoming);
    return { ...ok('Profile updated (mock).'), profile };
  },

  PUBLISH_SCHOOL_EVENT: (req) => {
    if (!trimmed(req.title)) return { status: 'error', message: 'Title is required' };
    if (!trimmed(req.startsAt)) return { status: 'error', message: 'Start date is required' };
    counters.event += 1;
    const created: SchoolEvent = {
      id: `EV-${pad(counters.event)}`,
      title: trimmed(req.title),
      description: text(req.description),
      location: text(req.location),
      startsAt: text(req.startsAt),
      endsAt: text(req.endsAt) || text(req.startsAt),
      category: (text(req.category) || 'event') as SchoolEvent['category'],
      allDay: req.allDay === true,
      createdBy: TEACHER_USERNAME,
    };
    events.push(created);
    return { ...ok('Event published (mock).'), event: created };
  },
});