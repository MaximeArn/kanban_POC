/**
 * Regroupement des dossiers par semaine de CSDA visé.
 *
 * Le comité se tient chaque semaine, le jeudi : une semaine va du jeudi (inclus)
 * au mercredi suivant. Un CSDA visé un jeudi tombe dans la semaine qui commence
 * ce jeudi-là.
 *
 * Seuls les dossiers dont le CSDA visé est aujourd'hui ou plus tard sont répartis
 * par semaine. Les autres sont « en retard » (non validés) ou « terminés » (validés).
 */

import type { Dossier } from './workflow'

/** Un jeudi quelconque : fixe le jour de début des semaines. */
export const PERIOD_ANCHOR = '2026-01-01'

export const PERIOD_LENGTH_DAYS = 7

const DAY_MS = 86_400_000

export interface Period {
  /** Identifiant stable : date de début. */
  key: string
  /** Premier jour (jeudi), `YYYY-MM-DD`. */
  start: string
  /** Dernier jour inclus (mercredi), `YYYY-MM-DD`. */
  end: string
}

export type PeriodStatus = 'past' | 'current' | 'future'

/** Calculs en jours UTC : pas d'effet de fuseau ni de changement d'heure. */
function toDays(isoDate: string): number {
  return Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS)
}

function fromDays(days: number): string {
  return new Date(days * DAY_MS).toISOString().slice(0, 10)
}

export function periodOf(isoDate: string): Period {
  const anchor = toDays(PERIOD_ANCHOR)
  const index = Math.floor((toDays(isoDate) - anchor) / PERIOD_LENGTH_DAYS)
  const start = anchor + index * PERIOD_LENGTH_DAYS
  return { key: fromDays(start), start: fromDays(start), end: fromDays(start + PERIOD_LENGTH_DAYS - 1) }
}

/** `today` au format `YYYY-MM-DD` (les dates ISO se comparent comme des chaînes). */
export function periodStatus(period: Period, today: string): PeriodStatus {
  if (period.end < today) return 'past'
  if (period.start > today) return 'future'
  return 'current'
}

/** `YYYY-MM-DD` + n jours. */
export function addDays(isoDate: string, days: number): string {
  return fromDays(toDays(isoDate) + days)
}

/** Nombre de semaines entre deux clés de semaine (positif si `to` est après `from`). */
export function periodsBetween(fromKey: string, toKey: string): number {
  return Math.round((toDays(toKey) - toDays(fromKey)) / PERIOD_LENGTH_DAYS)
}

/** Semaine suivante (`offset` = 1) ou précédente (-1) d'une semaine donnée par sa clé. */
export function shiftPeriod(periodKey: string, offset: number): string {
  return addDays(periodKey, offset * PERIOD_LENGTH_DAYS)
}

/**
 * Nouvelle date de CSDA visé quand un dossier change de semaine : il garde son jour
 * dans la semaine (le jeudi du comité reste un jeudi), sans jamais tomber avant aujourd'hui.
 */
export function shiftToPeriod(isoDate: string, targetPeriodKey: string, today: string): string {
  const offset = toDays(isoDate) - toDays(periodOf(isoDate).start)
  const date = addDays(periodOf(targetPeriodKey).start, offset)
  return date < today ? today : date
}

/**
 * Nombre de jours de retard : CSDA visé dépassé (au jour près) sans que le dossier
 * soit validé. 0 si le dossier n'est pas en retard ; un CSDA visé aujourd'hui ne l'est pas.
 */
export function daysLate(dossier: Pick<Dossier, 'dateCsdaVisee' | 'stage'>, today: string): number {
  if (dossier.stage === 'valide') return 0
  return Math.max(0, toDays(today) - toDays(dossier.dateCsdaVisee))
}

/** Date du jour dans le fuseau du navigateur, `YYYY-MM-DD`. */
export function todayIso(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
