/**
 * Workflow des DDS (demandes de service) : statuts et règles de transition.
 *
 * Statuts repris de la maquette « Usine de Pilotage » ; règles de déplacement de notre POC
 * (une étape à la fois). C'est l'unique source de vérité sur « qui peut aller où » : l'UI
 * (drag and drop, boutons, mise en évidence des colonnes) ne fait qu'interroger ce module.
 */

import { daysBetween, periodOf, periodsBetween } from './periods'

export type StageId =
  | 'demande'
  | 'qualifie'
  | 'kickoff'
  | 'cadrage'
  | 'preinstruction'
  | 'instruction'
  | 'demandeCsda'
  | 'preDatm'
  | 'valideCsda'
  | 'production'
  | 'cadrageTermine'
  | 'abandonnee'

export interface Stage {
  id: StageId
  label: string
  /** Statut de sortie : pas de colonne, la DDS va dans l'archive « Terminés ». */
  exit?: boolean
}

/** Statuts du board, dans l'ordre : une colonne chacun. */
export const STAGES: readonly Stage[] = [
  { id: 'demande', label: 'A pré-qualifier' },
  { id: 'qualifie', label: 'Qualifié' },
  { id: 'kickoff', label: 'Kick-off planifié' },
  { id: 'cadrage', label: 'Cadrage' },
  { id: 'preinstruction', label: 'Pré-instruction' },
  { id: 'instruction', label: 'Instruction' },
  { id: 'demandeCsda', label: 'Demande CSDA' },
  { id: 'preDatm', label: 'Pré-DATM planifié' },
  { id: 'valideCsda', label: 'Validé CSDA' },
  { id: 'production', label: 'En production' },
]

/** Statuts de sortie, hors colonnes. */
export const EXIT_STAGES: readonly Stage[] = [
  { id: 'cadrageTermine', label: 'Cadrage terminé', exit: true },
  { id: 'abandonnee', label: 'Abandonnée', exit: true },
]

const ALL_STAGES: readonly Stage[] = [...STAGES, ...EXIT_STAGES]

/**
 * Phases du filtre « Phase » (spec F-DDS-17) : regroupent les statuts du Kanban.
 * Une phase masquée se replie en un bandeau vertical avec son compteur.
 */
export type PhaseId = 'qualification' | 'instruction' | 'validation' | 'sorties'

export interface Phase {
  id: PhaseId
  label: string
  stages: readonly StageId[]
}

export const PHASES: readonly Phase[] = [
  { id: 'qualification', label: 'Qualification', stages: ['demande', 'qualifie', 'kickoff'] },
  { id: 'instruction', label: 'Cadrage / Instruction', stages: ['cadrage', 'preinstruction', 'instruction'] },
  { id: 'validation', label: 'Validation', stages: ['demandeCsda', 'preDatm'] },
  { id: 'sorties', label: 'Sorties', stages: ['valideCsda', 'production', 'cadrageTermine', 'abandonnee'] },
]

export function phaseOf(stage: StageId): PhaseId {
  return PHASES.find((phase) => phase.stages.includes(stage))!.id
}

/** Statuts « validés » : un J0.8 passé ne les met pas en retard mais dans l'archive. */
export const VALIDATED_STAGES: readonly StageId[] = ['valideCsda', 'production']

/**
 * Règle (structurante, à satisfaire au dépôt) ou rappel (informatif) de chaque statut,
 * repris de la spécification (§6.2). Les règles ouvrent la modale de dépôt, les rappels
 * s'affichent après le déplacement.
 */
export interface StageRule {
  kind: 'regle' | 'rappel'
  text: string
}

export const STAGE_RULES: Partial<Record<StageId, StageRule>> = {
  qualifie: { kind: 'rappel', text: 'Vérifier qu’un référent est désigné.' },
  kickoff: { kind: 'regle', text: 'Planifier le rendez-vous de kick-off et désigner l’interlocuteur DS.' },
  cadrage: { kind: 'regle', text: 'Renseigner le cadrage technique et le cadrage sécurité.' },
  preinstruction: { kind: 'rappel', text: 'Vérifier si un cadrage (DA V0) est réellement nécessaire.' },
  instruction: { kind: 'regle', text: 'Le jalon J0.2 (fin de cadrage) doit être renseigné.' },
  demandeCsda: {
    kind: 'regle',
    text: 'Demande de passage explicite, à confirmer. J0.8 cette semaine ou la suivante, DDS hors attente.',
  },
  preDatm: {
    kind: 'regle',
    text: 'Planifier la Revue DA V1 / DATM (avis AT et sécurité). Normalement posé par l’arbitrage DATM (« Retenu »).',
  },
  valideCsda: {
    kind: 'regle',
    text: 'Renseigner le J0.8 réel (date de séance). Normalement posé par la décision en séance CSDA.',
  },
  production: { kind: 'regle', text: 'Clôture la DDS et l’archive.' },
}

export type TypeDds = 'DA V1' | 'DA V0' | 'Carto' | 'FAS'

export type MeteoStatut = 'Vert' | 'Orange' | 'Rouge'

export interface Meteo {
  statut: MeteoStatut
  commentaire: string
}

/** Mise en attente : motif obligatoire, cumulable avec tout statut jusqu'à la validation. */
export interface Attente {
  motif: string
  /** Horodatage ISO 8601. */
  depuis: string
}

export type Visibilite = '1 - Normal' | '2 - Important' | '3 - Stratégique'

export type PrioritePhase = 'Haute' | 'Normale' | 'Basse'

export type Externalisation = 'Aucune' | 'Cadrage' | 'Instruction' | 'Cadrage et instruction'

/** Ressource positionnée par chaque Partenaire sur la DDS (une par entité, spec F-DDS-14). */
export interface PartenairesPositionnes {
  datm: string | null
  mae: string | null
  ds: string | null
}

export interface KickOff {
  /** Date du rendez-vous, `YYYY-MM-DD`. */
  date: string
  interlocuteurDs: string
}

/**
 * Événement daté de la DDS. Union discriminée par `kind` : on pourra y ajouter
 * d'autres événements (commentaire, changement de référent…) sans casser l'existant.
 */
export type HistoryEvent =
  | { kind: 'stage'; at: string; from: StageId | null; to: StageId; motif?: string }
  /** Pose (`from` vide) ou décalage du jalon J0.8 (dates `YYYY-MM-DD`). Un décalage a un motif. */
  | {
      kind: 'date'
      at: string
      from: string | null
      to: string
      motif?: string
      porteur?: string
      commentaire?: string
    }
  | { kind: 'fas'; at: string; fas: boolean }
  | { kind: 'attente'; at: string; enAttente: boolean; motif?: string }
  /** Information saisie au titre d'une règle (kick-off planifié, J0.2 renseigné…). */
  | { kind: 'note'; at: string; label: string; detail?: string }

/** DDS : modèle de la maquette « Usine de Pilotage », champs utiles au board. */
export interface Dossier {
  /** N° DDS, ex. « DDS-2026-0060 ». */
  id: string
  titre: string
  cercle: string
  domaine: string
  typeDds: TypeDds
  offre: string
  demandeur: string
  direction: string
  /** Architecte solution référent (AS). */
  architecte: string
  dateSoumission: string
  /** Jalon J0.2 (fin de cadrage), `YYYY-MM-DD`. */
  j02: string | null
  /** Jalon J0.8 courant (fin d'instruction, CSDA visé), `YYYY-MM-DD`. Absent tant que la DDS est à pré-qualifier. */
  j08: string | null
  /** Premier J0.8 posé : jamais écrasé par les décalages (indicateurs, critère « Jalon dépassé »). */
  j08Initial: string | null
  /** J0.8 réel : date de la séance CSDA qui a validé la DDS. */
  j08Reel: string | null
  urgent: boolean
  motifUrgence: string | null
  /** Importance du dossier. */
  visibilite: Visibilite
  prioritePhase: PrioritePhase
  /** Service demandeur. */
  service: string
  /** Séquencement de construction (PRT Palier 1 à 3). */
  palier: string
  modeAgile: boolean
  externalisation: Externalisation
  /** Architectes contributeurs, en plus du référent. */
  contributeurs: string[]
  partenaires: PartenairesPositionnes
  meteo: Meteo | null
  /** Tag FAS (fiche d'architecture simplifiée) : passage en CSDA déclaratif. */
  fas: boolean
  kickoff: KickOff | null
  cadrageTechnique: boolean | null
  cadrageSecurite: boolean | null
  /** Date de la Revue DA V1 / DATM, `YYYY-MM-DD`. */
  revueDatm: string | null
  attente: Attente | null
  stage: StageId
  /** Statut avant abandon, pour pouvoir réactiver la DDS. */
  statutAvantAbandon: StageId | null
  motifAbandon: string | null
  /** Événements horodatés (ISO 8601), du plus ancien au plus récent. */
  historique: HistoryEvent[]
}

function indexOf(stage: StageId): number {
  return STAGES.findIndex((s) => s.id === stage)
}

export function getStage(stage: StageId): Stage {
  return ALL_STAGES.find((s) => s.id === stage)!
}

export function isExit(stage: StageId): boolean {
  return Boolean(getStage(stage).exit)
}

/** Mise en attente possible jusqu'à la validation de la DDS (Qualification à Validation). */
export function canHold(stage: StageId): boolean {
  return !isExit(stage) && !VALIDATED_STAGES.includes(stage)
}

/** Tag FAS modifiable jusqu'au kick-off inclus, figé ensuite (correction par la Coordination). */
export function canEditFas(stage: StageId): boolean {
  return stage === 'demande' || stage === 'qualifie' || stage === 'kickoff'
}

/**
 * Éligibilité à une session CSDA : J0.8 cette semaine ou la suivante (S ou S+1).
 * Pas de borne basse : un J0.8 dépassé reste éligible.
 */
export function isSessionEligible(j08: string | null, today: string): boolean {
  return j08 !== null && periodsBetween(periodOf(today).key, periodOf(j08).key) <= 1
}

/**
 * Nombre de jours de retard : J0.8 dépassé (au jour près) sans que la DDS soit validée
 * ni sortie. 0 sinon ; un J0.8 aujourd'hui n'est pas en retard, ni une DDS sans J0.8.
 */
export function daysLate(dossier: Pick<Dossier, 'j08' | 'stage'>, today: string): number {
  if (!dossier.j08 || VALIDATED_STAGES.includes(dossier.stage) || isExit(dossier.stage)) return 0
  return Math.max(0, daysBetween(dossier.j08, today))
}

/** Statut suivant dans l'ordre du board, ou `null` en fin de parcours (ou depuis une sortie). */
export function nextStage(stage: StageId): StageId | null {
  if (isExit(stage)) return null
  return STAGES[indexOf(stage) + 1]?.id ?? null
}

/**
 * Statut précédent : celui du board, ou pour un abandon, le statut d'où l'on revient.
 * « Cadrage terminé » est une sortie définitive : une suite donne lieu à une nouvelle DDS.
 */
export function previousStage(dossier: Pick<Dossier, 'stage' | 'statutAvantAbandon'>): StageId | null {
  if (dossier.stage === 'abandonnee') return dossier.statutAvantAbandon ?? 'demande'
  if (dossier.stage === 'cadrageTermine') return null
  return STAGES[indexOf(dossier.stage) - 1]?.id ?? null
}

/**
 * Statuts atteignables : un pas en avant ou en arrière, plus les sorties
 * (abandon depuis tout statut du board, cadrage terminé depuis « Cadrage »).
 */
export function reachableStages(dossier: Pick<Dossier, 'stage' | 'statutAvantAbandon'>): StageId[] {
  const next = nextStage(dossier.stage)
  const previous = previousStage(dossier)
  const exits: StageId[] = isExit(dossier.stage)
    ? []
    : ['abandonnee', ...(dossier.stage === 'cadrage' ? (['cadrageTermine'] as const) : [])]

  return [...(next ? [next] : []), ...(previous ? [previous] : []), ...exits]
}

/** Avancer dans le workflow ; une sortie compte comme une avancée. */
export function isForward(from: StageId, to: StageId): boolean {
  if (isExit(to)) return true
  if (isExit(from)) return false
  return indexOf(to) > indexOf(from)
}

/** Statuts du board strictement compris entre `from` et `to` (vide si l'un est une sortie). */
export function stagesBetween(from: StageId, to: StageId): Stage[] {
  if (isExit(from) || isExit(to)) return []
  const [start, end] = [indexOf(from), indexOf(to)].sort((a, b) => a - b) as [number, number]
  return STAGES.slice(start + 1, end)
}

/** Position 1-based du statut dans le board ; une sortie est en fin de parcours. */
export function stagePosition(stage: StageId): number {
  return isExit(stage) ? STAGES.length : indexOf(stage) + 1
}

/**
 * Information ou confirmation à obtenir avant que le déplacement soit appliqué :
 * - `j08`       : poser le J0.8 pour sortir de « A pré-qualifier »
 * - `kickoff`   : date du kick-off et interlocuteur DS
 * - `cadrage`   : cadrage technique et cadrage sécurité
 * - `j02`       : J0.2 pour entrer en Instruction
 * - `passage`   : confirmer la demande de passage en CSDA
 * - `revueDatm` : date de la Revue DA V1 / DATM
 * - `j08Reel`   : date de la séance CSDA
 * - `cloture`   : confirmer la clôture (En production)
 * - `sortie`    : confirmer la sortie définitive (Cadrage terminé)
 * - `motif`     : motif d'abandon
 */
export type MoveRequirement =
  | 'j08'
  | 'kickoff'
  | 'cadrage'
  | 'j02'
  | 'passage'
  | 'revueDatm'
  | 'j08Reel'
  | 'cloture'
  | 'sortie'
  | 'motif'

export type MoveCheck =
  | { allowed: true; requires: MoveRequirement[] }
  | { allowed: false; reason: string }

/**
 * Règle centrale : la DDS peut-elle aller dans `target` ? (`today` : `YYYY-MM-DD`)
 * `requires` liste les règles du statut visé à satisfaire avant d'appliquer le
 * déplacement. Les règles ne s'appliquent qu'en avançant : revenir à un statut déjà
 * franchi ne redemande rien.
 */
export function canMoveTo(dossier: Dossier, target: StageId, today: string): MoveCheck {
  if (dossier.stage === target) {
    return { allowed: false, reason: 'La DDS est déjà à ce statut.' }
  }

  if (!reachableStages(dossier).includes(target)) {
    const from = getStage(dossier.stage).label
    const to = getStage(target).label
    return {
      allowed: false,
      reason: `Transition interdite : « ${from} » → « ${to} ». Une DDS avance ou recule d'un seul statut à la fois.`,
    }
  }

  const forward = isForward(dossier.stage, target)

  if (forward && dossier.attente && (target === 'demandeCsda' || target === 'valideCsda')) {
    return { allowed: false, reason: 'DDS en attente : levez l’attente avant de poursuivre vers le CSDA.' }
  }
  if (forward && target === 'demandeCsda' && !isSessionEligible(dossier.j08, today)) {
    return {
      allowed: false,
      reason: 'Pas encore éligible au CSDA : le J0.8 doit tomber cette semaine ou la suivante.',
    }
  }

  const requires: MoveRequirement[] = []
  if (target === 'abandonnee') {
    requires.push('motif')
  } else if (forward) {
    if (dossier.stage === 'demande' && dossier.j08 === null) requires.push('j08')
    if (target === 'kickoff' && !dossier.kickoff) requires.push('kickoff')
    if (target === 'cadrage' && (dossier.cadrageTechnique === null || dossier.cadrageSecurite === null)) {
      requires.push('cadrage')
    }
    if (target === 'instruction' && !dossier.j02) requires.push('j02')
    if (target === 'demandeCsda') requires.push('passage')
    if (target === 'preDatm' && !dossier.revueDatm) requires.push('revueDatm')
    if (target === 'valideCsda' && !dossier.j08Reel) requires.push('j08Reel')
    if (target === 'production') requires.push('cloture')
    if (target === 'cadrageTermine') requires.push('sortie')
  }

  return { allowed: true, requires }
}

export interface MoveOption {
  /** `null` quand il n'existe aucun statut dans ce sens. */
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
  /** Transitions autorisées hors précédent / suivant (abandon, cadrage terminé). */
  shortcuts: ShortcutOption[]
}

function describeMove(dossier: Dossier, target: StageId | null, today: string): MoveOption {
  if (target === null) {
    const reason =
      dossier.stage === 'cadrageTermine'
        ? 'Sortie définitive : une suite donne lieu à une nouvelle DDS.'
        : 'Aucun statut dans ce sens.'
    return { target, label: '', allowed: false, reason }
  }
  const check = canMoveTo(dossier, target, today)
  return {
    target,
    label: getStage(target).label,
    allowed: check.allowed,
    reason: 'reason' in check ? check.reason : '',
  }
}

/** Actions de déplacement à proposer pour une DDS (boutons de la carte et du drawer). */
export function availableMoves(dossier: Dossier, today: string): AvailableMoves {
  const previous = describeMove(dossier, previousStage(dossier), today)
  const next = describeMove(dossier, nextStage(dossier.stage), today)
  const shortcuts = reachableStages(dossier)
    .filter((s) => s !== previous.target && s !== next.target)
    .map((s) => ({ target: s, label: getStage(s).label, forward: isForward(dossier.stage, s) }))

  return { previous, next, shortcuts }
}
