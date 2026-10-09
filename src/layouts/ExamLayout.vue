<script setup lang="ts">
// nj surface tokens load only for /exam/ (per-route token scoping).
void import('../styles/nj.css');
</script>

<template>
  <div class="surface-nj">
    <router-view />
  </div>
</template>
