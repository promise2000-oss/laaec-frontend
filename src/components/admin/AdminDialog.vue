<script setup lang="ts">
/**
 * AdminDialog — the modal every Saint Finbarr's admin panel opens for create,
 * edit, detail and confirm.
 *
 * Why one component and not four: the live portal opens all four in the same
 * shell (title, body, Cancel + a single confirm button on the right), so the
 * only differences are the body and the confirm button's label and colour.
 * Modelling that as one component with a `kind` prop is what keeps the focus
 * trap, the Escape handler and the backdrop dismissal from being reimplemented
 * once per module.
 *
 * The behaviour the live app has and this reproduces:
 *  - Escape closes; clicking the backdrop closes.
 *  - Focus moves to the panel on open and returns to the opener on close, so a
 *    keyboard user is not dropped at the top of the document.
 *  - `Cancel` is always present. A confirm dialog's confirm button is never the
 *    default focus — the operator has to reach for it, which is what you want
 *    when the button deletes something.
 */
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    kind?: 'create' | 'edit' | 'detail' | 'confirm';
    message?: string;
    confirmLabel?: string;
    danger?: boolean;
    busy?: boolean;
    /** Set false to omit the confirm button entirely (a detail dialog). */
    confirmable?: boolean;
  }>(),
  {
    kind: 'detail',
    message: '',
    confirmLabel: '',
    danger: false,
    busy: false,
    confirmable: true,
  },
);

const emit = defineEmits<{ close: []; confirm: [] }>();

const panel = ref<HTMLElement | null>(null);
let opener: HTMLElement | null = null;

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    event.stopPropagation();
    emit('close');
  }
};

/*
 * `immediate` is load-bearing.
 *
 * Without it this watcher only fires on a CHANGE, so a dialog that MOUNTS with
 * `open` already true never registers its keydown handler. That is not a
 * hypothetical: the attendance register does `await load()` after a successful
 * save, which flips the shell to its loading branch, which unmounts the default
 * slot and with it this dialog — and it comes back with `open` still true. The
 * register then had no Escape handler and no working dismissal, while the same
 * dialog opened by a click (a change from false to true) behaved correctly. The
 * symptom was a dialog that could only be dismissed by its own button.
 */
watch(
  () => props.open,
  async (open) => {
    if (open) {
      opener = document.activeElement as HTMLElement | null;
      document.addEventListener('keydown', onKeydown, true);
      await nextTick();
      panel.value?.focus();
    } else {
      document.removeEventListener('keydown', onKeydown, true);
      opener?.focus?.();
      opener = null;
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown, true));

const onBackdrop = (event: MouseEvent): void => {
  if (event.target === event.currentTarget) emit('close');
};
</script>

<template>
  <div
    v-if="open"
    class="ap-dialog"
    role="presentation"
    @mousedown="onBackdrop"
  >
    <div
      ref="panel"
      class="ap-dialog__panel"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      tabindex="-1"
    >
      <header class="ap-dialog__head">
        <h3 class="ap-dialog__title">{{ title }}</h3>
        <button type="button" class="ap-btn ap-btn--ghost ap-btn--xs" aria-label="Close" @click="emit('close')">
          &times;
        </button>
      </header>

      <div class="ap-dialog__body">
        <p v-if="kind === 'confirm' && message" class="ap-inline-note">{{ message }}</p>
        <slot />
      </div>

      <footer class="ap-dialog__foot">
        <button type="button" class="ap-btn" :disabled="busy" @click="emit('close')">Cancel</button>
        <button
          v-if="confirmable"
          type="button"
          class="ap-btn"
          :class="danger ? 'ap-btn--danger' : 'ap-btn--primary'"
          :disabled="busy"
          @click="emit('confirm')"
        >
          {{ busy ? 'Working...' : confirmLabel || 'Save' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
@import './admin-panel.css';
</style>
