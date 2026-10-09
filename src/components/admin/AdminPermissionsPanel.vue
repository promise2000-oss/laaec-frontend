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

const byModule = computed(() => {
  const map = new Map<string, Permission[]>();
  for (const permission of permissions.value) {
    const list = map.get(permission.module) ?? [];
    list.push(permission);
    map.set(permission.module, list);
  }
  return [...map.entries()];
});

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
  dialog.value = true;
};

const toggleModule = (moduleName: string, on: boolean): void => {
  const ids = permissions.value.filter((p) => p.module === moduleName).map((p) => p.id);
  draft.value = on ? [...new Set([...draft.value, ...ids])] : draft.value.filter((id) => !ids.includes(id));
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
      confirm-label="Save"
      :busy="busy"
      @close="dialog = false"
      @confirm="save"
    >
      <p class="ap-inline-note">{{ draft.length }} permission(s) selected.</p>
      <div class="ap-roles__matrix">
        <div v-for="[moduleName, list] in byModule" :key="moduleName" class="ap-roles__group">
          <label class="ap-check ap-roles__head">
            <input
              type="checkbox"
              :checked="list.every((p) => draft.includes(p.id))"
              @change="toggleModule(moduleName, ($event.target as HTMLInputElement).checked)"
            />
            <strong>{{ moduleName }}</strong>
          </label>
          <label v-for="permission in list" :key="permission.id" class="ap-check ap-roles__item">
            <input v-model="draft" type="checkbox" :value="permission.id" />
            <span>{{ permission.label }}</span>
          </label>
        </div>
      </div>
      <p v-if="dialogError" class="ap-form__error" role="alert">{{ dialogError }}</p>
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

.ap-roles__matrix {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 0.625rem;
  max-height: 22rem;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.ap-roles__group {
  border: 1px solid var(--laec-line, #d7dee8);
  border-radius: 10px;
  padding: 0.5rem 0.625rem;
}

.ap-roles__head { margin-bottom: 0.25rem; font-size: 0.75rem; }
.ap-roles__item { font-size: 0.75rem; color: #3b4553; }
</style>
