<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import KanbanBoard from './components/KanbanBoard.vue'
import PlaceholderView from './components/PlaceholderView.vue'
import { getNavItem, viewFromHash } from './navigation'

/*
 * Navigation sans routeur : la vue courante suit l'ancre de l'URL (#/ceda), ce qui garde
 * le bouton « Précédent » du navigateur et les liens directs.
 */
const current = ref(viewFromHash(window.location.hash))

function onHashChange() {
  current.value = viewFromHash(window.location.hash)
}

onMounted(() => window.addEventListener('hashchange', onHashChange))
onBeforeUnmount(() => window.removeEventListener('hashchange', onHashChange))
</script>

<template>
  <div class="app">
    <AppHeader :current="current" />
    <main class="app-view">
      <KanbanBoard v-if="current === 'dds'" />
      <PlaceholderView v-else :key="current" :title="getNavItem(current).label" />
    </main>
  </div>
</template>

<style scoped>
/* Bandeau fixe en haut, la vue occupe le reste de la hauteur. */
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
}

.app-view {
  flex: 1;
  min-height: 0;
}
</style>
