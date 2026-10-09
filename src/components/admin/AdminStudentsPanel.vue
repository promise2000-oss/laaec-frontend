<script setup lang="ts">
/**
 * AdminStudentsPanel — `/students`: the list, the class/category filters and the
 * Add Student & Parent form.
 *
 * WHY IT IS NOT THE GENERIC PANEL
 * -------------------------------
 * Two reasons, both about the form. The live form is sectioned —
 * `Academic Details`, `Personal Details`, `Parent / Guardian Onboarding` — and the
 * guardian block is not optional: six of its fields are marked required and the
 * section's own copy says it is "used to automatically onboard the parent to the
 * portal and link them to this student". A flat field list would lose both the
 * grouping an operator navigates by and the fact that the guardian half is what
 * makes the enrolment complete.
 *
 * The second reason is the row. The live student row shows the name, the
 * admission number, class, arm, session and category, and the row opens a student
 * profile rather than a generic detail dump. This renders the profile inline,
 * because a link to a route this portal does not have would be the blank-page
 * failure `nav.ts` documents.
 *
 * VALIDATION, verbatim from the live forms
 * ----------------------------------------
 * The new-student form marks these required: Arm, First Name, Last Name, Student
 * Category, Guardian Email, Guardian First Name, Guardian Last Name, Guardian
 * Phone, Guardian Address. The edit form's own messages are "First name is
 * required", "Last name is required", "Arm is required", "Category is required".
 * Both sets are reproduced.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { callApi } from '../../api';
/* The sectioned enrolment form is an inline dialog rather than the shared one:
   its body is two labelled sections with their own headings, which the shared
   dialog's single slot has nowhere to put. The import is here because the
   component is referenced in the template, and an unresolved component name is a
   render-time warning rather than a build error — so nothing else catches it. */
import AdminDialog from './AdminDialog.vue';
import AdminStatusBadge from './AdminStatusBadge.vue';
import AdminModuleShell from './AdminModuleShell.vue';
import { useAdminSession } from './useAdminSession';
import type { AdminModule } from '../../types/admin-registry';

const props = defineProps<{ module: AdminModule }>();
const can = defineModel<((permission?: string | null) => boolean) | null>('can', { default: null });

const session = useAdminSession();
const mayAdd = computed(() => (can.value ? can.value('students.add') : true));
const mayEdit = computed(() => (can.value ? can.value('students.update') : true));
const mayDelete = computed(() => (can.value ? can.value('students.delete') : true));

const CATEGORIES = ['DAY', 'BOARDING'] as const;

interface StudentRow extends Record<string, unknown> {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  className: string;
  armName: string;
  academicSession: string;
  category: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
  guardianRelationship: string;
  guardianOccupation: string;
  guardianAddress: string;
}

const rows = ref<StudentRow[]>([]);
const total = ref(0);
const page = ref(1);
const search = ref('');
const category = ref('');
const loading = ref(false);
const loadError = ref('');
const banner = ref('');
const busy = ref(false);
const formError = ref('');
const errors = ref<Record<string, string>>({});

const classOptions = ref<Array<{ value: string; label: string }>>([]);
const armOptions = ref<Array<{ value: string; label: string }>>([]);

const detailId = ref('');
const formOpen = ref(false);
const editingId = ref('');
const confirmDelete = ref<StudentRow | null>(null);

const PAGE_SIZE = 10;

const form = ref({
  admissionNo: '',
  academicSession: '2026/2027',
  className: '',
  armName: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  category: 'DAY',
  dateOfBirth: '',
  guardianFirstName: '',
  guardianLastName: '',
  guardianEmail: '',
  guardianPhone: '',
  guardianRelationship: '',
  guardianOccupation: '',
  guardianAddress: '',
});

const detail = computed(() => rows.value.find((r) => r.id === detailId.value) ?? null);
const visible = computed(() => rows.value);
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const filters: Record<string, string> = {};
    if (category.value) filters.category = category.value;
    const data = await callApi('LIST_ADMIN_RECORDS', {
      resource: 'students',
      search: search.value || undefined,
      filters,
      page: page.value,
      limit: PAGE_SIZE,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load students.');
    rows.value = data.records as StudentRow[];
    total.value = data.total;

    const classes = await callApi('GET_ADMIN_OPTION_LIST', { key: 'classes' });
    classOptions.value = classes.status === 'success' ? classes.options : [];
    const arms = await callApi('GET_ADMIN_OPTION_LIST', { key: 'arms' });
    armOptions.value = arms.status === 'success' ? arms.options : [];
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load students.';
    rows.value = [];
  } finally {
    loading.value = false;
  }
};

let timer: ReturnType<typeof setTimeout> | null = null;
watch(search, () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    page.value = 1;
    void load();
  }, 250);
});
watch([category, page], () => void load());

onMounted(load);

const armsForClass = computed(() =>
  armOptions.value.filter((option) => option.label.startsWith(form.value.className + ' ·')),
);

const openCreate = (): void => {
  editingId.value = '';
  errors.value = {};
  formError.value = '';
  form.value = {
    admissionNo: '',
    academicSession: '2026/2027',
    className: '',
    armName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    category: 'DAY',
    dateOfBirth: '',
    guardianFirstName: '',
    guardianLastName: '',
    guardianEmail: '',
    guardianPhone: '',
    guardianRelationship: '',
    guardianOccupation: '',
    guardianAddress: '',
  };
  formOpen.value = true;
};

const openEdit = (row: StudentRow): void => {
  editingId.value = row.id;
  errors.value = {};
  formError.value = '';
  form.value = {
    admissionNo: row.admissionNo,
    academicSession: row.academicSession,
    className: row.className,
    armName: row.armName,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    category: row.category,
    dateOfBirth: row.dateOfBirth,
    guardianFirstName: (row.guardianName || '').split(' ')[0] ?? '',
    guardianLastName: (row.guardianName || '').split(' ').slice(1).join(' '),
    guardianEmail: row.guardianEmail,
    guardianPhone: row.guardianPhone,
    guardianRelationship: row.guardianRelationship,
    guardianOccupation: row.guardianOccupation,
    guardianAddress: row.guardianAddress,
  };
  detailId.value = '';
  formOpen.value = true;
};

/* The live form's required set, checked in the order the form lays them out. */
const REQUIRED: ReadonlyArray<[keyof typeof form.value, string]> = [
  ['className', 'Class is required'],
  ['armName', 'Arm is required'],
  ['firstName', 'First name is required'],
  ['lastName', 'Last name is required'],
  ['category', 'Category is required'],
  ['guardianFirstName', 'Guardian first name is required'],
  ['guardianLastName', 'Guardian last name is required'],
  ['guardianEmail', 'Guardian email is required'],
  ['guardianPhone', 'Guardian phone is required'],
  ['guardianAddress', 'Guardian address is required'],
];

const validate = (): boolean => {
  const found: Record<string, string> = {};
  for (const [key, message] of REQUIRED) {
    if (!String(form.value[key] ?? '').trim()) found[key as string] = message;
  }
  if (form.value.guardianEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.value.guardianEmail)) {
    found.guardianEmail = 'Please enter a valid email address.';
  }
  errors.value = found;
  return Object.keys(found).length === 0;
};

const submit = async (): Promise<void> => {
  if (!validate()) return;
  busy.value = true;
  formError.value = '';
  try {
    const guardianName = `${form.value.guardianFirstName} ${form.value.guardianLastName}`.trim();
    const data = await callApi('SAVE_ADMIN_RECORD', {
      resource: 'students',
      id: editingId.value || undefined,
      record: {
        ...form.value,
        guardianName,
        admissionNo: form.value.admissionNo.trim() || `ADM-${Date.now()}`,
      },
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Save failed.');
    banner.value = editingId.value ? 'Student saved.' : 'Student and parent enrolled.';
    formOpen.value = false;
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Save failed.';
  } finally {
    busy.value = false;
  }
};

const remove = async (): Promise<void> => {
  if (!confirmDelete.value) return;
  busy.value = true;
  try {
    const data = await callApi('DELETE_ADMIN_RECORD', {
      resource: 'students',
      id: confirmDelete.value.id,
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Delete failed.');
    banner.value = 'Student deleted.';
    confirmDelete.value = null;
    detailId.value = '';
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Delete failed.';
  } finally {
    busy.value = false;
  }
};

const fullName = (row: StudentRow): string => `${row.firstName} ${row.lastName}`.trim();
</script>

<template>
  <AdminModuleShell
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :empty-count="total"
    :banner="banner"
    @retry="load"
    @dismiss="banner = ''"
  >
    <template #actions>
      <label class="ap-filter">
        <span>Category</span>
        <select v-model="category" class="ap-input" aria-label="Category">
          <option value="">All categories</option>
          <option v-for="entry in CATEGORIES" :key="entry" :value="entry">{{ entry === 'DAY' ? 'Day' : 'Boarding' }}</option>
        </select>
      </label>
      <button v-if="mayAdd" type="button" class="ap-btn ap-btn--primary" @click="openCreate">Add Student &amp; Parent</button>
    </template>

    <template #filters>
      <div class="ap-toolbar">
        <input
          v-model="search"
          class="ap-input ap-toolbar__search"
          type="search"
          placeholder="Search by name or admission number..."
          aria-label="Search students"
        />
      </div>
    </template>

    <template #empty>
      <p>No students match your filters.</p>
    </template>

    <!-- The profile view, where the live page navigates to. -->
    <template v-if="detail">
      <button type="button" class="ap-btn ap-btn--ghost" @click="detailId = ''">&larr; Back to students</button>
      <div class="ap-card">
        <div class="ap-identity">
          <span class="ap-avatar" aria-hidden="true">{{ fullName(detail).slice(0, 2).toUpperCase() }}</span>
          <span class="ap-identity__text">
            <span class="ap-identity__name">{{ fullName(detail) }}</span>
            <span class="ap-identity__sub">{{ detail.admissionNo }}</span>
          </span>
        </div>
        <h4 class="ap-band">Academic</h4>
        <dl class="ap-fields">
          <div><dt>Class</dt><dd>{{ detail.className }}</dd></div>
          <div><dt>Arm</dt><dd>{{ detail.armName }}</dd></div>
          <div><dt>Session</dt><dd>{{ detail.academicSession }}</dd></div>
          <div><dt>Category</dt><dd><AdminStatusBadge :status="detail.category" /></dd></div>
        </dl>
        <h4 class="ap-band">Personal</h4>
        <dl class="ap-fields">
          <div><dt>Email</dt><dd>{{ detail.email || '—' }}</dd></div>
          <div><dt>Phone</dt><dd>{{ detail.phone || '—' }}</dd></div>
          <div><dt>Date of birth</dt><dd>{{ detail.dateOfBirth || '—' }}</dd></div>
        </dl>
        <h4 class="ap-band">Parent / Guardian</h4>
        <dl class="ap-fields">
          <div><dt>Name</dt><dd>{{ detail.guardianName || '—' }}</dd></div>
          <div><dt>Email</dt><dd>{{ detail.guardianEmail || '—' }}</dd></div>
          <div><dt>Phone</dt><dd>{{ detail.guardianPhone || '—' }}</dd></div>
          <div><dt>Relationship</dt><dd>{{ detail.guardianRelationship || '—' }}</dd></div>
          <div><dt>Occupation</dt><dd>{{ detail.guardianOccupation || '—' }}</dd></div>
          <div><dt>Address</dt><dd>{{ detail.guardianAddress || '—' }}</dd></div>
        </dl>
        <div class="ap-detail__actions">
          <button v-if="mayEdit" type="button" class="ap-btn ap-btn--primary" @click="openEdit(detail)">Edit</button>
          <button v-if="mayDelete" type="button" class="ap-btn ap-btn--danger" @click="confirmDelete = detail">Delete</button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="ap-table-wrap">
        <table class="ap-table">
          <caption class="ap-table__caption">Showing {{ (page - 1) * PAGE_SIZE + 1 }}–{{ Math.min(page * PAGE_SIZE, total) }} of {{ total }} students</caption>
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">Class</th>
              <th scope="col">Arm</th>
              <th scope="col">Academic Session</th>
              <th scope="col">Category</th>
              <th scope="col"><span class="ap-sr">Details</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in visible" :key="row.id" class="ap-row" tabindex="0" @click="detailId = row.id" @keydown.enter="detailId = row.id">
              <td>
                <div class="ap-identity">
                  <span class="ap-avatar" aria-hidden="true">{{ fullName(row).slice(0, 2).toUpperCase() }}</span>
                  <span class="ap-identity__text">
                    <span class="ap-identity__name">{{ fullName(row) }}</span>
                    <span class="ap-identity__sub">{{ row.admissionNo }}</span>
                  </span>
                </div>
              </td>
              <td>{{ row.className }}</td>
              <td>{{ row.armName }}</td>
              <td>{{ row.academicSession }}</td>
              <td><AdminStatusBadge :status="row.category" /></td>
              <td class="ap-table__actions">
                <button type="button" class="ap-btn ap-btn--xs" @click.stop="detailId = row.id">View details</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="pageCount > 1" class="ap-pager">
        <span>Showing {{ (page - 1) * PAGE_SIZE + 1 }}–{{ Math.min(page * PAGE_SIZE, total) }} of {{ total }}</span>
        <span class="ap-pager__buttons">
          <button type="button" class="ap-btn ap-btn--xs" :disabled="page <= 1" @click="page = page - 1">Prev</button>
          <span>Page {{ page }} of {{ pageCount }}</span>
          <button type="button" class="ap-btn ap-btn--xs" :disabled="page >= pageCount" @click="page = page + 1">Next</button>
        </span>
      </div>
    </template>

    <!-- The sectioned form. -->
    <div v-if="formOpen" class="ap-dialog" role="presentation" @mousedown.self="formOpen = false">
      <div class="ap-dialog__panel" role="dialog" aria-modal="true" aria-label="Add Student & Parent">
        <header class="ap-dialog__head">
          <h3 class="ap-dialog__title">{{ editingId ? 'Edit Student' : 'Add Student & Parent' }}</h3>
          <button type="button" class="ap-btn ap-btn--ghost ap-btn--xs" aria-label="Close" @click="formOpen = false">&times;</button>
        </header>
        <div class="ap-dialog__body">
          <p class="ap-inline-note">{{ editingId ? 'Update the student record.' : 'Create a new student record with their parent or guardian.' }}</p>

          <h4 class="ap-band">Academic Details</h4>
          <p class="ap-inline-note">School and class placement information.</p>
          <div class="ap-form">
            <label class="ap-field">
              <span class="ap-field__label">Admission Number</span>
              <input v-model="form.admissionNo" class="ap-input" type="text" />
              <span class="ap-field__hint">Left blank, the portal generates one.</span>
            </label>
            <label class="ap-field">
              <span class="ap-field__label">Academic Session</span>
              <select v-model="form.academicSession" class="ap-input">
                <option>2026/2027</option>
                <option>2025/2026</option>
              </select>
            </label>
            <label class="ap-field">
              <span class="ap-field__label">Class</span>
              <select v-model="form.className" class="ap-input">
                <option value="">Select class</option>
                <option v-for="option in classOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <span v-if="errors.className" class="ap-form__error" role="alert">{{ errors.className }}</span>
            </label>
            <label class="ap-field">
              <span class="ap-field__label">Arm <span class="ap-field__req">*</span></span>
              <select v-model="form.armName" class="ap-input">
                <option value="">Select arm</option>
                <option v-for="option in armsForClass" :key="option.value" :value="option.value.replace(form.className + ' · ', '')">
                  {{ option.label }}
                </option>
              </select>
              <span v-if="errors.armName" class="ap-form__error" role="alert">{{ errors.armName }}</span>
            </label>
          </div>

          <h4 class="ap-band">Personal Details</h4>
          <p class="ap-inline-note">Student's basic personal information.</p>
          <div class="ap-form">
            <label class="ap-field">
              <span class="ap-field__label">First Name <span class="ap-field__req">*</span></span>
              <input v-model="form.firstName" class="ap-input" type="text" />
              <span v-if="errors.firstName" class="ap-form__error" role="alert">{{ errors.firstName }}</span>
            </label>
            <label class="ap-field">
              <span class="ap-field__label">Last Name <span class="ap-field__req">*</span></span>
              <input v-model="form.lastName" class="ap-input" type="text" />
              <span v-if="errors.lastName" class="ap-form__error" role="alert">{{ errors.lastName }}</span>
            </label>
            <label class="ap-field">
              <span class="ap-field__label">Email Address</span>
              <input v-model="form.email" class="ap-input" type="email" />
            </label>
            <label class="ap-field">
              <span class="ap-field__label">Phone Number</span>
              <input v-model="form.phone" class="ap-input" type="tel" />
            </label>
            <label class="ap-field">
              <span class="ap-field__label">Student Category <span class="ap-field__req">*</span></span>
              <select v-model="form.category" class="ap-input">
                <option v-for="entry in CATEGORIES" :key="entry" :value="entry">{{ entry === 'DAY' ? 'Day' : 'Boarding' }}</option>
              </select>
              <span v-if="errors.category" class="ap-form__error" role="alert">{{ errors.category }}</span>
            </label>
            <label class="ap-field">
              <span class="ap-field__label">Date of Birth</span>
              <input v-model="form.dateOfBirth" class="ap-input" type="date" />
            </label>
          </div>

          <h4 class="ap-band">Parent / Guardian Onboarding</h4>
          <p class="ap-inline-note">Used to automatically onboard the parent to the portal and link them to this student.</p>
          <div class="ap-form">
            <label class="ap-field">
              <span class="ap-field__label">Guardian First Name <span class="ap-field__req">*</span></span>
              <input v-model="form.guardianFirstName" class="ap-input" type="text" />
              <span v-if="errors.guardianFirstName" class="ap-form__error" role="alert">{{ errors.guardianFirstName }}</span>
            </label>
            <label class="ap-field">
              <span class="ap-field__label">Guardian Last Name <span class="ap-field__req">*</span></span>
              <input v-model="form.guardianLastName" class="ap-input" type="text" />
              <span v-if="errors.guardianLastName" class="ap-form__error" role="alert">{{ errors.guardianLastName }}</span>
            </label>
            <label class="ap-field">
              <span class="ap-field__label">Guardian Email <span class="ap-field__req">*</span></span>
              <input v-model="form.guardianEmail" class="ap-input" type="email" />
              <span v-if="errors.guardianEmail" class="ap-form__error" role="alert">{{ errors.guardianEmail }}</span>
            </label>
            <label class="ap-field">
              <span class="ap-field__label">Guardian Phone <span class="ap-field__req">*</span></span>
              <input v-model="form.guardianPhone" class="ap-input" type="tel" />
              <span v-if="errors.guardianPhone" class="ap-form__error" role="alert">{{ errors.guardianPhone }}</span>
            </label>
            <label class="ap-field">
              <span class="ap-field__label">Relationship</span>
              <select v-model="form.guardianRelationship" class="ap-input">
                <option value="">Select relationship</option>
                <option>FATHER</option>
                <option>MOTHER</option>
                <option>OTHER</option>
              </select>
            </label>
            <label class="ap-field">
              <span class="ap-field__label">Guardian Occupation</span>
              <input v-model="form.guardianOccupation" class="ap-input" type="text" />
            </label>
            <label class="ap-field ap-field--full">
              <span class="ap-field__label">Guardian Address <span class="ap-field__req">*</span></span>
              <input v-model="form.guardianAddress" class="ap-input" type="text" />
              <span v-if="errors.guardianAddress" class="ap-form__error" role="alert">{{ errors.guardianAddress }}</span>
            </label>
          </div>

          <p v-if="formError" class="ap-form__error" role="alert">{{ formError }}</p>
        </div>
        <footer class="ap-dialog__foot">
          <button type="button" class="ap-btn" :disabled="busy" @click="formOpen = false">Cancel</button>
          <button type="button" class="ap-btn ap-btn--primary" :disabled="busy" @click="submit">
            {{ busy ? 'Saving...' : 'Save Student' }}
          </button>
        </footer>
      </div>
    </div>

    <AdminDialog
      :open="confirmDelete !== null"
      kind="confirm"
      :title="confirmDelete ? `Delete ${fullName(confirmDelete)}?` : ''"
      message="This removes the student record. It cannot be undone."
      confirm-label="Delete"
      danger
      :busy="busy"
      @close="confirmDelete = null"
      @confirm="remove"
    >
      <p v-if="formError" class="ap-form__error" role="alert">{{ formError }}</p>
    </AdminDialog>
  </AdminModuleShell>
</template>

<style scoped>
@import './admin-panel.css';
</style>
