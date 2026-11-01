<script setup lang="ts">
/**
 * App — the tenant gate and the router.
 *
 * TENANT GATE (multi-school spec §4)
 * ----------------------------------
 * Before any page renders, the request's tenant is resolved from its hostname
 * by `useTenant`. On the PLATFORM (no subdomain) that resolution is
 * synchronous, so `<router-view />` paints exactly as before — there is no
 * added latency and no behaviour change on today's deployment. Only a request
 * that actually names a tenant (a real subdomain, or a local `?tenant=` review
 * preview) is gated, and then it lands on one of the spec's three outcomes:
 *
 *   unknown → the "school not found" screen (the subdomain matches no school)
 *   blocked → the refusal screen (the school is inactive or suspended)
 *   school  → the normal router, with the school's branding applied to `:root`
 *
 * This is the FRONTEND half of §4. The spec is explicit that production tenant
 * identification must be enforced server-side too; this gate demonstrates the
 * identical extract → find → check chain and will be mirrored by server
 * middleware once wildcard DNS routes `<slug>.laaec.com` here (see the
 * deployment requirements doc).
 */
import { useTenant } from './composables/useTenant';

const { kind, school, slug, reason } = useTenant();
</script>

<template>
  <!-- ── unknown subdomain: no school with this slug (spec §4) ─────────── -->
  <div v-if="kind === 'unknown'" class="tenant-gate">
    <div class="tenant-card">
      <div class="tenant-mark tenant-mark--bad">?</div>
      <h1>School not found</h1>
      <p>
        The address <code>{{ slug }}.laaec.com</code> does not match any registered school.
      </p>
      <p class="tenant-hint">
        Check the spelling of the address, or return to the main platform.
      </p>
      <a class="tenant-action" href="/">Go to the platform</a>
    </div>
  </div>

  <!-- ── blocked: the school exists but may not be served (spec §4) ────── -->
  <div v-else-if="kind === 'blocked'" class="tenant-gate">
    <div class="tenant-card">
      <div class="tenant-mark tenant-mark--warn">!</div>
      <h1>{{ school ? school.Name : slug }}</h1>
      <p v-if="reason === 'SUSPENDED'">
        This school is <strong>suspended</strong>. Its portal and protected examination services are blocked
        until an administrator restores it.
      </p>
      <p v-else-if="reason === 'INACTIVE'">
        This school is registered but <strong>not yet active</strong>, so it cannot serve the portal.
      </p>
      <p v-else>This school cannot be served right now.</p>
      <p class="tenant-hint">Contact your archdiocesan administrator to have the school reactivated.</p>
      <a class="tenant-action" href="/">Go to the platform</a>
    </div>
  </div>

  <!-- ── resolving a tenant (only ever shown when one is indicated) ────── -->
  <div v-else-if="kind === 'pending'" class="tenant-gate">
    <div class="tenant-card">
      <div class="tenant-mark">…</div>
      <h1>Opening school portal</h1>
      <p class="tenant-hint">Identifying the school for this address…</p>
    </div>
  </div>

  <!-- ── platform or an active school: render normally ─────────────────── -->
  <router-view v-else />
</template>

<style scoped>
.tenant-gate {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(160deg, #f5f8fc 0%, #eef2f7 100%);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

.tenant-card {
  max-width: 460px;
  width: 100%;
  background: #fff;
  border: 1px solid #e4e8ee;
  border-radius: 14px;
  padding: 40px 36px;
  text-align: center;
  box-shadow: 0 10px 40px rgba(20, 40, 80, 0.08);
}

.tenant-mark {
  width: 56px;
  height: 56px;
  margin: 0 auto 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--school-primary, #16457c);
  background: color-mix(in srgb, var(--school-primary, #16457c) 12%, #fff);
}

.tenant-mark--bad {
  color: #8f2a2a;
  background: #fbe9e9;
}

.tenant-mark--warn {
  color: #8a6104;
  background: #fdf3dd;
}

.tenant-card h1 {
  margin: 0 0 12px;
  font-size: 1.3rem;
  color: #1a2230;
}

.tenant-card p {
  margin: 0 0 12px;
  font-size: 0.88rem;
  line-height: 1.55;
  color: #4a5261;
}

.tenant-card code {
  background: #f1f4f8;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.84em;
  color: #33405a;
}

.tenant-hint {
  color: #8690a0 !important;
  font-size: 0.8rem !important;
}

.tenant-action {
  display: inline-block;
  margin-top: 8px;
  padding: 11px 22px;
  border-radius: 8px;
  background: var(--school-primary, #16457c);
  color: #fff;
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 600;
}
</style>
