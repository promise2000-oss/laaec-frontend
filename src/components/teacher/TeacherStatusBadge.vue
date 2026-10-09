<script setup lang="ts">
/**
 * Status badge for the teacher portal's document lifecycles (D-72).
 *
 * The origin has one badge per module with its own variant map, and the labels
 * differ per module — `LessonStatusBadge` renders `Draft | Pending | Approved |
 * Rejected`, `WeeklyReportStatusBadge` renders `Draft | Submitted | Reviewed`,
 * and the class-teacher module renders the raw status string with no mapping at
 * all. That inconsistency is reproduced: this component is given the labels
 * explicitly rather than inferring them, so a module that shows its raw status
 * can still do so.
 *
 * Variants follow the origin's shadcn badges: `default` for the affirmative
 * terminal state, `secondary` for in-flight, `outline` for draft, `destructive`
 * for rejected.
 */
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** The raw status string from the record. */
    status: string;
    label?: string;
    variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  }>(),
  { label: '', variant: 'outline' },
);

/**
 * Default label per status. Only used when the caller passes none, which is the
 * three modules that do their own mapping; the class-teacher panel passes the
 * literal string instead.
 */
const DEFAULT_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  reviewed: 'Reviewed',
  open: 'Open',
  assigned: 'Assigned',
  resolved: 'Resolved',
  archived: 'Archived',
  dismissed: 'Dismissed',
  in_progress: 'In Progress',
  scheduled: 'Scheduled',
  closed: 'Closed',
  under_review: 'Under review',
  appealed: 'Appealed',
};

const text = computed(() => props.label || DEFAULT_LABELS[props.status] || props.status);
</script>

<template>
  <span class="tp-badge" :class="`tp-badge--${variant}`">{{ text }}</span>
</template>

<style scoped>
.tp-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 0.125rem 0.5625rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

/* The origin's four shadcn badge variants, at the rail's type scale. */
.tp-badge--default {
  background: #eaf2fb;
  border-color: #bcd6f0;
  color: #16457c;
}

.tp-badge--secondary {
  background: #f1f3f6;
  border-color: #d7dee8;
  color: #46505f;
}

.tp-badge--outline {
  background: transparent;
  border-color: #c6cfdb;
  color: #5b6472;
}

.tp-badge--destructive {
  background: #fdf0f0;
  border-color: #f0c8c8;
  color: #8f2a2a;
}
</style>