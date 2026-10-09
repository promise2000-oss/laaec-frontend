<script setup lang="ts">
/**
 * PRD §4.4 — `/control/` — Admin Command Center.
 *
 * Copy, structure and behaviour ported verbatim from origin-pages/control.html
 * (captured 2026-09-28). Deliberate deviations, all logged in BUILD-LOG:
 *  - Transport: typed mock adapter (D-05). `REQUEST_ADMIN_PASSWORD_RESET`,
 *    `CONFIRM_ADMIN_PASSWORD_RESET`, `UPDATE_ADMIN_STATUS` and
 *    `SEND_ADMIN_PASSWORD_CHANGED_EMAIL` (RF-63, D-09) go through `callApi`
 *    instead of `fetch(AWS_CONFIG.registerEndpoint)`.
 *  - Cognito: a real `AuthenticationDetails` object is constructed but never
 *    sent anywhere (D-11, D-31) — `mockAuthenticateAdmin` /
 *    `mockCompleteAdminPasswordChallenge` stand in for `authenticateUser` /
 *    `completeNewPasswordChallenge`, returning the three outcomes the page
 *    branches on. The real user pool is never contacted.
 *  - Cloudflare challenge markup/scripts omitted (DEV-1). The `/laec logo.png`
 *    reference is no longer kept broken — the LAEC crest is served and shown
 *    (2026-10-02; see `logoSrc` below).
 *  - PRD transcription discrepancy: §4.4 calls the two-minute timer an "idle
 *    timer"; the origin arms a fixed timer once on page load with no activity
 *    listeners and no re-arm (attested, `startControlReturnHomeTimer`).
 *    Origin implemented — `useIdleTimeout({ mode: 'control' })`.
 *
 * Mock credentials (fictional): `mocksuper` / `mockschool` / `mockict` /
 * `mockcommittee` with `MockAdminPass1`; `mocktemp` / `TempAdmin1!` forces the
 * RF-59 password change; `mockguest` / `MockAdminPass1` authenticates without
 * a console role (RF-66).
 *
 * ROLE-SCOPED VARIANTS (2026-10-02)
 * ---------------------------------
 * The page now also serves six role-specific doors (`/login/school/`,
 * `/login/ict/`, `/login/committee/`, `/login/teacher/`, `/login/central/`,
 * `/login/super/`), all of which render this same component with a `portal`
 * prop naming the one claim they accept. With no prop — at `/control/` — the
 * page behaves and reads exactly as the origin did: a role-agnostic staff gate
 * that accepts any of the six claims and dispatches on the result. The
 * `portal` prop only supplies the heading and adds the wrong-role refusal;
 * every form, message, timer and mock call is shared, so the doors cannot
 * drift apart from the page they were derived from.
 */

import { computed, onMounted, reactive, ref } from 'vue';
import { AuthenticationDetails } from 'amazon-cognito-identity-js';
import { callApi, mockAuthenticateAdmin, mockCompleteAdminPasswordChallenge } from '../api';
import type { ApiEnvelope, MockAdminAuthSuccess } from '../api';
import { useIdleTimeout } from '../composables/useIdleTimeout';
import { PORTALS, portalForRole, ROLE_PORTALS } from '../lib/portals';
import type { Portal } from '../lib/portals';
import { STORAGE_KEYS } from '../types';
import type { AdminRole } from '../types';

/**
 * The role this instance is scoped to, or `null` at `/control/` for the
 * role-agnostic origin page.
 */
const props = defineProps<{ portal?: Portal }>();

const portal = computed(() => props.portal ?? null);

/* ── constants (origin globals, lines 287–296) ────────────────────────── */

/**
 * The first four are the origin's own routes. The two added by the
 * exam-management addendum (D-55): a teacher lands on the authoring console,
 * the Central Admin on the review console.
 *
 * Derived from `lib/portals.ts` rather than repeated, so a console can only
 * move if its door moves with it. The result is identical to the origin table.
 */
const ROLE_DESTINATIONS: Record<AdminRole, string> = Object.fromEntries(
  ROLE_PORTALS.map((p) => [p.role, p.consolePath]),
) as Record<AdminRole, string>;

/** The heading pair this page shows — the door's, or the origin's. */
const loginHeading = computed(() => portal.value?.loginHeading ?? 'ADMIN PORTAL');
const loginSubheading = computed(
  () => portal.value?.loginSubheading ?? 'Lagos Archdiocesan Education Commission',
);

/**
 * Every door except this one, for the switcher under the card.
 *
 * The wrong-role refusal names the door an account belongs to, and this lets
 * the person act on that immediately rather than hunting for it. It appears
 * only on the scoped doors: at `/control/` the claim is discovered after
 * authenticating and the page already dispatches to the right console, so there
 * is nothing to switch away from.
 */
const otherPortals = computed(() => PORTALS.filter((p) => p.path !== portal.value?.path));

/** `poolData` — recorded for traceability; the pool is never constructed. */
const POOL_DATA = { UserPoolId: 'us-east-1_K9Rbj2rSw', ClientId: '1rhsndrfu8gf4pjmfn4rp4q5og' } as const;

const PASSWORD_EYE_OPEN =
  '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
const PASSWORD_EYE_CLOSED =
  '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle><path d="M4 12h16"></path></svg>';

/** One admin session id per browser, minted on first load (RF-64). */
const adminSessionID =
  localStorage.getItem(STORAGE_KEYS.AdminSessionID) ||
  `ADM_${Date.now()}_${Math.random().toString(36).slice(2)}`;

/**
 * The LAEC crest, served as `/laec-crest.png`.
 *
 * D-13 / RF-6 originally held that the origin's logo reference is `laec logo.png`
 * (with the space) and is deliberately left unserved so the image fails exactly
 * as it does on the live site. Reversed by client instruction (2026-10-02): the
 * card and the six role-scoped doors were rendering a broken-image glyph where
 * the crest belongs. `public/nicegene_logo.png` is still the generic
 * student-avatar placeholder inside the consoles — a different job, untouched.
 */
const logoSrc = '/laec-crest.png';

/** `currentCognitoUser` — the mock needs only the username. */
let currentUsername = '';

/* ── form visibility and messaging ────────────────────────────────────── */

const showLogin = ref(true);
const showNewPassword = ref(false);
const showForgot = ref(false);
const showForgotStep2 = ref(false);
const forgotStepText = ref('Enter your Admin ID to receive a verification code.');

const username = ref('');
const password = ref('');
const msg = ref('');
const msgColor = ref('');
const loaderVisible = ref(false);

const newPassword = ref('');
const confirmPassword = ref('');
const msgNew = ref('');
const msgNewColor = ref('');
const loaderNew = ref(false);
const updateDisabled = ref(false);

const forgotUsername = ref('');
const verificationCode = ref('');
const forgotNewPassword = ref('');
const msgForgot = ref('');
const msgForgotColor = ref('');
const loaderForgot = ref(false);

const modalVisible = ref(false);
const modalTitle = ref('Security Notice');
const modalMsg = ref('');

/** RF-60: `#` is advertised by the UI but rejected by the validator (D-08). */
const passwordVisible = reactive<Record<string, boolean>>({
  password: false,
  'new-password': false,
  'confirm-password': false,
  'forgot-new-password': false,
});

type ReqKey = 'len' | 'case' | 'num' | 'sym';
const REQ_KEYS: readonly ReqKey[] = ['len', 'case', 'num', 'sym'] as const;
const reqValid = reactive<Record<ReqKey, boolean>>({ len: false, case: false, num: false, sym: false });
const fReqValid = reactive<Record<ReqKey, boolean>>({ len: false, case: false, num: false, sym: false });

/* ── helpers (origin functions) ───────────────────────────────────────── */

const msgOf = (e: unknown): string =>
  e instanceof Error
    ? e.message
    : typeof e === 'object' && e !== null && 'message' in e
      ? String((e as { message: unknown }).message)
      : '';

const togglePasswordVisibility = (inputId: string): void => {
  passwordVisible[inputId] = !passwordVisible[inputId];
};

const eyeIcon = (inputId: string): string =>
  passwordVisible[inputId] ? PASSWORD_EYE_OPEN : PASSWORD_EYE_CLOSED;

const eyeLabel = (inputId: string): string =>
  passwordVisible[inputId] ? 'Hide password' : 'Show password';

/** `winAlert` in the origin's style: a modal with a title and a body. */
const winAlert = (title: string, message: string): void => {
  modalTitle.value = title;
  modalMsg.value = message;
  modalVisible.value = true;
};

/**
 * "an ICT Administrator", "a School Administrator". Only the refusal message
 * needs this, and only because one of the six role labels starts with a vowel;
 * a role added later starting with one must not produce "a Examination ...".
 */
const indefiniteArticle = (label: string): string =>
  /^[aeiou]/i.test(label) ? `an ${label}` : `a ${label}`;

const closeModal = (): void => {
  modalVisible.value = false;
};

/** The message line the origin would target for the visible form. */
const activeMessage = (): { text: typeof msg; color: typeof msgColor } | null => {
  if (showForgot.value) return { text: msgForgot, color: msgForgotColor };
  if (showNewPassword.value) return { text: msgNew, color: msgNewColor };
  return { text: msg, color: msgColor };
};

const evaluatePassword = (val: string): Record<ReqKey, boolean> => ({
  len: val.length >= 8,
  case: /[a-z]/.test(val) && /[A-Z]/.test(val),
  num: /\d/.test(val),
  sym: /[@$!%*?&]/.test(val),
});

/** `validatePassword(val, prefix)` — updates indicators, returns all-met. */
const validatePassword = (val: string, prefix: 'req' | 'f-req'): boolean => {
  const reqs = evaluatePassword(val);
  const target = prefix === 'req' ? reqValid : fReqValid;
  for (const key of REQ_KEYS) target[key] = reqs[key];
  return REQ_KEYS.every((key) => reqs[key]);
};

type AdminPasswordAction =
  | { action: 'REQUEST_ADMIN_PASSWORD_RESET'; username: string }
  | {
      action: 'CONFIRM_ADMIN_PASSWORD_RESET';
      username: string;
      code: string;
      newPassword: string;
    }
  | {
      action: 'SEND_ADMIN_PASSWORD_CHANGED_EMAIL';
      username: string;
      newPassword: string;
      reason: string;
    };

/**
 * `postAdminPasswordAction` — origin POSTs the envelope to the register
 * endpoint; here each action is routed to the typed mock and an error
 * envelope is thrown exactly as the origin threw on `!response.ok ||
 * data.status === "error"`.
 */
const postAdminPasswordAction = async (payload: AdminPasswordAction): Promise<ApiEnvelope> => {
  let data: ApiEnvelope;
  switch (payload.action) {
    case 'REQUEST_ADMIN_PASSWORD_RESET':
      data = await callApi('REQUEST_ADMIN_PASSWORD_RESET', { username: payload.username });
      break;
    case 'CONFIRM_ADMIN_PASSWORD_RESET':
      data = await callApi('CONFIRM_ADMIN_PASSWORD_RESET', {
        username: payload.username,
        code: payload.code,
        newPassword: payload.newPassword,
      });
      break;
    case 'SEND_ADMIN_PASSWORD_CHANGED_EMAIL':
      data = await callApi('SEND_ADMIN_PASSWORD_CHANGED_EMAIL', {
        username: payload.username,
        newPassword: payload.newPassword,
        reason: payload.reason,
      });
      break;
  }
  if (data.status !== 'success') {
    throw new Error(data.message || 'Password email request failed.');
  }
  return data;
};

/* ── RF-4: fixed two-minute return-home timer (no activity events) ────── */

const idle = useIdleTimeout({ mode: 'control' });

/* ── login (RF-58…RF-66) ──────────────────────────────────────────────── */

/**
 * RF-67 / D-10 — the origin's session-lock stub: it validates its arguments
 * and does nothing else. Administrator single-session locking is not enforced
 * on this page (Q8).
 */
const startAdminSessionLock = async (details: {
  schoolId: string;
  username: string;
  role: string;
}): Promise<void> => {
  if (!details.username || !details.role) throw new Error('Missing admin session details.');
};

const processLoginSuccess = async (
  result: MockAdminAuthSuccess,
  changedPassword = '',
): Promise<void> => {
  const idToken = result.idPayload;
  const role = String(idToken['custom:Role'] || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  const schoolId = String(idToken['custom:SchoolID'] || '').trim().toUpperCase();
  const fullName = idToken.name || 'Admin';
  const user = currentUsername; // captured for the status sync
  idle.clear();

  /*
   * A role-scoped door accepts exactly one claim (2026-10-02). An account that
   * belongs to a different door is refused here, BEFORE any session key is
   * written — so a wrong guess leaves no half-open session behind — and the
   * message names the door it does belong to rather than just saying no.
   *
   * `/control/` has no `portal` and so skips this entirely, which is what keeps
   * the origin page's RF-66 behaviour intact: there, an account with no console
   * role at all falls through to the `Unauthorized` alert.
   */
  const door = portal.value;
  if (door?.role && role !== door.role) {
    const owner = portalForRole(role);
    const target = activeMessage();
    const text = owner
      ? `This account is ${indefiniteArticle(owner.roleLabel)}. It belongs in the “${owner.title}” portal, not this one.`
      : `This account does not have ${door.roleLabel} privileges.`;
    if (target) {
      target.text.value = text;
      target.color.value = 'red';
    } else {
      winAlert('Wrong Portal', text);
    }
    loaderVisible.value = false;
    loaderNew.value = false;
    loaderForgot.value = false;
    idle.arm();
    return;
  }

  if ((Object.keys(ROLE_DESTINATIONS) as string[]).includes(role)) {
    try {
      await startAdminSessionLock({ schoolId, username: user, role });
    } catch (error) {
      // Cognito sign-out has no counterpart in the mock; the origin reports
      // the failure on whichever message line is visible.
      const target = activeMessage();
      if (target) {
        target.text.value = msgOf(error);
        target.color.value = 'red';
      } else {
        winAlert('Session Active', msgOf(error));
      }
      loaderVisible.value = false;
      loaderNew.value = false;
      loaderForgot.value = false;
      idle.arm();
      return;
    }

    localStorage.setItem(STORAGE_KEYS.LAEC_Session, result.accessToken);
    localStorage.setItem(STORAGE_KEYS.AdminName, fullName);
    localStorage.setItem(STORAGE_KEYS.SchoolID, schoolId);
    localStorage.setItem(STORAGE_KEYS.AdminRole, role);
    localStorage.setItem(STORAGE_KEYS.AdminUsername, user);
    localStorage.setItem(STORAGE_KEYS.AdminSessionID, adminSessionID);

    // --- INTEGRATED: DYNAMODB STATUS SYNCHRONIZATION (RF-63, D-09) ---
    const completedFirstLoginPasswordChange = showNewPassword.value;
    if (completedFirstLoginPasswordChange) {
      void callApi('UPDATE_ADMIN_STATUS', {
        schoolID: schoolId,
        username: user,
        newStatus: 'ACTIVE',
      }).catch((e: unknown) => console.warn('Status Sync Request Failed', e));

      if (changedPassword) {
        void postAdminPasswordAction({
          action: 'SEND_ADMIN_PASSWORD_CHANGED_EMAIL',
          username: user,
          newPassword: changedPassword,
          reason: 'FIRST_LOGIN_PASSWORD_CHANGE',
        }).catch((e: unknown) => console.warn('Password Change Email Failed', e));
      }
    }

    const target = activeMessage();
    if (target) {
      target.text.value = 'Access Granted! Loading Secure Dashboard...';
      target.color.value = 'green';
    }

    setTimeout(() => {
      const destination = ROLE_DESTINATIONS[role as AdminRole];
      if (destination) window.location.href = destination;
    }, 1000);
  } else {
    winAlert('Unauthorized', 'This account does not have Admin privileges. Access Restricted.');
    setTimeout(() => {
      location.reload();
    }, 3000);
  }
};

const handleAdminLogin = async (): Promise<void> => {
  const name = username.value.trim();
  const pass = password.value;
  idle.clear(); // clearControlReturnHomeTimer()

  if (!name || !pass) {
    msg.value = 'Credentials required.';
    msgColor.value = 'red';
    idle.arm();
    return;
  }

  loaderVisible.value = true;
  msg.value = 'Verifying Authority...';
  msgColor.value = 'var(--laec-blue)';

  // Origin: new AmazonCognitoIdentity.AuthenticationDetails(authenticationData)
  // — built for parity, never transmitted (D-11, D-31).
  void new AuthenticationDetails({ Username: name, Password: pass });
  currentUsername = name;

  try {
    const outcome = await mockAuthenticateAdmin(name, pass);
    if (outcome.kind === 'newPasswordRequired') {
      showLogin.value = false;
      showNewPassword.value = true;
      return;
    }
    await processLoginSuccess(outcome.result);
  } catch (err) {
    msg.value = msgOf(err) || 'Login failed.';
    msgColor.value = 'red';
    loaderVisible.value = false;
    idle.arm();
  }
};

/* ── forced password change (RF-59, RF-60, RF-61) ─────────────────────── */

const handlePasswordChange = async (): Promise<void> => {
  const newPass = newPassword.value;
  const confPass = confirmPassword.value;

  if (newPass !== confPass) {
    msgNew.value = 'Passwords do not match!';
    msgNewColor.value = 'red';
    return;
  }

  if (!validatePassword(newPass, 'req')) {
    msgNew.value = 'Please meet all security requirements.';
    msgNewColor.value = 'red';
    return;
  }

  loaderNew.value = true;
  updateDisabled.value = true;

  try {
    const result = await mockCompleteAdminPasswordChallenge(currentUsername, newPass);
    await processLoginSuccess(result, newPass);
  } catch (err) {
    msgNew.value = msgOf(err) || 'Failed to update.';
    msgNewColor.value = 'red';
    loaderNew.value = false;
    updateDisabled.value = false;
  }
};

/* ── password recovery (RF-62) ────────────────────────────────────────── */

const showForgotPassword = (): void => {
  showLogin.value = false;
  showForgot.value = true;
};

/** Origin: `onclick="location.reload()"` on the "Back to Login" link. */
const backToLogin = (): void => {
  location.reload();
};

const handleRequestReset = async (): Promise<void> => {
  const name = forgotUsername.value.trim();

  if (!name) {
    msgForgot.value = 'Please enter your Admin ID.';
    return;
  }

  loaderForgot.value = true;
  msgForgot.value = 'Sending recovery code...';
  msgForgotColor.value = 'var(--laec-blue)';

  try {
    const data = await postAdminPasswordAction({
      action: 'REQUEST_ADMIN_PASSWORD_RESET',
      username: name,
    });
    loaderForgot.value = false;
    showForgotStep2.value = true;
    forgotStepText.value = data.message || 'Recovery code sent to your registered email.';
    msgForgot.value = '';
  } catch (err) {
    msgForgot.value = msgOf(err);
    msgForgotColor.value = 'red';
    loaderForgot.value = false;
  }
};

const handleConfirmReset = async (): Promise<void> => {
  const name = forgotUsername.value.trim();
  const code = verificationCode.value;
  const newPass = forgotNewPassword.value;

  if (!validatePassword(newPass, 'f-req')) {
    msgForgot.value = 'Password must meet all requirements.';
    msgForgotColor.value = 'red';
    return;
  }

  loaderForgot.value = true;
  msgForgot.value = 'Updating password...';
  msgForgotColor.value = 'var(--laec-blue)';

  try {
    const data = await postAdminPasswordAction({
      action: 'CONFIRM_ADMIN_PASSWORD_RESET',
      username: name,
      code,
      newPassword: newPass,
    });
    loaderForgot.value = false;
    winAlert(
      'Success',
      data.message || 'Password updated successfully. Updated login details have been emailed.',
    );
    setTimeout(() => {
      location.reload();
    }, 3000);
  } catch (err) {
    msgForgot.value = msgOf(err);
    msgForgotColor.value = 'red';
    loaderForgot.value = false;
  }
};

/* ── origin: `window.addEventListener('load', startControlReturnHomeTimer)` */

onMounted(() => {
  void POOL_DATA; // the pool id is recorded for traceability only (D-11)
});
</script>

<template>
  <!-- §2.4 bubble field — identical on the three glass surfaces -->
  <div class="bubble-field" aria-hidden="true">
    <span class="bubble" style="--size: 72px; --left: 6%; --duration: 19s; --delay: -4s; --drift: 34px"></span>
    <span class="bubble" style="--size: 46px; --left: 14%; --duration: 15s; --delay: -10s; --drift: -26px"></span>
    <span class="bubble" style="--size: 118px; --left: 24%; --duration: 24s; --delay: -7s; --drift: 52px"></span>
    <span class="bubble" style="--size: 58px; --left: 38%; --duration: 17s; --delay: -2s; --drift: -42px"></span>
    <span class="bubble" style="--size: 92px; --left: 52%; --duration: 22s; --delay: -13s; --drift: 30px"></span>
    <span class="bubble" style="--size: 40px; --left: 63%; --duration: 14s; --delay: -5s; --drift: -18px"></span>
    <span class="bubble" style="--size: 132px; --left: 72%; --duration: 27s; --delay: -15s; --drift: -58px"></span>
    <span class="bubble" style="--size: 64px; --left: 84%; --duration: 18s; --delay: -8s; --drift: 36px"></span>
    <span class="bubble" style="--size: 34px; --left: 93%; --duration: 13s; --delay: -1s; --drift: -24px"></span>
  </div>

  <!-- 1. Security notice modal -->
  <div
    class="modal-overlay"
    id="modal-overlay"
    :style="modalVisible ? { display: 'flex' } : undefined"
  >
    <div class="modal-box">
      <h3 id="modal-title">{{ modalTitle }}</h3>
      <p id="modal-msg">{{ modalMsg }}</p>
      <button class="modal-btn" @click="closeModal">DISMISS</button>
    </div>
  </div>

  <!-- 2. Auth card with the three forms -->
  <div class="login-card" id="auth-container">
    <img :src="logoSrc" alt="LAEC" class="logo" />

    <div id="login-form" v-show="showLogin">
      <h2>{{ loginHeading }}</h2>
      <p>{{ loginSubheading }}</p>

      <div class="input-group">
        <label>Admin ID / Username</label>
        <input
          type="text"
          id="username"
          placeholder="Enter Admin ID or Username"
          v-model="username"
        />
      </div>

      <div class="input-group">
        <label>Secure Password</label>
        <div class="password-field">
          <input
            :type="passwordVisible['password'] ? 'text' : 'password'"
            id="password"
            placeholder="••••••••"
            v-model="password"
          />
          <button
            type="button"
            class="password-toggle"
            :aria-label="eyeLabel('password')"
            :aria-pressed="passwordVisible['password'] ? 'true' : 'false'"
            v-html="eyeIcon('password')"
            @click="togglePasswordVisibility('password')"
          ></button>
        </div>
      </div>

      <div class="loader" id="loader" :style="loaderVisible ? { display: 'block' } : undefined"></div>
      <div id="msg" :style="msgColor ? { color: msgColor } : undefined">{{ msg }}</div>
      <button @click="handleAdminLogin">AUTHORIZE SESSION</button>
      <span class="forgot-link" @click="showForgotPassword">Forgotten Password?</span>
    </div>

    <div id="new-password-form" v-show="showNewPassword">
      <h2 style="color: var(--success)">Security Update</h2>
      <p>Your temporary password has expired. Please set a new permanent password.</p>

      <div class="input-group">
        <label>New Password</label>
        <div class="password-field">
          <input
            :type="passwordVisible['new-password'] ? 'text' : 'password'"
            id="new-password"
            placeholder="Set your password"
            v-model="newPassword"
            @keyup="validatePassword(newPassword, 'req')"
          />
          <button
            type="button"
            class="password-toggle"
            :aria-label="eyeLabel('new-password')"
            :aria-pressed="passwordVisible['new-password'] ? 'true' : 'false'"
            v-html="eyeIcon('new-password')"
            @click="togglePasswordVisibility('new-password')"
          ></button>
        </div>
      </div>

      <div class="input-group">
        <label>Confirm New Password</label>
        <div class="password-field">
          <input
            :type="passwordVisible['confirm-password'] ? 'text' : 'password'"
            id="confirm-password"
            placeholder="Repeat new password"
            v-model="confirmPassword"
          />
          <button
            type="button"
            class="password-toggle"
            :aria-label="eyeLabel('confirm-password')"
            :aria-pressed="passwordVisible['confirm-password'] ? 'true' : 'false'"
            v-html="eyeIcon('confirm-password')"
            @click="togglePasswordVisibility('confirm-password')"
          ></button>
        </div>
      </div>

      <div class="password-requirements">
        <div class="req-item" id="req-len" :class="{ valid: reqValid.len }">
          <span></span> At least 8 characters
        </div>
        <div class="req-item" id="req-case" :class="{ valid: reqValid.case }">
          <span></span> Uppercase &amp; Lowercase
        </div>
        <div class="req-item" id="req-num" :class="{ valid: reqValid.num }">
          <span></span> At least one number
        </div>
        <div class="req-item" id="req-sym" :class="{ valid: reqValid.sym }">
          <span></span> One symbol (@, #, $, !)
        </div>
      </div>

      <div class="loader" id="loader-new" :style="loaderNew ? { display: 'block' } : undefined"></div>
      <div id="msg-new" :style="msgNewColor ? { color: msgNewColor } : undefined">{{ msgNew }}</div>
      <button
        id="update-btn"
        style="background: var(--success)"
        :disabled="updateDisabled"
        @click="handlePasswordChange"
      >
        UPDATE &amp; LOGIN
      </button>
    </div>

    <div id="forgot-password-form" v-show="showForgot">
      <h2>Reset Password</h2>
      <p id="forgot-step-text">{{ forgotStepText }}</p>

      <div id="step-1-forgot" v-show="!showForgotStep2">
        <div class="input-group">
          <label>Admin ID / Username</label>
          <input
            type="text"
            id="forgot-username"
            placeholder="Enter Registration ID"
            v-model="forgotUsername"
          />
        </div>
        <button @click="handleRequestReset">SEND RECOVERY CODE</button>
      </div>

      <div id="step-2-forgot" v-show="showForgotStep2">
        <div class="input-group">
          <label>Verification Code</label>
          <input
            type="text"
            id="verification-code"
            placeholder="Check your email"
            v-model="verificationCode"
          />
        </div>
        <div class="input-group">
          <label>New Secure Password</label>
          <div class="password-field">
            <input
              :type="passwordVisible['forgot-new-password'] ? 'text' : 'password'"
              id="forgot-new-password"
              placeholder="Min. 8 characters"
              v-model="forgotNewPassword"
              @keyup="validatePassword(forgotNewPassword, 'f-req')"
            />
            <button
              type="button"
              class="password-toggle"
              :aria-label="eyeLabel('forgot-new-password')"
              :aria-pressed="passwordVisible['forgot-new-password'] ? 'true' : 'false'"
              v-html="eyeIcon('forgot-new-password')"
              @click="togglePasswordVisibility('forgot-new-password')"
            ></button>
          </div>
        </div>
        <div class="password-requirements">
          <div class="req-item" id="f-req-len" :class="{ valid: fReqValid.len }">
            <span></span> At least 8 characters
          </div>
          <div class="req-item" id="f-req-case" :class="{ valid: fReqValid.case }">
            <span></span> Uppercase &amp; Lowercase
          </div>
          <div class="req-item" id="f-req-num" :class="{ valid: fReqValid.num }">
            <span></span> At least one number
          </div>
          <div class="req-item" id="f-req-sym" :class="{ valid: fReqValid.sym }">
            <span></span> One symbol (@, #, $, !)
          </div>
        </div>
        <button @click="handleConfirmReset">SET NEW PASSWORD</button>
      </div>

      <div
        class="loader"
        id="loader-forgot"
        :style="loaderForgot ? { display: 'block' } : undefined"
      ></div>
      <div id="msg-forgot" :style="msgForgotColor ? { color: msgForgotColor } : undefined">
        {{ msgForgot }}
      </div>
      <span class="forgot-link" @click="backToLogin">Back to Login</span>
    </div>
  </div>

  <!--
    Door switcher. Rendered only on the role-scoped doors, where the page can
    refuse a claim and name the door it belongs to. Hidden at `/control/`.
  -->
  <nav v-if="portal" class="portal-switcher" aria-label="All portals">
    <p class="portal-switcher-title">Not the right portal?</p>
    <ul class="portal-switcher-list">
      <li v-for="other in otherPortals" :key="other.path">
        <a class="portal-switcher-link" :href="other.path">{{ other.title }}</a>
      </li>
      <li><a class="portal-switcher-link" href="/control/">Any staff role</a></li>
    </ul>
  </nav>
</template>

<style>
/*
 * Origin <style> block ported verbatim (origin-pages/control.html lines 13–156)
 * with every selector scoped under .page-control (entry <body> class) per the
 * established convention. Body tokens, the background/overlay pseudo-elements
 * and the §2.4 bubble field live in src/styles/glass.css.
 */
.page-control .modal-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  z-index: var(--z-modal);
  justify-content: center;
  align-items: center;
}

.page-control .modal-box {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  animation: modalPop 0.3s ease;
}

@keyframes modalPop {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.page-control .modal-box h3 {
  color: var(--laec-blue);
  margin-top: 0;
}

.page-control .modal-box p {
  margin-bottom: 1.5rem;
  color: #444;
}

.page-control .modal-btn {
  background: var(--laec-blue);
  color: white;
  padding: 10px 25px;
  border-radius: 6px;
  border: none;
  font-weight: 700;
  cursor: pointer;
}

.page-control .login-card {
  position: relative;
  z-index: var(--z-content);
  background: rgba(255, 255, 255, 0.96);
  padding: 2.5rem;
  border-radius: 15px;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.16);
  width: 100%;
  max-width: 320px;
  text-align: center;
  border-top: 5px solid var(--laec-blue);
}

.page-control .logo {
  height: 60px;
  margin-bottom: 1rem;
}

.page-control h2 {
  color: var(--laec-blue);
  margin-bottom: 0.5rem;
  font-size: 1.4rem;
  font-weight: 800;
}

.page-control p {
  color: #666;
  font-size: 0.85rem;
  margin-bottom: 2rem;
}

.page-control .input-group {
  text-align: left;
  margin-bottom: 1.2rem;
}

.page-control label {
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  color: #444;
  margin-bottom: 5px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.page-control input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-sizing: border-box;
  font-size: 0.95rem;
  outline: none;
  transition: 0.3s;
}

.page-control input:focus {
  border-color: var(--laec-blue);
  box-shadow: 0 0 0 3px rgba(0, 74, 153, 0.1);
}

.page-control .password-field {
  position: relative;
}

.page-control .password-field input {
  padding-right: 46px;
}

.page-control .password-toggle {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 34px;
  height: 34px;
  padding: 0;
  margin: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #777777;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.page-control .password-toggle svg {
  width: 19px;
  height: 19px;
  stroke: currentColor;
}

.page-control .password-toggle:hover {
  background: rgba(119, 119, 119, 0.12);
  transform: translateY(-50%);
}

.page-control button {
  width: 100%;
  padding: 14px;
  background: var(--laec-blue);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  transition: 0.3s;
  margin-top: 10px;
  font-size: 0.9rem;
}

.page-control button:hover {
  background: #003366;
  transform: translateY(-1px);
}

#msg,
#msg-new,
#msg-forgot {
  margin-top: 15px;
  font-size: 0.8rem;
  font-weight: 600;
  min-height: 1.2rem;
  line-height: 1.4;
}

.page-control .loader {
  border: 3px solid #f3f3f3;
  border-top: 3px solid var(--laec-blue);
  border-radius: 50%;
  width: 22px;
  height: 22px;
  animation: spin 1s linear infinite;
  display: none;
  margin: 10px auto;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* New Password UI styling */
.page-control .password-requirements {
  text-align: left;
  font-size: 11px;
  color: #777;
  margin-top: 10px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;
  border: 1px solid #eee;
}

.page-control .req-item {
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: 0.2s;
}

.page-control .req-item.valid {
  color: var(--success);
  font-weight: bold;
}

.page-control .req-item.valid span::before {
  content: '✔';
}

.page-control .req-item span::before {
  content: '○';
  width: 12px;
  display: inline-block;
}

/* INTEGRATED: Forgot Password Link styling */
.page-control .forgot-link {
  display: block;
  margin-top: 15px;
  font-size: 0.75rem;
  color: var(--laec-blue);
  text-decoration: none;
  font-weight: 600;
  cursor: pointer;
}

.page-control .forgot-link:hover {
  text-decoration: underline;
}

/* ── door switcher (role-scoped pages only) ─────────────────────────────────
 *
 * The refusal message names the door an account belongs to, so every door is
 * listed here and the person can move straight there. Gated on
 * `.page-control-door`, which only the six /login/* entries carry, so the
 * origin page at /control/ renders none of this.
 */
.page-control-door .portal-switcher {
  position: relative;
  z-index: var(--z-content);
  width: 100%;
  max-width: 320px;
  text-align: center;
}

.page-control-door .portal-switcher-title {
  margin: 0 0 10px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.65);
}

.page-control-door .portal-switcher-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 8px;
  margin: 0;
  padding: 14px;
  list-style: none;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 12px;
}

.page-control-door .portal-switcher-link {
  font-size: 0.72rem;
  font-weight: 600;
  color: #ffffff;
  text-decoration: none;
  opacity: 0.85;
  transition: opacity 0.2s;
}

.page-control-door .portal-switcher-link:hover {
  opacity: 1;
  text-decoration: underline;
}
</style>
