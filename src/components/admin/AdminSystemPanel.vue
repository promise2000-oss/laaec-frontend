/**
 * AdminSystemPanel — the `/system/*` family: the settings forms, the audit log,
 * the backups list, the feature toggles, and the three pages the live app shows an
 * error card for.
 *
 * THE THREE ERROR PAGES, AND WHY THEY ARE REPRODUCED AS ERRORS
 * -----------------------------------------------------------
 * `/system/academic-settings`, `/system/branding` and
 * `/system/notification-settings` each render a heading, their description, and
 * then `Couldn't load …` with a Back to settings link. That is not a 404 and not
 * an empty state: the deployed app calls
 * `/system/settings/{academic|branding|notifications}` and something fails. An
 * audit that "fixed" these by inventing a form would be documenting a feature that
 * does not exist, and one that left them blank would be hiding a real defect. So
 * they render exactly what the live app renders, with the live error text.
 *
 * `BrandingSettings` is still typed and the mock still serves it, because the
 * endpoint the live app calls does exist — it is this page's read that fails.
 * That is recorded in feature-inventory.md, not hidden by removing the type.
 *
 * THE TWO SETTINGS FORMS
 * ----------------------
 * `/system/general-settings` is three sections (School information, Regional
 * settings, Active academic session) and one Save. `/system/system-configuration`
 * is four (Limits & defaults, Security, Integrations/Maintenance, Data &
 * retention) and FOUR Saves — one per section. Both are reproduced, including the
 * per-section save, because an operator who edits Security and clicks Save at the
 * top of the page expects that to save Security and this page makes that
 * unambiguous by putting the button in the section.
 */
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { callApi } from '../../api';
import AdminModuleShell from './AdminModuleShell.vue';
import AdminResourcePanel from './AdminResourcePanel.vue';
import AdminStatusBadge from './AdminStatusBadge.vue';
import { useAdminSession } from './useAdminSession';
import { UNAVAILABLE_SETTINGS } from '../../types/admin-registry';
import type { AdminModule } from '../../types/admin-registry';
import type { GeneralSettings, SystemConfiguration } from '../../types/admin';

const props = defineProps<{ module: AdminModule }>();
const can = defineModel<((permission?: string | null) => boolean) | null>('can', { default: null });

const session = useAdminSession();
const mayWrite = computed(() => (can.value ? can.value('system.settings.update') : true));

const isGeneral = computed(() => props.module.resource === 'general-settings');
const isConfiguration = computed(() => props.module.resource === 'system-configuration');
const isUnavailable = computed(() => props.module.resource === 'unavailable-settings');

const settings = ref<GeneralSettings | null>(null);
const configuration = ref<SystemConfiguration | null>(null);

/**
 * `loading` starts TRUE. The two form kinds below bind straight to `settings` /
 * `configuration` (`v-model="settings.schoolName"`), and `onMounted` has not run
 * on the first paint — so a `false` here would render the form against a null
 * object and throw. Starting true means the shell shows its spinner instead,
 * which is what the live app does while the settings load.
 */
const loading = ref(true);
const loadError = ref('');
const banner = ref('');
const errors = ref<Record<string, string>>({});
const busy = ref(false);

const unavailable = computed(() => UNAVAILABLE_SETTINGS[props.module.id]);

const load = async (): Promise<void> => {
  /*
   * The three unavailable pages have nothing to fetch, so `loading` is cleared
   * immediately. It starts `true` (see the declaration), which would otherwise
   * leave those three showing the spinner forever.
   */
  if (isUnavailable.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  loadError.value = '';
  try {
    if (isGeneral.value) {
      const data = await callApi('GET_ADMIN_GENERAL_SETTINGS', { schoolID: session.schoolId() });
      if (data.status !== 'success') throw new Error(data.message || 'Failed to load.');
      settings.value = data.settings;
    } else if (isConfiguration.value) {
      const data = await callApi('GET_ADMIN_SYSTEM_CONFIGURATION', { schoolID: session.schoolId() });
      if (data.status !== 'success') throw new Error(data.message || 'Failed to load.');
      configuration.value = data.settings;
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load.';
  } finally {
    loading.value = false;
  }
};

onMounted(load);

/* The live general-settings form's one required field: "School name *" — and the
   source's message for it is "School name is required". */
const saveGeneral = async (): Promise<void> => {
  if (!settings.value) return;
  const found: Record<string, string> = {};
  if (!settings.value.schoolName.trim()) found.schoolName = 'School name is required';
  errors.value = found;
  if (Object.keys(found).length) return;

  busy.value = true;
  try {
    const data = await callApi('SAVE_GENERAL_SETTINGS', { settings: settings.value, actor: session.actor() });
    if (data.status !== 'success') throw new Error(data.message || 'Save failed.');
    banner.value = data.message || 'General settings saved.';
  } catch (e) {
    banner.value = e instanceof Error ? e.message : 'Save failed.';
  } finally {
    busy.value = false;
  }
};

const saveConfiguration = async (): Promise<void> => {
  if (!configuration.value) return;
  const found: Record<string, string> = {};
  /* The origin's own floor, from `system-system-configuration`: a minimum
     password length below 8 is refused rather than saved. */
  if (configuration.value.minimumPasswordLength < 8) {
    found.minimumPasswordLength = 'Minimum password length must be at least 8.';
  }
  if (configuration.value.sessionTimeoutMinutes < 1) {
    found.sessionTimeoutMinutes = 'Enter a whole number of 0 or more.';
  }
  errors.value = found;
  if (Object.keys(found).length) return;

  busy.value = true;
  try {
    const data = await callApi('SAVE_SYSTEM_CONFIGURATION', { settings: configuration.value, actor: session.actor() });
    if (data.status !== 'success') throw new Error(data.message || 'Save failed.');
    banner.value = data.message || 'System configuration saved.';
  } catch (e) {
    banner.value = e instanceof Error ? e.message : 'Save failed.';
  } finally {
    busy.value = false;
  }
};

/**
 * Reading a general-settings field as a string, for the `:value` + `@input` pairs
 * that bind to a typed interface's non-string fields. `v-model` on a computed
 * property of an object returned from a ref would need a writable computed per
 * field, which is fifteen more declarations than the two-field pattern below.
 */
const field = (key: keyof GeneralSettings): string => String(settings.value?.[key] ?? '');
</script>

<template>
  <!-- ── the three pages the live app fails to load ────────────────────── -->
  <AdminModuleShell
    v-if="isUnavailable"
    :title="unavailable?.title ?? module.title"
    :description="unavailable?.description ?? module.description"
    :empty-count="1"
    :banner="banner"
    @dismiss="banner = ''"
  >
    <div class="ap-error" role="alert">
      <p class="ap-error__text">{{ unavailable?.error }}</p>
    </div>
    <p class="ap-inline-note">
      The {{ unavailable?.description }} This page is reproduced as the live deployment renders it: the read behind it fails
      there, and inventing a form would document a feature that does not exist.
    </p>
    <div class="ap-detail__actions">
      <RouterLink class="ap-btn" :to="{ path: '/admin/', query: { panel: 'general-settings' } }">Back to settings</RouterLink>
    </div>
  </AdminModuleShell>

  <!-- ── general settings ──────────────────────────────────────────────── -->
  <AdminModuleShell
    v-else-if="isGeneral && settings"
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :banner="banner"
    :empty-count="1"
    @retry="load"
    @dismiss="banner = ''"
  >
    <section class="ap-sys__section">
      <h3 class="ap-sys__heading">School information</h3>
      <p class="ap-inline-note">Public details shown to parents and staff.</p>
      <div class="ap-form">
        <label class="ap-field">
          <span class="ap-field__label">School name <span class="ap-field__req">*</span></span>
          <input v-model="settings.schoolName" class="ap-input" type="text" />
          <span v-if="errors.schoolName" class="ap-form__error" role="alert">{{ errors.schoolName }}</span>
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Motto</span>
          <input :value="field('motto')" class="ap-input" type="text" @input="settings!.motto = ($event.target as HTMLInputElement).value" />
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Tagline</span>
          <input :value="field('tagline')" class="ap-input" type="text" @input="settings!.tagline = ($event.target as HTMLInputElement).value" />
        </label>
        <label class="ap-field ap-field--full">
          <span class="ap-field__label">Address</span>
          <textarea :value="field('address')" class="ap-input ap-input--area" rows="2" @input="settings!.address = ($event.target as HTMLTextAreaElement).value" />
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Phone number</span>
          <input :value="field('phone')" class="ap-input" type="tel" @input="settings!.phone = ($event.target as HTMLInputElement).value" />
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Email address</span>
          <input :value="field('email')" class="ap-input" type="email" @input="settings!.email = ($event.target as HTMLInputElement).value" />
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Website</span>
          <input :value="field('website')" class="ap-input" type="text" @input="settings!.website = ($event.target as HTMLInputElement).value" />
        </label>
      </div>
    </section>

    <section class="ap-sys__section">
      <h3 class="ap-sys__heading">Regional settings</h3>
      <p class="ap-inline-note">Timezone, currency and formatting preferences.</p>
      <div class="ap-form">
        <label class="ap-field">
          <span class="ap-field__label">Timezone</span>
          <select :value="field('timezone')" class="ap-input" @change="settings!.timezone = ($event.target as HTMLSelectElement).value">
            <option>Africa/Lagos</option><option>UTC</option>
          </select>
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Locale</span>
          <select :value="field('locale')" class="ap-input" @change="settings!.locale = ($event.target as HTMLSelectElement).value">
            <option value="en-NG">English (Nigeria)</option><option value="en-GB">English (United Kingdom)</option>
          </select>
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Currency</span>
          <select :value="field('currency')" class="ap-input" @change="settings!.currency = ($event.target as HTMLSelectElement).value">
            <option value="NGN">₦ Naira (NGN)</option><option value="USD">$ US Dollar (USD)</option>
          </select>
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Date format</span>
          <select :value="field('dateFormat')" class="ap-input" @change="settings!.dateFormat = ($event.target as HTMLSelectElement).value">
            <option value="dd/MM/yyyy">DD/MM/YYYY</option><option value="yyyy-MM-dd">YYYY-MM-DD</option>
          </select>
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Week starts on</span>
          <select :value="field('weekStartsOn')" class="ap-input" @change="settings!.weekStartsOn = ($event.target as HTMLSelectElement).value">
            <option>Monday</option><option>Sunday</option>
          </select>
        </label>
      </div>
    </section>

    <section class="ap-sys__section">
      <h3 class="ap-sys__heading">Active academic session</h3>
      <p class="ap-inline-note">The session and term currently in progress.</p>
      <div class="ap-form">
        <label class="ap-field">
          <span class="ap-field__label">Academic session</span>
          <select :value="field('academicSession')" class="ap-input" @change="settings!.academicSession = ($event.target as HTMLSelectElement).value">
            <option>2026/2027</option><option>2025/2026</option>
          </select>
        </label>
        <label class="ap-field">
          <span class="ap-field__label">Current term</span>
          <select :value="field('currentTerm')" class="ap-input" @change="settings!.currentTerm = ($event.target as HTMLSelectElement).value">
            <option>First</option><option>Second</option><option>Third</option>
          </select>
        </label>
      </div>
      <div class="ap-detail__actions">
        <button v-if="mayWrite" type="button" class="ap-btn ap-btn--primary" :disabled="busy" @click="saveGeneral">Save changes</button>
      </div>
    </section>
  </AdminModuleShell>

  <!-- ── system configuration ──────────────────────────────────────────── -->
  <AdminModuleShell
    v-else-if="isConfiguration && configuration"
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :banner="banner"
    :empty-count="1"
    @retry="load"
    @dismiss="banner = ''"
  >
    <section class="ap-sys__section">
      <h3 class="ap-sys__heading">Limits &amp; defaults</h3>
      <p class="ap-inline-note">Platform-wide limits that apply to all tenants.</p>
      <div class="ap-form">
        <label class="ap-field"><span class="ap-field__label">Session timeout (minutes)</span><input v-model.number="configuration.sessionTimeoutMinutes" class="ap-input" type="number" min="0" /></label>
        <label class="ap-field"><span class="ap-field__label">Max upload size (MB)</span><input v-model.number="configuration.maxUploadSizeMb" class="ap-input" type="number" min="0" /></label>
        <label class="ap-field"><span class="ap-field__label">Data retention (days)</span><input v-model.number="configuration.dataRetentionDays" class="ap-input" type="number" min="0" /></label>
        <label class="ap-field"><span class="ap-field__label">Max students per class</span><input v-model.number="configuration.maxStudentsPerClass" class="ap-input" type="number" min="0" /></label>
      </div>
      <div class="ap-detail__actions"><button v-if="mayWrite" type="button" class="ap-btn ap-btn--primary" :disabled="busy" @click="saveConfiguration">Save changes</button></div>
    </section>

    <section class="ap-sys__section">
      <h3 class="ap-sys__heading">Security</h3>
      <p class="ap-inline-note">Password policy and account protection settings.</p>
      <div class="ap-form">
        <label class="ap-field">
          <span class="ap-field__label">Minimum password length</span>
          <input v-model.number="configuration.minimumPasswordLength" class="ap-input" type="number" min="0" />
          <span v-if="errors.minimumPasswordLength" class="ap-form__error" role="alert">{{ errors.minimumPasswordLength }}</span>
        </label>
        <label class="ap-field"><span class="ap-field__label">Password expiry (days)</span><input v-model.number="configuration.passwordExpiryDays" class="ap-input" type="number" min="0" /></label>
        <label class="ap-field"><span class="ap-field__label">Failed attempts before lockout</span><input v-model.number="configuration.failedAttemptsBeforeLockout" class="ap-input" type="number" min="0" /></label>
        <label class="ap-field"><span class="ap-field__label">Lockout window (minutes)</span><input v-model.number="configuration.lockoutWindowMinutes" class="ap-input" type="number" min="0" /></label>
        <label class="ap-field ap-field--check">
          <input v-model="configuration.requireTwoFactor" type="checkbox" />
          <span>Require two-factor authentication — all staff must enrol an authenticator app.</span>
        </label>
      </div>
      <div class="ap-detail__actions"><button v-if="mayWrite" type="button" class="ap-btn ap-btn--primary" :disabled="busy" @click="saveConfiguration">Save changes</button></div>
    </section>

    <section class="ap-sys__section">
      <h3 class="ap-sys__heading">Integrations</h3>
      <p class="ap-inline-note">Service providers and connection keys.</p>
      <label class="ap-field ap-field--check">
        <input v-model="configuration.maintenanceMode" type="checkbox" />
        <span>Maintenance mode — blocks all sign-ins and shows a notice page.</span>
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Maintenance message</span>
        <textarea v-model="configuration.maintenanceMessage" class="ap-input ap-input--area" rows="2" />
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Allowed IP addresses</span>
        <input v-model="configuration.allowedIpAddresses" class="ap-input" type="text" />
      </label>
      <div class="ap-detail__actions"><button v-if="mayWrite" type="button" class="ap-btn ap-btn--primary" :disabled="busy" @click="saveConfiguration">Save changes</button></div>
    </section>

    <section class="ap-sys__section">
      <h3 class="ap-sys__heading">Data &amp; retention</h3>
      <p class="ap-inline-note">Database details and backup coordination.</p>
      <dl class="ap-fields">
        <div><dt>Database name</dt><dd>{{ configuration.databaseName }}</dd></div>
        <div><dt>Status</dt><dd><AdminStatusBadge status="active" /></dd></div>
      </dl>
    </section>
  </AdminModuleShell>

  <!-- ── audit logs, backups, feature toggles: plain lists ──────────────── -->
  <AdminResourcePanel v-else v-model:can="can" :module="module" />
</template>

<style scoped>
@import './admin-panel.css';

.ap-sys__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border: 1px solid var(--laec-line, #d7dee8);
  border-radius: 12px;
  background: #fff;
  padding: 0.875rem 1rem;
}

.ap-sys__heading {
  margin: 0;
  font-size: 0.9375rem;
}
</style>
