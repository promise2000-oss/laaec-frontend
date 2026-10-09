<script setup lang="ts">
/**
 * Events panel (D-72) — the origin's `/teacher/events`.
 *
 * The origin shares `CommunicationEventsPage` across all role paths and renders
 * cards, not a table. Its four category labels are reproduced verbatim:
 * `academic → Academic`, `event → Event`, `holiday → Holiday`,
 * `meeting → Meeting`.
 *
 * The create form is gated on `communication.events.create` in the origin, and a
 * teacher holding only `communication.read` sees no button at all. That gate is
 * reproduced here — the button is not rendered rather than rendered-and-disabled,
 * because the origin removes it.
 *
 * NOT PORTED: the events the academic calendar holds. The origin's calendar is a
 * separate module with its own nine event types and its own read-only mode; here
 * it stays on the existing `/calendar/` document (D-64), which already renders
 * the LAEC exam window. Merging the two would change an existing working surface.
 */
import { computed, onMounted, ref } from 'vue';
import { callApi } from '../../api';
import { hasPermission } from '../../lib/permissions';
import { useTeacherSession } from './useTeacherSession';
import TeacherModuleShell from './TeacherModuleShell.vue';
import type { EventCategory, SchoolEvent } from '../../types/teacher';

const CATEGORY_LABELS: Record<EventCategory, string> = {
  academic: 'Academic',
  event: 'Event',
  holiday: 'Holiday',
  meeting: 'Meeting',
};

const session = useTeacherSession();

const events = ref<SchoolEvent[]>([]);
const loading = ref(false);
const loadError = ref('');
const banner = ref('');
const permissions = ref<string[]>([]);

const creating = ref(false);
const busy = ref(false);
const formError = ref('');

const form = ref({
  title: '',
  description: '',
  location: '',
  startsAt: '',
  endsAt: '',
  category: 'event' as EventCategory,
  allDay: false,
});

const canCreate = computed(() => hasPermission(permissions.value, 'communication.events.create'));

/** The origin's `EventDateBadge` — a day/month/year tile. */
const dateParts = (value: string): { day: string; month: string; year: string } => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { day: '--', month: '---', year: '----' };
  return {
    day: d.toLocaleDateString('en-NG', { day: '2-digit' }),
    month: d.toLocaleDateString('en-NG', { month: 'short' }),
    year: d.toLocaleDateString('en-NG', { year: 'numeric' }),
  };
};

const timeRange = (event: SchoolEvent): string => {
  if (event.allDay) return 'All day';
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const fmt = (d: Date): string => d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  return Number.isNaN(start.getTime())
    ? '—'
    : `${fmt(start)}${Number.isNaN(end.getTime()) ? '' : ` – ${fmt(end)}`}`;
};

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_SCHOOL_EVENTS', { schoolID: session.schoolID() });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load events.');
    events.value = data.events;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load events.';
  } finally {
    loading.value = false;
  }
};

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

const openCreate = (): void => {
  creating.value = true;
  formError.value = '';
  form.value = {
    title: '',
    description: '',
    location: '',
    startsAt: '',
    endsAt: '',
    category: 'event',
    allDay: false,
  };
};

const submit = async (): Promise<void> => {
  if (!form.value.title.trim()) {
    formError.value = 'Title is required';
    return;
  }
  if (!form.value.startsAt) {
    formError.value = 'Start date is required';
    return;
  }
  busy.value = true;
  formError.value = '';
  try {
    const data = await callApi('PUBLISH_SCHOOL_EVENT', {
      schoolID: session.schoolID(),
      title: form.value.title.trim(),
      description: form.value.description,
      location: form.value.location,
      startsAt: form.value.startsAt,
      endsAt: form.value.endsAt || form.value.startsAt,
      category: form.value.category,
      allDay: form.value.allDay,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not publish this event.');
    banner.value = `"${form.value.title.trim()}" published.`;
    creating.value = false;
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Could not publish this event.';
  } finally {
    busy.value = false;
  }
};

onMounted(async () => {
  await Promise.all([load(), loadPermissions()]);
});
</script>

<template>
  <TeacherModuleShell
    title="Events"
    description="School events, meetings and holidays."
    :loading="loading"
    :error="loadError"
    :empty-count="events.length"
    @retry="load"
    :banner="banner"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button v-if="canCreate" type="button" class="tp-btn tp-btn--primary" @click="openCreate">
        New Event
      </button>
    </template>

    <template #empty>
      <p>No events yet. Publish the first event to get started.</p>
      <button v-if="canCreate" type="button" class="tp-btn tp-btn--primary tp-empty__cta" @click="openCreate">
        New Event
      </button>
    </template>

    <div v-if="creating" class="tp-card">
      <h3 class="tp-card__title">New event</h3>
      <label class="tp-field">
        <span class="tp-field__label">Title</span>
        <input v-model="form.title" class="tp-input" />
      </label>
      <div class="tp-form">
        <label class="tp-field">
          <span class="tp-field__label">Starts</span>
          <input v-model="form.startsAt" class="tp-input" type="datetime-local" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Ends</span>
          <input v-model="form.endsAt" class="tp-input" type="datetime-local" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Category</span>
          <select v-model="form.category" class="tp-input">
            <option v-for="(label, key) in CATEGORY_LABELS" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Location</span>
          <input v-model="form.location" class="tp-input" />
        </label>
      </div>
      <label class="tp-check" style="margin-bottom: 0.75rem">
        <input v-model="form.allDay" type="checkbox" />
        <span>All day</span>
      </label>
      <label class="tp-field">
        <span class="tp-field__label">Description</span>
        <textarea v-model="form.description" class="tp-input tp-input--area" rows="3" />
      </label>

      <p v-if="formError" class="tp-form__error" role="alert">{{ formError }}</p>

      <div class="tp-detail__actions">
        <button type="button" class="tp-btn tp-btn--ghost" :disabled="busy" @click="creating = false">
          Cancel
        </button>
        <button type="button" class="tp-btn tp-btn--primary" :disabled="busy" @click="submit">
          {{ busy ? 'Publishing...' : 'Publish event' }}
        </button>
      </div>
    </div>

    <div v-else class="tp-events">
      <article v-for="event in events" :key="event.id" class="tp-card tp-event">
        <div class="tp-event__badge" aria-hidden="true">
          <span class="tp-event__day">{{ dateParts(event.startsAt).day }}</span>
          <span class="tp-event__month">{{ dateParts(event.startsAt).month }}</span>
          <span class="tp-event__year">{{ dateParts(event.startsAt).year }}</span>
        </div>
        <div class="tp-event__body">
          <h3 class="tp-card__title">{{ event.title }}</h3>
          <p class="tp-inline-note">
            {{ CATEGORY_LABELS[event.category] }} &middot; {{ timeRange(event) }}
            <template v-if="event.location"> &middot; {{ event.location }}</template>
          </p>
          <p v-if="event.description" class="tp-event__desc">{{ event.description }}</p>
        </div>
      </article>
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

.tp-events {
  display: grid;
  gap: 0.625rem;
}

.tp-event {
  display: flex;
  gap: 0.875rem;
  align-items: flex-start;
}

.tp-event__badge {
  flex: none;
  display: grid;
  place-items: center;
  border: 1px solid #bcd6f0;
  background: #f4f8fd;
  border-radius: 8px;
  padding: 0.375rem 0.5rem;
  min-width: 3.75rem;
}

.tp-event__day {
  font-size: 1.125rem;
  font-weight: 800;
  color: #16457c;
  line-height: 1.1;
}

.tp-event__month {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #16457c;
}

.tp-event__year {
  font-size: 0.5625rem;
  color: var(--text-muted, #5b6472);
}

.tp-event__body {
  min-width: 0;
  display: grid;
  gap: 0.25rem;
}

.tp-event__desc {
  margin: 0;
  font-size: 0.8125rem;
}
</style>