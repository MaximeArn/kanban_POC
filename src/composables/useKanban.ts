import { computed, reactive, ref } from 'vue'
import { DOSSIERS_MOCK } from '../data/dossiers.mock'
import { periodOf, periodsBetween, shiftPeriod, shiftToPeriod, todayIso } from '../domain/periods'
import {
  STAGES,
  canMoveTo,
  getStage,
  type Dossier,
  type Stage,
  type StageId,
  type TypeDossier,
} from '../domain/workflow'
import { formatDate, formatDayRange } from '../utils/format'

/** Type MIME dédié : évite qu'une carte lâchée dans un champ texte y colle son identifiant. */
export const DND_MIME = 'application/x-dossier-id'

export type MoveResult = 'moved' | 'pending' | 'refused'

/**
 * État d'une zone de dépôt (cellule étape × ligne, ou en-tête de ligne) pendant un glisser :
 * - `source`    : zone d'origine de la carte glissée
 * - `allowed`   : la carte peut y être déposée
 * - `forbidden` : transition d'étape interdite
 * - `inactive`  : ligne où l'on ne peut pas planifier (« En retard », « Terminés »)
 * - `null`      : aucun glisser en cours
 */
export type DropState = 'source' | 'allowed' | 'forbidden' | 'inactive' | null

/**
 * Lignes du board, dans cet ordre :
 * - `late`     : CSDA visé dépassé, dossier non validé (à traiter en priorité)
 * - `current`  : semaine en cours, d'aujourd'hui à sa fin
 * - `upcoming` : semaines suivantes
 * - `done`     : CSDA visé dépassé, dossier validé
 */
export type LaneKind = 'late' | 'current' | 'upcoming' | 'done'

export interface Lane {
  /** `late`, `done`, ou date de début de la semaine. */
  key: string
  kind: LaneKind
  /** « En retard », « CSDA de cette semaine », « CSDA dans une semaine », « CSDA dans 2 semaines »… */
  label: string
  /** Plage de dates de la semaine (« 1 → 7 oct. »), vide pour « En retard » et « Terminés ». */
  dates: string
  count: number
  /** Tous les dossiers de la ligne, triés par date de CSDA visé (archive « Terminés »). */
  dossiers: Dossier[]
  cells: { stage: Stage; dossiers: Dossier[] }[]
}

export const LATE_LANE = 'late'
export const DONE_LANE = 'done'

const LANE_RANK: Record<LaneKind, number> = { late: 0, current: 1, upcoming: 1, done: 2 }

function byCsdaDate(a: Dossier, b: Dossier): number {
  return a.dateCsdaVisee.localeCompare(b.dateCsdaVisee) || a.id.localeCompare(b.id)
}

export interface PendingMove {
  dossierId: string
  target: StageId
  /** Replanification à appliquer avec le changement d'étape, une fois le type choisi. */
  date?: string
}

/** Minuscules et sans accents, pour une recherche tolérante. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

export function useKanban() {
  const dossiers = ref<Dossier[]>(
    DOSSIERS_MOCK.map((d) => ({ ...d, historique: [...d.historique] })),
  )

  /** Dossier affiché dans le drawer de détail. */
  const selectedId = ref<string | null>(null)

  const filters = reactive({ architecte: '', search: '' })

  /** Figée au chargement : suffisant pour un POC (pas de bascule à minuit). */
  const today = todayIso()
  const currentLaneKey = periodOf(today).key

  /** Dossier en cours de glisser (l'API native ne permet pas de lire les données pendant `dragover`). */
  const draggedId = ref<string | null>(null)

  /** Déplacement vers CSDA en attente du choix de type. */
  const pendingMove = ref<PendingMove | null>(null)

  /** Dernier message d'état, restitué dans une zone `aria-live`. */
  const announcement = ref('')

  const architectes = computed(() =>
    [...new Set(dossiers.value.map((d) => d.architecte))].sort((a, b) => a.localeCompare(b, 'fr')),
  )

  const hasActiveFilters = computed(() => filters.architecte !== '' || filters.search.trim() !== '')

  const visibleDossiers = computed(() => {
    const query = normalize(filters.search)
    return dossiers.value
      .filter(
        (d) =>
          (filters.architecte === '' || d.architecte === filters.architecte) &&
          (query === '' || normalize(`${d.id} ${d.titre}`).includes(query)),
      )
      .sort(byCsdaDate)
  })

  /** En-têtes de colonnes : compteurs toutes lignes confondues. */
  const columns = computed(() =>
    STAGES.map((stage) => ({
      stage,
      count: visibleDossiers.value.filter((d) => d.stage === stage.id).length,
      total: dossiers.value.filter((d) => d.stage === stage.id).length,
    })),
  )

  /** Le retard se juge au jour près : un CSDA visé aujourd'hui reste dans la semaine en cours. */
  function laneKeyOf(dossier: Dossier): string {
    if (dossier.dateCsdaVisee < today) return dossier.stage === 'valide' ? DONE_LANE : LATE_LANE
    return periodOf(dossier.dateCsdaVisee).key
  }

  /** Seules les semaines (en cours et à venir) acceptent une nouvelle date. */
  function isPlanningLane(key: string): boolean {
    return key !== LATE_LANE && key !== DONE_LANE
  }

  /** Libellé relatif (« CSDA dans une semaine »), plus lisible que des dates ; les dates sont à part. */
  function describeLane(key: string): Pick<Lane, 'kind' | 'label' | 'dates'> {
    if (key === LATE_LANE) return { kind: 'late', label: 'En retard', dates: '' }
    if (key === DONE_LANE) return { kind: 'done', label: 'Terminés', dates: '' }

    const period = periodOf(key)
    const weeks = periodsBetween(currentLaneKey, key)
    if (weeks === 0) {
      return { kind: 'current', label: 'CSDA de cette semaine', dates: formatDayRange(today, period.end, today) }
    }
    return {
      kind: 'upcoming',
      label: weeks === 1 ? 'CSDA dans une semaine' : `CSDA dans ${weeks} semaines`,
      dates: formatDayRange(period.start, period.end, today),
    }
  }

  /** De la semaine en cours à `last` inclus. */
  function periodKeysUntil(last: string): string[] {
    const keys: string[] = []
    for (let key = currentLaneKey; key <= last; key = shiftPeriod(key, 1)) keys.push(key)
    return keys
  }

  /**
   * Lignes : « En retard » et « Terminés » si non vides, et toutes les semaines de celle
   * en cours à la dernière occupée, plus une libre : on peut y déposer un dossier.
   */
  const lanes = computed<Lane[]>(() => {
    const groups = new Map<string, Dossier[]>()
    for (const dossier of visibleDossiers.value) {
      const key = laneKeyOf(dossier)
      const group = groups.get(key)
      if (group) group.push(dossier)
      else groups.set(key, [dossier])
    }

    const lastOccupied = [...groups.keys()].filter(isPlanningLane).sort().at(-1) ?? currentLaneKey
    const keys = new Set([...groups.keys(), ...periodKeysUntil(shiftPeriod(lastOccupied, 1))])

    return [...keys]
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

  /**
   * État de dépôt d'une cellule. Sans `laneKey` (en-têtes de colonnes), on se place
   * dans la ligne du dossier glissé.
   */
  function dropStateFor(stage: StageId, laneKey?: string): DropState {
    const dossier = draggedDossier.value
    if (!dossier) return null
    const sourceLane = laneKeyOf(dossier)
    const lane = laneKey ?? sourceLane
    const sameLane = lane === sourceLane
    if (!sameLane && !isPlanningLane(lane)) return 'inactive'
    if (dossier.stage === stage) return sameLane ? 'source' : 'allowed'
    return canMoveTo(dossier, stage).allowed ? 'allowed' : 'forbidden'
  }

  /** État de dépôt d'un en-tête de ligne : y déposer replanifie sans changer d'étape. */
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
   * changement d'étape (`target`) et/ou replanification (`date`, `YYYY-MM-DD`).
   */
  function moveDossier(id: string, target: StageId, date?: string): MoveResult {
    const dossier = findDossier(id)
    if (!dossier) return 'refused'

    const stageChange = target !== dossier.stage
    const dateChange = date !== undefined && date !== dossier.dateCsdaVisee
    if (!stageChange && !dateChange) return 'refused'

    if (date !== undefined && date < today) {
      announcement.value = `${dossier.id} : le CSDA visé ne peut pas être planifié dans le passé.`
      return 'refused'
    }

    if (stageChange) {
      const check = canMoveTo(dossier, target)
      if (!check.allowed) {
        announcement.value = `${dossier.id} : ${check.reason}`
        return 'refused'
      }
      if (check.requiresType) {
        pendingMove.value = { dossierId: id, target, date }
        return 'pending'
      }
    }

    const at = new Date().toISOString()
    const laneBefore = laneKeyOf(dossier)
    const changes: string[] = []

    if (dateChange) {
      dossier.historique.push({ kind: 'date', at, from: dossier.dateCsdaVisee, to: date })
      dossier.dateCsdaVisee = date
      changes.push(`replanifié au ${formatDate(date)}`)
    }
    if (stageChange) {
      dossier.historique.push({ kind: 'stage', at, from: dossier.stage, to: target })
      dossier.stage = target
      changes.push(`déplacé vers « ${getStage(target).label} »`)
    }

    // Valider un dossier en retard, le replanifier, etc. le fait changer de ligne.
    const laneAfter = laneKeyOf(dossier)
    const laneChange = laneAfter === laneBefore ? '' : ` Il passe dans « ${describeLane(laneAfter).label} ».`
    announcement.value = `${dossier.id} ${changes.join(' et ')}.${laneChange}`
    return 'moved'
  }

  /** Dépôt d'une carte dans une ligne (et une étape, si déposée dans une cellule). */
  function dropDossier(id: string, laneKey: string, stage?: StageId): MoveResult {
    const dossier = findDossier(id)
    if (!dossier) return 'refused'
    if (laneKey === laneKeyOf(dossier)) return moveDossier(id, stage ?? dossier.stage)
    if (!isPlanningLane(laneKey)) return 'refused'
    return moveDossier(id, stage ?? dossier.stage, shiftToPeriod(dossier.dateCsdaVisee, laneKey, today))
  }

  /** Replanification seule (drawer) : nouvelle date de CSDA visé, `YYYY-MM-DD`. */
  function rescheduleDossier(id: string, date: string): MoveResult {
    const dossier = findDossier(id)
    if (!dossier) return 'refused'
    return moveDossier(id, dossier.stage, date)
  }

  function confirmPendingMove(type: TypeDossier): MoveResult {
    const pending = pendingMove.value
    const dossier = pendingDossier.value
    pendingMove.value = null
    if (!pending || !dossier) return 'refused'

    dossier.type = type
    dossier.historique.push({ kind: 'type', at: new Date().toISOString(), type })
    return moveDossier(pending.dossierId, pending.target, pending.date)
  }

  function cancelPendingMove(): void {
    const dossier = pendingDossier.value
    pendingMove.value = null
    if (dossier) announcement.value = `Déplacement de ${dossier.id} annulé : type de dossier non renseigné.`
  }

  function resetFilters(): void {
    filters.architecte = ''
    filters.search = ''
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
  }
}
