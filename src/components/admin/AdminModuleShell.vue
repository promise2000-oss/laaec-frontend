<script setup lang="ts">
/**
 * AdminModuleShell — the loading / error / empty / banner frame every
 * Saint Finbarr's admin panel renders inside.
 *
 * The sibling of `TeacherModuleShell`, for the same reason and with the same
 * four concerns factored out once: a heading, a toolbar row, the loading/error/
 * empty triad, and a dismissible success banner. The live app spells these out
 * per module (`PageSpinner` in a card, `ErrorBanner` + retry, `EmptyMessage`, an
 * emerald auto-hiding banner) — this is that pattern, once.
 *
 * `AppAlert` is deliberately NOT used here: that component is the modal
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
     * Success banner text. Empty means no banner — hence a prop and not a slot:
     * a slot that is always *declared* is always *present*, so a
     * `<template #banner>` wrapper would render an empty dismissible bar on
     * every panel for the whole session. The presence test is on the content.
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
  <section class="ap-module">
    <header class="ap-module__head">
      <div class="ap-module__intro">
        <h2 class="ap-module__title">{{ title }}</h2>
        <p v-if="description" class="ap-module__desc">{{ description }}</p>
      </div>
      <div class="ap-module__actions">
        <slot name="actions" />
      </div>
    </header>

    <slot name="filters" />

    <div v-if="banner" class="ap-banner" role="status">
      <div class="ap-banner__body">
        <p>{{ banner }}</p>
      </div>
      <button type="button" class="ap-banner__close" aria-label="Dismiss" @click="emit('dismiss')">
        &times;
      </button>
    </div>

    <div v-if="loading" class="ap-loading" role="status" aria-live="polite">
      <span class="ap-loading__ring" aria-hidden="true" />
      <p class="ap-loading__label"><slot name="loadingLabel">Loading...</slot></p>
    </div>

    <div v-else-if="error" class="ap-error" role="alert">
      <p class="ap-error__text">{{ error }}</p>
      <button v-if="retryable" type="button" class="ap-btn ap-btn--ghost" @click="emit('retry')">
        Retry
      </button>
    </div>

    <div v-else-if="$slots.empty && emptyCount === 0" class="ap-empty">
      <slot name="empty" />
    </div>

    <slot v-else />
  </section>
</template>

<style scoped>
@import './admin-panel.css';

.ap-module {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ap-module__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.ap-module__intro {
  min-width: 0;
}

.ap-module__title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.ap-module__desc {
  margin: 0.25rem 0 0;
  color: var(--text-muted, #5b6472);
  font-size: 0.8125rem;
  max-width: 62ch;
}

.ap-module__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>
