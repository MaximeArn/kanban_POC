/**
 * Workflow des dossiers d'architecture : étapes et règles de transition.
 *
 * C'est l'unique source de vérité sur « qui peut aller où ». L'UI (drag and
 * drop, boutons, mise en évidence des colonnes) ne fait qu'interroger ce module.
 */

export type StageId =
  | 'demande'
  | 'qualification'
  | 'ceda'
  | 'kickoff'
  | 'dav0'
  | 'dav1'
  | 'datm'
  | 'csda'
  | 'valide'

export interface Stage {
  id: StageId
  label: string
  /** Étape qui peut être sautée. */
  optional?: boolean
  /** Le dossier doit avoir un type (Formel / Déclaratif) pour entrer dans l'étape. */
  requiresType?: boolean
}

export const STAGES: readonly Stage[] = [
  { id: 'demande', label: 'DDS à traiter' },
  { id: 'qualification', label: 'Qualification CEDA' },
  { id: 'ceda', label: 'CEDA' },
  { id: 'kickoff', label: 'Kick-off' },
  { id: 'dav0', label: 'Instruction DAv0', optional: true },
  { id: 'dav1', label: 'Instruction DAv1' },
  { id: 'datm', label: 'Revue DATM' },
  { id: 'csda', label: 'CSDA', requiresType: true },
  { id: 'valide', label: 'Validé' },
]

export type TypeDossier = 'formel' | 'declaratif'

export const TYPE_LABELS: Record<TypeDossier, string> = {
  formel: 'Formel',
  declaratif: 'Déclaratif',
}

/**
 * Événement daté du dossier. Union discriminée par `kind` : on pourra y ajouter
 * d'autres événements (commentaire, changement d'AS…) sans casser l'existant.
 */
export type HistoryEvent =
  | { kind: 'stage'; at: string; from: StageId | null; to: StageId }
  | { kind: 'type'; at: string; type: TypeDossier }
  /** Replanification du CSDA visé (dates `YYYY-MM-DD`). */
  | { kind: 'date'; at: string; from: string; to: string }

export interface Dossier {
  id: string
  titre: string
  description: string
  /** Porteur du projet côté métier. */
  porteur: string
  /** Direction métier à l'origine de la demande. */
  direction: string
  /** Architecte solution (AS) affecté. */
  architecte: string
  /** Date du CSDA visé, au format ISO `YYYY-MM-DD`. */
  dateCsdaVisee: string
  type: TypeDossier | null
  stage: StageId
  /** Événements horodatés (ISO 8601), du plus ancien au plus récent. */
  historique: HistoryEvent[]
}

/**
 * Sauts autorisés en plus de l'étape suivante. Le retour est implicitement
 * autorisé : un dossier arrivé en DAv1 depuis Kick-off peut y revenir.
 */
const SKIPS: Partial<Record<StageId, StageId[]>> = {
  kickoff: ['dav1'],
}

function indexOf(stage: StageId): number {
  return STAGES.findIndex((s) => s.id === stage)
}

export function getStage(stage: StageId): Stage {
  return STAGES[indexOf(stage)]!
}

/** Étape suivante dans l'ordre du workflow (sans saut), ou `null` en fin de parcours. */
export function nextStage(stage: StageId): StageId | null {
  return STAGES[indexOf(stage) + 1]?.id ?? null
}

/** Étape précédente dans l'ordre du workflow, ou `null` en début de parcours. */
export function previousStage(stage: StageId): StageId | null {
  return STAGES[indexOf(stage) - 1]?.id ?? null
}

/** Toutes les étapes atteignables depuis `stage`, en avant comme en arrière. */
export function reachableStages(stage: StageId): StageId[] {
  const next = nextStage(stage)
  const previous = previousStage(stage)
  const forwardSkips = SKIPS[stage] ?? []
  const backwardSkips = STAGES.map((s) => s.id).filter((from) => SKIPS[from]?.includes(stage))

  return [
    ...(next ? [next] : []),
    ...forwardSkips,
    ...(previous ? [previous] : []),
    ...backwardSkips,
  ]
}

export function isForward(from: StageId, to: StageId): boolean {
  return indexOf(to) > indexOf(from)
}

/** Étapes strictement comprises entre `from` et `to` (ex. DAv0 entre Kick-off et DAv1). */
export function stagesBetween(from: StageId, to: StageId): Stage[] {
  const [start, end] = [indexOf(from), indexOf(to)].sort((a, b) => a - b) as [number, number]
  return STAGES.slice(start + 1, end)
}

/** Position 1-based de l'étape dans le workflow. */
export function stagePosition(stage: StageId): number {
  return indexOf(stage) + 1
}

export type MoveCheck =
  | { allowed: true; requiresType: boolean }
  | { allowed: false; reason: string }

/**
 * Règle centrale : le dossier peut-il aller dans `target` ?
 * `requiresType` signale que le déplacement est possible, mais qu'il faut
 * d'abord renseigner le type du dossier.
 */
export function canMoveTo(dossier: Dossier, target: StageId): MoveCheck {
  if (dossier.stage === target) {
    return { allowed: false, reason: 'Le dossier est déjà à cette étape.' }
  }

  if (!reachableStages(dossier.stage).includes(target)) {
    const from = getStage(dossier.stage).label
    const to = getStage(target).label
    return {
      allowed: false,
      reason: `Transition interdite : « ${from} » → « ${to} ». Un dossier avance ou recule d'une seule étape à la fois.`,
    }
  }

  return {
    allowed: true,
    requiresType: Boolean(getStage(target).requiresType) && dossier.type === null,
  }
}

export interface MoveOption {
  /** `null` quand il n'existe aucune étape dans ce sens. */
  target: StageId | null
  label: string
  allowed: boolean
  /** Motif du refus, vide si la transition est autorisée. */
  reason: string
}

export interface ShortcutOption {
  target: StageId
  label: string
  forward: boolean
}

export interface AvailableMoves {
  previous: MoveOption
  next: MoveOption
  /** Transitions autorisées hors précédente / suivante (ex. Kick-off → DAv1 sans DAv0). */
  shortcuts: ShortcutOption[]
}

function describeMove(dossier: Dossier, target: StageId | null): MoveOption {
  if (target === null) {
    return { target, label: '', allowed: false, reason: 'Aucune étape dans ce sens.' }
  }
  const check = canMoveTo(dossier, target)
  return {
    target,
    label: getStage(target).label,
    allowed: check.allowed,
    reason: 'reason' in check ? check.reason : '',
  }
}

/** Actions de déplacement à proposer pour un dossier (boutons de la carte et du drawer). */
export function availableMoves(dossier: Dossier): AvailableMoves {
  const previous = describeMove(dossier, previousStage(dossier.stage))
  const next = describeMove(dossier, nextStage(dossier.stage))
  const shortcuts = reachableStages(dossier.stage)
    .filter((s) => s !== previous.target && s !== next.target)
    .map((s) => ({ target: s, label: getStage(s).label, forward: isForward(dossier.stage, s) }))

  return { previous, next, shortcuts }
}
