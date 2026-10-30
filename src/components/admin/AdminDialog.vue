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
 *  - Tab is trapped inside the panel for the dialog's whole life.
 *  - Focus moves to the panel on open and returns to the opener on close, so a
 *    keyboard user is not dropped at the top of the document.
 *  - `Cancel` is always present. A confirm dialog's confirm button is never the
 *    default focus — the operator has to reach for it, which is what you want
 *    when the button deletes something.
 *
 * LAYOUT: ONE SCROLLER, NOT TWO
 * ------------------------------
 * The panel is a flex column capped at `100dvh - gutter`, and `.ap-dialog__body`
 * is the only element that scrolls. The header and footer are flex children of
 * the panel rather than children of the body, so they cannot scroll away — they
 * are pinned by the flex layout, which is more robust than `position: sticky`
 * (a sticky element can only pin for as far as its containing block exceeds the
 * viewport, and a sticky footer inside a scroll container pins to the bottom of
 * the *content*, not the viewport).
 *
 * This is also why a consumer must not add its own `max-height` + `overflow` to
 * the slot content. The permissions matrix used to: it capped itself at 22rem
 * and scrolled, which put a scroller inside the body scroller. Two nested
 * scrollers means wheel input over the list scrolls the list, the same wheel
 * over the gap scrolls the dialog, and the operator cannot see the footer. The
 * matrix now renders full height and lets the body own the scroll.
 *
 * THE ACCESSIBLE NAME IS `aria-label`, NOT `aria-labelledby`
 * -------------------------------------------------------
 * `aria-labelledby` pointing at the rendered `<h3>` is the better pattern, but
 * this component exposes a `#header` slot that may replace the `<h3>` entirely
 * (the permissions dialog puts a role badge and a description in the header).
 * A dangling `aria-labelledby` id computes an *empty* accessible name — it does
 * not fall back to `aria-label` — so a slot consumer would silently produce an
 * unnamed dialog. `aria-label` is always present and always holds the visible
 * title, so it stays. Adding `aria-labelledby` alongside it would only ever
 * shadow it.
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
    /** Panel width. `md` is the original 640px; the others are opt-in. */
    size?: 'sm' | 'md' | 'lg' | 'xl';
  }>(),
  {
    kind: 'detail',
    message: '',
    confirmLabel: '',
    danger: false,
    busy: false,
    confirmable: true,
    size: 'md',
  },
);

const emit = defineEmits<{ close: []; confirm: [] }>();

const panel = ref<HTMLElement | null>(null);
let opener: HTMLElement | null = null;

/*
 * The close glyph is an inline SVG rather than `&times;`.
 *
 * The text `&times;` rendered inside a `.ap-btn` measured 24 x 27px with its
 * glyph centred by font metrics, not by the box, so it looked smaller than its
 * hit area and sat low against the title. A fixed 32 x 32 button holding a
 * stroke icon is square by construction and does not depend on the font stack.
 * 1.7 stroke on a 24 box matches the icon scale used in AppShell's ICONS map.
 */
const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
  'stroke-width="1.7" stroke-linecap="round" aria-hidden="true" focusable="false">' +
  '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/></svg>';

/** Everything Tab can land on inside the panel, in DOM order. */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const focusables = (): HTMLElement[] =>
  panel.value
    ? (Array.from(panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      ) as HTMLElement[])
    : [];

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    event.stopPropagation();
    emit('close');
    return;
  }
  if (event.key !== 'Tab') return;

  /*
   * The actual focus trap.
   *
   * This component's docstring claimed one and did not have it: the only
   * keyboard handling was Escape, so Tab walked straight out of the dialog into
   * the page behind it while `aria-modal="true"` told assistive technology the
   * rest of the document was inert. A modal that says it is modal and lets the
   * caret leave is worse than one that does not, because the operator has no
   * way to tell.
   *
   * It wraps at both ends only. Tabbing through the middle of the dialog is left
   * to the browser, so reading order stays reading order.
   */
  const items = focusables();
  if (items.length === 0) {
    event.preventDefault();
    panel.value?.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement as HTMLElement | null;
  /*
   * The panel itself (tabindex="-1") holds focus between open and the first Tab.
   * Backward from there would otherwise escape upward, so it counts as the start
   * of the run; forward from there already lands on `first` and needs no help.
   */
  if (event.shiftKey) {
    if (active === first || active === panel.value) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last) {
    event.preventDefault();
    first.focus();
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
  <div v-if="open" class="ap-dialog" role="presentation" @mousedown="onBackdrop">
    <div
      ref="panel"
      class="ap-dialog__panel"
      :class="`ap-dialog__panel--${size}`"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      tabindex="-1"
    >
      <header class="ap-dialog__head">
        <slot name="header">
          <h3 class="ap-dialog__title">{{ title }}</h3>
        </slot>
        <button type="button" class="ap-dialog__close" aria-label="Close dialog" @click="emit('close')">
          <span class="ap-dialog__close-icon" aria-hidden="true" v-html="CLOSE_ICON" />
        </button>
      </header>

      <div v-if="$slots.toolbar" class="ap-dialog__toolbar">
        <slot name="toolbar" />
      </div>

      <div class="ap-dialog__body">
        <p v-if="kind === 'confirm' && message" class="ap-inline-note">{{ message }}</p>
        <slot />
      </div>

      <footer class="ap-dialog__foot">
        <div v-if="$slots['footer-note']" class="ap-dialog__foot-note">
          <slot name="footer-note" />
        </div>
        <div class="ap-dialog__foot-actions">
          <button type="button" class="ap-btn" :disabled="busy" @click="emit('close')">Cancel</button>
          <button
            v-if="confirmable"
            type="button"
            class="ap-btn"
            :class="danger ? 'ap-btn--danger' : 'ap-btn--primary'"
            :disabled="busy"
            @click="emit('confirm')"
          >
            <span v-if="busy" class="ap-btn__spinner" aria-hidden="true" />
            {{ busy ? 'Working...' : confirmLabel || 'Save' }}
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
@import './admin-panel.css';

/*
 * Size steps are on the panel, not on the dialog, so the backdrop's centring is
 * unaffected. `md` is byte-for-byte the original 640px — the other two are new
 * opt-ins and nothing that does not ask for them changes width.
 */
.ap-dialog__panel--sm { max-width: 460px; }
.ap-dialog__panel--md { max-width: 640px; }
.ap-dialog__panel--lg { max-width: 820px; }
.ap-dialog__panel--xl { max-width: 1024px; }

/*
 * Edge shadows — the scroll affordance.
 *
 * The pinned header and footer sit over a scrolling body, so on a long dialog
 * the operator has no way to tell that content continues past the footer. These
 * are four background layers on the body rather than pseudo-elements, because
 * the trick is the `background-attachment` split and pseudo-elements cannot
 * carry one:
 *
 *   local  (the two white "cover" gradients) — pinned to the CONTENT, so they
 *          scroll away and stop covering the shadow the moment you reach that end.
 *   scroll (the two radial shadows)          — pinned to the BOX, so they stay
 *          put and are revealed as the cover gradients move off.
 *
 * The visible result is a shadow that appears at the top only once the body has
 * been scrolled, one at the bottom only while content remains below, both gone
 * at the extremes, and nothing at all when the body does not overflow. No JS, no
 * scroll listener, and no permanent decoration lying about overflow that is not
 * there.
 */
.ap-dialog__body {
  background:
    linear-gradient(var(--ap-surface, #fff) 40%, rgba(255, 255, 255, 0)) center top,
    linear-gradient(rgba(255, 255, 255, 0), var(--ap-surface, #fff) 60%) center bottom,
    radial-gradient(farthest-side at 50% 0, rgba(11, 34, 66, 0.13), rgba(11, 34, 66, 0)) center top,
    radial-gradient(farthest-side at 50% 100%, rgba(11, 34, 66, 0.13), rgba(11, 34, 66, 0)) center bottom;
  background-color: var(--ap-surface, #fff);
  background-repeat: no-repeat;
  background-size: 100% 28px, 100% 28px, 100% 9px, 100% 9px;
  background-attachment: local, local, scroll, scroll;
}

/*
 * `margin-left: auto` rather than `space-between` on the footer: with no
 * `#footer-note` slot the footer has one child, and under `space-between` a lone
 * child lands at the START — every other dialog in the console would have had
 * its buttons jump to the left the moment this class was added. With auto margin
 * the actions sit right whether or not a note precedes them.
 */
.ap-dialog__foot-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

/*
 * Cancel and Save are 36px tall at desktop size. On a coarse pointer or a narrow
 * viewport both grow to 44px — the two buttons an operator reaches for at the
 * end of every task, so they are the last place to leave a short target.
 */
@media (pointer: coarse), (max-width: 640px) {
  .ap-dialog__foot-actions .ap-btn { min-height: 44px; padding-top: 0.625rem; padding-bottom: 0.625rem; }
}

.ap-dialog__foot-note {
  font-size: 0.8125rem;
  color: var(--ap-text-muted, #5b6472);
  min-width: 0;
}

.ap-btn__spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 0.4rem;
  vertical-align: -1px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-top-color: transparent;
  animation: ap-btn-spin 0.7s linear infinite;
}

@keyframes ap-btn-spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .ap-btn__spinner { animation-duration: 2.4s; }
}
</style>