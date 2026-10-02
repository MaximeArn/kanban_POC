<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { LATE_LANE, useKanban, type LaneKind, type MoveResult } from '../composables/useKanban'
import { getStage, type StageId, type TypeDossier } from '../domain/workflow'
import { formatLongDate } from '../utils/format'
import DossierDrawer from './DossierDrawer.vue'
import KanbanCard from './KanbanCard.vue'
import KanbanCell from './KanbanCell.vue'
import KanbanLane from './KanbanLane.vue'
import TypeDossierModal from './TypeDossierModal.vue'

const {
  filters,
  today,
  currentLaneKey,
  architectes,
  hasActiveFilters,
  columns,
  lanes,
  draggedId,
  dropStateFor,
  laneDropStateFor,
  pendingMove,
  pendingDossier,
  announcement,
  selectedId,
  selectedDossier,
  moveDossier,
  dropDossier,
  rescheduleDossier,
  confirmPendingMove,
  cancelPendingMove,
  resetFilters,
  openDossier,
  closeDossier,
} = useKanban()

/**
 * Bouton de carte à l'origine d'un déplacement en attente, pour y replacer le focus.
 * `null` si le déplacement vient du drawer : il reste affiché, le focus y revient seul.
 */
let pendingAction: string | null = null

const todayLabel = formatLongDate(today)

/** Chiffres clés de l'en-tête, sur les dossiers affichés (filtres appliqués). */
const summary = computed(() => {
  const countOf = (kind: LaneKind) =>
    lanes.value.filter((l) => l.kind === kind).reduce((sum, l) => sum + l.count, 0)
  return {
    total: lanes.value.reduce((sum, l) => sum + l.count, 0),
    late: countOf('late'),
    current: countOf('current'),
  }
})

/** Seules « En retard » et la semaine en cours sont dépliées par défaut. */
const expandedLanes = ref(new Set<string>([LATE_LANE, currentLaneKey]))

function toggleLane(key: string) {
  if (expandedLanes.value.has(key)) expandedLanes.value.delete(key)
  else expandedLanes.value.add(key)
}

let dragStartTimer: ReturnType<typeof setTimeout> | undefined

function onDragStart(id: string) {
  // Différé : sinon le fantôme de glisser, capturé après `dragstart`, serait lui aussi estompé.
  dragStartTimer = setTimeout(() => {
    draggedId.value = id
  })
}

function onDragEnd() {
  clearTimeout(dragStartTimer)
  draggedId.value = null
}

/** Dépôt dans une cellule (`stage` défini) ou sur un en-tête de ligne (replanification seule). */
function onDrop(laneKey: string, id: string, stage?: StageId) {
  draggedId.value = null
  pendingAction = null
  dropDossier(id, laneKey, stage)
}

/**
 * Au clavier, la carte déplacée change de colonne et est donc recréée :
 * on replace le focus sur le même bouton (ou la carte s'il est désactivé).
 */
async function restoreFocus(id: string, action: string | null) {
  await nextTick()
  const card = document.getElementById(`card-${id}`)
  const button = action
    ? card?.querySelector<HTMLButtonElement>(`[data-action="${action}"]:not(:disabled)`)
    : null
  ;(button ?? card)?.focus()
}

function onCardMove(id: string, target: StageId, action: string) {
  const result: MoveResult = moveDossier(id, target)
  if (result === 'moved') restoreFocus(id, action)
  if (result === 'pending') pendingAction = action
}

function onDrawerMove(id: string, target: StageId) {
  pendingAction = null
  moveDossier(id, target)
}

function onDrawerReschedule(id: string, date: string) {
  rescheduleDossier(id, date)
}

async function onDrawerClose() {
  const id = selectedId.value
  closeDossier()
  await nextTick()
  if (id) document.getElementById(`card-open-${id}`)?.focus()
}

function onTypeConfirm(type: TypeDossier) {
  const id = pendingMove.value?.dossierId
  const result = confirmPendingMove(type)
  if (id && result === 'moved' && pendingAction) restoreFocus(id, pendingAction)
  pendingAction = null
}

function onTypeCancel() {
  cancelPendingMove()
  pendingAction = null
}
</script>

<template>
  <div class="page">
    <div class="main-column">
      <header class="app-header">
        <div class="app-header-main">
          <div class="brand">
            <span class="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <rect x="3" y="4" width="5" height="16" rx="1.5" />
                <rect x="9.5" y="4" width="5" height="11" rx="1.5" />
                <rect x="16" y="4" width="5" height="7" rx="1.5" />
              </svg>
            </span>
            <div>
              <h1 class="brand-title">Suivi Cadrage et Instruction</h1>
              <p class="brand-subtitle">Dossiers d’architecture · {{ todayLabel }}</p>
            </div>
          </div>

          <div class="filters" role="search">
            <label class="filter">
              <span class="sr-only">Architecte solution (AS)</span>
              <select v-model="filters.architecte">
                <option value="">Tous les AS</option>
                <option v-for="name in architectes" :key="name" :value="name">{{ name }}</option>
              </select>
            </label>

            <label class="filter filter-search">
              <span class="sr-only">Rechercher un dossier</span>
              <svg class="filter-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
                <path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <input v-model="filters.search" type="search" placeholder="Titre ou identifiant" />
            </label>

            <button v-if="hasActiveFilters" type="button" class="reset" @click="resetFilters">
              Réinitialiser
            </button>
          </div>
        </div>

        <ul class="summary" aria-label="Synthèse des dossiers affichés">
          <li class="summary-item">
            <strong>{{ summary.total }}</strong> dossier{{ summary.total > 1 ? 's' : '' }}
          </li>
          <li class="summary-item" :class="{ 'is-alert': summary.late > 0 }">
            <strong>{{ summary.late }}</strong> en retard
          </li>
          <li class="summary-item">
            <strong>{{ summary.current }}</strong> au CSDA cette semaine
          </li>
        </ul>
      </header>

      <!-- Invisible : restitue aux lecteurs d'écran le résultat des déplacements. -->
      <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>

      <main
        class="board"
        :style="{ '--stage-count': columns.length }"
        aria-label="Tableau des dossiers par étape"
      >
        <div class="board-content">
          <div class="board-header">
            <div
              v-for="column in columns"
              :key="column.stage.id"
              class="column-header"
              :class="`is-${dropStateFor(column.stage.id) ?? 'idle'}`"
            >
              <span class="column-title">
                {{ column.stage.label }}
                <span v-if="column.stage.optional" class="column-tag">optionnelle</span>
              </span>
              <span
                class="column-count"
                :aria-label="
                  column.count === column.total
                    ? `${column.total} dossiers`
                    : `${column.count} dossiers affichés sur ${column.total}`
                "
              >
                {{ column.count === column.total ? column.total : `${column.count} / ${column.total}` }}
              </span>
            </div>
          </div>

          <KanbanLane
            v-for="lane in lanes"
            :key="lane.key"
            :lane="lane"
            :collapsed="!expandedLanes.has(lane.key)"
            :header-drop-state="laneDropStateFor(lane.key)"
            @toggle="toggleLane"
            @drop="onDrop(lane.key, $event)"
          >
            <!-- « Terminés » : simple archive, sans les colonnes du workflow. -->
            <div v-if="lane.kind === 'done'" class="archive" role="list" aria-label="Dossiers archivés">
              <div v-for="dossier in lane.dossiers" :key="dossier.id" role="listitem">
                <KanbanCard
                  :dossier="dossier"
                  :dragging="draggedId === dossier.id"
                  :selected="selectedId === dossier.id"
                  @open="openDossier"
                  @move="onCardMove"
                  @drag-start="onDragStart"
                  @drag-end="onDragEnd"
                />
              </div>
            </div>

            <template v-else>
              <KanbanCell
                v-for="cell in lane.cells"
                :key="cell.stage.id"
                :label="`${cell.stage.label} – ${lane.label}${lane.dates ? ` (${lane.dates})` : ''}`"
                :drop-state="dropStateFor(cell.stage.id, lane.key)"
                @drop="onDrop(lane.key, $event, cell.stage.id)"
              >
                <KanbanCard
                  v-for="dossier in cell.dossiers"
                  :key="dossier.id"
                  :dossier="dossier"
                  :dragging="draggedId === dossier.id"
                  :selected="selectedId === dossier.id"
                  @open="openDossier"
                  @move="onCardMove"
                  @drag-start="onDragStart"
                  @drag-end="onDragEnd"
                />
              </KanbanCell>
            </template>
          </KanbanLane>

          <p v-if="lanes.every((l) => l.count === 0)" class="board-empty">
            Aucun dossier ne correspond aux filtres.
          </p>
        </div>
      </main>
    </div>

    <Transition name="drawer">
      <DossierDrawer
        v-if="selectedDossier"
        :dossier="selectedDossier"
        :today="today"
        @move="onDrawerMove"
        @reschedule="onDrawerReschedule"
        @close="onDrawerClose"
      />
    </Transition>

    <TypeDossierModal
      v-if="pendingMove && pendingDossier"
      :dossier="pendingDossier"
      :target-label="getStage(pendingMove.target).label"
      @confirm="onTypeConfirm"
      @cancel="onTypeCancel"
    />
  </div>
</template>

<style scoped>
.page {
  height: 100vh;
  height: 100dvh;
}

/* Le drawer est en `position: fixed`, hors du flux : cette colonne occupe toute la page. */
.main-column {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/*
 * En-tête clair : il s'efface devant le board. Le vert ne reste que sur l'icône,
 * et seule l'alerte « en retard » est colorée.
 */
.app-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 20px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.app-header-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--accent);
  color: var(--on-accent);
}

.brand-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
  color: var(--text-h);
}

.brand-subtitle {
  margin: 2px 0 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.filter {
  position: relative;
  display: flex;
  align-items: center;
}

select,
input,
.reset {
  font: inherit;
  font-size: 0.875rem;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-h);
  box-sizing: border-box;
}

select:hover,
input:hover {
  border-color: color-mix(in srgb, var(--text-muted) 50%, var(--border));
}

select {
  min-width: 160px;
  cursor: pointer;
}

.filter-search input {
  width: 260px;
  padding-left: 34px;
}

.filter-icon {
  position: absolute;
  left: 11px;
  color: var(--text-muted);
  pointer-events: none;
}

select:focus-visible,
input:focus-visible,
.reset:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.reset {
  cursor: pointer;
  background: transparent;
  color: var(--text);
}

.reset:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Pastilles neutres : chiffres lisibles sans attirer l'œil. */
.summary-item {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--surface-2);
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.summary-item strong {
  font-weight: 700;
  color: var(--text-h);
}

/* Seule l'alerte est colorée : c'est la seule qui appelle une action. */
.summary-item.is-alert,
.summary-item.is-alert strong {
  background: var(--warning-bg);
  color: var(--warning);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}


/*
 * Grille étapes × lignes. Les colonnes ont une largeur fixe : en-têtes et cellules
 * de chaque ligne s'alignent sans grille partagée. Défilement dans les deux sens.
 */
.board {
  --column-width: 260px;
  --board-padding: 20px;
  flex: 1;
  min-height: 0;
  padding: 12px var(--board-padding) 16px;
  overflow: auto;
}

/* Grille sans gouttière : les colonnes sont matérialisées par des filets (cf. KanbanCell). */
/* Les lignes sont des panneaux espacés ; l'espace suffit à les séparer. */
.board-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: max-content;
}

/*
 * En-tête de tableau : barre bordée au même gabarit que les panneaux de lignes
 * (même bordure de 1px), donc colonnes alignées. Reste visible au défilement vertical.
 */
.board-header {
  position: sticky;
  z-index: 2;
  top: 0;
  display: grid;
  grid-template-columns: repeat(var(--stage-count), var(--column-width));
  margin-top: 4px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--lane-bar-bg);
  box-shadow:
    0 -4px 0 var(--bg),
    var(--shadow-sm);
}

/* En-tête plat : nom de l'étape et compteur, séparés comme les colonnes des lignes. */
.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px 9px;
  transition:
    opacity 0.15s,
    box-shadow 0.15s;
}

.column-header + .column-header {
  border-left: 1px solid var(--border);
}

/* Les fonds d'état (glisser) épousent les coins arrondis de la barre. */
.column-header:first-child {
  border-radius: 9px 0 0 9px;
}

.column-header:last-child {
  border-radius: 0 9px 9px 0;
}

/* Pendant un glisser : étapes possibles en vert (fond, titre, soulignement)… */
.column-header.is-allowed {
  background: color-mix(in srgb, var(--accent) 14%, var(--lane-bar-bg));
  box-shadow: inset 0 -3px 0 var(--accent);
}

.column-header.is-allowed .column-title {
  color: var(--accent);
}

/* … étapes interdites hachurées, comme leurs cellules. */
.column-header.is-forbidden {
  background: repeating-linear-gradient(-45deg, var(--hatch) 0 2px, transparent 2px 9px);
}

.column-header.is-forbidden > * {
  opacity: 0.4;
}

.column-title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-h);
}

.column-tag {
  font-size: 0.6875rem;
  font-weight: 500;
  font-style: italic;
  color: var(--text-muted);
}

.column-count {
  min-width: 22px;
  padding: 1px 7px;
  border: 1px solid var(--grid-line);
  border-radius: 999px;
  background: var(--surface);
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
  color: var(--text-h);
}

.column-header.is-allowed .column-count {
  background: var(--accent);
  color: var(--on-accent);
}

.board-empty {
  margin: 24px 0;
  font-style: italic;
  color: var(--text-muted);
}

/*
 * Archive « Terminés » : grille de cartes (largeur d'une carte de colonne), limitée à la
 * partie visible et figée à gauche, pour ne pas avoir à défiler horizontalement.
 */
.archive {
  position: sticky;
  left: calc(var(--board-padding) + 1px);
  display: grid;
  grid-template-columns: repeat(auto-fill, calc(var(--column-width) - 16px));
  gap: 8px;
  width: calc(100vw - 2 * var(--board-padding) - 24px);
  padding: 10px 8px;
  box-sizing: border-box;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.2s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(100%);
}

@media (prefers-reduced-motion: reduce) {
  .drawer-enter-active,
  .drawer-leave-active {
    transition: none;
  }
}
</style>
