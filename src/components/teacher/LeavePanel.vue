<script setup lang="ts">
/**
 * Permission (leave) panel (D-72) — the origin's 3 routes collapsed.
 *
 * Origin routes folded in: `/teacher/leave` (the list), `/teacher/leave/apply`
 * (the form) and `/teacher/leave/[id]` (the detail, which is also where a
 * pending request can be approved or rejected).
 *
 * The rail label is the origin's own — `Permission (leave)` — not "Leave". The
 * nav item reads `Permission (leave)` in `teacher-nav.ts`, and a rail label is
 * observable copy.
 *
 * VALIDATION, verbatim from the origin's `handleSubmit`
 * -----------------------------------------------
 *   "Select the staff member"
 *   "Enter a leave type"
 *   "Select the leave dates"
 *   "End date must be after the start date"   (when the inclusive day count <= 0)
 *   "Provide a reason for the leave"
 *
 * And two origin details worth naming:
 *
 *  - `endDate` is given `min={startDate}`, and the duration line is computed,
 *    not stored: `{n} working day(s) requested`, or
 *    `Select dates to calculate the duration.` when a date is missing.
 *  - the status is stored and rendered UPPERCASE (`PENDING`/`APPROVED`/
 *    `REJECTED`) even though the origin's own type declares it lowercase. That
 *    is the observable behaviour, so `LeaveStatus` is the uppercase union.
 *
 * A teacher's own request can be decided from this panel, which is the origin's
 * behaviour: `LeaveDetailPage` renders Approve/Reject whenever
 * `status === 'PENDING'` with **no permission check at all**. Reproduced, and
 * flagged in docs/teacher-portal/permissions.md §4 as an origin gap rather than
 * quietly tightened here.
 */
import { computed, onMounted, ref } from 'vue';
import { callApi } from '../../api';
import { useTeacherSession } from './useTeacherSession';
import TeacherModuleShell from './TeacherModuleShell.vue';
import TeacherStatusBadge from './TeacherStatusBadge.vue';
import type { LeaveRequest, LeaveStatus } from '../../types/teacher';

const TABS: ReadonlyArray<{ id: LeaveStatus | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
];

const session = useTeacherSession();

const requests = ref<LeaveRequest[]>([]);
const loading = ref(false);
const loadError = ref('');
const banner = ref('');
const tab = ref<LeaveStatus | 'ALL'>('ALL');
const search = ref('');

/* The apply form, and the success card the origin shows instead of it. */
const applying = ref(false);
const staffOptions = ref<Array<{ username: string; fullName: string; department: string }>>([]);
const staffLoading = ref(false);
const staffError = ref('');
const formError = ref('');
const submitting = ref(false);
const submitted = ref<LeaveRequest | null>(null);

const form = ref({
  staffUsername: '',
  leaveType: '',
  startDate: '',
  endDate: '',
  reason: '',
});

/** The origin's inclusive day count. Zero when either date is missing or reversed. */
const days = computed<number>(() => {
  const start = form.value.startDate;
  const end = form.value.endDate;
  if (!start || !end) return 0;
  const a = Date.parse(start);
  const b = Date.parse(end);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
});

const durationLine = computed(() =>
  days.value > 0 ? `${days.value} working day(s) requested` : 'Select dates to calculate the duration.',
);

const visible = computed(() =>
  tab.value === 'ALL' ? requests.value : requests.value.filter((r) => r.status === tab.value),
);

const badgeVariant = (status: LeaveStatus): 'default' | 'secondary' | 'destructive' => {
  if (status === 'APPROVED') return 'default';
  if (status === 'REJECTED') return 'destructive';
  return 'secondary';
};

const longDate = (value: string): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_LEAVE_REQUESTS', {
      schoolID: session.schoolID(),
      teacherUsername: session.username(),
      status: tab.value === 'ALL' ? undefined : tab.value,
      search: search.value || undefined,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load leave requests.');
    requests.value = data.requests;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load leave requests.';
  } finally {
    loading.value = false;
  }
};

const loadStaff = async (): Promise<void> => {
  staffLoading.value = true;
  staffError.value = '';
  try {
    const data = await callApi('GET_TEACHER_DIRECTORY', {
      schoolID: session.schoolID(),
      requesterUsername: session.username(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load staff');
    // The origin's picker excludes accounts still in the `invited` state.
    staffOptions.value = data.staff
      .filter((entry) => entry.status !== 'invited')
      .map((entry) => ({
        username: entry.username,
        fullName: entry.fullName,
        department: entry.department,
      }));
  } catch (e) {
    staffError.value = e instanceof Error ? e.message : 'Failed to load staff';
  } finally {
    staffLoading.value = false;
  }
};

const openApply = async (): Promise<void> => {
  applying.value = true;
  submitted.value = null;
  formError.value = '';
  form.value = {
    // Defaults to the signed-in teacher, which is what a teacher applying for
    // their own leave always wants.
    staffUsername: session.username(),
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
  };
  if (staffOptions.value.length === 0) await loadStaff();
};

const closeApply = (): void => {
  applying.value = false;
  submitted.value = null;
  formError.value = '';
};

const submit = async (): Promise<void> => {
  // The origin's five messages, in the order it checks them.
  if (!form.value.staffUsername) {
    formError.value = 'Select the staff member';
    return;
  }
  if (!form.value.leaveType.trim()) {
    formError.value = 'Enter a leave type';
    return;
  }
  if (!form.value.startDate || !form.value.endDate) {
    formError.value = 'Select the leave dates';
    return;
  }
  if (days.value <= 0) {
    formError.value = 'End date must be after the start date';
    return;
  }
  if (!form.value.reason.trim()) {
    formError.value = 'Provide a reason for the leave';
    return;
  }

  const chosen = staffOptions.value.find((s) => s.username === form.value.staffUsername);
  submitting.value = true;
  formError.value = '';
  try {
    const data = await callApi('APPLY_FOR_LEAVE', {
      schoolID: session.schoolID(),
      staffUsername: form.value.staffUsername,
      staffName: chosen?.fullName ?? session.teacherName(),
      department: chosen?.department ?? '',
      leaveType: form.value.leaveType.trim(),
      startDate: form.value.startDate,
      endDate: form.value.endDate,
      days: days.value,
      reason: form.value.reason.trim(),
    });
    if (data.status !== 'success' || !data.request) {
      throw new Error(data.message || 'Something went wrong.');
    }
    submitted.value = data.request;
    banner.value = 'Leave request submitted';
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Something went wrong.';
  } finally {
    submitting.value = false;
  }
};

const decide = async (request: LeaveRequest, decision: 'APPROVED' | 'REJECTED'): Promise<void> => {
  submitting.value = true;
  try {
    const data = await callApi('DECIDE_LEAVE', {
      schoolID: session.schoolID(),
      requestId: request.id,
      decision,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Something went wrong.');
    banner.value = `Leave request ${decision === 'APPROVED' ? 'approved' : 'rejected'}.`;
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Something went wrong.';
  } finally {
    submitting.value = false;
  }
};

const openRequest = computed(() => requests.value.find((r) => r.id === openId.value) ?? null);
const openId = ref('');

onMounted(load);
</script>

<template>
  <TeacherModuleShell
    title="My Permission"
    description="Apply for leave and track the decision."
    :loading="loading"
    :error="loadError"
    :empty-count="requests.length"
    @retry="load"
    :banner="banner"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button type="button" class="tp-btn tp-btn--primary" @click="openApply">
        Apply for Permission
      </button>
    </template>

    <template #filters>
      <div class="tp-toolbar">
        <div class="tp-tabs" role="tablist" aria-label="Leave status">
          <button
            v-for="entry in TABS"
            :key="entry.id"
            type="button"
            role="tab"
            class="tp-tab"
            :class="{ 'tp-tab--on': tab === entry.id }"
            :aria-selected="tab === entry.id"
            @click="tab = entry.id; load()"
          >
            {{ entry.label }}
          </button>
        </div>
        <input
          v-model="search"
          class="tp-input tp-toolbar__search"
          type="search"
          placeholder="Search leave requests..."
        />
      </div>
    </template>

    <template #empty>
      <p>No leave requests match your filters.</p>
      <button type="button" class="tp-btn tp-btn--primary tp-empty__cta" @click="openApply">
        Apply for Permission
      </button>
    </template>

    <!-- The origin's success card, shown in place of the form. -->
    <div v-if="submitted" class="tp-card">
      <h3 class="tp-card__title">Leave request submitted</h3>
      <p class="tp-inline-note">
        {{ submitted.staffName }}'s {{ submitted.leaveType }} request for {{ submitted.days }} day(s)
        has been sent for approval.
      </p>
      <div class="tp-detail__actions">
        <button type="button" class="tp-btn" @click="closeApply">Back to leave requests</button>
      </div>
    </div>

    <div v-else-if="applying" class="tp-card">
      <h3 class="tp-card__title">Apply for leave</h3>

      <label class="tp-field">
        <span class="tp-field__label">Staff member</span>
        <select v-model="form.staffUsername" class="tp-input">
          <option value="">Select a staff member</option>
          <option v-for="entry in staffOptions" :key="entry.username" :value="entry.username">
            {{ entry.fullName }} &middot; {{ entry.department }}
          </option>
        </select>
        <span v-if="staffLoading" class="tp-field__hint">Loading staff...</span>
        <span v-else-if="staffOptions.length === 0 && !staffError" class="tp-field__hint">
          No staff members found. Please add staff first.
        </span>
        <span v-if="staffError" class="tp-field__hint tp-form__error">{{ staffError }}</span>
      </label>

      <label class="tp-field">
        <span class="tp-field__label">Leave type</span>
        <input
          v-model="form.leaveType"
          class="tp-input"
          placeholder="e.g. Annual Leave, Sick Leave, Compassionate Leave"
        />
      </label>

      <div class="tp-form">
        <label class="tp-field">
          <span class="tp-field__label">Start date</span>
          <input v-model="form.startDate" class="tp-input" type="date" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">End date</span>
          <!-- The origin sets min from the chosen start date. -->
          <input
            v-model="form.endDate"
            class="tp-input"
            type="date"
            :min="form.startDate || undefined"
          />
        </label>
      </div>
      <p class="tp-inline-note">{{ durationLine }}</p>

      <label class="tp-field">
        <span class="tp-field__label">Reason</span>
        <textarea
          v-model="form.reason"
          class="tp-input tp-input--area"
          rows="3"
          placeholder="Briefly explain the reason for this leave request."
        />
      </label>

      <p v-if="formError" class="tp-form__error" role="alert">{{ formError }}</p>

      <div class="tp-detail__actions">
        <button type="button" class="tp-btn tp-btn--ghost" :disabled="submitting" @click="closeApply">
          Cancel
        </button>
        <button type="button" class="tp-btn tp-btn--primary" :disabled="submitting" @click="submit">
          {{ submitting ? 'Submitting...' : 'Submit request' }}
        </button>
      </div>
    </div>

    <div v-else-if="openRequest" class="tp-card">
      <button type="button" class="tp-btn tp-btn--ghost" @click="openId = ''">
        &larr; Back to leave requests
      </button>
      <h3 class="tp-card__title">{{ openRequest.staffName }}</h3>
      <dl class="tp-fields">
        <div><dt>Leave type</dt><dd>{{ openRequest.leaveType }}</dd></div>
        <div><dt>Duration</dt><dd>{{ openRequest.days }} day(s)</dd></div>
        <div><dt>From</dt><dd>{{ longDate(openRequest.startDate) }}</dd></div>
        <div><dt>To</dt><dd>{{ longDate(openRequest.endDate) }}</dd></div>
      </dl>
      <h4 class="tp-band">REASON</h4>
      <p class="tp-inline-note">{{ openRequest.reason || '—' }}</p>

      <div class="tp-detail__actions">
        <TeacherStatusBadge
          :status="openRequest.status"
          :variant="badgeVariant(openRequest.status)"
        />
        <!-- Rendered on status alone, as the origin does — no permission check. -->
        <template v-if="openRequest.status === 'PENDING'">
          <button
            type="button"
            class="tp-btn tp-btn--primary"
            :disabled="submitting"
            @click="decide(openRequest, 'APPROVED')"
          >
            Approve
          </button>
          <button
            type="button"
            class="tp-btn tp-btn--danger"
            :disabled="submitting"
            @click="decide(openRequest, 'REJECTED')"
          >
            Reject
          </button>
        </template>
      </div>
    </div>

    <div v-else class="tp-table-wrap">
      <table class="tp-table">
        <caption class="tp-table__caption">{{ visible.length }} leave request(s)</caption>
        <thead>
          <tr>
            <th scope="col">Staff</th>
            <th scope="col">Leave Type</th>
            <th scope="col">Dates</th>
            <th scope="col">Days</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="tp-sr">Details</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="request in visible" :key="request.id" class="tp-row" tabindex="0" @click="openId = request.id" @keydown.enter="openId = request.id">
            <td>{{ request.staffName }}</td>
            <td>{{ request.leaveType }}</td>
            <td>{{ request.startDate }} – {{ request.endDate }}</td>
            <td>{{ request.days }}</td>
            <td>
              <TeacherStatusBadge :status="request.status" :variant="badgeVariant(request.status)" />
            </td>
            <td class="tp-table__actions">
              <button type="button" class="tp-btn tp-btn--ghost tp-btn--xs" @click.stop="openId = request.id">
                View
              </button>
            </td>
          </tr>
        </tbody>
      </table>
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
</style>