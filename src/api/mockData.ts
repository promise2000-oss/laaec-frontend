/**
 * Fictional mock fixtures for the typed mock adapter (decision D-05).
 *
 * Every record below is invented for this build — no real student,
 * administrator, school or credential data appears anywhere (brief: mock API
 * only). Names use a MOCK prefix so screenshots are self-describing.
 */

import type {
  AdminAccount,
  CalendarEvent,
  NoticeBoardItem,
  PortalNotification,
  DemotionLog,
  PortalConfig,
  Question,
  QuestionSubmissionRecord,
  ResultRecord,
  Student,
  TeacherNotice,
} from '../types';

export const MOCK_SCHOOL_ID = '001';
export const MOCK_SCHOOL_NAME = 'MOCK EXAMPLE SCHOOLS';

/** PRD §2.3 runtime configuration; production runs MODE_B (PRD §2.2). */
export const MOCK_CONFIG: PortalConfig = {
  academicYear: '2025/2026',
  currentTerm: 'TERM1',
  activeExamType: 'EXAM',
  mode: 'MODE_B',
  /** Read by resolveEffectiveMode (observed key, origin login.html). */
  currentMode: 'MODE_B',
  portalActive: true,
  /**
   * The super administrator's promotion window, read by `/ca/` GET_CONFIG
   * (ca.html line 2235): it reveals `#promotion-alert-banner` and the Promotion
   * Exception Manager. The origin only opens it during TERM1, which is the term
   * this fixture is set to.
   */
  promotionActive: true,
  examDuration: 60,
  /* Live-window wire format unconfirmed (PortalConfig.StartTime/EndTime). */
  StartTime: '09:00:00',
  EndTime: '17:00:00',
  activeSubjects: ['MATHEMATICS', 'ENGLISH_LANGUAGE', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY'],
};

export const MOCK_STUDENTS: Student[] = [
  {
    PK: 'MOCK#STUDENT#LAEC/001/2025/0001',
    RegNo: 'LAEC/001/2025/0001',
    FullName: 'MOCK STUDENT ALPHA',
    SchoolID: MOCK_SCHOOL_ID,
    Class: 'SSS1',
    Arm: 'SCIENCE',
    Subjects: ['MATHEMATICS', 'ENGLISH_LANGUAGE', 'PHYSICS', 'CHEMISTRY'],
    PassportURL: '',
    SchoolName: MOCK_SCHOOL_NAME,
    Password: 'MockPass1',
  },
  {
    PK: 'MOCK#STUDENT#LAEC/001/2025/0002',
    RegNo: 'LAEC/001/2025/0002',
    FullName: 'MOCK STUDENT BRAVO',
    SchoolID: MOCK_SCHOOL_ID,
    Class: 'SSS1',
    Arm: 'SCIENCE',
    Subjects: ['MATHEMATICS', 'ENGLISH_LANGUAGE', 'BIOLOGY'],
    PassportURL: '',
    SchoolName: MOCK_SCHOOL_NAME,
    Password: 'MockPass2',
  },
  {
    PK: 'MOCK#STUDENT#LAEC/001/2025/0003',
    RegNo: 'LAEC/001/2025/0003',
    FullName: 'MOCK STUDENT CHARLIE',
    SchoolID: MOCK_SCHOOL_ID,
    Class: 'SSS2',
    Arm: 'ARTS',
    Subjects: ['MATHEMATICS', 'ENGLISH_LANGUAGE', 'LITERATURE_IN_ENGLISH'],
    PassportURL: '',
    SchoolName: MOCK_SCHOOL_NAME,
    Password: 'MockPass3',
  },
  {
    PK: 'MOCK#STUDENT#LAEC/001/2025/0004',
    RegNo: 'LAEC/001/2025/0004',
    FullName: 'MOCK STUDENT DELTA',
    SchoolID: MOCK_SCHOOL_ID,
    Class: 'SSS2',
    Arm: 'COMMERCIAL',
    Subjects: ['MATHEMATICS', 'ENGLISH_LANGUAGE', 'COMMERCE'],
    PassportURL: '',
    SchoolName: MOCK_SCHOOL_NAME,
    Password: 'MockPass4',
  },
  {
    PK: 'MOCK#STUDENT#LAEC/001/2025/0005',
    RegNo: 'LAEC/001/2025/0005',
    FullName: 'MOCK STUDENT ECHO',
    SchoolID: MOCK_SCHOOL_ID,
    Class: 'JSS3',
    Arm: 'A',
    Subjects: ['BASIC_TECHNOLOGY', 'ENGLISH_LANGUAGE'],
    PassportURL: '',
    SchoolName: MOCK_SCHOOL_NAME,
    Password: 'MockPass5',
  },
  {
    PK: 'MOCK#STUDENT#LAEC/001/2025/0006',
    RegNo: 'LAEC/001/2025/0006',
    FullName: 'MOCK STUDENT FOXTROT',
    SchoolID: MOCK_SCHOOL_ID,
    Class: 'JSS3',
    Arm: 'B',
    Subjects: ['BASIC_TECHNOLOGY', 'ENGLISH_LANGUAGE'],
    PassportURL: '',
    SchoolName: MOCK_SCHOOL_NAME,
    Password: 'MockPass6',
  },
  /* Graduated path (PRD §4.2 step 6) — graduate-ui. */
  {
    PK: 'MOCK#STUDENT#LAEC/001/2025/0007',
    RegNo: 'LAEC/001/2025/0007',
    FullName: 'MOCK STUDENT GRADUATE',
    SchoolID: MOCK_SCHOOL_ID,
    Class: 'GRADUATED',
    Arm: '',
    Subjects: [],
    PassportURL: '',
    SchoolName: MOCK_SCHOOL_NAME,
    Password: 'MockPass7',
  },
  /* Migration path (PRD §4.2 step 8) — promotion wording. */
  {
    PK: 'MOCK#STUDENT#LAEC/001/2025/0008',
    RegNo: 'LAEC/001/2025/0008',
    FullName: 'MOCK STUDENT PROMOTED',
    SchoolID: MOCK_SCHOOL_ID,
    Class: 'SSS1',
    Arm: 'SCIENCE',
    Subjects: ['MATHEMATICS', 'ENGLISH_LANGUAGE', 'PHYSICS'],
    PassportURL: '',
    SchoolName: MOCK_SCHOOL_NAME,
    Password: 'MockPass8',
    RequiresSubjectUpdate: true,
    SubjectUpdateReason: 'PROMOTION',
  },
  /* Migration path with the DEMOTION wording variant. */
  {
    PK: 'MOCK#STUDENT#LAEC/001/2025/0009',
    RegNo: 'LAEC/001/2025/0009',
    FullName: 'MOCK STUDENT DEMOTED',
    SchoolID: MOCK_SCHOOL_ID,
    Class: 'JSS2',
    Arm: 'A',
    Subjects: ['MATHEMATICS', 'ENGLISH_LANGUAGE'],
    PassportURL: '',
    SchoolName: MOCK_SCHOOL_NAME,
    Password: 'MockPass9',
    RequiresSubjectUpdate: true,
    SubjectUpdateReason: 'DEMOTION',
  },
];

/** Objective paper for /exam/ — fictional content, no licensed material. */
export const MOCK_QUESTIONS: Question[] = [
  {
    QuestionID: 'MOCKQ1',
    ImageURL: '/nicegene_logo.png',
    QuestionType: 'OBJECTIVE',
    Question: 'Which value is the primary blue declared by the portal glass theme?',
    A: '#004a99',
    B: '#ffffff',
    C: '#dc3545',
    D: '#00c2ff',
    Correct: 'A',
    EXAM: '5',
    ShuffleQuestions: true,
    DurationMinutes: 45,
    EndTime: '2099-12-31T23:59:59+01:00',
  },
  {
    QuestionID: 'MOCKQ2',
    QuestionType: 'OBJECTIVE',
    Question: 'What is the default examination duration recorded in the runtime configuration?',
    A: '60 minutes',
    B: '30 minutes',
    C: '90 minutes',
    D: '120 minutes',
    Correct: 'A',
    EXAM: '5',
    ShuffleQuestions: true,
    DurationMinutes: 45,
    EndTime: '2099-12-31T23:59:59+01:00',
  },
  {
    QuestionID: 'MOCKQ3',
    QuestionType: 'OBJECTIVE',
    Question: 'Which academic coordinate value identifies the active term?',
    A: 'TERM1',
    B: 'MODE_A',
    C: 'CA2',
    D: 'JOINT',
    Correct: 'A',
    EXAM: '5',
    ShuffleQuestions: false,
    DurationMinutes: 45,
    EndTime: '2099-12-31T23:59:59+01:00',
  },
  {
    QuestionID: 'MOCKQ4',
    QuestionType: 'OBJECTIVE',
    Question: 'A tab switch during an examination triggers which lockdown action?',
    A: 'Immediate auto-termination',
    B: 'A five-second grace period',
    C: 'A warning banner only',
    D: 'Nothing is recorded',
    Correct: 'A',
    EXAM: '5',
    ShuffleQuestions: true,
    DurationMinutes: 45,
    EndTime: '2099-12-31T23:59:59+01:00',
  },
  {
    QuestionID: 'MOCKQ5',
    QuestionType: 'OBJECTIVE',
    Question: 'Below which inner-to-available ratio is the exam window considered split-screen?',
    A: '0.78',
    B: '0.50',
    C: '0.95',
    D: '1.00',
    Correct: 'A',
    EXAM: '5',
    ShuffleQuestions: false,
    DurationMinutes: 45,
    EndTime: '2099-12-31T23:59:59+01:00',
  },
  {
    QuestionID: 'MOCKQ6',
    QuestionType: 'OBJECTIVE',
    Question: 'How often is the split-screen ratio sampled during a live session?',
    A: 'Every 1500 ms',
    B: 'Every second',
    C: 'Only on resize',
    D: 'Every 10 seconds',
    Correct: 'A',
    EXAM: '5',
    ShuffleQuestions: true,
    DurationMinutes: 45,
    EndTime: '2099-12-31T23:59:59+01:00',
  },
  {
    QuestionID: 'MOCKQ7',
    QuestionType: 'OBJECTIVE',
    Question: 'Which storage key holds autosaved answers for a subject?',
    A: 'ans_{RegNo}_{subject}',
    B: 'LAEC_Session',
    /* Option C is deliberately absent: RF-35 requires the exam hall to render
     * only the letters a question actually carries, and a three-option paper is
     * the only way to observe that through the real question renderer. */
    D: 'selectedSubject',
    Correct: 'A',
    EXAM: '5',
    ShuffleQuestions: false,
    DurationMinutes: 45,
    EndTime: '2099-12-31T23:59:59+01:00',
  },
  {
    QuestionID: 'MOCKQ8',
    QuestionType: 'OBJECTIVE',
    Question: 'What is displayed while the timer is offline?',
    /* Rich text plus a missing image, so RF-38 (sanitiseRichTextHtml) and RF-39
     * (a broken diagram hides itself) are observable in the running exam hall
     * rather than only in the helper. */
    QuestionHTML:
      'What is <b>displayed</b> while the timer is <script>window.print()<\/script> <span style="color:#ff0000" onmouseover="window.print()">offline</span>?',
    ImageURL: '/missing-diagram-for-audit.png',
    A: 'A visual offline class on the timer',
    B: 'The timer stops permanently',
    C: 'The session auto-submits',
    D: 'Nothing changes',
    Correct: 'A',
    EXAM: '5',
    ShuffleQuestions: true,
    DurationMinutes: 45,
    EndTime: '2099-12-31T23:59:59+01:00',
  },
  {
    QuestionID: 'MOCKQ9',
    QuestionType: 'OBJECTIVE',
    Question: 'Which reason string is sent when the countdown reaches zero?',
    A: 'None',
    B: 'Time expired',
    C: 'Auto submitted',
    D: 'Timer stopped',
    Correct: 'A',
    EXAM: '5',
    ShuffleQuestions: false,
    DurationMinutes: 45,
    EndTime: '2099-12-31T23:59:59+01:00',
  },
  {
    QuestionID: 'MOCKQ10',
    QuestionType: 'OBJECTIVE',
    Question: 'Who designed and maintains this portal?',
    A: 'NICEGENE TECHNOLOGIES',
    B: 'The school',
    C: 'The exam committee',
    D: 'Cloudflare',
    Correct: 'A',
    EXAM: '5',
    ShuffleQuestions: true,
    DurationMinutes: 45,
    EndTime: '2099-12-31T23:59:59+01:00',
  },
  {
    QuestionID: 'MOCKQ11',
    QuestionType: 'SUB_OBJECTIVE',
    Question: 'State the split-screen ratio threshold and the viewport sampling interval in milliseconds.',
    A: '',
    B: '',
    C: '',
    D: '',
    Correct: '0.78|1500',
    EXAM: '5',
    ShuffleQuestions: true,
    DurationMinutes: 45,
    EndTime: '2099-12-31T23:59:59+01:00',
  },
  {
    QuestionID: 'MOCKQ12',
    QuestionType: 'THEORY',
    Question: 'Explain the measures the portal applies to prevent tab switching during an examination.',
    A: '',
    B: '',
    C: '',
    D: '',
    Correct: '',
    EXAM: '5',
    ShuffleQuestions: true,
    DurationMinutes: 45,
    EndTime: '2099-12-31T23:59:59+01:00',
  },
];

/** Stored result lines — pk/sk naming is a mock pattern (wire names unconfirmed). */
/**
 * Results fixtures carry the hall fields the /login/ completion filter reads
 * (`Subject`, the CA1/CA2/EXAM triple) plus the administrator-side fields the
 * /admin/ renderers attest (identity, coordinate, score triple, status and
 * violation payload). Three records are FLAGGED so the invigilation monitor has
 * something to show; one of those is a time-expiry violation, which the
 * origin's delete path deliberately excludes.
 */
const FLAGGED_FIXTURES: Record<string, string> = {
  'LAEC/001/2025/0003': 'Tab Switch/Focus Lost',
  'LAEC/001/2025/0005': 'Time Expired',
  'LAEC/001/2025/0007': 'Fullscreen mode exited',
};

export const MOCK_RESULTS: ResultRecord[] = MOCK_STUDENTS.map((s, i) => {
  const total = 40;
  const score = 22 + ((i * 3) % 17);
  const violation = FLAGGED_FIXTURES[s.RegNo];
  return {
    pk: `MOCK#RESULT#${s.RegNo}`,
    sk: `RESULT#${s.Class}#MATHEMATICS#2025/2026#TERM1`,
    PK: `MOCK#RESULT#${s.RegNo}`,
    SK: `RESULT#${s.Class}#MATHEMATICS#2025/2026#TERM1`,
    /* Subject is read by the /login/ completion filter (observed). */
    Subject: 'MATHEMATICS',
    CA1: 12 + i,
    CA2: 14 + i,
    EXAM: 40 + i,
    FullName: s.FullName,
    RegNo: s.RegNo,
    SchoolID: s.SchoolID,
    Class: s.Class,
    Arm: s.Arm,
    Category: 'EXAM',
    Mode: 'MODE_B',
    Term: 'TERM1',
    Year: '2025/2026',
    Timestamp: `2026-01-1${(i % 9) + 1}T09:1${i % 6}:00Z`,
    Score: score,
    Total: total,
    Percentage: Math.round((score / total) * 100),
    Status: violation ? 'FLAGGED' : 'CLEAN',
    Violation: violation ?? '',
    AnswerScript: [
      {
        QuestionNo: 1,
        QuestionType: 'OBJECTIVE',
        Question: 'Which value is the primary blue declared by the portal glass theme?',
        StudentAnswer: 'A',
        CorrectAnswer: 'A',
        Mark: 5,
        Awarded: score > 25 ? 5 : 0,
        IsCorrect: score > 25,
      },
      {
        QuestionNo: 2,
        QuestionType: 'OBJECTIVE',
        Question: 'State the split-screen ratio threshold.',
        StudentAnswer: 'A',
        CorrectAnswer: 'A',
        Mark: 5,
        Awarded: 5,
        IsCorrect: true,
      },
      {
        QuestionNo: 3,
        QuestionType: 'THEORY',
        Question: 'Explain the measures the portal applies to prevent tab switching.',
        StudentAnswer: 'THEORY_READ',
        CorrectAnswer: '',
        Mark: 0,
        Awarded: 0,
        IsCorrect: false,
      },
    ],
  } as ResultRecord;
});

/**
 * Paper inventory for the `LAECExamSession` queue on the four consoles. The
 * library passes each row straight through but merges the list on `paper.key`
 * (exam-session-controls.js line 125), and stamps that same
 * `<Class>::<Subject>` form on the rows its own discovery path builds
 * (config.js line 793) - so a row without a key collapses the whole list.
 */
export const MOCK_INVENTORY: Array<{
  key: string;
  Subject: string;
  Class: string;
  questionCount: number;
}> = [
  { key: 'JSS1::MATHEMATICS', Subject: 'MATHEMATICS', Class: 'JSS1', questionCount: 20 },
  { key: 'JSS2::MATHEMATICS', Subject: 'MATHEMATICS', Class: 'JSS2', questionCount: 20 },
  { key: 'JSS1::ENGLISH_LANGUAGE', Subject: 'ENGLISH_LANGUAGE', Class: 'JSS1', questionCount: 15 },
  { key: 'SS1::ENGLISH_LANGUAGE', Subject: 'ENGLISH_LANGUAGE', Class: 'SS1', questionCount: 25 },
  { key: 'JSS3::CITIZENSHIP_HERITAGE', Subject: 'CITIZENSHIP_HERITAGE', Class: 'JSS3', questionCount: 18 },
  { key: 'SS1::BIOLOGY', Subject: 'BIOLOGY', Class: 'SS1', questionCount: 30 },
  { key: 'SS2::ECONOMICS', Subject: 'ECONOMICS', Class: 'SS2', questionCount: 22 },
];

/**
 * `/ca/` Promotion Exception register (GET_DEMOTION_LOGS). Two of the three
 * records share a RegNo so the origin's `counts[RegNo]` tally shows a repeated
 * demotion, which is the column the register exists to surface.
 */
export const MOCK_DEMOTION_LOGS: DemotionLog[] = [
  {
    DemotedAt: '2026-01-14T08:22:00Z',
    FullName: 'MOCK STUDENT ECHOLA',
    RegNo: 'LAEC/001/2025/0005',
    PreviousClass: 'JSS2',
    NewClass: 'JSS1',
  },
  {
    DemotedAt: '2026-01-15T13:05:00Z',
    FullName: 'MOCK STUDENT ECHOLA',
    RegNo: 'LAEC/001/2025/0005',
    PreviousClass: 'JSS3',
    NewClass: 'JSS2',
  },
  {
    DemotedAt: '2026-01-16T10:41:00Z',
    FullName: 'MOCK STUDENT BRAVO',
    RegNo: 'LAEC/001/2025/0002',
    PreviousClass: 'SS1',
    NewClass: 'JSS3',
  },
];

/** `counts[RegNo]` — how many demotions each registration has accumulated. */
export const MOCK_DEMOTION_COUNTS: Record<string, number> = {
  'LAEC/001/2025/0005': 2,
  'LAEC/001/2025/0002': 1,
};

export const MOCK_ADMINS: AdminAccount[] = [
  {
    /* Central Admin (D-55): sits above the school consoles, owns staff
       onboarding across all schools and chairs the question review queue. */
    Username: 'central@nicegeneco.com',
    Email: 'central@nicegeneco.com',
    FullName: 'LAEC CENTRAL ADMIN',
    Role: 'CENTRAL_ADMIN',
    SchoolID: 'GLOBAL',
    Timestamp: '2026-09-29T07:05:00Z',
    Status: 'ACTIVE',
  },
  {
    /* Teacher (D-55): school staff who authors question papers as drafts and
       submits them for review. */
    Username: 'teacher@nicegeneco.com',
    Email: 'teacher@nicegeneco.com',
    FullName: 'MOCK TEACHER ONE',
    Role: 'TEACHER',
    SchoolID: MOCK_SCHOOL_ID,
    Timestamp: '2026-09-29T07:10:00Z',
    Status: 'ACTIVE',
  },
  {
    /* A second teacher at the same school, so the review queue has more than
       one author to accept from. */
    Username: 'teacher2@nicegeneco.com',
    Email: 'teacher2@nicegeneco.com',
    FullName: 'MOCK TEACHER TWO',
    Role: 'TEACHER',
    SchoolID: MOCK_SCHOOL_ID,
    Timestamp: '2026-09-29T07:12:00Z',
    Status: 'ACTIVE',
  },
  {
    /**
     * The seeded operator account (D-52). The origin's Cognito directory was
     * never reachable without credentials, so this build ships one named,
     * super-administrator login for review: the vendor's own address, joint
     * scope, and no forced password change. It exists so the portal can be
     * opened and walked without seeding storage by hand; it is mock-only and
     * the production bundle contains no mock at all.
     */
    Username: 'admin@nicegeneco.com',
    Email: 'admin@nicegeneco.com',
    FullName: 'LAEC MASTER ADMIN',
    Role: 'SUPER_ADMIN',
    SchoolID: 'GLOBAL',
    Timestamp: '2026-09-29T07:00:00Z',
    Status: 'ACTIVE',
  },
  {
    Username: 'mocksuper',
    Email: 'mocksuper@example.test',
    FullName: 'MOCK SUPER ADMIN',
    Role: 'SUPER_ADMIN',
    SchoolID: MOCK_SCHOOL_ID,
    Timestamp: '2026-01-05T08:00:00Z',
    Status: 'ACTIVE',
  },
  {
    Username: 'mockschool',
    Email: 'mockschool@example.test',
    FullName: 'MOCK SCHOOL ADMIN',
    Role: 'SCHOOL_ADMIN',
    SchoolID: MOCK_SCHOOL_ID,
    Timestamp: '2026-01-05T08:10:00Z',
    Status: 'ACTIVE',
  },
  {
    Username: 'mockict',
    Email: 'mockict@example.test',
    FullName: 'MOCK ICT ADMIN',
    Role: 'ICT_ADMIN',
    SchoolID: MOCK_SCHOOL_ID,
    Timestamp: '2026-01-05T08:20:00Z',
    Status: 'ACTIVE',
  },
  {
    Username: 'mockcommittee',
    Email: 'mockcommittee@example.test',
    FullName: 'MOCK EXAM COMMITTEE',
    Role: 'EXAM_COMMITTEE',
    SchoolID: MOCK_SCHOOL_ID,
    Timestamp: '2026-01-05T08:30:00Z',
    Status: 'ACTIVE',
  },
];

/* ── question authoring lifecycle fixtures (addendum, D-53) ────────────── */

/**
 * One LIVE submission so "accept makes the questions live" is observable
 * end to end, and it is deliberately placed on a coordinate no mock student
 * sits: SS2 / ECONOMICS has an inventory row but no paper in MOCK_LIVE_PAPERS,
 * so accepting it cannot disturb the counts the origin evidence cites.
 */
export const MOCK_SUBMISSIONS: QuestionSubmissionRecord[] = [
  {
    SubmissionID: 'SUB-0001',
    SchoolID: MOCK_SCHOOL_ID,
    Subject: 'ECONOMICS',
    Class: 'SS2',
    Term: 'TERM1',
    Category: 'EXAM',
    Status: 'LIVE',
    SubmittedBy: 'teacher@nicegeneco.com',
    SubmittedByName: 'MOCK TEACHER ONE',
    SubmittedAt: '2026-09-20T09:15:00Z',
    UpdatedAt: '2026-09-22T11:40:00Z',
    ReviewedBy: 'central@nicegeneco.com',
    ReviewedAt: '2026-09-22T11:40:00Z',
    ReviewNote: 'Accepted for the SS2 Economics paper.',
    QuestionCount: 2,
    Questions: [
      {
        QuestionID: 'SUBQ1',
        QuestionType: 'OBJECTIVE',
        Question: 'Which factor shifts a demand curve to the right?',
        A: 'A rise in consumer income for a normal good',
        B: 'A fall in the price of the good itself',
        C: 'A fall in demand',
        D: 'Movement along the same curve',
        Correct: 'A',
        EXAM: '5',
        ShuffleQuestions: false,
        DurationMinutes: 45,
        EndTime: '2099-12-31T23:59:59+01:00',
      },
      {
        QuestionID: 'SUBQ2',
        QuestionType: 'OBJECTIVE',
        Question: 'A central bank raising the policy rate is a move in which policy?',
        A: 'Expansionary fiscal policy',
        B: 'Contractionary monetary policy',
        C: 'Neutral fiscal policy',
        D: 'Protectionist trade policy',
        Correct: 'B',
        EXAM: '5',
        ShuffleQuestions: false,
        DurationMinutes: 45,
        EndTime: '2099-12-31T23:59:59+01:00',
      },
    ],
  },
  {
    /* Waiting on the review team — the fixture the queue is worked from. */
    SubmissionID: 'SUB-0002',
    SchoolID: MOCK_SCHOOL_ID,
    Subject: 'CIVIC_EDUCATION',
    Class: 'JSS1',
    Term: 'TERM1',
    Category: 'EXAM',
    Status: 'PENDING_REVIEW',
    SubmittedBy: 'teacher@nicegeneco.com',
    SubmittedByName: 'MOCK TEACHER ONE',
    SubmittedAt: '2026-09-28T08:05:00Z',
    UpdatedAt: '2026-09-28T08:30:00Z',
    QuestionCount: 1,
    Questions: [
      {
        QuestionID: 'SUBQ3',
        QuestionType: 'OBJECTIVE',
        Question: 'Who is the Head of State of Nigeria?',
        A: 'The President',
        B: 'The Governor-General',
        C: 'The Senate President',
        D: 'The Chief Judge',
        Correct: 'A',
        EXAM: '5',
        ShuffleQuestions: false,
        DurationMinutes: 45,
        EndTime: '2099-12-31T23:59:59+01:00',
      },
    ],
  },
  {
    /* A second author's paper in the queue, so a group decision is possible. */
    SubmissionID: 'SUB-0003',
    SchoolID: MOCK_SCHOOL_ID,
    Subject: 'BASIC_TECH',
    Class: 'JSS3',
    Term: 'TERM1',
    Category: 'CA1',
    Status: 'PENDING_REVIEW',
    SubmittedBy: 'teacher2@nicegeneco.com',
    SubmittedByName: 'MOCK TEACHER TWO',
    SubmittedAt: '2026-09-28T10:20:00Z',
    UpdatedAt: '2026-09-28T10:45:00Z',
    QuestionCount: 1,
    Questions: [
      {
        QuestionID: 'SUBQ4',
        QuestionType: 'OBJECTIVE',
        Question: 'Which of these is a renewable energy source?',
        A: 'Solar',
        B: 'Coal',
        D: 'Petrol',
        Correct: 'A',
        EXAM: '5',
        ShuffleQuestions: false,
        DurationMinutes: 45,
        EndTime: '2099-12-31T23:59:59+01:00',
      },
    ],
  },
  {
    /* Rejected once already, so the state and its notice are both visible. */
    SubmissionID: 'SUB-0004',
    SchoolID: MOCK_SCHOOL_ID,
    Subject: 'FRENCH',
    Class: 'JSS2',
    Term: 'TERM1',
    Category: 'EXAM',
    Status: 'REJECTED',
    SubmittedBy: 'teacher@nicegeneco.com',
    SubmittedByName: 'MOCK TEACHER ONE',
    SubmittedAt: '2026-09-25T13:00:00Z',
    UpdatedAt: '2026-09-26T09:10:00Z',
    ReviewedBy: 'central@nicegeneco.com',
    ReviewedAt: '2026-09-26T09:10:00Z',
    ReviewNote: 'Two answers marked correct. Please re-check and resubmit.',
    QuestionCount: 1,
    Questions: [
      {
        QuestionID: 'SUBQ5',
        QuestionType: 'OBJECTIVE',
        Question: 'What is the French word for school?',
        A: 'école',
        B: 'maison',
        C: 'bureau',
        D: 'jardin',
        Correct: 'A,B',
        EXAM: '5',
        ShuffleQuestions: false,
        DurationMinutes: 45,
        EndTime: '2099-12-31T23:59:59+01:00',
      },
    ],
  },
  {
    /* A working draft: never submitted, so it must not reach the exam hall. */
    SubmissionID: 'SUB-0005',
    SchoolID: MOCK_SCHOOL_ID,
    Subject: 'MUSIC',
    Class: 'JSS1',
    Term: 'TERM1',
    Category: 'EXAM',
    Status: 'DRAFT',
    SubmittedBy: 'teacher@nicegeneco.com',
    SubmittedByName: 'MOCK TEACHER ONE',
    SubmittedAt: '',
    UpdatedAt: '2026-09-29T07:20:00Z',
    QuestionCount: 1,
    Questions: [
      {
        QuestionID: 'SUBQ6',
        QuestionType: 'OBJECTIVE',
        Question: 'How many lines are in a standard musical stave?',
        A: 'Four',
        B: 'Five',
        C: 'Six',
        D: 'Seven',
        Correct: 'B',
        EXAM: '5',
        ShuffleQuestions: false,
        DurationMinutes: 45,
        EndTime: '2099-12-31T23:59:59+01:00',
      },
    ],
  },
];

/** Decision notices already raised, so the teacher console is not empty. */
export const MOCK_TEACHER_NOTICES: TeacherNotice[] = [
  {
    NoticeID: 'NOT-0001',
    SchoolID: MOCK_SCHOOL_ID,
    TeacherUsername: 'teacher@nicegeneco.com',
    SubmissionID: 'SUB-0004',
    Subject: 'FRENCH',
    Class: 'JSS2',
    Decision: 'REJECTED',
    Note: 'Two answers marked correct. Please re-check and resubmit.',
    CreatedAt: '2026-09-26T09:10:00Z',
    Read: false,
  },
  {
    NoticeID: 'NOT-0002',
    SchoolID: MOCK_SCHOOL_ID,
    TeacherUsername: 'teacher@nicegeneco.com',
    SubmissionID: 'SUB-0001',
    Subject: 'ECONOMICS',
    Class: 'SS2',
    Decision: 'ACCEPTED',
    Note: 'Accepted for the SS2 Economics paper.',
    CreatedAt: '2026-09-22T11:40:00Z',
    Read: true,
  },
];

/* ── notification centre fixtures (D-64) ─────────────────────────────────
 *
 * Deliberately covering all six categories, addressed three different ways (one
 * account, one role, the whole portal) and split across read and unread, so the
 * filter tabs, the unread badge and the per-category counts are all observable
 * from the fixtures alone.
 */
export const MOCK_NOTIFICATIONS: PortalNotification[] = [
  {
    NotificationID: 'NTF-0001',
    Category: 'ANNOUNCEMENT',
    Title: 'Results for 2025/2026 Term 1 have been published',
    Body: 'The master console published Term 1 results for all ten schools. School admins can now release them to candidates from the Results Center.',
    CreatedAt: '2026-09-29T06:30:00Z',
    Read: false,
    Pinned: true,
    Link: '/admin/',
  },
  {
    NotificationID: 'NTF-0002',
    Category: 'EXAM',
    Title: 'JSS3 Mathematics window closes at 14:00',
    Body: 'The hard cut-off for the JSS3 Mathematics paper is 14:00 today. Candidates still seated will be auto-terminated at that time.',
    CreatedAt: '2026-09-29T07:00:00Z',
    Read: false,
    Link: '/ca/',
  },
  {
    NotificationID: 'NTF-0003',
    Category: 'REVIEW',
    Title: '2 question papers are awaiting your decision',
    Body: 'CIVIC_EDUCATION JSS1 and BASIC_TECH JSS3 are in the review queue. Accepting publishes the questions; rejecting returns them to the author with your reason.',
    CreatedAt: '2026-09-28T10:45:00Z',
    Read: false,
    Role: 'CENTRAL_ADMIN',
    Link: '/central/',
  },
  {
    NotificationID: 'NTF-0004',
    Category: 'SECURITY',
    Title: 'Password changed on your account',
    Body: 'Your portal password was changed. If this was not you, contact the master administrator immediately.',
    CreatedAt: '2026-09-25T14:20:00Z',
    Read: true,
    Username: 'teacher@nicegeneco.com',
  },
  {
    NotificationID: 'NTF-0005',
    Category: 'RESULTS',
    Title: '3 results are flagged for moderation',
    Body: 'Three results were flagged automatically and are waiting in the Results Center for a remark or a release.',
    CreatedAt: '2026-09-24T08:15:00Z',
    Read: true,
    Link: '/admin/',
  },
  {
    NotificationID: 'NTF-0006',
    Category: 'SYSTEM',
    Title: 'Scheduled maintenance on Saturday 03:00-05:00',
    Body: 'The portal will be unavailable for two hours while the examination database is patched. No candidate session may be running at that time.',
    CreatedAt: '2026-09-20T11:00:00Z',
    Read: true,
    Pinned: true,
  },
  {
    NotificationID: 'NTF-0007',
    Category: 'EXAM',
    Title: 'Portal re-opened for 2025/2026 Term 2 registration',
    Body: 'Registration is open. School admins should confirm their invigilator allocations before the first examination window.',
    CreatedAt: '2026-09-18T09:00:00Z',
    Read: true,
  },
];

/* ── academic calendar fixtures (D-64) ────────────────────────────────────
 *
 * Term boundaries and holiday blocks are all-day; examination windows are
 * timed, because a window has a real start and a real cut-off and the calendar
 * should show both.
 */
export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    EventID: 'EVT-0001',
    Kind: 'TERM',
    Title: '2025/2026 Term 1 begins',
    Description: 'First day of term. Registration and invigilation allocation close at the end of week 1.',
    Start: '2026-09-07',
    End: '2026-09-07',
    AllDay: true,
    Session: '2025/2026 TERM1',
    SchoolID: MOCK_SCHOOL_ID,
  },
  {
    EventID: 'EVT-0002',
    Kind: 'TERM',
    Title: 'Mid-term break',
    Description: 'Two-week mid-term break. No examinations may be scheduled inside it.',
    Start: '2026-10-05',
    End: '2026-10-16',
    AllDay: true,
    Session: '2025/2026 TERM1',
    SchoolID: MOCK_SCHOOL_ID,
  },
  {
    EventID: 'EVT-0003',
    Kind: 'EXAM',
    Title: 'JSS3 First Term Examination',
    Description: 'Mathematics, English Language and the three core subjects. Windows are 45 minutes each.',
    Start: '2026-09-28T08:00:00',
    End: '2026-09-28T14:00:00',
    AllDay: false,
    Session: '2025/2026 TERM1',
    SchoolID: MOCK_SCHOOL_ID,
  },
  {
    EventID: 'EVT-0004',
    Kind: 'EXAM',
    Title: 'SSS2 First Term Examination',
    Description: 'Commerce and Economics papers. The Economics set includes questions published through the review workflow.',
    Start: '2026-09-29T08:00:00',
    End: '2026-09-29T15:00:00',
    AllDay: false,
    Session: '2025/2026 TERM1',
    SchoolID: MOCK_SCHOOL_ID,
  },
  {
    EventID: 'EVT-0005',
    Kind: 'HOLIDAY',
    Title: 'Independence Day',
    Description: 'National holiday. The portal is closed for the day.',
    Start: '2026-10-01',
    End: '2026-10-01',
    AllDay: true,
    Session: '2025/2026 TERM1',
    SchoolID: MOCK_SCHOOL_ID,
  },
  {
    EventID: 'EVT-0006',
    Kind: 'EVENT',
    Title: 'Chief Examiner briefing',
    Description: 'Joint briefing for the examination committee and the ICT administrators ahead of the result release.',
    Start: '2026-10-06T10:00:00',
    End: '2026-10-06T12:00:00',
    AllDay: false,
    Session: '2025/2026 TERM1',
    SchoolID: MOCK_SCHOOL_ID,
  },
  {
    EventID: 'EVT-0007',
    Kind: 'TERM',
    Title: '2025/2026 Term 1 examinations begin',
    Description: 'The examination period opens. No paper may be scheduled outside the published windows.',
    Start: '2026-09-28',
    End: '2026-09-28',
    AllDay: true,
    Session: '2025/2026 TERM1',
    SchoolID: MOCK_SCHOOL_ID,
  },
  {
    EventID: 'EVT-0008',
    Kind: 'TERM',
    Title: '2025/2026 Term 1 ends',
    Description: 'Last day of term. Results must be published before this date.',
    Start: '2026-12-18',
    End: '2026-12-18',
    AllDay: true,
    Session: '2025/2026 TERM1',
    SchoolID: MOCK_SCHOOL_ID,
  },
];

/* ── notice board fixtures (D-64) ───────────────────────────────────────── */

export const MOCK_NOTICES: NoticeBoardItem[] = [
  {
    NoticeID: 'NTC-0001',
    Title: 'Portal maintenance window — Saturday 03:00 to 05:00',
    Body: 'The portal will be offline for two hours while the examination database is patched. No candidate session may be running during the window, so invigilators should confirm the hall is clear before 02:30.',
    Audience: 'ALL',
    AuthorUsername: 'admin@nicegeneco.com',
    AuthorName: 'LAEC MASTER ADMIN',
    PublishedAt: '2026-09-26T09:00:00Z',
    Pinned: true,
    SchoolID: 'GLOBAL',
  },
  {
    NoticeID: 'NTC-0002',
    Title: 'Question review queue is now the only route to publication',
    Body: 'From this term, questions authored by teachers must be accepted by the central review team before they reach a candidate. Papers written straight into the live set will not appear in an examination.',
    Audience: 'TEACHER',
    AuthorUsername: 'central@nicegeneco.com',
    AuthorName: 'LAEC CENTRAL ADMIN',
    PublishedAt: '2026-09-25T10:30:00Z',
    Pinned: false,
    SchoolID: MOCK_SCHOOL_ID,
  },
  {
    NoticeID: 'NTC-0003',
    Title: 'Invigilator allocation closes Friday',
    Body: 'Submit your invigilator allocation for the first term examinations by Friday close of business. Late allocations cannot be honoured once the examination period opens.',
    Audience: 'SCHOOL_ADMIN',
    AuthorUsername: 'admin@nicegeneco.com',
    AuthorName: 'LAEC MASTER ADMIN',
    PublishedAt: '2026-09-24T14:00:00Z',
    Pinned: false,
    SchoolID: MOCK_SCHOOL_ID,
  },
  {
    NoticeID: 'NTC-0004',
    Title: 'Exam hall lockdown: 45 seconds grace on tab switch',
    Body: 'A candidate who leaves the hall tab is auto-terminated immediately. Confirm kiosk lockdown before each window opens; a misconfigured kiosk will fail every candidate it seats.',
    Audience: 'ICT_ADMIN',
    AuthorUsername: 'admin@nicegeneco.com',
    AuthorName: 'LAEC MASTER ADMIN',
    PublishedAt: '2026-09-22T08:45:00Z',
    Pinned: false,
    SchoolID: MOCK_SCHOOL_ID,
  },
  {
    NoticeID: 'NTC-0005',
    Title: 'Term 1 results are ready for release',
    Body: 'All ten schools have submitted. School administrators may now release results to candidates from the Results Center. Three results remain flagged for moderation.',
    Audience: 'SCHOOL_ADMIN',
    AuthorUsername: 'admin@nicegeneco.com',
    AuthorName: 'LAEC MASTER ADMIN',
    PublishedAt: '2026-09-29T06:30:00Z',
    Pinned: true,
    SchoolID: MOCK_SCHOOL_ID,
  },
];
