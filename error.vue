<script setup lang="ts">
import type { NuxtError } from '#app'

/** Page d'erreur de Nuxt (404 surtout), dans le layout commun et en français. */
const props = defineProps<{
  error: NuxtError
}>()

const notFound = computed(() => props.error.statusCode === 404)

// Nuxt affiche cette page à la place d'app.vue : le modèle de titre y est repris.
useHead({ title: () => (notFound.value ? 'Page introuvable' : 'Erreur'), titleTemplate: pageTitle })

function backToDds() {
  clearError({ redirect: '/dds' })
}
</script>

<template>
  <NuxtLayout>
    <div class="error-view">
      <ViewHeader :title="notFound ? 'Page introuvable' : 'Une erreur est survenue'" />
      <div class="error-body">
        <div class="error-card">
          <p>
            {{
              notFound
                ? 'Cette adresse ne correspond à aucune vue de l’Usine de Pilotage.'
                : 'La page n’a pas pu s’afficher. Réessayez, ou revenez au suivi des DDS.'
            }}
          </p>
          <button type="button" class="error-button" @click="backToDds">Revenir aux DDS</button>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<style scoped>
.error-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.error-body {
  flex: 1;
  padding: 16px 20px;
}

/* Carte de la maquette, comme les vues à venir (PlaceholderView). */
.error-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px;
  border: 1px solid var(--bordure);
  border-radius: 16px;
  background: var(--carte);
  color: var(--gris-600);
}

.error-card p {
  margin: 0;
}

.error-button {
  padding: 8px 16px;
  border: 1.5px solid var(--bleu-600);
  border-radius: 8px;
  background: var(--bleu-600);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
}

.error-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--bleu-100);
}
</style>
