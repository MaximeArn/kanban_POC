const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const shortDateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Date calendaire `YYYY-MM-DD` → « 29 oct. 2026 » (sans décalage de fuseau). */
export function formatDate(isoDate: string): string {
  return dateFormat.format(new Date(isoDate))
}

const longDateFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** `YYYY-MM-DD` → « jeudi 1 octobre 2026 ». */
export function formatLongDate(isoDate: string): string {
  return longDateFormat.format(new Date(isoDate))
}

/** « 24 sept. » ; l'année n'est ajoutée que si elle diffère de celle de `today` (« 4 janv. 2027 »). */
export function formatShortDate(isoDate: string, today: string): string {
  return isoDate.slice(0, 4) === today.slice(0, 4)
    ? shortDateFormat.format(new Date(isoDate))
    : formatDate(isoDate)
}

/** « 1 → 7 oct. », « 29 oct. → 4 nov. », « 14 oct. » si un seul jour (année comme `formatShortDate`). */
export function formatDayRange(start: string, end: string, today: string): string {
  if (start === end) return formatShortDate(end, today)
  const from =
    start.slice(0, 7) === end.slice(0, 7) ? String(Number(start.slice(8))) : formatShortDate(start, today)
  return `${from} → ${formatShortDate(end, today)}`
}

/** « 3 j », « 2 sem. » : durée de retard compacte. */
export function formatDelay(days: number): string {
  return days < 14 ? `${days} j` : `${Math.floor(days / 7)} sem.`
}

/** Horodatage ISO 8601 → « 29 oct. 2026, 14:32 » dans le fuseau du navigateur. */
export function formatDateTime(isoDateTime: string): string {
  return dateTimeFormat.format(new Date(isoDateTime))
}

/** Nombre de couleurs `--person-N` définies dans style.css. */
const PERSON_COLORS = 6

/** Couleur stable d'une personne (0 à 5), dérivée de son nom. */
export function personColorIndex(name: string): number {
  return [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % PERSON_COLORS
}

/** « Claire Dubois » → « CD ». */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
