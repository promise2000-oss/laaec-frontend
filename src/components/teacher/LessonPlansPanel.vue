<script setup lang="ts">
/**
 * Lesson Planning panel (D-72) — the origin's 10 routes collapsed into one.
 *
 * Origin routes folded in: `/teacher/lesson-planning`, `/my-plans`,
 * `/drafts`, `/pending-review`, `/approved`, `/rejected` (all the same
 * `LessonTable` with a different `status`), `/create`, `/[id]`, `/[id]/edit`
 * (the latter two become an in-panel form) and `/weekly-planner`.
 *
 * WHAT IS REPRODUCED
 *   - the five status tabs, which are the origin's route segments;
 *   - the column set: Subject, Teacher, Class, Topic, Week, Date, Status,
 *     Actions — no sort control, no pagination, no search box, because the
 *     origin's `LessonTable` has none;
 *   - the date fallback to `createdAt` when `startDate` is empty, and `Week {n}`
 *     versus an em dash when `week` is unset;
 *   - row click routing to the editor when editable and the reader otherwise;
 *   - Edit gated on `status !== 'approved'`, Delete gated on
 *     `status === 'draft'`, both also requiring ownership;
 *   - the delete confirmation copy verbatim: title `Delete lesson plan?`, body
 *     `"<topic>" will be permanently deleted. This cannot be undone.`;
 *   - the empty copy `No lesson plans with status "<status>" yet.`
 *
 * WHAT IS DELIBERATELY NOT INHERITED
 *   The origin's supporting-document upload. LAEC has no attachment surface,
 *   so the field is captured as a filename and shown read-only. See
 *   docs/teacher-portal/api-map.md.
 */
import { computed, onMounted, ref } from 'vue';
import { callApi } from '../../api';
import { useTeacherSession } from './useTeacherSession';
import TeacherModuleShell from './TeacherModuleShell.vue';
import TeacherStatusBadge from './TeacherStatusBadge.vue';
import type { LessonPlan, LessonPlanStatus, ReferenceClass } from '../../types/teacher';

/** The origin's five status tabs, in its order. */
const TABS: ReadonlyArray<{ id: LessonPlanStatus | 'all'; label: string }> = [
  { id: 'all', label: 'My Plans' },
  { id: 'draft', label: 'Drafts' },
  { id: 'pending', label: 'Pending Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

const session = useTeacherSession();

const plans = ref<LessonPlan[]>([]);
const loading = ref(false);
const loadError = ref('');
const banner = ref('');
const tab = ref<LessonPlanStatus | 'all'>('all');

/* Which plan is open, and whether the form is showing. `''` means the list. */
const openId = ref('');
const editing = ref(false);
/* Confirm-delete target, the origin's AlertDialog. */
const deleteTarget = ref<LessonPlan | null>(null);
const saving = ref(false);
const formError = ref('');

/**
 * A plan being authored that does not exist in the store yet.
 *
 * It has to be held separately from `openId`: a new plan has no id, so keying
 * the form on an open record meant `New Lesson` set a flag that nothing rendered
 * from. `editing` below is what the form's visibility actually keys on.
 */
const draft = ref<LessonPlan | null>(null);

const canCreate = (): boolean => true;
const canUpdate = (plan: LessonPlan): boolean =>
  plan.teacherUsername === session.username() && plan.status !== 'approved';
const canDelete = (plan: LessonPlan): boolean =>
  plan.teacherUsername === session.username() && plan.status === 'draft';

const visible = computed(() => (tab.value === 'all' ? plans.value : plans.value.filter((p) => p.status === tab.value)));

const openPlan = computed(() => plans.value.find((p) => p.id === openId.value) ?? null);

/** What the detail/form block shows: a stored plan, or the unsaved draft. */
const subject = computed<LessonPlan | null>(() => draft.value ?? openPlan.value);

/**
 * The class picker.
 *
 * The origin makes this a `<Select>` whose option values are class ids, and its
 * validator checks `!classId`. A free-text field writing only the display name
 * could never satisfy that rule, so the select is kept: choosing a class sets
 * both, which is what the origin's form does on change.
 */
const classes = ref<ReferenceClass[]>([]);

const onClassChange = (): void => {
  const plan = subject.value;
  if (!plan) return;
  const chosen = classes.value.find((c) => c.id === plan.classId);
  plan.className = chosen?.name ?? '';
};

const loadClasses = async (): Promise<void> => {
  try {
    const data = await callApi('GET_TEACHER_DIRECTORY', {
      schoolID: session.schoolID(),
      requesterUsername: session.username(),
    });
    if (data.status === 'success') classes.value = data.classes;
  } catch {
    classes.value = [];
  }
};

/** `Week {n}`, or an em dash — the origin's `Week` cell. */
const weekLabel = (plan: LessonPlan): string => (plan.week > 0 ? `Week ${plan.week}` : '—');

/** The origin falls back to `createdAt` when `startDate` is null. */
const dateLabel = (value: string): string => (value ? value.slice(0, 10) : '—');

const badgeVariant = (status: LessonPlanStatus): 'default' | 'secondary' | 'outline' | 'destructive' => {
  if (status === 'approved') return 'default';
  if (status === 'pending') return 'secondary';
  if (status === 'rejected') return 'destructive';
  return 'outline';
};

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_LESSON_PLANS', {
      schoolID: session.schoolID(),
      teacherUsername: session.username(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load lesson plans.');
    plans.value = data.plans;
    void loadClasses();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load lesson plans.';
  } finally {
    loading.value = false;
  }
};

/** Row click: the editor when editable, the reader otherwise. */
const open = (plan: LessonPlan): void => {
  openId.value = plan.id;
  editing.value = canUpdate(plan);
  formError.value = '';
};

const closeDetail = (): void => {
  openId.value = '';
  draft.value = null;
  editing.value = false;
  formError.value = '';
};

/** The origin's blank create form, with its own defaults. */
const blankPlan = (): LessonPlan => ({
  id: '',
  teacherUsername: session.username(),
  teacherName: session.teacherName(),
  academicSessionId: '',
  term: '',
  week: 1,
  classId: '',
  className: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  subject: '',
  topic: '',
  subTopic: '',
  duration: '',
  period: '',
  objectives: [],
  instructionalMaterials: '',
  previousKnowledge: '',
  entryBehaviour: '',
  recommendedText: '',
  referenceText: '',
  lessonContent: [],
  presentationSteps: [],
  studentActivities: [],
  summary: '',
  evaluationQuestions: '',
  assignment: '',
  remarks: '',
  supportingDocName: '',
  status: 'draft',
  rejectionReason: '',
  targetReviewerUsername: null,
  signature: '',
  signatureStyle: 'vibes',
  reviewedBy: '',
  reviewedAt: '',
});

const startCreate = (): void => {
  openId.value = '';
  draft.value = blankPlan();
  editing.value = true;
  formError.value = '';
};

const save = async (status: 'draft' | 'pending'): Promise<void> => {
  const plan = subject.value;
  if (!plan) return;
  saving.value = true;
  formError.value = '';
  try {
    const data = await callApi('SAVE_LESSON_PLAN', {
      schoolID: session.schoolID(),
      planId: plan.id || undefined,
      teacherUsername: session.username(),
      plan: {
        ...plan,
        // The review fields belong to the store, not the form.
        reviewedBy: '',
        reviewedAt: '',
      },
      status,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not save this lesson plan.');
    banner.value =
      status === 'draft' ? 'Lesson plan saved as a draft.' : 'Lesson plan saved and sent for review.';
    await load();
    // The draft now has an id, so it becomes an ordinary open record.
    draft.value = null;
    openId.value = data.plan?.id ?? '';
    editing.value = false;
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Could not save this lesson plan.';
  } finally {
    saving.value = false;
  }
};

const confirmDelete = async (): Promise<void> => {
  const target = deleteTarget.value;
  if (!target) return;
  saving.value = true;
  try {
    const data = await callApi('DELETE_LESSON_PLAN', {
      schoolID: session.schoolID(),
      planId: target.id,
      teacherUsername: session.username(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to delete the lesson plan.');
    banner.value = `"${target.topic}" deleted.`;
    deleteTarget.value = null;
    if (openId.value === target.id) closeDetail();
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Failed to delete the lesson plan.';
    deleteTarget.value = null;
  } finally {
    saving.value = false;
  }
};

onMounted(load);
</script>

<template>
  <TeacherModuleShell
    title="Lesson Planning"
    description="E-Lesson Plan — create, submit and manage your lesson plans"
    :loading="loading"
    :error="loadError"
    :empty-count="plans.length"
    @retry="load"
    :banner="banner"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button
        v-if="canCreate() && !openPlan"
        type="button"
        class="tp-btn tp-btn--primary"
        @click="startCreate"
      >
        New Lesson
      </button>
    </template>

    <template #filters>
      <div class="tp-tabs" role="tablist" aria-label="Lesson plan status">
        <button
          v-for="entry in TABS"
          :key="entry.id"
          type="button"
          role="tab"
          class="tp-tab"
          :class="{ 'tp-tab--on': tab === entry.id }"
          :aria-selected="tab === entry.id"
          @click="tab = entry.id"
        >
          {{ entry.label }}
        </button>
      </div>
    </template>

    <template #empty>
      <p v-if="tab === 'all'">No lesson plans yet.</p>
      <p v-else>No lesson plans with status "{{ tab }}" yet.</p>
      <button
        v-if="canCreate()"
        type="button"
        class="tp-btn tp-btn--primary tp-empty__cta"
        @click="startCreate"
      >
        Create a lesson plan
      </button>
    </template>

    <!-- Detail / form replaces the list, as the origin's route change did. -->
    <div v-if="subject" class="tp-detail">
      <button type="button" class="tp-btn tp-btn--ghost" @click="closeDetail">
        &larr; Back to lesson plans
      </button>

      <h3 class="tp-detail__title">{{ subject.topic || 'Untitled lesson plan' }}</h3>
      <p class="tp-detail__meta">
        {{ subject.subject }} &middot; {{ subject.className }} &middot; {{ weekLabel(subject) }}
      </p>

      <p v-if="subject.status === 'rejected' && subject.rejectionReason" class="tp-rejected" role="alert">
        {{ subject.rejectionReason }}
      </p>

      <!-- The origin renders a print-shaped document. This is the same document,
           reduced to the fields a teacher can edit. -->
      <dl class="tp-fields">
        <div><dt>Term</dt><dd>{{ subject.term || '—' }}</dd></div>
        <div><dt>Session</dt><dd>{{ subject.academicSessionId || '—' }}</dd></div>
        <div><dt>Sub-topic</dt><dd>{{ subject.subTopic || '—' }}</dd></div>
        <div><dt>Duration</dt><dd>{{ subject.duration || '—' }}</dd></div>
        <div><dt>Period</dt><dd>{{ subject.period || '—' }}</dd></div>
        <div><dt>Dates</dt><dd>{{ subject.startDate || '—' }} – {{ subject.endDate || '—' }}</dd></div>
      </dl>

      <template v-if="editing">
        <div class="tp-form">
          <label class="tp-field">
            <span class="tp-field__label">Topic</span>
            <input v-model="subject.topic" class="tp-input" placeholder="e.g. Fractions" />
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Sub-topic</span>
            <input v-model="subject.subTopic" class="tp-input" placeholder="e.g. Addition of fractions" />
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Subject</span>
            <input v-model="subject.subject" class="tp-input" />
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Class</span>
            <select v-model="subject.classId" class="tp-input" @change="onClassChange">
              <option value="">Select class</option>
              <option v-for="entry in classes" :key="entry.id" :value="entry.id">
                {{ entry.name }}
              </option>
            </select>
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Term</span>
            <input v-model="subject.term" class="tp-input" placeholder="e.g. First" />
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Week</span>
            <!-- The origin's only numeric constraint in this form. -->
            <input v-model.number="subject.week" class="tp-input" type="number" min="1" />
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Duration</span>
            <input v-model="subject.duration" class="tp-input" placeholder="e.g. 2HRS 20MINS" />
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Period</span>
            <input v-model="subject.period" class="tp-input" placeholder="e.g. 4TH PERIOD" />
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Start date</span>
            <input v-model="subject.startDate" class="tp-input" type="date" />
          </label>
          <label class="tp-field">
            <span class="tp-field__label">End date</span>
            <input v-model="subject.endDate" class="tp-input" type="date" />
          </label>
        </div>

        <label class="tp-field">
          <span class="tp-field__label">Objectives</span>
          <textarea v-model="subject.summary" class="tp-input tp-input--area" rows="4" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Instructional materials</span>
          <textarea v-model="subject.instructionalMaterials" class="tp-input tp-input--area" rows="3" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Remarks</span>
          <textarea v-model="subject.remarks" class="tp-input tp-input--area" rows="2" />
        </label>

        <p v-if="formError" class="tp-form__error" role="alert">{{ formError }}</p>

        <div class="tp-detail__actions">
          <button type="button" class="tp-btn tp-btn--ghost" :disabled="saving" @click="closeDetail">
            Cancel
          </button>
          <button type="button" class="tp-btn" :disabled="saving" @click="save('draft')">
            {{ saving ? 'Saving...' : 'Save Draft' }}
          </button>
          <button
            type="button"
            class="tp-btn tp-btn--primary"
            :disabled="saving"
            @click="save('pending')"
          >
            {{ saving ? 'Saving...' : 'Save & Submit' }}
          </button>
        </div>
      </template>

      <template v-else>
        <div class="tp-detail__actions">
          <TeacherStatusBadge
            :status="subject.status"
            :variant="badgeVariant(subject.status)"
          />
          <button
            v-if="subject.id && canUpdate(subject)"
            type="button"
            class="tp-btn"
            @click="editing = true"
          >
            Edit
          </button>
          <button
            v-if="subject.id && canDelete(subject)"
            type="button"
            class="tp-btn tp-btn--danger"
            @click="deleteTarget = subject"
          >
            Delete
          </button>
        </div>
      </template>
    </div>

    <div v-else class="tp-table-wrap">
      <table class="tp-table">
        <caption class="tp-table__caption">
          {{ visible.length }} lesson plan(s)
        </caption>
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
          <tr
            v-for="plan in visible"
            :key="plan.id"
            class="tp-row"
            tabindex="0"
            @click="open(plan)"
            @keydown.enter="open(plan)"
          >
            <td>{{ plan.subject }}</td>
            <td>{{ plan.teacherName }}</td>
            <td>{{ plan.className }}</td>
            <td>{{ plan.topic || '—' }}</td>
            <td>{{ weekLabel(plan) }}</td>
            <td>{{ dateLabel(plan.startDate) }}</td>
            <td>
              <TeacherStatusBadge :status="plan.status" :variant="badgeVariant(plan.status)" />
            </td>
            <td class="tp-table__actions">
              <button
                v-if="canUpdate(plan)"
                type="button"
                class="tp-btn tp-btn--ghost tp-btn--xs"
                @click.stop="open(plan); editing = true"
              >
                Edit
              </button>
              <button
                v-else
                type="button"
                class="tp-btn tp-btn--ghost tp-btn--xs"
                @click.stop="open(plan)"
              >
                View
              </button>
              <button
                v-if="canDelete(plan)"
                type="button"
                class="tp-btn tp-btn--ghost tp-btn--xs tp-btn--dangerish"
                @click.stop="deleteTarget = plan"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- The origin's delete confirmation, with its copy verbatim. -->
    <div v-if="deleteTarget" class="tp-modal" role="alertdialog" aria-label="Delete lesson plan?">
      <div class="tp-modal__box">
        <h4 class="tp-modal__title">Delete lesson plan?</h4>
        <p class="tp-modal__body">
          "{{ deleteTarget.topic }}" will be permanently deleted. This cannot be undone.
        </p>
        <div class="tp-modal__actions">
          <button type="button" class="tp-btn tp-btn--ghost" @click="deleteTarget = null">
            Cancel
          </button>
          <button type="button" class="tp-btn tp-btn--danger" :disabled="saving" @click="confirmDelete">
            {{ saving ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </TeacherModuleShell>
</template>

<style scoped>
@import './teacher-panel.css';

.tp-detail {
  border: 1px solid var(--laec-line, #d7dee8);
  border-radius: 12px;
  padding: 1.125rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: #fff;
}

.tp-detail__title {
  margin: 0;
  font-size: 1rem;
}

.tp-detail__meta {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted, #5b6472);
}

.tp-rejected {
  margin: 0;
  border: 1px solid #f0c8c8;
  background: #fdf3f3;
  color: #8f2a2a;
  border-radius: 8px;
  padding: 0.625rem 0.75rem;
  font-size: 0.8125rem;
}

.tp-detail__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}

.tp-form__error {
  margin: 0;
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
  margin: 0 0 0.5rem;
  font-size: 0.9375rem;
  color: #8f2a2a;
}

.tp-modal__body {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted, #5b6472);
}

.tp-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.125rem;
}
</style>