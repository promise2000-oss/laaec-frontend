<script setup lang="ts">
/**
 * Class Teacher Weekly Report panel (D-72) — the origin's 5 routes collapsed.
 *
 * Origin routes folded in: `/teacher/class-teacher-weekly-report`, `/create`,
 * `/[id]`, `/[id]/edit`, and the share dialog that the detail page opens for a
 * submitted report.
 *
 * THREE ORIGIN BEHAVIOURS REPRODUCED THAT LOOK LIKE BUGS
 * ------------------------------------------------------
 * 1. NO VALIDATION AT ALL. `ClassTeacherWeeklyReportForm` has no `validate()`
 *    function, so every field is optional and blank strings are submitted as
 *    `undefined`. This panel therefore has no required-field guard on save,
 *    while the lesson-plan and weekly-report panels beside it do. That is not an
 *    oversight in this port; it is the origin.
 * 2. NO REVIEW STEP. The lifecycle is `draft → submitted` and stops. There is no
 *    approve, no reject, no finalize — so unlike Lesson Planning and Weekly
 *    Report, there is nothing to review from this module.
 * 3. THE STATUS BADGE SHOWS THE RAW STRING. The origin renders a `Badge` whose
 *    child is the literal status, with no label mapping and no vocabulary, so
 *    `submitted` appears in lowercase while the other two modules show `Approved`
 *    and `Reviewed`. Reproduced by passing no `label` to the badge.
 *
 * The attendance preview is also the origin's: it refires on a 400 ms debounce
 * when the class or the week-ending range changes, is skipped when nothing is
 * chosen yet, and its failure copy is
 * `Could not load attendance for the selected week.`
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { callApi } from '../../api';
import { useTeacherSession } from './useTeacherSession';
import TeacherModuleShell from './TeacherModuleShell.vue';
import TeacherStatusBadge from './TeacherStatusBadge.vue';
import type {
  AttendancePreview,
  ClassTeacherReport,
  ClassTeacherReportStatus,
  LeadershipEntry,
  ReferenceClass,
} from '../../types/teacher';
import { WEEKDAYS } from '../../types/teacher';

const TABS: ReadonlyArray<{ id: ClassTeacherReportStatus | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'submitted', label: 'Submitted' },
];

const session = useTeacherSession();

const reports = ref<ClassTeacherReport[]>([]);
const loading = ref(false);
const loadError = ref('');
const banner = ref('');
const tab = ref<ClassTeacherReportStatus | 'all'>('all');

const classes = ref<ReferenceClass[]>([]);
const superiors = ref<LeadershipEntry[]>([]);

/* `editing` holds the report under edit; `viewing` the one being read. */
const editing = ref<ClassTeacherReport | null>(null);
const viewing = ref<ClassTeacherReport | null>(null);
const saving = ref(false);
const formError = ref('');

/* Share dialog, as the origin's `ShareClassTeacherWeeklyReportDialog`. */
const sharing = ref<ClassTeacherReport | null>(null);
const superiorQuery = ref('');
const selectedSuperior = ref<LeadershipEntry | null>(null);
const sharingBusy = ref(false);

/* Attendance preview. */
const preview = ref<AttendancePreview | null>(null);
const previewLoading = ref(false);
const previewError = ref('');

const visible = computed(() =>
  tab.value === 'all' ? reports.value : reports.value.filter((r) => r.status === tab.value),
);

/* A date range's weekdays, Monday to Friday — the origin's `weekDayDates`. */
const weekdaysInRange = computed<Array<ClassTeacherReport['attendance'][number]['day']>>(() => {
  const start = editing.value?.weekEndingStart ?? '';
  const end = editing.value?.weekEndingEnd ?? '';
  if (!start || !end) return [];
  const from = new Date(start);
  const to = new Date(end);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return [];
  const days = new Set<string>();
  const cursor = new Date(from);
  while (cursor <= to) {
    const name = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
      cursor.getDay()
    ];
    if (name && name !== 'sunday' && name !== 'saturday') days.add(name);
    cursor.setDate(cursor.getDate() + 1);
  }
  return WEEKDAYS.filter((day) => days.has(day));
});

const formatDate = (value: string): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

const canShare = (report: ClassTeacherReport): boolean =>
  report.teacherUsername === session.username() && report.status === 'submitted';

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_CLASS_TEACHER_REPORTS', {
      schoolID: session.schoolID(),
      teacherUsername: session.username(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load reports');
    reports.value = data.reports;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load reports';
  } finally {
    loading.value = false;
  }
};

const shiftDays = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const blank = (): ClassTeacherReport => ({
  id: '',
  teacherUsername: session.username(),
  teacherName: session.teacherName(),
  classId: classes.value[0]?.id ?? '',
  className: classes.value[0]?.name ?? '',
  sectionId: classes.value[0]?.sectionId ?? '',
  weekEndingStart: shiftDays(-4),
  weekEndingEnd: shiftDays(0),
  week: '',
  callsFromParents: '',
  callsToParents: '',
  teacherResponse: '',
  dailyReports: {
    monday: '',
    tuesday: '',
    wednesday: '',
    thursday: '',
    friday: '',
  },
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
});

const startCreate = (): void => {
  formError.value = '';
  editing.value = blank();
  viewing.value = null;
};

const openView = (report: ClassTeacherReport): void => {
  viewing.value = report;
  editing.value = null;
  formError.value = '';
};

const startEdit = (report: ClassTeacherReport): void => {
  editing.value = { ...report, dailyReports: { ...report.dailyReports } };
  viewing.value = null;
  formError.value = '';
};

const closeDetail = (): void => {
  editing.value = null;
  viewing.value = null;
  formError.value = '';
};

const onClassChange = (): void => {
  const chosen = classes.value.find((c) => c.id === editing.value?.classId);
  if (editing.value && chosen) {
    editing.value.className = chosen.name;
    editing.value.sectionId = chosen.sectionId ?? '';
  }
};

/** Keeps the attendance rows in step with the date range. */
const syncAttendanceRows = (): void => {
  const report = editing.value;
  if (!report) return;
  const wanted = weekdaysInRange.value;
  report.attendance = wanted.map((day) => {
    const existing = report.attendance.find((row) => row.day === day);
    return existing ?? { day, present: 0, absent: 0 };
  });
};

/* The origin's 400 ms debounce, with a latest-wins guard. */
const PREVIEW_DEBOUNCE_MS = 400;
let previewTimer: ReturnType<typeof setTimeout> | undefined;
let previewSeq = 0;

const loadPreview = async (): Promise<void> => {
  const report = editing.value;
  if (!report?.className || !report.weekEndingStart || !report.weekEndingEnd) return;
  const token = ++previewSeq;
  previewLoading.value = true;
  previewError.value = '';
  try {
    const data = await callApi('GET_ATTENDANCE_PREVIEW', {
      schoolID: session.schoolID(),
      className: report.className,
      from: report.weekEndingStart,
      to: report.weekEndingEnd,
    });
    if (token !== previewSeq) return;
    if (data.status !== 'success' || !data.preview) {
      throw new Error(data.message || 'Could not load attendance for the selected week.');
    }
    preview.value = data.preview;
    report.absenteesMonday = data.preview.absentees.monday;
    report.absenteesWeek = data.preview.absentees.tuesdayFriday;
  } catch (e) {
    if (token !== previewSeq) return;
    previewError.value =
      e instanceof Error ? e.message : 'Could not load attendance for the selected week.';
  } finally {
    if (token === previewSeq) previewLoading.value = false;
  }
};

watch(
  () => [editing.value?.className, editing.value?.weekEndingStart, editing.value?.weekEndingEnd],
  () => {
    syncAttendanceRows();
    preview.value = null;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => void loadPreview(), PREVIEW_DEBOUNCE_MS);
  },
);

onBeforeUnmount(() => clearTimeout(previewTimer));

const save = async (status: ClassTeacherReportStatus): Promise<void> => {
  const report = editing.value;
  if (!report) return;
  saving.value = true;
  formError.value = '';
  try {
    // No client-side validation, matching the origin's absent `validate()`.
    const data = await callApi('SAVE_CLASS_TEACHER_REPORT', {
      schoolID: session.schoolID(),
      reportId: report.id || undefined,
      report,
      status,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not save this report.');
    banner.value =
      status === 'draft' ? 'Draft saved.' : 'Report saved and submitted. The mentor has been notified.';
    closeDetail();
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Could not save this report.';
  } finally {
    saving.value = false;
  }
};

const filteredSuperiors = computed(() => {
  const needle = superiorQuery.value.trim().toLowerCase();
  if (!needle) return superiors.value;
  return superiors.value.filter((entry) =>
    `${entry.fullName} ${entry.email} ${entry.roleNames.join(' ')}`.toLowerCase().includes(needle),
  );
});

const openShare = async (report: ClassTeacherReport): Promise<void> => {
  sharing.value = report;
  superiorQuery.value = '';
  selectedSuperior.value = null;
  if (superiors.value.length === 0) {
    try {
      const data = await callApi('GET_CLASS_TEACHER_SUPERIORS', { schoolID: session.schoolID() });
      if (data.status === 'success') superiors.value = data.superiors;
    } catch {
      superiors.value = [];
    }
  }
};

const confirmShare = async (): Promise<void> => {
  const report = sharing.value;
  const target = selectedSuperior.value;
  if (!report || !target) return;
  sharingBusy.value = true;
  try {
    const data = await callApi('SHARE_CLASS_TEACHER_REPORT', {
      schoolID: session.schoolID(),
      reportId: report.id,
      username: target.username,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to share the report.');
    banner.value = `Report shared with ${target.fullName}.`;
    sharing.value = null;
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Failed to share the report.';
  } finally {
    sharingBusy.value = false;
  }
};

onMounted(async () => {
  await load();
  try {
    const data = await callApi('GET_MY_CLASS_TEACHING', {
      schoolID: session.schoolID(),
      teacherUsername: session.username(),
    });
    if (data.status === 'success') {
      classes.value = data.classes;
      // The origin auto-selects when the teacher has exactly one class.
      if (classes.value.length === 1 && !editing.value) {
        editing.value = { ...blank(), ...classes.value[0] };
      }
    }
  } catch {
    classes.value = [];
  }
});
</script>

<template>
  <TeacherModuleShell
    title="Class Teacher Weekly Report"
    description="Create a report for the week ending with attendance, parent calls and class affairs"
    :loading="loading"
    :error="loadError"
    :empty-count="reports.length"
    @retry="load"
    :banner="banner"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button type="button" class="tp-btn tp-btn--primary" @click="startCreate">New Report</button>
    </template>

    <template #filters>
      <div class="tp-tabs" role="tablist" aria-label="Report status">
        <button
          v-for="entry in TABS"
          :key="entry.id"
          type="button"
          role="tab"
          class="tp-tab"
          :class="{ 'tp-tab--on': tab === entry.id }"
          @click="tab = entry.id"
        >
          {{ entry.label }}
        </button>
      </div>
    </template>

    <template #empty>
      <p>No class teacher weekly reports yet</p>
      <button type="button" class="tp-btn tp-btn--primary tp-empty__cta" @click="startCreate">
        Create a report for the week ending with attendance, parent calls and class affairs.
      </button>
    </template>

    <!-- The origin's printed document, as a form. -->
    <div v-if="editing" class="tp-card">
      <h3 class="tp-card__title">
        {{ editing.id ? 'Edit class teacher weekly report' : 'New class teacher weekly report' }}
      </h3>
      <p class="tp-inline-note">ST. FINBARR'S COLLEGE, AKOKA &ndash; LAGOS. Report for the week ending</p>

      <div class="tp-form">
        <label class="tp-field">
          <span class="tp-field__label">From</span>
          <input v-model="editing.weekEndingStart" class="tp-input" type="date" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">To</span>
          <input v-model="editing.weekEndingEnd" class="tp-input" type="date" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Week</span>
          <input v-model="editing.week" class="tp-input" placeholder="e.g. Week 2" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Class</span>
          <select v-model="editing.classId" class="tp-input" @change="onClassChange">
            <option value="">Select class</option>
            <option v-for="entry in classes" :key="entry.id" :value="entry.id">{{ entry.name }}</option>
          </select>
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Class teacher's name</span>
          <input v-model="editing.teacherName" class="tp-input" />
        </label>
      </div>

      <div class="tp-toolbar">
        <button
          type="button"
          class="tp-btn"
          :disabled="previewLoading || !editing.className || !editing.weekEndingStart || !editing.weekEndingEnd"
          @click="loadPreview"
        >
          {{ previewLoading ? 'Loading...' : 'Refresh' }} attendance
        </button>
        <p v-if="preview" class="tp-inline-note">
          {{ preview.present }} present, {{ preview.absent }} absent.
        </p>
      </div>
      <p v-if="previewError" class="tp-form__error" role="alert">{{ previewError }}</p>

      <div v-if="editing.attendance.length" class="tp-table-wrap">
        <table class="tp-table">
          <caption class="tp-table__caption">Daily attendance</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Present</th>
              <th scope="col">Absent</th>
              <th scope="col">Daily activity / lesson note</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in editing.attendance" :key="row.day">
              <th scope="row" style="text-transform: capitalize">{{ row.day }}</th>
              <td>
                <input
                  v-model.number="row.present"
                  class="tp-input"
                  type="number"
                  min="0"
                  style="width: 5.5rem"
                />
              </td>
              <td>
                <input
                  v-model.number="row.absent"
                  class="tp-input"
                  type="number"
                  min="0"
                  style="width: 5.5rem"
                />
              </td>
              <td>
                <input v-model="editing.dailyReports[row.day]" class="tp-input" type="text" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <label class="tp-field">
        <span class="tp-field__label">Names of absentees on Monday</span>
        <textarea v-model="editing.absenteesMonday" class="tp-input tp-input--area" rows="2" />
      </label>
      <label class="tp-field">
        <span class="tp-field__label">Names of absentees from Tuesday to Friday</span>
        <textarea v-model="editing.absenteesWeek" class="tp-input tp-input--area" rows="2" />
      </label>

      <label class="tp-field">
        <span class="tp-field__label">Calls received from parents during the week</span>
        <textarea v-model="editing.callsFromParents" class="tp-input tp-input--area" rows="1" />
      </label>
      <label class="tp-field">
        <span class="tp-field__label">Calls made to parents during the week</span>
        <textarea v-model="editing.callsToParents" class="tp-input tp-input--area" rows="1" />
      </label>
      <label class="tp-field">
        <span class="tp-field__label">Your response and follow-up actions</span>
        <textarea v-model="editing.teacherResponse" class="tp-input tp-input--area" rows="2" />
      </label>

      <template
        v-for="band in [
          ['SICK STUDENTS', 'sickStudents', ''],
          ['FAULTY FACILITIES / GADGETS', 'faultyFacilities', ''],
          ['REPORTS / COMPLAINTS FROM TEACHERS', 'reportsFromTeachers', ''],
          ['REPORTS / COMPLAINTS FROM STUDENTS', 'reportsFromStudents', ''],
          ['STUDENTS FEEDBACK ABOUT SUBJECT TEACHERS', 'studentsFeedbackAboutTeachers', ''],
          ['RESPONSE FROM CLASS TEACHERS', 'responseFromClassTeachers', ''],
          ['REMEDIAL CLASSES REPORT (FROM SUBJECT TEACHERS)', 'remedialClassesReport', ''],
          ['CASES / ISSUES FOR MANAGEMENT\'S ATTENTION', 'casesForManagement', ''],
          ['CHECKING OF NOTES', 'checkingOfNotes', ''],
          ['CLASS CAPTAIN\'S REPORT', 'classCaptainsReport', ''],
        ]"
        :key="band[1] as string"
      >
        <h4 class="tp-band">{{ band[0] }}</h4>
        <textarea
          v-model="editing[band[1] as keyof ClassTeacherReport] as string"
          class="tp-input tp-input--area"
          rows="2"
        />
      </template>

      <h4 class="tp-band">MENTOR'S REPORT</h4>
      <label class="tp-field">
        <span class="tp-field__label">Mentor's remarks on the class and the class teacher</span>
        <textarea v-model="editing.mentorsReport" class="tp-input tp-input--area" rows="3" />
      </label>

      <p v-if="formError" class="tp-form__error" role="alert">{{ formError }}</p>

      <div class="tp-detail__actions">
        <button type="button" class="tp-btn tp-btn--ghost" :disabled="saving" @click="closeDetail">
          Cancel
        </button>
        <button type="button" class="tp-btn" :disabled="saving" @click="save('draft')">
          {{ saving ? 'Saving...' : 'Save Draft' }}
        </button>
        <button type="button" class="tp-btn tp-btn--primary" :disabled="saving" @click="save('submitted')">
          {{ saving ? 'Saving...' : 'Save & Submit' }}
        </button>
      </div>
    </div>

    <div v-else-if="viewing" class="tp-card">
      <button type="button" class="tp-btn tp-btn--ghost" @click="closeDetail">
        &larr; Back to reports
      </button>
      <h3 class="tp-card__title">{{ viewing.className }} — {{ viewing.week || 'week not set' }}</h3>
      <dl class="tp-fields">
        <div>
          <dt>Week ending</dt>
          <dd>{{ formatDate(viewing.weekEndingStart) }} – {{ formatDate(viewing.weekEndingEnd) }}</dd>
        </div>
        <div><dt>Class teacher</dt><dd>{{ viewing.teacherName }}</dd></div>
        <div><dt>Status</dt><dd>{{ viewing.status }}</dd></div>
      </dl>
      <div class="tp-detail__actions">
        <TeacherStatusBadge :status="viewing.status" :variant="viewing.status === 'submitted' ? 'default' : 'secondary'" />
        <button
          v-if="canShare(viewing)"
          type="button"
          class="tp-btn"
          @click="openShare(viewing)"
        >
          Share with superior
        </button>
        <button type="button" class="tp-btn" @click="startEdit(viewing)">Edit</button>
      </div>
    </div>

    <div v-else class="tp-table-wrap">
      <table class="tp-table">
        <caption class="tp-table__caption">{{ reports.length }} report(s) created.</caption>
        <thead>
          <tr>
            <th scope="col">Week Ending</th>
            <th scope="col">Week</th>
            <th scope="col">Class</th>
            <th scope="col">Teacher</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="tp-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="report in visible"
            :key="report.id"
            class="tp-row"
            tabindex="0"
            @click="openView(report)"
            @keydown.enter="openView(report)"
          >
            <td>{{ formatDate(report.weekEndingStart) }} – {{ formatDate(report.weekEndingEnd) }}</td>
            <td>{{ report.week || '—' }}</td>
            <td>{{ report.className }}</td>
            <td>{{ report.teacherName }}</td>
            <td>
              <!-- Raw status, as the origin renders it. -->
              <TeacherStatusBadge
                :status="report.status"
                :variant="report.status === 'submitted' ? 'default' : 'secondary'"
              />
            </td>
            <td class="tp-table__actions">
              <button type="button" class="tp-btn tp-btn--ghost tp-btn--xs" @click.stop="openView(report)">
                View
              </button>
              <button type="button" class="tp-btn tp-btn--ghost tp-btn--xs" @click.stop="startEdit(report)">
                Edit
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="sharing" class="tp-modal" role="alertdialog" aria-label="Share Report with Superior">
      <div class="tp-modal__box">
        <h4 class="tp-modal__title">Share Report with Superior</h4>
        <p class="tp-modal__body">
          Select a leadership staff member to share this report with via direct message.
        </p>
        <input
          v-model="superiorQuery"
          class="tp-input"
          type="search"
          placeholder="Search by name, email, or role..."
        />
        <p v-if="superiors.length === 0" class="tp-inline-note" style="margin-top: 0.5rem">
          No superiors found
        </p>
        <ul v-else-if="filteredSuperiors.length" class="tp-sharelist">
          <li v-for="entry in filteredSuperiors" :key="entry.username">
            <button
              type="button"
              class="tp-picker__option"
              :class="{ 'tp-picker__option--on': selectedSuperior?.username === entry.username }"
              @click="selectedSuperior = entry"
            >
              <span>{{ entry.fullName }}</span>
              <span>{{ entry.roleNames.join(', ') }}</span>
            </button>
          </li>
        </ul>
        <p v-else class="tp-inline-note" style="margin-top: 0.5rem">No superiors found</p>

        <p v-if="selectedSuperior" class="tp-inline-note" style="margin-top: 0.5rem">
          Selected: {{ selectedSuperior.fullName }} — {{ selectedSuperior.roleNames.join(', ') }}
        </p>

        <div class="tp-modal__actions">
          <button type="button" class="tp-btn tp-btn--ghost" @click="sharing = null">Cancel</button>
          <button
            type="button"
            class="tp-btn tp-btn--primary"
            :disabled="!selectedSuperior || sharingBusy"
            @click="confirmShare"
          >
            {{ sharingBusy ? 'Sharing...' : 'Share' }}
          </button>
        </div>
      </div>
    </div>
  </TeacherModuleShell>
</template>

<style scoped>
@import './teacher-panel.css';

.tp-detail__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

.tp-form__error {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: #8f2a2a;
}

.tp-sharelist {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  max-height: 170px;
  overflow-y: auto;
  display: grid;
  gap: 0.25rem;
}

.tp-picker__option {
  width: 100%;
  text-align: left;
  font: inherit;
  font-size: 0.8125rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 0.4375rem 0.5rem;
  cursor: pointer;
  display: grid;
  gap: 0.125rem;
}

.tp-picker__option:hover {
  background: #f4f8fd;
}

.tp-picker__option--on {
  background: #eaf2fb;
  border-color: #bcd6f0;
}

.tp-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(11 34 66 / 0.72);
  backdrop-filter: blur(6px);
  z-index: var(--z-modal);
  padding: 1rem;
}

.tp-modal__box {
  background: #fff;
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  width: min(92%, 440px);
  max-height: 86vh;
  overflow-y: auto;
  box-shadow: 0 12px 32px rgb(18 23 34 / 0.14);
}

.tp-modal__title {
  margin: 0 0 0.375rem;
  font-size: 0.9375rem;
}

.tp-modal__body {
  margin: 0 0 0.625rem;
  font-size: 0.8125rem;
  color: var(--text-muted, #5b6472);
}

.tp-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}
</style>