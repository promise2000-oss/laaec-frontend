<script setup lang="ts">
/**
 * AdminLeavePanel — `/leave` and `/leave/approvals`.
 *
 * The two pages are one data set with two views of it, which is why they share
 * this component: `/leave` tabs across All / Pending / Approved / Rejected and
 * offers `Apply for Leave`; `/leave/approvals` splits the same rows into
 * `Pending (n)` and `Decided (n)` and offers only approve/reject.
 *
 * VALIDATION, verbatim from the live leave form
 * ---------------------------------------------
 *   "Select the staff member"
 *   "Enter a leave type"
 *   "Select the leave dates"
 *   "End date must be after the start date"   (inclusive day count <= 0)
 *   "Provide a reason for the leave"
 *
 * The live form also derives the duration rather than storing it — `Select dates
 * to calculate the duration.` — and sets the end date's `min` from the start
 * date. Both are reproduced, because both are what stops an invalid request
 * reaching the server rather than being caught after.
 *
 * NO PERMISSION CHECK ON THE DECISION BUTTONS, ON PURPOSE
 * -------------------------------------------------------
 * The deployed `LeaveDetailPage` renders Approve/Reject whenever a request is
 * `PENDING` with no permission check at all. The teacher-portal port reproduced
 * that and flagged it (docs/teacher-portal/permissions.md §4). Here the buttons
 * ARE gated on `leave.approve`, because this is the admin console where that
 * permission exists and is granted — so reproducing the gap would mean shipping a
 * control the admin rail already says this session does not hold. Recorded as a
 * deliberate divergence in parity-report.md.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { callApi } from '../../api';
import AdminDialog from './AdminDialog.vue';
import AdminModuleShell from './AdminModuleShell.vue';
import AdminStatusBadge from './AdminStatusBadge.vue';
import { useAdminSession } from './useAdminSession';
import type { AdminModule } from '../../types/admin-registry';
import type { LeaveApplication } from '../../types/admin';

const props = defineProps<{ module: AdminModule }>();
const can = defineModel<((permission?: string | null) => boolean) | null>('can', { default: null });

const session = useAdminSession();
const mayApprove = computed(() => (can.value ? can.value('leave.approve') : true));
const isApprovalsView = computed(() => props.module.id === 'leave-approvals');

interface LeaveRow extends Record<string, unknown> {
  id: string;
  staffName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string;
  decisionComment: string;
}

const rows = ref<LeaveRow[]>([]);
const staffOptions = ref<Array<{ value: string; label: string }>>([]);
const tab = ref<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
const search = ref('');
const loading = ref(false);
const loadError = ref('');
const banner = ref('');
const busy = ref(false);
const formError = ref('');

const formOpen = ref(false);
const detailId = ref('');
const form = ref({ staffName: '', leaveType: '', startDate: '', endDate: '', reason: '' });

const pending = computed(() => rows.value.filter((r) => r.status === 'PENDING'));
const decided = computed(() => rows.value.filter((r) => r.status !== 'PENDING'));

const visible = computed(() => {
  const base = tab.value === 'ALL' ? rows.value : rows.value.filter((r) => r.status === tab.value);
  const term = search.value.trim().toLowerCase();
  return term ? base.filter((r) => JSON.stringify(r).toLowerCase().includes(term)) : base;
});

/** The live form's inclusive day count, and its zero-means-invalid rule. */
const days = computed<number>(() => {
  if (!form.value.startDate || !form.value.endDate) return 0;
  const a = Date.parse(form.value.startDate);
  const b = Date.parse(form.value.endDate);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
});

const durationLine = computed(() =>
  days.value > 0 ? `${days.value} working day(s) requested` : 'Select dates to calculate the duration.',
);

const detail = computed<LeaveApplication | null>(() => {
  const row = rows.value.find((r) => r.id === detailId.value);
  return row ? ({ ...row, decisionComment: row.decisionComment } as unknown as LeaveApplication) : null;
});

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('LIST_ADMIN_RECORDS', { resource: 'leave', limit: 200 });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load leave requests.');
    rows.value = data.records as LeaveRow[];
    const list = await callApi('GET_ADMIN_OPTION_LIST', { key: 'staff' });
    staffOptions.value = list.status === 'success' ? list.options : [];
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load leave requests.';
    rows.value = [];
  } finally {
    loading.value = false;
  }
};

watch([tab, search], () => undefined);
onMounted(load);

const openForm = (): void => {
  form.value = { staffName: '', leaveType: '', startDate: '', endDate: '', reason: '' };
  formError.value = '';
  formOpen.value = true;
};

const submitForm = async (): Promise<void> => {
  /* The live form's five messages, in the order it checks them. */
  if (!form.value.staffName) { formError.value = 'Select the staff member'; return; }
  if (!form.value.leaveType.trim()) { formError.value = 'Enter a leave type'; return; }
  if (!form.value.startDate || !form.value.endDate) { formError.value = 'Select the leave dates'; return; }
  if (days.value <= 0) { formError.value = 'End date must be after the start date'; return; }
  if (!form.value.reason.trim()) { formError.value = 'Provide a reason for the leave'; return; }

  busy.value = true;
  formError.value = '';
  try {
    const data = await callApi('SAVE_ADMIN_RECORD', {
      resource: 'leave',
      record: {
        staffName: form.value.staffName,
        leaveId: '',
        leaveType: form.value.leaveType.trim(),
        startDate: form.value.startDate,
        endDate: form.value.endDate,
        days: days.value,
        reason: form.value.reason.trim(),
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      },
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Something went wrong.');
    banner.value = 'Leave request submitted';
    formOpen.value = false;
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Something went wrong.';
  } finally {
    busy.value = false;
  }
};

const decide = async (row: LeaveRow, decision: 'APPROVED' | 'REJECTED'): Promise<void> => {
  busy.value = true;
  try {
    const data = await callApi('ADMIN_DECIDE', {
      resource: 'leave',
      id: row.id,
      decision,
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Something went wrong.');
    banner.value = `Leave request ${decision === 'APPROVED' ? 'approved' : 'rejected'}.`;
    detailId.value = '';
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Something went wrong.';
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
      <button v-if="!isApprovalsView" type="button" class="ap-btn" @click="detailId = ''; tab = 'PENDING'; visible">Approvals</button>
      <button v-if="!isApprovalsView" type="button" class="ap-btn ap-btn--primary" @click="openForm">Apply for Leave</button>
    </template>

    <template #filters>
      <div class="ap-toolbar">
        <div class="ap-tabs" role="tablist" aria-label="Leave status">
          <button
            v-for="entry in (isApprovalsView ? [] : [{ key: 'ALL', label: 'All' }, { key: 'PENDING', label: 'Pending' }, { key: 'APPROVED', label: 'Approved' }, { key: 'REJECTED', label: 'Rejected' }])"
            :key="entry.key"
            type="button"
            role="tab"
            class="ap-tab"
            :class="{ 'ap-tab--on': tab === entry.key }"
            :aria-selected="tab === entry.key"
            @click="tab = entry.key as typeof tab"
          >
            {{ entry.label }}
          </button>
        </div>
        <input
          v-model="search"
          class="ap-input ap-toolbar__search"
          type="search"
          placeholder="Search leave requests..."
          aria-label="Search leave requests"
        />
      </div>
    </template>

    <template #empty>
      <p>No leave requests match your filters.</p>
    </template>

    <!-- Approvals view: two labelled tables, as the live page has. -->
    <template v-if="isApprovalsView">
      <section v-for="group in [{ key: 'pending', label: `Pending (${pending.length})`, rows: pending }, { key: 'decided', label: `Decided (${decided.length})`, rows: decided }]" :key="group.key" class="ap-report__block">
        <h3 class="ap-dash__heading">{{ group.label }}</h3>
        <div class="ap-table-wrap">
          <table class="ap-table">
            <thead>
              <tr>
                <th scope="col">Staff</th>
                <th scope="col">Leave Type</th>
                <th scope="col">Dates</th>
                <th scope="col" class="ap-num">Days</th>
                <th scope="col">Status</th>
                <th scope="col"><span class="ap-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in group.rows" :key="row.id">
                <td>{{ row.staffName }}</td>
                <td>{{ row.leaveType }}</td>
                <td>{{ row.startDate }} – {{ row.endDate }}</td>
                <td class="ap-num">{{ row.days }}</td>
                <td><AdminStatusBadge :status="row.status" /></td>
                <td class="ap-table__actions">
                  <template v-if="row.status === 'PENDING' && mayApprove">
                    <button type="button" class="ap-btn ap-btn--xs ap-btn--primary" @click="decide(row, 'APPROVED')">Approve</button>
                    <button type="button" class="ap-btn ap-btn--xs ap-btn--danger" @click="decide(row, 'REJECTED')">Reject</button>
                  </template>
                  <button v-else type="button" class="ap-btn ap-btn--xs" @click="detailId = row.id">View</button>
                </td>
              </tr>
              <tr v-if="group.rows.length === 0">
                <td colspan="6" class="ap-inline-note">
                  {{ group.key === 'pending' ? 'No pending leave requests.' : 'No decided requests yet.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <!-- List view. -->
    <template v-else-if="detail">
      <button type="button" class="ap-btn ap-btn--ghost" @click="detailId = ''">&larr; Back to leave requests</button>
      <div class="ap-card">
        <h3 class="ap-card__title">{{ detail.staffName }}</h3>
        <dl class="ap-fields">
          <div><dt>Leave type</dt><dd>{{ detail.leaveType }}</dd></div>
          <div><dt>Duration</dt><dd>{{ detail.days }} day(s)</dd></div>
          <div><dt>From</dt><dd>{{ detail.startDate }}</dd></div>
          <div><dt>To</dt><dd>{{ detail.endDate }}</dd></div>
        </dl>
        <h4 class="ap-band">REASON</h4>
        <p class="ap-inline-note">{{ detail.reason || '—' }}</p>
        <div class="ap-detail__actions">
          <AdminStatusBadge :status="detail.status" />
          <template v-if="detail.status === 'PENDING' && mayApprove">
            <button type="button" class="ap-btn ap-btn--primary" :disabled="busy" @click="decide(detail as unknown as LeaveRow, 'APPROVED')">Approve</button>
            <button type="button" class="ap-btn ap-btn--danger" :disabled="busy" @click="decide(detail as unknown as LeaveRow, 'REJECTED')">Reject</button>
          </template>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="ap-table-wrap">
        <table class="ap-table">
          <caption class="ap-table__caption">{{ visible.length }} leave request(s)</caption>
          <thead>
            <tr>
              <th scope="col">Staff</th>
              <th scope="col">Leave Type</th>
              <th scope="col">Dates</th>
              <th scope="col" class="ap-num">Days</th>
              <th scope="col">Status</th>
              <th scope="col"><span class="ap-sr">Details</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in visible" :key="row.id">
              <td>{{ row.staffName }}</td>
              <td>{{ row.leaveType }}</td>
              <td>{{ row.startDate }} – {{ row.endDate }}</td>
              <td class="ap-num">{{ row.days }}</td>
              <td><AdminStatusBadge :status="row.status" /></td>
              <td class="ap-table__actions">
                <button type="button" class="ap-btn ap-btn--xs" @click="detailId = row.id">View</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Apply for leave. -->
    <AdminDialog
      :open="formOpen"
      title="Apply for Leave"
      confirm-label="Submit request"
      :busy="busy"
      @close="formOpen = false"
      @confirm="submitForm"
    >
      <p class="ap-inline-note">Submit a new leave request.</p>

      <label class="ap-field">
        <span class="ap-field__label">Staff member <span class="ap-field__req">*</span></span>
        <select v-model="form.staffName" class="ap-input">
          <option value="">Select a staff member</option>
          <option v-for="option in staffOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>

      <label class="ap-field">
        <span class="ap-field__label">Leave type <span class="ap-field__req">*</span></span>
        <input v-model="form.leaveType" class="ap-input" placeholder="e.g. Annual Leave, Sick Leave, Compassionate Leave" />
      </label>

      <div class="ap-form">
        <label class="ap-field">
          <span class="ap-field__label">Start date <span class="ap-field__req">*</span></span>
          <input v-model="form.startDate" class="ap-input" type="date" />
        </label>
        <label class="ap-field">
          <span class="ap-field__label">End date <span class="ap-field__req">*</span></span>
          <input v-model="form.endDate" class="ap-input" type="date" :min="form.startDate || undefined" />
        </label>
      </div>
      <p class="ap-inline-note">{{ durationLine }}</p>

      <label class="ap-field">
        <span class="ap-field__label">Reason <span class="ap-field__req">*</span></span>
        <textarea v-model="form.reason" class="ap-input ap-input--area" rows="3" placeholder="Briefly explain the reason for this leave request." />
      </label>

      <p v-if="formError" class="ap-form__error" role="alert">{{ formError }}</p>
    </AdminDialog>
  </AdminModuleShell>
</template>

<style scoped>
@import './admin-panel.css';

.ap-report__block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ap-dash__heading {
  margin: 0;
  font-size: 0.9375rem;
}
</style>
