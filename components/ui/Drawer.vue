<script setup lang="ts" generic="T extends object">
/**
 * Drawer générique : panneau fixe à droite, sur toute la hauteur, au-dessus de la page
 * (rien ne se décale dessous). Les drawers métier fournissent le contenu par slots :
 * - `meta`    : ligne au-dessus du titre (identifiant, badges…) ;
 * - `title`   : titre du drawer (nom accessible, focus à l'ouverture) ;
 * - `default` : corps, qui défile.
 *
 * Il s'ouvre quand `item` est renseigné et se referme quand il repasse à `null` ; les slots
 * reçoivent `item` non nul. Fermeture par ✕, Échap ou clic hors du panneau.
 */
const props = withDefaults(
  defineProps<{
    /** Objet affiché (DDS…) ; `null` = drawer fermé. */
    item: T | null
    /** Nom accessible du bouton de fermeture. */
    closeLabel?: string
    /** Clics extérieurs qui ne ferment pas le drawer (sélecteur CSS), ex. « .card, dialog ». */
    ignoreOutside?: string
    width?: string
  }>(),
  { closeLabel: 'Fermer', ignoreOutside: 'dialog', width: '600px' },
)

const emit = defineEmits<{
  /** `outside` : clic hors du drawer, le focus reste là où l'utilisateur a cliqué. */
  close: [outside: boolean]
}>()

defineSlots<{
  meta?: (props: { item: T }) => unknown
  title: (props: { item: T }) => unknown
  default: (props: { item: T }) => unknown
}>()

const titleId = useId()
const root = ref<HTMLElement | null>(null)
const titleEl = ref<HTMLElement | null>(null)

function focusTitle() {
  titleEl.value?.focus()
}

// Les sous-composants du contenu peuvent ramener le focus sur le titre (ex. bouton désactivé).
provide(DRAWER_CONTEXT, { focusTitle })

// Focus sur le titre à l'ouverture et à chaque changement d'objet affiché.
watch(
  () => props.item,
  async (item, previous) => {
    if (!item || item === previous) return
    await nextTick()
    focusTitle()
  },
  { immediate: true },
)

function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Element | null
  if (!props.item || !target || root.value?.contains(target)) return
  if (target.closest(props.ignoreOutside)) return
  emit('close', true)
}

onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown))
</script>

<template>
  <!-- À la fermeture, la transition garde le dernier contenu affiché le temps de l'animation. -->
  <Transition name="ui-drawer">
    <aside
      v-if="item"
      ref="root"
      class="ui-drawer"
      :style="{ '--drawer-width': width }"
      :aria-labelledby="titleId"
      @keydown.esc.stop="emit('close', false)"
    >
      <header class="ui-drawer-header">
        <div class="ui-drawer-meta">
          <slot name="meta" :item="item" />
        </div>
        <button type="button" class="ui-drawer-close" :aria-label="closeLabel" @click="emit('close', false)">
          ✕
        </button>
        <h2 :id="titleId" ref="titleEl" class="ui-drawer-title" tabindex="-1">
          <slot name="title" :item="item" />
        </h2>
      </header>

      <div class="ui-drawer-body">
        <slot :item="item" />
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.ui-drawer {
  position: fixed;
  z-index: 10;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  width: min(var(--drawer-width), 100vw);
  background: var(--surface);
  border-left: 1px solid var(--border);
  box-shadow: var(--shadow-md);
}

.ui-drawer-header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px 12px;
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--border);
}

.ui-drawer-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.ui-drawer-close {
  width: 32px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  color: var(--text);
  font-size: 1rem;
  cursor: pointer;
}

.ui-drawer-close:hover {
  border-color: var(--border);
  color: var(--text-h);
}

.ui-drawer-close:focus-visible,
.ui-drawer-title:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.ui-drawer-title {
  grid-column: 1 / -1;
  margin: 0;
  font-family: var(--title);
  font-size: 1.25rem;
  line-height: 1.3;
  color: var(--bleu-700);
}

.ui-drawer-title:focus-visible {
  border-radius: 2px;
}

.ui-drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 20px 24px;
}

.ui-drawer-enter-active,
.ui-drawer-leave-active {
  transition: transform 0.2s ease;
}

.ui-drawer-enter-from,
.ui-drawer-leave-to {
  transform: translateX(100%);
}

@media (prefers-reduced-motion: reduce) {
  .ui-drawer-enter-active,
  .ui-drawer-leave-active {
    transition: none;
  }
}
</style>
