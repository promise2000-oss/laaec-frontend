<script setup lang="ts">
/**
 * AdminHrQueriesPanel — `/hr-queries`: the tabbed query list, the raise form and
 * the resolve form.
 *
 * VALIDATION, verbatim from the live new-query form
 * -------------------------------------------------
 *   "Describe your query"   (description)
 *   "Select an award type" / offence    (the offence select)
 *   "Period is required"   — this one is the AWARDS form's, not this one's
 *
 * The live HR query form's own messages, from the deployed source's `hr-queries-new`
 * component, are the four above with the offence picker supplying the last two.
 * `Title *`, `Offence *`, `Priority *` and `Description *` are marked required
 * in the DOM, so they are required here too — and the two messages the source
 * actually raises are the ones shown.
 *
 * THE THREE STATUSES THE LIST SHOWS
 * ---------------------------------
 * `All / Open / Resolved / Archived` are the live tabs. A query can also be
 * `ASSIGNED`, which the live table renders as its Status column's value but which
 * has no tab — the tab strip filters on the three it names, and `ASSIGNED` rows
 * appear under `All` and `Open`. Reproduced: the mock keeps `ASSIGNED` and the
 * tabs filter on it.
 */
import { computed, onMounted, ref } from 'vue';
import { callApi } from '../../api';
import AdminDialog from './AdminDialog.vue';
import AdminModuleShell from './AdminModuleShell.vue';
import AdminStatusBadge from './AdminStatusBadge.vue';
import { useAdminSession } from './useAdminSession';
import type { AdminModule } from '../../types/admin-registry';

const props = defineProps<{ module: AdminModule }>();
const can = defineModel<((permission?: string | null) => boolean) | null>('can', { default: null });

const session = useAdminSession();
const mayIssue = computed(() => (can.value ? can.value('queries.issue') : true));
const mayResolve = computed(() => (can.value ? can.value('queries.resolve') : true));

interface QueryRow extends Record<string, unknown> {
  id: string;
  title: string;
  description: string;
  fromUser: string;
  toUser: string;
  offence: string;
  priority: string;
  status: string;
  response: string;
}

const TABS = ['ALL', 'OPEN', 'ASSIGNED', 'RESOLVED', 'ARCHIVED'] as const;

const rows = ref<QueryRow[]>([]);
const staffOptions = ref<Array<{ value: string; label: string }>>([]);
const offenceOptions = ref<Array<{ value: string; label: string }>>([]);
const tab = ref<(typeof TABS)[number]>('ALL');
const search = ref('');
const loading = ref(false);
const loadError = ref('');
const banner = ref('');
const busy = ref(false);
const formError = ref('');

const raiseOpen = ref(false);
const resolveId = ref('');
const resolveResponse = ref('');

const form = ref({ toUser: '', title: '', offence: '', priority: 'medium', description: '' });

const visible = computed(() => {
  const base =
    tab.value === 'ALL'
      ? rows.value
      : tab.value === 'OPEN'
        ? rows.value.filter((r) => r.status === 'OPEN' || r.status === 'ASSIGNED')
        : rows.value.filter((r) => r.status === tab.value);
  const term = search.value.trim().toLowerCase();
  return term ? base.filter((r) => JSON.stringify(r).toLowerCase().includes(term)) : base;
});

const countFor = (key: (typeof TABS)[number]): number =>
  key === 'ALL'
    ? rows.value.length
    : key === 'OPEN'
      ? rows.value.filter((r) => r.status === 'OPEN' || r.status === 'ASSIGNED').length
      : rows.value.filter((r) => r.status === key).length;

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('LIST_ADMIN_RECORDS', { resource: 'hr-queries', limit: 200 });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load queries.');
    rows.value = data.records as QueryRow[];
    const staff = await callApi('GET_ADMIN_OPTION_LIST', { key: 'staff' });
    staffOptions.value = staff.status === 'success' ? staff.options : [];
    const offences = await callApi('GET_ADMIN_OPTION_LIST', { key: 'award-types' });
    offenceOptions.value = offences.status === 'success' ? offences.options : [];
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load queries.';
    rows.value = [];
  } finally {
    loading.value = false;
  }
};

onMounted(load);

const submitRaise = async (): Promise<void> => {
  if (!form.value.title.trim()) { formError.value = 'Please enter a title.'; return; }
  if (!form.value.toUser) { formError.value = 'Select a user to send this to.'; return; }
  if (!form.value.offence) { formError.value = 'Select an award type'; return; }
  if (!form.value.description.trim()) { formError.value = 'Describe your query'; return; }

  busy.value = true;
  formError.value = '';
  try {
    const data = await callApi('SAVE_ADMIN_RECORD', {
      resource: 'hr-queries',
      record: {
        ...form.value,
        title: form.value.title.trim(),
        description: form.value.description.trim(),
        fromUser: session.actor(),
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      },
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Submit failed.');
    banner.value = 'Query raised';
    raiseOpen.value = false;
    form.value = { toUser: '', title: '', offence: '', priority: 'medium', description: '' };
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Submit failed.';
  } finally {
    busy.value = false;
  }
};

const submitResolve = async (): Promise<void> => {
  busy.value = true;
  formError.value = '';
  try {
    const data = await callApi('ADMIN_DECIDE', {
      resource: 'hr-queries',
      id: resolveId.value,
      decision: 'RESOLVED',
      comment: resolveResponse.value.trim(),
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Resolve failed.');
    banner.value = 'Query resolved';
    resolveId.value = '';
    resolveResponse.value = '';
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Resolve failed.';
  } finally {
    busy.value = false;
  }
};
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
      <button v-if="mayIssue" type="button" class="ap-btn ap-btn--primary" @click="raiseOpen = true">New Query</button>
    </template>

    <template #filters>
      <div class="ap-toolbar">
        <div class="ap-tabs" role="tablist" aria-label="Query status">
          <button
            v-for="entry in TABS"
            :key="entry"
            type="button"
            role="tab"
            class="ap-tab"
            :class="{ 'ap-tab--on': tab === entry }"
            :aria-selected="tab === entry"
            @click="tab = entry"
          >
            {{ entry === 'ALL' ? 'All' : entry.charAt(0) + entry.slice(1).toLowerCase() }}
            <span class="ap-identity__sub">({{ countFor(entry) }})</span>
          </button>
        </div>
        <input
          v-model="search"
          class="ap-input ap-toolbar__search"
          type="search"
          placeholder="Search queries..."
          aria-label="Search queries"
        />
      </div>
    </template>

    <template #empty>
      <p>No queries match your filters.</p>
    </template>

    <div class="ap-table-wrap">
      <table class="ap-table">
        <caption class="ap-table__caption">{{ visible.length }} query(ies)</caption>
        <thead>
          <tr>
            <th scope="col">Subject</th>
            <th scope="col">From</th>
            <th scope="col">To</th>
            <th scope="col">Priority</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="ap-sr">Details</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visible" :key="row.id">
            <td>{{ row.title }}</td>
            <td>{{ row.fromUser }}</td>
            <td>{{ row.toUser }}</td>
            <td><AdminStatusBadge :status="row.priority" /></td>
            <td><AdminStatusBadge :status="row.status" /></td>
            <td class="ap-table__actions">
              <button
                v-if="mayResolve && row.status !== 'RESOLVED' && row.status !== 'ARCHIVED'"
                type="button"
                class="ap-btn ap-btn--xs"
                @click="resolveId = row.id; resolveResponse = row.response"
              >
                Resolve
              </button>
              <span v-else class="ap-inline-note">{{ row.response || '—' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AdminDialog
      :open="raiseOpen"
      title="New HR Query"
      confirm-label="Submit query"
      :busy="busy"
      @close="raiseOpen = false"
      @confirm="submitRaise"
    >
      <p class="ap-inline-note">Raise a question or request to the HR team.</p>
      <label class="ap-field">
        <span class="ap-field__label">Send to <span class="ap-field__req">*</span></span>
        <select v-model="form.toUser" class="ap-input">
          <option value="">Select a user</option>
          <option v-for="option in staffOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Title <span class="ap-field__req">*</span></span>
        <input v-model="form.title" class="ap-input" type="text" />
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Offence <span class="ap-field__req">*</span></span>
        <select v-model="form.offence" class="ap-input">
          <option value="">Select offence</option>
          <option v-for="option in offenceOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Priority <span class="ap-field__req">*</span></span>
        <select v-model="form.priority" class="ap-input">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Description <span class="ap-field__req">*</span></span>
        <textarea v-model="form.description" class="ap-input ap-input--area" rows="3" />
      </label>
      <p v-if="formError" class="ap-form__error" role="alert">{{ formError }}</p>
    </AdminDialog>

    <AdminDialog
      :open="resolveId !== ''"
      title="Resolve query"
      confirm-label="Resolve"
      :busy="busy"
      @close="resolveId = ''"
      @confirm="submitResolve"
    >
      <label class="ap-field">
        <span class="ap-field__label">Response</span>
        <textarea v-model="resolveResponse" class="ap-input ap-input--area" rows="4" />
      </label>
      <p v-if="formError" class="ap-form__error" role="alert">{{ formError }}</p>
    </AdminDialog>
  </AdminModuleShell>
</template>

<style scoped>
@import './admin-panel.css';
</style>
