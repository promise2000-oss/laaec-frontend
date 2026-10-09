<script setup lang="ts">
/**
 * HR Queries panel (D-72) — the origin's 3 routes collapsed.
 *
 * Origin routes folded in: `/teacher/hr-queries` (the list),
 * `/teacher/hr-queries/new` (the form) and `/teacher/hr-queries/[id]` (the detail,
 * which also carries the Manage query card).
 *
 * REPRODUCED
 *  - four tabs: `All`, `Open`, `Resolved`, `Archived`;
 *  - the list's Subject cell carrying the category as a sub-line, defaulting to
 *    `General` — which is why the field is labelled **Offence** on the form;
 *  - the priority and status badges: priority `high`/`medium`/`low` (default
 *    `medium`), status `Open`/`Assigned`/`Resolved`/`Archived` (default `Open`);
 *  - the form's three validation messages, verbatim:
 *    `Select the recipient`, `Title is required`, `Describe your query`;
 *  - the recipient typeahead: 300 ms debounce, self excluded, `No users found.`;
 *  - the Manage query card, which appears while `status !== 'ARCHIVED'` and
 *    offers `Assign and keep open` (only from `OPEN`), `Mark resolved` (only
 *    when not already `RESOLVED`) and `Archive`.
 *
 * NOT REPRODUCED, AND IT IS THE ORIGIN'S GAP
 *  The detail page's management actions carry **no permission check** — any
 *  teacher who reaches the URL can resolve or archive somebody's query. The
 *  action map gates the transport on `queries.read`, which is what the origin's
 *  own permission vocabulary implies, but that is a weaker gate than the UI
 *  would ideally carry. Recorded in docs/teacher-portal/permissions.md §4.
 *
 * NOT PORTED: the origin's `CategoryManageDialog`, which is gated on
 * `categories.manage` — a permission no teacher holds, so a teacher never sees
 * the button that opens it. Its absence is faithful rather than a gap.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { callApi } from '../../api';
import { useTeacherSession } from './useTeacherSession';
import TeacherModuleShell from './TeacherModuleShell.vue';
import TeacherStatusBadge from './TeacherStatusBadge.vue';
import type { HrQuery, QueryPriority, QueryStatus, TeacherDirectoryEntry } from '../../types/teacher';

const TABS: ReadonlyArray<{ id: QueryStatus | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'OPEN', label: 'Open' },
  { id: 'RESOLVED', label: 'Resolved' },
  { id: 'ARCHIVED', label: 'Archived' },
];

const session = useTeacherSession();

const queries = ref<HrQuery[]>([]);
const loading = ref(false);
const loadError = ref('');
const banner = ref('');
const tab = ref<QueryStatus | 'ALL'>('ALL');
const search = ref('');

const openId = ref('');
const creating = ref(false);
const submitting = ref(false);
const formError = ref('');

/* Recipient typeahead — the origin's 300 ms debounce. */
const recipientQuery = ref('');
const recipients = ref<TeacherDirectoryEntry[]>([]);
const recipientSearching = ref(false);
const recipientError = ref('');

const form = ref({
  title: '',
  description: '',
  targetUsername: '',
  targetUserName: '',
  category: 'General',
  priority: 'medium' as QueryPriority,
});

/**
 * The origin sources this list from `GET /offence-categories/active` and uses
 * each option's `name` as the value. That endpoint has no teacher-side handler,
 * so the categories are fixed here rather than fetched — the field is required
 * either way, and inventing a fetch for a list the origin also administers is
 * not warranted.
 */
const OFFENCE_CATEGORIES = ['General', 'Conduct', 'Facilities', 'Payroll', 'Academic'];

const visible = computed(() =>
  tab.value === 'ALL' ? queries.value : queries.value.filter((q) => q.status === tab.value),
);

const openQuery = computed(() => queries.value.find((q) => q.id === openId.value) ?? null);

const priorityVariant = (p: QueryPriority): 'destructive' | 'secondary' | 'outline' => {
  if (p === 'high') return 'destructive';
  if (p === 'medium') return 'secondary';
  return 'outline';
};

const statusVariant = (s: QueryStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (s === 'RESOLVED') return 'default';
  if (s === 'ASSIGNED') return 'secondary';
  if (s === 'ARCHIVED') return 'outline';
  return 'destructive';
};

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_HR_QUERIES', {
      schoolID: session.schoolID(),
      teacherUsername: session.username(),
      status: tab.value === 'ALL' ? undefined : tab.value,
      search: search.value || undefined,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load queries.');
    queries.value = data.queries;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load queries.';
  } finally {
    loading.value = false;
  }
};

/* Recipient search, latest-wins. */
let recipientTimer: ReturnType<typeof setTimeout> | undefined;
let recipientSeq = 0;

const searchRecipients = async (needle: string): Promise<void> => {
  const token = ++recipientSeq;
  if (needle.trim().length === 0) {
    recipients.value = [];
    recipientSearching.value = false;
    return;
  }
  recipientSearching.value = true;
  recipientError.value = '';
  try {
    const data = await callApi('GET_TEACHER_DIRECTORY', {
      schoolID: session.schoolID(),
      requesterUsername: session.username(),
      search: needle.trim(),
    });
    if (token !== recipientSeq) return;
    if (data.status !== 'success') throw new Error(data.message || 'Search failed.');
    recipients.value = data.staff;
  } catch (e) {
    if (token !== recipientSeq) return;
    recipientError.value = e instanceof Error ? e.message : 'Could not search for a recipient.';
  } finally {
    if (token === recipientSeq) recipientSearching.value = false;
  }
};

watch(recipientQuery, (value) => {
  clearTimeout(recipientTimer);
  recipientTimer = setTimeout(() => void searchRecipients(value), 300);
});

onBeforeUnmount(() => {
  clearTimeout(recipientTimer);
  recipientSeq += 1;
});

const openCreate = (): void => {
  creating.value = true;
  openId.value = '';
  formError.value = '';
  form.value = {
    title: '',
    description: '',
    targetUsername: '',
    targetUserName: '',
    category: 'General',
    priority: 'medium',
  };
  recipientQuery.value = '';
  recipients.value = [];
};

const closeCreate = (): void => {
  creating.value = false;
  formError.value = '';
};

const pickRecipient = (entry: TeacherDirectoryEntry): void => {
  form.value.targetUsername = entry.username;
  form.value.targetUserName = entry.fullName;
  recipients.value = [];
  recipientQuery.value = '';
};

const submit = async (): Promise<void> => {
  // The origin's three checks, in its order.
  if (!form.value.targetUsername) {
    formError.value = 'Select the recipient';
    return;
  }
  if (!form.value.title.trim()) {
    formError.value = 'Title is required';
    return;
  }
  if (!form.value.description.trim()) {
    formError.value = 'Describe your query';
    return;
  }

  submitting.value = true;
  formError.value = '';
  try {
    const data = await callApi('RAISE_HR_QUERY', {
      schoolID: session.schoolID(),
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      issuerUsername: session.username(),
      issuerName: session.teacherName(),
      targetUsername: form.value.targetUsername,
      targetUserName: form.value.targetUserName,
      category: form.value.category,
      priority: form.value.priority,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Something went wrong.');
    banner.value = `"${form.value.title}" has been sent to the HR team.`;
    closeCreate();
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Something went wrong.';
  } finally {
    submitting.value = false;
  }
};

const update = async (query: HrQuery, status: QueryStatus, assignee?: string): Promise<void> => {
  submitting.value = true;
  try {
    const data = await callApi('UPDATE_HR_QUERY', {
      schoolID: session.schoolID(),
      queryId: query.id,
      status,
      assigneeUsername: assignee,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not update this query.');
    banner.value = `Query marked ${status.toLowerCase()}.`;
    await load();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Could not update this query.';
  } finally {
    submitting.value = false;
  }
};

onMounted(load);
</script>

<template>
  <TeacherModuleShell
    title="HR Queries"
    description="Raise a query for the HR team and track its progress."
    :loading="loading"
    :error="loadError"
    :empty-count="queries.length"
    @retry="load"
    :banner="banner"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button type="button" class="tp-btn tp-btn--primary" @click="openCreate">Create Query</button>
    </template>

    <template #filters>
      <div class="tp-toolbar">
        <div class="tp-tabs" role="tablist" aria-label="Query status">
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
        <input v-model="search" class="tp-input tp-toolbar__search" type="search" placeholder="Search queries..." />
      </div>
    </template>

    <template #empty>
      <p>No queries match your filters.</p>
      <button type="button" class="tp-btn tp-btn--primary tp-empty__cta" @click="openCreate">Create Query</button>
    </template>

    <div v-if="creating" class="tp-card">
      <h3 class="tp-card__title">Create a query</h3>

      <label class="tp-field">
        <span class="tp-field__label">To</span>
        <input
          v-model="recipientQuery"
          class="tp-input"
          type="search"
          placeholder="Search staff..."
          autocomplete="off"
        />
      </label>
      <p v-if="recipientError" class="tp-form__error" role="alert">{{ recipientError }}</p>
      <p v-else-if="recipientSearching" class="tp-inline-note">Searching...</p>
      <p v-else-if="recipientQuery.trim() && recipients.length === 0" class="tp-inline-note">
        No users found.
      </p>
      <ul v-else-if="recipients.length" class="tp-recipients">
        <li v-for="entry in recipients" :key="entry.username">
          <button type="button" class="tp-recipient" @click="pickRecipient(entry)">
            <strong>{{ entry.fullName }}</strong>
            <span>{{ entry.email }}</span>
          </button>
        </li>
      </ul>
      <p v-if="form.targetUserName" class="tp-inline-note">
        Recipient: <strong>{{ form.targetUserName }}</strong>
      </p>

      <label class="tp-field">
        <span class="tp-field__label">Subject</span>
        <input v-model="form.title" class="tp-input" />
      </label>

      <div class="tp-form">
        <label class="tp-field">
          <span class="tp-field__label">Offence</span>
          <select v-model="form.category" class="tp-input">
            <option v-for="entry in OFFENCE_CATEGORIES" :key="entry" :value="entry">{{ entry }}</option>
          </select>
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Priority</span>
          <select v-model="form.priority" class="tp-input">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>

      <label class="tp-field">
        <span class="tp-field__label">Description</span>
        <textarea v-model="form.description" class="tp-input tp-input--area" rows="4" />
      </label>

      <p v-if="formError" class="tp-form__error" role="alert">{{ formError }}</p>

      <div class="tp-detail__actions">
        <button type="button" class="tp-btn tp-btn--ghost" :disabled="submitting" @click="closeCreate">
          Cancel
        </button>
        <button type="button" class="tp-btn tp-btn--primary" :disabled="submitting" @click="submit">
          {{ submitting ? 'Submitting...' : 'Submit query' }}
        </button>
      </div>
    </div>

    <div v-else-if="openQuery" class="tp-card">
      <button type="button" class="tp-btn tp-btn--ghost" @click="openId = ''">&larr; Back to queries</button>
      <h3 class="tp-card__title">{{ openQuery.title }}</h3>
      <p class="tp-inline-note">
        {{ openQuery.issuerName }} &middot; {{ openQuery.category || 'General' }} &middot;
        created {{ openQuery.createdAt.slice(0, 10) }}
      </p>

      <div class="tp-detail__actions">
        <TeacherStatusBadge :status="openQuery.status" :variant="statusVariant(openQuery.status)" />
        <TeacherStatusBadge :status="openQuery.priority" :label="openQuery.priority" :variant="priorityVariant(openQuery.priority)" />
      </div>

      <h4 class="tp-band">DESCRIPTION</h4>
      <p class="tp-inline-note">{{ openQuery.description }}</p>

      <dl class="tp-fields" style="margin-top: 0.75rem">
        <div><dt>From</dt><dd>{{ openQuery.issuerName }}</dd></div>
        <div><dt>To</dt><dd>{{ openQuery.targetUserName || 'Unassigned' }}</dd></div>
      </dl>

      <div v-if="openQuery.response">
        <h4 class="tp-band">RESPONSE</h4>
        <p class="tp-inline-note">{{ openQuery.response }}</p>
      </div>

      <!-- The origin's "Manage query" card: hidden once archived. -->
      <div v-if="openQuery.status !== 'ARCHIVED'" class="tp-card" style="margin-top: 0.75rem">
        <h4 class="tp-card__title">Manage query</h4>
        <div class="tp-detail__actions">
          <button
            v-if="openQuery.status === 'OPEN'"
            type="button"
            class="tp-btn"
            :disabled="submitting"
            @click="update(openQuery, 'ASSIGNED')"
          >
            Assign and keep open
          </button>
          <button
            v-if="openQuery.status !== 'RESOLVED'"
            type="button"
            class="tp-btn tp-btn--primary"
            :disabled="submitting"
            @click="update(openQuery, 'RESOLVED')"
          >
            Mark resolved
          </button>
          <button
            type="button"
            class="tp-btn tp-btn--danger"
            :disabled="submitting"
            @click="update(openQuery, 'ARCHIVED')"
          >
            Archive
          </button>
        </div>
      </div>
    </div>

    <div v-else class="tp-table-wrap">
      <table class="tp-table">
        <caption class="tp-table__caption">{{ visible.length }} query(s)</caption>
        <thead>
          <tr>
            <th scope="col">Subject</th>
            <th scope="col">From</th>
            <th scope="col">To</th>
            <th scope="col">Priority</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="tp-sr">Details</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="query in visible" :key="query.id" class="tp-row" tabindex="0" @click="openId = query.id" @keydown.enter="openId = query.id">
            <td>
              <strong>{{ query.title }}</strong>
              <span class="tp-cellsub">{{ query.category || 'General' }}</span>
            </td>
            <td>{{ query.issuerName }}</td>
            <td>{{ query.targetUserName || '—' }}</td>
            <td>
              <TeacherStatusBadge :status="query.priority" :label="query.priority" :variant="priorityVariant(query.priority)" />
            </td>
            <td>
              <TeacherStatusBadge :status="query.status" :variant="statusVariant(query.status)" />
            </td>
            <td class="tp-table__actions">
              <button type="button" class="tp-btn tp-btn--ghost tp-btn--xs" @click.stop="openId = query.id">
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

.tp-cellsub {
  display: block;
  font-size: 0.6875rem;
  color: var(--text-muted, #5b6472);
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
  display: grid;
  gap: 0.125rem;
}

.tp-recipient:hover {
  background: #f4f8fd;
}
</style>