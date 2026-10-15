<script setup lang="ts">
import { computed } from 'vue'
import {
  VALIDATED_STAGES,
  availableMoves,
  daysLate,
  getStage,
  isExit,
  type Dossier,
  type MoveOption,
  type StageId,
} from '../domain/workflow'
import { DND_MIME } from '../composables/useKanban'
import { useToday } from '../composables/useToday'
import { formatDelay, formatShortDate } from '../utils/format'

const props = defineProps<{
  dossier: Dossier
  dragging: boolean
  selected: boolean
}>()

const emit = defineEmits<{
  open: [id: string]
  move: [id: string, target: StageId, action: string]
  'drag-start': [id: string]
  'drag-end': []
}>()

const today = useToday()
const moves = computed(() => availableMoves(props.dossier, today.value))
const delay = computed(() => daysLate(props.dossier, today.value))

/** Revenir en arrière depuis une validation ou une sortie a un sens métier : on le nomme. */
const previousLabel = computed(() => {
  const target = `« ${moves.value.previous.label} »`
  if (VALIDATED_STAGES.includes(props.dossier.stage)) return `Invalider (retour en ${target})`
  if (props.dossier.stage === 'abandonnee') return `Réactiver (retour en ${target})`
  return `Statut précédent : ${moves.value.previous.label}`
})

/** Depuis Instruction, avancer est une demande de passage en CSDA (règle à confirmer). */
const nextLabel = computed(() =>
  moves.value.next.target === 'demandeCsda'
    ? 'Demander le passage en CSDA'
    : `Étape suivante : ${moves.value.next.label}`,
)

/** Couleur de la pastille météo de la maquette. */
const METEO_TONES = { Vert: 'succes', Orange: 'vigilance', Rouge: 'alerte' } as const

function moveTo(option: MoveOption, action: string) {
  if (option.target && option.allowed) emit('move', props.dossier.id, option.target, action)
}

function onDragStart(event: DragEvent) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData(DND_MIME, props.dossier.id)
  event.dataTransfer.effectAllowed = 'move'
  emit('drag-start', props.dossier.id)
}
</script>

<template>
  <!-- Clic souris n'importe où sur la carte ; au clavier, le titre est le bouton d'ouverture. -->
  <article
    :id="`card-${dossier.id}`"
    class="card"
    :class="{ 'is-dragging': dragging, 'is-selected': selected }"
    tabindex="-1"
    draggable="true"
    :aria-labelledby="`card-open-${dossier.id}`"
    @click="emit('open', dossier.id)"
    @dragstart="onDragStart"
    @dragend="emit('drag-end')"
  >
    <!-- Bandeau « Urgente » de la maquette. -->
    <div v-if="dossier.urgent" class="card-urgent" :title="dossier.motifUrgence ?? undefined">
      <span class="ms" aria-hidden="true">warning</span> Urgente
    </div>

    <header class="card-header">
      <span class="card-id">
        <span
          v-if="dossier.meteo"
          class="meteo"
          :class="`meteo-${METEO_TONES[dossier.meteo.statut]}`"
          :title="`Météo ${dossier.meteo.statut} — ${dossier.meteo.commentaire}`"
        />
        <span v-if="dossier.meteo" class="sr-only">Météo {{ dossier.meteo.statut }}.</span>
        {{ dossier.id }}
      </span>
      <span v-if="isExit(dossier.stage)" class="badge badge-exit">{{ getStage(dossier.stage).label }}</span>
      <span v-else-if="dossier.fas" class="badge badge-fas" title="Fiche d’architecture simplifiée : CSDA déclaratif">
        FAS
      </span>
    </header>

    <h3 class="card-title">
      <button
        :id="`card-open-${dossier.id}`"
        type="button"
        class="card-open"
        :aria-current="selected ? 'true' : undefined"
        @click.stop="emit('open', dossier.id)"
      >
        {{ dossier.titre }}
      </button>
    </h3>

    <p class="card-requester">{{ dossier.demandeur }}</p>

    <!-- Pastille « En attente » de la maquette : le motif est dans l'infobulle et la fiche. -->
    <p v-if="dossier.attente" class="card-hold" :title="`En attente : ${dossier.attente.motif}`">
      <span class="ms" aria-hidden="true">pause_circle</span> En attente
      <span class="sr-only">: {{ dossier.attente.motif }}</span>
    </p>

    <footer class="card-footer">
      <!-- Date et retard groupés : si la place manque, la pastille passe sous la date. -->
      <span class="card-schedule">
        <span
          v-if="dossier.j08"
          class="card-date"
          :class="{ 'is-late': delay > 0 }"
          :title="delay > 0 ? `J0.8 dépassé de ${delay} jour${delay > 1 ? 's' : ''}` : 'Jalon J0.8 (CSDA visé)'"
        >
          CSDA <time :datetime="dossier.j08">{{ formatShortDate(dossier.j08, today) }}</time>
        </span>
        <span v-else class="card-date">J0.8 à poser</span>
        <span v-if="delay > 0" class="card-delay">
          <span aria-hidden="true">+{{ formatDelay(delay) }}</span>
          <span class="sr-only">En retard de {{ delay }} jour{{ delay > 1 ? 's' : '' }}.</span>
        </span>
      </span>

      <span class="card-nav">
        <button
          type="button"
          data-action="previous"
          :disabled="!moves.previous.allowed"
          :title="moves.previous.allowed ? previousLabel : moves.previous.reason"
          :aria-label="
            moves.previous.allowed ? `${previousLabel} – ${dossier.id}` : `Étape précédente – ${dossier.id}`
          "
          @click.stop="moveTo(moves.previous, 'previous')"
        >
          ←
        </button>
        <button
          type="button"
          data-action="next"
          :disabled="!moves.next.allowed"
          :title="moves.next.allowed ? nextLabel : moves.next.reason"
          :aria-label="moves.next.allowed ? `${nextLabel} – ${dossier.id}` : `Étape suivante – ${dossier.id}`"
          @click.stop="moveTo(moves.next, 'next')"
        >
          →
        </button>
      </span>
    </footer>
  </article>
</template>

<style scoped>
/*
 * L'ombre combine deux couches indépendantes, pour qu'elles se cumulent :
 * contour de sélection et élévation.
 */
.card {
  --ring: 0 0 transparent;
  --elevation: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  overflow: hidden;
  background: var(--carte);
  border: 1px solid var(--bordure);
  border-radius: 12px;
  box-shadow: var(--ring), var(--elevation);
  cursor: pointer;
  transition:
    opacity 0.15s,
    box-shadow 0.15s;
}

.card:hover {
  --elevation: var(--shadow-md);
}

.card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.card.is-selected {
  --ring: 0 0 0 2px var(--accent);
}

.card.is-dragging {
  --elevation: 0 0 transparent;
  opacity: 0.4;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

/* Bandeau rouge pleine largeur en haut de carte (marges négatives = padding de la carte). */
.card-urgent {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: -10px -12px 0;
  padding: 2px 12px;
  background: var(--alerte);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #fff;
}

.card-urgent .ms {
  font-size: 12px;
}

.card-id {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--mono);
  font-size: 0.6875rem;
  color: var(--gris-600);
}

/* Pastille météo de la maquette (Vert / Orange / Rouge). */
.meteo {
  flex: 0 0 9px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.meteo-succes {
  background: var(--succes);
}

.meteo-vigilance {
  background: var(--vigilance);
}

.meteo-alerte {
  background: var(--alerte);
}

.badge-exit {
  color: #41485a;
  background: var(--gris-100);
}

.badge {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.badge-fas {
  color: var(--declaratif);
  background: var(--declaratif-bg);
}

/* Pastille « En attente » : orange de vigilance, comme la maquette. */
.card-hold {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 4px;
  margin: 0;
  padding: 1px 8px 1px 6px;
  border-radius: 999px;
  background: var(--vigilance-soft);
  color: var(--vigilance-fg);
  font-size: 0.6875rem;
  font-weight: 700;
}

.card-hold .ms {
  font-size: 14px;
}

.card-title {
  margin: 0;
}

.card-open {
  display: -webkit-box;
  width: 100%;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.35;
  text-align: left;
  color: var(--text-h);
  cursor: pointer;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.card-open:hover {
  color: var(--accent);
}

.card-open:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 2px;
}

.card-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

/* Demandeur sous le titre, comme la carte de la maquette. */
.card-requester {
  margin: -2px 0 0;
  overflow: hidden;
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--gris-600);
}

.card-schedule {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
  min-width: 0;
}

.card-date {
  font-size: 0.75rem;
  line-height: 1.3;
  white-space: nowrap;
  color: var(--text-muted);
}

.card-date time {
  color: var(--text);
}

.card-date.is-late,
.card-date.is-late time {
  color: var(--warning);
}

/* Retard en pastille : lisible d'un coup d'œil, sans faire passer la date sur deux lignes. */
.card-delay {
  padding: 0 6px;
  border-radius: 999px;
  background: var(--warning-bg);
  color: var(--warning);
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1.6;
  white-space: nowrap;
}

.card-nav {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
  margin-left: auto;
}

/* Discrètes au repos, affirmées au survol de la carte ou au clavier (toujours présentes). */
.card-nav button {
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.875rem;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color 0.15s,
    border-color 0.15s,
    color 0.15s;
}

.card:hover .card-nav button:not(:disabled),
.card:focus-within .card-nav button:not(:disabled) {
  border-color: var(--border);
  background: var(--surface-2);
  color: var(--text-h);
}

.card .card-nav button:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.card-nav button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.card-nav button:disabled {
  cursor: not-allowed;
  opacity: 0.3;
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
</style>
