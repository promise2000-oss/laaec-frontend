<script setup lang="ts">
/**
 * Profile panel (D-72) — the origin's `/teacher/profile`.
 *
 * The origin shares `MyProfilePage` between `/teacher/profile` and `/profile` and
 * carries no page-level permission requirement at all: any session that can
 * reach the page can edit itself. That is reproduced — there is no gate here
 * beyond the transport's, which the action map ties to `teacher.read`.
 *
 * Field set transcribed from `UpdateProfilePayload`. Two of the origin's groups
 * are deliberately NOT here:
 *
 *  - `bankName`, `accountName`, `accountNumber`, `monthlySalary` are pay data.
 *    LAEC's teacher console has no payroll surface and no role that could read
 *    one, so shipping the fields would create a place to type bank details with
 *    nothing behind it.
 *  - `avatarUrl` is omitted because uploading it needs the attachment transport
 *    this portal does not have (see docs/teacher-portal/api-map.md).
 *
 * `GENDER_OPTIONS` (`MALE`/`FEMALE`) and `MARITAL_STATUS_OPTIONS`
 * (`MARRIED`/`UNMARRIED`) are the origin's, uppercase and in that order.
 */
import { onMounted, ref } from 'vue';
import { callApi } from '../../api';
import { useTeacherSession } from './useTeacherSession';
import TeacherModuleShell from './TeacherModuleShell.vue';
import type { TeacherProfile } from '../../types/teacher';

const GENDER_OPTIONS = ['MALE', 'FEMALE'] as const;
const MARITAL_STATUS_OPTIONS = ['MARRIED', 'UNMARRIED'] as const;

const session = useTeacherSession();

const profile = ref<TeacherProfile | null>(null);
const loading = ref(false);
const loadError = ref('');
const saving = ref(false);
const banner = ref('');
const formError = ref('');

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_MY_PROFILE', {
      schoolID: session.schoolID(),
      username: session.username(),
    });
    if (data.status !== 'success' || !data.profile) {
      throw new Error(data.message || 'Failed to load your profile.');
    }
    profile.value = data.profile;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load your profile.';
  } finally {
    loading.value = false;
  }
};

const save = async (): Promise<void> => {
  const current = profile.value;
  if (!current) return;
  formError.value = '';
  if (!current.firstName.trim()) {
    formError.value = 'First name is required';
    return;
  }
  if (!current.lastName.trim()) {
    formError.value = 'Last name is required';
    return;
  }
  if (!current.email.trim()) {
    formError.value = 'Email is required';
    return;
  }
  saving.value = true;
  try {
    const data = await callApi('UPDATE_TEACHER_PROFILE', {
      schoolID: session.schoolID(),
      username: session.username(),
      profile: current,
    });
    if (data.status !== 'success' || !data.profile) {
      throw new Error(data.message || 'Could not save your profile.');
    }
    profile.value = data.profile;
    banner.value = 'Profile updated.';
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Could not save your profile.';
  } finally {
    saving.value = false;
  }
};

onMounted(load);
</script>

<template>
  <TeacherModuleShell
    title="Profile"
    description="Your staff record."
    :loading="loading"
    :error="loadError"
    :empty-count="profile ? 1 : 0"
    @retry="load"
    :banner="banner"
    @dismiss="banner = ''"
  >
    <template #empty>
      <p>No profile loaded.</p>
      <button type="button" class="tp-btn tp-btn--primary tp-empty__cta" @click="load">Reload</button>
    </template>

    <form v-if="profile" class="tp-card" @submit.prevent="save">
      <section class="tp-section">
        <h3 class="tp-card__title">Personal details</h3>
        <div class="tp-form">
          <label class="tp-field">
            <span class="tp-field__label">First name</span>
            <input v-model="profile.firstName" class="tp-input" />
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Last name</span>
            <input v-model="profile.lastName" class="tp-input" />
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Email</span>
            <input v-model="profile.email" class="tp-input" type="email" />
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Phone</span>
            <input v-model="profile.phone" class="tp-input" />
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Gender</span>
            <select v-model="profile.gender" class="tp-input">
              <option v-for="entry in GENDER_OPTIONS" :key="entry" :value="entry">{{ entry }}</option>
            </select>
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Date of birth</span>
            <input v-model="profile.dateOfBirth" class="tp-input" type="date" />
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Marital status</span>
            <select v-model="profile.maritalStatus" class="tp-input">
              <option v-for="entry in MARITAL_STATUS_OPTIONS" :key="entry" :value="entry">
                {{ entry }}
              </option>
            </select>
          </label>
          <label class="tp-field">
            <span class="tp-field__label">Emergency mobile</span>
            <input v-model="profile.emergencyMobile" class="tp-input" />
          </label>
        </div>
        <label class="tp-field">
          <span class="tp-field__label">Address</span>
          <input v-model="profile.address" class="tp-input" />
        </label>
        <label class="tp-field">
          <span class="tp-field__label">Qualifications</span>
          <textarea v-model="profile.qualifications" class="tp-input tp-input--area" rows="3" />
        </label>
      </section>

      <p v-if="formError" class="tp-form__error" role="alert">{{ formError }}</p>

      <div class="tp-detail__actions">
        <button type="submit" class="tp-btn tp-btn--primary" :disabled="saving">
          {{ saving ? 'Saving...' : 'Save profile' }}
        </button>
      </div>
    </form>
  </TeacherModuleShell>
</template>

<style scoped>
@import './teacher-panel.css';

.tp-section + .tp-section {
  margin-top: 1rem;
  border-top: 1px solid var(--laec-line, #d7dee8);
  padding-top: 1rem;
}

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
</style>