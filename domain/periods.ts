/**
 * Regroupement des dossiers par semaine de CSDA visé.
 *
 * Le comité se tient chaque semaine, le jeudi : une semaine va du jeudi (inclus)
 * au mercredi suivant. Un CSDA visé un jeudi tombe dans la semaine qui commence
 * ce jeudi-là.
 *
 * Seuls les dossiers dont le CSDA visé est aujourd'hui ou plus tard sont répartis
 * par semaine. Les autres sont « en retard » (non validés) ou « terminés » (validés).
 *
 * Module sans dépendance au workflow : calculs de dates purs, réutilisés par celui-ci.
 */

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

/** `YYYY-MM-DD` + n mois ; jour ramené à la fin du mois si besoin (31 mars − 1 mois = 28 ou 29 févr.). */
export function addMonths(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number]
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay))).toISOString().slice(0, 10)
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
 * Nouveau J0.8 quand une DDS change de semaine : elle garde son jour dans la semaine
 * (le jeudi du comité reste un jeudi), sans jamais tomber avant aujourd'hui. Sans J0.8
 * (DDS à pré-qualifier), on prend le premier jour de la semaine visée.
 */
export function shiftToPeriod(isoDate: string | null, targetPeriodKey: string, today: string): string {
  const offset = isoDate ? toDays(isoDate) - toDays(periodOf(isoDate).start) : 0
  const date = addDays(periodOf(targetPeriodKey).start, offset)
  return date < today ? today : date
}

/** Nombre de jours de `from` à `to` (négatif si `to` est avant). */
export function daysBetween(from: string, to: string): number {
  return toDays(to) - toDays(from)
}

/** Prochain jour de la semaine `weekday` (0 = dimanche, 2 = mardi…) à partir de `isoDate` inclus. */
export function nextWeekday(isoDate: string, weekday: number): string {
  const current = new Date(`${isoDate}T00:00:00Z`).getUTCDay()
  return addDays(isoDate, (weekday - current + 7) % 7)
}

/** Date du jour dans le fuseau du navigateur, `YYYY-MM-DD`. */
export function todayIso(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
