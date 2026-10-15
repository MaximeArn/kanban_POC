<script setup lang="ts">
import type { NuxtError } from '#app'

/** Page d'erreur de Nuxt, dans le layout commun : image de la mascotte et retour au tableau de bord. */
const props = defineProps<{
  error: NuxtError
}>()

const notFound = computed(() => props.error.statusCode === 404)

// Nuxt affiche cette page à la place d'app.vue : le modèle de titre y est repris.
const title = computed(() => (notFound.value ? 'Page introuvable' : 'Erreur'))
useHead({ title, titleTemplate: pageTitle })
// Adresse sans route : l'erreur survient au démarrage de l'app et le titre n'est alors pas
// rendu par useHead ; on l'applique au montage.
onMounted(() => (document.title = pageTitle(title.value)))

function backToDashboard() {
  clearError({ redirect: '/dashboard' })
}
</script>

<template>
  <NuxtLayout>
    <div class="error-view">
      <img v-if="notFound" class="error-image" src="/404.svg" alt="Page introuvable" width="720" height="440" />
      <p v-else class="error-text">La page n’a pas pu s’afficher.</p>
      <button type="button" class="error-button" @click="backToDashboard">Revenir au tableau de bord</button>
    </div>
  </NuxtLayout>
</template>

<style scoped>
.error-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  height: 100%;
  padding: 24px 16px;
  box-sizing: border-box;
}

/* Image 404 (public/404.svg) : mascotte « perplexe » entre deux 4. */
.error-image {
  max-width: 100%;
  height: auto;
}

.error-text {
  margin: 0;
  font-size: 1.125rem;
  color: var(--gris-600);
}

/* Bouton primaire de la maquette. */
.error-button {
  padding: 10px 20px;
  border: 1.5px solid var(--bleu-600);
  border-radius: 10px;
  background: var(--bleu-600);
  font: inherit;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
}

.error-button:hover {
  background: var(--bleu-700);
}

.error-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--bleu-100);
}
</style>
