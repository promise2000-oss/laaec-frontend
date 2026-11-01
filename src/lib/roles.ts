/**
 * Role helpers and the role → default permission map (D-71).
 *
 * Shaped on `saintfinbarrs-frontend`'s `lib/roles.ts` at the client's
 * direction: the same `ROLE_DEFAULT_PERMISSIONS` table, the same
 * `effectivePermissions` union of granted permissions with role defaults, and
 * the same convention that a super-administrator entry is empty because that
 * role bypasses the check rather than being granted everything by hand.
 *
 * The role names are LAEC's own six (D-55), not theirs - the reference app's
 * seventeen names (bursary, clinicals, exams-records, vice principal, ...) come
 * from a school-management domain this portal does not have.
 */

import type { AdminRole } from '../types';
import { permissionsForSchoolRoles } from '../types/admin-registry';

/* ── role predicates ────────────────────────────────────────────────────── */

const normalize = (role: string | undefined | null): string =>
  String(role || '').trim().toUpperCase();

/** The six claims a session can carry (D-55). */
const ROLE_NAMES: AdminRole[] = [
  'SUPER_ADMIN',
  'CENTRAL_ADMIN',
  'SCHOOL_ADMIN',
  'ICT_ADMIN',
  'EXAM_COMMITTEE',
  'TEACHER',
];

/**
 * Whether the claim holds the role. LAEC claims are a single enum per session,
 * so this is an equality check rather than the reference implementation's
 * substring matching over a third-party backend's free-text role names.
 */
export function hasRole(role: string | undefined | null, roleKey: AdminRole): boolean {
  return normalize(role) === roleKey;
}

/** LAEC has exactly two cross-school claims; both bypass (see `isAdminLike`). */
export const isGlobalRole = (role: string | undefined | null): boolean =>
  hasRole(role, 'SUPER_ADMIN') || hasRole(role, 'CENTRAL_ADMIN');

/**
 * The single claim a session carries, for redirect targets after a refused
 * navigation. There is no multi-role user here, so unlike the reference
 * implementation there is no precedence order to resolve.
 */
export function primaryRoleName(role: string | undefined | null): AdminRole {
  const value = normalize(role) as AdminRole;
  return value && ROLE_NAMES.includes(value) ? value : 'TEACHER';
}

/* ── default grants ─────────────────────────────────────────────────────── */

/** Students, question bank, results, admin accounts, settings and content. */
const SCHOOL_ADMIN_DEFAULTS = [
  'dashboard.read',
  'students.read',
  'students.manage',
  'questions.read',
  'questions.manage',
  'questions.delete',
  'results.read',
  'results.remark',
  'results.delete',
  'admins.read',
  'admins.manage',
  'exam.settings.manage',
  'exam.schedule.manage',
  'notices.read',
  'notices.publish',
  'notices.delete',
  'calendar.read',
  'calendar.manage',
  'notifications.read',
  'notifications.mark',
  'system.read',
  'staff.read',
];

/** Content governance across every school (D-55) - decides, does not sit exams. */
const CENTRAL_ADMIN_DEFAULTS = [
  'dashboard.read',
  'review.read',
  'review.decide',
  'staff.read',
  'staff.manage',
  'admins.read',
  'admins.manage',
  'questions.read',
  'questions.manage',
  'questions.delete',
  'results.read',
  'students.read',
  'notices.read',
  'notices.publish',
  'notices.delete',
  'calendar.read',
  'calendar.manage',
  'notifications.read',
  'notifications.mark',
  'system.read',
];

/** Infrastructure and configuration; strong on results, weak on authoring. */
const ICT_ADMIN_DEFAULTS = [
  'dashboard.read',
  'students.read',
  'students.manage',
  'questions.read',
  'results.read',
  'results.remark',
  'results.delete',
  'exam.settings.manage',
  'notices.read',
  'calendar.read',
  'notifications.read',
  'notifications.mark',
  'system.read',
  'staff.read',
];

/** Marks and archives; authors nothing and owns no accounts.
 *  `system.read` is required because this console renders the origin's
 *  System Health panel — omitting it filtered the panel out of its own rail. */
const EXAM_COMMITTEE_DEFAULTS = [
  'dashboard.read',
  'students.read',
  'questions.read',
  'questions.manage',
  'results.read',
  'results.remark',
  'results.delete',
  'exam.settings.manage',
  'notices.read',
  'calendar.read',
  'notifications.read',
  'notifications.mark',
  'system.read',
];

/**
 * Authors exam papers and reads the outcome of their own submissions, and owns
 * the St Finbarr's teacher portal (D-72).
 *
 * The teacher-portal half is the origin's `ROLE_DEFAULT_PERMISSIONS["teacher"]`,
 * transcribed. That list is reproduced whole rather than trimmed to the panels
 * this portal renders, because the origin ships two codes with no teacher UI at
 * all (`results.upload*`, `store.browse*`) and trimming would be a silent
 * correction of a decision somebody made.
 *
 * What is NOT copied, and why it matters:
 *
 *  - The origin's list is missing seven codes its own nav requires. Per
 *    `docs/teacher-portal/permissions.md` §3, `queries.view`, `queries.issue`,
 *    `disciplinary.cases.view`, `counselling.cases.view`,
 *    `counselling.committees.view`, `counselling.reports.view` and
 *    `counselling.reports.manage` appear in `teacher-nav.ts` but not in the
 *    role defaults — so on the deployed app, HR Queries and most of Guidance &
 *    Counselling vanish from a teacher's sidebar unless a backend grant supplies
 *    them. Those seven ARE granted here, so the rail and the panels agree. The
 *    divergence is deliberate and recorded rather than inherited silently.
 *
 *  - The origin grants `weekly-reports.review` and `lesson-plans.review` to
 *    every teacher, which is why a teacher who is nobody's reviewer still sees
 *    a Review Inbox. Reproduced, because it is the observable behaviour.
 */
const TEACHER_DEFAULTS = [
  'dashboard.read',
  'questions.read',
  'questions.author',
  'questions.submit',
  'review.read',
  'notices.read',
  'calendar.read',
  'notifications.read',
  'notifications.mark',
  // teacher portal (D-72)
  'teacher.read',
  'communication.read',
  'communication.messages.send',
  'lesson-plans.read',
  'lesson-plans.create',
  'lesson-plans.update',
  'lesson-plans.delete',
  'lesson-plans.review',
  'weekly-reports.read',
  'weekly-reports.create',
  'weekly-reports.update',
  'weekly-reports.delete',
  'weekly-reports.review',
  'class-reports.read',
  'class-reports.create',
  'class-reports.update',
  'class-reports.delete',
  'class-reports.submit',
  'leave.read',
  'leave.create',
  'queries.read',
  'queries.issue',
  'counselling.read',
  'counselling.cases.book',
  'counselling.cases.view',
  'counselling.committees.view',
  'counselling.committees.manage',
  'counselling.reports.view',
  'counselling.reports.manage',
  'disciplinary.read',
  'disciplinary.incidents.manage',
  'disciplinary.committees.manage',
  'disciplinary.cases.launch',
  'disciplinary.cases.view',
];

/**
 * The Saint Finbarr's College ADMIN portal's permissions, granted to SUPER_ADMIN.
 *
 * WHY SUPER_ADMIN AND NOBODY ELSE
 * -------------------------------
 * The Saint Finbarr's admin modules are mounted in `/admin/`, whose console owner is
 * `SUPER_ADMIN` (see `CONSOLE_OWNER` in nav.ts). The codes below are the ones that
 * console's own rail declares, so granting them here is what makes the rail and the
 * panels agree for a super administrator.
 *
 * They are NOT in any of the five other roles' defaults, and that is deliberate
 * rather than an omission: the LAEC role model has no role whose remit is school
 * management. `SCHOOL_ADMIN` here is "a school administrator of the LAEC
 * examination centre" — exam sessions, question papers, results for one school —
 * and handing it the Saint Finbarr's staff, results, fees and inventory codes
 * would grant it a remit it does not have. That is the gap recorded in
 * docs/saint-finbarrs-admin/roles-and-permissions.md: the live portal's 33 roles do
 * not map onto this portal's six claims, so the school-management vocabulary is
 * granted to the one claim that owns that console and to nothing else.
 *
 * It is a grant, not an exemption. `bypassesPermissions` still returns false for
 * every claim, so `callApi` checks these codes the same way it checks every other,
 * and a code added here is enforced rather than waved through.
 */
const SUPER_ADMIN_PORTAL_DEFAULTS = [
  /* Dashboards */
  'dashboard.superadmin',
  /* Archdiocesan school registry (D23 runtime extension). The registry is
     master-level: only the super-admin console reads and writes it, so these
     codes are granted here and to no other role — the same rule that keeps the
     Saint Finbarr's portal grant with its one owning console. */
  'schools.read',
  'schools.manage',
  /* Multi-school platform (multi-school spec §1, §2, §3, §5). Editing a school
     profile, changing its lifecycle state, minting its subdomain URL and
     managing groups are all master-level acts on the same registry, so they
     inherit the registry's one-console rule and are granted here only. The
     GROUP_ADMIN role the spec envisages would take a subset of
     `school_groups.*` once a backend identity model exists (see the deployment
     requirements doc); today the super administrator owns all of them. */
  'schools.update',
  'schools.status',
  'schools.urls',
  'school_groups.read',
  'school_groups.manage',
  /* User & roles */
  'users.read',
  'users.create',
  'users.update',
  'users.delete',
  'roles.read',
  'roles.create',
  'roles.update',
  'roles.delete',
  'permissions.read',
  'permissions.create',
  'permissions.update',
  'permissions.delete',
  'invitations.send',
  'audit_log.view',
  /* Students (exam data — registering candidates). The Staff & HR, departments,
     designations, attendance, leave, queries, awards and categories codes that
     used to sit here are REMOVED: they are Saint Finbarr's school-management,
     not CBT/exam operations. `staff.read`/`staff.manage` still reach SUPER_ADMIN
     through CENTRAL_ADMIN's defaults (cross-school staff onboarding, D-55), so
     the Staff List stays; every other HR control drops from the rail. */
  'students.add',
  'students.create',
  'students.update',
  'students.delete',
  'students.import',
  /* Academics — kept whole. The exam portal organises candidates by session,
     class, arm and subject, so the whole academic module (sessions, classes,
     arms, subjects, timetables, assignments, class/subject-teachers) stays; it
     is data the exam flow depends on, not school-management overhead. */
  'academic.read',
  'academic.sessions.create',
  'academic.sessions.update',
  'academic.sessions.delete',
  'academic.manage',
  'academic.subjects.manage',
  'academic.calendar.manage',
  'academic.timetables.manage',
  'academic.assignments.manage',
  'academic.routines.manage',
  'academic.classteachers.manage',
  'academic.subjectteachers.manage',
  'lesson-plans.manage',
  'lesson-plans.manageAll',
  'weekly-reports.manage',
  /* Results — the admin-portal marking pipeline, exam-core and kept whole
     (upload windows, vetting, publishing, grading, committee, report cards). */
  'results.window.read',
  'results.window.manage',
  'results.upload',
  'results.upload.view',
  'results.view',
  'results.queue.read',
  'results.vet',
  'results.vet.view',
  'results.publish',
  'results.committee.view',
  'results.committee.review',
  'results.grading.manage',
  'results.report.view',
  'results.attendance.manage',
  'results.domain.manage',
  'results.comment.manage',
  /* System */
  'system.settings.update',
  'dashboard.admin',
] as const;

/**
 * Default permissions each role relies on even when a stored grant has not
 * caught up. Without this table a session whose permissions are missing renders
 * an empty console: the union in `effectivePermissions` is what stops a nav
 * filter from reading a blank array as "may see nothing".
 *
 * SUPER_ADMIN carries the Saint Finbarr's portal grant and nothing else. Its
 * `SUPER_ADMIN_PERMISSIONS` superset below then adds the other five roles' defaults,
 * so its effective list is the union of all six — and it is a grant, not an
 * exemption: `bypassesPermissions` still returns false for it.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<AdminRole, readonly string[]> = {
  SUPER_ADMIN: SUPER_ADMIN_PORTAL_DEFAULTS,
  CENTRAL_ADMIN: CENTRAL_ADMIN_DEFAULTS,
  SCHOOL_ADMIN: SCHOOL_ADMIN_DEFAULTS,
  ICT_ADMIN: ICT_ADMIN_DEFAULTS,
  EXAM_COMMITTEE: EXAM_COMMITTEE_DEFAULTS,
  TEACHER: TEACHER_DEFAULTS,
};

/**
 * The permissions SUPER_ADMIN holds, as a superset of every other role.
 *
 * WHY THIS IS A GRANT AND NOT A BYPASS
 * ----------------------------------
 * `ROLE_DEFAULT_PERMISSIONS.SUPER_ADMIN` is `[]`, and that empty list is read
 * as "this role is exempt" by `bypassesPermissions`. Exemption is a blunt
 * instrument: it lets the navigation filter show every item, but a console
 * still filters its own controls, so a super administrator who was admitted to
 * /teacher/ by the router guard saw a rail with nothing in it and could not act
 * on any of it. Navigation and function disagreed, and only one of them had been
 * told about the exemption.
 *
 * The fix is to make the exemption *true* rather than to route around it: a
 * super administrator is granted the union of every other role's defaults, so
 * `can()` and the nav filter answer identically for them, and there is no gap
 * where a screen is reachable but inert. The union is computed from this same
 * table, so a permission added to a role is inherited here automatically -
 * the superset cannot fall out of date with the vocabulary it is derived from.
 *
 * This does not widen what a super administrator can reach at the transport
 * layer: `callApi` gates every mutating action on its own permission code, and
 * a super administrator now actually holds those codes.
 *
 * It is deliberately NOT the whole `PERMISSION_CODES` list. Two codes are
 * meaningful only for a role with its own remit, and granting them to
 * everyone-by-exemption would be a lie about who is accountable:
 *   - `password.reset` is reachable from the unauthenticated control page, so a
 *     blanket grant would widen account recovery.
 *   - `review.decide` sits with the Central Admin, which chairs the review
 *     queue; SUPER_ADMIN inherits the queue's *visibility* via CENTRAL_ADMIN's
 *     `review.read`, not the decision itself.
 */
const SUPER_ADMIN_SUPERSET_EXCLUSIONS: readonly string[] = ['password.reset'];

/**
 * Every permission SUPER_ADMIN holds: its own portal grant plus every other role's
 * defaults, minus the exclusions.
 *
 * The union is computed from this same table rather than written out, so a
 * permission added to any role is inherited here automatically and the superset
 * cannot fall out of date with the vocabulary it is derived from. Adding
 * `SUPER_ADMIN`'s own defaults to the union is a no-op (it is already in the set),
 * which keeps the expression a plain "every role's defaults".
 */
export const SUPER_ADMIN_PERMISSIONS: readonly string[] = Object.freeze(
  Array.from(
    new Set(
      Object.entries(ROLE_DEFAULT_PERMISSIONS).flatMap(([, codes]) => [...codes]),
    ),
  ).filter((code) => !SUPER_ADMIN_SUPERSET_EXCLUSIONS.includes(code)),
);

/**
 * Whether the claim carries SUPER_ADMIN. Kept beside the defaults it governs so
 * the exemption and the grant it is replaced by stay in one file.
 */
export function isSuperAdmin(role: string | undefined | null): boolean {
  return hasRole(role, 'SUPER_ADMIN');
}

/**
 * The union of a session's granted permissions with the defaults its role
 * implies. Used for nav filtering and for every `hasPermission` call, so a
 * console never renders empty because a backend grant is missing or stale.
 *
 * `schoolRoles` is the SECOND axis, and it is optional because most callers do
 * not have it: the LAEC claim decides whether `/admin/` opens at all, and the 33
 * school roles decide what an operator may do once inside. Both are real — a
 * session is a claim PLUS zero or more school roles — and both feed the same
 * effective set, so the rail filter and every `can()` answer consistently.
 *
 * The union, not the intersection, is the deliberate choice: on the live portal
 * a user's permissions are the union of everything their roles grant, so a
 * session holding Bursary and Teacher reaches both. Taking an intersection here
 * would make a second role subtract the first, which is not how the origin
 * behaves and would leave the roles page able to make a session narrower by
 * accident.
 */
export function effectivePermissions(
  permissions: string[] | undefined | null,
  role: string | undefined | null,
  schoolRoles?: readonly string[] | null,
): string[] {
  const result = new Set<string>(permissions ?? []);
  const defaults = ROLE_DEFAULT_PERMISSIONS[normalize(role) as AdminRole];
  if (defaults) for (const code of defaults) result.add(code);
  // A super administrator's exemption is materialised as a grant, so that
  // `can()` and the nav filter return the same answer for them.
  if (isSuperAdmin(role)) for (const code of SUPER_ADMIN_PERMISSIONS) result.add(code);
  for (const code of permissionsForSchoolRoles(schoolRoles)) result.add(code);
  return [...result];
}
