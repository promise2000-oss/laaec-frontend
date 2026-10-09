/**
 * The signed-in operator's session: roles, permissions, and the sync that keeps
 * them current (D-71).
 *
 * The reference implementation holds this in a zustand `useAuthStore` persisted
 * to sessionStorage, re-read on every navigation, on tab focus and every thirty
 * seconds. This is the same design in the stack this project already approved:
 * Pinia was installed in `main.ts` from the start but carried no stores (D-45),
 * and a session is exactly the state a store exists for - shared by six
 * consoles, read by the rail, the route guard and every gated control, and
 * expected to change underneath them without a re-login.
 *
 * Two properties are worth stating because they are what make the rail honest:
 *
 * - `permissions` is always the *effective* set: whatever the mock returned,
 *   unioned with the role's defaults. A session can therefore never render an
 *   empty console because a grant is missing (see `effectivePermissions`).
 * - `syncLocal()` runs before the first paint and applies the defaults alone,
 *   so the very first frame already agrees with what the transport will enforce
 *   moments later rather than flashing an unrestricted rail.
 */
import { defineStore } from 'pinia';
import { callApi } from '../api';
import { bypassesPermissions, hasPermission, permissionForAction } from '../lib/permissions';
import { effectivePermissions, primaryRoleName } from '../lib/roles';
import { STORAGE_KEYS, type AdminRole } from '../types';

interface SessionState {
  username: string;
  name: string;
  /** The claim stored for this session; empty when signed out. */
  role: string;
  schoolId: string;
  /** Effective permissions: granted union role defaults. */
  permissions: string[];
  /** Epoch ms of the last successful server sync, 0 if never. */
  syncedAt: number;
  /** True once a sync has completed or been attempted at least once. */
  ready: boolean;
}

const emptyState = (): SessionState => ({
  username: '',
  name: '',
  role: '',
  schoolId: '',
  permissions: [],
  syncedAt: 0,
  ready: false,
});

export const useSessionStore = defineStore('session', {
  state: (): SessionState => emptyState(),

  getters: {
    /** The claim as a typed role, falling back to the teacher portal. */
    roleKey: (state): AdminRole => primaryRoleName(state.role),

    /** Whether a session exists at all — the route guards read this first. */
    isAuthenticated: (state): boolean => state.role !== '' && state.username !== '',

    /** Cross-school claim, for the scope chip. */
    isGlobal: (state): boolean => {
      const role = String(state.role || '').toUpperCase();
      return role === 'SUPER_ADMIN' || role === 'CENTRAL_ADMIN';
    },
  },

  actions: {
    /**
     * Apply the claim held in storage and derive its default permissions.
     * Runs before the first paint so the rail and the transport start out
     * agreeing with each other.
     */
    syncLocal() {
      const role = localStorage.getItem(STORAGE_KEYS.AdminRole) || '';
      const session = localStorage.getItem(STORAGE_KEYS.LAEC_Session) || '';
      if (!session || !role) {
        Object.assign(this, emptyState(), { ready: true });
        return;
      }
      this.username = localStorage.getItem(STORAGE_KEYS.AdminUsername) || '';
      this.name = localStorage.getItem(STORAGE_KEYS.AdminName) || '';
      this.schoolId = localStorage.getItem(STORAGE_KEYS.SchoolID) || '';
      this.role = role;
      this.permissions = effectivePermissions([], role);
      this.ready = true;
    },

    /**
     * Re-read the operator's grants from the mock (D-71).
     *
     * The counterpart of `GET /auth/me`: called on mount, after every route
     * change, on tab focus and every thirty seconds. A failure leaves the
     * store untouched rather than dropping a working session on the floor —
     * the defaults already in place keep the console usable, and the next
     * navigation retries.
     */
    async refresh() {
      if (!localStorage.getItem(STORAGE_KEYS.LAEC_Session)) {
        Object.assign(this, emptyState(), { ready: true });
        return;
      }
      try {
        const res = await callApi('GET_MY_PERMISSIONS', {
          username: localStorage.getItem(STORAGE_KEYS.AdminUsername) || undefined,
          role: localStorage.getItem(STORAGE_KEYS.AdminRole) || undefined,
        });
        if (res.status !== 'success') return;
        /*
         * The contract's envelope carries its payload at the top level —
         * `Success<T>` in the type map is just `T` — so reaching for `res.data`
         * finds undefined and skips the sync entirely, leaving the session on
         * its local claim for good. That silent no-op is the failure this
         * comment exists to make obvious next time.
         */
        const payload = res as unknown as {
          username?: string;
          name?: string;
          schoolID?: string;
          role?: string;
          permissions?: string[];
        };
        if (!payload.role) return;
        this.username = payload.username || this.username;
        this.name = payload.name || this.name;
        this.schoolId = payload.schoolID || this.schoolId;
        this.role = payload.role;
        this.permissions = effectivePermissions(payload.permissions ?? [], payload.role);
        this.syncedAt = Date.now();
        this.ready = true;
        /*
         * The roster is the authority on the claim, so the corrected role is
         * written back: the route guards and the next paint read storage, and
         * without this a claim edited in devtools would keep opening consoles
         * that the permissions it is given would refuse to fill.
         */
        localStorage.setItem(STORAGE_KEYS.AdminRole, payload.role);
      } catch {
        // Network or handler failure: keep the current grants; next nav retries.
      }
    },

    /**
     * The predicate every gated control uses. Identical to the one the mock's
     * transport enforces, so a control that renders is a control that works.
     */
    can(permission?: string | null): boolean {
      if (!permission) return true;
      if (bypassesPermissions(this.role)) return true;
      return hasPermission(this.permissions, permission);
    },

    /** Whether a mutating contract action may be issued right now. */
    canPerform(action: string): boolean {
      const required = permissionForAction(action);
      if (required === undefined) return false; // unknown action — fail closed
      if (required === null) return true; // outside the admin model
      return this.can(required);
    },
  },
});

/**
 * Wire the store to navigation and time (D-71).
 *
 * Called once from `main.ts` after the router is installed. The store is
 * already seeded from storage before mount — this wires what happens *next*:
 * `afterEach` replaces the reference implementation's "on every route change"
 * hook, and the interval and visibility listener are its polling and focus
 * equivalents.
 */
export function installSessionSync(router: {
  afterEach: (fn: () => void) => void;
}): void {
  const store = useSessionStore();
  void store.refresh();

  router.afterEach(() => {
    store.syncLocal();
    void store.refresh();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void store.refresh();
  });

  window.setInterval(() => void store.refresh(), 30_000);
}
