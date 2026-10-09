/**
 * RF-4 and RF-5 — idle timeouts.
 *
 * - RF-4 (`/control/`): redirect to `/` after two minutes where no
 *   `LAEC_Session` is present. Attested in origin-pages/control.html
 *   (`startControlReturnHomeTimer`, lines 310–321, armed by the `load`
 *   listener on line 592): a **fixed** two-minute timer armed once on page
 *   load, cleared by `clearControlReturnHomeTimer()` at the start of a login
 *   attempt and on success, with **no** activity listeners and no re-arm
 *   after firing.
 * - RF-5 (`/admin/`): clear `localStorage` and redirect to `/control/` after
 *   five idle minutes, resetting the timer on mousemove, keypress, click and
 *   scroll.
 *
 * The two modes differ in more than duration: only the admin mode binds the
 * RF-5 event set. Redirects use `location.replace(...)`, matching the
 * original's navigation style. The PRD calls the `/control/` timer an "idle
 * timer"; the origin has no idle semantics there — logged as a transcription
 * discrepancy, origin implemented.
 */

import { onMounted, onUnmounted } from 'vue';
import { STORAGE_KEYS } from '../types';

export type IdleMode = 'control' | 'admin';

export interface IdleTimeoutOptions {
  mode: IdleMode;
  /** Injected for tests; defaults to `location.replace`. */
  redirect?: (path: string) => void;
  /** Injected for tests; defaults to `localStorage.removeItem(LAEC_Session)` / `clear()`. */
  clearStorage?: () => void;
}

/** RF-5 only — `/control/` binds nothing (attested in the header). */
const IDLE_EVENTS = ['mousemove', 'keypress', 'click', 'scroll'] as const;

const TWO_MINUTES_MS = 2 * 60 * 1000; // RF-4
const FIVE_MINUTES_MS = 5 * 60 * 1000; // RF-5

export function useIdleTimeout(options: IdleTimeoutOptions) {
  const idleMs = options.mode === 'control' ? TWO_MINUTES_MS : FIVE_MINUTES_MS;

  const redirect = options.redirect ?? ((path: string) => window.location.replace(path));

  const clearStorage =
    options.clearStorage ??
    (() => {
      if (options.mode === 'admin') {
        window.localStorage.clear(); // RF-5: clears localStorage wholesale
      } else {
        window.localStorage.removeItem(STORAGE_KEYS.LAEC_Session);
      }
    });

  let timer: ReturnType<typeof setTimeout> | null = null;

  const fire = (): void => {
    timer = null;
    if (options.mode === 'control') {
      // RF-4: only where no LAEC_Session is present; the origin does not
      // re-arm afterwards, so a live session simply keeps the page.
      if (window.localStorage.getItem(STORAGE_KEYS.LAEC_Session) === null) {
        redirect('/');
      }
      return;
    }
    clearStorage();
    redirect('/control/');
  };

  const arm = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(fire, idleMs);
  };

  /** `clearControlReturnHomeTimer` — called by the login handlers (RF-4). */
  const clear = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const reset = (): void => arm();

  const cleanup = (): void => {
    clear();
    for (const event of IDLE_EVENTS) window.removeEventListener(event, reset);
  };

  onMounted(() => {
    if (options.mode === 'control') {
      arm(); // origin: `window.addEventListener('load', startControlReturnHomeTimer)`
      return;
    }
    for (const event of IDLE_EVENTS) window.addEventListener(event, reset, { passive: true });
    arm();
  });

  onUnmounted(cleanup);

  return { idleMs, arm, clear, reset, cleanup };
}
