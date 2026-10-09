<script setup lang="ts">
/**
 * AdminStatusBadge — one badge for every status string in the admin portal.
 *
 * The live app colours status inconsistently across modules — `Active` green on
 * `/users`, `Healthy` green on stock, `Cancelled` red on sales, `Pending` amber
 * on leave — but the underlying rule is one rule: good / in-flight / bad /
 * neutral. Classifying by the word itself rather than per module means a status
 * nobody anticipated still gets a colour instead of a default grey.
 */
import { computed } from 'vue';

const props = defineProps<{ status: string }>();

type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral';

const GOOD = ['active', 'approved', 'published', 'released', 'confirmed', 'vet', 'vetted', 'healthy', 'completed', 'in_stock', 'success', 'good', 'new', 'open'];
const WARN = ['pending', 'assigned', 'draft', 'payment_confirmed', 'awaiting_payment', 'paid_confirm', 'low_stock', 'low', 'fair', 'committee_tagged', 'refund_pending', 'running', 'invited'];
const BAD = ['rejected', 'declined', 'cancelled', 'suspended', 'failed', 'out_of_stock', 'poor', 'archived', 'inactive'];

const tone = computed<Tone>(() => {
  const value = props.status.trim().toLowerCase();
  if (GOOD.includes(value)) return 'ok';
  if (WARN.includes(value)) return 'warn';
  if (BAD.includes(value)) return 'bad';
  /* "Open" on an upload window is in-flight, not good: it will close. Kept out
     of GOOD deliberately, and the word is disambiguated by the module. */
  if (value === 'open') return 'info';
  return 'neutral';
});

/** `PAYMENT_CONFIRMED` reads as `Payment confirmed` on the live tabs. */
const label = computed(() =>
  props.status
    .trim()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase()),
);
</script>

<template>
  <span class="ap-badge" :class="`ap-badge--${tone}`">{{ label }}</span>
</template>

<style scoped>
@import './admin-panel.css';
</style>
