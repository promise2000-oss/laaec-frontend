/**
 * admin.ts — the Saint Finbarr's College admin-portal domain types.
 *
 * WHY A SEPARATE FILE
 * -------------------
 * `types/index.ts` and `types/teacher.ts` already hold LAEC's examination types
 * and the St Finbarr's *teacher* portal types (D-72). This file holds the
 * *admin* portal's types, which is a third, much larger vocabulary: HR,
 * students, parents, academics, results, inventory, store, fees and wallets.
 * Keeping them apart means the LAEC consoles keep compiling against exactly the
 * types they were written against.
 *
 * EVERY TYPE HERE IS OBSERVED
 * ---------------------------
 * Field names, value spellings and status unions come from the live deployment
 * (see docs/saint-finbarrs-admin/feature-inventory.md) with the source's own
 * type declarations used to settle shapes the DOM cannot show. Where a value is
 * displayed in a form the audit could not read — the fee item amounts, for
 * instance — the type is left as a string rather than guessed at.
 */

/* ── users, roles, permissions ─────────────────────────────────────────── */

/** `/users` shows `Active`; `/roles` counts members per role. */
export type UserStatus = 'active' | 'inactive' | 'invited' | 'suspended';

/** The statuses the status filter offers, in the order the live page shows them. */
export const USER_STATUSES: readonly UserStatus[] = ['active', 'inactive', 'invited', 'suspended'];

export interface PortalUser {
  id: string;
  firstName: string;
  lastName: string;
  /** Rendered as one avatar pair on the live list. */
  initials: string;
  email: string;
  phone: string;
  /** Free text: a user may hold several of the 33 roles. */
  roles: string[];
  status: UserStatus;
  /** The live list renders `Never` when there is no previous login. */
  lastLogin: string;
  joined: string;
}

/**
 * One of the 33 roles on `/roles`. `users` and `permissions` are the two
 * columns the live table shows, and both are counts, not joined data.
 */
export interface PortalRole {
  id: string;
  name: string;
  /** Empty for `Asst. Admin Sec.` — the live table shows nothing there. */
  description: string;
  users: number;
  permissions: number;
}

/**
 * A permission, grouped by module exactly as `/roles/new` groups them:
 * a module heading with a `Select all` checkbox and one checkbox per
 * permission, each carrying a human label.
 */
export interface PortalPermission {
  id: string;
  module: string;
  label: string;
}

/* ── staff, departments, designations, attendance, leave, HR ───────────── */

export interface Department {
  id: string;
  name: string;
  /** Rendered as `Head: <name>`; empty when the department has no head. */
  headName: string;
  /** The live card shows `5 staff members` under the name. */
  staffCount: number;
}

export interface Designation {
  id: string;
  name: string;
  description: string;
  staffCount: number;
}

export interface StaffMember {
  id: string;
  /** The live table's `Employee` column is `<name>` then `<staffNo> · <email>`. */
  fullName: string;
  staffNo: string;
  email: string;
  phone: string;
  roles: string[];
  departmentId: string;
  departmentName: string;
  designationId: string;
  designationName: string;
  gender: string;
  dateOfBirth: string;
  currentAddress: string;
  status: UserStatus;
  lastLogin: string;
}

/** A staff attendance sheet. The live list shows its title and week count. */
export interface AttendanceSheet {
  id: string;
  title: string;
  category: 'staff' | 'student';
  /** A staff sheet carries a term and session; a student sheet carries a class. */
  term: string;
  academicSession: string;
  classId: string;
  className: string;
  weeks: AttendanceWeek[];
}

export type AttendanceMark = 'present' | 'absent' | 'unmarked';

export interface AttendanceWeek {
  id: string;
  label: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** One entry per person in the sheet's register. */
  marks: Record<string, AttendanceMark>;
}

/** The report's own row shape — a person, not a sheet. */
export interface AttendanceReportRow {
  personId: string;
  name: string;
  identifier: string;
  present: number;
  absent: number;
  unmarked: number;
  /** Percentage, pre-formatted by the mock; `0` when nothing is marked. */
  rate: number;
}

export interface LeaveApplication {
  id: string;
  staffId: string;
  staffName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decisionComment: string;
  createdAt: string;
}

/** `/hr-queries` columns: Subject, From, To, Priority, Status, Details. */
export interface HrQuery {
  id: string;
  title: string;
  description: string;
  fromUser: string;
  toUser: string;
  offence: string;
  priority: 'low' | 'medium' | 'high';
  status: 'OPEN' | 'ASSIGNED' | 'RESOLVED' | 'ARCHIVED';
  response: string;
  createdAt: string;
}

export interface Award {
  id: string;
  awardType: string;
  recipientName: string;
  recipientEmail: string;
  period: string;
  reason: string;
  createdAt: string;
}

/* ── students, parents ─────────────────────────────────────────────────── */

export type StudentCategory = 'DAY' | 'BOARDING';

export interface StudentRecord {
  id: string;
  firstName: string;
  lastName: string;
  /** The live table's `Student` cell is `<name>` then the admission number. */
  admissionNo: string;
  classId: string;
  className: string;
  armId: string;
  armName: string;
  academicSession: string;
  category: StudentCategory;
  email: string;
  phone: string;
  dateOfBirth: string;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
  guardianRelationship: string;
  guardianOccupation: string;
  guardianAddress: string;
}

export interface ParentRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  /** Rendered as `2 linked` with the children's names beneath. */
  children: Array<{ id: string; name: string; className: string }>;
  status: UserStatus;
  lastLogin: string;
}

/* ── academics ─────────────────────────────────────────────────────────── */

export interface AcademicSession {
  id: string;
  name: string;
  /** `First` / `Second` / `Third`. */
  term: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'INACTIVE';
  classCount: number;
}

export interface AcademicClass {
  id: string;
  name: string;
  academicSession: string;
  arms: AcademicArm[];
}

export interface AcademicArm {
  id: string;
  classId: string;
  className: string;
  name: string;
}

export interface Subject {
  id: string;
  name: string;
  /** `MTH`, `ENG`, `B.Tech`, and an em dash for the several with no code. */
  code: string;
  description: string;
}

export interface Timetable {
  id: string;
  title: string;
  academicSession: string;
  classId: string;
  className: string;
  armId: string;
  armName: string;
  description: string;
  slots: TimetableSlot[];
}

/** The create grid's columns are the weekdays, Monday to Friday. */
export interface TimetableSlot {
  id: string;
  from: string;
  to: string;
  cells: Array<{ subjectId: string; teacherName: string }>;
}

export interface Assignment {
  id: string;
  title: string;
  /** The live table shows an `.pdf`/`.docx` filename for an uploaded one. */
  documentName: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  armName: string;
  dueDate: string;
  teacherName: string;
}

export interface ClassTeacherAssignment {
  id: string;
  classId: string;
  className: string;
  armId: string;
  armName: string;
  teacherId: string;
  teacherName: string;
  academicSession: string;
}

export interface SubjectTeacherAssignment {
  id: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
  armId: string;
  armName: string;
}

export interface CalendarEntry {
  id: string;
  title: string;
  /** `YYYY-MM-DD`. */
  date: string;
  kind: 'term' | 'event' | 'exam' | 'pta' | 'holiday';
  description: string;
  academicSession: string;
}

/* ── communication ─────────────────────────────────────────────────────── */

export type NoticeAudience = 'EVERYONE' | 'STAFF' | 'STUDENTS' | 'PARENTS' | 'TEACHERS';

export interface PortalNotice {
  id: string;
  title: string;
  body: string;
  audience: NoticeAudience;
  authorName: string;
  /** The live form has `Pin to top` and `Publish immediately`. */
  pinned: boolean;
  published: boolean;
  createdAt: string;
}

export interface PortalEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  /** ISO datetime; empty when the event is all-day. */
  startsAt: string;
  endsAt: string;
  category: string;
  audience: NoticeAudience;
  allDay: boolean;
}

/* ── inventory ─────────────────────────────────────────────────────────── */

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface InventoryCategory {
  id: string;
  name: string;
  scope: string;
  description: string;
  linkedItems: number;
  createdAt: string;
}

export interface StockItem {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  categoryName: string;
  unitPrice: number;
  inStock: number;
  reserved: number;
  /** The stock list derives this column; the live page computes `inStock - reserved`. */
  available: number;
  reorderLevel: number;
  status: StockStatus;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

export type AssetCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR';

export interface SchoolAsset {
  id: string;
  name: string;
  category: string;
  quantity: number;
  location: string;
  condition: AssetCondition;
  lastAudited: string;
  notes: string;
  /** Rendered on the live list as `0 photos` / `N photos`. */
  photoCount: number;
}

export type SaleStatus = 'DRAFT' | 'PAYMENT_CONFIRMED' | 'RELEASED' | 'CANCELLED';

export interface Sale {
  id: string;
  /** `INV-2026-0001` on the live list. */
  invoiceNo: string;
  buyerName: string;
  buyerPhone: string;
  total: number;
  status: SaleStatus;
  date: string;
  createdBy: string;
  supplierName: string;
  lines: SaleLine[];
}

export interface SaleLine {
  stockItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

/* ── store, fees, wallet ───────────────────────────────────────────────── */

export type OrderStatus =
  | 'AWAITING_PAYMENT'
  | 'PAID_CONFIRM'
  | 'REFUND_PENDING'
  | 'CONFIRMED'
  | 'REFUNDED';

export interface StoreOrder {
  id: string;
  /** `ORD-2026-0002` on the live queue. */
  orderNo: string;
  customerName: string;
  date: string;
  total: number;
  status: OrderStatus;
  lines: Array<{ stockItemId: string; name: string; quantity: number; unitPrice: number }>;
}

export interface CartLine {
  stockItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface FeeCategory {
  id: string;
  name: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface FeeItem {
  id: string;
  description: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  academicSession: string;
  term: string;
  classId: string;
  className: string;
}

export interface FeePayment {
  id: string;
  reference: string;
  studentId: string;
  studentName: string;
  className: string;
  amount: number;
  method: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  academicSession: string;
  term: string;
  paidAt: string;
}

export interface StudentWallet {
  id: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  className: string;
  balance: number;
  threshold: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  studentName: string;
  type: 'TOPUP' | 'DEDUCT' | 'REFUND';
  amount: number;
  note: string;
  /** The reports page counts only confirmed transactions. */
  confirmed: boolean;
  createdAt: string;
}

/* ── results ───────────────────────────────────────────────────────────── */

/**
 * A result-upload window. The live table's `Actions` column offers `Close` on
 * an open window and `Reopen` on a closed one — one label for the state.
 */
export interface UploadWindow {
  id: string;
  title: string;
  academicSession: string;
  term: string;
  status: 'OPEN' | 'CLOSED';
  startsAt: string;
  endsAt: string;
  /** The window's own teacher picker; the create dialog lists every teacher. */
  teacherIds: string[];
}

export type ResultQueueStatus =
  | 'PENDING'
  | 'COMMITTEE_TAGGED'
  | 'VETTED'
  | 'PUBLISHED'
  | 'DECLINED';

export interface ResultQueueItem {
  id: string;
  title: string;
  academicSession: string;
  term: string;
  className: string;
  subjectName: string;
  teacherName: string;
  status: ResultQueueStatus;
  submittedAt: string;
  declineReason: string;
}

/** `/results/grading` — the scale the portal computes grades from. */
export interface GradingBand {
  grade: string;
  minScore: number;
  maxScore: number;
  label: string;
}

/** The constants printed under the grading table. */
export interface GradingSettings {
  bands: GradingBand[];
  passMark: number;
  maxCA: number;
  maxExam: number;
}

/**
 * One entered result row. The live Enter Results grid has a fixed column set
 * and derives `total`, `average` and `cumulative` from the four marks.
 */
export interface ResultEntryRow {
  studentId: string;
  admissionNo: string;
  surname: string;
  otherNames: string;
  sex: string;
  studentType: StudentCategory;
  className: string;
  academicSession: string;
  /** The live grid's TERM header, from the form's term selector. */
  term: string;
  /** `CA 1` out of 20. */
  ca1: number | '';
  /** `CA 2` out of 10. */
  ca2: number | '';
  /** `PROJ/ASS` out of 10. */
  project: number | '';
  /** `EXAM` out of 60. */
  exam: number | '';
}

export interface StudentResultSummary {
  studentId: string;
  admissionNo: string;
  name: string;
  className: string;
  armName: string;
  /** One entry per subject; the live report card lists them. */
  subjects: Array<{ subjectName: string; ca: number; exam: number; total: number; grade: string; remark: string }>;
  total: number;
  average: number;
  grade: string;
  remark: string;
  attendance: number;
  position: number;
}

/* ── system ────────────────────────────────────────────────────────────── */

/** `/system/general-settings` — the three sections the live form renders. */
export interface GeneralSettings {
  schoolName: string;
  motto: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  timezone: string;
  locale: string;
  currency: string;
  dateFormat: string;
  weekStartsOn: string;
  academicSession: string;
  currentTerm: string;
}

/** `/system/system-configuration` — the four sections the live form renders. */
export interface SystemConfiguration {
  sessionTimeoutMinutes: number;
  maxUploadSizeMb: number;
  dataRetentionDays: number;
  maxStudentsPerClass: number;
  minimumPasswordLength: number;
  passwordExpiryDays: number;
  failedAttemptsBeforeLockout: number;
  lockoutWindowMinutes: number;
  requireTwoFactor: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowedIpAddresses: string;
  /** Read-only on the live page: `saintfinbarrs-prod`. */
  databaseName: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  module: string;
  target: string;
  ipAddress: string;
  status: 'SUCCESS' | 'FAILED';
}

export interface BackupRecord {
  id: string;
  name: string;
  type: 'MANUAL' | 'SCHEDULED';
  size: string;
  status: 'COMPLETED' | 'RUNNING' | 'FAILED';
  createdAt: string;
  createdBy: string;
  retention: string;
}

export interface FeatureToggle {
  id: string;
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface BrandingSettings {
  logoUrl: string;
  faviconUrl: string;
  primaryColour: string;
  accentColour: string;
  portalTitle: string;
}

/**
 * The three settings pages the live app shows an error for
 * (`Couldn't load …`) rather than a form. Documented as a live defect in
 * feature-inventory.md; the type exists so the port reproduces the state
 * honestly rather than inventing a form the origin does not render.
 */
export interface UnavailableSettingsPage {
  key: 'academic' | 'notification' | 'branding';
  title: string;
  description: string;
  errorMessage: string;
}

/** `/inventory/settings` — the single global default the live form edits. */
export interface InventorySettings {
  defaultReorderLevel: number;
}

/* ── dashboard ─────────────────────────────────────────────────────────── */

/** One dashboard tile: a live count plus the module it opens. */
export interface DashboardStat {
  key: string;
  label: string;
  /** Pre-formatted by the mock: the live tiles mix plain counts with `—`. */
  value: string;
  href: string;
  /** The live tile carries a second, smaller total where one exists. */
  secondary?: string;
}

/** The six sections the Super Admin dashboard groups its tiles into. */
export interface DashboardSection {
  key: string;
  title: string;
  description: string;
  stats: DashboardStat[];
}

/** The dashboard's third column: named shortcuts with a description each. */
export interface QuickAction {
  label: string;
  description: string;
  href: string;
}

/* ── case reports ──────────────────────────────────────────────────────

/**
 * The shared filter bar both report pages render.
 *
 * These types are NOT duplicated here: the Disciplinary and Counselling modules
 * were already built once for this project's `/teacher/` console, with their
 * shapes in `types/teacher.ts`, and the admin panels read those same records.
 * Two copies of `DisciplinaryCase` would be two definitions of one entity, and a
 * teacher-side and admin-side case could then disagree — which is precisely the
 * kind of drift this project has already had to undo once.
 *
 * The only admin-specific addition is `CaseFilters`, because both report pages
 * filter on a date range that the teacher's own list does not offer.
 */
export interface CaseFilters {
  search: string;
  status: string;
  session: string;
  fromDate: string;
  toDate: string;
}

/* ── store cart ────────────────────────────────── */

/**
 * The cart, as a first-class record rather than a panel-local array.
 *
 * It used to be one: `AdminInventoryPanel` held `cartLines` in component state
 * and "checkout" re-issued `ADD_TO_CART` per line — which could not have created
 * an order even in principle, because it added to the thing it had just
 * emptied. A cart the mock owns is what makes `PLACE_STORE_ORDER` a transaction
 * rather than a UI gesture, and it is what the live `/store/cart` is.
 */
export interface StoreCart {
  items: CartLine[];
  /** Derived from the lines; never stored, so it cannot disagree with them. */
  total: number;
}
