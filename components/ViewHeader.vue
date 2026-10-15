<script setup lang="ts">
/**
 * En-tête de vue commun, façon « titre de section » de la maquette : titre, mention
 * (date…), actions à droite (filtres) et contenu en dessous (chiffres clés).
 */
defineProps<{
  title: string
  eyebrow?: string
  /** Consigne courte après le titre, tronquée (…) si la place manque. */
  subtitle?: string
}>()
</script>

<template>
  <header class="view-header">
    <div class="view-header-main">
      <div class="view-title">
        <h1 class="view-title-text">{{ title }}</h1>
        <span v-if="eyebrow" class="view-title-eyebrow">{{ eyebrow }}</span>
        <span v-if="subtitle" class="view-title-subtitle" :title="subtitle">{{ subtitle }}</span>
      </div>
      <slot name="actions" />
    </div>
    <slot />
  </header>
</template>

<style scoped>
.view-header {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--bordure);
  background: var(--canvas);
}

.view-header-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

/* Le titre prend la place disponible et cède sur le sous-titre avant de faire passer les actions à la ligne. */
.view-title {
  display: flex;
  flex: 1 1 320px;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

.view-title-text {
  flex-shrink: 0;
  margin: 0;
  white-space: nowrap;
  font-family: var(--title);
  font-size: 1.375rem;
  font-weight: 700;
  line-height: 1.75rem;
  color: var(--bleu-700);
}

.view-title-eyebrow {
  flex-shrink: 0;
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--gris-600);
}

.view-title-subtitle {
  min-width: 0;
  overflow: hidden;
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--gris-600);
}
</style>
