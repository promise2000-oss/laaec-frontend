<script setup lang="ts">
/*
 * AppLoading — the blocking sync overlay, shared by the eight shell views
 * (D-74).
 *
 * WHAT IT FIXES BEYOND DEDUPLICATION
 * ----------------------------------
 * The consoles used a light scrim (`rgb(247 250 253 / 0.82)`) with a dark-blue
 * ring and dark-blue label, while Central/Teacher used a navy scrim
 * (`rgb(11 34 66 / 0.72)`) with a white ring — but kept a *dark-blue* label.
 * That last pairing measured 1.71:1 against the composited scrim, far below
 * WCAG AA. It escaped the D-73 contrast audit precisely because the overlay is
 * `display: none` until a request is in flight, so no pass that walks rendered
 * elements ever saw it.
 *
 * One treatment now covers both: the same navy scrim the alert dialog uses, a
 * white ring, and a white label (≈6.8:1 against the composited backdrop).
 *
 * The `#loading-overlay-text` id survives because Ca/Comm/Ict write to it
 * imperatively through `document.getElementById` to show a progress message.
 */
interface Props {
  visible: boolean;
  text?: string;
}

withDefaults(defineProps<Props>(), {
  text: 'LAEC Secure Synchronizing...',
});
</script>

<template>
  <div id="loading-overlay" :style="visible ? { display: 'flex' } : undefined">
    <div class="spinner"></div>
    <p id="loading-overlay-text" class="loading-text">{{ text }}</p>
  </div>
</template>

<style>
/* Same narrow `!important` exception AppAlert documents: the origin
   stylesheets still declare these with selectors we do not own. */
#loading-overlay {
  background: rgb(11 34 66 / 0.72) !important;
  -webkit-backdrop-filter: blur(6px) !important;
  backdrop-filter: blur(6px) !important;
  z-index: var(--z-loading) !important;
}

/* Colour only — each surface keeps its own ring size and spin keyframes. */
#loading-overlay .spinner {
  border: 4px solid rgb(255 255 255 / 0.22) !important;
  border-top-color: #ffffff !important;
}

#loading-overlay .loading-text {
  margin-top: 15px;
  font-weight: 650;
  color: #ffffff;
  text-align: center;
  padding-inline: 18px;
}
</style>
