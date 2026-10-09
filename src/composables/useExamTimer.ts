/**
 * RF-41…45 — examination countdown.
 *
 * - RF-41: duration defaults to `config.examDuration`, overridden by
 *   `paper.DurationMinutes` where present.
 * - RF-42: ticks each second, displays `HH:MM:SS`, auto-submits at zero with
 *   `violationReason = "None"`.
 * - RF-43: a `paper.EndTime` in the future becomes `hardCutOffTime`; reaching
 *   it auto-terminates with "Exam Window Closed".
 * - RF-44: going offline adds a visual class — the view binds `offline`.
 * - RF-45: where no duration is configured the timer counts up (`timeLeft++`);
 *   this is observed behaviour, its intent is to be confirmed.
 */

import { computed, onScopeDispose, ref } from 'vue';

export interface ExamTimerOptions {
  /** RF-41: `config.examDuration`, minutes. */
  defaultDurationMinutes?: number | null;
  /** RF-41: `paper.DurationMinutes`, minutes — wins where present. */
  paperDurationMinutes?: number | null;
  /** RF-43: `paper.EndTime` — wire format unconfirmed; see parseEndTime. */
  paperEndTime?: string | null;
  /** RF-42: fired at zero; reason is always "None". */
  onTimeExpired?: (reason: 'None') => void;
  /** RF-43: fired when hardCutOffTime is reached. */
  onHardCutOff?: (reason: 'Exam Window Closed') => void;
}

export type TimerMode = 'countdown' | 'count-up' | 'stopped';

/** `HH:MM:SS`, hours not wrapped (RF-42 display). */
export const formatHMS = (totalSeconds: number): string => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

/**
 * Parse `paper.EndTime`. The wire format is unconfirmed: time-only values
 * (`HH:MM:SS`) resolve to today (and, if already past, do not qualify as a
 * future cut-off); date-bearing strings go through `Date`. Returns `null`
 * where no future cut-off exists (RF-43's conditional).
 */
export const parseEndTime = (raw: string, now: Date = new Date()): Date | null => {
  const timeOnly = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());
  if (timeOnly) {
    const candidate = new Date(now);
    candidate.setHours(Number(timeOnly[1]), Number(timeOnly[2]), Number(timeOnly[3] ?? '0'), 0);
    return candidate.getTime() > now.getTime() ? candidate : null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime() > now.getTime() ? parsed : null;
};

export function useExamTimer(options: ExamTimerOptions = {}) {
  const durationSeconds = (): number | null => {
    const minutes = options.paperDurationMinutes ?? options.defaultDurationMinutes ?? null;
    if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes <= 0) {
      return null; // RF-45: no configured duration → count up
    }
    return Math.round(minutes * 60);
  };

  /**
   * The duration is resolved at `start()`, not at composition: the view
   * calls `useExamTimer` during setup, while `config.examDuration` and
   * `paper.DurationMinutes` are only known after Stage-1's fetches finish.
   * Before `start()` the display reads `00:00:00`, exactly like the origin's
   * `#timer` before its first tick.
   */
  const mode = ref<TimerMode>('count-up');
  const timeLeft = ref<number>(0); // RF-45 counts up from zero
  const offline = ref(false); // RF-44: view renders the visual class
  const hardCutOffTime = ref<Date | null>(null); // RF-43
  const terminated = ref<'None' | 'Exam Window Closed' | null>(null);

  const display = computed(() => formatHMS(timeLeft.value));

  let tick: ReturnType<typeof setInterval> | null = null;

  const stop = (): void => {
    if (tick !== null) {
      clearInterval(tick);
      tick = null;
    }
    if (mode.value !== 'stopped') mode.value = 'stopped';
  };

  const start = (): void => {
    if (tick !== null || mode.value === 'stopped') return;

    // RF-41: paper duration wins over the configured default (read live so
    // values fetched during Stage 1 are in effect when the exam engages).
    const initial = durationSeconds();
    mode.value = initial === null ? 'count-up' : 'countdown';
    timeLeft.value = initial === null ? 0 : initial;

    // RF-43: only a future EndTime qualifies as hard cut-off.
    if (options.paperEndTime) {
      hardCutOffTime.value = parseEndTime(options.paperEndTime);
    }

    tick = setInterval(() => {
      // RF-43: window closure wins over the countdown.
      if (hardCutOffTime.value && Date.now() >= hardCutOffTime.value.getTime()) {
        terminated.value = 'Exam Window Closed';
        stop();
        options.onHardCutOff?.('Exam Window Closed');
        return;
      }

      if (mode.value === 'countdown') {
        timeLeft.value -= 1; // RF-42: tick each second
        if (timeLeft.value <= 0) {
          timeLeft.value = 0;
          terminated.value = 'None';
          stop();
          options.onTimeExpired?.('None');
        }
      } else {
        timeLeft.value += 1; // RF-45: count up where no duration is configured
      }
    }, 1000);
  };

  const setOffline = (value: boolean): void => {
    offline.value = value; // RF-44
  };

  const onOffline = (): void => setOffline(true);
  const onOnline = (): void => setOffline(false);

  if (typeof window !== 'undefined') {
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    if (navigator.onLine === false) offline.value = true;
  }

  onScopeDispose(() => {
    stop();
    if (typeof window !== 'undefined') {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    }
  });

  return {
    timeLeft,
    display,
    mode,
    offline,
    setOffline,
    hardCutOffTime,
    terminated,
    start,
    stop,
  };
}
