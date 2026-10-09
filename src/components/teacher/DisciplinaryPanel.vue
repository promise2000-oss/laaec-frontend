/**
 * Disciplinary panel (D-72) — the origin's 5 routes collapsed.
 *
 * Origin routes folded in: `/disciplinary/incidents`, `/disciplinary/committees`,
 * `/disciplinary/launch-case`, `/disciplinary/reports` and
 * `/disciplinary/reports/[id]`. The nav groups them under one expandable parent,
 * and here they are four sub-views behind one rail entry.
 *
 * THE MISNAMED ROUTE, REPRODUCED
 * ------------------------------
 * `/disciplinary/incidents` does NOT manage incidents. It manages **case
 * types** — the list a `Launch Case` form picks `caseTypeId` from. The sub-view is
 * labelled `Case Types` here so it is not misread, and `docs/teacher-portal/
 * routes.md` records the origin's own naming.
 *
 * REPRODUCED
 *  - case types soft-delete (`isActive = false`), and an inactive row keeps a
 *    visible `Inactive` badge rather than disappearing;
 *  - the delete success banner `Deleted successfully.`;
 *  - the empty copy `No incidents yet. Add the first case type to get started.`
 *    — the origin's own `EmptyMessage`, which does say "incidents" while managing
 *    case types;
 *  - the launch form's two-character typeahead guard, and its silent refusal to
 *    submit without a student and a case type;
 *  - case status and severity vocabularies, both uppercase: six statuses and four
 *    severities.
 *
 * NOT PORTED: the origin's case report **download**, which streams
 * `GET /disciplinary/cases/:id/download` as an HTML blob named after the case
 * number plus `-report.html`. LAEC's `callApi` returns a typed envelope, not a
 * blob, so a download would need a transport this portal does not have.
 * Recorded in docs/teacher-portal/api-map.md rather than faked with
 * `window.print()`.
 */
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { callApi } from '../../api';
import { hasPermission } from '../../lib/permissions';
import { useTeacherSession } from './useTeacherSession';
import TeacherModuleShell from './TeacherModuleShell.vue';
import TeacherStatusBadge from './TeacherStatusBadge.vue';
import type {
  CaseSeverity,
  DisciplinaryCase,
  DisciplinaryCaseStatus,
  DisciplinaryCommittee,
  DisciplinaryIncidentType,
} from '../../types/teacher';

type View = 'types' | 'committees' | 'launch' | 'cases';

const session = useTeacherSession();

const view = ref<View>('cases');
const banner = ref('');
const loading = ref(false);
const loadError = ref('');
const busy = ref(false);

const permissions = ref<string[]>([]);
const can = (code: string): boolean => hasPermission(permissions.value, code);

/* ── case types ────────────────────────────────────────────────────────── */

const incidentTypes = ref<DisciplinaryIncidentType[]>([]);
const typeForm = ref({ title: '', description: '' });
const typeError = ref('');

const canManageTypes = computed(() => can('disciplinary.incidents.manage'));
const managesTypes = (): boolean => canManageTypes.value;

/* ── committees ────────────────────────────────────────────────────────── */

const committees = ref<DisciplinaryCommittee[]>([]);
const committeeForm = ref({ name: '', description: '' });
const committeeError = ref('');

const canManageCommittees = computed(() => can('disciplinary.committees.manage'));
const managesCommittees = (): boolean => canManageCommittees.value;

/* ── launch a case ────────────────────────────────────────────────────── */

const activeTypes = computed(() => incidentTypes.value.filter((t) => t.isActive));
const activeCommittees = computed(() => committees.value.filter((c) => c.isActive));

const VIEWS: ReadonlyArray<{ id: View; label: string }> = [
  { id: 'cases', label: 'Reports' },
  { id: 'launch', label: 'Launch Case' },
  { id: 'types', label: 'Case Types' },
  { id: 'committees', label: 'Disciplinary Committee' },
];

const SEVERITIES: readonly CaseSeverity[] = ['MINOR', 'MODERATE', 'MAJOR', 'CRITICAL'];

const launchStudent = ref('');
const studentPicked = ref<{ name: string; username: string } | null>(null);
const studentResults = ref<Array<{ name: string; username: string }>>([]);
const studentSearching = ref(false);
const launchedCase = ref<DisciplinaryCase | null>(null);

const launchForm = ref({
  caseTypeId: '',
  incidentDate: new Date().toISOString().slice(0, 10),
  location: '',
  severity: 'MODERATE' as CaseSeverity,
  committeeId: '',
  description: '',
  initialComment: '',
});

/* ── cases ─────────────────────────────────────────────────────────────── */

const CASE_STATUSES: readonly DisciplinaryCaseStatus[] = [
  'OPEN',
  'PENDING',
  'UNDER_REVIEW',
  'DISMISSED',
  'RESOLVED',
  'APPEALED',
];

const cases = ref<DisciplinaryCase[]>([]);
const caseSearch = ref('');
const caseStatus = ref<DisciplinaryCaseStatus | ''>('');
const caseTypeFilter = ref('');
const openCaseId = ref('');
const caseComment = ref('');

const openCase = computed(() => cases.value.find((c) => c.id === openCaseId.value) ?? null);

const caseBadge = (status: DisciplinaryCaseStatus): 'default' | 'secondary' | 'outline' | 'destructive' => {
  if (status === 'RESOLVED' || status === 'DISMISSED') return 'default';
  if (status === 'OPEN') return 'destructive';
  if (status === 'APPEALED') return 'outline';
  return 'secondary';
};

/* ── the origin's two-character typeahead guard ────────────────────────── */

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
  } catch {
    if (token === studentSeq) studentResults.value = [];
  } finally {
    if (token === studentSeq) studentSearching.value = false;
  }
};

watch(launchStudent, (value) => {
  clearTimeout(studentTimer);
  studentTimer = setTimeout(() => void searchStudents(value), 300);
});

onBeforeUnmount(() => {
  clearTimeout(studentTimer);
  studentSeq += 1;
});

/* ── loads ─────────────────────────────────────────────────────────────── */

const loadAll = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const [types, committeesRes, casesRes, perms] = await Promise.all([
      callApi('GET_DISCIPLINARY_INCIDENT_TYPES', { schoolID: session.schoolID() }),
      callApi('GET_DISCIPLINARY_COMMITTEES', { schoolID: session.schoolID() }),
      callApi('GET_DISCIPLINARY_CASES', {
        schoolID: session.schoolID(),
        search: caseSearch.value || undefined,
        status: caseStatus.value || undefined,
        caseTypeId: caseTypeFilter.value || undefined,
      }),
      callApi('GET_MY_PERMISSIONS', { username: session.username(), role: session.role.value }),
    ]);
    if (types.status !== 'success') throw new Error(types.message || 'Failed to load case types.');
    if (committeesRes.status !== 'success') {
      throw new Error(committeesRes.message || 'Failed to load committees.');
    }
    if (casesRes.status !== 'success') throw new Error(casesRes.message || 'Failed to load cases.');
    incidentTypes.value = types.incidentTypes;
    committees.value = committeesRes.committees;
    cases.value = casesRes.cases;
    if (perms.status === 'success') permissions.value = perms.permissions;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load disciplinary data.';
  } finally {
    loading.value = false;
  }
};

const saveType = async (): Promise<void> => {
  typeError.value = '';
  if (!typeForm.value.title.trim()) {
    typeError.value = 'Enter a title';
    return;
  }
  busy.value = true;
  try {
    const data = await callApi('SAVE_DISCIPLINARY_INCIDENT_TYPE', {
      schoolID: session.schoolID(),
      title: typeForm.value.title.trim(),
      description: typeForm.value.description.trim(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not save this case type.');
    banner.value = `"${typeForm.value.title.trim()}" saved.`;
    typeForm.value = { title: '', description: '' };
    await loadAll();
  } catch (e) {
    typeError.value = e instanceof Error ? e.message : 'Could not save this case type.';
  } finally {
    busy.value = false;
  }
};

const deleteType = async (entry: DisciplinaryIncidentType): Promise<void> => {
  busy.value = true;
  try {
    const data = await callApi('DELETE_DISCIPLINARY_INCIDENT_TYPE', {
      schoolID: session.schoolID(),
      incidentTypeId: entry.id,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not delete this case type.');
    banner.value = 'Deleted successfully.';
    await loadAll();
  } catch (e) {
    typeError.value = e instanceof Error ? e.message : 'Could not delete this case type.';
  } finally {
    busy.value = false;
  }
};

const saveCommittee = async (): Promise<void> => {
  committeeError.value = '';
  if (!committeeForm.value.name.trim()) {
    committeeError.value = 'Enter a committee name';
    return;
  }
  busy.value = true;
  try {
    const data = await callApi('SAVE_DISCIPLINARY_COMMITTEE', {
      schoolID: session.schoolID(),
      committee: {
        name: committeeForm.value.name.trim(),
        description: committeeForm.value.description.trim(),
        isActive: true,
        members: [],
      },
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not save this committee.');
    banner.value = `"${committeeForm.value.name.trim()}" saved.`;
    committeeForm.value = { name: '', description: '' };
    await loadAll();
  } catch (e) {
    committeeError.value = e instanceof Error ? e.message : 'Could not save this committee.';
  } finally {
    busy.value = false;
  }
};

const submitLaunch = async (): Promise<void> => {
  // The origin returns silently when either field is missing.
  if (!studentPicked.value || !launchForm.value.caseTypeId) return;
  busy.value = true;
  try {
    const data = await callApi('LAUNCH_DISCIPLINARY_CASE', {
      schoolID: session.schoolID(),
      studentName: studentPicked.value.name,
      studentUsername: studentPicked.value.username,
      caseTypeId: launchForm.value.caseTypeId,
      incidentDate: launchForm.value.incidentDate,
      location: launchForm.value.location,
      severity: launchForm.value.severity,
      sessionId: '',
      committeeId: launchForm.value.committeeId,
      description: launchForm.value.description,
      initialComment: launchForm.value.initialComment,
    });
    if (data.status !== 'success' || !data.disciplinaryCase) {
      throw new Error(data.message || 'Could not launch this case.');
    }
    launchedCase.value = data.disciplinaryCase;
    banner.value = `Case ${data.disciplinaryCase.caseNumber} launched.`;
    await loadAll();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Could not launch this case.';
  } finally {
    busy.value = false;
  }
};

const resetLaunch = (): void => {
  launchedCase.value = null;
  studentPicked.value = null;
  launchStudent.value = '';
  launchForm.value = {
    caseTypeId: activeTypes.value[0]?.id ?? '',
    incidentDate: new Date().toISOString().slice(0, 10),
    location: '',
    severity: 'MODERATE',
    committeeId: activeCommittees.value[0]?.id ?? '',
    description: '',
    initialComment: '',
  };
};

const saveCaseStatus = async (record: DisciplinaryCase, status: DisciplinaryCaseStatus): Promise<void> => {
  busy.value = true;
  try {
    const data = await callApi('UPDATE_DISCIPLINARY_CASE_STATUS', {
      schoolID: session.schoolID(),
      caseId: record.id,
      status,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not update this case.');
    banner.value = `Case ${record.caseNumber} marked ${status.replace('_', ' ').toLowerCase()}.`;
    await loadAll();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Could not update this case.';
  } finally {
    busy.value = false;
  }
};

const addComment = async (record: DisciplinaryCase): Promise<void> => {
  if (!caseComment.value.trim()) return;
  busy.value = true;
  try {
    const data = await callApi('ADD_DISCIPLINARY_CASE_COMMENT', {
      schoolID: session.schoolID(),
      caseId: record.id,
      comment: caseComment.value.trim(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not add the comment.');
    caseComment.value = '';
    await loadAll();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Could not add the comment.';
  } finally {
    busy.value = false;
  }
};

onMounted(async () => {
  await loadAll();
  resetLaunch();
});
</script>

<template>
  <TeacherModuleShell
    title="Disciplinary"
    description="Case types, committees, launched cases and their outcomes."
    :loading="loading"
    :error="loadError"
    :empty-count="view === 'cases' ? cases.length : 1"
    @retry="loadAll"
    :banner="banner"
    @dismiss="banner = ''"
  >
    <template #filters>
      <div class="tp-tabs" role="tablist" aria-label="Disciplinary views">
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

    <!-- ── case types ────────────────────────────────────────────────── -->
    <template v-if="view === 'types'">
      <div v-if="canManageTypes" class="tp-card">
        <h3 class="tp-card__title">Add case type</h3>
        <label class="tp-field">
          <span class="tp-field__label">Title</span>
          <input v-model="typeForm.title" class="tp-input" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Description</span>
          <textarea v-model="typeForm.description" class="tp-input tp-input--area" rows="2" />
        </label>
        <p v-if="typeError" class="tp-form__error" role="alert">{{ typeError }}</p>
        <button type="button" class="tp-btn tp-btn--primary" :disabled="busy" @click="saveType">
          Save case type
        </button>
      </div>

      <div v-for="entry in incidentTypes" :key="entry.id" class="tp-card">
        <h3 class="tp-card__title">
          {{ entry.title }}
          <TeacherStatusBadge
            v-if="!entry.isActive"
            status="archived"
            label="Inactive"
            variant="outline"
          />
        </h3>
        <p class="tp-inline-note">{{ entry.description || '—' }}</p>
        <div v-if="managesTypes()" class="tp-detail__actions">
          <button
            type="button"
            class="tp-btn tp-btn--ghost tp-btn--dangerish"
            :disabled="busy || !entry.isActive"
            @click="deleteType(entry)"
          >
            Delete
          </button>
        </div>
      </div>

      <div v-if="incidentTypes.length === 0" class="tp-empty">
        <p>No incidents yet. Add the first case type to get started.</p>
      </div>
    </template>

    <!-- ── committees ────────────────────────────────────────────────── -->
    <template v-else-if="view === 'committees'">
      <div v-if="managesCommittees()" class="tp-card">
        <h3 class="tp-card__title">Add committee</h3>
        <label class="tp-field">
          <span class="tp-field__label">Name</span>
          <input v-model="committeeForm.name" class="tp-input" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Description</span>
          <textarea v-model="committeeForm.description" class="tp-input tp-input--area" rows="2" />
        </label>
        <p v-if="committeeError" class="tp-form__error" role="alert">{{ committeeError }}</p>
        <button type="button" class="tp-btn tp-btn--primary" :disabled="busy" @click="saveCommittee">
          Save committee
        </button>
      </div>

      <div v-for="entry in committees" :key="entry.id" class="tp-card">
        <h3 class="tp-card__title">{{ entry.name }}</h3>
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

    <!-- ── launch a case ─────────────────────────────────────────────── -->
    <template v-else-if="view === 'launch'">
      <div v-if="launchedCase" class="tp-card">
        <h3 class="tp-card__title">Case {{ launchedCase.caseNumber }} launched</h3>
        <p class="tp-inline-note">
          "{{ launchedCase.studentName }}" &mdash; {{ launchedCase.caseTypeTitle }}. The disciplinary
          committee has been notified.
        </p>
        <div class="tp-detail__actions">
          <button type="button" class="tp-btn" @click="resetLaunch">Launch another</button>
        </div>
      </div>

      <div v-else class="tp-card">
        <h3 class="tp-card__title">Launch a case</h3>

        <label class="tp-field">
          <span class="tp-field__label">Student</span>
          <input v-model="launchStudent" class="tp-input" type="search" placeholder="Type at least 2 characters" />
        </label>
        <p v-if="studentSearching" class="tp-inline-note">Searching...</p>
        <ul v-else-if="studentResults.length" class="tp-recipients">
          <li v-for="entry in studentResults" :key="entry.username">
            <button
              type="button"
              class="tp-recipient"
              @click="
                studentPicked = entry;
                launchStudent = entry.name;
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
            <span class="tp-field__label">Case type</span>
            <select v-model="launchForm.caseTypeId" class="tp-input">
              <option value="">Select case type</option>
              <option v-for="entry in activeTypes" :key="entry.id" :value="entry.id">
                {{ entry.title }}
              </option>
            </select>
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Incident date</span>
            <input v-model="launchForm.incidentDate" class="tp-input" type="date" />
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Severity</span>
            <select v-model="launchForm.severity" class="tp-input">
              <option v-for="entry in SEVERITIES" :key="entry" :value="entry">{{ entry }}</option>
            </select>
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Committee</span>
            <select v-model="launchForm.committeeId" class="tp-input">
              <option value="">Select committee</option>
              <option v-for="entry in activeCommittees" :key="entry.id" :value="entry.id">
                {{ entry.name }}
              </option>
            </select>
          </label>
        </div>

        <label class="tp-field">
          <span class="tp-field__label">Location</span>
          <input v-model="launchForm.location" class="tp-input" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Description</span>
          <textarea v-model="launchForm.description" class="tp-input tp-input--area" rows="3" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Initial comment</span>
          <textarea v-model="launchForm.initialComment" class="tp-input tp-input--area" rows="2" />
        </label>

        <div class="tp-detail__actions">
          <button type="button" class="tp-btn tp-btn--primary" :disabled="busy" @click="submitLaunch">
            {{ busy ? 'Launching...' : 'Launch case' }}
          </button>
        </div>
      </div>
    </template>

    <!-- ── cases ─────────────────────────────────────────────────────── -->
    <template v-else>
      <div class="tp-toolbar">
        <input
          v-model="caseSearch"
          class="tp-input tp-toolbar__search"
          type="search"
          placeholder="Case number, student or type..."
          @keyup.enter="loadAll"
        />
        <select v-model="caseStatus" class="tp-input tp-status-filter" @change="loadAll">
          <option value="">All statuses</option>
          <option v-for="entry in CASE_STATUSES" :key="entry" :value="entry">
            {{ entry.replace('_', ' ') }}
          </option>
        </select>
        <select v-model="caseTypeFilter" class="tp-input tp-status-filter" @change="loadAll">
          <option value="">All case types</option>
          <option v-for="entry in incidentTypes" :key="entry.id" :value="entry.id">
            {{ entry.title }}
          </option>
        </select>
        <button type="button" class="tp-btn" @click="caseStatus = ''; caseTypeFilter = ''; caseSearch = ''; loadAll()">
          Reset
        </button>
      </div>

      <div v-if="openCase" class="tp-card">
        <button type="button" class="tp-btn tp-btn--ghost" @click="openCaseId = ''">&larr; Back to cases</button>
        <h3 class="tp-card__title">Case {{ openCase.caseNumber }}</h3>
        <p class="tp-inline-note">
          {{ openCase.studentName }} &middot; {{ openCase.caseTypeTitle }} &middot;
          {{ openCase.incidentDate }}
        </p>
        <dl class="tp-fields">
          <div><dt>Severity</dt><dd>{{ openCase.severity }}</dd></div>
          <div><dt>Status</dt><dd>{{ openCase.status.replace('_', ' ') }}</dd></div>
          <div><dt>Location</dt><dd>{{ openCase.location || '—' }}</dd></div>
          <div><dt>Committee</dt><dd>{{ openCase.committeeName || '—' }}</dd></div>
        </dl>

        <h4 class="tp-band">DESCRIPTION</h4>
        <p class="tp-inline-note">{{ openCase.description || '—' }}</p>

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
              @change="saveCaseStatus(openCase, ($event.target as HTMLSelectElement).value as DisciplinaryCaseStatus)"
            >
              <option v-for="entry in CASE_STATUSES" :key="entry" :value="entry">
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
              <th scope="col">Type</th>
              <th scope="col">Severity</th>
              <th scope="col">Status</th>
              <th scope="col"><span class="tp-sr">Details</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in cases" :key="record.id" class="tp-row" tabindex="0" @click="openCaseId = record.id" @keydown.enter="openCaseId = record.id">
              <td>{{ record.caseNumber }}</td>
              <td>{{ record.studentName }}</td>
              <td>{{ record.caseTypeTitle }}</td>
              <td>{{ record.severity }}</td>
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
        <p>No disciplinary cases match your filters.</p>
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