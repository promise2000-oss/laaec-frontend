/**
 * useAdminSession — the signed-in operator's identity, in the shape the admin
 * panels need it.
 *
 * The sibling of `teacher/useTeacherSession.ts`, reading the same storage keys
 * the six consoles already write. It exists so a panel does not repeat the four
 * `localStorage.getItem` calls and so a change to where a session lives is one
 * edit rather than forty.
 *
 * It is a plain function, not a store: the session itself already lives in
 * `stores/session.ts` (Pinia) and is kept current on every navigation. Reading
 * storage here is deliberate — a panel's *writes* need the literal id the
 * transport will audit-log, and the store's copy is a mirror of that, not the
 * authority.
 */
import { STORAGE_KEYS } from '../../types';

export interface AdminSession {
  username: string;
  name: string;
  schoolId: string;
  role: string;
  /** `SUPER ADMIN` on the live dashboard's role chip; this portal's claim. */
  roleLabel: string;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  CENTRAL_ADMIN: 'Central Admin',
  SCHOOL_ADMIN: 'School Admin',
  ICT_ADMIN: 'ICT Admin',
  EXAM_COMMITTEE: 'Exam Committee',
  TEACHER: 'Teacher',
};

export function useAdminSession(): {
  username: () => string;
  name: () => string;
  schoolId: () => string;
  role: () => string;
  roleLabel: () => string;
  actor: () => string;
} {
  const read = (key: string): string => {
    try {
      return localStorage.getItem(key) || '';
    } catch {
      return '';
    }
  };

  const name = (): string => read(STORAGE_KEYS.AdminName) || read(STORAGE_KEYS.AdminUsername) || 'Administrator';
  const role = (): string => (read(STORAGE_KEYS.AdminRole) || 'SUPER_ADMIN').toUpperCase();

  return {
    username: () => read(STORAGE_KEYS.AdminUsername),
    name,
    schoolId: () => read(STORAGE_KEYS.SchoolID),
    role,
    roleLabel: () => ROLE_LABELS[role()] ?? role(),
    /* The name the audit log stamps. Falls back to the username so a record is
       never written against an empty actor, which would make the log untestable. */
    actor: () => name(),
  };
}
