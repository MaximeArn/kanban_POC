/**
 * Vues de l'application, reprises de la navigation de la maquette « Usine de Pilotage »
 * (ordre du profil Coordination, qui les voit toutes). Seule la vue DDS est implémentée.
 */

export type ViewId =
  | 'dashboard'
  | 'dds'
  | 'ceda'
  | 'datm'
  | 'csda-prep'
  | 'csda'
  | 'cockpit'
  | 'commandes'
  | 'externalisation'
  | 'pdc'
  | 'referentiels'
  | 'habilitations'
  | 'reporting'

export interface NavItem {
  id: ViewId
  label: string
  /** Nom d'icône Material Symbols. */
  icon: string
  /** Mascotte affichée dans le bandeau (fichier de public/mascottes). */
  mascotte: string
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: 'home', mascotte: '02' },
  { id: 'dds', label: 'DDS', icon: 'assignment', mascotte: '06' },
  { id: 'ceda', label: 'CEDA', icon: 'groups', mascotte: '11' },
  { id: 'datm', label: 'Revue DATM', icon: 'fact_check', mascotte: '08' },
  { id: 'csda-prep', label: 'CSDA / fin de Cadrage', icon: 'event_upcoming', mascotte: '01' },
  { id: 'csda', label: 'CSDA', icon: 'gavel', mascotte: '19' },
  { id: 'cockpit', label: 'Cockpit', icon: 'work', mascotte: '04' },
  { id: 'commandes', label: 'Commandes CDS', icon: 'receipt_long', mascotte: '09' },
  { id: 'externalisation', label: 'Externalisation CDS', icon: 'swap_horiz', mascotte: '14' },
  { id: 'pdc', label: 'Plan de charge', icon: 'calendar_month', mascotte: '16' },
  { id: 'referentiels', label: 'Référentiels', icon: 'storage', mascotte: '17' },
  { id: 'habilitations', label: 'Habilitations', icon: 'lock', mascotte: '18' },
  { id: 'reporting', label: 'Reporting Domaine', icon: 'summarize', mascotte: '03' },
]

/** Vue ouverte au chargement, la seule implémentée pour l'instant. */
export const DEFAULT_VIEW: ViewId = 'dds'

export function getNavItem(id: ViewId): NavItem {
  return NAV_ITEMS.find((item) => item.id === id)!
}

/** Vue désignée par l'ancre de l'URL (`#/ceda`) ; vue par défaut si elle est absente ou inconnue. */
export function viewFromHash(hash: string): ViewId {
  const id = hash.replace(/^#\/?/, '')
  return NAV_ITEMS.some((item) => item.id === id) ? (id as ViewId) : DEFAULT_VIEW
}
