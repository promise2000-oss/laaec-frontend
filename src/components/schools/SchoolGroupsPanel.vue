<script setup lang="ts">
/**
 * SchoolGroupsPanel — create, edit, delete and populate school groups
 * (multi-school spec §2).
 *
 * WHY A STANDALONE COMPONENT
 * --------------------------
 * The seven transcribed LAEC panels are inline in `AdminView.vue` because they
 * are the origin's own markup. Groups are a NEW surface with no origin
 * counterpart, so they live here rather than adding several hundred lines to a
 * view that is already the Master Command Center. The view still owns the panel
 * `<div id="school-groups">` (so `showTab`'s element guard passes) and simply
 * mounts this component inside it.
 *
 * WHY MEMBERSHIP IS DERIVED, NOT STORED
 * -------------------------------------
 * A school belongs to AT MOST ONE group (spec §7 exclusive membership). That is
 * modelled as a single `groupId` column on the school, and this panel's member
 * lists are derived from it by the transport (`GET_SCHOOL_GROUPS` returns each
 * group's `schoolCodes`). So "add", "remove" and "transfer" are all the SAME
 * call — `SET_SCHOOL_GROUP(code, groupId | null)` — and a transfer is atomic:
 * pointing a school at a new group automatically detaches it from the old one.
 * There is no member list stored on the group to fall out of sync.
 *
 * FEEDBACK AND CONFIRMATION
 * -------------------------
 * The panel cannot reach `AdminView`'s `winAlert`, so it carries its own inline
 * banner for results and an inline modal for the one destructive action
 * (deleting a group). Delete is the operation the spec singles out — "delete
 * groups without accidentally deleting the schools" — so it confirms, names the
 * exact number of schools that will be KEPT, and never removes a school.
 */
import { computed, onMounted, ref } from 'vue';
import { callApi } from '../../api';
import { msgOf } from '../../lib/console';
import { STORAGE_KEYS } from '../../types';
import type { AdminRole, SchoolGroup, SchoolRecord } from '../../types';

type GroupWithMembers = SchoolGroup & { schoolCodes: string[] };

const groups = ref<GroupWithMembers[]>([]);
const schools = ref<SchoolRecord[]>([]);
const loading = ref(false);
const banner = ref('');

/* Create form. */
const newGroupName = ref('');
const newGroupDescription = ref('');

/* Inline edit state: which group id is being edited, and its draft fields. */
const editingId = ref<string | null>(null);
const editName = ref('');
const editDescription = ref('');

/* Per-group draft of the school chosen in the "add to group" select. */
const addCandidate = ref<Record<string, string>>({});

/* The pending destructive action: the group the administrator asked to delete. */
const confirmDeleteId = ref<string | null>(null);

const creatorUsername = (): string => localStorage.getItem(STORAGE_KEYS.AdminUsername) || '';
const creatorRole = (): AdminRole =>
  (localStorage.getItem(STORAGE_KEYS.AdminRole) || 'SUPER_ADMIN') as AdminRole;

const loadAll = async (): Promise<void> => {
  loading.value = true;
  try {
    const [groupData, schoolData] = await Promise.all([
      callApi('GET_SCHOOL_GROUPS', { schoolID: 'ALL' }),
      callApi('GET_SCHOOLS', { schoolID: 'ALL' }),
    ]);
    groups.value = groupData.status === 'success' ? groupData.groups : [];
    schools.value = schoolData.status === 'success' ? schoolData.schools : [];
  } catch (e) {
    banner.value = msgOf(e) || 'School groups could not be loaded.';
  }
  loading.value = false;
};

/** The display name for a school code, falling back to the code itself. */
const schoolNameOf = (code: string): string =>
  schools.value.find((s) => s.Code === code)?.Name || code;

/**
 * Schools that can be added to a given group. A school already IN this group is
 * excluded (nothing to add); a school in ANOTHER group is included, because
 * adding it there is exactly how a transfer is performed.
 */
const availableFor = (group: GroupWithMembers): SchoolRecord[] =>
  schools.value.filter((s) => s.groupId !== group.id);

/** The group this panel will confirm deleting, resolved for the modal. */
const confirmDeleteGroup = computed<GroupWithMembers | null>(
  () => groups.value.find((g) => g.id === confirmDeleteId.value) ?? null,
);

const showBanner = (message: string): void => {
  banner.value = message;
  window.setTimeout(() => {
    if (banner.value === message) banner.value = '';
  }, 6000);
};

/* ── create ───────────────────────────────────────────────────────────── */

const createGroup = async (): Promise<void> => {
  const name = newGroupName.value.trim();
  if (!name) {
    showBanner('Enter a group name.');
    return;
  }
  loading.value = true;
  try {
    const data = await callApi('CREATE_SCHOOL_GROUP', {
      name,
      description: newGroupDescription.value.trim(),
      creatorUsername: creatorUsername(),
      creatorRole: creatorRole(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Group could not be created.');
    newGroupName.value = '';
    newGroupDescription.value = '';
    showBanner(data.message || `Group "${name}" created.`);
    await loadAll();
  } catch (e) {
    showBanner(msgOf(e) || 'Group could not be created.');
  }
  loading.value = false;
};

/* ── edit ─────────────────────────────────────────────────────────────── */

const startEdit = (group: GroupWithMembers): void => {
  editingId.value = group.id;
  editName.value = group.name;
  editDescription.value = group.description || '';
};

const cancelEdit = (): void => {
  editingId.value = null;
};

const saveEdit = async (group: GroupWithMembers): Promise<void> => {
  const name = editName.value.trim();
  if (!name) {
    showBanner('A group name is required.');
    return;
  }
  loading.value = true;
  try {
    const data = await callApi('UPDATE_SCHOOL_GROUP', {
      id: group.id,
      name,
      description: editDescription.value.trim(),
      creatorUsername: creatorUsername(),
      creatorRole: creatorRole(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Group could not be updated.');
    editingId.value = null;
    showBanner(data.message || `Group "${name}" updated.`);
    await loadAll();
  } catch (e) {
    showBanner(msgOf(e) || 'Group could not be updated.');
  }
  loading.value = false;
};

/* ── delete (keeps the schools) ───────────────────────────────────────── */

const requestDelete = (group: GroupWithMembers): void => {
  confirmDeleteId.value = group.id;
};

const cancelDelete = (): void => {
  confirmDeleteId.value = null;
};

const confirmDelete = async (): Promise<void> => {
  const group = confirmDeleteGroup.value;
  if (!group) return;
  loading.value = true;
  try {
    const data = await callApi('DELETE_SCHOOL_GROUP', {
      id: group.id,
      creatorUsername: creatorUsername(),
      creatorRole: creatorRole(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Group could not be deleted.');
    confirmDeleteId.value = null;
    showBanner(data.message || `Group "${group.name}" deleted. Its schools were kept.`);
    await loadAll();
  } catch (e) {
    showBanner(msgOf(e) || 'Group could not be deleted.');
  }
  loading.value = false;
};

/* ── membership: add / transfer / remove ──────────────────────────────── */

/*
 * One call for all three (spec §2). Passing a group id adds the school there —
 * transferring it out of any group it was already in — and passing an empty
 * string removes it. The transport enforces the exclusive single-`groupId`
 * model, so a school can never end up in two groups.
 */
const setMembership = async (code: string, groupId: string | null): Promise<void> => {
  loading.value = true;
  try {
    const data = await callApi('SET_SCHOOL_GROUP', {
      code,
      groupId,
      creatorUsername: creatorUsername(),
      creatorRole: creatorRole(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Membership could not be changed.');
    showBanner(data.message || 'Membership updated.');
    await loadAll();
  } catch (e) {
    showBanner(msgOf(e) || 'Membership could not be changed.');
    await loadAll();
  }
  loading.value = false;
};

const addMember = (group: GroupWithMembers): void => {
  const code = addCandidate.value[group.id];
  if (!code) {
    showBanner('Choose a school to add to this group.');
    return;
  }
  addCandidate.value[group.id] = '';
  void setMembership(code, group.id);
};

const removeMember = (code: string): void => {
  void setMembership(code, null);
};

onMounted(loadAll);
</script>

<template>
  <div>
    <!-- ── create group (spec §9 Create School Group) ─────────────────── -->
    <div class="card">
      <h3>School Groups</h3>
      <p style="font-size: 0.75rem; color: #666; margin-bottom: 1.5rem">
        Group schools for shared reporting and administration. A school belongs to at most one group; adding a
        school that is already in another group transfers it here. Deleting a group never deletes its schools —
        they simply become ungrouped.
      </p>
      <div
        v-if="banner"
        style="border: 1px solid #cfe3d4; background: #eef7f0; color: #14532d; padding: 10px 14px; border-radius: 6px; font-size: 0.78rem; margin-bottom: 1rem"
      >
        {{ banner }}
      </div>
      <div class="grid-2">
        <div>
          <label>Group Name</label>
          <input type="text" v-model="newGroupName" placeholder="e.g. Group A" />
        </div>
        <div>
          <label>Description (optional)</label>
          <input type="text" v-model="newGroupDescription" placeholder="e.g. Coastal deanery colleges" />
        </div>
      </div>
      <button class="btn-primary" style="margin-top: 20px" :disabled="loading" @click="createGroup()">
        CREATE GROUP
      </button>
    </div>

    <div v-if="loading && !groups.length" class="card" style="color: #777; font-size: 0.8rem">
      Loading groups…
    </div>

    <!-- ── group list (spec §9 Group Details) ─────────────────────────── -->
    <div class="card" v-for="group in groups" :key="group.id">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px">
        <div>
          <h4 style="margin: 0; font-size: 1rem">{{ group.name }}</h4>
          <p style="margin: 4px 0 0; font-size: 0.74rem; color: #666">{{ group.description || 'No description.' }}</p>
          <span style="font-size: 0.7rem; color: #888">{{ group.schoolCodes.length }} school{{ group.schoolCodes.length === 1 ? '' : 's' }}</span>
        </div>
        <div style="display: flex; gap: 8px">
          <button style="background: none; border: 1px solid #ddd; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 0.74rem" @click="startEdit(group)">Edit</button>
          <button style="background: none; border: 1px solid #f0c2c2; color: #8f2a2a; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 0.74rem" @click="requestDelete(group)">Delete</button>
        </div>
      </div>

      <!-- inline edit -->
      <div v-if="editingId === group.id" style="margin-top: 1rem; border-top: 1px solid #eee; padding-top: 1rem">
        <div class="grid-2">
          <div>
            <label>Group Name</label>
            <input type="text" v-model="editName" />
          </div>
          <div>
            <label>Description</label>
            <input type="text" v-model="editDescription" />
          </div>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 14px">
          <button class="btn-primary" @click="saveEdit(group)">SAVE</button>
          <button style="background: #eee; color: #333; border: none; padding: 9px 16px; border-radius: 6px; cursor: pointer" @click="cancelEdit()">CANCEL</button>
        </div>
      </div>

      <!-- members -->
      <div style="margin-top: 1.25rem; border-top: 1px solid #eee; padding-top: 1rem">
        <h5 style="margin: 0 0 0.75rem; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: #666">Schools in this group</h5>
        <ul style="list-style: none; padding: 0; margin: 0 0 1rem">
          <li
            v-for="code in group.schoolCodes"
            :key="code"
            style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f2f2f2; font-size: 0.82rem"
          >
            <span>{{ schoolNameOf(code) }} <code style="color: #999; font-size: 0.72rem">{{ code }}</code></span>
            <button style="background: none; border: none; color: #8f2a2a; cursor: pointer; font-size: 0.74rem" @click="removeMember(code)">Remove</button>
          </li>
          <li v-if="!group.schoolCodes.length" style="color: #999; font-size: 0.8rem; padding: 8px 0">
            No schools in this group yet.
          </li>
        </ul>

        <!-- add / transfer -->
        <div style="display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap">
          <div style="flex: 1; min-width: 220px">
            <label style="font-size: 0.72rem; color: #666">Add a school</label>
            <select v-model="addCandidate[group.id]" style="width: 100%; padding: 7px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.78rem">
              <option value="">— Choose a school —</option>
              <option v-for="s in availableFor(group)" :key="s.Code" :value="s.Code">
                {{ s.Name }} ({{ s.groupId ? 'in ' + (groups.find((g2) => g2.id === s.groupId)?.name || 'another group') : 'ungrouped' }})
              </option>
            </select>
          </div>
          <button class="btn-primary" style="margin-bottom: 2px" @click="addMember(group)">ADD TO GROUP</button>
        </div>
        <p style="font-size: 0.68rem; color: #999; margin: 8px 0 0">
          Adding a school that is already in another group transfers it here.
        </p>
      </div>
    </div>

    <div v-if="!loading && !groups.length" class="card" style="text-align: center; color: #999; font-size: 0.8rem">
      No school groups yet. Create one above to start grouping schools.
    </div>

    <!-- ── delete confirmation (spec §2: keeps the schools) ───────────── -->
    <div
      v-if="confirmDeleteGroup"
      style="position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000"
      @click.self="cancelDelete()"
    >
      <div style="background: #fff; border-radius: 10px; padding: 28px; max-width: 420px; width: 92%">
        <h3 style="margin: 0 0 12px; font-size: 1.1rem">Delete group “{{ confirmDeleteGroup.name }}”?</h3>
        <p style="font-size: 0.82rem; color: #555; margin: 0 0 20px; line-height: 1.5">
          This removes the group. Its
          <strong>{{ confirmDeleteGroup.schoolCodes.length }} school{{ confirmDeleteGroup.schoolCodes.length === 1 ? '' : 's' }}</strong>
          will be <strong>kept</strong> and become ungrouped — no school is deleted.
        </p>
        <div style="display: flex; gap: 10px; justify-content: flex-end">
          <button style="background: #eee; color: #333; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer" @click="cancelDelete()">Cancel</button>
          <button style="background: #8f2a2a; color: #fff; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer" @click="confirmDelete()">Delete Group</button>
        </div>
      </div>
    </div>
  </div>
</template>
