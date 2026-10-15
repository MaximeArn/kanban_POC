import type { Ref } from 'vue'
import { todayIso } from '~/domain/periods'

/**
 * Date du jour (`YYYY-MM-DD`) réactive et partagée par toute l'application.
 *
 * Elle change à minuit, et est revérifiée quand l'onglet redevient visible : un poste mis
 * en veille retarde les minuteurs. Sans cela, une page ouverte la veille ne verrait pas
 * qu'un J0.8 d'hier est désormais en retard.
 */
const today = ref(todayIso())
let started = false

function refresh(): void {
  const now = todayIso()
  if (now !== today.value) today.value = now
}

/** Programme la prochaine vérification juste après minuit (heure locale). */
function scheduleMidnight(): void {
  const now = new Date()
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1)
  setTimeout(() => {
    refresh()
    scheduleMidnight()
  }, nextMidnight.getTime() - now.getTime())
}

function start(): void {
  if (started || typeof window === 'undefined') return
  started = true
  scheduleMidnight()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh()
  })
  window.addEventListener('focus', refresh)
}

export function useToday(): Readonly<Ref<string>> {
  start()
  return readonly(today)
}
