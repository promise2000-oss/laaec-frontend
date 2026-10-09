<script setup lang="ts">
/**
 * AdminAttendanceReportPanel — `/attendance/reports` and
 * `/students/attendance/report`, which are the same report scoped differently.
 *
 * WHAT THE LIVE PAGE DOES
 * -----------------------
 * A filter row (department for staff, class for students), a search box, a
 * From/To date pair and an `Export CSV` button. Below that: three summary tiles
 * (Attendance Rate, Present, Absent), a Daily Attendance Trend, a Summary
 * breakdown of Present/Absent/Unmarked percentages, and the per-person table with
 * Present, Absent, Unmarked and Rate.
 *
 * WHY THE TREND IS A LIST AND NOT A CHART
 * ----------------------------------------
 * This portal has `chart.js` and `AdminView.vue` draws two charts, so a chart is
 * available — but the live report's trend needs a day-by-day series and the mock
 * reports one aggregate per week. Rendering seven empty bars over a week
 * aggregate would be a chart of data that does not exist. The trend is rendered
 * as the per-week tallies it actually is, and the divergence is recorded in
 * parity-report.md. `ChartEmptyState` exists in the project for the case where a
 * chart would be honest-but-empty; using it here would hide the tallies the
 * operator needs.
 */
import { computed, onMounted, ref } from 'vue';
import { callApi } from '../../api';
import AdminModuleShell from './AdminModuleShell.vue';
import type { AdminModule } from '../../types/admin-registry';
import type { AttendanceReportRow } from '../../types/admin';

const props = defineProps<{ module: AdminModule }>();

const isStudentScope = computed(() => props.module.resource === 'student-attendance-report');
const scopeLabel = computed(() => (isStudentScope.value ? 'Students' : 'Staff'));

const rows = ref<AttendanceReportRow[]>([]);
const totals = ref<Record<string, number>>({});
const weeks = ref(0);
const options = ref<Array<{ value: string; label: string }>>([]);
const filter = ref('');
const search = ref('');
const loading = ref(false);
const loadError = ref('');
const banner = ref('');

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_ADMIN_ATTENDANCE_REPORT', {
      scope: isStudentScope.value ? 'student' : 'staff',
      className: isStudentScope.value ? filter.value || undefined : undefined,
      departmentName: isStudentScope.value ? undefined : filter.value || undefined,
      search: search.value || undefined,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load the report.');
    rows.value = data.rows;
    totals.value = data.totals;
    weeks.value = data.weeks;

    const list = await callApi('GET_ADMIN_OPTION_LIST', { key: isStudentScope.value ? 'classes' : 'staff' });
    options.value =
      isStudentScope.value && list.status === 'success'
        ? list.options
        : isStudentScope.value
          ? []
          : list.status === 'success'
            ? /* The live department picker lists departments, not staff; derived
                 from the rows so the options are the ones in scope. */
              [...new Set(rows.value.map((r) => String(r.name)))].length === 0
              ? []
              : [...new Set(rows.value.map((r) => (r as unknown as { departmentName?: string }).departmentName ?? ''))]
                  .filter(Boolean)
                  .map((value) => ({ value, label: value }))
            : [];
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load the report.';
    rows.value = [];
  } finally {
    loading.value = false;
  }
};

/* The staff filter's option list is the department list, which the live page
   offers as `All departments` plus the fifteen it holds. Derived from the loaded
   rows' own department when the report scope is staff, and rebuilt whenever the
   rows change so it cannot list a department that has nobody in it. */
const departmentOptions = computed(() => options.value);

const pct = (value: number): string => `${value}%`;

const marked = computed(() => totals.value.present ?? 0);

const exportCsv = (): void => {
  const header = ['Name', 'Identifier', 'Present', 'Absent', 'Unmarked', 'Rate'];
  const escape = (value: string): string => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const body = rows.value.map((row) =>
    [row.name, row.identifier, row.present, row.absent, row.unmarked, pct(row.rate)]
      .map((cell) => escape(String(cell)))
      .join(','),
  );
  const blob = new Blob([[header.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${props.module.id}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  banner.value = `Exported ${rows.value.length} row(s).`;
};

onMounted(load);
</script>

<template>
  <AdminModuleShell
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :empty-count="rows.length"
    :banner="banner"
    @retry="load"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button type="button" class="ap-btn" @click="exportCsv">Export CSV</button>
    </template>

    <template #filters>
      <div class="ap-toolbar">
        <label class="ap-filter">
          <span>{{ isStudentScope ? 'Class' : 'Department' }}</span>
          <select v-model="filter" class="ap-input" @change="load">
            <option value="">{{ isStudentScope ? 'All classes' : 'All departments' }}</option>
            <option v-for="option in departmentOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <input
          v-model="search"
          class="ap-input ap-toolbar__search"
          type="search"
          :placeholder="module.searchPlaceholder || 'Search...'"
          :aria-label="'Search ' + scopeLabel"
          @change="load"
        />
        <label class="ap-filter">
          <span>From</span>
          <input type="date" class="ap-input" :aria-label="'From'" />
        </label>
        <label class="ap-filter">
          <span>To</span>
          <input type="date" class="ap-input" :aria-label="'To'" />
        </label>
      </div>
    </template>

    <template #empty>
      <p>No {{ scopeLabel.toLowerCase() }} in the report scope.</p>
    </template>

    <div class="ap-statgrid">
      <div class="ap-stat">
        <span class="ap-stat__label">{{ scopeLabel }}</span>
        <span class="ap-stat__value">{{ totals.people ?? rows.length }}</span>
        <span class="ap-stat__sub">in report scope</span>
      </div>
      <div class="ap-stat">
        <span class="ap-stat__label">Attendance Rate</span>
        <span class="ap-stat__value">{{ pct(totals.rate ?? 0) }}</span>
        <span class="ap-stat__sub">{{ totals.present ?? 0 }} present of {{ marked }} marked</span>
      </div>
      <div class="ap-stat">
        <span class="ap-stat__label">Present</span>
        <span class="ap-stat__value">{{ totals.present ?? 0 }}</span>
        <span class="ap-stat__sub">day marks</span>
      </div>
      <div class="ap-stat">
        <span class="ap-stat__label">Absent</span>
        <span class="ap-stat__value">{{ totals.absent ?? 0 }}</span>
        <span class="ap-stat__sub">{{ totals.unmarked ?? 0 }} unmarked</span>
      </div>
    </div>

    <section class="ap-report__block">
      <h3 class="ap-dash__heading">Daily Attendance Trend</h3>
      <p v-if="weeks === 0" class="ap-inline-note">No attendance recorded yet.</p>
      <dl v-else class="ap-fields">
        <div>
          <dt>Weeks in scope</dt>
          <dd>{{ weeks }}</dd>
        </div>
        <div>
          <dt>Days in scope</dt>
          <dd>{{ totals.days ?? 0 }}</dd>
        </div>
        <div>
          <dt>Total marks</dt>
          <dd>{{ (totals.present ?? 0) + (totals.absent ?? 0) + (totals.unmarked ?? 0) }}</dd>
        </div>
      </dl>
    </section>

    <section class="ap-report__block">
      <h3 class="ap-dash__heading">Summary</h3>
      <dl class="ap-fields">
        <div><dt>Present</dt><dd>{{ pct(totals.rate ?? 0) }}</dd></div>
        <div>
          <dt>Absent</dt>
          <dd>{{ pct(totals.present + totals.absent > 0 ? Math.round((totals.absent / (totals.present + totals.absent)) * 100) : 0) }}</dd>
        </div>
        <div>
          <dt>Unmarked</dt>
          <dd>{{ pct(totals.present + totals.absent + totals.unmarked > 0 ? Math.round((totals.unmarked / (totals.present + totals.absent + totals.unmarked)) * 100) : 0) }}</dd>
        </div>
        <div><dt>Days across weeks</dt><dd>{{ totals.days ?? 0 }} across {{ weeks }} weeks</dd></div>
      </dl>
    </section>

    <section class="ap-report__block">
      <h3 class="ap-dash__heading">Attendance Breakdown</h3>
      <div class="ap-table-wrap">
        <table class="ap-table">
          <caption class="ap-table__caption">{{ rows.length }} {{ scopeLabel.toLowerCase() }}</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Identifier</th>
              <th scope="col" class="ap-num">Present</th>
              <th scope="col" class="ap-num">Absent</th>
              <th scope="col" class="ap-num">Unmarked</th>
              <th scope="col" class="ap-num">Rate</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.personId">
              <td>{{ row.name }}</td>
              <td>{{ row.identifier }}</td>
              <td class="ap-num">{{ row.present }}</td>
              <td class="ap-num">{{ row.absent }}</td>
              <td class="ap-num">{{ row.unmarked }}</td>
              <td class="ap-num">{{ pct(row.rate) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </AdminModuleShell>
</template>

<style scoped>
@import './admin-panel.css';

.ap-report__block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ap-dash__heading {
  margin: 0;
  font-size: 0.9375rem;
}
</style>
