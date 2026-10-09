<script setup lang="ts">
/*
 * `/calendar/` — Academic & Exam Calendar (D-64).
 *
 * Carried over from the reference school-management application, which offers
 * Monthly / Weekly / Yearly / Agenda views over term dates, events and holidays.
 * Those four views are the idea worth keeping; the data is LAEC's own, and it
 * was already in the build and unused — MOCK_CONFIG holds the academic session
 * and term, and every live paper carries a StartTime and an EndTime. This page
 * is what makes an exam window visible as a window rather than as a row in a
 * table somewhere.
 *
 * Not an origin page. It uses the shared AppShell like the other role consoles
 * (D-60) and the same token contract (D-63).
 */
import { computed, nextTick, onMounted, ref } from 'vue';
import { callApi } from '../api';
import AppShell from '../components/AppShell.vue';
import AppAlert from '../components/AppAlert.vue';
import { PENDING_PANEL_KEY, consolePathFor, filterNav, navFor } from '../lib/nav';
import { useSessionStore } from '../stores/session';
import { STORAGE_KEYS } from '../types';
import type { CalendarEvent, CalendarEventKind } from '../types';
import { useIdleTimeout } from '../composables/useIdleTimeout';

type View = 'month' | 'week' | 'year' | 'agenda';

const ROLE = localStorage.getItem(STORAGE_KEYS.AdminRole) || '';
const IDENTITY = localStorage.getItem(STORAGE_KEYS.AdminName) || '';
const SCHOOL_ID = localStorage.getItem(STORAGE_KEYS.SchoolID) || '';
const navMeta = navFor(ROLE);
const currentRole = ROLE;

/* The rail is permission-filtered (D-71): SUPER_ADMIN sees every
   section, every other session only the ones it actually holds. */
const sessionStore = useSessionStore();
const navGroups = computed(
  () => filterNav(navMeta, sessionStore.permissions, currentRole).groups,
);

const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'month', label: 'Monthly' },
  { id: 'week', label: 'Weekly' },
  { id: 'year', label: 'Yearly' },
  { id: 'agenda', label: 'Agenda' },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* The two roles that may edit the calendar. Mirrors the notice board. */
/** Whether this session may add to or clear the calendar (D-71). */
const CAN_MANAGE = computed(() => sessionStore.can('calendar.manage'));

const view = ref<View>('month');
const events = ref<CalendarEvent[]>([]);
const sessions = ref<string[]>([]);
const sessionFilter = ref('');
const cursor = ref(new Date());
const selected = ref<CalendarEvent | null>(null);
const loading = ref(false);
const formOpen = ref(false);
const savedFilter = localStorage.getItem('activeCalendar_Tab') || 'calendar';

const alertVisible = ref(false);
const alertTitle = ref('');
const alertMsg = ref('');
const winAlert = (msg: string, title: string): void => {
  alertMsg.value = msg;
  alertTitle.value = title;
  alertVisible.value = true;
};
const KIND_META: Record<CalendarEventKind, { label: string; cls: string }> = {
  TERM: { label: 'Term', cls: 'term' },
  EXAM: { label: 'Examination', cls: 'exam' },
  EVENT: { label: 'Event', cls: 'event' },
  HOLIDAY: { label: 'Holiday', cls: 'holiday' },
};

/* ── data ─────────────────────────────────────────────────────────────── */

const loadCalendar = async (): Promise<void> => {
  loading.value = true;
  try {
    const data = await callApi('GET_ACADEMIC_CALENDAR', {
      schoolID: SCHOOL_ID,
      year: sessionFilter.value ? sessionFilter.value.split(' ')[0] : '',
    });
    if (data.status !== 'success') throw new Error(data.message || 'read failed');
    events.value = data.events;
    sessions.value = data.sessions || [];
  } catch {
    events.value = [];
  }
  loading.value = false;
};

const filtered = computed(() =>
  sessionFilter.value ? events.value.filter((e) => e.Session === sessionFilter.value) : events.value,
);

/* ── date helpers ─────────────────────────────────────────────────────── */

const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseLocal = (iso: string): Date => new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);

const spansDay = (e: CalendarEvent, day: Date): boolean => {
  const k = dayKey(day);
  const start = e.AllDay ? e.Start : e.Start.slice(0, 10);
  const end = e.AllDay ? e.End : e.End.slice(0, 10);
  return k >= start && k <= end;
};

const eventsOn = (day: Date): CalendarEvent[] => filtered.value.filter((e) => spansDay(e, day));

const timeLabel = (e: CalendarEvent): string => {
  if (e.AllDay) return 'All day';
  const t = (iso: string): string => iso.slice(11, 16);
  return `${t(e.Start)}–${t(e.End)}`;
};

const prettyDate = (iso: string): string => {
  const d = parseLocal(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
};

const relative = (iso: string): string => {
  const d = parseLocal(iso);
  const today = new Date();
  const diff = Math.round((d.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 0) return `in ${diff} day${diff === 1 ? '' : 's'}`;
  return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} ago`;
};

/* ── month grid, Monday-first ─────────────────────────────────────────── */

const monthCells = computed(() => {
  const y = cursor.value.getFullYear();
  const m = cursor.value.getMonth();
  const first = new Date(y, m, 1);
  const lead = (first.getDay() + 6) % 7; // Monday-first offset
  const cells: Array<Date | null> = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
});

const weekDays = computed(() => {
  const base = new Date(cursor.value);
  const offset = (base.getDay() + 6) % 7;
  const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
});

const yearMonths = computed(() =>
  Array.from({ length: 12 }, (_, m) => ({
    month: m,
    label: MONTHS[m],
    count: filtered.value.filter((e) => parseLocal(e.Start).getFullYear() === cursor.value.getFullYear() && parseLocal(e.Start).getMonth() === m).length,
  })),
);

const agendaGroups = computed(() => {
  const today = new Date();
  const upcoming = filtered.value.filter((e) => parseLocal(e.Start) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const past = filtered.value.filter((e) => parseLocal(e.Start) < new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const sortByStart = (a: CalendarEvent, b: CalendarEvent): number => a.Start.localeCompare(b.Start);
  return [
    { key: 'upcoming', label: 'Upcoming', items: upcoming.sort(sortByStart) },
    { key: 'past', label: 'Past', items: past.sort(sortByStart).reverse() },
  ];
});

const monthLabel = computed(() => `${MONTHS[cursor.value.getMonth()]} ${cursor.value.getFullYear()}`);
const weekLabel = computed(() => {
  const days = weekDays.value;
  const first = days[0];
  const last = days[6];
  return first.getMonth() === last.getMonth()
    ? `${first.getDate()}–${last.getDate()} ${MONTHS[first.getMonth()]} ${first.getFullYear()}`
    : `${first.getDate()} ${MONTHS[first.getMonth()].slice(0, 3)} – ${last.getDate()} ${MONTHS[last.getMonth()].slice(0, 3)} ${last.getFullYear()}`;
});

const isToday = (d: Date): boolean => dayKey(d) === dayKey(new Date());

const shift = (dir: number): void => {
  const d = new Date(cursor.value);
  if (view.value === 'month') d.setMonth(d.getMonth() + dir);
  else if (view.value === 'week') d.setDate(d.getDate() + dir * 7);
  else if (view.value === 'year') d.setFullYear(d.getFullYear() + dir);
  cursor.value = d;
};

const goToday = (): void => {
  cursor.value = new Date();
};

/* ── add / delete ─────────────────────────────────────────────────────── */

const blankEvent = (): { kind: CalendarEventKind; title: string; description: string; start: string; end: string; allDay: boolean } => ({
  kind: 'EVENT',
  title: '',
  description: '',
  start: dayKey(new Date()),
  end: dayKey(new Date()),
  allDay: true,
});
const draft = ref(blankEvent());

const saveEvent = (): void => {
  const title = draft.value.title.trim();
  if (!title) {
    winAlert('A title is required before an event can be added.', 'Missing title');
    return;
  }
  if (draft.value.end < draft.value.start) {
    winAlert('The end date falls before the start date.', 'Check the dates');
    return;
  }
  void (async () => {
    loading.value = true;
    try {
      const data = await callApi('UPSERT_ACADEMIC_EVENT', {
        schoolID: SCHOOL_ID,
        kind: draft.value.kind,
        title: title,
        description: draft.value.description,
        start: draft.value.start,
        end: draft.value.end,
        allDay: draft.value.allDay,
        session: sessionFilter.value || undefined,
      });
      if (data.status !== 'success') throw new Error(data.message || 'Save failed.');
      winAlert(`${data.event?.Title || title} added to the calendar.`, 'Event added');
      draft.value = blankEvent();
      formOpen.value = false;
      await loadCalendar();
    } catch (e) {
      winAlert(e instanceof Error ? e.message : 'Could not add that event.', 'Save failed');
    }
    loading.value = false;
  })();
};

const removeEvent = (item: CalendarEvent): void => {
  void (async () => {
    loading.value = true;
    const data = await callApi('DELETE_ACADEMIC_EVENT', { schoolID: SCHOOL_ID, eventId: item.EventID });
    if (data.status === 'success') {
      winAlert(`${item.Title} removed from the calendar.`, 'Event removed');
      selected.value = null;
      await loadCalendar();
    } else {
      winAlert(data.message || 'Could not remove that event.', 'Delete failed');
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
  localStorage.setItem('activeCalendar_Tab', savedFilter);
  await nextTick();
  await loadCalendar();
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
    active-id="calendar"
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
        <h1>Academic &amp; Exam Calendar</h1>
        <p class="page-sub">
          Term dates, examination windows and school events across the session. {{ filtered.length }}
          event(s).
        </p>
      </div>
      <div class="page-head-tools">
        <label class="field">
          <span>Session</span>
          <select id="cal-session" v-model="sessionFilter" @change="loadCalendar()">
            <option value="">All sessions</option>
            <option v-for="s in sessions" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
        <button v-if="CAN_MANAGE" id="add-event" class="btn-primary" @click="formOpen = !formOpen">
          {{ formOpen ? 'CLOSE' : 'ADD EVENT' }}
        </button>
      </div>
    </header>

    <!-- ── add event ─────────────────────────────────────────────────── -->
    <section v-if="formOpen" id="event-form" class="card">
      <h2>Add a calendar event</h2>
      <div class="form-grid">
        <label class="field">
          <span>Kind</span>
          <select id="ev-kind" v-model="draft.kind">
            <option value="TERM">Term</option>
            <option value="EXAM">Examination</option>
            <option value="EVENT">Event</option>
            <option value="HOLIDAY">Holiday</option>
          </select>
        </label>
        <label class="field">
          <span>Title</span>
          <input id="ev-title" v-model="draft.title" type="text" placeholder="e.g. Term 2 examinations begin" />
        </label>
        <label class="field">
          <span>Start</span>
          <input id="ev-start" v-model="draft.start" type="date" />
        </label>
        <label class="field">
          <span>End</span>
          <input id="ev-end" v-model="draft.end" type="date" />
        </label>
        <label class="field field-check">
          <input id="ev-allday" v-model="draft.allDay" type="checkbox" />
          <span>All day</span>
        </label>
        <label class="field field-wide">
          <span>Description</span>
          <textarea id="ev-desc" v-model="draft.description" rows="2" placeholder="What an administrator needs to know."></textarea>
        </label>
      </div>
      <div class="composer-actions">
        <button id="save-event" class="btn-primary" @click="saveEvent()">SAVE EVENT</button>
        <button class="btn-secondary" @click="formOpen = false">CANCEL</button>
      </div>
    </section>

    <!-- ── toolbar ───────────────────────────────────────────────────── -->
    <div class="cal-toolbar">
      <div class="cal-switch" role="tablist">
        <button
          v-for="v in VIEWS"
          :key="v.id"
          class="cal-switch-btn"
          role="tab"
          :class="{ active: view === v.id }"
          :aria-selected="view === v.id"
          @click="view = v.id"
        >
          {{ v.label }}
        </button>
      </div>
      <div class="cal-nav">
        <button class="btn-secondary" aria-label="Previous period" @click="shift(-1)">‹</button>
        <strong id="cal-label" class="cal-label">
          {{ view === 'month' ? monthLabel : view === 'week' ? weekLabel : String(cursor.getFullYear()) }}
        </strong>
        <button class="btn-secondary" aria-label="Next period" @click="shift(1)">›</button>
        <button id="cal-today" class="btn-secondary" @click="goToday()">Today</button>
      </div>
    </div>

    <!-- ── month ─────────────────────────────────────────────────────── -->
    <div v-if="view === 'month'" id="cal-month" class="card cal-card">
      <div class="cal-weekdays">
        <span v-for="d in WEEKDAYS" :key="d">{{ d }}</span>
      </div>
      <div class="cal-grid">
        <div
          v-for="(day, i) in monthCells"
          :key="i"
          class="cal-cell"
          :class="{ blank: !day, today: day && isToday(day) }"
        >
          <template v-if="day">
            <span class="cal-date">{{ day.getDate() }}</span>
            <button
              v-for="e in eventsOn(day).slice(0, 3)"
              :key="e.EventID"
              class="cal-chip"
              :class="KIND_META[e.Kind].cls"
              @click="selected = e"
            >
              {{ e.Title }}
            </button>
            <button
              v-if="eventsOn(day).length > 3"
              class="cal-more"
              @click="view = 'agenda'"
            >
              +{{ eventsOn(day).length - 3 }} more
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- ── week ──────────────────────────────────────────────────────── -->
    <div v-else-if="view === 'week'" id="cal-week" class="cal-week">
      <div v-for="d in weekDays" :key="d.toISOString()" class="cal-week-col card" :class="{ today: isToday(d) }">
        <div class="cal-week-head">
          <span>{{ WEEKDAYS[(d.getDay() + 6) % 7] }}</span>
          <strong>{{ d.getDate() }}</strong>
        </div>
        <button
          v-for="e in eventsOn(d)"
          :key="e.EventID"
          class="cal-chip cal-chip-block"
          :class="KIND_META[e.Kind].cls"
          @click="selected = e"
        >
          <strong>{{ e.Title }}</strong>
          <small>{{ timeLabel(e) }}</small>
        </button>
        <p v-if="eventsOn(d).length === 0" class="cal-none">—</p>
      </div>
    </div>

    <!-- ── year ──────────────────────────────────────────────────────── -->
    <div v-else-if="view === 'year'" id="cal-year" class="cal-year">
      <button
        v-for="m in yearMonths"
        :key="m.month"
        class="cal-month-tile card"
        @click="cursor = new Date(cursor.getFullYear(), m.month, 1); view = 'month'"
      >
        <strong>{{ m.label }}</strong>
        <span class="cal-month-count">{{ m.count }}</span>
        <small>{{ m.count === 1 ? 'event' : 'events' }}</small>
      </button>
    </div>

    <!-- ── agenda ────────────────────────────────────────────────────── -->
    <div v-else id="cal-agenda" class="cal-agenda">
      <section v-for="g in agendaGroups" :key="g.key" class="card cal-agenda-group">
        <h2>{{ g.label }} <span class="cal-count">{{ g.items.length }}</span></h2>
        <p v-if="g.items.length === 0" class="cal-none">Nothing {{ g.key === 'upcoming' ? 'scheduled' : 'recorded' }}.</p>
        <button
          v-for="e in g.items"
          v-else
          :key="e.EventID"
          class="cal-agenda-row"
          @click="selected = e"
        >
          <span class="cal-dot" :class="KIND_META[e.Kind].cls"></span>
          <span class="cal-agenda-date">
            <strong>{{ prettyDate(e.Start) }}</strong>
            <small>{{ timeLabel(e) }} · {{ relative(e.Start) }}</small>
          </span>
          <span class="cal-agenda-title">
            <strong>{{ e.Title }}</strong>
            <small>{{ e.Description }}</small>
          </span>
          <span class="badge" :class="KIND_META[e.Kind].cls">{{ KIND_META[e.Kind].label }}</span>
        </button>
      </section>
    </div>

    <!-- ── selected event ────────────────────────────────────────────── -->
    <aside v-if="selected" id="cal-detail" class="card cal-detail">
      <button class="cal-close" aria-label="Close" @click="selected = null">×</button>
      <span class="badge" :class="KIND_META[selected.Kind].cls">{{ KIND_META[selected.Kind].label }}</span>
      <h2>{{ selected.Title }}</h2>
      <p class="cal-detail-when">{{ prettyDate(selected.Start) }} · {{ timeLabel(selected) }} · {{ relative(selected.Start) }}</p>
      <p class="cal-detail-body">{{ selected.Description }}</p>
      <p v-if="selected.Session" class="cal-detail-session">Session: {{ selected.Session }}</p>
      <button v-if="CAN_MANAGE" class="btn-danger" @click="removeEvent(selected)">REMOVE EVENT</button>
    </aside>

    <footer class="page-footer">
      <p>
        LAEC CLOUD-BASED INTEGRATED EXAMINATION MANAGEMENT SYSTEM © {{ new Date().getFullYear() }}
        NICEGENE TECHNOLOGIES. All Rights Reserved.
      </p>
    </footer>
  </AppShell>
</template>

<style>
/* Calendar surface, scoped to the page class so it cannot leak (D-63). */
body.surface-enterprise.page-calendar .page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
body.surface-enterprise.page-calendar .page-head h1 {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.2px;
  margin: 0 0 4px;
  color: var(--app-text);
}
body.surface-enterprise.page-calendar .page-sub {
  margin: 0;
  color: var(--app-text-soft);
  font-size: 12.5px;
}
body.surface-enterprise.page-calendar .page-head-tools {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

body.surface-enterprise.page-calendar .field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--app-text-soft);
}
body.surface-enterprise.page-calendar .field select,
body.surface-enterprise.page-calendar .field input,
body.surface-enterprise.page-calendar .field textarea {
  text-transform: none;
  letter-spacing: normal;
  font-size: 12.5px;
  font-weight: 400;
  color: var(--app-text);
  min-width: 0;
}
body.surface-enterprise.page-calendar .field-check {
  flex-direction: row;
  align-items: center;
  gap: 7px;
  align-self: end;
  padding-bottom: 7px;
}
body.surface-enterprise.page-calendar .field-wide {
  grid-column: 1 / -1;
}

body.surface-enterprise.page-calendar .form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 12px;
}
body.surface-enterprise.page-calendar .card h2 {
  font-size: 15px;
  font-weight: 650;
  margin: 0 0 4px;
  color: var(--app-text);
}

body.surface-enterprise.page-calendar .cal-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
body.surface-enterprise.page-calendar .cal-switch {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--app-line);
  border-radius: var(--app-r-md);
  background: var(--app-n0);
}
body.surface-enterprise.page-calendar .cal-switch-btn {
  padding: 6px 13px;
  border: 0;
  border-radius: var(--app-r-sm);
  background: transparent;
  color: var(--app-text-soft);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
body.surface-enterprise.page-calendar .cal-switch-btn:hover {
  background: var(--app-n50);
}
body.surface-enterprise.page-calendar .cal-switch-btn.active {
  background: var(--app-accent);
  color: #fff;
}
body.surface-enterprise.page-calendar .cal-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}
body.surface-enterprise.page-calendar .cal-label {
  min-width: 210px;
  text-align: center;
  font-size: 13px;
  font-weight: 650;
}

body.surface-enterprise.page-calendar .cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 1px;
  background: var(--app-line-soft);
  border-bottom: 1px solid var(--app-line);
}
body.surface-enterprise.page-calendar .cal-weekdays span {
  padding: 8px 10px;
  background: var(--app-n50);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--app-text-soft);
}
body.surface-enterprise.page-calendar .cal-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 1px;
  background: var(--app-line-soft);
}
body.surface-enterprise.page-calendar .cal-cell {
  min-height: 96px;
  min-width: 0;
  padding: 6px 7px;
  background: var(--app-n0);
  display: flex;
  flex-direction: column;
  gap: 3px;
}
body.surface-enterprise.page-calendar .cal-cell.blank {
  background: var(--app-n50);
}
body.surface-enterprise.page-calendar .cal-cell.today {
  background: var(--app-accent-soft);
}
body.surface-enterprise.page-calendar .cal-date {
  font-size: 11.5px;
  font-weight: 650;
  color: var(--app-text-soft);
}
body.surface-enterprise.page-calendar .cal-cell.today .cal-date {
  color: var(--app-accent);
}
body.surface-enterprise.page-calendar .cal-chip {
  display: block;
  width: 100%;
  min-width: 0;
  text-align: left;
  padding: 3px 6px;
  border: 0;
  border-left: 3px solid var(--app-n300);
  border-radius: 3px;
  background: var(--app-n50);
  color: var(--app-text);
  font: inherit;
  font-size: 11px;
  line-height: 1.3;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
body.surface-enterprise.page-calendar .cal-chip:hover {
  background: var(--app-n100);
}
body.surface-enterprise.page-calendar .cal-chip.term { border-left-color: var(--app-accent); }
body.surface-enterprise.page-calendar .cal-chip.exam { border-left-color: #7c3aed; }
body.surface-enterprise.page-calendar .cal-chip.event { border-left-color: var(--app-success); }
body.surface-enterprise.page-calendar .cal-chip.holiday { border-left-color: var(--app-danger); }
body.surface-enterprise.page-calendar .cal-more {
  border: 0;
  background: none;
  color: var(--app-accent);
  font: inherit;
  font-size: 10.5px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  padding: 0 2px;
}

body.surface-enterprise.page-calendar .cal-week {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}
body.surface-enterprise.page-calendar .cal-week-col {
  min-height: 260px;
  padding: 10px 9px;
}
body.surface-enterprise.page-calendar .cal-week-col.today {
  border-color: var(--app-accent);
  box-shadow: 0 0 0 1px var(--app-accent) inset;
}
body.surface-enterprise.page-calendar .cal-week-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: 7px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--app-line-soft);
  font-size: 10.5px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--app-text-soft);
}
body.surface-enterprise.page-calendar .cal-week-head strong {
  font-size: 15px;
  color: var(--app-text);
}
body.surface-enterprise.page-calendar .cal-chip-block {
  white-space: normal;
  padding: 5px 7px;
  margin-bottom: 4px;
}
body.surface-enterprise.page-calendar .cal-chip-block strong {
  display: block;
  font-weight: 650;
}
body.surface-enterprise.page-calendar .cal-chip-block small {
  display: block;
  color: var(--app-text-soft);
  font-size: 10.5px;
}

body.surface-enterprise.page-calendar .cal-year {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  min-width: 0;
  gap: 10px;
}
body.surface-enterprise.page-calendar .cal-month-tile {
  padding: 16px 14px;
  text-align: left;
  cursor: pointer;
  font: inherit;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
body.surface-enterprise.page-calendar .cal-month-tile:hover {
  border-color: var(--app-accent);
}
body.surface-enterprise.page-calendar .cal-month-tile strong {
  font-size: 13px;
  font-weight: 650;
}
body.surface-enterprise.page-calendar .cal-month-count {
  font-size: 26px;
  font-weight: 700;
  color: var(--app-accent);
  font-variant-numeric: tabular-nums;
}
body.surface-enterprise.page-calendar .cal-month-tile small {
  color: var(--app-text-mute);
  font-size: 11px;
}

body.surface-enterprise.page-calendar .cal-agenda {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
body.surface-enterprise.page-calendar .cal-count {
  color: var(--app-text-mute);
  font-weight: 500;
}
body.surface-enterprise.page-calendar .cal-agenda-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 4px;
  border: 0;
  border-bottom: 1px solid var(--app-line-soft);
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
body.surface-enterprise.page-calendar .cal-agenda-row:hover {
  background: var(--app-n50);
}
body.surface-enterprise.page-calendar .cal-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: 0 0 auto;
  background: var(--app-n300);
}
body.surface-enterprise.page-calendar .cal-dot.term { background: var(--app-accent); }
body.surface-enterprise.page-calendar .cal-dot.exam { background: #7c3aed; }
body.surface-enterprise.page-calendar .cal-dot.event { background: var(--app-success); }
body.surface-enterprise.page-calendar .cal-dot.holiday { background: var(--app-danger); }
body.surface-enterprise.page-calendar .cal-agenda-date {
  display: flex;
  flex-direction: column;
  min-width: 150px;
}
body.surface-enterprise.page-calendar .cal-agenda-date small,
body.surface-enterprise.page-calendar .cal-agenda-title small {
  color: var(--app-text-mute);
  font-size: 11px;
}
body.surface-enterprise.page-calendar .cal-agenda-title {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
body.surface-enterprise.page-calendar .badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.3px;
  background: var(--app-n100);
  color: var(--app-text-soft);
  white-space: nowrap;
}
body.surface-enterprise.page-calendar .badge.term { background: var(--app-accent-soft); color: var(--app-accent); }
body.surface-enterprise.page-calendar .badge.exam { background: #f3e8ff; color: #6d28d9; }
body.surface-enterprise.page-calendar .badge.event { background: var(--app-success-soft); color: var(--app-success); }
body.surface-enterprise.page-calendar .badge.holiday { background: var(--app-danger-soft); color: var(--app-danger); }

body.surface-enterprise.page-calendar .cal-detail {
  position: sticky;
  bottom: 16px;
  margin-top: 14px;
}
body.surface-enterprise.page-calendar .cal-close {
  position: absolute;
  top: 10px;
  right: 12px;
  border: 0;
  background: none;
  font-size: 20px;
  line-height: 1;
  color: var(--app-text-mute);
  cursor: pointer;
}
body.surface-enterprise.page-calendar .cal-detail h2 {
  margin: 8px 0 4px;
}
body.surface-enterprise.page-calendar .cal-detail-when {
  margin: 0 0 8px;
  color: var(--app-text-soft);
  font-size: 12px;
}
body.surface-enterprise.page-calendar .cal-detail-body {
  margin: 0 0 8px;
  color: var(--app-text);
  font-size: 12.5px;
  line-height: 1.5;
}
body.surface-enterprise.page-calendar .cal-detail-session {
  margin: 0 0 12px;
  color: var(--app-text-mute);
  font-size: 11.5px;
}
body.surface-enterprise.page-calendar .cal-none {
  color: var(--app-text-mute);
  font-size: 12px;
  font-style: italic;
  margin: 0;
}
body.surface-enterprise.page-calendar .composer-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}
body.surface-enterprise.page-calendar .page-footer {
  margin-top: 20px;
  padding: 14px;
  text-align: center;
  color: var(--app-text-mute);
  font-size: 11.5px;
  border-top: 1px solid var(--app-line);
}

body.surface-enterprise.page-calendar #custom-alert {
  position: fixed;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgb(11 34 66 / 0.6);
  z-index: var(--z-modal);
}
body.surface-enterprise.page-calendar .alert-content {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  max-width: 440px;
  width: 92%;
}
body.surface-enterprise.page-calendar .alert-content h3 {
  margin: 0 0 6px;
  color: var(--app-accent);
  font-size: 15px;
}
body.surface-enterprise.page-calendar .alert-content p {
  margin: 0;
  color: var(--app-text);
  font-size: 13px;
}
body.surface-enterprise.page-calendar .alert-btns {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

@media (max-width: 900px) {
  body.surface-enterprise.page-calendar .cal-week {
    grid-template-columns: repeat(2, 1fr);
  }
  body.surface-enterprise.page-calendar .cal-label {
    min-width: 150px;
  }
}
@media (max-width: 767px) {
  body.surface-enterprise.page-calendar .cal-grid,
  body.surface-enterprise.page-calendar .cal-weekdays {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  body.surface-enterprise.page-calendar .cal-cell {
    min-height: 78px;
  }
  body.surface-enterprise.page-calendar .cal-week {
    grid-template-columns: 1fr;
  }
  body.surface-enterprise.page-calendar .cal-agenda-row {
    flex-wrap: wrap;
  }
  body.surface-enterprise.page-calendar .cal-agenda-date {
    min-width: 0;
    flex: 1 1 100%;
  }
}
</style>
