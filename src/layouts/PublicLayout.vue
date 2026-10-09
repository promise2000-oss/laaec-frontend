<script setup lang="ts">
// Glass surface tokens load only for /, /login/ and /control/ (per-route, decision: token scoping).
void import('../styles/glass.css');
</script>

<template>
  <div class="surface-glass">
    <router-view />
  </div>
</template>
