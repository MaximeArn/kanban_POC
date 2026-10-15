<script setup lang="ts">
/**
 * Modale générique, base de toutes les modales : <dialog> ouvert par showModal() au montage
 * (fond inerte, focus piégé, Échap). Le parent l'affiche avec un `v-if` et la retire à
 * `cancel` ou `submit`. Les modales métier fournissent le contenu par slots :
 * - `title`       : titre (nom accessible de la modale) ;
 * - `description` : sous-titre (description accessible), ex. l'objet concerné ;
 * - `default`     : corps ;
 * - `actions`     : boutons, alignés à droite. Un bouton `type="submit"` émet `submit`.
 */
const props = withDefaults(
  defineProps<{
    width?: string
    /** Un clic sur le fond annule la modale. */
    closeOnBackdrop?: boolean
  }>(),
  { width: '520px', closeOnBackdrop: true },
)

const emit = defineEmits<{
  /** Échap ou clic sur le fond. */
  cancel: []
  submit: []
}>()

const slots = defineSlots<{
  title: () => unknown
  description?: () => unknown
  default?: () => unknown
  actions?: () => unknown
}>()

const titleId = useId()
const descriptionId = useId()
const dialog = ref<HTMLDialogElement | null>(null)

onMounted(() => dialog.value?.showModal())
// close() avant le retrait du DOM : le navigateur rend le focus à l'élément qui l'avait.
onBeforeUnmount(() => {
  if (dialog.value?.open) dialog.value.close()
})

function cancel() {
  dialog.value?.close()
  emit('cancel')
}

/** Clic sur le fond : la cible est le <dialog> lui-même, le contenu étant dans le <form>. */
function onDialogClick(event: MouseEvent) {
  if (props.closeOnBackdrop && event.target === dialog.value) cancel()
}
</script>

<template>
  <dialog
    ref="dialog"
    class="ui-modal"
    :style="{ '--modal-width': width }"
    :aria-labelledby="titleId"
    :aria-describedby="slots.description ? descriptionId : undefined"
    @cancel.prevent="cancel"
    @click="onDialogClick"
  >
    <form class="ui-modal-form" @submit.prevent="emit('submit')">
      <header class="ui-modal-header">
        <h2 :id="titleId" class="ui-modal-title"><slot name="title" /></h2>
        <div v-if="slots.description" :id="descriptionId" class="ui-modal-description">
          <slot name="description" />
        </div>
      </header>

      <slot />

      <div v-if="slots.actions" class="ui-modal-actions">
        <slot name="actions" />
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.ui-modal {
  width: min(var(--modal-width), calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  padding: 0;
  border: 1px solid var(--bordure);
  border-radius: 16px;
  background: var(--carte);
  color: var(--text);
  box-shadow: var(--ombre);
}

.ui-modal::backdrop {
  background: rgba(14, 42, 92, 0.45);
}

.ui-modal-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 24px;
}

.ui-modal-header,
.ui-modal-description {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ui-modal-title {
  margin: 0;
  font-family: var(--title);
  font-size: 1.125rem;
  color: var(--bleu-700);
}

.ui-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
