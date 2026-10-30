/**
 * AdminResultsPanel — the results-management half of the admin portal: upload
 * windows, results entry, the results queue, committee review, the grading
 * scale, student results and report cards.
 *
 * WHY ONE COMPONENT FOR SEVEN PAGES
 * ---------------------------------
 * These seven pages share one thing the generic panel cannot supply: every value
 * they display is *computed*, and the computation belongs to the origin's server,
 * not to the browser. `/results/enter` totals four marks into 100, averages them,
 * adds a cumulative and a grade; `/results/grading` holds the scale those
 * computations use; `/results/students` and `/results/report-cards` render the
 * graded result of that same arithmetic. Splitting them would mean three files
 * each reimplementing the same grade lookup, and they would drift.
 *
 * So the grade arithmetic lives here, once, and the mock holds the scale. The
 * live constants are reproduced exactly: CA 1 out of 20, CA 2 out of 10,
 * PROJ/ASS out of 10, EXAM out of 60, TOTAL out of 100, PASS MARK 40, and
 * MAX CA 40 / MAX EXAM 60 — which is why CA 1 + CA 2 is 30 and the live page's
 * own header says `Max CA: 40`. That gap is in the origin and is reproduced
 * rather than silently corrected; recorded in feature-inventory.md.
 */
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { callApi } from '../../api';
import AdminDialog from './AdminDialog.vue';
import AdminModuleShell from './AdminModuleShell.vue';
import AdminStatusBadge from './AdminStatusBadge.vue';
import { useAdminSession } from './useAdminSession';
import type { AdminModule } from '../../types/admin-registry';
import type {
  GradingSettings,
  ResultEntryRow,
  ResultQueueItem,
  StudentResultSummary,
} from '../../types/admin';

const props = defineProps<{ module: AdminModule }>();
const can = defineModel<((permission?: string | null) => boolean) | null>('can', { default: null });

const session = useAdminSession();
const permitted = (permission?: string): boolean => {
  if (!permission) return true;
  return can.value ? can.value(permission) : true;
};

const isWindows = computed(() => props.module.resource === 'upload-windows');
const isEntry = computed(() => props.module.resource === 'result-entries');
const isQueue = computed(() => props.module.resource === 'results-queue');
const isCommittee = computed(() => props.module.resource === 'committee-review');
const isGrading = computed(() => props.module.resource === 'grading');
const isReportCards = computed(() => props.module.resource === 'report-cards');

/*
 * `loading` starts TRUE, not false, and that is load-bearing rather than
 * cosmetic. Every kind this panel renders except the two list kinds binds
 * directly to loaded state (`grading!.passMark`, `settings.schoolName`,
 * `entry.classPopulation`), so on the first paint — before `onMounted` has run —
 * those bindings would dereference null. Starting true means `AdminModuleShell`
 * renders its spinner and never evaluates the slot, which is also what the live
 * app does: the page mounts, fetches, and the form appears with its values.
 */
const rows = ref<Array<Record<string, unknown> & { id: string }>>([]);
const total = ref(0);
const tab = ref('ALL');
const search = ref('');
const classFilter = ref('');
const classOptions = ref<Array<{ value: string; label: string }>>([]);
const loading = ref(true);
const loadError = ref('');
const banner = ref('');
const busy = ref(false);
const dialogError = ref('');

/* ── windows ───────────────────────────────────────────────────────────── */

interface WindowRow extends Record<string, unknown> {
  id: string;
  title: string;
  academicSession: string;
  term: string;
  status: 'OPEN' | 'CLOSED';
  startsAt: string;
  endsAt: string;
}

const windowForm = ref({ title: '', academicSession: '2026/2027', term: 'First', startsAt: '', endsAt: '' });
const windowErrors = ref<Record<string, string>>({});
const windowOpen = ref(false);
const staffOptions = ref<Array<{ value: string; label: string }>>([]);

const windowRows = computed(() => rows.value as unknown as WindowRow[]);

const setWindowStatus = async (row: WindowRow, status: 'OPEN' | 'CLOSED'): Promise<void> => {
  busy.value = true;
  try {
    const data = await callApi('SET_UPLOAD_WINDOW_STATUS', { id: row.id, status, actor: session.actor() });
    if (data.status !== 'success') throw new Error(data.message || 'Could not update the window.');
    banner.value = status === 'CLOSED' ? `Closed "${row.title}".` : `Reopened "${row.title}".`;
    await load();
  } catch (e) {
    banner.value = e instanceof Error ? e.message : 'Could not update the window.';
  } finally {
    busy.value = false;
  }
};

const createWindow = async (): Promise<void> => {
  const found: Record<string, string> = {};
  if (!windowForm.value.title.trim()) found.title = 'Enter a title for the window';
  if (!windowForm.value.startsAt) found.startsAt = 'Start date and time are required.';
  if (!windowForm.value.endsAt) found.endsAt = 'End date and time are required.';
  windowErrors.value = found;
  if (Object.keys(found).length) return;

  busy.value = true;
  dialogError.value = '';
  try {
    const data = await callApi('SAVE_UPLOAD_WINDOW', {
      title: windowForm.value.title.trim(),
      academicSession: windowForm.value.academicSession,
      term: windowForm.value.term,
      startsAt: windowForm.value.startsAt,
      endsAt: windowForm.value.endsAt,
      teacherIds: [],
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Save failed.');
    banner.value = 'Upload window created.';
    windowOpen.value = false;
    windowForm.value = { title: '', academicSession: '2026/2027', term: 'First', startsAt: '', endsAt: '' };
    await load();
  } catch (e) {
    dialogError.value = e instanceof Error ? e.message : 'Save failed.';
  } finally {
    busy.value = false;
  }
};

/* ── results entry ─────────────────────────────────────────────────────── */

interface EntryContext {
  className: string;
  academicSession: string;
  term: string;
  rows: ResultEntryRow[];
  grading: GradingSettings;
  classPopulation: number;
}

const entry = ref<EntryContext | null>(null);
const entrySession = ref('2026/2027');
const entryTerm = ref('First');

const asNumber = (value: number | ''): number => (value === '' || value === null ? 0 : Number(value));

const entryRows = computed(() => {
  const rowsIn = entry.value?.rows ?? [];
  return rowsIn.map((row) => {
    const total = asNumber(row.ca1) + asNumber(row.ca2) + asNumber(row.project) + asNumber(row.exam);
    const band = (entry.value?.grading.bands ?? []).find((b) => total >= b.minScore && total <= b.maxScore);
    return { ...row, total, grade: band?.grade ?? '—', label: band?.label ?? '' };
  });
});

const classAverage = computed(() => {
  const totals = entryRows.value.map((r) => r.total);
  if (!totals.length) return 0;
  return Math.round((totals.reduce((n, t) => n + t, 0) / totals.length) * 10) / 10;
});
const classHighest = computed(() => entryRows.value.reduce((n, r) => Math.max(n, r.total), 0));
const classLowest = computed(() =>
  entryRows.value.length ? entryRows.value.reduce((n, r) => Math.min(n, r.total), Number.MAX_SAFE_INTEGER) : 0,
);

const loadEntry = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_ADMIN_RESULT_ENTRY_CONTEXT', {
      className: classFilter.value,
      academicSession: entrySession.value,
      term: entryTerm.value,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load.');
    entry.value = data;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load.';
  } finally {
    loading.value = false;
  }
};

const submitResults = async (): Promise<void> => {
  busy.value = true;
  banner.value = '';
  try {
    const data = await callApi('SAVE_RESULT_ENTRIES', {
      className: entry.value?.className ?? '',
      rows: entry.value?.rows ?? [],
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Submit failed.');
    banner.value = data.message || 'Results submitted.';
  } catch (e) {
    banner.value = e instanceof Error ? e.message : 'Submit failed.';
  } finally {
    busy.value = false;
  }
};

/* ── the queue ─────────────────────────────────────────────────────────── */

const QUEUE_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'COMMITTEE_TAGGED', label: 'Committee Tagged' },
  { key: 'VETTED', label: 'Vetted' },
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'DECLINED', label: 'Declined' },
];

const queueRows = computed(() => rows.value as unknown as ResultQueueItem[]);
const visibleQueue = computed(() =>
  tab.value === 'ALL' ? queueRows.value : queueRows.value.filter((r) => r.status === tab.value),
);

const decide = async (item: ResultQueueItem, decision: string): Promise<void> => {
  busy.value = true;
  banner.value = '';
  try {
    const data = await callApi('DECIDE_RESULT', {
      id: item.id,
      decision,
      note: item.id === declineId.value ? declineNote.value : '',
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not update.');
    banner.value = data.message || `${item.title} — ${decision.toLowerCase()}.`;
    declineId.value = '';
    declineNote.value = '';
    await load();
  } catch (e) {
    banner.value = e instanceof Error ? e.message : 'Could not update.';
  } finally {
    busy.value = false;
  }
};

const declineId = ref('');
const declineNote = ref('');

/* ── grading ───────────────────────────────────────────────────────────── */

const grading = ref<GradingSettings | null>(null);
const gradingErrors = ref<Record<string, string>>({});

const loadGrading = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_ADMIN_RESULT_ENTRY_CONTEXT', {});
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load.');
    grading.value = data.grading;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load.';
  } finally {
    loading.value = false;
  }
};

const saveGrading = async (): Promise<void> => {
  if (!grading.value) return;
  const found: Record<string, string> = {};
  grading.value.bands.forEach((band, index) => {
    if (band.minScore > band.maxScore) {
      found[`band-${index}`] = 'Each band needs a minimum score at or below its maximum.';
    }
  });
  gradingErrors.value = found;
  if (Object.keys(found).length) return;

  busy.value = true;
  try {
    const data = await callApi('SAVE_GRADING_SETTINGS', {
      bands: grading.value.bands,
      passMark: grading.value.passMark,
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Save failed.');
    banner.value = data.message || 'Grading settings saved.';
    await loadGrading();
  } catch (e) {
    banner.value = e instanceof Error ? e.message : 'Save failed.';
  } finally {
    busy.value = false;
  }
};

/* ── student results and report cards ──────────────────────────────────── */

/**
 * The two student-facing lists, typed as what they are rather than as loose rows:
 * both carry a per-subject breakdown, and the report card renders it.
 *
 * The registry rows are `Record<string, unknown>` because the generic engine reads
 * them generically; here the two shapes are known, so they are named. `id` comes
 * off the registry row (every row has one) and the rest off `StudentResultSummary`.
 */
/** A summary row plus the registry's `id`, which the detail lookup keys on. */
type StudentSummaryRow = StudentResultSummary & { id: string };

const studentRows = computed<StudentSummaryRow[]>(() =>
  rows.value.map((row) => ({
    ...(row as unknown as StudentResultSummary),
    id: String(row.id),
  })),
);
const detailId = ref('');

const reportCard = computed(() => studentRows.value.find((row) => row.id === detailId.value) ?? null);

/* ── loading ───────────────────────────────────────────────────────────── */

const load = async (): Promise<void> => {
  if (isEntry.value) return loadEntry();
  if (isGrading.value) return loadGrading();

  loading.value = true;
  loadError.value = '';
  try {
    const filters: Record<string, string> = {};
    if (classFilter.value) filters.className = classFilter.value;
    const data = await callApi('LIST_ADMIN_RECORDS', {
      resource: props.module.resource,
      search: search.value || undefined,
      filters,
      limit: 100,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load.');
    rows.value = data.records;
    total.value = data.total;

    const classes = await callApi('GET_ADMIN_OPTION_LIST', { key: 'classes' });
    classOptions.value = classes.status === 'success' ? classes.options : [];
    if (isWindows.value) {
      const staff = await callApi('GET_ADMIN_OPTION_LIST', { key: 'staff' });
      staffOptions.value = staff.status === 'success' ? staff.options : [];
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load.';
    rows.value = [];
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>

<template>
  <!-- ── upload windows ────────────────────────────────────────────────── -->
  <AdminModuleShell
    v-if="isWindows"
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :empty-count="rows.length"
    :banner="banner"
    @retry="load"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button v-if="permitted('results.window.manage')" type="button" class="ap-btn ap-btn--primary" @click="windowOpen = true">
        Create Window
      </button>
    </template>

    <div class="ap-table-wrap">
      <table class="ap-table">
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Academic Session</th>
            <th scope="col">Term</th>
            <th scope="col">Status</th>
            <th scope="col">Starts At</th>
            <th scope="col">Ends At</th>
            <th scope="col"><span class="ap-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in windowRows" :key="row.id">
            <td>{{ row.title }}</td>
            <td>{{ row.academicSession }}</td>
            <td>{{ row.term }}</td>
            <td><AdminStatusBadge :status="row.status" /></td>
            <td>{{ row.startsAt }}</td>
            <td>{{ row.endsAt }}</td>
            <td class="ap-table__actions">
              <button
                v-if="permitted('results.window.manage') && row.status === 'OPEN'"
                type="button"
                class="ap-btn ap-btn--xs ap-btn--danger"
                :disabled="busy"
                @click="setWindowStatus(row, 'CLOSED')"
              >
                Close
              </button>
              <button
                v-if="permitted('results.window.manage') && row.status === 'CLOSED'"
                type="button"
                class="ap-btn ap-btn--xs ap-btn--primary"
                :disabled="busy"
                @click="setWindowStatus(row, 'OPEN')"
              >
                Reopen
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AdminDialog
      :open="windowOpen"
      title="Create Upload Window"
      confirm-label="Create Window"
      :busy="busy"
      @close="windowOpen = false"
      @confirm="createWindow"
    >
      <div class="ap-form">
        <label class="ap-field">
          <span class="ap-field__label">Title</span>
          <input v-model="windowForm.title" class="ap-input" type="text" placeholder="e.g. First Term 2025 Results" />
          <span v-if="windowErrors.title" class="ap-form__error" role="alert">{{ windowErrors.title }}</span>
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Academic Session</span>
          <select v-model="windowForm.academicSession" class="ap-input">
            <option>2026/2027</option>
            <option>2025/2026</option>
          </select>
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Term</span>
          <select v-model="windowForm.term" class="ap-input">
            <option>First</option>
            <option>Second</option>
            <option>Third</option>
          </select>
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Starts at</span>
          <input v-model="windowForm.startsAt" class="ap-input" type="date" />
          <span v-if="windowErrors.startsAt" class="ap-form__error" role="alert">{{ windowErrors.startsAt }}</span>
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Ends at</span>
          <input v-model="windowForm.endsAt" class="ap-input" type="date" />
          <span v-if="windowErrors.endsAt" class="ap-form__error" role="alert">{{ windowErrors.endsAt }}</span>
        </label>
        <label class="ap-field ap-field--full">
          <span class="ap-field__label">Teachers</span>
          <input class="ap-input" type="text" placeholder="Search teachers by name or email..." list="window-teachers" />
          <datalist id="window-teachers">
            <option v-for="option in staffOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </datalist>
        </label>
      </div>
      <p v-if="dialogError" class="ap-form__error" role="alert">{{ dialogError }}</p>
    </AdminDialog>
  </AdminModuleShell>

  <!-- ── results entry ─────────────────────────────────────────────────── -->
  <AdminModuleShell
    v-else-if="isEntry"
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :banner="banner"
    :empty-count="entryRows.length"
    @retry="loadEntry"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button v-if="permitted('results.upload')" type="button" class="ap-btn ap-btn--primary" :disabled="busy || !classFilter" @click="submitResults">
        Submit Results
      </button>
    </template>

    <template #filters>
      <div class="ap-toolbar">
        <label class="ap-filter"><span>Academic Session</span>
          <select v-model="entrySession" class="ap-input"><option>2026/2027</option><option>2025/2026</option></select>
        </label>
        <label class="ap-filter"><span>Term</span>
          <select v-model="entryTerm" class="ap-input"><option>First</option><option>Second</option><option>Third</option></select>
        </label>
        <label class="ap-filter"><span>Class</span>
          <select v-model="classFilter" class="ap-input" @change="loadEntry">
            <option value="">Select class</option>
            <option v-for="option in classOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
      </div>
    </template>

    <template #empty>
      <p>{{ classFilter ? 'No students in this class.' : 'Select class first' }}</p>
    </template>

    <dl class="ap-fields">
      <div><dt>CLASS POPULATION</dt><dd>{{ entry?.classPopulation ?? 0 }}</dd></div>
      <div><dt>ACADEMIC SESSION</dt><dd>{{ entry?.academicSession ?? '—' }}</dd></div>
      <div><dt>CLASS AVG.</dt><dd>{{ classAverage }}</dd></div>
      <div><dt>CLASS HIGHEST SCORE</dt><dd>{{ classHighest }}</dd></div>
      <div><dt>CLASS LOWEST SCORE</dt><dd>{{ classLowest }}</dd></div>
      <div><dt>PASS MARK</dt><dd>{{ entry?.grading.passMark ?? 40 }}</dd></div>
      <div><dt>MAX CA</dt><dd>{{ entry?.grading.maxCA ?? 40 }}</dd></div>
      <div><dt>MAX EXAM</dt><dd>{{ entry?.grading.maxExam ?? 60 }}</dd></div>
    </dl>

    <div class="ap-table-wrap">
      <table class="ap-table">
        <caption class="ap-table__caption">{{ entryRows.length }} student(s)</caption>
        <thead>
          <tr>
            <th scope="col">S/N</th>
            <th scope="col">SURNAME</th>
            <th scope="col">OTHER NAMES</th>
            <th scope="col">ADMISSION NO.</th>
            <th scope="col">SEX</th>
            <th scope="col">STUDENT TYPE</th>
            <th scope="col" class="ap-num">CA 1 (20)</th>
            <th scope="col" class="ap-num">CA 2 (10)</th>
            <th scope="col" class="ap-num">PROJ/ASS (10)</th>
            <th scope="col" class="ap-num">EXAM (60)</th>
            <th scope="col" class="ap-num">TOTAL (100)</th>
            <th scope="col" class="ap-num">AVG. (100)</th>
            <th scope="col">GRADE</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in entryRows" :key="row.studentId">
            <td>{{ index + 1 }}</td>
            <td>{{ row.surname }}</td>
            <td>{{ row.otherNames }}</td>
            <td>{{ row.admissionNo }}</td>
            <td>{{ row.sex }}</td>
            <td>{{ row.studentType }}</td>
            <td class="ap-num"><input v-model.number="(entry!.rows[index] as ResultEntryRow).ca1" class="ap-input ap-results__mark" type="number" :aria-label="`${row.surname} ${row.otherNames} — CA 1 mark`" min="0" max="20" /></td>
            <td class="ap-num"><input v-model.number="(entry!.rows[index] as ResultEntryRow).ca2" class="ap-input ap-results__mark" type="number" :aria-label="`${row.surname} ${row.otherNames} — CA 2 mark`" min="0" max="10" /></td>
            <td class="ap-num"><input v-model.number="(entry!.rows[index] as ResultEntryRow).project" class="ap-input ap-results__mark" type="number" :aria-label="`${row.surname} ${row.otherNames} — Project mark`" min="0" max="10" /></td>
            <td class="ap-num"><input v-model.number="(entry!.rows[index] as ResultEntryRow).exam" class="ap-input ap-results__mark" type="number" :aria-label="`${row.surname} ${row.otherNames} — Exam mark`" min="0" max="60" /></td>
            <td class="ap-num">{{ row.total }}</td>
            <td class="ap-num">{{ row.total }}</td>
            <td>{{ row.grade }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <section class="ap-results__block">
      <h3 class="ap-results__heading">GRADES &amp; RATINGS</h3>
      <div class="ap-table-wrap">
        <table class="ap-table">
          <thead><tr><th scope="col">Score Range</th><th scope="col">Grade</th><th scope="col">Rating</th></tr></thead>
          <tbody>
            <tr v-for="band in (entry?.grading.bands ?? [])" :key="band.grade">
              <td>{{ band.minScore }}&ndash;{{ band.maxScore }}</td>
              <td>{{ band.grade }}</td>
              <td>{{ band.label }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="ap-inline-note">PASS MARK: {{ entry?.grading.passMark ?? 40 }}</p>
    </section>
  </AdminModuleShell>

  <!-- ── the queue and committee review ────────────────────────────────── -->
  <AdminModuleShell
    v-else-if="isQueue || isCommittee"
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :empty-count="rows.length"
    :banner="banner"
    @retry="load"
    @dismiss="banner = ''"
  >
    <template #filters>
      <div class="ap-tabs" role="tablist" aria-label="Queue status">
        <button
          v-for="entry in QUEUE_TABS"
          :key="entry.key"
          type="button"
          role="tab"
          class="ap-tab"
          :class="{ 'ap-tab--on': tab === entry.key }"
          :aria-selected="tab === entry.key"
          @click="tab = entry.key"
        >
          {{ entry.label }}
        </button>
      </div>
    </template>

    <template #empty>
      <p>{{ isCommittee ? 'No results tagged to you for review.' : 'No results in this queue.' }}</p>
    </template>

    <div class="ap-table-wrap">
      <table class="ap-table">
        <thead>
          <tr>
            <th scope="col">Submission</th>
            <th scope="col">Session</th>
            <th scope="col">Term</th>
            <th scope="col">Class</th>
            <th scope="col">Subject</th>
            <th scope="col">Teacher</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="ap-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visibleQueue" :key="row.id">
            <td>{{ row.title }}</td>
            <td>{{ row.academicSession }}</td>
            <td>{{ row.term }}</td>
            <td>{{ row.className }}</td>
            <td>{{ row.subjectName }}</td>
            <td>{{ row.teacherName }}</td>
            <td><AdminStatusBadge :status="row.status" /></td>
            <td class="ap-table__actions">
              <template v-if="isCommittee">
                <button
                  v-if="permitted('results.committee.review') && row.status === 'COMMITTEE_TAGGED'"
                  type="button"
                  class="ap-btn ap-btn--xs ap-btn--primary"
                  :disabled="busy"
                  @click="decide(row, 'REVIEW')"
                >
                  Review
                </button>
              </template>
              <template v-else>
                <button
                  v-if="permitted('results.vet') && row.status === 'PENDING'"
                  type="button"
                  class="ap-btn ap-btn--xs"
                  :disabled="busy"
                  @click="decide(row, 'TAG')"
                >
                  Tag committee
                </button>
                <button
                  v-if="permitted('results.vet') && row.status === 'COMMITTEE_TAGGED'"
                  type="button"
                  class="ap-btn ap-btn--xs ap-btn--primary"
                  :disabled="busy"
                  @click="decide(row, 'VET')"
                >
                  Vet
                </button>
                <button
                  v-if="permitted('results.publish') && row.status === 'VETTED'"
                  type="button"
                  class="ap-btn ap-btn--xs ap-btn--primary"
                  :disabled="busy"
                  @click="decide(row, 'PUBLISH')"
                >
                  Publish
                </button>
                <button
                  v-if="permitted('results.publish') && ['PENDING', 'COMMITTEE_TAGGED', 'VETTED'].includes(row.status)"
                  type="button"
                  class="ap-btn ap-btn--xs ap-btn--danger"
                  :disabled="busy"
                  @click="declineId = row.id"
                >
                  Decline
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="queueRows.some((r) => r.status === 'DECLINED')" class="ap-results__block">
      <h3 class="ap-results__heading">Declined</h3>
      <ul class="ap-inline-note">
        <li v-for="row in queueRows.filter((r) => r.status === 'DECLINED')" :key="row.id">
          <strong>{{ row.title }}</strong> — {{ row.declineReason }}
        </li>
      </ul>
    </div>

    <AdminDialog
      :open="declineId !== ''"
      kind="confirm"
      title="Decline this result"
      confirm-label="Decline"
      danger
      :busy="busy"
      @close="declineId = ''"
      @confirm="decide(queueRows.find((r) => r.id === declineId)!, 'DECLINE')"
    >
      <label class="ap-field">
        <span class="ap-field__label">Reason <span class="ap-field__req">*</span></span>
        <textarea v-model="declineNote" class="ap-input ap-input--area" rows="3" />
      </label>
    </AdminDialog>
  </AdminModuleShell>

  <!--
    ── the grading scale ─────────────────────────────────────────────────
    Guarded on `grading` as well as `isGrading`, and the guard is load-bearing:
    `loading` starts `false` and only becomes `true` inside `onMounted`, so on the
    first paint the shell's slot is rendered with `grading` still null — and
    `grading!.passMark` in that slot is a null dereference. The other four
    kinds here are safe because their slots read through optional chaining or hold
    no state at all; this one binds to the object's fields directly.
  -->
  <AdminModuleShell
    v-else-if="isGrading && grading"
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :banner="banner"
    :empty-count="grading.bands.length"
    @retry="loadGrading"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button v-if="permitted('results.grading.manage')" type="button" class="ap-btn ap-btn--primary" :disabled="busy" @click="saveGrading">
        Save changes
      </button>
    </template>

    <div class="ap-table-wrap">
      <table class="ap-table">
        <caption class="ap-table__caption">Grading Scale</caption>
        <thead>
          <tr>
            <th scope="col">Grade Code</th>
            <th scope="col" class="ap-num">Min Score</th>
            <th scope="col" class="ap-num">Max Score</th>
            <th scope="col">Label</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(band, index) in grading?.bands ?? []" :key="band.grade">
            <td>{{ band.grade }}</td>
            <td class="ap-num"><input v-model.number="grading!.bands[index].minScore" class="ap-input ap-results__mark" type="number" :aria-label="`Grade ${band.grade} min score`" min="0" max="100" /></td>
            <td class="ap-num"><input v-model.number="grading!.bands[index].maxScore" class="ap-input ap-results__mark" type="number" :aria-label="`Grade ${band.grade} max score`" min="0" max="100" /></td>
            <td><input v-model="grading!.bands[index].label" class="ap-input" type="text" :aria-label="`Grade ${band.grade} label`" /></td>
          </tr>
        </tbody>
      </table>
    </div>

    <dl class="ap-fields">
      <div><dt>Pass Mark</dt><dd><input v-model.number="grading!.passMark" class="ap-input ap-results__mark" type="number" min="0" max="100" /></dd></div>
      <div><dt>Max CA</dt><dd>{{ grading?.maxCA ?? 40 }}</dd></div>
      <div><dt>Max Exam</dt><dd>{{ grading?.maxExam ?? 60 }}</dd></div>
    </dl>

    <p v-if="Object.keys(gradingErrors).length" class="ap-form__error" role="alert">
      {{ Object.values(gradingErrors)[0] }}
    </p>
  </AdminModuleShell>

  <!-- ── student results and report cards ──────────────────────────────── -->
  <AdminModuleShell
    v-else
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :empty-count="rows.length"
    :banner="banner"
    @retry="load"
    @dismiss="banner = ''"
  >
    <template #filters>
      <div class="ap-toolbar">
        <label class="ap-filter">
          <span>Class</span>
          <select v-model="classFilter" class="ap-input" @change="load">
            <option value="">All Classes</option>
            <option v-for="option in classOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <input
          v-model="search"
          class="ap-input ap-toolbar__search"
          type="search"
          :placeholder="module.searchPlaceholder || 'Search...'"
          :aria-label="'Search ' + module.title"
          @change="load"
        />
      </div>
    </template>

    <template #empty>
      <p>{{ isReportCards ? 'No students found.' : 'No student results found.' }}</p>
    </template>

    <template v-if="isReportCards && reportCard">
      <button type="button" class="ap-btn ap-btn--ghost" @click="detailId = ''">&larr; Back</button>
      <div class="ap-card">
        <h3 class="ap-card__title">{{ reportCard.name }}</h3>
        <p class="ap-inline-note">{{ reportCard.admissionNo }} &middot; {{ reportCard.className }} &middot; {{ reportCard.armName }}</p>
        <div class="ap-table-wrap">
          <table class="ap-table">
            <caption class="ap-table__caption">GRADES &amp; RATINGS</caption>
            <thead><tr><th scope="col">Subject</th><th scope="col" class="ap-num">CA</th><th scope="col" class="ap-num">Exam</th><th scope="col" class="ap-num">Total</th><th scope="col">Grade</th><th scope="col">Remark</th></tr></thead>
            <tbody>
              <tr v-for="subject in reportCard.subjects" :key="subject.subjectName">
                <td>{{ subject.subjectName }}</td>
                <td class="ap-num">{{ subject.ca }}</td>
                <td class="ap-num">{{ subject.exam }}</td>
                <td class="ap-num">{{ subject.total }}</td>
                <td>{{ subject.grade }}</td>
                <td>{{ subject.remark }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <dl class="ap-fields">
          <div><dt>Total</dt><dd>{{ reportCard.total }}</dd></div>
          <div><dt>Average</dt><dd>{{ reportCard.average }}</dd></div>
          <div><dt>Grade</dt><dd>{{ reportCard.grade }}</dd></div>
          <div><dt>Remark</dt><dd>{{ reportCard.remark }}</dd></div>
          <div><dt>Attendance</dt><dd>{{ reportCard.attendance }}%</dd></div>
          <div><dt>Position</dt><dd>{{ reportCard.position }}</dd></div>
        </dl>
      </div>
    </template>

    <template v-else>
      <div class="ap-table-wrap">
        <table class="ap-table">
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">Class</th>
              <th v-if="isReportCards" scope="col">Admission No.</th>
              <th scope="col" class="ap-num">Total</th>
              <th scope="col" class="ap-num">Average</th>
              <th scope="col">Grade</th>
              <th v-if="isReportCards" scope="col">Remark</th>
              <th v-else scope="col" class="ap-num">Position</th>
              <th scope="col"><span class="ap-sr">Details</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in studentRows" :key="row.id">
              <td>{{ row.name }}</td>
              <td>{{ row.className }}</td>
              <td v-if="isReportCards">{{ row.admissionNo }}</td>
              <td class="ap-num">{{ row.total }}</td>
              <td class="ap-num">{{ row.average }}</td>
              <td>{{ row.grade }}</td>
              <td v-if="isReportCards">{{ row.remark }}</td>
              <td v-else class="ap-num">{{ row.position }}</td>
              <td class="ap-table__actions">
                <button v-if="isReportCards" type="button" class="ap-btn ap-btn--xs" @click="detailId = row.id">View report card</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </AdminModuleShell>
</template>

<style scoped>
@import './admin-panel.css';

.ap-results__block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ap-results__heading {
  margin: 0;
  font-size: 0.9375rem;
}

.ap-results__mark {
  min-width: 4.5rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
