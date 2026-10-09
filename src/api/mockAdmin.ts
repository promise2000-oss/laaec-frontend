/**
 * mockAdmin.ts — the Saint Finbarr's College admin portal's data layer.
 *
 * WHY A SEPARATE FILE
 * -------------------
 * `mock.ts` is the 38-action LAEC contract and `mockTeacher.ts` is the 49-action
 * teacher portal. The admin portal is larger again (27 actions) and its records
 * have nothing in common with either, so it gets its own file. `attachAdminHandlers`
 * folds these into the same `handlers` map, which is what keeps `callApi`'s
 * permission gate, latency simulation and failure injection applying unchanged.
 *
 * WHY IT IS SEEDED
 * ---------------
 * The live admin portal at audit time held 278 users, 155 students, 129 parents,
 * 151 staff, 36 subjects, 23 classes, 33 roles, 5 stock items, 6 fee categories
 * and so on. Reproducing those counts is not the point; reproducing *the shape*
 * is. Every module in `types/admin-registry.ts` is seeded with enough rows to
 * exercise its states — an empty state is reachable through a filter, and a
 * seeded module is reachable through none. A console where twenty of thirty
 * panels say "No records yet" is not a port of anything.
 *
 * WHERE THE COUNTS DIFFER, AND WHY
 * --------------------------------
 * Seeded counts are smaller than the live counts and are NOT presented as the
 * live counts. The dashboard tiles render whatever the seed holds, and the
 * dashboard's own description ("Live counts from your database") is kept as the
 * live app's copy while the values are this portal's own. Where a seed is a
 * deliberate divergence from the live data the reason is recorded at the seed.
 *
 * NOT INVENTED
 * ------------
 * Status unions, validation messages, column headers, tab labels and role and
 * permission names are the live app's own. Nothing here is a plausible-sounding
 * guess at a value the audit could not read; unconfirmed fields stay empty
 * strings rather than being filled in.
 */

import type {
  AcademicArm,
  AcademicClass,
  AcademicSession,
  Assignment,
  AttendanceMark,
  AttendanceReportRow,
  AttendanceSheet,
  AuditLogEntry,
  CartLine,
  Award,
  BackupRecord,
  BrandingSettings,
  CalendarEntry,
  ClassTeacherAssignment,
  DashboardSection,
  Department,
  Designation,
  FeatureToggle,
  FeeCategory,
  FeeItem,
  FeePayment,
  GeneralSettings,
  GradingSettings,
  HrQuery,
  InventoryCategory,
  InventorySettings,
  LeaveApplication,
  NoticeAudience,
  PortalEvent,
  PortalNotice,
  PortalUser,
  QuickAction,
  ResultEntryRow,
  ResultQueueItem,
  SchoolAsset,
  StockItem,
  StudentCategory,
  StudentRecord,
  StudentResultSummary,
  StudentWallet,
  StoreCart,
  StoreOrder,
  Subject,
  SubjectTeacherAssignment,
  Supplier,
  SystemConfiguration,
  Timetable,
  UploadWindow,
  UserStatus,
  WalletTransaction,
} from '../types/admin';
import { SEED_PERMISSION_MODULES, SEED_ROLES } from '../types/admin-registry';
import type { PortalRole } from '../types/admin';

/** The envelope every admin handler returns. Matches `ApiEnvelope`. */
type AnyRes = { status: 'success' | 'error'; message?: string; [k: string]: unknown };
type Req = Record<string, unknown>;

const ok = (message: string): AnyRes => ({ status: 'success', message });

const text = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const trimmed = (v: unknown): string => text(v).trim();

/** `YYYY-MM-DD`, the shape every date input on the live portal submits. */
const day = (offsetDays = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};
const stamp = (offsetDays = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
};

const CURRENCY = '₦';
/** The live app renders money with thousands separators and two decimals. */
export const money = (amount: number): string =>
  `${CURRENCY}${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const name2initials = (first: string, last: string): string =>
  `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

const full = (first: string, last: string): string => `${first} ${last}`.trim();

/* ── sessions, classes, arms, subjects ─────────────────────────────────── */

const sessions: AcademicSession[] = [
  {
    id: 'SES-2026-27',
    name: '2026/2027',
    term: 'First',
    startDate: day(-23),
    endDate: day(72),
    status: 'ACTIVE',
    classCount: 23,
  },
  {
    id: 'SES-2025-26',
    name: '2025/2026',
    term: 'Third',
    startDate: day(-238),
    endDate: day(-171),
    status: 'INACTIVE',
    classCount: 0,
  },
  {
    id: 'SES-2025-26-2',
    name: '2025/2026',
    term: 'First',
    startDate: day(-411),
    endDate: day(-338),
    status: 'INACTIVE',
    classCount: 0,
  },
];

/**
 * The live portal's 23 class names, with the arms each actually has. The class
 * *names* are reproduced as observed — including the duplicates (`JSS 1` and
 * `JSS1`, `SS 1` and `SS1`, `SSS 1` and `Ss1`), which is a real data-hygiene
 * finding recorded in feature-inventory.md rather than something to tidy up here.
 */
const CLASS_NAMES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['JSS 1', ['Arm A', 'Arm B', 'Arm C', 'Arm D', 'Arm E', 'Arm F', 'Arm G']],
  ['JSS 2', ['Arm A', 'Arm B', 'Arm C', 'Arm D', 'Arm E', 'Arm F', 'Arm G']],
  ['JSS 3', ['Arm A', 'Arm B', 'Arm C', 'Arm D', 'Arm E']],
  ['JSS1', ['Arm A', 'Arm B', 'Arm D', 'Arm E']],
  ['JSS2', ['Arm A', 'Arm B', 'Arm C', 'Arm D', 'Arm E', 'Arm F', 'Arm G']],
  ['JSS3', ['Arm A', 'Arm B', 'Arm E']],
  ['JSS3E', ['Arm A']],
  ['Jss1', ['Arm A', 'Arm B']],
  ['Jss2', ['Arm A', 'Arm B', 'Arm C', 'Arm D', 'Arm G']],
  ['Jss3', ['Arm A', 'Arm E']],
  ['SS 1', ['Arm A', 'Arm B', 'Arm C', 'Arm D', 'Arm E', 'Arm F']],
  ['SS 2', ['Arm A', 'Arm B', 'Arm C', 'Arm D', 'Arm E']],
  ['SS 3', ['Arm A', 'Arm B']],
  ['SS1', ['Arm A', 'Arm B', 'Arm C', 'Arm D', 'Arm E']],
  ['SS2', ['Arm A', 'Arm B', 'Arm C']],
  ['SS2E', ['Arm A']],
  ['SS3', ['Arm A']],
  ['SSS 2', ['Arm A']],
  ['SSS1', ['Arm A', 'Arm B', 'Arm C']],
  ['SSS2', ['Arm A', 'Arm B']],
  ['SSS3', ['Arm A']],
  ['Ss1', ['Arm A', 'Arm B']],
  ['Ss2', ['Arm A', 'Arm B']],
];

let classSeq = 0;
const classes: AcademicClass[] = CLASS_NAMES.map(([name, armNames]) => {
  classSeq += 1;
  return {
    id: `CLS-${String(classSeq).padStart(3, '0')}`,
    name,
    academicSession: '2026/2027',
    arms: armNames.map((armName, i) => ({
      id: `ARM-${String(classSeq).padStart(3, '0')}-${String(i + 1).padStart(2, '0')}`,
      classId: `CLS-${String(classSeq).padStart(3, '0')}`,
      className: name,
      name: armName,
    })),
  };
});

const arms: AcademicArm[] = classes.flatMap((c) => c.arms);

/** The live subject list: 36 rows, codes as observed, em dash where there is none. */
const subjects: Subject[] = [
  ['AI/Robotics', 'AI'],
  ['Agricultural Science', 'Agric'],
  ['Basic Science', 'B.Sci'],
  ['Basic Technology', 'B.Tech'],
  ['Biology', 'Bio'],
  ['Business Studies', 'BS'],
  ['Chemistry', 'CHE'],
  ['Christian Religious Studies', 'CRS'],
  ['Citizenship & Heritage Studies', 'CHS'],
  ['Commerce', 'Com'],
  ['Computer Hardware & GSM Repairs', 'CHGR'],
  ['Digital Technology', 'D.T.'],
  ['Economics', 'Eco'],
  ['English', 'ENG'],
  ['Financial Accounting', 'Acc'],
  ['Fine Art', 'F.A.'],
  ['Food & Nutrition', 'F/N'],
  ['French', 'Fren'],
  ['Furthermaths', 'Fur'],
  ['Garment Making', 'GM'],
  ['Geography', 'Geo'],
  ['Government', 'Gov'],
  ['History', 'His'],
  ['Igbo', 'Igbo'],
  ['Intermediate Science', 'Inter'],
  ['Lit -in-English', 'Lit'],
  ['Marketing', 'Ma'],
  ['Mathematics', 'MTH'],
  ['Music', 'Mus'],
  ['Physical & Health Education', 'PHE'],
  ['Physics', 'PHY'],
  ['Social & Citizenship Studies', 'SCS'],
  ['Social Studies', 'S. S'],
  ['Solar Installation & Maintenance', 'Solar'],
  ['Technical Drawing', 'T.D'],
  ['Yoruba', 'Yor'],
].map(([name, code], i) => ({ id: `SUB-${String(i + 1).padStart(2, '0')}`, name, code, description: '' }));

/* ── people ────────────────────────────────────────────────────────────── */

/**
 * The 21 departments the live `/departments` page holds, with each one's code and
 * head as observed. `headName` is empty for the eleven that have no head — the
 * live card prints `Head:` and then nothing, which is what this reproduces.
 */
const DEPARTMENT_SEED: ReadonlyArray<readonly [string, string, string, number]> = [
  ['DEP-01', 'Admin', 'Victor Biyibi', 5],
  ['DEP-02', 'Administration', '', 1],
  ['DEP-03', 'Boarding', 'Rev. Fr. Michael', 4],
  ['DEP-04', 'Bursary', '', 2],
  ['DEP-05', 'Business', 'Ohamuo Adenike', 5],
  ['DEP-06', 'Clinic', '', 3],
  ['DEP-07', 'Digital Tech', 'Kalu Esther', 7],
  ['DEP-08', 'English', 'Anyanwu Queeneth', 7],
  ['DEP-09', 'Facilities', '', 0],
  ['DEP-10', 'Guidance & Counseling', 'Mary Uzoukwu', 2],
  ['DEP-11', 'Humanities', 'Sarah Okanoluwa', 3],
  ['DEP-12', 'ICT / Registry', '', 0],
  ['DEP-13', 'Inventory', '', 0],
  ['DEP-14', 'Library', '', 0],
  ['DEP-15', 'Maintenance Department', '', 0],
  ['DEP-16', 'Mathematics', 'KAZEEM ABASS', 5],
  ['DEP-17', 'SNE Unit', '', 0],
  ['DEP-18', 'Science', 'Ayalokunrin Mary', 9],
  ['DEP-19', 'Transport', '', 0],
  ['DEP-20', 'Vocational', 'OJAJUNI OLABISI', 2],
  ['DEP-21', 'Academics', '', 0],
];

const departments: Department[] = DEPARTMENT_SEED.map(([id, name, headName, staffCount]) => ({
  id,
  name,
  headName,
  staffCount,
}));

/**
 * The live designation list: 29 rows, including the one whose description is the
 * filler text `lorem pasum` — reproduced, because it is what the live card shows
 * and "fixing" seed data is not what this audit is for.
 */
const DESIGNATION_SEED: ReadonlyArray<readonly [string, number]> = [
  ['Admin Director', 0],
  ['Asst. College Admin', 1],
  ['Asst. Sectional Head - Junior School', 1],
  ['Asst. Sectional Head - Senior School', 1],
  ['Bursar', 0],
  ['Class Teacher', 0],
  ['Clinic/Nurse', 0],
  ['College Administrator', 0],
  ['Driver', 0],
  ['Head Teacher', 1],
  ['Head of Department', 0],
  ['Head of Unit', 0],
  ['Hostel Warden', 0],
  ['House Parent', 0],
  ['ICT Officer', 0],
  ['Lab assistant', 0],
  ['Librarian', 0],
  ['Porter', 0],
  ['Principal', 0],
  ['Register', 0],
  ['School Administrator', 0],
  ['Sectional Head - Junior School', 0],
  ['Sectional Head - Senior School', 1],
  ['Security Officer', 0],
  ['Store keeper', 0],
  ['Super Admin', 0],
  ['Teacher', 0],
  ['Vice Principal Academics', 0],
  ['Year Tutor', 0],
];

const designations: Designation[] = DESIGNATION_SEED.map(([name, staffCount], i) => ({
  id: `DSG-${String(i + 1).padStart(2, '0')}`,
  name,
  description: name === 'Lab assistant' ? 'lorem pasum' : '',
  staffCount,
}));

interface SeedPerson {
  first: string;
  last: string;
  email: string;
  phone: string;
  roles: string[];
  departmentId?: string;
  designationId?: string;
  status?: UserStatus;
  lastLoginDays?: number | null;
}

const SEED_STAFF: SeedPerson[] = [
  { first: 'Very Rev. Fr. Babs', last: '', email: 'admin@saintfinbarrscollege.com', phone: '+2348029492720', roles: ['Super Admin'], departmentId: 'DEP-01', designationId: 'DSG-25', lastLoginDays: 0 },
  { first: 'Alexander', last: 'Uche-Okoro', email: 'alexanderuchechukwuucheokoro@gmail.com', phone: '+2348030000001', roles: ['HR Officer'], departmentId: 'DEP-01' },
  { first: 'Onyedika', last: 'Nwabunor Dominion', email: 'nwabunoronyedika@gmail.com', phone: '+2348030000002', roles: ['Administrator'], departmentId: 'DEP-02' },
  { first: 'Andrew', last: 'Dare', email: 'dredarezzy2596@gmail.com', phone: '+2348030000003', roles: ['House Parent'], departmentId: 'DEP-03', lastLoginDays: 1 },
  { first: 'Sarah', last: 'Afia-Ilevbare', email: 'sarah.afialevbare@example.ng', phone: '+2348030000004', roles: ['Teacher', 'Class Teacher'], departmentId: 'DEP-08', designationId: 'DSG-04', lastLoginDays: 2 },
  { first: 'Mitchell', last: 'Ipense', email: 'mitchell.ipense@example.ng', phone: '+2348030000005', roles: ['Teacher'], departmentId: 'DEP-08', lastLoginDays: 4 },
  { first: 'Chidinma', last: 'Nwadike', email: 'chidinma.nwadike@example.ng', phone: '+2348030000006', roles: ['Teacher'], departmentId: 'DEP-16', lastLoginDays: 3 },
  { first: 'Abayomi', last: 'Osineye', email: 'kenny_info2@yahoo.com', phone: '+2348030000007', roles: ['Teacher', 'Class Teacher'], departmentId: 'DEP-16', lastLoginDays: 6 },
  { first: 'Tosin', last: 'Adejoro', email: 'tosin.adejoro@example.ng', phone: '+2348030000008', roles: ['Teacher', 'Class Teacher'], departmentId: 'DEP-18', lastLoginDays: 5 },
  { first: 'Kosiso', last: 'Egemba', email: 'kosiso.egemba@example.ng', phone: '+2348030000009', roles: ['Teacher', 'Class Teacher'], departmentId: 'DEP-11' },
  { first: 'Akindele', last: 'Esther', email: 'Iammercy20@gmail.com', phone: '+2348030000010', roles: ['Teacher', 'Head of Department'], departmentId: 'DEP-16', lastLoginDays: 1 },
  { first: 'Damilola', last: 'Ahmed', email: 'damilola.ahmed@example.ng', phone: '+2348030000011', roles: ['Counsellor Team'], departmentId: 'DEP-10' },
  { first: 'Theresa', last: 'Alagbaoso', email: 'theresa.alagbaoso@example.ng', phone: '+2348030000012', roles: ['Counsellor Team'], departmentId: 'DEP-10' },
  { first: 'Chioma', last: 'Okoye-Azi', email: 'chisly4real@gmail.com', phone: '+2348030000013', roles: ['Secretary'], departmentId: 'DEP-02' },
  { first: 'Emmy', last: 'Obi', email: 'emmy.obi@example.ng', phone: '+2348030000014', roles: ['Bursary'], departmentId: 'DEP-04' },
  { first: 'Kelechi', last: 'Nwosu', email: 'kelechi.nwosu@example.ng', phone: '+2348030000015', roles: ['Accountant'], departmentId: 'DEP-04' },
  { first: 'Bola', last: 'Adeyemi', email: 'bola.adeyemi@example.ng', phone: '+2348030000016', roles: ['ICT'], departmentId: 'DEP-12', lastLoginDays: 2 },
  { first: 'Ngozi', last: 'Eze', email: 'ngozi.eze@example.ng', phone: '+2348030000017', roles: ['Clinicals'], departmentId: 'DEP-06' },
  { first: 'Samuel', last: 'Kuye', email: 'samuel.kuye@example.ng', phone: '+2348030000018', roles: ['Store/Sales Staff'], departmentId: 'DEP-13' },
  { first: 'Fatima', last: 'Bello', email: 'fatima.bello@example.ng', phone: '+2348030000019', roles: ['Sanitation'], departmentId: 'DEP-09' },
  { first: 'Grace', last: 'Etim', email: 'grace.etim@example.ng', phone: '+2348030000020', roles: ['Librarian'], departmentId: 'DEP-14' },
  { first: 'Ibrahim', last: 'Musa', email: 'ibrahim.musa@example.ng', phone: '+2348030000021', roles: ['Kitchen'], departmentId: 'DEP-19' },
];

let staffSeq = 0;
const staff: Array<Record<string, unknown> & { id: string; fullName: string; firstName: string; lastName: string }> =
  SEED_STAFF.map((person) => {
    staffSeq += 1;
    const department = departments.find((d) => d.id === person.departmentId);
    const designation = designations.find((d) => d.id === person.designationId);
    return {
      id: `STF-${String(staffSeq).padStart(3, '0')}`,
      firstName: person.first,
      lastName: person.last,
      fullName: full(person.first, person.last),
      staffNo: `SFC${String(100 + staffSeq).padStart(3, '0')}`,
      email: person.email,
      phone: person.phone,
      roles: person.roles,
      departmentId: department?.id ?? '',
      departmentName: department?.name ?? '',
      designationId: designation?.id ?? '',
      designationName: designation?.name ?? '',
      gender: '',
      dateOfBirth: '',
      currentAddress: '',
      status: person.status ?? 'active',
      lastLogin:
        person.lastLoginDays === null || person.lastLoginDays === undefined
          ? 'Never'
          : new Date(Date.now() - person.lastLoginDays * 86400000).toLocaleString('en-GB'),
    };
  });

/** The staff picker reads name + email, which is what the live dialog shows. */
const staffOptions = staff.map((s) => ({ value: String(s.fullName), label: `${s.fullName} · ${s.email}` }));

const STUDENT_SEED: ReadonlyArray<readonly [string, string, string, StudentCategory, string]> = [
  ['Awesome', 'Louis', 'SFC/STU/41938', 'DAY', 'Jss2'],
  ['Chidera', 'Daraojimba', '00041711', 'DAY', 'JSS3'],
  ['Chiemerie', 'Daraojimba', '00042057', 'DAY', 'JSS2'],
  ['Chukwunomso', 'Okwechime', 'SFSC/693ST2024/41699', 'DAY', 'JSS 3'],
  ['MUNACHIMSO', 'NWAFOR', 'ADM-1790305319449-135-545', 'DAY', 'JSS 2'],
  ['UCHECHUKWU', 'NWAFOR', 'ADM-1790305319002-134-871', 'BOARDING', 'SSS1'],
  ['Emmanuel', 'Otuodichukwu', 'ADM-1790305318937-133-572', 'DAY', 'Ss1'],
  ['David', 'Otuodichukwu', 'ADM-1790305318491-132-337', 'DAY', 'Jss2'],
  ['OGUEZUONU', 'PROSPER CHIGOZIRIM', 'ADM-1790305318030-131-8', 'DAY', 'JSS1'],
  ['Ebuka', 'Ikemusinachi Okoye-Azi', 'SFSC693ST202541916', 'DAY', 'JSS2'],
  ['Claudius', 'Osemudiamen Ugbeni', 'ADM-1790285580553-798', 'DAY', 'JSS1'],
  ['Ekweanua', 'Kamsiyochukwu Michael', 'SFC/STU/189324', 'BOARDING', 'JSS2'],
  ['FRANCIS', 'ADEOLUWA OGUNMUYIWA', 'SFC/STU/0041', 'DAY', 'JSS3'],
  ['TOLUWANI', 'ODENEYE', 'ADM-1790303864282-104', 'DAY', 'SS1'],
  ['Joel', 'Idegu', 'SFSC693ST202541936', 'DAY', 'JSS2'],
  ['Jachinma', 'Otegbulu', 'ADM-1790303342194-122', 'DAY', 'JSS 3'],
  ['ADEMIDE', 'OKEGBEMI', 'ADM-1790285068168-862', 'DAY', 'JSS 2'],
  ['Michael', 'Adum', 'SFC/STU/221044', 'DAY', 'SS 2'],
  ['Blessing', 'Akporhono', 'SFC/STU/221045', 'BOARDING', 'JSS2'],
  ['Sarah', 'Ochili', 'SFC/STU/221046', 'DAY', 'JSS3'],
];

let studentSeq = 0;
const students: StudentRecord[] = STUDENT_SEED.map(([first, last, admissionNo, category, className], i) => {
  studentSeq += 1;
  const klass = classes.find((c) => c.name === className) ?? classes[0];
  const arm = klass.arms[i % klass.arms.length];
  return {
    id: `STU-${String(studentSeq).padStart(3, '0')}`,
    firstName: first,
    lastName: last,
    admissionNo,
    classId: klass.id,
    className: klass.name,
    armId: arm.id,
    armName: arm.name,
    academicSession: '2026/2027',
    category,
    email: '',
    phone: '',
    dateOfBirth: '',
    guardianName: '',
    guardianEmail: '',
    guardianPhone: '',
    guardianRelationship: '',
    guardianOccupation: '',
    guardianAddress: '',
  };
});

/**
 * Parents are derived from students rather than written out: the live page shows
 * `2 linked` with the children's names beneath, so a parent record that is not
 * backed by real children would make that column a lie.
 */
let parentSeq = 0;
const parents = students
  .filter((_, i) => i % 2 === 0)
  .map((student, i): Record<string, unknown> & { id: string } => {
    parentSeq += 1;
    const second = students[i * 2 + 1];
    const children = second && second.id !== student.id
      ? [
          { id: student.id, name: full(student.firstName, student.lastName), className: student.className },
          { id: second.id, name: full(second.firstName, second.lastName), className: second.className },
        ]
      : [{ id: student.id, name: full(student.firstName, student.lastName), className: student.className }];
    return {
      id: `PAR-${String(parentSeq).padStart(3, '0')}`,
      firstName: children[0].name.split(' ')[0],
      lastName: children[0].name.split(' ').slice(1).join(' '),
      fullName: children[0].name,
      email: `guardian.${parentSeq}@example.ng`,
      phone: `+23480${String(3000000 + parentSeq).slice(-7)}`,
      children,
      status: 'active' as UserStatus,
      lastLogin: 'Never',
    };
  });

/** Users: one row per staff, one per parent, plus the four Super Admins. */
let userSeq = 0;
const users: PortalUser[] = [
  ...staff.map((person): PortalUser => {
    userSeq += 1;
    return {
      id: `USR-${String(userSeq).padStart(3, '0')}`,
      firstName: String(person.firstName),
      lastName: String(person.lastName),
      initials: name2initials(String(person.firstName), String(person.lastName)),
      email: String(person.email),
      phone: String(person.phone),
      roles: person.roles as string[],
      status: person.status as UserStatus,
      lastLogin: String(person.lastLogin),
      joined: day(-100 + userSeq),
    };
  }),
  ...parents.map((person): PortalUser => {
    userSeq += 1;
    return {
      id: `USR-${String(userSeq).padStart(3, '0')}`,
      firstName: String(person.firstName),
      lastName: String(person.lastName),
      initials: name2initials(String(person.firstName), String(person.lastName)),
      email: String(person.email),
      phone: String(person.phone),
      roles: ['Parent'],
      status: 'active',
      lastLogin: 'Never',
      joined: day(-90 + userSeq),
    };
  }),
];

/* ── roles, permissions ────────────────────────────────────────────────── */

const roles: PortalRole[] = SEED_ROLES.map((role) => ({ ...role }));

/**
 * The permission grid behind `/permissions` and `/roles/new`.
 *
 * Role → permission ids. `Super Admin` holds every code because the live role
 * row says "Has all system permissions" and the live matrix shows it as such.
 * The other roles are seeded so the matrix is legible rather than empty: each
 * holds the codes its own name implies. This is a *seed*, not a claim about the
 * live grants — the live per-role permission counts are recorded in
 * `SEED_ROLES.permissions` and are what the roles table renders.
 */
const allPermissionKeys = SEED_PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => p.key));
const permissionIds = SEED_PERMISSION_MODULES.flatMap((m, mi) =>
  m.permissions.map((p, pi) => ({ ...p, id: `PRM-${String(mi + 1).padStart(2, '0')}-${String(pi + 1).padStart(2, '0')}`, module: m.module })),
);

/** Roles that get a plausible subset; everything else starts empty, as live. */
const ROLE_GRANTS: Readonly<Record<string, readonly string[]>> = {
  'Super Admin': allPermissionKeys,
  Administrator: allPermissionKeys.filter((k) => !k.startsWith('results.vet')),
  'College Administrator': allPermissionKeys.filter((k) => !k.startsWith('results.vet')),
  'Assistant College Administrator': allPermissionKeys.filter((k) => !k.startsWith('results.') && !k.startsWith('inventory.sales.release')),
  ICT: allPermissionKeys.filter((k) => k.startsWith('system.') || k.startsWith('users.') || k.startsWith('roles.') || k.startsWith('permissions.')),
  'HR Officer': allPermissionKeys.filter((k) => k.startsWith('queries.') || k.startsWith('leave.') || k.startsWith('awards.') || k.startsWith('staff.') || k.startsWith('categories.')),
  Teacher: allPermissionKeys.filter((k) => k.startsWith('teacher.') || k.startsWith('lesson-plans.') || k.startsWith('weekly-reports.')),
  Parent: allPermissionKeys.filter((k) => k.startsWith('students.read') || k.startsWith('results.view')),
  Bursary: allPermissionKeys.filter((k) => k.startsWith('schoolfees.') || k.startsWith('wallet.')),
  Accountant: allPermissionKeys.filter((k) => k.startsWith('schoolfees.') || k.startsWith('wallet.')),
  'Store/Sales Staff': allPermissionKeys.filter((k) => k.startsWith('inventory.') || k.startsWith('store.')),
  'Inventory/Stock': allPermissionKeys.filter((k) => k.startsWith('inventory.')),
  Clinicals: allPermissionKeys.filter((k) => k.startsWith('inventory.clinic.')),
  'House Parent': allPermissionKeys.filter((k) => k.startsWith('disciplinary.') || k.startsWith('students.read')),
  'Counsellor Team': allPermissionKeys.filter((k) => k.startsWith('counselling.')),
  'Head Teacher': allPermissionKeys.filter((k) => k.startsWith('weekly-reports.review') || k.startsWith('results.') || k.startsWith('counselling.')),
  'Sectional Head (Senior)': allPermissionKeys.filter((k) => k.startsWith('lesson-plans.review') || k.startsWith('weekly-reports.review')),
  'Sectional Head (Junior)': allPermissionKeys.filter((k) => k.startsWith('lesson-plans.review')),
  'Head Teacher Office': allPermissionKeys.filter((k) => k.startsWith('communication.')),
};

const rolePermissionIds = new Map<string, string[]>();
for (const role of roles) {
  const keys = ROLE_GRANTS[role.name] ?? [];
  rolePermissionIds.set(
    role.id,
    permissionIds.filter((p) => keys.includes(p.key)).map((p) => p.id),
  );
}

const userPermissionIds = new Map<string, string[]>(users.map((u) => [u.id, []]));

/* ── attendance ────────────────────────────────────────────────────────── */

/**
 * A register of `personCount` marks: the first `presentCount` present, the last
 * one left unmarked so the report's `Unmarked` column is never trivially zero
 * and the operator can see what an unmarked day looks like.
 */
const mark = (personCount: number, presentCount: number): Record<string, AttendanceMark> => {
  const marks: Record<string, AttendanceMark> = {};
  for (let i = 0; i < personCount; i++) {
    marks[String(i)] = i < presentCount ? 'present' : i < personCount - 1 ? 'absent' : 'unmarked';
  }
  return marks;
};

const buildSheets = (): AttendanceSheet[] => [
  {
    id: 'SHT-STAFF-01',
    title: 'Staff Attendance',
    category: 'staff',
    term: 'First',
    academicSession: '2026/2027',
    classId: '',
    className: '',
    weeks: [
      { id: 'WK-01', label: 'Week 1', date: day(-14), marks: mark(staff.length, staff.length - 2) },
      { id: 'WK-02', label: 'Week 2', date: day(-7), marks: mark(staff.length, staff.length - 4) },
      { id: 'WK-03', label: 'Week 3', date: day(0), marks: mark(staff.length, staff.length - 1) },
    ],
  },
  {
    id: 'SHT-STAFF-02',
    title: 'Staff- Attendance -01',
    category: 'staff',
    term: 'First',
    academicSession: '2026/2027',
    classId: '',
    className: '',
    weeks: [{ id: 'WK-04', label: 'Week 1', date: day(-10), marks: mark(staff.length, staff.length - 3) }],
  },
  ...['JSS 1', 'JSS 2', 'SS 1', 'SS 2'].map((className, i): AttendanceSheet => {
    const klass = classes.find((c) => c.name === className) ?? classes[0];
    const roster = students.filter((s) => s.className === className);
    const size = roster.length || 6;
    return {
      id: `SHT-STU-${String(i + 1).padStart(2, '0')}`,
      title: className,
      category: 'student',
      term: 'First',
      academicSession: '2026/2027',
      classId: klass.id,
      className,
      weeks: [
        { id: `WKS-${i}-1`, label: 'Week 1', date: day(-14), marks: mark(size, size - 2) },
        { id: `WKS-${i}-2`, label: 'Week 2', date: day(-7), marks: mark(size, size - 1) },
      ],
    };
  }),
];

let sheets: AttendanceSheet[] = buildSheets();

/** Tally one sheet's weeks into the report's per-person row. */
const attendanceRows = (sheet: AttendanceSheet, people: Array<{ id: string; name: string; identifier: string }>): AttendanceReportRow[] =>
  people.map((person, index) => {
    let present = 0;
    let absent = 0;
    let unmarked = 0;
    for (const week of sheet.weeks) {
      const value = week.marks[String(index)];
      if (value === 'present') present += 1;
      else if (value === 'absent') absent += 1;
      else unmarked += 1;
    }
    const marked = present + absent;
    return { personId: person.id, name: person.name, identifier: person.identifier, present, absent, unmarked, rate: marked ? Math.round((present / marked) * 100) : 0 };
  });

const attendanceTotals = (rows: AttendanceReportRow[]): Record<string, number> => {
  const present = rows.reduce((n, r) => n + r.present, 0);
  const absent = rows.reduce((n, r) => n + r.absent, 0);
  const unmarked = rows.reduce((n, r) => n + r.unmarked, 0);
  const marked = present + absent;
  return {
    present,
    absent,
    unmarked,
    rate: marked ? Math.round((present / marked) * 100) : 0,
    people: rows.length,
    weeks: sheets.filter((s) => s.category === 'staff').reduce((n, s) => n + s.weeks.length, 0),
    days: sheets.filter((s) => s.category === 'staff').reduce((n, s) => n + s.weeks.length * 5, 0),
  };
};

/* ── leave, queries, awards ────────────────────────────────────────────── */

let leaveSeq = 0;
const leave: LeaveApplication[] = [
  {
    id: 'LV-003',
    staffId: 'STF-005',
    staffName: 'Sarah Afia-Ilevbare',
    leaveType: 'Annual Leave',
    startDate: day(6),
    endDate: day(10),
    days: 5,
    reason: 'Family visit out of state.',
    status: 'PENDING',
    decisionComment: '',
    createdAt: stamp(-1),
  },
  {
    id: 'LV-002',
    staffId: 'STF-006',
    staffName: 'Mitchell Ipense',
    leaveType: 'Sick Leave',
    startDate: day(-12),
    endDate: day(-11),
    days: 2,
    reason: 'Medical review.',
    status: 'APPROVED',
    decisionComment: 'Approved. Please hand your register to the class teacher.',
    createdAt: stamp(-14),
  },
  {
    id: 'LV-001',
    staffId: 'STF-014',
    staffName: 'Kelechi Nwosu',
    leaveType: 'Compassionate Leave',
    startDate: day(-30),
    endDate: day(-28),
    days: 3,
    reason: 'Bereavement.',
    status: 'REJECTED',
    decisionComment: 'Rejected: quarter close. Please resubmit for next term.',
    createdAt: stamp(-32),
  },
];
leaveSeq = leave.length;

let querySeq = 0;
const queries: HrQuery[] = [
  {
    id: 'HQ-001',
    title: 'Query for Lateness to Class',
    description: 'Reported for arriving after the bell on three occasions.',
    fromUser: 'Nicegene Technologies',
    toUser: 'Kalu Esther',
    offence: 'Lateness to Class',
    priority: 'low',
    status: 'ASSIGNED',
    response: '',
    createdAt: stamp(-18),
  },
  {
    id: 'HQ-002',
    title: 'Missing duty roster',
    description: 'The weekly duty roster was not submitted for week 2.',
    fromUser: 'Sarah Afia-Ilevbare',
    toUser: 'Kosiso Egemba',
    offence: 'Administrative',
    priority: 'medium',
    status: 'OPEN',
    response: '',
    createdAt: stamp(-6),
  },
  {
    id: 'HQ-003',
    title: 'Leave balance clarification',
    description: 'Requested a statement of the annual leave balance carried over.',
    fromUser: 'Akindele Esther',
    toUser: 'Alexander Uche-Okoro',
    offence: 'Leave',
    priority: 'high',
    status: 'RESOLVED',
    response: 'Statement issued and acknowledged.',
    createdAt: stamp(-40),
  },
];
querySeq = queries.length;

let awardSeq = 0;
const awards: Award[] = [
  {
    id: 'AW-001',
    awardType: 'Staff of the Month',
    recipientName: 'Akindele Esther',
    recipientEmail: 'Iammercy20@gmail.com',
    period: 'September 2026',
    reason: 'Outstanding commitment to her JSS 1 class and to the department.',
    createdAt: stamp(-24),
  },
  {
    id: 'AW-002',
    awardType: 'Best Tutor',
    recipientName: 'Abayomi Osineye',
    recipientEmail: 'kenny_info2@yahoo.com',
    period: 'September 2026',
    reason: 'Highest class average in Mathematics for the first term.',
    createdAt: stamp(-24),
  },
  {
    id: 'AW-003',
    awardType: 'Service Award',
    recipientName: 'Theresa Alagbaoso',
    recipientEmail: 'theresa.alagbaoso@example.ng',
    period: 'August 2026',
    reason: 'Ten years of service to the counselling unit.',
    createdAt: stamp(-52),
  },
];
awardSeq = awards.length;

/** The award picker and the HR offence picker read the same catalogue. */
const awardTypes = [
  'Staff of the Month',
  'Best Tutor',
  'Service Award',
  'Excellence in Teaching',
  'Community Service',
  'Lateness to Class',
  'Administrative',
  'Leave',
];

/* ── academics: timetables, assignments, class/subject teachers ─────────── */

let timetableSeq = 0;
const timetables: Timetable[] = [
  {
    id: 'TT-001',
    title: 'JSS 1 Arm A — First Term',
    academicSession: '2026/2027',
    classId: classes[0].id,
    className: classes[0].name,
    armId: classes[0].arms[0].id,
    armName: classes[0].arms[0].name,
    description: '',
    slots: [
      {
        id: 'SLOT-01',
        from: '08:00',
        to: '08:45',
        cells: [
          { subjectId: 'SUB-28', teacherName: 'Chidinma Nwadike' },
          { subjectId: 'SUB-14', teacherName: 'Sarah Afia-Ilevbare' },
          { subjectId: 'SUB-28', teacherName: 'Chidinma Nwadike' },
          { subjectId: 'SUB-14', teacherName: 'Sarah Afia-Ilevbare' },
          { subjectId: 'SUB-33', teacherName: 'Kosiso Egemba' },
        ],
      },
      {
        id: 'SLOT-02',
        from: '08:45',
        to: '09:30',
        cells: [
          { subjectId: 'SUB-31', teacherName: 'Tosin Adejoro' },
          { subjectId: 'SUB-31', teacherName: 'Tosin Adejoro' },
          { subjectId: 'SUB-31', teacherName: 'Tosin Adejoro' },
          { subjectId: 'SUB-31', teacherName: 'Tosin Adejoro' },
          { subjectId: 'SUB-31', teacherName: 'Tosin Adejoro' },
        ],
      },
    ],
  },
];
timetableSeq = timetables.length;

/**
 * The five assignments the live `/academic/assignments` table holds. Each title
 * and document filename is verbatim from that table; every row's due date is
 * today's date, which is what the live column shows for all five.
 */
const ASSIGNMENT_SEED: ReadonlyArray<
  readonly [string, string, string, string, string, string, string]
> = [
  ['MARKETING THIRD WEEK ASSIGNMENT', 'SS2 MARKETING ASSIGNMENT, FIRST TERM 2026-2027.pdf', 'SUB-27', 'Marketing', 'SS 2', 'Arm A', 'Adesola Adepoju'],
  ['PHYSICS INDEPENDENCE ASSIGNMENT', 'SS2 PHY INDEPENDENCE ASSIGNMENT.docx', 'SUB-31', 'Physics', 'SS 2', 'Arm D', 'Joshua Adenuga'],
  ['Mathematics Holiday Assignment', '', 'SUB-28', 'Mathematics', 'JSS 1', 'Arm A', 'Temitope Adedimeji'],
  ['Living Things', '', 'SUB-05', 'Biology', 'SS 1', 'Arm D', 'ADEYEMO OLUBUKOLA'],
  ['GEOMETRICAL CONSTRUCTION', 'JSS 2 BASIC TECHNOLOGY ASSIGNMENT.docx', 'SUB-04', 'Basic Technology', 'JSS 2', 'Arm A', 'OLANIYI DUROKIFA'],
];

const assignments: Assignment[] = ASSIGNMENT_SEED.map(
  ([title, documentName, subjectId, subjectName, className, armName, teacherName], i) => ({
    id: `AS-${String(i + 1).padStart(3, '0')}`,
    title,
    documentName,
    subjectId,
    subjectName,
    classId: classes.find((c) => c.name === className)?.id ?? '',
    className,
    armName,
    dueDate: day(0),
    teacherName,
  }),
);
let assignmentSeq = assignments.length;

let classTeacherSeq = 0;
const classTeachers: ClassTeacherAssignment[] = staff
  .filter((s) => (s.roles as string[]).includes('Class Teacher'))
  .flatMap((person, i) => {
    const klass = classes[i % classes.length];
    /* Two arms per teacher: the live table shows 31 rows across the arms of each
       class, so one teacher per arm is the shape it has. */
    return klass.arms.slice(0, 2).map((arm): ClassTeacherAssignment => {
      classTeacherSeq += 1;
      return {
        id: `CT-${String(classTeacherSeq).padStart(3, '0')}`,
        classId: klass.id,
        className: klass.name,
        armId: arm.id,
        armName: arm.name,
        teacherId: String(person.id),
        teacherName: String(person.fullName),
        academicSession: '2026/2027',
      };
    });
  });

let subjectTeacherSeq = 0;
const subjectTeachers: SubjectTeacherAssignment[] = staff
  .filter((s) => (s.roles as string[]).includes('Teacher'))
  .slice(0, 12)
  .map((person, i): SubjectTeacherAssignment => {
    subjectTeacherSeq += 1;
    const klass = classes[i % classes.length];
    const arm = klass.arms[i % klass.arms.length];
    return {
      id: `ST-${String(subjectTeacherSeq).padStart(3, '0')}`,
      subjectId: subjects[i % subjects.length].id,
      subjectName: subjects[i % subjects.length].name,
      teacherId: String(person.id),
      teacherName: String(person.fullName),
      classId: klass.id,
      className: klass.name,
      armId: arm.id,
      armName: arm.name,
    };
  });

/* ── calendar ──────────────────────────────────────────────────────────── */

let calendarSeq = 0;
const calendar: CalendarEntry[] = [
  { id: 'CAL-01', title: "Indepence Day", date: day(-5), kind: 'holiday', description: '', academicSession: '2026/2027' },
  { id: 'CAL-02', title: 'Teachers Day', date: day(-1), kind: 'holiday', description: '', academicSession: '2026/2027' },
  { id: 'CAL-03', title: 'Archdiocesan Teachers Day', date: day(4), kind: 'event', description: '', academicSession: '2026/2027' },
  { id: 'CAL-04', title: 'Speech and Prize giving Day', date: day(11), kind: 'event', description: '', academicSession: '2026/2027' },
  { id: 'CAL-05', title: 'First Organized Contionous Test/PTA', date: day(21), kind: 'pta', description: '', academicSession: '2026/2027' },
  { id: 'CAL-06', title: 'All Saint Day', date: day(25), kind: 'holiday', description: '', academicSession: '2026/2027' },
  { id: 'CAL-07', title: 'Mid-term break', date: day(35), kind: 'term', description: '', academicSession: '2026/2027' },
  { id: 'CAL-08', title: 'Third Term examinations begin', date: day(50), kind: 'exam', description: '', academicSession: '2026/2027' },
];
calendarSeq = calendar.length;

/* ── notices, events ───────────────────────────────────────────────────── */

let noticeSeq = 0;
const notices: PortalNotice[] = [
  {
    id: 'NT-001',
    title: 'First Term Examination Timetable',
    body: 'The first term examination timetable is now on the notice board. Students are to confirm their subjects with their form teacher.',
    audience: 'EVERYONE',
    authorName: 'Nicegene Technologies',
    pinned: true,
    published: true,
    createdAt: stamp(-2),
  },
  {
    id: 'NT-002',
    title: 'Staff briefing on the new reporting format',
    body: 'All academic and administrative staff are expected for a briefing on the revised reporting format this Friday after morning assembly.',
    audience: 'STAFF',
    authorName: 'Onyedika Nwabunor Dominion',
    pinned: false,
    published: true,
    createdAt: stamp(-9),
  },
  {
    id: 'NT-003',
    title: 'Draft: Parent-teacher meeting schedule',
    body: 'Draft schedule for the first term parent-teacher meetings. Not yet published.',
    audience: 'PARENTS',
    authorName: 'Sarah Afia-Ilevbare',
    pinned: false,
    published: false,
    createdAt: stamp(-1),
  },
];
noticeSeq = notices.length;

let eventSeq = 0;
const events: PortalEvent[] = [
  {
    id: 'EV-001',
    title: 'Inter-house sports',
    description: 'Annual inter-house athletics competition.',
    location: 'College field',
    startsAt: stamp(12),
    endsAt: stamp(13),
    category: 'Sport',
    audience: 'EVERYONE',
    allDay: false,
  },
  {
    id: 'EV-002',
    title: 'Science fair',
    description: 'Projects from JSS 3 and SS 1.',
    location: 'Old block hall',
    startsAt: stamp(19),
    endsAt: stamp(20),
    category: 'Academic',
    audience: 'STUDENTS',
    allDay: false,
  },
];
eventSeq = events.length;

/* ── inventory ─────────────────────────────────────────────────────────── */

let inventoryCategorySeq = 0;
const inventoryCategories: InventoryCategory[] = [
  ['General', 'Anything concerning wears', 1, -35],
  ['ELECTRONICS', 'This category accounts for all the electronics of the school.', 0, -23],
  ['FURNITURE', 'This is for all the chairs, tables etc.', 0, -23],
  ['UNIFORM', 'This is for all forms of uniform of the school', 2, -23],
].map(([name, description, linkedItems, createdOffset], i) => {
  inventoryCategorySeq += 1;
  return {
    id: `ICAT-${String(i + 1).padStart(2, '0')}`,
    name: String(name),
    scope: 'General',
    description: String(description),
    linkedItems: Number(linkedItems),
    createdAt: stamp(Number(createdOffset)),
  };
});

let stockSeq = 0;
const stock: StockItem[] = [
  ['Sports wear', 'Size 23', 'ICAT-04', 8000, 0, 0, 2],
  ['Trousers', 'Size-32', 'ICAT-04', 3000, 30, 1, 5],
  ['Uniform', 'UNI-SKT-442', 'ICAT-01', 20000, 5, 5, 3],
  ['Science Calculator', 'SCI-CALC-88', 'ICAT-02', 12500, 4, 0, 4],
  ['Folding Chair', 'FUR-CHR-10', 'ICAT-03', 18500, 12, 2, 6],
].map(([name, sku, categoryId, unitPrice, inStock, reserved, reorderLevel], i) => {
  stockSeq += 1;
  const category = inventoryCategories.find((c) => c.id === categoryId);
  const available = Number(inStock) - Number(reserved);
  return {
    id: `STK-${String(i + 1).padStart(2, '0')}`,
    name: String(name),
    sku: String(sku),
    categoryId: String(categoryId),
    categoryName: category?.name ?? '',
    unitPrice: Number(unitPrice),
    inStock: Number(inStock),
    reserved: Number(reserved),
    available,
    reorderLevel: Number(reorderLevel),
    status: available <= 0 ? 'OUT_OF_STOCK' : available <= Number(reorderLevel) ? 'LOW_STOCK' : 'IN_STOCK',
  };
});

let clinicSeq = 0;
const clinicStock: StockItem[] = [
  ['Paracetamol 500mg', 'CLN-PAR-500', 'General', 350, 60, 10],
  ['Bandage roll', 'CLN-BND-01', 'General', 900, 18, 5],
  ['Hand sanitiser 500ml', 'CLN-SAN-500', 'General', 1200, 8, 6],
].map(([name, sku, categoryName, unitPrice, inStock, reorderLevel], i) => {
  clinicSeq += 1;
  const available = Number(inStock);
  return {
    id: `CLN-${String(i + 1).padStart(2, '0')}`,
    name: String(name),
    sku: String(sku),
    categoryId: 'ICAT-01',
    categoryName: String(categoryName),
    unitPrice: Number(unitPrice),
    inStock: available,
    reserved: 0,
    available,
    reorderLevel: Number(reorderLevel),
    status: available <= 0 ? 'OUT_OF_STOCK' : available <= Number(reorderLevel) ? 'LOW_STOCK' : 'IN_STOCK',
  };
});

let supplierSeq = 0;
const suppliers: Supplier[] = [
  {
    id: 'SUP-001',
    name: 'NICEGENE TECHNOLOGY SOLUTIONS LIMITED',
    contact: 'ENGR. EUGENE O. ORJI',
    phone: '+2348029492720',
    email: 'info@nicegeneco.com.ng',
    address: '',
    notes: '',
  },
  {
    id: 'SUP-002',
    name: 'MedPlus Distribution Ltd',
    contact: 'Ada Obi',
    phone: '+2348031112223',
    email: 'sales@medplus.example.ng',
    address: '14 Marina Road, Lagos',
    notes: 'Net 30. Delivery on Tuesdays.',
  },
];
supplierSeq = suppliers.length;

let assetSeq = 0;
const assets: SchoolAsset[] = [
  {
    id: 'AST-001',
    name: 'HP Laptops',
    category: 'ELECTRONICS',
    quantity: 20,
    location: 'Across Admin Offices',
    condition: 'NEW',
    lastAudited: '',
    notes: '',
    photoCount: 0,
  },
  {
    id: 'AST-002',
    name: 'Generator 15KVA',
    category: 'EQUIPMENT',
    quantity: 2,
    location: 'Power house',
    condition: 'GOOD',
    lastAudited: day(-60),
    notes: 'Serviced quarterly.',
    photoCount: 2,
  },
  {
    id: 'AST-003',
    name: 'Student desks',
    category: 'FURNITURE',
    quantity: 240,
    location: 'Classrooms',
    condition: 'FAIR',
    lastAudited: day(-120),
    notes: 'Twelve damaged in the last term.',
    photoCount: 1,
  },
];
assetSeq = assets.length;

let saleSeq = 0;
const sales: Array<Record<string, unknown> & { id: string; total: number; status: string }> = [
  {
    id: 'SALE-001',
    invoiceNo: 'INV-2026-0001',
    buyerName: 'ORJI',
    buyerPhone: '',
    total: 30000,
    status: 'CANCELLED',
    date: day(-16),
    createdBy: 'ALEXANDER UCHE-OKORO',
    supplierName: '',
    lines: [{ stockItemId: 'STK-03', name: 'Uniform', quantity: 1, unitPrice: 20000 }, { stockItemId: 'STK-02', name: 'Trousers', quantity: 1, unitPrice: 3000 }],
  },
  {
    id: 'SALE-002',
    invoiceNo: 'INV-2026-0002',
    buyerName: 'Sarah Afia-Ilevbare',
    buyerPhone: '+2348030000004',
    total: 8000,
    status: 'PAYMENT_CONFIRMED',
    date: day(-3),
    createdBy: 'Alexander Uche-Okoro',
    supplierName: 'SUP-001',
    lines: [{ stockItemId: 'STK-01', name: 'Sports wear', quantity: 1, unitPrice: 8000 }],
  },
  {
    id: 'SALE-003',
    invoiceNo: 'INV-2026-0003',
    buyerName: 'Akindele Esther',
    buyerPhone: '+2348030000010',
    total: 60000,
    status: 'DRAFT',
    date: day(-1),
    createdBy: 'Samuel Kuye',
    supplierName: 'SUP-001',
    lines: [{ stockItemId: 'STK-05', name: 'Folding Chair', quantity: 2, unitPrice: 18500 }, { stockItemId: 'STK-04', name: 'Science Calculator', quantity: 2, unitPrice: 12500 }],
  },
];
saleSeq = sales.length;

let inventorySettings: InventorySettings = { defaultReorderLevel: 5 };

/* ── store ─────────────────────────────────────────────────────────────── */

/**
 * The cart the mock owns.
 *
 * It is a module-level array rather than panel state on purpose: checkout is a
 * transaction against it, so a component that held the lines itself could not
 * have had a server-side cart to check out against. `cartSnapshot` derives the
 * total from the lines so the two can never disagree.
 */
const cart: CartLine[] = [];
const cartSnapshot = (): StoreCart => ({
  items: cart.map((line) => ({ ...line })),
  total: cart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
});

let orderSeq = 2;
const orders: StoreOrder[] = [
  {
    id: 'ORD-001',
    orderNo: 'ORD-2026-0001',
    customerName: 'Nicegene Technologies',
    date: '16 Sept 2026, 08:55',
    total: 20000,
    status: 'AWAITING_PAYMENT',
    lines: [{ stockItemId: 'STK-03', name: 'Uniform', quantity: 1, unitPrice: 20000 }],
  },
  {
    id: 'ORD-002',
    orderNo: 'ORD-2026-0002',
    customerName: 'Nicegene Technologies',
    date: '16 Sept 2026, 09:02',
    total: 3000,
    status: 'AWAITING_PAYMENT',
    lines: [{ stockItemId: 'STK-02', name: 'Trousers', quantity: 1, unitPrice: 3000 }],
  },
  {
    id: 'ORD-003',
    orderNo: 'ORD-2026-0003',
    customerName: 'Sarah Afia-Ilevbare',
    date: day(-2),
    total: 11500,
    status: 'CONFIRMED',
    lines: [
      { stockItemId: 'STK-04', name: 'Science Calculator', quantity: 1, unitPrice: 12500 },
      { stockItemId: 'STK-01', name: 'Sports wear', quantity: 1, unitPrice: 8000 },
    ],
  },
  {
    id: 'ORD-004',
    orderNo: 'ORD-2026-0004',
    customerName: 'Akindele Esther',
    date: day(-1),
    total: 8000,
    status: 'REFUND_PENDING',
    lines: [{ stockItemId: 'STK-01', name: 'Sports wear', quantity: 1, unitPrice: 8000 }],
  },
];
/* Seeded to the seed, so a checkout cannot mint an id that already exists.
   It read 2 — left over from when only two orders were seeded — and so the
   first order placed came out as `ORD-2026-0003`, colliding with a seeded
   order of that number: the queue gained a row the panel's `:key` then
   rendered against the wrong record, and the two were indistinguishable on
   screen. Derived rather than restated, so adding a seed order cannot
   reintroduce it. */
orderSeq = orders.length;

/* ── fees ──────────────────────────────────────────────────────────────── */

let feeCategorySeq = 0;
const feeCategories: FeeCategory[] = [
  ['Development Levy', 'School development levy'],
  ['Hostel', 'Boarding/hostel accommodation'],
  ['Others', 'Miscellaneous payments'],
  ['PTA Levy', 'Parent-Teacher Association levy'],
  ['Tuition', 'Termly tuition fee'],
  ['Uniform', 'School uniform and attire'],
].map(([name, description], i) => {
  feeCategorySeq += 1;
  return { id: `FCAT-${String(i + 1).padStart(2, '0')}`, name: name!, description: description!, status: 'ACTIVE', createdAt: `7 Sept 2026` };
});

let feeItemSeq = 0;
const feeItems: FeeItem[] = [
  ['JSS 1 Tuition', 'FCAT-05', 120000, 'JSS 1'],
  ['JSS 2 Tuition', 'FCAT-05', 120000, 'JSS 2'],
  ['SS 1 Tuition', 'FCAT-05', 145000, 'SS 1'],
  ['Boarding Accommodation', 'FCAT-02', 90000, 'SS 1'],
  ['School Uniform (Set)', 'FCAT-06', 25000, 'JSS 1'],
  ['PTA Levy', 'FCAT-04', 15000, 'JSS 1'],
].map(([description, categoryId, amount, className], i) => {
  feeItemSeq += 1;
  const category = feeCategories.find((c) => c.id === categoryId);
  return {
    id: `FITM-${String(i + 1).padStart(2, '0')}`,
    description: String(description),
    categoryId: String(categoryId),
    categoryName: category?.name ?? '',
    amount: Number(amount),
    academicSession: '2026/2027',
    term: 'First',
    classId: classes.find((c) => c.name === className)?.id ?? '',
    className: String(className),
  };
});

let feePaymentSeq = 0;
const feePayments: FeePayment[] = [
  ['PAY-2026-0001', students[0].id, full(students[0].firstName, students[0].lastName), 120000, 'Card', 'CONFIRMED', -12],
  ['PAY-2026-0002', students[2].id, full(students[2].firstName, students[2].lastName), 145000, 'Transfer', 'CONFIRMED', -9],
  ['PAY-2026-0003', students[4].id, full(students[4].firstName, students[4].lastName), 90000, 'Card', 'PENDING', -2],
  ['PAY-2026-0004', students[7].id, full(students[7].firstName, students[7].lastName), 15000, 'Cash', 'FAILED', -5],
].map(([reference, studentId, studentName, amount, method, status, offset], i) => {
  feePaymentSeq += 1;
  return {
    id: `FP-${String(i + 1).padStart(3, '0')}`,
    reference: String(reference),
    studentId: String(studentId),
    studentName: String(studentName),
    className: students.find((s) => s.id === studentId)?.className ?? '',
    amount: Number(amount),
    method: String(method),
    status: status as FeePayment['status'],
    academicSession: '2026/2027',
    term: 'First',
    paidAt: stamp(Number(offset)),
  };
});

/* ── wallets ───────────────────────────────────────────────────────────── */

let walletSeq = 0;
const wallets: StudentWallet[] = students.slice(0, 8).map((student, i) => {
  walletSeq += 1;
  return {
    id: `WLT-${String(i + 1).padStart(3, '0')}`,
    studentId: student.id,
    studentName: full(student.firstName, student.lastName),
    admissionNo: student.admissionNo,
    className: student.className,
    balance: i < 3 ? 0 : (i + 1) * 2500,
    threshold: 1000,
    status: 'ACTIVE',
  };
});

let txnSeq = 0;
const WALLET_TXN_SEED: ReadonlyArray<
  readonly [number, 'TOPUP' | 'DEDUCT', number, string, number]
> = [
  [3, 'TOPUP', 10000, 'Allowance for first term', -14],
  [3, 'DEDUCT', 2500, 'Textbooks', -11],
  [4, 'TOPUP', 7500, 'Allowance for first term', -10],
  [5, 'TOPUP', 5000, 'Allowance for first term', -9],
  [5, 'DEDUCT', 1200, 'School uniform', -6],
  [6, 'DEDUCT', 900, 'Meal card top-up', -3],
];
const walletTransactions: WalletTransaction[] = WALLET_TXN_SEED.map(([walletIndex, type, amount, note, offset], i) => {
  txnSeq += 1;
  const wallet = wallets[walletIndex];
  return {
    id: `WTX-${String(i + 1).padStart(3, '0')}`,
    walletId: wallet.id,
    studentName: wallet.studentName,
    type,
    amount,
    note,
    confirmed: true,
    createdAt: stamp(offset),
  };
});

/* ── results ───────────────────────────────────────────────────────────── */

let windowSeq = 2;
const uploadWindows: UploadWindow[] = [
  {
    id: 'UW-001',
    title: 'Third Term Academic Results',
    academicSession: '2025/2026',
    term: 'Third',
    status: 'CLOSED',
    startsAt: day(-21),
    endsAt: day(-19),
    teacherIds: [],
  },
  {
    id: 'UW-002',
    title: 'First Term Result',
    academicSession: '2026/2027',
    term: 'First',
    status: 'OPEN',
    startsAt: day(-42),
    endsAt: day(-41),
    teacherIds: staff.slice(0, 8).map((s) => String(s.id)),
  },
  {
    id: 'UW-003',
    title: 'Second Term Result',
    academicSession: '2026/2027',
    term: 'Second',
    status: 'OPEN',
    startsAt: day(10),
    endsAt: day(30),
    teacherIds: staff.slice(0, 5).map((s) => String(s.id)),
  },
];

const grading: GradingSettings = {
  bands: [
    { grade: 'A', minScore: 70, maxScore: 100, label: 'Excellent' },
    { grade: 'B', minScore: 60, maxScore: 69, label: 'Very Good' },
    { grade: 'C', minScore: 50, maxScore: 59, label: 'Good' },
    { grade: 'D', minScore: 40, maxScore: 49, label: 'Fair' },
    { grade: 'F', minScore: 0, maxScore: 39, label: 'Fail' },
  ],
  passMark: 40,
  maxCA: 40,
  maxExam: 60,
};

const gradeFor = (score: number): { grade: string; label: string; remark: string } => {
  const band = grading.bands.find((b) => score >= b.minScore && score <= b.maxScore) ?? grading.bands[grading.bands.length - 1];
  const remark = score >= grading.passMark ? 'Promoted' : 'Not promoted';
  return { grade: band.grade, label: band.label, remark };
};

/** One row per student in the chosen class, with marks derived so totals vary. */
/**
 * One row per student in the chosen class.
 *
 * `term` is part of the signature because the live form's Term selector changes
 * the grid's heading, and a row that did not know its term could not render the
 * `TERM` column the live table carries. It is carried on every row as
 * `academicSession`'s sibling so the caller can render it, and the marks are
 * derived from the row's own index so a class of twenty has twenty distinct
 * totals rather than twenty identical ones.
 */
const buildResultRows = (className: string, session: string, term: string): ResultEntryRow[] => {
  const roster = students.filter((s) => !className || s.className === className);
  const rows = roster.length ? roster : students.slice(0, 5);
  return rows.map((student, i) => {
    const ca1 = 8 + ((i * 3) % 12);
    const ca2 = 4 + ((i * 2) % 6);
    const project = 4 + ((i * 5) % 6);
    const exam = 22 + ((i * 7) % 34);
    return {
      studentId: student.id,
      admissionNo: student.admissionNo,
      surname: student.lastName.toUpperCase(),
      otherNames: student.firstName,
      sex: i % 2 === 0 ? 'M' : 'F',
      studentType: student.category,
      className: student.className,
      academicSession: session,
      /* The live grid's SESSION / TERM header pair comes from the form, not the
         row, so the row carries the term only so a caller can label it. */
      term,
      ca1,
      ca2,
      project,
      exam,
    };
  });
};

let resultRows: ResultEntryRow[] = buildResultRows('JSS 1', '2026/2027', 'First');

let queueSeq = 0;
const resultsQueue: ResultQueueItem[] = [
  {
    id: 'RQ-001',
    title: 'JSS 1 Mathematics — First Term',
    academicSession: '2026/2027',
    term: 'First',
    className: 'JSS 1',
    subjectName: 'Mathematics',
    teacherName: 'Chidinma Nwadike',
    status: 'PENDING',
    submittedAt: stamp(-1),
    declineReason: '',
  },
  {
    id: 'RQ-002',
    title: 'SS 1 English — First Term',
    academicSession: '2026/2027',
    term: 'First',
    className: 'SS 1',
    subjectName: 'English',
    teacherName: 'Sarah Afia-Ilevbare',
    status: 'COMMITTEE_TAGGED',
    submittedAt: stamp(-2),
    declineReason: '',
  },
  {
    id: 'RQ-003',
    title: 'SS 2 Physics — First Term',
    academicSession: '2026/2027',
    term: 'First',
    className: 'SS 2',
    subjectName: 'Physics',
    teacherName: 'Tosin Adejoro',
    status: 'VETTED',
    submittedAt: stamp(-3),
    declineReason: '',
  },
  {
    id: 'RQ-004',
    title: 'JSS 2 Basic Science — First Term',
    academicSession: '2026/2027',
    term: 'First',
    className: 'JSS 2',
    subjectName: 'Basic Science',
    teacherName: 'Mitchell Ipense',
    status: 'PUBLISHED',
    submittedAt: stamp(-6),
    declineReason: '',
  },
  {
    id: 'RQ-005',
    title: 'JSS 3 Mathematics — First Term',
    academicSession: '2026/2027',
    term: 'First',
    className: 'JSS 3',
    subjectName: 'Mathematics',
    teacherName: 'Abayomi Osineye',
    status: 'DECLINED',
    submittedAt: stamp(-8),
    declineReason: 'Two candidates share one admission number. Please re-enter the register.',
  },
];
queueSeq = resultsQueue.length;

let summarySeq = 0;
const studentResults: StudentResultSummary[] = students.slice(0, 10).map((student, i): StudentResultSummary => {
  summarySeq += 1;
  const picks = [subjects[27], subjects[13], subjects[30], subjects[21]];
  const subjectsOut = picks.map((subject, j) => {
    const ca = 12 + ((i + j * 5) % 26);
    const exam = 24 + ((i * 3 + j * 7) % 32);
    const total = ca + exam;
    const g = gradeFor(total);
    return { subjectName: subject.name, ca, exam, total, grade: g.grade, remark: g.label };
  });
  const total = subjectsOut.reduce((n, s) => n + s.total, 0);
  const average = Math.round((total / subjectsOut.length) * 10) / 10;
  const g = gradeFor(average);
  return {
    studentId: student.id,
    admissionNo: student.admissionNo,
    name: full(student.firstName, student.lastName),
    className: student.className,
    armName: student.armName,
    subjects: subjectsOut,
    total,
    average,
    grade: g.grade,
    remark: g.remark,
    attendance: 88 + ((i * 2) % 12),
    position: (i % 5) + 1,
  };
});

/* ── system ────────────────────────────────────────────────────────────── */

let generalSettings: GeneralSettings = {
  schoolName: "Saint Finbarr's College",
  motto: '',
  tagline: '',
  address: 'Akoka, Yaba, Lagos',
  phone: '09092585474',
  email: 'contact@saintfinbarrscollege.com',
  website: 'www.stfinbarrscollegeakoka.com',
  timezone: 'Africa/Lagos',
  locale: 'en-NG',
  currency: 'NGN',
  dateFormat: 'dd/MM/yyyy',
  weekStartsOn: 'Monday',
  academicSession: '2026/2027',
  currentTerm: 'First',
};

let systemConfiguration: SystemConfiguration = {
  sessionTimeoutMinutes: 30,
  maxUploadSizeMb: 25,
  dataRetentionDays: 365,
  maxStudentsPerClass: 60,
  minimumPasswordLength: 10,
  passwordExpiryDays: 90,
  failedAttemptsBeforeLockout: 5,
  lockoutWindowMinutes: 15,
  requireTwoFactor: false,
  maintenanceMode: false,
  maintenanceMessage: '',
  allowedIpAddresses: '',
  databaseName: 'saintfinbarrs-prod',
};

let branding: BrandingSettings = {
  logoUrl: '',
  faviconUrl: '',
  primaryColour: '#1c4e80',
  accentColour: '#c8a24a',
  portalTitle: 'NICEGENE DAILYAPP',
};

let auditSeq = 0;
const auditLogs: AuditLogEntry[] = [
  ['Nicegene Technologies', 'UPDATE', 'Users', 'USR-002', '10.0.0.4', 'SUCCESS', -0],
  ['Nicegene Technologies', 'CREATE', 'Departments', 'DEP-21', '10.0.0.4', 'SUCCESS', -1],
  ['Sarah Afia-Ilevbare', 'SUBMIT', 'Results', 'RQ-001', '10.0.0.21', 'SUCCESS', -1],
  ['Onyedika Nwabunor Dominion', 'UPDATE', 'System', 'general-settings', '10.0.0.9', 'SUCCESS', -2],
  ['Samuel Kuye', 'CREATE', 'Sales', 'SALE-003', '10.0.0.33', 'SUCCESS', -2],
  ['Chidinma Nwadike', 'DELETE', 'Attendance', 'WK-09', '10.0.0.21', 'FAILED', -3],
  ['Akindele Esther', 'APPROVE', 'Lesson plans', 'LP-0004', '10.0.0.17', 'SUCCESS', -4],
].map(([actor, action, module, target, ipAddress, status, offset], i) => {
  auditSeq += 1;
  return {
    id: `AUD-${String(i + 1).padStart(4, '0')}`,
    timestamp: stamp(Number(offset)),
    actor: String(actor),
    action: String(action),
    module: String(module),
    target: String(target),
    ipAddress: String(ipAddress),
    status: status as AuditLogEntry['status'],
  };
});

let backupSeq = 0;
const backups: BackupRecord[] = [
  {
    id: 'BK-001',
    name: 'nightly-2026-10-06',
    type: 'SCHEDULED',
    size: '412 MB',
    status: 'COMPLETED',
    createdAt: stamp(-1),
    createdBy: 'Scheduler',
    retention: '30 days',
  },
  {
    id: 'BK-002',
    name: 'pre-upgrade-2026-09-30',
    type: 'MANUAL',
    size: '398 MB',
    status: 'COMPLETED',
    createdAt: stamp(-7),
    createdBy: 'Nicegene Technologies',
    retention: '90 days',
  },
];
backupSeq = backups.length;

const featureToggles: FeatureToggle[] = [
  ['store.enabled', 'School Store', 'Sell uniform and school supplies online.', true],
  ['wallet.enabled', 'Student Wallets', 'Allow parents to fund a student wallet.', true],
  ['counselling.enabled', 'Guidance & Counselling', 'Referrals, committees and session reports.', true],
  ['disciplinary.enabled', 'Disciplinary', 'Incident types, committees and case reports.', true],
  ['results.committee', 'Results Committee', 'Tag results to a committee for review before publishing.', false],
  ['attendance.sms', 'SMS attendance alerts', 'Send an SMS to guardians when a student is absent.', false],
  ['store.payments', 'Online store payments', 'Accept online payment for store orders.', false],
  ['import.bulk', 'Bulk imports', 'Excel and CSV import for students and staff.', true],
].map(([key, label, description, enabled], i) => ({ id: `FT-${String(i + 1).padStart(2, '0')}`, key: String(key), label: String(label), description: String(description), enabled: Boolean(enabled) }));

/* ── dashboard ─────────────────────────────────────────────────────────── */

const dashboardSections = (): DashboardSection[] => [
  {
    key: 'school',
    title: 'School Overview',
    description: 'Live counts from your database.',
    stats: [
      { key: 'students', label: 'All Students', value: String(students.length), href: '/admin/?panel=students' },
      { key: 'day', label: 'Day Students', value: String(students.filter((s) => s.category === 'DAY').length), href: '/admin/?panel=students&category=DAY' },
      { key: 'boarding', label: 'Boarding Students', value: String(students.filter((s) => s.category === 'BOARDING').length), href: '/admin/?panel=students&category=BOARDING' },
      { key: 'staff', label: 'Staff', value: String(staff.length), href: '/admin/?panel=staff' },
      { key: 'parents', label: 'Parents', value: String(parents.length), href: '/admin/?panel=parents' },
      { key: 'users', label: 'Active Users', value: String(users.length), href: '/admin/?panel=users' },
      { key: 'invitations', label: 'Pending Invitations', value: String(users.filter((u) => u.status === 'invited').length), href: '/admin/?panel=users' },
      { key: 'unread', label: 'Unread Notifications', value: '0', href: '/admin/?panel=notifications' },
    ],
  },
  {
    key: 'hr',
    title: 'Staff & HR',
    description: 'Workforce overview: headcount, attendance and pending leave.',
    stats: [
      { key: 'departments', label: 'Departments', value: String(departments.length), href: '/admin/?panel=departments' },
      { key: 'designations', label: 'Designations', value: String(designations.length), href: '/admin/?panel=designations' },
      { key: 'attendance', label: 'Attendance', value: String(sheets.filter((s) => s.category === 'staff').length), href: '/admin/?panel=staff-attendance' },
      { key: 'leave', label: 'Leave Requests', value: String(leave.filter((l) => l.status === 'PENDING').length), secondary: `${leave.length} total`, href: '/admin/?panel=leave' },
      { key: 'queries', label: 'Queries', value: String(queries.filter((q) => q.status !== 'ARCHIVED').length), secondary: `${queries.length} total`, href: '/admin/?panel=hr-queries' },
      { key: 'awards', label: 'Awards', value: String(awards.length), href: '/admin/?panel=awards' },
    ],
  },
  {
    key: 'teaching',
    title: 'Teaching',
    description: 'Your lessons, reports and communications.',
    stats: [
      { key: 'lessonPlans', label: 'Lesson Plans', value: '0', href: '/admin/?panel=lesson-plans' },
      { key: 'weeklyReports', label: 'Weekly Reports', value: '0', href: '/admin/?panel=weekly-reports' },
      { key: 'messages', label: 'Messages', value: '0', href: '/admin/?panel=messaging' },
      { key: 'notifications', label: 'Notifications', value: '0', href: '/admin/?panel=notifications' },
    ],
  },
  {
    key: 'inventory',
    title: 'Inventory',
    description: 'Stock, sales and assets overview.',
    stats: [
      { key: 'items', label: 'Total Items', value: String(stock.length), href: '/admin/?panel=stock' },
      { key: 'low', label: 'Low Stock', value: String(stock.filter((s) => s.status === 'LOW_STOCK').length), href: '/admin/?panel=stock' },
      { key: 'out', label: 'Out of Stock', value: String(stock.filter((s) => s.status === 'OUT_OF_STOCK').length), href: '/admin/?panel=stock' },
      { key: 'revenue', label: 'Sales Revenue', value: money(sales.filter((s) => s.status === 'RELEASED').reduce((n, s) => n + s.total, 0)), href: '/admin/?panel=sales' },
      { key: 'pendingSales', label: 'Pending Sales', value: String(sales.filter((s) => s.status === 'DRAFT' || s.status === 'PAYMENT_CONFIRMED').length), href: '/admin/?panel=sales' },
      { key: 'assets', label: 'Assets', value: String(assets.length), href: '/admin/?panel=assets' },
    ],
  },
  {
    key: 'results',
    title: 'Results Management',
    description: 'Upload windows, the queue and published results.',
    stats: [
      { key: 'windows', label: 'Open Windows', value: String(uploadWindows.filter((w) => w.status === 'OPEN').length), href: '/admin/?panel=upload-windows' },
      { key: 'queue', label: 'In Queue', value: String(resultsQueue.filter((q) => q.status !== 'PUBLISHED' && q.status !== 'DECLINED').length), href: '/admin/?panel=results-queue' },
      { key: 'published', label: 'Published', value: String(resultsQueue.filter((q) => q.status === 'PUBLISHED').length), href: '/admin/?panel=student-results' },
    ],
  },
  {
    key: 'finance',
    title: 'Fees & Wallets',
    description: 'Collections, pending payments and wallet liability.',
    stats: [
      { key: 'collected', label: 'Fees Collected', value: money(feePayments.filter((p) => p.status === 'CONFIRMED').reduce((n, p) => n + p.amount, 0)), href: '/admin/?panel=fee-payments' },
      { key: 'pendingFees', label: 'Pending Payments', value: String(feePayments.filter((p) => p.status === 'PENDING').length), href: '/admin/?panel=fee-payments' },
      { key: 'wallets', label: 'Active Wallets', value: String(wallets.filter((w) => w.status === 'ACTIVE').length), href: '/admin/?panel=wallets' },
      { key: 'liability', label: 'Wallet Liability', value: money(wallets.reduce((n, w) => n + w.balance, 0)), href: '/admin/?panel=wallet-reports' },
    ],
  },
];

const quickActions: QuickAction[] = [
  { label: 'Add Student & Parent', description: 'Enrol a student and create their parent', href: '/admin/?panel=students&action=create' },
  { label: 'Add Staff', description: 'Create a staff record', href: '/admin/?panel=staff&action=create' },
  { label: 'Send Message', description: 'Start a chat or direct message', href: '/admin/?panel=messaging' },
  { label: 'Tenant Settings', description: 'Branding, defaults and profile', href: '/admin/?panel=general-settings' },
  { label: 'Academic Sessions', description: 'Sessions and terms', href: '/admin/?panel=sessions' },
  { label: 'Roles', description: 'Roles and access levels', href: '/admin/?panel=roles' },
  { label: 'Permissions', description: 'Granular access control', href: '/admin/?panel=permissions' },
  { label: 'Imports', description: 'Students and staff imports', href: '/admin/?panel=students' },
  { label: 'Classes & Arms', description: 'Manage classes and sections', href: '/admin/?panel=classes' },
  { label: 'Subjects', description: 'Manage subjects', href: '/admin/?panel=subjects' },
  { label: 'Timetable', description: 'Manage timetables', href: '/admin/?panel=timetables' },
  { label: 'Notice Board', description: 'Post and manage notices', href: '/admin/?panel=notices' },
  { label: 'Create Lesson Plan', description: 'Write a new lesson plan', href: '/teacher/?panel=lesson-plans' },
  { label: 'My Lesson Plans', description: 'View and manage your plans', href: '/teacher/?panel=lesson-plans' },
  { label: 'Create Weekly Report', description: 'Submit a weekly report', href: '/teacher/?panel=weekly-reports' },
  { label: 'Inventory Reports', description: 'Stock, sales and asset reports', href: '/admin/?panel=inventory-reports' },
  { label: 'Stock Overview', description: 'View and manage stock items', href: '/admin/?panel=stock' },
  { label: 'Sales & Invoicing', description: 'Create and manage sales', href: '/admin/?panel=sales' },
  { label: 'Assets', description: 'Manage school assets', href: '/admin/?panel=assets' },
  { label: 'Messaging', description: 'Chat with teachers, staff and parents', href: '/admin/?panel=messaging' },
  { label: 'Notifications', description: 'View all notifications', href: '/admin/?panel=notifications' },
];

/* ── lookups the generic panel needs for its option lists ──────────────── */

const optionLists: Record<string, Array<{ value: string; label: string }>> = {
  roles: roles.map((r) => ({ value: r.name, label: r.name })),
  staff: staffOptions,
  classes: classes.map((c) => ({ value: c.name, label: c.name })),
  arms: arms.map((a) => ({ value: a.name, label: `${a.className} · ${a.name}` })),
  subjects: subjects.map((s) => ({ value: s.name, label: s.name })),
  'inventory-categories': inventoryCategories.map((c) => ({ value: c.name, label: c.name })),
  'fee-categories': feeCategories.map((c) => ({ value: c.name, label: c.name })),
  suppliers: suppliers.map((s) => ({ value: s.name, label: s.name })),
  'award-types': awardTypes.map((a) => ({ value: a, label: a })),
};

/* ── the resource store ────────────────────────────────────────────────── */

type Collection = Array<Record<string, unknown> & { id: string }>;

interface CollectionEntry {
  rows: Collection;
  /** Newest-first, and the counter the id generator continues from. */
  prefix: string;
  seq: number;
  /** Recomputes a derived field after a write, e.g. a stock item's availability. */
  normalise?: (row: Record<string, unknown>) => void;
}

const nextId = (entry: CollectionEntry): string => {
  entry.seq += 1;
  return `${entry.prefix}-${String(entry.seq).padStart(3, '0')}`;
};

/**
 * Adapts a typed seed array to the store's loose row type.
 *
 * The seeds are declared with their own interfaces (`Department`, `FeePayment`,
 * …), which have no index signature, so TypeScript will not let them be
 * `Record<string, unknown>` directly. The cast is through `unknown` for that
 * reason alone: the store's contract is "a row with an `id` and arbitrary
 * fields", and every seed satisfies it. Nothing here converts a value.
 */
const asCollection = (rows: unknown[]): Collection => rows as unknown as Collection;

/** Every list the generic panel can read and write, by resource key. */
const store: Record<string, CollectionEntry> = {
  users: { rows: asCollection(users), prefix: 'USR', seq: userSeq },
  roles: { rows: asCollection(roles), prefix: 'ROL', seq: roles.length },
  staff: { rows: asCollection(staff), prefix: 'STF', seq: staffSeq },
  departments: { rows: asCollection(departments), prefix: 'DEP', seq: departments.length },
  designations: { rows: asCollection(designations), prefix: 'DSG', seq: designations.length },
  students: { rows: asCollection(students), prefix: 'STU', seq: studentSeq },
  parents: { rows: asCollection(parents), prefix: 'PAR', seq: parentSeq },
  sessions: { rows: asCollection(sessions), prefix: 'SES', seq: sessions.length },
  classes: { rows: asCollection(classes), prefix: 'CLS', seq: classes.length },
  arms: { rows: asCollection(arms), prefix: 'ARM', seq: arms.length },
  subjects: { rows: asCollection(subjects), prefix: 'SUB', seq: subjects.length },
  timetables: { rows: asCollection(timetables), prefix: 'TT', seq: timetableSeq },
  assignments: { rows: asCollection(assignments), prefix: 'AS', seq: assignmentSeq },
  'class-teachers': { rows: asCollection(classTeachers), prefix: 'CT', seq: classTeacherSeq },
  'subject-teachers': { rows: asCollection(subjectTeachers), prefix: 'ST', seq: subjectTeacherSeq },
  leave: { rows: asCollection(leave), prefix: 'LV', seq: leaveSeq },
  'hr-queries': { rows: asCollection(queries), prefix: 'HQ', seq: querySeq },
  awards: { rows: asCollection(awards), prefix: 'AW', seq: awardSeq },
  stock: {
    rows: asCollection(stock),
    prefix: 'STK',
    seq: stockSeq,
    normalise: (row) => {
      const inStock = num(row.inStock);
      const reserved = num(row.reserved);
      const available = inStock - reserved;
      row.available = available;
      row.status = available <= 0 ? 'OUT_OF_STOCK' : available <= num(row.reorderLevel) ? 'LOW_STOCK' : 'IN_STOCK';
    },
  },
  'inventory-categories': { rows: asCollection(inventoryCategories), prefix: 'ICAT', seq: inventoryCategorySeq },
  'clinic-stock': { rows: asCollection(clinicStock), prefix: 'CLN', seq: clinicSeq },
  suppliers: { rows: asCollection(suppliers), prefix: 'SUP', seq: supplierSeq },
  assets: { rows: asCollection(assets), prefix: 'AST', seq: assetSeq },
  sales: { rows: asCollection(sales), prefix: 'SALE', seq: saleSeq },
  'fee-categories': { rows: asCollection(feeCategories), prefix: 'FCAT', seq: feeCategorySeq },
  'fee-items': { rows: asCollection(feeItems), prefix: 'FITM', seq: feeItemSeq },
  'fee-payments': { rows: asCollection(feePayments), prefix: 'FP', seq: feePaymentSeq },
  wallets: { rows: asCollection(wallets), prefix: 'WLT', seq: walletSeq },
  'upload-windows': { rows: asCollection(uploadWindows), prefix: 'UW', seq: windowSeq },
  'results-queue': { rows: asCollection(resultsQueue), prefix: 'RQ', seq: queueSeq },
  'student-results': { rows: asCollection(studentResults), prefix: 'SR', seq: summarySeq },
  'audit-logs': { rows: asCollection(auditLogs), prefix: 'AUD', seq: auditSeq },
  backups: { rows: asCollection(backups), prefix: 'BK', seq: backupSeq },
  'feature-toggles': { rows: asCollection(featureToggles), prefix: 'FT', seq: featureToggles.length },
  'store-items': { rows: asCollection(stock), prefix: 'STK', seq: stockSeq },
  'store-queue': { rows: asCollection(orders), prefix: 'ORD', seq: orderSeq },
  orders: { rows: asCollection(orders), prefix: 'ORD', seq: orderSeq },
  notices: { rows: asCollection(notices), prefix: 'NT', seq: noticeSeq },
  events: { rows: asCollection(events), prefix: 'EV', seq: eventSeq },
  calendar: { rows: asCollection(calendar), prefix: 'CAL', seq: calendarSeq },
};

/* ── filtering, sorting, paging ────────────────────────────────────────── */

const searchHaystack = (row: Record<string, unknown>): string =>
  Object.entries(row)
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
    .map(([, v]) => String(v))
    .join(' ')
    .toLowerCase();

const applyListQuery = (req: Req, rows: Collection): Collection => {
  const search = trimmed(req.search).toLowerCase();
  const filters = (req.filters ?? {}) as Record<string, string>;
  const page = Math.max(1, num(req.page, 1));
  const limit = Math.max(1, num(req.limit, 50));
  const sort = trimmed(req.sort);
  const dir = trimmed(req.dir) === 'desc' ? -1 : 1;

  let out = rows;
  if (search) out = out.filter((row) => searchHaystack(row).includes(search));
  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue;
    out = out.filter((row) => {
      const actual = row[key];
      if (Array.isArray(actual)) return actual.map(String).includes(value);
      return String(actual ?? '') === value;
    });
  }
  if (sort) {
    out = [...out].sort((a, b) => {
      const av = a[sort];
      const bv = b[sort];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
    });
  }
  const total = out.length;
  const start = (page - 1) * limit;
  return out.slice(start, start + limit).map((row) => ({ ...row, __total: total }));
};

/* ── the handlers ──────────────────────────────────────────────────────── */

const logAction = (actor: string, action: string, module: string, target: string): void => {
  auditSeq += 1;
  store['audit-logs'].seq = auditSeq;
  const row: AuditLogEntry = {
    id: `AUD-${String(auditSeq).padStart(4, '0')}`,
    timestamp: new Date().toISOString(),
    actor,
    action,
    module,
    target,
    ipAddress: '127.0.0.1',
    status: 'SUCCESS',
  };
  (store['audit-logs'].rows as Collection).unshift(row as unknown as Collection[number]);
};

export type AdminHandlers = Record<string, (req: Req) => AnyRes>;

const handlers: AdminHandlers = {
  /* ── the generic list / record engine ───────────────────────────────── */

  LIST_ADMIN_RECORDS: (req) => {
    const resource = trimmed(req.resource);
    const entry = store[resource];
    if (!entry) return { status: 'error', message: `Unknown resource: ${resource}` };
    const rows = applyListQuery(req, entry.rows);
    const first = rows[0] as (Record<string, unknown> & { __total?: number }) | undefined;
    return {
      ...ok(`Read ${rows.length} record(s) (mock).`),
      records: rows,
      total: first?.__total ?? entry.rows.length,
      page: num(req.page, 1),
      limit: num(req.limit, 50),
    };
  },

  GET_ADMIN_RECORD: (req) => {
    const resource = trimmed(req.resource);
    const entry = store[resource];
    if (!entry) return { status: 'error', message: `Unknown resource: ${resource}` };
    const row = entry.rows.find((r) => r.id === trimmed(req.id));
    return row ? { ...ok('Record retrieved (mock).'), record: row } : { status: 'error', message: 'Record not found (mock).' };
  },

  SAVE_ADMIN_RECORD: (req) => {
    const resource = trimmed(req.resource);
    const entry = store[resource];
    if (!entry) return { status: 'error', message: `Unknown resource: ${resource}` };
    const payload = (req.record ?? {}) as Record<string, unknown>;
    const id = trimmed(req.id);
    const actor = trimmed(req.actor) || 'Nicegene Technologies';

    if (id) {
      const index = entry.rows.findIndex((r) => r.id === id);
      if (index < 0) return { status: 'error', message: 'Record not found (mock).' };
      const merged = { ...entry.rows[index], ...payload, id };
      entry.normalise?.(merged);
      entry.rows[index] = merged;
      logAction(actor, 'UPDATE', resource, id);
      return { ...ok('Saved (mock).'), record: merged };
    }

    const created: Record<string, unknown> & { id: string } = {
      ...payload,
      id: trimmed(payload.id) || nextId(entry),
    };
    /* The people-shaped resources carry a computed display name and initials
       rather than storing them, because that is what the live tables render and
       a name that can drift out of sync with its parts is a defect. */
    if (created.firstName !== undefined || created.lastName !== undefined) {
      created.fullName = full(String(created.firstName ?? ''), String(created.lastName ?? ''));
      created.initials = name2initials(String(created.firstName ?? ''), String(created.lastName ?? ''));
    }
    if (resource === 'users' || resource === 'staff') {
      created.lastLogin = created.lastLogin ?? 'Never';
      created.status = created.status ?? 'invited';
      created.joined = created.joined ?? day();
      if (!created.staffNo && resource === 'staff') created.staffNo = `SFC${String(200 + entry.rows.length + 1)}`;
    }
    if (resource === 'stock' || resource === 'clinic-stock') entry.normalise?.(created);
    entry.rows.unshift(created);
    logAction(actor, 'CREATE', resource, String(created.id));
    return { ...ok('Created (mock).'), record: created };
  },

  DELETE_ADMIN_RECORD: (req) => {
    const resource = trimmed(req.resource);
    const entry = store[resource];
    if (!entry) return { status: 'error', message: `Unknown resource: ${resource}` };
    const id = trimmed(req.id);
    const index = entry.rows.findIndex((r) => r.id === id);
    if (index < 0) return { status: 'error', message: 'Record not found (mock).' };
    entry.rows.splice(index, 1);
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'DELETE', resource, id);
    return ok('Deleted (mock).');
  },

  /** Approve / reject / resolve: one verb set over several resources. */
  ADMIN_DECIDE: (req) => {
    const resource = trimmed(req.resource);
    const entry = store[resource];
    if (!entry) return { status: 'error', message: `Unknown resource: ${resource}` };
    const id = trimmed(req.id);
    const row = entry.rows.find((r) => r.id === id);
    if (!row) return { status: 'error', message: 'Record not found (mock).' };

    const decision = trimmed(req.decision).toUpperCase();
    if (resource === 'leave') {
      if (decision !== 'APPROVED' && decision !== 'REJECTED') {
        return { status: 'error', message: 'Leave decision must be APPROVED or REJECTED.' };
      }
      row.status = decision;
      row.decisionComment = trimmed(req.comment);
    } else if (resource === 'hr-queries') {
      row.status = decision === 'REJECTED' ? 'ARCHIVED' : 'RESOLVED';
      row.response = trimmed(req.comment) || row.response;
    } else {
      row.status = decision;
    }
    logAction(trimmed(req.actor) || 'Nicegene Technologies', decision, resource, id);
    return { ...ok(`${decision} (mock).`), record: row };
  },

  ADMIN_SET_STATUS: (req) => {
    const resource = trimmed(req.resource);
    const entry = store[resource];
    if (!entry) return { status: 'error', message: `Unknown resource: ${resource}` };
    const row = entry.rows.find((r) => r.id === trimmed(req.id));
    if (!row) return { status: 'error', message: 'Record not found (mock).' };
    row.status = trimmed(req.status);
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'STATUS', resource, String(row.id));
    return { ...ok('Status updated (mock).'), record: row };
  },

  RESEND_INVITATION: (req) => {
    const ids = (req.userIds ?? []) as string[];
    if (ids.length === 0) return { status: 'error', message: 'Select at least one account.' };
    return ok(`Invitation resent to ${ids.length} account(s) (mock).`);
  },

  /* ── roles and permissions ───────────────────────────────────────────── */

  SAVE_ADMIN_ROLE: (req) => {
    const name = trimmed(req.name);
    if (!name) return { status: 'error', message: 'Role name is required.' };
    const entry = store.roles;
    const id = trimmed(req.id);
    const permissionIdsIn = (req.permissionIds ?? []) as string[];

    if (id) {
      const row = entry.rows.find((r) => r.id === id);
      if (!row) return { status: 'error', message: 'Role not found (mock).' };
      row.name = name;
      row.description = trimmed(req.description);
      rolePermissionIds.set(id, permissionIdsIn);
      row.permissions = permissionIdsIn.length;
      logAction(trimmed(req.actor) || 'Nicegene Technologies', 'UPDATE', 'roles', id);
      return { ...ok('Role saved (mock).'), role: row };
    }

    const created: PortalRole = {
      id: nextId(entry),
      name,
      description: trimmed(req.description),
      users: 0,
      permissions: permissionIdsIn.length,
    };
    /* `PortalRole` has no index signature, so it does not satisfy the store's
       loose row type directly. The cast is `unknown` for that reason alone; the
       object shape is unchanged and the panel reads it back through the same
       `Record<string, unknown>` view every other registry row is read through. */
    entry.rows.push(created as unknown as Collection[number]);
    rolePermissionIds.set(created.id, permissionIdsIn);
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'CREATE', 'roles', created.id);
    return { ...ok('Role created (mock).'), role: created };
  },

  ASSIGN_ROLE: (req) => {
    const roleName = trimmed(req.role);
    const userIds = (req.userIds ?? []) as string[];
    if (!roleName) return { status: 'error', message: 'Select a role.' };
    if (userIds.length === 0) return { status: 'error', message: 'Select at least one user.' };
    for (const uid of userIds) {
      const user = users.find((u) => u.id === uid);
      if (user && !user.roles.includes(roleName)) user.roles.push(roleName);
    }
    const role = roles.find((r) => r.name === roleName);
    if (role) role.users = users.filter((u) => u.roles.includes(roleName)).length;
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'ASSIGN', 'roles', roleName);
    return ok(`Assigned ${roleName} to ${userIds.length} user(s) (mock).`);
  },

  UNASSIGN_ROLE: (req) => {
    const roleName = trimmed(req.role);
    const userIds = (req.userIds ?? []) as string[];
    if (!roleName) return { status: 'error', message: 'Select a role.' };
    if (userIds.length === 0) return { status: 'error', message: 'Select at least one user.' };
    for (const uid of userIds) {
      const user = users.find((u) => u.id === uid);
      if (user) user.roles = user.roles.filter((r) => r !== roleName);
    }
    const role = roles.find((r) => r.name === roleName);
    if (role) role.users = users.filter((u) => u.roles.includes(roleName)).length;
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'UNASSIGN', 'roles', roleName);
    return ok(`Unassigned ${roleName} from ${userIds.length} user(s) (mock).`);
  },

  GET_ADMIN_PERMISSION_MATRIX: (req) => {
    const scope = trimmed(req.scope) || 'role';
    if (scope === 'role') {
      return {
        ...ok('Role permission matrix retrieved (mock).'),
        permissions: permissionIds,
        rows: roles.map((role) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          users: role.users,
          permissionIds: rolePermissionIds.get(role.id) ?? [],
        })),
      };
    }
    return {
      ...ok('User permission matrix retrieved (mock).'),
      permissions: permissionIds,
      rows: users.map((user) => ({
        id: user.id,
        name: full(user.firstName, user.lastName),
        description: user.email,
        users: 0,
        permissionIds: userPermissionIds.get(user.id) ?? [],
      })),
      total: users.length,
    };
  },

  SAVE_ADMIN_PERMISSION_GRANT: (req) => {
    const scope = trimmed(req.scope) || 'role';
    const id = trimmed(req.id);
    const permissionIdsIn = (req.permissionIds ?? []) as string[];
    const target = scope === 'role' ? rolePermissionIds : userPermissionIds;
    if (!target.has(id)) return { status: 'error', message: 'Row not found (mock).' };
    target.set(id, permissionIdsIn);
    if (scope === 'role') {
      const role = roles.find((r) => r.id === id);
      if (role) role.permissions = permissionIdsIn.length;
    }
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'GRANT', 'permissions', id);
    return ok(`Saved ${permissionIdsIn.length} permission(s) (mock).`);
  },

  /* ── imports ─────────────────────────────────────────────────────────── */

  IMPORT_STAFF: () => ({ ...ok('Import staged (mock).'), step: 1, headers: ['Staff ID', 'First Name', 'Last Name', 'Mobile Number', 'Email', 'Role'], required: ['Staff ID', 'First Name', 'Last Name', 'Mobile Number', 'Email', 'Role'], optional: ['Gender', 'Date of Birth', 'Current Address'] }),

  IMPORT_STUDENTS: () => ({ ...ok('Import staged (mock).'), step: 1, headers: ['Student First Name', 'Student Last Name', 'Class', 'Arm', 'Student Category', 'Guardian First Name', 'Guardian Last Name', 'Guardian Email', 'Guardian Phone', 'Guardian Address'], required: ['Student First Name', 'Student Last Name', 'Class', 'Arm', 'Student Category', 'Guardian First Name', 'Guardian Last Name', 'Guardian Email', 'Guardian Phone', 'Guardian Address'], optional: ['Admission No', 'Academic Session', 'Student Email', 'Student Phone', 'Date of Birth', 'Guardian Relationship', 'Guardian Occupation'] }),

  CONFIRM_IMPORT: (req) => {
    const resource = trimmed(req.resource) === 'staff' ? 'staff' : 'students';
    const rows = (req.rows ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) return { status: 'error', message: 'There is nothing to import.' };
    return ok(`Imported ${rows.length} ${resource === 'staff' ? 'staff' : 'student'} record(s) (mock).`);
  },

  /* ── attendance ──────────────────────────────────────────────────────── */

  GET_ADMIN_ATTENDANCE_SHEETS: (req) => {
    const category = trimmed(req.category);
    const rows = category ? sheets.filter((s) => s.category === category) : sheets;
    return { ...ok('Sheets retrieved (mock).'), sheets: rows };
  },

  SAVE_ATTENDANCE_SHEET: (req) => {
    const id = trimmed(req.sheetId);
    if (id) {
      const sheet = sheets.find((s) => s.id === id);
      if (!sheet) return { status: 'error', message: 'Sheet not found (mock).' };
      const week = (req.week ?? {}) as Record<string, unknown>;
      sheet.weeks.push({
        id: `WK-${String(sheet.weeks.length + 1).padStart(2, '0')}`,
        label: trimmed(week.label) || `Week ${sheet.weeks.length + 1}`,
        date: trimmed(week.date) || day(),
        marks: (week.marks ?? {}) as Record<string, AttendanceMark>,
      });
      logAction(trimmed(req.actor) || 'Nicegene Technologies', 'UPDATE', 'attendance', id);
      return { ...ok('Week added (mock).'), sheet };
    }
    const category = trimmed(req.category) === 'student' ? 'student' : 'staff';
    const created: AttendanceSheet = {
      id: `SHT-${category === 'staff' ? 'STAFF' : 'STU'}-${String(sheets.length + 1).padStart(2, '0')}`,
      title: trimmed(req.title) || (category === 'staff' ? 'Staff Attendance' : trimmed(req.className)),
      category,
      term: trimmed(req.term),
      academicSession: trimmed(req.academicSession),
      classId: trimmed(req.classId),
      className: trimmed(req.className),
      weeks: [],
    };
    sheets.push(created);
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'CREATE', 'attendance', created.id);
    return { ...ok('Sheet created (mock).'), sheet: created };
  },

  SAVE_ATTENDANCE_MARKS: (req) => {
    const sheet = sheets.find((s) => s.id === trimmed(req.sheetId));
    if (!sheet) return { status: 'error', message: 'Sheet not found (mock).' };
    const week = sheet.weeks.find((w) => w.id === trimmed(req.weekId));
    if (!week) return { status: 'error', message: 'Week not found (mock).' };
    const marks = (req.marks ?? {}) as Record<string, AttendanceMark>;
    let updated = 0;
    for (const [personId, value] of Object.entries(marks)) {
      if (!['present', 'absent', 'unmarked'].includes(value)) continue;
      week.marks[personId] = value;
      updated += 1;
    }
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'MARK', 'attendance', sheet.id);
    return { ...ok(`Saved ${updated} mark(s) (mock).`), sheet, updated };
  },

  GET_ADMIN_ATTENDANCE_REPORT: (req) => {
    const scope = trimmed(req.scope) === 'student' ? 'student' : 'staff';
    const className = trimmed(req.className);
    const departmentName = trimmed(req.departmentName);
    const search = trimmed(req.search).toLowerCase();

    const relevant = sheets.filter((s) => s.category === scope && (!className || s.className === className));
    /*
     * Read both registers through one loose row shape rather than a union of the
     * two seed types: the two have almost no fields in common (a staff member has
     * a `staffNo` and a `departmentName`, a student has neither), so a union would
     * force a narrowing branch at every access and still not be honest about the
     * fields. The columns the report needs are the three below, and both seeds
     * carry them under the names the report renders.
     */
    const source: Collection = scope === 'staff' ? asCollection(staff) : asCollection(students);
    const people = source
      .filter((p) =>
        scope === 'staff'
          ? !departmentName || String(p.departmentName ?? '') === departmentName
          : !className || String(p.className ?? '') === className,
      )
      .map((p) => ({
        id: String(p.id),
        name: String(p.fullName ?? ''),
        identifier: String(scope === 'staff' ? (p.staffNo ?? '') : (p.admissionNo ?? '')),
        email: String(p.email ?? ''),
      }))
      .filter((p) => !search || `${p.name} ${p.identifier} ${p.email}`.toLowerCase().includes(search));

    /* One synthetic register spanning every sheet in scope: the live report is one
       table, and per-sheet tallies would change the row set as you filter. */
    const combined: AttendanceSheet = {
      id: `REPORT-${scope}`,
      title: scope === 'staff' ? 'Staff' : 'Students',
      category: scope,
      term: '',
      academicSession: '',
      classId: '',
      className,
      weeks: relevant.flatMap((s) => s.weeks),
    };
    const rows = attendanceRows(combined, people);
    return { ...ok('Attendance report retrieved (mock).'), rows, totals: attendanceTotals(rows), weeks: combined.weeks.length };
  },

  /* ── results ─────────────────────────────────────────────────────────── */

  SAVE_UPLOAD_WINDOW: (req) => {
    const title = trimmed(req.title);
    if (!title) return { status: 'error', message: 'Enter a title for the window.' };
    const entry = store['upload-windows'];
    const id = trimmed(req.id);
    if (id) {
      const row = entry.rows.find((r) => r.id === id);
      if (!row) return { status: 'error', message: 'Window not found (mock).' };
      Object.assign(row, { title, academicSession: trimmed(req.academicSession), term: trimmed(req.term), startsAt: trimmed(req.startsAt), endsAt: trimmed(req.endsAt), teacherIds: (req.teacherIds ?? []) as string[] });
      logAction(trimmed(req.actor) || 'Nicegene Technologies', 'UPDATE', 'upload-windows', id);
      return { ...ok('Window saved (mock).'), window: row };
    }
    const created = {
      id: nextId(entry),
      title,
      academicSession: trimmed(req.academicSession),
      term: trimmed(req.term),
      status: 'OPEN',
      startsAt: trimmed(req.startsAt),
      endsAt: trimmed(req.endsAt),
      teacherIds: (req.teacherIds ?? []) as string[],
    };
    entry.rows.unshift(created);
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'CREATE', 'upload-windows', String(created.id));
    return { ...ok('Window created (mock).'), window: created };
  },

  SET_UPLOAD_WINDOW_STATUS: (req) => {
    const row = store['upload-windows'].rows.find((r) => r.id === trimmed(req.id));
    if (!row) return { status: 'error', message: 'Window not found (mock).' };
    row.status = trimmed(req.status) === 'CLOSED' ? 'CLOSED' : 'OPEN';
    logAction(trimmed(req.actor) || 'Nicegene Technologies', String(row.status), 'upload-windows', String(row.id));
    return { ...ok(`Window ${String(row.status).toLowerCase()} (mock).`), window: row };
  },

  GET_ADMIN_RESULT_ENTRY_CONTEXT: (req) => {
    const className = trimmed(req.className);
    const academicSession = trimmed(req.academicSession) || '2026/2027';
    const term = trimmed(req.term) || 'First';
    resultRows = buildResultRows(className, academicSession, term);
    return {
      ...ok('Result entry context retrieved (mock).'),
      className,
      academicSession,
      term,
      rows: resultRows,
      grading,
      classPopulation: resultRows.length,
    };
  },

  SAVE_RESULT_ENTRIES: (req) => {
    const rows = (req.rows ?? []) as ResultEntryRow[];
    if (rows.length === 0) return { status: 'error', message: 'There are no rows to save.' };
    resultRows = rows;
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'SUBMIT', 'results', trimmed(req.className));
    return ok(`Submitted ${rows.length} result row(s) (mock).`);
  },

  DECIDE_RESULT: (req) => {
    const row = store['results-queue'].rows.find((r) => r.id === trimmed(req.id));
    if (!row) return { status: 'error', message: 'Queue item not found (mock).' };
    const decision = trimmed(req.decision).toUpperCase();
    const allowed: Record<string, string> = {
      TAG: 'COMMITTEE_TAGGED',
      VET: 'VETTED',
      PUBLISH: 'PUBLISHED',
      DECLINE: 'DECLINED',
      REVIEW: 'VETTED',
    };
    const next = allowed[decision];
    if (!next) return { status: 'error', message: `Unknown result decision: ${decision}` };
    if (next === 'DECLINED' && !trimmed(req.note)) {
      return { status: 'error', message: 'Please enter a comment before submitting your review.' };
    }
    row.status = next;
    if (next === 'DECLINED') row.declineReason = trimmed(req.note);
    logAction(trimmed(req.actor) || 'Nicegene Technologies', decision, 'results', String(row.id));
    return { ...ok(`${decision} (mock).`), item: row };
  },

  SAVE_GRADING_SETTINGS: (req) => {
    const bands = (req.bands ?? []) as GradingSettings['bands'];
    if (bands.length === 0) return { status: 'error', message: 'The grading scale cannot be empty.' };
    const passMark = num(req.passMark, grading.passMark);
    if (bands.some((b) => num(b.minScore) > num(b.maxScore))) {
      return { status: 'error', message: 'Each band needs a minimum score at or below its maximum.' };
    }
    grading.bands = bands.map((b) => ({ grade: trimmed(b.grade), minScore: num(b.minScore), maxScore: num(b.maxScore), label: trimmed(b.label) }));
    grading.passMark = passMark;
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'UPDATE', 'grading', 'scale');
    return { ...ok('Grading settings saved (mock).'), settings: grading };
  },

  /* ── wallet, orders, fees ────────────────────────────────────────────── */

  ADJUST_WALLET: (req) => {
    const row = store.wallets.rows.find((r) => r.id === trimmed(req.walletId));
    if (!row) return { status: 'error', message: 'Wallet not found (mock).' };
    const amount = num(req.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { status: 'error', message: 'Amount must be greater than zero' };
    const kind = trimmed(req.kind).toUpperCase();
    if (kind === 'TOPUP') row.balance = num(row.balance) + amount;
    else if (kind === 'DEDUCT') {
      if (amount > num(row.balance)) return { status: 'error', message: 'Amount is greater than the wallet balance.' };
      row.balance = num(row.balance) - amount;
    } else return { status: 'error', message: 'Choose Top up or Deduct.' };

    txnSeq += 1;
    walletTransactions.unshift({
      id: `WTX-${String(txnSeq).padStart(3, '0')}`,
      walletId: String(row.id),
      studentName: String(row.studentName),
      type: kind === 'TOPUP' ? 'TOPUP' : 'DEDUCT',
      amount,
      note: trimmed(req.note),
      confirmed: true,
      createdAt: new Date().toISOString(),
    });
    logAction(trimmed(req.actor) || 'Nicegene Technologies', kind, 'wallets', String(row.id));
    return { ...ok(`${kind === 'TOPUP' ? 'Topped up' : 'Deducted'} ${money(amount)} (mock).`), wallet: row };
  },

  GET_ADMIN_WALLET_REPORTS: () => {
    const funded = walletTransactions.filter((t) => t.type === 'TOPUP').reduce((n, t) => n + t.amount, 0);
    const spent = walletTransactions.filter((t) => t.type === 'DEDUCT').reduce((n, t) => n + t.amount, 0);
    return {
      ...ok('Wallet reports retrieved (mock).'),
      liability: wallets.reduce((n, w) => n + num(w.balance), 0),
      funded,
      spent,
      active: wallets.filter((w) => w.status === 'ACTIVE').length,
      confirmed: walletTransactions.filter((t) => t.confirmed).length,
      transactions: walletTransactions,
    };
  },

  GET_ADMIN_CART: () => ({ ...ok('Cart retrieved (mock).'), lines: [] as Array<Record<string, unknown>> }),

  GET_CART: () => ({ ...ok('Cart retrieved (mock).'), cart: cartSnapshot() }),

  ADD_TO_CART: (req) => {
    const item = stock.find((s) => s.id === trimmed(req.stockItemId));
    if (!item) return { status: 'error', message: 'Item not found (mock).' };
    if (item.available <= 0) return { status: 'error', message: 'This item is out of stock.' };
    const quantity = Math.max(1, Number(req.quantity ?? 1));
    const existing = cart.find((l) => l.stockItemId === item.id);
    if (existing) {
      existing.quantity = Math.min(item.available, existing.quantity + quantity);
    } else {
      cart.push({ stockItemId: item.id, name: item.name, quantity: Math.min(quantity, item.available), unitPrice: item.unitPrice });
    }
    return { ...ok(`Added ${item.name} to the cart (mock).`), cart: cartSnapshot() };
  },

  /**
   * Set a line's quantity outright.
   *
   * Set-to rather than add-to, because the live cart PATCHes the line: a delta
   * would need a second action just to let an operator lower a quantity, and
   * "remove" is not the same as "set to zero" — zero is not a valid quantity.
   */
  UPDATE_CART_ITEM: (req) => {
    const line = cart.find((l) => l.stockItemId === trimmed(req.stockItemId));
    if (!line) return { status: 'error', message: 'That item is not in your cart.' };
    const item = stock.find((s) => s.id === line.stockItemId);
    const quantity = Math.floor(Number(req.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) return { status: 'error', message: 'Enter a whole quantity of 1 or more.' };
    /* Stock has not moved yet, so the ceiling is everything not already in the
       cart — not simply `available`, which would let a line claim stock another
       line in the same cart is holding. */
    const inCart = cart.filter((l) => l.stockItemId === line.stockItemId).reduce((n, l) => n + l.quantity, 0);
    const ceiling = (item?.available ?? 0) + inCart - line.quantity;
    if (quantity > ceiling) {
      return { status: 'error', message: `Only ${ceiling} of ${line.name} available.` };
    }
    line.quantity = quantity;
    return { ...ok(`Updated ${line.name} (mock).`), cart: cartSnapshot() };
  },

  REMOVE_CART_ITEM: (req) => {
    const index = cart.findIndex((l) => l.stockItemId === trimmed(req.stockItemId));
    if (index === -1) return { status: 'error', message: 'That item is not in your cart.' };
    cart.splice(index, 1);
    return { ...ok('Removed from the cart (mock).'), cart: cartSnapshot() };
  },

  /**
   * Checkout. This is the action the panel's Checkout button actually issues;
   * before it existed the button looped `ADD_TO_CART` over its own lines, which
   * re-added to the very cart it had just emptied and could not have created an
   * order even in principle — while still reporting "Order placed".
   *
   * It is one transaction: every line is validated before any is reserved, so a
   * short order cannot half-place and still claim success.
   */
  PLACE_STORE_ORDER: (req) => {
    const requested = Array.isArray(req.lines) ? (req.lines as Array<{ stockItemId?: unknown; quantity?: unknown }>) : [];
    if (requested.length === 0) return { status: 'error', message: 'Your cart is empty.' };
    const lines: CartLine[] = [];
    for (const line of requested) {
      const item = stock.find((s) => s.id === trimmed(line.stockItemId as string));
      if (!item) return { status: 'error', message: 'An item in your cart no longer exists.' };
      const quantity = Math.floor(Number(line.quantity));
      if (!Number.isFinite(quantity) || quantity < 1) return { status: 'error', message: 'Enter a whole quantity of 1 or more.' };
      if (quantity > item.available) {
        return { status: 'error', message: `Only ${item.available} of ${item.name} left in stock.` };
      }
      lines.push({ stockItemId: item.id, name: item.name, quantity, unitPrice: item.unitPrice });
    }
    const total = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
    orderSeq += 1;
    const order: StoreOrder = {
      id: `ORD-${String(orderSeq).padStart(3, '0')}`,
      orderNo: `ORD-2026-${String(orderSeq).padStart(4, '0')}`,
      customerName: trimmed(req.actor) || 'Nicegene Technologies',
      date: day(0),
      total,
      status: 'AWAITING_PAYMENT',
      lines,
    };
    orders.unshift(order);
    /* Stock moves at checkout, not at confirmation: the bursary may never get
       to the queue, and an order that holds nothing is not a real order. */
    for (const line of lines) {
      const item = stock.find((s) => s.id === line.stockItemId);
      if (!item) continue;
      item.inStock = Math.max(0, item.inStock - line.quantity);
      item.available = Math.max(0, item.available - line.quantity);
      item.status = item.available <= 0 ? 'OUT_OF_STOCK' : item.available <= item.reorderLevel ? 'LOW_STOCK' : 'IN_STOCK';
    }
    cart.length = 0;
    store['store-queue'].rows = asCollection(orders);
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'PLACE', 'store', order.id);
    return { ...ok(`Order ${order.orderNo} placed. Awaiting bursary confirmation.`), order };
  },

  /**
   * The bursary taking cash or a transfer for an order.
   *
   * "Payment reference is required." is the live queue detail's own refusal, and
   * it is enforced here rather than in the panel: a mock that accepted a blank
   * reference would let the panel's validation be the only thing standing in for
   * a server check that exists on the origin.
   */
  CONFIRM_STORE_ORDER: (req) => {
    const row = orders.find((o) => o.id === trimmed(req.id));
    if (!row) return { status: 'error', message: 'Order not found (mock).' };
    const reference = trimmed(req.paymentRef);
    if (!reference) return { status: 'error', message: 'Payment reference is required.' };
    if (row.status === 'CONFIRMED') return { status: 'error', message: `Order ${row.orderNo} is already confirmed.` };
    if (row.status === 'REFUNDED') return { status: 'error', message: `Order ${row.orderNo} was refunded and cannot be confirmed.` };
    row.status = 'CONFIRMED';
    store['store-queue'].rows = asCollection(orders);
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'CONFIRM', 'store', row.id);
    return { ...ok(`Order ${row.orderNo} confirmed.`), order: row };
  },

  /**
   * Resolving a refund. Both fields are optional on the live queue, so neither
   * is required here — a refund can be closed with neither a note nor a receipt.
   */
  RESOLVE_STORE_REFUND: (req) => {
    const row = orders.find((o) => o.id === trimmed(req.id));
    if (!row) return { status: 'error', message: 'Order not found (mock).' };
    if (row.status !== 'REFUND_PENDING') return { status: 'error', message: `Order ${row.orderNo} is not awaiting a refund.` };
    row.status = 'REFUNDED';
    /* Stock goes back when the refund is resolved, not when it is requested. */
    for (const line of row.lines) {
      const item = stock.find((s) => s.id === line.stockItemId);
      if (!item) continue;
      item.inStock += line.quantity;
      item.available += line.quantity;
      item.status = item.available <= 0 ? 'OUT_OF_STOCK' : item.available <= item.reorderLevel ? 'LOW_STOCK' : 'IN_STOCK';
    }
    store['store-queue'].rows = asCollection(orders);
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'REFUND', 'store', row.id);
    return { ...ok(`Refund resolved for ${row.orderNo}.`), order: row };
  },



  RECORD_FEE_PAYMENT: (req) => {
    const amount = num(req.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { status: 'error', message: 'Amount must be greater than zero' };
    const entry = store['fee-payments'];
    const student = students.find((s) => s.id === trimmed(req.studentId));
    const created: FeePayment = {
      id: nextId(entry),
      reference: `PAY-2026-${String(entry.rows.length + 1).padStart(4, '0')}`,
      studentId: trimmed(req.studentId),
      studentName: student ? full(student.firstName, student.lastName) : 'Unknown student',
      className: student?.className ?? '',
      amount,
      method: trimmed(req.method) || 'Cash',
      status: 'CONFIRMED',
      academicSession: trimmed(req.academicSession) || '2026/2027',
      term: trimmed(req.term) || 'First',
      paidAt: new Date().toISOString(),
    };
    /* Cast for the same reason as the role row above: `FeePayment` is an
       interface without an index signature, and the store's row type is loose. */
    entry.rows.unshift(created as unknown as Collection[number]);
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'CREATE', 'school-fees', created.reference);
    return { ...ok('Payment recorded (mock).'), payment: created };
  },

  GET_ADMIN_FEE_REPORTS: () => {
    const confirmed = feePayments.filter((p) => p.status === 'CONFIRMED');
    const byCategory = new Map<string, number>();
    for (const payment of confirmed) {
      for (const item of feeItems.filter((f) => f.className === payment.className)) {
        byCategory.set(item.categoryName, (byCategory.get(item.categoryName) ?? 0) + item.amount);
      }
    }
    return {
      ...ok('Fee reports retrieved (mock).'),
      collected: confirmed.reduce((n, p) => n + p.amount, 0),
      payments: confirmed.length,
      pending: feePayments.filter((p) => p.status === 'PENDING').length,
      byCategory: [...byCategory.entries()].map(([name, amount]) => ({ name, amount })),
    };
  },

  GET_ADMIN_FEE_BREAKDOWN: (req) => {
    const className = trimmed(req.className);
    const rows = feeItems.filter((f) => !className || f.className === className);
    const total = rows.reduce((n, f) => n + f.amount, 0);
    const paid = feePayments.filter((p) => p.status === 'CONFIRMED' && p.className === className).reduce((n, p) => n + p.amount, 0);
    return { ...ok('Fee breakdown retrieved (mock).'), rows, total, paid, payments: feePayments.filter((p) => !className || p.className === className) };
  },

  /* ── inventory ───────────────────────────────────────────────────────── */

  GET_ADMIN_INVENTORY_REPORTS: () => {
    const byStatus = new Map<string, number>();
    for (const sale of sales) byStatus.set(String(sale.status), (byStatus.get(String(sale.status)) ?? 0) + 1);
    return {
      ...ok('Inventory reports retrieved (mock).'),
      totalItems: stock.length,
      stockValue: stock.reduce((n, s) => n + num(s.unitPrice) * num(s.inStock), 0),
      low: stock.filter((s) => s.status === 'LOW_STOCK').length,
      out: stock.filter((s) => s.status === 'OUT_OF_STOCK').length,
      releasedSales: sales.filter((s) => s.status === 'RELEASED').length,
      revenue: sales.filter((s) => s.status === 'RELEASED').reduce((n, s) => n + num(s.total), 0),
      pendingSales: sales.filter((s) => s.status === 'DRAFT' || s.status === 'PAYMENT_CONFIRMED').length,
      assets: assets.length,
      movements: [] as Array<Record<string, unknown>>,
      salesByStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
    };
  },

  SAVE_INVENTORY_SETTINGS: (req) => {
    const level = num(req.defaultReorderLevel, -1);
    if (level < 0) return { status: 'error', message: 'Enter a whole number of 0 or more.' };
    inventorySettings = { defaultReorderLevel: level };
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'UPDATE', 'inventory', 'settings');
    return { ...ok('Inventory settings saved (mock).'), settings: inventorySettings };
  },

  GET_ADMIN_INVENTORY_SETTINGS: () => ({ ...ok('Inventory settings retrieved (mock).'), settings: inventorySettings }),

  SAVE_STOCK_MOVEMENT: (req) => {
    const row = store.stock.rows.find((r) => r.id === trimmed(req.stockItemId));
    if (!row) return { status: 'error', message: 'Stock item not found (mock).' };
    const added = num(req.quantity);
    if (!Number.isFinite(added) || added <= 0) return { status: 'error', message: 'Enter a whole number of 0 or more.' };
    row.inStock = num(row.inStock) + added;
    store.stock.normalise?.(row);
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'RESTOCK', 'stock', String(row.id));
    return { ...ok(`Added ${added} to stock (mock).`), record: row };
  },

  /* ── notices, events, calendar ───────────────────────────────────────── */

  PUBLISH_ADMIN_NOTICE: (req) => {
    const title = trimmed(req.title);
    const body = trimmed(req.body);
    if (!title || !body) return { status: 'error', message: 'Title and content are required.' };
    const entry = store.notices;
    const id = trimmed(req.id);
    const audience = (trimmed(req.audience) || 'EVERYONE') as NoticeAudience;
    const published = req.published === false ? false : true;
    if (id) {
      const row = entry.rows.find((r) => r.id === id);
      if (!row) return { status: 'error', message: 'Notice not found (mock).' };
      Object.assign(row, { title, body, audience, pinned: req.pinned === true, published });
      logAction(trimmed(req.actor) || 'Nicegene Technologies', 'UPDATE', 'notices', id);
      return { ...ok('Notice saved (mock).'), notice: row };
    }
    const created = {
      id: nextId(entry),
      title,
      body,
      audience,
      authorName: trimmed(req.authorName) || 'Nicegene Technologies',
      pinned: req.pinned === true,
      published,
      createdAt: new Date().toISOString(),
    };
    entry.rows.unshift(created);
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'CREATE', 'notices', created.id);
    return { ...ok('Notice published (mock).'), notice: created };
  },

  PUBLISH_ADMIN_EVENT: (req) => {
    const title = trimmed(req.title);
    if (!title) return { status: 'error', message: 'Event title is required.' };
    if (!trimmed(req.startsAt) && req.allDay !== true) return { status: 'error', message: 'Start date and time are required.' };
    const entry = store.events;
    const created = {
      id: nextId(entry),
      title,
      description: trimmed(req.description),
      location: trimmed(req.location),
      startsAt: trimmed(req.startsAt),
      endsAt: trimmed(req.endsAt),
      category: trimmed(req.category),
      audience: (trimmed(req.audience) || 'EVERYONE') as NoticeAudience,
      allDay: req.allDay === true,
    };
    entry.rows.unshift(created);
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'CREATE', 'events', created.id);
    return { ...ok('Event created (mock).'), event: created };
  },

  /* ── system ──────────────────────────────────────────────────────────── */

  GET_ADMIN_GENERAL_SETTINGS: () => ({ ...ok('General settings retrieved (mock).'), settings: generalSettings }),
  SAVE_GENERAL_SETTINGS: (req) => {
    const schoolName = trimmed(req.schoolName);
    if (!schoolName) return { status: 'error', message: 'School name is required' };
    generalSettings = { ...generalSettings, ...(req.settings as Record<string, unknown>), schoolName } as GeneralSettings;
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'UPDATE', 'system', 'general-settings');
    return { ...ok('General settings saved (mock).'), settings: generalSettings };
  },

  GET_ADMIN_SYSTEM_CONFIGURATION: () => ({ ...ok('System configuration retrieved (mock).'), settings: systemConfiguration }),
  SAVE_SYSTEM_CONFIGURATION: (req) => {
    const minimumPasswordLength = num(req.minimumPasswordLength, systemConfiguration.minimumPasswordLength);
    if (minimumPasswordLength < 8) return { status: 'error', message: 'Minimum password length must be at least 8.' };
    systemConfiguration = { ...systemConfiguration, ...(req.settings as Record<string, unknown>), minimumPasswordLength } as SystemConfiguration;
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'UPDATE', 'system', 'system-configuration');
    return { ...ok('System configuration saved (mock).'), settings: systemConfiguration };
  },

  GET_ADMIN_BRANDING: () => ({ ...ok('Branding retrieved (mock).'), settings: branding }),
  SAVE_ADMIN_BRANDING: (req) => {
    branding = { ...branding, ...(req.settings as Record<string, unknown>) } as BrandingSettings;
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'UPDATE', 'system', 'branding');
    return { ...ok('Branding saved (mock).'), settings: branding };
  },

  SAVE_FEATURE_TOGGLE: (req) => {
    const row = store['feature-toggles'].rows.find((r) => r.id === trimmed(req.id));
    if (!row) return { status: 'error', message: 'Feature not found (mock).' };
    row.enabled = req.enabled === undefined ? !row.enabled : req.enabled === true;
    logAction(trimmed(req.actor) || 'Nicegene Technologies', 'TOGGLE', 'system', String(row.id));
    return { ...ok('Feature toggled (mock).'), record: row };
  },

  CREATE_BACKUP: () => {
    const entry = store.backups;
    backupSeq += 1;
    entry.seq = backupSeq;
    const created: BackupRecord = {
      id: `BK-${String(backupSeq).padStart(3, '0')}`,
      name: `manual-${day()}`,
      type: 'MANUAL',
      size: '—',
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      createdBy: 'Nicegene Technologies',
      retention: '30 days',
    };
    /* Cast for the same reason as the role and payment rows above. */
    entry.rows.unshift(created as unknown as Collection[number]);
    logAction('Nicegene Technologies', 'CREATE', 'system', created.id);
    return { ...ok('Backup created (mock).'), backup: created };
  },

  /* ── dashboard, lookups ──────────────────────────────────────────────── */

  GET_ADMIN_DASHBOARD: () => ({
    ...ok('Dashboard retrieved (mock).'),
    sections: dashboardSections(),
    quickActions,
    greeting: 'Welcome, Nicegene Technologies',
    roleLabel: 'SUPER ADMIN',
    schoolName: "Saint Finbarr's College",
    academicSession: '2026/2027',
    school: { id: 'SFC', name: "Saint Finbarr's College", address: 'Akoka, Yaba, Lagos', email: 'contact@saintfinbarrscollege.com', phone: '09092585474' },
  }),

  GET_ADMIN_OPTION_LIST: (req) => {
    const key = trimmed(req.key);
    return { ...ok('Options retrieved (mock).'), options: optionLists[key] ?? [] };
  },
};

/** Called once from `mock.ts` to fold these into the shared handler map. */
export function adminHandlers(): AdminHandlers {
  return handlers;
}

export const adminInternals = {
  money,
  store,
  sheets,
  staff,
  students,
  roles,
  permissionIds,
  rolePermissionIds,
  userPermissionIds,
  walletTransactions,
  getGrading: () => grading,
  getStudents: () => students,
  getStaff: () => staff,
  getClasses: () => classes,
  getArms: () => arms,
  getSubjects: () => subjects,
  getSessions: () => sessions,
  getResultRows: () => resultRows,
};
