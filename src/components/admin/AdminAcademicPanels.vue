/**
 * AdminAcademicPanels — the five academic-settings modules whose behaviour is
 * not a plain table: the class/arm hierarchy, the timetable grid, and the three
 * assignment pages.
 *
 * WHY THE HIERARCHY NEEDS ITS OWN COMPONENT
 * -----------------------------------------
 * `/academic/classes` lists classes with their arm counts; `/academic/sections`
 * (Arms) lists the arms GROUPED UNDER THEIR CLASS, with a `Filter by class`
 * select. Rendering arms as a flat table would lose the grouping that is the whole
 * point of the page — an operator asks "what arms does JSS 1 have", not "what
 * arms exist" — so the hierarchy is rendered as sections, one per class, with the
 * filter narrowing the sections rather than the rows.
 *
 * WHY THE TIMETABLE IS ITS OWN COMPONENT
 * --------------------------------------
 * `/academic/timetables/new` is a grid: rows are time slots (FROM / TO), columns
 * are Monday to Friday, and each cell holds a subject and a teacher. That is a
 * matrix, not a list, and a generic table renderer cannot express it. The live
 * grid's column headers and the `Add Time Slot` button are reproduced; the
 * existing timetable opens in read mode with the same grid.
 *
 * WHAT IS NOT HERE
 * ----------------
 * `/academic/sessions`, `/academic/subjects`, `/academic/assignments`,
 * `/academic/class-teachers` and `/academic/subject-teachers` ARE plain lists with
 * a create dialog and go through `AdminResourcePanel`.
 */
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { callApi } from '../../api';
import AdminDialog from './AdminDialog.vue';
import AdminModuleShell from './AdminModuleShell.vue';
import { useAdminSession } from './useAdminSession';
import type { AdminModule } from '../../types/admin-registry';

const props = defineProps<{ module: AdminModule }>();
const can = defineModel<((permission?: string | null) => boolean) | null>('can', { default: null });

const session = useAdminSession();
const mayWrite = (permission: string): boolean => (can.value ? can.value(permission) : true);

const isClasses = computed(() => props.module.id === 'classes');
const isArms = computed(() => props.module.id === 'arms');
const isTimetables = computed(() => props.module.id === 'timetables');

/* ── data ──────────────────────────────────────────────────────────────── */

interface ClassRow extends Record<string, unknown> {
  id: string;
  name: string;
  arms: AcademicArm[];
}
interface AcademicArm {
  id: string;
  className: string;
  name: string;
}
interface TimetableRow extends Record<string, unknown> {
  id: string;
  title: string;
  className: string;
  armName: string;
  slots: TimetableSlot[];
}
interface TimetableSlot {
  id: string;
  from: string;
  to: string;
  cells: Array<{ subjectId: string; teacherName: string }>;
}
const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

const classes = ref<ClassRow[]>([]);
const arms = ref<AcademicArm[]>([]);
const timetables = ref<TimetableRow[]>([]);
const subjects = ref<Array<{ value: string; label: string }>>([]);
const staffOptions = ref<Array<{ value: string; label: string }>>([]);
const classOptions = ref<Array<{ value: string; label: string }>>([]);
const armOptions = ref<Array<{ value: string; label: string }>>([]);

const search = ref('');
const classFilter = ref('');
const loading = ref(false);
const loadError = ref('');
const banner = ref('');
const busy = ref(false);
const formError = ref('');
const errors = ref<Record<string, string>>({});

/* ── the timetable grid ────────────────────────────────────────────────── */

const openTimetableId = ref('');
const draftTitle = ref('');
const draftDescription = '';
/* A draft slot carries no `id` — one is minted on save, in registration order.
   Declared without the field so the draft type is not a lie about its own shape;
   the grid reads the id off the SAVED slot only, and uses the index otherwise. */
const draftSlots = ref<Array<{ from: string; to: string; cells: Array<{ subjectId: string; teacherName: string }> }>>([
  { from: '', to: '', cells: WEEKDAYS.map(() => ({ subjectId: '', teacherName: '' })) },
]);

const openTimetable = computed(() => timetables.value.find((t) => t.id === openTimetableId.value) ?? null);

/** The key a grid row is rendered under: its saved id, or its draft position. */
const slotId = (slot: { id?: string } | object, index: number): string =>
  'id' in slot && typeof slot.id === 'string' ? slot.id : `draft-${index}`;

const gridSlots = computed(() =>
  openTimetableId.value === 'new' ? draftSlots.value : (openTimetable.value?.slots ?? []),
);

const addSlot = (): void => {
  draftSlots.value = [
    ...draftSlots.value,
    { from: '', to: '', cells: WEEKDAYS.map(() => ({ subjectId: '', teacherName: '' })) },
  ];
};

const removeSlot = (index: number): void => {
  draftSlots.value = draftSlots.value.filter((_, i) => i !== index);
};

/* ── the class / arm forms ─────────────────────────────────────────────── */

const classOpen = ref(false);
const armOpen = ref(false);
const classForm = ref({ name: '', academicSession: '2026/2027' });
const armForm = ref({ className: '', name: '' });

/* ── loading ───────────────────────────────────────────────────────────── */

/** Classes grouped by name, each with its arms — the shape `/academic/sections` shows. */
const groupedArms = computed(() => {
  const term = search.value.trim().toLowerCase();
  return classes.value
    .map((klass) => ({
      name: klass.name,
      arms: arms.value.filter((a) => a.className === klass.name),
    }))
    .filter((group) => (classFilter.value ? group.name === classFilter.value : true))
    .filter((group) => (term ? group.name.toLowerCase().includes(term) || group.arms.some((a) => a.name.toLowerCase().includes(term)) : true));
});

const filteredClasses = computed(() => {
  const term = search.value.trim().toLowerCase();
  return term ? classes.value.filter((c) => c.name.toLowerCase().includes(term)) : classes.value;
});

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const classList = await callApi('LIST_ADMIN_RECORDS', { resource: 'classes', limit: 200 });
    if (classList.status !== 'success') throw new Error(classList.message || 'Failed to load classes.');
    classes.value = classList.records as unknown as ClassRow[];

    const armList = await callApi('LIST_ADMIN_RECORDS', { resource: 'arms', limit: 400 });
    if (armList.status === 'success') arms.value = armList.records as unknown as AcademicArm[];

    const subjectList = await callApi('GET_ADMIN_OPTION_LIST', { key: 'subjects' });
    subjects.value = subjectList.status === 'success' ? subjectList.options : [];

    const staffList = await callApi('GET_ADMIN_OPTION_LIST', { key: 'staff' });
    staffOptions.value = staffList.status === 'success' ? staffList.options : [];

    const classOpts = await callApi('GET_ADMIN_OPTION_LIST', { key: 'classes' });
    classOptions.value = classOpts.status === 'success' ? classOpts.options : [];

    const armOpts = await callApi('GET_ADMIN_OPTION_LIST', { key: 'arms' });
    armOptions.value = armOpts.status === 'success' ? armOpts.options : [];

    if (isTimetables.value) {
      const tt = await callApi('LIST_ADMIN_RECORDS', { resource: 'timetables', limit: 100 });
      if (tt.status === 'success') timetables.value = tt.records as unknown as TimetableRow[];
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load.';
  } finally {
    loading.value = false;
  }
};

onMounted(load);

/* ── mutations ─────────────────────────────────────────────────────────── */

const createClass = async (): Promise<void> => {
  /* The live form's own message: "Class name is required" */
  errors.value = classForm.value.name.trim() ? {} : { name: 'Class name is required' };
  if (Object.keys(errors.value).length) return;
  busy.value = true;
  try {
    const data = await callApi('SAVE_ADMIN_RECORD', {
      resource: 'classes',
      record: { ...classForm.value, arms: [] },
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Save failed.');
    banner.value = 'Class saved.';
    classOpen.value = false;
    classForm.value = { name: '', academicSession: '2026/2027' };
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Save failed.';
  } finally {
    busy.value = false;
  }
};

const createArm = async (): Promise<void> => {
  const found: Record<string, string> = {};
  if (!armForm.value.className) found.className = 'Class is required';
  if (!armForm.value.name.trim()) found.name = 'Arm name is required';
  errors.value = found;
  if (Object.keys(found).length) return;
  busy.value = true;
  try {
    const data = await callApi('SAVE_ADMIN_RECORD', {
      resource: 'arms',
      record: { ...armForm.value },
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Save failed.');
    banner.value = 'Arm saved.';
    armOpen.value = false;
    armForm.value = { className: '', name: '' };
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Save failed.';
  } finally {
    busy.value = false;
  }
};

const saveTimetable = async (): Promise<void> => {
  const found: Record<string, string> = {};
  if (!draftTitle.value.trim()) found.title = 'Title is required';
  draftSlots.value.forEach((slot, index) => {
    if (!slot.from || !slot.to) found[`slot-${index}`] = 'A time slot needs a FROM and a TO.';
  });
  errors.value = found;
  if (Object.keys(found).length) return;

  busy.value = true;
  try {
    const data = await callApi('SAVE_ADMIN_RECORD', {
      resource: 'timetables',
      record: {
        title: draftTitle.value.trim(),
        description: draftDescription,
        academicSession: '2026/2027',
        className: '',
        armName: '',
        slots: draftSlots.value.map((slot, index) => ({ id: `SLOT-${index + 1}`, ...slot })),
      },
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Save failed.');
    banner.value = 'Timetable saved.';
    openTimetableId.value = '';
    draftTitle.value = '';
    draftSlots.value = [{ from: '', to: '', cells: WEEKDAYS.map(() => ({ subjectId: '', teacherName: '' })) }];
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Save failed.';
  } finally {
    busy.value = false;
  }
};

const subjectName = (id: string): string => subjects.value.find((s) => s.value === id)?.label ?? '';
</script>

<template>
  <!-- ── classes ───────────────────────────────────────────────────────── -->
  <AdminModuleShell
    v-if="isClasses"
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :empty-count="classes.length"
    :banner="banner"
    @retry="load"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button v-if="mayWrite('academic.manage')" type="button" class="ap-btn ap-btn--primary" @click="classOpen = true">
        Add Class
      </button>
    </template>

    <template #filters>
      <input v-model="search" class="ap-input ap-toolbar__search" type="search" placeholder="Search classes..." aria-label="Search classes" />
    </template>

    <template #empty>
      <p>No classes yet.</p>
    </template>

    <div class="ap-cards">
      <article v-for="klass in filteredClasses" :key="klass.id" class="ap-card">
        <h3 class="ap-card__title">{{ klass.name }}</h3>
        <p class="ap-inline-note">{{ klass.arms.length }} arm{{ klass.arms.length === 1 ? '' : 's' }}</p>
      </article>
    </div>

    <AdminDialog :open="classOpen" title="Add Class" confirm-label="Save class" :busy="busy" @close="classOpen = false" @confirm="createClass">
      <p class="ap-inline-note">Create a new class within an academic session.</p>
      <label class="ap-field">
        <span class="ap-field__label">Class name <span class="ap-field__req">*</span></span>
        <input v-model="classForm.name" class="ap-input" type="text" placeholder="Select class" />
        <span v-if="errors.name" class="ap-form__error" role="alert">{{ errors.name }}</span>
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Academic session</span>
        <select v-model="classForm.academicSession" class="ap-input">
          <option>2026/2027</option>
          <option>2025/2026</option>
          <option value="">No session</option>
        </select>
      </label>
      <p v-if="formError" class="ap-form__error" role="alert">{{ formError }}</p>
    </AdminDialog>
  </AdminModuleShell>

  <!-- ── arms, grouped by class ────────────────────────────────────────── -->
  <AdminModuleShell
    v-else-if="isArms"
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :empty-count="arms.length"
    :banner="banner"
    @retry="load"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button v-if="mayWrite('academic.manage')" type="button" class="ap-btn ap-btn--primary" @click="armOpen = true">Add Arm</button>
    </template>

    <template #filters>
      <div class="ap-toolbar">
        <label class="ap-filter">
          <span>Filter by class</span>
          <select v-model="classFilter" class="ap-input" aria-label="Filter by class">
            <option value="">All classes</option>
            <option v-for="option in classOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <input v-model="search" class="ap-input ap-toolbar__search" type="search" placeholder="Search arms..." aria-label="Search arms" />
      </div>
    </template>

    <template #empty>
      <p>No arms yet.</p>
    </template>

    <div v-for="group in groupedArms" :key="group.name" class="ap-acad__group">
      <h3 class="ap-acad__heading">
        {{ group.name }}
        <span class="ap-inline-note">{{ group.arms.length }} arm{{ group.arms.length === 1 ? '' : 's' }}</span>
      </h3>
      <div class="ap-cards">
        <article v-for="arm in group.arms" :key="arm.id" class="ap-card">
          <h4 class="ap-card__title">{{ arm.name }}</h4>
        </article>
      </div>
    </div>

    <AdminDialog :open="armOpen" title="Add Arm" confirm-label="Save arm" :busy="busy" @close="armOpen = false" @confirm="createArm">
      <p class="ap-inline-note">Create a new arm within a class.</p>
      <label class="ap-field">
        <span class="ap-field__label">Class <span class="ap-field__req">*</span></span>
        <select v-model="armForm.className" class="ap-input">
          <option value="">Select class</option>
          <option v-for="option in classOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
        <span v-if="errors.className" class="ap-form__error" role="alert">{{ errors.className }}</span>
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Arm name <span class="ap-field__req">*</span></span>
        <input v-model="armForm.name" class="ap-input" type="text" />
        <span v-if="errors.name" class="ap-form__error" role="alert">{{ errors.name }}</span>
      </label>
      <p v-if="formError" class="ap-form__error" role="alert">{{ formError }}</p>
    </AdminDialog>
  </AdminModuleShell>

  <!-- ── timetables ────────────────────────────────────────────────────── -->
  <AdminModuleShell
    v-else-if="isTimetables"
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :empty-count="timetables.length"
    :banner="banner"
    @retry="load"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button v-if="mayWrite('academic.timetables.manage')" type="button" class="ap-btn ap-btn--primary" @click="openTimetableId = 'new'">
        Add Timetable
      </button>
    </template>

    <template #empty>
      <p>No timetables yet. Add the first timetable to get started.</p>
    </template>

    <template v-if="openTimetableId">
      <button type="button" class="ap-btn ap-btn--ghost" @click="openTimetableId = ''">&larr; Back</button>
      <div class="ap-card">
        <h3 class="ap-card__title">{{ openTimetableId === 'new' ? 'Add Timetable' : openTimetable?.title }}</h3>

        <template v-if="openTimetableId === 'new'">
          <label class="ap-field">
            <span class="ap-field__label">Title <span class="ap-field__req">*</span></span>
            <input v-model="draftTitle" class="ap-input" type="text" />
            <span v-if="errors.title" class="ap-form__error" role="alert">{{ errors.title }}</span>
          </label>
          <label class="ap-field">
            <span class="ap-field__label">Session</span>
            <select class="ap-input"><option>2026/2027</option></select>
          </label>
          <label class="ap-field">
            <span class="ap-field__label">Class</span>
            <select class="ap-input">
              <option value="">Select class</option>
              <option v-for="option in classOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label class="ap-field">
            <span class="ap-field__label">Arm</span>
            <select class="ap-input">
              <option value="">Select arm</option>
              <option v-for="option in armOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
        </template>

        <h4 class="ap-band">Schedule Grid</h4>
        <button
          v-if="openTimetableId === 'new'"
          type="button"
          class="ap-btn ap-btn--xs"
          @click="addSlot"
        >
          Add Time Slot
        </button>

        <div class="ap-table-wrap">
          <table class="ap-table">
            <thead>
              <tr>
                <th scope="col">TIME</th>
                <th v-for="day in WEEKDAYS" :key="day" scope="col">{{ day }}</th>
                <th v-if="openTimetableId === 'new'" scope="col"><span class="ap-sr">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(slot, slotIndex) in gridSlots" :key="slotId(slot, slotIndex)">
                <td>
                  <div class="ap-acad__time">
                    <input v-model="slot.from" class="ap-input ap-results__mark" type="time" :disabled="openTimetableId !== 'new'" aria-label="From" />
                    <input v-model="slot.to" class="ap-input ap-results__mark" type="time" :disabled="openTimetableId !== 'new'" aria-label="To" />
                  </div>
                </td>
                <td v-for="(cell, cellIndex) in slot.cells" :key="cellIndex">
                  <template v-if="openTimetableId === 'new'">
                    <select v-model="cell.subjectId" class="ap-input" :aria-label="'Subject for ' + WEEKDAYS[cellIndex]">
                      <option value="">Subject</option>
                      <option v-for="option in subjects" :key="option.value" :value="option.value">{{ option.label }}</option>
                    </select>
                    <select v-model="cell.teacherName" class="ap-input" :aria-label="'Teacher for ' + WEEKDAYS[cellIndex]">
                      <option value="">Teacher</option>
                      <option v-for="option in staffOptions" :key="option.value" :value="option.value.split(' · ')[0]">{{ option.label }}</option>
                    </select>
                  </template>
                  <template v-else>
                    <span class="ap-acad__cell">{{ subjectName(cell.subjectId) }}</span>
                    <span class="ap-identity__sub">{{ cell.teacherName }}</span>
                  </template>
                </td>
                <td v-if="openTimetableId === 'new'">
                  <button type="button" class="ap-btn ap-btn--xs ap-btn--dangerish" @click="removeSlot(slotIndex)">Remove</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="Object.keys(errors).length && errors['slot-0']" class="ap-form__error" role="alert">
          {{ errors['slot-0'] }}
        </div>

        <div class="ap-detail__actions">
          <button v-if="openTimetableId === 'new'" type="button" class="ap-btn ap-btn--primary" :disabled="busy" @click="saveTimetable">
            Create Timetable
          </button>
        </div>
        <p v-if="formError" class="ap-form__error" role="alert">{{ formError }}</p>
      </div>
    </template>

    <template v-else>
      <div class="ap-cards">
        <article v-for="row in timetables" :key="row.id" class="ap-card">
          <h3 class="ap-card__title">{{ row.title }}</h3>
          <p class="ap-inline-note">{{ row.className }} · {{ row.armName }}</p>
          <button type="button" class="ap-btn ap-btn--xs" @click="openTimetableId = row.id">Open</button>
        </article>
      </div>
    </template>
  </AdminModuleShell>
</template>

<style scoped>
@import './admin-panel.css';

.ap-acad__group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ap-acad__heading {
  margin: 0;
  font-size: 0.9375rem;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.ap-acad__time {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ap-acad__cell {
  display: block;
  font-weight: 600;
}
</style>
