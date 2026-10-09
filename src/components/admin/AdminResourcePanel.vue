<script setup lang="ts">
/**
 * AdminResourcePanel — ONE component that renders any of the forty registry
 * modules declared in `types/admin-registry.ts`.
 *
 * WHY
 * ---
 * The live admin portal's list pages are the same page forty times: a heading, a
 * search box, a filter or two, a table, a row action menu, and a create/edit
 * dialog over a small field set. They differ in a column list and a field list.
 * Writing a component per route would be forty near-identical files that drift;
 * this is the page, and `AdminModule` is what varies.
 *
 * WHAT IT DOES
 * ------------
 *  - reads a page of records through `LIST_ADMIN_RECORDS`, carrying search,
 *    filters, tab and page in the request (the mock does the narrowing, which is
 *    what the origin's server does too);
 *  - renders the declared columns, with the live app's presentations for money,
 *    dates, status, identity and counts;
 *  - opens `AdminDialog` for create / edit / detail / confirm, validating the
 *    required fields before it will issue a save;
 *  - issues the right contract action per dialog, and refuses to issue one the
 *    session's permissions do not cover — the button is not rendered at all in
 *    that case, and the transport refuses it independently;
 *  - paginates, and renders the live app's `Showing 1–10 of N` line.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * It does not compute anything the origin computes on the server. `available`,
 * the attendance rate and the grade come back from the mock as the fields the
 * live columns render, so a formula that lives in this component would be a
 * second source of truth for a value the origin derives in one place.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { callApi } from '../../api';
import AdminDialog from './AdminDialog.vue';
import AdminModuleShell from './AdminModuleShell.vue';
import AdminStatusBadge from './AdminStatusBadge.vue';
import { useAdminSession } from './useAdminSession';
import type { AdminColumn, AdminField, AdminModule, AdminRecord } from '../../types/admin-registry';
import { money } from '../../api/mockAdmin';

const props = defineProps<{ module: AdminModule }>();

const session = useAdminSession();
/** Injected so a parent can read the session's grants without importing Pinia. */
const can = defineModel<((permission?: string | null) => boolean) | null>('can', { default: null });

const PAGE_SIZE = 10;

type Record_ = AdminRecord;
type Option = { value: string; label: string };

const records = ref<Record_[]>([]);
const total = ref(0);
const page = ref(1);
const search = ref('');
const filters = ref<Record<string, string>>({});
const tab = ref<string>('ALL');
const optionCache = ref<Record<string, Option[]>>({});

const loading = ref(false);
const loadError = ref('');
const banner = ref('');
const dialogError = ref('');
const busy = ref(false);

const dialog = ref<{
  open: boolean;
  kind: 'create' | 'edit' | 'detail' | 'confirm';
  /** The originating action's label, which is what distinguishes two dialogs
   *  that share a confirm label. See `ADJUST_WALLET`. */
  label: string;
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  action: string;
  record: Record_ | null;
}>({ open: false, kind: 'detail', label: '', title: '', message: '', confirmLabel: '', danger: false, action: '', record: null });

const form = ref<Record<string, unknown>>({});

/* ── permissions ───────────────────────────────────────────────────────── */

/**
 * Whether a permission is held. Falls back to "permitted" when no `can` model
 * was supplied, so the panel is usable in isolation (and in a test) — but the
 * transport enforces independently, so a wrong answer here cannot widen access,
 * only mislead the clicker.
 */
const permitted = (permission?: string): boolean => {
  if (!permission) return true;
  const predicate = can.value;
  return predicate ? predicate(permission) : true;
};

const mayWrite = computed(() => permitted(props.module.writePermission));
const mayDelete = computed(() => permitted(props.module.deletePermission));

/*
 * `mayDelete` decides the Delete row action's presence. The list is filtered by
 * `rowActions` below, which already drops an action whose `permission` the session
 * does not hold — but a Delete action declared without an explicit `permission`
 * falls back to the module's `deletePermission`, so the two have to agree. This
 * computed is that fallback, and it is read by `canDeleteAction` below.
 */
const canDeleteAction = (): boolean => mayDelete.value;

/**
 * The row actions this session may perform, in the module's declared order.
 *
 * An action with its own `permission` is gated on that. One without falls back to
 * the module's `deletePermission` when it is a destructive verb and its
 * `writePermission` otherwise, because the registry's per-action `permission`
 * field is optional and the module-level pair is the coarser statement of the same
 * rule. A module that declares neither has no write permission at all, so nothing
 * destructive survives this filter.
 */
const rowActions = computed(() =>
  (props.module.rowActions ?? []).filter((action) => {
    if (action.permission) return permitted(action.permission);
    if (/^(delete|remove|deactivate|suspend|cancel)/i.test(action.label)) return canDeleteAction();
    return permitted(props.module.writePermission);
  }),
);

/**
 * The toolbar buttons this session may perform. Same rule as the row actions: an
 * explicit `permission` wins, and a button with none falls back to the module's
 * write permission — which is what makes `Export`, `Import` and `Add User` behave
 * the way the registry declares rather than the way a label suggests.
 */
const toolbarButtons = computed(() =>
  (props.module.toolbar ?? []).filter((action) => {
    if (action.permission) return permitted(action.permission);
    /* A button with no dialog is an action of its own — Export today — so it is
       gated on the module's READ permission, not its write one. A read-only
       session must still be able to take its data out. */
    if (!action.dialog) return permitted(props.module.permission);
    return permitted(props.module.writePermission);
  }),
);

/* ── loading ───────────────────────────────────────────────────────────── */

const buildFilters = (): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters.value)) {
    if (value) out[key] = value;
  }
  return out;
};

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('LIST_ADMIN_RECORDS', {
      resource: props.module.resource,
      search: search.value || undefined,
      filters: buildFilters(),
      page: page.value,
      limit: PAGE_SIZE,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load records.');
    records.value = data.records;
    total.value = data.total;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load records.';
    records.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
};

/* The live pages filter as you type — every list has an `onChange` handler on
   its search box that refetches — so this debounces rather than waiting for a
   submit that the UI does not have. */
let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    void load();
  }, 250);
});

watch([filters, tab], () => {
  page.value = 1;
  void load();
}, { deep: true });

watch(page, () => void load());

onMounted(async () => {
  // Option lists the dialogs and the filters read, fetched once per panel.
  const keys = new Set<string>();
  for (const field of props.module.fields ?? []) if (field.optionsSource) keys.add(field.optionsSource);
  for (const filter of props.module.filters ?? []) keys.add(filter.source);
  await Promise.all(
    [...keys].map(async (key) => {
      try {
        const data = await callApi('GET_ADMIN_OPTION_LIST', { key });
        optionCache.value[key] = data.status === 'success' ? data.options : [];
      } catch {
        optionCache.value[key] = [];
      }
    }),
  );
  await load();
  /* After the load, so the dialog opens over a populated list rather than an
     empty frame that fills in a moment later. */
  consumeActionQuery();
});

/* ── filter options ────────────────────────────────────────────────────── */

const filterOptions = (source: string): Option[] => {
  const cached = optionCache.value[source];
  if (cached?.length) return cached;
  // Derived from the page's own rows, which is what the live app does: the
  // "All departments" list is the departments in the current result set.
  const seen = new Map<string, Option>();
  for (const row of records.value) {
    const value = String(row[source] ?? '');
    if (value) seen.set(value, { value, label: value });
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
};

/* ── cell rendering ────────────────────────────────────────────────────── */

const initialsOf = (row: Record_): string => {
  if (typeof row.initials === 'string' && row.initials) return row.initials;
  const name = String(row.fullName ?? row.name ?? '');
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
};

const subLineOf = (row: Record_): string => {
  /* The live list's secondary line per module: an email for users and staff,
     an admission number for students, a SKU for stock. Whichever the row
     carries, in that order. */
  for (const key of ['email', 'admissionNo', 'sku', 'staffNo', 'reference']) {
    const value = row[key];
    if (typeof value === 'string' && value) return value;
  }
  return '';
};

const cellText = (row: Record_, column: AdminColumn): string => {
  const value = row[column.key];
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return String(value.length);
  switch (column.render) {
    case 'money':
      return money(Number(value));
    case 'bool':
      return value ? 'Yes' : 'No';
    case 'count':
      return String(value);
    default:
      return String(value);
  }
};

const cellIsIdentity = (column: AdminColumn): boolean => column.render === 'avatar';

/* ── dialogs ───────────────────────────────────────────────────────────── */

/**
 * The field list the open dialog renders.
 *
 * A dialog may declare its own, and does when it collects the operator's input
 * rather than the record's attributes — the wallet adjust dialog's amount. Falling
 * back to the module's field list is the ordinary case. This is read in three
 * places (blanking the form, prefilling it on edit, and validating), so it is a
 * function rather than a value copied at each site: three copies of the same
 * decision is how they drift.
 */
const dialogFields = (): AdminField[] =>
  dialogFieldsOverride.value ?? props.module.fields ?? [];

/** The dialog's own declared fields, while one is open; null for the module's. */
const dialogFieldsOverride = ref<AdminField[] | null>(null);

const blankForm = (): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const field of dialogFields()) out[field.key] = '';
  return out;
};

const openDialog = (
  kind: 'create' | 'edit' | 'detail' | 'confirm',
  record: Record_ | null,
  spec: {
    label?: string;
    title: (r: AdminRecord) => string;
    message?: (r: AdminRecord) => string;
    confirmLabel?: string;
    danger?: boolean;
    action?: string;
    fields?: AdminField[];
  },
): void => {
  dialogError.value = '';
  /* Set before `blankForm`, which reads it. */
  dialogFieldsOverride.value = spec.fields ?? null;
  form.value = blankForm();
  if (kind === 'edit' && record) {
    /* Prefilled only from the record's own attributes. A dialog with its own
       fields (the wallet adjustment) collects operator input, and there is
       nothing on the record to prefill it from — so this must not run for one,
       or the wallet's `balance` would land in the amount box. */
    if (!spec.fields) {
      for (const field of props.module.fields ?? []) form.value[field.key] = record[field.key] ?? '';
    }
  }
  dialog.value = {
    open: true,
    kind,
    label: spec.label ?? '',
    title: spec.title(record ?? { id: '' }),
    message: spec.message ? spec.message(record ?? { id: '' }) : '',
    confirmLabel: spec.confirmLabel ?? (kind === 'create' ? 'Create' : kind === 'edit' ? 'Save' : 'Confirm'),
    danger: spec.danger === true,
    action: spec.action ?? 'SAVE_ADMIN_RECORD',
    record,
  };
};

const closeDialog = (): void => {
  dialog.value = { ...dialog.value, open: false };
  dialogError.value = '';
  dialogFieldsOverride.value = null;
};

const openCreate = (): void => {
  const button = (props.module.toolbar ?? []).find((b) => b.dialog?.kind === 'create');
  if (!button?.dialog) return;
  openDialog('create', null, button.dialog);
};

/*
 * `?action=create` opens the create dialog on arrival.
 *
 * The fee-breakdown panel's "New Payment" links here with that query, and the
 * link is only honest if it lands on the form. Without this the operator arrives
 * on the payment list with a filled-in intent and has to find the button again —
 * the exact friction a dashboard tile is supposed to remove.
 *
 * Stripped from the URL once consumed, so a reload does not re-open a dialog the
 * operator has since closed, and so the address bar shows the panel rather than a
 * one-shot instruction.
 */
const route = useRoute();
const router = useRouter();
const consumeActionQuery = (): void => {
  const requested = String(route.query.action ?? '');
  if (!requested) return;
  const query = { ...route.query };
  delete query.action;
  void router.replace({ path: route.path, query });

  if (requested === 'create') openCreate();
};

const openToolbarDialog = (label: string): void => {
  const button = toolbarButtons.value.find((b) => b.label === label);
  if (button?.dialog) openDialog(button.dialog.kind, null, button.dialog);
};

const openRowDialog = (row: Record_, label: string): void => {
  const action = rowActions.value.find((a) => a.label === label);
  if (action) openDialog(action.dialog.kind, row, action.dialog);
};

const rowLabel = (row: Record_): string => String(row.fullName ?? row.name ?? row.id);

/* ── validation ────────────────────────────────────────────────────────── */

/**
 * Required-field validation only, and it runs before the action is issued.
 *
 * The live forms do more — a session name must match `^\d{4}/\d{4}$`, a fee
 * amount must be positive, a leave end date must follow its start date — and
 * those rules are declared per field below where the origin has them, because a
 * generic rule would either be too strict for some modules or too lax for the
 * one that needs it.
 */
const errors = ref<Record<string, string>>({});

const validate = (): boolean => {
  const found: Record<string, string> = {};
  for (const field of dialogFields()) {
    if (!field.required) continue;
    const value = form.value[field.key];
    if (value === '' || value === null || value === undefined) {
      found[field.key] = `${field.label} is required`;
    }
  }
  /*
   * The origin's own refusal for a money field, verbatim from the deployed
   * wallet adjust dialog: "Amount must be greater than zero". It is stated on the
   * amount rather than on a zero-or-blank rule, because 0 is a value the operator
   * can type and a `required` check would wave it through.
   */
  for (const field of dialogFields()) {
    if (!field.positive) continue;
    const value = Number(form.value[field.key]);
    if (form.value[field.key] !== '' && (!Number.isFinite(value) || value <= 0)) {
      found[field.key] = 'Amount must be greater than zero';
    }
  }
  /* The session-name format rule, which the origin enforces on both the session
     form and the import's column list. Declared here because both spell it the
     same way and neither module can see the other's validator. */
  if (props.module.resource === 'sessions' && form.value.name) {
    const name = String(form.value.name);
    if (!/^\d{4}\/\d{4}$/.test(name)) {
      found.name = 'Session name must follow the format 2025/2026';
    }
  }
  errors.value = found;
  return Object.keys(found).length === 0;
};

/* ── issuing ───────────────────────────────────────────────────────────── */

/** What each dialog's action means for each resource, resolved in one place. */
const issueFor = async (): Promise<void> => {
  const spec = dialog.value;
  const record = spec.record;
  const resource = props.module.resource;

  switch (spec.action) {
    case 'SAVE_ADMIN_RECORD': {
      const data = await callApi('SAVE_ADMIN_RECORD', {
        resource,
        id: spec.kind === 'edit' ? record?.id : undefined,
        record: form.value,
        actor: session.actor(),
      });
      if (data.status !== 'success') throw new Error(data.message || 'Save failed.');
      banner.value = spec.kind === 'create' ? 'Created.' : 'Saved.';
      break;
    }
    case 'DELETE_ADMIN_RECORD': {
      const data = await callApi('DELETE_ADMIN_RECORD', {
        resource,
        id: String(record?.id ?? ''),
        actor: session.actor(),
      });
      if (data.status !== 'success') throw new Error(data.message || 'Delete failed.');
      banner.value = 'Deleted.';
      break;
    }
    case 'ADMIN_DECIDE': {
      const decision = spec.confirmLabel.toUpperCase();
      const data = await callApi('ADMIN_DECIDE', {
        resource,
        id: String(record?.id ?? ''),
        decision,
        actor: session.actor(),
      });
      if (data.status !== 'success') throw new Error(data.message || 'Decision failed.');
      banner.value = `${spec.confirmLabel}.`;
      break;
    }
    /* The one action that does not read its arguments off the record: the wallet
       list's Top up and Deduct row actions are the same dialog with a different
       direction, and the amount, the narration and the spend kind are the
       operator's own fields rather than record attributes — which is why the
       dialog declares them (see `dialogFields`). */
    case 'ADJUST_WALLET': {
      /*
       * The direction is the dialog's own action label, not its confirm button's
       * copy. It used to be read off `confirmLabel`, which made the two dialogs
       * indistinguishable to this switch the moment the copy changed — and the
       * copy did change, to the origin's "Credit wallet" and "Deduct".
       */
      const topping = /top up/i.test(spec.label);
      const data = await callApi('ADJUST_WALLET', {
        walletId: String(record?.id ?? ''),
        kind: topping ? 'TOPUP' : 'DEDUCT',
        amount: Number(form.value.amount ?? 0),
        note: String(form.value.note ?? ''),
        spendKind: String(form.value.deductKind ?? ''),
        actor: session.actor(),
      });
      if (data.status !== 'success') throw new Error(data.message || 'Adjustment failed.');
      banner.value = data.message || 'Wallet adjusted.';
      break;
    }
    case 'ADMIN_SET_STATUS': {
      const status =
        spec.confirmLabel === 'Release'
          ? 'RELEASED'
          : spec.confirmLabel === 'Cancel'
            ? 'CANCELLED'
            : String(form.value.status ?? 'inactive');
      const data = await callApi('ADMIN_SET_STATUS', {
        resource,
        id: String(record?.id ?? ''),
        status,
        actor: session.actor(),
      });
      if (data.status !== 'success') throw new Error(data.message || 'Update failed.');
      banner.value = `${spec.confirmLabel}.`;
      break;
    }
    default:
      throw new Error(`Unsupported action: ${spec.action}`);
  }
};

const onConfirm = async (): Promise<void> => {
  if (dialog.value.kind === 'create' || dialog.value.kind === 'edit') {
    if (!validate()) return;
  }
  busy.value = true;
  dialogError.value = '';
  try {
    await issueFor();
    closeDialog();
    await load();
  } catch (e) {
    dialogError.value = e instanceof Error ? e.message : 'Something went wrong.';
  } finally {
    busy.value = false;
  }
};

/* ── export ────────────────────────────────────────────────────────────── */

const exportCsv = (): void => {
  /* The live `/attendance/reports`, `/students/export` and `/staff` pages all
     offer Export CSV, and all three build it in the browser from the rows they
     already hold. That is what this does, from the rows already fetched. */
  const header = props.module.columns.map((c) => c.label);
  const escape = (value: string): string => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const body = records.value.map((row) =>
    props.module.columns.map((c) => escape(cellText(row, c))).join(','),
  );
  const blob = new Blob([[header.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${props.module.id}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  banner.value = `Exported ${records.value.length} row(s).`;
};

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));
const rangeStart = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1));
const rangeEnd = computed(() => Math.min(page.value * PAGE_SIZE, total.value));

const fieldOptions = (field: AdminField): Option[] =>
  field.options ?? optionCache.value[field.optionsSource ?? ''] ?? [];

/**
 * The row action labels a given row offers.
 *
 * Every action in the module's list is offered on every row: the registry's
 * `rowActions` are a property of the module, not of a record's state, and the live
 * menus are static too (`/users` offers View / Edit / Deactivate / Suspend /
 * Delete on every row, whatever the row's status). Making this a function of the
 * row rather than of the module is what lets the template ask twice — once for the
 * header cell, once per row — and get the same answer.
 */
const visibleRowActions = (_row: Record_): string[] => rowActions.value.map((a) => a.label);

/* ── the row menu ──────────────────────────────────────────────────────── */

const menuFor = ref<string>('');

const toggleMenu = (row: Record_): void => {
  menuFor.value = menuFor.value === row.id ? '' : row.id;
};

const pickRowAction = (row: Record_, label: string): void => {
  menuFor.value = '';
  openRowDialog(row, label);
};

/*
 * Clicking anywhere closes an open menu. Bound on the window rather than on the
 * trigger's parent, so a click on a filter or a page while a menu is open dismisses
 * it — which is what the live app's outside-click dismissal does, and what a
 * keyboard user would otherwise find surprising.
 *
 * Registered on mount and removed on unmount. The panel is mounted only while
 * active, so this runs once per visit rather than once per page load.
 */
const onWindowClick = (): void => {
  menuFor.value = '';
};

onMounted(() => window.addEventListener('click', onWindowClick));
onBeforeUnmount(() => window.removeEventListener('click', onWindowClick));
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
      <button
        v-if="module.exportable"
        type="button"
        class="ap-btn"
        @click="exportCsv"
      >
        Export
      </button>
      <button
        v-for="button in toolbarButtons"
        :key="button.label"
        type="button"
        class="ap-btn"
        :class="button.dialog?.kind === 'create' ? 'ap-btn--primary' : ''"
        @click="openToolbarDialog(button.label)"
      >
        {{ button.label }}
      </button>
      <button
        v-if="!module.toolbar?.length && mayWrite && module.fields?.length"
        type="button"
        class="ap-btn ap-btn--primary"
        @click="openCreate"
      >
        Create
      </button>
    </template>

    <template #filters>
      <div class="ap-toolbar">
        <div v-if="module.tabs?.length" class="ap-tabs" role="tablist" :aria-label="module.title + ' status'">
          <button
            v-for="entry in module.tabs"
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

        <input
          v-model="search"
          class="ap-input ap-toolbar__search"
          type="search"
          :placeholder="module.searchPlaceholder || 'Search...'"
          :aria-label="'Search ' + module.title"
        />

        <div v-if="module.filters?.length" class="ap-toolbar__filters">
          <label v-for="filter in module.filters" :key="filter.key" class="ap-filter">
            <span class="ap-sr">{{ filter.label }}</span>
            <select
              v-model="filters[filter.key]"
              :aria-label="filter.label"
            >
              <option value="">{{ filter.allLabel }}</option>
              <option v-for="option in filterOptions(filter.source)" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>
      </div>
    </template>

    <template #empty>
      <p>No {{ module.title.toLowerCase() }} match your filters.</p>
    </template>

    <div class="ap-table-wrap">
      <table class="ap-table">
        <caption class="ap-table__caption">
          {{ total }} {{ module.title.toLowerCase() }}
        </caption>
        <thead>
          <tr>
            <th v-for="column in module.columns" :key="column.key" scope="col">
              {{ column.label }}
            </th>
            <th v-if="visibleRowActions(records[0] ?? { id: '' }).length" scope="col">
              <span class="ap-sr">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in records" :key="row.id" class="ap-row" tabindex="0">
            <td
              v-for="column in module.columns"
              :key="column.key"
              :class="{ 'ap-num': column.numeric }"
            >
              <span v-if="cellIsIdentity(column)" class="ap-identity">
                <span class="ap-avatar" aria-hidden="true">{{ initialsOf(row) }}</span>
                <span class="ap-identity__text">
                  <span class="ap-identity__name">{{ rowLabel(row) }}</span>
                  <span v-if="subLineOf(row)" class="ap-identity__sub">{{ subLineOf(row) }}</span>
                </span>
              </span>
              <AdminStatusBadge v-else-if="column.render === 'status'" :status="cellText(row, column)" />
              <span v-else>{{ cellText(row, column) }}</span>
            </td>
            <td v-if="visibleRowActions(row).length" class="ap-table__actions">
              <span class="ap-menu-wrap">
                <button
                  type="button"
                  class="ap-btn ap-btn--ghost ap-btn--xs"
                  :aria-expanded="menuFor === row.id"
                  :aria-label="'Actions for ' + rowLabel(row)"
                  @click.stop="toggleMenu(row)"
                >
                  Actions
                </button>
                <span v-if="menuFor === row.id" class="ap-menu" role="menu" @click.stop>
                  <button
                    v-for="label in visibleRowActions(row)"
                    :key="label"
                    type="button"
                    role="menuitem"
                    class="ap-menu__item"
                    :class="{ 'ap-menu__item--danger': label.toLowerCase().includes('delete') || label.toLowerCase().includes('suspend') }"
                    @click="pickRowAction(row, label)"
                  >
                    {{ label }}
                  </button>
                </span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="total > PAGE_SIZE" class="ap-pager">
        <span>Showing {{ rangeStart }}–{{ rangeEnd }} of {{ total }}</span>
        <span class="ap-pager__buttons">
          <button type="button" class="ap-btn ap-btn--xs" :disabled="page <= 1" @click="page = page - 1">
            Prev
          </button>
          <span>Page {{ page }} of {{ pageCount }}</span>
          <button type="button" class="ap-btn ap-btn--xs" :disabled="page >= pageCount" @click="page = page + 1">
            Next
          </button>
        </span>
      </div>
    </div>

    <AdminDialog
      :open="dialog.open"
      :kind="dialog.kind"
      :title="dialog.title"
      :message="dialog.message"
      :confirm-label="dialog.confirmLabel"
      :danger="dialog.danger"
      :busy="busy"
      :confirmable="dialog.kind !== 'detail'"
      @close="closeDialog"
      @confirm="onConfirm"
    >
      <!-- Detail: every field the record carries, so nothing is hidden. -->
      <dl v-if="dialog.kind === 'detail'" class="ap-fields">
        <div v-for="(value, key) in dialog.record" :key="key">
          <dt>{{ key }}</dt>
          <dd>{{ Array.isArray(value) ? value.length + ' item(s)' : String(value ?? '—') }}</dd>
        </div>
      </dl>

      <!-- Create / edit: the dialog's declared field list, or the module's. -->
      <div v-else-if="dialog.kind === 'create' || dialog.kind === 'edit'" class="ap-form">
        <label
          v-for="field in dialogFields()"
          :key="field.key"
          class="ap-field"
          :class="{ 'ap-field--full': field.half !== true && field.type === 'textarea', 'ap-field--check': field.type === 'checkbox' }"
        >
          <span class="ap-field__label">
            {{ field.label }}
            <span v-if="field.required" class="ap-field__req" aria-hidden="true">*</span>
          </span>
          <textarea
            v-if="field.type === 'textarea'"
            v-model="form[field.key] as string"
            class="ap-input ap-input--area"
            rows="3"
            :placeholder="field.placeholder"
            :required="field.required"
          />
          <select
            v-else-if="field.type === 'select'"
            v-model="form[field.key] as string"
            class="ap-input"
            :required="field.required"
          >
            <option value="">Select {{ field.label.toLowerCase() }}</option>
            <option v-for="option in fieldOptions(field)" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <span v-else-if="field.type === 'checkbox'" class="ap-check">
            <input v-model="form[field.key] as boolean" type="checkbox" />
            <span>{{ field.hint || '' }}</span>
          </span>
          <input
            v-else
            v-model="form[field.key] as string | number"
            class="ap-input"
            :type="field.type === 'datetime' ? 'datetime-local' : field.type"
            :placeholder="field.placeholder"
            :required="field.required"
            :min="field.type === 'number' ? 0 : undefined"
          />
          <span v-if="errors[field.key]" class="ap-form__error" role="alert">{{ errors[field.key] }}</span>
          <span v-else-if="field.hint && field.type !== 'checkbox'" class="ap-field__hint">{{ field.hint }}</span>
        </label>
      </div>

      <p v-if="dialogError" class="ap-form__error" role="alert">{{ dialogError }}</p>
    </AdminDialog>
  </AdminModuleShell>
</template>

<style scoped>
@import './admin-panel.css';
</style>
