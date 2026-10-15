<script setup lang="ts">
import type { PendingAnswer, Requirement } from '~/composables/useKanban'
import { addDays, nextWeekday, periodOf } from '~/domain/periods'
import { INTERLOCUTEURS_DS, MOTIFS_DECALAGE, PORTEURS_DECALAGE } from '~/domain/referentiels'
import { STAGE_RULES, getStage, isSessionEligible, type Dossier, type StageId } from '~/domain/workflow'

/**
 * Règles à satisfaire avant un déplacement (spec §6.2) : une section par règle, toutes
 * validées ensemble. Ex. : déposer une carte dans « Demande CSDA » d'une autre semaine
 * demande le motif du décalage du J0.8 et la confirmation de la demande de passage.
 */
const props = defineProps<{
  dossier: Dossier
  target: StageId
  requirements: Requirement[]
  /** J0.8 proposé par le déplacement (dépôt dans une autre semaine, saisie du drawer). */
  proposedDate?: string
  /** `YYYY-MM-DD` */
  today: string
}>()

const emit = defineEmits<{
  confirm: [answer: PendingAnswer]
  cancel: []
}>()

/** Titre de la modale quand une seule règle s'applique. */
const TITLES: Record<Requirement, string> = {
  j08: 'Jalon J0.8 requis',
  decalage: 'Décaler le J0.8',
  kickoff: 'Planifier le kick-off',
  cadrage: 'Cadrage technique et sécurité',
  j02: 'Jalon J0.2 requis',
  passage: 'Demander le passage en CSDA',
  revueDatm: 'Planifier la Revue DATM',
  j08Reel: 'J0.8 réel (date de séance)',
  cloture: 'Clôturer la DDS',
  sortie: 'Cadrage terminé',
  motif: 'Abandonner la DDS',
}

/** Intitulé et texte de chaque section ; les règles de statut reprennent `STAGE_RULES`. */
const SECTIONS: Record<Requirement, { title: string; text: string }> = {
  j08: {
    title: 'Jalon J0.8',
    text: 'Une DDS qui quitte « A pré-qualifier » doit avoir un J0.8 (fin d’instruction, CSDA visé).',
  },
  decalage: {
    title: 'Décalage du J0.8',
    text: 'Tout décalage est tracé avec un motif et son porteur. Le J0.8 initial est conservé.',
  },
  kickoff: { title: 'Kick-off planifié', text: STAGE_RULES.kickoff!.text },
  cadrage: { title: 'Cadrage', text: STAGE_RULES.cadrage!.text },
  j02: { title: 'Instruction', text: STAGE_RULES.instruction!.text },
  passage: {
    title: 'Demande de passage en CSDA',
    text: 'Le dossier entre dans la liste priorisée de la session. Sans action de votre part, il y reste jusqu’à son retrait.',
  },
  revueDatm: { title: 'Pré-DATM planifié', text: STAGE_RULES.preDatm!.text },
  j08Reel: { title: 'Validé CSDA', text: STAGE_RULES.valideCsda!.text },
  cloture: { title: 'En production', text: 'La DDS est clôturée et rejoint l’archive « Terminés ».' },
  sortie: {
    title: 'Sortie définitive',
    text: 'Le cadrage est terminé sans instruction. Si une instruction doit suivre, elle fera l’objet d’une nouvelle DDS.',
  },
  motif: { title: 'Abandon', text: 'Le motif est obligatoire et sera conservé dans l’historique.' },
}

const dialog = ref<HTMLDialogElement | null>(null)

const has = (requirement: Requirement) => props.requirements.includes(requirement)

const j08 = ref(props.proposedDate ?? '')
const decalageDate = ref(props.proposedDate ?? props.dossier.j08 ?? '')
const decalageMotif = ref('')
const decalagePorteur = ref('')
const decalageCommentaire = ref('')
const kickoffDate = ref(props.dossier.kickoff?.date ?? addDays(props.today, 7))
const interlocuteurDs = ref(props.dossier.kickoff?.interlocuteurDs ?? '')
const cadrageTechnique = ref<boolean | null>(props.dossier.cadrageTechnique)
const cadrageSecurite = ref<boolean | null>(props.dossier.cadrageSecurite)
const j02 = ref(props.dossier.j02 ?? '')
const j08Reel = ref(periodOf(props.today).start)
const motif = ref('')

/** J0.8 après le déplacement : celui saisi ici, sinon celui proposé, sinon l'actuel. */
const effectiveJ08 = computed<string | null>(() => {
  if (has('decalage')) return decalageDate.value || null
  if (has('j08')) return j08.value || null
  return props.proposedDate ?? props.dossier.j08
})

/** Revue DATM : le mardi précédant le CSDA du J0.8, ou à défaut le prochain mardi. */
function defaultRevueDatm(): string {
  const tuesday = effectiveJ08.value ? addDays(periodOf(effectiveJ08.value).start, -2) : ''
  return tuesday >= props.today ? tuesday : nextWeekday(props.today, 2)
}
const revueDatm = ref(defaultRevueDatm())

/** Demande de passage : le J0.8 (éventuellement modifié ici) doit rester en semaine S ou S+1. */
const notEligible = computed(() => has('passage') && !isSessionEligible(effectiveJ08.value, props.today))

const fromLabel = computed(() => getStage(props.dossier.stage).label)
const targetLabel = computed(() => getStage(props.target).label)
const stageChange = computed(() => props.target !== props.dossier.stage)

const title = computed(() =>
  props.requirements.length === 1 ? TITLES[props.requirements[0]!] : `Passage en « ${targetLabel.value} »`,
)

const submitLabel = computed(() => {
  if (has('motif')) return 'Abandonner la DDS'
  if (has('passage')) return 'Demander le passage'
  if (has('cloture')) return 'Clôturer la DDS'
  if (has('sortie')) return 'Confirmer la sortie'
  if (!stageChange.value) return 'Décaler le J0.8'
  return 'Valider et déplacer'
})

/** Réponse complète, ou `null` tant qu'une règle n'est pas satisfaite. */
const answer = computed<PendingAnswer | null>(() => {
  const result: PendingAnswer = {}
  if (notEligible.value) return null

  if (has('j08')) {
    if (!j08.value || j08.value < props.today) return null
    result.j08 = j08.value
  }
  if (has('decalage')) {
    const date = decalageDate.value
    if (!date || date < props.today || date === props.dossier.j08) return null
    if (!decalageMotif.value || !decalagePorteur.value) return null
    result.decalage = {
      date,
      motif: decalageMotif.value,
      porteur: decalagePorteur.value,
      commentaire: decalageCommentaire.value.trim(),
    }
  }
  if (has('kickoff')) {
    if (!kickoffDate.value || !interlocuteurDs.value.trim()) return null
    result.kickoff = { date: kickoffDate.value, interlocuteurDs: interlocuteurDs.value.trim() }
  }
  if (has('cadrage')) {
    if (cadrageTechnique.value === null || cadrageSecurite.value === null) return null
    result.cadrage = { technique: cadrageTechnique.value, securite: cadrageSecurite.value }
  }
  if (has('j02')) {
    if (!j02.value || (effectiveJ08.value !== null && j02.value > effectiveJ08.value)) return null
    result.j02 = j02.value
  }
  if (has('revueDatm')) {
    if (!revueDatm.value || revueDatm.value < props.today) return null
    result.revueDatm = revueDatm.value
  }
  if (has('j08Reel')) {
    if (!j08Reel.value || j08Reel.value > props.today) return null
    result.j08Reel = j08Reel.value
  }
  if (has('motif')) {
    if (!motif.value.trim()) return null
    result.motif = motif.value.trim()
  }
  return result
})

// showModal() : fond inerte, focus piégé dans la modale, Échap = événement `cancel`.
onMounted(() => dialog.value?.showModal())

function confirm() {
  if (!answer.value) return
  const value = answer.value
  dialog.value?.close()
  emit('confirm', value)
}

function cancel() {
  dialog.value?.close()
  emit('cancel')
}

/** Clic sur le fond : la cible est le <dialog> lui-même, le contenu étant dans le <form>. */
function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) cancel()
}
</script>

<template>
  <dialog
    ref="dialog"
    class="modal"
    aria-labelledby="pending-modal-title"
    aria-describedby="pending-modal-subject"
    @cancel.prevent="cancel"
    @click="onDialogClick"
  >
    <form class="modal-body" @submit.prevent="confirm">
      <header class="modal-header">
        <h2 id="pending-modal-title" class="modal-title">{{ title }}</h2>
        <p id="pending-modal-subject" class="modal-subject">
          <span class="modal-id">{{ dossier.id }}</span> {{ dossier.titre }}
        </p>
        <p v-if="stageChange" class="modal-transition">
          « {{ fromLabel }} » <span aria-hidden="true">→</span><span class="sr-only">vers</span> « {{ targetLabel }} »
        </p>
      </header>

      <section
        v-for="requirement in requirements"
        :key="requirement"
        class="modal-section"
        :class="{ 'is-danger': requirement === 'motif' }"
        :aria-labelledby="`rule-${requirement}`"
      >
        <h3 :id="`rule-${requirement}`" class="section-heading">
          <span class="chip">Règle</span>
          {{ SECTIONS[requirement].title }}
        </h3>
        <p class="section-text">{{ SECTIONS[requirement].text }}</p>

        <label v-if="requirement === 'j08'" class="field">
          <span>Jalon J0.8</span>
          <input v-model="j08" type="date" :min="today" required />
        </label>

        <template v-else-if="requirement === 'decalage'">
          <p class="section-facts">
            J0.8 actuel : <strong>{{ dossier.j08 ? formatDate(dossier.j08) : '—' }}</strong>
            <template v-if="dossier.j08Initial && dossier.j08Initial !== dossier.j08">
              · initial : <strong>{{ formatDate(dossier.j08Initial) }}</strong>
            </template>
          </p>
          <div class="field-row">
            <label class="field">
              <span>Nouvelle date</span>
              <input v-model="decalageDate" type="date" :min="today" required />
            </label>
            <label class="field">
              <span>Porteur</span>
              <select v-model="decalagePorteur" required>
                <option value="" disabled>Choisir…</option>
                <option v-for="porteur in PORTEURS_DECALAGE" :key="porteur" :value="porteur">{{ porteur }}</option>
              </select>
            </label>
          </div>
          <label class="field">
            <span>Motif</span>
            <select v-model="decalageMotif" required>
              <option value="" disabled>Choisir un motif…</option>
              <option v-for="item in MOTIFS_DECALAGE" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>
          <label class="field">
            <span>Commentaire <em>(facultatif)</em></span>
            <textarea v-model="decalageCommentaire" rows="2" />
          </label>
        </template>

        <div v-else-if="requirement === 'kickoff'" class="field-row">
          <label class="field">
            <span>Date du kick-off</span>
            <input v-model="kickoffDate" type="date" required />
          </label>
          <label class="field">
            <span>Interlocuteur DS</span>
            <input v-model="interlocuteurDs" type="text" list="interlocuteurs-ds" placeholder="Nom…" required />
            <datalist id="interlocuteurs-ds">
              <option v-for="name in INTERLOCUTEURS_DS" :key="name" :value="name" />
            </datalist>
          </label>
        </div>

        <div v-else-if="requirement === 'cadrage'" class="field-row">
          <fieldset class="choice-group">
            <legend>Cadrage technique</legend>
            <label class="choice"><input v-model="cadrageTechnique" type="radio" :value="true" /> Oui</label>
            <label class="choice"><input v-model="cadrageTechnique" type="radio" :value="false" /> Non</label>
          </fieldset>
          <fieldset class="choice-group">
            <legend>Cadrage sécurité</legend>
            <label class="choice"><input v-model="cadrageSecurite" type="radio" :value="true" /> Oui</label>
            <label class="choice"><input v-model="cadrageSecurite" type="radio" :value="false" /> Non</label>
          </fieldset>
        </div>

        <label v-else-if="requirement === 'j02'" class="field">
          <span>Jalon J0.2 (fin de cadrage)</span>
          <input v-model="j02" type="date" :max="effectiveJ08 ?? undefined" required />
          <small v-if="effectiveJ08" class="field-hint">Au plus tard le J0.8 ({{ formatDate(effectiveJ08) }}).</small>
        </label>

        <dl v-else-if="requirement === 'passage'" class="section-facts facts-list">
          <div>
            <dt>J0.8 (CSDA visé)</dt>
            <dd>{{ effectiveJ08 ? formatDate(effectiveJ08) : '—' }}</dd>
          </div>
          <div>
            <dt>Process</dt>
            <dd v-if="dossier.fas">FAS : CSDA déclaratif (consigné sans débat, Revue DATM optionnelle)</dd>
            <dd v-else>Standard : arbitrage DATM, Revue DATM puis CSDA</dd>
          </div>
          <p v-if="notEligible" class="field-error" role="alert">
            Pas encore éligible : le J0.8 doit tomber cette semaine ou la suivante.
          </p>
        </dl>

        <label v-else-if="requirement === 'revueDatm'" class="field">
          <span>Date de la Revue DATM</span>
          <input v-model="revueDatm" type="date" :min="today" required />
        </label>

        <label v-else-if="requirement === 'j08Reel'" class="field">
          <span>Date de séance du CSDA</span>
          <input v-model="j08Reel" type="date" :max="today" required />
        </label>

        <label v-else-if="requirement === 'motif'" class="field">
          <span>Motif d’abandon</span>
          <input v-model="motif" type="text" placeholder="Obligatoire…" required />
        </label>
      </section>

      <div class="modal-actions">
        <button type="button" class="btn" @click="cancel">Annuler</button>
        <button
          type="submit"
          class="btn"
          :class="has('motif') ? 'btn-danger' : 'btn-primary'"
          :disabled="!answer"
        >
          {{ submitLabel }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.modal {
  width: min(520px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  padding: 0;
  border: 1px solid var(--bordure);
  border-radius: 16px;
  background: var(--carte);
  color: var(--text);
  box-shadow: var(--ombre);
}

.modal::backdrop {
  background: rgba(14, 42, 92, 0.45);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 24px;
}

.modal-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.modal-title {
  margin: 0;
  font-family: var(--title);
  font-size: 1.125rem;
  color: var(--bleu-700);
}

.modal-subject {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-h);
}

.modal-id {
  font-family: var(--mono);
  font-size: 0.8125rem;
  font-weight: 400;
  color: var(--gris-600);
}

.modal-transition {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--gris-600);
}

/* Une règle = un encart, chip « Règle » comme les repères de la maquette. */
.modal-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--bordure);
  border-radius: 12px;
  background: var(--canvas);
}

.section-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-h);
}

.chip {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--bleu-100);
  color: var(--bleu-700);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.is-danger .chip {
  background: var(--alerte-soft);
  color: var(--alerte-fg);
}

.section-text {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.45;
}

.section-facts {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--gris-600);
}

.section-facts strong {
  color: var(--text-h);
}

.facts-list {
  display: grid;
  gap: 4px;
}

.facts-list div {
  display: grid;
  grid-template-columns: 130px 1fr;
  gap: 8px;
}

.facts-list dd {
  margin: 0;
  color: var(--text-h);
}

.field-error {
  margin: 4px 0 0;
  font-weight: 600;
  color: var(--alerte-fg);
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--gris-600);
}

.field em {
  font-weight: 400;
}

.field-hint {
  font-weight: 400;
}

.field input,
.field select,
.field textarea {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--gris-300);
  border-radius: 8px;
  background: var(--carte);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--encre);
  box-sizing: border-box;
}

.field textarea {
  padding: 8px 12px;
  resize: vertical;
}

.choice-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
}

.choice-group legend {
  margin-bottom: 4px;
  padding: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--gris-600);
}

.choice {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--gris-300);
  border-radius: 8px;
  background: var(--carte);
  font-size: 0.875rem;
  cursor: pointer;
}

.choice:has(input:checked) {
  border-color: var(--bleu-600);
  background: var(--bleu-100);
  color: var(--bleu-700);
}

.field input:focus-visible,
.field select:focus-visible,
.field textarea:focus-visible,
.btn:focus-visible {
  outline: none;
  border-color: var(--bleu-600);
  box-shadow: 0 0 0 3px var(--bleu-100);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Boutons de la maquette : secondaire bordé, primaire bleu, destructif rouge. */
.btn {
  padding: 8px 16px;
  border: 1.5px solid var(--bleu-600);
  border-radius: 8px;
  background: var(--carte);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--bleu-600);
  cursor: pointer;
}

.btn-primary {
  background: var(--bleu-600);
  color: #fff;
}

.btn-danger {
  border-color: var(--alerte);
  background: var(--alerte);
  color: #fff;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
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

@media (max-width: 520px) {
  .field-row {
    grid-template-columns: 1fr;
  }
}
</style>
