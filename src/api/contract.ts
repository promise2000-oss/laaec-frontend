/**
 * Typed API contract for all 38 actions in PRD §3.6.
 *
 * Request fields are the union of keys observed for each action in the
 * original front-end code (tools/actions-report.txt — extracted from
 * origin-pages/*.html inline scripts and public/*.js). Response payloads use
 * the observed flat envelope `{ status, message?, <payload> }`; where the
 * original's response payload key was not observed, the field is marked
 * `unconfirmed` and typed loosely rather than guessed (decision D-05).
 *
 * Transport, as observed: GET actions travel as query strings
 * (`?action=NAME&param=…`), POST actions as `JSON.stringify({ action, … })`
 * to the register endpoint.
 */

import type {
  AdminAccount,
  AdminRole,
  AdminStatus,
  DemotionLog,
  ExamCategory,
  ExamMode,
  ExamResultSubmission,
  ExamTerm,
  Paper,
  CalendarEvent,
  NoticeAudience,
  NoticeCategory,
  PortalConfig,
  PortalNotification,
  Question,
  QuestionStatus,
  QuestionSubmission,
  QuestionSubmissionRecord,
  NoticeBoardItem,
  TeacherNotice,
  ResultRecord,
  Student,
} from '../types';
import type {
  AttendancePreview,
  ChatMessage,
  ClassTeacherReport,
  ClassTeacherReportStatus,
  CaseSeverity,
  Conversation,
  CounsellingPriority,
  CounsellingCase,
  CounsellingCommittee,
  CounsellingReport,
  CounsellingReportStatus,
  CounsellingStatus,
  DisciplinaryCase,
  DisciplinaryCaseStatus,
  DisciplinaryCommittee,
  DisciplinaryIncidentType,
  EventCategory,
  HrQuery,
  LeadershipEntry,
  LeaveRequest,
  LeaveStatus,
  LessonPlan,
  LessonPlanStatus,
  QueryPriority,
  QueryStatus,
  ReferenceClass,
  ReferenceSession,
  SchoolEvent,
  SignatureStyle,
  TeacherDashboardCounts,
  TeacherDirectoryEntry,
  TeacherProfile,
  WeeklyReport,
  WeeklyReportReviewLevel,
  WeeklyReportStatus,
} from '../types/teacher';

/** Flat envelope observed on every call (`data.status` 46×, `data.message` 29×). */
export interface ApiEnvelope {
  status: 'success' | 'error';
  message?: string;
}

type Success<T> = T;

export interface ApiMap {
  /* ── Read operations (GET) — 11 ─────────────────────────────────────── */

  GET_PORTAL_STATE: {
    req: { schoolID: string };
    res: ApiEnvelope &
      Success<{
        config?: PortalConfig;
        /** Observed: `data.isPromotionActive === true || data.config.promotionActive === true`. */
        isPromotionActive?: boolean;
        /** Observed: `data.isOffline === true` closes the portal. */
        isOffline?: boolean;
        /** Observed keys feeding `resolveEffectiveMode`. */
        localMode?: string;
        globalMode?: string;
        effectiveMode?: string;
      }>;
  };
  GET_STUDENT_PROFILE: {
    req: { schoolID: string; regID: string };
    res: ApiEnvelope &
      Success<{
        /** Payload key unconfirmed. */
        student?: Student;
      }>;
  };
  GET_LIVE_SCHEDULE: {
    req: {
      schoolID: string;
      class: string;
      term: ExamTerm;
      year: string;
      category: ExamCategory;
      mode: ExamMode;
    };
    res: ApiEnvelope &
      Success<{
        /** Payload key observed as `scheduleData.activePapers` (origin login.html). */
        activePapers?: Paper[];
      }>;
  };
  GET_RESULTS: {
    req: {
      /** Present on every admin-side call site; omitted by /login/ (observed) — optional. */
      schoolID?: string;
      year: string;
      term: ExamTerm;
      mode: ExamMode;
      category?: ExamCategory;
      subject?: string;
      targetSchool?: string;
      regNo?: string;
      class?: string;
      studentClass?: string;
      studentArm?: string;
      noCache?: boolean;
      completionOnly?: boolean;
    };
    res: ApiEnvelope & Success<{ results: ResultRecord[] }>;
  };
  GET_SECURE_QUESTIONS: {
    req: {
      schoolID: string;
      year: string;
      term: ExamTerm;
      type: ExamCategory;
      mode: ExamMode;
      class?: string;
      subject?: string;
      pastOnly?: boolean;
      regNo?: string;
      noCache?: boolean;
      editorMode?: boolean;
    };
    res: ApiEnvelope &
      Success<{
        questions: Question[];
        /** Observed: gates the "Subject Locked" alert instead of Diagnostic Report. */
        completed?: boolean;
        /** Observed: `data.debug.attempts[]` and `data.debug.searchedPK`. */
        debug?: {
          attempts?: Array<{ subject: string; class: string }>;
          searchedPK?: string;
        };
      }>;
  };
  GET_QUESTION_INVENTORY: {
    req: {
      schoolID: string;
      year: string;
      term: ExamTerm;
      type: ExamCategory;
      mode: ExamMode;
    };
    res: ApiEnvelope &
      Success<{
        /** Payload key observed twice as `data.inventory`; item shape unconfirmed. */
        inventory: unknown[];
      }>;
  };
  GET_STUDENTS: {
    req: { schoolID: string };
    res: ApiEnvelope & Success<{ students: Student[] }>;
  };
  GET_CONFIG: {
    req: { schoolID?: string };
    res: ApiEnvelope &
      Success<{
        /** Observed flat on this response: `data.mode || 'MODE_A'`. */
        mode?: ExamMode;
        /**
         * Also observed flat, read by /admin/ `loadGlobalStats`
         * (origin-pages/admin.html lines 2137–2184) — not nested under
         * `config`: portalActive, academicYear, currentTerm, activeExamType,
         * examDuration (minutes) and promotionActive.
         */
        portalActive?: boolean;
        academicYear?: string;
        currentTerm?: ExamTerm;
        activeExamType?: ExamCategory;
        examDuration?: number;
        promotionActive?: boolean;
        config?: PortalConfig;
      }>;
  };
  GET_COGNITO_ADMINS: {
    /**
     * `roles` is the origin's comma-separated filter, which every console sends
     * with a value. The Central Admin (D-55) reads the whole directory across
     * schools instead, so both fields became optional and an empty `roles`
     * means "every role" — the same meaning the observed filter had when the
     * page passed a list that covered everything.
     */
    req: { schoolID?: string; roles?: string };
    res: ApiEnvelope & Success<{ admins: AdminAccount[] }>;
  };
  GET_EXAM_CONFIG: {
    req: { schoolID: string };
    res: ApiEnvelope &
      Success<{
        /**
         * Attested by origin-pages/exam.html `syncExamConfig`: the page gates
         * on `status === "success" && data.config` and reads `examDuration`,
         * `activeExamType`, `currentTerm`, `currentMode`, `academicYear`.
         */
        config: PortalConfig;
        /** Read in the mode chain after the hallway's stored mode. */
        effectiveMode?: ExamMode;
      }>;
  };
  GET_DEMOTION_LOGS: {
    req: { schoolID: string };
    res: ApiEnvelope &
      Success<{
        logs: DemotionLog[];
        /** `counts[RegNo]` — repeated-demotion tally, read beside the array. */
        counts?: Record<string, number>;
      }>;
  };

  /* ── notifications, calendar and notices (D-64) — reads ───────────── */

  /**
   * One notification list for the current operator. `username` and `role` are
   * both optional because a notification can be addressed to a single account,
   * to a whole role, or to the whole portal, and the read has to return all
   * three. `category` narrows the list the way the reference application's
   * filter tabs do.
   */
  GET_NOTIFICATIONS: {
    req: { schoolID?: string; username?: string; role?: string; category?: NoticeCategory };
    res: ApiEnvelope &
      Success<{
        notifications: PortalNotification[];
        unread: number;
        counts?: Record<string, number>;
      }>;
  };
  /** The academic sessions and the events inside them. */
  GET_ACADEMIC_CALENDAR: {
    req: { schoolID?: string; year?: string };
    res: ApiEnvelope &
      Success<{
        events: CalendarEvent[];
        sessions?: string[];
      }>;
  };
  /** The notice board, narrowed to what this operator is allowed to read. */
  GET_NOTICES: {
    req: { schoolID?: string; role?: string };
    res: ApiEnvelope & Success<{ notices: NoticeBoardItem[] }>;
  };

  /**
   * The signed-in operator's roles and permissions (D-71).
   *
   * This is the mock's counterpart of the reference implementation's
   * `GET /auth/me`: the one call a session re-reads on every navigation and
   * every thirty seconds so that a role change reaches the rail without a
   * re-login. The mock resolves it from the role's default grant unioned with
   * any stored override, which is why a fresh session never renders empty.
   */
  GET_MY_PERMISSIONS: {
    req: { username?: string; role?: string };
    res: ApiEnvelope &
      Success<{
        username: string;
        name: string;
        schoolID: string;
        role: AdminRole;
        permissions: string[];
      }>;
  };

  /* ── question authoring lifecycle (addendum, D-54) — reads ──────────── */

  /** A teacher's own papers, whatever state they are in. */
  GET_MY_SUBMISSIONS: {
    req: { schoolID: string; teacherUsername: string };
    res: ApiEnvelope &
      Success<{
        submissions: QuestionSubmissionRecord[];
        counts?: Record<QuestionStatus, number>;
      }>;
  };
  /** The review team's queue, with a tally per state. */
  GET_REVIEW_QUEUE: {
    req: { schoolID: string; status?: QuestionStatus };
    res: ApiEnvelope &
      Success<{
        submissions: QuestionSubmissionRecord[];
        counts?: Record<QuestionStatus, number>;
      }>;
  };
  /** Decision notices addressed to one teacher. */
  GET_TEACHER_NOTICES: {
    req: { schoolID: string; teacherUsername: string };
    res: ApiEnvelope & Success<{ notices: TeacherNotice[]; unread: number }>;
  };

  /* ── St Finbarr's teacher portal (D-72) — reads ─────────────────────────
   * One action per origin endpoint. LAEC's contract speaks `schoolID` +
   * `teacherUsername` rather than HTTP paths, so the origin's URL segments
   * become request fields; see docs/teacher-portal/api-map.md for the table
   * that pairs each of these with the endpoint it stands for.
   */

  GET_TEACHER_DASHBOARD: {
    req: { schoolID: string; teacherUsername: string };
    res: ApiEnvelope & Success<{ counts: TeacherDashboardCounts }>;
  };
  GET_LESSON_PLANS: {
    req: {
      schoolID: string;
      teacherUsername: string;
      status?: LessonPlanStatus;
      search?: string;
    };
    res: ApiEnvelope &
      Success<{
        plans: LessonPlan[];
        counts?: Partial<Record<LessonPlanStatus, number>>;
      }>;
  };
  /** The review inbox. `assignedToMeOnly` is the origin's Review Inbox mode. */
  GET_LESSON_PLAN_QUEUE: {
    req: {
      schoolID: string;
      reviewerUsername: string;
      status?: LessonPlanStatus;
      search?: string;
      assignedToMe?: boolean;
    };
    res: ApiEnvelope & Success<{ plans: LessonPlan[] }>;
  };
  GET_WEEKLY_REPORTS: {
    req: { schoolID: string; teacherUsername: string; status?: WeeklyReportStatus };
    res: ApiEnvelope & Success<{ reports: WeeklyReport[] }>;
  };
  GET_WEEKLY_REPORT_QUEUE: {
    req: {
      schoolID: string;
      reviewerUsername: string;
      status?: WeeklyReportStatus;
      search?: string;
    };
    res: ApiEnvelope & Success<{ reports: WeeklyReport[] }>;
  };
  GET_CLASS_TEACHER_REPORTS: {
    req: { schoolID: string; teacherUsername: string; status?: ClassTeacherReportStatus };
    res: ApiEnvelope & Success<{ reports: ClassTeacherReport[] }>;
  };
  /** Classes this teacher is the class teacher of — the report's class picker. */
  GET_MY_CLASS_TEACHING: {
    req: { schoolID: string; teacherUsername: string };
    res: ApiEnvelope & Success<{ classes: ReferenceClass[] }>;
  };
  GET_ATTENDANCE_PREVIEW: {
    req: { schoolID: string; className: string; from: string; to: string };
    /** `preview` is absent on the error branch, which carries only `{status, message}`. */
    res: Partial<Success<{ preview: AttendancePreview }>> & ApiEnvelope;
  };
  GET_CLASS_TEACHER_SUPERIORS: {
    req: { schoolID: string };
    res: ApiEnvelope & Success<{ superiors: LeadershipEntry[] }>;
  };
  GET_LEAVE_REQUESTS: {
    req: {
      schoolID: string;
      teacherUsername: string;
      status?: LeaveStatus;
      search?: string;
    };
    res: ApiEnvelope & Success<{ requests: LeaveRequest[] }>;
  };
  GET_HR_QUERIES: {
    req: { schoolID: string; teacherUsername: string; status?: QueryStatus; search?: string };
    res: ApiEnvelope & Success<{ queries: HrQuery[] }>;
  };
  GET_COUNSELLING_COMMITTEES: {
    req: { schoolID: string };
    res: ApiEnvelope & Success<{ committees: CounsellingCommittee[] }>;
  };
  GET_COUNSELLING_CASES: {
    req: {
      schoolID: string;
      search?: string;
      status?: CounsellingStatus;
      sessionId?: string;
    };
    res: ApiEnvelope & Success<{ cases: CounsellingCase[] }>;
  };
  GET_COUNSELLING_REPORTS: {
    req: { schoolID: string; search?: string; status?: CounsellingReportStatus };
    res: ApiEnvelope & Success<{ reports: CounsellingReport[] }>;
  };
  GET_DISCIPLINARY_INCIDENT_TYPES: {
    req: { schoolID: string };
    res: ApiEnvelope & Success<{ incidentTypes: DisciplinaryIncidentType[] }>;
  };
  GET_DISCIPLINARY_COMMITTEES: {
    req: { schoolID: string };
    res: ApiEnvelope & Success<{ committees: DisciplinaryCommittee[] }>;
  };
  GET_DISCIPLINARY_CASES: {
    req: {
      schoolID: string;
      search?: string;
      status?: DisciplinaryCaseStatus;
      caseTypeId?: string;
      sessionId?: string;
    };
    res: ApiEnvelope & Success<{ cases: DisciplinaryCase[] }>;
  };
  /** Reviewer / recipient picker. Excludes the caller, as the origin does. */
  GET_TEACHER_DIRECTORY: {
    req: { schoolID: string; requesterUsername: string; search?: string };
    res: ApiEnvelope &
      Success<{
        staff: TeacherDirectoryEntry[];
        classes: ReferenceClass[];
        sessions: ReferenceSession[];
      }>;
  };
  GET_TEACHER_CONVERSATIONS: {
    req: { schoolID: string; teacherUsername: string };
    res: ApiEnvelope & Success<{ conversations: Conversation[] }>;
  };
  GET_TEACHER_MESSAGES: {
    req: { schoolID: string; conversationId: string };
    res: ApiEnvelope & Success<{ messages: ChatMessage[] }>;
  };
  GET_SCHOOL_EVENTS: {
    req: { schoolID: string };
    res: ApiEnvelope & Success<{ events: SchoolEvent[] }>;
  };
  GET_MY_PROFILE: {
    req: { schoolID: string; username: string };
    res: ApiEnvelope & Success<{ profile: TeacherProfile }>;
  };

  /* ── Write operations (POST) — 27 ───────────────────────────────────── */

  SUBMIT_EXAM_RESULT: {
    req: { result: ExamResultSubmission };
    res: ApiEnvelope;
  };
  END_STUDENT_SESSION: {
    req: { schoolID: string; regNo: string; sessionID: string };
    res: ApiEnvelope;
  };
  UPDATE_STUDENT_SUBJECTS: {
    req: { schoolID: string; regNo: string; subjects: string[]; studentArm?: string };
    res: ApiEnvelope;
  };
  UPDATE_MODE: {
    req: { mode: ExamMode; schoolID?: string };
    res: ApiEnvelope;
  };
  UPDATE_PORTAL: {
    req: { active: boolean };
    res: ApiEnvelope;
  };
  UPDATE_EXAM_SETTINGS: {
    req: {
      type: ExamCategory;
      duration: number;
      activePapers: string[];
      livePapers: string[];
      startTime: string;
      endTime: string;
      schoolID?: string;
    };
    res: ApiEnvelope;
  };
  UPDATE_SESSION_CONFIG: {
    req: { year: string; term: ExamTerm; promotionActive: boolean };
    res: ApiEnvelope;
  };
  EXECUTE_PROMOTION: {
    req: {
      /** Promotion lifecycle state; exact values unconfirmed. */
      state: string;
      schoolID?: string;
      specificStudents?: string[];
    };
    res: ApiEnvelope;
  };
  TRIGGER_ARCHIVE: {
    req: { year: string; term: ExamTerm };
    res: ApiEnvelope;
  };
  CREATE_ADMIN_ACCESS: {
    req: {
      schoolID: string;
      fullName: string;
      username: string;
      email: string;
      password: string;
      targetRole: AdminRole;
      creatorUsername: string;
      creatorRole: AdminRole;
      creatorSchoolID: string;
    };
    res: ApiEnvelope;
  };
  DELETE_ADMIN_ACCESS: {
    req: {
      username: string;
      email: string;
      requestorUsername: string;
      requestorRole: AdminRole;
      requestorSchoolID: string;
      schoolID?: string;
    };
    res: ApiEnvelope;
  };
  UPDATE_ADMIN_STATUS: {
    req: { schoolID: string; username: string; newStatus: AdminStatus };
    res: ApiEnvelope;
  };
  REQUEST_ADMIN_PASSWORD_RESET: {
    req: { username: string };
    res: ApiEnvelope;
  };
  CONFIRM_ADMIN_PASSWORD_RESET: {
    req: { username: string; code: string; newPassword: string };
    res: ApiEnvelope;
  };
  SEND_ADMIN_PASSWORD_CHANGED_EMAIL: {
    req: { username: string; newPassword: string; reason: string };
    res: ApiEnvelope;
  };
  BULK_UPLOAD_QUESTIONS: {
    req: {
      schoolID: string;
      testType: string;
      questions: QuestionSubmission[];
      durationMinutes: number;
      assessmentInstruction: string;
      shuffleQuestions?: boolean;
    };
    /** The blast-complete alert interpolates `result.count` verbatim. */
    res: ApiEnvelope & { count?: number };
  };
  UPLOAD_QUESTION_IMAGE: {
    req: { fileName: string; fileType: string; imageBase64: string };
    /** Written into the read-only `#generated-url` field on success. */
    res: ApiEnvelope & { imageUrl?: string };
  };
  ADD_QUESTION: {
    req: {
      mode: ExamMode;
      schoolID: string;
      year: string;
      term: ExamTerm;
      category: ExamCategory;
      question: QuestionSubmission;
    };
    res: ApiEnvelope;
  };
  UPDATE_QUESTION: {
    req: {
      pk: string;
      sk: string;
      mode: ExamMode;
      schoolID: string;
      question: QuestionSubmission;
    };
    res: ApiEnvelope;
  };
  DELETE_QUESTION: {
    req: { pk: string; sk: string; mode: ExamMode; schoolID: string };
    res: ApiEnvelope;
  };
  DELETE_QUESTION_PAPER: {
    req: {
      mode: ExamMode;
      schoolID: string;
      year: string;
      term: ExamTerm;
      category: ExamCategory;
      subject: string;
      studentClass: string;
    };
    res: ApiEnvelope;
  };
  REMARK_STUDENT_RESULTS: {
    req: { records: ResultRecord[] };
    res: ApiEnvelope;
  };
  DELETE_SUBJECT_RESULTS: {
    req: { subject: string; records: ResultRecord[] };
    res: ApiEnvelope;
  };
  DELETE_STUDENT_RESULT: {
    req: { pk: string; sk: string };
    res: ApiEnvelope;
  };
  DELETE_STUDENT: {
    req: { schoolID: string; regNo: string };
    res: ApiEnvelope;
  };
  DELETE_FLAGGED_RESULTS: {
    req: { records: ResultRecord[] };
    res: ApiEnvelope;
  };
  UPDATE_STUDENT_CLASS_ARM: {
    req: { schoolID: string; regNo: string; studentClass: string; studentArm: string };
    res: ApiEnvelope;
  };

  /* ── question authoring lifecycle (addendum, D-54) ──────────────────
   * The origin writes questions unmediated, so none of these exist there.
   * They follow the same verb-first, `schoolID`-scoped shape the observed
   * actions use, and the review decisions take a list so the queue can be
   * worked in groups rather than one paper at a time.
   */

  /** Create or overwrite a teacher's own draft. Never publishes. */
  SAVE_QUESTION_SUBMISSION: {
    req: {
      schoolID: string;
      submissionId?: string;
      subject: string;
      class: string;
      term: ExamTerm;
      category: ExamCategory;
      questions: Question[];
      teacherUsername: string;
      teacherName: string;
    };
    res: Partial<Success<{ submission: QuestionSubmissionRecord; message: string }>> & ApiEnvelope;
  };
  /** Draft → PENDING_REVIEW. */
  SUBMIT_QUESTION_FOR_REVIEW: {
    req: { schoolID: string; submissionId: string; teacherUsername: string };
    res: Partial<Success<{ submission: QuestionSubmissionRecord; message: string }>> & ApiEnvelope;
  };
  /** PENDING_REVIEW → LIVE, which is what publishes the questions. */
  ACCEPT_QUESTION_SUBMISSION: {
    req: {
      schoolID: string;
      submissionIds: string[];
      reviewerUsername: string;
      note?: string;
    };
    res: Partial<Success<{ accepted: number; message: string }>> & ApiEnvelope;
  };
  /** PENDING_REVIEW → REJECTED, which leaves the questions unpublished. */
  REJECT_QUESTION_SUBMISSION: {
    req: {
      schoolID: string;
      submissionIds: string[];
      reviewerUsername: string;
      note: string;
    };
    res: Partial<Success<{ rejected: number; message: string }>> & ApiEnvelope;
  };
  /** Raised by the review decision, mirroring how the origin notifies by action. */
  SEND_QUESTION_DECISION_EMAIL: {
    req: {
      schoolID: string;
      teacherUsername: string;
      teacherEmail: string;
      submissionId: string;
      decision: 'ACCEPTED' | 'REJECTED';
      note?: string;
    };
    res: ApiEnvelope;
  };

  /* ── St Finbarr's ADMIN portal — reads ──────────────────────────────────
   * One action per origin endpoint family, named for what it does rather than
   * for the URL segment it stands for. `docs/saint-finbarrs-admin/api-observations.md`
   * pairs each of these with the origin call it replaces.
   *
   * `resource` is the registry key from `types/admin-registry.ts`; the generic
   * list/read/write engine is deliberately resource-parameterised because the
   * origin serves 40+ list endpoints that differ only in their path.
   */

  /** Any registry resource, filtered, searched, sorted and paged. */
  LIST_ADMIN_RECORDS: {
    req: {
      resource: string;
      search?: string;
      filters?: Record<string, string>;
      sort?: string;
      dir?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    };
    res: ApiEnvelope &
      Success<{
        records: Array<Record<string, unknown> & { id: string }>;
        total: number;
        page: number;
        limit: number;
      }>;
  };
  GET_ADMIN_RECORD: {
    req: { resource: string; id: string };
    res: Partial<Success<{ record: Record<string, unknown> & { id: string } }>> & ApiEnvelope;
  };
  /** The role × permission grid behind `/permissions` and the role form. */
  GET_ADMIN_PERMISSION_MATRIX: {
    req: { scope?: 'role' | 'user'; search?: string; page?: number; limit?: number };
    res: ApiEnvelope &
      Success<{
        permissions: Array<{ id: string; module: string; key: string; label: string }>;
        rows: Array<{ id: string; name: string; description: string; users: number; permissionIds: string[] }>;
        total?: number;
      }>;
  };
  GET_ADMIN_DASHBOARD: {
    req: { schoolID?: string };
    res: ApiEnvelope &
      Success<{
        sections: import('../types/admin').DashboardSection[];
        quickActions: import('../types/admin').QuickAction[];
        greeting: string;
        roleLabel: string;
        schoolName: string;
        academicSession: string;
        school: { id: string; name: string; address: string; email: string; phone: string };
      }>;
  };
  /** The option lists the registry's `optionsSource` fields name. */
  GET_ADMIN_OPTION_LIST: {
    req: { key: string; search?: string };
    res: ApiEnvelope & Success<{ options: Array<{ value: string; label: string }> }>;
  };
  GET_ADMIN_ATTENDANCE_SHEETS: {
    req: { category?: 'staff' | 'student'; classId?: string };
    res: ApiEnvelope & Success<{ sheets: import('../types/admin').AttendanceSheet[] }>;
  };
  GET_ADMIN_ATTENDANCE_REPORT: {
    req: {
      scope?: 'staff' | 'student';
      className?: string;
      departmentName?: string;
      search?: string;
      from?: string;
      to?: string;
    };
    res: ApiEnvelope &
      Success<{
        rows: import('../types/admin').AttendanceReportRow[];
        totals: Record<string, number>;
        weeks: number;
      }>;
  };
  GET_ADMIN_RESULT_ENTRY_CONTEXT: {
    req: { className?: string; academicSession?: string; term?: string };
    res: ApiEnvelope &
      Success<{
        className: string;
        academicSession: string;
        term: string;
        rows: import('../types/admin').ResultEntryRow[];
        grading: import('../types/admin').GradingSettings;
        classPopulation: number;
      }>;
  };
  GET_ADMIN_WALLET_REPORTS: {
    req: { schoolID?: string };
    res: ApiEnvelope &
      Success<{
        liability: number;
        funded: number;
        spent: number;
        active: number;
        confirmed: number;
        transactions: import('../types/admin').WalletTransaction[];
      }>;
  };
  GET_ADMIN_FEE_REPORTS: {
    req: { academicSession?: string; term?: string };
    res: ApiEnvelope &
      Success<{
        collected: number;
        payments: number;
        pending: number;
        byCategory: Array<{ name: string; amount: number }>;
      }>;
  };
  GET_ADMIN_FEE_BREAKDOWN: {
    req: { className?: string; academicSession?: string; term?: string };
    res: ApiEnvelope &
      Success<{
        rows: import('../types/admin').FeeItem[];
        total: number;
        paid: number;
        payments: import('../types/admin').FeePayment[];
      }>;
  };
  GET_ADMIN_INVENTORY_REPORTS: {
    req: { schoolID?: string };
    res: ApiEnvelope &
      Success<{
        totalItems: number;
        stockValue: number;
        low: number;
        out: number;
        releasedSales: number;
        revenue: number;
        pendingSales: number;
        assets: number;
        movements: Array<Record<string, unknown>>;
        salesByStatus: Array<{ status: string; count: number }>;
      }>;
  };
  GET_ADMIN_INVENTORY_SETTINGS: {
    req: { schoolID?: string };
    res: ApiEnvelope & Success<{ settings: import('../types/admin').InventorySettings }>;
  };
  GET_ADMIN_CART: {
    req: { username: string };
    res: ApiEnvelope & Success<{ lines: Array<Record<string, unknown>> }>;
  };
  GET_ADMIN_GENERAL_SETTINGS: {
    req: { schoolID?: string };
    res: ApiEnvelope & Success<{ settings: import('../types/admin').GeneralSettings }>;
  };
  GET_ADMIN_SYSTEM_CONFIGURATION: {
    req: { schoolID?: string };
    res: ApiEnvelope & Success<{ settings: import('../types/admin').SystemConfiguration }>;
  };
  GET_ADMIN_BRANDING: {
    req: { schoolID?: string };
    res: ApiEnvelope & Success<{ settings: import('../types/admin').BrandingSettings }>;
  };

  /* ── St Finbarr's ADMIN portal — writes ───────────────────────────────── */

  /** Create (`id` absent) or overwrite a registry record. */
  SAVE_ADMIN_RECORD: {
    req: {
      resource: string;
      id?: string;
      record: Record<string, unknown>;
      /** Who made the change. Stamped into the audit log by the mock. */
      actor?: string;
    };
    res: Partial<Success<{ record: Record<string, unknown> & { id: string } }>> & ApiEnvelope;
  };
  DELETE_ADMIN_RECORD: {
    req: { resource: string; id: string; actor?: string };
    res: ApiEnvelope;
  };
  /** Approve / reject / resolve, across leave, queries and any other workflow. */
  ADMIN_DECIDE: {
    req: { resource: string; id: string; decision: string; comment?: string; actor?: string };
    res: Partial<Success<{ record: Record<string, unknown> }>> & ApiEnvelope;
  };
  ADMIN_SET_STATUS: {
    req: { resource: string; id: string; status: string; actor?: string };
    res: Partial<Success<{ record: Record<string, unknown> }>> & ApiEnvelope;
  };
  RESEND_INVITATION: {
    req: { userIds: string[] };
    res: ApiEnvelope;
  };

  SAVE_ADMIN_ROLE: {
    req: {
      id?: string;
      name: string;
      description?: string;
      permissionIds: string[];
      actor?: string;
    };
    res: Partial<Success<{ role: import('../types/admin').PortalRole }>> & ApiEnvelope;
  };
  ASSIGN_ROLE: {
    req: { role: string; userIds: string[]; actor?: string };
    res: ApiEnvelope;
  };
  UNASSIGN_ROLE: {
    req: { role: string; userIds: string[]; actor?: string };
    res: ApiEnvelope;
  };
  SAVE_ADMIN_PERMISSION_GRANT: {
    req: { scope: 'role' | 'user'; id: string; permissionIds: string[]; actor?: string };
    res: ApiEnvelope;
  };

  IMPORT_STAFF: {
    req: { fileName?: string };
    res: ApiEnvelope & Success<{ step: number; headers: string[]; required: string[]; optional: string[] }>;
  };
  IMPORT_STUDENTS: {
    req: { fileName?: string };
    res: ApiEnvelope & Success<{ step: number; headers: string[]; required: string[]; optional: string[] }>;
  };
  CONFIRM_IMPORT: {
    req: { resource: 'staff' | 'students'; rows: Array<Record<string, unknown>> };
    res: ApiEnvelope;
  };

  SAVE_ATTENDANCE_SHEET: {
    req: {
      sheetId?: string;
      category?: 'staff' | 'student';
      title?: string;
      term?: string;
      academicSession?: string;
      classId?: string;
      className?: string;
      week?: { label?: string; date?: string; marks?: Record<string, import('../types/admin').AttendanceMark> };
      actor?: string;
    };
    res: Partial<Success<{ sheet: import('../types/admin').AttendanceSheet }>> & ApiEnvelope;
  };
  SAVE_ATTENDANCE_MARKS: {
    req: {
      sheetId: string;
      weekId: string;
      marks: Record<string, import('../types/admin').AttendanceMark>;
      actor?: string;
    };
    res: Partial<Success<{ sheet: import('../types/admin').AttendanceSheet; updated: number }>> & ApiEnvelope;
  };

  SAVE_UPLOAD_WINDOW: {
    req: {
      id?: string;
      title: string;
      academicSession: string;
      term: string;
      startsAt: string;
      endsAt: string;
      teacherIds: string[];
      actor?: string;
    };
    res: Partial<Success<{ window: Record<string, unknown> }>> & ApiEnvelope;
  };
  SET_UPLOAD_WINDOW_STATUS: {
    req: { id: string; status: 'OPEN' | 'CLOSED'; actor?: string };
    res: Partial<Success<{ window: Record<string, unknown> }>> & ApiEnvelope;
  };
  SAVE_RESULT_ENTRIES: {
    req: { className: string; rows: import('../types/admin').ResultEntryRow[]; actor?: string };
    res: ApiEnvelope;
  };
  /** `TAG` | `VET` | `PUBLISH` | `DECLINE` | `REVIEW`. */
  DECIDE_RESULT: {
    req: { id: string; decision: string; note?: string; actor?: string };
    res: Partial<Success<{ item: Record<string, unknown> }>> & ApiEnvelope;
  };
  SAVE_GRADING_SETTINGS: {
    req: {
      bands: import('../types/admin').GradingSettings['bands'];
      passMark: number;
      actor?: string;
    };
    res: Partial<Success<{ settings: import('../types/admin').GradingSettings }>> & ApiEnvelope;
  };

  ADJUST_WALLET: {
    req: {
      walletId: string;
      kind: 'TOPUP' | 'DEDUCT';
      amount: number;
      note?: string;
      /**
       * How a deduction was made — `SPEND` (an expense) or `WITHDRAW` (cash out).
       * The origin's adjust dialog offers this only when deducting and sends it
       * only in that case (`wallet-adjust-dialog.tsx`), so it is optional and a
       * top-up does not carry it.
       */
      spendKind?: string;
      actor?: string;
    };
    res: Partial<Success<{ wallet: Record<string, unknown> }>> & ApiEnvelope;
  };
  /**
   * Add to the cart.
   *
   * Non-partial on purpose: the mock answers every success with the new cart,
   * and an add that reported success without the cart to show would leave the
   * caller with no way to learn whether the line had merged into an existing
   * one or started a new one.
   */
  ADD_TO_CART: {
    req: { stockItemId: string; quantity?: number };
    res: Success<{ cart: import('../types/admin').StoreCart }> & ApiEnvelope;
  };

  /* ── store checkout ──────────────────────────────────────────────────── */

  /**
   * Read the cart.
   *
   * A GET, and a distinct one: the live `/store/cart` is its own endpoint rather
   * than the item grid filtered by some flag, so there is no collection to list
   * it by. Reading the grid and treating an empty grid as an empty cart would be
   * the one shortcut that reports an empty store as an empty basket.
   */
  GET_CART: {
    req: Record<string, never>;
    res: Success<{ cart: import('../types/admin').StoreCart }> & ApiEnvelope;
  };

  /** Set one line's quantity. PATCH `/store/cart/:id` on the live origin. */
  UPDATE_CART_ITEM: {
    req: { stockItemId: string; quantity: number };
    res: Success<{ cart: import('../types/admin').StoreCart }> & ApiEnvelope;
  };

  /** Drop one line. DELETE `/store/cart/:id` on the live origin. */
  REMOVE_CART_ITEM: {
    req: { stockItemId: string };
    res: Success<{ cart: import('../types/admin').StoreCart }> & ApiEnvelope;
  };

  /**
   * Checkout: place an order from the cart and clear it.
   *
   * The live store posts to `/store/checkout` and receives the created order. It
   * is a real transaction — the order lands in the bursary queue as
   * AWAITING_PAYMENT — and it is what `ADD_TO_CART` is not.
   */
  PLACE_STORE_ORDER: {
    req: {
      lines: Array<{ stockItemId: string; quantity: number }>;
      paymentMethod?: 'ONLINE' | 'BURSARY';
      actor?: string;
    };
    res: Success<{ order: import('../types/admin').StoreOrder }> & ApiEnvelope;
  };

  /**
   * The bursary confirming an order it has taken cash or a transfer for.
   *
   * The live queue detail refuses an empty reference with "Payment reference is
   * required." before issuing anything \u2014 reproduced verbatim.
   */
  CONFIRM_STORE_ORDER: {
    req: { id: string; paymentMethod?: string; paymentRef: string; actor?: string };
    res: Success<{ order: import('../types/admin').StoreOrder }> & ApiEnvelope;
  };

  /**
   * Resolving a refund request, optionally with a receipt.
   *
   * Both fields are optional in the live queue (`refundNote`,
   * `refundReceiptUrl`), so a refund can be resolved with neither.
   */
  RESOLVE_STORE_REFUND: {
    req: { id: string; refundNote?: string; refundReceiptUrl?: string; actor?: string };
    res: Success<{ order: import('../types/admin').StoreOrder }> & ApiEnvelope;
  };

  /* ── disciplinary ────────────────────────────────────────────────────── */

  /**
   * Create or edit a committee, and manage its seats.
   *
   * `members` is the full desired membership rather than an add/remove pair,
   * because the live committee editor lets an operator set each member's seat
   * (CHAIR or MEMBER) and re-saving the list is the only operation that covers
   * both adding and changing one.
   */
  /** The live launch form. `studentId` and `caseTypeId` are the two it cannot do without. */

  /* ── counselling ─────────────────────────────────────────────────────── */

  /** The live book form. The reason for referral is what it cannot do without. */
  /** Create or update a report. A case must be named; the narratives may be blank while it is a draft. */

  RECORD_FEE_PAYMENT: {
    req: {
      studentId: string;
      amount: number;
      method?: string;
      academicSession?: string;
      term?: string;
      actor?: string;
    };
    res: Partial<Success<{ payment: import('../types/admin').FeePayment }>> & ApiEnvelope;
  };

  SAVE_INVENTORY_SETTINGS: {
    req: { defaultReorderLevel: number; actor?: string };
    res: Partial<Success<{ settings: import('../types/admin').InventorySettings }>> & ApiEnvelope;
  };
  SAVE_STOCK_MOVEMENT: {
    req: { stockItemId: string; quantity: number; actor?: string };
    res: Partial<Success<{ record: Record<string, unknown> }>> & ApiEnvelope;
  };

  PUBLISH_ADMIN_NOTICE: {
    req: {
      id?: string;
      title: string;
      body: string;
      audience: string;
      pinned?: boolean;
      published?: boolean;
      authorName?: string;
      actor?: string;
    };
    res: Partial<Success<{ notice: Record<string, unknown> }>> & ApiEnvelope;
  };
  PUBLISH_ADMIN_EVENT: {
    req: {
      title: string;
      description?: string;
      location?: string;
      startsAt: string;
      endsAt?: string;
      category?: string;
      audience?: string;
      allDay?: boolean;
      actor?: string;
    };
    res: Partial<Success<{ event: Record<string, unknown> }>> & ApiEnvelope;
  };

  SAVE_GENERAL_SETTINGS: {
    req: { settings: import('../types/admin').GeneralSettings; actor?: string };
    res: Partial<Success<{ settings: import('../types/admin').GeneralSettings }>> & ApiEnvelope;
  };
  SAVE_SYSTEM_CONFIGURATION: {
    req: { settings: import('../types/admin').SystemConfiguration; actor?: string };
    res: Partial<Success<{ settings: import('../types/admin').SystemConfiguration }>> & ApiEnvelope;
  };
  SAVE_ADMIN_BRANDING: {
    req: { settings: import('../types/admin').BrandingSettings; actor?: string };
    res: Partial<Success<{ settings: import('../types/admin').BrandingSettings }>> & ApiEnvelope;
  };
  SAVE_FEATURE_TOGGLE: {
    req: { id: string; enabled?: boolean; actor?: string };
    res: Partial<Success<{ record: Record<string, unknown> }>> & ApiEnvelope;
  };
  CREATE_BACKUP: {
    req: { actor?: string };
    res: Partial<Success<{ backup: import('../types/admin').BackupRecord }>> & ApiEnvelope;
  };

  /* ── St Finbarr's teacher portal (D-72) — writes ──────────────────────── */

  /**
   * Create or update a lesson plan. `status` is part of the payload because the
   * origin's "Save Draft" and "Save & Submit" are the same PATCH with a
   * different status — there is no separate create-for-draft endpoint.
   */
  SAVE_LESSON_PLAN: {
    req: {
      schoolID: string;
      planId?: string;
      /** Ownership and the review fields are the store's business, not the caller's. */
      plan: Omit<LessonPlan, 'id' | 'status' | 'teacherUsername'>;
      /** The session's author. The store refuses an edit from anybody else. */
      teacherUsername: string;
      status: Extract<LessonPlanStatus, 'draft' | 'pending'>;
    };
    res: Partial<Success<{ plan: LessonPlan }>> & ApiEnvelope;
  };
  DELETE_LESSON_PLAN: {
    req: { schoolID: string; planId: string; teacherUsername: string };
    res: ApiEnvelope;
  };
  /** draft → pending. `reviewerUsername` omitted means "any authorised reviewer". */
  SUBMIT_LESSON_PLAN: {
    req: { schoolID: string; planId: string; reviewerUsername?: string };
    res: Partial<Success<{ plan: LessonPlan }>> & ApiEnvelope;
  };
  /** pending → approved | rejected. The origin's `remark` is optional. */
  REVIEW_LESSON_PLAN: {
    req: {
      schoolID: string;
      planId: string;
      decision: 'approved' | 'rejected';
      remark?: string;
      signature?: string;
      signatureStyle?: SignatureStyle;
    };
    res: Partial<Success<{ plan: LessonPlan }>> & ApiEnvelope;
  };

  SAVE_WEEKLY_REPORT: {
    req: {
      schoolID: string;
      reportId?: string;
      /** The store owns the H.O.D comment fields; the caller sends the body only. */
      report: Omit<WeeklyReport, 'id' | 'status' | 'hodComment' | 'hodReviewedBy' | 'hodReviewedAt'>;
      status: Extract<WeeklyReportStatus, 'draft' | 'submitted'>;
    };
    res: Partial<Success<{ report: WeeklyReport }>> & ApiEnvelope;
  };
  DELETE_WEEKLY_REPORT: {
    req: { schoolID: string; reportId: string };
    res: ApiEnvelope;
  };
  SUBMIT_WEEKLY_REPORT: {
    req: { schoolID: string; reportId: string; reviewerUsername?: string };
    res: Partial<Success<{ report: WeeklyReport }>> & ApiEnvelope;
  };
  /**
   * `level: 'hod'` records a comment and leaves the report `submitted`;
   * `level: 'head'` additionally finalises it as `reviewed`. `comment` is
   * required by the origin's review form.
   */
  REVIEW_WEEKLY_REPORT: {
    req: {
      schoolID: string;
      reportId: string;
      level: WeeklyReportReviewLevel;
      comment: string;
      signature?: string;
      signatureStyle?: SignatureStyle;
    };
    res: Partial<Success<{ report: WeeklyReport }>> & ApiEnvelope;
  };

  SAVE_CLASS_TEACHER_REPORT: {
    req: {
      schoolID: string;
      reportId?: string;
      report: Omit<ClassTeacherReport, 'id' | 'status'>;
      status: ClassTeacherReportStatus;
    };
    res: Partial<Success<{ report: ClassTeacherReport }>> & ApiEnvelope;
  };
  DELETE_CLASS_TEACHER_REPORT: {
    req: { schoolID: string; reportId: string };
    res: ApiEnvelope;
  };
  SHARE_CLASS_TEACHER_REPORT: {
    req: { schoolID: string; reportId: string; username: string };
    res: Partial<Success<{ shared: boolean }>> & ApiEnvelope;
  };

  APPLY_FOR_LEAVE: {
    req: {
      schoolID: string;
      staffUsername: string;
      staffName: string;
      department: string;
      leaveType: string;
      startDate: string;
      endDate: string;
      days: number;
      reason: string;
    };
    res: Partial<Success<{ request: LeaveRequest }>> & ApiEnvelope;
  };
  DECIDE_LEAVE: {
    req: {
      schoolID: string;
      requestId: string;
      decision: 'APPROVED' | 'REJECTED';
      comment?: string;
    };
    res: Partial<Success<{ request: LeaveRequest }>> & ApiEnvelope;
  };
  DELETE_LEAVE_REQUEST: {
    req: { schoolID: string; requestId: string };
    res: ApiEnvelope;
  };

  RAISE_HR_QUERY: {
    req: {
      schoolID: string;
      title: string;
      description: string;
      issuerUsername: string;
      issuerName: string;
      targetUsername: string;
      targetUserName: string;
      category: string;
      priority: QueryPriority;
    };
    res: Partial<Success<{ query: HrQuery }>> & ApiEnvelope;
  };
  UPDATE_HR_QUERY: {
    req: {
      schoolID: string;
      queryId: string;
      status?: QueryStatus;
      assigneeUsername?: string;
      response?: string;
    };
    res: Partial<Success<{ query: HrQuery }>> & ApiEnvelope;
  };



  /* ── counselling ─────────────────────────────────────────────────────────── */

  SAVE_COUNSELLING_COMMITTEE: {
    req: {
      schoolID: string;
      committeeId?: string;
      committee: Omit<CounsellingCommittee, 'id'>;
    };
    res: Partial<Success<{ committee: CounsellingCommittee }>> & ApiEnvelope;
  };
  DELETE_COUNSELLING_COMMITTEE: {
    req: { schoolID: string; committeeId: string };
    res: ApiEnvelope;
  };
  LAUNCH_COUNSELLING_CASE: {
    req: {
      schoolID: string;
      studentName: string;
      studentUsername: string;
      referredByName: string;
      referralDate: string;
      priority: CounsellingPriority;
      status: CounsellingStatus;
      committeeId: string;
      sessionId: string;
      backgroundInfo: string;
      reasonForReferral: string;
      initialComment: string;
    };
    res: Partial<Success<{ counsellingCase: CounsellingCase }>> & ApiEnvelope;
  };
  /**
   * Remove a counselling case.
   *
   * Admin-only, and deliberately not the teacher console's shape: the deployed
   * `deleteCounsellingCase(id)` takes the case id and nothing else, so it is
   * declared that way here too rather than inheriting the `schoolID` every other
   * teacher-side action carries. The teacher console has no case delete of its
   * own, which is why this is new rather than reused.
   */
  DELETE_COUNSELLING_CASE: {
    req: { caseId: string };
    res: ApiEnvelope;
  };
  UPDATE_COUNSELLING_CASE_STATUS: {
    req: { schoolID: string; caseId: string; status: CounsellingStatus };
    res: Partial<Success<{ counsellingCase: CounsellingCase }>> & ApiEnvelope;
  };
  ADD_COUNSELLING_CASE_COMMENT: {
    req: { schoolID: string; caseId: string; comment: string };
    res: Partial<Success<{ counsellingCase: CounsellingCase }>> & ApiEnvelope;
  };
  SAVE_COUNSELLING_REPORT: {
    req: {
      schoolID: string;
      reportId?: string;
      report: Omit<CounsellingReport, 'id' | 'authorUsername' | 'createdAt'>;
    };
    res: Partial<Success<{ report: CounsellingReport }>> & ApiEnvelope;
  };
  SHARE_COUNSELLING_REPORT: {
    req: { schoolID: string; reportId: string; username: string };
    res: Partial<Success<{ shared: boolean }>> & ApiEnvelope;
  };

  /* ── disciplinary ─────────────────────────────────────────────────────────── */

  SAVE_DISCIPLINARY_INCIDENT_TYPE: {
    req: {
      schoolID: string;
      incidentTypeId?: string;
      title: string;
      description: string;
    };
    res: Partial<Success<{ incidentType: DisciplinaryIncidentType }>> & ApiEnvelope;
  };
  DELETE_DISCIPLINARY_INCIDENT_TYPE: {
    req: { schoolID: string; incidentTypeId: string };
    res: ApiEnvelope;
  };
  SAVE_DISCIPLINARY_COMMITTEE: {
    req: {
      schoolID: string;
      committeeId?: string;
      committee: Omit<DisciplinaryCommittee, 'id'>;
    };
    res: Partial<Success<{ committee: DisciplinaryCommittee }>> & ApiEnvelope;
  };
  DELETE_DISCIPLINARY_COMMITTEE: {
    req: { schoolID: string; committeeId: string };
    res: ApiEnvelope;
  };
  LAUNCH_DISCIPLINARY_CASE: {
    req: {
      schoolID: string;
      studentName: string;
      studentUsername: string;
      caseTypeId: string;
      incidentDate: string;
      location: string;
      severity: CaseSeverity;
      sessionId: string;
      committeeId: string;
      description: string;
      initialComment: string;
    };
    res: Partial<Success<{ disciplinaryCase: DisciplinaryCase }>> & ApiEnvelope;
  };
  UPDATE_DISCIPLINARY_CASE_STATUS: {
    req: { schoolID: string; caseId: string; status: DisciplinaryCaseStatus };
    res: Partial<Success<{ disciplinaryCase: DisciplinaryCase }>> & ApiEnvelope;
  };
  ADD_DISCIPLINARY_CASE_COMMENT: {
    req: { schoolID: string; caseId: string; comment: string };
    res: Partial<Success<{ disciplinaryCase: DisciplinaryCase }>> & ApiEnvelope;
  };
  /**
   * Remove a disciplinary case. Admin-only, and shaped as the deployed
   * `deleteCase(id)` is — the case id alone, no `schoolID`.
   */
  DELETE_DISCIPLINARY_CASE: {
    req: { caseId: string };
    res: ApiEnvelope;
  };
  SHARE_DISCIPLINARY_CASE: {
    req: { schoolID: string; caseId: string; username: string };
    res: Partial<Success<{ shared: boolean }>> & ApiEnvelope;
  };

  SEND_TEACHER_MESSAGE: {
    req: { schoolID: string; conversationId: string; senderUsername: string; body: string };
    res: Partial<Success<{ message: ChatMessage }>> & ApiEnvelope;
  };
  CREATE_TEACHER_CONVERSATION: {
    req: { schoolID: string; requesterUsername: string; username: string };
    res: Partial<Success<{ conversation: Conversation }>> & ApiEnvelope;
  };
  MARK_TEACHER_CONVERSATION_READ: {
    req: { schoolID: string; conversationId: string };
    res: ApiEnvelope;
  };

  UPDATE_TEACHER_PROFILE: {
    req: { schoolID: string; username: string; profile: TeacherProfile };
    res: Partial<Success<{ profile: TeacherProfile }>> & ApiEnvelope;
  };
  PUBLISH_SCHOOL_EVENT: {
    req: {
      schoolID: string;
      title: string;
      description: string;
      location: string;
      startsAt: string;
      endsAt: string;
      category: EventCategory;
      allDay: boolean;
    };
    res: Partial<Success<{ event: SchoolEvent }>> & ApiEnvelope;
  };

  /* ── notifications, calendar and notices (D-64) — writes ────────────── */

  MARK_NOTIFICATION_READ: {
    req: { schoolID?: string; notificationIds: string[] };
    res: Partial<Success<{ updated: number }>> & ApiEnvelope;
  };
  MARK_ALL_NOTIFICATIONS_READ: {
    req: { schoolID?: string; username?: string; role?: string };
    res: Partial<Success<{ updated: number }>> & ApiEnvelope;
  };
  /** Create or update one calendar event. A published exam window is one too. */
  UPSERT_ACADEMIC_EVENT: {
    req: {
      schoolID: string;
      eventId?: string;
      kind: CalendarEvent['Kind'];
      title: string;
      description: string;
      start: string;
      end: string;
      allDay: boolean;
      session?: string;
    };
    res: Partial<Success<{ event: CalendarEvent }>> & ApiEnvelope;
  };
  DELETE_ACADEMIC_EVENT: {
    req: { schoolID: string; eventId: string };
    res: ApiEnvelope;
  };
  PUBLISH_NOTICE: {
    req: {
      schoolID: string;
      title: string;
      body: string;
      audience: NoticeAudience;
      authorUsername: string;
      authorName: string;
      pinned?: boolean;
    };
    res: Partial<Success<{ notice: NoticeBoardItem }>> & ApiEnvelope;
  };
  DELETE_NOTICE: {
    req: { schoolID: string; noticeId: string; requestorUsername: string };
    res: ApiEnvelope;
  };
}

export type ActionName = keyof ApiMap;

/** The 11 read operations (PRD §3.6). */
export const GET_ACTIONS = [
  'GET_CART',
  'GET_PORTAL_STATE',
  'GET_STUDENT_PROFILE',
  'GET_LIVE_SCHEDULE',
  'GET_RESULTS',
  'GET_SECURE_QUESTIONS',
  'GET_QUESTION_INVENTORY',
  'GET_STUDENTS',
  'GET_CONFIG',
  'GET_COGNITO_ADMINS',
  'GET_EXAM_CONFIG',
  'GET_DEMOTION_LOGS',
  // notifications, calendar and notices (D-64)
  'GET_NOTIFICATIONS',
  'GET_ACADEMIC_CALENDAR',
  'GET_NOTICES',
  // the signed-in operator's roles and permissions (D-71)
  'GET_MY_PERMISSIONS',
  // question authoring lifecycle (D-54)
  'GET_MY_SUBMISSIONS',
  'GET_REVIEW_QUEUE',
  'GET_TEACHER_NOTICES',
  // St Finbarr's teacher portal (D-72)
  'GET_TEACHER_DASHBOARD',
  'GET_LESSON_PLANS',
  'GET_LESSON_PLAN_QUEUE',
  'GET_WEEKLY_REPORTS',
  'GET_WEEKLY_REPORT_QUEUE',
  'GET_CLASS_TEACHER_REPORTS',
  'GET_MY_CLASS_TEACHING',
  'GET_ATTENDANCE_PREVIEW',
  'GET_CLASS_TEACHER_SUPERIORS',
  'GET_LEAVE_REQUESTS',
  'GET_HR_QUERIES',
  'GET_COUNSELLING_COMMITTEES',
  'GET_COUNSELLING_CASES',
  'GET_COUNSELLING_REPORTS',
  'GET_DISCIPLINARY_INCIDENT_TYPES',
  'GET_DISCIPLINARY_COMMITTEES',
  'GET_DISCIPLINARY_CASES',
  'GET_TEACHER_DIRECTORY',
  'GET_TEACHER_CONVERSATIONS',
  'GET_TEACHER_MESSAGES',
  'GET_SCHOOL_EVENTS',
  'GET_MY_PROFILE',
  // St Finbarr's admin portal
  'LIST_ADMIN_RECORDS',
  'GET_ADMIN_RECORD',
  'GET_ADMIN_PERMISSION_MATRIX',
  'GET_ADMIN_DASHBOARD',
  'GET_ADMIN_OPTION_LIST',
  'GET_ADMIN_ATTENDANCE_SHEETS',
  'GET_ADMIN_ATTENDANCE_REPORT',
  'GET_ADMIN_RESULT_ENTRY_CONTEXT',
  'GET_ADMIN_WALLET_REPORTS',
  'GET_ADMIN_FEE_REPORTS',
  'GET_ADMIN_FEE_BREAKDOWN',
  'GET_ADMIN_INVENTORY_REPORTS',
  'GET_ADMIN_INVENTORY_SETTINGS',
  'GET_ADMIN_CART',
  'GET_ADMIN_GENERAL_SETTINGS',
  'GET_ADMIN_SYSTEM_CONFIGURATION',
  'GET_ADMIN_BRANDING',
] as const satisfies readonly ActionName[];

/** The 27 write operations (PRD §3.6). */
export const POST_ACTIONS = [
  'SUBMIT_EXAM_RESULT',
  'END_STUDENT_SESSION',
  'UPDATE_STUDENT_SUBJECTS',
  'UPDATE_MODE',
  'UPDATE_PORTAL',
  'UPDATE_EXAM_SETTINGS',
  'UPDATE_SESSION_CONFIG',
  'EXECUTE_PROMOTION',
  'TRIGGER_ARCHIVE',
  'CREATE_ADMIN_ACCESS',
  'DELETE_ADMIN_ACCESS',
  'UPDATE_ADMIN_STATUS',
  'REQUEST_ADMIN_PASSWORD_RESET',
  'CONFIRM_ADMIN_PASSWORD_RESET',
  'SEND_ADMIN_PASSWORD_CHANGED_EMAIL',
  'BULK_UPLOAD_QUESTIONS',
  'UPLOAD_QUESTION_IMAGE',
  'ADD_QUESTION',
  'UPDATE_QUESTION',
  'DELETE_QUESTION',
  'DELETE_QUESTION_PAPER',
  'REMARK_STUDENT_RESULTS',
  'DELETE_SUBJECT_RESULTS',
  'DELETE_STUDENT_RESULT',
  'DELETE_STUDENT',
  'DELETE_FLAGGED_RESULTS',
  'UPDATE_STUDENT_CLASS_ARM',
  // notifications, calendar and notices (D-64)
  'MARK_NOTIFICATION_READ',
  'MARK_ALL_NOTIFICATIONS_READ',
  'UPSERT_ACADEMIC_EVENT',
  'DELETE_ACADEMIC_EVENT',
  'PUBLISH_NOTICE',
  'DELETE_NOTICE',
  // question authoring lifecycle (D-54)
  'SAVE_QUESTION_SUBMISSION',
  'SUBMIT_QUESTION_FOR_REVIEW',
  'ACCEPT_QUESTION_SUBMISSION',
  'REJECT_QUESTION_SUBMISSION',
  'SEND_QUESTION_DECISION_EMAIL',
  // St Finbarr's teacher portal (D-72)
  'SAVE_LESSON_PLAN',
  'DELETE_LESSON_PLAN',
  'SUBMIT_LESSON_PLAN',
  'REVIEW_LESSON_PLAN',
  'SAVE_WEEKLY_REPORT',
  'DELETE_WEEKLY_REPORT',
  'SUBMIT_WEEKLY_REPORT',
  'REVIEW_WEEKLY_REPORT',
  'SAVE_CLASS_TEACHER_REPORT',
  'DELETE_CLASS_TEACHER_REPORT',
  'SHARE_CLASS_TEACHER_REPORT',
  'APPLY_FOR_LEAVE',
  'DECIDE_LEAVE',
  'DELETE_LEAVE_REQUEST',
  'RAISE_HR_QUERY',
  'UPDATE_HR_QUERY',
  // Disciplinary and counselling were built for this console first. The admin
  // panels read these same records and issue these same actions rather than
  // declaring twins — two definitions of one case is how the teacher side and
  // the admin side would come to disagree about it.
  'SAVE_COUNSELLING_COMMITTEE',
  'DELETE_COUNSELLING_COMMITTEE',
  'LAUNCH_COUNSELLING_CASE',
  'UPDATE_COUNSELLING_CASE_STATUS',
  'ADD_COUNSELLING_CASE_COMMENT',
  'DELETE_COUNSELLING_CASE',
  'SAVE_COUNSELLING_REPORT',
  'SHARE_COUNSELLING_REPORT',
  'SAVE_DISCIPLINARY_INCIDENT_TYPE',
  'DELETE_DISCIPLINARY_INCIDENT_TYPE',
  'SAVE_DISCIPLINARY_COMMITTEE',
  'DELETE_DISCIPLINARY_COMMITTEE',
  'LAUNCH_DISCIPLINARY_CASE',
  'UPDATE_DISCIPLINARY_CASE_STATUS',
  'ADD_DISCIPLINARY_CASE_COMMENT',
  'DELETE_DISCIPLINARY_CASE',
  'SHARE_DISCIPLINARY_CASE',
  'SEND_TEACHER_MESSAGE',
  'CREATE_TEACHER_CONVERSATION',
  'MARK_TEACHER_CONVERSATION_READ',
  'UPDATE_TEACHER_PROFILE',
  'PUBLISH_SCHOOL_EVENT',
  // St Finbarr's admin portal
  'SAVE_ADMIN_RECORD',
  'DELETE_ADMIN_RECORD',
  'ADMIN_DECIDE',
  'ADMIN_SET_STATUS',
  'RESEND_INVITATION',
  'SAVE_ADMIN_ROLE',
  'ASSIGN_ROLE',
  'UNASSIGN_ROLE',
  'SAVE_ADMIN_PERMISSION_GRANT',
  'IMPORT_STAFF',
  'IMPORT_STUDENTS',
  'CONFIRM_IMPORT',
  'SAVE_ATTENDANCE_SHEET',
  'SAVE_ATTENDANCE_MARKS',
  'SAVE_UPLOAD_WINDOW',
  'SET_UPLOAD_WINDOW_STATUS',
  'SAVE_RESULT_ENTRIES',
  'DECIDE_RESULT',
  'SAVE_GRADING_SETTINGS',
  'ADJUST_WALLET',
  'ADD_TO_CART',
  'RECORD_FEE_PAYMENT',
  'SAVE_INVENTORY_SETTINGS',
  'SAVE_STOCK_MOVEMENT',
  'PUBLISH_ADMIN_NOTICE',
  'PUBLISH_ADMIN_EVENT',
  'SAVE_GENERAL_SETTINGS',
  'SAVE_SYSTEM_CONFIGURATION',
  'SAVE_ADMIN_BRANDING',
  'SAVE_FEATURE_TOGGLE',
  'CREATE_BACKUP',
  /* Store checkout — see PLACE_STORE_ORDER. */
  'PLACE_STORE_ORDER',
  'CONFIRM_STORE_ORDER',
  'RESOLVE_STORE_REFUND',
  'UPDATE_CART_ITEM',
  'REMOVE_CART_ITEM',
] as const satisfies readonly ActionName[];

export type ApiRequest<A extends ActionName> = ApiMap[A]['req'];
export type ApiResponse<A extends ActionName> = ApiMap[A]['res'];

/** Compile-time proof that GET_ACTIONS + POST_ACTIONS cover the map exactly. */
type ListedActions = (typeof GET_ACTIONS)[number] | (typeof POST_ACTIONS)[number];
type _AssertAllListed = ActionName extends ListedActions ? true : never;
const _assertAllListed: _AssertAllListed = true;
void _assertAllListed;
