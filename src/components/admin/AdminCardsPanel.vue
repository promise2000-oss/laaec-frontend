<script setup lang="ts">
/**
 * AdminCardsPanel — the modules the live app renders as a card grid rather than
 * a table: `/departments` and `/designations`.
 *
 * WHY IT IS SEPARATE FROM AdminResourcePanel
 * -------------------------------------------
 * Neither page has a table. `/departments` shows one card per department with
 * its code, staff count and `Head: <name>`; `/designations` shows one card per
 * designation with its staff count. The live card also carries its own `Actions`
 * button, so each card needs the same row-action menu the table rows get — that
 * is why this reuses `AdminResourcePanel`'s dialog handling rather than
 * reimplementing it, and why both panels share one dialog component.
 *
 * The grid, the count line and the search box are the live page's.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { callApi } from '../../api';
import AdminDialog from './AdminDialog.vue';
import AdminModuleShell from './AdminModuleShell.vue';
import { useAdminSession } from './useAdminSession';
import type { AdminField, AdminModule, AdminRecord } from '../../types/admin-registry';

const props = defineProps<{ module: AdminModule }>();
const can = defineModel<((permission?: string | null) => boolean) | null>('can', { default: null });

const session = useAdminSession();
const permitted = (permission?: string): boolean => {
  if (!permission) return true;
  return can.value ? can.value(permission) : true;
};

interface Card_ extends Record<string, unknown> {
  id: string;
  name: string;
}

const rows = ref<Card_[]>([]);
const search = ref('');
const loading = ref(false);
const loadError = ref('');
const banner = ref('');
const busy = ref(false);
const dialogError = ref('');
const errors = ref<Record<string, string>>({});
const options = ref<Record<string, Array<{ value: string; label: string }>>>({});

const dialog = ref(false);
const kind = ref<'create' | 'edit'>('create');
const editingId = ref('');
const form = ref<Record<string, unknown>>({});
const menuFor = ref('');

const createButton = computed(() => (props.module.toolbar ?? []).find((b) => b.dialog?.kind === 'create'));
const rowActions = computed(() => (props.module.rowActions ?? []));

const visible = computed(() => {
  const term = search.value.trim().toLowerCase();
  if (!term) return rows.value;
  return rows.value.filter((row) => JSON.stringify(row).toLowerCase().includes(term));
});

const staffLabel = (row: Card_): string => `${row.staffCount ?? 0} staff members`;

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('LIST_ADMIN_RECORDS', { resource: props.module.resource, limit: 200 });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load records.');
    rows.value = data.records as Card_[];
    for (const field of props.module.fields ?? []) {
      if (!field.optionsSource || options.value[field.optionsSource]) continue;
      const list = await callApi('GET_ADMIN_OPTION_LIST', { key: field.optionsSource });
      options.value[field.optionsSource] = list.status === 'success' ? list.options : [];
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load records.';
    rows.value = [];
  } finally {
    loading.value = false;
  }
};

watch(search, () => undefined);
onMounted(load);

const blank = (): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const field of props.module.fields ?? []) out[field.key] = '';
  return out;
};

const openCreate = (): void => {
  if (!createButton.value?.dialog) return;
  kind.value = 'create';
  editingId.value = '';
  form.value = blank();
  errors.value = {};
  dialogError.value = '';
  dialog.value = true;
};

const openAction = (row: Card_, label: string): void => {
  const action = rowActions.value.find((a) => a.label === label);
  menuFor.value = '';
  if (!action) return;
  if (action.dialog.kind === 'confirm') {
    confirmRow.value = row;
    confirmSpec.value = action.dialog;
    dialog.value = true;
    return;
  }
  kind.value = 'edit';
  editingId.value = row.id;
  form.value = blank();
  for (const field of props.module.fields ?? []) form.value[field.key] = row[field.key] ?? '';
  errors.value = {};
  dialogError.value = '';
  dialog.value = true;
};

/** The confirm dialog's pending row and its spec, or null when none is open. */
const confirmRow = ref<Card_ | null>(null);
const confirmSpec = ref<AdminDialogSpec | null>(null);

/** The registry's own dialog spec shape, named locally so the cast is explicit. */
interface AdminDialogSpec {
  title: (record: AdminRecord) => string;
  message?: (record: AdminRecord) => string;
  confirmLabel?: string;
  danger?: boolean;
  action?: string;
}

const validate = (): boolean => {
  const found: Record<string, string> = {};
  for (const field of props.module.fields ?? []) {
    if (field.required && !String(form.value[field.key] ?? '').trim()) {
      found[field.key] = `${field.label.replace(/\*$/, '').trim()} is required`;
    }
  }
  errors.value = found;
  return Object.keys(found).length === 0;
};

const submit = async (): Promise<void> => {
  busy.value = true;
  dialogError.value = '';
  try {
    if (confirmSpec.value && confirmRow.value) {
      const spec = confirmSpec.value;
      if (spec.action === 'DELETE_ADMIN_RECORD') {
        const data = await callApi('DELETE_ADMIN_RECORD', {
          resource: props.module.resource,
          id: confirmRow.value.id,
          actor: session.actor(),
        });
        if (data.status !== 'success') throw new Error(data.message || 'Delete failed.');
        banner.value = 'Deleted.';
      }
    } else {
      if (!validate()) return;
      const data = await callApi('SAVE_ADMIN_RECORD', {
        resource: props.module.resource,
        id: kind.value === 'edit' ? editingId.value : undefined,
        record: form.value,
        actor: session.actor(),
      });
      if (data.status !== 'success') throw new Error(data.message || 'Save failed.');
      banner.value = kind.value === 'create' ? 'Created.' : 'Saved.';
    }
    dialog.value = false;
    confirmSpec.value = null;
    confirmRow.value = null;
    await load();
  } catch (e) {
    dialogError.value = e instanceof Error ? e.message : 'Something went wrong.';
  } finally {
    busy.value = false;
  }
};

const fieldOptions = (field: AdminField) => options.value[field.optionsSource ?? ''] ?? [];
</script>

<template>
  <AdminModuleShell
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
      <button
        v-if="createButton && permitted(createButton.permission)"
        type="button"
        class="ap-btn ap-btn--primary"
        @click="openCreate"
      >
        {{ createButton.label }}
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
      </div>
    </template>

    <template #empty>
      <p>{{ module.title }} has no records yet.</p>
    </template>

    <div class="ap-cards">
      <article v-for="row in visible" :key="row.id" class="ap-card">
        <h3 class="ap-card__title">{{ row.name }}</h3>
        <p class="ap-inline-note">{{ staffLabel(row) }}</p>
        <p v-if="'headName' in row" class="ap-inline-note">Head: {{ row.headName || '—' }}</p>
        <p v-if="'description' in row && row.description" class="ap-inline-note">{{ row.description }}</p>
        <div v-if="rowActions.length" class="ap-menu-wrap ap-cards__actions">
          <button
            type="button"
            class="ap-btn ap-btn--xs"
            :aria-expanded="menuFor === row.id"
            @click.stop="menuFor = menuFor === row.id ? '' : row.id"
          >
            Actions
          </button>
          <span v-if="menuFor === row.id" class="ap-menu" role="menu" @click.stop>
            <button
              v-for="action in rowActions"
              :key="action.label"
              type="button"
              role="menuitem"
              class="ap-menu__item"
              :class="{ 'ap-menu__item--danger': action.dialog.danger }"
              :disabled="action.permission ? !permitted(action.permission) : false"
              @click="openAction(row, action.label)"
            >
              {{ action.label }}
            </button>
          </span>
        </div>
      </article>
    </div>

    <AdminDialog
      :open="dialog"
      :kind="confirmSpec ? 'confirm' : kind"
      :title="confirmSpec ? confirmSpec.title(confirmRow ?? { id: '' }) : kind === 'create' ? (createButton?.dialog?.label ?? 'Create') : 'Edit ' + String(confirmRow?.name ?? '')"
      :message="confirmSpec?.message ? confirmSpec.message(confirmRow ?? { id: '' }) : ''"
      :confirm-label="confirmSpec?.confirmLabel ?? (kind === 'create' ? 'Save' : 'Save')"
      :danger="confirmSpec?.danger === true"
      :busy="busy"
      @close="dialog = false; confirmSpec = null"
      @confirm="submit"
    >
      <div v-if="!confirmSpec" class="ap-form">
        <label v-for="field in module.fields" :key="field.key" class="ap-field" :class="{ 'ap-field--full': field.type === 'textarea' }">
          <span class="ap-field__label">
            {{ field.label }}
            <span v-if="field.required" class="ap-field__req">*</span>
          </span>
          <textarea
            v-if="field.type === 'textarea'"
            v-model="form[field.key] as string"
            class="ap-input ap-input--area"
            rows="3"
          />
          <select v-else-if="field.type === 'select'" v-model="form[field.key] as string" class="ap-input">
            <option value="">Select {{ field.label.toLowerCase() }}</option>
            <option v-for="option in fieldOptions(field)" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
          <input
            v-else
            v-model="form[field.key] as string | number"
            class="ap-input"
            :type="field.type === 'datetime' ? 'datetime-local' : field.type"
          />
          <span v-if="errors[field.key]" class="ap-form__error" role="alert">{{ errors[field.key] }}</span>
          <span v-else-if="field.hint" class="ap-field__hint">{{ field.hint }}</span>
        </label>
      </div>
      <p v-if="dialogError" class="ap-form__error" role="alert">{{ dialogError }}</p>
    </AdminDialog>
  </AdminModuleShell>
</template>

<style scoped>
@import './admin-panel.css';

.ap-cards__actions {
  margin-top: 0.5rem;
}
</style>
