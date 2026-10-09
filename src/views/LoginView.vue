<script setup lang="ts">
/**
 * PRD §4.2 — `/login/` — Student CBT Portal.
 *
 * Copy, structure and behaviour ported verbatim from origin-pages/login.html
 * (captured 2026-09-28). Deliberate deviations:
 *  - Transport: typed mock adapter (D-05) — no AWS endpoint is ever called.
 *    GET/POST actions run through `useApiRetry` (RF-98 constants identical
 *    to config.js). GET_SECURE_QUESTIONS is the exception: it calls the REAL
 *    `config.js fetchQuestionSet` with a `fetchImpl` shim, so subject/class
 *    candidate expansion and the Diagnostic Report attempts list remain
 *    byte-authentic.
 *  - Cognito: a real `AuthenticationDetails` object (D-11, no network) is
 *    handed to `mockAuthenticate`; the user pool is never contacted and no
 *    real credentials exist (brief: mock API only).
 *  - Cloudflare challenge markup/scripts omitted (DEV-1). The /laec logo.png
 *    reference is no longer kept broken — the LAEC crest is served and shown
 *    (2026-10-02; see `logoSrc` below).
 *  - Placeholder reg no is `LAEC/SFC/2026/001` as observed on the origin
 *    today (PRD §4.2 transcribes `LAEC/SCH/2026/001` — logged as a PRD
 *    transcription discrepancy).
 *
 * Mock credentials (fictional): LAEC/001/2025/0001 + MockPass1 … 0006;
 * 0007 = graduated, 0008 = promotion migration, 0009 = demotion migration.
 */

import { onMounted, onUnmounted, ref } from 'vue';
import { AuthenticationDetails } from 'amazon-cognito-identity-js';
import { ApiHttpError, callApi, mockAuthenticate } from '../api';
import type { ApiResponse, MockAuthSuccess } from '../api';
import { useApiRetry } from '../composables/useApiRetry';
import { STORAGE_KEYS } from '../types';
import type {
  ExamCategory,
  ExamMode,
  ExamTerm,
  LaecUtils,
  Paper,
  PortalConfig,
  QuestionSetAttempt,
  Student,
} from '../types';

/* ── config.js (loaded in this entry's <head>, origin parity) ─────────── */
/* Cast once, as the original does (`const LAEC = window.LAEC_UTILS`); if the
 * script were missing, calls would throw exactly as they do in the original. */
const LAEC = window.LAEC_UTILS as LaecUtils;
const { call: retry } = useApiRetry();

/* ── module state (per-document in the original) ──────────────────────── */
let loggedInStudent: Student | null = null;
let isPromotionActive = false;
let globalConfig: PortalConfig | null = null;
let portalStatePromise: Promise<boolean> | null = null;
let portalStateSchoolID = '';
let effectiveMode = 'MODE_B';

const studentSessionID =
  sessionStorage.getItem(STORAGE_KEYS.studentSessionID) ||
  `STU_${Date.now()}_${Math.random().toString(36).slice(2)}`;
sessionStorage.setItem(STORAGE_KEYS.studentSessionID, studentSessionID);

type Screen = 'login' | 'offline' | 'migration' | 'subject' | 'graduate';

const screen = ref<Screen>('login');
const cardMaxWidth = ref('360px');
const regId = ref('');
const password = ref('');
const showPassword = ref(false);
const loader = ref(false);
const errorVisible = ref(false);
/** D17 — ships in the markup as "Invalid Credentials. Please try again." */
const errorText = ref('Invalid Credentials. Please try again.');
const alertOpen = ref(false);
const alertTitle = ref('Notification');
const alertMsg = ref('');
const identityOpen = ref(false);
const popPhoto = ref('');
const popName = ref('');
const popClass = ref('');
const congratsMsg = ref('');
const arm = ref('');
const checkedRows = ref<number[]>([]);
const welcomeName = ref('Welcome');
const hallwaySubtitle = ref('Select your scheduled subject to begin:');
const hallwaySubjects = ref<Array<{ subject: string; label: string; completed: boolean }>>([]);
const noLivePanel = ref(false);
const graduateMessage = ref('');
const footerYear = ref('');
const slipName = ref('');
const slipReg = ref('');
const slipClass = ref('');
const slipPass = ref('');
const slipPhoto = ref('');
const slipSubjects = ref('');
const migrationRecordLabel = ref('Academic Migration Record (2025/2026)');

/*
 * D-13 was "reference the origin's `laec logo.png`, which is deliberately not
 * served so the image fails exactly as it does on the live site". Reversed by
 * client instruction (2026-10-02): the LAEC crest is now served as
 * `/laec-crest.png` and shown here, and on every other page that had the
 * deliberately-broken reference. The card was rendering a broken-image glyph
 * where the crest belongs. `public/nicegene_logo.png` remains the generic
 * student-avatar placeholder in the consoles — a different job, untouched.
 */
const logoSrc = '/laec-crest.png';

const ARM_OPTIONS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

/* ── small helpers (verbatim ports) ───────────────────────────────────── */

const msgOf = (e: unknown): string =>
  e instanceof Error
    ? e.message
    : typeof e === 'object' && e !== null && 'message' in e
      ? String((e as { message: unknown }).message)
      : '';

const showWindowAlert = (msg: string, title = 'System Notification'): void => {
  alertMsg.value = msg;
  alertTitle.value = title;
  alertOpen.value = true;
};

const closeWindowAlert = (): void => {
  alertOpen.value = false;
};

const togglePasswordVisibility = (): void => {
  showPassword.value = !showPassword.value;
};

const getStudentSchoolID = (studentRecord: Student | null): string =>
  (studentRecord && (studentRecord.SchoolID || (studentRecord.RegNo && studentRecord.RegNo.split('/')[1]))) || '';

const getStudentArmValue = (studentRecord: Student | null): string =>
  String(
    (studentRecord && (studentRecord.Arm || studentRecord.StudentArm || (studentRecord as Student & { studentArm?: string }).studentArm)) || '',
  ).toUpperCase();

const getStudentSchoolLabel = (student: Student): string =>
  student.SchoolName ||
  student.schoolName ||
  student.School ||
  student.school ||
  student.SchoolID ||
  (student.RegNo && student.RegNo.split('/')[1]) ||
  'your school';

const isGraduatedStudent = (student: Student): boolean =>
  String(student?.Class || '').trim().toUpperCase() === 'GRADUATED';

const resolveEffectiveMode = (payload: ApiResponse<'GET_PORTAL_STATE'>): string => {
  const localMode = String(payload.localMode || '').toUpperCase();
  const configMode = String(payload.config?.currentMode || payload.effectiveMode || '').toUpperCase();
  const globalMode = String(payload.globalMode || '').toUpperCase();
  return configMode || (localMode && localMode !== 'NOT_SET' ? localMode : globalMode) || 'MODE_A';
};

const formatTermLabel = (term: string): string => String(term || 'TERM1').replace('TERM', 'Term ');

const showCompletedSubjectNotice = (subject: string): void => {
  const displayName = LAEC.humanizeSubject(subject);
  const sessionLabel = globalConfig?.academicYear || 'the active academic session';
  const termLabel = formatTermLabel(globalConfig?.currentTerm || 'TERM1');
  /* The wire may carry '#' as activeExamType (observed guard in origin). */
  const categoryLabel =
    globalConfig?.activeExamType && String(globalConfig.activeExamType) !== '#' ? globalConfig.activeExamType : 'EXAM';
  showWindowAlert(
    `You already have a result on ${displayName} for ${sessionLabel}, ${termLabel}, ${categoryLabel}. This subject cannot be taken again, kindly contact the ICT or examination officer.`,
    'Subject Locked',
  );
};

/* ── session helpers ──────────────────────────────────────────────────── */

const startStudentSession = async (studentRecord: Student): Promise<void> => {
  const schoolID = getStudentSchoolID(studentRecord);
  const regNo = studentRecord?.RegNo || '';
  if (!schoolID || !regNo) throw new Error('Missing student session identity.');
  sessionStorage.setItem(STORAGE_KEYS.studentSessionLocked, 'true');
};

const releaseStudentSession = async (): Promise<void> => {
  let activeStudent = loggedInStudent;
  if (!activeStudent) {
    try {
      activeStudent = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.activeStudent) || 'null') as Student | null;
    } catch {
      activeStudent = null;
    }
  }
  const schoolID = getStudentSchoolID(activeStudent);
  const regNo = activeStudent?.RegNo;
  if (!schoolID || !regNo || sessionStorage.getItem(STORAGE_KEYS.studentSessionLocked) !== 'true') return;
  /* Original: bare fetch with .catch — no retry layer (observed). */
  await callApi('END_STUDENT_SESSION', {
    schoolID,
    regNo,
    sessionID: studentSessionID,
  }).catch(() => {});
  sessionStorage.removeItem(STORAGE_KEYS.studentSessionLocked);
};

const studentLogout = async (): Promise<void> => {
  loader.value = true;
  await releaseStudentSession();
  sessionStorage.clear();
  window.location.replace('/login/');
};

/* ── live-window logic (verbatim ports of origin-pages/login.html) ────── */

interface LivePaper {
  Subject: string;
  Class: string;
  StartTime: string;
  EndTime: string;
}

const normalizeLivePaper = (paper: unknown): LivePaper | null => {
  if (!paper) return null;

  if (typeof paper === 'string') {
    const parts = paper
      .split(/::|\||#/)
      .map((part) => String(part || '').trim())
      .filter(Boolean);
    const paperClass = parts.find((part) => /^(JSS|SS)\s*\d$/i.test(part));
    const subjectPart = parts.find(
      (part) => !paperClass || LAEC.normalizeClassValue(part) !== LAEC.normalizeClassValue(paperClass),
    );
    if (!subjectPart || !paperClass) return null;
    return {
      Subject: LAEC.normalizeSubjectValue(subjectPart),
      Class: LAEC.normalizeClassValue(paperClass),
      StartTime: '',
      EndTime: '',
    };
  }

  const p = paper as Partial<Paper>;
  const subject = LAEC.normalizeSubjectValue(p.Subject || p.subject || p.Name || p.name);
  const paperClass = LAEC.normalizeClassValue(
    p.Class || p.class || p.StudentClass || p.studentClass || p.Level || p.level,
  );
  if (!subject || !paperClass) return null;
  return {
    Subject: subject,
    Class: paperClass,
    StartTime: String(p.StartTime || p.startTime || p.liveStartTime || p.start || ''),
    EndTime: String(p.EndTime || p.endTime || p.liveEndTime || p.end || ''),
  };
};

const normalizeScheduleDateInput = (value: unknown): string => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/Z$/i.test(text) || /[+-]\d{2}:\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return `${text}:00+01:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(text)) return `${text}+01:00`;
  return text;
};

const parseScheduleTimeMs = (value: unknown): number => {
  const text = String(value || '').trim();
  if (!text) return Number.NaN;
  return new Date(normalizeScheduleDateInput(text)).getTime();
};

const isPaperLiveNow = (paper: LivePaper, configData: PortalConfig | null): boolean => {
  const now = new Date();
  const nowIso = now.toISOString();
  const startTime = paper.StartTime || configData?.startTime || configData?.liveStartTime || '';
  const endTime = paper.EndTime || configData?.endTime || configData?.liveEndTime || '';
  const startMs = parseScheduleTimeMs(startTime);
  const endMs = parseScheduleTimeMs(endTime);
  if (Number.isFinite(startMs) && now.getTime() < startMs) return false;
  if (Number.isFinite(endMs) && now.getTime() > endMs) return false;
  if (!Number.isFinite(startMs) && startTime && nowIso < startTime) return false;
  if (!Number.isFinite(endMs) && endTime && nowIso > endTime) return false;
  return true;
};

const collectLiveSubjectsForClass = (
  scheduleData: ApiResponse<'GET_LIVE_SCHEDULE'>,
  configData: PortalConfig | null,
  studentClass: string,
): Set<string> => {
  const liveSubjectMap = new Map<string, string>();
  (scheduleData?.activePapers || []).forEach((item) => {
    const paper = normalizeLivePaper(item);
    if (!paper || paper.Class !== studentClass || !isPaperLiveNow(paper, configData)) return;
    liveSubjectMap.set(paper.Subject, paper.Subject);
  });
  return new Set(liveSubjectMap.keys());
};

/* ── portal state ─────────────────────────────────────────────────────── */

const checkPortalState = async (force = false): Promise<boolean> => {
  const currentReg = regId.value || '';
  const schoolID = currentReg.includes('/') ? (currentReg.split('/')[1] ?? '') : 'GLOBAL';
  if (globalConfig && portalStateSchoolID === schoolID && !force) return true;
  if (portalStatePromise && portalStateSchoolID === schoolID && !force) return portalStatePromise;
  portalStateSchoolID = schoolID;
  portalStatePromise = (async () => {
    try {
      const data = await retry(
        'GET_PORTAL_STATE',
        { schoolID },
        { retryLabel: 'Portal state check', retries: 2, timeoutMs: 8000 },
      );
      if (data.status === 'success') {
        globalConfig = data.config ?? null;
        isPromotionActive = data.isPromotionActive === true || data.config?.promotionActive === true;
        effectiveMode = resolveEffectiveMode(data);
        if (data.config?.portalActive === false || data.isOffline === true) {
          /* Observed: login-ui is emptied and hidden, offline-ui shown. The
             subtitle string is identical to the static markup, so binding
             screen state reproduces the DOM effect (v-if clears the
             children; the class toggle hides the container). */
          screen.value = 'offline';
          return false;
        }
        return true;
      }
    } catch {
      console.error('Portal Sync Pending...');
    }
    portalStatePromise = null;
    return false;
  })();
  return portalStatePromise;
};

/* ── login sequence (PRD §4.2 steps 1–6) ──────────────────────────────── */

const handleLogin = async (): Promise<void> => {
  if (typeof AuthenticationDetails !== 'function') {
    showWindowAlert('Security library failed to load. Please refresh the page.', 'Library Error');
    return;
  }

  const isAllowed = await checkPortalState();
  if (screen.value === 'offline') {
    /* PRD §4.2 step 3: once offline-ui replaces login-ui there is nothing to
       authenticate against; the document-level Enter listener can still fire
       handleLogin, and it must be a no-op (the original dereferences the
       cleared #regId and dies — same observable outcome: no login attempt). */
    return;
  }
  if (!isAllowed) {
    showWindowAlert(
      'Could not confirm portal status. Please check the internet connection and try again.',
      'Connection Check Failed',
    );
    return;
  }

  const reg = regId.value.trim().toUpperCase();
  const pass = password.value.trim();

  if (!reg || !pass) {
    errorText.value = 'Please enter your ID and Password.';
    errorVisible.value = true;
    return;
  }

  errorVisible.value = false;
  loader.value = true;

  /* Real Cognito object (D-11), consumed by the mock — no pool contact. */
  const authenticationDetails = new AuthenticationDetails({ Username: reg, Password: pass });

  let result: MockAuthSuccess;
  try {
    result = await mockAuthenticate(authenticationDetails.getUsername(), authenticationDetails.getPassword() ?? '');
  } catch (err) {
    loader.value = false;
    errorText.value = 'Access Denied: ' + (msgOf(err) || 'Invalid Credentials.');
    errorVisible.value = true;
    return;
  }

  try {
    const schoolId = result.payload['custom:SchoolID'] || reg.split('/')[1] || '';
    const data = await retry(
      'GET_STUDENT_PROFILE',
      { schoolID: schoolId, regID: reg },
      { retryLabel: 'Student profile lookup' },
    );

    if (data.status === 'success' && data.student) {
      const student = data.student;
      loggedInStudent = student;

      if (isGraduatedStudent(student)) {
        loader.value = false;
        showGraduateNotice();
        return;
      }

      await startStudentSession(student);
      sessionStorage.setItem(STORAGE_KEYS.activeStudent, JSON.stringify(student));
      sessionStorage.setItem(STORAGE_KEYS.studentToken, result.jwtToken);

      loader.value = false;

      if (isPromotionActive === true || student.RequiresSubjectUpdate === true) {
        showMigrationPicker();
      } else {
        await showSubjectHallway();
      }
    } else {
      throw new Error('Student record not found.');
    }
  } catch (e) {
    /* Original calls cognitoUser.signOut() here — no Cognito user exists
       under mocks, and nothing was written to the pool. */
    sessionStorage.removeItem(STORAGE_KEYS.studentSessionLocked);
    loader.value = false;
    errorText.value = msgOf(e) || 'Security Sync Error: Data retrieval failed.';
    errorVisible.value = true;
  }
};

/* ── graduate path ────────────────────────────────────────────────────── */

const showGraduateNotice = (): void => {
  const student = loggedInStudent!;
  const firstName = (student.FullName || 'Graduate').split(' ')[0] ?? '';
  const schoolLabel = getStudentSchoolLabel(student);
  loader.value = false;
  screen.value = 'graduate';
  cardMaxWidth.value = '380px';
  graduateMessage.value =
    `Congratulations ${firstName} on your graduation as a student of ${schoolLabel}. You no longer have active examination access on this portal as a graduate.`;
};

/* ── migration path (PRD §4.2 migration UI) ───────────────────────────── */

type SubjectRow =
  | { type: 'header'; title: string; val?: never; name?: never }
  | { type: 'subject'; title?: never; val: string; name: string };

const SUBJECT_GROUPS: Array<{ title: string; subjects: string[] }> = [
  {
    title: 'CORE COMPULSORY SUBJECTS',
    subjects: ['MATHEMATICS', 'ENGLISH_LANGUAGE', 'CITIZENSHIP_HERITAGE', 'DIGITAL_TECHNOLOGY', 'CIVIC_EDUCATION', 'CRS', 'NIGERIAN_LANGUAGE'],
  },
  {
    title: 'JUNIOR SECONDARY SUBJECTS (JSS2 & JSS3)',
    subjects: ['ENGLISH_LANGUAGE', 'MATHEMATICS', 'NIGERIAN_LANGUAGE', 'FRENCH', 'INTERMEDIATE_SCIENCE', 'MUSIC', 'FINE_ART', 'BASIC_TECH', 'AGRIC_SCIENCE_JSS', 'HOME_ECONOMICS', 'CIVIC_SECURITY', 'CRS', 'HISTORY', 'NATIONAL_VALUES', 'PRE_VOCATIONAL_STUDIES', 'CCA', 'BASIC_SCIENCE_TECHNOLOGY', 'BUSINESS_STUDIES', 'PHE'],
  },
  {
    title: 'SENIOR SCIENCE & MATHEMATICS',
    subjects: ['BIOLOGY', 'CHEMISTRY', 'PHYSICS', 'FURTHER_MATHEMATICS', 'AGRIC_SCIENCE_SSS', 'PHE', 'GEOGRAPHY', 'TECHNICAL_DRAWING', 'BASIC_ELECTRICITY', 'FOOD_NUTRITION'],
  },
  {
    title: 'SENIOR ARTS & HUMANITIES',
    subjects: ['LITERATURE_IN_ENGLISH', 'GOVERNMENT', 'HISTORY', 'FRENCH', 'YORUBA', 'VISUAL_ARTS', 'MUSIC', 'HOME_MANAGEMENT', 'CRS'],
  },
  {
    title: 'SENIOR COMMERCIAL',
    subjects: ['ECONOMICS', 'COMMERCE', 'FINANCIAL_ACCOUNTING', 'MARKETING', 'FURTHER_MATHEMATICS', 'GOVERNMENT', 'OFFICE_PRACTICE'],
  },
  {
    title: 'TRADE & ENTREPRENEURSHIP',
    subjects: ['SOLAR_PV_INSTALLATION', 'FASHION_DESIGN', 'LIVESTOCK_FARMING', 'BEAUTY_COSMETOLOGY', 'COMPUTER_GSM_REPAIR', 'HORTICULTURE_CROP', 'DATA_PROCESSING', 'CATERING_CRAFT', 'ANIMAL_HUSBANDRY', 'BOOK_KEEPING', 'PHOTOGRAPHY'],
  },
];

const SUBJECT_LABEL_MAP: Record<string, string> = {
  ENGLISH_LANGUAGE: 'ENGLISH LANGUAGE',
  CITIZENSHIP_HERITAGE: 'CITIZENSHIP & HERITAGE STUDIES',
  DIGITAL_TECHNOLOGY: 'DIGITAL TECHNOLOGY (ICT)',
  CIVIC_EDUCATION: 'CIVIC EDUCATION',
  NIGERIAN_LANGUAGE: 'NIGERIAN LANGUAGE (YORUBA/IGBO/HAUSA)',
  YORUBA: 'YORUBA',
  INTERMEDIATE_SCIENCE: 'INTERMEDIATE SCIENCE (B/ SCIENCE)',
  MUSIC: 'MUSIC',
  FINE_ART: 'FINE ART',
  BASIC_TECH: 'BASIC TECH',
  AGRIC_SCIENCE_JSS: 'AGRIC',
  HOME_ECONOMICS: 'HOME ECONOMICS',
  CIVIC_SECURITY: 'CIVIC & SECURITY STUDIES',
  BUSINESS_STUDIES: 'BUSINESS STUDIES',
  HISTORY: 'HISTORY',
  NATIONAL_VALUES: 'NATIONAL VALUES (NVE)',
  CCA: 'CULTURAL & CREATIVE ARTS',
  PHE: 'PHYSICAL & HEALTH EDUCATION',
  BASIC_SCIENCE_TECHNOLOGY: 'BASIC SCIENCE AND TECHNOLOGY (BST)',
  PRE_VOCATIONAL_STUDIES: 'PRE-VOCATIONAL STUDIES (AGRIC/HOME EC)',
  AGRIC_SCIENCE_SSS: 'AGRICULTURAL SCIENCE (SSS)',
  FURTHER_MATHEMATICS: 'FURTHER MATHEMATICS',
  TECHNICAL_DRAWING: 'TECHNICAL DRAWING',
  BASIC_ELECTRICITY: 'BASIC ELECTRICITY',
  FOOD_NUTRITION: 'FOODS AND NUTRITION',
  LITERATURE_IN_ENGLISH: 'LITERATURE IN ENGLISH',
  VISUAL_ARTS: 'VISUAL ARTS',
  HOME_MANAGEMENT: 'HOME MANAGEMENT',
  CRS: 'CHRISTIAN RELIGIOUS STUDIES (CRS)',
  FINANCIAL_ACCOUNTING: 'FINANCIAL ACCOUNTING',
  OFFICE_PRACTICE: 'OFFICE PRACTICE',
  SOLAR_PV_INSTALLATION: 'SOLAR PV INSTALLATION & MAINTENANCE',
  FASHION_DESIGN: 'GARMENT MAKING AND FASHION DESIGNING',
  LIVESTOCK_FARMING: 'LIVESTOCK FARMING',
  BEAUTY_COSMETOLOGY: 'BEAUTY & COSMETOLOGY',
  COMPUTER_GSM_REPAIR: 'COMPUTER HARDWARE & GSM REPAIRS',
  HORTICULTURE_CROP: 'HORTICULTURE',
  DATA_PROCESSING: 'DATA PROCESSING',
  CATERING_CRAFT: 'CATERING CRAFT PRACTICE',
  BOOK_KEEPING: 'BOOK-KEEPING',
};

const getSubjectPickerLabel = (subject: string, groupTitle: string): string => {
  const normalizedSubject = LAEC.normalizeSubjectValue(subject);
  if (normalizedSubject === 'CRS' && String(groupTitle || '').indexOf('SENIOR') > -1) {
    return 'CHRISTIAN RELIGIOUS STUDIES (CRS) (SSS)';
  }
  return SUBJECT_LABEL_MAP[normalizedSubject] || LAEC.humanizeSubject(normalizedSubject);
};

/* Built once per mount — the original rebuilds the same markup per open. */
const subjectData: SubjectRow[] = [];
SUBJECT_GROUPS.forEach((group) => {
  subjectData.push({ type: 'header', title: group.title });
  group.subjects.forEach((subject) => {
    subjectData.push({ type: 'subject', name: getSubjectPickerLabel(subject, group.title), val: subject });
  });
});

/* Rows are tracked by index so duplicate values across groups stay
   independent (querySelectorAll semantics); save() de-duplicates via Set. */
const toggleRow = (index: number): void => {
  checkedRows.value = checkedRows.value.includes(index)
    ? checkedRows.value.filter((i) => i !== index)
    : [...checkedRows.value, index];
};

const showMigrationPicker = (): void => {
  loader.value = false;
  screen.value = 'migration';
  cardMaxWidth.value = '600px';

  const student = loggedInStudent!;
  const fName = student.FullName.split(' ')[0] ?? '';
  const newClass = student.Class;
  const updateReason =
    student.SubjectUpdateReason === 'DEMOTION'
      ? 'Kindly review and update your subjects for this class.'
      : 'Congratulations for making it this far. Kindly select to update your new class subjects.';
  congratsMsg.value = `Welcome to ${newClass}, ${fName}! ${updateReason}`;
  arm.value = getStudentArmValue(student);
  migrationRecordLabel.value = `Academic Migration Record (${(globalConfig && globalConfig.academicYear) || '2025/2026'})`;
  checkedRows.value = [];
};

const saveNewSubjects = async (): Promise<void> => {
  const selectedSet = new Set<string>();
  subjectData.forEach((row, index) => {
    if (row.type === 'subject' && checkedRows.value.includes(index)) selectedSet.add(row.val);
  });
  const selected = Array.from(selectedSet);
  const selectedArm = arm.value;

  if (selected.length === 0) {
    showWindowAlert('Please select your subjects before proceeding.', 'Selection Required');
    return;
  }
  if (!selectedArm) {
    showWindowAlert('Please select your new class arm before proceeding.', 'Arm Required');
    return;
  }
  loader.value = true;
  try {
    const student = loggedInStudent!;
    const schoolId = student.SchoolID || student.PK.split('#')[1] || '';
    const data = await retry(
      'UPDATE_STUDENT_SUBJECTS',
      {
        schoolID: schoolId,
        regNo: student.RegNo,
        subjects: selected,
        studentArm: selectedArm,
      },
      { retryLabel: 'Student subject update' },
    );
    if (data.status !== 'success') throw new Error(data.message);
    student.Arm = selectedArm;
    student.StudentArm = selectedArm;

    loader.value = false;
    popPhoto.value = student.PassportURL || '/nicegene_logo.png';
    popName.value = student.FullName;
    popClass.value = `MIGRATED TO: ${student.Class} ${selectedArm}`;
    identityOpen.value = true;

    slipName.value = student.FullName;
    slipReg.value = student.RegNo;
    slipClass.value = `${student.Class} ${selectedArm}`;
    /* D7/RF-29: plaintext password printed on the slip — as observed. */
    slipPass.value = String(student.Password);
    slipPhoto.value = student.PassportURL || '/nicegene_logo.png';
    slipSubjects.value = selected.map((subject) => LAEC.humanizeSubject(subject)).join(', ');

    setTimeout(() => {
      window.print();
      void (async () => {
        await releaseStudentSession();
        sessionStorage.clear();
        window.location.reload();
      })();
    }, 5000);
  } catch (e) {
    showWindowAlert('Update failed: ' + msgOf(e), 'System Error');
    loader.value = false;
  }
};

/* ── subject hallway (PRD §4.2 steps 9–11) ────────────────────────────── */

const showSubjectHallway = async (): Promise<void> => {
  loader.value = true;

  try {
    if (!globalConfig) {
      await checkPortalState();
    }

    const student = loggedInStudent!;
    const schoolId = student.SchoolID || student.PK.split('#')[1] || '';
    const yearKey = (globalConfig!.academicYear || '2025/2026').replace('/', '-');
    const activeTerm = (globalConfig!.currentTerm || 'TERM1').toUpperCase();
    let activeCat = (globalConfig!.activeExamType || 'EXAM').toUpperCase();
    if (activeCat === '#') activeCat = 'EXAM';

    const currentMode = effectiveMode || 'MODE_A';
    const cleanClass = LAEC.normalizeClassValue(student.Class);

    const [scheduleData, resultData] = await Promise.all([
      retry(
        'GET_LIVE_SCHEDULE',
        {
          schoolID: schoolId,
          class: cleanClass,
          term: activeTerm as ExamTerm,
          year: yearKey,
          category: activeCat as ExamCategory,
          mode: currentMode as ExamMode,
        },
        { retryLabel: 'Live schedule lookup', retries: 2, timeoutMs: 8000 },
      ),
      retry(
        'GET_RESULTS',
        {
          regNo: student.RegNo.trim(),
          year: yearKey,
          term: activeTerm as ExamTerm,
          category: activeCat as ExamCategory,
          mode: currentMode as ExamMode,
          completionOnly: true,
        },
        { retryLabel: 'Completed subjects lookup', retries: 2, timeoutMs: 8000 },
      ),
    ]);

    const liveSubjects = collectLiveSubjectsForClass(scheduleData, globalConfig, cleanClass);

    const completedSubjects = new Set(
      (resultData.results || [])
        .map((r) => LAEC.normalizeSubjectValue(r.Subject))
        .filter(Boolean),
    );

    loader.value = false;
    screen.value = 'subject';
    welcomeName.value = `Hello, ${student.FullName.split(' ')[0] ?? ''}`;

    const studentSubjects = [
      ...new Set(
        (student.Subjects || [])
          .map((sub) => LAEC.normalizeSubjectValue(sub))
          .filter(Boolean),
      ),
    ];

    const visibleSubjects = Array.from(liveSubjects).filter(
      (sub) => studentSubjects.length === 0 || studentSubjects.includes(sub),
    );
    const completedVisibleCount = visibleSubjects.filter((sub) => completedSubjects.has(sub)).length;

    if (visibleSubjects.length === 0) {
      hallwaySubtitle.value = 'Select your scheduled subject to begin:';
      noLivePanel.value = true;
      hallwaySubjects.value = [];
    } else {
      noLivePanel.value = false;
      hallwaySubtitle.value =
        completedVisibleCount > 0
          ? 'Select your scheduled subject to begin. Completed subjects remain locked.'
          : 'Select your scheduled subject to begin:';
      hallwaySubjects.value = visibleSubjects.map((sub) => ({
        subject: sub,
        label: LAEC.humanizeSubject(sub),
        completed: completedSubjects.has(sub),
      }));
    }
  } catch {
    loader.value = false;
    console.error('Hallway Sync Error:');
    showWindowAlert('Sync Error: Could not verify schedule. Please refresh.', 'Connection Error');
  }
};

const onHallwayClick = (item: { subject: string; completed: boolean }): void => {
  if (item.completed) showCompletedSubjectNotice(item.subject);
  else void verifyAndEnter(item.subject);
};

/**
 * fetchImpl shim: config.js's real fetchWithRetry/fetchQuestionSet drives the
 * call (candidate expansion, RF-98 retries), but the request is answered by
 * the typed mock — no network leaves the browser.
 */
const mockFetchImpl = async (url: string): Promise<Response> => {
  const query = new URL(url).searchParams;
  try {
    const data = await callApi('GET_SECURE_QUESTIONS', {
      schoolID: query.get('schoolID') ?? '',
      subject: query.get('subject') ?? '',
      class: query.get('class') ?? '',
      year: query.get('year') ?? '',
      term: (query.get('term') || 'TERM1') as ExamTerm,
      type: (query.get('type') || 'EXAM') as ExamCategory,
      mode: (query.get('mode') || 'MODE_B') as ExamMode,
      regNo: query.get('regNo') ?? undefined,
      noCache: query.get('noCache') !== null,
    });
    return new Response(JSON.stringify(data), {
      status: data.status === 'success' ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const status = e instanceof ApiHttpError ? e.status : 500;
    return new Response(JSON.stringify({ status: 'error', message: msgOf(e) }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

const verifyAndEnter = async (selectedSubject: string): Promise<void> => {
  loader.value = true;
  try {
    const student = loggedInStudent!;
    const schoolId = student.SchoolID || student.PK.split('#')[1] || '';
    const yearKey = (globalConfig!.academicYear || '2025/2026').replace('/', '-');
    const term = (globalConfig!.currentTerm || 'TERM1').toUpperCase();

    let type: string = globalConfig!.activeExamType;
    if (!type || type === '#') type = 'EXAM';

    const normalizedSubject = LAEC.normalizeSubjectValue(selectedSubject);
    const cleanClass = LAEC.normalizeClassValue(student.Class);
    const { data } = await LAEC.fetchQuestionSet({
      /* Mock base — config.js embeds it into the URL the shim parses;
         no real endpoint string is ever constructed (brief: mock API only). */
      baseUrl: 'http://mock.local/students',
      params: {
        action: 'GET_SECURE_QUESTIONS',
        schoolID: schoolId,
        subject: normalizedSubject,
        year: yearKey,
        term,
        type,
        mode: effectiveMode,
        class: cleanClass,
        regNo: student.RegNo,
        noCache: '1',
      },
      fetchImpl: mockFetchImpl,
    });

    if (data.status === 'success' && data.questions && data.questions.length > 0) {
      sessionStorage.setItem(STORAGE_KEYS.selectedSubject, normalizedSubject);
      sessionStorage.setItem(STORAGE_KEYS.currentEffectiveMode, effectiveMode);
      sessionStorage.setItem(STORAGE_KEYS.currentExamCategory, type);
      sessionStorage.setItem(STORAGE_KEYS.currentExamTerm, term);
      sessionStorage.setItem(STORAGE_KEYS.currentExamYear, yearKey);
      window.location.assign('/exam/');
    } else {
      loader.value = false;
      if (data.message) {
        showWindowAlert(data.message, data.completed ? 'Subject Locked' : 'Diagnostic Report');
        return;
      }
      let debugMsg = `Paper Not Found.\n\n`;
      debugMsg += `Target: ${LAEC.humanizeSubject(normalizedSubject)}\n`;
      const attempts = (data.debug?.attempts || []) as QuestionSetAttempt[];
      debugMsg += `Attempts: ${attempts.map((a) => `${a.subject} @ ${a.class}`).join(', ') || 'None'}\n`;
      debugMsg += `Search Path: ${data.debug?.searchedPK || 'Unknown'}\n`;
      debugMsg += `Found in DB: ${data.questions?.length || 0} questions`;

      showWindowAlert(debugMsg, 'Diagnostic Report');
    }
  } catch {
    loader.value = false;
    showWindowAlert('Network error. Could not reach NICEGENE Cloud.', 'Sync Error');
  }
};

/* ── lifecycle ────────────────────────────────────────────────────────── */

const onKeypress = (e: KeyboardEvent): void => {
  if (e.key === 'Enter') void handleLogin();
};

onMounted(() => {
  footerYear.value = String(new Date().getFullYear());
  document.addEventListener('keypress', onKeypress);
  void checkPortalState();
});

onUnmounted(() => {
  document.removeEventListener('keypress', onKeypress);
});
</script>

<template>
  <div class="bubble-field" aria-hidden="true">
    <span class="bubble" style="--size: 72px; --left: 6%; --duration: 19s; --delay: -4s; --drift: 34px;"></span>
    <span class="bubble" style="--size: 46px; --left: 14%; --duration: 15s; --delay: -10s; --drift: -26px;"></span>
    <span class="bubble" style="--size: 118px; --left: 24%; --duration: 24s; --delay: -7s; --drift: 52px;"></span>
    <span class="bubble" style="--size: 58px; --left: 38%; --duration: 17s; --delay: -2s; --drift: -42px;"></span>
    <span class="bubble" style="--size: 92px; --left: 52%; --duration: 22s; --delay: -13s; --drift: 30px;"></span>
    <span class="bubble" style="--size: 40px; --left: 63%; --duration: 14s; --delay: -5s; --drift: -18px;"></span>
    <span class="bubble" style="--size: 132px; --left: 72%; --duration: 27s; --delay: -15s; --drift: -58px;"></span>
    <span class="bubble" style="--size: 64px; --left: 84%; --duration: 18s; --delay: -8s; --drift: 36px;"></span>
    <span class="bubble" style="--size: 34px; --left: 93%; --duration: 13s; --delay: -1s; --drift: -24px;"></span>
  </div>

  <div id="laec-alert-overlay" :style="{ display: alertOpen ? 'flex' : 'none' }">
    <div class="laec-alert-box">
      <div class="laec-alert-header" id="laec-alert-title">{{ alertTitle }}</div>
      <div class="laec-alert-body" id="laec-alert-msg">{{ alertMsg }}</div>
      <div class="laec-alert-footer">
        <button class="laec-alert-btn" type="button" @click="closeWindowAlert">OK</button>
      </div>
    </div>
  </div>

  <div id="identity-popup" :style="{ display: identityOpen ? 'flex' : 'none' }">
    <div class="identity-box">
      <h3 style="color: var(--success); margin-top: 0;">UPDATE SUCCESSFUL</h3>
      <img id="pop-photo" class="identity-photo" :src="popPhoto" />
      <h4 id="pop-name" style="margin: 5px 0; color: var(--laec-blue);">{{ popName }}</h4>
      <p id="pop-class" style="font-weight: bold; color: #666;">{{ popClass }}</p>
      <p style="font-size: 0.8rem; color: #444;">Your curriculum is now active. <br />Preparing your examination slip...</p>
    </div>
  </div>

  <div class="login-card no-print" id="main-card" :style="{ maxWidth: cardMaxWidth }">
    <img :src="logoSrc" alt="LAEC Logo" />

    <div id="offline-ui" :class="{ hidden: screen !== 'offline' }">
      <h2 style="color: var(--danger);">Portal Closed</h2>
      <p class="subtitle">The exam portal is locked, it is not exam or test period!</p>
    </div>

    <div id="login-ui" :class="{ hidden: screen !== 'login' }">
      <template v-if="screen !== 'offline'">
        <h2>Student CBT Portal</h2>
        <p class="subtitle">Lagos Archdiocesan Education Commission</p>

        <div class="form-group">
          <label>Registration Number</label>
          <input v-model="regId" type="text" id="regId" placeholder="LAEC/SFC/2026/001" autocomplete="off" />
        </div>

        <div class="form-group">
          <label>Examination Password</label>
          <div class="password-field">
            <input v-model="password" :type="showPassword ? 'text' : 'password'" id="password" placeholder="******" />
            <button
              type="button"
              class="password-toggle"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              :aria-pressed="showPassword ? 'true' : 'false'"
              @click="togglePasswordVisibility"
            ><svg v-if="showPassword" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg><svg v-else viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle><path d="M4 12h16"></path></svg></button>
          </div>
        </div>

        <button class="btn-login" type="button" @click="handleLogin">Login</button>
      </template>
    </div>

    <div id="migration-ui" :class="{ hidden: screen !== 'migration' }">
      <h2 style="color: var(--success); font-size: 1.1rem;">Migration Milestone</h2>
      <p id="congrats-msg" style="font-size: 0.8rem; line-height: 1.5; color: #444; margin-bottom: 10px;">{{ congratsMsg }}</p>
      <div class="form-group" style="margin-bottom: 10px;">
        <label>New Class Arm</label>
        <select id="migration-arm" v-model="arm">
          <option value="">-- Select Arm --</option>
          <option v-for="code in ARM_OPTIONS" :key="code" :value="code">{{ code }}</option>
        </select>
      </div>
      <div class="migration-viewport">
        <div class="migration-grid" id="master-subject-list">
          <template v-for="(item, index) in subjectData" :key="index">
            <div v-if="item.type === 'header'" class="subject-header">{{ item.title }}</div>
            <label v-else class="sub-item">
              <input
                type="checkbox"
                name="newSub"
                :value="item.val"
                :checked="checkedRows.includes(index)"
                @change="toggleRow(index)"
              />
              <span>{{ item.name }}</span>
            </label>
          </template>
        </div>
      </div>
      <button class="btn-login" type="button" @click="saveNewSubjects">Update My Curriculum</button>
    </div>

    <div id="subject-ui" :class="{ hidden: screen !== 'subject' }">
      <h2 id="welcome-student">{{ welcomeName }}</h2>
      <p class="subtitle" style="margin-bottom: 0.75rem;">{{ hallwaySubtitle }}</p>
      <div id="subject-list" class="subject-hallway">
        <div v-if="noLivePanel" style="padding: 20px; background: #fff5f5; border: 1px solid #feb2b2; color: #c53030; border-radius: 8px; font-size: 0.85rem; font-weight: 600;">SYSTEM STATUS: No active examination scheduled for your class at this time. Please check your timetable or contact the ICT center.</div>
        <button
          v-for="item in hallwaySubjects"
          :key="item.subject"
          type="button"
          class="btn-subject"
          :class="{ completed: item.completed }"
          :title="item.completed ? `You already have a result on ${item.label}.` : `Start ${item.label}`"
          :aria-disabled="item.completed ? 'true' : 'false'"
          @click="onHallwayClick(item)"
        >{{ item.completed ? `${item.label} - COMPLETED` : item.label }}</button>
      </div>
      <button class="btn-login" type="button" style="background:#888; margin-top:10px;" @click="studentLogout">Logout</button>
    </div>

    <div id="graduate-ui" class="graduate-panel" :style="{ display: screen === 'graduate' ? 'block' : 'none' }">
      <h2>Congratulations, Graduate</h2>
      <div class="graduate-badge">Graduated Student Record</div>
      <p id="graduate-message">{{ graduateMessage }}</p>
      <p style="font-weight:700; color:var(--laec-blue);">For transcripts, past results, or records support, kindly contact your school administrator.</p>
      <button class="btn-login" type="button" style="margin-top:12px;" @click="studentLogout">Return to Login</button>
    </div>

    <div id="loader" :style="{ display: loader ? 'block' : 'none' }"></div>
    <div id="error-msg" :style="{ display: errorVisible ? 'block' : 'none' }">{{ errorText }}</div>

    <p style="margin-top: 1.2rem; font-size: 0.68rem; color: #4e4d4d;">&copy; <span id="copyright-year">{{ footerYear }}</span> NICEGENE TECHNOLOGIES. All rights reserved! <br /> Unauthorised access is strictly prohibited. <br /> All activities are monitored.</p>
  </div>

  <div id="print-slip">
    <div class="slip-header">
      <h2 style="margin:0; color: #004a99;">LAEC EXAMINATION SLIP</h2>
      <p id="migration-record-label" style="margin:5px; font-weight:bold;">{{ migrationRecordLabel }}</p>
    </div>
    <div class="slip-body">
      <img id="slip-img" class="slip-photo" :src="slipPhoto" />
      <div class="slip-details">
        <p><strong>NAME:</strong> <span id="slip-name">{{ slipName }}</span></p>
        <p><strong>REG NO:</strong> <span id="slip-reg" style="font-size:16px; font-weight:bold;">{{ slipReg }}</span></p>
        <p><strong>NEW CLASS:</strong> <span id="slip-class">{{ slipClass }}</span></p>
        <p><strong>PASSWORD:</strong> <span id="slip-pass" style="color:red; font-weight:bold;">{{ slipPass }}</span></p>
      </div>
    </div>
    <div class="slip-subjects">
      <strong>UPDATED CURRICULUM SUBJECTS:</strong>
      <p id="slip-subjects-list">{{ slipSubjects }}</p>
      <p style="margin-top: 20px; font-style: italic; font-size: 10px;">Note: Present this document to your invigilator for verification.</p>
    </div>
  </div>
</template>

<style>
/* Ported from origin-pages/login.html (lines 91–241) and prefixed with
   .page-login so the rules cannot leak onto other SPA routes. body, html and
   the bubble field live in glass.css; IDs here are unique to this page. */

.page-login .login-card {
  position: relative;
  z-index: var(--z-content);
  background: var(--glass);
  padding: 1.85rem 1.7rem 1.35rem;
  border-radius: 20px;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 360px;
  text-align: center;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  margin: auto;
  transition: max-width 0.3s ease;
}

.page-login .login-card img { width: 68px; margin-bottom: 0.8rem; }
.page-login h2 { color: var(--laec-blue); margin-bottom: 0.35rem; font-weight: 800; text-transform: uppercase; font-size: 1.12rem; }
.page-login p.subtitle { color: #555; font-size: 0.82rem; margin-bottom: 1.2rem; }

.page-login .form-group { text-align: left; margin-bottom: 1rem; }
.page-login label { display: block; font-size: 0.75rem; font-weight: 700; color: var(--laec-blue); margin-bottom: 5px; text-transform: uppercase; }

.page-login input { width: 100%; padding: 11px 12px; border: 2px solid #ddd; border-radius: 8px; box-sizing: border-box; font-size: 0.96rem; transition: 0.3s; }
.page-login input:focus { border-color: var(--laec-accent); outline: none; background: #fff; }
.page-login .password-field { position: relative; }
.page-login .password-field input { padding-right: 46px; }
.page-login .password-toggle {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 34px;
  height: 34px;
  padding: 0;
  margin: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #777777;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.page-login .password-toggle svg { width: 19px; height: 19px; stroke: currentColor; }
.page-login .password-toggle:hover { background: rgba(119, 119, 119, 0.12); }

.page-login .btn-login, .page-login .btn-subject {
  background: var(--laec-blue); color: white; width: 100%; padding: 12px; border: none; border-radius: 8px; font-size: 0.96rem; font-weight: 700; cursor: pointer; transition: 0.3s; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;
}

.page-login .btn-login:hover, .page-login .btn-subject:hover { background: var(--laec-accent); transform: translateY(-2px); }

.page-login .btn-subject.completed {
  background: #cbd5e0 !important;
  color: #718096 !important;
  cursor: not-allowed !important;
  transform: none !important;
  border: 1px solid #a0aec0;
}

.page-login .btn-subject.completed:hover {
  background: #cbd5e0 !important;
  color: #718096 !important;
}

#error-msg { color: #dc3545; font-size: 0.85rem; margin-top: 1rem; display: none; font-weight: 600; }

#loader { display: none; margin: 10px auto; border: 4px solid #f3f3f3; border-top: 4px solid var(--laec-blue); border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.page-login .hidden { display: none !important; }
.page-login .subject-hallway { margin-top: 1rem; text-align: left; }

.page-login .migration-viewport { background: #f1f4f8; border: 1px solid #ddd; border-radius: 12px; padding: 12px; margin: 12px 0; max-height: 310px; overflow-y: auto; text-align: left; box-shadow: inset 0 2px 5px rgba(0,0,0,0.05); }
.page-login .migration-viewport::-webkit-scrollbar { width: 6px; }
.page-login .migration-viewport::-webkit-scrollbar-thumb { background: var(--laec-blue); border-radius: 10px; }

.page-login .migration-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.page-login .subject-header { grid-column: 1 / -1; background: var(--laec-blue); color: white; padding: 6px 12px; font-size: 10px; font-weight: 800; border-radius: 4px; margin-top: 12px; text-transform: uppercase; letter-spacing: 0.5px; }

.page-login .sub-item { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 600; color: #333; background: white; padding: 8px; border-radius: 6px; border: 1px solid #eee; cursor: pointer; transition: 0.2s; }
.page-login .sub-item:hover { border-color: var(--laec-blue); background: #eef5ff; }

#identity-popup {
  position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: var(--z-modal);
  display: none; justify-content: center; align-items: center;
}
.page-login .identity-box {
  background: white; padding: 30px; border-radius: 20px; width: 90%; max-width: 420px; text-align: center;
  border-top: 10px solid var(--success);
}
.page-login .identity-photo { width: 150px; height: 150px; object-fit: cover; border: 5px solid var(--laec-blue); border-radius: 15px; margin-bottom: 15px; }

#print-slip { display: none; width: 100%; background: white; padding: 20px; border: 2px solid #000; font-family: sans-serif; text-align: left; }
.page-login .slip-header { text-align: center; border-bottom: 2px solid #000; margin-bottom: 15px; padding-bottom: 10px; }
.page-login .slip-body { display: flex; gap: 20px; margin-bottom: 15px; }
.page-login .slip-photo { width: 120px; height: 120px; border: 1px solid #000; object-fit: cover; }
.page-login .slip-details p { margin: 5px 0; font-size: 13px; }
.page-login .slip-subjects { border-top: 1px dashed #000; padding-top: 10px; font-size: 11px; line-height: 1.5; }

#laec-alert-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.85);
  display: none; justify-content: center; align-items: center; z-index: var(--z-modal); backdrop-filter: blur(5px);
}
.page-login .laec-alert-box {
  background: white; border-radius: 15px; width: 90%; max-width: 420px;
  overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5); text-align: center;
  animation: alertShow 0.3s ease-out;
}
@keyframes alertShow { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.page-login .laec-alert-header { background: var(--laec-blue); color: white; padding: 12px; font-weight: 800; font-size: 0.9rem; text-transform: uppercase; }
.page-login .laec-alert-body { padding: 25px 20px; color: #333; font-size: 0.95rem; line-height: 1.5; }
.page-login .laec-alert-footer { padding: 15px; border-top: 1px solid #eee; }
.page-login .laec-alert-btn { background: var(--laec-blue); color: white; border: none; padding: 10px 30px; border-radius: 6px; font-weight: 700; cursor: pointer; text-transform: uppercase; width: 100%; }
.page-login .laec-alert-btn:hover { background: var(--laec-accent); }

.page-login .graduate-panel {
  display: none;
  text-align: center;
  background: #f8fbff;
  border: 1px solid #cfe3ff;
  border-radius: 14px;
  padding: 18px 14px;
  color: #1f3654;
}
.page-login .graduate-panel h2 {
  color: var(--success);
  font-size: 1.05rem;
  margin: 0 0 0.55rem;
}
.page-login .graduate-panel p {
  font-size: 0.84rem;
  line-height: 1.55;
  margin: 0.45rem 0;
}
.page-login .graduate-badge {
  display: inline-block;
  margin: 0.65rem 0;
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(40, 167, 69, 0.12);
  color: #16723a;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

@media print { .page-login .no-print { display: none !important; } #print-slip { display: block !important; } }
</style>
