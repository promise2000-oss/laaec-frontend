/**
 * admin.ts — the Saint Finbarr's College admin portal: module registry.
 *
 * WHY A REGISTRY AND NOT ONE COMPONENT PER PAGE
 * ---------------------------------------------
 * The live admin portal has 131 routes, but its pages are overwhelmingly the
 * *same* page: a title, a toolbar with a search box and a filter or two, a
 * table, a row action menu, and a create/edit dialog with a small set of
 * fields. `/users`, `/staff`, `/departments`, `/designations`, `/students`,
 * `/parents`, `/academic/subjects`, `/academic/sessions`, `/inventory/stock`,
 * `/inventory/suppliers`, `/school-fees/categories`, `/school-fees/items`,
 * `/system/feature-toggles` and twenty more are all that page with a different
 * column set. Writing one Vue component per route would be ~60 files that
 * differ only in a field list, and they would drift apart.
 *
 * So a module is declared here — columns, filters, form fields, the actions it
 * offers and the permissions each one needs — and ONE component
 * (`AdminResourcePanel.vue`) renders any of them. A page whose behaviour is
 * genuinely not "a table and a form" (the dashboard, the permissions matrix,
 * results entry, the grading scale, a results queue, an attendance register, a
 * wallet, the store) has its own component, and the registry names it.
 *
 * Every entry is traceable to docs/saint-finbarrs-admin/feature-matrix.md.
 * Labels are the live app's own and are not paraphrased: a rail label is
 * observable copy.
 */
import type { PortalRole } from './admin';

/**
 * A column. `field` reads a key off the record; `render` names a presentation
 * the generic panel knows how to draw (`status`, `money`, `date`, `joined`,
 * `avatar`, `bool`, `count`, or nothing for plain text).
 */
export interface AdminColumn {
  key: string;
  label: string;
  /** Presentation hint. Absent means plain text. */
  render?: 'status' | 'money' | 'date' | 'avatar' | 'bool' | 'count' | 'code';
  /** Right-align numeric columns. */
  numeric?: boolean;
}

/** A toolbar filter. `options` is dynamic for most, so it is a field name. */
export interface AdminFilter {
  key: string;
  label: string;
  /** The record field whose distinct values populate the options. */
  source: string;
  /** The label for the "no filter" option. */
  allLabel: string;
}

export interface AdminFieldOption {
  value: string;
  label: string;
}

export interface AdminField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'date' | 'datetime' | 'select' | 'checkbox';
  required?: boolean;
  /**
   * The value must be a number greater than zero. Set on a money field whose
   * origin form refuses a zero or negative amount, so the refusal happens before
   * the request rather than after it — see the wallet adjust dialog.
   */
  positive?: boolean;
  placeholder?: string;
  options?: AdminFieldOption[];
  /** A fixed set, e.g. the category list, or the field name the options read. */
  optionsSource?: string;
  /** Shown under the control. */
  hint?: string;
  /** Half-width in the dialog grid. */
  half?: boolean;
}

/** A dialog or drawer the module opens. */
export interface AdminDialog {
  kind: 'create' | 'edit' | 'detail' | 'confirm';
  label: string;
  title: (record: AdminRecord) => string;
  /** Only for confirm dialogs. */
  message?: (record: AdminRecord) => string;
  confirmLabel?: string;
  danger?: boolean;
  /**
   * This dialog's own fields, overriding the module's.
   *
   * For a dialog that collects the OPERATOR's input rather than the record's
   * attributes — a wallet top-up's amount, for instance. Without it the generic
   * panel renders the module's field list, which for such a dialog is the wrong
   * set entirely (and, where the module declares none, an empty form that issues
   * a write with nothing filled in).
   */
  fields?: AdminField[];
  /** The contract action issued on confirm. */
  action?: AdminActionName;
}

/** Every mutation the generic panel can issue, mapped to its contract action. */
export type AdminActionName =
  | 'SAVE_ADMIN_RECORD'
  | 'DELETE_ADMIN_RECORD'
  | 'ADMIN_DECIDE'
  | 'SAVE_ADMIN_ROLE'
  | 'ASSIGN_ROLE'
  | 'UNASSIGN_ROLE'
  | 'ADMIN_SET_STATUS'
  | 'RESEND_INVITATION'
  | 'IMPORT_STAFF'
  | 'IMPORT_STUDENTS'
  | 'CONFIRM_IMPORT'
  | 'SAVE_ATTENDANCE_SHEET'
  | 'SAVE_ATTENDANCE_MARKS'
  | 'SAVE_UPLOAD_WINDOW'
  | 'SET_UPLOAD_WINDOW_STATUS'
  | 'DECIDE_RESULT'
  | 'SAVE_GRADING_SETTINGS'
  | 'ADJUST_WALLET'
  | 'SET_ORDER_STATUS'
  | 'RECORD_FEE_PAYMENT'
  | 'SAVE_GENERAL_SETTINGS'
  | 'SAVE_SYSTEM_CONFIGURATION'
  | 'SAVE_INVENTORY_SETTINGS'
  | 'SAVE_FEATURE_TOGGLE'
  | 'CREATE_BACKUP'
  | 'SAVE_STOCK_MOVEMENT';

export type AdminRecord = Record<string, unknown> & { id: string };

export interface AdminModule {
  /** Rail id. Must match the `id` in `lib/nav.ts` ADMIN_GROUPS. */
  id: string;
  /** The live app's own page title. */
  title: string;
  /** The live app's own one-line description. */
  description: string;
  /** The registry resource key — also the contract's `resource` field. */
  resource: string;
  columns: AdminColumn[];
  filters?: AdminFilter[];
  /** The placeholder on the search box, verbatim where the live page has one. */
  searchPlaceholder?: string;
  /** Tab strip over the list, e.g. `/leave`'s All/Pending/Approved/Rejected. */
  tabs?: Array<{ key: string; label: string }>;
  /** The field the tabs filter on; absent means the tabs are presentational. */
  tabField?: string;
  /** Field list for the create/edit dialog. */
  fields?: AdminField[];
  /** Row action menu. Empty means the row is not clickable. */
  rowActions?: Array<{
    label: string;
    dialog: AdminDialog;
    permission?: string;
  }>;
  /** Buttons in the toolbar, right of the search box. */
  toolbar?: Array<{ label: string; dialog?: AdminDialog; permission?: string }>;
  /** Extra pages the module owns, in the live app's own order. */
  pages?: Array<{ id: string; label: string; description: string; resource: string }>;
  /** Read permission; the rail and the panel both read it. */
  permission: string;
  /** Write permission for the create/edit dialog. */
  writePermission?: string;
  /** Delete permission. Absent means the module cannot delete. */
  deletePermission?: string;
  /** A bespoke component id, when this module is not a table-and-a-form. */
  customPanel?: string;
  /** Whether the generic panel should offer CSV export, and the column set. */
  exportable?: boolean;
}

/**
 * The wallet adjust dialog's own fields, verbatim from the deployed
 * `wallet-adjust-dialog.tsx`.
 *
 * WHY THEY ARE DECLARED HERE AND NOT ON THE MODULE
 * -----------------------------------------------
 * The module's `fields` are the wallet's own attributes, and an adjustment is not
 * one: the amount and the narration belong to the operator's action, not to the
 * student. Declaring them as module fields would have rendered them on every
 * create or edit of a wallet, which the origin does not offer at all — the origin
 * has no "edit wallet" form, only this adjustment.
 *
 * The origin's copy is kept exactly, because these are the strings a bursary
 * officer reads under time pressure:
 *   "Amount (NGN)"   placeholder "e.g. 5000"
 *   "Narration (optional)"
 *   "Amount must be greater than zero"
 */
export const WALLET_ADJUST_FIELDS: AdminField[] = [
  {
    key: 'amount',
    label: 'Amount (NGN)',
    type: 'number',
    required: true,
    positive: true,
    placeholder: 'e.g. 5000',
  },
  {
    key: 'note',
    label: 'Narration (optional)',
    type: 'text',
    placeholder: 'Cash received at Bursary',
  },
];

/** The deduction's kind selector, shown only when deducting. */
export const WALLET_DEDUCT_KIND: AdminField = {
  key: 'deductKind',
  label: 'Type',
  type: 'select',
  options: [
    { value: 'SPEND', label: 'Spend (expense)' },
    { value: 'WITHDRAW', label: 'Cash withdrawal' },
  ],
};

/* ── the shared option lists ───────────────────────────────────────────── */

export const STATUS_OPTIONS: AdminFieldOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'invited', label: 'Invited' },
  { value: 'suspended', label: 'Suspended' },
];

export const CATEGORY_OPTIONS: AdminFieldOption[] = [
  { value: 'DAY', label: 'Day' },
  { value: 'BOARDING', label: 'Boarding' },
];

export const CONDITION_OPTIONS: AdminFieldOption[] = [
  { value: 'NEW', label: 'New' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'POOR', label: 'Poor' },
];

export const ACADEMIC_SESSION_OPTIONS: AdminFieldOption[] = [
  { value: '2026/2027', label: '2026/2027' },
  { value: '2025/2026', label: '2025/2026' },
];

export const TERM_OPTIONS: AdminFieldOption[] = [
  { value: 'First', label: 'First Term' },
  { value: 'Second', label: 'Second Term' },
  { value: 'Third', label: 'Third Term' },
];

export const PRIORITY_OPTIONS: AdminFieldOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

/* ── the modules ───────────────────────────────────────────────────────── */

/**
 * The 33 roles, in the order `/roles` lists them, with the description the
 * live table shows. `users` and `permissions` are the two live counts.
 *
 * Seeded rather than empty on purpose: the live `/permissions` page is a
 * matrix of roles against permissions, and a matrix of nothing is not a page.
 * These are the live values read on 2026-10-07 and they are what make the
 * role/permission surfaces reviewable without first creating 33 roles.
 */
export const SEED_ROLES: PortalRole[] = [
  { id: 'R01', name: 'Vice Principal', description: 'School Vice Principal', users: 0, permissions: 91 },
  {
    id: 'R02',
    name: 'Teacher & Parent',
    description: 'This is for a staff of the school who has a ward or children in the school',
    users: 1,
    permissions: 28,
  },
  { id: 'R03', name: 'Counsellor Team', description: 'Guidance & Counsellor', users: 3, permissions: 27 },
  { id: 'R04', name: 'HR Officer', description: 'Human Resources', users: 1, permissions: 46 },
  { id: 'R05', name: 'Accountant', description: 'Accounts and Finance', users: 0, permissions: 10 },
  { id: 'R06', name: 'Bursary', description: 'Bursary and finance', users: 2, permissions: 18 },
  { id: 'R07', name: 'Clinicals', description: 'School clinic staff', users: 5, permissions: 14 },
  { id: 'R08', name: 'House Parent', description: 'Boarding house parent', users: 5, permissions: 23 },
  { id: 'R09', name: 'ICT', description: 'ICT support', users: 2, permissions: 137 },
  { id: 'R10', name: 'Inventory/Stock', description: 'Inventory and stock management', users: 2, permissions: 13 },
  { id: 'R11', name: 'Kitchen', description: 'Kitchen staff', users: 2, permissions: 0 },
  { id: 'R12', name: 'Librarian', description: 'Library staff', users: 0, permissions: 0 },
  {
    id: 'R13',
    name: 'College Administrator',
    description: 'The College Administrator has access to all the system features & functionalities',
    users: 0,
    permissions: 132,
  },
  {
    id: 'R14',
    name: 'Assistant College Administrator',
    description: 'Assists the College Administrator',
    users: 3,
    permissions: 137,
  },
  { id: 'R15', name: 'Head Teacher', description: 'School Principal', users: 1, permissions: 50 },
  { id: 'R16', name: 'Sectional Head (Senior)', description: 'School Vice Principal', users: 2, permissions: 47 },
  { id: 'R17', name: 'Sectional Head (Junior)', description: 'School Vice Principal', users: 2, permissions: 40 },
  { id: 'R18', name: 'Management', description: 'Management staff', users: 0, permissions: 0 },
  {
    id: 'R19',
    name: 'Facility & Maintenance',
    description: 'Maintenance of school properties and facilities',
    users: 1,
    permissions: 17,
  },
  { id: 'R20', name: 'Parent', description: 'Parent/Guardian', users: 129, permissions: 21 },
  { id: 'R21', name: 'Sanitation', description: 'Sanitation staff', users: 10, permissions: 0 },
  { id: 'R22', name: 'Secretary', description: 'Secretarial staff', users: 4, permissions: 34 },
  { id: 'R23', name: 'Staff', description: 'General staff', users: 0, permissions: 15 },
  { id: 'R24', name: 'Teacher', description: 'Teaching Staff', users: 107, permissions: 55 },
  { id: 'R25', name: 'Store/Sales Staff', description: 'Store and sales management', users: 0, permissions: 6 },
  {
    id: 'R26',
    name: 'Special Lesson Formator',
    description: 'This role is in charge of coordinating all special lesson activities',
    users: 1,
    permissions: 17,
  },
  { id: 'R27', name: 'Asst. Admin Sec.', description: '', users: 1, permissions: 16 },
  { id: 'R28', name: 'Super Admin', description: 'Has all system permissions', users: 4, permissions: 154 },
  { id: 'R29', name: 'Admin', description: 'General administration', users: 0, permissions: 113 },
  { id: 'R30', name: 'Administrator', description: 'School administrator', users: 1, permissions: 115 },
  { id: 'R31', name: 'Assistant Admin', description: 'Assists general administration', users: 0, permissions: 3 },
  {
    id: 'R32',
    name: 'Assistant Administrator',
    description: 'Assists school administrator',
    users: 0,
    permissions: 3,
  },
  { id: 'R33', name: 'Principal', description: 'School Principal', users: 0, permissions: 91 },
];

/**
 * The permission catalogue, grouped by module exactly as `/roles/new` groups
 * it. The keys are the live app's own `module.action` strings so a code can be
 * matched one-for-one against the deployed source; the labels are the live
 * dialog's own wording.
 */
export interface SeedPermission {
  key: string;
  label: string;
}

export const SEED_PERMISSION_MODULES: ReadonlyArray<{ module: string; permissions: SeedPermission[] }> = [
  {
    module: 'Counselling',
    permissions: [
      { key: 'counselling.cases.manage', label: 'Update counselling cases (status, assignment)' },
      { key: 'counselling.committees.view', label: 'View counselling committees' },
      { key: 'counselling.committees.manage', label: 'Create and manage counselling committees' },
      { key: 'counselling.reports.view', label: 'View counselling reports' },
      {
        key: 'counselling.reports.manage',
        label: 'Create, edit, delete and share counselling reports',
      },
      { key: 'counselling.read', label: 'Access the guidance and counselling module' },
      { key: 'counselling.cases.book', label: 'Book a counselling session / create a referral' },
      { key: 'counselling.cases.view', label: 'View counselling cases and reports' },
    ],
  },
  {
    module: 'Users',
    permissions: [
      { key: 'users.read', label: 'Read user' },
      { key: 'users.update', label: 'Update user' },
      { key: 'users.delete', label: 'Delete user' },
      { key: 'users.create', label: 'Create user' },
    ],
  },
  {
    module: 'Roles',
    permissions: [
      { key: 'roles.create', label: 'Create role' },
      { key: 'roles.read', label: 'Read role' },
      { key: 'roles.update', label: 'Update role' },
      { key: 'roles.delete', label: 'Delete role' },
    ],
  },
  {
    module: 'Permissions',
    permissions: [
      { key: 'permissions.read', label: 'Read permission' },
      { key: 'permissions.update', label: 'Update permission' },
      { key: 'permissions.delete', label: 'Delete permission' },
      { key: 'permissions.create', label: 'Create permission' },
    ],
  },
  {
    module: 'Notifications',
    permissions: [{ key: 'notifications.read', label: 'Read notifications' }],
  },
  { module: 'Audit log', permissions: [{ key: 'audit_log.view', label: 'View audit logs' }] },
  {
    module: 'Attendance',
    permissions: [
      { key: 'attendance.read', label: 'Read attendance' },
      { key: 'attendance.manage', label: 'Add attendance weeks and registers' },
      { key: 'attendance.mark', label: 'Mark attendance' },
      { key: 'attendance.delete', label: 'Delete attendance weeks' },
    ],
  },
  {
    module: 'Academic',
    permissions: [
      { key: 'academic.sessions.delete', label: 'Delete academic session' },
      { key: 'academic.read', label: 'View academic settings' },
      { key: 'academic.manage', label: 'Create, update and delete classes' },
      { key: 'academic.manage', label: 'Create, update and delete sections' },
      { key: 'academic.sessions.create', label: 'Create academic session' },
      { key: 'academic.sessions.update', label: 'Update academic session' },
      { key: 'academic.subjects.manage', label: 'Create, update and delete subjects' },
      { key: 'academic.calendar.manage', label: 'Create, update and delete academic calendar events' },
      { key: 'academic.timetables.manage', label: 'Create, update and delete timetables' },
      { key: 'academic.assignments.manage', label: 'Create, update and delete assignments' },
      { key: 'academic.routines.manage', label: 'Create, update and delete class routines' },
      { key: 'academic.classteachers.manage', label: 'Assign and remove class teachers' },
      { key: 'academic.subjectteachers.manage', label: 'Assign and remove subject teachers' },
    ],
  },
  {
    module: 'Dashboards',
    permissions: [
      { key: 'dashboard.superadmin', label: 'View the Super Admin dashboard' },
      { key: 'dashboard.admin', label: 'View the Admin dashboard' },
      { key: 'dashboard.hr', label: 'View the HR dashboard' },
    ],
  },
  {
    module: 'Communication',
    permissions: [
      { key: 'communication.notices.update', label: 'Update notices' },
      { key: 'communication.notices.delete', label: 'Delete notices' },
      { key: 'communication.events.create', label: 'Create events' },
      { key: 'communication.events.update', label: 'Update events' },
      { key: 'communication.read', label: 'View communication features' },
      { key: 'communication.notices.create', label: 'Create notices' },
      { key: 'communication.events.delete', label: 'Delete events' },
      { key: 'communication.messages.send', label: 'Send messages in conversations' },
      { key: 'communication.conversations.manage', label: 'Create and manage conversations' },
    ],
  },
  {
    module: 'Disciplinary',
    permissions: [
      { key: 'disciplinary.cases.launch', label: 'Launch a disciplinary case' },
      { key: 'disciplinary.cases.view', label: 'View disciplinary cases and reports' },
      { key: 'disciplinary.read', label: 'Access the disciplinary management module' },
      { key: 'disciplinary.cases.manage', label: 'Update disciplinary cases (status, assignment)' },
      { key: 'disciplinary.incidents.view', label: 'View incident case types' },
      { key: 'disciplinary.incidents.manage', label: 'Add, edit and delete incident case types' },
      { key: 'disciplinary.committees.view', label: 'View disciplinary committees' },
      { key: 'disciplinary.committees.manage', label: 'Create and manage disciplinary committees' },
    ],
  },
  {
    module: 'Teacher portal',
    permissions: [
      { key: 'teacher.read', label: 'View the teacher portal' },
      {
        key: 'weekly-reports.review',
        label: 'Review weekly teaching reports (H.O.D / Head Teacher comments)',
      },
      { key: 'academic.assignments.manage', label: 'Create and manage assignments for students' },
      { key: 'weekly-reports.read', label: 'View weekly reports' },
      { key: 'weekly-reports.manage', label: 'Create, update, and delete weekly reports' },
    ],
  },
  {
    module: 'Lesson planning',
    permissions: [
      { key: 'lesson-plans.review', label: 'Approve or reject lesson plans' },
      { key: 'lesson-plans.manage', label: 'Create, update, and delete lesson plans' },
      { key: 'lesson-plans.read', label: 'View lesson plans' },
      { key: 'lesson-plans.create', label: 'Create lesson plans' },
      { key: 'lesson-plans.update', label: 'Edit lesson plans' },
      { key: 'lesson-plans.delete', label: 'Delete lesson plans' },
      { key: 'lesson-plans.manageAll', label: 'View and manage all lesson plans (Admin / ICT)' },
    ],
  },
  {
    module: 'System',
    permissions: [
      { key: 'system.read', label: 'View system settings' },
      { key: 'system.settings.update', label: 'Update system settings' },
    ],
  },
  {
    module: 'Staff',
    permissions: [
      { key: 'staff.create', label: 'Create staff (legacy)' },
      { key: 'staff.add', label: 'Add staff' },
      { key: 'staff.read', label: 'Read staff' },
      { key: 'staff.update', label: 'Update staff' },
      { key: 'staff.delete', label: 'Delete staff' },
      { key: 'staff.import', label: 'Bulk import staff' },
      { key: 'staff.portal', label: 'Access the staff portal dashboard' },
    ],
  },
  {
    module: 'Students',
    permissions: [
      { key: 'students.create', label: 'Create students (legacy)' },
      { key: 'students.add', label: 'Add student' },
      { key: 'students.read', label: 'Read student' },
      { key: 'students.update', label: 'Update student' },
      { key: 'students.delete', label: 'Delete student' },
      { key: 'students.import', label: 'Bulk import students' },
    ],
  },
  { module: 'Parents', permissions: [{ key: 'parents.read', label: 'Read parent' }] },
  { module: 'Authentication', permissions: [{ key: 'invitations.send', label: 'Send invitations' }] },
  {
    module: 'Departments',
    permissions: [
      { key: 'departments.read', label: 'Read departments' },
      { key: 'departments.create', label: 'Create departments' },
      { key: 'departments.update', label: 'Update departments' },
      { key: 'departments.delete', label: 'Delete departments' },
    ],
  },
  {
    module: 'Leave',
    permissions: [
      { key: 'leave.apply', label: 'Apply for leave' },
      { key: 'leave.view', label: 'View own leave history and status' },
      { key: 'leave.approve', label: 'Approve or reject leave applications' },
      { key: 'leave.manage', label: 'Manage leave types and policies' },
    ],
  },
  {
    module: 'Designations',
    permissions: [
      { key: 'designations.read', label: 'Read designations' },
      { key: 'designations.create', label: 'Create designations' },
      { key: 'designations.update', label: 'Update designations' },
      { key: 'designations.delete', label: 'Delete designations' },
    ],
  },
  {
    module: 'HR',
    permissions: [
      { key: 'queries.issued', label: 'View queries issued to you' },
      { key: 'queries.issue', label: 'Issue queries to staff' },
      { key: 'queries.resolve', label: 'Resolve or close queries' },
      { key: 'queries.view', label: 'List and view HR queries' },
    ],
  },
  {
    module: 'Categories',
    permissions: [
      { key: 'categories.manage', label: 'Manage offence and award categories' },
      { key: 'categories.view', label: 'View offence and award categories' },
    ],
  },
  {
    module: 'Awards',
    permissions: [
      { key: 'awards.read', label: 'View awards' },
      { key: 'awards.manage', label: 'Create and delete awards' },
    ],
  },
  {
    module: 'Inventory',
    permissions: [
      { key: 'inventory.sales.release', label: 'Confirm payments and release stock' },
      { key: 'inventory.clinic.read', label: 'View clinic stock' },
      { key: 'inventory.categories.manage', label: 'Manage item categories' },
      { key: 'inventory.stock.read', label: 'View stock list' },
      { key: 'inventory.stock.manage', label: 'Create, edit, delete stock items' },
      { key: 'inventory.suppliers.read', label: 'View suppliers' },
      { key: 'inventory.suppliers.manage', label: 'Manage suppliers' },
      { key: 'inventory.clinic.manage', label: 'Manage clinic stock' },
      { key: 'inventory.assets.read', label: 'View asset register' },
      { key: 'inventory.assets.manage', label: 'Manage assets' },
      { key: 'inventory.sales.read', label: 'View sales and invoices' },
      { key: 'inventory.sales.create', label: 'Create sale requests' },
      { key: 'inventory.read', label: 'View inventory module' },
    ],
  },
  {
    module: 'Results',
    permissions: [
      { key: 'results.publish', label: 'Publish or decline results' },
      { key: 'results.view', label: 'View published results' },
      { key: 'results.committee.view', label: 'View results tagged to committee' },
      { key: 'results.window.read', label: 'View upload windows' },
      { key: 'results.committee.review', label: 'Review tagged results' },
      { key: 'results.window.manage', label: 'Create/close/extend upload windows' },
      { key: 'results.grading.manage', label: 'Configure grading scale' },
      { key: 'results.report.view', label: 'View and download report cards' },
      { key: 'results.attendance.manage', label: 'Manage attendance records for report cards' },
      { key: 'results.domain.manage', label: 'Manage affective/psychomotor ratings' },
      { key: 'results.comment.manage', label: 'Manage teacher/head teacher comments' },
      { key: 'results.upload', label: 'Upload subject results' },
      { key: 'results.upload.view', label: 'View own upload status' },
      { key: 'results.queue.read', label: 'View result queue' },
      { key: 'results.vet', label: 'Vet and authorize results' },
      { key: 'results.vet.view', label: 'View vetting status' },
    ],
  },
  {
    module: 'Store',
    permissions: [
      { key: 'store.browse', label: 'Browse the store catalogue' },
      { key: 'store.cart.manage', label: 'Manage shopping cart' },
      { key: 'store.order.place', label: 'Place orders' },
      { key: 'store.orders.read', label: 'View own orders' },
      { key: 'store.queue.read', label: 'View bursary confirmation queue' },
      { key: 'store.queue.manage', label: 'Confirm or reject store orders' },
    ],
  },
  {
    module: 'Wallet',
    permissions: [
      { key: 'wallet.view', label: 'View student wallets and transactions' },
      { key: 'wallet.fund', label: 'Fund a student wallet through the payment gateway' },
      { key: 'wallet.manage', label: 'Process wallet top-ups, withdrawals and reports' },
    ],
  },
  {
    module: 'School fees',
    permissions: [
      { key: 'schoolfees.read', label: 'View school fees and payments' },
      { key: 'schoolfees.manage', label: 'Manage school fees, categories and payments' },
      { key: 'schoolfees.pay', label: 'Pay school fees through the payment gateway' },
    ],
  },
];

/* ── the registry ──────────────────────────────────────────────────────── */

/**
 * Every admin module, keyed by rail id. Order does not matter here — the rail
 * order lives in `lib/nav.ts` — but the keys must match the rail exactly.
 */
export const ADMIN_MODULES: Readonly<Record<string, AdminModule>> = {
  /* Users & roles */
  users: {
    id: 'users',
    title: 'Users',
    description: 'All system users with their roles, status and last login.',
    resource: 'users',
    permission: 'users.read',
    writePermission: 'users.create',
    deletePermission: 'users.delete',
    searchPlaceholder: 'Search by name or email...',
    filters: [
      { key: 'role', label: 'Role', source: 'roles', allLabel: 'All roles' },
      { key: 'status', label: 'Status', source: 'status', allLabel: 'All statuses' },
    ],
    columns: [
      { key: 'fullName', label: 'Name', render: 'avatar' },
      { key: 'roles', label: 'Role', render: 'count' },
      { key: 'status', label: 'Status', render: 'status' },
      { key: 'lastLogin', label: 'Last login', render: 'date' },
    ],
    fields: [
      { key: 'firstName', label: 'First name', type: 'text', required: true, half: true },
      { key: 'lastName', label: 'Last name', type: 'text', required: true, half: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'phone', label: 'Phone', type: 'tel', required: true },
      {
        key: 'roles',
        label: 'Roles',
        type: 'select',
        hint: 'The live form offers all 33 roles as checkboxes.',
        optionsSource: 'roles',
      },
    ],
    toolbar: [
      {
        label: 'Resend Invitation',
        permission: 'invitations.send',
        dialog: {
          kind: 'detail',
          label: 'Resend Invitations',
          title: () => 'Resend Invitations',
          message: () => 'Select the accounts to resend an invitation to.',
        },
      },
      {
        label: 'Add User',
        permission: 'users.create',
        dialog: { kind: 'create', label: 'Add User', title: () => 'Add User', action: 'SAVE_ADMIN_RECORD' },
      },
    ],
    rowActions: [
      { label: 'View details', dialog: { kind: 'detail', label: 'User details', title: (r) => String(r.fullName) } },
      { label: 'Edit', permission: 'users.update', dialog: { kind: 'edit', label: 'Edit user', title: (r) => `Edit ${r.fullName}`, action: 'SAVE_ADMIN_RECORD' } },
      { label: 'Deactivate', permission: 'users.update', dialog: { kind: 'confirm', label: 'Deactivate user', title: (r) => `Deactivate ${r.fullName}?`, message: (r) => `${r.email} will no longer be able to sign in.`, confirmLabel: 'Deactivate', action: 'ADMIN_SET_STATUS' } },
      { label: 'Suspend', permission: 'users.update', dialog: { kind: 'confirm', label: 'Suspend user', title: (r) => `Suspend ${r.fullName}?`, message: () => 'A suspended account is blocked from signing in until it is reinstated.', confirmLabel: 'Suspend', danger: true, action: 'ADMIN_SET_STATUS' } },
      { label: 'Delete', permission: 'users.delete', dialog: { kind: 'confirm', label: 'Delete user', title: (r) => `Delete ${r.fullName}?`, message: () => 'This removes the account. It cannot be undone.', confirmLabel: 'Delete', danger: true, action: 'DELETE_ADMIN_RECORD' } },
    ],
  },

  roles: {
    id: 'roles',
    title: 'Roles',
    description: 'Roles define what users can do in the system.',
    resource: 'roles',
    permission: 'roles.read',
    writePermission: 'roles.create',
    deletePermission: 'roles.delete',
    customPanel: 'roles',
    columns: [
      { key: 'name', label: 'Role', render: 'avatar' },
      { key: 'users', label: 'Users', numeric: true },
      { key: 'permissions', label: 'Permissions', numeric: true },
    ],
    toolbar: [
      { label: 'Assign role', permission: 'roles.update', dialog: { kind: 'detail', label: 'Assign role', title: () => 'Assign role' } },
      { label: 'Unassign role', permission: 'roles.update', dialog: { kind: 'detail', label: 'Unassign role', title: () => 'Unassign role' } },
      { label: 'Add Role', permission: 'roles.create', dialog: { kind: 'create', label: 'Add Role', title: () => 'Add Role', action: 'SAVE_ADMIN_ROLE' } },
    ],
  },

  permissions: {
    id: 'permissions',
    title: 'Permissions',
    description: 'Grant access to features by role or by user.',
    resource: 'permissions',
    permission: 'permissions.read',
    writePermission: 'permissions.update',
    customPanel: 'permissions',
    columns: [],
    tabs: [
      { key: 'role', label: 'View by role' },
      { key: 'user', label: 'View all users' },
    ],
  },

  /* Staff & HR */
  staff: {
    id: 'staff',
    title: 'Staff List',
    description: 'All staff members with their departments, designations and status.',
    resource: 'staff',
    permission: 'staff.read',
    writePermission: 'staff.add',
    deletePermission: 'staff.delete',
    exportable: true,
    searchPlaceholder: 'Search by name, email or staff no...',
    filters: [
      { key: 'departmentId', label: 'Department', source: 'departmentName', allLabel: 'All departments' },
      { key: 'designationId', label: 'Designation', source: 'designationName', allLabel: 'All designations' },
    ],
    columns: [
      { key: 'fullName', label: 'Employee', render: 'avatar' },
      { key: 'roles', label: 'Roles', render: 'count' },
      { key: 'departmentName', label: 'Department' },
      { key: 'designationName', label: 'Designation' },
      { key: 'status', label: 'Status', render: 'status' },
    ],
    fields: [
      { key: 'staffNo', label: 'Staff number', type: 'text', required: true, half: true },
      { key: 'phone', label: 'Mobile number', type: 'tel', required: true, half: true },
      { key: 'firstName', label: 'First name', type: 'text', required: true, half: true },
      { key: 'lastName', label: 'Last name', type: 'text', required: true, half: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'roles', label: 'Roles', type: 'select', hint: 'The live form offers all 33 roles as checkboxes.', optionsSource: 'roles' },
      { key: 'gender', label: 'Gender', type: 'select', half: true, options: [{ value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' }] },
      { key: 'dateOfBirth', label: 'Date of birth', type: 'date', half: true },
      { key: 'currentAddress', label: 'Current address', type: 'text' },
    ],
    toolbar: [
      { label: 'Export', permission: 'staff.read' },
      { label: 'Import', permission: 'staff.import', dialog: { kind: 'detail', label: 'Import Staff', title: () => 'Import Staff' } },
      { label: 'Add Staff', permission: 'staff.add', dialog: { kind: 'create', label: 'Add Staff', title: () => 'Add Staff', action: 'SAVE_ADMIN_RECORD' } },
    ],
    rowActions: [
      { label: 'View profile', dialog: { kind: 'detail', label: 'Staff profile', title: (r) => String(r.fullName) } },
      { label: 'Edit', permission: 'staff.update', dialog: { kind: 'edit', label: 'Edit staff', title: (r) => `Edit ${r.fullName}`, action: 'SAVE_ADMIN_RECORD' } },
      { label: 'Resend invitation', permission: 'invitations.send', dialog: { kind: 'confirm', label: 'Resend invitation', title: (r) => `Resend an invitation to ${r.email}?`, message: () => 'The account keeps its roles and its password is not changed.', confirmLabel: 'Resend', action: 'RESEND_INVITATION' } },
      { label: 'Delete', permission: 'staff.delete', dialog: { kind: 'confirm', label: 'Delete staff', title: (r) => `Delete ${r.fullName}?`, message: () => 'This removes the staff record. It cannot be undone.', confirmLabel: 'Delete', danger: true, action: 'DELETE_ADMIN_RECORD' } },
    ],
  },

  departments: {
    id: 'departments',
    title: 'Departments',
    description: 'Organisational departments.',
    resource: 'departments',
    permission: 'departments.read',
    writePermission: 'departments.create',
    deletePermission: 'departments.delete',
    customPanel: 'department-cards',
    searchPlaceholder: 'Search departments...',
    columns: [
      { key: 'name', label: 'Department' },
      { key: 'headName', label: 'Head of department' },
      { key: 'staffCount', label: 'Staff members', numeric: true },
    ],
    fields: [
      { key: 'name', label: 'Department name', type: 'text', required: true },
      { key: 'code', label: 'Department code', type: 'text', required: true },
      { key: 'headName', label: 'Head of department', type: 'select', hint: 'The live picker lists staff.', optionsSource: 'staff' },
    ],
    toolbar: [
      { label: 'Add Department', permission: 'departments.create', dialog: { kind: 'create', label: 'Add Department', title: () => 'Add Department', action: 'SAVE_ADMIN_RECORD' } },
    ],
  },

  designations: {
    id: 'designations',
    title: 'Designations',
    description: 'Job titles and positions within the school.',
    resource: 'designations',
    permission: 'designations.read',
    writePermission: 'designations.create',
    deletePermission: 'designations.delete',
    customPanel: 'designation-cards',
    searchPlaceholder: 'Search designations...',
    columns: [
      { key: 'name', label: 'Designation' },
      { key: 'description', label: 'Description' },
      { key: 'staffCount', label: 'Staff members', numeric: true },
    ],
    fields: [
      { key: 'name', label: 'Designation name', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
    toolbar: [
      { label: 'Add Designation', permission: 'designations.create', dialog: { kind: 'create', label: 'Add Designation', title: () => 'Add Designation', action: 'SAVE_ADMIN_RECORD' } },
    ],
  },

  'staff-attendance': {
    id: 'staff-attendance',
    title: 'Staff Attendance',
    description: 'View all staff attendance sheets. Open a sheet to mark attendance.',
    resource: 'attendance-sheets',
    permission: 'attendance.read',
    writePermission: 'attendance.manage',
    customPanel: 'attendance-sheets',
    columns: [],
  },

  'staff-attendance-report': {
    id: 'staff-attendance-report',
    title: 'Staff Attendance Report',
    description: 'Analyse staff attendance across departments and weeks.',
    resource: 'attendance-report',
    permission: 'attendance.read',
    customPanel: 'attendance-report',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'identifier', label: 'Identifier', render: 'code' },
      { key: 'present', label: 'Present', numeric: true },
      { key: 'absent', label: 'Absent', numeric: true },
      { key: 'unmarked', label: 'Unmarked', numeric: true },
      { key: 'rate', label: 'Rate', render: 'count' },
    ],
    filters: [{ key: 'departmentName', label: 'Department', source: 'departmentName', allLabel: 'All departments' }],
    searchPlaceholder: 'Search by name, email or department...',
    exportable: true,
  },

  leave: {
    id: 'leave',
    title: 'Leave Requests',
    description: 'Manage staff leave requests.',
    resource: 'leave',
    permission: 'leave.view',
    writePermission: 'leave.apply',
    customPanel: 'leave',
    searchPlaceholder: 'Search leave requests...',
    tabs: [
      { key: 'ALL', label: 'All' },
      { key: 'PENDING', label: 'Pending' },
      { key: 'APPROVED', label: 'Approved' },
      { key: 'REJECTED', label: 'Rejected' },
    ],
    columns: [
      { key: 'staffName', label: 'Staff' },
      { key: 'leaveType', label: 'Leave Type' },
      { key: 'startDate', label: 'Dates' },
      { key: 'days', label: 'Days', numeric: true },
      { key: 'status', label: 'Status', render: 'status' },
    ],
    fields: [
      { key: 'staffName', label: 'Staff member', type: 'select', required: true, optionsSource: 'staff' },
      { key: 'leaveType', label: 'Leave type', type: 'text', required: true },
      { key: 'startDate', label: 'Start date', type: 'date', required: true, half: true },
      { key: 'endDate', label: 'End date', type: 'date', required: true, half: true, hint: 'The live form computes the day count from these two.' },
      { key: 'reason', label: 'Reason', type: 'textarea', required: true },
    ],
    toolbar: [
      { label: 'Apply for Leave', permission: 'leave.apply', dialog: { kind: 'create', label: 'Apply for Leave', title: () => 'Apply for Leave', action: 'SAVE_ADMIN_RECORD' } },
    ],
    rowActions: [
      { label: 'Approve', permission: 'leave.approve', dialog: { kind: 'confirm', label: 'Approve leave', title: () => 'Approve this leave request?', confirmLabel: 'Approve', action: 'ADMIN_DECIDE' } },
      { label: 'Reject', permission: 'leave.approve', dialog: { kind: 'confirm', label: 'Reject leave', title: () => 'Reject this leave request?', confirmLabel: 'Reject', danger: true, action: 'ADMIN_DECIDE' } },
    ],
  },

  'leave-approvals': {
    id: 'leave-approvals',
    title: 'Leave Approvals',
    description: 'Approve or reject leave requests.',
    resource: 'leave',
    permission: 'leave.approve',
    customPanel: 'leave-approvals',
    columns: [],
    pages: [
      { id: 'pending', label: 'Pending', description: 'Awaiting a decision.', resource: 'leave-pending' },
      { id: 'decided', label: 'Decided', description: 'Already approved or rejected.', resource: 'leave-decided' },
    ],
  },

  'hr-queries': {
    id: 'hr-queries',
    title: 'HR Queries',
    description: 'Questions and requests from staff.',
    resource: 'hr-queries',
    permission: 'queries.view',
    writePermission: 'queries.issue',
    customPanel: 'hr-queries',
    searchPlaceholder: 'Search queries...',
    tabs: [
      { key: 'ALL', label: 'All' },
      { key: 'OPEN', label: 'Open' },
      { key: 'RESOLVED', label: 'Resolved' },
      { key: 'ARCHIVED', label: 'Archived' },
    ],
    columns: [
      { key: 'title', label: 'Subject' },
      { key: 'fromUser', label: 'From' },
      { key: 'toUser', label: 'To' },
      { key: 'priority', label: 'Priority', render: 'status' },
      { key: 'status', label: 'Status', render: 'status' },
    ],
    fields: [
      { key: 'toUser', label: 'Send to', type: 'select', required: true, optionsSource: 'staff' },
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'offence', label: 'Offence', type: 'select', required: true, optionsSource: 'award-types' },
      { key: 'priority', label: 'Priority', type: 'select', required: true, options: PRIORITY_OPTIONS },
      { key: 'description', label: 'Description', type: 'textarea', required: true },
    ],
    toolbar: [
      { label: 'New Query', permission: 'queries.issue', dialog: { kind: 'create', label: 'New HR Query', title: () => 'New HR Query', action: 'SAVE_ADMIN_RECORD' } },
    ],
    rowActions: [
      { label: 'View', dialog: { kind: 'detail', label: 'Query', title: (r) => String(r.title) } },
      { label: 'Resolve', permission: 'queries.resolve', dialog: { kind: 'edit', label: 'Resolve query', title: (r) => `Resolve: ${r.title}`, action: 'ADMIN_DECIDE' } },
    ],
  },

  awards: {
    id: 'awards',
    title: 'Awards',
    description: 'Recognise an outstanding staff member or department.',
    resource: 'awards',
    permission: 'awards.read',
    writePermission: 'awards.manage',
    deletePermission: 'awards.manage',
    customPanel: 'awards',
    columns: [
      { key: 'awardType', label: 'Award type' },
      { key: 'recipientName', label: 'Recipient', render: 'avatar' },
      { key: 'period', label: 'Period' },
      { key: 'createdAt', label: 'Issued', render: 'date' },
    ],
    fields: [
      { key: 'awardType', label: 'Award type', type: 'select', required: true, optionsSource: 'award-types' },
      { key: 'recipientName', label: 'Recipient', type: 'select', required: true, optionsSource: 'staff' },
      { key: 'period', label: 'Period', type: 'text', required: true, hint: 'The live form offers First Term / Second Term / Third Term.' },
      { key: 'reason', label: 'Reason', type: 'textarea', required: true },
    ],
    toolbar: [
      { label: 'Give Award', permission: 'awards.manage', dialog: { kind: 'create', label: 'Give Award', title: () => 'Give Award', action: 'SAVE_ADMIN_RECORD' } },
    ],
  },

  /* Students & parents */
  students: {
    id: 'students',
    title: 'Student List',
    description: 'All enrolled students with class, arm and status.',
    resource: 'students',
    permission: 'students.read',
    writePermission: 'students.add',
    deletePermission: 'students.delete',
    customPanel: 'students',
    searchPlaceholder: 'Search by name or admission number...',
    filters: [{ key: 'category', label: 'Category', source: 'category', allLabel: 'All categories' }],
    columns: [
      { key: 'fullName', label: 'Student', render: 'avatar' },
      { key: 'className', label: 'Class' },
      { key: 'armName', label: 'Arm' },
      { key: 'academicSession', label: 'Academic Session' },
      { key: 'category', label: 'Category' },
    ],
    fields: [
      { key: 'admissionNo', label: 'Admission Number', type: 'text', half: true, hint: 'Left blank, the portal generates one.' },
      { key: 'academicSession', label: 'Academic Session', type: 'select', half: true, options: ACADEMIC_SESSION_OPTIONS },
      { key: 'className', label: 'Class', type: 'select', required: true, optionsSource: 'classes' },
      { key: 'armName', label: 'Arm', type: 'select', required: true, optionsSource: 'arms' },
      { key: 'firstName', label: 'First name', type: 'text', required: true, half: true },
      { key: 'lastName', label: 'Last name', type: 'text', required: true, half: true },
      { key: 'email', label: 'Email Address', type: 'email', half: true },
      { key: 'phone', label: 'Phone Number', type: 'tel', half: true },
      { key: 'category', label: 'Student Category', type: 'select', required: true, options: CATEGORY_OPTIONS },
      { key: 'dateOfBirth', label: 'Date of Birth', type: 'date', half: true },
      { key: 'guardianFirstName', label: 'Guardian First name', type: 'text', required: true, half: true },
      { key: 'guardianLastName', label: 'Guardian Last name', type: 'text', required: true, half: true },
      { key: 'guardianEmail', label: 'Guardian Email', type: 'email', required: true, half: true },
      { key: 'guardianPhone', label: 'Guardian Phone', type: 'tel', required: true, half: true },
      { key: 'guardianRelationship', label: 'Relationship', type: 'select', half: true, options: [{ value: 'FATHER', label: 'Father' }, { value: 'MOTHER', label: 'Mother' }, { value: 'OTHER', label: 'Other' }] },
      { key: 'guardianOccupation', label: 'Guardian Occupation', type: 'text' },
      { key: 'guardianAddress', label: 'Guardian Address', type: 'text', required: true },
    ],
    toolbar: [
      { label: 'Import', permission: 'students.import', dialog: { kind: 'detail', label: 'Import Students', title: () => 'Import Students' } },
      { label: 'Add Student & Parent', permission: 'students.add', dialog: { kind: 'create', label: 'Add Student & Parent', title: () => 'Add Student & Parent', action: 'SAVE_ADMIN_RECORD' } },
    ],
    rowActions: [
      { label: 'View details', dialog: { kind: 'detail', label: 'Student details', title: (r) => String(r.fullName) } },
      { label: 'Edit', permission: 'students.update', dialog: { kind: 'edit', label: 'Edit student', title: (r) => `Edit ${r.fullName}`, action: 'SAVE_ADMIN_RECORD' } },
      { label: 'Delete', permission: 'students.delete', dialog: { kind: 'confirm', label: 'Delete student', title: (r) => `Delete ${r.fullName}?`, message: () => 'This removes the student record. It cannot be undone.', confirmLabel: 'Delete', danger: true, action: 'DELETE_ADMIN_RECORD' } },
    ],
  },

  'student-attendance': {
    id: 'student-attendance',
    title: 'Student Attendance',
    description: 'View all class attendance sheets. Open a sheet to add weeks and mark attendance.',
    resource: 'attendance-sheets',
    permission: 'attendance.read',
    writePermission: 'attendance.manage',
    customPanel: 'attendance-sheets',
    columns: [],
  },

  'student-attendance-report': {
    id: 'student-attendance-report',
    title: 'Student Attendance Report',
    description: 'Analyse student attendance per class across weeks.',
    resource: 'student-attendance-report',
    permission: 'attendance.read',
    customPanel: 'attendance-report',
    searchPlaceholder: 'Search by name or admission number...',
    filters: [{ key: 'className', label: 'Class', source: 'className', allLabel: 'All classes' }],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'identifier', label: 'Identifier', render: 'code' },
      { key: 'present', label: 'Present', numeric: true },
      { key: 'absent', label: 'Absent', numeric: true },
      { key: 'unmarked', label: 'Unmarked', numeric: true },
      { key: 'rate', label: 'Rate', render: 'count' },
    ],
    exportable: true,
  },

  parents: {
    id: 'parents',
    title: 'Parent List',
    description: 'All parents/guardians linked to the school.',
    resource: 'parents',
    permission: 'parents.read',
    writePermission: 'users.create',
    customPanel: 'parents',
    searchPlaceholder: 'Search by name or email...',
    columns: [
      { key: 'fullName', label: 'Parent', render: 'avatar' },
      { key: 'phone', label: 'Phone' },
      { key: 'children', label: 'Linked Children', render: 'count' },
      { key: 'status', label: 'Status', render: 'status' },
      { key: 'lastLogin', label: 'Last login', render: 'date' },
    ],
    fields: [
      { key: 'firstName', label: 'First name', type: 'text', required: true, half: true },
      { key: 'lastName', label: 'Last name', type: 'text', required: true, half: true },
      { key: 'email', label: 'Email', type: 'email', required: true, half: true },
      { key: 'phone', label: 'Phone', type: 'tel', required: true, half: true },
      { key: 'roles', label: 'Roles', type: 'select', hint: 'The live form offers all 33 roles as checkboxes.', optionsSource: 'roles' },
    ],
    toolbar: [
      { label: 'Add Parent', permission: 'users.create', dialog: { kind: 'create', label: 'Add Parent', title: () => 'Add Parent', action: 'SAVE_ADMIN_RECORD' } },
    ],
  },

  /* Academics */
  sessions: {
    id: 'sessions',
    title: 'Sessions',
    description: 'Academic sessions, e.g. 2025/2026.',
    resource: 'sessions',
    permission: 'academic.read',
    writePermission: 'academic.sessions.create',
    deletePermission: 'academic.sessions.delete',
    searchPlaceholder: 'Search sessions...',
    columns: [
      { key: 'name', label: 'Session' },
      { key: 'term', label: 'Term' },
      { key: 'startDate', label: 'Starts', render: 'date' },
      { key: 'endDate', label: 'Ends', render: 'date' },
      { key: 'status', label: 'Status', render: 'status' },
      { key: 'classCount', label: 'Classes', numeric: true },
    ],
    fields: [
      { key: 'name', label: 'Session name', type: 'text', required: true, hint: 'Must follow the format 2025/2026.' },
      { key: 'term', label: 'Term', type: 'select', required: true, options: TERM_OPTIONS },
      { key: 'startDate', label: 'Start date', type: 'date', half: true },
      { key: 'endDate', label: 'End date', type: 'date', half: true },
      { key: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }] },
    ],
    toolbar: [
      { label: 'Add Session', permission: 'academic.sessions.create', dialog: { kind: 'create', label: 'Add Session', title: () => 'Add Session', action: 'SAVE_ADMIN_RECORD' } },
    ],
  },

  classes: {
    id: 'classes',
    title: 'Classes',
    description: 'Manage classes and their arms.',
    resource: 'classes',
    permission: 'academic.read',
    writePermission: 'academic.manage',
    deletePermission: 'academic.manage',
    searchPlaceholder: 'Search classes...',
    columns: [
      { key: 'name', label: 'Class' },
      { key: 'arms', label: 'Arms', render: 'count' },
    ],
    fields: [
      { key: 'name', label: 'Class name', type: 'text', required: true },
      { key: 'academicSession', label: 'Academic session', type: 'select', options: ACADEMIC_SESSION_OPTIONS },
    ],
    toolbar: [
      { label: 'Add Class', permission: 'academic.manage', dialog: { kind: 'create', label: 'Add Class', title: () => 'Add Class', action: 'SAVE_ADMIN_RECORD' } },
    ],
  },

  arms: {
    id: 'arms',
    title: 'Arms',
    description: 'Arms within each class.',
    resource: 'arms',
    permission: 'academic.read',
    writePermission: 'academic.manage',
    deletePermission: 'academic.manage',
    customPanel: 'arms',
    filters: [{ key: 'className', label: 'Filter by class', source: 'className', allLabel: 'All classes' }],
    columns: [
      { key: 'className', label: 'Class' },
      { key: 'name', label: 'Arm' },
    ],
    fields: [
      { key: 'className', label: 'Class', type: 'select', required: true, optionsSource: 'classes' },
      { key: 'name', label: 'Arm name', type: 'text', required: true },
    ],
    toolbar: [
      { label: 'Add Arm', permission: 'academic.manage', dialog: { kind: 'create', label: 'Add Arm', title: () => 'Add Arm', action: 'SAVE_ADMIN_RECORD' } },
    ],
  },

  subjects: {
    id: 'subjects',
    title: 'Subjects',
    description: 'Subjects taught across the school.',
    resource: 'subjects',
    permission: 'academic.read',
    writePermission: 'academic.subjects.manage',
    deletePermission: 'academic.subjects.manage',
    columns: [
      { key: 'name', label: 'Subject' },
      { key: 'code', label: 'Code', render: 'code' },
      { key: 'description', label: 'Description' },
    ],
    fields: [
      { key: 'name', label: 'Subject', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', hint: 'Several live subjects carry no code.' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
    toolbar: [
      { label: 'Add Subject', permission: 'academic.subjects.manage', dialog: { kind: 'create', label: 'Add Subject', title: () => 'Add Subject', action: 'SAVE_ADMIN_RECORD' } },
    ],
    rowActions: [
      { label: 'Edit', permission: 'academic.subjects.manage', dialog: { kind: 'edit', label: 'Edit subject', title: (r) => `Edit ${r.name}`, action: 'SAVE_ADMIN_RECORD' } },
      { label: 'Delete', permission: 'academic.subjects.manage', dialog: { kind: 'confirm', label: 'Delete subject', title: (r) => `Delete ${r.name}?`, confirmLabel: 'Delete', danger: true, action: 'DELETE_ADMIN_RECORD' } },
    ],
  },

  timetables: {
    id: 'timetables',
    title: 'Timetables',
    description: 'Class timetables for each session, class and arm.',
    resource: 'timetables',
    permission: 'academic.read',
    writePermission: 'academic.timetables.manage',
    deletePermission: 'academic.timetables.manage',
    customPanel: 'timetable',
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'className', label: 'Class' },
      { key: 'armName', label: 'Arm' },
      { key: 'academicSession', label: 'Session' },
    ],
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'academicSession', label: 'Session', type: 'select', options: ACADEMIC_SESSION_OPTIONS },
      { key: 'className', label: 'Class', type: 'select', optionsSource: 'classes' },
      { key: 'armName', label: 'Arm', type: 'select', optionsSource: 'arms' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
    toolbar: [
      { label: 'Add Timetable', permission: 'academic.timetables.manage', dialog: { kind: 'create', label: 'Add Timetable', title: () => 'Add Timetable', action: 'SAVE_ADMIN_RECORD' } },
    ],
  },

  assignments: {
    id: 'assignments',
    title: 'Assignments',
    description: 'Assignments and homework given to students.',
    resource: 'assignments',
    permission: 'academic.read',
    writePermission: 'academic.assignments.manage',
    deletePermission: 'academic.assignments.manage',
    columns: [
      { key: 'title', label: 'Assignment' },
      { key: 'subjectName', label: 'Subject' },
      { key: 'className', label: 'Class' },
      { key: 'dueDate', label: 'Due date', render: 'date' },
      { key: 'teacherName', label: 'Teacher' },
    ],
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'documentName', label: 'Document', type: 'text', hint: 'The live page also offers Upload Document.' },
      { key: 'subjectName', label: 'Subject', type: 'select', required: true, optionsSource: 'subjects' },
      { key: 'className', label: 'Class', type: 'select', required: true, optionsSource: 'classes' },
      { key: 'dueDate', label: 'Due date', type: 'date', required: true },
    ],
    toolbar: [
      { label: 'Create In-App', permission: 'academic.assignments.manage', dialog: { kind: 'create', label: 'Create In-App', title: () => 'Create In-App', action: 'SAVE_ADMIN_RECORD' } },
      { label: 'Upload Document', permission: 'academic.assignments.manage', dialog: { kind: 'create', label: 'Upload Document', title: () => 'Upload Document', action: 'SAVE_ADMIN_RECORD' } },
    ],
  },

  'class-teachers': {
    id: 'class-teachers',
    title: 'Class Teachers',
    description: 'Assign a class teacher to each class and arm.',
    resource: 'class-teachers',
    permission: 'academic.read',
    writePermission: 'academic.classteachers.manage',
    deletePermission: 'academic.classteachers.manage',
    columns: [
      { key: 'className', label: 'Class' },
      { key: 'armName', label: 'Arm' },
      { key: 'teacherName', label: 'Teacher' },
      { key: 'academicSession', label: 'Session' },
    ],
    fields: [
      { key: 'className', label: 'Class', type: 'select', required: true, optionsSource: 'classes' },
      { key: 'armName', label: 'Arm', type: 'select', required: true, optionsSource: 'arms' },
      { key: 'teacherName', label: 'Teacher', type: 'select', required: true, optionsSource: 'staff' },
      { key: 'academicSession', label: 'Session', type: 'select', required: true, options: ACADEMIC_SESSION_OPTIONS },
    ],
    toolbar: [
      { label: 'Assign Class Teacher', permission: 'academic.classteachers.manage', dialog: { kind: 'create', label: 'Assign Class Teacher', title: () => 'Assign Class Teacher', action: 'SAVE_ADMIN_RECORD' } },
    ],
  },

  'subject-teachers': {
    id: 'subject-teachers',
    title: 'Subject Teachers',
    description: 'Assign a teacher to a subject for specific classes.',
    resource: 'subject-teachers',
    permission: 'academic.read',
    writePermission: 'academic.subjectteachers.manage',
    deletePermission: 'academic.subjectteachers.manage',
    columns: [
      { key: 'subjectName', label: 'Subject' },
      { key: 'teacherName', label: 'Teacher' },
      { key: 'className', label: 'Class' },
      { key: 'armName', label: 'Arm' },
    ],
    fields: [
      { key: 'subjectName', label: 'Subject', type: 'select', required: true, optionsSource: 'subjects' },
      { key: 'teacherName', label: 'Teacher', type: 'select', required: true, optionsSource: 'staff' },
      { key: 'className', label: 'Class', type: 'select', required: true, optionsSource: 'classes' },
      { key: 'armName', label: 'Arm', type: 'select', optionsSource: 'arms' },
    ],
    toolbar: [
      { label: 'Assign Teacher', permission: 'academic.subjectteachers.manage', dialog: { kind: 'create', label: 'Assign Teacher', title: () => 'Assign Teacher', action: 'SAVE_ADMIN_RECORD' } },
    ],
  },

  /* Inventory */
  stock: {
    id: 'stock',
    title: 'Stock Items',
    description: 'Manage store stock levels and pricing.',
    resource: 'stock',
    permission: 'inventory.stock.read',
    writePermission: 'inventory.stock.manage',
    deletePermission: 'inventory.stock.manage',
    searchPlaceholder: 'Search by name, SKU or category...',
    filters: [
      { key: 'status', label: 'Status', source: 'status', allLabel: 'All items' },
      { key: 'categoryName', label: 'Category', source: 'categoryName', allLabel: 'All categories' },
    ],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'sku', label: 'SKU', render: 'code' },
      { key: 'categoryName', label: 'Category' },
      { key: 'unitPrice', label: 'Unit Price', render: 'money', numeric: true },
      { key: 'inStock', label: 'In Stock', numeric: true },
      { key: 'reserved', label: 'Reserved', numeric: true },
      { key: 'available', label: 'Available', numeric: true },
      { key: 'status', label: 'Status', render: 'status' },
    ],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Junior School Shirt' },
      { key: 'sku', label: 'SKU', type: 'text', required: true, placeholder: 'e.g. UNI-JSS-SHIRT' },
      { key: 'categoryName', label: 'Category', type: 'select', required: true, optionsSource: 'inventory-categories' },
      { key: 'unitPrice', label: 'Unit price', type: 'number', half: true },
      { key: 'inStock', label: 'In stock', type: 'number', half: true },
      { key: 'reserved', label: 'Reserved', type: 'number', half: true },
      { key: 'reorderLevel', label: 'Reorder level', type: 'number', half: true, hint: 'Zero falls back to the global default.' },
    ],
    toolbar: [
      { label: 'Create Stock Item', permission: 'inventory.stock.manage', dialog: { kind: 'create', label: 'Create Stock Item', title: () => 'Create Stock Item', action: 'SAVE_ADMIN_RECORD' } },
      { label: 'Restock', permission: 'inventory.stock.manage', dialog: { kind: 'edit', label: 'Restock', title: () => 'Restock', action: 'SAVE_STOCK_MOVEMENT' } },
    ],
  },

  'inventory-categories': {
    id: 'inventory-categories',
    title: 'Item Categories',
    description: 'Organize stock items into categories.',
    resource: 'inventory-categories',
    permission: 'inventory.read',
    writePermission: 'inventory.categories.manage',
    deletePermission: 'inventory.categories.manage',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'scope', label: 'Scope' },
      { key: 'description', label: 'Description' },
      { key: 'linkedItems', label: 'Linked Items', numeric: true },
      { key: 'createdAt', label: 'Created', render: 'date' },
    ],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Medical Supplies' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What belongs in this category?' },
    ],
    toolbar: [
      { label: 'Create Category', permission: 'inventory.categories.manage', dialog: { kind: 'create', label: 'Create Category', title: () => 'Create Category', action: 'SAVE_ADMIN_RECORD' } },
    ],
    rowActions: [
      { label: 'Edit', permission: 'inventory.categories.manage', dialog: { kind: 'edit', label: 'Edit category', title: (r) => `Edit ${r.name}`, action: 'SAVE_ADMIN_RECORD' } },
      { label: 'Delete', permission: 'inventory.categories.manage', dialog: { kind: 'confirm', label: 'Delete category', title: (r) => `Delete ${r.name}?`, confirmLabel: 'Delete', danger: true, action: 'DELETE_ADMIN_RECORD' } },
    ],
  },

  suppliers: {
    id: 'suppliers',
    title: 'Suppliers',
    description: 'Manage store suppliers.',
    resource: 'suppliers',
    permission: 'inventory.suppliers.read',
    writePermission: 'inventory.suppliers.manage',
    deletePermission: 'inventory.suppliers.manage',
    searchPlaceholder: 'Search suppliers...',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'contact', label: 'Contact' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
    ],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. MedPlus Distribution Ltd' },
      { key: 'contact', label: 'Contact', type: 'text', placeholder: 'e.g. Ada Obi', half: true },
      { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+234...', half: true },
      { key: 'email', label: 'Email', type: 'email', placeholder: 'sales@supplier.com', half: true },
      { key: 'address', label: 'Address', type: 'text', placeholder: 'Street, city, state' },
      { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Payment terms, delivery notes...' },
    ],
    toolbar: [
      { label: 'Create Supplier', permission: 'inventory.suppliers.manage', dialog: { kind: 'create', label: 'Create Supplier', title: () => 'Create Supplier', action: 'SAVE_ADMIN_RECORD' } },
    ],
    rowActions: [
      { label: 'Edit', permission: 'inventory.suppliers.manage', dialog: { kind: 'edit', label: 'Edit supplier', title: (r) => `Edit ${r.name}`, action: 'SAVE_ADMIN_RECORD' } },
      { label: 'Delete', permission: 'inventory.suppliers.manage', dialog: { kind: 'confirm', label: 'Delete supplier', title: (r) => `Delete ${r.name}?`, confirmLabel: 'Delete', danger: true, action: 'DELETE_ADMIN_RECORD' } },
    ],
  },

  assets: {
    id: 'assets',
    title: 'School Assets',
    description: 'Track and manage school assets.',
    resource: 'assets',
    permission: 'inventory.assets.read',
    writePermission: 'inventory.assets.manage',
    deletePermission: 'inventory.assets.manage',
    searchPlaceholder: 'Search assets...',
    filters: [{ key: 'condition', label: 'Condition', source: 'condition', allLabel: 'All Conditions' }],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'category', label: 'Category' },
      { key: 'quantity', label: 'Qty', numeric: true },
      { key: 'location', label: 'Location' },
      { key: 'condition', label: 'Condition', render: 'status' },
      { key: 'lastAudited', label: 'Last Audited', render: 'date' },
    ],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. HP LaserJet Printer' },
      { key: 'category', label: 'Category', type: 'text', required: true, placeholder: 'e.g. Office Equipment' },
      { key: 'quantity', label: 'Quantity', type: 'number', half: true },
      { key: 'condition', label: 'Condition', type: 'select', options: CONDITION_OPTIONS },
      { key: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Admin Block, Room 12' },
      { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Serial numbers, maintenance notes...' },
    ],
    toolbar: [
      { label: 'Create Asset', permission: 'inventory.assets.manage', dialog: { kind: 'create', label: 'Create Asset', title: () => 'Create Asset', action: 'SAVE_ADMIN_RECORD' } },
    ],
    rowActions: [
      { label: 'Edit', permission: 'inventory.assets.manage', dialog: { kind: 'edit', label: 'Edit asset', title: (r) => `Edit ${r.name}`, action: 'SAVE_ADMIN_RECORD' } },
      { label: 'Delete', permission: 'inventory.assets.manage', dialog: { kind: 'confirm', label: 'Delete asset', title: (r) => `Delete ${r.name}?`, confirmLabel: 'Delete', danger: true, action: 'DELETE_ADMIN_RECORD' } },
    ],
  },

  'inventory-reports': {
    id: 'inventory-reports',
    title: 'Inventory Reports',
    description: 'A snapshot of stock, sales and assets across the school.',
    resource: 'inventory-reports',
    permission: 'inventory.stock.read',
    customPanel: 'inventory-reports',
    columns: [],
  },

  'inventory-settings': {
    id: 'inventory-settings',
    title: 'Inventory Settings',
    description: 'Configure how the system identifies and alerts on low stock.',
    resource: 'inventory-settings',
    permission: 'system.settings.update',
    writePermission: 'system.settings.update',
    customPanel: 'inventory-settings',
    columns: [],
    fields: [
      { key: 'defaultReorderLevel', label: 'Default reorder level', type: 'number', hint: 'Items with a reorder level of 0 use this value.' },
    ],
  },

  'clinic-store': {
    id: 'clinic-store',
    title: 'Clinic Stock',
    description: 'Track clinic inventory levels.',
    resource: 'clinic-stock',
    permission: 'inventory.clinic.read',
    writePermission: 'inventory.clinic.manage',
    deletePermission: 'inventory.clinic.manage',
    searchPlaceholder: 'Search by name, SKU or category...',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'sku', label: 'SKU', render: 'code' },
      { key: 'categoryName', label: 'Category' },
      { key: 'unitPrice', label: 'Unit Price', render: 'money', numeric: true },
      { key: 'available', label: 'Available', numeric: true },
      { key: 'status', label: 'Status', render: 'status' },
    ],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'sku', label: 'SKU', type: 'text', required: true },
      { key: 'unitPrice', label: 'Unit price', type: 'number' },
      { key: 'inStock', label: 'In stock', type: 'number' },
    ],
    toolbar: [
      { label: 'Create Clinic Stock', permission: 'inventory.clinic.manage', dialog: { kind: 'create', label: 'Create Clinic Stock', title: () => 'Create Clinic Stock', action: 'SAVE_ADMIN_RECORD' } },
    ],
  },

  sales: {
    id: 'sales',
    title: 'Sales',
    description: 'Store sales records and receipts.',
    resource: 'sales',
    permission: 'inventory.sales.read',
    writePermission: 'inventory.sales.create',
    deletePermission: 'inventory.sales.manage',
    customPanel: 'sales',
    columns: [
      { key: 'invoiceNo', label: 'Invoice #', render: 'code' },
      { key: 'buyerName', label: 'Buyer' },
      { key: 'total', label: 'Total Amount', render: 'money', numeric: true },
      { key: 'status', label: 'Status', render: 'status' },
      { key: 'date', label: 'Date', render: 'date' },
      { key: 'createdBy', label: 'Created By' },
    ],
    fields: [
      { key: 'buyerName', label: 'Buyer', type: 'text', placeholder: 'e.g. John Doe' },
      { key: 'buyerPhone', label: 'Phone or email', type: 'text' },
      { key: 'supplierName', label: 'Supplier', type: 'select', hint: 'The live dialog offers `No supplier` first.', optionsSource: 'suppliers' },
    ],
    toolbar: [
      { label: 'Create Sale', permission: 'inventory.sales.create', dialog: { kind: 'create', label: 'Create Sale', title: () => 'Create Sale', action: 'SAVE_ADMIN_RECORD' } },
    ],
    rowActions: [
      { label: 'View', dialog: { kind: 'detail', label: 'Sale', title: (r) => String(r.invoiceNo) } },
      { label: 'Release', permission: 'inventory.sales.release', dialog: { kind: 'confirm', label: 'Release sale', title: (r) => `Release ${r.invoiceNo}?`, confirmLabel: 'Release', action: 'ADMIN_SET_STATUS' } },
      { label: 'Cancel', permission: 'inventory.sales.manage', dialog: { kind: 'confirm', label: 'Cancel sale', title: (r) => `Cancel ${r.invoiceNo}?`, confirmLabel: 'Cancel', danger: true, action: 'ADMIN_SET_STATUS' } },
    ],
  },

  /* Store */
  store: {
    id: 'store',
    title: 'Browse Store',
    description: 'Browse and purchase items from the school store.',
    resource: 'store-items',
    permission: 'store.browse',
    writePermission: 'store.cart.manage',
    customPanel: 'store',
    searchPlaceholder: 'Search items...',
    filters: [{ key: 'categoryName', label: 'Category', source: 'categoryName', allLabel: 'All' }],
    columns: [
      { key: 'name', label: 'Item' },
      { key: 'categoryName', label: 'Category' },
      { key: 'unitPrice', label: 'Price', render: 'money', numeric: true },
      { key: 'available', label: 'Available', numeric: true },
      { key: 'status', label: 'Status', render: 'status' },
    ],
  },

  cart: {
    id: 'cart',
    title: 'Shopping Cart',
    description: 'Review the items you have added before checking out.',
    resource: 'cart',
    permission: 'store.cart.manage',
    /* Checkout is the customer's own action on their own basket, so it carries
       the same code as adding to it rather than a separate "place order" one.
       `store.order.place` was written here before checkout existed as an
       operation, and named a permission nothing declares — the button it gated
       was the one that could not have placed an order. */
    writePermission: 'store.cart.manage',
    customPanel: 'cart',
    columns: [],
  },

  orders: {
    id: 'orders',
    title: 'My Orders',
    description: 'View your order history and status.',
    resource: 'orders',
    permission: 'store.orders.read',
    customPanel: 'orders',
    columns: [
      { key: 'orderNo', label: 'Order #', render: 'code' },
      { key: 'date', label: 'Date', render: 'date' },
      { key: 'total', label: 'Total', render: 'money', numeric: true },
      { key: 'status', label: 'Status', render: 'status' },
    ],
  },

  queue: {
    id: 'queue',
    title: 'Bursary Confirmation Queue',
    description: 'Review and confirm store orders awaiting payment.',
    resource: 'store-queue',
    permission: 'store.queue.read',
    writePermission: 'store.queue.manage',
    customPanel: 'queue',
    columns: [
      { key: 'orderNo', label: 'Order #', render: 'code' },
      { key: 'customerName', label: 'Customer' },
      { key: 'date', label: 'Date', render: 'date' },
      { key: 'total', label: 'Total', render: 'money', numeric: true },
      { key: 'status', label: 'Status', render: 'status' },
    ],
    rowActions: [
      { label: 'Confirm', permission: 'store.queue.manage', dialog: { kind: 'confirm', label: 'Confirm order', title: (r) => `Confirm ${r.orderNo}?`, message: () => 'Confirming releases the stock and marks the order confirmed.', confirmLabel: 'Confirm', action: 'SET_ORDER_STATUS' } },
      { label: 'Resolve refund', permission: 'store.queue.manage', dialog: { kind: 'confirm', label: 'Resolve refund', title: (r) => `Refund ${r.orderNo}?`, confirmLabel: 'Refund', action: 'SET_ORDER_STATUS' } },
    ],
  },

  /* Fees */
  'fee-breakdown': {
    id: 'fee-breakdown',
    title: 'School Fees',
    description: 'View your fee breakdown and payment history.',
    resource: 'fee-breakdown',
    permission: 'schoolfees.read',
    customPanel: 'fees',
    columns: [],
  },

  'fee-categories': {
    id: 'fee-categories',
    title: 'Fee Categories',
    description: 'Manage school fee categories such as tuition, transport and feeding.',
    resource: 'fee-categories',
    permission: 'schoolfees.read',
    writePermission: 'schoolfees.manage',
    deletePermission: 'schoolfees.manage',
    searchPlaceholder: 'Search categories...',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description' },
      { key: 'status', label: 'Status', render: 'status' },
      { key: 'createdAt', label: 'Created', render: 'date' },
    ],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Tuition' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional description' },
    ],
    toolbar: [
      { label: 'New Category', permission: 'schoolfees.manage', dialog: { kind: 'create', label: 'New Category', title: () => 'New Category', action: 'SAVE_ADMIN_RECORD' } },
    ],
    rowActions: [
      { label: 'Edit', permission: 'schoolfees.manage', dialog: { kind: 'edit', label: 'Edit category', title: (r) => `Edit ${r.name}`, action: 'SAVE_ADMIN_RECORD' } },
      { label: 'Delete', permission: 'schoolfees.manage', dialog: { kind: 'confirm', label: 'Delete category', title: (r) => `Delete ${r.name}?`, confirmLabel: 'Delete', danger: true, action: 'DELETE_ADMIN_RECORD' } },
    ],
  },

  'fee-items': {
    id: 'fee-items',
    title: 'Fee Items',
    description: 'Manage school fee items per class, session and term.',
    resource: 'fee-items',
    permission: 'schoolfees.read',
    writePermission: 'schoolfees.manage',
    deletePermission: 'schoolfees.manage',
    searchPlaceholder: 'Search by description or category...',
    filters: [
      { key: 'academicSession', label: 'Session', source: 'academicSession', allLabel: 'All sessions' },
      { key: 'term', label: 'Term', source: 'term', allLabel: 'All terms' },
      { key: 'className', label: 'Class', source: 'className', allLabel: 'All classes' },
    ],
    columns: [
      { key: 'description', label: 'Description' },
      { key: 'categoryName', label: 'Category' },
      { key: 'amount', label: 'Amount', render: 'money', numeric: true },
      { key: 'className', label: 'Class' },
      { key: 'academicSession', label: 'Session' },
      { key: 'term', label: 'Term' },
    ],
    fields: [
      { key: 'categoryName', label: 'Category', type: 'select', required: true, optionsSource: 'fee-categories' },
      { key: 'description', label: 'Description', type: 'text', required: true, placeholder: 'e.g. JSS 1 Tuition' },
      { key: 'amount', label: 'Amount', type: 'number', required: true, placeholder: 'e.g. 50000' },
      { key: 'academicSession', label: 'Session', type: 'select', options: ACADEMIC_SESSION_OPTIONS },
      { key: 'term', label: 'Term', type: 'select', options: TERM_OPTIONS },
      { key: 'className', label: 'Class', type: 'select', optionsSource: 'classes' },
    ],
    toolbar: [
      { label: 'New Fee Item', permission: 'schoolfees.manage', dialog: { kind: 'create', label: 'New Fee Item', title: () => 'New Fee Item', action: 'SAVE_ADMIN_RECORD' } },
    ],
  },

  'fee-payments': {
    id: 'fee-payments',
    title: 'Payment History',
    description: 'Every school fee payment across all sessions and terms.',
    resource: 'fee-payments',
    permission: 'schoolfees.read',
    writePermission: 'schoolfees.manage',
    customPanel: 'fee-payments',
    searchPlaceholder: 'Search payments...',
    filters: [
      { key: 'academicSession', label: 'Session', source: 'academicSession', allLabel: 'All sessions' },
      { key: 'term', label: 'Term', source: 'term', allLabel: 'All terms' },
      { key: 'status', label: 'Status', source: 'status', allLabel: 'All statuses' },
    ],
    columns: [
      { key: 'reference', label: 'Reference', render: 'code' },
      { key: 'studentName', label: 'Student' },
      { key: 'amount', label: 'Amount', render: 'money', numeric: true },
      { key: 'method', label: 'Method' },
      { key: 'status', label: 'Status', render: 'status' },
      { key: 'paidAt', label: 'Paid at', render: 'date' },
    ],
    toolbar: [
      { label: 'Record Payment', permission: 'schoolfees.manage', dialog: { kind: 'create', label: 'Record Payment', title: () => 'Record Payment', action: 'RECORD_FEE_PAYMENT' } },
    ],
  },

  'fee-reports': {
    id: 'fee-reports',
    title: 'Fee Reports',
    description: 'Confirmed school fee collections and pending payments.',
    resource: 'fee-reports',
    permission: 'schoolfees.read',
    customPanel: 'fee-reports',
    columns: [],
  },

  /* Wallets */
  wallets: {
    id: 'wallets',
    title: 'Student Wallets',
    description: 'Search, top up or deduct balances.',
    resource: 'wallets',
    permission: 'wallet.view',
    writePermission: 'wallet.manage',
    customPanel: 'wallets',
    searchPlaceholder: 'Search by name or admission number',
    columns: [
      { key: 'studentName', label: 'Student', render: 'avatar' },
      { key: 'admissionNo', label: 'Admission No.', render: 'code' },
      { key: 'className', label: 'Class' },
      { key: 'balance', label: 'Balance', render: 'money', numeric: true },
      { key: 'threshold', label: 'Threshold', render: 'money', numeric: true },
      { key: 'status', label: 'Status', render: 'status' },
    ],
    rowActions: [
      {
        label: 'Top up',
        permission: 'wallet.manage',
        dialog: {
          kind: 'edit',
          label: 'Top up',
          /* The origin titles this dialog "Cash top-up" and credits it with
             "Credit wallet"; kept verbatim so the operator reads what they read
             there. */
          title: () => 'Cash top-up',
          confirmLabel: 'Credit wallet',
          fields: WALLET_ADJUST_FIELDS,
          action: 'ADJUST_WALLET',
        },
      },
      {
        label: 'Deduct',
        permission: 'wallet.manage',
        dialog: {
          kind: 'edit',
          label: 'Deduct',
          title: () => 'Deduct from wallet',
          confirmLabel: 'Deduct',
          danger: true,
          /* The kind selector appears only when deducting, as in the origin. */
          fields: [...WALLET_ADJUST_FIELDS.slice(0, 1), WALLET_DEDUCT_KIND, ...WALLET_ADJUST_FIELDS.slice(1)],
          action: 'ADJUST_WALLET',
        },
      },
    ],
  },

  'wallet-reports': {
    id: 'wallet-reports',
    title: 'Wallet Reports',
    description: 'Aggregate allowance liability, funding and spend across all student wallets.',
    resource: 'wallet-reports',
    permission: 'wallet.view',
    customPanel: 'wallet-reports',
    columns: [],
  },

  /* Results */
  'upload-windows': {
    id: 'upload-windows',
    title: 'Upload Windows',
    description: 'Manage result upload windows for teachers.',
    resource: 'upload-windows',
    permission: 'results.window.read',
    writePermission: 'results.window.manage',
    customPanel: 'upload-windows',
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'academicSession', label: 'Academic Session' },
      { key: 'term', label: 'Term' },
      { key: 'status', label: 'Status', render: 'status' },
      { key: 'startsAt', label: 'Starts At', render: 'date' },
      { key: 'endsAt', label: 'Ends At', render: 'date' },
    ],
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. First Term 2025 Results' },
      { key: 'academicSession', label: 'Academic Session', type: 'select', required: true, options: ACADEMIC_SESSION_OPTIONS },
      { key: 'term', label: 'Term', type: 'select', required: true, options: TERM_OPTIONS },
      { key: 'startsAt', label: 'Starts at', type: 'date', required: true, half: true },
      { key: 'endsAt', label: 'Ends at', type: 'date', required: true, half: true },
      { key: 'teacherIds', label: 'Teachers', type: 'select', hint: 'The live dialog is a searchable teacher list.', optionsSource: 'staff' },
    ],
    toolbar: [
      { label: 'Audit Trail', permission: 'results.window.read', dialog: { kind: 'detail', label: 'Audit Trail', title: () => 'Upload Window Audit Trail' } },
      { label: 'Create Window', permission: 'results.window.manage', dialog: { kind: 'create', label: 'Create Upload Window', title: () => 'Create Upload Window', action: 'SAVE_UPLOAD_WINDOW' } },
    ],
    rowActions: [
      { label: 'Close', permission: 'results.window.manage', dialog: { kind: 'confirm', label: 'Close window', title: (r) => `Close "${r.title}"?`, message: () => 'Teachers can no longer upload into this window.', confirmLabel: 'Close', action: 'SET_UPLOAD_WINDOW_STATUS' } },
      { label: 'Reopen', permission: 'results.window.manage', dialog: { kind: 'confirm', label: 'Reopen window', title: (r) => `Reopen "${r.title}"?`, confirmLabel: 'Reopen', action: 'SET_UPLOAD_WINDOW_STATUS' } },
    ],
  },

  'enter-results': {
    id: 'enter-results',
    title: 'Enter Results',
    description: 'Enter student examination results.',
    resource: 'result-entries',
    permission: 'results.upload',
    writePermission: 'results.upload',
    customPanel: 'enter-results',
    columns: [],
  },

  'results-queue': {
    id: 'results-queue',
    title: 'Results Queue',
    description: 'Review, vet, and publish submitted results.',
    resource: 'results-queue',
    permission: 'results.queue.read',
    writePermission: 'results.vet',
    customPanel: 'results-queue',
    columns: [],
    tabs: [
      { key: 'ALL', label: 'All' },
      { key: 'PENDING', label: 'Pending' },
      { key: 'COMMITTEE_TAGGED', label: 'Committee Tagged' },
      { key: 'VETTED', label: 'Vetted' },
      { key: 'PUBLISHED', label: 'Published' },
      { key: 'DECLINED', label: 'Declined' },
    ],
  },

  'committee-review': {
    id: 'committee-review',
    title: 'Committee Review',
    description: 'Review results tagged to you by the committee.',
    resource: 'committee-review',
    permission: 'results.committee.view',
    writePermission: 'results.committee.review',
    customPanel: 'committee-review',
    columns: [],
  },

  grading: {
    id: 'grading',
    title: 'Grading Settings',
    description: 'Manage the grading scale and pass mark for result computation.',
    resource: 'grading',
    permission: 'results.grading.manage',
    writePermission: 'results.grading.manage',
    customPanel: 'grading',
    columns: [
      { key: 'grade', label: 'Grade Code' },
      { key: 'minScore', label: 'Min Score', numeric: true },
      { key: 'maxScore', label: 'Max Score', numeric: true },
      { key: 'label', label: 'Label' },
    ],
  },

  'student-results': {
    id: 'student-results',
    title: 'Student Results',
    description: 'Published results per student.',
    resource: 'student-results',
    permission: 'results.view',
    customPanel: 'student-results',
    searchPlaceholder: 'Search by student name or class...',
    filters: [{ key: 'className', label: 'Class', source: 'className', allLabel: 'All Classes' }],
    columns: [
      { key: 'name', label: 'Student', render: 'avatar' },
      { key: 'className', label: 'Class' },
      { key: 'total', label: 'Total', numeric: true },
      { key: 'average', label: 'Average', numeric: true },
      { key: 'grade', label: 'Grade' },
      { key: 'position', label: 'Position', numeric: true },
    ],
  },

  'report-cards': {
    id: 'report-cards',
    title: 'Report Cards',
    description: 'View and download report cards.',
    resource: 'report-cards',
    permission: 'results.report.view',
    customPanel: 'report-cards',
    searchPlaceholder: 'Search by name or admission number...',
    filters: [{ key: 'className', label: 'Class', source: 'className', allLabel: 'All Classes' }],
    columns: [
      { key: 'name', label: 'Student', render: 'avatar' },
      { key: 'admissionNo', label: 'Admission No.', render: 'code' },
      { key: 'className', label: 'Class' },
      { key: 'average', label: 'Average', numeric: true },
      { key: 'grade', label: 'Grade' },
      { key: 'remark', label: 'Remark' },
    ],
  },

  /* System */
  'general-settings': {
    id: 'general-settings',
    title: 'General Settings',
    description: 'School name, contact details and regional settings.',
    resource: 'general-settings',
    permission: 'system.read',
    writePermission: 'system.settings.update',
    customPanel: 'general-settings',
    columns: [],
    fields: [
      { key: 'schoolName', label: 'School name', type: 'text', required: true },
      { key: 'motto', label: 'Motto', type: 'text', half: true },
      { key: 'tagline', label: 'Tagline', type: 'text', half: true },
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'phone', label: 'Phone number', type: 'tel', half: true },
      { key: 'email', label: 'Email address', type: 'email', half: true },
      { key: 'website', label: 'Website', type: 'text', half: true },
      { key: 'timezone', label: 'Timezone', type: 'select', half: true, options: [{ value: 'Africa/Lagos', label: 'Africa/Lagos (WAT, UTC+1)' }, { value: 'UTC', label: 'UTC' }] },
      { key: 'locale', label: 'Locale', type: 'select', half: true, options: [{ value: 'en-NG', label: 'English (Nigeria)' }, { value: 'en-GB', label: 'English (United Kingdom)' }] },
      { key: 'currency', label: 'Currency', type: 'select', half: true, options: [{ value: 'NGN', label: '₦ Naira (NGN)' }, { value: 'USD', label: '$ US Dollar (USD)' }] },
      { key: 'dateFormat', label: 'Date format', type: 'select', half: true, options: [{ value: 'dd/MM/yyyy', label: 'DD/MM/YYYY' }, { value: 'yyyy-MM-dd', label: 'YYYY-MM-DD' }] },
      { key: 'weekStartsOn', label: 'Week starts on', type: 'select', half: true, options: [{ value: 'Monday', label: 'Monday' }, { value: 'Sunday', label: 'Sunday' }] },
      { key: 'academicSession', label: 'Academic session', type: 'select', options: ACADEMIC_SESSION_OPTIONS },
      { key: 'currentTerm', label: 'Current term', type: 'select', options: TERM_OPTIONS },
    ],
  },

  'academic-settings': {
    id: 'academic-settings',
    title: 'Academic Settings',
    description: 'Grading scale, promotion rules and assessment policy.',
    resource: 'unavailable-settings',
    permission: 'system.read',
    customPanel: 'unavailable',
    columns: [],
  },

  'audit-logs': {
    id: 'audit-logs',
    title: 'Audit Logs',
    description: 'A trail of who did what, and when.',
    resource: 'audit-logs',
    permission: 'audit_log.view',
    searchPlaceholder: 'Search actor, action, module or target...',
    filters: [
      { key: 'module', label: 'Module', source: 'module', allLabel: 'All modules' },
      { key: 'action', label: 'Action', source: 'action', allLabel: 'All actions' },
    ],
    columns: [
      { key: 'timestamp', label: 'Timestamp', render: 'date' },
      { key: 'actor', label: 'Actor' },
      { key: 'action', label: 'Action' },
      { key: 'module', label: 'Module' },
      { key: 'target', label: 'Target' },
      { key: 'ipAddress', label: 'IP address', render: 'code' },
      { key: 'status', label: 'Status', render: 'status' },
    ],
  },

  backups: {
    id: 'backups',
    title: 'Backups',
    description: 'Scheduled backups, restore points and download archives.',
    resource: 'backups',
    permission: 'system.read',
    writePermission: 'system.settings.update',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type' },
      { key: 'size', label: 'Size' },
      { key: 'status', label: 'Status', render: 'status' },
      { key: 'createdAt', label: 'Created at', render: 'date' },
      { key: 'createdBy', label: 'Created by' },
      { key: 'retention', label: 'Retention' },
    ],
    toolbar: [{ label: 'Create backup', permission: 'system.settings.update', dialog: { kind: 'confirm', label: 'Create backup', title: () => 'Create a backup now?', message: () => 'A full archive is taken of the portal database.', confirmLabel: 'Create backup', action: 'CREATE_BACKUP' } }],
  },

  branding: {
    id: 'branding',
    title: 'Branding',
    description: 'Logo, colours, favicon and portal look & feel.',
    resource: 'unavailable-settings',
    permission: 'system.read',
    customPanel: 'unavailable',
    columns: [],
  },

  'feature-toggles': {
    id: 'feature-toggles',
    title: 'Feature Toggles',
    description: 'Enable or disable modules and features.',
    resource: 'feature-toggles',
    permission: 'system.read',
    writePermission: 'system.settings.update',
    searchPlaceholder: 'Search features...',
    columns: [
      { key: 'label', label: 'Feature' },
      { key: 'description', label: 'Description' },
      { key: 'enabled', label: 'Enabled', render: 'bool' },
    ],
    rowActions: [
      { label: 'Toggle', permission: 'system.settings.update', dialog: { kind: 'confirm', label: 'Toggle feature', title: (r) => `Toggle ${r.label}?`, confirmLabel: 'Toggle', action: 'SAVE_FEATURE_TOGGLE' } },
    ],
  },

  'notification-settings': {
    id: 'notification-settings',
    title: 'Notification Settings',
    description: 'Channel preferences and email/SMS notification rules.',
    resource: 'unavailable-settings',
    permission: 'system.read',
    customPanel: 'unavailable',
    columns: [],
  },

  'system-configuration': {
    id: 'system-configuration',
    title: 'System Configuration',
    description: 'Advanced system parameters, keys and integrations.',
    resource: 'system-configuration',
    permission: 'system.read',
    writePermission: 'system.settings.update',
    customPanel: 'system-configuration',
    columns: [],
    fields: [
      { key: 'sessionTimeoutMinutes', label: 'Session timeout (minutes)', type: 'number', half: true },
      { key: 'maxUploadSizeMb', label: 'Max upload size (MB)', type: 'number', half: true },
      { key: 'dataRetentionDays', label: 'Data retention (days)', type: 'number', half: true },
      { key: 'maxStudentsPerClass', label: 'Max students per class', type: 'number', half: true },
      { key: 'minimumPasswordLength', label: 'Minimum password length', type: 'number', half: true },
      { key: 'passwordExpiryDays', label: 'Password expiry (days)', type: 'number', half: true },
      { key: 'failedAttemptsBeforeLockout', label: 'Failed attempts before lockout', type: 'number', half: true },
      { key: 'lockoutWindowMinutes', label: 'Lockout window (minutes)', type: 'number', half: true },
      { key: 'requireTwoFactor', label: 'Require two-factor authentication', type: 'checkbox', hint: 'All staff must enrol an authenticator app.' },
      { key: 'maintenanceMode', label: 'Maintenance mode', type: 'checkbox', hint: 'Blocks all sign-ins and shows a notice page.' },
      { key: 'maintenanceMessage', label: 'Maintenance message', type: 'textarea' },
      { key: 'allowedIpAddresses', label: 'Allowed IP addresses', type: 'text' },
    ],
  },

  /* ── disciplinary ────────────────────────────────────────────────────────
   *
   * Four panels, matching the live `/disciplinary/*` routes. The READ gates are
   * the module-wide `disciplinary.read` rather than a per-page code: the
   * deployed app gates the whole module on one permission, and inventing
   * `disciplinary.incidents.view` for this console would be a code the origin
   * has no notion of.
   */
  'disciplinary-incidents': {
    id: 'disciplinary-incidents',
    title: 'Incidents',
    description: 'Manage disciplinary case types.',
    resource: 'case-catalogue',
    permission: 'disciplinary.read',
    writePermission: 'disciplinary.incidents.manage',
    customPanel: 'case-catalogue',
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'description', label: 'Description' },
    ],
  },

  'disciplinary-committees': {
    id: 'disciplinary-committees',
    title: 'Disciplinary Committee',
    description: 'Create and manage the committees that hear disciplinary cases.',
    resource: 'case-committees',
    permission: 'disciplinary.read',
    writePermission: 'disciplinary.committees.manage',
    deletePermission: 'disciplinary.committees.manage',
    customPanel: 'case-committees',
    columns: [],
  },

  'disciplinary-launch-case': {
    id: 'disciplinary-launch-case',
    title: 'Launch Case',
    description: 'Record an incident and open a disciplinary case against a student.',
    resource: 'case-catalogue',
    /* Launching is its own permission on the live app, and it is the only one
       these two fields are gated on — a session may read the catalogue without
       being able to open a case against anyone in it. */
    permission: 'disciplinary.cases.launch',
    writePermission: 'disciplinary.cases.launch',
    customPanel: 'case-form',
    columns: [],
  },

  'disciplinary-reports': {
    id: 'disciplinary-reports',
    title: 'Case Reports',
    description: 'Review every disciplinary case, its severity and its status.',
    resource: 'disciplinary-cases',
    permission: 'disciplinary.cases.view',
    /* Status changes and comments are gated on the same read code as the origin
       gates them, which is genuinely permissive — a committee member who can see
       a case is one the live app lets them move. Recorded in parity-report.md. */
    writePermission: 'disciplinary.cases.view',
    deletePermission: 'disciplinary.committees.manage',
    customPanel: 'case-work',
    columns: [],
  },

  /* ── counselling ─────────────────────────────────────────────────────────
   *
   * Four panels against the live `/counselling/*` routes, and the same three
   * component kinds as the disciplinary module above: a committee list, a
   * sectioned referral form, and a filtered case list. Both modules share these
   * components rather than having one each, because they are the same three
   * pages with different nouns — which is how the deployed app is written too,
   * with `counselling-cases.tsx` and `disciplinary-reports.tsx` reading as
   * siblings.
   */
  'counselling-cases': {
    id: 'counselling-cases',
    title: 'View Cases',
    description: 'Review and filter all counselling referrals.',
    resource: 'counselling-cases',
    permission: 'counselling.cases.view',
    writePermission: 'counselling.cases.view',
    deletePermission: 'counselling.committees.manage',
    customPanel: 'case-work',
    columns: [],
  },

  'counselling-book-session': {
    id: 'counselling-book-session',
    title: 'Book Session',
    description: 'Refer a student for counselling and assign a counsellor.',
    resource: 'counselling-cases',
    permission: 'counselling.cases.book',
    writePermission: 'counselling.cases.book',
    customPanel: 'case-form',
    columns: [],
  },

  'counselling-committee': {
    id: 'counselling-committee',
    title: 'Counselling Committee',
    description: 'Create and manage the counselling team and its committees.',
    resource: 'case-committees',
    permission: 'counselling.committees.view',
    writePermission: 'counselling.committees.manage',
    deletePermission: 'counselling.committees.manage',
    customPanel: 'case-committees',
    columns: [],
  },

  'counselling-reports': {
    id: 'counselling-reports',
    title: 'Session Reports',
    description: 'Write up and review the record of each counselling session.',
    resource: 'counselling-reports',
    permission: 'counselling.reports.view',
    writePermission: 'counselling.reports.manage',
    customPanel: 'case-work',
    columns: [],
  },
};

/** The three settings pages the live app shows an error card for. */
export const UNAVAILABLE_SETTINGS: Readonly<Record<string, { title: string; description: string; error: string }>> = {
  'academic-settings': {
    title: 'Academic Settings',
    description: 'Grading scale, promotion rules and assessment policy.',
    error: "Couldn't load academic settings",
  },
  branding: {
    title: 'Branding',
    description: 'Logo, colours, favicon and portal look & feel.',
    error: "Couldn't load branding settings",
  },
  'notification-settings': {
    title: 'Notification Settings',
    description: 'Channel preferences and email/SMS notification rules.',
    error: "Couldn't load notification settings",
  },
};

/** Module ids the generic panel can render with no bespoke component. */
export const GENERIC_PANEL_IDS = Object.values(ADMIN_MODULES)
  .filter((m) => !m.customPanel)
  .map((m) => m.id);

/** Every module id, for the rail/mount cross-check in `tools/check-admin-parity.mjs`. */
export const ADMIN_MODULE_IDS = Object.keys(ADMIN_MODULES);
