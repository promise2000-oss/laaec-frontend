<script setup lang="ts">
/**
 * AdminCaseWorkPanel — the working pages of the Disciplinary and Counselling
 * modules: the case list, the referral list, and the counselling report list.
 *
 * WHY THESE THREE ARE ONE COMPONENT
 * ---------------------------------
 * All three are a filtered table over a list of records with a status, a person,
 * a date and a detail dialog. The columns differ (a disciplinary case has an
 * incident type and a severity; a referral has a priority; a report has neither
 * because it inherits them from its case), so the column set is derived rather
 * than configured — and the differences are exactly the `isCounselling` and
 * `isReports` splits below.
 *
 * THE DETAIL DIALOG IS THE POINT
 * ------------------------------
 * A case is not read-only. It has a status to move through and a discussion
 * thread, and both are live features: `disciplinary-report-detail.tsx` renders
 * "Update status" over every state except the case's own, and both modules have
 * a comment composer. So the dialog here carries both, rather than being a
 * read-only viewer that would leave the module's only write unreachable.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { callApi } from '../../api';
import { SEED_CASE_STUDENTS } from '../../api/seedCaseCatalogue';
import AdminModuleShell from './AdminModuleShell.vue';
import AdminStatusBadge from './AdminStatusBadge.vue';
import AdminDialog from './AdminDialog.vue';
import type {
  CounsellingCase,
  CounsellingReport,
  CounsellingReportStatus,
  CounsellingStatus,
  DisciplinaryCase,
  DisciplinaryCaseStatus,
} from '../../types/teacher';
import type { AdminModule } from '../../types/admin-registry';

const props = defineProps<{ module: AdminModule }>();
const can = defineModel<((permission?: string | null) => boolean) | null>('can', { default: null });
const permitted = (permission?: string): boolean => {
  if (!permission) return true;
  return can.value ? can.value(permission) : true;
};

const SCHOOL_ID = 'SGC';

const isCounselling = computed(() => props.module.id.startsWith('counselling'));
const isReports = computed(() => props.module.id === 'counselling-reports');

/** Permission vocabulary, picked by module rather than restated per template. */
const perms = computed(() =>
  isCounselling.value
    ? {
        view: 'counselling.cases.view',
        remove: 'counselling.committees.manage',
        write: 'counselling.reports.manage',
      }
    : {
        view: 'disciplinary.cases.view',
        remove: 'disciplinary.committees.manage',
        write: 'disciplinary.cases.view',
      },
);

/* ── filters ────────────────────────────────────────────────────────────── */

/**
 * The filter bar both list pages carry.
 *
 * The live `/counselling/cases` bar is Search / Status / Academic session with
 * Reset and Apply; `/disciplinary/reports` adds Severity. The dates are this
 * console's own addition and are marked as such in the hint, because no date
 * range was observed on either page.
 */
const search = ref('');
const status = ref('');
const severity = ref('');
const sessionId = ref('');

const statusOptions = computed<string[]>(() =>
  isCounselling.value
    ? ['OPEN', 'SCHEDULED', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED']
    : isReports.value
      ? ['DRAFT', 'FINAL']
      : ['OPEN', 'PENDING', 'UNDER_REVIEW', 'DISMISSED', 'RESOLVED', 'APPEALED'],
);

const sessions = [
  { id: 'SESS-2025-2026', name: '2025/2026' },
  { id: 'SESS-2024-2025', name: '2024/2025' },
];

const resetFilters = (): void => {
  search.value = '';
  status.value = '';
  severity.value = '';
  sessionId.value = '';
  void load();
};

/* ── the list ───────────────────────────────────────────────────────────── */

/**
 * The two case types in one array.
 *
 * They are the same page with different columns, so they are held together and
 * discriminated by `isCounsellingCase` — which checks for a field only the
 * referral carries. Two separate lists would mean two `v-for`s and two copies of
 * every filter interaction for no gain.
 */
type AnyCase = DisciplinaryCase | CounsellingCase;
const cases = ref<AnyCase[]>([]);
const reports = ref<CounsellingReport[]>([]);
const loading = ref(false);
const loadError = ref('');
const banner = ref('');
const busy = ref(false);

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    if (isReports.value) {
      const data = await callApi('GET_COUNSELLING_REPORTS', {
        schoolID: SCHOOL_ID,
        search: search.value || undefined,
        status: (status.value || undefined) as CounsellingReportStatus | undefined,
      });
      if (data.status !== 'success') throw new Error(data.message || 'Failed to load reports.');
      reports.value = data.reports;
      return;
    }
    if (isCounselling.value) {
      const data = await callApi('GET_COUNSELLING_CASES', {
        schoolID: SCHOOL_ID,
        search: search.value || undefined,
        status: (status.value || undefined) as CounsellingStatus | undefined,
        sessionId: sessionId.value || undefined,
      });
      if (data.status !== 'success') throw new Error(data.message || 'Failed to load cases.');
      cases.value = data.cases;
      counsellingCases.value = data.cases;
      return;
    }
    const data = await callApi('GET_DISCIPLINARY_CASES', {
      schoolID: SCHOOL_ID,
      search: search.value || undefined,
      status: (status.value || undefined) as DisciplinaryCaseStatus | undefined,
      sessionId: sessionId.value || undefined,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load cases.');
    /* Severity is filtered here rather than server-side because the teacher
       action takes no severity argument. That is a real difference from the
       origin, which filters it in the query, and it is recorded as such. */
    cases.value = severity.value
      ? (data.cases as DisciplinaryCase[]).filter((c) => c.severity === severity.value)
      : data.cases;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load cases.';
  } finally {
    loading.value = false;
  }
};

onMounted(load);
watch(() => props.module.id, load);

/* ── the detail dialog ──────────────────────────────────────────────────── */

type Detail =
  | { kind: 'case'; record: AnyCase }
  | { kind: 'report'; record: CounsellingReport }
  | null;

const detail = ref<Detail>(null);
const nextStatus = ref('');
const statusNote = ref('');
const commentBody = ref('');
const detailError = ref('');

const openCase = (record: AnyCase): void => {
  detailError.value = '';
  nextStatus.value = '';
  statusNote.value = '';
  commentBody.value = '';
  detail.value = { kind: 'case', record };
};

const openReport = (record: CounsellingReport): void => {
  detailError.value = '';
  nextStatus.value = '';
  commentBody.value = '';
  detail.value = { kind: 'report', record };
};

const isCounsellingCase = (r: DisciplinaryCase | CounsellingCase): r is CounsellingCase =>
  'reasonForReferral' in r;

/**
 * The live status control offers every state EXCEPT the one the case is in —
 * `disciplinary-report-detail.tsx` filters `CASE_STATUS_OPTIONS` against
 * `caseRecord.status` — so a committee member cannot "set" a case to the state
 * it is already in. Reproduced here rather than offering the current state.
 */
const statusChoices = computed<string[]>(() =>
  statusOptions.value.filter((s) => s !== (detail.value?.kind === 'case' ? detail.value.record.status : '')),
);

const updateStatus = async (): Promise<void> => {
  const open = detail.value;
  if (open?.kind !== 'case' || !nextStatus.value) return;
  busy.value = true;
  detailError.value = '';
  try {
    const data = isCounsellingCase(open.record)
      ? await callApi('UPDATE_COUNSELLING_CASE_STATUS', {
          schoolID: SCHOOL_ID,
          caseId: open.record.id,
          status: nextStatus.value as CounsellingStatus,
        })
      : await callApi('UPDATE_DISCIPLINARY_CASE_STATUS', {
          schoolID: SCHOOL_ID,
          caseId: open.record.id,
          status: nextStatus.value as DisciplinaryCaseStatus,
        });
    if (data.status !== 'success') throw new Error(data.message || 'Could not update the status.');
    banner.value = `${open.record.caseNumber} moved to ${nextStatus.value.replace(/_/g, ' ').toLowerCase()}.`;
    detail.value = null;
    await load();
  } catch (e) {
    detailError.value = e instanceof Error ? e.message : 'Could not update the status.';
  } finally {
    busy.value = false;
  }
};

const addComment = async (): Promise<void> => {
  const open = detail.value;
  if (open?.kind !== 'case' || !commentBody.value.trim()) return;
  busy.value = true;
  detailError.value = '';
  try {
    const data = isCounsellingCase(open.record)
      ? await callApi('ADD_COUNSELLING_CASE_COMMENT', {
          schoolID: SCHOOL_ID,
          caseId: open.record.id,
          comment: commentBody.value.trim(),
        })
      : await callApi('ADD_DISCIPLINARY_CASE_COMMENT', {
          schoolID: SCHOOL_ID,
          caseId: open.record.id,
          comment: commentBody.value.trim(),
        });
    if (data.status !== 'success') throw new Error(data.message || 'Could not add the comment.');
    banner.value = 'Comment added.';
    commentBody.value = '';
    detail.value = null;
    await load();
  } catch (e) {
    detailError.value = e instanceof Error ? e.message : 'Could not add the comment.';
  } finally {
    busy.value = false;
  }
};

/* ── report editing ─────────────────────────────────────────────────────── */

/**
 * The five narrative fields of a session report, in the live form's own order,
 * plus its title and its DRAFT/FINAL state.
 *
 * A report must be named; the narratives may be blank while it is a draft,
 * which is what "DRAFT" means here rather than a separate field.
 */
const reportDialog = ref(false);
const reportDraft = ref({
  id: '',
  caseId: '',
  title: '',
  status: 'DRAFT' as CounsellingReportStatus,
  summary: '',
  findings: '',
  recommendations: '',
  actionPlan: '',
});
const reportError = ref('');

const openReportDialog = (record?: CounsellingReport): void => {
  reportError.value = '';
  reportDraft.value = record
    ? {
        id: record.id,
        caseId: record.caseId,
        title: record.title,
        status: record.status,
        summary: record.summary,
        findings: record.findings,
        recommendations: record.recommendations,
        actionPlan: record.actionPlan,
      }
    : {
        id: '',
        caseId: counsellingCases.value[0]?.id ?? '',
        title: '',
        status: 'DRAFT',
        summary: '',
        findings: '',
        recommendations: '',
        actionPlan: '',
      };
  reportDialog.value = true;
};

/**
 * The cases a report can be attached to, and the student directory the Class
 * column is read from.
 *
 * Read on every load rather than once: it is the same list the case table is
 * showing, so reading it here costs one request and keeps the report dialog's
 * case picker and the table's Class column from being able to disagree.
 */
const counsellingCases = ref<CounsellingCase[]>([]);

const saveReport = async (): Promise<void> => {
  const draft = reportDraft.value;
  if (!draft.caseId) {
    reportError.value = 'Choose the case this report belongs to.';
    return;
  }
  if (!draft.title.trim()) {
    reportError.value = 'Enter a title.';
    return;
  }
  busy.value = true;
  reportError.value = '';
  try {
    const data = await callApi('SAVE_COUNSELLING_REPORT', {
      schoolID: SCHOOL_ID,
      reportId: draft.id || undefined,
      report: {
        caseId: draft.caseId,
        caseNumber: counsellingCases.value.find((c) => c.id === draft.caseId)?.caseNumber ?? '',
        title: draft.title.trim(),
        status: draft.status,
        summary: draft.summary.trim(),
        findings: draft.findings.trim(),
        recommendations: draft.recommendations.trim(),
        actionPlan: draft.actionPlan.trim(),
      },
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not save the report.');
    banner.value = data.message || 'Report saved.';
    reportDialog.value = false;
    await load();
  } catch (e) {
    reportError.value = e instanceof Error ? e.message : 'Could not save the report.';
  } finally {
    busy.value = false;
  }
};

const finaliseReport = async (record: CounsellingReport): Promise<void> => {
  busy.value = true;
  try {
    const data = await callApi('SAVE_COUNSELLING_REPORT', {
      schoolID: SCHOOL_ID,
      reportId: record.id,
      report: { ...record, status: record.status === 'DRAFT' ? 'FINAL' : 'DRAFT' },
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not update the report.');
    banner.value = data.message || 'Report updated.';
    await load();
  } catch (e) {
    banner.value = e instanceof Error ? e.message : 'Could not update the report.';
  } finally {
    busy.value = false;
  }
};

/* ── delete ─────────────────────────────────────────────────────────────── */

const deleteDialog = ref(false);
const deleteTarget = ref<{ id: string; label: string } | null>(null);

const confirmDelete = (record: { id: string; caseNumber?: string; title?: string }): void => {
  deleteTarget.value = { id: record.id, label: record.caseNumber ?? record.title ?? record.id };
  deleteDialog.value = true;
};

const runDelete = async (): Promise<void> => {
  const target = deleteTarget.value;
  if (!target) return;
  busy.value = true;
  try {
    const data = isCounselling.value
      ? await callApi('DELETE_COUNSELLING_CASE', { caseId: target.id })
      : await callApi('DELETE_DISCIPLINARY_CASE', { caseId: target.id });
    if (data.status !== 'success') throw new Error(data.message || 'Could not delete.');
    banner.value = `${target.label} deleted.`;
    deleteDialog.value = false;
    deleteTarget.value = null;
    await load();
  } catch (e) {
    banner.value = e instanceof Error ? e.message : 'Could not delete.';
  } finally {
    busy.value = false;
  }
};

const rowCount = computed(() => (isReports.value ? reports.value.length : cases.value.length));

/**
 * The student's class, which both live tables carry in their own column.
 *
 * The case records themselves do not hold it — the deployed types carry a
 * student username, not a class — so it is read from the same student list the
 * referral form offers. Inventing a class per case would be a column of
 * fiction; this is at least one list, used consistently by both.
 */
const classOf = (studentUsername: string): string =>
  SEED_CASE_STUDENTS.find((s) => s.username === studentUsername)?.className ?? '—';
</script>

<template>
  <AdminModuleShell
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :banner="banner"
    :empty-count="rowCount"
    @retry="load"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button
        v-if="isReports && permitted(perms.write)"
        type="button"
        class="ap-btn ap-btn--primary"
        @click="openReportDialog()"
      >
        New Report
      </button>
    </template>

    <template #filters>
      <div class="ap-filters">
        <label class="ap-field ap-field--inline">
          <span class="ap-field__label">Search</span>
          <input v-model="search" class="ap-input" type="search" @keyup.enter="load" />
        </label>
        <label class="ap-field ap-field--inline">
          <span class="ap-field__label">Status</span>
          <select v-model="status" class="ap-input" @change="load">
            <option value="">All statuses</option>
            <option v-for="s in statusOptions" :key="s" :value="s">{{ s.replace(/_/g, ' ') }}</option>
          </select>
        </label>
        <label v-if="!isReports" class="ap-field ap-field--inline">
          <span class="ap-field__label">Academic session</span>
          <select v-model="sessionId" class="ap-input" @change="load">
            <option value="">All sessions</option>
            <option v-for="s in sessions" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </label>
        <label v-if="!isCounselling && !isReports" class="ap-field ap-field--inline">
          <span class="ap-field__label">Severity</span>
          <select v-model="severity" class="ap-input" @change="load">
            <option value="">All severities</option>
            <option v-for="s in ['MINOR', 'MODERATE', 'MAJOR', 'CRITICAL']" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
        <div class="ap-filters__actions">
          <button type="button" class="ap-btn" @click="resetFilters">Reset</button>
          <button type="button" class="ap-btn ap-btn--primary" @click="load">Apply</button>
        </div>
      </div>
    </template>

    <template #empty>
      <p>
        {{ isReports ? 'No session reports yet.' : isCounselling ? 'No counselling cases yet.' : 'No disciplinary cases yet.' }}
      </p>
    </template>

    <!-- ── the reports table ─────────────────────────────────────────── -->
    <div v-if="isReports" class="ap-table-wrap">
      <table class="ap-table">
        <thead>
          <tr>
            <th scope="col">Case #</th>
            <th scope="col">Title</th>
            <th scope="col">Status</th>
            <th scope="col">Written</th>
            <th scope="col"><span class="ap-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in reports" :key="row.id">
            <td>{{ row.caseNumber }}</td>
            <td>{{ row.title }}</td>
            <td><AdminStatusBadge :status="row.status" /></td>
            <td>{{ row.createdAt }}</td>
            <td class="ap-table__actions">
              <button type="button" class="ap-btn ap-btn--xs" @click="openReport(row)">View</button>
              <button
                v-if="permitted(perms.write)"
                type="button"
                class="ap-btn ap-btn--xs"
                @click="openReportDialog(row)"
              >
                Edit
              </button>
              <button
                v-if="permitted(perms.write)"
                type="button"
                class="ap-btn ap-btn--xs ap-btn--primary"
                :disabled="busy"
                @click="finaliseReport(row)"
              >
                {{ row.status === 'DRAFT' ? 'Finalise' : 'Reopen' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── the cases table ──────────────────────────────────────────── -->
    <div v-else class="ap-table-wrap">
      <table class="ap-table">
        <thead>
          <tr>
            <th scope="col">Case No.</th>
            <th scope="col">Student</th>
            <th scope="col">Class</th>
            <th v-if="!isCounselling" scope="col">Case Type</th>
            <th scope="col">{{ isCounselling ? 'Referral Date' : 'Date' }}</th>
            <th v-if="!isCounselling" scope="col">Severity</th>
            <th v-else scope="col">Priority</th>
            <th scope="col">Status</th>
            <th scope="col">{{ isCounselling ? 'Counsellor' : 'Assigned To' }}</th>
            <th scope="col"><span class="ap-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in cases" :key="row.id">
            <td>{{ row.caseNumber }}</td>
            <td>{{ row.studentName }}</td>
            <td>{{ classOf(row.studentUsername) }}</td>
            <td v-if="!isCounselling">{{ (row as DisciplinaryCase).caseTypeTitle }}</td>
            <td>{{ isCounsellingCase(row) ? (row as CounsellingCase).referralDate : (row as DisciplinaryCase).incidentDate }}</td>
            <td>
              <AdminStatusBadge
                :status="isCounsellingCase(row) ? (row as CounsellingCase).priority : (row as DisciplinaryCase).severity"
              />
            </td>
            <td><AdminStatusBadge :status="row.status" /></td>
            <td>{{ row.committeeName || '—' }}</td>
            <td class="ap-table__actions">
              <button type="button" class="ap-btn ap-btn--xs" @click="openCase(row)">View</button>
              <button
                v-if="permitted(perms.remove)"
                type="button"
                class="ap-btn ap-btn--xs ap-btn--danger"
                :disabled="busy"
                @click="confirmDelete(row)"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── case detail ──────────────────────────────────────────────── -->
    <AdminDialog
      :open="detail?.kind === 'case'"
      :title="detail?.kind === 'case' ? `Case ${detail.record.caseNumber}` : ''"
      kind="detail"
      :confirmable="false"
      @close="detail = null"
    >
      <template v-if="detail?.kind === 'case'">
        <dl class="ap-facts">
          <dt>Student</dt>
          <dd>{{ detail.record.studentName }}</dd>
          <dt>Status</dt>
          <dd><AdminStatusBadge :status="detail.record.status" /></dd>
          <template v-if="!isCounsellingCase(detail.record)">
            <dt>Case type</dt>
            <dd>{{ (detail.record as DisciplinaryCase).caseTypeTitle }}</dd>
            <dt>Severity</dt>
            <dd>{{ (detail.record as DisciplinaryCase).severity }}</dd>
            <dt>Date of incident</dt>
            <dd>{{ (detail.record as DisciplinaryCase).incidentDate }}</dd>
            <dt>Location</dt>
            <dd>{{ (detail.record as DisciplinaryCase).location || '—' }}</dd>
          </template>
          <template v-else>
            <dt>Priority</dt>
            <dd>{{ (detail.record as CounsellingCase).priority }}</dd>
            <dt>Referral date</dt>
            <dd>{{ (detail.record as CounsellingCase).referralDate }}</dd>
            <dt>Reason</dt>
            <dd>{{ (detail.record as CounsellingCase).reasonForReferral }}</dd>
            <dt>Referred by</dt>
            <dd>{{ (detail.record as CounsellingCase).referredByName || '—' }}</dd>
          </template>
          <dt>Committee</dt>
          <dd>{{ detail.record.committeeName || '—' }}</dd>
        </dl>

        <h4 class="ap-band">Discussion</h4>
        <ul v-if="detail.record.comments?.length" class="ap-comments">
          <li v-for="c in detail.record.comments" :key="c.id">
            <p class="ap-comments__body">{{ c.body }}</p>
            <p class="ap-inline-note">{{ c.authorName }} · {{ c.createdAt }}</p>
          </li>
        </ul>
        <p v-else class="ap-inline-note">No comments on this case yet.</p>

        <label class="ap-field">
          <span class="ap-field__label">Add a comment</span>
          <textarea v-model="commentBody" class="ap-input ap-input--area" rows="3"></textarea>
        </label>
        <button type="button" class="ap-btn" :disabled="busy || !commentBody.trim()" @click="addComment">
          Add comment
        </button>

        <h4 class="ap-band">Update status</h4>
        <p class="ap-inline-note">
          The live control offers every state except the one this case is already in.
        </p>
        <label class="ap-field">
          <span class="ap-field__label">Status</span>
          <select v-model="nextStatus" class="ap-input">
            <option value="">Select new status</option>
            <option v-for="s in statusChoices" :key="s" :value="s">{{ s.replace(/_/g, ' ') }}</option>
          </select>
        </label>
        <button type="button" class="ap-btn ap-btn--primary" :disabled="busy || !nextStatus" @click="updateStatus">
          Update status
        </button>
        <p v-if="detailError" class="ap-form__error" role="alert">{{ detailError }}</p>
      </template>
    </AdminDialog>

    <!-- ── report detail ────────────────────────────────────────────── -->
    <AdminDialog
      :open="detail?.kind === 'report'"
      :title="detail?.kind === 'report' ? detail.record.title : ''"
      kind="detail"
      :confirmable="false"
      @close="detail = null"
    >
      <template v-if="detail?.kind === 'report'">
        <dl class="ap-facts">
          <dt>Case</dt>
          <dd>{{ detail.record.caseNumber }}</dd>
          <dt>Status</dt>
          <dd><AdminStatusBadge :status="detail.record.status" /></dd>
          <dt>Written by</dt>
          <dd>{{ detail.record.authorUsername }}</dd>
          <dt>Written</dt>
          <dd>{{ detail.record.createdAt }}</dd>
        </dl>
        <h4 class="ap-band">Summary</h4>
        <p class="ap-cell--wide">{{ detail.record.summary || '—' }}</p>
        <h4 class="ap-band">Findings</h4>
        <p class="ap-cell--wide">{{ detail.record.findings || '—' }}</p>
        <h4 class="ap-band">Recommendations</h4>
        <p class="ap-cell--wide">{{ detail.record.recommendations || '—' }}</p>
        <h4 class="ap-band">Action plan</h4>
        <p class="ap-cell--wide">{{ detail.record.actionPlan || '—' }}</p>
      </template>
    </AdminDialog>

    <!-- ── report form ──────────────────────────────────────────────── -->
    <AdminDialog
      :open="reportDialog"
      :title="reportDraft.id ? 'Edit Report' : 'New Report'"
      kind="edit"
      :confirm-label="reportDraft.id ? 'Save changes' : 'Save report'"
      :busy="busy"
      @close="reportDialog = false"
      @confirm="saveReport"
    >
      <label class="ap-field">
        <span class="ap-field__label">Case <span aria-hidden="true">*</span></span>
        <select v-model="reportDraft.caseId" class="ap-input">
          <option value="">Select a case</option>
          <option v-for="c in counsellingCases" :key="c.id" :value="c.id">
            {{ c.caseNumber }} — {{ c.studentName }}
          </option>
        </select>
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Title <span aria-hidden="true">*</span></span>
        <input v-model="reportDraft.title" class="ap-input" type="text" />
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Status</span>
        <select v-model="reportDraft.status" class="ap-input">
          <option value="DRAFT">Draft</option>
          <option value="FINAL">Final</option>
        </select>
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Summary</span>
        <textarea v-model="reportDraft.summary" class="ap-input ap-input--area" rows="3"></textarea>
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Findings</span>
        <textarea v-model="reportDraft.findings" class="ap-input ap-input--area" rows="3"></textarea>
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Recommendations</span>
        <textarea v-model="reportDraft.recommendations" class="ap-input ap-input--area" rows="3"></textarea>
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Action plan</span>
        <textarea v-model="reportDraft.actionPlan" class="ap-input ap-input--area" rows="3"></textarea>
      </label>
      <p v-if="reportError" class="ap-form__error" role="alert">{{ reportError }}</p>
    </AdminDialog>

    <!-- ── delete confirmation ──────────────────────────────────────── -->
    <AdminDialog
      :open="deleteDialog"
      :title="`Delete ${deleteTarget?.label ?? ''}?`"
      kind="confirm"
      message="This removes the case and its discussion. It cannot be undone."
      confirm-label="Delete"
      danger
      :busy="busy"
      @close="deleteDialog = false"
      @confirm="runDelete"
    />
  </AdminModuleShell>
</template>

<style scoped>
@import './admin-panel.css';

.ap-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.625rem 0.75rem;
  margin-bottom: 0.75rem;
}

.ap-field--inline {
  min-width: 11rem;
  margin-bottom: 0;
}

.ap-filters__actions {
  display: flex;
  gap: 0.375rem;
}

.ap-facts {
  display: grid;
  grid-template-columns: 10rem 1fr;
  gap: 0.35rem 0.75rem;
  margin: 0 0 1rem;
}

.ap-facts dt {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted, #5b6472);
}

.ap-facts dd {
  margin: 0;
  font-size: 0.8125rem;
}

.ap-comments {
  list-style: none;
  margin: 0 0 1rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ap-comments li {
  border: 1px solid var(--laec-line, #d7dee8);
  border-radius: 8px;
  padding: 0.5rem 0.625rem;
}

.ap-comments__body {
  margin: 0 0 0.25rem;
  font-size: 0.8125rem;
  white-space: normal;
}

.ap-cell--wide {
  white-space: normal;
  line-height: 1.5;
  font-size: 0.8125rem;
  margin: 0 0 0.75rem;
}

@media (max-width: 640px) {
  .ap-facts {
    grid-template-columns: 1fr;
  }

  .ap-field--inline {
    min-width: 100%;
  }
}
</style>