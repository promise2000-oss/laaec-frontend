<script setup lang="ts">
/**
 * Guidance & Counselling panel (D-72) — the origin's 6 routes collapsed.
 *
 * Origin routes folded in: `/counselling/book-session`, `/counselling/cases`,
 * `/counselling/cases/[id]`, `/counselling/committee`, `/counselling/reports`,
 * `/counselling/reports/[id]` and `/counselling/report`. The nav item groups
 * them under one expandable parent, and here they are four sub-views behind one
 * rail entry: Cases, Book a session, Committees, Reports.
 *
 * THE PERMISSION GATE THAT IS FAITHFUL HERE
 * -----------------------------------------
 * `/counselling/report` is the only counselling page in the origin with an
 * explicit guard:
 * `hasPermission(permissions, "counselling.reports.manage") || isAdminLike(roles)`
 * and otherwise renders `EmptyMessage "You do not have permission to create
 * counselling reports."`. That message is reproduced verbatim behind
 * `canCreateReport`.
 *
 * THE SILENT-RETURN THAT IS ALSO FAITHFUL
 * ----------------------------------------
 * `BookSessionPage.handleSubmit` has **no** validate function. It early-returns
 * when the student or the reason is missing, silently — no message, no field
 * marking. This panel reproduces the silent return rather than inventing the
 * error text a reader would expect, and says so here because a silent failure is
 * indistinguishable from a broken button.
 *
 * The case-typeahead convention is also the origin's: searches require at least
 * two non-space characters, and a single result is selected automatically.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { callApi } from '../../api';
import { hasPermission } from '../../lib/permissions';
import { useTeacherSession } from './useTeacherSession';
import TeacherModuleShell from './TeacherModuleShell.vue';
import TeacherStatusBadge from './TeacherStatusBadge.vue';
import type {
  CounsellingCase,
  CounsellingCommittee,
  CounsellingPriority,
  CounsellingReport,
  CounsellingReportStatus,
  CounsellingStatus,
} from '../../types/teacher';

type View = 'cases' | 'book' | 'committees' | 'reports';

const session = useTeacherSession();

const view = ref<View>('cases');
const banner = ref('');

/** The four sub-views behind this one rail entry, in the origin's nav order. */
const VIEWS: ReadonlyArray<{ id: View; label: string }> = [
  { id: 'cases', label: 'View Cases' },
  { id: 'book', label: 'Book Session' },
  { id: 'committees', label: 'Committee' },
  { id: 'reports', label: 'Reports' },
];

/* ── cases ─────────────────────────────────────────────────────────────── */

const cases = ref<CounsellingCase[]>([]);
const caseSearch = ref('');
const caseStatus = ref<CounsellingStatus | ''>('');
const loading = ref(false);
const loadError = ref('');
const openCaseId = ref('');
const caseComment = ref('');
const busy = ref(false);

const COUNSELLING_STATUSES: readonly CounsellingStatus[] = [
  'OPEN',
  'SCHEDULED',
  'IN_PROGRESS',
  'PENDING',
  'RESOLVED',
  'CLOSED',
];

const openCase = computed(() => cases.value.find((c) => c.id === openCaseId.value) ?? null);

const caseBadge = (status: CounsellingStatus): 'default' | 'secondary' | 'outline' | 'destructive' => {
  if (status === 'RESOLVED' || status === 'CLOSED') return 'default';
  if (status === 'OPEN') return 'destructive';
  return 'secondary';
};

/* ── book a session ────────────────────────────────────────────────────── */

const committees = ref<CounsellingCommittee[]>([]);
const activeCommittees = computed(() => committees.value.filter((c) => c.isActive));

const bookStudent = ref('');
const studentResults = ref<Array<{ name: string; username: string }>>([]);
const studentPicked = ref<{ name: string; username: string } | null>(null);
const studentSearching = ref(false);

const bookForm = ref({
  referredByName: '',
  referralDate: new Date().toISOString().slice(0, 10),
  priority: 'NORMAL' as CounsellingPriority,
  committeeId: '',
  reasonForReferral: '',
  backgroundInfo: '',
  initialComment: '',
});

const bookedCase = ref<CounsellingCase | null>(null);

const PRIORITIES: readonly CounsellingPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

/* ── committees ────────────────────────────────────────────────────────── */

const committeeName = ref('');
const committeeDescription = ref('');
const committeeError = ref('');

const canManageCommittees = computed(() => can('counselling.committees.manage'));
const managesCommittees = (): boolean => canManageCommittees.value;

/* ── reports ───────────────────────────────────────────────────────────── */

const reports = ref<CounsellingReport[]>([]);
const reportStatus = ref<CounsellingReportStatus | ''>('');
const canCreateReport = computed(() => can('counselling.reports.manage'));
const reportForm = ref({
  caseId: '',
  title: '',
  status: 'DRAFT' as CounsellingReportStatus,
  summary: '',
  findings: '',
  recommendations: '',
  actionPlan: '',
});
const reportError = ref('');

/**
 * The origin's gate is `hasPermission(...) || isAdminLike(roles)`. LAEC has no
 * `isAdminLike` escape — `bypassesPermissions` returns false for every claim by
 * design (see `lib/permissions.ts`) — so only the permission is consulted here.
 * The consequence is recorded in docs/teacher-portal/permissions.md §4.
 */
const permissions = ref<string[]>([]);
const can = (code: string): boolean => hasPermission(permissions.value, code);

/* ── the origin's two-character typeahead rule ──────────────────────────── */

const MIN_SEARCH = 2;
let studentTimer: ReturnType<typeof setTimeout> | undefined;
let studentSeq = 0;

const searchStudents = async (needle: string): Promise<void> => {
  const token = ++studentSeq;
  if (needle.trim().length < MIN_SEARCH) {
    studentResults.value = [];
    studentSearching.value = false;
    return;
  }
  studentSearching.value = true;
  try {
    // The origin's student typeahead resolves against the student directory; the
    // mock serves the same directory shape, so the search runs through it.
    const data = await callApi('GET_TEACHER_DIRECTORY', {
      schoolID: session.schoolID(),
      requesterUsername: session.username(),
      search: needle.trim(),
    });
    if (token !== studentSeq) return;
    if (data.status !== 'success') throw new Error(data.message || 'Search failed.');
    studentResults.value = data.staff.map((entry) => ({
      name: entry.fullName,
      username: entry.username,
    }));
    // A single result is auto-selected, as the origin does.
    if (studentResults.value.length === 1) {
      studentPicked.value = studentResults.value[0];
      bookStudent.value = studentResults.value[0].name;
    }
  } catch {
    if (token === studentSeq) studentResults.value = [];
  } finally {
    if (token === studentSeq) studentSearching.value = false;
  }
};

watch(bookStudent, (value) => {
  clearTimeout(studentTimer);
  studentTimer = setTimeout(() => void searchStudents(value), 300);
});

onBeforeUnmount(() => {
  clearTimeout(studentTimer);
  studentSeq += 1;
});

/* ── loads ─────────────────────────────────────────────────────────────── */

const loadCases = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_COUNSELLING_CASES', {
      schoolID: session.schoolID(),
      search: caseSearch.value || undefined,
      status: caseStatus.value || undefined,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load cases.');
    cases.value = data.cases;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load cases.';
  } finally {
    loading.value = false;
  }
};

const loadCommittees = async (): Promise<void> => {
  try {
    const data = await callApi('GET_COUNSELLING_COMMITTEES', { schoolID: session.schoolID() });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load committees.');
    committees.value = data.committees;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load committees.';
  }
};

const loadReports = async (): Promise<void> => {
  try {
    const data = await callApi('GET_COUNSELLING_REPORTS', {
      schoolID: session.schoolID(),
      status: reportStatus.value || undefined,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load reports.');
    reports.value = data.reports;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load reports.';
  }
};

/** The session's effective permissions, so the report gate can be evaluated. */
const loadPermissions = async (): Promise<void> => {
  try {
    const data = await callApi('GET_MY_PERMISSIONS', {
      username: session.username(),
      role: session.role.value,
    });
    if (data.status === 'success') permissions.value = data.permissions;
  } catch {
    permissions.value = [];
  }
};

const saveCaseStatus = async (record: CounsellingCase, status: CounsellingStatus): Promise<void> => {
  busy.value = true;
  try {
    const data = await callApi('UPDATE_COUNSELLING_CASE_STATUS', {
      schoolID: session.schoolID(),
      caseId: record.id,
      status,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to update this case.');
    banner.value = `Case ${record.caseNumber} marked ${status.replace('_', ' ').toLowerCase()}.`;
    await loadCases();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to update this case.';
  } finally {
    busy.value = false;
  }
};

const addComment = async (record: CounsellingCase): Promise<void> => {
  if (!caseComment.value.trim()) return;
  busy.value = true;
  try {
    const data = await callApi('ADD_COUNSELLING_CASE_COMMENT', {
      schoolID: session.schoolID(),
      caseId: record.id,
      comment: caseComment.value.trim(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to add the comment.');
    caseComment.value = '';
    await loadCases();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to add the comment.';
  } finally {
    busy.value = false;
  }
};

const submitBooking = async (): Promise<void> => {
  // The origin returns silently here — no message, no field marking.
  if (!studentPicked.value || !bookForm.value.reasonForReferral.trim()) return;
  busy.value = true;
  try {
    const data = await callApi('LAUNCH_COUNSELLING_CASE', {
      schoolID: session.schoolID(),
      studentName: studentPicked.value.name,
      studentUsername: studentPicked.value.username,
      referredByName: bookForm.value.referredByName || session.teacherName(),
      referralDate: bookForm.value.referralDate,
      priority: bookForm.value.priority,
      status: 'OPEN',
      committeeId: bookForm.value.committeeId,
      sessionId: '',
      backgroundInfo: bookForm.value.backgroundInfo,
      reasonForReferral: bookForm.value.reasonForReferral,
      initialComment: bookForm.value.initialComment,
    });
    if (data.status !== 'success' || !data.counsellingCase) {
      throw new Error(data.message || 'Could not book this session.');
    }
    bookedCase.value = data.counsellingCase;
    banner.value = `Case ${data.counsellingCase.caseNumber} launched.`;
    await loadCases();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Could not book this session.';
  } finally {
    busy.value = false;
  }
};

const resetBooking = (): void => {
  bookedCase.value = null;
  studentPicked.value = null;
  bookStudent.value = '';
  bookForm.value = {
    referredByName: session.teacherName(),
    referralDate: new Date().toISOString().slice(0, 10),
    priority: 'NORMAL',
    committeeId: activeCommittees.value[0]?.id ?? '',
    reasonForReferral: '',
    backgroundInfo: '',
    initialComment: '',
  };
};

const saveCommittee = async (): Promise<void> => {
  committeeError.value = '';
  if (!committeeName.value.trim()) {
    committeeError.value = 'Enter a committee name';
    return;
  }
  busy.value = true;
  try {
    const data = await callApi('SAVE_COUNSELLING_COMMITTEE', {
      schoolID: session.schoolID(),
      committee: {
        name: committeeName.value.trim(),
        description: committeeDescription.value.trim(),
        isActive: true,
        members: [],
      },
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not save this committee.');
    banner.value = `"${committeeName.value.trim()}" saved.`;
    committeeName.value = '';
    committeeDescription.value = '';
    await loadCommittees();
  } catch (e) {
    committeeError.value = e instanceof Error ? e.message : 'Could not save this committee.';
  } finally {
    busy.value = false;
  }
};

const submitReport = async (): Promise<void> => {
  reportError.value = '';
  // The origin's only check: a case must be selected and the title non-blank.
  if (!reportForm.value.caseId || !reportForm.value.title.trim()) return;
  busy.value = true;
  try {
    const data = await callApi('SAVE_COUNSELLING_REPORT', {
      schoolID: session.schoolID(),
      // `caseNumber` is derived from the case, so the store fills it rather than the form.
      report: {
        ...reportForm.value,
        title: reportForm.value.title.trim(),
        caseNumber: cases.value.find((c) => c.id === reportForm.value.caseId)?.caseNumber ?? '',
      },
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not save this report.');
    banner.value = `"${reportForm.value.title.trim()}" saved.`;
    reportForm.value = {
      caseId: '',
      title: '',
      status: 'DRAFT',
      summary: '',
      findings: '',
      recommendations: '',
      actionPlan: '',
    };
    await loadReports();
  } catch (e) {
    reportError.value = e instanceof Error ? e.message : 'Could not save this report.';
  } finally {
    busy.value = false;
  }
};

onMounted(async () => {
  await Promise.all([loadPermissions(), loadCases(), loadCommittees(), loadReports()]);
  resetBooking();
});
</script>

<template>
  <TeacherModuleShell
    title="Guidance &amp; Counselling"
    description="Book a session, follow a case, and manage the committee."
    :loading="loading && view === 'cases'"
    :error="loadError"
    :empty-count="view === 'cases' ? cases.length : view === 'reports' ? reports.length : 1"
    @retry="loadCases"
    :banner="banner"
    @dismiss="banner = ''"
  >
    <template #filters>
      <div class="tp-tabs" role="tablist" aria-label="Counselling views">
        <button
          v-for="entry in VIEWS"
          :key="entry.id"
          type="button"
          role="tab"
          class="tp-tab"
          :class="{ 'tp-tab--on': view === entry.id }"
          :aria-selected="view === entry.id"
          @click="view = entry.id"
        >
          {{ entry.label }}
        </button>
      </div>
    </template>

    <!-- ── cases ─────────────────────────────────────────────────────── -->
    <template v-if="view === 'cases'">
      <div class="tp-toolbar">
        <input
          v-model="caseSearch"
          class="tp-input tp-toolbar__search"
          type="search"
          placeholder="Case number or student..."
          @keyup.enter="loadCases"
        />
        <select v-model="caseStatus" class="tp-input tp-status-filter" @change="loadCases">
          <option value="">All statuses</option>
          <option v-for="entry in COUNSELLING_STATUSES" :key="entry" :value="entry">
            {{ entry.replace('_', ' ') }}
          </option>
        </select>
        <button type="button" class="tp-btn" @click="caseStatus = ''; caseSearch = ''; loadCases()">
          Reset
        </button>
      </div>

      <div v-if="openCase" class="tp-card">
        <button type="button" class="tp-btn tp-btn--ghost" @click="openCaseId = ''">
          &larr; Back to cases
        </button>
        <h3 class="tp-card__title">Case {{ openCase.caseNumber }}</h3>
        <p class="tp-inline-note">
          {{ openCase.studentName }} &middot; referred by {{ openCase.referredByName }} on
          {{ openCase.referralDate }}
        </p>
        <dl class="tp-fields">
          <div><dt>Priority</dt><dd>{{ openCase.priority }}</dd></div>
          <div><dt>Status</dt><dd>{{ openCase.status.replace('_', ' ') }}</dd></div>
          <div><dt>Committee</dt><dd>{{ openCase.committeeName || '—' }}</dd></div>
        </dl>

        <h4 class="tp-band">REASON FOR REFERRAL</h4>
        <p class="tp-inline-note">{{ openCase.reasonForReferral || '—' }}</p>
        <h4 class="tp-band">BACKGROUND</h4>
        <p class="tp-inline-note">{{ openCase.backgroundInfo || '—' }}</p>

        <h4 class="tp-band">COMMENTS</h4>
        <ul v-if="openCase.comments.length" class="tp-comments">
          <li v-for="entry in openCase.comments" :key="entry.id">
            <strong>{{ entry.authorName }}</strong>
            <span class="tp-cellsub">{{ entry.createdAt.slice(0, 10) }}</span>
            <p>{{ entry.body }}</p>
          </li>
        </ul>
        <p v-else class="tp-inline-note">No comments yet.</p>
        <label class="tp-field">
          <span class="tp-field__label">Add a comment</span>
          <textarea v-model="caseComment" class="tp-input tp-input--area" rows="2" />
        </label>
        <button
          type="button"
          class="tp-btn"
          :disabled="busy || !caseComment.trim()"
          @click="addComment(openCase)"
        >
          Add comment
        </button>

        <div class="tp-detail__actions">
          <label class="tp-field">
            <span class="tp-field__label">Update status</span>
            <select
              class="tp-input"
              :value="openCase.status"
              @change="saveCaseStatus(openCase, ($event.target as HTMLSelectElement).value as CounsellingStatus)"
            >
              <option v-for="entry in COUNSELLING_STATUSES" :key="entry" :value="entry">
                {{ entry.replace('_', ' ') }}
              </option>
            </select>
          </label>
        </div>
      </div>

      <div v-else-if="cases.length" class="tp-table-wrap">
        <table class="tp-table">
          <caption class="tp-table__caption">{{ cases.length }} case(s)</caption>
          <thead>
            <tr>
              <th scope="col">Case</th>
              <th scope="col">Student</th>
              <th scope="col">Priority</th>
              <th scope="col">Status</th>
              <th scope="col"><span class="tp-sr">Details</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in cases" :key="record.id" class="tp-row" tabindex="0" @click="openCaseId = record.id" @keydown.enter="openCaseId = record.id">
              <td>{{ record.caseNumber }}</td>
              <td>{{ record.studentName }}</td>
              <td>{{ record.priority }}</td>
              <td>
                <TeacherStatusBadge :status="record.status" :variant="caseBadge(record.status)" />
              </td>
              <td class="tp-table__actions">
                <button type="button" class="tp-btn tp-btn--ghost tp-btn--xs" @click.stop="openCaseId = record.id">
                  View
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="tp-empty">
        <p>No counselling cases match your filters.</p>
      </div>
    </template>

    <!-- ── book a session ────────────────────────────────────────────── -->
    <template v-else-if="view === 'book'">
      <div v-if="bookedCase" class="tp-card">
        <h3 class="tp-card__title">Case {{ bookedCase.caseNumber }} launched</h3>
        <p class="tp-inline-note">
          "{{ bookedCase.studentName }}" &mdash; {{ bookedCase.committeeName || 'session booked' }}.
        </p>
        <div class="tp-detail__actions">
          <button type="button" class="tp-btn" @click="resetBooking">Book another</button>
        </div>
      </div>

      <div v-else class="tp-card">
        <h3 class="tp-card__title">Book a counselling session</h3>

        <label class="tp-field">
          <span class="tp-field__label">Student</span>
          <input v-model="bookStudent" class="tp-input" type="search" placeholder="Type at least 2 characters" />
        </label>
        <p v-if="studentSearching" class="tp-inline-note">Searching...</p>
        <ul v-else-if="studentResults.length > 1" class="tp-recipients">
          <li v-for="entry in studentResults" :key="entry.username">
            <button
              type="button"
              class="tp-recipient"
              @click="
                studentPicked = entry;
                bookStudent = entry.name;
                studentResults = [];
              "
            >
              {{ entry.name }}
            </button>
          </li>
        </ul>
        <p v-if="studentPicked" class="tp-inline-note">
          Selected: <strong>{{ studentPicked.name }}</strong>
        </p>

        <div class="tp-form">
          <label class="tp-field">
            <span class="tp-field__label">Referred by</span>
            <input v-model="bookForm.referredByName" class="tp-input" />
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Referral date</span>
            <input v-model="bookForm.referralDate" class="tp-input" type="date" />
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Priority</span>
            <select v-model="bookForm.priority" class="tp-input">
              <option v-for="entry in PRIORITIES" :key="entry" :value="entry">{{ entry }}</option>
            </select>
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Committee</span>
            <select v-model="bookForm.committeeId" class="tp-input">
              <option value="">Select committee</option>
              <option v-for="entry in activeCommittees" :key="entry.id" :value="entry.id">
                {{ entry.name }}
              </option>
            </select>
          </label>
        </div>

        <label class="tp-field">
          <span class="tp-field__label">Reason for referral</span>
          <textarea v-model="bookForm.reasonForReferral" class="tp-input tp-input--area" rows="3" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Background information</span>
          <textarea v-model="bookForm.backgroundInfo" class="tp-input tp-input--area" rows="3" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Initial comment</span>
          <textarea v-model="bookForm.initialComment" class="tp-input tp-input--area" rows="2" />
        </label>

        <div class="tp-detail__actions">
          <button type="button" class="tp-btn tp-btn--primary" :disabled="busy" @click="submitBooking">
            {{ busy ? 'Booking...' : 'Book session' }}
          </button>
        </div>
      </div>
    </template>

    <!-- ── committees ────────────────────────────────────────────────── -->
    <template v-else-if="view === 'committees'">
      <div v-if="managesCommittees()" class="tp-card">
        <h3 class="tp-card__title">Add a committee</h3>
        <label class="tp-field">
          <span class="tp-field__label">Name</span>
          <input v-model="committeeName" class="tp-input" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Description</span>
          <textarea v-model="committeeDescription" class="tp-input tp-input--area" rows="2" />
        </label>
        <p v-if="committeeError" class="tp-form__error" role="alert">{{ committeeError }}</p>
        <button type="button" class="tp-btn tp-btn--primary" :disabled="busy" @click="saveCommittee">
          Save committee
        </button>
      </div>

      <div v-for="entry in committees" :key="entry.id" class="tp-card">
        <h3 class="tp-card__title">
          {{ entry.name }}
          <TeacherStatusBadge
            :status="entry.isActive ? 'active' : 'archived'"
            :label="entry.isActive ? 'Active' : 'Inactive'"
            :variant="entry.isActive ? 'default' : 'outline'"
          />
        </h3>
        <p class="tp-inline-note">{{ entry.description || '—' }}</p>
        <p class="tp-inline-note">
          {{ entry.members.length }} member(s):
          <template v-if="entry.members.length">
            {{ entry.members.map((m) => `${m.fullName} (${m.role})`).join(', ') }}
          </template>
          <template v-else>none</template>
        </p>
      </div>
    </template>

    <!-- ── reports ───────────────────────────────────────────────────── -->
    <template v-else>
      <div v-if="canCreateReport" class="tp-card">
        <h3 class="tp-card__title">New counselling report</h3>
        <label class="tp-field">
          <span class="tp-field__label">Case</span>
          <select v-model="reportForm.caseId" class="tp-input">
            <option value="">Select a case</option>
            <option v-for="record in cases" :key="record.id" :value="record.id">
              {{ record.caseNumber }} &mdash; {{ record.studentName }}
            </option>
          </select>
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Title</span>
          <input v-model="reportForm.title" class="tp-input" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Status</span>
          <select v-model="reportForm.status" class="tp-input">
            <option value="DRAFT">DRAFT</option>
            <option value="FINAL">FINAL</option>
          </select>
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Summary</span>
          <textarea v-model="reportForm.summary" class="tp-input tp-input--area" rows="3" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Findings</span>
          <textarea v-model="reportForm.findings" class="tp-input tp-input--area" rows="3" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Recommendations</span>
          <textarea v-model="reportForm.recommendations" class="tp-input tp-input--area" rows="3" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Action plan</span>
          <textarea v-model="reportForm.actionPlan" class="tp-input tp-input--area" rows="3" />
        </label>
        <p v-if="reportError" class="tp-form__error" role="alert">{{ reportError }}</p>
        <button type="button" class="tp-btn tp-btn--primary" :disabled="busy" @click="submitReport">
          Save report
        </button>
      </div>

      <!-- The origin's message when the permission is absent, verbatim. -->
      <div v-else class="tp-empty">
        <p>You do not have permission to create counselling reports.</p>
      </div>

      <div v-for="record in reports" :key="record.id" class="tp-card">
        <h3 class="tp-card__title">{{ record.title }}</h3>
        <p class="tp-inline-note">
          {{ record.caseNumber }} &middot;
          <TeacherStatusBadge
            :status="record.status"
            :label="record.status"
            :variant="record.status === 'FINAL' ? 'default' : 'outline'"
          />
        </p>
        <p class="tp-inline-note">{{ record.summary || 'No summary.' }}</p>
      </div>
    </template>
  </TeacherModuleShell>
</template>

<style scoped>
@import './teacher-panel.css';

.tp-detail__actions {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

.tp-form__error {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: #8f2a2a;
}

.tp-status-filter {
  width: auto;
  min-width: 10rem;
}

.tp-cellsub {
  display: block;
  font-size: 0.6875rem;
  color: var(--text-muted, #5b6472);
}

.tp-comments {
  list-style: none;
  margin: 0 0 0.75rem;
  padding: 0;
  display: grid;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.tp-comments p {
  margin: 0.125rem 0 0;
}

.tp-recipients {
  list-style: none;
  margin: 0 0 0.75rem;
  padding: 0;
  display: grid;
  gap: 0.25rem;
  max-height: 170px;
  overflow-y: auto;
}

.tp-recipient {
  width: 100%;
  text-align: left;
  font: inherit;
  font-size: 0.8125rem;
  background: transparent;
  border: 1px solid var(--laec-line, #d7dee8);
  border-radius: 6px;
  padding: 0.4375rem 0.5rem;
  cursor: pointer;
}

.tp-recipient:hover {
  background: #f4f8fd;
}
</style>