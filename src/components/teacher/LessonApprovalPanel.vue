<script setup lang="ts">
/**
 * Review Inbox panel (D-72) — the origin's `/teacher/lesson-approval`.
 *
 * The origin renders `LessonPlanManagement assignedToMeOnly`, which is the same
 * component the HR portal mounts at `/staff-portal/lesson-planning/approvals`.
 * What is reproduced here:
 *
 *  - three status tabs — `Pending review`, `Approved`, `Rejected` — starting on
 *    `pending`, and the caption `Only plans assigned to you for review.`;
 *  - a 400 ms debounced search (the origin's review-inbox search debounce is
 *    400 ms, unlike the 300 ms used by the reviewer picker), placeholder
 *    `Search by teacher name or email...`, resetting the list on each keystroke;
 *  - the row action gate: approve and reject are offered only while the plan is
 *    `pending`, and only when the caller may act on it — meaning the plan has no
 *    assigned reviewer or names this session. When blocked, the origin's
 *    tooltip is used: `Only the assigned reviewer can approve or reject this
 *    plan.`;
 *  - the approve confirmation `Approve lesson plan?` and the reject sheet with
 *    an **optional** reason, placeholder
 *    `e.g. Objectives are not measurable, please revise and resubmit.`;
 *  - the success banners, near-verbatim: `Approved "<topic>" by <teacher>.`,
 *    `Rejected "<topic>" by <teacher>. The teacher has been notified.`
 *
 * NOT reproduced: the origin's PDF export (it needs `jsPDF`, which this portal
 * does not depend on), bulk selection, forwarding to another reviewer, and
 * sharing into a chat. Those are recorded in docs/teacher-portal/features.md as
 * UNKNOWN-for-this-port rather than faked.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { callApi } from '../../api';
import { useTeacherSession } from './useTeacherSession';
import TeacherModuleShell from './TeacherModuleShell.vue';
import TeacherStatusBadge from './TeacherStatusBadge.vue';
import type { LessonPlan, LessonPlanStatus } from '../../types/teacher';

const TABS: ReadonlyArray<{ id: LessonPlanStatus; label: string }> = [
  { id: 'pending', label: 'Pending review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

const session = useTeacherSession();

const plans = ref<LessonPlan[]>([]);
const loading = ref(false);
const loadError = ref('');
const banner = ref('');
const tab = ref<LessonPlanStatus>('pending');
const search = ref('');

/* Approve confirmation and the reject sheet, as two separate dialogs. */
const approving = ref<LessonPlan | null>(null);
const rejecting = ref<LessonPlan | null>(null);
const rejectReason = ref('');
const busy = ref(false);
const actionError = ref('');

const weekLabel = (plan: LessonPlan): string => (plan.week > 0 ? `Week ${plan.week}` : '—');

const badgeVariant = (status: LessonPlanStatus): 'default' | 'secondary' | 'outline' | 'destructive' => {
  if (status === 'approved') return 'default';
  if (status === 'pending') return 'secondary';
  if (status === 'rejected') return 'destructive';
  return 'outline';
};

/**
 * The origin's `canActOn(lesson)`: a plan assigned to somebody else is visible
 * but not actionable. Kept as a separate predicate so the disabled state and its
 * tooltip read from one rule.
 */
const canActOn = (plan: LessonPlan): boolean =>
  !plan.targetReviewerUsername || plan.targetReviewerUsername === session.username();

const blockedReason = 'Only the assigned reviewer can approve or reject this plan.';

const actionable = computed(() => (plan: LessonPlan): boolean => plan.status === 'pending' && canActOn(plan));

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_LESSON_PLAN_QUEUE', {
      schoolID: session.schoolID(),
      reviewerUsername: session.username(),
      status: tab.value,
      search: search.value || undefined,
      assignedToMe: true,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load lesson plans.');
    plans.value = data.plans;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load lesson plans.';
  } finally {
    loading.value = false;
  }
};

/* The origin's 400 ms debounce. */
const SEARCH_DEBOUNCE_MS = 400;
let timer: ReturnType<typeof setTimeout> | undefined;

watch(search, () => {
  clearTimeout(timer);
  timer = setTimeout(() => void load(), SEARCH_DEBOUNCE_MS);
});

onBeforeUnmount(() => clearTimeout(timer));

const review = async (plan: LessonPlan, decision: 'approved' | 'rejected'): Promise<void> => {
  busy.value = true;
  actionError.value = '';
  try {
    const data = await callApi('REVIEW_LESSON_PLAN', {
      schoolID: session.schoolID(),
      planId: plan.id,
      decision,
      remark: decision === 'rejected' ? rejectReason.value : undefined,
      signature: session.teacherName(),
    });
    if (data.status !== 'success') {
      throw new Error(
        decision === 'approved'
          ? 'Failed to approve the lesson plan.'
          : 'Failed to reject the lesson plan.',
      );
    }
    banner.value =
      decision === 'approved'
        ? `Approved "${plan.topic}" by ${plan.teacherName}.`
        : `Rejected "${plan.topic}" by ${plan.teacherName}. The teacher has been notified.`;
    approving.value = null;
    rejecting.value = null;
    rejectReason.value = '';
    await load();
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Failed to review the lesson plan.';
  } finally {
    busy.value = false;
  }
};

const openReject = (plan: LessonPlan): void => {
  actionError.value = '';
  rejectReason.value = '';
  rejecting.value = plan;
};

onMounted(load);
</script>

<template>
  <TeacherModuleShell
    title="Review Inbox"
    description="Only plans assigned to you for review."
    :loading="loading"
    :error="loadError"
    :empty-count="plans.length"
    @retry="load"
    :banner="banner"
    @dismiss="banner = ''"
  >
    <template #filters>
      <div class="tp-toolbar">
        <div class="tp-tabs" role="tablist" aria-label="Review status">
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
          placeholder="Search by teacher name or email..."
        />
      </div>
    </template>

    <template #empty>
      <p v-if="search.trim()">
        No lesson plans assigned to you for review{{ ` matching "${search.trim()}".` }}
      </p>
      <p v-else>No lesson plans assigned to you for review.</p>
    </template>

    <div class="tp-table-wrap">
      <table class="tp-table">
        <caption class="tp-table__caption">{{ plans.length }} lesson plan(s)</caption>
        <thead>
          <tr>
            <th scope="col">Subject</th>
            <th scope="col">Teacher</th>
            <th scope="col">Class</th>
            <th scope="col">Topic</th>
            <th scope="col">Week</th>
            <th scope="col">Date</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="tp-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="plan in plans" :key="plan.id">
            <td>{{ plan.subject }}</td>
            <td>{{ plan.teacherName }}</td>
            <td>{{ plan.className }}</td>
            <td>{{ plan.topic || '—' }}</td>
            <td>{{ weekLabel(plan) }}</td>
            <td>{{ plan.startDate || '—' }}</td>
            <td>
              <TeacherStatusBadge :status="plan.status" :variant="badgeVariant(plan.status)" />
            </td>
            <td class="tp-table__actions">
              <button
                type="button"
                class="tp-btn tp-btn--ghost tp-btn--xs"
                :disabled="!actionable(plan)"
                :title="actionable(plan) ? 'Approve' : blockedReason"
                @click="approving = plan"
              >
                Approve
              </button>
              <button
                type="button"
                class="tp-btn tp-btn--ghost tp-btn--xs"
                :disabled="!actionable(plan)"
                :title="actionable(plan) ? 'Reject' : blockedReason"
                @click="openReject(plan)"
              >
                Reject
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="actionError" class="tp-form__error" role="alert">{{ actionError }}</p>

    <div v-if="approving" class="tp-modal" role="alertdialog" aria-label="Approve lesson plan?">
      <div class="tp-modal__box">
        <h4 class="tp-modal__title">Approve lesson plan?</h4>
        <p class="tp-modal__body">
          "{{ approving.topic }}" by {{ approving.teacherName }} will be approved and signed.
        </p>
        <div class="tp-modal__actions">
          <button type="button" class="tp-btn tp-btn--ghost" @click="approving = null">Cancel</button>
          <button
            type="button"
            class="tp-btn tp-btn--primary"
            :disabled="busy"
            @click="review(approving, 'approved')"
          >
            {{ busy ? 'Approving...' : 'Approve' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="rejecting" class="tp-modal" role="alertdialog" aria-label="Reject lesson plan">
      <div class="tp-modal__box">
        <h4 class="tp-modal__title">Reject lesson plan</h4>
        <p class="tp-modal__body">
          "{{ rejecting.topic }}" will be returned to {{ rejecting.teacherName }} for revision.
        </p>
        <label class="tp-field">
          <span class="tp-field__label">Reason (optional)</span>
          <textarea
            v-model="rejectReason"
            class="tp-input tp-input--area"
            rows="3"
            placeholder="e.g. Objectives are not measurable, please revise and resubmit."
          />
        </label>
        <div class="tp-modal__actions">
          <button type="button" class="tp-btn tp-btn--ghost" @click="rejecting = null">Cancel</button>
          <button
            type="button"
            class="tp-btn tp-btn--danger"
            :disabled="busy"
            @click="review(rejecting, 'rejected')"
          >
            {{ busy ? 'Rejecting...' : 'Reject' }}
          </button>
        </div>
      </div>
    </div>
  </TeacherModuleShell>
</template>

<style scoped>
@import './teacher-panel.css';

.tp-form__error {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: #8f2a2a;
}

.tp-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(11 34 66 / 0.72);
  backdrop-filter: blur(6px);
  z-index: var(--z-modal);
  padding: 1rem;
}

.tp-modal__box {
  background: #fff;
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  width: min(92%, 440px);
  box-shadow: 0 12px 32px rgb(18 23 34 / 0.14);
}

.tp-modal__title {
  margin: 0 0 0.375rem;
  font-size: 0.9375rem;
}

.tp-modal__body {
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
  color: var(--text-muted, #5b6472);
}

.tp-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}
</style>