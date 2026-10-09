/**
 * The permission vocabulary (D-71).
 *
 * LAEC previously had roles but no permissions: a role chose a paint job and
 * every one of the 47 contract actions was callable by whichever session
 * happened to be open. This module is the vocabulary that closes that gap, and
 * it is shaped on `saintfinbarrs-frontend`'s `lib/permissions.ts` at the
 * client's direction - same `module.action` string codes, same
 * `hasPermission` / `isAdminLike` predicate pair, same humanising helpers.
 *
 * What is NOT copied: their code list. Every code here names an action this
 * portal actually performs, transcribed from the 26 mutating contract actions
 * the six consoles issue (see ACTION_PERMISSIONS). Importing their catalogue
 * wholesale would have carried ~120 codes for modules that do not exist here -
 * store, wallet, school fees, inventory, counselling - and left the codes that
 * matter unrepresented.
 */
/** Read-side and capability codes, grouped by the module they belong to. */
export const PERMISSION_CODES = [
  'dashboard.read',
  'students.read',
  'students.manage',
  'questions.read',
  'questions.author',
  'questions.submit',
  'questions.manage',
  'questions.delete',
  'results.read',
  'results.remark',
  'results.delete',
  'admins.read',
  'admins.manage',
  'exam.settings.manage',
  'exam.schedule.manage',
  'review.read',
  'review.decide',
  'staff.read',
  'staff.manage',
  'notices.read',
  'notices.publish',
  'notices.delete',
  'calendar.read',
  'calendar.manage',
  'notifications.read',
  'notifications.mark',
  'system.read',
  'password.reset',

  /* St Finbarr's teacher portal (teacher-portal addendum, D-72). The codes are
     the origin's own `module.action` strings, so a code named here can be
     matched one-for-one against `lib/navigation/teacher-nav.ts` in the deployed
     app rather than re-derived. */
  'teacher.read',
  'lesson-plans.read',
  'lesson-plans.create',
  'lesson-plans.update',
  'lesson-plans.delete',
  'lesson-plans.submit',
  'lesson-plans.review',
  'weekly-reports.read',
  'weekly-reports.create',
  'weekly-reports.update',
  'weekly-reports.delete',
  'weekly-reports.submit',
  'weekly-reports.review',
  'class-reports.read',
  'class-reports.create',
  'class-reports.update',
  'class-reports.delete',
  'class-reports.submit',
  'leave.read',
  'leave.create',
  'leave.approve',
  'queries.read',
  'queries.issue',
  'communication.read',
  'communication.messages.send',
  'communication.events.create',
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

  /* St Finbarr's ADMIN portal (admin addendum). These are the deployed app's own
     `module.action` codes, taken verbatim from the `/roles/new` permission
     catalogue (32 modules, 182 codes). They are added rather than renamed so a
     code in `lib/nav.ts` ADMIN_GROUPS can be matched one-for-one against
     `lib/permissions.ts` in the deployed source rather than re-derived. The
     LAEC codes above keep their meaning; nothing is renamed. */
  'users.read',
  'roles.read',
  'permissions.read',
  'departments.read',
  'designations.read',
  'attendance.read',
  'leave.view',
  'queries.view',
  'parents.read',
  'academic.read',
  'inventory.stock.read',
  'inventory.suppliers.read',
  'inventory.assets.read',
  'results.view',
  'wallet.manage',
  'dashboard.superadmin',
  'users.create',
  'users.update',
  'users.delete',
  'roles.create',
  'roles.update',
  'roles.delete',
  'permissions.create',
  'permissions.update',
  'permissions.delete',
  'invitations.send',
  'audit_log.view',
  'attendance.manage',
  'attendance.mark',
  'attendance.delete',
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
  'communication.notices.create',
  'communication.notices.update',
  'communication.notices.delete',
  'communication.events.update',
  'communication.events.delete',
  'communication.conversations.manage',
  'dashboard.admin',
  'dashboard.hr',
  'staff.create',
  'staff.add',
  'staff.update',
  'staff.delete',
  'staff.import',
  'staff.portal',
  'students.create',
  'students.add',
  'students.update',
  'students.delete',
  'students.import',
  'departments.create',
  'departments.update',
  'departments.delete',
  'designations.create',
  'designations.update',
  'designations.delete',
  'leave.apply',
  'leave.approve',
  'leave.manage',
  'queries.issued',
  'queries.resolve',
  'categories.view',
  'categories.manage',
  'awards.read',
  'awards.manage',
  'inventory.read',
  'inventory.categories.manage',
  'inventory.stock.manage',
  'inventory.clinic.read',
  'inventory.clinic.manage',
  'inventory.suppliers.manage',
  'inventory.assets.manage',
  'inventory.sales.read',
  'inventory.sales.create',
  'inventory.sales.manage',
  'inventory.sales.release',
  'results.window.read',
  'results.window.manage',
  'results.upload',
  'results.upload.view',
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
  'store.browse',
  'store.cart.manage',
  'store.order.place',
  'store.orders.read',
  'store.queue.read',
  'store.queue.manage',
  'wallet.view',
  'wallet.fund',
  'schoolfees.read',
  'schoolfees.manage',
  'schoolfees.pay',
  'system.settings.update',
  'lesson-plans.manage',
  'lesson-plans.manageAll',
  'weekly-reports.manage',
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

/* ── predicates ─────────────────────────────────────────────────────────── */

/**
 * `hasPermission` returns true when no permission is required, so a caller can
 * pass an optional code and stay permissive by default - the same contract the
 * reference implementation uses.
 */
export function hasPermission(
  permissions: string[] | undefined | null,
  permission?: string | null,
): boolean {
  if (!permission) return true;
  if (!Array.isArray(permissions)) return false;
  return permissions.includes(permission);
}

/** True when every one of the listed permissions is held. */
export function hasAllPermissions(
  permissions: string[] | undefined | null,
  required: readonly (string | undefined | null)[],
): boolean {
  return required.every((code) => hasPermission(permissions, code));
}

/**
 * True when the session's claim is exempt from permission checks.
 *
 * In the reference implementation this predicate is `isAdminLike`, and it
 * matches a substring of a free-text role name because their roles come from a
 * third-party backend ("principal", "vice principal", "administrator"). LAEC's
 * claims are a closed six-value enum, so an equality check against one exempt
 * role was enough — but there is no longer an exempt role.
 *
 * LAEC USES NO EXEMPTION. Every claim, Super Admin included, is governed by the
 * explicit default list in `roles.ts`; Super Admin's effective list is the union
 * of the other five (`SUPER_ADMIN_PERMISSIONS`). This predicate is retained
 * because it is the single place a caller asks the question, and it now answers
 * "nobody" for every claim, so a future caller cannot reintroduce the exemption
 * by accident and a `true` here would mean something genuinely new.
 *
 * This is a behaviour change. It previously returned true for Super Admin, and
 * that closed a real gap: exemption let the navigation filter show every item
 * while the consoles still filtered their own controls, so a super administrator
 * who reached a console found an empty, unusable rail. Navigation and function
 * disagreed, and only one of them had been told about the exemption. Central
 * Admin was never exempt and is unaffected.
 */
export function bypassesPermissions(_role: string | undefined | null): boolean {
  return false;
}

/* ── the action → permission map ────────────────────────────────────────── */

/**
 * Every POST action the contract declares, mapped to the permission it
 * requires. `null` marks an action no operator needs a permission for: the two
 * candidate-session actions belong to a student sitting an exam, not to the
 * admin RBAC model at all.
 *
 * The value type is `string` rather than `PermissionCode` because three entries
 * hold a placeholder instead of a code — see `ADMIN_WRITE_SENTINEL` below. They
 * are resolved against the request by `resolveAdminPermission`, which is what
 * `callApi` calls; nothing reads this map directly for a placeholder value.
 *
 * This is the single enforcement point (see `callApi` in `src/api/mock.ts`),
 * so it covers the six consoles, the two new surfaces and the first-party
 * library bridges in `src/lib/console.ts` in one place - the same way a real
 * backend would gate its own endpoints rather than trusting the client.
 */
export const ACTION_PERMISSIONS: Record<string, string | null> = {
  /* candidate session — outside the admin model */
  SUBMIT_EXAM_RESULT: null,
  END_STUDENT_SESSION: null,

  /* students */
  UPDATE_STUDENT_SUBJECTS: 'students.manage',
  UPDATE_STUDENT_CLASS_ARM: 'students.manage',
  DELETE_STUDENT: 'students.manage',

  /* question bank and authoring */
  BULK_UPLOAD_QUESTIONS: 'questions.manage',
  UPLOAD_QUESTION_IMAGE: 'questions.author',
  ADD_QUESTION: 'questions.manage',
  UPDATE_QUESTION: 'questions.manage',
  DELETE_QUESTION: 'questions.delete',
  DELETE_QUESTION_PAPER: 'questions.delete',
  SAVE_QUESTION_SUBMISSION: 'questions.submit',
  SUBMIT_QUESTION_FOR_REVIEW: 'questions.submit',

  /* review queue (D-55) */
  ACCEPT_QUESTION_SUBMISSION: 'review.decide',
  REJECT_QUESTION_SUBMISSION: 'review.decide',
  SEND_QUESTION_DECISION_EMAIL: 'review.decide',

  /* results */
  REMARK_STUDENT_RESULTS: 'results.remark',
  DELETE_SUBJECT_RESULTS: 'results.delete',
  DELETE_STUDENT_RESULT: 'results.delete',
  DELETE_FLAGGED_RESULTS: 'results.delete',

  /* school administrator accounts */
  CREATE_ADMIN_ACCESS: 'admins.manage',
  DELETE_ADMIN_ACCESS: 'admins.manage',
  UPDATE_ADMIN_STATUS: 'admins.manage',

  /* portal and examination configuration */
  UPDATE_MODE: 'exam.settings.manage',
  UPDATE_PORTAL: 'exam.settings.manage',
  UPDATE_EXAM_SETTINGS: 'exam.settings.manage',
  UPDATE_SESSION_CONFIG: 'exam.settings.manage',

  /* session lifecycle */
  EXECUTE_PROMOTION: 'exam.schedule.manage',
  TRIGGER_ARCHIVE: 'exam.schedule.manage',

  /* notice board and calendar (D-64) */
  PUBLISH_NOTICE: 'notices.publish',
  DELETE_NOTICE: 'notices.delete',
  UPSERT_ACADEMIC_EVENT: 'calendar.manage',
  DELETE_ACADEMIC_EVENT: 'calendar.manage',

  /* notification centre (D-64) */
  MARK_NOTIFICATION_READ: 'notifications.mark',
  MARK_ALL_NOTIFICATIONS_READ: 'notifications.mark',

  /* account recovery, gated separately because it is reachable from the
     unauthenticated control page */
  REQUEST_ADMIN_PASSWORD_RESET: 'password.reset',
  CONFIRM_ADMIN_PASSWORD_RESET: 'password.reset',
  SEND_ADMIN_PASSWORD_CHANGED_EMAIL: 'password.reset',

  /* teacher portal — lesson planning (D-72) */
  SAVE_LESSON_PLAN: 'lesson-plans.create',
  DELETE_LESSON_PLAN: 'lesson-plans.delete',
  SUBMIT_LESSON_PLAN: 'lesson-plans.submit',
  REVIEW_LESSON_PLAN: 'lesson-plans.review',

  /* teacher portal — weekly report */
  SAVE_WEEKLY_REPORT: 'weekly-reports.create',
  DELETE_WEEKLY_REPORT: 'weekly-reports.delete',
  SUBMIT_WEEKLY_REPORT: 'weekly-reports.submit',
  REVIEW_WEEKLY_REPORT: 'weekly-reports.review',

  /* teacher portal — class-teacher weekly report */
  SAVE_CLASS_TEACHER_REPORT: 'class-reports.create',
  DELETE_CLASS_TEACHER_REPORT: 'class-reports.delete',
  SUBMIT_CLASS_TEACHER_REPORT: 'class-reports.submit',
  SHARE_CLASS_TEACHER_REPORT: 'class-reports.read',

  /* teacher portal — leave */
  APPLY_FOR_LEAVE: 'leave.create',
  DECIDE_LEAVE: 'leave.approve',
  DELETE_LEAVE_REQUEST: 'leave.approve',

  /* teacher portal — HR queries */
  RAISE_HR_QUERY: 'queries.issue',
  UPDATE_HR_QUERY: 'queries.read',

  /* teacher portal — counselling */
  SAVE_COUNSELLING_COMMITTEE: 'counselling.committees.manage',
  DELETE_COUNSELLING_COMMITTEE: 'counselling.committees.manage',
  LAUNCH_COUNSELLING_CASE: 'counselling.cases.book',
  UPDATE_COUNSELLING_CASE_STATUS: 'counselling.cases.view',
  ADD_COUNSELLING_CASE_COMMENT: 'counselling.cases.view',
  /* Deleting a case is not something the live app gates on a case-level
     permission — `deleteCounsellingCase(id)` carries none — so the code here is
     chosen to keep the control out of a read-only session's hands rather than to
     reproduce an origin that offers it to everyone who can see the case. Recorded
     as a deliberate divergence in parity-report.md. */
  DELETE_COUNSELLING_CASE: 'counselling.committees.manage',
  SAVE_COUNSELLING_REPORT: 'counselling.reports.manage',
  SHARE_COUNSELLING_REPORT: 'counselling.reports.view',

  /* teacher portal — disciplinary */
  SAVE_DISCIPLINARY_INCIDENT_TYPE: 'disciplinary.incidents.manage',
  DELETE_DISCIPLINARY_INCIDENT_TYPE: 'disciplinary.incidents.manage',
  SAVE_DISCIPLINARY_COMMITTEE: 'disciplinary.committees.manage',
  DELETE_DISCIPLINARY_COMMITTEE: 'disciplinary.committees.manage',
  LAUNCH_DISCIPLINARY_CASE: 'disciplinary.cases.launch',
  UPDATE_DISCIPLINARY_CASE_STATUS: 'disciplinary.cases.view',
  ADD_DISCIPLINARY_CASE_COMMENT: 'disciplinary.cases.view',
  /* See DELETE_COUNSELLING_CASE: the origin gates no case delete at all, so this
     is this console's own floor rather than a reproduction. */
  DELETE_DISCIPLINARY_CASE: 'disciplinary.committees.manage',
  SHARE_DISCIPLINARY_CASE: 'disciplinary.cases.view',

  /* teacher portal — messaging */
  SEND_TEACHER_MESSAGE: 'communication.messages.send',
  CREATE_TEACHER_CONVERSATION: 'communication.messages.send',
  MARK_TEACHER_CONVERSATION_READ: 'communication.messages.send',

  /* teacher portal — profile and events.
     Profile updates are gated on `teacher.read` because the origin gates the
     whole profile page on nothing at all — a session that can open the portal
     can edit itself. That is the observable behaviour, so the code chosen here
     is the one that reproduces it rather than inventing a stricter one. */
  UPDATE_TEACHER_PROFILE: 'teacher.read',
  PUBLISH_SCHOOL_EVENT: 'communication.events.create',

  /* ── St Finbarr's admin portal ─────────────────────────────────────────
   * Each entry is the permission the deployed app gates that action on, taken
   * from `lib/permissions.ts` in its own source. Where the origin has no gate
   * at all the code is chosen to REPRODUCE that (a comment says so), because a
   * tightened gate would be an invention dressed as a fix.
   */

  /* Generic registry engine. The read and write halves are separated: a role
     that may view a list may not create a row in it. */
  SAVE_ADMIN_RECORD: '__ADMIN_WRITE__',
  DELETE_ADMIN_RECORD: '__ADMIN_DELETE__',
  ADMIN_DECIDE: '__ADMIN_DECIDE__',
  ADMIN_SET_STATUS: '__ADMIN_WRITE__',
  RESEND_INVITATION: 'invitations.send',

  SAVE_ADMIN_ROLE: 'roles.create',
  ASSIGN_ROLE: 'roles.update',
  UNASSIGN_ROLE: 'roles.update',
  SAVE_ADMIN_PERMISSION_GRANT: 'permissions.update',

  IMPORT_STAFF: 'staff.import',
  IMPORT_STUDENTS: 'students.import',
  CONFIRM_IMPORT: '__ADMIN_WRITE__',

  SAVE_ATTENDANCE_SHEET: 'attendance.manage',
  SAVE_ATTENDANCE_MARKS: 'attendance.mark',

  SAVE_UPLOAD_WINDOW: 'results.window.manage',
  SET_UPLOAD_WINDOW_STATUS: 'results.window.manage',
  SAVE_RESULT_ENTRIES: 'results.upload',
  /* The live source gates the queue on `results.vet` for vet and on
     `results.publish` for publish; `DECIDE_RESULT` carries which one it is in
     its `decision`, so the code here is the weaker of the two and the panel
     narrows it further per row action. */
  DECIDE_RESULT: 'results.vet',
  SAVE_GRADING_SETTINGS: 'results.grading.manage',

  ADJUST_WALLET: 'wallet.manage',
  /* The cart is the customer's own basket, so it is gated on the same
     `store.cart.manage` as adding to it; reading it is the same operation on
     the same record. The bursary's two decisions keep `store.queue.manage`,
     which is what the live queue route itself requires. */
  GET_CART: 'store.cart.manage',
  ADD_TO_CART: 'store.cart.manage',
  UPDATE_CART_ITEM: 'store.cart.manage',
  REMOVE_CART_ITEM: 'store.cart.manage',
  PLACE_STORE_ORDER: 'store.cart.manage',
  CONFIRM_STORE_ORDER: 'store.queue.manage',
  RESOLVE_STORE_REFUND: 'store.queue.manage',
  RECORD_FEE_PAYMENT: 'schoolfees.manage',

  SAVE_INVENTORY_SETTINGS: 'system.settings.update',
  SAVE_STOCK_MOVEMENT: 'inventory.stock.manage',

  /* Notice board writes reuse the LAEC `notices.*` codes: the admin portal's
     notice form and LAEC's notice board are the same feature reached from two
     consoles, so one permission governs it. */
  PUBLISH_ADMIN_NOTICE: 'notices.publish',
  PUBLISH_ADMIN_EVENT: 'communication.events.create',

  SAVE_GENERAL_SETTINGS: 'system.settings.update',
  SAVE_SYSTEM_CONFIGURATION: 'system.settings.update',
  SAVE_ADMIN_BRANDING: 'system.settings.update',
  SAVE_FEATURE_TOGGLE: 'system.settings.update',
  CREATE_BACKUP: 'system.settings.update',
};

/**
 * The three sentinel codes above.
 *
 * `SAVE_ADMIN_RECORD` is one contract action serving forty registry resources,
 * and the permission that guards it differs per resource — a user who may add
 * staff may not add a role. `callApi` cannot know which resource a caller meant
 * from the action name alone, so it resolves the placeholder against the
 * request: the registry module's own `writePermission` / `deletePermission` /
 * the row's decision verb.
 *
 * That resolution happens in `resolveAdminPermission` below and nowhere else,
 * so the transport still enforces exactly one thing per action and the rule is
 * in one readable place. A request whose resource names no module (or names a
 * module with no write permission) FAILS CLOSED, because an unresolvable gate is
 * exactly the case an exemption would be invented for.
 */
export const ADMIN_WRITE_SENTINEL = '__ADMIN_WRITE__';
export const ADMIN_DELETE_SENTINEL = '__ADMIN_DELETE__';
export const ADMIN_DECIDE_SENTINEL = '__ADMIN_DECIDE__';

/**
 * Which module a generic admin request is about, so its placeholder can be
 * resolved. `import` is deferred to the top of the module's lifetime because
 * `admin-registry.ts` does not import this file, but `mock.ts` imports both.
 */
let adminModuleLookup: ((resource: string) => { writePermission?: string; deletePermission?: string; permission: string } | undefined) | null = null;

/** Registered by `mock.ts` at module load; see `registerAdminModuleLookup`. */
export function registerAdminModuleLookup(
  lookup: (resource: string) => { writePermission?: string; deletePermission?: string; permission: string } | undefined,
): void {
  adminModuleLookup = lookup;
}

/** The decision verb → permission for the workflows `ADMIN_DECIDE` covers. */
const DECIDE_PERMISSION: Record<string, PermissionCode> = {
  APPROVED: 'leave.approve',
  REJECTED: 'leave.approve',
  RESOLVED: 'queries.resolve',
  ARCHIVED: 'queries.resolve',
};

/**
 * The permission a generic admin action really requires, given the request.
 *
 * Returns `undefined` when the action is not one of the three sentinels, and
 * `null` for a sentinel that cannot be resolved — which `callApi` treats as
 * denied, so an unknown resource never gains access by being unknown.
 */
export function resolveAdminPermission(action: string, request: unknown): PermissionCode | null | undefined {
  /*
   * The sentinel test reads the raw map, not `permissionForAction`. That function
   * narrows a placeholder to `null` on purpose — `null` is what "not a declared
   * code" means to every other caller — so testing its return against the
   * sentinel strings would compare two types the compiler knows cannot overlap,
   * and would silently return the placeholder as `null` for every action.
   */
  const sentinel = ACTION_PERMISSIONS[action] as string | null | undefined;
  if (
    sentinel !== ADMIN_WRITE_SENTINEL &&
    sentinel !== ADMIN_DELETE_SENTINEL &&
    sentinel !== ADMIN_DECIDE_SENTINEL
  ) {
    return isKnownPermission(sentinel) ? sentinel : sentinel === null ? null : undefined;
  }
  if (!adminModuleLookup) return null;
  const req = (request ?? {}) as { resource?: unknown; decision?: unknown };
  const module = adminModuleLookup(String(req.resource ?? ''));
  if (!module) return null;
  if (sentinel === ADMIN_DECIDE_SENTINEL) {
    const decision = String(req.decision ?? '').toUpperCase();
    const code = DECIDE_PERMISSION[decision] ?? module.permission;
    return isKnownPermission(code) ? code : null;
  }
  const code = sentinel === ADMIN_DELETE_SENTINEL ? module.deletePermission : module.writePermission;
  // A module with no delete permission cannot be deleted from, and a module with
  // no write permission cannot be written to. `null`, so the gate refuses.
  return isKnownPermission(code) ? code : null;
}

/** Whether a string is a declared code. Anything else fails closed. */
function isKnownPermission(code: string | undefined | null): code is PermissionCode {
  return typeof code === 'string' && (PERMISSION_CODES as readonly string[]).includes(code);
}

/**
 * Whether an action's static mapping is one of the three placeholders.
 *
 * `permissionForAction` deliberately reports a placeholder as `null`, because
 * `null` is what "not a declared code" means to every other caller and a
 * placeholder is exactly that until it is resolved. A caller that needs to tell
 * the two apart — the transport gate, which must not read `null` as "no
 * permission needed" — asks here.
 */
export function hasAdminPlaceholder(action: string): boolean {
  /*
   * Read through `ACTION_PERMISSIONS` rather than `permissionForAction`, which
   * deliberately narrows a placeholder to `null` — comparing that narrowed type to
   * the sentinel strings would be a comparison between types the compiler knows
   * cannot overlap, and it would hide the very thing this function exists to tell.
   */
  const mapped = ACTION_PERMISSIONS[action] as string | null | undefined;
  return (
    mapped === ADMIN_WRITE_SENTINEL ||
    mapped === ADMIN_DELETE_SENTINEL ||
    mapped === ADMIN_DECIDE_SENTINEL
  );
}

/**
 * The declared permission for a POST action, without resolving a placeholder.
 * `undefined` means "no such action", which `callApi` treats as a refusal.
 *
 * Prefer `resolveAdminPermission(action, request)`, which also resolves the
 * three sentinel entries. This function is for callers that genuinely only want
 * the static mapping.
 */
export const permissionForAction = (
  action: string,
): PermissionCode | null | undefined => {
  const mapped = ACTION_PERMISSIONS[action];
  if (mapped === undefined) return undefined;
  return isKnownPermission(mapped) ? mapped : null;
};

/* ── display helpers ────────────────────────────────────────────────────── */

const PERMISSION_LABELS: Record<string, string> = {
  'dashboard.read': 'View dashboard',
  'students.read': 'View students',
  'students.manage': 'Manage student records',
  'questions.read': 'View the question bank',
  'questions.author': 'Author question images',
  'questions.submit': 'Submit papers for review',
  'questions.manage': 'Create and edit questions',
  'questions.delete': 'Delete questions and papers',
  'results.read': 'View results',
  'results.remark': 'Remark results',
  'results.delete': 'Delete results',
  'admins.read': 'View school admins',
  'admins.manage': 'Manage school admin access',
  'exam.settings.manage': 'Change examination settings',
  'exam.schedule.manage': 'Promote and archive sessions',
  'review.read': 'View the review queue',
  'review.decide': 'Accept or reject submissions',
  'staff.read': 'View staff',
  'staff.manage': 'Manage staff',
  'notices.read': 'View notices',
  'notices.publish': 'Publish notices',
  'notices.delete': 'Withdraw notices',
  'calendar.read': 'View the academic calendar',
  'calendar.manage': 'Add and remove calendar events',
  'notifications.read': 'View notifications',
  'notifications.mark': 'Mark notifications as read',
  'system.read': 'View system health',
  'password.reset': 'Reset admin passwords',

  /* teacher portal */
  'teacher.read': 'View the teacher portal',
  'lesson-plans.read': 'View lesson plans',
  'lesson-plans.create': 'Create lesson plans',
  'lesson-plans.update': 'Edit lesson plans',
  'lesson-plans.delete': 'Delete lesson plans',
  'lesson-plans.submit': 'Submit lesson plans for review',
  'lesson-plans.review': 'Review lesson plans',
  'weekly-reports.read': 'View weekly reports',
  'weekly-reports.create': 'Create weekly reports',
  'weekly-reports.update': 'Edit weekly reports',
  'weekly-reports.delete': 'Delete weekly reports',
  'weekly-reports.submit': 'Submit weekly reports for review',
  'weekly-reports.review': 'Review weekly reports',
  'class-reports.read': 'View class teacher weekly reports',
  'class-reports.create': 'Create class teacher weekly reports',
  'class-reports.update': 'Edit class teacher weekly reports',
  'class-reports.delete': 'Delete class teacher weekly reports',
  'class-reports.submit': 'Submit class teacher weekly reports',
  'leave.read': 'View leave requests',
  'leave.create': 'Apply for leave',
  'leave.approve': 'Approve or reject leave',
  'queries.read': 'View HR queries',
  'queries.issue': 'Raise an HR query',
  'communication.read': 'View communication',
  'communication.messages.send': 'Send messages',
  'communication.events.create': 'Publish events',
  'counselling.read': 'View counselling',
  'counselling.cases.book': 'Book a counselling session',
  'counselling.cases.view': 'View counselling cases',
  'counselling.committees.view': 'View counselling committees',
  'counselling.committees.manage': 'Manage counselling committees',
  'counselling.reports.view': 'View counselling reports',
  'counselling.reports.manage': 'Create counselling reports',
  'disciplinary.read': 'View disciplinary',
  'disciplinary.incidents.manage': 'Manage disciplinary case types',
  'disciplinary.committees.manage': 'Manage disciplinary committees',
  'disciplinary.cases.launch': 'Launch a disciplinary case',
  'disciplinary.cases.view': 'View disciplinary cases',
};

const ACTION_VERBS: Record<string, string> = {
  read: 'View',
  view: 'View',
  manage: 'Manage',
  delete: 'Delete',
  publish: 'Publish',
  author: 'Author',
  submit: 'Submit',
  decide: 'Decide',
  remark: 'Remark',
  mark: 'Mark',
  reset: 'Reset',
};

/** `results.remark` -> "Remark results". Known codes win over the fallback. */
export function humanizePermission(name: string): string {
  const known = PERMISSION_LABELS[name];
  if (known) return known;
  const parts = name.split('.');
  const action = parts.pop() ?? name;
  const object = parts.join(' ');
  const verb = ACTION_VERBS[action] ?? action;
  const label = verb + (object ? ` ${object}` : '');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Overview',
  students: 'Students',
  questions: 'Question Bank',
  results: 'Results',
  admins: 'School Admins',
  exam: 'Examination',
  review: 'Review Queue',
  staff: 'Staff',
  notices: 'Notice Board',
  calendar: 'Calendar',
  notifications: 'Notifications',
  system: 'System',
  password: 'Account recovery',
  /* teacher portal — the hyphenated modules keep their origin spelling so a
     code reads identically to the one in the deployed app's own source. */
  teacher: 'Teacher Portal',
  'lesson-plans': 'Lesson Planning',
  'weekly-reports': 'Weekly Report',
  'class-reports': 'Class Teacher Weekly Report',
  leave: 'Leave',
  queries: 'HR Queries',
  communication: 'Communication',
  counselling: 'Guidance & Counselling',
  disciplinary: 'Disciplinary',
};

/** `results` -> "Results". Groups the permission list in the UI. */
export function moduleLabel(module: string): string {
  const known = MODULE_LABELS[module];
  if (known) return known;
  const label = module.replace(/[-_]+/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** The codes a module owns, in declaration order - used to render groups. */
export function permissionsByModule(): Array<{ module: string; label: string; codes: string[] }> {
  const groups = new Map<string, string[]>();
  for (const code of PERMISSION_CODES) {
    const module = code.split('.')[0];
    const list = groups.get(module) ?? [];
    list.push(code);
    groups.set(module, list);
  }
  return [...groups.entries()].map(([module, codes]) => ({
    module,
    label: moduleLabel(module),
    codes,
  }));
}
