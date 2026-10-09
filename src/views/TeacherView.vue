<script setup lang="ts">
/*
 * `/teacher/` — Question Studio (exam-management addendum, D-55).
 *
 * NOT a replica. The origin has no teacher role, no authoring surface and no
 * review workflow, so nothing here is transcribed: the lifecycle
 * (DRAFT -> PENDING_REVIEW -> LIVE / REJECTED) and the eight actions it uses
 * (D-53, D-54) are designed for the addendum. What is inherited is the
 * enterprise surface and the §4.9 shared chrome the consoles use, so the page
 * reads as part of the same portal.
 *
 * The one rule that matters: nothing a teacher does on this page publishes a
 * question. `SAVE_QUESTION_SUBMISSION` keeps a draft, `SUBMIT_QUESTION_FOR_REVIEW`
 * hands it to the queue, and only the Central Admin's accept makes it live.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { callApi } from '../api';
import AppShell from '../components/AppShell.vue';
import AppAlert from '../components/AppAlert.vue';
import AppLoading from '../components/AppLoading.vue';
import { filterNav, navFor, takePendingPanel } from '../lib/nav';
import { useSessionStore } from '../stores/session';
/* St Finbarr's teacher portal (D-72). Each is one of the deployed app's route
   groups, collapsed into a panel. They are imported eagerly rather than lazily:
   the rail can switch to any of them on the first click, and a lazy chunk per
   panel would add a network round trip to every navigation for screens that are
   each one table and one form. */
import TeacherDashboardPanel from '../components/teacher/TeacherDashboardPanel.vue';
import LessonPlansPanel from '../components/teacher/LessonPlansPanel.vue';
import WeeklyReportsPanel from '../components/teacher/WeeklyReportsPanel.vue';
import ClassTeacherReportsPanel from '../components/teacher/ClassTeacherReportsPanel.vue';
import LessonApprovalPanel from '../components/teacher/LessonApprovalPanel.vue';
import LeavePanel from '../components/teacher/LeavePanel.vue';
import HrQueriesPanel from '../components/teacher/HrQueriesPanel.vue';
import CounsellingPanel from '../components/teacher/CounsellingPanel.vue';
import DisciplinaryPanel from '../components/teacher/DisciplinaryPanel.vue';
import MessagingPanel from '../components/teacher/MessagingPanel.vue';
import EventsPanel from '../components/teacher/EventsPanel.vue';
import NotificationsPanel from '../components/teacher/NotificationsPanel.vue';
import ProfilePanel from '../components/teacher/ProfilePanel.vue';
import { useIdleTimeout } from '../composables/useIdleTimeout';
import { STORAGE_KEYS } from '../types';
import type {
  ExamCategory,
  ExamTerm,
  Question,
  QuestionStatus,
  QuestionSubmissionRecord,
  TeacherNotice,
} from '../types';

const LAEC = (window as unknown as { LAEC_UTILS: Record<string, (...args: never[]) => unknown> }).LAEC_UTILS;
const humanizeSubject = (subject: string): string =>
  String(LAEC.humanizeSubject ? (LAEC.humanizeSubject as (s: string) => string)(subject) : subject);

type Tab = { id: string; label: string };
/** Each console declares this locally; /teacher/ follows the same shape. */
type AlertType = 'info' | 'confirm';

/**
 * The panel ids this view can mount. It mirrors the `TEACHER_GROUPS` ids in
 * `lib/nav.ts` and exists so `restoreActiveTab` can reject a persisted panel the
 * rail no longer offers — the same guard the origin's own rail applies. It is
 * a subset of `navFor(currentRole).groups`, deliberately: a persisted panel must
 * survive a permission change, so the test is "is this still a panel", not "is
 * this still visible to me".
 */
const TABS: Tab[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'drafts', label: 'My Papers' },
  { id: 'lesson-plans', label: 'Lesson Planning' },
  { id: 'weekly-reports', label: 'Weekly Report' },
  { id: 'class-reports', label: 'Class Teacher Report' },
  { id: 'lesson-approval', label: 'Review Inbox' },
  { id: 'leave', label: 'Permission (leave)' },
  { id: 'hr-queries', label: 'HR Queries' },
  { id: 'compose', label: 'Compose' },
  { id: 'notices', label: 'Decisions' },
  { id: 'messaging', label: 'Messages' },
  { id: 'events', label: 'Events' },
  { id: 'counselling', label: 'Guidance & Counselling' },
  { id: 'disciplinary', label: 'Disciplinary' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'profile', label: 'Profile' },
];

/** The 60 subjects the origin's own question manager offers (config.js). */
const SUBJECT_OPTIONS = [
  'MATHEMATICS', 'ENGLISH_LANGUAGE', 'CITIZENSHIP_HERITAGE', 'DIGITAL_TECHNOLOGY', 'CIVIC_EDUCATION',
  'CRS', 'NIGERIAN_LANGUAGE', 'FRENCH', 'INTERMEDIATE_SCIENCE', 'MUSIC', 'FINE_ART', 'BASIC_TECH',
  'AGRIC_SCIENCE_JSS', 'HOME_ECONOMICS', 'CIVIC_SECURITY', 'HISTORY', 'NATIONAL_VALUES',
  'PRE_VOCATIONAL_STUDIES', 'CCA', 'BASIC_SCIENCE_TECHNOLOGY', 'BUSINESS_STUDIES', 'PHE', 'BIOLOGY',
  'CHEMISTRY', 'PHYSICS', 'FURTHER_MATHEMATICS', 'AGRICULTURAL_SCIENCE', 'GEOGRAPHY', 'TECHNICAL_DRAWING',
  'BASIC_ELECTRICITY', 'FOODS_AND_NUTRITION', 'LITERATURE_IN_ENGLISH', 'GOVERNMENT', 'YORUBA', 'IGBO',
  'HAUSA', 'VISUAL_ARTS', 'HOME_MANAGEMENT', 'ECONOMICS', 'COMMERCE', 'FINANCIAL_ACCOUNTING', 'MARKETING',
  'OFFICE_PRACTICE', 'TRADE', 'SOLAR_PV', 'LIVESTOCK_FARMING', 'BEAUTY', 'COMPUTER_HARDWARE', 'HORTICULTURE',
  'DATA_PROCESSING', 'CATERING', 'ANIMAL_HUSBANDRY', 'BOOK_KEEPING', 'PHOTOGRAPHY',
];
const CLASS_OPTIONS = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'];

const TEACHER_USERNAME = localStorage.getItem(STORAGE_KEYS.AdminUsername) || '';
const SCHOOL_ID = localStorage.getItem(STORAGE_KEYS.SchoolID) || '';

const currentRole = localStorage.getItem(STORAGE_KEYS.AdminRole) || 'TEACHER';
const navMeta = navFor(currentRole);

/* The rail is permission-filtered (D-71): SUPER_ADMIN sees every
   section, every other session only the ones it actually holds. */
const sessionStore = useSessionStore();
const navGroups = computed(
  () => filterNav(navMeta, sessionStore.permissions, currentRole).groups,
);
const activeTab = ref<string>(
  takePendingPanel(navMeta, 'activeTeacher_Tab') || 'dashboard',
);
const navOpen = ref(false);
const backToTopVisible = ref(false);
const loadingVisible = ref(false);
const copyrightYear = String(new Date().getFullYear());
const teacherIdentity = ref('Loading Identity...');

const alertVisible = ref(false);
const alertTitle = ref('');
const alertMsg = ref('');
const alertConfirmVisible = ref(false);
let alertConfirmHandler: (() => void) | null = null;

const winAlert = (msg: string, title: string, type: AlertType = 'info', onConfirm: (() => void) | null = null): void => {
  alertTitle.value = title;
  alertMsg.value = msg;
  alertConfirmVisible.value = type === 'confirm';
  alertConfirmHandler = onConfirm;
  alertVisible.value = true;
};
const closeAlert = (): void => {
  alertVisible.value = false;
  if (alertConfirmHandler) {
    const handler = alertConfirmHandler;
    alertConfirmHandler = null;
    handler();
  }
};

const mySubmissions = ref<QuestionSubmissionRecord[]>([]);
const counts = ref<Record<QuestionStatus, number>>({ DRAFT: 0, PENDING_REVIEW: 0, LIVE: 0, REJECTED: 0 });
const notices = ref<TeacherNotice[]>([]);
const unreadCount = ref(0);

const editingId = ref('');
const draftSubject = ref('MATHEMATICS');
const draftClass = ref('JSS1');
const draftTerm = ref<ExamTerm>('TERM1');
const draftCategory = ref<ExamCategory>('EXAM');
const draftQuestions = ref<Question[]>([]);
const tickedRows = ref<number[]>([]);

const draftsHint = computed(() =>
  mySubmissions.value.length === 0
    ? 'Nothing authored yet.'
    : `${mySubmissions.value.length} paper(s) on record. Drafts are yours alone until you submit them.`,
);

const statusLabel = (status: QuestionStatus): string =>
  ({ DRAFT: 'DRAFT', PENDING_REVIEW: 'IN REVIEW', LIVE: 'LIVE', REJECTED: 'REJECTED' })[status];

const formatStamp = (value: string): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 16).replace('T', ' ');
};

/* ── the teacher's own papers ─────────────────────────────────────────── */

const loadMySubmissions = async (): Promise<void> => {
  loadingVisible.value = true;
  try {
    const data = await callApi('GET_MY_SUBMISSIONS', {
      schoolID: SCHOOL_ID,
      teacherUsername: TEACHER_USERNAME,
    });
    if (data.status !== 'success') throw new Error(data.message || 'read failed');
    mySubmissions.value = data.submissions;
    counts.value = data.counts || counts.value;
  } catch {
    mySubmissions.value = [];
    winAlert('Sync Error', 'Could not read your submissions.');
  }
  loadingVisible.value = false;
};

const loadNotices = async (): Promise<void> => {
  try {
    const data = await callApi('GET_TEACHER_NOTICES', {
      schoolID: SCHOOL_ID,
      teacherUsername: TEACHER_USERNAME,
    });
    if (data.status !== 'success') throw new Error(data.message || 'read failed');
    notices.value = data.notices;
    unreadCount.value = data.unread;
  } catch {
    notices.value = [];
  }
};

/* ── composing ────────────────────────────────────────────────────────── */

const blankQuestion = (): Question => ({
  QuestionType: 'OBJECTIVE',
  Question: '',
  A: '',
  B: '',
  C: '',
  D: '',
  Correct: '',
  EXAM: '5',
  ShuffleQuestions: false,
  DurationMinutes: 45,
});

const addQuestion = (): void => {
  draftQuestions.value = [...draftQuestions.value, blankQuestion()];
};

const setField = (index: number, field: keyof Question, value: string): void => {
  draftQuestions.value[index] = { ...draftQuestions.value[index], [field]: value };
};

const toggleRow = (index: number): void => {
  tickedRows.value = tickedRows.value.includes(index)
    ? tickedRows.value.filter((i) => i !== index)
    : [...tickedRows.value, index];
};

const removeQuestion = (index: number): void => {
  draftQuestions.value = draftQuestions.value.filter((_, i) => i !== index);
  tickedRows.value = tickedRows.value.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i));
};

/** Group edit: drop every ticked row in one action (addendum item 5). */
const removeTicked = (): void => {
  const drop = new Set(tickedRows.value);
  if (drop.size === 0) return;
  const count = drop.size;
  draftQuestions.value = draftQuestions.value.filter((_, i) => !drop.has(i));
  tickedRows.value = [];
  winAlert('Removed', `${count} question(s) removed from this draft. Save to keep the change.`);
};

const openDraft = (item: QuestionSubmissionRecord): void => {
  editingId.value = item.SubmissionID;
  draftSubject.value = item.Subject;
  draftClass.value = item.Class;
  draftTerm.value = item.Term as ExamTerm;
  draftCategory.value = item.Category as ExamCategory;
  draftQuestions.value = item.Questions.map((q) => ({ ...q }));
  tickedRows.value = [];
  showTab('compose');
};

const resetComposer = (): void => {
  editingId.value = '';
  draftQuestions.value = [blankQuestion()];
  tickedRows.value = [];
};

const saveDraft = (): void => {
  const questions = draftQuestions.value.filter((q) => String(q.Question || '').trim() !== '');
  if (questions.length === 0) {
    winAlert('Selection Required', 'Write at least one question before saving.');
    return;
  }
  void (async () => {
    loadingVisible.value = true;
    try {
      const data = await callApi('SAVE_QUESTION_SUBMISSION', {
        schoolID: SCHOOL_ID,
        submissionId: editingId.value || undefined,
        subject: draftSubject.value,
        class: draftClass.value,
        term: draftTerm.value,
        category: draftCategory.value,
        questions,
        teacherUsername: TEACHER_USERNAME,
        teacherName: localStorage.getItem(STORAGE_KEYS.AdminName) || TEACHER_USERNAME,
      });
      if (data.status !== 'success' || !data.submission) {
        throw new Error(data.message || 'Save failed.');
      }
      winAlert('Draft Saved', `${data.submission.SubmissionID} saved as a draft. It is not live.`);
      editingId.value = data.submission.SubmissionID;
      draftQuestions.value = data.submission.Questions.map((q) => ({ ...q }));
      await loadMySubmissions();
    } catch (e) {
      winAlert('Save Failed', e instanceof Error ? e.message : 'Could not save this draft.');
    }
    loadingVisible.value = false;
  })();
};

const submitForReview = (item: QuestionSubmissionRecord): void => {
  winAlert(
    `Send ${item.SubmissionID} (${humanizeSubject(item.Subject)} ${item.Class}, ${item.QuestionCount} question(s)) to the review team? It stays unpublished until they accept it.`,
    'SUBMIT FOR REVIEW',
    'confirm',
    () => {
      void (async () => {
        loadingVisible.value = true;
        try {
          const data = await callApi('SUBMIT_QUESTION_FOR_REVIEW', {
            schoolID: SCHOOL_ID,
            submissionId: item.SubmissionID,
            teacherUsername: TEACHER_USERNAME,
          });
          if (data.status !== 'success' || !data.submission) {
            throw new Error(data.message || 'Submit failed.');
          }
          winAlert('Sent for Review', data.message || 'Sent. You will be notified of the decision.');
          await loadMySubmissions();
        } catch (e) {
          winAlert('Submit Failed', e instanceof Error ? e.message : 'Could not submit this paper.');
        }
        loadingVisible.value = false;
      })();
    },
  );
};

/* ── chrome ───────────────────────────────────────────────────────────── */

const showTab = (tabId: string): void => {
  activeTab.value = tabId;
  localStorage.setItem('activeTeacher_Tab', tabId);
  if (window.innerWidth <= 900) navOpen.value = false;
  if (tabId === 'notices') void loadNotices();
  if (tabId === 'drafts') void loadMySubmissions();
};

const restoreActiveTab = (): void => {
  const saved = localStorage.getItem('activeTeacher_Tab') || 'dashboard';
  showTab(TABS.some((t) => t.id === saved) ? saved : 'dashboard');
};

const syncHeaderOffset = (): void => {
  const header = document.querySelector('.page-header') as HTMLElement | null;
  if (header) {
    document.documentElement.style.setProperty('--header-offset', `${header.offsetHeight}px`);
  }
};

const toggleBackToTopButton = (): void => {
  backToTopVisible.value = window.scrollY > 320;
};

const scrollToTopPage = (): void => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const toggleNav = (): void => {
  navOpen.value = !navOpen.value;
};

const handleLogout = (): void => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = '/control/';
};

useIdleTimeout({ mode: 'admin' });

onMounted(async () => {
  if (!localStorage.getItem(STORAGE_KEYS.LAEC_Session)) {
    window.location.href = '/control/';
    return;
  }
  const name = localStorage.getItem(STORAGE_KEYS.AdminName);
  teacherIdentity.value = name ? `TEACHER: ${name}` : SCHOOL_ID || 'Unknown School';

  await nextTick();
  syncHeaderOffset();
  toggleBackToTopButton();
  window.addEventListener('resize', syncHeaderOffset);
  window.addEventListener('scroll', toggleBackToTopButton, { passive: true });

  restoreActiveTab();
  draftQuestions.value = [blankQuestion()];

  /* The §4.9 shared components and the first-party libraries reach for these
     page globals, exactly as the origin's top-level declarations provided
     them on the four consoles. */
  const hooks = ((window as unknown as Record<string, unknown>).__LAEC_ADMIN_HOOKS__ ??=
    {}) as Record<string, unknown>;
  Object.assign(hooks, { winAlert, closeAlert, toggleNav, showTab, scrollToTopPage, handleLogout });

  await loadMySubmissions();
  await loadNotices();
});

watch(draftQuestions, () => {
  tickedRows.value = tickedRows.value.filter((i) => i >= 0 && i < draftQuestions.value.length);
});
</script>
<!--
  `/teacher/` — Question Studio (addendum, D-55).

  NOT an origin page: the origin has no teacher role, no authoring surface and no
  review workflow (D-53). It is built in the enterprise surface so it reads as
  part of the same portal as the four consoles, and it uses the same shared
  chrome the consoles use (custom alert, loading overlay, back-to-top, footer),
  because those are the §4.9 shared components the addendum inherits.

  A teacher signs in with a TEACHER role, drafts a paper, submits it, and sees
  what the review team decided. Nothing a teacher does here publishes questions:
  only the Central Admin's accept does (D-53).
-->
<template>
    <AppLoading :visible="loadingVisible" text="LAEC Teacher Portal Syncing..." />

    <AppAlert
      :visible="alertVisible"
      :title="alertTitle"
      :msg="alertMsg"
      cancel-visible
      :confirm-visible="alertConfirmVisible"
      @close="closeAlert()"
      @confirm="closeAlert()"
    />

    <AppShell
      :role="currentRole"
      :role-label="navMeta.roleLabel"
      :breadcrumb="navMeta.breadcrumb"
      :groups="navGroups"
      :scope="SCHOOL_ID"
      :scope-kind="navMeta.scopeKind"
      :active-id="activeTab"
      :identity="teacherIdentity"
      @select="showTab"
      @logout="handleLogout()"
    >

    <button
      class="back-to-top"
      id="backToTopBtn"
      aria-label="Back to top"
      :class="{ visible: backToTopVisible }"
      @click="scrollToTopPage()"
    >
      ↑
    </button>

    <div class="view-well">
      <!-- ── DRAFTS ────────────────────────────────────��─────────── -->
      <div id="drafts" class="tab-panel" :class="{ active: activeTab === 'drafts' }">
        <div class="control-box">
          <div>
            <h2 style="margin: 0">My Question Papers</h2>
            <p id="drafts-hint" style="opacity: 0.8; margin: 5px 0 0">{{ draftsHint }}</p>
          </div>
          <div>
            <button id="refresh-drafts" class="btn-success" @click="loadMySubmissions()">REFRESH</button>
          </div>
        </div>

        <div class="status-chips" id="status-chips">
          <span class="status-chip draft">Draft: {{ counts.DRAFT || 0 }}</span>
          <span class="status-chip pending">In review: {{ counts.PENDING_REVIEW || 0 }}</span>
          <span class="status-chip live">Live: {{ counts.LIVE || 0 }}</span>
          <span class="status-chip rejected">Rejected: {{ counts.REJECTED || 0 }}</span>
        </div>

        <div class="table-responsive">
          <table id="submissions-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Subject</th>
                <th>Class</th>
                <th>Term</th>
                <th>Category</th>
                <th>Questions</th>
                <th>Status</th>
                <th>Last updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="submissions-body">
              <tr v-for="item in mySubmissions" :key="item.SubmissionID">
                <td>{{ item.SubmissionID }}</td>
                <td>{{ humanizeSubject(item.Subject) }}</td>
                <td>{{ item.Class }}</td>
                <td>{{ item.Term }}</td>
                <td>{{ item.Category }}</td>
                <td>{{ item.QuestionCount }}</td>
                <td>
                  <span class="status-badge" :class="item.Status.toLowerCase()">{{ statusLabel(item.Status) }}</span>
                </td>
                <td>{{ formatStamp(item.UpdatedAt) }}</td>
                <td class="row-actions">
                  <button
                    v-if="item.Status === 'DRAFT'"
                    class="btn-primary"
                    @click="openDraft(item)"
                  >
                    EDIT
                  </button>
                  <button
                    v-if="item.Status === 'DRAFT'"
                    class="btn-success"
                    @click="submitForReview(item)"
                  >
                    SUBMIT FOR REVIEW
                  </button>
                  <button
                    v-if="item.Status === 'PENDING_REVIEW'"
                    class="btn-secondary"
                    @click="winAlert('Awaiting Review', item.SubmissionID + ' is with the review team.')"
                  >
                    IN REVIEW
                  </button>
                  <button
                    v-if="item.Status === 'LIVE'"
                    class="btn-secondary"
                    @click="winAlert('Live', item.SubmissionID + ' is live for ' + humanizeSubject(item.Subject) + ' ' + item.Class + '.')"
                  >
                    VIEW LIVE
                  </button>
                  <button
                    v-if="item.Status === 'REJECTED'"
                    class="btn-warning"
                    @click="winAlert('Rejected', item.ReviewNote || 'The review team rejected this paper.')"
                  >
                    SEE REASON
                  </button>
                </td>
              </tr>
              <tr v-if="mySubmissions.length === 0">
                <td :colspan="9" class="empty-cell" id="submissions-empty">
                  You have not authored any question papers yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── COMPOSE ───────────────────────────────────────────────── -->
      <div id="compose" class="tab-panel" :class="{ active: activeTab === 'compose' }">
        <div class="control-box">
          <div>
            <h2 style="margin: 0">{{ editingId ? 'Edit Draft ' + editingId : 'New Question Paper' }}</h2>
            <p style="opacity: 0.8; margin: 5px 0 0">
              Saving keeps this a draft. Questions go live only when the review team accepts them.
            </p>
          </div>
          <div>
            <button v-if="editingId" class="btn-secondary" @click="resetComposer()">NEW DRAFT</button>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label for="draft-subject">Subject</label>
            <select id="draft-subject" v-model="draftSubject">
              <option v-for="subject in SUBJECT_OPTIONS" :key="subject" :value="subject">
                {{ humanizeSubject(subject) }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label for="draft-class">Class</label>
            <select id="draft-class" v-model="draftClass">
              <option v-for="level in CLASS_OPTIONS" :key="level" :value="level">{{ level }}</option>
            </select>
          </div>
          <div class="form-group">
            <label for="draft-term">Term</label>
            <select id="draft-term" v-model="draftTerm">
              <option value="TERM1">1st Term</option>
              <option value="TERM2">2nd Term</option>
              <option value="TERM3">3rd Term</option>
            </select>
          </div>
          <div class="form-group">
            <label for="draft-category">Category</label>
            <select id="draft-category" v-model="draftCategory">
              <option value="EXAM">EXAM</option>
              <option value="CA1">CA 1</option>
              <option value="CA2">CA 2</option>
            </select>
          </div>
        </div>

        <h3 style="color: var(--laec-blue); margin-top: 24px">Questions</h3>
        <p style="opacity: 0.8; margin: 4px 0 12px">
          {{ draftQuestions.length }} question(s) in this draft. Remove the ones you ticked.
        </p>

        <div class="table-responsive">
          <table id="draft-questions-table">
            <thead>
              <tr>
                <th style="width: 40px"></th>
                <th style="width: 55px">SN</th>
                <th>Question</th>
                <th>Type</th>
                <th>A</th>
                <th>B</th>
                <th>C</th>
                <th>D</th>
                <th>Correct</th>
                <th style="width: 90px">Remove</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(q, index) in draftQuestions" :key="index">
                <td>
                  <input
                    type="checkbox"
                    :checked="tickedRows.includes(index)"
                    @change="toggleRow(index)"
                    :aria-label="'Select question ' + (index + 1)"
                  />
                </td>
                <td>{{ index + 1 }}</td>
                <td>
                  <input
                    type="text"
                    class="cell-input"
                    :value="q.Question"
                    placeholder="Question stem"
                    @input="setField(index, 'Question', ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td>
                  <select
                    :value="q.QuestionType"
                    @change="setField(index, 'QuestionType', ($event.target as HTMLSelectElement).value)"
                  >
                    <option value="OBJECTIVE">OBJECTIVE</option>
                    <option value="SUB_OBJECTIVE">SUB-OBJECTIVE</option>
                    <option value="THEORY">THEORY</option>
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    class="cell-input"
                    :value="q.A"
                    @input="setField(index, 'A', ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    class="cell-input"
                    :value="q.B"
                    @input="setField(index, 'B', ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    class="cell-input"
                    :value="q.C"
                    @input="setField(index, 'C', ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    class="cell-input"
                    :value="q.D"
                    @input="setField(index, 'D', ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    class="cell-input correct"
                    :value="q.Correct"
                    @input="setField(index, 'Correct', ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td>
                  <button class="btn-danger" @click="removeQuestion(index)">REMOVE</button>
                </td>
              </tr>
              <tr v-if="draftQuestions.length === 0">
                <td :colspan="10" class="empty-cell">No questions yet. Add one to begin.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="composer-actions">
          <button id="add-question" class="btn-secondary" @click="addQuestion()">ADD QUESTION</button>
          <button id="save-draft" class="btn-primary" @click="saveDraft()">SAVE DRAFT</button>
          <button
            id="remove-ticked"
            class="btn-danger"
            :disabled="tickedRows.length === 0"
            @click="removeTicked()"
          >
            REMOVE TICKED ({{ tickedRows.length }})
          </button>
        </div>
      </div>

      <!-- ── NOTICES ───────────────────────────────────────────────── -->
      <!-- ── St Finbarr's teacher portal (D-72) ────────────────────────────
           Every panel below is one of the deployed app's route groups, collapsed
           into a single rail entry. They are mounted lazily with `v-if` on the
           active panel rather than all at once, because twelve panels each
           holding a form and a table would cost more in memory than the single
           active one, and because the origin mounts only the route it navigated
           to. Mounting is also what makes `AppShell`'s own first-panel shortcut
           work: the shell clicks an item to make it active, so a panel that is
           never mounted never renders. -->

      <LessonPlansPanel
        v-if="activeTab === 'lesson-plans'"
        class="tab-panel active"
      />

      <WeeklyReportsPanel
        v-if="activeTab === 'weekly-reports'"
        class="tab-panel active"
      />

      <ClassTeacherReportsPanel
        v-if="activeTab === 'class-reports'"
        class="tab-panel active"
      />

      <LessonApprovalPanel
        v-if="activeTab === 'lesson-approval'"
        class="tab-panel active"
      />

      <TeacherDashboardPanel
        v-if="activeTab === 'dashboard'"
        class="tab-panel active"
        @navigate="showTab"
      />

      <LeavePanel
        v-if="activeTab === 'leave'"
        class="tab-panel active"
      />

      <HrQueriesPanel
        v-if="activeTab === 'hr-queries'"
        class="tab-panel active"
      />

      <CounsellingPanel
        v-if="activeTab === 'counselling'"
        class="tab-panel active"
      />

      <DisciplinaryPanel
        v-if="activeTab === 'disciplinary'"
        class="tab-panel active"
      />

      <MessagingPanel
        v-if="activeTab === 'messaging'"
        class="tab-panel active"
      />

      <EventsPanel
        v-if="activeTab === 'events'"
        class="tab-panel active"
      />

      <NotificationsPanel
        v-if="activeTab === 'notifications'"
        class="tab-panel active"
        @navigate="showTab"
      />

      <ProfilePanel
        v-if="activeTab === 'profile'"
        class="tab-panel active"
      />

      <div id="notices" class="tab-panel" :class="{ active: activeTab === 'notices' }">
        <div class="control-box">
          <div>
            <h2 style="margin: 0">Review Decisions</h2>
            <p id="notices-hint" style="opacity: 0.8; margin: 5px 0 0">
              {{ notices.length }} notice(s), {{ unreadCount }} unread.
            </p>
          </div>
          <div>
            <button id="refresh-notices" class="btn-success" @click="loadNotices()">REFRESH</button>
          </div>
        </div>

        <div id="notices-list" class="notice-list">
          <div v-for="notice in notices" :key="notice.NoticeID" class="notice" :class="notice.Decision.toLowerCase()">
            <div class="notice-head">
              <span class="status-badge" :class="notice.Decision.toLowerCase()">{{ notice.Decision }}</span>
              <strong>{{ notice.Subject }} · {{ notice.Class }}</strong>
              <span class="notice-ref">{{ notice.SubmissionID }}</span>
              <span v-if="!notice.Read" class="unread-dot" aria-label="Unread"></span>
              <span class="notice-time">{{ formatStamp(notice.CreatedAt) }}</span>
            </div>
            <p class="note-body">{{ notice.Note }}</p>
          </div>
          <p v-if="notices.length === 0" id="notices-empty" class="empty-cell">
            No review decisions yet. You will be notified here when one is made.
          </p>
        </div>
      </div>
    </div>

    <footer class="page-footer">
      <p>LAEC CLOUD-BASED INTEGRATED EXAMINATION MANAGEMENT SYSTEM © {{ copyrightYear }} NICEGENE TECHNOLOGIES. All Rights Reserved.</p>
    </footer>
    </AppShell>
</template>


<style>
/* Enterprise console chrome, scoped to this page so it cannot leak into the
   origin replicas (D-57: those pages ship their own generated stylesheets). */
.surface-enterprise .page-header {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  background: linear-gradient(135deg, var(--laec-blue) 0%, var(--laec-blue-deep) 100%);
  color: #ffffff;
  box-shadow: var(--shadow);
}
.surface-enterprise .header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 22px;
  gap: 16px;
  flex-wrap: wrap;
}
.surface-enterprise .logo-section h1 {
  margin: 0;
  font-size: 1.35rem;
  letter-spacing: 0.5px;
  font-family: 'Space Grotesk', 'Manrope', sans-serif;
}
.surface-enterprise .logo-section .subtitle {
  margin: 3px 0 0;
  font-size: 0.78rem;
  opacity: 0.85;
}
.surface-enterprise .header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.surface-enterprise .logout-btn-header,
.surface-enterprise .logout-btn-drawer {
  background: var(--danger);
  color: #ffffff;
  border: 0;
  border-radius: 6px;
  padding: 8px 14px;
  font-weight: 800;
  cursor: pointer;
  font-size: 0.75rem;
}
.surface-enterprise .nav-container {
  background: rgba(0, 0, 0, 0.18);
  padding: 0 12px;
}
.surface-enterprise .nav-tabs {
  display: flex;
  gap: 2px;
  overflow-x: auto;
}
.surface-enterprise .nav-tabs .tab {
  padding: 11px 18px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.8rem;
  white-space: nowrap;
  border-bottom: 3px solid transparent;
}
.surface-enterprise .nav-tabs .tab.active {
  border-bottom-color: var(--laec-accent);
  background: rgba(255, 255, 255, 0.1);
}
.surface-enterprise .main-content { box-sizing: border-box; width: 100%; }
.surface-enterprise .main-content > * { max-width: 100%; }
.surface-enterprise .table-responsive > table { min-width: 640px; }
.surface-enterprise .main-content {
  padding: calc(var(--header-offset, 130px) + 18px) 22px 40px;
  max-width: 1400px;
  margin: 0 auto;
}
.surface-enterprise .control-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  background: #ffffff;
  border: 1px solid var(--border);
  border-left: 4px solid var(--laec-accent);
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 16px;
  color: var(--text-dark);
}
.surface-enterprise .status-chips {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.surface-enterprise .status-chip {
  border-radius: 999px;
  padding: 5px 13px;
  font-size: 0.72rem;
  font-weight: 800;
  border: 1px solid var(--border);
  background: #ffffff;
  color: var(--text-soft);
}
.surface-enterprise .status-chip.draft { border-color: var(--text-soft); color: var(--text-soft); }
.surface-enterprise .status-chip.pending { border-color: var(--warning); color: #8a6104; }
.surface-enterprise .status-chip.live { border-color: var(--success); color: var(--success); }
.surface-enterprise .status-chip.rejected { border-color: var(--danger); color: var(--danger); }
.surface-enterprise .status-badge {
  display: inline-block;
  border-radius: 4px;
  padding: 3px 9px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.4px;
  background: #eef3f8;
  color: var(--text-soft);
}
.surface-enterprise .status-badge.live,
.surface-enterprise .status-badge.accepted { background: #e5f6ed; color: var(--success); }
.surface-enterprise .status-badge.pending_review { background: #fdf3dd; color: #8a6104; }
.surface-enterprise .status-badge.draft { background: #eef3f8; color: var(--text-soft); }
.surface-enterprise .status-badge.rejected,
.surface-enterprise .status-badge.rejected-state { background: #fbe9e9; color: var(--danger); }
.surface-enterprise .table-responsive {
  overflow-x: auto;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.surface-enterprise table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.surface-enterprise th {
  background: var(--bg-soft);
  color: var(--text-soft);
  text-align: left;
  padding: 10px 12px;
  font-size: 0.7rem;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  white-space: nowrap;
}
.surface-enterprise td {
  padding: 10px 12px;
  border-top: 1px solid var(--border);
  vertical-align: middle;
}
.surface-enterprise .row-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.surface-enterprise .empty-cell {
  text-align: center;
  color: var(--text-soft);
  padding: 26px 12px;
  font-style: italic;
}
.surface-enterprise .form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px 18px;
}
.surface-enterprise .form-group label {
  display: block;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--text-soft);
  margin-bottom: 5px;
}
.surface-enterprise select,
.surface-enterprise input[type='text'] {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.82rem;
  font-family: inherit;
  color: var(--text-dark);
  background: #ffffff;
}
.surface-enterprise .cell-input { min-width: 90px; }
.surface-enterprise .cell-input.correct { max-width: 70px; font-weight: 800; color: var(--success); }
.surface-enterprise .composer-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  flex-wrap: wrap;
}
.surface-enterprise .notice-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.surface-enterprise .notice {
  background: #ffffff;
  border: 1px solid var(--border);
  border-left: 4px solid var(--text-soft);
  border-radius: 8px;
  padding: 14px 16px;
}
.surface-enterprise .notice.accepted { border-left-color: var(--success); }
.surface-enterprise .notice.rejected { border-left-color: var(--danger); }
.surface-enterprise .notice-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  color: var(--text-dark);
  font-size: 0.84rem;
}
.surface-enterprise .notice-ref { color: var(--text-soft); font-size: 0.75rem; }
.surface-enterprise .notice-time { margin-left: auto; color: var(--text-soft); font-size: 0.72rem; }
.surface-enterprise .unread-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--laec-accent);
  display: inline-block;
}
.surface-enterprise .note-body { margin: 8px 0 0; color: var(--text-dark); font-size: 0.82rem; }
.surface-enterprise .page-footer {
  text-align: center;
  padding: 18px;
  color: var(--text-soft);
  font-size: 0.72rem;
  border-top: 1px solid var(--border);
  background: #ffffff;
}
.surface-enterprise .back-to-top {
  position: fixed;
  right: 22px;
  bottom: 22px;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 0;
  background: var(--laec-blue);
  color: #ffffff;
  font-size: 1.1rem;
  font-weight: 800;
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease;
  z-index: var(--z-furniture);
}
.surface-enterprise .back-to-top.visible { opacity: 1; visibility: visible; }
.surface-enterprise .tab-panel { display: none; }
.surface-enterprise .tab-panel.active { display: block; }
.surface-enterprise #custom-alert,
.surface-enterprise #loading-overlay {
  position: fixed;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(11, 34, 66, 0.72);
  z-index: var(--z-modal);
}
.surface-enterprise .alert-content {
  background: #ffffff;
  border-radius: 12px;
  padding: 22px 26px;
  max-width: 460px;
  width: 92%;
}
.surface-enterprise #alert-msg { color: var(--text-dark); white-space: pre-line; }
.surface-enterprise .alert-btns {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 16px;
  flex-wrap: wrap;
}
.surface-enterprise .spinner {
  width: 42px;
  height: 42px;
  border: 4px solid #ffffff33;
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: laec-teacher-spin 0.9s linear infinite;
}
@keyframes laec-teacher-spin { to { transform: rotate(360deg); } }
.surface-enterprise #loading-overlay {
  flex-direction: column;
  color: #ffffff;
  text-align: center;
}
.surface-enterprise .btn-primary,
.surface-enterprise .btn-secondary,
.surface-enterprise .btn-success,
.surface-enterprise .btn-warning,
.surface-enterprise .btn-danger {
  border: 0;
  border-radius: 6px;
  padding: 8px 14px;
  font-weight: 800;
  font-size: 0.74rem;
  cursor: pointer;
  color: #ffffff;
}
.surface-enterprise .btn-primary { background: var(--laec-blue); }
.surface-enterprise .btn-secondary { background: var(--text-soft); }
.surface-enterprise .btn-success { background: var(--success); }
.surface-enterprise .btn-warning { background: var(--warning); color: #3d2c00; }
.surface-enterprise .btn-danger { background: var(--danger); }
.surface-enterprise .btn-danger:disabled { opacity: 0.45; cursor: not-allowed; }

/*
 * Same idiom the four generated console stylesheets use (ca-page.css line 1117):
 * the document scrolls horizontally because a question table is wider than a
 * phone, and clipping on the html element is what keeps that inside the table
 * container rather than letting it push the page (D-59).
 */
html:has(body.surface-enterprise.page-teacher),
body.surface-enterprise.page-teacher {
  overflow-x: hidden;
}
/*
 * The enterprise surface is a flex column, and `.table-responsive` is a flex
 * item inside it. A flex item sized `max-width: 100%` resolves against an
 * already-widened parent, so a wide table still pushes the page out to its
 * intrinsic width. Clipping the outer wrapper and letting the table container
 * scroll horizontally is what actually holds the viewport (D-59).
 */
.surface-enterprise { overflow-x: hidden; }
.surface-enterprise .table-responsive { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.surface-enterprise .table-responsive > table { min-width: 620px; }
.surface-enterprise .reject-panel textarea { max-width: 100%; }

/*
 * Narrow viewports (D-59). The question and staff tables are wider than a
 * phone on purpose - a question needs its stem and four options legible - so
 * they scroll inside their own container rather than widening the page. The
 * `min-width: 0` on the grid and flex children is what stops a wide table from
 * pushing the whole layout past the viewport.
 */
.surface-enterprise .main-content,
.surface-enterprise .tab-panel,
.surface-enterprise .control-box,
.surface-enterprise .form-grid,
.surface-enterprise .table-responsive,
.surface-enterprise .notice-list,
.surface-enterprise .reject-panel {
  min-width: 0;
  max-width: 100%;
}
.surface-enterprise .header-content > *,
.surface-enterprise .control-box > * {
  min-width: 0;
}
.surface-enterprise .table-responsive { overflow-x: auto; }
@media (max-width: 768px) {
  .surface-enterprise .form-grid { grid-template-columns: 1fr; }
  .surface-enterprise .control-box { flex-direction: column; align-items: flex-start; }
  .surface-enterprise .control-actions { width: 100%; }
  .surface-enterprise .control-actions > * { flex: 1 1 auto; }
  .surface-enterprise .notice-time { margin-left: 0; width: 100%; }
}

@media (max-width: 768px) {
  .surface-enterprise .main-content { padding: calc(var(--header-offset, 160px) + 12px) 12px 32px; }
  .surface-enterprise .header-content { padding: 12px 14px; }
  .surface-enterprise .logo-section h1 { font-size: 1.05rem; }
}
</style>
