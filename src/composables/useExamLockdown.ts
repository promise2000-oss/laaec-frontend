/**
 * RF-46…51 — lockdown and auto-termination for `/exam/`.
 *
 * Reconciled line-by-line against origin-pages/exam.html `setupLockdown`
 * (attested 2026-09-28):
 *
 * - RF-46: hiding the tab terminates immediately with "TAB_SWITCH_OR_MINIMIZE".
 * - RF-47: losing window focus starts a five-second grace countdown; returning
 *   (focus) cancels it; expiry terminates with "Lost window focus". Every
 *   clear also rewrites the banner base to "SECURITY ACTIVE: DO NOT SWITCH
 *   TABS OR MINIMIZE" — observed in `clearInactiveWindowGrace`, suppressed
 *   once the RF-51 latch is set.
 * - RF-48: a `fullscreenchange` with no fullscreen element terminates with
 *   "Fullscreen mode exited"; any other change clears the grace.
 * - RF-49: `Escape`, `F11`, `F5`, `Meta`, `Alt` plus any ctrl/meta/alt state
 *   are blocked with preventDefault/stopPropagation/stopImmediatePropagation
 *   in the capture phase on keydown, keyup AND keypress, recorded as
 *   "Restricted keyboard input detected: <key>". Blocked keys are not
 *   exempted while typing in a field (observed — the origin's typing checks
 *   only guard the non-blocked early return).
 * - RF-50: every 1500 ms and on resize, an inner-to-available width-or-height
 *   ratio below 0.78 terminates with "Split-screen, minimized, or resized
 *   exam window detected"; otherwise a visible fullscreen session clears the
 *   grace (observed else-branch).
 * - RF-51: an auto-terminate already in flight sets the banner to
 *   "🚨 SESSION TERMINATED - SUBMITTING..." (three dots, as served — the
 *   PRD's ellipsis transcription is logged as a discrepancy) and is
 *   idempotent through the `isSubmitting` latch.
 *
 * The origin wires every listener inside setupLockdown() when the candidate
 * enters the hall; `enabled` reproduces that stage gate (the origin checks
 * `mainWrapper.classList.contains('hidden')` per handler).
 */

import { computed, onScopeDispose, ref } from 'vue';

export const LOCKDOWN_THRESHOLDS = {
  /** RF-47: blur grace, seconds. */
  focusGraceSeconds: 5,
  /** RF-50: minimum inner-to-available ratio. */
  minWindowRatio: 0.78,
  /** RF-50: sampling interval, ms. */
  ratioSampleMs: 1500,
} as const;

/** Banner before any grace clear (origin `#secBanner` markup). */
export const BANNER_INITIAL = 'LOCKDOWN ACTIVE — DO NOT SWITCH TABS OR MINIMIZE WINDOW';
/** Banner base after the first clear (observed in clearInactiveWindowGrace). */
export const BANNER_SECURED = 'SECURITY ACTIVE: DO NOT SWITCH TABS OR MINIMIZE';
/** RF-51 — three dots, exactly as served by origin-pages/exam.html. */
export const TERMINATION_BANNER = '🚨 SESSION TERMINATED - SUBMITTING...';

/** RF-47 countdown line, `INACTIVE_WINDOW_GRACE_SECONDS` → 5…1. */
export const graceWarningText = (seconds: number): string =>
  `WARNING: RETURN TO EXAM WINDOW WITHIN ${seconds}s`;

/** RF-49: blocked keys (bare modifier state travels via ctrl/meta/altKey). */
const RESTRICTED_KEYS = new Set(['Escape', 'F11', 'F5', 'Meta', 'Alt']);

export interface LockdownOptions {
  /** Performs the submission for a termination reason; guarded by the RF-51 latch. */
  onTerminate: (reason: string) => void | Promise<void>;
  /** Skip fullscreen monitoring where the page never enters fullscreen (page decision). */
  monitorFullscreen?: boolean;
}

export function useExamLockdown(options: LockdownOptions) {
  const isSubmitting = ref(false); // RF-51 latch
  /** Stage gate: false until the candidate enters the hall (origin: mainWrapper visible). */
  const enabled = ref(false);
  const banner = ref<string | null>(null); // RF-51 text once terminated
  const bannerBase = ref<string>(BANNER_INITIAL);
  const terminatedReason = ref<string | null>(null);
  /** RF-49: recorded restricted-key messages (one per blocked event). */
  const keyboardViolations = ref<string[]>([]);
  /** RF-47: remaining grace seconds while blurred; null when not blurring. */
  const focusGraceRemaining = ref<number | null>(null);

  /** What the view renders into `#secBanner`. */
  const bannerText = computed<string>(() => {
    if (banner.value !== null) return banner.value;
    if (focusGraceRemaining.value !== null) return graceWarningText(focusGraceRemaining.value);
    return bannerBase.value;
  });

  /* ── RF-47: grace lifecycle (origin clearInactiveWindowGrace / start…) ─ */

  let graceTimeout: ReturnType<typeof setTimeout> | null = null;
  let graceTicker: ReturnType<typeof setInterval> | null = null;

  const clearInactiveWindowGrace = (): void => {
    if (graceTimeout !== null) clearTimeout(graceTimeout);
    if (graceTicker !== null) clearInterval(graceTicker);
    graceTimeout = null;
    graceTicker = null;
    focusGraceRemaining.value = null;
    if (!isSubmitting.value) bannerBase.value = BANNER_SECURED;
  };

  const startInactiveWindowGrace = (): void => {
    if (!enabled.value || isSubmitting.value) return;
    if (graceTimeout !== null) return; // no re-entry while counting down
    focusGraceRemaining.value = LOCKDOWN_THRESHOLDS.focusGraceSeconds;
    // Displayed sequence 5…1, exactly like the origin's `if (secondsLeft > 0)`.
    graceTicker = setInterval(() => {
      if (focusGraceRemaining.value !== null && focusGraceRemaining.value > 1) {
        focusGraceRemaining.value -= 1;
      }
    }, 1000);
    // Only caller is the blur handler, so the reason is always this string
    // (the origin's default branch is unreachable — noted in the header).
    graceTimeout = setTimeout(() => {
      // Origin: expiry assigns violationReason then autoTerminate(); here the
      // terminate() sequence performs latch → clear → banner → submission.
      void terminate('Lost window focus');
    }, LOCKDOWN_THRESHOLDS.focusGraceSeconds * 1000);
  };

  /**
   * RF-51: idempotent — a second call while a termination is in flight is a
   * no-op; order mirrors origin autoTerminate (latch, clear grace, reason,
   * banner, then submission).
   */
  const terminate = async (reason: string): Promise<void> => {
    if (isSubmitting.value) return;
    isSubmitting.value = true;
    terminatedReason.value = reason;
    clearInactiveWindowGrace(); // latch already set → banner base untouched
    banner.value = TERMINATION_BANNER;
    await options.onTerminate(reason);
  };

  /* ── RF-46: tab hidden / visible ───────────────────────────────────── */

  const onVisibilityChange = (): void => {
    if (!enabled.value) return;
    if (document.hidden && !isSubmitting.value) void terminate('TAB_SWITCH_OR_MINIMIZE');
    if (!document.hidden) clearInactiveWindowGrace();
  };

  /* ── RF-47: window blur / focus ────────────────────────────────────── */

  const onWindowBlur = (): void => {
    if (!enabled.value || isSubmitting.value) return;
    startInactiveWindowGrace();
  };

  const onWindowFocus = (): void => {
    if (!enabled.value) return;
    clearInactiveWindowGrace();
  };

  /* ── RF-48: fullscreen change ──────────────────────────────────────── */

  const onFullscreenChange = (): void => {
    if (!enabled.value || options.monitorFullscreen === false) return;
    if (document.fullscreenElement === null && !isSubmitting.value) {
      void terminate('Fullscreen mode exited');
    } else {
      clearInactiveWindowGrace();
    }
  };

  /* ── RF-49: restricted keys, capture phase, all three event types ──── */

  const onKeyEvent = (event: KeyboardEvent): void => {
    if (!enabled.value || isSubmitting.value) return;

    const blocked =
      RESTRICTED_KEYS.has(event.key) || event.ctrlKey || event.metaKey || event.altKey;
    if (!blocked) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    keyboardViolations.value.push(
      `Restricted keyboard input detected: ${event.key || 'UNKNOWN_KEY'}`,
    );
  };

  /* ── RF-50: split-screen sampling ──────────────────────────────────── */

  const checkRatio = (): void => {
    if (!enabled.value || isSubmitting.value) return;
    const availableWidth = window.screen.availWidth || window.innerWidth;
    const availableHeight = window.screen.availHeight || window.innerHeight;
    const widthRatio = window.innerWidth / availableWidth;
    const heightRatio = window.innerHeight / availableHeight;

    if (
      widthRatio < LOCKDOWN_THRESHOLDS.minWindowRatio ||
      heightRatio < LOCKDOWN_THRESHOLDS.minWindowRatio
    ) {
      void terminate('Split-screen, minimized, or resized exam window detected');
    } else if (!document.hidden && document.fullscreenElement) {
      clearInactiveWindowGrace();
    }
  };

  let ratioTimer: ReturnType<typeof setInterval> | null = null;

  /* ── wiring (origin setupLockdown, invoked when the exam engages) ───── */

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('keydown', onKeyEvent, true); // capture phase (RF-49)
    document.addEventListener('keyup', onKeyEvent, true);
    document.addEventListener('keypress', onKeyEvent, true);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('resize', checkRatio);
    ratioTimer = setInterval(checkRatio, LOCKDOWN_THRESHOLDS.ratioSampleMs);
  }

  const dispose = (): void => {
    if (typeof document === 'undefined') return;
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('keydown', onKeyEvent, true);
    document.removeEventListener('keyup', onKeyEvent, true);
    document.removeEventListener('keypress', onKeyEvent, true);
    window.removeEventListener('blur', onWindowBlur);
    window.removeEventListener('focus', onWindowFocus);
    window.removeEventListener('resize', checkRatio);
    if (ratioTimer !== null) clearInterval(ratioTimer);
    ratioTimer = null;
    clearInactiveWindowGrace();
  };

  onScopeDispose(dispose);

  return {
    enabled,
    isSubmitting,
    banner,
    bannerBase,
    bannerText,
    terminatedReason,
    keyboardViolations,
    focusGraceRemaining,
    terminate,
    checkRatio,
    dispose,
  };
}
