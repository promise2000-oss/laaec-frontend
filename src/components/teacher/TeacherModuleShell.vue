<script setup lang="ts">
/**
 * Shared shell for every St Finbarr's teacher-portal panel (D-72).
 *
 * One component so the twelve document/case panels cannot drift apart on the
 * four things they all have in common: a heading, a toolbar row, the
 * loading / error / empty triad, and a dismissible success banner. The origin
 * spells these out per module (`PageSpinner` in a card, `ErrorBanner` + retry,
 * `EmptyMessage`, and an emerald auto-hiding banner after a success) — this is
 * that pattern, once.
 *
 * It renders nothing but the spinner while `loading` is true, which is the
 * origin's behaviour: the table and its toolbar are both replaced, not
 * disabled. `AppAlert` is NOT used here — that component is the modal
 * `custom-alert` dialog the consoles already own, and a page-level success
 * banner is a different thing.
 */
withDefaults(
  defineProps<{
    title: string;
    description?: string;
    /** Record count, used only to decide whether the empty state shows. */
    emptyCount?: number;
    /**
     * Success banner text. Empty means no banner — which is why this is a prop
     * and not a slot: a slot that is always *declared* is always *present*, so a
     * `<template #banner>` wrapper would render an empty dismissible bar on every
     * panel for the whole session. The presence test has to be on the content.
     */
    banner?: string;
    loading?: boolean;
    error?: string;
    /** Set false to suppress the retry affordance. */
    retryable?: boolean;
  }>(),
  {
    description: '',
    emptyCount: 0,
    banner: '',
    loading: false,
    error: '',
    retryable: true,
  },
);

const emit = defineEmits<{ retry: []; dismiss: [] }>();
</script>

<template>
  <section class="tp-module">
    <header class="tp-module__head">
      <div class="tp-module__intro">
        <h2 class="tp-module__title">{{ title }}</h2>
        <p v-if="description" class="tp-module__desc">{{ description }}</p>
      </div>
      <div class="tp-module__actions">
        <slot name="actions" />
      </div>
    </header>

    <slot name="filters" />

    <!-- The origin's success banner: emerald, dismissible with an X. -->
    <div v-if="banner" class="tp-banner" role="status">
      <div class="tp-banner__body">
        <p>{{ banner }}</p>
      </div>
      <button type="button" class="tp-banner__close" aria-label="Dismiss" @click="emit('dismiss')">
        &times;
      </button>
    </div>

    <div v-if="loading" class="tp-loading" role="status" aria-live="polite">
      <span class="tp-loading__ring" aria-hidden="true" />
      <p class="tp-loading__label"><slot name="loadingLabel">Loading...</slot></p>
    </div>

    <div v-else-if="error" class="tp-error" role="alert">
      <p class="tp-error__text">{{ error }}</p>
      <button v-if="retryable" type="button" class="tp-btn tp-btn--ghost" @click="emit('retry')">
        Retry
      </button>
    </div>

    <div v-else-if="$slots.empty && emptyCount === 0" class="tp-empty">
      <slot name="empty" />
    </div>

    <slot v-else />
  </section>
</template>

<style scoped>
.tp-module {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tp-module__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.tp-module__intro {
  min-width: 0;
}

.tp-module__title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.tp-module__desc {
  margin: 0.25rem 0 0;
  color: var(--text-muted, #5b6472);
  font-size: 0.8125rem;
  max-width: 62ch;
}

.tp-module__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* The origin's emerald success banner. */
.tp-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  border: 1px solid #a7d8bf;
  background: #eefaf3;
  color: #14532d;
  border-radius: 10px;
  padding: 0.75rem 0.875rem;
}

.tp-banner__body {
  flex: 1;
  font-size: 0.8125rem;
  min-width: 0;
}

.tp-banner__body :deep(p) {
  margin: 0;
}

.tp-banner__close {
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 1.15rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.125rem;
  opacity: 0.7;
}

.tp-banner__close:hover {
  opacity: 1;
}

.tp-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.625rem;
  padding: 2rem 1rem;
}

.tp-loading__ring {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--laec-line, #d7dee8);
  border-top-color: var(--laec-blue, #1c4e80);
  animation: tp-spin 0.8s linear infinite;
}

@keyframes tp-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tp-loading__ring {
    animation-duration: 2.4s;
  }
}

.tp-loading__label {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted, #5b6472);
}

.tp-error {
  border: 1px solid #f0c8c8;
  background: #fdf3f3;
  color: #8f2a2a;
  border-radius: 10px;
  padding: 0.875rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.tp-error__text {
  margin: 0;
  font-size: 0.8125rem;
}

.tp-empty {
  border: 1px dashed var(--laec-line, #d7dee8);
  border-radius: 10px;
  padding: 1.75rem 1.25rem;
  text-align: center;
  color: var(--text-muted, #5b6472);
  font-size: 0.8125rem;
}

.tp-btn {
  font: inherit;
  font-size: 0.8125rem;
  border-radius: 8px;
  padding: 0.4375rem 0.8125rem;
  cursor: pointer;
  border: 1px solid var(--laec-line, #d7dee8);
  background: #fff;
  color: inherit;
}

.tp-btn--ghost:hover {
  border-color: var(--laec-blue, #1c4e80);
  color: var(--laec-blue, #1c4e80);
}
</style>