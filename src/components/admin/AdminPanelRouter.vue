/**
 * AdminPanelRouter — mounts the component a registry module id names.
 *
 * WHY A ROUTER RATHER THAN A SWITCH IN THE VIEW
 * ---------------------------------------------
 * `/admin/` mounts forty-odd panels. Putting a forty-branch `v-if` chain in the
 * view would put forty component imports and forty structural decisions into a
 * file that is already the LAEC Master Command Center, and any change to the set
 * would touch two files. This is the one place the mapping is read from, and
 * `tools/check-admin-parity.mjs` asserts that mapping against the registry — so a
 * module declared with no component, or a component nothing mounts, is a check
 * failure rather than a blank panel at runtime.
 *
 * The map itself lives in `admin-panels.ts` rather than here, because a Vue SFC's
 * setup block cannot export and the check needs to read it.
 */
<script setup lang="ts">
import { computed } from 'vue';
import { ADMIN_MODULES } from '../../types/admin-registry';
import { componentForPanel } from './admin-panels';
import type { AdminModule } from '../../types/admin-registry';

const props = defineProps<{ panelId: string }>();

/**
 * The `can` predicate is threaded down to each panel rather than imported from the
 * Pinia store inside them, so a panel can be rendered against an arbitrary
 * permission set — which is what makes the permission behaviour testable without
 * signing in as six different roles. The view passes the session's `can`, which is
 * the same predicate `callApi` enforces, so a control that renders is a control
 * that works.
 */
const can = defineModel<((permission?: string | null) => boolean) | null>('can', { default: null });

const component = computed(() => componentForPanel(props.panelId));

/**
 * The registry entry for a panel id, or undefined. The dashboard has no registry
 * entry — it is a bespoke page with no list behind it — and neither do the LAEC
 * panels, which are transcribed origin markup in the view. `v-if` on the module is
 * what keeps the view's own seven panels from ever being routed here.
 */
const module = computed<AdminModule | undefined>(() => ADMIN_MODULES[props.panelId]);
</script>

<template>
  <component :is="component" v-if="module" v-model:can="can" :module="module" />
</template>
