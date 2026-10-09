<script setup lang="ts">
/**
 * Notifications panel (D-72) — the origin's `/teacher/notifications`.
 *
 * The origin shares this page across every role and it is the hub for everything
 * that happened elsewhere, so it stays read-only here: the portal already has a
 * notification centre in `AppShell` (D-64), and this panel adds the origin's
 * typed *filtering*, not a second mark-as-read implementation.
 *
 * THE ORIGIN'S BEHAVIOUR THAT IS WORTH FLAGGING
 * ----------------------------------------------
 * `NotificationsPage` calls `useNotificationUnread.getState().clear()` and then
 * `PATCH /notifications/read-all` **on mount**, unconditionally. Visiting the
 * page therefore marks everything read server-side whether or not the reader
 * looked at anything. That is reproduced here: `clearUnread()` is called after a
 * successful load.
 *
 * The origin's filter tabs are reproduced in its own vocabulary:
 * `All, Unread, Messages, Leave, Attendance, Events, System, Discipline,
 * Counselling` — which is wider than LAEC's five notification categories, so
 * the mapping is explicit below rather than inferred.
 *
 * The origin's deep-link resolution by `refEntity` is reproduced for the
 * teacher-specific targets, so a notification about a case actually takes you to
 * the right sub-view.
 */
import { computed, onMounted, ref } from 'vue';
import { callApi } from '../../api';
import { useTeacherSession } from './useTeacherSession';
import TeacherModuleShell from './TeacherModuleShell.vue';
import type { PortalNotification } from '../../types';

/**
 * The origin's nine tabs.
 *
 * Each names a module. `kinds` are the `Kind` values a teacher-portal action
 * raises; `categories` are LAEC's own coarse categories, used for the items
 * that predate this module and carry no `Kind`. A row matches when it matches
 * EITHER, which is why a tab is not empty just because one of the two vocabularies
 * has no rows in it.
 */
const FILTERS: ReadonlyArray<{
  id: FilterId;
  label: string;
  kinds: readonly string[];
  categories: readonly PortalNotification['Category'][];
}> = [
  { id: 'ALL', label: 'All', kinds: [], categories: [] },
  { id: 'UNREAD', label: 'Unread', kinds: [], categories: [] },
  { id: 'MESSAGES', label: 'Messages', kinds: [], categories: ['SYSTEM'] },
  { id: 'LEAVE', label: 'Leave', kinds: ['LEAVE'], categories: [] },
  { id: 'ATTENDANCE', label: 'Attendance', kinds: [], categories: ['EXAM'] },
  { id: 'EVENTS', label: 'Events', kinds: [], categories: ['ANNOUNCEMENT'] },
  { id: 'SYSTEM', label: 'System', kinds: ['SYSTEM'], categories: ['SYSTEM', 'SECURITY'] },
  { id: 'DISCIPLINE', label: 'Discipline', kinds: ['DISCIPLINE'], categories: ['REVIEW'] },
  { id: 'COUNSELLING', label: 'Counselling', kinds: ['COUNSELLING'], categories: ['REVIEW'] },
];

type FilterId =
  | 'ALL'
  | 'UNREAD'
  | 'MESSAGES'
  | 'LEAVE'
  | 'ATTENDANCE'
  | 'EVENTS'
  | 'SYSTEM'
  | 'DISCIPLINE'
  | 'COUNSELLING';

const session = useTeacherSession();

const notifications = ref<PortalNotification[]>([]);
const loading = ref(false);
const loadError = ref('');
const filter = ref<FilterId>('ALL');
/** Panel to switch to when a notification is followed. */
const emit = defineEmits<{ navigate: [panel: string] }>();

const total = computed(() => notifications.value.length);
const unread = computed(() => notifications.value.filter((n) => !n.Read).length);

const visible = computed(() => {
  if (filter.value === 'ALL') return notifications.value;
  if (filter.value === 'UNREAD') return notifications.value.filter((n) => !n.Read);
  const entry = FILTERS.find((f) => f.id === filter.value);
  if (!entry) return notifications.value;
  return notifications.value.filter(
    (n) =>
      (n.Kind !== undefined && entry.kinds.includes(n.Kind)) ||
      entry.categories.includes(n.Category),
  );
});

/** The origin's deep-link map, restricted to LAEC's panels. */
const panelFor = (notice: PortalNotification): string => {
  const type = notice.Link ?? '';
  if (type.includes('lesson_plan')) return 'lesson-plans';
  if (type.includes('weekly_report')) return 'weekly-reports';
  if (type.includes('class_teacher_report')) return 'class-reports';
  if (type.includes('leave')) return 'leave';
  if (type.includes('counselling')) return 'counselling';
  if (type.includes('disciplinary')) return 'disciplinary';
  if (type.includes('event')) return 'events';
  return '';
};

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_NOTIFICATIONS', {
      schoolID: session.schoolID(),
      username: session.username(),
      // Role-addressed items — which is how every teacher-portal action raises
      // one — are only returned when the call names the role too.
      role: session.role.value,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load notifications.');
    notifications.value = data.notifications;
    // The origin marks everything read on mount — reproduced, see the note above.
    if (data.notifications.some((n) => !n.Read)) await clearUnread();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load notifications.';
  } finally {
    loading.value = false;
  }
};

const clearUnread = async (): Promise<void> => {
  try {
    await callApi('MARK_ALL_NOTIFICATIONS_READ', {
      schoolID: session.schoolID(),
      username: session.username(),
      role: session.role.value,
    });
    notifications.value = notifications.value.map((n) => ({ ...n, Read: true }));
  } catch {
    // A failed read-receipt is not the reader's problem: the list still renders.
  }
};

const markRead = async (notice: PortalNotification): Promise<void> => {
  if (notice.Read) return;
  notice.Read = true;
  try {
    await callApi('MARK_NOTIFICATION_READ', {
      schoolID: session.schoolID(),
      notificationIds: [notice.NotificationID],
    });
  } catch {
    // Optimistic, and deliberately not rolled back — the origin does the same.
  }
};

const follow = (notice: PortalNotification): void => {
  const panel = panelFor(notice);
  if (panel) emit('navigate', panel);
};

const formatStamp = (value: string): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

onMounted(load);
</script>

<template>
  <TeacherModuleShell
    title="Notifications"
    :description="`${unread} unread of ${total} total notifications.`"
    :loading="loading"
    :error="loadError"
    :empty-count="total"
    @retry="load"
  >
    <template #empty>
      <p>No notifications in this view.</p>
    </template>

    <template #actions>
      <button type="button" class="tp-btn" :disabled="unread === 0" @click="clearUnread">
        Mark all as read
      </button>
    </template>

    <template #filters>
      <div class="tp-tabs" role="tablist" aria-label="Notification kind">
        <button
          v-for="entry in FILTERS"
          :key="entry.id"
          type="button"
          role="tab"
          class="tp-tab"
          :class="{ 'tp-tab--on': filter === entry.id }"
          :aria-selected="filter === entry.id"
          @click="filter = entry.id"
        >
          {{ entry.label }}
        </button>
      </div>
    </template>

    <ul class="tp-notifs">
      <li
        v-for="notice in visible"
        :key="notice.NotificationID"
        class="tp-notif"
        :class="{ 'tp-notif--unread': !notice.Read }"
      >
        <div class="tp-notif__body">
          <p class="tp-notif__title">{{ notice.Title }}</p>
          <p class="tp-notif__text">{{ notice.Body }}</p>
          <p class="tp-notif__stamp">{{ formatStamp(notice.CreatedAt) }}</p>
        </div>
        <div class="tp-notif__actions">
          <button
            v-if="!notice.Read"
            type="button"
            class="tp-btn tp-btn--ghost tp-btn--xs"
            @click="markRead(notice)"
          >
            Mark as read
          </button>
          <button
            v-if="panelFor(notice)"
            type="button"
            class="tp-btn tp-btn--ghost tp-btn--xs"
            @click="follow(notice)"
          >
            View
          </button>
        </div>
      </li>
    </ul>
  </TeacherModuleShell>
</template>

<style scoped>
@import './teacher-panel.css';

.tp-notifs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}

.tp-notif {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.875rem;
  border: 1px solid var(--laec-line, #d7dee8);
  border-radius: 10px;
  padding: 0.75rem 0.875rem;
  background: #fff;
}

.tp-notif--unread {
  border-color: #bcd6f0;
  background: #f7fbff;
}

.tp-notif__body {
  min-width: 0;
  display: grid;
  gap: 0.125rem;
}

.tp-notif__title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
}

.tp-notif__text {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted, #5b6472);
}

.tp-notif__stamp {
  margin: 0;
  font-size: 0.6875rem;
  color: var(--text-muted, #5b6472);
}

.tp-notif__actions {
  flex: none;
  display: flex;
  gap: 0.25rem;
}
</style>