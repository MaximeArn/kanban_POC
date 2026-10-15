import type { InjectionKey } from 'vue'

/** Services du drawer générique (UiDrawer) offerts à son contenu. */
export interface DrawerContext {
  /** Ramène le focus sur le titre du drawer (ex. quand le bouton actionné devient désactivé). */
  focusTitle: () => void
}

export const DRAWER_CONTEXT: InjectionKey<DrawerContext> = Symbol('ui-drawer')
