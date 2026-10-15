import { computed, reactive, ref } from 'vue'
import { DOSSIERS_MOCK } from '../data/dossiers.mock'
import { addMonths, periodOf, periodsBetween, shiftPeriod, shiftToPeriod } from '../domain/periods'
import { useToday } from './useToday'
import {
  PHASES,
  STAGES,
  STAGE_RULES,
  VALIDATED_STAGES,
  canEditFas,
  canHold,
  canMoveTo,
  getStage,
  isExit,
  isForward,
  type Dossier,
  type KickOff,
  type MoveRequirement,
  type Phase,
  type PhaseId,
  type Stage,
  type StageId,
} from '../domain/workflow'
import { formatDate, formatDayRange } from '../utils/format'

/** Type MIME dédié : évite qu'une carte lâchée dans un champ texte y colle son identifiant. */
export const DND_MIME = 'application/x-dossier-id'

export type MoveResult = 'moved' | 'pending' | 'refused'

/**
 * État d'une zone de dépôt (cellule statut × ligne, ou en-tête de ligne) pendant un glisser :
 * - `source`    : zone d'origine de la carte glissée
 * - `allowed`   : la carte peut y être déposée
 * - `forbidden` : transition de statut interdite
 * - `inactive`  : ligne où l'on ne peut pas planifier (« En retard », « Terminés »)
 * - `null`      : aucun glisser en cours
 */
export type DropState = 'source' | 'allowed' | 'forbidden' | 'inactive' | null

/**
 * Lignes du board, dans cet ordre :
 * - `late`     : J0.8 dépassé, DDS non validée (anomalie à traiter en priorité)
 * - `current`  : semaine en cours, d'aujourd'hui à sa fin ; accueille aussi, en
 *                « A pré-qualifier », les DDS sans J0.8
 * - `upcoming` : semaines suivantes
 * - `done`     : archive (cadrage terminé, abandonnée, validée au J0.8 passé)
 */
export type LaneKind = 'late' | 'current' | 'upcoming' | 'done'

export interface Lane {
  /** `late`, `done`, ou date de début de la semaine. */
  key: string
  kind: LaneKind
  /** « En retard », « CSDA de cette semaine », « CSDA dans une semaine »… */
  label: string
  /** Plage de dates de la semaine (« 1 → 7 oct. »), vide pour les autres lignes. */
  dates: string
  count: number
  /** Toutes les DDS de la ligne, triées par J0.8 (archive « Terminés »). */
  dossiers: Dossier[]
  cells: { stage: Stage; dossiers: Dossier[] }[]
}

export const LATE_LANE = 'late'
export const DONE_LANE = 'done'

const LANE_RANK: Record<LaneKind, number> = { late: 0, current: 1, upcoming: 1, done: 2 }

function byJ08(a: Dossier, b: Dossier): number {
  return (a.j08 ?? '9999').localeCompare(b.j08 ?? '9999') || a.id.localeCompare(b.id)
}

/**
 * Colonne du board : un statut, ou une phase masquée repliée en bandeau (filtre Phase).
 * `count` : DDS affichées (filtres appliqués) ; `total` : toutes les DDS du statut.
 */
export type ColumnSlot =
  | { kind: 'stage'; key: StageId; stage: Stage; count: number; total: number }
  | { kind: 'phase'; key: PhaseId; phase: Phase; count: number }

/** Filtres à bascule activés depuis les chiffres clés (spec F-DDS-03bis). */
export type ToggleFilter = 'urgentes' | 'plusDe3Mois' | 'enAttente'

/** Ce qu'il faut obtenir avant d'appliquer un déplacement : règle du statut visé, ou décalage du J0.8. */
export type Requirement = MoveRequirement | 'decalage'

/** Déplacement suspendu en attente des informations de la modale. */
export interface PendingMove {
  dossierId: string
  /** Statut visé ; égal au statut actuel pour un simple décalage du J0.8. */
  target: StageId
  requirements: Requirement[]
  /** Nouveau J0.8 proposé (dépôt dans une autre semaine, saisie dans le drawer). */
  date?: string
}

/** Décalage d'un J0.8 déjà posé : nouvelle date, motif, porteur et commentaire facultatif. */
export interface Decalage {
  date: string
  motif: string
  porteur: string
  commentaire: string
}

/** Informations saisies dans la modale : seules celles des `requirements` sont renseignées. */
export interface PendingAnswer {
  j08?: string
  kickoff?: KickOff
  cadrage?: { technique: boolean; securite: boolean }
  j02?: string
  revueDatm?: string
  j08Reel?: string
  /** Motif d'abandon. */
  motif?: string
  decalage?: Decalage
}

/** Rappel d'un statut (cf. `STAGE_RULES`), affiché après le déplacement. */
export interface Reminder {
  /** Identifiant unique : un même rappel répété relance l'affichage. */
  id: number
  dossierId: string
  stageLabel: string
  text: string
}

/** Minuscules et sans accents, pour une recherche tolérante. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

function ouiNon(value: boolean): string {
  return value ? 'Oui' : 'Non'
}

export function useKanban() {
  const dossiers = ref<Dossier[]>(
    DOSSIERS_MOCK.map((d) => ({ ...d, historique: [...d.historique] })),
  )

  /** DDS affichée dans le drawer de détail. */
  const selectedId = ref<string | null>(null)

  /**
   * `phases` : phases affichées ; vide = toutes (aucun filtre par défaut, spec F-DDS-17).
   * `toggles` : filtres à bascule des chiffres clés.
   */
  const filters = reactive({
    search: '',
    phases: [] as PhaseId[],
    toggles: [] as ToggleFilter[],
  })

  /** Date du jour réactive : passe à minuit (un J0.8 d'hier bascule alors « En retard »). */
  const today = useToday()
  const currentLaneKey = computed(() => periodOf(today.value).key)

  /** DDS en cours de glisser (l'API native ne permet pas de lire les données pendant `dragover`). */
  const draggedId = ref<string | null>(null)

  /** Déplacement suspendu en attente d'informations (règles du statut visé, motif de décalage…). */
  const pendingMove = ref<PendingMove | null>(null)

  /** Dernier message d'état, restitué dans une zone `aria-live`. */
  const announcement = ref('')

  /** Dernier rappel de statut, affiché en bandeau. */
  const reminder = ref<Reminder | null>(null)
  let reminderSeq = 0

  const hasActiveFilters = computed(
    () =>
      filters.search.trim() !== '' ||
      filters.phases.length > 0 ||
      filters.toggles.length > 0,
  )

  /** DDS en cours (ni validée ni sortie) soumise depuis plus de 3 mois : alerte du tableau de bord. */
  function isPlusDe3Mois(dossier: Dossier): boolean {
    return (
      !isExit(dossier.stage) &&
      !VALIDATED_STAGES.includes(dossier.stage) &&
      dossier.dateSoumission <= addMonths(today.value, -3)
    )
  }

  const TOGGLE_TESTS: Record<ToggleFilter, (dossier: Dossier) => boolean> = {
    urgentes: (d) => d.urgent,
    plusDe3Mois: isPlusDe3Mois,
    enAttente: (d) => d.attente !== null,
  }

  /**
   * Recherche : base des compteurs des filtres à bascule, qui restent ainsi stables.
   * Pas de filtre par architecte : le périmètre est celui du profil connecté.
   */
  const searchedDossiers = computed(() => {
    const query = normalize(filters.search)
    return dossiers.value.filter(
      (d) => query === '' || normalize(`${d.id} ${d.titre} ${d.domaine} ${d.demandeur}`).includes(query),
    )
  })

  /** Nombre de DDS de chaque filtre à bascule. */
  const toggleCounts = computed(() => {
    const counts = {} as Record<ToggleFilter, number>
    for (const [key, test] of Object.entries(TOGGLE_TESTS) as [ToggleFilter, (d: Dossier) => boolean][]) {
      counts[key] = searchedDossiers.value.filter(test).length
    }
    return counts
  })

  /** Filtres à bascule cumulés (ET) : « urgentes » + « en attente » = urgentes en attente. */
  const visibleDossiers = computed(() =>
    searchedDossiers.value
      .filter((d) => filters.toggles.every((toggle) => TOGGLE_TESTS[toggle](d)))
      .sort(byJ08),
  )

  function isPhaseShown(phase: PhaseId): boolean {
    return filters.phases.length === 0 || filters.phases.includes(phase)
  }

  /**
   * Colonnes : les statuts des phases affichées, et un bandeau par phase masquée, à sa
   * place dans le parcours. Sorties : Validé CSDA et En production (les autres sorties
   * sont dans l'archive « Terminés »).
   */
  const columns = computed<ColumnSlot[]>(() =>
    PHASES.flatMap((phase): ColumnSlot[] => {
      if (!isPhaseShown(phase.id)) {
        const count = visibleDossiers.value.filter((d) => phase.stages.includes(d.stage)).length
        return [{ kind: 'phase', key: phase.id, phase, count }]
      }
      return STAGES.filter((stage) => phase.stages.includes(stage.id)).map(
        (stage): ColumnSlot => ({
          kind: 'stage',
          key: stage.id,
          stage,
          count: visibleDossiers.value.filter((d) => d.stage === stage.id).length,
          total: dossiers.value.filter((d) => d.stage === stage.id).length,
        }),
      )
    }),
  )

  function togglePhase(phase: PhaseId): void {
    const shown = filters.phases.includes(phase)
      ? filters.phases.filter((p) => p !== phase)
      : [...filters.phases, phase]
    // Toutes les phases cochées = aucun filtre.
    filters.phases = shown.length === PHASES.length ? [] : shown
  }

  function toggleFilter(toggle: ToggleFilter): void {
    filters.toggles = filters.toggles.includes(toggle)
      ? filters.toggles.filter((t) => t !== toggle)
      : [...filters.toggles, toggle]
  }

  /**
   * Le retard se juge au jour près : un J0.8 aujourd'hui reste dans la semaine en cours.
   * Sans J0.8 (DDS à pré-qualifier), la DDS est rangée dans la semaine en cours. Une DDS
   * validée est rangée à sa date de séance (J0.8 réel) : elle rejoint l'archive le lendemain.
   */
  function laneKeyOf(dossier: Pick<Dossier, 'stage' | 'j08' | 'j08Reel'>): string {
    if (isExit(dossier.stage)) return DONE_LANE
    const validated = VALIDATED_STAGES.includes(dossier.stage)
    const date = validated ? (dossier.j08Reel ?? dossier.j08) : dossier.j08
    if (date === null) return currentLaneKey.value
    if (date < today.value) return validated ? DONE_LANE : LATE_LANE
    return periodOf(date).key
  }

  /** Seules les semaines (en cours et à venir) acceptent un nouveau J0.8. */
  function isPlanningLane(key: string): boolean {
    return key !== LATE_LANE && key !== DONE_LANE
  }

  /** Libellé relatif (« CSDA dans une semaine »), plus lisible que des dates ; les dates sont à part. */
  function describeLane(key: string): Pick<Lane, 'kind' | 'label' | 'dates'> {
    if (key === LATE_LANE) return { kind: 'late', label: 'En retard', dates: '' }
    if (key === DONE_LANE) return { kind: 'done', label: 'Terminés', dates: '' }

    const period = periodOf(key)
    const weeks = periodsBetween(currentLaneKey.value, key)
    if (weeks === 0) {
      return { kind: 'current', label: 'CSDA de cette semaine', dates: formatDayRange(today.value, period.end, today.value) }
    }
    return {
      kind: 'upcoming',
      label: weeks === 1 ? 'CSDA dans une semaine' : `CSDA dans ${weeks} semaines`,
      dates: formatDayRange(period.start, period.end, today.value),
    }
  }

  /** De la semaine en cours à `last` inclus. */
  function periodKeysUntil(last: string): string[] {
    const keys: string[] = []
    for (let key = currentLaneKey.value; key <= last; key = shiftPeriod(key, 1)) keys.push(key)
    return keys
  }

  /**
   * Lignes : « En retard » et « Terminés » si non vides, et toutes les semaines de celle
   * en cours à la dernière occupée, plus une libre pour y déposer.
   */
  const lanes = computed<Lane[]>(() => {
    const groups = new Map<string, Dossier[]>()
    for (const dossier of visibleDossiers.value) {
      const key = laneKeyOf(dossier)
      const group = groups.get(key)
      if (group) group.push(dossier)
      else groups.set(key, [dossier])
    }

    const lastOccupied = [...groups.keys()].filter(isPlanningLane).sort().at(-1) ?? currentLaneKey.value
    const keys = new Set([...groups.keys(), ...periodKeysUntil(shiftPeriod(lastOccupied, 1))])

    return [...keys]
      // La phase « Sorties » masquée replie aussi l'archive (son bandeau en donne le compte).
      .filter((key) => key !== DONE_LANE || isPhaseShown('sorties'))
      .map((key) => {
        const list = groups.get(key) ?? []
        return {
          key,
          ...describeLane(key),
          count: list.length,
          dossiers: list,
          cells: STAGES.map((stage) => ({ stage, dossiers: list.filter((d) => d.stage === stage.id) })),
        }
      })
      .sort((a, b) => LANE_RANK[a.kind] - LANE_RANK[b.kind] || a.key.localeCompare(b.key))
  })

  const draggedDossier = computed(() => findDossier(draggedId.value))

  /** J0.8 qu'aurait la DDS si on la déposait dans la ligne `laneKey` (inchangé dans sa ligne). */
  function j08ForLane(dossier: Dossier, laneKey: string): string | null {
    return laneKey === laneKeyOf(dossier) ? dossier.j08 : shiftToPeriod(dossier.j08, laneKey, today.value)
  }

  /**
   * État de dépôt d'une cellule. Sans `laneKey` (en-têtes de colonnes), on se place
   * dans la ligne de la DDS glissée.
   */
  function dropStateFor(stage: StageId, laneKey?: string): DropState {
    const dossier = draggedDossier.value
    if (!dossier) return null
    const sourceLane = laneKeyOf(dossier)
    const lane = laneKey ?? sourceLane
    const sameLane = lane === sourceLane
    if (!sameLane && !isPlanningLane(lane)) return 'inactive'
    if (dossier.stage === stage) return sameLane ? 'source' : 'allowed'
    // Dans une autre semaine, la DDS y prend son J0.8 : on juge la transition avec ce jalon.
    const check = canMoveTo({ ...dossier, j08: j08ForLane(dossier, lane) }, stage, today.value)
    return check.allowed ? 'allowed' : 'forbidden'
  }

  /** État de dépôt d'un en-tête de ligne : y déposer replanifie sans changer de statut. */
  function laneDropStateFor(laneKey: string): DropState {
    const dossier = draggedDossier.value
    if (!dossier) return null
    if (laneKey === laneKeyOf(dossier)) return 'source'
    return isPlanningLane(laneKey) ? 'allowed' : 'inactive'
  }

  const pendingDossier = computed(() => findDossier(pendingMove.value?.dossierId ?? null))

  const selectedDossier = computed(() => findDossier(selectedId.value))

  function findDossier(id: string | null): Dossier | undefined {
    return id === null ? undefined : dossiers.value.find((d) => d.id === id)
  }

  /**
   * Point d'entrée unique pour tout déplacement (drag and drop, boutons, drawer) :
   * changement de statut (`target`) et/ou pose / décalage du J0.8 (`date`, `YYYY-MM-DD`).
   * Si une règle du statut visé ou un décalage demande une information, le déplacement
   * est suspendu (`pendingMove`) jusqu'à la réponse de la modale.
   */
  function requestMove(id: string, target: StageId, date?: string): MoveResult {
    const dossier = findDossier(id)
    if (!dossier) return 'refused'

    const stageChange = target !== dossier.stage
    const dateChange = date !== undefined && date !== dossier.j08
    if (!stageChange && !dateChange) return 'refused'

    if (date !== undefined && date < today.value) {
      announcement.value = `${dossier.id} : le J0.8 ne peut pas être planifié dans le passé.`
      return 'refused'
    }

    const requirements: Requirement[] = []
    // Poser le J0.8 la première fois est libre ; le décaler demande un motif (le J0.8 initial est conservé).
    if (dateChange && dossier.j08 !== null) requirements.push('decalage')

    if (stageChange) {
      // La transition est jugée avec le J0.8 qui sera appliqué (ex. dépôt dans une autre semaine).
      const check = canMoveTo({ ...dossier, j08: date ?? dossier.j08 }, target, today.value)
      if (!check.allowed) {
        announcement.value = `${dossier.id} : ${check.reason}`
        return 'refused'
      }
      requirements.push(...check.requires)
    }

    if (requirements.length > 0) {
      pendingMove.value = { dossierId: id, target, requirements, ...(date !== undefined ? { date } : {}) }
      return 'pending'
    }
    return applyMove(dossier, target, date, {})
  }

  /** Applique un déplacement validé, avec les informations saisies au titre des règles. */
  function applyMove(dossier: Dossier, target: StageId, date: string | undefined, answer: PendingAnswer): MoveResult {
    const stageChange = target !== dossier.stage
    const dateChange = date !== undefined && date !== dossier.j08
    if (!stageChange && !dateChange) return 'refused'

    const at = new Date().toISOString()
    const laneBefore = laneKeyOf(dossier)
    const changes: string[] = []
    const note = (label: string, detail: string) => dossier.historique.push({ kind: 'note', at, label, detail })

    if (answer.kickoff) {
      dossier.kickoff = answer.kickoff
      note('Kick-off planifié', `${formatDate(answer.kickoff.date)} · interlocuteur DS : ${answer.kickoff.interlocuteurDs}`)
    }
    if (answer.cadrage) {
      dossier.cadrageTechnique = answer.cadrage.technique
      dossier.cadrageSecurite = answer.cadrage.securite
      note('Cadrage renseigné', `Technique : ${ouiNon(answer.cadrage.technique)} · sécurité : ${ouiNon(answer.cadrage.securite)}`)
    }
    if (answer.j02) {
      dossier.j02 = answer.j02
      note('J0.2 renseigné', formatDate(answer.j02))
    }
    if (answer.revueDatm) {
      dossier.revueDatm = answer.revueDatm
      note('Revue DATM planifiée', formatDate(answer.revueDatm))
    }
    if (answer.j08Reel) {
      dossier.j08Reel = answer.j08Reel
      note('J0.8 réel renseigné (date de séance)', formatDate(answer.j08Reel))
    }

    if (date !== undefined && dateChange) {
      const decalage = answer.decalage
      dossier.historique.push({
        kind: 'date',
        at,
        from: dossier.j08,
        to: date,
        ...(decalage ? { motif: decalage.motif, porteur: decalage.porteur } : {}),
        ...(decalage?.commentaire ? { commentaire: decalage.commentaire } : {}),
      })
      changes.push(`${dossier.j08 ? 'J0.8 décalé' : 'J0.8 posé'} au ${formatDate(date)}`)
      dossier.j08Initial ??= date
      dossier.j08 = date
    }

    const forward = stageChange && isForward(dossier.stage, target)
    if (stageChange) {
      const label = getStage(target).label
      dossier.historique.push({ kind: 'stage', at, from: dossier.stage, to: target, ...(answer.motif ? { motif: answer.motif } : {}) })
      if (target === 'abandonnee') {
        dossier.statutAvantAbandon = dossier.stage
        dossier.motifAbandon = answer.motif ?? null
      } else if (dossier.stage === 'abandonnee') {
        dossier.statutAvantAbandon = null
        dossier.motifAbandon = null
      }
      // Invalidée : la date de séance n'a plus cours.
      if (VALIDATED_STAGES.includes(dossier.stage) && !VALIDATED_STAGES.includes(target)) dossier.j08Reel = null
      // Plus de mise en attente après la validation ou une sortie : elle est levée.
      if (dossier.attente && !canHold(target)) {
        dossier.attente = null
        dossier.historique.push({ kind: 'attente', at, enAttente: false, motif: `Levée au passage en « ${label} »` })
      }
      dossier.stage = target
      changes.push(target === 'demandeCsda' && forward ? 'passage en CSDA demandé' : `déplacée vers « ${label} »`)
    }

    // Valider une DDS en retard, la décaler, l'abandonner… la fait changer de ligne.
    const laneAfter = laneKeyOf(dossier)
    const laneChange = laneAfter === laneBefore ? '' : ` Elle passe dans « ${describeLane(laneAfter).label} ».`
    const rule = forward ? STAGE_RULES[target] : undefined
    const rappel = rule?.kind === 'rappel' ? rule : undefined
    announcement.value = `${dossier.id} ${changes.join(' et ')}.${laneChange}${rappel ? ` Rappel : ${rappel.text}` : ''}`
    if (rappel) {
      reminder.value = { id: ++reminderSeq, dossierId: dossier.id, stageLabel: getStage(target).label, text: rappel.text }
    }
    return 'moved'
  }

  /** Changement de statut par bouton (carte, drawer). */
  function moveDossier(id: string, target: StageId): MoveResult {
    return requestMove(id, target)
  }

  /** Dépôt d'une carte dans une ligne (et un statut, si déposée dans une cellule). */
  function dropDossier(id: string, laneKey: string, stage?: StageId): MoveResult {
    const dossier = findDossier(id)
    if (!dossier) return 'refused'
    if (laneKey === laneKeyOf(dossier)) return requestMove(id, stage ?? dossier.stage)
    if (!isPlanningLane(laneKey)) return 'refused'
    return requestMove(id, stage ?? dossier.stage, j08ForLane(dossier, laneKey) ?? undefined)
  }

  /** Pose ou décalage du J0.8 depuis le drawer, `YYYY-MM-DD`. */
  function rescheduleDossier(id: string, date: string): MoveResult {
    const dossier = findDossier(id)
    if (!dossier) return 'refused'
    return requestMove(id, dossier.stage, date)
  }

  function confirmPendingMove(answer: PendingAnswer): MoveResult {
    const pending = pendingMove.value
    const dossier = pendingDossier.value
    pendingMove.value = null
    if (!pending || !dossier) return 'refused'

    const date = answer.decalage?.date ?? answer.j08 ?? pending.date
    if (date !== undefined && date < today.value) {
      announcement.value = `${dossier.id} : le J0.8 ne peut pas être planifié dans le passé.`
      return 'refused'
    }
    if (pending.target !== dossier.stage) {
      // La date a pu être modifiée dans la modale : la transition est revérifiée avec elle.
      const check = canMoveTo({ ...dossier, j08: date ?? dossier.j08 }, pending.target, today.value)
      if (!check.allowed) {
        announcement.value = `${dossier.id} : ${check.reason}`
        return 'refused'
      }
    }
    return applyMove(dossier, pending.target, date, answer)
  }

  function cancelPendingMove(): void {
    const pending = pendingMove.value
    const dossier = pendingDossier.value
    pendingMove.value = null
    if (pending && dossier) {
      announcement.value =
        pending.target === dossier.stage
          ? `Décalage du J0.8 de ${dossier.id} annulé.`
          : `Déplacement de ${dossier.id} annulé.`
    }
  }

  /** Mise en attente (`motif`) ou levée de l'attente (`null`). */
  function setAttente(id: string, motif: string | null): void {
    const dossier = findDossier(id)
    if (!dossier) return
    const at = new Date().toISOString()
    if (motif) {
      if (!canHold(dossier.stage) || dossier.attente) return
      dossier.attente = { motif, depuis: at }
      dossier.historique.push({ kind: 'attente', at, enAttente: true, motif })
      announcement.value = `${dossier.id} mise en attente : ${motif}.`
    } else if (dossier.attente) {
      dossier.attente = null
      dossier.historique.push({ kind: 'attente', at, enAttente: false })
      announcement.value = `${dossier.id} : attente levée.`
    }
  }

  /** Urgence : le motif est obligatoire pour la poser. */
  function setUrgence(id: string, urgent: boolean, motif: string | null): void {
    const dossier = findDossier(id)
    const motifSaisi = motif?.trim() ?? ''
    if (!dossier || dossier.urgent === urgent || (urgent && !motifSaisi)) return
    const at = new Date().toISOString()
    dossier.urgent = urgent
    dossier.motifUrgence = urgent ? motifSaisi : null
    dossier.historique.push(
      urgent
        ? { kind: 'note', at, label: 'DDS déclarée urgente', detail: `Motif : ${motifSaisi}` }
        : { kind: 'note', at, label: 'Urgence retirée' },
    )
    announcement.value = urgent ? `${dossier.id} déclarée urgente.` : `${dossier.id} : urgence retirée.`
  }

  /** Tag FAS : modifiable jusqu'au kick-off inclus. */
  function setFas(id: string, fas: boolean): void {
    const dossier = findDossier(id)
    if (!dossier || dossier.fas === fas || !canEditFas(dossier.stage)) return
    dossier.fas = fas
    dossier.historique.push({ kind: 'fas', at: new Date().toISOString(), fas })
    announcement.value = `${dossier.id} : tag FAS ${fas ? 'posé' : 'retiré'}.`
  }

  function dismissReminder(): void {
    reminder.value = null
  }

  function resetFilters(): void {
    filters.search = ''
    filters.phases = []
    filters.toggles = []
  }

  function openDossier(id: string): void {
    selectedId.value = id
  }

  function closeDossier(): void {
    selectedId.value = null
  }

  return {
    filters,
    today,
    currentLaneKey,
    hasActiveFilters,
    toggleCounts,
    isPhaseShown,
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
  }
}
