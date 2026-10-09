<script setup lang="ts">
/*
 * `/central/` — Central Administration (exam-management addendum, D-55).
 *
 * NOT a replica: the origin has no Central Admin role. This console sits above
 * the four school consoles and owns the two jobs the addendum gives it —
 * onboarding staff across every school, and the question review queue that
 * decides whether a teacher's paper goes live (D-53).
 *
 * The accept action is the only path that publishes questions, and it raises a
 * notice for the author; the reject action requires a reason and does the same
 * (D-58).
 */
import { computed, nextTick, onMounted, ref } from 'vue';
import { callApi } from '../api';
import AppShell from '../components/AppShell.vue';
import AppAlert from '../components/AppAlert.vue';
import AppLoading from '../components/AppLoading.vue';
import { filterNav, navFor, takePendingPanel } from '../lib/nav';
import { useSessionStore } from '../stores/session';
import { useIdleTimeout } from '../composables/useIdleTimeout';
import { STORAGE_KEYS } from '../types';
import type {
  AdminAccount,
  AdminRole,
  QuestionStatus,
  QuestionSubmissionRecord,
} from '../types';

type AlertType = 'info' | 'confirm';

type Tab = { id: string; label: string };

const TABS: Tab[] = [
  { id: 'review', label: 'Review Queue' },
  { id: 'bank', label: 'Question Bank' },
  { id: 'staff', label: 'Staff' },
];

const REVIEWER = localStorage.getItem(STORAGE_KEYS.AdminUsername) || '';
const SCHOOL_ID = localStorage.getItem(STORAGE_KEYS.SchoolID) || 'GLOBAL';

const currentRole = localStorage.getItem(STORAGE_KEYS.AdminRole) || 'CENTRAL_ADMIN';
const navMeta = navFor(currentRole);

/* The rail is permission-filtered (D-71): SUPER_ADMIN sees every
   section, every other session only the ones it actually holds. */
const sessionStore = useSessionStore();
const navGroups = computed(
  () => filterNav(navMeta, sessionStore.permissions, currentRole).groups,
);

/* What this session may decide (D-71). These read the same permissions the
   mock's transport enforces, so a control never offers an action that will
   then refuse it. */
const CAN_DECIDE = computed(() => sessionStore.can('review.decide'));
const CAN_ONBOARD = computed(() => sessionStore.can('admins.manage'));

const activeTab = ref<string>(
  takePendingPanel(navMeta, 'activeCentral_Tab') || 'review',
);
const navOpen = ref(false);
const backToTopVisible = ref(false);
const loadingVisible = ref(false);
const copyrightYear = String(new Date().getFullYear());
const identity = ref('Loading Identity...');

const alertVisible = ref(false);
const alertTitle = ref('');
const alertMsg = ref('');
const alertConfirmVisible = ref(false);
let alertConfirmHandler: (() => void) | null = null;

const winAlert = (
  msg: string,
  title: string,
  type: AlertType = 'info',
  onConfirm: (() => void) | null = null,
): void => {
  alertTitle.value = title;
  alertMsg.value = msg;
  alertConfirmVisible.value = type === 'confirm';
  alertConfirmHandler = onConfirm;
  alertVisible.value = true;
};
const closeAlert = (): void => {
  alertVisible.value = false;
  if (alertConfirmHandler) {
    const handler = alertConfirmHandler;
    alertConfirmHandler = null;
    handler();
  }
};

const queue = ref<QuestionSubmissionRecord[]>([]);
const queueCounts = ref<Record<QuestionStatus, number>>({
  DRAFT: 0,
  PENDING_REVIEW: 0,
  LIVE: 0,
  REJECTED: 0,
});
const selected = ref<string[]>([]);
const rejectOpen = ref(false);
const rejectIds = ref<string[]>([]);
const rejectNote = ref('');
const bankFilter = ref<QuestionStatus | 'ALL'>('ALL');
const bank = ref<QuestionSubmissionRecord[]>([]);
const staff = ref<AdminAccount[]>([]);

const newName = ref('');
const newUsername = ref('');
const newEmail = ref('');
const newRole = ref<AdminRole>('TEACHER');
const newSchool = ref('001');
const newPassword = ref('');

const REVIEWABLE_ROLES: AdminRole[] = [
  'TEACHER',
  'SCHOOL_ADMIN',
  'ICT_ADMIN',
  'EXAM_COMMITTEE',
  'CENTRAL_ADMIN',
];
const SCHOOL_OPTIONS = ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010'];

const pendingLabel = computed(() => `${queue.value.length} paper(s) awaiting a decision.`);
const allPendingSelected = computed(
  () => queue.value.length > 0 && selected.value.length === queue.value.length,
);

const statusLabel = (status: QuestionStatus): string =>
  ({ DRAFT: 'DRAFT', PENDING_REVIEW: 'IN REVIEW', LIVE: 'LIVE', REJECTED: 'REJECTED' })[status];

const formatStamp = (value: string): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 16).replace('T', ' ');
};

/* ── review queue ──────────────────────────────────────────────────────── */

const loadQueue = async (): Promise<void> => {
  loadingVisible.value = true;
  try {
    const data = await callApi('GET_REVIEW_QUEUE', { schoolID: SCHOOL_ID });
    if (data.status !== 'success') throw new Error(data.message || 'read failed');
    queue.value = data.submissions;
    queueCounts.value = data.counts || queueCounts.value;
    selected.value = selected.value.filter((id) => queue.value.some((item) => item.SubmissionID === id));
  } catch {
    queue.value = [];
  }
  loadingVisible.value = false;
};

const loadBank = async (): Promise<void> => {
  const wanted = bankFilter.value === 'ALL' ? 'PENDING_REVIEW' : bankFilter.value;
  try {
    const data = await callApi('GET_REVIEW_QUEUE', { schoolID: SCHOOL_ID, status: wanted });
    if (data.status === 'success') bank.value = data.submissions;
  } catch {
    bank.value = [];
  }
};

const toggleQueueRow = (id: string): void => {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((x) => x !== id)
    : [...selected.value, id];
};

const toggleAllPending = (): void => {
  selected.value = allPendingSelected.value ? [] : queue.value.map((item) => item.SubmissionID);
};

/** Group accept — the addendum asks for group editing as well as individual. */
const acceptSelected = (): void => {
  const ids = selected.value;
  if (ids.length === 0) {
    winAlert('Selection Required', 'Select at least one paper to accept.');
    return;
  }
  winAlert(
    `Accept ${ids.length} submission(s)? Their questions go live immediately and the author(s) are notified.`,
    'ACCEPT SUBMISSIONS',
    'confirm',
    () => {
      void (async () => {
        loadingVisible.value = true;
        try {
          const data = await callApi('ACCEPT_QUESTION_SUBMISSION', {
            schoolID: SCHOOL_ID,
            submissionIds: ids,
            reviewerUsername: REVIEWER,
            note: 'Accepted by the central review team.',
          });
          if (data.status !== 'success') throw new Error(data.message || 'Accept failed.');
          for (const id of ids) void notifyAuthor(id, 'ACCEPTED', 'Accepted by the central review team.');
          winAlert('Accepted', data.message || 'Accepted.');
          selected.value = [];
          await loadQueue();
          if (activeTab.value === 'bank') await loadBank();
        } catch (e) {
          winAlert('Accept Failed', e instanceof Error ? e.message : 'Could not accept those papers.');
        }
        loadingVisible.value = false;
      })();
    },
  );
};

const rejectSelected = (): void => {
  const ids = selected.value;
  if (ids.length === 0) {
    winAlert('Selection Required', 'Select at least one paper to reject.');
    return;
  }
  /*
   * The reason is typed into the panel rather than a window.prompt: the origin
   * raises its own alert dialog, and a native prompt is unstyled, untranslated
   * and cannot carry the portal's own controls. The teacher reads this text
   * verbatim on their Decisions tab, so it is required before the decision runs.
   */
  rejectIds.value = ids;
  rejectNote.value = '';
  rejectOpen.value = true;
};

const confirmReject = (): void => {
  const note = rejectNote.value.trim();
  if (!note) {
    winAlert('Reason Required', 'A rejection needs a reason for the teacher.');
    return;
  }
  const ids = rejectIds.value;
  rejectOpen.value = false;
  void (async () => {
    loadingVisible.value = true;
    try {
      const data = await callApi('REJECT_QUESTION_SUBMISSION', {
        schoolID: SCHOOL_ID,
        submissionIds: ids,
        reviewerUsername: REVIEWER,
        note,
      });
      if (data.status !== 'success') throw new Error(data.message || 'Reject failed.');
      for (const id of ids) void notifyAuthor(id, 'REJECTED', note);
      winAlert('Rejected', data.message || 'Rejected.');
      selected.value = [];
      rejectNote.value = '';
      await loadQueue();
      if (activeTab.value === 'bank') await loadBank();
    } catch (e) {
      winAlert('Reject Failed', e instanceof Error ? e.message : 'Could not reject those papers.');
    }
    loadingVisible.value = false;
  })();
};

const cancelReject = (): void => {
  rejectOpen.value = false;
  rejectNote.value = '';
  rejectIds.value = [];
};

/** The decision notice is raised server-side; this is the email half (D-58). */
const notifyAuthor = async (
  submissionId: string,
  decision: 'ACCEPTED' | 'REJECTED',
  note: string,
): Promise<void> => {
  const submission = [...queue.value, ...bank.value].find((item) => item.SubmissionID === submissionId);
  if (!submission) return;
  const teacher = staff.value.find((a) => a.Username === submission.SubmittedBy);
  try {
    await callApi('SEND_QUESTION_DECISION_EMAIL', {
      schoolID: submission.SchoolID,
      teacherUsername: submission.SubmittedBy,
      teacherEmail: teacher?.Email || '',
      submissionId,
      decision,
      note,
    });
  } catch {
    /* the in-page notice is the record; the email is best-effort, as D-58 says */
  }
};

/* ── staff onboarding across schools ───────────────────────────────────── */

const loadStaff = async (): Promise<void> => {
  loadingVisible.value = true;
  try {
    const data = await callApi('GET_COGNITO_ADMINS', { schoolID: SCHOOL_ID });
    if (data.status === 'success' && Array.isArray(data.admins)) {
      staff.value = data.admins;
    } else {
      staff.value = [];
    }
  } catch {
    staff.value = [];
  }
  loadingVisible.value = false;
};

const onboardStaff = (): void => {
  const name = newName.value.trim();
  const username = newUsername.value.trim();
  const email = newEmail.value.trim();
  const password = newPassword.value.trim();
  if (!name || !username || !email || !password) {
    winAlert('Required', 'Fill the name, username, email and a starting password.');
    return;
  }
  if (!/^[A-Za-z0-9._@-]+$/.test(username)) {
    winAlert('Invalid Username', 'Usernames take letters, numbers, @, dot, underscore or hyphen only.');
    return;
  }
  void (async () => {
    loadingVisible.value = true;
    try {
      const data = await callApi('CREATE_ADMIN_ACCESS', {
        schoolID: newSchool.value,
        fullName: name,
        username,
        email,
        password,
        targetRole: newRole.value,
        creatorUsername: REVIEWER,
        creatorRole: 'CENTRAL_ADMIN',
        creatorSchoolID: SCHOOL_ID,
      });
      if (data.status !== 'success') throw new Error(data.message || 'Could not create the account.');
      winAlert('Access Granted', data.message || `${username} onboarded to ${newSchool.value}.`);
      newName.value = '';
      newUsername.value = '';
      newEmail.value = '';
      newPassword.value = '';
      await loadStaff();
    } catch (e) {
      winAlert('Onboarding Failed', e instanceof Error ? e.message : 'Could not onboard that account.');
    }
    loadingVisible.value = false;
  })();
};

const revokeStaff = (account: AdminAccount): void => {
  winAlert(
    `Remove ${account.Username} (${account.Role}) from the staff directory?`,
    'REVOKE ACCESS',
    'confirm',
    () => {
      void (async () => {
        loadingVisible.value = true;
        try {
          const data = await callApi('DELETE_ADMIN_ACCESS', {
            username: account.Username,
            email: account.Email || '',
            schoolID: account.SchoolID,
            requestorUsername: REVIEWER,
            requestorRole: 'CENTRAL_ADMIN',
            requestorSchoolID: SCHOOL_ID,
          });
          if (data.status !== 'success') throw new Error(data.message || 'Could not revoke access.');
          winAlert('Access Revoked', data.message || `${account.Username} removed.`);
          await loadStaff();
        } catch (e) {
          winAlert('Revoke Failed', e instanceof Error ? e.message : 'Could not revoke access.');
        }
        loadingVisible.value = false;
      })();
    },
  );
};

/* ── chrome ────────────────────────────────────────────────────────────── */

const showTab = (tabId: string): void => {
  activeTab.value = tabId;
  localStorage.setItem('activeCentral_Tab', tabId);
  if (window.innerWidth <= 900) navOpen.value = false;
  if (tabId === 'staff') void loadStaff();
  if (tabId === 'bank') void loadBank();
};

const syncHeaderOffset = (): void => {
  const header = document.querySelector('.page-header') as HTMLElement | null;
  if (header) {
    document.documentElement.style.setProperty('--header-offset', `${header.offsetHeight}px`);
  }
};

const toggleBackToTopButton = (): void => {
  backToTopVisible.value = window.scrollY > 320;
};

const scrollToTopPage = (): void => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const toggleNav = (): void => {
  navOpen.value = !navOpen.value;
};

const handleLogout = (): void => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = '/control/';
};

useIdleTimeout({ mode: 'admin' });

onMounted(async () => {
  if (!localStorage.getItem(STORAGE_KEYS.LAEC_Session)) {
    window.location.href = '/control/';
    return;
  }
  /* The operator's name, not "CENTRAL ADMIN: <name>" — the prefix restated the
     role badge beside it and was the part that got ellipsised. */
  const name = localStorage.getItem(STORAGE_KEYS.AdminName);
  identity.value = name || 'Central Administration';

  await nextTick();
  syncHeaderOffset();
  toggleBackToTopButton();
  window.addEventListener('resize', syncHeaderOffset);
  window.addEventListener('scroll', toggleBackToTopButton, { passive: true });

  const saved = localStorage.getItem('activeCentral_Tab') || 'review';
  showTab(TABS.some((t) => t.id === saved) ? saved : 'review');

  const hooks = ((window as unknown as Record<string, unknown>).__LAEC_ADMIN_HOOKS__ ??=
    {}) as Record<string, unknown>;
  Object.assign(hooks, { winAlert, closeAlert, toggleNav, showTab, scrollToTopPage, handleLogout });

  await loadQueue();
  await loadStaff();
});
</script>

<template>
    <AppLoading :visible="loadingVisible" text="LAEC Central Administration Syncing..." />

    <AppAlert
      :visible="alertVisible"
      :title="alertTitle"
      :msg="alertMsg"
      cancel-visible
      :confirm-visible="alertConfirmVisible"
      @close="closeAlert()"
      @confirm="closeAlert()"
    />

    <AppShell
      :role="currentRole"
      :role-label="navMeta.roleLabel"
      :breadcrumb="navMeta.breadcrumb"
      :groups="navGroups"
      :scope="SCHOOL_ID"
      :scope-kind="navMeta.scopeKind"
      :active-id="activeTab"
      :identity="identity"
      @select="showTab"
      @logout="handleLogout()"
    >

    <button
      class="back-to-top"
      id="backToTopBtn"
      aria-label="Back to top"
      :class="{ visible: backToTopVisible }"
      @click="scrollToTopPage()"
    >
      ↑
    </button>

    <div class="view-well">
      <!-- ── REVIEW QUEUE ─────────────────────────────── -->
      <div id="review" class="tab-panel" :class="{ active: activeTab === 'review' }">
        <div class="control-box">
          <div>
            <h2 style="margin: 0">Question Review Queue</h2>
            <p id="queue-hint" style="opacity: 0.8; margin: 5px 0 0">{{ pendingLabel }}</p>
          </div>
          <div class="control-actions">
            <button id="refresh-queue" class="btn-success" @click="loadQueue()">REFRESH</button>
            <button id="accept-selected" class="btn-primary" v-if="CAN_DECIDE" @click="acceptSelected()">
              ACCEPT ({{ selected.length }})
            </button>
            <button id="reject-selected" class="btn-danger" v-if="CAN_DECIDE" @click="rejectSelected()">
              REJECT ({{ selected.length }})
            </button>
          </div>
        </div>

        <div class="status-chips">
          <span class="status-chip draft">Drafts: {{ queueCounts.DRAFT || 0 }}</span>
          <span class="status-chip pending">In review: {{ queueCounts.PENDING_REVIEW || 0 }}</span>
          <span class="status-chip live">Live: {{ queueCounts.LIVE || 0 }}</span>
          <span class="status-chip rejected">Rejected: {{ queueCounts.REJECTED || 0 }}</span>
        </div>


        <div v-if="rejectOpen" id="reject-panel" class="reject-panel">
          <h3 style="margin: 0 0 6px; color: var(--danger)">Reason for rejection</h3>
          <p style="margin: 0 0 10px; color: var(--text-soft); font-size: 0.8rem">
            The teacher sees this text verbatim. {{ rejectIds.length }} paper(s) selected.
          </p>
          <textarea
            id="reject-note"
            v-model="rejectNote"
            rows="3"
            placeholder="e.g. Option C is missing for item 1 — please re-check and resubmit."
          ></textarea>
          <div class="composer-actions">
            <button id="confirm-reject" class="btn-danger" @click="confirmReject()">CONFIRM REJECTION</button>
            <button id="cancel-reject" class="btn-secondary" @click="cancelReject()">CANCEL</button>
          </div>
        </div>

        <div class="table-responsive">
          <table id="queue-table">
            <thead>
              <tr>
                <th style="width: 40px">
                  <input
                    type="checkbox"
                    id="select-all-pending"
                    :checked="allPendingSelected"
                    aria-label="Select every pending paper"
                    @change="toggleAllPending()"
                  />
                </th>
                <th>ID</th>
                <th>Subject</th>
                <th>Class</th>
                <th>Category</th>
                <th>Author</th>
                <th>Questions</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="queue-body">
              <tr v-for="item in queue" :key="item.SubmissionID">
                <td>
                  <input
                    type="checkbox"
                    :checked="selected.includes(item.SubmissionID)"
                    :aria-label="'Select ' + item.SubmissionID"
                    @change="toggleQueueRow(item.SubmissionID)"
                  />
                </td>
                <td>{{ item.SubmissionID }}</td>
                <td>{{ item.Subject.replace(/_/g, ' ') }}</td>
                <td>{{ item.Class }}</td>
                <td>{{ item.Category }}</td>
                <td>{{ item.SubmittedByName }}</td>
                <td>{{ item.QuestionCount }}</td>
                <td>{{ formatStamp(item.SubmittedAt) }}</td>
                <td class="row-actions">
                  <button class="btn-primary" v-if="CAN_DECIDE" @click="selected = [item.SubmissionID]; acceptSelected()">
                    ACCEPT
                  </button>
                  <button class="btn-danger" v-if="CAN_DECIDE" @click="selected = [item.SubmissionID]; rejectSelected()">
                    REJECT
                  </button>
                </td>
              </tr>
              <tr v-if="queue.length === 0">
                <td :colspan="9" class="empty-cell" id="queue-empty">
                  The queue is clear. Nothing is awaiting a decision.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── QUESTION BANK ─────────────────────────────── -->
      <div id="bank" class="tab-panel" :class="{ active: activeTab === 'bank' }">
        <div class="control-box">
          <div>
            <h2 style="margin: 0">Question Bank</h2>
            <p style="opacity: 0.8; margin: 5px 0 0">Every paper and the state it is in.</p>
          </div>
          <div class="control-actions">
            <select id="bank-filter" v-model="bankFilter" @change="loadBank()">
              <option value="DRAFT">DRAFT</option>
              <option value="PENDING_REVIEW">IN REVIEW</option>
              <option value="LIVE">LIVE</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
        </div>

        <div class="table-responsive">
          <table id="bank-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Subject</th>
                <th>Class</th>
                <th>Questions</th>
                <th>Status</th>
                <th>Author</th>
                <th>Reviewed by</th>
                <th>Review note</th>
              </tr>
            </thead>
            <tbody id="bank-body">
              <tr v-for="item in bank" :key="item.SubmissionID">
                <td>{{ item.SubmissionID }}</td>
                <td>{{ item.Subject.replace(/_/g, ' ') }}</td>
                <td>{{ item.Class }}</td>
                <td>{{ item.QuestionCount }}</td>
                <td>
                  <span class="status-badge" :class="item.Status.toLowerCase()">{{ statusLabel(item.Status) }}</span>
                </td>
                <td>{{ item.SubmittedByName }}</td>
                <td>{{ item.ReviewedBy || '—' }}</td>
                <td>{{ item.ReviewNote || '—' }}</td>
              </tr>
              <tr v-if="bank.length === 0">
                <td :colspan="8" class="empty-cell">No papers in that state.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── STAFF ─────────────────────────────────────── -->
      <div id="staff" class="tab-panel" :class="{ active: activeTab === 'staff' }">
        <div class="control-box">
          <div>
            <h2 style="margin: 0">Onboard Staff</h2>
            <p style="opacity: 0.8; margin: 5px 0 0">
              A Central Admin can place staff in any school, including teachers.
            </p>
          </div>
          <div>
            <button id="refresh-staff" class="btn-success" @click="loadStaff()">REFRESH</button>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label for="staff-name">Full name</label>
            <input id="staff-name" v-model="newName" type="text" placeholder="e.g. Mrs Adesuwa Bello" />
          </div>
          <div class="form-group">
            <label for="staff-username">Username</label>
            <input id="staff-username" v-model="newUsername" type="text" placeholder="e.g. teacher3" />
          </div>
          <div class="form-group">
            <label for="staff-email">Email</label>
            <input id="staff-email" v-model="newEmail" type="email" placeholder="name@school.test" />
          </div>
          <div class="form-group">
            <label for="staff-role">Role</label>
            <select id="staff-role" v-model="newRole">
              <option v-for="role in REVIEWABLE_ROLES" :key="role" :value="role">{{ role }}</option>
            </select>
          </div>
          <div class="form-group">
            <label for="staff-school">School</label>
            <select id="staff-school" v-model="newSchool">
              <option v-for="code in SCHOOL_OPTIONS" :key="code" :value="code">{{ code }}</option>
            </select>
          </div>
          <div class="form-group">
            <label for="staff-password">Starting password</label>
            <input id="staff-password" v-model="newPassword" type="text" placeholder="Temp@2026" />
          </div>
        </div>

        <div class="composer-actions">
          <button id="onboard-staff" class="btn-primary" v-if="CAN_ONBOARD" @click="onboardStaff()">ONBOARD STAFF</button>
        </div>

        <div class="table-responsive" style="margin-top: 18px">
          <table id="staff-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>School</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="staff-body">
              <tr v-for="account in staff" :key="account.Username">
                <td>{{ account.FullName }}</td>
                <td>{{ account.Username }}</td>
                <td>{{ account.Email }}</td>
                <td>{{ account.Role }}</td>
                <td>{{ account.SchoolID }}</td>
                <td>{{ account.Status || 'ACTIVE' }}</td>
                <td class="row-actions">
                  <button
                    v-if="account.Username !== REVIEWER"
                    class="btn-danger"
                    @click="revokeStaff(account)"
                  >
                    REVOKE
                  </button>
                </td>
              </tr>
              <tr v-if="staff.length === 0">
                <td :colspan="7" class="empty-cell">No staff records.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <footer class="page-footer">
      <p>
        LAEC CLOUD-BASED INTEGRATED EXAMINATION MANAGEMENT SYSTEM © {{ copyrightYear }} NICEGENE TECHNOLOGIES. All
        Rights Reserved.
      </p>
    </footer>
    </AppShell>
</template>

<style>
/* Shares the enterprise chrome with /teacher/ and the four consoles (D-57). */
.surface-enterprise .page-header {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  background: linear-gradient(135deg, var(--laec-blue) 0%, var(--laec-blue-deep) 100%);
  color: #ffffff;
  box-shadow: var(--shadow);
}
.surface-enterprise .header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 22px;
  gap: 16px;
  flex-wrap: wrap;
}
.surface-enterprise .logo-section h1 {
  margin: 0;
  font-size: 1.35rem;
  letter-spacing: 0.5px;
  font-family: 'Space Grotesk', 'Manrope', sans-serif;
}
.surface-enterprise .logo-section .subtitle {
  margin: 3px 0 0;
  font-size: 0.78rem;
  opacity: 0.85;
}
.surface-enterprise .header-actions,
.surface-enterprise .control-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.surface-enterprise .logout-btn-header,
.surface-enterprise .logout-btn-drawer {
  background: var(--danger);
  color: #ffffff;
  border: 0;
  border-radius: 6px;
  padding: 8px 14px;
  font-weight: 800;
  cursor: pointer;
  font-size: 0.75rem;
}
.surface-enterprise .nav-container {
  background: rgba(0, 0, 0, 0.18);
  padding: 0 12px;
}
.surface-enterprise .nav-tabs {
  display: flex;
  gap: 2px;
  overflow-x: auto;
}
.surface-enterprise .nav-tabs .tab {
  padding: 11px 18px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.8rem;
  white-space: nowrap;
  border-bottom: 3px solid transparent;
}
.surface-enterprise .nav-tabs .tab.active {
  border-bottom-color: var(--laec-accent);
  background: rgba(255, 255, 255, 0.1);
}
.surface-enterprise .main-content { box-sizing: border-box; width: 100%; }
.surface-enterprise .main-content > * { max-width: 100%; }
.surface-enterprise .table-responsive > table { min-width: 640px; }
.surface-enterprise .main-content {
  padding: calc(var(--header-offset, 130px) + 18px) 22px 40px;
  max-width: 1400px;
  margin: 0 auto;
}
.surface-enterprise .control-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  background: #ffffff;
  border: 1px solid var(--border);
  border-left: 4px solid var(--laec-accent);
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 16px;
  color: var(--text-dark);
}
.surface-enterprise .status-chips {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.surface-enterprise .status-chip {
  border-radius: 999px;
  padding: 5px 13px;
  font-size: 0.72rem;
  font-weight: 800;
  border: 1px solid var(--border);
  background: #ffffff;
  color: var(--text-soft);
}
.surface-enterprise .status-chip.draft { border-color: var(--text-soft); color: var(--text-soft); }
.surface-enterprise .status-chip.pending { border-color: var(--warning); color: #8a6104; }
.surface-enterprise .status-chip.live { border-color: var(--success); color: var(--success); }
.surface-enterprise .status-chip.rejected { border-color: var(--danger); color: var(--danger); }
.surface-enterprise .status-badge {
  display: inline-block;
  border-radius: 4px;
  padding: 3px 9px;
  font-size: 0.68rem;
  font-weight: 800;
  background: #eef3f8;
  color: var(--text-soft);
}
.surface-enterprise .status-badge.live { background: #e5f6ed; color: var(--success); }
.surface-enterprise .status-badge.pending_review { background: #fdf3dd; color: #8a6104; }
.surface-enterprise .status-badge.draft { background: #eef3f8; color: var(--text-soft); }
.surface-enterprise .status-badge.rejected { background: #fbe9e9; color: var(--danger); }
.surface-enterprise .table-responsive {
  overflow-x: auto;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.surface-enterprise table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.surface-enterprise th {
  background: var(--bg-soft);
  color: var(--text-soft);
  text-align: left;
  padding: 10px 12px;
  font-size: 0.7rem;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  white-space: nowrap;
}
.surface-enterprise td {
  padding: 10px 12px;
  border-top: 1px solid var(--border);
  vertical-align: middle;
}
.surface-enterprise .row-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.surface-enterprise .empty-cell {
  text-align: center;
  color: var(--text-soft);
  padding: 26px 12px;
  font-style: italic;
}
.surface-enterprise .form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 14px;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px 18px;
}
.surface-enterprise .form-group label {
  display: block;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--text-soft);
  margin-bottom: 5px;
}
.surface-enterprise select,
.surface-enterprise input[type='text'],
.surface-enterprise input[type='email'] {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.82rem;
  font-family: inherit;
  color: var(--text-dark);
  background: #ffffff;
}
.surface-enterprise .reject-panel {
  background: #fff7f7;
  border: 1px solid var(--danger);
  border-radius: 8px;
  padding: 16px 18px;
  margin-bottom: 16px;
}
.surface-enterprise .reject-panel textarea {
  width: 100%;
  padding: 9px 11px;
  border: 1px solid var(--danger);
  border-radius: 6px;
  font-size: 0.84rem;
  font-family: inherit;
  color: var(--text-dark);
  background: #ffffff;
  resize: vertical;
}
.surface-enterprise .composer-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  flex-wrap: wrap;
}
.surface-enterprise .page-footer {
  text-align: center;
  padding: 18px;
  color: var(--text-soft);
  font-size: 0.72rem;
  border-top: 1px solid var(--border);
  background: #ffffff;
}
.surface-enterprise .back-to-top {
  position: fixed;
  right: 22px;
  bottom: 22px;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 0;
  background: var(--laec-blue);
  color: #ffffff;
  font-size: 1.1rem;
  font-weight: 800;
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease;
  z-index: var(--z-furniture);
}
.surface-enterprise .back-to-top.visible { opacity: 1; visibility: visible; }
.surface-enterprise .tab-panel { display: none; }
.surface-enterprise .tab-panel.active { display: block; }
.surface-enterprise #custom-alert,
.surface-enterprise #loading-overlay {
  position: fixed;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(11, 34, 66, 0.72);
  z-index: var(--z-modal);
}
.surface-enterprise .alert-content {
  background: #ffffff;
  border-radius: 12px;
  padding: 22px 26px;
  max-width: 460px;
  width: 92%;
}
.surface-enterprise #alert-msg { color: var(--text-dark); white-space: pre-line; }
.surface-enterprise .alert-btns {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 16px;
  flex-wrap: wrap;
}
.surface-enterprise .spinner {
  width: 42px;
  height: 42px;
  border: 4px solid #ffffff33;
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: laec-central-spin 0.9s linear infinite;
}
@keyframes laec-central-spin { to { transform: rotate(360deg); } }
.surface-enterprise #loading-overlay {
  flex-direction: column;
  color: #ffffff;
  text-align: center;
}
.surface-enterprise .btn-primary,
.surface-enterprise .btn-secondary,
.surface-enterprise .btn-success,
.surface-enterprise .btn-warning,
.surface-enterprise .btn-danger {
  border: 0;
  border-radius: 6px;
  padding: 8px 14px;
  font-weight: 800;
  font-size: 0.74rem;
  cursor: pointer;
  color: #ffffff;
  white-space: nowrap;
}
.surface-enterprise .btn-primary { background: var(--laec-blue); }
.surface-enterprise .btn-secondary { background: var(--text-soft); }
.surface-enterprise .btn-success { background: var(--success); }
.surface-enterprise .btn-warning { background: var(--warning); color: #3d2c00; }
.surface-enterprise .btn-danger { background: var(--danger); }

/*
 * Same idiom the four generated console stylesheets use (ca-page.css line 1117):
 * the document scrolls horizontally because a question table is wider than a
 * phone, and clipping on the html element is what keeps that inside the table
 * container rather than letting it push the page (D-59).
 */
html:has(body.surface-enterprise.page-central),
body.surface-enterprise.page-central {
  overflow-x: hidden;
}
/*
 * The enterprise surface is a flex column, and `.table-responsive` is a flex
 * item inside it. A flex item sized `max-width: 100%` resolves against an
 * already-widened parent, so a wide table still pushes the page out to its
 * intrinsic width. Clipping the outer wrapper and letting the table container
 * scroll horizontally is what actually holds the viewport (D-59).
 */
.surface-enterprise { overflow-x: hidden; }
.surface-enterprise .table-responsive { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.surface-enterprise .table-responsive > table { min-width: 620px; }
.surface-enterprise .reject-panel textarea { max-width: 100%; }

/*
 * Narrow viewports (D-59). The question and staff tables are wider than a
 * phone on purpose - a question needs its stem and four options legible - so
 * they scroll inside their own container rather than widening the page. The
 * `min-width: 0` on the grid and flex children is what stops a wide table from
 * pushing the whole layout past the viewport.
 */
.surface-enterprise .main-content,
.surface-enterprise .tab-panel,
.surface-enterprise .control-box,
.surface-enterprise .form-grid,
.surface-enterprise .table-responsive,
.surface-enterprise .notice-list,
.surface-enterprise .reject-panel {
  min-width: 0;
  max-width: 100%;
}
.surface-enterprise .header-content > *,
.surface-enterprise .control-box > * {
  min-width: 0;
}
.surface-enterprise .table-responsive { overflow-x: auto; }
@media (max-width: 768px) {
  .surface-enterprise .form-grid { grid-template-columns: 1fr; }
  .surface-enterprise .control-box { flex-direction: column; align-items: flex-start; }
  .surface-enterprise .control-actions { width: 100%; }
  .surface-enterprise .control-actions > * { flex: 1 1 auto; }
  .surface-enterprise .notice-time { margin-left: 0; width: 100%; }
}

@media (max-width: 768px) {
  .surface-enterprise .main-content { padding: calc(var(--header-offset, 160px) + 12px) 12px 32px; }
  .surface-enterprise .header-content { padding: 12px 14px; }
  .surface-enterprise .logo-section h1 { font-size: 1.05rem; }
}
</style>
