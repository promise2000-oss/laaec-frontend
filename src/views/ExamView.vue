<script setup lang="ts">
/**
 * PRD §4.3 — `/exam/` — Secure Examination Hall.
 *
 * Copy, structure and behaviour ported verbatim from origin-pages/exam.html
 * (captured 2026-09-28). Deliberate deviations (all logged in BUILD-LOG):
 *  - Transport: typed mock adapter (D-05) — no AWS endpoint is ever called.
 *    GET_EXAM_CONFIG runs through `useApiRetry` (RF-98 constants, identical
 *    to config.js defaults; the origin passes only `retryLabel`).
 *    GET_SECURE_QUESTIONS calls the REAL `config.js fetchQuestionSet` with a
 *    `fetchImpl` shim (D-28) so subject/class candidate expansion stays
 *    byte-authentic. SUBMIT_EXAM_RESULT runs through `useApiRetry` with the
 *    origin's observed `retries: 6, maxDelayMs: 10000` (RF-56) inside the
 *    origin's infinite 2s reconnect loop. END_STUDENT_SESSION is a plain
 *    `callApi` (origin: `fetch(...).catch(() => {})`).
 *  - The origin's `objectiveCount` / `subObjectiveCount` / `theoryCount`
 *    locals in `processSubmission` are never read by the payload and are
 *    omitted (noUnusedLocals); every payload value is computed as observed.
 *  - Cloudflare challenge markup/scripts omitted (DEV-1). The CDN aws-sdk
 *    script tag and the body `oncontextmenu` guard are kept (D-08/observed).
 *  - PRD transcription discrepancies resolved in favour of the origin:
 *    seven `.rules-list` items (PRD §4.3 says "eight"), the Timer Control
 *    statement ends "… Ensure you keep an eye on the clock.", and the
 *    RF-51 / NETWORK LOST banners use three dots ("...") not "…".
 *  - Stage gate: the origin wires lockdown listeners inside setupLockdown()
 *    when the hall is entered; useExamLockdown wires them at setup behind
 *    the `enabled` ref, which engageExtremeSecurity flips (equivalent).
 *  - Keyboard violations are recorded by useExamLockdown (RF-49) but, as in
 *    the origin, never reach the payload: every auto-termination overwrites
 *    `violationReason` with its own reason before submission.
 *
 * Mock fixtures: 12 questions (10 OBJECTIVE, 1 SUB_OBJECTIVE, 1 THEORY),
 * `EXAM` mark column `5`, paper coordinates (45-minute duration, 2099
 * hard cut-off) on every row, one diagram image (mockData.ts).
 */

import { computed, onMounted, ref, watch } from 'vue';
import { ApiHttpError, callApi } from '../api';
import { useApiRetry } from '../composables/useApiRetry';
import { useAnswerPersistence } from '../composables/useAnswerPersistence';
import { useExamLockdown } from '../composables/useExamLockdown';
import { useExamTimer, type ExamTimerOptions } from '../composables/useExamTimer';
import { STORAGE_KEYS, answerStorageKey } from '../types';
import type {
  ExamAnswerScriptLine,
  ExamCategory,
  ExamMode,
  ExamResultSubmission,
  ExamTerm,
  LaecUtils,
  Question,
  Student,
} from '../types';

/* ── config.js (loaded in this entry's <head>, origin parity) ─────────── */
/* Cast once, as the original does (`const LAEC = window.LAEC_UTILS`). */
const LAEC = window.LAEC_UTILS as LaecUtils;
const { call: retry } = useApiRetry();

/* ── Route guard (origin: top-level script; PRD §4.3 / RF-2) ──────────── */
let student: Student | null = null;
try {
  student = JSON.parse(
    sessionStorage.getItem(STORAGE_KEYS.activeStudent) || 'null',
  ) as Student | null;
} catch {
  sessionStorage.removeItem(STORAGE_KEYS.activeStudent);
}
const selectedSubject = sessionStorage.getItem(STORAGE_KEYS.selectedSubject);
if (!student || !selectedSubject) {
  location.replace('/login/');
  throw new Error('Missing active exam session.');
}
const activeStudent: Student = student;

/* ── RF-52: answer persistence — byte-exact key, restores on construction */
const storageKey = answerStorageKey(activeStudent.RegNo, selectedSubject);
const { answers, restored, setAnswer } = useAnswerPersistence(
  activeStudent.RegNo,
  selectedSubject,
);
if (restored.value) console.log('Power Recovery: Previous progress restored.');

/* ── view state (origin globals mirrored as refs) ─────────────────────── */
const questions = ref<Question[]>([]);
const curIdx = ref(0);
const violationReason = ref('None');
/** true ⇔ origin's `#instructionStage` gained `.hidden` (hall engaged). */
const started = ref(false);
const instructionTitle = ref('LAEC System Instructions');
const showSystemCard = ref(true);
const showAssessmentCard = ref(false);
const showAgreement = ref(false);
const showNextBtn = ref(true);
const showProceedBtn = ref(false);
const agreeChecked = ref(false);
const assessmentSubjectLabel = ref('Assessment Specific Instruction');
const assessmentText = ref('');
const catDisplay = ref('SYNCING...');
const activeTestType = ref('EXAM');
const activeTerm = ref('TERM1');
const activeSystemMode = ref('MODE_A');
const activeAcademicYear = ref('2025-2026');
const assessmentInstruction = ref('');
const loadErrorText = ref<string | null>(null);
const sidebarReg = ref('---');
const sidebarName = ref('Student Name');
const sidebarPhoto = ref('/nicegene_logo.png');
const diagramFailed = ref(false);
const modalVisible = ref(false);
const modalTitle = ref('End Session?');
const modalMsg = ref('Are you sure you want to submit your exam now?');
const modalActionsVisible = ref(true);
/** Stays inside the always-hidden #finalScoreArea; origin clears it on success. */
const percentText = ref('0%');

/* ── RF-41…45 countdown — options are mutated during Stage 1 and applied
      at start() (config/paper values are not known at setup) ──────────── */
const timerOptions: ExamTimerOptions = {
  defaultDurationMinutes: null,
  paperDurationMinutes: null,
  paperEndTime: null,
  onTimeExpired: (reason) => {
    violationReason.value = reason; // RF-42: always "None"
    void processSubmission(false);
  },
  onHardCutOff: (reason) => {
    // RF-43: origin's startTimer calls its own autoTerminate(), which latches
    // and paints the 🚨 banner — so route through the lockdown latch, not
    // straight into autoTerminate (the banner would otherwise be skipped).
    void lockdown.terminate(reason);
  },
};
const timer = useExamTimer(timerOptions);
const timerDisplay = timer.display;
const timerOffline = timer.offline;

/* ── RF-46…51 lockdown — listeners gated until engageExtremeSecurity ──── */
const lockdown = useExamLockdown({ onTerminate: (reason) => autoTerminate(reason) });
const { isSubmitting, bannerText } = lockdown;

/* ── submission pipeline (origin autoTerminate / processSubmission) ───── */

const autoTerminate = async (reason: string): Promise<void> => {
  violationReason.value = reason; // origin: `if (reason) violationReason = reason`
  await processSubmission(true);
};

/** `parseFloat(q[activeTestType]) || 0` (attested mark column). */
const questionMark = (q: Question): number =>
  parseFloat(String((q as unknown as Record<string, unknown>)[activeTestType.value] ?? '')) || 0;

const sanitizeSubObjectiveAnswer = (value: string): string =>
  String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

const normalizeSubObjectiveAnswer = (value: string): string => {
  const upperValue = sanitizeSubObjectiveAnswer(value).toUpperCase();
  let normalized = '';
  for (const char of upperValue) {
    const isLetter = char.toLowerCase() !== char.toUpperCase();
    const isNumber = char >= '0' && char <= '9';
    if (isLetter || isNumber || char === '|' || char === ' ') normalized += char;
  }
  return normalized.replace(/\s*\|\s*/g, '|').replace(/\s+/g, ' ').trim();
};

const splitSubObjectiveAnswers = (value: string): string[] =>
  normalizeSubObjectiveAnswer(value)
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 10);

const isSubObjectiveCorrect = (studentValue: string, correctValue: string): boolean => {
  const studentParts = splitSubObjectiveAnswers(studentValue);
  const acceptedParts = new Set(splitSubObjectiveAnswers(correctValue));
  return (
    studentParts.length > 0 &&
    acceptedParts.size > 0 &&
    studentParts.every((part) => acceptedParts.has(part))
  );
};

const releaseStudentSession = async (): Promise<void> => {
  const sessionID = sessionStorage.getItem(STORAGE_KEYS.studentSessionID) || '';
  if (!sessionID || sessionStorage.getItem(STORAGE_KEYS.studentSessionLocked) !== 'true') return;
  const schoolID = activeStudent.SchoolID || activeStudent.RegNo.split('/')[1];
  try {
    await callApi('END_STUDENT_SESSION', {
      schoolID,
      regNo: activeStudent.RegNo,
      sessionID,
    });
  } catch {
    // origin: `fetch(...).catch(() => {})` — failures do not block cleanup
  }
  sessionStorage.removeItem(STORAGE_KEYS.studentSessionLocked);
};

const processSubmission = async (isViolation = false): Promise<void> => {
  // origin sets the latch at entry (RF-51); auto-termination already did.
  isSubmitting.value = true;
  timer.stop();
  // Origin also clears viewportGuardInterval; the composable's ratio sampler
  // is latch-gated and inert from here on (equivalent observable behaviour).

  let totalObtainable = 0;
  let studentScore = 0;

  // Grading always reads the persisted copy (origin reads localStorage first).
  let finalAnswers: Record<string, string> = {};
  try {
    finalAnswers = JSON.parse(localStorage.getItem(storageKey) || '{}') || {};
  } catch {
    finalAnswers = { ...answers.value };
  }

  questions.value.forEach((q, i) => {
    const markValue = questionMark(q);
    if (q.QuestionType === 'SUB_OBJECTIVE') {
      totalObtainable += markValue;
      if (isSubObjectiveCorrect(finalAnswers[String(i)] || '', q.Correct || '')) {
        studentScore += markValue;
      }
    } else if (q.QuestionType !== 'THEORY') {
      totalObtainable += markValue;
      const studentAns = (finalAnswers[String(i)] || '').trim().toUpperCase();
      const correctAns = (q.Correct || '').trim().toUpperCase();
      if (studentAns !== '' && studentAns === correctAns) studentScore += markValue;
    }
    // THEORY: counted by the origin (theoryCount) but never scored — that
    // counter is payload-dead and omitted here.
  });

  const answerScript: ExamAnswerScriptLine[] = questions.value.map((q, i) => {
    const questionType = q.QuestionType || 'OBJECTIVE';
    const markValue = questionType === 'THEORY' ? 0 : questionMark(q);
    const studentAnswer = finalAnswers[String(i)] || '';
    const correctAnswer = q.Correct || '';
    const isCorrect =
      questionType === 'SUB_OBJECTIVE'
        ? isSubObjectiveCorrect(studentAnswer, correctAnswer)
        : questionType !== 'THEORY' &&
          String(studentAnswer).trim().toUpperCase() === String(correctAnswer).trim().toUpperCase();
    return {
      QuestionNo: i + 1,
      QuestionID: q.QuestionID || q.SK || '',
      QuestionType: questionType,
      Question: q.Question || q.Text || '',
      QuestionHTML: q.QuestionHTML || q.TextHTML || q.Question || q.Text || '',
      A: q.A || '',
      B: q.B || '',
      C: q.C || '',
      D: q.D || '',
      AHTML: q.AHTML || q.A || '',
      BHTML: q.BHTML || q.B || '',
      CHTML: q.CHTML || q.C || '',
      DHTML: q.DHTML || q.D || '',
      StudentAnswer: studentAnswer,
      CorrectAnswer: correctAnswer,
      Mark: markValue,
      Awarded: isCorrect ? markValue : 0,
      IsCorrect: isCorrect,
    };
  });

  const percent = totalObtainable > 0 ? Math.round((studentScore / totalObtainable) * 100) : 0;
  modalVisible.value = true;
  modalTitle.value = isViolation ? 'DISCIPLINARY TERMINATION' : 'PROCESSING...';
  modalMsg.value = 'Syncing your answers with NICEGENE cloud...';
  modalActionsVisible.value = false;

  const resultPayload: ExamResultSubmission = {
    regNo: activeStudent.RegNo,
    testType: activeTestType.value,
    term: activeTerm.value,
    mode: activeSystemMode.value,
    academicYear: activeAcademicYear.value,
    fullName: activeStudent.FullName,
    schoolID: activeStudent.SchoolID || activeStudent.RegNo.split('/')[1],
    studentClass: activeStudent.Class,
    studentArm: activeStudent.Arm || activeStudent.StudentArm || '',
    subject: selectedSubject,
    score: studentScore,
    total: totalObtainable,
    percentage: percent,
    answerScript,
    status: isViolation ? 'FLAGGED' : 'CLEAN',
    violation: isViolation ? violationReason.value : 'None',
  };

  const safeSubmit = async (): Promise<void> => {
    try {
      const submitData = await retry(
        'SUBMIT_EXAM_RESULT',
        { result: resultPayload },
        {
          retryLabel: 'Exam result submission',
          retries: 6, // RF-56 / origin `retries: 6` (seven attempts)
          maxDelayMs: 10000, // RF-56 ten-second ceiling
        },
      );
      if (submitData.status !== 'success') {
        throw new Error(submitData.message || 'Result was not saved.');
      }

      modalTitle.value = isViolation ? 'DISCIPLINARY TERMINATION' : 'EXAM COMPLETED';
      modalMsg.value = isViolation
        ? `Status: ${violationReason.value}`
        : 'Submission successful! Redirecting...';
      // finalScoreArea stays hidden; origin clears the two unused fields.
      percentText.value = '';

      setTimeout(() => {
        void releaseStudentSession().finally(() => {
          localStorage.removeItem(storageKey);
          sessionStorage.removeItem(STORAGE_KEYS.selectedSubject);
          sessionStorage.removeItem(STORAGE_KEYS.currentEffectiveMode);
          sessionStorage.removeItem(STORAGE_KEYS.currentExamCategory);
          sessionStorage.removeItem(STORAGE_KEYS.currentExamTerm);
          sessionStorage.removeItem(STORAGE_KEYS.currentExamYear);
          sessionStorage.removeItem(STORAGE_KEYS.activeStudent);
          location.replace('/login/');
        });
      }, 5000);
    } catch {
      modalMsg.value = '⚠️ NETWORK LOST - RECONNECTING...';
      setTimeout(() => {
        void safeSubmit();
      }, 2000);
    }
  };
  void safeSubmit();
};

/* ── fetchImpl shim (D-28): config.js's fetchQuestionSet drives the real
      candidate/retry layer; the shim routes each probe to the typed mock ── */

const msgOf = (e: unknown): string =>
  e instanceof Error
    ? e.message
    : typeof e === 'object' && e !== null && 'message' in e
      ? String((e as { message: unknown }).message)
      : '';

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

/* ── deterministic shuffle (RF-53, origin verbatim) ───────────────────── */

const createShuffleSeed = (text: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const seededRandom = (seed: number): (() => number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

const isShuffleEnabled = (value: unknown): boolean => {
  if (value === false || value === 0) return false;
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
  return false;
};

const shuffleQuestionsForStudent = (questionList: Question[]): Question[] => {
  const paperShuffleValue = questionList.find((question) =>
    Object.prototype.hasOwnProperty.call(question, 'ShuffleQuestions'),
  )?.ShuffleQuestions;
  const shouldShuffle = questionList.length > 0 && isShuffleEnabled(paperShuffleValue);
  if (!shouldShuffle) return [...questionList];

  const shuffleSessionKey = `shuffle_${activeStudent.RegNo}_${selectedSubject}_${activeAcademicYear.value}_${activeTerm.value}_${activeTestType.value}_${activeSystemMode.value}`;
  let shuffleSessionID = sessionStorage.getItem(shuffleSessionKey);
  if (!shuffleSessionID) {
    shuffleSessionID = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(shuffleSessionKey, shuffleSessionID);
  }
  const seedText = [
    activeStudent.RegNo,
    activeStudent.FullName,
    activeStudent.SchoolID,
    activeStudent.Class,
    selectedSubject,
    activeAcademicYear.value,
    activeTerm.value,
    activeTestType.value,
    activeSystemMode.value,
    sessionStorage.getItem(STORAGE_KEYS.studentSessionID) || shuffleSessionID,
  ].join('|');
  const random = seededRandom(createShuffleSeed(seedText));
  const shuffled = [...questionList];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/* ── Stage-1 data loading (origin window.onload body) ─────────────────── */

const loadStudentDetails = (): void => {
  sidebarName.value = activeStudent.FullName;
  sidebarReg.value = activeStudent.RegNo;
  if (activeStudent.PassportURL) sidebarPhoto.value = activeStudent.PassportURL;
};

const syncExamConfig = async (): Promise<void> => {
  const schoolCode = activeStudent.RegNo.split('/')[1];
  const data = await retry('GET_EXAM_CONFIG', { schoolID: schoolCode }, {
    retryLabel: 'Exam config sync',
  });

  if (data.status !== 'success' || !data.config) {
    throw new Error(data.message || 'Exam config sync failed.');
  }

  const hallwayMode = sessionStorage.getItem(STORAGE_KEYS.currentEffectiveMode);
  const hallwayCategory = sessionStorage.getItem(STORAGE_KEYS.currentExamCategory);
  const hallwayTerm = sessionStorage.getItem(STORAGE_KEYS.currentExamTerm);
  const hallwayYear = sessionStorage.getItem(STORAGE_KEYS.currentExamYear);
  activeTestType.value = hallwayCategory || data.config.activeExamType || 'EXAM';
  activeTerm.value = hallwayTerm || data.config.currentTerm || 'TERM1';
  activeSystemMode.value = (
    hallwayMode ||
    data.effectiveMode ||
    data.config.currentMode ||
    'MODE_A'
  ).toUpperCase();
  activeAcademicYear.value =
    hallwayYear || (data.config.academicYear || '2025/2026').replace('/', '-');

  // FALLBACK: global duration in case the specific paper has none (RF-41).
  timerOptions.defaultDurationMinutes = parseInt(String(data.config.examDuration), 10) || 0;

  catDisplay.value = `SESSION: ${activeTestType.value} (${activeSystemMode.value})`;
};

const fetchQuestions = async (): Promise<void> => {
  const schoolCode = activeStudent.RegNo.split('/')[1];
  try {
    const normalizedSubject = LAEC.normalizeSubjectValue(selectedSubject);
    const normalizedClass = LAEC.normalizeClassValue(activeStudent.Class);
    const { data } = await LAEC.fetchQuestionSet({
      /* Mock base — config.js embeds it into the URL the shim parses;
         no real endpoint string is constructed (brief: mock API only). */
      baseUrl: 'http://mock.local/students',
      params: {
        action: 'GET_SECURE_QUESTIONS',
        schoolID: schoolCode,
        year: activeAcademicYear.value,
        term: activeTerm.value,
        class: normalizedClass,
        subject: normalizedSubject,
        type: activeTestType.value,
        mode: activeSystemMode.value,
        regNo: activeStudent.RegNo,
        noCache: '1',
      },
      fetchImpl: mockFetchImpl,
    });
    if (data.status !== 'success') {
      throw new Error(data.message || 'Secure subject validation failed.');
    }
    const rawQuestions = (data.questions ?? []) as Question[];

    if (rawQuestions.length === 0) {
      isSubmitting.value = true;
      modalVisible.value = true;
      modalTitle.value = data.completed ? 'SUBJECT LOCKED' : 'PAPER NOT FOUND';
      modalMsg.value =
        data.message ||
        `Subject paper for ${LAEC.humanizeSubject(normalizedSubject)} is not yet available.`;
      modalActionsVisible.value = false;
      setTimeout(() => {
        location.replace('/login/');
      }, 6000);
    } else {
      questions.value = shuffleQuestionsForStudent(rawQuestions);

      // Paper-specific duration (RF-41) — logged exactly as observed.
      const paper = questions.value[0];
      if (paper.DurationMinutes) {
        const specificMinutes = parseFloat(String(paper.DurationMinutes));
        console.log(`System: Applying Paper-Specific Timer of ${specificMinutes} minutes.`);
        timerOptions.paperDurationMinutes = specificMinutes;
      }

      // Go-live hard cut-off (RF-43): only a future EndTime qualifies.
      if (paper.EndTime) {
        const paperEndTime = new Date(paper.EndTime).getTime();
        timerOptions.paperEndTime =
          Number.isFinite(paperEndTime) && Date.now() < paperEndTime ? paper.EndTime : null;
      }

      assessmentInstruction.value =
        paper.AssessmentInstruction || paper.Instruction || paper.Instructions || '';
    }
  } catch (e) {
    loadErrorText.value = 'Error loading secure data.';
    throw e;
  }
};

/* ── Stage-1 interactions (origin showAssessmentInstructions / engage…) ─ */

const showAssessmentInstructions = (): void => {
  instructionTitle.value = 'Assessment Specific Instruction';
  showSystemCard.value = false;
  showAssessmentCard.value = true;
  showAgreement.value = true;
  showNextBtn.value = false;
  showProceedBtn.value = true;
  assessmentSubjectLabel.value = `${LAEC.humanizeSubject(selectedSubject)} Instruction`;
  assessmentText.value =
    assessmentInstruction.value ||
    'No additional subject-specific instruction was provided for this paper. Follow all LAEC system rules and answer the questions presented.';
};

const engageExtremeSecurity = async (): Promise<void> => {
  try {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    // observed: fullscreen failures are swallowed silently
  }
  started.value = true;
  lockdown.enabled.value = true; // origin: setupLockdown() inside startExam
  timer.start(); // origin: startTimer() inside startExam
  // renderQuestion()/renderPalette() are reactive (computeds + watch below).
};

/* ── navigation and interaction (origin changeQ/jumpTo/save…) ─────────── */

const changeQ = (dir: number): void => {
  const n = curIdx.value + dir;
  if (n >= 0 && n < questions.value.length) curIdx.value = n;
};

const jumpTo = (i: number): void => {
  curIdx.value = i;
};

const showConfirm = (): void => {
  modalVisible.value = true;
};

const closeModal = (): void => {
  if (!isSubmitting.value) modalVisible.value = false;
};

const saveAnswer = (val: string): void => {
  setAnswer(String(curIdx.value), val); // RF-52 autosave; selection is computed
};

const saveSubObjectiveAnswer = (value: string): void => {
  setAnswer(String(curIdx.value), sanitizeSubObjectiveAnswer(value));
};

const onSubInput = (event: Event): void => {
  saveSubObjectiveAnswer((event.target as HTMLInputElement).value);
};

/* ── derived rendering (origin renderQuestion / renderPalette) ────────── */

const renderSafeQuestionHtml = (
  html: string | null | undefined,
  fallbackText?: string,
): string => LAEC.sanitizeRichTextHtml(html, fallbackText);

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

const currentQuestion = computed<Question | null>(
  () => questions.value[curIdx.value] ?? null,
);
const questionType = computed(() => currentQuestion.value?.QuestionType ?? null);
const currentAnswer = computed(() => answers.value[String(curIdx.value)] ?? '');

const qLabel = computed(() =>
  questions.value.length === 0
    ? 'Question 0 of 0'
    : `Question ${curIdx.value + 1} of ${questions.value.length}`,
);

const qTextHtml = computed(() => {
  if (loadErrorText.value !== null) return loadErrorText.value;
  const q = currentQuestion.value;
  if (!q) return 'Connecting to secure question bank...';
  return renderSafeQuestionHtml(q.QuestionHTML || q.TextHTML, q.Question || q.Text);
});

const diagramUrl = computed(() => {
  const url = currentQuestion.value?.ImageURL ?? '';
  return url.trim() !== '' ? url : '';
});

const currentOptions = computed(() => {
  const q = currentQuestion.value;
  if (!q || q.QuestionType === 'THEORY' || q.QuestionType === 'SUB_OBJECTIVE') return [];
  return OPTION_LETTERS.filter((letter) => Boolean(q[letter])).map((letter) => ({
    letter,
    html: renderSafeQuestionHtml(
      (q as unknown as Record<string, unknown>)[`${letter}HTML`] as string | null | undefined,
      q[letter],
    ),
    selected: currentAnswer.value === letter,
  }));
});

const subObjectiveValue = computed(() => sanitizeSubObjectiveAnswer(currentAnswer.value));

const palette = computed(() =>
  questions.value.map((q, i) => ({
    index: i,
    label: i + 1,
    current: i === curIdx.value,
    answered: Boolean(answers.value[String(i)]),
    theory: q.QuestionType === 'THEORY',
  })),
);

/* Origin renderQuestion side-effects: THEORY records "THEORY_READ" in memory
   only (never persisted), and every render rebuilds the diagram image so a
   failing URL re-fires onerror. */
watch([curIdx, questions], () => {
  diagramFailed.value = false;
  const q = questions.value[curIdx.value];
  if (q && q.QuestionType === 'THEORY' && !answers.value[String(curIdx.value)]) {
    answers.value = { ...answers.value, [String(curIdx.value)]: 'THEORY_READ' };
  }
});

/* ── origin window.onload ─────────────────────────────────────────────── */

onMounted(async () => {
  loadStudentDetails();
  try {
    await syncExamConfig();
    await fetchQuestions();
    // Origin re-renders the palette here only when answers exist; the
    // computed palette is always current (same DOM result).
  } catch (err) {
    console.error('Critical System Error:', err);
    alert('System failed to load secure content. Please login again.');
    location.replace('/login/');
  }
});
</script>

<template>
  <!-- Stage 1 — instructions (origin #instructionStage.start-overlay) -->
  <div id="instructionStage" class="start-overlay" :class="{ hidden: started }">
    <h1 id="instructionTitle" style="color: var(--laec-blue); margin-top: 0">
      {{ instructionTitle }}
    </h1>
    <div class="instruction-card" id="systemInstructionCard" :class="{ hidden: !showSystemCard }">
      <p><strong>Strict Rules &amp; Regulations:</strong></p>
      <ul class="rules-list">
        <li>
          <strong>AI Proctoring Enabled:</strong> This session is strictly monitored. Your
          navigation, screen activity, and session duration are logged in real-time.
        </li>
        <li>
          <strong>Anti-Cheat Tab Lock:</strong> You are prohibited from switching tabs or
          minimizing this window.
          <strong>Any attempt to leave this page will trigger an automatic submission of your exam.</strong>
        </li>
        <li>
          <strong>Automatic Disqualification:</strong> Leaving the exam environment will result in
          a flagged status. A disciplinary comment will be appended to your final result for
          administrators.
        </li>
        <li>
          <strong>Single Session Policy:</strong> You cannot access this exam on multiple devices.
          Detected multi-logins will terminate your session immediately.
        </li>
        <li>
          <strong>Timer Control:</strong> Your work will be submitted automatically when the
          countdown reaches zero. Ensure you keep an eye on the clock.
        </li>
        <li>
          <strong>External Materials:</strong> Use of smartphones, smartwatches, or textbooks is
          strictly forbidden.
        </li>
        <li>
          <strong>Full-Screen Mode:</strong> Entering the hall will force your browser into
          Full-Screen mode to maintain integrity.
        </li>
      </ul>
    </div>
    <div class="instruction-card" id="assessmentInstructionCard" :class="{ hidden: !showAssessmentCard }">
      <p><strong id="assessmentInstructionSubject">{{ assessmentSubjectLabel }}</strong></p>
      <div
        id="assessmentInstructionText"
        style="white-space: pre-wrap; color: #444; font-size: 14px; line-height: 1.55"
      >{{ assessmentText }}</div>
    </div>
    <div id="agreementArea" :class="{ hidden: !showAgreement }" style="margin: 10px 0">
      <label style="cursor: pointer; display: flex; align-items: center; gap: 10px; max-width: 450px">
        <input
          type="checkbox"
          id="agreeCheck"
          v-model="agreeChecked"
          style="width: 22px; height: 22px"
        />
        <span style="color: var(--nj-danger); font-weight: bold; font-size: 0.9rem; text-align: left">
          I understand that minimizing this window terminates my exam immediately and I accept to
          obey the exam rules.
        </span>
      </label>
    </div>
    <button
      id="nextInstructionBtn"
      class="btn btn-next"
      style="width: 100%; max-width: 400px"
      :class="{ hidden: !showNextBtn }"
      @click="showAssessmentInstructions"
    >
      NEXT
    </button>
    <button
      id="proceedBtn"
      class="btn btn-start"
      :class="{ hidden: !showProceedBtn, 'active-green': agreeChecked }"
      :disabled="!agreeChecked"
      @click="engageExtremeSecurity"
    >
      Enter Exam Hall
    </button>
  </div>

  <!-- Security banner (RF-46…51 state line) -->
  <div class="security-banner" id="secBanner" :class="{ hidden: !started }">
    {{ bannerText }}
  </div>

  <!-- Main header -->
  <header class="header" id="mainHeader" :class="{ hidden: !started }">
    <div style="font-weight: 800; font-size: 1.2rem; letter-spacing: 1px">LAEC SECURE PORTAL</div>
    <div
      id="active-cat-display"
      style="background: rgba(255, 255, 255, 0.2); padding: 5px 12px; border-radius: 4px; font-weight: bold; font-size: 0.8rem"
    >
      {{ catDisplay }}
    </div>
    <div class="timer-box" id="timer" :class="{ offline: timerOffline }">{{ timerDisplay }}</div>
  </header>

  <!-- Exam body -->
  <div class="main-wrapper" id="mainWrapper" :class="{ hidden: !started }">
    <main class="question-container">
      <div class="q-meta" id="qLabel">{{ qLabel }}</div>
      <div class="question-actions-top">
        <button class="btn btn-prev" @click="changeQ(-1)">PREVIOUS</button>
        <button class="btn btn-next" @click="changeQ(1)">SAVE &amp; NEXT</button>
      </div>
      <div class="q-text" id="qText" v-html="qTextHtml"></div>
      <div id="diagramArea" style="text-align: center; margin-bottom: 20px">
        <img
          v-if="diagramUrl"
          v-show="!diagramFailed"
          :key="`${curIdx}-${diagramUrl}`"
          :src="diagramUrl"
          @error="diagramFailed = true"
          style="max-width: 100%; max-height: 300px; border: 2px solid var(--laec-blue); border-radius: 10px"
        />
      </div>
      <div id="optionsArea" class="options-area">
        <div v-if="questionType === 'THEORY'" class="theory-notice">
          THEORY QUESTION<br />Provide answer in your Physical Booklet.
        </div>
        <div v-else-if="questionType === 'SUB_OBJECTIVE'" class="sub-objective-wrap">
          <input
            type="text"
            class="sub-objective-input"
            maxlength="120"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder="Type your answer"
            :value="subObjectiveValue"
            @input="onSubInput"
          />
          <div class="sub-objective-hint">
            Use | only when you need to enter more than one possible answer.
          </div>
        </div>
        <template v-else>
          <label
            v-for="opt in currentOptions"
            :key="opt.letter"
            class="option-label"
            :class="{ selected: opt.selected }"
          >
            <input
              type="radio"
              name="opt"
              :checked="opt.selected"
              @change="saveAnswer(opt.letter)"
            />
            <b>{{ opt.letter }}.</b>
            <span>&nbsp;<span v-html="opt.html"></span></span>
          </label>
        </template>
      </div>
      <div class="footer-nav">
        <button class="btn btn-submit" @click="showConfirm">SUBMIT EXAM</button>
      </div>
    </main>

    <aside class="sidebar">
      <div class="monitoring-box">
        <img id="sidebar-photo" class="student-photo-square" :src="sidebarPhoto" />
        <span id="sidebar-reg" class="student-reg-tag">{{ sidebarReg }}</span>
        <span
          id="sidebar-name"
          style="font-size: 13px; color: #666; text-transform: uppercase; font-weight: 700"
        >{{ sidebarName }}</span>
      </div>
      <h4 style="margin: 0 0 10px; font-size: 0.8rem; color: #888">QUESTION NAVIGATOR</h4>
      <div class="palette-grid" id="palette">
        <div
          v-for="p in palette"
          :key="p.index"
          class="q-box"
          :class="{ current: p.current, answered: p.answered, theory: p.theory }"
          @click="jumpTo(p.index)"
        >
          {{ p.label }}
        </div>
      </div>
    </aside>
  </div>

  <!-- Confirmation / status modal -->
  <div
    class="modal-overlay"
    id="modalOverlay"
    :style="modalVisible ? { display: 'flex' } : undefined"
  >
    <div class="modal-box">
      <h2 id="modalTitle">{{ modalTitle }}</h2>
      <p id="modalMsg">{{ modalMsg }}</p>
      <div id="finalScoreArea" class="hidden">
        <div class="score-display" id="percentCircle">{{ percentText }}</div>
        <p
          id="rawScoreLabel"
          style="font-weight: bold; color: var(--laec-blue); margin-top: 10px"
        ></p>
      </div>
      <div
        id="modalActions"
        style="display: flex; gap: 10px; margin-top: 30px"
        :class="{ hidden: !modalActionsVisible }"
      >
        <button class="btn btn-prev" style="flex: 1" @click="closeModal">CANCEL</button>
        <button
          class="btn btn-next"
          style="flex: 1; background: var(--nj-danger)"
          @click="processSubmission(false)"
        >
          YES, SUBMIT
        </button>
      </div>
    </div>
  </div>
</template>

<style>
/*
 * Origin <style> block ported verbatim (origin-pages/exam.html lines 12–173),
 * every class selector scoped under .page-exam (entry <body> class) per the
 * established /login/ convention; IDs appear in no origin rule. Body tokens
 * and the body rule live in nj.css (surface-nj).
 */
.page-exam .hidden {
  display: none !important;
}

.page-exam .rules-list {
  list-style: none;
  padding: 0;
  margin: 10px 0;
}

.page-exam .rules-list li {
  position: relative;
  padding-left: 25px;
  margin-bottom: 12px;
  line-height: 1.4;
  color: #444;
  font-size: 14px;
}

.page-exam .rules-list li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--laec-blue);
  font-weight: bold;
}

.page-exam .security-banner {
  background: var(--nj-danger);
  color: white;
  padding: 10px;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  border-bottom: 3px solid #000;
}

.page-exam header {
  background: var(--laec-blue);
  color: white;
  padding: 10px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.page-exam .timer-box {
  font-family: monospace;
  background: #000;
  padding: 8px 15px;
  border-radius: 5px;
  font-weight: bold;
  font-size: 1.4rem;
  color: #ff0;
  border: 2px solid white;
  transition: 0.3s;
}

.page-exam .timer-box.offline {
  color: var(--nj-warning);
  border-color: var(--nj-warning);
}

.page-exam .start-overlay {
  position: fixed;
  inset: 0;
  background: white;
  z-index: var(--z-modal);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
}

.page-exam .instruction-card {
  background: #f9f9f9;
  padding: 20px;
  border-radius: 12px;
  margin: 15px 0;
  max-width: 550px;
  width: 100%;
  text-align: left;
  border: 1px solid #ddd;
  max-height: 60vh;
  overflow-y: auto;
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.05);
}

.page-exam .instruction-card::-webkit-scrollbar {
  width: 8px;
}

.page-exam .instruction-card::-webkit-scrollbar-track {
  background: #eee;
  border-radius: 10px;
}

.page-exam .instruction-card::-webkit-scrollbar-thumb {
  background: var(--laec-blue);
  border-radius: 10px;
}

.page-exam .main-wrapper {
  display: flex;
  flex-direction: row;
  max-width: 1200px;
  width: 95%;
  margin: 15px auto;
  gap: 20px;
  flex: 1;
}

.page-exam .sidebar {
  width: 280px;
  background: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 2px 15px rgba(0, 0, 0, 0.05);
  height: fit-content;
  border: 1px solid var(--nj-border);
}

.page-exam .monitoring-box {
  text-align: center;
  margin-bottom: 20px;
  border-bottom: 2px solid var(--nj-bg);
  padding-bottom: 15px;
}

.page-exam .student-photo-square {
  width: 180px;
  height: 180px;
  object-fit: cover;
  border: 4px solid var(--laec-blue);
  border-radius: 8px;
  background: #eee;
}

.page-exam .student-reg-tag {
  font-weight: bold;
  color: var(--laec-blue);
  font-size: 1.1rem;
  display: block;
  margin-top: 8px;
}

.page-exam .palette-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-top: 15px;
}

.page-exam .q-box {
  height: 35px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--nj-border);
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
  transition: 0.3s;
  background: white;
  font-size: 0.85rem;
}

.page-exam .q-box.current {
  border: 2.5px solid var(--laec-blue);
  color: var(--laec-blue);
  background: #eef5ff;
}

.page-exam .q-box.answered {
  background: var(--nj-success);
  color: white;
  border-color: var(--nj-success);
}

.page-exam .q-box.theory {
  background: var(--laec-blue);
  color: white;
}

.page-exam .question-container {
  flex: 1;
  background: white;
  padding: 35px;
  border-radius: 10px;
  box-shadow: 0 2px 15px rgba(0, 0, 0, 0.05);
  min-height: 450px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--nj-border);
}

.page-exam .q-meta {
  color: var(--laec-blue);
  font-weight: 800;
  margin-bottom: 10px;
  font-size: 0.9rem;
  text-transform: uppercase;
}

.page-exam .q-text {
  font-size: 1.4rem;
  line-height: 1.6;
  margin-bottom: 30px;
  color: #333;
  white-space: pre-wrap;
}

.page-exam .option-label {
  display: flex;
  align-items: center;
  padding: 18px;
  border: 1px solid var(--nj-border);
  margin-bottom: 15px;
  border-radius: 8px;
  cursor: pointer;
  transition: 0.2s;
  font-size: 1.1rem;
}

.page-exam .option-label:hover {
  background: #f8f9fa;
  border-color: var(--laec-blue);
}

.page-exam .option-label.selected {
  border-color: var(--laec-blue);
  background: #eef5ff;
  font-weight: 600;
}

.page-exam .option-label input {
  margin-right: 15px;
  width: 20px;
  height: 20px;
}

.page-exam .sub-objective-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.page-exam .sub-objective-input {
  width: 100%;
  max-width: 620px;
  padding: 16px 18px;
  border: 1px solid var(--nj-border);
  border-radius: 8px;
  font-size: 1.1rem;
  font-family: inherit;
  color: #222;
  background: #fff;
}

.page-exam .sub-objective-input:focus {
  outline: none;
  border-color: var(--laec-blue);
  box-shadow: 0 0 0 3px rgba(0, 86, 179, 0.12);
}

.page-exam .sub-objective-hint {
  color: #667085;
  font-size: 0.9rem;
}

.page-exam .question-actions-top {
  display: flex;
  gap: 15px;
  margin: 0 0 22px;
}

.page-exam .footer-nav {
  display: flex;
  align-items: center;
  margin-top: auto;
  padding-top: 25px;
  border-top: 1px solid #eee;
}

.page-exam .btn {
  padding: 12px 28px;
  border: none;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  text-transform: uppercase;
  transition: 0.3s;
}

.page-exam .btn-prev {
  background: #eee;
  color: #555;
  margin-right: 15px;
}

.page-exam .btn-next {
  background: var(--laec-blue);
  color: white;
}

.page-exam .btn-submit {
  background: var(--nj-danger);
  color: white;
  margin-left: auto;
}

.page-exam .btn-start {
  background: #ccc;
  color: #777;
  width: 100%;
  max-width: 400px;
  padding: 15px;
  border-radius: 8px;
  cursor: not-allowed;
  border: none;
}

.page-exam .btn-start.active-green {
  background: var(--nj-success) !important;
  color: white !important;
  cursor: pointer !important;
}

.page-exam .theory-notice {
  background: #fff3cd;
  border: 2px dashed #856404;
  color: #856404;
  padding: 25px;
  border-radius: 8px;
  text-align: center;
  font-weight: bold;
  font-size: 1.1rem;
}

.page-exam .modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  display: none;
  justify-content: center;
  align-items: center;
  z-index: var(--z-modal);
}

.page-exam .modal-box {
  background: white;
  padding: 40px;
  border-radius: 12px;
  max-width: 450px;
  width: 90%;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.page-exam .score-display {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 6px solid var(--nj-success);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.2rem;
  font-weight: bold;
  color: var(--nj-success);
  margin: 20px auto;
}

@media (max-width: 900px) {
  .page-exam .main-wrapper {
    flex-direction: column;
  }

  .page-exam .sidebar {
    width: auto;
    order: -1;
  }

  .page-exam .palette-grid {
    grid-template-columns: repeat(10, 1fr);
  }

  .page-exam .question-actions-top {
    position: sticky;
    top: 72px;
    z-index: var(--z-sticky-sm);
    background: white;
    padding: 10px 0;
    border-bottom: 1px solid #eee;
  }

  .page-exam .rules-list li {
    font-size: 13px;
  }
}
</style>
