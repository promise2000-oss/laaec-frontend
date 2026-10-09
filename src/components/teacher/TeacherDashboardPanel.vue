<script setup lang="ts">
/**
 * Teacher dashboard (D-72) — the origin's `/dashboard`.
 *
 * The origin's landing page is `src/components/unified-dashboard.tsx`, which
 * reads one `GET /dashboard/stats` plus the messaging and communication stores.
 * This panel reproduces that shape: a set of count tiles, each one a link into
 * the panel that owns the work it counts, and nothing that is not a count.
 *
 * The nine counts are the ones a teacher can act on. Two origin counts are
 * deliberately absent:
 *
 *  - `results.upload` / `store.browse`. The origin grants a teacher
 *    `RESULTS_UPLOAD_PERMISSIONS` and `STORE_BROWSE_PERMISSIONS` but builds no
 *    teacher UI for either, so there is no screen to link a tile to. Adding one
 *    would be inventing a feature.
 *  - lesson-plan counts by `week`. The origin's `useTeacherDashboardData` calls
 *    `listLessonPlans(undefined, 1, 100)` and groups client-side; the counts
 *    here come from `GET_TEACHER_DASHBOARD`, which is one request rather than a
 *    full page of plans.
 */
import { computed, onMounted, ref } from 'vue';
import { callApi } from '../../api';
import { useTeacherSession } from './useTeacherSession';
import TeacherModuleShell from './TeacherModuleShell.vue';
import type { TeacherDashboardCounts } from '../../types/teacher';

const session = useTeacherSession();

const counts = ref<TeacherDashboardCounts | null>(null);
const loading = ref(false);
const loadError = ref('');

/** Emitted so the rail can switch panel — the origin's tile links are routes. */
const emit = defineEmits<{ navigate: [panel: string] }>();

interface Tile {
  key: keyof TeacherDashboardCounts;
  label: string;
  panel: string;
  hint: string;
}

const TILES: readonly Tile[] = [
  {
    key: 'lessonPlanDrafts',
    label: 'Lesson plan drafts',
    panel: 'lesson-plans',
    hint: 'Not yet submitted',
  },
  {
    key: 'lessonPlanPending',
    label: 'Awaiting review',
    panel: 'lesson-plans',
    hint: 'Submitted lesson plans',
  },
  {
    key: 'weeklyReportDrafts',
    label: 'Weekly report drafts',
    panel: 'weekly-reports',
    hint: 'Not yet submitted',
  },
  {
    key: 'weeklyReportSubmitted',
    label: 'Reports in review',
    panel: 'weekly-reports',
    hint: 'Submitted weekly reports',
  },
  {
    key: 'classReportsDraft',
    label: 'Class reports in progress',
    panel: 'class-reports',
    hint: 'Class teacher reports not yet submitted',
  },
  {
    key: 'openLeaveRequests',
    label: 'Pending leave',
    panel: 'leave',
    hint: 'Awaiting a decision',
  },
  {
    key: 'openHrQueries',
    label: 'Open HR queries',
    panel: 'hr-queries',
    hint: 'Unresolved queries',
  },
  {
    key: 'openCounsellingCases',
    label: 'Open counselling cases',
    panel: 'counselling',
    hint: 'Not resolved or closed',
  },
  {
    key: 'openDisciplinaryCases',
    label: 'Open disciplinary cases',
    panel: 'disciplinary',
    hint: 'Not dismissed or resolved',
  },
  {
    key: 'unreadMessages',
    label: 'Unread messages',
    panel: 'messaging',
    hint: 'Across your conversations',
  },
];

const greeting = computed(() => session.teacherName() || 'Teacher');

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_TEACHER_DASHBOARD', {
      schoolID: session.schoolID(),
      teacherUsername: session.username(),
    });
    if (data.status !== 'success' || !data.counts) {
      throw new Error(data.message || 'Could not load your dashboard.');
    }
    counts.value = data.counts;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Could not load your dashboard.';
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>

<template>
  <TeacherModuleShell
    title="Dashboard"
    :description="`Welcome back, ${greeting}.`"
    :loading="loading"
    :error="loadError"
    :empty-count="counts ? 1 : 0"
    :retryable="false"
    @retry="load"
  >
    <template #empty>
      <p>No dashboard data yet.</p>
      <button type="button" class="tp-btn tp-btn--primary tp-empty__cta" @click="load">Reload</button>
    </template>

    <div class="tp-tiles">
      <button
        v-for="tile in TILES"
        :key="tile.key"
        type="button"
        class="tp-tile"
        @click="emit('navigate', tile.panel)"
      >
        <span class="tp-tile__count">{{ counts?.[tile.key] ?? 0 }}</span>
        <span class="tp-tile__label">{{ tile.label }}</span>
        <span class="tp-tile__hint">{{ tile.hint }}</span>
      </button>
    </div>
  </TeacherModuleShell>
</template>

<style scoped>
@import './teacher-panel.css';

.tp-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 0.75rem;
}

.tp-tile {
  font: inherit;
  text-align: left;
  background: #fff;
  border: 1px solid var(--laec-line, #d7dee8);
  border-radius: 12px;
  padding: 0.875rem 1rem;
  cursor: pointer;
  display: grid;
  gap: 0.125rem;
}

.tp-tile:hover {
  border-color: var(--laec-blue, #1c4e80);
  box-shadow: 0 2px 8px rgb(18 23 34 / 0.06);
}

.tp-tile:focus-visible {
  outline: 2px solid var(--laec-blue, #1c4e80);
  outline-offset: 2px;
}

.tp-tile__count {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--laec-blue, #1c4e80);
  line-height: 1.15;
}

.tp-tile__label {
  font-size: 0.8125rem;
  font-weight: 600;
}

.tp-tile__hint {
  font-size: 0.6875rem;
  color: var(--text-muted, #5b6472);
}
</style>