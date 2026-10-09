<script setup lang="ts">
/**
 * AdminAwardsPanel — `/awards`.
 *
 * A note on what this page is on the live deployment: `/awards` answers with
 * `This page couldn't load` and a Reload button — an error boundary, not an empty
 * list. The list underneath it is real (`/awards/new` opens a working form, the
 * dashboard counts 3 awards, and the permission catalogue carries `awards.read`
 * and `awards.manage`), so the failure is in that page's read, not in the module.
 *
 * This renders the working module: the list the dashboard counts and the form
 * `/awards/new` serves. The live error state is recorded in feature-inventory.md
 * and parity-report.md as an observed defect rather than reproduced here, because
 * reproducing a broken read would mean shipping a page whose only content is a
 * Reload button.
 *
 * VALIDATION, verbatim from the live form
 * ---------------------------------------
 *   "Select an award type"
 *   "Select the recipient"
 *   "Period is required"
 *   "Add a reason for the award"
 */
import { computed, onMounted, ref } from 'vue';
import { callApi } from '../../api';
import AdminDialog from './AdminDialog.vue';
import AdminModuleShell from './AdminModuleShell.vue';
import { useAdminSession } from './useAdminSession';
import type { AdminModule } from '../../types/admin-registry';

const props = defineProps<{ module: AdminModule }>();
const can = defineModel<((permission?: string | null) => boolean) | null>('can', { default: null });

const session = useAdminSession();
const mayManage = computed(() => (can.value ? can.value('awards.manage') : true));

interface AwardRow extends Record<string, unknown> {
  id: string;
  awardType: string;
  recipientName: string;
  period: string;
  reason: string;
  createdAt: string;
}

const rows = ref<AwardRow[]>([]);
const typeOptions = ref<Array<{ value: string; label: string }>>([]);
const staffOptions = ref<Array<{ value: string; label: string }>>([]);
const loading = ref(false);
const loadError = ref('');
const banner = ref('');
const busy = ref(false);
const formError = ref('');

const open = ref(false);
const form = ref({ awardType: '', recipientName: '', period: '', reason: '' });

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('LIST_ADMIN_RECORDS', { resource: 'awards', limit: 200 });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load awards.');
    rows.value = data.records as AwardRow[];
    const types = await callApi('GET_ADMIN_OPTION_LIST', { key: 'award-types' });
    typeOptions.value = types.status === 'success' ? types.options : [];
    const staff = await callApi('GET_ADMIN_OPTION_LIST', { key: 'staff' });
    staffOptions.value = staff.status === 'success' ? staff.options : [];
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load awards.';
    rows.value = [];
  } finally {
    loading.value = false;
  }
};

onMounted(load);

const submit = async (): Promise<void> => {
  if (!form.value.awardType) { formError.value = 'Select an award type'; return; }
  if (!form.value.recipientName) { formError.value = 'Select the recipient'; return; }
  if (!form.value.period.trim()) { formError.value = 'Period is required'; return; }
  if (!form.value.reason.trim()) { formError.value = 'Add a reason for the award'; return; }

  busy.value = true;
  formError.value = '';
  try {
    const data = await callApi('SAVE_ADMIN_RECORD', {
      resource: 'awards',
      record: { ...form.value, createdAt: new Date().toISOString() },
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Save failed.');
    banner.value = 'Award issued';
    open.value = false;
    form.value = { awardType: '', recipientName: '', period: '', reason: '' };
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Save failed.';
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
      <button v-if="mayManage" type="button" class="ap-btn ap-btn--primary" @click="open = true">Give Award</button>
    </template>

    <template #empty>
      <p>No awards issued yet.</p>
    </template>

    <div class="ap-table-wrap">
      <table class="ap-table">
        <caption class="ap-table__caption">{{ rows.length }} award(s)</caption>
        <thead>
          <tr>
            <th scope="col">Award type</th>
            <th scope="col">Recipient</th>
            <th scope="col">Period</th>
            <th scope="col">Reason</th>
            <th scope="col">Issued</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.awardType }}</td>
            <td>{{ row.recipientName }}</td>
            <td>{{ row.period }}</td>
            <td>{{ row.reason }}</td>
            <td>{{ row.createdAt }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <AdminDialog
      :open="open"
      title="Give Award"
      confirm-label="Issue award"
      :busy="busy"
      @close="open = false"
      @confirm="submit"
    >
      <p class="ap-inline-note">Recognise an outstanding staff member or department.</p>

      <label class="ap-field">
        <span class="ap-field__label">Award type <span class="ap-field__req">*</span></span>
        <select v-model="form.awardType" class="ap-input">
          <option value="">Select award type</option>
          <option v-for="option in typeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>

      <label class="ap-field">
        <span class="ap-field__label">Recipient <span class="ap-field__req">*</span></span>
        <input
          v-model="form.recipientName"
          class="ap-input"
          type="text"
          list="award-recipients"
          placeholder="Search for a recipient by name or email..."
        />
        <datalist id="award-recipients">
          <option v-for="option in staffOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </datalist>
      </label>

      <label class="ap-field">
        <span class="ap-field__label">Period <span class="ap-field__req">*</span></span>
        <input v-model="form.period" class="ap-input" type="text" placeholder="e.g. September 2026" />
      </label>

      <label class="ap-field">
        <span class="ap-field__label">Reason <span class="ap-field__req">*</span></span>
        <textarea v-model="form.reason" class="ap-input ap-input--area" rows="3" />
      </label>

      <p v-if="formError" class="ap-form__error" role="alert">{{ formError }}</p>
    </AdminDialog>
  </AdminModuleShell>
</template>

<style scoped>
@import './admin-panel.css';
</style>
