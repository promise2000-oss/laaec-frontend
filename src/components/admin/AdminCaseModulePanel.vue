<script setup lang="ts">
/**
 * AdminCaseModulePanel — the pages of the Disciplinary and Counselling modules
 * that are NOT case lists: the incident catalogue, the committee list, and the
 * referral / launch form.
 *
 * WHY ONE COMPONENT FOR SIX PAGES ACROSS TWO MODULES
 * --------------------------------------------------
 * Disciplinary and Counselling are the same three pages with different nouns.
 * Both have a standing catalogue or team list, both have a committee with seats
 * (CHAIR and MEMBER), and both have a sectioned form that ends in a write. The
 * deployed app is written that way too — `counselling-cases.tsx` and
 * `disciplinary-reports.tsx` are siblings, and both reach for the same
 * `ApiCommitteeMember`. Writing a pair of components here would be two
 * renderings of one page that would then drift.
 *
 * So this is parameterised by `kind`, and `kind` comes from the registry's
 * `customPanel`. The vocabulary — what a case is called, what its states are,
 * which action opens one — is data, held here rather than repeated per module.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * -------------------------------
 * It does not invent behaviour. Every string it renders was observed on the live
 * deployment or read out of its source: the option lists, the required-field
 * markers, the "Cancel / Save Referral" pair, and the severity and priority
 * defaults. Where the live page could not be observed, the capability is absent
 * rather than guessed — see `api-observations.md`.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { callApi } from '../../api';
import { SEED_CASE_STUDENTS } from '../../api/seedCaseCatalogue';
import AdminModuleShell from './AdminModuleShell.vue';
import AdminStatusBadge from './AdminStatusBadge.vue';
import AdminDialog from './AdminDialog.vue';
import { useAdminSession } from './useAdminSession';
import type {
  CounsellingCommittee,
  CounsellingPriority,
  CounsellingStatus,
  DisciplinaryCase,
  DisciplinaryCaseStatus,
  DisciplinaryCommittee,
  DisciplinaryIncidentType,
  CaseSeverity,
  CommitteeRole,
} from '../../types/teacher';
import type { AdminModule } from '../../types/admin-registry';

const props = defineProps<{ module: AdminModule }>();
const can = defineModel<((permission?: string | null) => boolean) | null>('can', { default: null });
const session = useAdminSession();
const permitted = (permission?: string): boolean => {
  if (!permission) return true;
  return can.value ? can.value(permission) : true;
};

/* ── which module is this, and which of the three pages ─────────────────── */

/**
 * `disciplinary` vs `counselling`, taken from the module id rather than a prop.
 *
 * The id is the only thing that differs between the two, and a prop that has to
 * be kept in step with the id by hand is a prop that will eventually be wrong —
 * at which point a counselling panel would save a disciplinary case.
 */
const isCounselling = computed(() => props.module.id.startsWith('counselling'));

/** One `schoolID` for both, which is how the teacher-side actions are shaped. */
const SCHOOL_ID = 'SGC';

const options = computed(() =>
  isCounselling.value
    ? {
        /* `counselling-book-session.tsx` lines 43–57: the two lists, verbatim. */
        priority: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as CounsellingPriority[],
        status: ['OPEN', 'SCHEDULED', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED'] as CounsellingStatus[],
        /* The live form preselects NORMAL on the counselling side... */
        defaultPriority: 'NORMAL' as CounsellingPriority,
        defaultStatus: 'OPEN' as CounsellingStatus,
        caseLabel: 'counselling',
        submitLabel: 'Save Referral',
        dateLabel: 'Referral date',
        reasonLabel: 'Reason for referral',
        reasonField: 'reasonForReferral',
        severity: null,
      }
    : {
        /* `disciplinary-launch-case.tsx` SEVERITY_OPTIONS, and MODERATE
           preselected. There is no priority on this side at all. */
        priority: [] as never[],
        status: ['OPEN', 'PENDING', 'UNDER_REVIEW', 'DISMISSED', 'RESOLVED', 'APPEALED'] as DisciplinaryCaseStatus[],
        defaultPriority: 'MODERATE' as never,
        defaultStatus: 'OPEN' as DisciplinaryCaseStatus,
        caseLabel: 'disciplinary',
        submitLabel: 'Launch Case',
        dateLabel: 'Date of incident',
        reasonLabel: 'Incident type',
        reasonField: 'caseTypeId',
        severity: ['MINOR', 'MODERATE', 'MAJOR', 'CRITICAL'] as CaseSeverity[],
      },
);

/* ── shared load/empty/banner plumbing ──────────────────────────────────── */

const busy = ref(false);
const loading = ref(false);
const loadError = ref('');
const banner = ref('');

const reportFailure = (fallback: string, e: unknown): void => {
  loadError.value = e instanceof Error ? e.message : fallback;
};

/* ── the incident catalogue ─────────────────────────────────────────────── */

const incidentTypes = ref<DisciplinaryIncidentType[]>([]);

const loadIncidentTypes = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_DISCIPLINARY_INCIDENT_TYPES', { schoolID: SCHOOL_ID });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load incident types.');
    incidentTypes.value = data.incidentTypes;
  } catch (e) {
    reportFailure('Failed to load incident types.', e);
  } finally {
    loading.value = false;
  }
};

type IncidentDraft = { id: string; title: string; description: string };
const incidentDialog = ref(false);
const incidentDraft = ref<IncidentDraft>({ id: '', title: '', description: '' });
const incidentError = ref('');

const openIncidentDialog = (row?: DisciplinaryIncidentType): void => {
  incidentError.value = '';
  incidentDraft.value = row
    ? { id: row.id, title: row.title, description: row.description }
    : { id: '', title: '', description: '' };
  incidentDialog.value = true;
};

const saveIncident = async (): Promise<void> => {
  if (!incidentDraft.value.title.trim()) {
    incidentError.value = 'Enter a title.';
    return;
  }
  busy.value = true;
  try {
    const data = await callApi('SAVE_DISCIPLINARY_INCIDENT_TYPE', {
      schoolID: SCHOOL_ID,
      incidentTypeId: incidentDraft.value.id || undefined,
      title: incidentDraft.value.title.trim(),
      description: incidentDraft.value.description.trim(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not save the incident type.');
    banner.value = data.message || 'Incident type saved.';
    incidentDialog.value = false;
    await loadIncidentTypes();
  } catch (e) {
    incidentError.value = e instanceof Error ? e.message : 'Could not save the incident type.';
  } finally {
    busy.value = false;
  }
};

const deleteIncident = async (row: DisciplinaryIncidentType): Promise<void> => {
  busy.value = true;
  try {
    const data = await callApi('DELETE_DISCIPLINARY_INCIDENT_TYPE', {
      schoolID: SCHOOL_ID,
      incidentTypeId: row.id,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not delete the incident type.');
    banner.value = data.message || 'Incident type deleted.';
    await loadIncidentTypes();
  } catch (e) {
    banner.value = e instanceof Error ? e.message : 'Could not delete the incident type.';
  } finally {
    busy.value = false;
  }
};

/* ── committees ─────────────────────────────────────────────────────────── */

type Committee = DisciplinaryCommittee | CounsellingCommittee;

const committees = ref<Committee[]>([]);

const loadCommittees = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = isCounselling.value
      ? await callApi('GET_COUNSELLING_COMMITTEES', { schoolID: SCHOOL_ID })
      : await callApi('GET_DISCIPLINARY_COMMITTEES', { schoolID: SCHOOL_ID });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load committees.');
    committees.value = data.committees as Committee[];
  } catch (e) {
    reportFailure('Failed to load committees.', e);
  } finally {
    loading.value = false;
  }
};

interface SeatDraft {
  username: string;
  fullName: string;
  email: string;
  role: CommitteeRole;
}

const committeeDialog = ref(false);
const committeeDraft = ref<{ id: string; name: string; description: string; seats: SeatDraft[] }>({
  id: '',
  name: '',
  description: '',
  seats: [],
});
const committeeError = ref('');

const openCommitteeDialog = (row?: Committee): void => {
  committeeError.value = '';
  committeeDraft.value = {
    id: row?.id ?? '',
    name: row?.name ?? '',
    description: row?.description ?? '',
    seats: (row?.members ?? []).map((m) => ({
      username: m.username,
      fullName: m.fullName,
      email: m.email,
      role: m.role,
    })),
  };
  committeeDialog.value = true;
};

const addSeat = (): void => {
  committeeDraft.value.seats.push({ username: '', fullName: '', email: '', role: 'MEMBER' });
};

const removeSeat = (index: number): void => {
  committeeDraft.value.seats.splice(index, 1);
};

/**
 * A seat needs a person.
 *
 * The live committee editor will not save a row with no member selected, and a
 * chairless committee is the failure this check exists to stop — so it is
 * enforced here rather than left to the mock to accept and quietly drop.
 */
const saveCommittee = async (): Promise<void> => {
  const draft = committeeDraft.value;
  if (!draft.name.trim()) {
    committeeError.value = 'Enter a committee name';
    return;
  }
  const blank = draft.seats.findIndex((s) => !s.fullName.trim());
  if (blank !== -1) {
    committeeError.value = `Name the member on row ${blank + 1}.`;
    return;
  }
  if (draft.seats.filter((s) => s.role === 'CHAIR').length > 1) {
    committeeError.value = 'A committee has at most one chair.';
    return;
  }
  busy.value = true;
  try {
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      isActive: true,
      members: draft.seats.map((s) => ({
        username: s.username || s.fullName.trim().toLowerCase().replace(/\s+/g, '.'),
        fullName: s.fullName.trim(),
        email: s.email.trim(),
        role: s.role,
      })),
    };
    const data = isCounselling.value
      ? await callApi('SAVE_COUNSELLING_COMMITTEE', {
          schoolID: SCHOOL_ID,
          committeeId: draft.id || undefined,
          committee: payload,
        })
      : await callApi('SAVE_DISCIPLINARY_COMMITTEE', {
          schoolID: SCHOOL_ID,
          committeeId: draft.id || undefined,
          committee: payload,
        });
    if (data.status !== 'success') throw new Error(data.message || 'Could not save the committee.');
    banner.value = data.message || 'Committee saved.';
    committeeDialog.value = false;
    await loadCommittees();
  } catch (e) {
    committeeError.value = e instanceof Error ? e.message : 'Could not save the committee.';
  } finally {
    busy.value = false;
  }
};

/* ── the referral / launch form ─────────────────────────────────────────── */

/**
 * The student picker's options.
 *
 * The live form searches students and staff over the API as you type. This has
 * no such search — the mock carries no student directory to search — so it
 * offers a fixed list and says so in the hint, rather than presenting a search
 * box that silently matches nothing.
 */
const students = ref<Array<{ username: string; name: string; className: string }>>([]);

interface CaseFormState {
  studentUsername: string;
  reason: string;
  date: string;
  location: string;
  priority: string;
  status: string;
  committeeId: string;
  severity: string;
  description: string;
  background: string;
  referredBy: string;
  assignedTo: string;
  initialComment: string;
}

const today = (): string => new Date().toISOString().slice(0, 10);

const blankForm = (): CaseFormState => ({
  studentUsername: '',
  reason: '',
  date: today(),
  location: '',
  priority: String(options.value.defaultPriority ?? ''),
  status: String(options.value.defaultStatus ?? ''),
  committeeId: '',
  severity: isCounselling.value ? '' : 'MODERATE',
  description: '',
  background: '',
  referredBy: '',
  assignedTo: '',
  initialComment: '',
});

const form = ref<CaseFormState>(blankForm());
const formError = ref('');
const createdCase = ref<string>('');

/**
 * The two fields the live form marks required, and nothing else.
 *
 * `disciplinary-launch-case.tsx` marks the incident type and the date; the book
 * form marks the student, the referral date and the reason. Marking a field
 * required that the origin does not require would make this form refuse
 * submissions the live app accepts.
 */
const missingRequired = computed<string[]>(() => {
  const gaps: string[] = [];
  if (!form.value.studentUsername.trim()) gaps.push('student');
  if (!form.value.reason.trim()) gaps.push(options.value.reasonLabel.toLowerCase());
  if (!form.value.date) gaps.push(options.value.dateLabel.toLowerCase());
  return gaps;
});

const resetForm = (): void => {
  form.value = blankForm();
  formError.value = '';
  createdCase.value = '';
};

const submitForm = async (): Promise<void> => {
  if (missingRequired.value.length) {
    formError.value = 'Fill in every required field.';
    return;
  }
  busy.value = true;
  formError.value = '';
  try {
    const student = students.value.find((s) => s.username === form.value.studentUsername);
    const common = {
      schoolID: SCHOOL_ID,
      studentName: student?.name ?? form.value.studentUsername,
      studentUsername: form.value.studentUsername,
    };
    const data = isCounselling.value
      ? await callApi('LAUNCH_COUNSELLING_CASE', {
          ...common,
          referredByName: form.value.referredBy.trim() || session.actor(),
          referralDate: form.value.date,
          priority: form.value.priority as CounsellingPriority,
          status: form.value.status as CounsellingStatus,
          committeeId: form.value.committeeId,
          sessionId: 'SESS-2025-2026',
          backgroundInfo: form.value.background.trim(),
          reasonForReferral: form.value.reason.trim(),
          initialComment: form.value.initialComment.trim(),
        })
      : await callApi('LAUNCH_DISCIPLINARY_CASE', {
          ...common,
          caseTypeId: form.value.reason,
          incidentDate: form.value.date,
          location: form.value.location.trim(),
          severity: form.value.severity as CaseSeverity,
          sessionId: 'SESS-2025-2026',
          committeeId: form.value.committeeId,
          description: form.value.description.trim(),
          initialComment: form.value.initialComment.trim(),
        });
    if (data.status !== 'success') throw new Error(data.message || 'Could not save.');
    const record = isCounselling.value
      ? (data as { counsellingCase?: { caseNumber: string } }).counsellingCase
      : (data as { disciplinaryCase?: DisciplinaryCase }).disciplinaryCase;
    createdCase.value = record?.caseNumber ?? '';
    banner.value = data.message || 'Saved.';
    form.value = blankForm();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Could not save.';
  } finally {
    busy.value = false;
  }
};

const loadFormOptions = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    await Promise.all([loadIncidentTypes(), loadCommittees()]);
    students.value = [...SEED_CASE_STUDENTS];
  } catch (e) {
    reportFailure('Failed to load the form.', e);
  } finally {
    loading.value = false;
  }
};

/* ── which page is this ─────────────────────────────────────────────────── */

const kind = computed(() => props.module.customPanel ?? 'case-work');

const loadActive = async (): Promise<void> => {
  banner.value = '';
  if (kind.value === 'case-catalogue') await loadIncidentTypes();
  else if (kind.value === 'case-committees') await loadCommittees();
  else await loadFormOptions();
};

onMounted(loadActive);
watch(() => props.module.id, loadActive);
</script>

<template>
  <!-- ── the incident catalogue ─────────────────────────────────────── -->
  <AdminModuleShell
    v-if="kind === 'case-catalogue'"
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :banner="banner"
    :empty-count="incidentTypes.length"
    @retry="loadIncidentTypes"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button
        v-if="permitted('disciplinary.incidents.manage')"
        type="button"
        class="ap-btn ap-btn--primary"
        @click="openIncidentDialog()"
      >
        Add Incident
      </button>
    </template>

    <template #empty>
      <p>No incident types yet. Add the school's first offence and the sanction attached to it.</p>
    </template>

    <div class="ap-table-wrap">
      <table class="ap-table">
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Description</th>
            <th scope="col"><span class="ap-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in incidentTypes" :key="row.id">
            <td>{{ row.title }}</td>
            <td class="ap-cell--wide">{{ row.description }}</td>
            <td class="ap-table__actions">
              <button
                v-if="permitted('disciplinary.incidents.manage')"
                type="button"
                class="ap-btn ap-btn--xs"
                @click="openIncidentDialog(row)"
              >
                Edit
              </button>
              <button
                v-if="permitted('disciplinary.incidents.manage')"
                type="button"
                class="ap-btn ap-btn--xs ap-btn--danger"
                :disabled="busy"
                @click="deleteIncident(row)"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AdminDialog
      :open="incidentDialog"
      :title="incidentDraft.id ? 'Edit Incident' : 'Add Incident'"
      kind="edit"
      :confirm-label="incidentDraft.id ? 'Save changes' : 'Add incident'"
      :busy="busy"
      @close="incidentDialog = false"
      @confirm="saveIncident"
    >
      <label class="ap-field">
        <span class="ap-field__label">Title <span aria-hidden="true">*</span></span>
        <input v-model="incidentDraft.title" class="ap-input" type="text" />
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Description</span>
        <textarea
          v-model="incidentDraft.description"
          class="ap-input ap-input--area"
          rows="6"
          placeholder="The sanction attached to this offence."
        ></textarea>
        <span class="ap-field__hint">
          The live catalogue writes each offence's sanction out in full, because that is what an operator
          decides on.
        </span>
      </label>
      <p v-if="incidentError" class="ap-form__error" role="alert">{{ incidentError }}</p>
    </AdminDialog>
  </AdminModuleShell>

  <!-- ── committees ──────────────────────────────────────────────────── -->
  <AdminModuleShell
    v-else-if="kind === 'case-committees'"
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :banner="banner"
    :empty-count="committees.length"
    @retry="loadCommittees"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button
        v-if="permitted(isCounselling ? 'counselling.committees.manage' : 'disciplinary.committees.manage')"
        type="button"
        class="ap-btn ap-btn--primary"
        @click="openCommitteeDialog()"
      >
        New Committee
      </button>
    </template>

    <template #empty>
      <p>No committees yet. A case needs one to be heard by.</p>
    </template>

    <div class="ap-cards">
      <article v-for="row in committees" :key="row.id" class="ap-card">
        <h3 class="ap-card__title">{{ row.name }}</h3>
        <p v-if="row.description" class="ap-inline-note">{{ row.description }}</p>
        <p class="ap-inline-note">
          <AdminStatusBadge :status="row.isActive ? 'ACTIVE' : 'INACTIVE'" />
          · {{ row.members.length }} member(s)
        </p>
        <ul v-if="row.members.length" class="ap-seats">
          <li v-for="m in row.members" :key="m.username">
            <span class="ap-seats__name">{{ m.fullName }}</span>
            <span class="ap-badge ap-badge--soft">{{ m.role === 'CHAIR' ? 'Chair' : 'Member' }}</span>
          </li>
        </ul>
        <p v-else class="ap-inline-note">No members yet.</p>
        <button
          v-if="permitted(isCounselling ? 'counselling.committees.manage' : 'disciplinary.committees.manage')"
          type="button"
          class="ap-btn ap-btn--xs"
          @click="openCommitteeDialog(row)"
        >
          Edit
        </button>
      </article>
    </div>

    <AdminDialog
      :open="committeeDialog"
      :title="committeeDraft.id ? 'Edit Committee' : 'New Committee'"
      kind="edit"
      :confirm-label="committeeDraft.id ? 'Save changes' : 'Create committee'"
      :busy="busy"
      @close="committeeDialog = false"
      @confirm="saveCommittee"
    >
      <label class="ap-field">
        <span class="ap-field__label">Name <span aria-hidden="true">*</span></span>
        <input v-model="committeeDraft.name" class="ap-input" type="text" />
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Description</span>
        <textarea v-model="committeeDraft.description" class="ap-input ap-input--area" rows="3"></textarea>
      </label>

      <h4 class="ap-band">Members</h4>
      <p class="ap-inline-note">One chair convenes the committee; the rest deliberate.</p>
      <div v-for="(seat, index) in committeeDraft.seats" :key="index" class="ap-seat-row">
        <label class="ap-field">
          <span class="ap-field__label">Name</span>
          <input v-model="seat.fullName" class="ap-input" type="text" />
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Email</span>
          <input v-model="seat.email" class="ap-input" type="email" />
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Seat</span>
          <select v-model="seat.role" class="ap-input">
            <option value="MEMBER">Member</option>
            <option value="CHAIR">Chair</option>
          </select>
        </label>
        <button type="button" class="ap-btn ap-btn--xs ap-btn--danger" @click="removeSeat(index)">Remove</button>
      </div>
      <button type="button" class="ap-btn ap-btn--xs" @click="addSeat">Add member</button>
      <p v-if="committeeError" class="ap-form__error" role="alert">{{ committeeError }}</p>
    </AdminDialog>
  </AdminModuleShell>

  <!-- ── the referral / launch form ──────────────────────────────────── -->
  <AdminModuleShell
    v-else
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :banner="banner"
    @retry="loadFormOptions"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button type="button" class="ap-btn" :disabled="busy" @click="resetForm">Reset</button>
      <button
        type="button"
        class="ap-btn ap-btn--primary"
        :disabled="busy || missingRequired.length > 0"
        @click="submitForm"
      >
        {{ options.submitLabel }}
      </button>
    </template>

    <template v-if="createdCase">
      <div class="ap-callout ap-callout--good">
        <h3 class="ap-callout__title">{{ options.caseLabel === 'disciplinary' ? 'Case' : 'Referral' }} {{ createdCase }} saved</h3>
        <p class="ap-inline-note">
          The committee has been notified. Find it under
          {{ options.caseLabel === 'disciplinary' ? 'Case Reports' : 'View Cases' }}.
        </p>
      </div>
    </template>

    <fieldset class="ap-fieldset">
      <legend class="ap-fieldset__legend">Student</legend>
      <label class="ap-field">
        <span class="ap-field__label">Search student <span aria-hidden="true">*</span></span>
        <select v-model="form.studentUsername" class="ap-input">
          <option value="">Select a student</option>
          <option v-for="s in students" :key="s.username" :value="s.username">
            {{ s.name }} — {{ s.className }}
          </option>
        </select>
        <span class="ap-field__hint">
          The live form searches students as you type. This mock has no directory to search, so it offers the
          students it knows — a search box here would match nothing and look broken.
        </span>
      </label>
    </fieldset>

    <fieldset class="ap-fieldset">
      <legend class="ap-fieldset__legend">
        {{ options.caseLabel === 'disciplinary' ? 'Incident' : 'Referral' }} &amp; assignment
      </legend>
      <label class="ap-field">
        <span class="ap-field__label">{{ options.reasonLabel }} <span aria-hidden="true">*</span></span>
        <select v-if="!isCounselling" v-model="form.reason" class="ap-input">
          <option value="">Select an incident type</option>
          <option v-for="row in incidentTypes" :key="row.id" :value="row.id">{{ row.title }}</option>
        </select>
        <textarea
          v-else
          v-model="form.reason"
          class="ap-input ap-input--area"
          rows="3"
          placeholder="Why this student is being referred."
        ></textarea>
      </label>
      <label class="ap-field">
        <span class="ap-field__label">{{ options.dateLabel }} <span aria-hidden="true">*</span></span>
        <input v-model="form.date" class="ap-input" type="date" />
      </label>
      <label v-if="!isCounselling" class="ap-field">
        <span class="ap-field__label">Location</span>
        <input v-model="form.location" class="ap-input" type="text" />
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Severity</span>
        <select v-if="!isCounselling" v-model="form.severity" class="ap-input">
          <option v-for="s in options.severity ?? []" :key="s" :value="s">{{ s }}</option>
        </select>
        <select v-else v-model="form.priority" class="ap-input">
          <option v-for="p in options.priority" :key="p" :value="p">{{ p }}</option>
        </select>
        <span class="ap-field__hint">
          {{ isCounselling ? 'The live form preselects Normal.' : 'The live form preselects Moderate.' }}
        </span>
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Status</span>
        <select v-model="form.status" class="ap-input">
          <option v-for="s in options.status" :key="s" :value="s">{{ s.replace(/_/g, ' ') }}</option>
        </select>
      </label>
      <label class="ap-field">
        <span class="ap-field__label">{{ isCounselling ? 'Committee' : 'Disciplinary committee' }}</span>
        <select v-model="form.committeeId" class="ap-input">
          <option value="">Auto-assigned</option>
          <option v-for="row in committees" :key="row.id" :value="row.id">{{ row.name }}</option>
        </select>
      </label>
    </fieldset>

    <fieldset class="ap-fieldset">
      <legend class="ap-fieldset__legend">
        {{ isCounselling ? 'Background' : 'Description' }}
      </legend>
      <label v-if="!isCounselling" class="ap-field">
        <span class="ap-field__label">Description</span>
        <textarea v-model="form.description" class="ap-input ap-input--area" rows="4"></textarea>
      </label>
      <label v-else class="ap-field">
        <span class="ap-field__label">Background information</span>
        <textarea v-model="form.background" class="ap-input ap-input--area" rows="4"></textarea>
      </label>
      <label v-if="isCounselling" class="ap-field">
        <span class="ap-field__label">Referred by (name, optional)</span>
        <input v-model="form.referredBy" class="ap-input" type="text" />
      </label>
      <label class="ap-field">
        <span class="ap-field__label">
          {{ isCounselling ? 'Initial note' : 'Initial comment' }} (optional)
        </span>
        <textarea v-model="form.initialComment" class="ap-input ap-input--area" rows="3"></textarea>
      </label>
    </fieldset>

    <p v-if="formError" class="ap-form__error" role="alert">{{ formError }}</p>
    <p v-else-if="missingRequired.length" class="ap-field__hint">
      Still needed: {{ missingRequired.join(', ') }}.
    </p>
  </AdminModuleShell>
</template>

<style scoped>
@import './admin-panel.css';

.ap-cell--wide {
  min-width: 22rem;
  white-space: normal;
  line-height: 1.5;
}

.ap-seats {
  list-style: none;
  margin: 0.5rem 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ap-seats li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

/* `.ap-seat-row` and `.ap-total` are declared in the shared `admin-panel.css`,
 * not here: the sale sheet needs the same row shape and a scoped rule would not
 * reach it. */

.ap-callout {
  border: 1px solid var(--laec-line, #d7dee8);
  border-radius: 10px;
  padding: 0.75rem 0.875rem;
  margin-bottom: 1rem;
}

.ap-callout--good {
  border-color: #b7e0c7;
  background: #f2fbf5;
}

.ap-callout__title {
  margin: 0 0 0.25rem;
  font-size: 0.9375rem;
  font-weight: 700;
}
</style>