<script setup lang="ts">
/**
 * AdminAttendanceSheetsPanel — `/attendance` and `/students/attendance`: the two
 * sheet lists, plus the register each sheet opens.
 *
 * WHAT THE LIVE PAGES DO
 * ----------------------
 * `/attendance` shows one card per staff sheet with its title and week count, and
 * `Click here to mark attendance`. `/students/attendance` is the same, per class.
 * `Add New Sheet` opens a form — a title plus term and session for staff, a class
 * picker for students — and the live student form notes that "Classes with an
 * existing sheet are hidden here".
 *
 * WHAT THIS DOES
 * --------------
 * The same two lists, the same create form, and a register: add a week, mark each
 * person present / absent / unmarked, and save through `SAVE_ATTENDANCE_MARKS`.
 * The mark buttons are the three the live register offers, and an unmarked day is
 * a real state rather than an absence — which is the distinction the report's
 * `Unmarked` column exists to show.
 */
import { computed, onMounted, ref } from 'vue';
import { callApi } from '../../api';
import AdminDialog from './AdminDialog.vue';
import AdminModuleShell from './AdminModuleShell.vue';
import { useAdminSession } from './useAdminSession';
import type { AdminModule } from '../../types/admin-registry';
import type { AttendanceSheet } from '../../types/admin';

const props = defineProps<{ module: AdminModule }>();
const can = defineModel<((permission?: string | null) => boolean) | null>('can', { default: null });

const session = useAdminSession();
const permitted = (permission?: string): boolean => {
  if (!permission) return true;
  return can.value ? can.value(permission) : true;
};

/** The student sheets carry a class; the staff sheets do not. */
const isStudentScope = computed(() => props.module.resource === 'attendance-sheets' && props.module.id.startsWith('student'));

const sheets = ref<AttendanceSheet[]>([]);
const classes = ref<Array<{ value: string; label: string }>>([]);
const classOptions = ref<Array<{ value: string; label: string }>>([]);
const register = ref<Array<{ id: string; name: string; identifier: string }>>([]);
const loading = ref(false);
const loadError = ref('');
const banner = ref('');
const busy = ref(false);
const dialogError = ref('');
const errors = ref<Record<string, string>>({});

const openSheet = ref<AttendanceSheet | null>(null);
const activeWeekId = ref('');
const marks = ref<Record<string, string>>({});

const createOpen = ref(false);
const createTitle = ref('');
const createTerm = ref('First');
const createSession = ref('2026/2027');
const createClass = ref('');

const markValues = ['present', 'absent', 'unmarked'] as const;
type MarkValue = (typeof markValues)[number];

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_ADMIN_ATTENDANCE_SHEETS', {
      category: isStudentScope.value ? 'student' : 'staff',
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load sheets.');
    sheets.value = data.sheets;

    const list = await callApi('GET_ADMIN_OPTION_LIST', { key: 'classes' });
    classes.value = list.status === 'success' ? list.options : [];
    /* The live student form hides classes that already have a sheet. Reproduced,
       because a class appearing twice is the bug the copy calls out. */
    classOptions.value = isStudentScope.value
      ? classes.value.filter((option) => !sheets.value.some((sheet) => sheet.className === option.value))
      : classes.value;

    if (isStudentScope.value) {
      const people = await callApi('LIST_ADMIN_RECORDS', { resource: 'students', limit: 200 });
      if (people.status === 'success') register.value = (people.records as Array<Record<string, unknown> & { id: string }>).map((row) => ({
        id: String(row.id),
        name: `${row.fullName}`,
        identifier: String(row.admissionNo ?? ''),
      }));
    } else {
      const people = await callApi('LIST_ADMIN_RECORDS', { resource: 'staff', limit: 200 });
      if (people.status === 'success') register.value = (people.records as Array<Record<string, unknown> & { id: string }>).map((row) => ({
        id: String(row.id),
        name: String(row.fullName),
        identifier: String(row.staffNo ?? ''),
      }));
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load sheets.';
    sheets.value = [];
  } finally {
    loading.value = false;
  }
};

const openRegister = (sheet: AttendanceSheet): void => {
  openSheet.value = sheet;
  activeWeekId.value = sheet.weeks[0]?.id ?? '';
  syncMarks();
};

const activeWeek = computed(() => openSheet.value?.weeks.find((w) => w.id === activeWeekId.value) ?? null);

const syncMarks = (): void => {
  const week = activeWeek.value;
  marks.value = {};
  if (!week) return;
  /* The register's marks are keyed by index, which is how the mock stores them;
     the ids shown here are the person ids. Index alignment is what makes the two
     agree, so it is resolved here rather than guessing at the mapping. */
  register.value.forEach((person, index) => {
    marks.value[person.id] = week.marks[String(index)] ?? 'unmarked';
  });
};

const setMark = (personId: string, value: MarkValue): void => {
  marks.value = { ...marks.value, [personId]: value };
};

const saveMarks = async (): Promise<void> => {
  if (!openSheet.value || !activeWeek.value) return;
  busy.value = true;
  dialogError.value = '';
  try {
    /* The mock keys marks by register index, so the person ids are mapped back
       before the call. Doing it here keeps the contract's `marks` shape as the
       origin's — a person → mark map keyed by register position. */
    const payload: Record<string, AttendanceSheet['weeks'][number]['marks'][string]> = {};
    register.value.forEach((person, index) => {
      payload[String(index)] = (marks.value[person.id] ?? 'unmarked') as MarkValue;
    });
    const data = await callApi('SAVE_ATTENDANCE_MARKS', {
      sheetId: openSheet.value.id,
      weekId: activeWeek.value.id,
      marks: payload,
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Save failed.');
    banner.value = data.message || 'Attendance saved.';
    await load();
    const refreshed = sheets.value.find((s) => s.id === openSheet.value?.id);
    if (refreshed) openSheet.value = refreshed;
  } catch (e) {
    dialogError.value = e instanceof Error ? e.message : 'Save failed.';
  } finally {
    busy.value = false;
  }
};

const addWeek = async (): Promise<void> => {
  if (!openSheet.value) return;
  busy.value = true;
  dialogError.value = '';
  try {
    const data = await callApi('SAVE_ATTENDANCE_SHEET', {
      sheetId: openSheet.value.id,
      week: {
        label: `Week ${openSheet.value.weeks.length + 1}`,
        date: new Date().toISOString().slice(0, 10),
        marks: {},
      },
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Save failed.');
    banner.value = 'Week added.';
    await load();
    const refreshed = sheets.value.find((s) => s.id === openSheet.value?.id);
    if (refreshed) {
      openSheet.value = refreshed;
      activeWeekId.value = refreshed.weeks[refreshed.weeks.length - 1]?.id ?? '';
      syncMarks();
    }
  } catch (e) {
    dialogError.value = e instanceof Error ? e.message : 'Save failed.';
  } finally {
    busy.value = false;
  }
};

const validateCreate = (): boolean => {
  const found: Record<string, string> = {};
  if (isStudentScope.value && !createClass.value) found.className = 'Select the class';
  if (!isStudentScope.value && !createTitle.value.trim()) found.title = 'Sheet Title is optional';
  errors.value = found;
  return Object.keys(found).length === 0;
};

const createSheet = async (): Promise<void> => {
  if (!validateCreate()) return;
  busy.value = true;
  dialogError.value = '';
  try {
    const data = await callApi('SAVE_ATTENDANCE_SHEET', {
      category: isStudentScope.value ? 'student' : 'staff',
      title: createTitle.value.trim(),
      term: createTerm.value,
      academicSession: createSession.value,
      className: createClass.value,
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Save failed.');
    banner.value = 'Sheet created.';
    createOpen.value = false;
    createTitle.value = '';
    createClass.value = '';
    await load();
  } catch (e) {
    dialogError.value = e instanceof Error ? e.message : 'Save failed.';
  } finally {
    busy.value = false;
  }
};

onMounted(load);
</script>

<template>
  <AdminModuleShell
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :empty-count="sheets.length"
    :banner="banner"
    @retry="load"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button
        v-if="permitted('attendance.manage')"
        type="button"
        class="ap-btn ap-btn--primary"
        @click="createOpen = true"
      >
        Add New Sheet
      </button>
    </template>

    <template #empty>
      <p>No {{ isStudentScope ? 'class' : 'staff' }} attendance sheets yet.</p>
    </template>

    <div class="ap-cards">
      <article v-for="sheet in sheets" :key="sheet.id" class="ap-card">
        <h3 class="ap-card__title">{{ sheet.title }}</h3>
        <p class="ap-inline-note">{{ sheet.weeks.length }} weeks</p>
        <p v-if="!isStudentScope" class="ap-inline-note">{{ sheet.term }} Term {{ sheet.academicSession }}</p>
        <button
          v-if="permitted('attendance.mark')"
          type="button"
          class="ap-btn ap-btn--xs"
          @click="openRegister(sheet)"
        >
          Click here to mark attendance
        </button>
      </article>
    </div>

    <!-- The register. -->
    <AdminDialog
      :open="openSheet !== null"
      :title="openSheet ? openSheet.title : ''"
      confirm-label="Save attendance"
      :busy="busy"
      @close="openSheet = null"
      @confirm="saveMarks"
    >
      <div class="ap-toolbar">
        <label class="ap-filter">
          <span>Week</span>
          <select v-model="activeWeekId" class="ap-input" @change="syncMarks">
            <option v-for="week in openSheet?.weeks ?? []" :key="week.id" :value="week.id">
              {{ week.label }} — {{ week.date }}
            </option>
            <option v-if="(openSheet?.weeks.length ?? 0) === 0" value="">No weeks yet</option>
          </select>
        </label>
        <button
          v-if="permitted('attendance.manage')"
          type="button"
          class="ap-btn ap-btn--xs"
          @click="addWeek"
        >
          Add week
        </button>
      </div>

      <p v-if="(openSheet?.weeks.length ?? 0) === 0" class="ap-inline-note">
        This sheet has no weeks yet. Add one to start marking attendance.
      </p>

      <div v-else class="ap-table-wrap">
        <table class="ap-table">
          <caption class="ap-table__caption">{{ register.length }} in the register</caption>
          <thead>
            <tr>
              <th scope="col">{{ isStudentScope ? 'Student' : 'Staff' }}</th>
              <th scope="col">Identifier</th>
              <th scope="col">Mark</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="person in register" :key="person.id">
              <td>{{ person.name }}</td>
              <td>{{ person.identifier }}</td>
              <td>
                <span class="ap-marks">
                  <button
                    v-for="value in markValues"
                    :key="value"
                    type="button"
                    class="ap-btn ap-btn--xs"
                    :class="{ 'ap-btn--primary': marks[person.id] === value }"
                    :aria-pressed="marks[person.id] === value"
                    @click="setMark(person.id, value)"
                  >
                    {{ value }}
                  </button>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="dialogError" class="ap-form__error" role="alert">{{ dialogError }}</p>
    </AdminDialog>

    <!-- Add a sheet. -->
    <AdminDialog
      :open="createOpen"
      :title="isStudentScope ? 'New Attendance Sheet' : 'New Staff Attendance Sheet'"
      confirm-label="Create Sheet"
      :busy="busy"
      @close="createOpen = false"
      @confirm="createSheet"
    >
      <p v-if="isStudentScope" class="ap-inline-note">
        Classes with an existing sheet are hidden here. Each class has its own attendance sheet and weeks.
      </p>

      <label class="ap-field">
        <span class="ap-field__label">{{ isStudentScope ? 'Class' : 'Sheet Title' }}</span>
        <select v-if="isStudentScope" v-model="createClass" class="ap-input">
          <option value="">Select a class</option>
          <option v-for="option in classOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
        <input v-else v-model="createTitle" class="ap-input" type="text" placeholder="Optional. Give this attendance sheet a descriptive name." />
        <span v-if="errors.className" class="ap-form__error" role="alert">{{ errors.className }}</span>
        <span v-else-if="!isStudentScope" class="ap-field__hint">Optional. Give this attendance sheet a descriptive name.</span>
      </label>

      <template v-if="!isStudentScope">
        <label class="ap-field">
          <span class="ap-field__label">Term</span>
          <select v-model="createTerm" class="ap-input">
            <option>First</option>
            <option>Second</option>
            <option>Third</option>
          </select>
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Academic Session</span>
          <select v-model="createSession" class="ap-input">
            <option>2026/2027</option>
            <option>2025/2026</option>
          </select>
        </label>
      </template>

      <p v-if="dialogError" class="ap-form__error" role="alert">{{ dialogError }}</p>
    </AdminDialog>
  </AdminModuleShell>
</template>

<style scoped>
@import './admin-panel.css';

.ap-marks {
  display: inline-flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}
</style>
