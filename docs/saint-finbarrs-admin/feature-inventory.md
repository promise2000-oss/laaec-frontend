# Feature inventory — per-feature record

One row per live feature: what it is for, what it looks like, what it does, which
workflow it belongs to, what it validates, where its data comes from, and who may
use it. Labels are per `README.md`; **SOURCE** items come from the deployed
application's own source at
`C:\Users\USER\Documents\saintfinbarrs-frontend`.

Columns: **Purpose** is what the feature is for; **UI** is what it renders;
**Actions** is what an operator can do; **Validation** is what the origin refuses
(only where it was read from source); **Data** is the backing endpoint family;
**Perm** is the permission family that gates it.

## Dashboards

| Feature | Purpose | UI | Actions | Validation | Data | Perm |
|---|---|---|---|---|---|---|
| `/dashboard` | The admin landing page | Stat tiles, activity list, shortcuts | Navigate | — | `/dashboard/stats` | none on the page itself |
| `/dashboard` (Super Admin) | A second summary, with school-management tiles | Stat tiles over staff, students, wallets, stock, and quick-action links | Open a module by `?panel=` link | — | Several | `dashboard.superadmin` |

The live app has one dashboard; this project has two — the LAEC exam overview
(pre-existing) and the Saint Finbarr's summary. Two extras is a divergence,
recorded in `parity-report.md`.

## User & Roles

| Feature | Purpose | UI | Actions | Validation | Data | Perm |
|---|---|---|---|---|---|---|
| `/users` | Every account on the system | Table: name/email, roles, department, designation, status; 42 buttons; row menu with 5 items | View details, Edit, Deactivate, Suspend, Delete | — | `/users` | `users.*` |
| `/users/new` | Create an account | Form, 37 fields | Create | First name, last name, email, phone required; **and the 33 roles as checkboxes** | `/users` | `users.create` |
| `/roles` | The 33-role catalogue | Table, 33 rows | Create, Edit, Delete | — | `/roles` | `roles.*` |
| `/roles/new` | Create a role | Form with **186 fields** — the permission matrix, grouped by module | Create | — | `/roles`, `/permissions` | `roles.create` |
| `/permissions` | Who may do what | 33 role cards; tabs *View by role* / *View all users*; per-role edit dialog over 149 checkboxes | Grant/revoke a permission; search users | — | `/permissions`, `/permissions/users` | `permissions.*` |
| `/permissions/overrides` | The same page, per-user | identical | identical | — | same | `permissions.*` |

**The 186-field role form is the single most information-dense page in the audit**
and the reason `permissions` got a bespoke component: it is a matrix, not a list.

## Staff & HR

| Feature | Purpose | UI | Actions | Validation | Data | Perm |
|---|---|---|---|---|---|---|
| `/staff` | Staff directory | Table, 20 buttons, Export + Import + Add Staff; row menu of 4 | View profile, Edit, Resend invitation, Delete | — | `/staff` | `staff.*` |
| `/staff/new` | Add a staff member | Form, 41 fields | Create | First name, last name, email required | `/staff` | `staff.add` |
| `/staff/import` | Bulk import | Wizard; **validates the file's column headers before accepting it** | Import, confirm | Column names must match the expected set | `/staff/import`, `/staff/import/confirm` | `staff.import` |
| `/departments` | Organisation structure | 22 buttons — a card grid, not a table | Create, Edit, Delete | — | `/departments` | `departments.*` |
| `/designations` | Job titles | 30 buttons — a card grid | Create, Edit, Delete | — | `/designations` | `designations.*` |
| `/attendance` | Staff attendance sheets | A card per sheet; `Click here to mark attendance` | Add sheet, open a register, add a week, mark present/absent/unmarked, save | — | `/attendance/sheets`, `/attendance/weeks`, `/attendance/marks` | `attendance.*` |
| `/attendance/new` | Create a sheet | Form, 3 fields | Create | — | `/attendance/sheets` | `attendance.manage` |
| `/attendance/reports` | Analyse attendance | 151-row table + summary tiles + an Export CSV button | Search, filter, export | — | `/attendance/register` | `attendance.read` |
| `/leave` | Leave requests | Tabs All/Pending/Approved/Rejected; table; Apply for Leave | Apply, View | **Five rules, verbatim** — see `workflows.md` | `/leave/requests` | `leave.*` |
| `/leave/new`, `/leave/apply` | The leave form | Dialog/form, 5 fields | Submit | **The five rules above.** Duration is *derived*, not stored | `/leave/requests` | `leave.apply` |
| `/leave/approvals` | Decide leave | **Two tables**, Pending and Decided | Approve, Reject | — | `/leave/requests/:id/approve`, `/reject` | `leave.approve` |
| `/hr-queries` | Staff-to-HR questions | Table + 4 tabs (All/Open/Resolved/Archived) | View, respond | — | `/hr-queries` | `queries.*` |
| `/hr-queries/new` | Raise a question | Form, 5 fields | Create | — | `/hr-queries` | `queries.issue` |
| `/awards` | Staff recognition | Table | View | **Observed broken: "This page couldn't load"** | `/awards` | `awards.read` |
| `/awards/new` | Give an award | Form, 4 fields | Create | Award type, recipient, period and reason | `/awards` | `awards.manage` |

## Students & Parents

| Feature | Purpose | UI | Actions | Validation | Data | Perm |
|---|---|---|---|---|---|---|
| `/students` | The roll | Table, 19 buttons; row menu of 3 | View details, Edit, Delete; Import; Add Student & Parent | — | `/students` | `students.*` |
| `/students/new` | Enrol a student | Form, 17 fields, **two sections**: academic details and a nested guardian block | Create | Arm, first name, last name, category, guardian email/phone/first name/address required. Blank admission number means the portal generates one | `/students` | `students.add` |
| `/students/import` | Bulk enrol | Wizard | Import | As staff import | `/students/import` | `students.import` |
| `/students/export` | Bulk export | **Under construction** | — | — | — | — |
| `/students/promotion` | Move a cohort up a year | **Under construction** | — | — | — | — |
| `/students/attendance` | Per-class sheets | Same card grid as staff attendance | Add sheet, mark a register | — | `/attendance/sheets` | `attendance.*` |
| `/students/attendance/new` | Create a class sheet | Form | Create | — | `/attendance/sheets` | `attendance.manage` |
| `/students/attendance/report` | Class attendance analysis | Table + summary + Export CSV | Search, filter, export | — | `/attendance/register` | `attendance.read` |
| `/parents` | Guardians | Table, 14 buttons | Add parent; the **37-field create form is the same component as `Add User`**, with the 33 roles as checkboxes | First name, last name, email, phone required | `/parents` | `parents.read`, `users.create` |
| `/students/:id` | One student's profile | Profile page | — | — | `/students/:id` | `students.read` |

## Academic

| Feature | Purpose | UI | Actions | Validation | Data | Perm |
|---|---|---|---|---|---|---|
| `/academic/sessions` | School years | Table + search | Create, Edit, Delete | Session name must match `^\d{4}/\d{4}$` | `/academic/sessions` | `academic.sessions.*` |
| `/academic/terms` | Terms within a session | Table + search | Create, Edit, Delete | — | `/academic/sessions` | `academic.sessions.*` |
| `/academic/classes` | The class list | Card grid | Create, Edit | — | `/academic/classes` | `academic.manage` |
| `/academic/sections` | Sections within a class | Table + search | Create, Edit, Delete | — | `/academic/sections` | `academic.manage` |
| `/academic/subjects` | Subjects | Table, 36 rows | Create, Edit, Delete | — | `/academic/subjects` | `academic.subjects.manage` |
| `/academic/timetables` | Timetables | Card grid; the timetable view is a **weekday × period grid** | Create, edit slots, remove | — | `/academic/timetables` | `academic.timetables.manage` |
| `/academic/timetables/new` | Build a timetable | Grid + form, 17 fields | Save | — | `/academic/timetables` | `academic.timetables.manage` |
| `/academic/assignments` | Homework | Table | **Create In-App**, **Upload Document** | — | `/academic/assignments`, `/files/upload` | `academic.assignments.manage` |
| `/academic/class-routines` | Weekly routines | Table | Create, Edit | — | `/academic/class-routines` | `academic.routines.manage` |
| `/academic/class-teachers` | Who teaches which class | Table, 31 rows | Assign | — | `/academic/class-teachers` | `academic.classteachers.manage` |
| `/academic/subject-teachers` | Who teaches which subject | Table, 36 rows | Assign | — | `/academic/subject-teachers` | `academic.subjectteachers.manage` |
| `/academic/calendar` | The school calendar | 4 tabs + 13 buttons | Create, edit, delete events | — | `/academic/calendar` | `academic.calendar.manage` |

## Inventory

| Feature | Purpose | UI | Actions | Validation | Data | Perm |
|---|---|---|---|---|---|---|
| `/inventory/stock` | Stock levels | Table + search; Create Stock Item, Restock | Create, restock, row menu | — | `/inventory/stock`, `/restock` | `inventory.stock.*` |
| `/inventory/categories` | Item categories | Table, 4 rows | Create, Edit, Delete | — | `/inventory/categories` | `inventory.categories.manage` |
| `/inventory/suppliers` | Suppliers | Table | Create, Edit, Delete | — | `/inventory/suppliers` | `inventory.suppliers.*` |
| `/inventory/assets` | Fixed assets | Table | Create, Edit, Delete; **image upload** | — | `/inventory/assets`, `/images` | `inventory.assets.*` |
| `/inventory/reports` | Stock reporting | Summary tiles | — | — | `/inventory/reports/summary` | `inventory.stock.read` |
| `/inventory/settings` | Stock rules | Form | Save | — | — | `system.settings.update` |
| `/inventory/clinic` | The clinic's own store | Table | Create, Edit | — | `/inventory/clinic/stock` | `inventory.clinic.*` |
| `/inventory/sales` | Sales and invoicing | Table + 5 tabs; Create Sale dialog | Create a sale, view a sale | — | `/inventory/sales`, `/next-invoice` | `inventory.sales.*` |

## Store, Fees and Wallets

| Feature | Purpose | UI | Actions | Validation | Data | Perm |
|---|---|---|---|---|---|---|
| `/store` | A storefront | Product grid + search | Browse, add to cart | — | `/store/items` | `store.browse` |
| `/store/cart` | The cart | Cart lines | Update, remove, **checkout** | — | `/store/cart`, `/checkout` | `store.cart.manage` |
| `/store/orders` | Order history | Table | View | — | `/store/orders` | `store.orders.read` |
| `/store/queue` | The bursary's confirmation queue | Table + 6 tabs; `?status=REFUND_PENDING` is the refund queue | Confirm, resolve refund, mark paid | — | `/store/queue`, `/confirm`, `/resolve-refund` | `store.queue.read` |
| `/school-fees` | What a class owes | Fee breakdown by category and class | Navigate | — | `/school-fees/breakdown` | `schoolfees.read` |
| `/school-fees/categories` | Fee categories | Table, 6 rows | Create, Edit, Delete | — | `/school-fees/categories` | `schoolfees.read` |
| `/school-fees/items` | Fee items | Form, 4 fields | Create, Edit, Delete | — | `/school-fees/items` | `schoolfees.read` |
| `/school-fees/payments` | Payment history | Table | **Record payment** | — | `/school-fees/payments` | `schoolfees.read` |
| `/school-fees/reports` | Collection reports | Report tiles | — | — | `/school-fees/reports/summary` | `schoolfees.read` |
| `/wallets` | Per-student balances | Table + search; row menu | **Top up**, **Deduct** | `Amount must be greater than zero`; the deduction's kind is Spend or Cash withdrawal | `/wallets`, `/topup`, `/deduct` | `wallet.*` |
| `/wallets/reports` | Wallet reporting | Totals + a category breakdown | — | — | `/wallets/reports/summary` | `wallet.view` |

## Results Management

| Feature | Purpose | UI | Actions | Validation | Data | Perm |
|---|---|---|---|---|---|---|
| `/results/windows` | When teachers may upload | Table + form | Create, close, extend, **Reopen** | — | `/results/upload-windows` | `results.window.*` |
| `/results/enter` | Enter marks for a class | Filters (session, term, class) + a **13-column sheet** + class summary + grades table | Type four marks; Submit Results | Submit is disabled until a class is chosen | `/results/upload` | `results.upload` |
| `/results/queue` | Vet submitted results | Table + 6 tabs | Vet, publish, decline, tag for committee | — | `/results/queue` | `results.queue.read` |
| `/results/committee` | Committee-tagged results | Table | Review | **Observed: renders nothing** | `/results/committee/tagged` | `results.committee.view` |
| `/results/grading` | The grading scale | Editable table of bands + pass mark | Save changes | **A band whose min exceeds its max is refused** | `/results/grading-scale` | `results.grading.manage` |
| `/results/students` | Published results per student | Table | View | — | `/results/student/:id` | `results.view` |
| `/results/report-cards` | The report card | Table → a per-student card | View, download | — | `/results/report-card/:id` | `results.report.view` |

## System

| Feature | Purpose | UI | Actions | Validation | Data | Perm |
|---|---|---|---|---|---|---|
| `/system/general-settings` | School identity and contact | Form, 14 fields | Save | **`School name is required`** | `/system/settings/general` | `system.read` |
| `/system/academic-settings` | Grading scale, promotion rules | **"Couldn't load academic settings"** | — | — | `/system/settings/academic` | `system.read` |
| `/system/branding` | Logo, colours, favicon | **"Couldn't load branding settings"** | — | — | `/system/settings/branding` | `system.read` |
| `/system/notification-settings` | Channel preferences | **"Couldn't load notification settings"** | — | — | `/system/settings/notifications` | `system.read` |
| `/system/system-configuration` | Platform limits and security | Four sections; the Security one holds the password policy | Save | **A minimum password length below 8 is refused** | `/system/settings/limits`, `/security` | `system.read` |
| `/system/audit-logs` | Who did what | Table + 4 filters | Search, filter | — | `/system/audit-logs` | `audit_log.view` |
| `/system/backups` | Backups | Table | Create a backup | — | `/system/backups`, `/history` | `system.read` |
| `/system/feature-toggles` | Feature flags | Table of toggles | Toggle | — | `/system/feature-toggles` | `system.read` |

## Modules deliberately not built

Communication (messaging, notice board, events, logs, templates), Disciplinary
and Counselling. Each is named in `feature-matrix.md` with the reason. The notice
board and events calendar already exist in this project on `/notices/` and
`/calendar/`.

## Read next

`workflows.md` for what these are used for, `route-inventory.md` for the 131
routes, `feature-matrix.md` for what was built.