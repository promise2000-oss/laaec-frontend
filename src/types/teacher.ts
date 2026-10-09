/**
 * St Finbarr's teacher portal — domain types.
 *
 * Transcribed from the deployed portal's own source
 * (`Documents/saintfinbarrs-frontend`, Next.js: `lib/api/types.ts` and the
 * `src/components/teacher/**` forms). Field names, status strings and enum
 * members are reproduced verbatim, including the inconsistencies the origin
 * carries — see `LeaveRequest.status` and the note on `TeacherNotice` below.
 *
 * Kept apart from `src/types/index.ts` because that file is LAEC's CBT domain
 * (exams, question papers, results) and this is the school-management domain.
 * The two coexist: LAEC's `QuestionSubmission` and this file's `LessonPlan` are
 * both author-and-submit lifecycles and are deliberately NOT merged.
 */

/* ── shared ─────────────────────────────────────────────────────────────── */

/**
 * The origin's teacher portal is reached by any account holding a role whose
 * name is exactly `teacher` or `teaching staff` (`isTeacherRole` in
 * `lib/roles.ts`). LAEC's sessions carry a closed six-value `AdminRole`
 * instead, so a portal-wide `TeacherIdentity` is derived from the session
 * rather than from a role-name string.
 */
export interface TeacherIdentity {
  /** LAEC's `STORAGE_KEYS.AdminUsername`. */
  username: string;
  fullName: string;
  schoolID: string;
}

/** A reviewer / recipient picker row. Origin: `GET /communication/users`. */
export interface TeacherDirectoryEntry {
  username: string;
  fullName: string;
  email: string;
  department: string;
  designation?: string;
  /** Only `active` accounts are returned by the origin's endpoint. */
  status: 'active' | 'invited' | 'suspended';
}

/** Origin: `AcademicSession`, rendered in selects as `${name} — ${term}`. */
export interface ReferenceSession {
  id: string;
  name: string;
  term: string;
}

/** Origin: `GET /communication/users?search=` also feeds reviewer pickers. */
export interface ReferenceClass {
  id: string;
  name: string;
  /** Present only for classes the signed-in teacher actually teaches. */
  sectionId?: string;
}

/* ── lesson planning ────────────────────────────────────────────────────── */

/**
 * Origin `LessonPlanStatus`. Note `pending` — not `PENDING_REVIEW` as LAEC
 * calls the same idea for question papers. Both vocabularies are kept.
 */
export type LessonPlanStatus = 'draft' | 'pending' | 'approved' | 'rejected';

/** Origin `SignatureStyle`, default `vibes` (`DEFAULT_SIGNATURE_STYLE`). */
export type SignatureStyle = 'vibes' | 'allura' | 'dancing' | 'satisfy' | 'parisienne';

export interface LessonPresentationStep {
  stepLabel: string;
  duration: string;
  teacherPresentation: string;
}

export interface StudentActivity {
  studentActivity: string;
  expectedResponse: string;
}

export interface LessonContentBlock {
  heading: string;
  body: string;
}

export interface LessonPlan {
  id: string;
  /** Author. Both gates (edit, delete) compare against the session username. */
  teacherUsername: string;
  teacherName: string;

  academicSessionId: string;
  term: string;
  /** Origin renders `Week {n}`; HTML `min={1}`, default `1`. */
  week: number;
  classId: string;
  className: string;
  /** Origin renders the pair joined by an en dash. */
  startDate: string;
  endDate: string;
  subject: string;
  topic: string;
  subTopic: string;
  duration: string;
  period: string;

  objectives: string[];
  instructionalMaterials: string;
  previousKnowledge: string;
  entryBehaviour: string;
  recommendedText: string;
  referenceText: string;
  lessonContent: LessonContentBlock[];
  presentationSteps: LessonPresentationStep[];
  studentActivities: StudentActivity[];
  summary: string;
  evaluationQuestions: string;
  assignment: string;
  remarks: string;

  /**
   * Origin uploads this as multipart to `/lesson-plans/:id/document`. This
   * port stores the filename only — LAEC has no attachment surface. See
   * `api-map.md` §"no teacher-portal equivalent".
   */
  supportingDocName: string;

  status: LessonPlanStatus;
  /** Destructive banner on the detail view when `status === 'rejected'`. */
  rejectionReason: string;

  /** Assigned reviewer, or null for "any authorised reviewer may pick it up". */
  targetReviewerUsername: string | null;

  signature: string;
  signatureStyle: SignatureStyle;
  reviewedBy: string;
  reviewedAt: string;
}

/* ── weekly report ──────────────────────────────────────────────────────── */

/** Origin `WeeklyReportStatus`. `submitted` here, `pending` on a lesson plan. */
export type WeeklyReportStatus = 'draft' | 'submitted' | 'reviewed';

/** Origin `ReviewWeeklyReportPayload.level`. */
export type WeeklyReportReviewLevel = 'hod' | 'head';

/** A ticked checklist row. The origin seeds four empty unchecked rows. */
export interface WeeklyChecklistItem {
  text: string;
  checked: boolean;
}

export interface WeeklyReport {
  id: string;
  teacherUsername: string;
  teacherName: string;

  weekOfReport: string;
  reportDate: string;
  termSession: string;
  subject: string;
  classAndArm: string;
  topicCovered: string;
  topicUncovered: string;
  reasons: string;

  participationItems: WeeklyChecklistItem[];
  classroomItems: WeeklyChecklistItem[];
  assignmentItems: WeeklyChecklistItem[];
  challengeItems: WeeklyChecklistItem[];
  recommendationItems: WeeklyChecklistItem[];

  additionalObservations: string;
  comments: string;
  notes: string;
  otherChallenges: string;
  furtherRecommendations: string;
  conclusion: string;

  status: WeeklyReportStatus;

  hodComment: string;
  hodReviewedBy: string;
  hodReviewedAt: string;
  headComment: string;
  headReviewedBy: string;
  headReviewedAt: string;
  signature: string;
  signatureStyle: SignatureStyle;
}

/* ── class-teacher weekly report ────────────────────────────────────────── */

/** Only two states: this module has no approve/reject/finalize step. */
export type ClassTeacherReportStatus = 'draft' | 'submitted';

/** Monday–Friday. The origin derives the rows from the week-ending range. */
export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';

export const WEEKDAYS: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];

export interface DailyAttendance {
  day: Weekday;
  present: number;
  absent: number;
}

export interface ClassTeacherReport {
  id: string;
  teacherUsername: string;
  teacherName: string;

  classId: string;
  className: string;
  sectionId: string;
  weekEndingStart: string;
  weekEndingEnd: string;
  week: string;

  callsFromParents: string;
  callsToParents: string;
  teacherResponse: string;

  /** One entry per weekday in `WEEKDAYS`. */
  dailyReports: Record<Weekday, string>;
  attendance: DailyAttendance[];
  absenteesMonday: string;
  absenteesWeek: string;

  /* The ten narrative bands, in the origin's printed order. */
  sickStudents: string;
  faultyFacilities: string;
  reportsFromTeachers: string;
  reportsFromStudents: string;
  studentsFeedbackAboutTeachers: string;
  responseFromClassTeachers: string;
  remedialClassesReport: string;
  casesForManagement: string;
  checkingOfNotes: string;
  classCaptainsReport: string;
  mentorsReport: string;

  status: ClassTeacherReportStatus;
}

/** Origin `ClassTeacherAttendancePreview`, from `…/attendance-preview`. */
export interface AttendancePreview {
  className: string;
  present: number;
  absent: number;
  absentees: {
    monday: string;
    tuesdayFriday: string;
  };
}

/** Origin `ClassTeacherSuperior`, from `…/superiors`. */
export interface LeadershipEntry {
  username: string;
  fullName: string;
  email: string;
  /** Origin renders `roleNames.join(', ')`. */
  roleNames: string[];
}

/* ── leave ──────────────────────────────────────────────────────────────── */

/**
 * Origin `LeaveStatus` is lowercase, but the tab values, the badges and the mock
 * all use UPPERCASE. The uppercase form is the one that is actually rendered, so
 * it is the type. Reproduced rather than normalised.
 */
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LeaveRequest {
  id: string;
  staffUsername: string;
  staffName: string;
  department: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  /** Inclusive: `Math.round((end-start)/86400000) + 1`. */
  days: number;
  reason: string;
  status: LeaveStatus;
  submittedAt: string;
  decidedAt: string;
  decidedBy: string;
  decisionComment: string;
}

/* ── HR queries ─────────────────────────────────────────────────────────── */

/** Origin `QueryPriority`. */
export type QueryPriority = 'low' | 'medium' | 'high';

/** Origin `QueryStatus`. */
export type QueryStatus = 'OPEN' | 'ASSIGNED' | 'RESOLVED' | 'ARCHIVED';

export interface HrQuery {
  id: string;
  title: string;
  description: string;
  issuerName: string;
  issuerUsername: string;
  targetUsername: string;
  targetUserName: string;
  /**
   * Origin labels this field **Offence** in the form and sources its options
   * from `GET /offence-categories/active`, whose `name` is the value.
   */
  category: string;
  priority: QueryPriority;
  status: QueryStatus;
  response: string;
  createdAt: string;
}

/* ── counselling ────────────────────────────────────────────────────────── */

export type CounsellingPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

/** Origin `ApiCounsellingStatus` — six states, not the four HR queries use. */
export type CounsellingStatus =
  | 'OPEN'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'PENDING'
  | 'RESOLVED'
  | 'CLOSED';

export type CommitteeRole = 'CHAIR' | 'MEMBER';

export interface CommitteeMember {
  username: string;
  fullName: string;
  email: string;
  role: CommitteeRole;
}

export interface CounsellingCommittee {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  members: CommitteeMember[];
}

export interface CaseComment {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface CounsellingCase {
  id: string;
  /** Auto-incremented by the origin's mock, e.g. `CNS-001`. */
  caseNumber: string;
  studentName: string;
  studentUsername: string;
  referredByName: string;
  referralDate: string;
  priority: CounsellingPriority;
  status: CounsellingStatus;
  committeeId: string;
  committeeName: string;
  academicSessionId: string;
  backgroundInfo: string;
  reasonForReferral: string;
  initialComment: string;
  comments: CaseComment[];
}

export type CounsellingReportStatus = 'DRAFT' | 'FINAL';

export interface CounsellingReport {
  id: string;
  caseId: string;
  caseNumber: string;
  title: string;
  status: CounsellingReportStatus;
  summary: string;
  findings: string;
  recommendations: string;
  actionPlan: string;
  authorUsername: string;
  createdAt: string;
}

/* ── disciplinary ───────────────────────────────────────────────────────── */

export type CaseSeverity = 'MINOR' | 'MODERATE' | 'MAJOR' | 'CRITICAL';

/** Origin `ApiCaseStatus`. */
export type DisciplinaryCaseStatus =
  | 'OPEN'
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'DISMISSED'
  | 'RESOLVED'
  | 'APPEALED';

/**
 * Despite the route name `/teacher/disciplinary/incidents`, the origin's
 * "Incidents" page manages **case types**. Named for the route, not the entity.
 */
export interface DisciplinaryIncidentType {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
}

export interface DisciplinaryCommittee {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  members: CommitteeMember[];
}

export interface DisciplinaryCase {
  id: string;
  caseNumber: string;
  studentName: string;
  studentUsername: string;
  caseTypeId: string;
  caseTypeTitle: string;
  incidentDate: string;
  location: string;
  severity: CaseSeverity;
  status: DisciplinaryCaseStatus;
  committeeId: string;
  committeeName: string;
  academicSessionId: string;
  description: string;
  initialComment: string;
  comments: CaseComment[];
}

/* ── messaging ─────────────────────────────────────────────────────────── */

export type MessageType = 'text' | 'image' | 'file' | 'voice' | 'lesson-plan';

export interface Conversation {
  id: string;
  kind: 'direct' | 'group';
  name: string;
  members: string[];
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderUsername: string;
  senderName: string;
  body: string;
  type: MessageType;
  createdAt: string;
}

/* ── events & profile ───────────────────────────────────────────────────── */

/** Origin `EVENT_CATEGORY_LABELS`. */
export type EventCategory = 'academic' | 'event' | 'holiday' | 'meeting';

export interface SchoolEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  category: EventCategory;
  allDay: boolean;
  createdBy: string;
}

/** Origin `MyProfilePage` fields. `PATCH /auth/profile`. */
export interface TeacherProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  gender: 'MALE' | 'FEMALE';
  dateOfBirth: string;
  maritalStatus: 'MARRIED' | 'UNMARRIED';
  emergencyMobile: string;
  qualifications: string;
}

/* ── dashboard ──────────────────────────────────────────────────────────── */

/** Aggregate row for `/dashboard`. Origin: `GET /dashboard/stats`. */
export interface TeacherDashboardCounts {
  lessonPlanDrafts: number;
  lessonPlanPending: number;
  weeklyReportDrafts: number;
  weeklyReportSubmitted: number;
  classReportsDraft: number;
  openLeaveRequests: number;
  openHrQueries: number;
  openCounsellingCases: number;
  openDisciplinaryCases: number;
  unreadMessages: number;
  unreadNotifications: number;
}