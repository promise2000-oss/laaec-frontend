/**
 * RF-52 — answer persistence.
 *
 * "Answers shall autosave after every change under `ans_{RegNo}_{subject}`."
 *
 * The original stores `JSON.stringify(answers)` in `localStorage` under that
 * byte-exact key (observed in origin-pages/exam.html). The inner record shape
 * is a JSON object keyed by question identifier → selected value; the wire
 * naming of the original's keys was not observed — marked unconfirmed.
 */

import { ref } from 'vue';
import { answerStorageKey } from '../types';

/** question identifier → selected value (option letter or theory text) */
export type AnswerMap = Record<string, string>;

export function useAnswerPersistence(regNo: string, subject: string) {
  const key = answerStorageKey(regNo, subject); // byte-exact (RF-52)
  const answers = ref<AnswerMap>({});
  /** Whether a previous session's answers were found on entry. */
  const restored = ref(false);

  // Restore once on construction (exam page restores before first paint).
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        answers.value = parsed as AnswerMap;
        restored.value = true;
      }
    }
  } catch {
    // Corrupt JSON: the origin removes the key and starts clean — same here.
    localStorage.removeItem(key);
    answers.value = {};
  }

  /** Autosave after every change (RF-52). */
  const setAnswer = (questionId: string, value: string): void => {
    answers.value = { ...answers.value, [questionId]: value };
    try {
      localStorage.setItem(key, JSON.stringify(answers.value));
    } catch {
      // Storage full or unavailable — the in-memory copy still holds.
    }
  };

  const getAnswer = (questionId: string): string | undefined => answers.value[questionId];

  /** Remove the key entirely (submission path / session end). */
  const clearAnswers = (): void => {
    answers.value = {};
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  };

  return { key, answers, restored, setAnswer, getAnswer, clearAnswers };
}
