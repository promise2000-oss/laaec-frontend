<script setup lang="ts">
/**
 * AdminPermissionsPanel — `/permissions`: the two-tab page that grants access by
 * role or by user.
 *
 * WHAT THE LIVE PAGE DOES
 * -----------------------
 * Tab `View by role` lists every role with a permission count and opens a
 * `PermissionEditDialog` to change the grant. Tab `View all users` pages through
 * users 20 at a time (`USER_PAGE_SIZE = 20` in the deployed source) with a
 * search box, and offers the same edit dialog per user.
 *
 * WHAT THIS DOES
 * --------------
 * The same two tabs, the same grouping, the same per-row edit dialog, and
 * pagination at the same 20-per-page on the user tab. The dialog writes through
 * `SAVE_ADMIN_PERMISSION_GRANT`, so a grant made here changes what the roles
 * table counts and what the mock will enforce on the next write — it is not a
 * local checkbox that forgets itself on reload.
 *
 * WHY THE MATRIX IS NOT RENDERED ALL AT ONCE
 * -------------------------------------------
 * 32 modules × ~182 checkboxes is a page taller than any screen. The live page
 * collapses each role to a count and a 4-group preview (`groupPermissions`
 * slices to four and renders `Module (n)`), and this reproduces that: the list
 * shows the preview, the dialog shows the full matrix. The deployment's own
 * compromise, not a new one.
 *
 * THE DIALOG IS ONE SCROLLER
 * --------------------------
 * The matrix used to cap itself at 22rem with `overflow-y: auto` while sitting
 * inside `.ap-dialog__body`, which is itself the scroller. Two nested scrollers
 * meant the wheel scrolled the list over the list and the dialog over the gaps,
 * and the footer was never reachable. The matrix now renders at full height and
 * `AdminDialog`'s body owns the scroll, with edge shadows that appear only when
 * there is content in that direction.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { callApi } from '../../api';
import AdminDialog from './AdminDialog.vue';
import AdminModuleShell from './AdminModuleShell.vue';
import { useAdminSession } from './useAdminSession';
import type { AdminModule } from '../../types/admin-registry';

const props = defineProps<{ module: AdminModule }>();
const can = defineModel<((permission?: string | null) => boolean) | null>('can', { default: null });

const session = useAdminSession();
const mayEdit = computed(() => (can.value ? can.value('permissions.update') : true));

interface Row extends Record<string, unknown> {
  id: string;
  name: string;
  description: string;
  users: number;
  permissionIds: string[];
}
interface Permission {
  id: string;
  module: string;
  key: string;
  label: string;
}

const USER_PAGE_SIZE = 20;

const scope = ref<'role' | 'user'>('role');
const rows = ref<Row[]>([]);
const permissions = ref<Permission[]>([]);
const total = ref(0);
const page = ref(1);
const search = ref('');
const loading = ref(false);
const loadError = ref('');
const banner = ref('');
const busy = ref(false);
const dialogError = ref('');

const dialog = ref(false);
const editing = ref<Row | null>(null);
const draft = ref<string[]>([]);
/** The dialog's own filter. Purely client-side over the already-loaded matrix. */
const permQuery = ref('');

const byModule = computed(() => {
  const map = new Map<string, Permission[]>();
  for (const permission of permissions.value) {
    const list = map.get(permission.module) ?? [];
    list.push(permission);
    map.set(permission.module, list);
  }
  return [...map.entries()];
});

/**
 * The matrix as the dialog renders it: groups whose name or any of whose
 * permission labels matches the query.
 *
 * The match is on the label as well as the module name so searching "booking" or
 * "status, assignment" finds the permission, not just the heading it sits under.
 * Filtering here rather than through the API keeps the grant total stable while
 * the operator types — the dialog's own count must not move because a search box
 * changed what is on screen.
 */
const visibleGroups = computed(() => {
  const q = permQuery.value.trim().toLowerCase();
  return byModule.value
    .map(([moduleName, list]) => ({
      moduleName,
      // Both paths through this map produce one shape, so the unfiltered and the
      // filtered view are a single type and the template destructures one shape.
      list: q
        ? list.filter(
            (p) => p.label.toLowerCase().includes(q) || moduleName.toLowerCase().includes(q),
          )
        : list,
    }))
    .filter((group) => group.list.length > 0);
});

const visibleCount = computed(() =>
  visibleGroups.value.reduce((sum, group) => sum + group.list.length, 0),
);

const selectedIn = (list: Permission[]): number =>
  list.reduce((n, p) => (draft.value.includes(p.id) ? n + 1 : n), 0);

/**
 * `&middot;` is escaped because this string is dropped into `v-html` as an SVG
 * wrapper; the group name and the counts are the only things interpolated and
 * both are internal strings, never user input.
 */
const groupIcon = (moduleName: string): string => {
  const key = MODULE_ICON[moduleName] ?? 'grid';
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    focusable="false">${ICONS[key]}</svg>`;
};

/**
 * DOM ids for the `for`/`id` pairing. Permission keys are dotted
 * (`counselling.cases.manage`); dots are legal in an id but are a trap for any
 * later `querySelector`, so they are folded to dashes here. Derived from the key
 * alone, so it is stable across filtering and re-renders.
 */
const permDomId = (permission: Permission): string => `ap-perm-${permission.id.replace(/[^\w-]/g, '-')}`;
const groupDomId = (moduleName: string): string => `ap-grp-${moduleName.toLowerCase().replace(/[^\w-]/g, '-')}`;

/** `moduleLabel(module) (n)` — the live page's four-group preview. */
const preview = (row: Row): string[] =>
  byModule.value
    .map(([moduleName, list]) => ({
      moduleName,
      count: list.filter((p) => row.permissionIds.includes(p.id)).length,
    }))
    .filter((entry) => entry.count > 0)
    .slice(0, 4)
    .map((entry) => `${entry.moduleName} (${entry.count})`);

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_ADMIN_PERMISSION_MATRIX', {
      scope: scope.value,
      search: search.value || undefined,
      page: scope.value === 'user' ? page.value : undefined,
      limit: scope.value === 'user' ? USER_PAGE_SIZE : undefined,
    });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load permissions.');
    rows.value = data.rows as Row[];
    permissions.value = data.permissions;
    total.value = data.total ?? data.rows.length;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load permissions.';
    rows.value = [];
  } finally {
    loading.value = false;
  }
};

watch(scope, () => {
  page.value = 1;
  void load();
});
watch(page, () => void load());

let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    void load();
  }, 250);
});

const openEdit = (row: Row): void => {
  editing.value = row;
  draft.value = [...row.permissionIds];
  dialogError.value = '';
  // A filter left over from the last open would silently hide most of the matrix.
  permQuery.value = '';
  dialog.value = true;
};

/**
 * Select-all on a group header acts on the WHOLE group, not on the rows the
 * search happens to be showing.
 *
 * The alternative — select only what is visible — is the behaviour people expect
 * from a filtered list, but here it would mean that the `2/8` badge (whole group)
 * and what the checkbox just did (filtered subset) disagreed, with no way to see
 * which happened. The group header's promise is "this group's permissions", so
 * that is what it delivers, and the toolbar says plainly when a filter is hiding
 * part of it.
 */
const toggleModule = (moduleName: string, on: boolean): void => {
  const ids = permissions.value.filter((p) => p.module === moduleName).map((p) => p.id);
  draft.value = on ? [...new Set([...draft.value, ...ids])] : draft.value.filter((id) => !ids.includes(id));
};

const clearAll = (): void => {
  draft.value = [];
};

const save = async (): Promise<void> => {
  if (!editing.value) return;
  busy.value = true;
  dialogError.value = '';
  try {
    const data = await callApi('SAVE_ADMIN_PERMISSION_GRANT', {
      scope: scope.value,
      id: editing.value.id,
      permissionIds: draft.value,
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Save failed.');
    banner.value = `Saved ${draft.value.length} permission(s) for ${editing.value.name}.`;
    dialog.value = false;
    await load();
  } catch (e) {
    dialogError.value = e instanceof Error ? e.message : 'Save failed.';
  } finally {
    busy.value = false;
  }
};

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / USER_PAGE_SIZE)));

onMounted(load);

/* ── icons ─────────────────────────────────────────────────────────────────
 *
 * Inline SVG on the same 24-box, 1.7-stroke, round-cap geometry as the rail
 * glyphs in `AppShell.vue`, so a group chip and a nav item are the same drawing
 * at two sizes. No icon dependency: these are 18 paths of static geometry, and a
 * library would be a dependency for shapes that never change.
 */
const ICONS: Record<string, string> = {
  counselling:
    '<path d="M12 20.3 4.7 13a4.6 4.6 0 0 1 6.5-6.5l.8.8.8-.8A4.6 4.6 0 0 1 19.3 13Z"/>',
  users:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.3a3.2 3.2 0 0 1 0 5.4"/><path d="M17.5 14.2A5.5 5.5 0 0 1 20.5 19"/>',
  roles:
    '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="11" r="1.9"/><path d="M6.3 16.3a3.3 3.3 0 0 1 5.4 0"/><path d="M15 10h3.5M15 13.5h3.5"/>',
  permissions: '<circle cx="8" cy="12" r="3.6"/><path d="M11.6 12H21l-1.7 2.3 1.7 2.3h-5.8"/>',
  notifications:
    '<path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10Z"/><path d="M10 18.5a2 2 0 0 0 4 0"/>',
  attendance:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/><path d="m9 14.8 2 2 4-4"/>',
  academic:
    '<path d="M3.5 8.5 12 4.5l8.5 4-8.5 4Z"/><path d="M7 10.6v4.5c0 1.3 2.2 2.4 5 2.4s5-1.1 5-2.4v-4.5"/><path d="M20.5 8.5v5.2"/>',
  dashboards:
    '<path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="m13.4 10.6 4.1-4.1"/><path d="M3.5 18a9 9 0 1 1 17 0"/>',
  communication:
    '<path d="M20.5 11.5a7.6 7.6 0 0 1-8 7.5 8.9 8.9 0 0 1-2.7-.4L4.5 20l1.4-4.3a7.3 7.3 0 0 1-1.1-3.9 7.6 7.6 0 0 1 8-7.3 7.6 7.6 0 0 1 7.7 7Z"/>',
  disciplinary: '<path d="M12 4 21 19.5H3Z"/><path d="M12 10v4.2"/><path d="M12 17.2h.01"/>',
  lesson:
    '<path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8Z"/><path d="M14 3.5V8h4.5"/><path d="M8.5 12.5h7M8.5 16h5"/>',
  system:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.5 7.5l2 1.2M17.5 15.3l2 1.2M4.5 16.5l2-1.2M17.5 8.7l2-1.2"/>',
  students: '<circle cx="12" cy="8" r="3.4"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/>',
  departments:
    '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8.5 8.5H10M8.5 12H10M8.5 15.5H10M14 8.5h1.8M14 12h1.8M14 15.5h1.8"/>',
  leave:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/>',
  awards: '<circle cx="12" cy="9" r="5"/><path d="m8.8 13.6-1.3 6.9 4.5-2.4 4.5 2.4-1.3-6.9"/>',
  hr:
    '<rect x="3.5" y="7" width="17" height="12.5" rx="2"/><path d="M9 7V5.6A1.6 1.6 0 0 1 10.6 4h2.8A1.6 1.6 0 0 1 15 5.6V7"/><path d="M3.5 12.2h17"/>',
  categories:
    '<path d="M3.5 11.2V6.4A1.4 1.4 0 0 1 4.9 5h4.4l2 2.6h7.8A1.4 1.4 0 0 1 20.5 9v8.1a1.4 1.4 0 0 1-1.4 1.4H4.9a1.4 1.4 0 0 1-1.4-1.4Z"/>',
  inventory:
    '<path d="M12 3.5 20 7.6v8.8L12 20.5 4 16.4V7.6Z"/><path d="M4 7.6 12 11.7l8-4.1M12 11.7v8.8"/>',
  results: '<path d="M4 20V4.5M4 20h16M8.2 20v-5.6M12.6 20V9.4M17 20v-8"/>',
  store:
    '<path d="M4.6 8h14.8l-1.2 11.1a1.5 1.5 0 0 1-1.5 1.3H7.3a1.5 1.5 0 0 1-1.5-1.3Z"/><path d="M8.9 10.4V7.3a3.1 3.1 0 0 1 6.2 0v3.1"/>',
  wallet:
    '<rect x="3.5" y="6" width="17" height="13" rx="2"/><path d="M3.5 10.2h17"/><circle cx="16.2" cy="14.6" r="1.2"/>',
  fees:
    '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 9.6h18"/><path d="M6.8 14.6h4.4"/>',
  grid:
    '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
};

/**
 * Module name -> glyph. Exact match against `SEED_PERMISSION_MODULES`; anything
 * unrecognised (a module added later) falls back to `grid` rather than guessing,
 * so a wrong-looking icon can never be mistaken for a meaningful one.
 */
const MODULE_ICON: Record<string, string> = {
  Counselling: 'counselling',
  Users: 'users',
  Roles: 'roles',
  Permissions: 'permissions',
  Notifications: 'notifications',
  Attendance: 'attendance',
  Academic: 'academic',
  Dashboards: 'dashboards',
  Communication: 'communication',
  Disciplinary: 'disciplinary',
  'Teacher portal': 'academic',
  'Lesson planning': 'lesson',
  System: 'system',
  Staff: 'users',
  Students: 'students',
  Departments: 'departments',
  Leave: 'leave',
  Designations: 'awards',
  HR: 'hr',
  Categories: 'categories',
  Awards: 'awards',
  Inventory: 'inventory',
  Results: 'results',
  Store: 'store',
  Wallet: 'wallet',
  'School fees': 'fees',
};

const SEARCH_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
  'stroke-width="1.9" stroke-linecap="round" aria-hidden="true" focusable="false">' +
  '<circle cx="11" cy="11" r="6"/><path d="m20 20-3.6-3.6"/></svg>';
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
    <template #filters>
      <div class="ap-toolbar">
        <div class="ap-tabs" role="tablist" aria-label="Permission view">
          <button
            type="button"
            role="tab"
            class="ap-tab"
            :class="{ 'ap-tab--on': scope === 'role' }"
            :aria-selected="scope === 'role'"
            @click="scope = 'role'"
          >
            View by role
          </button>
          <button
            type="button"
            role="tab"
            class="ap-tab"
            :class="{ 'ap-tab--on': scope === 'user' }"
            :aria-selected="scope === 'user'"
            @click="scope = 'user'"
          >
            View all users
          </button>
        </div>
        <input
          v-if="scope === 'user'"
          v-model="search"
          class="ap-input ap-toolbar__search"
          type="search"
          placeholder="Search by name or email..."
          aria-label="Search users"
        />
      </div>
    </template>

    <template #empty>
      <p>No {{ scope === 'role' ? 'roles' : 'users' }} to show.</p>
    </template>

    <div class="ap-perm__list">
      <article v-for="row in rows" :key="row.id" class="ap-card ap-perm__row">
        <div class="ap-perm__head">
          <div class="ap-identity">
            <span class="ap-avatar" aria-hidden="true">{{ row.name.slice(0, 2).toUpperCase() }}</span>
            <span class="ap-identity__text">
              <span class="ap-identity__name">{{ row.name }}</span>
              <span v-if="row.description" class="ap-identity__sub">{{ row.description }}</span>
            </span>
          </div>
          <div class="ap-perm__meta">
            <span class="ap-badge ap-badge--info">{{ row.permissionIds.length }} permission(s)</span>
            <button
              v-if="mayEdit"
              type="button"
              class="ap-btn ap-btn--xs"
              @click="openEdit(row)"
            >
              Edit
            </button>
          </div>
        </div>
        <p v-if="preview(row).length" class="ap-inline-note">{{ preview(row).join(' · ') }}</p>
        <p v-else class="ap-inline-note">No permissions granted.</p>
      </article>
    </div>

    <div v-if="scope === 'user' && pageCount > 1" class="ap-pager">
      <span>Showing {{ (page - 1) * USER_PAGE_SIZE + 1 }}–{{ Math.min(page * USER_PAGE_SIZE, total) }} of {{ total }}</span>
      <span class="ap-pager__buttons">
        <button type="button" class="ap-btn ap-btn--xs" :disabled="page <= 1" @click="page = page - 1">Prev</button>
        <span>Page {{ page }} of {{ pageCount }}</span>
        <button type="button" class="ap-btn ap-btn--xs" :disabled="page >= pageCount" @click="page = page + 1">Next</button>
      </span>
    </div>

    <AdminDialog
      :open="dialog"
      :title="editing ? 'Permissions — ' + editing.name : 'Permissions'"
      size="xl"
      confirm-label="Save changes"
      :busy="busy"
      @close="dialog = false"
      @confirm="save"
    >
      <template #header>
        <div class="ap-perm__dlg-head">
          <div class="ap-perm__dlg-title">
            <h3 class="ap-dialog__title">Permissions</h3>
            <span v-if="editing" class="ap-badge ap-badge--info ap-perm__role-badge">{{ editing.name }}</span>
          </div>
          <p class="ap-perm__dlg-sub">Choose what this role can access</p>
        </div>
      </template>

      <template #toolbar>
        <div class="ap-perm__dlg-tools">
          <div class="ap-perm__search">
            <span class="ap-perm__search-icon" aria-hidden="true" v-html="SEARCH_ICON" />
            <input
              v-model="permQuery"
              class="ap-input"
              type="search"
              placeholder="Search permissions..."
              aria-label="Search permissions"
            />
          </div>
          <div class="ap-perm__dlg-count">
            <span class="ap-perm__pill" :class="{ 'ap-perm__pill--live': draft.length > 0 }">
              {{ draft.length }} selected
            </span>
            <button
              type="button"
              class="ap-perm__clear"
              :disabled="draft.length === 0"
              @click="clearAll"
            >
              Clear all
            </button>
          </div>
        </div>
      </template>

      <p v-if="permQuery.trim() && visibleCount < permissions.length" class="ap-perm__filter-note">
        Showing {{ visibleCount }} of {{ permissions.length }} permissions. A group's select all still
        covers the whole group.
      </p>

      <div class="ap-perm__matrix">
        <section
          v-for="group in visibleGroups"
          :key="group.moduleName"
          class="ap-perm__group"
          :aria-label="`${group.moduleName} permissions`"
        >
          <header class="ap-perm__group-head">
            <label class="ap-perm__group-pick" :for="groupDomId(group.moduleName)">
              <input
                :id="groupDomId(group.moduleName)"
                class="ap-perm__box"
                type="checkbox"
                :checked="selectedIn(group.list) === group.list.length"
                :indeterminate.prop="
                  selectedIn(group.list) > 0 && selectedIn(group.list) < group.list.length
                "
                :aria-label="`Select all ${group.moduleName} permissions`"
                @change="toggleModule(group.moduleName, ($event.target as HTMLInputElement).checked)"
              />
            </label>
            <span class="ap-perm__group-icon" aria-hidden="true" v-html="groupIcon(group.moduleName)" />
            <h4 class="ap-perm__group-name">{{ group.moduleName }}</h4>
            <span class="ap-perm__group-count"
              >{{ selectedIn(group.list) }}/{{ group.list.length }}</span
            >
          </header>

          <div class="ap-perm__group-body">
            <label
              v-for="permission in group.list"
              :key="permission.id"
              class="ap-perm__line ap-roles__item"
              :class="{ 'ap-perm__line--on': draft.includes(permission.id) }"
              :for="permDomId(permission)"
            >
              <input
                :id="permDomId(permission)"
                v-model="draft"
                class="ap-perm__box"
                type="checkbox"
                :value="permission.id"
              />
              <span class="ap-perm__label">{{ permission.label }}</span>
            </label>
          </div>
        </section>
      </div>

      <p v-if="visibleGroups.length === 0" class="ap-perm__empty">
        No permissions match your search.
      </p>

      <p v-if="dialogError" class="ap-form__error" role="alert">{{ dialogError }}</p>

      <template #footer-note>
        {{ draft.length }} of {{ permissions.length }} permissions selected
      </template>
    </AdminDialog>
  </AdminModuleShell>
</template>

<style scoped>
@import './admin-panel.css';

.ap-perm__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 0.75rem;
}

.ap-perm__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.375rem;
}

.ap-perm__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

/* ── dialog ────────────────────────────────────────────────────────────────
 * The class names are new but the shared `.ap-dialog__*` chrome is inherited
 * from AdminDialog; everything here is the permission matrix's own layout.
 */

.ap-perm__dlg-head { min-width: 0; }

.ap-perm__dlg-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.ap-perm__dlg-sub {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: var(--ap-text-muted, #5b6472);
}

.ap-perm__role-badge { font-size: 0.75rem; padding: 0.1875rem 0.5625rem; }

.ap-perm__dlg-tools {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.ap-perm__search {
  position: relative;
  flex: 1 1 220px;
  min-width: 0;
}

.ap-perm__search-icon {
  position: absolute;
  left: 0.625rem;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  color: var(--ap-text-muted, #5b6472);
  pointer-events: none;
  line-height: 0;
}

/* The origin sets a 13px 14px pad on every `.page-admin input`; the icon needs to
   sit inside the box, so the field's own left padding is raised to clear it. */
.ap-perm__search .ap-input { padding-left: 2.125rem; }

.ap-perm__dlg-count {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-shrink: 0;
}

.ap-perm__pill {
  display: inline-block;
  border-radius: 999px;
  padding: 0.1875rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  background: var(--ap-surface-sunken, #eef2f7);
  color: var(--ap-text-muted, #5b6472);
  font-variant-numeric: tabular-nums;
}

/* Only once something is actually selected does the count carry the accent, so
   an untouched dialog does not draw the eye to a number that is all zeros. */
.ap-perm__pill--live {
  background: var(--ap-accent-soft, #eaf2fb);
  color: var(--ap-accent, #16457c);
}

.ap-perm__clear {
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  background: none;
  border: 0;
  padding: 0.25rem 0.125rem;
  color: var(--ap-accent, #16457c);
  cursor: pointer;
  border-radius: 6px;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.ap-perm__clear:hover:not(:disabled) { color: var(--ap-accent-hover, #1c4e80); }

.ap-perm__clear:disabled {
  color: var(--ap-text-faint, #45505f);
  opacity: 0.6;
  cursor: not-allowed;
  text-decoration: none;
}

.ap-perm__clear:focus-visible {
  outline: 2px solid var(--laec-blue, #1c4e80);
  outline-offset: 2px;
}

.ap-perm__filter-note {
  margin: 0.75rem 0 0;
  font-size: 0.75rem;
  color: var(--ap-text-muted, #5b6472);
}

/* One column on mobile, two from md up. No `auto-fill`: the columns must not
   change width as the filter narrows the matrix, or the group headers jump
   sideways every keystroke. */
.ap-perm__matrix {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-top: 0.875rem;
}

@media (min-width: 768px) {
  .ap-perm__matrix { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.ap-perm__group {
  border: 1px solid var(--ap-line, #d7dee8);
  border-radius: 12px;
  background: var(--ap-surface, #fff);
  padding: 0.875rem;
  align-self: start;
  transition: border-color 0.15s ease;
}

.ap-perm__group:hover { border-color: var(--ap-line-accent, #bcd6f0); }

/*
 * `.ap-perm__group > .ap-perm__group-head` rather than the bare class.
 *
 * The element is a <header>, and `.page-admin header` (admin-page.css:73) plus
 * `.page-admin .ap-admin-panel header` (admin-panel-page.css) both match it.
 * The second one is (0,2,1) — it outranks a single scoped class (0,2,0) — and
 * its `border: 0` is what was erasing the rule below. The extra class in the
 * selector puts this at (0,3,0) so the divider survives on specificity alone.
 */
.ap-perm__group > .ap-perm__group-head {
  display: flex;
  /* `flex-direction: row` is here for the same reason the border is: the element
     is a <header>, and `.page-admin header` (admin-page.css:73) sets
     `flex-direction: column` with a gap, which stacked the checkbox above the
     group name instead of beside it. */
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 0.5rem;
  /* The shorthand, not just `padding-bottom`. `.page-admin header` sets
     `padding: 1rem 1.4rem 1.2rem`, so overriding only the bottom left the group
     header carrying a 22 px left indent — measured on desktop as its content
     starting 22 px in from the card's edge. */
  padding: 0 0 0.625rem;
  margin-bottom: 0.375rem;
  border: 0;
  border-bottom: 1px solid var(--ap-line, #d7dee8);
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

/*
 * The select-all is the one control in the header that is not already inside a
 * full-width row, so it is wrapped in its own label purely to give it a hit
 * area. The label contains nothing but the input — the icon and the heading sit
 * outside it, because `<label>` takes phrasing content and an `<h4>` is flow
 * content, so wrapping the header in one would be invalid markup.
 */
.ap-perm__group-pick {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.ap-perm__group-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--ap-accent-soft, #eaf2fb);
  color: var(--ap-accent, #16457c);
  line-height: 0;
}

.ap-perm__group-name {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  min-width: 0;
  overflow-wrap: anywhere;
}

.ap-perm__group-count {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 0.0625rem 0.4375rem;
  font-size: 0.6875rem;
  font-weight: 600;
  background: var(--ap-surface-sunken, #eef2f7);
  color: var(--ap-text-muted, #5b6472);
  font-variant-numeric: tabular-nums;
}

.ap-perm__group-body {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

/*
 * The whole row is the label, so the entire strip toggles the checkbox — which is
 * the point of a 18px target inside a 264px row. The label is sentence case at
 * reading weight; it was `text-transform: uppercase`, `font-weight: 800` and
 * `letter-spacing: 1.2px`, which turned "Update counselling cases (status,
 * assignment)" into a block of shouted small caps and was the single biggest
 * reason the matrix read as cramped.
 */
.ap-perm__line {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.5rem 0.625rem;
  /* `.page-admin label` (admin-page.css:690) puts `margin-bottom: 0.45rem` on
     every label in the console. At 0.125rem of row gap that made each row
     7.2px taller than its own content and was most of the "cramped" look. */
  margin-bottom: 0;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.ap-perm__line:hover { background: var(--ap-surface-tint, #f2f6fb); }

.ap-perm__line--on { background: var(--ap-accent-soft, #eaf2fb); }
.ap-perm__line--on:hover { background: var(--ap-surface-hint, #f2f7fd); }

.ap-perm__box {
  margin-top: 1px;
  flex: 0 0 auto;
}

.ap-perm__label {
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.45;
  color: var(--ap-text-strong, #3b4553);
  /*
   * `text-transform` and `letter-spacing` are inherited, and the row is a
   * <label>, which `.page-admin label` (admin-page.css:690) sets to
   * `text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800`. Setting
   * the size and weight here is not enough — without these two the permission
   * text renders as tracked-out small caps, which is the single biggest reason
   * the matrix read as cramped.
   */
  text-transform: none;
  letter-spacing: normal;
}

.ap-perm__line--on .ap-perm__label { color: var(--ap-accent, #16457c); }

.ap-perm__empty {
  margin: 2.5rem 0;
  text-align: center;
  font-size: 0.875rem;
  color: var(--ap-text-muted, #5b6472);
}

/*
 * A touch target is the whole row, so the strip grows to clear 44px rather than
 * the 18px checkbox inside it. Keyed on `pointer: coarse` OR a narrow viewport:
 * a narrow window driven by a mouse is still a narrow window, and the operator
 * will be aiming with a finger or a trackpad from that distance anyway.
 */
@media (pointer: coarse), (max-width: 640px) {
  .ap-perm__line { min-height: 44px; align-items: center; }

  /* The 18px box keeps its place on the header's left edge — `flex-start`, not
     `center` — so the icon and group name do not shift 16px right between
     breakpoints. The extra width extends the hit area to the right instead,
     over the 8px gap and the leading edge of the decorative icon. */
  .ap-perm__group-pick {
    min-width: 44px;
    min-height: 44px;
    justify-content: flex-start;
  }

  /* The search field and "Clear all" are 32px and 26px tall at desktop size.
     Both are primary targets in this toolbar, so both clear 44px here rather
     than only the permission rows. */
  .ap-perm__search .ap-input { min-height: 44px; }
  .ap-perm__clear { min-height: 44px; display: inline-flex; align-items: center; }
}
</style>