<script setup lang="ts">
/**
 * Weekly Report panel (D-72) — the origin's 6 routes collapsed into one.
 *
 * Origin routes folded in: `/teacher/weekly-report`, `/create`, `/[id]`,
 * `/[id]/edit`, and `/manage` (the Review Reports queue, which the origin's nav
 * gates on `weekly-reports.review`).
 *
 * THE ONE VALIDATION DIFFERENCE WORTH NAMING
 * -------------------------------------------
 * The lesson-plan form validates only when saving to `pending`, so a draft may
 * be saved empty. The weekly-report form validates on **every** save, draft
 * included. That asymmetry is the origin's and is reproduced here: `saveDraft`
 * refuses an empty report, and says exactly which of the four fields the origin
 * names — `Week of report is required`, `Term & session is required`,
 * `Subject is required`, `Class / Arm is required`.
 *
 * The review form's required comment is likewise the origin's: a H.O.D or Head
 * Teacher review cannot be submitted empty, and the message is
 * `Please enter a comment before submitting your review.` A lesson-plan
 * rejection, by contrast, takes an optional remark.
 *
 * The five numbered checklist sections are reproduced with the origin's banners
 * and the four seeded rows per section, and the store trims and drops empty
 * unticked rows on save.
 */
import { computed, onMounted, ref } from 'vue';
import { callApi } from '../../api';
import { useTeacherSession } from './useTeacherSession';
import TeacherModuleShell from './TeacherModuleShell.vue';
import TeacherStatusBadge from './TeacherStatusBadge.vue';
import type { WeeklyChecklistItem, WeeklyReport, WeeklyReportStatus } from '../../types/teacher';

/** The origin's banner order, verbatim. */
interface Section {
  key:
    | 'participationItems'
    | 'classroomItems'
    | 'assignmentItems'
    | 'challengeItems'
    | 'recommendationItems';
  banner: string;
  commentKey:
    | 'additionalObservations'
    | 'comments'
    | 'notes'
    | 'otherChallenges'
    | 'furtherRecommendations';
  commentLabel: string;
  placeholder: string;
}

const SECTIONS: readonly Section[] = [
  {
    key: 'participationItems',
    banner: "1. STUDENTS' PARTICIPATION AND PERFORMANCE",
    commentKey: 'additionalObservations',
    commentLabel: 'ADDITIONAL OBSERVATIONS',
    placeholder: "Any additional observations about students' participation...",
  },
  {
    key: 'classroomItems',
    banner: '2. CLASSROOM MANAGEMENT',
    commentKey: 'comments',
    commentLabel: 'COMMENTS',
    placeholder: 'Comments on classroom management...',
  },
  {
    key: 'assignmentItems',
    banner: '3. ASSIGNMENTS AND ASSESSMENTS',
    commentKey: 'notes',
    commentLabel: 'NOTES',
    placeholder: 'Notes on assignments and assessments...',
  },
  {
    key: 'challengeItems',
    banner: '4. CHALLENGES ENCOUNTERED IN CLASS',
    commentKey: 'otherChallenges',
    commentLabel: 'OTHER CHALLENGES',
    placeholder: 'Any other challenges encountered...',
  },
  {
    key: 'recommendationItems',
    banner: '5. RECOMMENDATIONS',
    commentKey: 'furtherRecommendations',
    commentLabel: 'FURTHER RECOMMENDATIONS',
    placeholder: 'Further recommendations...',
  },
];

const TABS: ReadonlyArray<{ id: WeeklyReportStatus | 'all'; label: string }> = [
  { id: 'all', label: 'My Reports' },
  { id: 'draft', label: 'Drafts' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'reviewed', label: 'Reviewed' },
];

const QUEUE_TABS: ReadonlyArray<{ id: 'all' | WeeklyReportStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'reviewed', label: 'Reviewed' },
];

const session = useTeacherSession();

const reports = ref<WeeklyReport[]>([]);
const loading = ref(false);
const loadError = ref('');
const banner = ref('');
const tab = ref<WeeklyReportStatus | 'all'>('draft');

/* `queue` is the origin's /manage view. */
const inQueue = ref(false);
const queue = ref<WeeklyReport[]>([]);
const queueSearch = ref('');
const queueStatus = ref<'all' | WeeklyReportStatus>('submitted');

const openId = ref('');
const editing = ref(false);
const saving = ref(false);
const formError = ref('');
const reviewError = ref('');
const reviewComment = ref('');
const reviewLevel = ref<'hod' | 'head'>('hod');

/* The id of the report under review, or '' for none. */
const reviewing = ref('');

const openReport = computed(() => reports.value.find((r) => r.id === openId.value) ?? null);
/* The report under review. `reviewing` holds its id, which is what lets the
   queue refetch underneath the open dialog without the dialog losing its
   subject. */
const reviewingReport = computed(
  () => reports.value.find((r) => r.id === reviewing.value) ?? queue.value.find((r) => r.id === reviewing.value) ?? null,
);

const visible = computed(() =>
  tab.value === 'all' ? reports.value : reports.value.filter((r) => r.status === tab.value),
);

const canEdit = (report: WeeklyReport): boolean =>
  report.teacherUsername === session.username() && report.status !== 'reviewed';
const canDelete = (report: WeeklyReport): boolean =>
  report.teacherUsername === session.username() && report.status === 'draft';

const badgeVariant = (status: WeeklyReportStatus): 'default' | 'secondary' | 'outline' => {
  if (status === 'reviewed') return 'default';
  if (status === 'submitted') return 'secondary';
  return 'outline';
};

const emptyRow = (): WeeklyChecklistItem => ({ text: '', checked: false });

const blank = (): WeeklyReport => ({
  id: '',
  teacherUsername: session.username(),
  teacherName: session.teacherName(),
  weekOfReport: '',
  reportDate: new Date().toISOString().slice(0, 10),
  termSession: '',
  subject: '',
  classAndArm: '',
  topicCovered: '',
  topicUncovered: '',
  reasons: '',
  participationItems: Array.from({ length: 4 }, emptyRow),
  classroomItems: Array.from({ length: 4 }, emptyRow),
  assignmentItems: Array.from({ length: 4 }, emptyRow),
  challengeItems: Array.from({ length: 4 }, emptyRow),
  recommendationItems: Array.from({ length: 4 }, emptyRow),
  additionalObservations: '',
  comments: '',
  notes: '',
  otherChallenges: '',
  furtherRecommendations: '',
  conclusion: '',
  status: 'draft',
  hodComment: '',
  hodReviewedBy: '',
  hodReviewedAt: '',
  headComment: '',
  headReviewedBy: '',
  headReviewedAt: '',
  signature: '',
  signatureStyle: 'vibes',
});

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_WEEKLY_REPORTS', {
      schoolID: session.schoolID(),
      teacherUsername: session.username(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load weekly reports.');
    reports.value = data.reports;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load weekly reports.';
  } finally {
    loading.value = false;
  }
};

const loadQueue = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_WEEKLY_REPORT_QUEUE', {
      schoolID: session.schoolID(),
      reviewerUsername: session.username(),
      status: queueStatus.value === 'all' ? undefined : queueStatus.value,
      search: queueSearch.value || undefined,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load weekly reports.');
    queue.value = data.reports;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load weekly reports.';
  } finally {
    loading.value = false;
  }
};

const openReportDetail = (report: WeeklyReport): void => {
  openId.value = report.id;
  editing.value = false;
  formError.value = '';
};

const startEdit = (report: WeeklyReport): void => {
  openId.value = report.id;
  editing.value = canEdit(report);
  formError.value = '';
};

const startCreate = (): void => {
  openId.value = '';
  editing.value = true;
  formError.value = '';
  /* Held outside `reports` until saved, so a cancelled new report leaves no row. */
  draft.value = blank();
};

const draft = ref<WeeklyReport | null>(null);

/** The record being edited: the new draft, or the open stored report. */
const editing_report = computed<WeeklyReport | null>(() => draft.value ?? openReport.value);

const addRow = (section: Section): void => {
  const target = editing_report.value;
  if (!target) return;
  target[section.key] = [...target[section.key], emptyRow()];
};

const removeRow = (section: Section, index: number): void => {
  const target = editing_report.value;
  if (!target) return;
  target[section.key] = target[section.key].filter((_, i) => i !== index);
};

const discardDraft = (): void => {
  draft.value = null;
  openId.value = '';
  editing.value = false;
  formError.value = '';
};

const save = async (status: 'draft' | 'submitted'): Promise<void> => {
  const report = editing_report.value;
  if (!report) return;
  saving.value = true;
  formError.value = '';
  try {
    const data = await callApi('SAVE_WEEKLY_REPORT', {
      schoolID: session.schoolID(),
      reportId: report.id || undefined,
      // The store owns the H.O.D comment fields, so the body is sent without them.
      report: (({ hodComment, hodReviewedBy, hodReviewedAt, ...body }) => body)(report),
      status,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not save this weekly report.');
    banner.value =
      status === 'draft' ? 'Weekly report saved as a draft.' : 'Weekly report submitted for review.';
    discardDraft();
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Could not save this weekly report.';
  } finally {
    saving.value = false;
  }
};

const submitReview = async (report: WeeklyReport): Promise<void> => {
  saving.value = true;
  reviewError.value = '';
  try {
    const data = await callApi('REVIEW_WEEKLY_REPORT', {
      schoolID: session.schoolID(),
      reportId: report.id,
      level: reviewLevel.value,
      comment: reviewComment.value,
      signature: session.teacherName(),
    });
    if (data.status !== 'success') {
      throw new Error(data.message || 'Failed to review this weekly report.');
    }
    banner.value =
      reviewLevel.value === 'head' ? 'Weekly report approved and finalized.' : "H.O.D comment recorded.";
    reviewComment.value = '';
    reviewing.value = '';
    await loadQueue();
    await load();
  } catch (e) {
    reviewError.value = e instanceof Error ? e.message : 'Failed to review this weekly report.';
  } finally {
    saving.value = false;
  }
};

/** The origin's two review placeholders, verbatim per level. */
const reviewPlaceholder = computed(() =>
  reviewLevel.value === 'hod'
    ? "H.O.D's comment on this report..."
    : "Head Teacher's comment on this report...",
);

const openReview = (report: WeeklyReport): void => {
  reviewing.value = report.id;
  // The origin pre-selects Head Teacher's level when a head comment already exists.
  reviewLevel.value = report.headComment ? 'head' : 'hod';
  reviewComment.value = '';
  reviewError.value = '';
};

onMounted(load);
</script>

<template>
  <TeacherModuleShell
    :title="inQueue ? 'Review Reports' : 'Weekly Report'"
    :description="
      inQueue
        ? 'Weekly teaching activities reports submitted to you for review'
        : 'Weekly Teaching Activities Report — record the week and submit it for review'
    "
    :loading="loading"
    :error="loadError"
    :empty-count="inQueue ? queue.length : reports.length"
    @retry="inQueue ? loadQueue() : load()"
    :banner="banner"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button type="button" class="tp-btn tp-btn--ghost" @click="inQueue = !inQueue; inQueue ? loadQueue() : load()">
        {{ inQueue ? 'My Reports' : 'Review Reports' }}
      </button>
      <button v-if="!inQueue" type="button" class="tp-btn tp-btn--primary" @click="startCreate">
        Create Report
      </button>
    </template>

    <template #filters>
      <template v-if="inQueue">
        <div class="tp-toolbar">
          <div class="tp-tabs" role="tablist" aria-label="Report status">
            <button
              v-for="entry in QUEUE_TABS"
              :key="entry.id"
              type="button"
              role="tab"
              class="tp-tab"
              :class="{ 'tp-tab--on': queueStatus === entry.id }"
              @click="queueStatus = entry.id; loadQueue()"
            >
              {{ entry.label }}
            </button>
          </div>
          <input
            v-model="queueSearch"
            class="tp-input tp-toolbar__search"
            type="search"
            placeholder="Search by subject, class or teacher..."
            @keyup.enter="loadQueue"
          />
          <button type="button" class="tp-btn" @click="loadQueue">Search</button>
        </div>
      </template>
      <div v-else class="tp-tabs" role="tablist" aria-label="Report status">
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
      <p v-if="inQueue">No weekly reports match this filter.</p>
      <template v-else>
        <p v-if="tab === 'all'">No weekly reports yet.</p>
        <p v-else>No weekly reports with status "{{ tab }}" yet.</p>
        <button type="button" class="tp-btn tp-btn--primary tp-empty__cta" @click="startCreate">
          Create a weekly report
        </button>
      </template>
    </template>

    <div v-if="editing && editing_report" class="tp-card">
      <h3 class="tp-card__title">{{ editing_report.id ? 'Edit weekly report' : 'New weekly report' }}</h3>

      <div class="tp-form">
        <label class="tp-field">
          <span class="tp-field__label">Week of Report</span>
          <input v-model="editing_report.weekOfReport" class="tp-input" placeholder="e.g. Week 1" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Date</span>
          <input v-model="editing_report.reportDate" class="tp-input" type="date" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Term &amp; Session</span>
          <input v-model="editing_report.termSession" class="tp-input" placeholder="e.g. First Term, 2025/2026" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Teacher's Name</span>
          <input class="tp-input" :value="editing_report.teacherName" readonly />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Subject</span>
          <input v-model="editing_report.subject" class="tp-input" placeholder="e.g. Mathematics" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Class / Arm(s)</span>
          <input v-model="editing_report.classAndArm" class="tp-input" placeholder="e.g. SS1 A &amp; B" />
        </label>
      </div>

      <label class="tp-field">
        <span class="tp-field__label">Topic Covered</span>
        <input v-model="editing_report.topicCovered" class="tp-input" placeholder="Topic covered for the week" />
      </label>
      <label class="tp-field">
        <span class="tp-field__label">Topic Uncovered</span>
        <input
          v-model="editing_report.topicUncovered"
          class="tp-input"
          placeholder="Topic / sub-topic not covered for the week"
        />
      </label>
      <label class="tp-field">
        <span class="tp-field__label">Reasons</span>
        <input v-model="editing_report.reasons" class="tp-input" placeholder="Reasons for any topic not covered" />
      </label>

      <template v-for="section in SECTIONS" :key="section.key">
        <h4 class="tp-band">{{ section.banner }}</h4>
        <div class="tp-checklist">
          <label v-for="(row, index) in editing_report[section.key]" :key="index" class="tp-check">
            <input v-model="row.checked" type="checkbox" />
            <input v-model="row.text" class="tp-input" type="text" placeholder="Type the item to tick" />
            <button
              type="button"
              class="tp-btn tp-btn--ghost tp-btn--xs"
              :aria-label="`Remove item ${index + 1}`"
              @click="removeRow(section, index)"
            >
              &times;
            </button>
          </label>
        </div>
        <button type="button" class="tp-btn tp-btn--xs" @click="addRow(section)">Add Item</button>

        <label class="tp-field">
          <span class="tp-field__label">{{ section.commentLabel }}</span>
          <textarea
            v-model="editing_report[section.commentKey]"
            class="tp-input tp-input--area"
            rows="2"
            :placeholder="section.placeholder"
          />
        </label>
      </template>

      <h4 class="tp-band">6. CONCLUSION</h4>
      <label class="tp-field">
        <span class="tp-field__label">Concluding remarks on the week's teaching activities</span>
        <textarea v-model="editing_report.conclusion" class="tp-input tp-input--area" rows="3" />
      </label>

      <p v-if="formError" class="tp-form__error" role="alert">{{ formError }}</p>

      <div class="tp-detail__actions">
        <button type="button" class="tp-btn tp-btn--ghost" :disabled="saving" @click="discardDraft">
          Cancel
        </button>
        <button type="button" class="tp-btn" :disabled="saving" @click="save('draft')">
          {{ saving ? 'Saving...' : 'Save Draft' }}
        </button>
        <button type="button" class="tp-btn tp-btn--primary" :disabled="saving" @click="save('submitted')">
          {{ saving ? 'Saving...' : 'Save & Submit' }}
        </button>
      </div>
    </div>

    <div v-else-if="openReport" class="tp-card">
      <button type="button" class="tp-btn tp-btn--ghost" @click="openId = ''">
        &larr; Back to weekly reports
      </button>
      <h3 class="tp-card__title">{{ openReport.subject }} — {{ openReport.weekOfReport }}</h3>
      <p class="tp-inline-note">
        {{ openReport.classAndArm }} &middot; {{ openReport.termSession }}
      </p>
      <dl class="tp-fields">
        <div><dt>Topic covered</dt><dd>{{ openReport.topicCovered || '—' }}</dd></div>
        <div><dt>Topic uncovered</dt><dd>{{ openReport.topicUncovered || '—' }}</dd></div>
        <div><dt>Reasons</dt><dd>{{ openReport.reasons || '—' }}</dd></div>
        <div><dt>Status</dt><dd>{{ openReport.status }}</dd></div>
      </dl>
      <div v-if="openReport.hodComment" class="tp-rejected">
        <strong>H.O.D's comment:</strong> {{ openReport.hodComment }}
      </div>
      <div v-if="openReport.headComment" class="tp-rejected">
        <strong>Head Teacher's comment:</strong> {{ openReport.headComment }}
      </div>
      <div class="tp-detail__actions">
        <button v-if="canEdit(openReport)" type="button" class="tp-btn" @click="editing = true">
          Edit
        </button>
        <button
          v-if="canDelete(openReport)"
          type="button"
          class="tp-btn tp-btn--ghost tp-btn--dangerish"
          @click="
            callApi('DELETE_WEEKLY_REPORT', { schoolID: session.schoolID(), reportId: openReport.id }).then(
              (r) => {
                banner = r.message || 'Weekly report deleted successfully';
                openId = '';
                load();
              },
            )
          "
        >
          Delete
        </button>
      </div>
    </div>

    <!-- The queue is a list of cards, not a table: the origin's manage view has
         no table markup, only a filter bar and one Review/View button per
         report. The author's own list IS a table, and its columns are the
         origin's: Subject, Class / Arm, Week, Date, Status, Actions. -->
    <div v-else-if="inQueue" class="tp-queue">
      <article v-for="report in queue" :key="report.id" class="tp-card">
        <h3 class="tp-card__title">{{ report.subject }}</h3>
        <p class="tp-inline-note">
          {{ report.classAndArm }} &middot; {{ report.weekOfReport }} &middot; {{ report.teacherName }}
        </p>
        <div class="tp-detail__actions">
          <TeacherStatusBadge :status="report.status" :variant="badgeVariant(report.status)" />
          <button
            type="button"
            class="tp-btn tp-btn--xs"
            @click="report.status === 'submitted' ? openReview(report) : openReportDetail(report)"
          >
            {{ report.status === 'submitted' ? 'Review' : 'View' }}
          </button>
        </div>
      </article>
    </div>

    <div v-else class="tp-table-wrap">
      <table class="tp-table">
        <caption class="tp-table__caption">{{ visible.length }} weekly report(s)</caption>
        <thead>
          <tr>
            <th scope="col">Subject</th>
            <th scope="col">Class / Arm</th>
            <th scope="col">Week</th>
            <th scope="col">Date</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="tp-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="report in visible"
            :key="report.id"
            class="tp-row"
            tabindex="0"
            @click="openReportDetail(report)"
            @keydown.enter="openReportDetail(report)"
          >
            <td>{{ report.subject }}</td>
            <td>{{ report.classAndArm }}</td>
            <td>{{ report.weekOfReport }}</td>
            <td>{{ report.reportDate || '—' }}</td>
            <td>
              <TeacherStatusBadge :status="report.status" :variant="badgeVariant(report.status)" />
            </td>
            <td class="tp-table__actions">
              <button
                type="button"
                class="tp-btn tp-btn--ghost tp-btn--xs"
                @click.stop="openReportDetail(report)"
              >
                View
              </button>
              <button
                v-if="canEdit(report)"
                type="button"
                class="tp-btn tp-btn--ghost tp-btn--xs"
                @click.stop="startEdit(report)"
              >
                Edit
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="reviewing" class="tp-modal" role="alertdialog" aria-label="Review weekly report">
      <div class="tp-modal__box">
        <h4 class="tp-modal__title">Review weekly report</h4>
        <p class="tp-modal__body">
          {{ reviewingReport?.subject }} — {{ reviewingReport?.classAndArm }}
        </p>

        <div class="tp-tabs">
          <button
            type="button"
            class="tp-tab"
            :class="{ 'tp-tab--on': reviewLevel === 'hod' }"
            @click="reviewLevel = 'hod'"
          >
            H.O.D's Comment
          </button>
          <button
            type="button"
            class="tp-tab"
            :class="{ 'tp-tab--on': reviewLevel === 'head' }"
            @click="reviewLevel = 'head'"
          >
            Head Teacher's Comment
          </button>
        </div>

        <label class="tp-field">
          <span class="tp-field__label">Comment</span>
          <textarea
            v-model="reviewComment"
            class="tp-input tp-input--area"
            rows="3"
            :placeholder="reviewPlaceholder"
          />
        </label>

        <p v-if="reviewError" class="tp-form__error" role="alert">{{ reviewError }}</p>

        <div class="tp-modal__actions">
          <button type="button" class="tp-btn tp-btn--ghost" @click="reviewing = ''">Cancel</button>
          <button
            type="button"
            class="tp-btn tp-btn--primary"
            :disabled="saving"
            @click="reviewingReport && submitReview(reviewingReport)"
          >
            {{ saving ? 'Submitting review...' : reviewLevel === 'head' ? 'Approve & Finalize' : 'Submit H.O.D Comment' }}
          </button>
        </div>
      </div>
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

.tp-rejected {
  margin-top: 0.5rem;
  border: 1px solid var(--laec-line, #d7dee8);
  background: #f7f9fc;
  border-radius: 8px;
  padding: 0.625rem 0.75rem;
  font-size: 0.8125rem;
}

/* The queue renders one card per row rather than a table row, because the
   origin's manage view has no table markup at all — only a filter bar and a
   list of reports with a single Review/View button. */
.tp-row-wrap {
  border-bottom: 1px solid var(--laec-line, #d7dee8);
  padding: 0.875rem;
}

.tp-cellblock {
  display: grid;
  gap: 0.25rem;
  font-size: 0.8125rem;
  justify-items: start;
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
  width: min(92%, 480px);
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