<script setup lang="ts">
/*
 * `/notices/` — Notice Board (D-64).
 *
 * Carried over from the reference school-management application's notice board:
 * publish, read, search, and pin. What changes for an examination portal is the
 * audience model — notices are addressed to a role, not to a department — and
 * the fact that publishing raises a notification, so the two features are one
 * system rather than two that drift apart.
 *
 * Not an origin page. Shared AppShell (D-60), same tokens (D-63).
 */
import { computed, nextTick, onMounted, ref } from 'vue';
import { callApi } from '../api';
import AppShell from '../components/AppShell.vue';
import AppAlert from '../components/AppAlert.vue';
import { PENDING_PANEL_KEY, consolePathFor, filterNav, navFor } from '../lib/nav';
import { useSessionStore } from '../stores/session';
import { STORAGE_KEYS } from '../types';
import type { NoticeAudience, NoticeBoardItem } from '../types';
import { useIdleTimeout } from '../composables/useIdleTimeout';

const ROLE = localStorage.getItem(STORAGE_KEYS.AdminRole) || '';
const IDENTITY = localStorage.getItem(STORAGE_KEYS.AdminName) || '';
const USERNAME = localStorage.getItem(STORAGE_KEYS.AdminUsername) || '';
const SCHOOL_ID = localStorage.getItem(STORAGE_KEYS.SchoolID) || '';
const navMeta = navFor(ROLE);
const currentRole = ROLE;

/* The rail is permission-filtered (D-71): SUPER_ADMIN sees every
   section, every other session only the ones it actually holds. */
const sessionStore = useSessionStore();
const navGroups = computed(
  () => filterNav(navMeta, sessionStore.permissions, currentRole).groups,
);

/**
 * Publishing is a privilege, not a role name (D-71).
 *
 * Both roles that hold `notices.publish` have it by default, and reading the
 * permission rather than comparing the claim means this control agrees with
 * the gate the transport enforces — a button that renders is a button that
 * works.
 */
const CAN_PUBLISH = computed(() => sessionStore.can('notices.publish'));
const CAN_WITHDRAW = computed(() => sessionStore.can('notices.delete'));

const AUDIENCES: Array<{ value: NoticeAudience; label: string }> = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'SCHOOL_ADMIN', label: 'School Admins' },
  { value: 'ICT_ADMIN', label: 'ICT Admins' },
  { value: 'EXAM_COMMITTEE', label: 'Exam Committee' },
  { value: 'TEACHER', label: 'Teachers' },
  { value: 'CENTRAL_ADMIN', label: 'Central Admins' },
  { value: 'SUPER_ADMIN', label: 'Super Admins' },
];

const notices = ref<NoticeBoardItem[]>([]);
const search = ref('');
const loading = ref(false);
const composerOpen = ref(false);

const alertVisible = ref(false);
const alertTitle = ref('');
const alertMsg = ref('');
const winAlert = (msg: string, title: string): void => {
  alertMsg.value = msg;
  alertTitle.value = title;
  alertVisible.value = true;
};

const draft = ref({ title: '', body: '', audience: 'ALL' as NoticeAudience, pinned: false });

const visible = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return notices.value;
  return notices.value.filter(
    (n) => n.Title.toLowerCase().includes(q) || n.Body.toLowerCase().includes(q) || n.AuthorName.toLowerCase().includes(q),
  );
});

const audienceLabel = (a: NoticeAudience): string => AUDIENCES.find((x) => x.value === a)?.label || a;

const formatStamp = (iso: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 16).replace('T', ' ');
};

const loadNotices = async (): Promise<void> => {
  loading.value = true;
  try {
    const data = await callApi('GET_NOTICES', { schoolID: SCHOOL_ID, role: ROLE });
    if (data.status !== 'success') throw new Error(data.message || 'read failed');
    notices.value = data.notices;
  } catch {
    notices.value = [];
  }
  loading.value = false;
};

const publish = (): void => {
  const title = draft.value.title.trim();
  const body = draft.value.body.trim();
  if (!title || !body) {
    winAlert('A notice needs both a title and a body.', 'Incomplete notice');
    return;
  }
  void (async () => {
    loading.value = true;
    try {
      const data = await callApi('PUBLISH_NOTICE', {
        schoolID: SCHOOL_ID,
        title: title,
        body: body,
        audience: draft.value.audience,
        authorUsername: USERNAME,
        authorName: IDENTITY || USERNAME,
        pinned: draft.value.pinned,
      });
      if (data.status !== 'success') throw new Error(data.message || 'Publish failed.');
      winAlert(`"${data.notice?.Title || title}" published to ${audienceLabel(draft.value.audience).toLowerCase()}.`, 'Notice published');
      draft.value = { title: '', body: '', audience: 'ALL', pinned: false };
      composerOpen.value = false;
      await loadNotices();
    } catch (e) {
      winAlert(e instanceof Error ? e.message : 'Could not publish that notice.', 'Publish failed');
    }
    loading.value = false;
  })();
};

const withdraw = (item: NoticeBoardItem): void => {
  void (async () => {
    loading.value = true;
    const data = await callApi('DELETE_NOTICE', {
      schoolID: SCHOOL_ID,
      noticeId: item.NoticeID,
      requestorUsername: USERNAME,
    });
    if (data.status === 'success') {
      winAlert(`${item.Title} withdrawn.`, 'Notice withdrawn');
      await loadNotices();
    } else {
      winAlert(data.message || 'Could not withdraw that notice.', 'Withdraw failed');
    }
    loading.value = false;
  })();
};

const showTab = (id: string): void => {
  /*
   * Cross-navigation from a shared surface (D-71).
   *
   * A document entry goes to its own route. A panel entry parks itself
   * so the console that owns it opens on that panel, and navigates to
   * that console. The id is never turned into a path: these ids are
   * panel names, not documents, and building `/` + id + `/` from them
   * produced /dashboard/, /review/ and /bank/ - none of which exist,
   * each landing on a blank page.
   */
  const target = navGroups.value.flatMap((g) => g.items).find((i) => i.id === id);
  if (!target) return;
  if (target.route) {
    if (target.route !== window.location.pathname) window.location.href = target.route;
    return;
  }
  sessionStorage.setItem(PENDING_PANEL_KEY, id);
  window.location.href = consolePathFor(ROLE);
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
  await nextTick();
  await loadNotices();
});
</script>

<template>
  <AppShell
    :role="currentRole"
    :role-label="navMeta.roleLabel"
    :breadcrumb="navMeta.breadcrumb"
    :groups="navGroups"
    :scope="navMeta.scopeKind === 'global' ? 'GLOBAL' : SCHOOL_ID"
    :scope-kind="navMeta.scopeKind"
    active-id="notice-board"
    :identity="IDENTITY"
    @select="showTab"
    @logout="handleLogout"
  >
    <AppAlert
      :visible="alertVisible"
      :title="alertTitle"
      :msg="alertMsg"
      :title-accent="false"
      @close="alertVisible = false"
    />

    <header class="page-head">
      <div>
        <h1>Notice Board</h1>
        <p class="page-sub">
          {{ visible.length }} notice(s) for you. Publishing also raises a notification for the audience.
        </p>
      </div>
      <div class="page-head-tools">
        <label class="field">
          <span>Search</span>
          <input id="notice-search" v-model="search" type="search" placeholder="Title, body or author" />
        </label>
        <button
          v-if="CAN_PUBLISH"
          id="compose-notice"
          class="btn-primary"
          @click="composerOpen = !composerOpen"
        >
          {{ composerOpen ? 'CLOSE' : 'PUBLISH NOTICE' }}
        </button>
      </div>
    </header>

    <section v-if="composerOpen" id="notice-composer" class="card">
      <h2>Publish a notice</h2>
      <div class="form-grid">
        <label class="field field-wide">
          <span>Title</span>
          <input id="notice-title" v-model="draft.title" type="text" placeholder="e.g. Portal maintenance on Saturday" />
        </label>
        <label class="field field-wide">
          <span>Body</span>
          <textarea id="notice-body" v-model="draft.body" rows="4" placeholder="What the reader needs to do, and by when."></textarea>
        </label>
        <label class="field">
          <span>Audience</span>
          <select id="notice-audience" v-model="draft.audience">
            <option v-for="a in AUDIENCES" :key="a.value" :value="a.value">{{ a.label }}</option>
          </select>
        </label>
        <label class="field field-check">
          <input id="notice-pinned" v-model="draft.pinned" type="checkbox" />
          <span>Pin to the top</span>
        </label>
      </div>
      <div class="composer-actions">
        <button id="publish-notice" class="btn-primary" @click="publish()">PUBLISH</button>
        <button class="btn-secondary" @click="composerOpen = false">CANCEL</button>
      </div>
    </section>

    <div class="notice-list">
      <article
        v-for="n in visible"
        :key="n.NoticeID"
        class="notice-card card"
        :class="{ pinned: n.Pinned }"
        :id="'notice-' + n.NoticeID"
      >
        <div class="notice-top">
          <span v-if="n.Pinned" class="pin">PINNED</span>
          <span class="audience">{{ audienceLabel(n.Audience) }}</span>
          <span class="stamp">{{ formatStamp(n.PublishedAt) }}</span>
        </div>
        <h2>{{ n.Title }}</h2>
        <p class="notice-body">{{ n.Body }}</p>
        <div class="notice-foot">
          <span>Published by {{ n.AuthorName }}</span>
          <button
            v-if="CAN_WITHDRAW"
            class="btn-danger"
            @click="withdraw(n)"
          >
            WITHDRAW
          </button>
        </div>
      </article>

      <p v-if="visible.length === 0" id="notices-empty" class="empty card">
        {{ search ? 'No notice matches that search.' : 'No notices for you yet.' }}
      </p>
      <p v-if="loading" class="empty card">Loading…</p>
    </div>

    <footer class="page-footer">
      <p>
        LAEC CLOUD-BASED INTEGRATED EXAMINATION MANAGEMENT SYSTEM © {{ new Date().getFullYear() }}
        NICEGENE TECHNOLOGIES. All Rights Reserved.
      </p>
    </footer>
  </AppShell>
</template>

<style>
/* Notice board surface, scoped to its page class (D-63). */
body.surface-enterprise.page-notices .page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
body.surface-enterprise.page-notices .page-head h1 {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.2px;
  margin: 0 0 4px;
  color: var(--app-text);
}
body.surface-enterprise.page-notices .page-sub {
  margin: 0;
  color: var(--app-text-soft);
  font-size: 12.5px;
}
body.surface-enterprise.page-notices .page-head-tools {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}
body.surface-enterprise.page-notices .field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--app-text-soft);
}
body.surface-enterprise.page-notices .field input,
body.surface-enterprise.page-notices .field select,
body.surface-enterprise.page-notices .field textarea {
  text-transform: none;
  letter-spacing: normal;
  font-size: 12.5px;
  font-weight: 400;
  color: var(--app-text);
  min-width: 200px;
}
body.surface-enterprise.page-notices .field-wide {
  grid-column: 1 / -1;
}
body.surface-enterprise.page-notices .field-check {
  flex-direction: row;
  align-items: center;
  gap: 7px;
  align-self: end;
  padding-bottom: 7px;
}
body.surface-enterprise.page-notices .form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-top: 12px;
}
body.surface-enterprise.page-notices .card h2 {
  font-size: 15px;
  font-weight: 650;
  margin: 0 0 6px;
  color: var(--app-text);
}

body.surface-enterprise.page-notices .notice-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
body.surface-enterprise.page-notices .notice-card {
  padding: 16px 18px;
  border-left: 3px solid var(--app-n200);
}
body.surface-enterprise.page-notices .notice-card.pinned {
  border-left-color: var(--app-accent);
  background: linear-gradient(90deg, var(--app-accent-soft) 0 3px, var(--app-n0) 3px);
}
body.surface-enterprise.page-notices .notice-top {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
body.surface-enterprise.page-notices .pin {
  padding: 2px 7px;
  border-radius: 3px;
  background: var(--app-n900);
  color: #fff;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.5px;
}
body.surface-enterprise.page-notices .audience {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--app-n100);
  color: var(--app-text-soft);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.3px;
}
body.surface-enterprise.page-notices .stamp {
  margin-left: auto;
  color: var(--app-text-mute);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
body.surface-enterprise.page-notices .notice-body {
  margin: 0 0 12px;
  color: var(--app-text);
  font-size: 13px;
  line-height: 1.55;
  max-width: 78ch;
}
body.surface-enterprise.page-notices .notice-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--app-line-soft);
  color: var(--app-text-mute);
  font-size: 11.5px;
}
body.surface-enterprise.page-notices .empty {
  padding: 30px 16px;
  text-align: center;
  color: var(--app-text-mute);
  font-size: 12.5px;
  font-style: italic;
}
body.surface-enterprise.page-notices .composer-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}
body.surface-enterprise.page-notices .page-footer {
  margin-top: 20px;
  padding: 14px;
  text-align: center;
  color: var(--app-text-mute);
  font-size: 11.5px;
  border-top: 1px solid var(--app-line);
}

body.surface-enterprise.page-notices #custom-alert {
  position: fixed;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgb(11 34 66 / 0.6);
  z-index: var(--z-modal);
}
body.surface-enterprise.page-notices .alert-content {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  max-width: 440px;
  width: 92%;
}
body.surface-enterprise.page-notices .alert-content h3 {
  margin: 0 0 6px;
  color: var(--app-accent);
  font-size: 15px;
}
body.surface-enterprise.page-notices .alert-content p {
  margin: 0;
  color: var(--app-text);
  font-size: 13px;
}
body.surface-enterprise.page-notices .alert-btns {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

@media (max-width: 767px) {
  body.surface-enterprise.page-notices .field input,
  body.surface-enterprise.page-notices .field select {
    min-width: 0;
    width: 100%;
  }
  body.surface-enterprise.page-notices .stamp {
    margin-left: 0;
    width: 100%;
  }
}
</style>
