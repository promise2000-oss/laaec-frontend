/**
 * admin-panels.ts — the panel-id → component map for the Saint Finbarr's admin
 * portal.
 *
 * WHY IT IS NOT IN THE ROUTER COMPONENT
 * ------------------------------------
 * A `<script setup>` block cannot `export`. The map needs to be exported for two
 * reasons: `tools/check-admin-parity.mjs` reads it to assert every bespoke panel is
 * reachable and every panel file is mounted, and it is the one place a reviewer
 * should look to answer "which component renders /results/queue". Both need a
 * module, not a component.
 *
 * WHY MOST MODULES ARE NOT IN IT
 * ------------------------------
 * Because on the live deployment they are the same page — a heading, a search box,
 * a filter or two, a table, a row action menu and a create/edit dialog — differing
 * only in a column list and a field list, and both of those are data in
 * `types/admin-registry.ts`. Those modules render with `AdminResourcePanel`, which
 * is the fallback for any id absent from this map. A new table-shaped module
 * therefore needs a registry entry and no component at all.
 *
 * The modules below are the ones whose behaviour is genuinely something else: a
 * permission matrix, a grading scale, a register, a five-column report, a
 * summary, a timetable grid, a sectioned enrolment form, a card grid.
 */
import type { Component } from 'vue';
import AdminResourcePanel from './AdminResourcePanel.vue';
import AdminDashboardPanel from './AdminDashboardPanel.vue';
import AdminRolesPanel from './AdminRolesPanel.vue';
import AdminPermissionsPanel from './AdminPermissionsPanel.vue';
import AdminCardsPanel from './AdminCardsPanel.vue';
import AdminAttendanceSheetsPanel from './AdminAttendanceSheetsPanel.vue';
import AdminAttendanceReportPanel from './AdminAttendanceReportPanel.vue';
import AdminLeavePanel from './AdminLeavePanel.vue';
import AdminHrQueriesPanel from './AdminHrQueriesPanel.vue';
import AdminAwardsPanel from './AdminAwardsPanel.vue';
import AdminStudentsPanel from './AdminStudentsPanel.vue';
import AdminPeoplePanel from './AdminPeoplePanel.vue';
import AdminInventoryPanel from './AdminInventoryPanel.vue';
import AdminCaseModulePanel from './AdminCaseModulePanel.vue';
import AdminCaseWorkPanel from './AdminCaseWorkPanel.vue';
import AdminMoneyPanel from './AdminMoneyPanel.vue';
import AdminResultsPanel from './AdminResultsPanel.vue';
import AdminSystemPanel from './AdminSystemPanel.vue';
import AdminAcademicPanels from './AdminAcademicPanels.vue';

export const ADMIN_PANEL_COMPONENTS: Record<string, Component> = {
  'school-dashboard': AdminDashboardPanel,
  roles: AdminRolesPanel,
  permissions: AdminPermissionsPanel,
  departments: AdminCardsPanel,
  designations: AdminCardsPanel,
  'staff-attendance': AdminAttendanceSheetsPanel,
  'student-attendance': AdminAttendanceSheetsPanel,
  'staff-attendance-report': AdminAttendanceReportPanel,
  'student-attendance-report': AdminAttendanceReportPanel,
  leave: AdminLeavePanel,
  'leave-approvals': AdminLeavePanel,
  'hr-queries': AdminHrQueriesPanel,
  awards: AdminAwardsPanel,
  students: AdminStudentsPanel,
  parents: AdminPeoplePanel,
  staff: AdminPeoplePanel,
  stock: AdminInventoryPanel,
  'inventory-categories': AdminInventoryPanel,
  suppliers: AdminInventoryPanel,
  assets: AdminInventoryPanel,
  'inventory-reports': AdminInventoryPanel,
  'inventory-settings': AdminInventoryPanel,
  'clinic-store': AdminInventoryPanel,
  sales: AdminInventoryPanel,
  store: AdminInventoryPanel,
  cart: AdminInventoryPanel,
  orders: AdminInventoryPanel,
  queue: AdminInventoryPanel,
  'fee-breakdown': AdminMoneyPanel,
  'fee-reports': AdminMoneyPanel,
  'wallet-reports': AdminMoneyPanel,
  'upload-windows': AdminResultsPanel,
  'enter-results': AdminResultsPanel,
  'results-queue': AdminResultsPanel,
  'committee-review': AdminResultsPanel,
  grading: AdminResultsPanel,
  'student-results': AdminResultsPanel,
  'report-cards': AdminResultsPanel,
  'general-settings': AdminSystemPanel,
  'academic-settings': AdminSystemPanel,
  branding: AdminSystemPanel,
  'notification-settings': AdminSystemPanel,
  'system-configuration': AdminSystemPanel,
  classes: AdminAcademicPanels,
  arms: AdminAcademicPanels,
  timetables: AdminAcademicPanels,
  /*
   * Disciplinary and Counselling, two modules and eight panels, on two
   * components. The split is by page shape, not by module: the catalogue,
   * committee and form pages are one kind, and the case and report lists are
   * another. Each component reads which module it is serving from its own panel
   * id, so a counselling panel can never save a disciplinary case.
   */
  'disciplinary-incidents': AdminCaseModulePanel,
  'disciplinary-committees': AdminCaseModulePanel,
  'disciplinary-launch-case': AdminCaseModulePanel,
  'counselling-book-session': AdminCaseModulePanel,
  'counselling-committee': AdminCaseModulePanel,
  'disciplinary-reports': AdminCaseWorkPanel,
  'counselling-cases': AdminCaseWorkPanel,
  'counselling-reports': AdminCaseWorkPanel,
};

/** The renderer for a panel id, or the default list renderer when unmapped. */
export const componentForPanel = (panelId: string): Component =>
  ADMIN_PANEL_COMPONENTS[panelId] ?? AdminResourcePanel;
