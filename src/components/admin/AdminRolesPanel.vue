<script setup lang="ts">
/**
 * AdminRolesPanel — `/roles`, which is a table plus two dialogs the generic
 * panel cannot express: the role form's permission matrix, and assign/unassign.
 *
 * THE PERMISSION MATRIX
 * ---------------------
 * `/roles/new` renders, for each of 32 permission modules, a `Select all`
 * checkbox and one checkbox per permission carrying the live dialog's own label.
 * That is reproduced here verbatim in wording and grouping. A role's saved
 * permission *count* is what the roles table shows, and it comes back from the
 * mock rather than being counted in this component — the same division of
 * labour the generic panel uses for every other derived value.
 *
 * ASSIGN / UNASSIGN
 * -----------------
 * The live page offers both as toolbar buttons opening a user picker filtered to
 * the chosen role. Here they are one dialog each with a role select and a
 * multi-select of users, which is the same operation with the same effect; the
 * live dialog's exact layout is not observable without opening it and selecting
 * a role, and inventing a layout would be a guess. Recorded in
 * feature-inventory.md as a documented simplification, not as parity.
 */
import { computed, onMounted, ref } from 'vue';
import { callApi } from '../../api';
import AdminDialog from './AdminDialog.vue';
import AdminModuleShell from './AdminModuleShell.vue';
import { useAdminSession } from './useAdminSession';
import type { AdminModule } from '../../types/admin-registry';

const props = defineProps<{ module: AdminModule }>();
const can = defineModel<((permission?: string | null) => boolean) | null>('can', { default: null });

const session = useAdminSession();
const permitted = (permission?: string): boolean => {
  if (!permission) return true;
  return can.value ? can.value(permission) : true;
};

interface RoleRow extends Record<string, unknown> {
  id: string;
  name: string;
  description: string;
  users: number;
  permissions: number;
}
interface Permission {
  id: string;
  module: string;
  key: string;
  label: string;
}

const roles = ref<RoleRow[]>([]);
const permissions = ref<Permission[]>([]);
const grants = ref<Record<string, string[]>>({});
const users = ref<Array<Record<string, unknown> & { id: string; name: string; roles: string[] }>>([]);
const loading = ref(false);
const loadError = ref('');
const banner = ref('');
const busy = ref(false);
const dialogError = ref('');

const search = ref('');

/* Grouped permissions, in the catalogue's own module order. */
const grouped = computed(() => {
  const map = new Map<string, Permission[]>();
  for (const permission of permissions.value) {
    const list = map.get(permission.module) ?? [];
    list.push(permission);
    map.set(permission.module, list);
  }
  return [...map.entries()];
});

const selectedCount = ref(0);

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await callApi('GET_ADMIN_PERMISSION_MATRIX', { scope: 'role' });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load roles.');
    /*
     * The matrix rows carry `permissionIds`, not the roles table's `permissions`
     * count — they are two different views of the same grant, and the count is
     * recomputed from the ids by `GET_ADMIN_PERMISSION_MATRIX`. Casting through
     * `unknown` because the two row shapes share no required field beyond `id`,
     * so TypeScript cannot see the overlap; the only consumer of this list is the
     * template, which reads name / description / users / permissionIds.
     */
    roles.value = data.rows as unknown as RoleRow[];
    permissions.value = data.permissions;
    grants.value = Object.fromEntries(data.rows.map((row) => [row.id, row.permissionIds]));
    selectedCount.value = 0;

    const userData = await callApi('LIST_ADMIN_RECORDS', { resource: 'users', limit: 200 });
    if (userData.status === 'success') {
      users.value = (userData.records as Array<Record<string, unknown> & { id: string; roles: string[] }>).map((row) => ({
        ...row,
        name: String(row.fullName ?? row.name ?? row.id),
        roles: (row.roles as string[]) ?? [],
      }));
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load roles.';
  } finally {
    loading.value = false;
  }
};

/* ── the role form ─────────────────────────────────────────────────────── */

const roleDialog = ref(false);
const editingRoleId = ref('');
const roleName = ref('');
const roleDescription = ref('');
const rolePermissions = ref<string[]>([]);
const roleErrors = ref<Record<string, string>>({});

const openRole = (role: RoleRow | null): void => {
  roleErrors.value = {};
  roleDialog.value = true;
  editingRoleId.value = role?.id ?? '';
  roleName.value = role?.name ?? '';
  roleDescription.value = role?.description ?? '';
  rolePermissions.value = role ? [...(grants.value[role.id] ?? [])] : [];
};

const closeRole = (): void => {
  roleDialog.value = false;
  dialogError.value = '';
  roleErrors.value = {};
};

const toggleModule = (module: string, on: boolean): void => {
  const ids = permissions.value.filter((p) => p.module === module).map((p) => p.id);
  rolePermissions.value = on
    ? [...new Set([...rolePermissions.value, ...ids])]
    : rolePermissions.value.filter((id) => !ids.includes(id));
};

/**
 * Select or clear every permission in the matrix.
 *
 * The live `/roles/new` form has no global "select all" — each module's own
 * `Select all` is the only bulk control it offers — so this exists for the case
 * where an operator genuinely wants an unrestricted role and would otherwise have
 * to click thirty-two module checkboxes. It is rendered as a labelled pair of
 * buttons rather than a checkbox so the two states cannot be confused, and the
 * count in the heading tells the operator what either will do before they press it.
 */
const allSelected = computed(() => permissions.value.length > 0 && rolePermissions.value.length === permissions.value.length);

const toggleAll = (on: boolean): void => {
  rolePermissions.value = on ? permissions.value.map((p) => p.id) : [];
};

const saveRole = async (): Promise<void> => {
  /* The live form's only validation, verbatim: "Role name is required." */
  const errors: Record<string, string> = {};
  if (!roleName.value.trim()) errors.name = 'Role name is required.';
  roleErrors.value = errors;
  if (Object.keys(errors).length) return;

  busy.value = true;
  dialogError.value = '';
  try {
    const data = await callApi('SAVE_ADMIN_ROLE', {
      id: editingRoleId.value || undefined,
      name: roleName.value.trim(),
      description: roleDescription.value.trim(),
      permissionIds: rolePermissions.value,
      actor: session.actor(),
    });
    if (data.status !== 'success' || !data.role) throw new Error(data.message || 'Save failed.');
    banner.value = editingRoleId.value ? 'Role saved.' : 'Role created.';
    closeRole();
    await load();
  } catch (e) {
    dialogError.value = e instanceof Error ? e.message : 'Save failed.';
  } finally {
    busy.value = false;
  }
};

/* ── assign / unassign ─────────────────────────────────────────────────── */

const assignDialog = ref<'assign' | 'unassign' | null>(null);
const assignRole = ref('');
const assignUsers = ref<string[]>([]);
const filteredUsers = computed(() => {
  const term = search.value.toLowerCase();
  const term2 = assignRole.value;
  return users.value
    .filter((u) => (term2 ? u.roles.includes(term2) : true))
    .filter((u) => !term || u.name.toLowerCase().includes(term) || String(u.email ?? '').toLowerCase().includes(term));
});

const openAssign = (kind: 'assign' | 'unassign'): void => {
  assignDialog.value = kind;
  assignRole.value = '';
  assignUsers.value = [];
};

const submitAssign = async (): Promise<void> => {
  if (!assignRole.value) {
    dialogError.value = 'Select a role.';
    return;
  }
  if (assignUsers.value.length === 0) {
    dialogError.value = 'Select at least one user.';
    return;
  }
  busy.value = true;
  dialogError.value = '';
  try {
    const data = await callApi(assignDialog.value === 'assign' ? 'ASSIGN_ROLE' : 'UNASSIGN_ROLE', {
      role: assignRole.value,
      userIds: assignUsers.value,
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Something went wrong.');
    banner.value = assignDialog.value === 'assign' ? 'Role assigned.' : 'Role unassigned.';
    assignDialog.value = null;
    await load();
  } catch (e) {
    dialogError.value = e instanceof Error ? e.message : 'Something went wrong.';
  } finally {
    busy.value = false;
  }
};

onMounted(load);
</script>

<template>
  <AdminModuleShell
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :empty-count="roles.length"
    :banner="banner"
    @retry="load"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button v-if="permitted('roles.update')" type="button" class="ap-btn" @click="openAssign('assign')">
        Assign role
      </button>
      <button v-if="permitted('roles.update')" type="button" class="ap-btn" @click="openAssign('unassign')">
        Unassign role
      </button>
      <button v-if="permitted('roles.create')" type="button" class="ap-btn ap-btn--primary" @click="openRole(null)">
        Add Role
      </button>
    </template>

    <div class="ap-table-wrap">
      <table class="ap-table">
        <caption class="ap-table__caption">{{ roles.length }} roles</caption>
        <thead>
          <tr>
            <th scope="col">Role</th>
            <th scope="col" class="ap-num">Users</th>
            <th scope="col" class="ap-num">Permissions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="role in roles" :key="role.id">
            <td>
              <div class="ap-identity">
                <span class="ap-avatar" aria-hidden="true">{{ role.name.slice(0, 2).toUpperCase() }}</span>
                <span class="ap-identity__text">
                  <span class="ap-identity__name">{{ role.name }}</span>
                  <span v-if="role.description" class="ap-identity__sub">{{ role.description }}</span>
                </span>
              </div>
            </td>
            <td class="ap-num">{{ role.users }}</td>
            <td class="ap-num">{{ role.permissions }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- The role form: name, description, and the permission matrix. -->
    <AdminDialog
      :open="roleDialog"
      :title="editingRoleId ? 'Edit Role' : 'Add Role'"
      confirm-label="Save"
      :busy="busy"
      @close="closeRole"
      @confirm="saveRole"
    >
      <p class="ap-inline-note">Create the role and the permissions it grants.</p>

      <label class="ap-field">
        <span class="ap-field__label">Name <span class="ap-field__req">*</span></span>
        <input v-model="roleName" class="ap-input" type="text" />
        <span v-if="roleErrors.name" class="ap-form__error" role="alert">{{ roleErrors.name }}</span>
      </label>

      <label class="ap-field">
        <span class="ap-field__label">Description</span>
        <input v-model="roleDescription" class="ap-input" type="text" />
      </label>

      <h4 class="ap-band">Assign permissions — {{ rolePermissions.length }} selected</h4>
      <div class="ap-toolbar ap-roles__bulk">
        <button type="button" class="ap-btn ap-btn--xs" :disabled="allSelected" @click="toggleAll(true)">
          Select all
        </button>
        <button type="button" class="ap-btn ap-btn--xs" :disabled="rolePermissions.length === 0" @click="toggleAll(false)">
          Clear all
        </button>
      </div>
      <div class="ap-roles__matrix">
        <div v-for="[moduleName, list] in grouped" :key="moduleName" class="ap-roles__group">
          <label class="ap-check ap-roles__head">
            <input
              type="checkbox"
              :checked="list.every((p) => rolePermissions.includes(p.id))"
              @change="toggleModule(moduleName, ($event.target as HTMLInputElement).checked)"
            />
            <strong>{{ moduleName }}</strong>
          </label>
          <label v-for="permission in list" :key="permission.id" class="ap-check ap-roles__item">
            <input v-model="rolePermissions" type="checkbox" :value="permission.id" />
            <span>{{ permission.label }}</span>
          </label>
        </div>
      </div>
      <p v-if="dialogError" class="ap-form__error" role="alert">{{ dialogError }}</p>
    </AdminDialog>

    <!-- Assign / unassign. -->
    <AdminDialog
      :open="assignDialog !== null"
      :title="assignDialog === 'assign' ? 'Assign role' : 'Unassign role'"
      :confirm-label="assignDialog === 'assign' ? 'Assign' : 'Unassign'"
      :busy="busy"
      @close="assignDialog = null"
      @confirm="submitAssign"
    >
      <label class="ap-field">
        <span class="ap-field__label">Role</span>
        <select v-model="assignRole" class="ap-input">
          <option value="">Select a role</option>
          <option v-for="role in roles" :key="role.id" :value="role.name">{{ role.name }}</option>
        </select>
      </label>
      <input v-model="search" class="ap-input" type="search" placeholder="Search by name or email..." />
      <div class="ap-checklist">
        <label v-for="user in filteredUsers" :key="user.id" class="ap-check">
          <input v-model="assignUsers" type="checkbox" :value="user.id" />
          <span>{{ user.name }} <span class="ap-identity__sub">{{ user.email }}</span></span>
        </label>
      </div>
      <p v-if="filteredUsers.length === 0" class="ap-inline-note">No users match this role.</p>
      <p v-if="dialogError" class="ap-form__error" role="alert">{{ dialogError }}</p>
    </AdminDialog>
  </AdminModuleShell>
</template>

<style scoped>
@import './admin-panel.css';

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

.ap-roles__head {
  margin-bottom: 0.25rem;
  font-size: 0.75rem;
}

.ap-roles__item {
  font-size: 0.75rem;
  color: #3b4553;
}

.ap-roles__bulk {
  margin-bottom: 0.5rem;
}
</style>
