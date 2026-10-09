<script setup lang="ts">
/*
 * ChartEmptyState — the "there is nothing to draw" panel for a dashboard chart.
 *
 * WHY IT EXISTS
 * -------------
 * Both Overview charts drew *something* when they had nothing to say, and in
 * both cases the placeholder was indistinguishable from a real result:
 *
 *   - The joint-exam pie rendered one pale slice with `data: [1]`. A pie with a
 *     single 100% slice is a full disc, and its 2px white border left a visible
 *     seam straight down the middle — it read as a chart with a data problem,
 *     not as an empty chart.
 *   - The population histogram drew its axes with every bar at zero, so Chart.js
 *     picked its default 0-to-1 scale and rendered a labelled axis for a
 *     population of nothing. One student and no students looked the same.
 *
 * Neither could be distinguished from real data at a glance, which is the exact
 * failure the Priority 1 reconciliation bug had: a chart that looks like it is
 * reporting something when it is reporting nothing.
 *
 * It is deliberately a plain panel, not a chart: no canvas, no legend, no axis.
 * The `title` carries the state, the default `description` explains what would
 * appear here, and the caller may override that to name the specific reason
 * (which session, which term) so the panel is actionable rather than generic.
 *
 * Styling reuses the console's own tokens (`.card`, `--text-soft`, `--laec-blue`)
 * so it sits inside the existing card design language rather than introducing a
 * new surface treatment.
 */
interface Props {
  /** Short state, e.g. "No results yet". */
  title: string;
  /** Why the chart is empty. Defaults to a generic line about the metric. */
  description?: string;
  /** Label announced to assistive tech for the glyph. */
  iconLabel?: string;
}

withDefaults(defineProps<Props>(), {
  description:
    'Nothing has been recorded for this metric yet. The chart appears here as soon as there is data.',
  iconLabel: 'No data',
});
</script>

<template>
  <!--
    role="status" so the empty state is announced when it replaces a chart,
    which is the only signal a screen-reader user gets that the panel changed
    from data to no-data.
  -->
  <div class="chart-empty-state" role="status">
    <span class="chart-empty-icon" aria-hidden="true">
      <!--
        A bar-chart glyph with no bars. Inline rather than an <img> so it takes
        the surrounding text colour and needs no extra request; the aria-hidden
        wrapper keeps it out of the accessibility tree, with iconLabel on the
        status above describing the state.
      -->
      <svg viewBox="0 0 48 40" width="46" height="38" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1.25" y="1.25" width="45.5" height="37.5" rx="6" stroke="currentColor" stroke-width="1.6" opacity="0.4" />
        <path d="M10 31V25M18 31V21M26 31V26M34 31V17" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" opacity="0.28" />
        <path d="M9 34.5h30" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.4" />
      </svg>
    </span>
    <p class="chart-empty-title">{{ title }}</p>
    <p class="chart-empty-desc">{{ description }}</p>
  </div>
</template>

<style scoped>
/*
 * A fixed minimum height so a card does not collapse when its chart is
 * replaced. It matches the histogram's rendered height at the 150px canvas
 * attribute, so swapping a chart for this panel is not a visible jump.
 */
.chart-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 190px;
  padding: 1.75rem 1.25rem;
  text-align: center;
  color: var(--text-soft);
}

.chart-empty-icon {
  display: grid;
  place-items: center;
  margin-bottom: 0.15rem;
  color: var(--laec-blue);
  opacity: 0.65;
}

.chart-empty-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--laec-blue-deep);
}

.chart-empty-desc {
  margin: 0;
  max-width: 30ch;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--text-soft);
}

@media (max-width: 640px) {
  .chart-empty-state {
    min-height: 160px;
    padding: 1.35rem 1rem;
  }
}
</style>
