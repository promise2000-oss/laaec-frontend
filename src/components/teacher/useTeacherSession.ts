/**
 * The signed-in teacher, read once (D-72).
 *
 * Every teacher-portal action is scoped by `schoolID` + `teacherUsername`, the
 * same two values LAEC's own question-authoring actions use, so a panel does not
 * have to reach into `localStorage` itself. Reading them in one composable also
 * means the identity is captured once per module rather than re-read on every
 * render.
 */
import { computed } from 'vue';
import { STORAGE_KEYS } from '../../types';

const username = (): string => localStorage.getItem(STORAGE_KEYS.AdminUsername) || '';
const schoolID = (): string => localStorage.getItem(STORAGE_KEYS.SchoolID) || '';

export const useTeacherSession = () => ({
  /** Passed as `teacherUsername` / `teacherName` on every teacher action. */
  username,
  teacherName: (): string => localStorage.getItem(STORAGE_KEYS.AdminName) || username(),
  schoolID,
  /** The session's claim, for the rail's permission decisions. */
  role: computed(() => localStorage.getItem(STORAGE_KEYS.AdminRole) || 'TEACHER'),
});