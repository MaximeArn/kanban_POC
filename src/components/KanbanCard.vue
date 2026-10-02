<script setup lang="ts">
import { computed } from 'vue'
import { TYPE_LABELS, availableMoves, type Dossier, type MoveOption, type StageId } from '../domain/workflow'
import { DND_MIME } from '../composables/useKanban'
import { daysLate, todayIso } from '../domain/periods'
import { formatDelay, formatShortDate, initials, personColorIndex } from '../utils/format'

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

const moves = computed(() => availableMoves(props.dossier))
const today = todayIso()
const delay = computed(() => daysLate(props.dossier, today))

/** Sur un dossier validé, revenir en arrière revient à l'invalider : on le dit. */
const previousLabel = computed(() =>
  props.dossier.stage === 'valide'
    ? `Invalider (retour en « ${moves.value.previous.label} »)`
    : `Étape précédente : ${moves.value.previous.label}`,
)

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
    <header class="card-header">
      <span class="card-id">{{ dossier.id }}</span>
      <span v-if="dossier.type" class="badge" :class="`badge-${dossier.type}`">
        {{ TYPE_LABELS[dossier.type] }}
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

    <footer class="card-footer">
      <span
        class="avatar"
        :style="{ '--person-color': `var(--person-${personColorIndex(dossier.architecte)})` }"
        :title="`AS : ${dossier.architecte}`"
        aria-hidden="true"
      >
        {{ initials(dossier.architecte) }}
      </span>
      <span class="sr-only">AS : {{ dossier.architecte }}.</span>

      <!-- Date et retard groupés : si la place manque, la pastille passe sous la date. -->
      <span class="card-schedule">
        <span
          class="card-date"
          :class="{ 'is-late': delay > 0 }"
          :title="delay > 0 ? `CSDA visé dépassé de ${delay} jour${delay > 1 ? 's' : ''}` : 'Date du CSDA visé'"
        >
          CSDA <time :datetime="dossier.dateCsdaVisee">{{ formatShortDate(dossier.dateCsdaVisee, today) }}</time>
        </span>
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
          :title="moves.next.allowed ? `Étape suivante : ${moves.next.label}` : moves.next.reason"
          :aria-label="
            moves.next.allowed
              ? `Étape suivante (${moves.next.label}) – ${dossier.id}`
              : `Étape suivante – ${dossier.id}`
          "
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
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  border-radius: 10px;
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

.card-id {
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.badge {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.badge-formel {
  color: var(--formel);
  background: var(--formel-bg);
}

.badge-declaratif {
  color: var(--declaratif);
  background: var(--declaratif-bg);
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

.avatar {
  display: inline-grid;
  place-items: center;
  flex: 0 0 24px;
  height: 24px;
  border-radius: 50%;
  /* Fond pâle et lettres colorées : repérable sans attirer l'œil. */
  background: color-mix(in srgb, var(--person-color, var(--accent)) 14%, var(--surface));
  color: var(--person-color, var(--accent));
  font-size: 0.6875rem;
  font-weight: 700;
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
