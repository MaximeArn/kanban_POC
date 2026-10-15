<template>
  <!-- Layout commun : bandeau de l'application en haut, la vue occupe le reste de la hauteur. -->
  <div class="app">
    <AppHeader />
    <main class="app-view">
      <slot />
    </main>
  </div>
</template>

<style scoped>
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
