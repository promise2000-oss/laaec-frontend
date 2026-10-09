<script setup lang="ts">
/**
 * Reviewer / recipient picker (D-72).
 *
 * Reproduces the origin's "Submit for Approval" sheet, which appears on both the
 * lesson-plan and weekly-report forms and behaves identically in both:
 *
 *  - a typeahead on `GET /communication/users?search=`, debounced 300 ms;
 *  - the caller excluded from its own results;
 *  - `"No users found."` as the empty state;
 *  - selecting an optional reviewer, and a footer that reads
 *    `This lesson plan will be sent to <name> for review.` — or, with nothing
 *    selected, `Select a reviewer, or submit without selecting to let any
 *    authorized reviewer pick it up.`
 *
 * The 300 ms debounce is the origin's own (its lesson-plan reviewer search and
 * its HR-query recipient search both use 300 ms; only the review-inbox teacher
 * search uses 400 ms).
 */
import { onBeforeUnmount, ref, watch } from 'vue';
import { callApi } from '../../api';
import { useTeacherSession } from './useTeacherSession';
import type { TeacherDirectoryEntry } from '../../types/teacher';

const props = withDefaults(
  defineProps<{
    /** The noun used in the footer sentence, e.g. "lesson plan". */
    noun?: string;
    /** Currently chosen reviewer, if any. */
    modelValue?: TeacherDirectoryEntry | null;
  }>(),
  { noun: 'lesson plan', modelValue: null },
);

const emit = defineEmits<{
  'update:modelValue': [value: TeacherDirectoryEntry | null];
  cancel: [];
}>();

const session = useTeacherSession();

const query = ref('');
const results = ref<TeacherDirectoryEntry[]>([]);
const searching = ref(false);
const loadError = ref('');
const DEBOUNCE_MS = 300;
let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;

/** Latest-wins: a slow earlier request must not overwrite a newer result set. */
const search = async (needle: string): Promise<void> => {
  const token = ++seq;
  if (needle.trim().length === 0) {
    results.value = [];
    searching.value = false;
    return;
  }
  searching.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_TEACHER_DIRECTORY', {
      schoolID: session.schoolID(),
      requesterUsername: session.username(),
      search: needle.trim(),
    });
    if (token !== seq) return;
    if (data.status !== 'success') throw new Error(data.message || 'Search failed.');
    results.value = data.staff;
  } catch (e) {
    if (token !== seq) return;
    loadError.value = e instanceof Error ? e.message : 'Could not search for a reviewer.';
  } finally {
    if (token === seq) searching.value = false;
  }
};

watch(query, (value) => {
  clearTimeout(timer);
  timer = setTimeout(() => void search(value), DEBOUNCE_MS);
});

onBeforeUnmount(() => {
  clearTimeout(timer);
  seq += 1;
});

const choose = (entry: TeacherDirectoryEntry): void => {
  emit('update:modelValue', entry);
};

const clear = (): void => {
  emit('update:modelValue', null);
  query.value = '';
};
</script>

<template>
  <div class="tp-picker">
    <label class="tp-field">
      <span class="tp-field__label">Select who should review this {{ props.noun }}.</span>
      <input
        v-model="query"
        class="tp-input"
        type="search"
        :placeholder="`Search for a reviewer (e.g. HOD, Principal, HR)...`"
        autocomplete="off"
      />
    </label>

    <p class="tp-picker__hint">
      They will receive a notification.
    </p>

    <div v-if="props.modelValue" class="tp-picker__chosen">
      <span>
        <strong>{{ props.modelValue.fullName }}</strong>
        <span class="tp-picker__email">{{ props.modelValue.email }}</span>
      </span>
      <button type="button" class="tp-btn tp-btn--ghost" @click="clear">Change</button>
    </div>

    <p v-if="loadError" class="tp-picker__error" role="alert">{{ loadError }}</p>
    <p v-else-if="searching" class="tp-picker__state">Searching...</p>
    <p v-else-if="query.trim() && results.length === 0" class="tp-picker__state">No users found.</p>

    <ul v-else-if="results.length" class="tp-picker__list">
      <li v-for="entry in results" :key="entry.username">
        <button type="button" class="tp-picker__option" @click="choose(entry)">
          <span class="tp-picker__name">{{ entry.fullName }}</span>
          <span class="tp-picker__email">{{ entry.email }}</span>
          <span v-if="entry.department" class="tp-picker__dept">{{ entry.department }}</span>
        </button>
      </li>
    </ul>

    <p class="tp-picker__foot">
      <template v-if="props.modelValue">
        This {{ props.noun }} will be sent to {{ props.modelValue.fullName }} for review.
      </template>
      <template v-else>
        Select a reviewer, or submit without selecting to let any authorized reviewer pick it up.
      </template>
    </p>
  </div>
</template>

<style scoped>
.tp-picker {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.tp-field {
  display: flex;
  flex-direction: column;
  gap: 0.3125rem;
}

.tp-field__label {
  font-size: 0.8125rem;
  font-weight: 600;
}

.tp-input {
  font: inherit;
  font-size: 0.8125rem;
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--laec-line, #d7dee8);
  border-radius: 8px;
  background: #fff;
  color: inherit;
  width: 100%;
}

.tp-input:focus {
  outline: 2px solid var(--laec-blue, #1c4e80);
  outline-offset: 1px;
}

.tp-picker__hint,
.tp-picker__foot,
.tp-picker__state {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-muted, #5b6472);
}

.tp-picker__foot {
  padding-top: 0.375rem;
  border-top: 1px solid var(--laec-line, #d7dee8);
}

.tp-picker__error {
  margin: 0;
  font-size: 0.75rem;
  color: #8f2a2a;
}

.tp-picker__chosen {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.8125rem;
  border: 1px solid #bcd6f0;
  background: #f4f8fd;
  border-radius: 8px;
  padding: 0.5rem 0.625rem;
}

.tp-picker__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 190px;
  overflow-y: auto;
  border: 1px solid var(--laec-line, #d7dee8);
  border-radius: 8px;
}

.tp-picker__option {
  width: 100%;
  text-align: left;
  font: inherit;
  font-size: 0.8125rem;
  background: transparent;
  border: 0;
  border-radius: 6px;
  padding: 0.5rem 0.625rem;
  cursor: pointer;
  display: grid;
  gap: 0.125rem;
}

.tp-picker__option:hover {
  background: #f4f8fd;
}

.tp-picker__name {
  font-weight: 600;
}

.tp-picker__email,
.tp-picker__dept {
  font-size: 0.75rem;
  color: var(--text-muted, #5b6472);
}

.tp-btn {
  font: inherit;
  font-size: 0.75rem;
  border-radius: 8px;
  padding: 0.3125rem 0.625rem;
  cursor: pointer;
  border: 1px solid var(--laec-line, #d7dee8);
  background: #fff;
  color: inherit;
}
</style>