<script setup lang="ts">
import type { DropState } from '~/composables/useKanban'

/** Intersection d'une étape (colonne) et d'une ligne : zone de dépôt des cartes. */
const props = defineProps<{
  /** Nom accessible, ex. « Revue DATM – jeu. 8 oct. → mer. 21 oct. 2026 ». */
  label: string
  dropState: DropState
}>()

const emit = defineEmits<{
  drop: [id: string]
}>()

const { isOver, handlers } = useDropZone(
  () => props.dropState === 'allowed',
  (id) => emit('drop', id),
)
</script>

<template>
  <div
    class="cell"
    :class="{
      'is-dragging': dropState !== null,
      'is-allowed': dropState === 'allowed',
      'is-forbidden': dropState === 'forbidden',
      'is-inactive': dropState === 'inactive',
      'is-over': isOver,
    }"
    role="group"
    :aria-label="label"
    v-on="handlers"
  >
    <slot />
  </div>
</template>

<style scoped>
/*
 * Pas de fond : une cellule vide reste de l'espace vide. Un séparateur vertical
 * entre deux cellules matérialise les colonnes dans le panneau de la ligne.
 */
.cell {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 64px;
  padding: 10px 8px;
  transition:
    opacity 0.15s,
    background-color 0.15s;
}

.cell + .cell {
  border-left: 1px solid var(--grid-line);
}

/* Une colonne sur deux teintée : on suit une étape d'une ligne à l'autre sans effort. */
.cell:nth-child(even) {
  background: var(--column-stripe);
}

/* Pendant un glisser, seulement deux états à lire : vert = possible, hachuré = interdit. */
.cell.is-dragging:nth-child(even) {
  background: transparent;
}

/*
 * Zones possibles : contour intérieur (outline, ne décale rien) et fond vert léger.
 * La zone survolée passe en trait plein, avec un fond plus soutenu.
 */
.cell.is-allowed {
  outline: 2px dashed var(--accent);
  outline-offset: -4px;
  border-radius: 10px;
  background: var(--accent-bg);
}

.cell.is-over {
  outline-style: solid;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}

/* Zones interdites : hachures (repère indépendant de la couleur) et contenu très estompé. */
.cell.is-forbidden {
  background: repeating-linear-gradient(-45deg, var(--hatch) 0 2px, transparent 2px 9px);
}

.cell.is-forbidden :slotted(*) {
  opacity: 0.3;
  filter: grayscale(1);
}

.cell.is-inactive {
  opacity: 0.3;
}
</style>
