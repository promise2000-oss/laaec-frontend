<script setup lang="ts">
// Enterprise surface tokens load only for /admin/, /ca/, /ict/ and /comm/ (per-route token scoping).
void import('../styles/enterprise.css');
</script>

<template>
  <div class="surface-enterprise">
    <router-view />
  </div>
</template>
