<script setup lang="ts">
import ViewHeader from './ViewHeader.vue'

/** Vue pas encore implémentée : mise en page commune (en-tête de vue) et carte d'attente, comme la maquette. */
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="placeholder-view">
    <ViewHeader :title="title" />
    <div class="placeholder-body zone-defilement">
      <p class="placeholder-card">Cette vue arrivera dans une prochaine version.</p>
    </div>
  </div>
</template>

<style scoped>
.placeholder-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.placeholder-body {
  flex: 1;
  min-height: 0;
  padding: 16px 20px;
  overflow-y: auto;
}

/* Carte de la maquette : fond blanc, bordure douce, coins arrondis. */
.placeholder-card {
  margin: 0;
  padding: 40px;
  border: 1px solid var(--bordure);
  border-radius: 16px;
  background: var(--carte);
  text-align: center;
  color: var(--gris-600);
}
</style>
