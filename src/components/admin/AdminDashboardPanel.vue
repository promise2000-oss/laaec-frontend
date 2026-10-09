<script setup lang="ts">
/**
 * AdminDashboardPanel — the Super Admin dashboard, which is the live app's
 * first screen and the one page in it that is not "a table and a form".
 *
 * WHAT IT REPRODUCES
 * ------------------
 *  - The greeting banner: `Welcome, <name>`, the claim chip, and the school line
 *    with the active session.
 *  - Three header links — School Manager, Academic Calendar, Notice Board.
 *  - Six stat sections (School Overview, Staff & HR, Teaching, Inventory,
 *    Results Management, Fees & Wallets), each with its own description line and
 *    each tile labelled, valued and linked to the module it opens.
 *  - A Quick Access column of named shortcuts with a one-line description each.
 *
 * WHY A SIXTH AND SEVENTH SECTION
 * -------------------------------
 * The live dashboard groups its tiles into five sections. Results, fees and
 * wallets are in its rail but absent from its tiles, which means a bursary
 * officer opening the dashboard sees no fees or wallet figure at all. This adds
 * the two sections rather than leaving the gap, and records the divergence in
 * docs/saint-finbarrs-admin/parity-report.md — the alternative was a dashboard
 * that silently omits two of the fourteen modules.
 *
 * EVERY TILE LINKS TO A PANEL, NOT A URL
 * --------------------------------------
 * `href` is emitted by the mock as `/admin/?panel=<id>`, and the view reads that
 * parameter. A tile that linked to a document this portal does not have would be
 * the blank-page failure `nav.ts` already documents for route-backed rail items.
 */
import { computed, onMounted, ref } from 'vue';
import { callApi } from '../../api';
import AdminModuleShell from './AdminModuleShell.vue';
import { useAdminSession } from './useAdminSession';
import type { DashboardSection, QuickAction } from '../../types/admin';

const emit = defineEmits<{ navigate: [panelId: string] }>();

const session = useAdminSession();

const sections = ref<DashboardSection[]>([]);
const quickActions = ref<QuickAction[]>([]);
const greeting = ref('');
const roleLabel = ref('');
const schoolName = ref('');
const academicSession = ref('');
const loading = ref(false);
const loadError = ref('');

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_ADMIN_DASHBOARD', { schoolID: session.schoolId() });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load the dashboard.');
    sections.value = data.sections;
    quickActions.value = data.quickActions;
    greeting.value = data.greeting;
    roleLabel.value = data.roleLabel;
    schoolName.value = data.schoolName;
    academicSession.value = data.academicSession;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load the dashboard.';
  } finally {
    loading.value = false;
  }
};

/** `/admin/?panel=students&action=create` — the panel is what matters here. */
const panelOf = (href: string): string => {
  const match = /[?&]panel=([a-z0-9-]+)/i.exec(href);
  return match ? match[1] : '';
};

const isLocal = (href: string): boolean => href.startsWith('/');

const totalTiles = computed(() => sections.value.reduce((n, s) => n + s.stats.length, 0));

onMounted(load);
</script>

<template>
  <AdminModuleShell
    :title="greeting || 'Welcome'"
    :description="schoolName ? schoolName + ' · Academic session ' + academicSession : ''"
    :loading="loading"
    :error="loadError"
    @retry="load"
  >
    <template #actions>
      <button type="button" class="ap-btn" @click="emit('navigate', 'general-settings')">School Manager</button>
      <button type="button" class="ap-btn" @click="emit('navigate', 'calendar')">Academic Calendar</button>
      <button type="button" class="ap-btn" @click="emit('navigate', 'notices')">Notice Board</button>
    </template>

    <div class="ap-split">
      <div class="ap-dash__main">
        <section v-for="section in sections" :key="section.key" class="ap-dash__section">
          <h3 class="ap-dash__heading">{{ section.title }}</h3>
          <p class="ap-inline-note">{{ section.description }}</p>
          <div class="ap-statgrid">
            <component
              :is="isLocal(stat.href) ? 'button' : 'div'"
              v-for="stat in section.stats"
              :key="stat.key"
              class="ap-stat ap-dash__stat"
              :type="isLocal(stat.href) ? 'button' : undefined"
              @click="isLocal(stat.href) && panelOf(stat.href) && emit('navigate', panelOf(stat.href))"
            >
              <span class="ap-stat__label">{{ stat.label }}</span>
              <span class="ap-stat__value">{{ stat.value }}</span>
              <span v-if="stat.secondary" class="ap-stat__sub">{{ stat.secondary }}</span>
              <span v-else-if="isLocal(stat.href)" class="ap-stat__sub">Open module</span>
            </component>
          </div>
        </section>
      </div>

      <aside class="ap-dash__side">
        <h3 class="ap-dash__heading">Quick Access</h3>
        <p class="ap-inline-note">Jump to common tasks.</p>
        <ul class="ap-dash__quick">
          <li v-for="action in quickActions" :key="action.label">
            <button
              type="button"
              class="ap-dash__quickbtn"
              :disabled="!isLocal(action.href) || !panelOf(action.href)"
              @click="isLocal(action.href) && panelOf(action.href) && emit('navigate', panelOf(action.href))"
            >
              <span class="ap-dash__quicklabel">{{ action.label }}</span>
              <span class="ap-dash__quickdesc">{{ action.description }}</span>
            </button>
          </li>
        </ul>
      </aside>
    </div>

    <p class="ap-inline-note">
      {{ totalTiles }} live count(s) across {{ sections.length }} section(s).
    </p>
  </AdminModuleShell>
</template>

<style scoped>
@import './admin-panel.css';

.ap-dash__main {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

.ap-dash__section {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.ap-dash__heading {
  margin: 0;
  font-size: 0.9375rem;
}

.ap-dash__stat {
  text-align: left;
  font: inherit;
  cursor: pointer;
  color: inherit;
}

.ap-dash__stat:hover {
  border-color: var(--laec-blue, #1c4e80);
}

.ap-dash__side {
  border: 1px solid var(--laec-line, #d7dee8);
  border-radius: 12px;
  background: #fff;
  padding: 0.875rem 1rem;
  min-width: 0;
}

.ap-dash__quick {
  list-style: none;
  margin: 0.625rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.ap-dash__quickbtn {
  display: block;
  width: 100%;
  text-align: left;
  font: inherit;
  background: #f7f9fc;
  border: 1px solid var(--laec-line, #d7dee8);
  border-radius: 8px;
  padding: 0.5rem 0.625rem;
  cursor: pointer;
}

.ap-dash__quickbtn:hover:not(:disabled) {
  border-color: var(--laec-blue, #1c4e80);
}

.ap-dash__quickbtn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ap-dash__quicklabel {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
}

.ap-dash__quickdesc {
  display: block;
  font-size: 0.6875rem;
  color: var(--text-muted, #5b6472);
}
</style>
