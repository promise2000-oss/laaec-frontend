<script setup lang="ts">
/*
 * AppAlert — the one alert dialog the eight shell views render (D-74).
 *
 * WHY THIS EXISTS
 * ---------------
 * Every console authored its own copy of this markup, and the copies had
 * drifted: three different backdrop fills, two radii (26 px on the consoles,
 * 12 px on the addendum surfaces), two paddings, two max-widths, two button-row
 * alignments, and a z-index that was 5000, 8000 or 9000 depending on which file
 * you happened to open. A dialog is the single most visible "popup" in the
 * product, so it is the one that most obviously either looked consistent or
 * looked assembled from spare parts.
 *
 * WHAT THE COMPONENT OWNS vs WHAT THE VIEW OWNS
 * ---------------------------------------------
 *   owns:    overlay, backdrop, dialog box, title, button row, stacking token
 *   view:    the flags, the confirm handler, and any per-view media via slots
 *
 * Every existing id (`custom-alert`, `alert-title`, `alert-msg`, `alert-ok`,
 * `alert-cancel`, `alert-confirm`, `alert-btns`) is preserved verbatim, because
 * several views reach into the DOM for them and the origin's own tests did too.
 *
 * BUTTON VISIBILITY IS INTENTIONALLY PER-VIEW
 * -------------------------------------------
 * Admin hides CANCEL outside a confirm dialog (`alertCancelVisible`); the other
 * consoles offer it unconditionally. That difference is reproduced here rather
 * than "fixed", because consolidating markup is not licence to change which
 * buttons a user sees. Note that on those consoles CANCEL and CONTINUE both
 * call `closeAlert()`, so the extra button is inert — worth revisiting
 * separately, recorded in the build log.
 */
interface Props {
  visible: boolean;
  title: string;
  /** `#alert-msg` is always rendered — an empty paragraph is what the origin
   *  shows, and suppressing it would change spacing on a blank message. */
  msg?: string;
  /** Blue accent title. Notices and Calendar render theirs unstyled. */
  titleAccent?: boolean;
  /** Offer CANCEL next to CONFIRM. */
  cancelVisible?: boolean;
  /** CONFIRM mode: shows CONFIRM + CANCEL and hides CONTINUE. */
  confirmVisible?: boolean;
  confirmLabel?: string;
}

withDefaults(defineProps<Props>(), {
  msg: '',
  titleAccent: true,
  cancelVisible: false,
  confirmVisible: false,
  confirmLabel: 'CONFIRM',
});

const emit = defineEmits<{ close: []; confirm: [] }>();
</script>

<template>
  <div id="custom-alert" :style="visible ? { display: 'flex' } : undefined">
    <div class="alert-content" role="alertdialog" :aria-label="title">
      <h3
        id="alert-title"
        :style="titleAccent ? { marginTop: 0, color: 'var(--laec-blue)' } : undefined"
      >
        {{ title }}
      </h3>

      <!-- Identity cards, passports and result photos live in the view. -->
      <slot name="media" />

      <p id="alert-msg">{{ msg }}</p>

      <div id="alert-btns" class="alert-btns">
        <button
          id="alert-ok"
          class="btn-primary"
          :style="confirmVisible ? { display: 'none' } : undefined"
          @click="emit('close')"
        >
          CONTINUE
        </button>
        <button
          id="alert-cancel"
          class="btn-danger"
          :style="cancelVisible ? undefined : { display: 'none' }"
          @click="emit('close')"
        >
          CANCEL
        </button>
        <button
          id="alert-confirm"
          class="btn-success"
          :style="confirmVisible ? undefined : { display: 'none' }"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style>
/*
 * `!important` here is the same deliberate, narrow exception AppShell documents
 * for its page-box reset: the overlay is still declared by the transcribed
 * origin stylesheets with selectors we do not own
 * (e.g. `body.surface-enterprise.page-calendar #custom-alert`, `body.surface-
 * enterprise.page-admin #custom-alert`), which outrank anything this component
 * can express. Rather than edit four page stylesheets and hope no selector was
 * missed, the shared values are stated once, here, and win outright. The origin
 * declarations become inert; they are left in place because they are
 * transcribed reference material.
 */
#custom-alert {
  background: rgb(11 34 66 / 0.72) !important;
  /* `!important` too: the console stylesheets declare `blur(10px)` under
     `.page-X #custom-alert`, which outranks this selector, and the effect is
     the most visible part of the scrim. */
  -webkit-backdrop-filter: blur(6px) !important;
  backdrop-filter: blur(6px) !important;
  z-index: var(--z-modal) !important;
}

#custom-alert .alert-content {
  background: #ffffff;
  border-radius: var(--app-r-lg, 10px);
  padding: 22px 24px;
  max-width: 460px;
  width: min(92%, 460px);
  box-shadow: var(--app-shadow-pop, 0 12px 32px rgb(18 23 34 / 0.14));
  text-align: left;
}

#custom-alert .alert-btns {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-wrap: wrap;
  margin-top: 18px;
}
</style>
