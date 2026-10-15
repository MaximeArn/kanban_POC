<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  LATE_LANE,
  useKanban,
  type Lane,
  type MoveResult,
  type PendingAnswer,
  type ToggleFilter,
} from '../composables/useKanban'
import { PHASES, STAGE_RULES, type Phase, type StageId } from '../domain/workflow'
import { formatLongDate } from '../utils/format'
import DossierDrawer from './DossierDrawer.vue'
import KanbanCard from './KanbanCard.vue'
import KanbanCell from './KanbanCell.vue'
import KanbanLane from './KanbanLane.vue'
import PendingMoveModal from './PendingMoveModal.vue'
import ViewHeader from './ViewHeader.vue'

const {
  filters,
  today,
  currentLaneKey,
  hasActiveFilters,
  toggleCounts,
  togglePhase,
  toggleFilter,
  columns,
  lanes,
  draggedId,
  dropStateFor,
  laneDropStateFor,
  pendingMove,
  pendingDossier,
  announcement,
  reminder,
  selectedId,
  selectedDossier,
  moveDossier,
  dropDossier,
  rescheduleDossier,
  confirmPendingMove,
  cancelPendingMove,
  setAttente,
  setFas,
  setUrgence,
  dismissReminder,
  resetFilters,
  openDossier,
  closeDossier,
} = useKanban()

/**
 * Bouton de carte à l'origine d'un déplacement en attente, pour y replacer le focus.
 * `null` si le déplacement vient du drawer : il reste affiché, le focus y revient seul.
 */
let pendingAction: string | null = null

/** À côté du titre, comme la maquette : nombre de DDS affichées, et la date du jour (jalons relatifs). */
const eyebrow = computed(() => {
  const total = summary.value.total
  return `${total} dossier${total > 1 ? 's' : ''} · ${formatLongDate(today.value)}`
})

/**
 * Chiffres clés de l'en-tête, sur les DDS affichées (filtres appliqués). La semaine en cours
 * accueille aussi les DDS sans J0.8 : « au CSDA cette semaine » ne compte que celles qui en ont un.
 */
const summary = computed(() => {
  const shown = lanes.value.flatMap((l) => l.dossiers)
  const current = lanes.value.find((l) => l.kind === 'current')?.dossiers ?? []
  return {
    total: shown.length,
    late: lanes.value.find((l) => l.kind === 'late')?.count ?? 0,
    sansJ08: shown.filter((d) => d.j08 === null).length,
    current: current.filter((d) => d.j08 !== null).length,
  }
})

/** Chiffres clés qui servent aussi de filtres (spec F-DDS-03bis) : compteurs hors bascules. */
const TOGGLES: { key: ToggleFilter; label: string }[] = [
  { key: 'urgentes', label: 'urgentes' },
  { key: 'plusDe3Mois', label: 'de plus de 3 mois' },
  { key: 'enAttente', label: 'en attente' },
]

/**
 * Pistes de la grille : largeur de colonne pour un statut, bandeau étroit pour une phase
 * masquée. Partagées par la barre des titres et toutes les lignes, qui restent alignées.
 */
const gridStyle = computed(() => {
  const stages = columns.value.filter((slot) => slot.kind === 'stage').length
  const bands = columns.value.length - stages
  return {
    '--board-columns': columns.value
      .map((slot) => (slot.kind === 'stage' ? 'var(--column-width)' : 'var(--band-width)'))
      .join(' '),
    '--board-min-width': `calc(${stages} * var(--column-width) + ${bands} * var(--band-width) + 2px)`,
  }
})

function cellOf(lane: Lane, stage: StageId) {
  return lane.cells.find((cell) => cell.stage.id === stage)?.dossiers ?? []
}

function phaseCount(lane: Lane, phase: Phase): number {
  return lane.dossiers.filter((d) => phase.stages.includes(d.stage)).length
}

/** Infobulle et texte lu de l'icône de règle / rappel d'une colonne. */
function ruleLabel(stage: StageId): string {
  const rule = STAGE_RULES[stage]
  return rule ? `${rule.kind === 'regle' ? 'Règle' : 'Rappel'} : ${rule.text}` : ''
}

/** Le rappel d'un statut reste affiché quelques secondes après le déplacement. */
let reminderTimer: ReturnType<typeof setTimeout> | undefined
watch(reminder, (value) => {
  clearTimeout(reminderTimer)
  if (value) reminderTimer = setTimeout(dismissReminder, 8000)
})

/** Rangée des titres de colonnes (hors défilement) et zone du board qui défile. */
const headerRow = ref<HTMLElement | null>(null)
const bodyRow = ref<HTMLElement | null>(null)

/** Comme la maquette : la rangée des titres suit le défilement horizontal du board. */
function syncHeaderScroll() {
  if (headerRow.value && bodyRow.value) headerRow.value.scrollLeft = bodyRow.value.scrollLeft
}

/** Dépliées par défaut : « En retard » et la semaine en cours. */
const expandedLanes = ref(new Set<string>([LATE_LANE, currentLaneKey.value]))

// Changement de semaine (page restée ouverte) : la nouvelle semaine en cours s'ouvre aussi.
watch(currentLaneKey, (key) => expandedLanes.value.add(key))

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
  pendingAction = null
  rescheduleDossier(id, date)
}

async function onDrawerClose() {
  const id = selectedId.value
  closeDossier()
  await nextTick()
  if (id) document.getElementById(`card-open-${id}`)?.focus()
}

function onPendingConfirm(answer: PendingAnswer) {
  const id = pendingMove.value?.dossierId
  const result = confirmPendingMove(answer)
  if (id && result === 'moved' && pendingAction) restoreFocus(id, pendingAction)
  pendingAction = null
}

function onPendingCancel() {
  cancelPendingMove()
  pendingAction = null
}
</script>

<template>
  <div class="page">
    <div class="main-column">
      <!--
        Disposition de la maquette : filtre Phase à droite du titre, recherche sur toute la
        largeur en dessous. Pas de filtre par AS : le périmètre est celui du profil connecté.
      -->
      <ViewHeader
        title="Suivi Cadrage et Instruction"
        :eyebrow="eyebrow"
        subtitle="Vos DDS uniquement — glissez une carte pour faire évoluer le statut"
      >
        <template #actions>
          <!-- Filtre Phase : aucune phase cochée = toutes affichées ; les autres se replient en bandeau. -->
          <div class="phase-filter" role="group" aria-labelledby="phase-filter-label">
            <span id="phase-filter-label" class="phase-filter-label">Phase</span>
            <button
              v-for="phase in PHASES"
              :key="phase.id"
              type="button"
              class="phase-chip"
              :aria-pressed="filters.phases.includes(phase.id)"
              @click="togglePhase(phase.id)"
            >
              {{ phase.label }}
            </button>
          </div>
        </template>

        <div class="search" role="search">
          <label class="search-field">
            <span class="sr-only">Rechercher une DDS</span>
            <span class="ms search-icon" aria-hidden="true">search</span>
            <input
              v-model="filters.search"
              type="search"
              placeholder="Rechercher par titre, domaine, demandeur, N° DDS…"
            />
          </label>
        </div>

        <div class="toolbar">
          <ul class="summary" aria-label="Synthèse des dossiers affichés">
            <li class="summary-item" :class="{ 'is-alert': summary.late > 0 }">
              <strong>{{ summary.late }}</strong> en retard
            </li>
            <li class="summary-item">
              <strong>{{ summary.sansJ08 }}</strong> à pré-qualifier (sans J0.8)
            </li>
            <li class="summary-item">
              <strong>{{ summary.current }}</strong> au CSDA cette semaine
            </li>
            <li v-for="toggle in TOGGLES" :key="toggle.key">
              <button
                type="button"
                class="summary-item is-toggle"
                :class="{ 'is-alert': toggle.key === 'urgentes', 'is-hold': toggle.key === 'enAttente' }"
                :aria-pressed="filters.toggles.includes(toggle.key)"
                :title="`N'afficher que les DDS ${toggle.label}`"
                @click="toggleFilter(toggle.key)"
              >
                <strong>{{ toggleCounts[toggle.key] }}</strong> {{ toggle.label }}
              </button>
            </li>
          </ul>

          <button v-if="hasActiveFilters" type="button" class="reset" @click="resetFilters">
            Réinitialiser les filtres
          </button>
        </div>
      </ViewHeader>

      <!-- Invisible : restitue aux lecteurs d'écran le résultat des déplacements. -->
      <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>

      <div
        class="board-area"
        :style="gridStyle"
        role="region"
        aria-label="Tableau des DDS par statut"
      >
        <!--
          Comme la maquette : les titres de colonnes sont hors de la zone qui défile, le board
          ne passe donc jamais dessous ; leur défilement horizontal suit celui du board.
        -->
        <div ref="headerRow" class="board-header-row">
          <div class="board-header">
            <template v-for="column in columns" :key="column.key">
            <!-- Phase masquée : bandeau étroit avec son compteur ; un clic la réaffiche. -->
            <button
              v-if="column.kind === 'phase'"
              type="button"
              class="column-header column-band"
              :title="`Phase « ${column.phase.label} » masquée — cliquer pour l'afficher`"
              @click="togglePhase(column.phase.id)"
            >
              <span class="column-count">{{ column.count }}</span>
              <span class="sr-only">
                Phase « {{ column.phase.label }} » masquée, {{ column.count }} DDS. Afficher la phase.
              </span>
            </button>
            <div
              v-else
              class="column-header"
              :class="`is-${dropStateFor(column.stage.id) ?? 'idle'}`"
            >
              <span class="column-title">
                {{ column.stage.label }}
                <span
                  v-if="STAGE_RULES[column.stage.id]"
                  class="column-rule"
                  :class="`is-${STAGE_RULES[column.stage.id]!.kind}`"
                  :title="ruleLabel(column.stage.id)"
                >
                  <span class="ms" aria-hidden="true">{{
                    STAGE_RULES[column.stage.id]!.kind === 'regle' ? 'rule' : 'lightbulb'
                  }}</span>
                  <span class="sr-only">{{ ruleLabel(column.stage.id) }}</span>
                </span>
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
            </template>
          </div>
        </div>

        <div ref="bodyRow" class="board zone-defilement" @scroll="syncHeaderScroll">
          <div class="board-content">
            <KanbanLane
              v-for="lane in lanes"
              :key="lane.key"
              :lane="lane"
              :collapsed="!expandedLanes.has(lane.key)"
              :header-drop-state="laneDropStateFor(lane.key)"
              @toggle="toggleLane"
              @drop="onDrop(lane.key, $event)"
            >
              <!-- Archive « Terminés » : simple grille de cartes, sans les colonnes du workflow. -->
              <div v-if="lane.kind === 'done'" class="card-grid" role="list" aria-label="DDS archivées">
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
                <template v-for="column in columns" :key="column.key">
                <!-- Phase masquée : bandeau vertical, nombre de DDS de la ligne dans cette phase. -->
                <div
                  v-if="column.kind === 'phase'"
                  class="phase-band"
                  :title="`${column.phase.label} : ${phaseCount(lane, column.phase)} DDS masquée(s)`"
                >
                  <span class="phase-band-label">
                    {{ column.phase.label }} · {{ phaseCount(lane, column.phase) }}
                  </span>
                </div>
                <KanbanCell
                  v-else
                  :label="`${column.stage.label} – ${lane.label}${lane.dates ? ` (${lane.dates})` : ''}`"
                  :drop-state="dropStateFor(column.stage.id, lane.key)"
                  @drop="onDrop(lane.key, $event, column.stage.id)"
                >
                  <KanbanCard
                    v-for="dossier in cellOf(lane, column.stage.id)"
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
              </template>
            </KanbanLane>

            <p v-if="lanes.every((l) => l.count === 0)" class="board-empty">
              Aucune DDS ne correspond aux filtres.
            </p>
          </div>
        </div>
      </div>
    </div>

    <Transition name="drawer">
      <DossierDrawer
        v-if="selectedDossier"
        :dossier="selectedDossier"
        :today="today"
        @move="onDrawerMove"
        @reschedule="onDrawerReschedule"
        @hold="setAttente"
        @fas="setFas"
        @urgence="setUrgence"
        @close="onDrawerClose"
      />
    </Transition>

    <!-- Rappel du statut d'arrivée (spec §6.2) : informatif, il ne bloque rien. -->
    <Transition name="toast">
      <div v-if="reminder" :key="reminder.id" class="toast">
        <span class="toast-chip"><span class="ms" aria-hidden="true">lightbulb</span> Rappel</span>
        <p class="toast-text">
          <strong>{{ reminder.dossierId }}</strong> en « {{ reminder.stageLabel }} » : {{ reminder.text }}
        </p>
        <button type="button" class="toast-close" aria-label="Fermer le rappel" @click="dismissReminder">✕</button>
      </div>
    </Transition>

    <PendingMoveModal
      v-if="pendingMove && pendingDossier"
      :dossier="pendingDossier"
      :target="pendingMove.target"
      :requirements="pendingMove.requirements"
      :proposed-date="pendingMove.date"
      :today="today"
      @confirm="onPendingConfirm"
      @cancel="onPendingCancel"
    />
  </div>
</template>

<style scoped>
/* Le bandeau de l'application est dans App.vue : la vue occupe la hauteur restante. */
.page {
  height: 100%;
}

/* Le drawer est en `position: fixed`, hors du flux : cette colonne occupe toute la page. */
.main-column {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Recherche sur toute la largeur, sous le titre (maquette). */
.search-field {
  position: relative;
  display: flex;
  align-items: center;
}

/* Champs arrondis de la maquette. */
input,
.reset {
  font: inherit;
  font-size: 0.875rem;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--gris-300);
  border-radius: 999px;
  background: var(--carte);
  color: var(--encre);
  box-sizing: border-box;
}

input:hover {
  border-color: #b9c0cd;
}

.search-field input {
  width: 100%;
  height: 40px;
  padding-left: 40px;
}

.search-icon {
  position: absolute;
  left: 14px;
  font-size: 18px;
  color: var(--gris-600);
  pointer-events: none;
}

/* Focus de la maquette : halo bleu clair, bordure bleue. */
input:focus-visible,
.reset:focus-visible {
  outline: none;
  border-color: var(--bleu-600);
  box-shadow: 0 0 0 3px var(--bleu-100);
}

.reset {
  flex-shrink: 0;
  height: 30px;
  cursor: pointer;
  border-color: transparent;
  background: transparent;
  font-weight: 600;
  color: var(--bleu-600);
}

.reset:hover {
  background: var(--bleu-100);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}

.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Pastilles (« pill ») de la maquette : neutre, et alerte pour les retards. */
.summary-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--gris-100);
  font-size: 0.8125rem;
  font-weight: 600;
  color: #41485a;
}

.summary-item strong {
  font-weight: 700;
}

.summary-item.is-alert {
  background: var(--alerte-soft);
  color: var(--alerte-fg);
}

/* Chiffres clés cliquables : même pastille, bordée pour signaler l'action. */
.summary-item.is-toggle {
  border: 1px solid var(--gris-300);
  background: var(--carte);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #41485a;
  cursor: pointer;
}

.summary-item.is-toggle:hover {
  border-color: var(--bleu-600);
}

.summary-item.is-toggle.is-alert strong {
  color: var(--alerte-fg);
}

.summary-item.is-toggle.is-hold strong {
  color: var(--vigilance-fg);
}

/* Filtre engagé : fond bleu clair, texte bleu gras (langage unique des filtres, spec §8). */
.summary-item.is-toggle[aria-pressed='true'],
.phase-chip[aria-pressed='true'] {
  border-color: var(--bleu-600);
  background: var(--bleu-100);
  color: var(--bleu-700);
  font-weight: 700;
}

.summary-item.is-toggle[aria-pressed='true'] strong {
  color: var(--bleu-700);
}

.summary-item.is-toggle:focus-visible,
.phase-chip:focus-visible,
.column-band:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--bleu-100);
  border-color: var(--bleu-600);
}

.phase-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.phase-filter-label {
  margin-right: 2px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--gris-600);
}

.phase-chip {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--gris-300);
  border-radius: 999px;
  background: var(--carte);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #41485a;
  cursor: pointer;
}

.phase-chip:hover {
  border-color: var(--bleu-600);
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
 * Grille statuts × lignes. Les colonnes ont une largeur fixe : titres et cellules de chaque
 * ligne s'alignent sans grille partagée.
 */
.board-area {
  --column-width: 260px;
  /* Bandeau d'une phase masquée (filtre Phase). */
  --band-width: 52px;
  --board-padding: 20px;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

/*
 * Titres de colonnes hors de la zone qui défile (cf. maquette) : défilement horizontal
 * piloté par le board (`syncHeaderScroll`). `scrollbar-gutter` réserve ici la même place
 * que la barre de défilement verticale du board : les deux restent alignés jusqu'au bout.
 */
.board-header-row {
  flex-shrink: 0;
  padding: 12px var(--board-padding) 0;
  overflow: hidden;
  scrollbar-gutter: stable;
}

/* Zone du board : défilement dans les deux sens, sous la rangée des titres. */
.board {
  flex: 1;
  min-height: 0;
  padding: 12px var(--board-padding) 16px;
  overflow: auto;
  scrollbar-gutter: stable;
}

/* Grille sans gouttière : les colonnes sont matérialisées par des filets (cf. KanbanCell). */
/* Les lignes sont des panneaux espacés ; l'espace suffit à les séparer. */
/*
 * Largeur minimale = toutes les colonnes + la bordure des panneaux (2 × 1px) : même repliées,
 * les lignes s'alignent sur la barre des titres, qui n'est plus dans cette zone.
 */
.board-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: max-content;
  min-width: var(--board-min-width);
}

/*
 * En-tête de tableau : barre bordée au même gabarit que les panneaux de lignes
 * (même bordure de 1px), donc colonnes alignées. Bas à angle droit : le board défile
 * juste dessous, des coins arrondis y laisseraient apparaître les cartes.
 */
.board-header {
  display: grid;
  grid-template-columns: var(--board-columns);
  width: max-content;
  border: 1px solid var(--border);
  border-radius: 10px 10px 0 0;
  background: var(--lane-bar-bg);
  box-shadow: var(--shadow-sm);
}

/*
 * En-tête plat : nom de l'étape et compteur, séparés comme les colonnes des lignes.
 * `position: relative` contient les textes `.sr-only` (positionnés en absolu) : sans cela,
 * ils échapperaient à la rangée des titres et élargiraient toute la page.
 */
.column-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px 9px;
  transition:
    opacity 0.15s,
    box-shadow 0.15s;
}

/* Les fonds d'état (glisser) épousent les coins arrondis de la barre. */
.column-header:first-child {
  border-radius: 9px 0 0;
}

.column-header:last-child {
  border-radius: 0 9px 0 0;
}

.column-header + .column-header {
  border-left: 1px solid var(--border);
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


/* Bandeau de phase masquée dans la barre des titres : bouton qui réaffiche la phase. */
.column-band {
  justify-content: center;
  padding: 10px 4px 9px;
  border: 0;
  background: var(--gris-100);
  font: inherit;
  cursor: pointer;
}

.column-band:hover {
  background: var(--bleu-100);
}

/* Le même bandeau dans chaque ligne : libellé vertical, sans place dans le calcul de hauteur. */
.phase-band {
  position: relative;
  border-left: 1px solid var(--grid-line);
  border-right: 1px solid var(--grid-line);
  background: var(--gris-100);
}

.phase-band:first-child {
  border-left: 0;
}

.phase-band-label {
  position: absolute;
  inset: 10px 0;
  overflow: hidden;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: var(--band-width);
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--gris-600);
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}

/* Repère de règle (bleu) ou de rappel (gris) du statut, détaillé en infobulle. */
.column-rule {
  display: inline-flex;
  align-self: center;
  cursor: help;
}

.column-rule .ms {
  font-size: 16px;
}

.column-rule.is-regle {
  color: var(--bleu-600);
}

.column-rule.is-rappel {
  color: var(--gris-600);
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
 * Archive « Terminés » : grille de cartes (largeur d'une carte de colonne),
 * limitée à la partie visible et figée à gauche, pour ne pas avoir à défiler horizontalement.
 * Le collage se mesure depuis le bord intérieur du board : décalage = bordure du panneau.
 */
.card-grid {
  position: sticky;
  left: 1px;
  display: grid;
  grid-template-columns: repeat(auto-fill, calc(var(--column-width) - 16px));
  gap: 8px;
  width: calc(100vw - 2 * var(--board-padding) - 24px);
  padding: 10px 8px;
  box-sizing: border-box;
}

/* Bandeau de rappel, en bas de l'écran, au-dessus du drawer. */
.toast {
  position: fixed;
  z-index: 20;
  bottom: 20px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 12px;
  width: max-content;
  max-width: min(640px, calc(100vw - 32px));
  padding: 10px 10px 10px 14px;
  border: 1px solid var(--bordure);
  border-radius: 12px;
  background: var(--carte);
  box-shadow: var(--ombre);
  transform: translateX(-50%);
}

.toast-chip {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  padding: 2px 10px 2px 8px;
  border-radius: 999px;
  background: var(--jaune-200);
  color: var(--bleu-700);
  font-size: 0.75rem;
  font-weight: 700;
}

.toast-chip .ms {
  font-size: 16px;
}

.toast-text {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.4;
}

.toast-close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
}

.toast-close:hover {
  border-color: var(--border);
  color: var(--text-h);
}

.toast-close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
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
  .toast-enter-active,
  .toast-leave-active,
  .drawer-enter-active,
  .drawer-leave-active {
    transition: none;
  }
}
</style>
