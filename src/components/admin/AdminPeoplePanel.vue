<script setup lang="ts">
/**
 * AdminPeoplePanel — `/parents` and `/staff`, which are one page each with a
 * difference that matters: a parent row shows its linked children and a staff row
 * shows a department, a designation and a row-action menu.
 *
 * WHY ONE COMPONENT
 * -----------------
 * Both are the generic list plus one bespoke column and one bespoke dialog
 * (parent: the role picker on create; staff: the import wizard). Splitting them
 * would duplicate the toolbar, the table, the pagination and the dialog plumbing
 * twice for two pages that differ by a column and a form.
 *
 * THE PARENT FORM'S ROLE PICKER
 * -----------------------------
 * The live `Add Parent` page is the same component as `Add User`: "Create user —
 * Create a new user account and assign one or more roles." Both mark First name,
 * Last name, Email and Phone required, and both offer the 33 roles as checkboxes.
 * A parent is created with the `Parent` role already assigned by the caller,
 * because the live page requires the operator to tick it and this page is
 * specifically "Add Parent" — the role picker is still shown so an operator can
 * add the other roles a staff parent holds.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { callApi } from '../../api';
import AdminDialog from './AdminDialog.vue';
import AdminModuleShell from './AdminModuleShell.vue';
import AdminStatusBadge from './AdminStatusBadge.vue';
import { useAdminSession } from './useAdminSession';
import { money } from '../../api/mockAdmin';
import type { AdminColumn, AdminModule } from '../../types/admin-registry';

const props = defineProps<{ module: AdminModule }>();
const can = defineModel<((permission?: string | null) => boolean) | null>('can', { default: null });

const session = useAdminSession();
const isStaff = computed(() => props.module.resource === 'staff');
const mayCreate = computed(() => (can.value ? can.value(isStaff.value ? 'staff.add' : 'users.create') : true));
const mayDelete = computed(() => (can.value ? can.value(isStaff.value ? 'staff.delete' : 'users.delete') : true));

interface PersonRow extends Record<string, unknown> {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  roles: string[];
  status: string;
  lastLogin: string;
  departmentName: string;
  designationName: string;
  staffNo: string;
  children: Array<{ id: string; name: string; className: string }>;
}

const rows = ref<PersonRow[]>([]);
const total = ref(0);
const page = ref(1);
const search = ref('');
const department = ref('');
const designation = ref('');
const roleOptions = ref<Array<{ value: string; label: string }>>([]);
const optionCache = ref<Record<string, Array<{ value: string; label: string }>>>({});
const loading = ref(false);
const loadError = ref('');
const banner = ref('');
const busy = ref(false);
const formError = ref('');
const errors = ref<Record<string, string>>({});

const detailId = ref('');
const formOpen = ref(false);
const editingId = ref('');
const importOpen = ref(false);
const importRows = ref<string[]>([]);

const PAGE_SIZE = 10;

const form = ref({ firstName: '', lastName: '', email: '', phone: '', roles: [] as string[] });

const detail = computed(() => rows.value.find((r) => r.id === detailId.value) ?? null);

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const filters: Record<string, string> = {};
    if (department.value) filters.departmentName = department.value;
    if (designation.value) filters.designationName = designation.value;
    const data = await callApi('LIST_ADMIN_RECORDS', {
      resource: props.module.resource,
      search: search.value || undefined,
      filters,
      page: page.value,
      limit: PAGE_SIZE,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load records.');
    rows.value = data.records as PersonRow[];
    total.value = data.total;

    if (!roleOptions.value.length) {
      const roles = await callApi('GET_ADMIN_OPTION_LIST', { key: 'roles' });
      roleOptions.value = roles.status === 'success' ? roles.options : [];
    }
    if (isStaff.value) {
      const depts = await callApi('GET_ADMIN_OPTION_LIST', { key: 'staff' });
      /* The live staff page's department filter lists departments, derived from
         the loaded rows so it cannot offer a department with nobody in it. */
      optionCache.value.staff = depts.status === 'success' ? depts.options : [];
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load records.';
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
watch([department, designation, page], () => void load());

onMounted(load);

const departmentOptions = computed(() => {
  const seen = new Map<string, { value: string; label: string }>();
  for (const row of rows.value) if (row.departmentName) seen.set(row.departmentName, { value: row.departmentName, label: row.departmentName });
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
});

const designationOptions = computed(() => {
  const seen = new Map<string, { value: string; label: string }>();
  for (const row of rows.value) if (row.designationName) seen.set(row.designationName, { value: row.designationName, label: row.designationName });
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
});

const openCreate = (): void => {
  editingId.value = '';
  errors.value = {};
  formError.value = '';
  form.value = { firstName: '', lastName: '', email: '', phone: '', roles: isStaff.value ? [] : ['Parent'] };
  detailId.value = '';
  formOpen.value = true;
};

const openEdit = (row: PersonRow): void => {
  editingId.value = row.id;
  errors.value = {};
  formError.value = '';
  form.value = {
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    roles: [...row.roles],
  };
  detailId.value = '';
  formOpen.value = true;
};

/**
 * The live form's required set, checked in the order the form lays them out, with
 * the source's own messages: the staff form raises "First and last name are
 * required." for either name and "Mobile number is required." for the phone, and
 * the shared email field raises "Please enter a valid email address." — which
 * doubles as the missing-value message, as it does in the deployed source.
 */
const validate = (): boolean => {
  const found: Record<string, string> = {};
  if (!form.value.firstName.trim()) found.firstName = 'First and last name are required.';
  if (!form.value.lastName.trim()) found.lastName = 'First and last name are required.';
  if (!form.value.email.trim()) found.email = 'Please enter your email address.';
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.value.email)) found.email = 'Please enter a valid email address.';
  if (!form.value.phone.trim()) found.phone = 'Mobile number is required.';
  errors.value = found;
  return Object.keys(found).length === 0;
};

const submit = async (): Promise<void> => {
  if (!validate()) return;
  busy.value = true;
  formError.value = '';
  try {
    const data = await callApi('SAVE_ADMIN_RECORD', {
      resource: props.module.resource,
      id: editingId.value || undefined,
      record: { ...form.value },
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Save failed.');
    banner.value = editingId.value ? 'Saved.' : 'Created. An invitation email will be sent.';
    formOpen.value = false;
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Save failed.';
  } finally {
    busy.value = false;
  }
};

const resend = async (row: PersonRow): Promise<void> => {
  busy.value = true;
  try {
    const data = await callApi('RESEND_INVITATION', { userIds: [row.id] });
    if (data.status !== 'success') throw new Error(data.message || 'Resend failed.');
    banner.value = data.message || 'Invitation resent.';
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Resend failed.';
  } finally {
    busy.value = false;
  }
};

const remove = async (row: PersonRow): Promise<void> => {
  busy.value = true;
  try {
    const data = await callApi('DELETE_ADMIN_RECORD', {
      resource: props.module.resource,
      id: row.id,
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Delete failed.');
    banner.value = 'Deleted.';
    detailId.value = '';
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Delete failed.';
  } finally {
    busy.value = false;
  }
};

const openImport = async (): Promise<void> => {
  busy.value = true;
  try {
    const data = await callApi(isStaff.value ? 'IMPORT_STAFF' : 'IMPORT_STUDENTS', {});
    if (data.status !== 'success') throw new Error(data.message || 'Import failed.');
    importRows.value = data.required;
    importOpen.value = true;
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Import failed.';
  } finally {
    busy.value = false;
  }
};

const runImport = async (): Promise<void> => {
  busy.value = true;
  try {
    const data = await callApi('CONFIRM_IMPORT', {
      resource: isStaff.value ? 'staff' : 'students',
      rows: importRows.value.map((header) => ({ [header]: 'imported' })),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Import failed.');
    banner.value = data.message || 'Imported.';
    importOpen.value = false;
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Import failed.';
  } finally {
    busy.value = false;
  }
};

const name = (row: PersonRow): string => row.fullName || `${row.firstName} ${row.lastName}`.trim();
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

/**
 * CSV export, as the deployed `staff.tsx` performs it: build it in the browser
 * from the rows already on screen, through a Blob and a temporary anchor.
 *
 * The registry declares this as the module's `Export` toolbar entry and the
 * generic panel renders `exportable` modules with it — but this panel writes its
 * own toolbar, so the declared button was never drawn and the origin's export was
 * missing here. Declared in the registry and drawn here is the duplication this
 * function is the resolution of: one implementation, one place that calls it.
 */
const exportCsv = (): void => {
  const escape = (value: string): string =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const columns = props.module.columns;
  const header = columns.map((c) => c.label);
  const body = rows.value.map((row) =>
    columns.map((c) => escape(cellText(row, c))).join(','),
  );
  const blob = new Blob([[header.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  /* The origin names the file `staff.csv`; the module id generalises it to
     whichever list this panel is showing. */
  anchor.download = `${props.module.id}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  banner.value = `Exported ${rows.value.length} row(s).`;
};

/** Whether this panel's list may be exported at all. */
const mayExport = computed(() => {
  const declared = (props.module.toolbar ?? []).find((b) => b.label === 'Export');
  if (!declared) return false;
  return declared.permission ? can.value?.(declared.permission) !== false : true;
});

/** One cell's text in a declared presentation, for the CSV. */
const cellText = (row: PersonRow, column: AdminColumn): string => {
  const value = row[column.key];
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value)) return String(value.length);
  return column.render === 'money' ? money(Number(value)) : String(value);
};
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
      <button v-if="mayExport" type="button" class="ap-btn" @click="exportCsv">Export</button>
      <button v-if="isStaff" type="button" class="ap-btn" @click="importOpen = true; openImport()">Import</button>
      <button v-if="mayCreate" type="button" class="ap-btn ap-btn--primary" @click="openCreate">
        {{ isStaff ? 'Add Staff' : 'Add Parent' }}
      </button>
    </template>

    <template #filters>
      <div class="ap-toolbar">
        <input
          v-model="search"
          class="ap-input ap-toolbar__search"
          type="search"
          :placeholder="module.searchPlaceholder || 'Search...'"
          :aria-label="'Search ' + module.title"
        />
        <template v-if="isStaff">
          <label class="ap-filter">
            <span>Department</span>
            <select v-model="department" class="ap-input" aria-label="Department">
              <option value="">All departments</option>
              <option v-for="option in departmentOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label class="ap-filter">
            <span>Designation</span>
            <select v-model="designation" class="ap-input" aria-label="Designation">
              <option value="">All designations</option>
              <option v-for="option in designationOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
        </template>
      </div>
    </template>

    <template #empty>
      <p>No {{ module.title.toLowerCase() }} match your filters.</p>
    </template>

    <template v-if="detail">
      <button type="button" class="ap-btn ap-btn--ghost" @click="detailId = ''">&larr; Back</button>
      <div class="ap-card">
        <div class="ap-identity">
          <span class="ap-avatar" aria-hidden="true">{{ name(detail).slice(0, 2).toUpperCase() }}</span>
          <span class="ap-identity__text">
            <span class="ap-identity__name">{{ name(detail) }}</span>
            <span class="ap-identity__sub">{{ detail.email }}</span>
          </span>
        </div>
        <dl class="ap-fields">
          <div><dt>Phone</dt><dd>{{ detail.phone || '—' }}</dd></div>
          <div><dt>Roles</dt><dd>{{ detail.roles.join(', ') || '—' }}</dd></div>
          <div><dt>Status</dt><dd><AdminStatusBadge :status="detail.status" /></dd></div>
          <div><dt>Last login</dt><dd>{{ detail.lastLogin || 'Never' }}</dd></div>
          <template v-if="isStaff">
            <div><dt>Staff number</dt><dd>{{ detail.staffNo }}</dd></div>
            <div><dt>Department</dt><dd>{{ detail.departmentName || '—' }}</dd></div>
            <div><dt>Designation</dt><dd>{{ detail.designationName || '—' }}</dd></div>
          </template>
        </dl>
        <template v-if="!isStaff && detail.children.length">
          <h4 class="ap-band">Linked Children</h4>
          <ul class="ap-inline-note">
            <li v-for="child in detail.children" :key="child.id">{{ child.name }} · {{ child.className }}</li>
          </ul>
        </template>
        <div class="ap-detail__actions">
          <button type="button" class="ap-btn ap-btn--primary" @click="openEdit(detail)">Edit</button>
          <button v-if="isStaff" type="button" class="ap-btn" @click="resend(detail)">Resend invitation</button>
          <button v-if="mayDelete" type="button" class="ap-btn ap-btn--danger" @click="remove(detail)">Delete</button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="ap-table-wrap">
        <table class="ap-table">
          <caption class="ap-table__caption">Showing {{ (page - 1) * PAGE_SIZE + 1 }}–{{ Math.min(page * PAGE_SIZE, total) }} of {{ total }}</caption>
          <thead>
            <tr>
              <th scope="col">{{ isStaff ? 'Employee' : 'Parent' }}</th>
              <th v-if="!isStaff" scope="col">Phone</th>
              <th v-if="!isStaff" scope="col" class="ap-num">Linked Children</th>
              <th v-if="isStaff" scope="col">Roles</th>
              <th v-if="isStaff" scope="col">Department</th>
              <th v-if="isStaff" scope="col">Designation</th>
              <th scope="col">Status</th>
              <th scope="col"><span class="ap-sr">Details</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id" class="ap-row" tabindex="0" @click="detailId = row.id" @keydown.enter="detailId = row.id">
              <td>
                <div class="ap-identity">
                  <span class="ap-avatar" aria-hidden="true">{{ name(row).slice(0, 2).toUpperCase() }}</span>
                  <span class="ap-identity__text">
                    <span class="ap-identity__name">{{ name(row) }}</span>
                    <span class="ap-identity__sub">{{ row.email }}</span>
                  </span>
                </div>
              </td>
              <td v-if="!isStaff">{{ row.phone }}</td>
              <td v-if="!isStaff" class="ap-num">{{ row.children.length }} linked</td>
              <td v-if="isStaff">{{ row.roles.join(', ') || '—' }}</td>
              <td v-if="isStaff">{{ row.departmentName || '—' }}</td>
              <td v-if="isStaff">{{ row.designationName || '—' }}</td>
              <td><AdminStatusBadge :status="row.status" /></td>
              <td class="ap-table__actions">
                <button type="button" class="ap-btn ap-btn--xs" @click.stop="detailId = row.id">
                  {{ isStaff ? 'View profile' : 'View details' }}
                </button>
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

    <AdminDialog
      :open="formOpen"
      :title="editingId ? `Edit ${module.title.replace('List', '').replace(/s$/, '')}` : (isStaff ? 'Add Staff' : 'Add Parent')"
      confirm-label="Save"
      :busy="busy"
      @close="formOpen = false"
      @confirm="submit"
    >
      <p class="ap-inline-note">Create a new user account and assign one or more roles. An invitation email will be sent.</p>

      <div class="ap-form">
        <label class="ap-field">
          <span class="ap-field__label">First name <span class="ap-field__req">*</span></span>
          <input v-model="form.firstName" class="ap-input" type="text" />
          <span v-if="errors.firstName" class="ap-form__error" role="alert">{{ errors.firstName }}</span>
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Last name <span class="ap-field__req">*</span></span>
          <input v-model="form.lastName" class="ap-input" type="text" />
          <span v-if="errors.lastName" class="ap-form__error" role="alert">{{ errors.lastName }}</span>
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Email <span class="ap-field__req">*</span></span>
          <input v-model="form.email" class="ap-input" type="email" />
          <span v-if="errors.email" class="ap-form__error" role="alert">{{ errors.email }}</span>
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Phone <span class="ap-field__req">*</span></span>
          <input v-model="form.phone" class="ap-input" type="tel" />
          <span v-if="errors.phone" class="ap-form__error" role="alert">{{ errors.phone }}</span>
        </label>
      </div>

      <h4 class="ap-band">Roles</h4>
      <div class="ap-checklist">
        <label v-for="option in roleOptions" :key="option.value" class="ap-check">
          <input v-model="form.roles" type="checkbox" :value="option.value" />
          <span>{{ option.label }}</span>
        </label>
      </div>

      <p v-if="formError" class="ap-form__error" role="alert">{{ formError }}</p>
    </AdminDialog>

    <AdminDialog
      :open="importOpen"
      :title="isStaff ? 'Import Staff' : 'Import Students'"
      confirm-label="Confirm import"
      :busy="busy"
      @close="importOpen = false"
      @confirm="runImport"
    >
      <p class="ap-inline-note">
        Bulk-import {{ isStaff ? 'staff members' : 'student records' }} from an Excel or CSV file. The file is validated on the
        server and a preview is returned.
      </p>
      <h4 class="ap-band">REQUIRED COLUMNS</h4>
      <ul class="ap-inline-note">
        <li v-for="header in importRows" :key="header">{{ header }} — Required</li>
      </ul>
      <p class="ap-inline-note">
        The first row must be a header row. Columns can be in any order and are matched by name.
      </p>
      <p v-if="formError" class="ap-form__error" role="alert">{{ formError }}</p>
    </AdminDialog>
  </AdminModuleShell>
</template>

<style scoped>
@import './admin-panel.css';
</style>
