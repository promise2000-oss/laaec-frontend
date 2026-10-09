/**
 * Per-role navigation (D-62), permission-filtered (D-71).
 *
 * The origin's six consoles each owned a flat horizontal tab strip with no
 * hierarchy, which is the main reason the portal read as a set of unrelated
 * admin panels. This module keeps every one of those 37 tab labels verbatim —
 * the labels are part of the observable copy — and only changes the *grouping*
 * and the order, so a role sees its sections as domains rather than as a
 * single undifferentiated row.
 *
 * Each role gets a different list. That began as a presentation decision
 * (D-61): it showed a role what it was for and blocked nothing. D-71 revises
 * it — every item now carries the permission its panel requires, and
 * `filterNav` drops the ones the session does not hold. The labels and the
 * grouping are still the origin's; what changed is that a list is now a
 * statement about access rather than about taste.
 *
 * The Super Admin bypasses the filter outright, which is how the reference
 * implementation expresses its super-administrator: not granted everything,
 * but not subject to the check.
 */
import type { AdminRole } from '../types';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  /** The permission required to see this item. Undefined means always visible. */
  permission?: string;
  /**
   * Set when the item is a separate document rather than a panel of this
   * console. Clicking such an item navigates instead of switching tabs —
   * `/calendar/` and `/notices/` are their own routes (D-64), and treating
   * them as panels is what blanked the console content area.
   */
  route?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface RoleNav {
  /** The breadcrumb root, i.e. what this role is. */
  breadcrumb: string;
  roleLabel: string;
  /** Whether this role holds every school or exactly one. */
  scopeKind: 'global' | 'school';
  groups: NavGroup[];
}

/**
 * The teacher rail (D-72).
 *
 * THREE SETS OF ITEMS, not one, and that is the point:
 *
 * 1. LAEC's own author workflow — `My Papers` / `Compose` / `Decisions`. These
 *    are exam question papers and they stay exactly as they were. The St
 *    Finbarr's lesson plan is also an authored document with a review step, and
 *    merging the two would lose the distinction between authoring a paper for
 *    the exam hall and authoring a plan for a class.
 *
 * 2. The St Finbarr's teacher portal, whose nav labels are the deployed app's
 *    own — `Lesson Planning`, `Weekly Report`, `Permission (leave)`, `HR
 *    Queries`, `Communications`, `Disciplinary`, `Guidance & Counselling`. The
 *    origin spells leave "Permission"; that is its wording and is kept, because
 *    a rail label is observable copy.
 *
 * 3. The two shared documents, appended by `navFor` from `SCHOOL_GROUP`.
 *
 * Grouping follows the origin's own two sections ("Teacher Portal" and
 * "General") rather than inventing a third arrangement, with LAEC's decisions
 * kept in a group of their own because they belong to the exam workflow.
 */
const TEACHER_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'gauge', permission: 'dashboard.read' },
      { id: 'drafts', label: 'My Papers', icon: 'book', permission: 'questions.author' },
    ],
  },
  {
    title: 'Teacher Portal',
    items: [
      { id: 'lesson-plans', label: 'Lesson Planning', icon: 'file', permission: 'teacher.read' },
      { id: 'weekly-reports', label: 'Weekly Report', icon: 'pen', permission: 'teacher.read' },
      { id: 'class-reports', label: 'Class Teacher Report', icon: 'pen', permission: 'teacher.read' },
      { id: 'lesson-approval', label: 'Review Inbox', icon: 'inbox', permission: 'lesson-plans.review' },
      { id: 'leave', label: 'Permission (leave)', icon: 'calendar', permission: 'teacher.read' },
      { id: 'hr-queries', label: 'HR Queries', icon: 'inbox', permission: 'queries.read' },
    ],
  },
  {
    title: 'Exam Papers',
    items: [
      { id: 'compose', label: 'Compose', icon: 'book', permission: 'questions.author' },
      { id: 'notices', label: 'Decisions', icon: 'inbox', permission: 'questions.submit' },
    ],
  },
  {
    title: 'General',
    items: [
      { id: 'messaging', label: 'Messages', icon: 'inbox', permission: 'communication.read' },
      { id: 'events', label: 'Events', icon: 'calendar', permission: 'communication.read' },
      { id: 'counselling', label: 'Guidance & Counselling', icon: 'users', permission: 'counselling.read' },
      { id: 'disciplinary', label: 'Disciplinary', icon: 'shield', permission: 'disciplinary.read' },
      { id: 'notifications', label: 'Notifications', icon: 'inbox', permission: 'notifications.read' },
      { id: 'profile', label: 'Profile', icon: 'users', permission: 'teacher.read' },
    ],
  },
];

/** The review console: content governance above the school consoles (D-55). */
const CENTRAL_GROUPS: NavGroup[] = [
  { title: 'Overview', items: [{ id: 'review', label: 'Review Queue', icon: 'inbox', permission: 'review.read' }] },
  { title: 'Content', items: [{ id: 'bank', label: 'Question Bank', icon: 'book', permission: 'questions.read' }] },
  { title: 'People', items: [{ id: 'staff', label: 'Staff', icon: 'shield', permission: 'staff.read' }] },
];

/*
 * The Super Admin rail after the Saint Finbarr's admin addendum.
 *
 * TWO SETS, and why they are two sets rather than one merged list:
 *
 * 1. LAEC's own origin panels — `dashboard`, `exam-mgt`, `past-questions`,
 *    `results`, `student-directory`, `admins`, `health`. Transcribed from
 *    `origin-pages/admin.html` and unchanged by the addendum, but regrouped: the
 *    origin's single `Overview` heading now heads a group that says what the
 *    group actually is, because it now sits beside eight other groups and
 *    "Overview" was not a description of anything.
 *
 * 2. The Saint Finbarr's College admin modules, whose rail labels are the live
 *    deployment's own and are kept verbatim — a rail label is observable copy.
 *
 * THE `students` ID COLLISION, which is deliberate
 * ------------------------------------------------
 * LAEC's panel was `students` and the Saint Finbarr's module is also `students`.
 * One id cannot address two panels, so LAEC's is renamed to
 * `student-directory` and the Saint Finbarr's keeps the id its registry entry
 * uses. Ids are not observable copy — the labels are, and they still differ on
 * screen ("Student Directory" against "Student List") — so this is the cheaper
 * of the two renames: one panel id and its `showTab`/`activeTab` calls, rather
 * than renaming the module across the registry, the mock and the rail.
 */
/*
 * The Super Admin rail after the Saint Finbarr's admin addendum.
 *
 * TWO SETS, and why they are two sets rather than one merged list:
 *
 * 1. LAEC's own origin panels — `dashboard`, `exam-mgt`, `past-questions`,
 *    `results`, `student-directory`, `admins`, `health`. Transcribed from
 *    `origin-pages/admin.html` and unchanged by the addendum, but regrouped: the
 *    origin's single `Overview` heading now heads a group that says what the
 *    group actually is, because it now sits beside eleven other groups and
 *    "Overview" was not a description of anything.
 *
 * 2. The Saint Finbarr's College admin modules, whose rail labels are the live
 *    deployment's own and are kept verbatim — a rail label is observable copy.
 *
 * THE `students` ID COLLISION, which is deliberate
 * ------------------------------------------------
 * LAEC's panel was `students` and the Saint Finbarr's module is also `students`.
 * One id cannot address two panels, so LAEC's becomes `student-directory` and
 * the Saint Finbarr's keeps the id its registry entry uses. Ids are not
 * observable copy — the labels are, and they still differ on screen ("Student
 * Directory" against "Student List") — so this is the cheaper of the two
 * renames: one panel id and its `showTab`/`activeTab` calls, rather than
 * renaming the module across the registry, the mock and the rail.
 */
const ADMIN_GROUPS: NavGroup[] = [
  {
    title: 'LAEC Examination',
    items: [
      { id: 'dashboard', label: 'Overview', icon: 'gauge', permission: 'dashboard.read' },
      { id: 'exam-mgt', label: 'Exam Management', icon: 'calendar', permission: 'exam.schedule.manage' },
      { id: 'past-questions', label: 'Past Questions', icon: 'book', permission: 'questions.read' },
      { id: 'results', label: 'Results Center', icon: 'chart', permission: 'results.read' },
      { id: 'student-directory', label: 'Student Directory', icon: 'users', permission: 'students.read' },
      { id: 'admins', label: 'School Admins', icon: 'shield', permission: 'admins.read' },
      { id: 'health', label: 'System Health', icon: 'cog', permission: 'system.read' },
    ],
  },
  {
    title: 'Dashboards',
    items: [{ id: 'school-dashboard', label: 'Dashboard', icon: 'gauge', permission: 'dashboard.superadmin' }],
  },
  {
    title: 'User & Roles',
    items: [
      { id: 'users', label: 'Users', icon: 'users', permission: 'users.read' },
      { id: 'roles', label: 'Roles', icon: 'shield', permission: 'roles.read' },
      { id: 'permissions', label: 'Permissions', icon: 'cog', permission: 'permissions.read' },
    ],
  },
  {
    title: 'Staff & HR',
    items: [
      { id: 'staff', label: 'Staff List', icon: 'users', permission: 'staff.read' },
      { id: 'departments', label: 'Departments', icon: 'file', permission: 'departments.read' },
      { id: 'designations', label: 'Designations', icon: 'file', permission: 'designations.read' },
      { id: 'staff-attendance', label: 'Staff Attendance', icon: 'book', permission: 'attendance.read' },
      { id: 'staff-attendance-report', label: 'Staff Attendance Report', icon: 'file', permission: 'attendance.read' },
      { id: 'leave', label: 'Leave', icon: 'calendar', permission: 'leave.view' },
      { id: 'leave-approvals', label: 'Leave Approvals', icon: 'check', permission: 'leave.approve' },
      { id: 'hr-queries', label: 'HR Queries', icon: 'inbox', permission: 'queries.view' },
      { id: 'awards', label: 'Awards', icon: 'chart', permission: 'awards.read' },
    ],
  },
  {
    title: 'Students & Parents',
    items: [
      { id: 'students', label: 'Student List', icon: 'users', permission: 'students.read' },
      { id: 'student-attendance', label: 'Student Attendance', icon: 'book', permission: 'attendance.read' },
      { id: 'student-attendance-report', label: 'Student Attendance Report', icon: 'chart', permission: 'attendance.read' },
      { id: 'parents', label: 'Parent List', icon: 'users', permission: 'parents.read' },
    ],
  },
  {
    title: 'Academic Settings',
    items: [
      { id: 'sessions', label: 'Sessions', icon: 'calendar', permission: 'academic.read' },
      { id: 'classes', label: 'Classes', icon: 'book', permission: 'academic.read' },
      { id: 'arms', label: 'Arms', icon: 'file', permission: 'academic.read' },
      { id: 'subjects', label: 'Subjects', icon: 'book', permission: 'academic.read' },
      { id: 'timetables', label: 'Timetable', icon: 'book', permission: 'academic.read' },
      { id: 'assignments', label: 'Assignments', icon: 'file', permission: 'academic.read' },
      { id: 'class-teachers', label: 'Class Teachers', icon: 'users', permission: 'academic.read' },
      { id: 'subject-teachers', label: 'Subject Teachers', icon: 'users', permission: 'academic.read' },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { id: 'stock', label: 'Stock Items', icon: 'book', permission: 'inventory.stock.read' },
      { id: 'inventory-categories', label: 'Item Categories', icon: 'file', permission: 'inventory.read' },
      { id: 'suppliers', label: 'Suppliers', icon: 'file', permission: 'inventory.suppliers.read' },
      { id: 'assets', label: 'Assets', icon: 'file', permission: 'inventory.assets.read' },
      { id: 'inventory-reports', label: 'Reports', icon: 'chart', permission: 'inventory.stock.read' },
      { id: 'inventory-settings', label: 'Settings', icon: 'cog', permission: 'system.settings.update' },
      { id: 'clinic-store', label: 'Clinic Store', icon: 'book', permission: 'inventory.clinic.read' },
      { id: 'sales', label: 'Sales & Invoicing', icon: 'chart', permission: 'inventory.sales.read' },
    ],
  },
  {
    title: 'Disciplinary',
    items: [
      { id: 'disciplinary-reports', label: 'Case Reports', icon: 'file', permission: 'disciplinary.cases.view' },
      { id: 'disciplinary-launch-case', label: 'Launch Case', icon: 'pen', permission: 'disciplinary.cases.launch' },
      { id: 'disciplinary-incidents', label: 'Incidents', icon: 'book', permission: 'disciplinary.read' },
      { id: 'disciplinary-committees', label: 'Committee', icon: 'users', permission: 'disciplinary.read' },
    ],
  },
  {
    title: 'Counselling',
    items: [
      { id: 'counselling-cases', label: 'View Cases', icon: 'users', permission: 'counselling.cases.view' },
      { id: 'counselling-book-session', label: 'Book Session', icon: 'pen', permission: 'counselling.cases.book' },
      { id: 'counselling-reports', label: 'Session Reports', icon: 'file', permission: 'counselling.reports.view' },
      { id: 'counselling-committee', label: 'Committee', icon: 'users', permission: 'counselling.committees.view' },
    ],
  },
  {
    title: 'Store',
    items: [
      { id: 'store', label: 'Browse Store', icon: 'book', permission: 'store.browse' },
      { id: 'cart', label: 'My Cart', icon: 'file', permission: 'store.cart.manage' },
      { id: 'orders', label: 'My Orders', icon: 'file', permission: 'store.orders.read' },
      { id: 'queue', label: 'Confirmation Queue', icon: 'inbox', permission: 'store.queue.read' },
      {
        id: 'refund-queue',
        label: 'Refund Queue',
        icon: 'inbox',
        permission: 'store.queue.read',
        /* The live app models Refund Queue as the same route with
           `?status=REFUND_PENDING`, not a second page. Carrying the query here
           keeps it one queue rather than two lists that can disagree. */
        route: '/admin/?panel=queue&status=REFUND_PENDING',
      },
    ],
  },
  {
    title: 'School Fees',
    items: [
      { id: 'fee-breakdown', label: 'Fee Breakdown', icon: 'file', permission: 'schoolfees.read' },
      { id: 'fee-categories', label: 'Fee Categories', icon: 'file', permission: 'schoolfees.read' },
      { id: 'fee-items', label: 'Fee Items', icon: 'file', permission: 'schoolfees.read' },
      { id: 'fee-payments', label: 'Payment History', icon: 'file', permission: 'schoolfees.read' },
      { id: 'fee-reports', label: 'Fee Reports', icon: 'chart', permission: 'schoolfees.read' },
    ],
  },
  {
    title: 'Student Wallet',
    items: [
      { id: 'wallets', label: 'Wallets', icon: 'file', permission: 'wallet.view' },
      { id: 'wallet-reports', label: 'Wallet Reports', icon: 'chart', permission: 'wallet.view' },
    ],
  },
  {
    title: 'Results Management',
    items: [
      { id: 'upload-windows', label: 'Upload Windows', icon: 'calendar', permission: 'results.window.read' },
      { id: 'enter-results', label: 'Enter Results', icon: 'pen', permission: 'results.upload' },
      { id: 'results-queue', label: 'Results Queue', icon: 'inbox', permission: 'results.queue.read' },
      { id: 'committee-review', label: 'Committee Review', icon: 'inbox', permission: 'results.committee.view' },
      { id: 'grading', label: 'Grading Settings', icon: 'cog', permission: 'results.grading.manage' },
      { id: 'student-results', label: 'Student Results', icon: 'users', permission: 'results.view' },
      { id: 'report-cards', label: 'Report Cards', icon: 'file', permission: 'results.report.view' },
    ],
  },
  {
    title: 'System',
    items: [
      { id: 'general-settings', label: 'School Manager', icon: 'cog', permission: 'system.read' },
      { id: 'academic-settings', label: 'Academic Settings', icon: 'cog', permission: 'system.read' },
      { id: 'audit-logs', label: 'Audit Logs', icon: 'file', permission: 'audit_log.view' },
      { id: 'backups', label: 'Backups', icon: 'file', permission: 'system.read' },
      { id: 'branding', label: 'Branding', icon: 'file', permission: 'system.read' },
      { id: 'feature-toggles', label: 'Feature Toggles', icon: 'cog', permission: 'system.read' },
      { id: 'notification-settings', label: 'Notification Settings', icon: 'cog', permission: 'system.read' },
      { id: 'system-configuration', label: 'System Configuration', icon: 'cog', permission: 'system.read' },
    ],
  },
];

const CA_GROUPS: NavGroup[] = [
  { title: 'Overview', items: [{ id: 'dashboard', label: 'Overview', icon: 'gauge', permission: 'dashboard.read' }] },
  { title: 'People', items: [{ id: 'students', label: 'Student Directory', icon: 'users', permission: 'students.read' }] },
  {
    title: 'Academics',
    items: [
      { id: 'register', label: 'Registration Portal', icon: 'inbox', permission: 'students.read' },
      { id: 'exam-center', label: 'Examination Center', icon: 'calendar', permission: 'exam.settings.manage' },
      { id: 'past-questions', label: 'Question Archive', icon: 'book', permission: 'questions.read' },
    ],
  },
  { title: 'Results', items: [{ id: 'results', label: 'School Results', icon: 'chart', permission: 'results.read' }] },
  { title: 'Governance', items: [{ id: 'ict-access', label: 'Internal Admins', icon: 'shield', permission: 'admins.read' }] },
  { title: 'System', items: [{ id: 'health', label: 'System Health', icon: 'cog', permission: 'system.read' }] },
];

const ICT_GROUPS: NavGroup[] = [
  { title: 'Overview', items: [{ id: 'dashboard', label: 'Overview', icon: 'gauge', permission: 'dashboard.read' }] },
  { title: 'People', items: [{ id: 'students', label: 'Student Directory', icon: 'users', permission: 'students.read' }] },
  {
    title: 'Academics',
    items: [
      { id: 'register', label: 'Registration Portal', icon: 'inbox', permission: 'students.read' },
      { id: 'exam-center', label: 'Examination Center', icon: 'calendar', permission: 'exam.settings.manage' },
      { id: 'past-questions', label: 'Past Questions', icon: 'book', permission: 'questions.read' },
    ],
  },
  { title: 'Results', items: [{ id: 'results', label: 'School Results', icon: 'chart', permission: 'results.read' }] },
  { title: 'System', items: [{ id: 'health', label: 'System Health', icon: 'cog', permission: 'system.read' }] },
];

const COMM_GROUPS: NavGroup[] = [
  { title: 'Overview', items: [{ id: 'dashboard', label: 'Overview', icon: 'gauge', permission: 'dashboard.read' }] },
  { title: 'People', items: [{ id: 'students', label: 'Student Directory', icon: 'users', permission: 'students.read' }] },
  {
    title: 'Academics',
    items: [
      { id: 'exam-center', label: 'Examination Center', icon: 'calendar', permission: 'exam.settings.manage' },
      { id: 'past-questions', label: 'Past Questions', icon: 'book', permission: 'questions.read' },
    ],
  },
  { title: 'Results', items: [{ id: 'results', label: 'School Results', icon: 'chart', permission: 'results.read' }] },
  { title: 'System', items: [{ id: 'health', label: 'System Health', icon: 'cog', permission: 'system.read' }] },
];

/**
 * The two cross-role surfaces carried over from the reference school-management
 * application (D-64). They are identical for every role, so they are declared
 * once and appended to each role's list rather than repeated six times - a
 * calendar or a notice board is the same thing to a school admin and to the
 * master admin, only the publish rights differ.
 *
 * Both are documents, not panels: no console has a `calendar` or `notice-board`
 * panel, so both carry a `route` and navigate rather than switch tabs. The
 * Notice Board's id is `notice-board` rather than `notices` for exactly that
 * reason - the teacher console already has a `notices` panel (Decisions), and
 * letting the two share an id meant a click could not say which one it meant.
 * The label is unchanged; only the id, which is not part of the observable
 * copy, is ours to name.
 */
const SCHOOL_GROUP: NavGroup = {
  title: 'School',
  items: [
    { id: 'calendar', label: 'Calendar', icon: 'calendar', permission: 'calendar.read', route: '/calendar/' },
    { id: 'notice-board', label: 'Notice Board', icon: 'inbox', permission: 'notices.read', route: '/notices/' },
  ],
};

const byRole: Record<AdminRole, RoleNav> = {
  SUPER_ADMIN: {
    breadcrumb: 'Super Administrator',
    roleLabel: 'Super Admin',
    scopeKind: 'global',
    groups: ADMIN_GROUPS,
  },
  CENTRAL_ADMIN: {
    breadcrumb: 'Central Administration',
    roleLabel: 'Central Admin',
    scopeKind: 'global',
    groups: CENTRAL_GROUPS,
  },
  SCHOOL_ADMIN: {
    breadcrumb: 'School Administration',
    roleLabel: 'School Admin',
    scopeKind: 'school',
    groups: CA_GROUPS,
  },
  ICT_ADMIN: {
    breadcrumb: 'ICT Administration',
    roleLabel: 'ICT Admin',
    scopeKind: 'school',
    groups: ICT_GROUPS,
  },
  EXAM_COMMITTEE: {
    breadcrumb: 'Exam Committee',
    roleLabel: 'Exam Committee',
    scopeKind: 'school',
    groups: COMM_GROUPS,
  },
  TEACHER: {
    /*
     * Renamed from "Question Studio" with the teacher-portal addendum (D-72).
     * The name was accurate while the console was three exam-paper tabs; it is
     * not now that fourteen of its seventeen panels are the St Finbarr's
     * school-management modules. "Teacher Portal" is also the deployed app's own
     * name for this role's area, so the two consoles now agree on what a
     * teacher's console is called.
     */
    breadcrumb: 'Teacher Portal',
    roleLabel: 'Teacher',
    scopeKind: 'school',
    groups: TEACHER_GROUPS,
  },
};

/**
 * Falls back to the teacher list rather than throwing: a console reached with an
 * unexpected role claim should still render a usable nav, which is what the
 * origin does when a claim is missing.
 */
export const navFor = (role: string): RoleNav => {
  const base = byRole[role as AdminRole] ?? byRole.TEACHER;
  return { ...base, groups: [...base.groups, SCHOOL_GROUP] };
};

/**
 * The console a role claim belongs to, and the role whose navigation that
 * console shows (2026-10-02).
 *
 * WHY A SUPER ADMINISTRATOR NEEDS THIS
 * -----------------------------------
 * A console asks for its navigation by ROLE, so a session that reached it
 * under a different claim was shown the WRONG console's rail — the one belonging
 * to the claim in storage, not the one it is actually sitting in. Before the
 * guard admitted SUPER_ADMIN everywhere that was invisible, because the rail and
 * the console always agreed. Now that it does not, the rail has to follow the
 * route instead of the claim, or a super administrator on /teacher/ is offered
 * Exam Management and Results Center and none of the authoring panels they are
 * looking at.
 *
 * So each console names the role whose nav it is, and `navFor` is called with
 * THAT role, while the session's own claim still governs what the filters
 * resolve to. The two are the same value for every role except SUPER_ADMIN,
 * which is the whole point: its own console is /admin/, and the other five
 * render their own.
 */
export const CONSOLE_OWNER: Record<string, AdminRole> = {
  admin: 'SUPER_ADMIN',
  ca: 'SCHOOL_ADMIN',
  ict: 'ICT_ADMIN',
  comm: 'EXAM_COMMITTEE',
  teacher: 'TEACHER',
  central: 'CENTRAL_ADMIN',
};

/**
 * The role whose navigation `consoleName` shows. Falls back to the session's own
 * claim for a console that is not in the table, so an unlisted route keeps
 * behaving as it did before rather than rendering an empty rail.
 */
export const navRoleForConsole = (consoleName: string, sessionRole: string): string =>
  CONSOLE_OWNER[consoleName] ?? sessionRole;

/**
 * Narrows a role's navigation to the items its session may see (D-71).
 *
 * Mirrors `filterNavSections` in the reference implementation: the Super Admin
 * sees everything, an item with no permission is always visible, and a group
 * that loses all of its items disappears rather than rendering as an empty
 * heading.
 *
 * Filtering runs against the *effective* permission set — granted permissions
 * unioned with the role defaults — so a session whose grants have not arrived
 * yet still sees its own console instead of an empty rail.
 */
export const filterNav = (
  nav: RoleNav,
  permissions: readonly string[],
  role: string,
): RoleNav => {
  if (String(role || '').trim().toUpperCase() === 'SUPER_ADMIN') return nav;

  const visible = (item: NavItem): boolean =>
    !item.permission || permissions.includes(item.permission);

  return {
    ...nav,
    groups: nav.groups
      .map((group) => ({ ...group, items: group.items.filter(visible) }))
      .filter((group) => group.items.length > 0),
  };
};

/** The permission a panel id requires, for gating a console's own controls. */
export const permissionForPanel = (id: string): string | undefined => {
  for (const group of Object.values(byRole)) {
    for (const g of group.groups) {
      const item = g.items.find((candidate) => candidate.id === id);
      if (item?.permission) return item.permission;
    }
  }
  return undefined;
};

/**
 * The console document a role belongs to (D-71).
 *
 * The shared surfaces — `/calendar/` and `/notices/` — render the operator's
 * own rail, so a panel entry clicked there has to lead back to the console
 * that owns it. Building that path from the id instead (as the first attempt
 * did) produced `/dashboard/`, `/review/`, `/bank/` — none of which are
 * documents this portal has, and all of which landed on a blank page.
 */
export const consolePathFor = (role: string): string => {
  switch (String(role || '').trim().toUpperCase()) {
    case 'SUPER_ADMIN':
      return '/admin/';
    case 'CENTRAL_ADMIN':
      return '/central/';
    case 'SCHOOL_ADMIN':
      return '/ca/';
    case 'ICT_ADMIN':
      return '/ict/';
    case 'EXAM_COMMITTEE':
      return '/comm/';
    default:
      return '/teacher/';
  }
};

/** Where a shared surface parks the panel it is navigating back to. */
export const PENDING_PANEL_KEY = 'laec.pendingPanel';

/**
 * Reads and clears the pending panel, keeping it only when this console
 * actually has that entry — and only when the entry is a panel rather than
 * one of the two documents in the School group.
 *
 * Reading it is one-shot so a stale value cannot re-open a panel on a later
 * visit, and the membership test is what stops a navigation from landing on
 * an id no console renders, which is the blank-content failure this whole
 * path exists to avoid.
 */
export const takePendingPanel = (nav: RoleNav, restoreKey: string): string => {
  const pending = sessionStorage.getItem(PENDING_PANEL_KEY) || '';
  sessionStorage.removeItem(PENDING_PANEL_KEY);
  if (!pending) return '';
  const known = nav.groups.some((group) =>
    group.items.some((item) => item.id === pending && !item.route),
  );
  if (!known) return '';
  /*
   * Every console also re-applies a persisted tab on mount, one frame after
   * this value is read — without this it would silently overwrite the panel
   * the navigation asked for and open the default one instead. Writing the
   * handoff into that same key makes the two agree rather than race; when
   * there is no handoff the key is left alone and ordinary restore behaviour
   * is untouched.
   */
  localStorage.setItem(restoreKey, pending);
  return pending;
};

/**
 * Whether this session may open a given panel of a console (D-71).
 *
 * The consoles each re-apply a persisted tab on mount, and their old test for
 * "does this panel still exist" asked for an element with id `tab-<panel>` —
 * the origin's horizontal tab strip, which D-62 replaced with this rail. That
 * element has not existed in any console since, so the guard was always false
 * and the persisted tab was silently discarded. The panel itself is the thing
 * worth asking about, and filtering the nav as well means a tab persisted
 * under a grant that has since been withdrawn is not quietly reopened.
 */
export const canOpenPanel = (
  nav: RoleNav,
  permissions: readonly string[],
  role: string,
  id: string,
): boolean =>
  filterNav(nav, permissions, role).groups.some((group) =>
    group.items.some((item) => item.id === id && !item.route),
  );
