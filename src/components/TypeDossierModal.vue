<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { TYPE_LABELS, type Dossier, type TypeDossier } from '../domain/workflow'

defineProps<{
  dossier: Dossier
  targetLabel: string
}>()

const emit = defineEmits<{
  confirm: [type: TypeDossier]
  cancel: []
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const choice = ref<TypeDossier | null>(null)
const types = Object.entries(TYPE_LABELS) as [TypeDossier, string][]

// showModal() : fond inerte, focus piégé dans la modale, Échap = événement `cancel`.
onMounted(() => dialog.value?.showModal())

function confirm() {
  if (!choice.value) return
  const type = choice.value
  dialog.value?.close()
  emit('confirm', type)
}

function cancel() {
  dialog.value?.close()
  emit('cancel')
}

/** Clic sur le fond : la cible est le <dialog> lui-même, le contenu étant dans le <form>. */
function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) cancel()
}
</script>

<template>
  <dialog
    ref="dialog"
    class="modal"
    aria-labelledby="type-modal-title"
    aria-describedby="type-modal-desc"
    @cancel.prevent="cancel"
    @click="onDialogClick"
  >
    <form class="modal-body" @submit.prevent="confirm">
      <h2 id="type-modal-title" class="modal-title">Type de dossier requis</h2>
      <p id="type-modal-desc" class="modal-desc">
        Le passage de <strong>{{ dossier.id }}</strong> en « {{ targetLabel }} » exige un type de
        dossier. Choisissez-le pour valider le déplacement.
      </p>

      <fieldset class="modal-choices">
        <legend class="modal-legend">{{ dossier.titre }}</legend>
        <label v-for="[value, label] in types" :key="value" class="modal-choice">
          <input v-model="choice" type="radio" name="type-dossier" :value="value" />
          {{ label }}
        </label>
      </fieldset>

      <div class="modal-actions">
        <button type="button" class="btn" @click="cancel">Annuler</button>
        <button type="submit" class="btn btn-primary" :disabled="!choice">
          Valider et déplacer
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.modal {
  width: min(420px, calc(100vw - 32px));
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-md);
}

.modal::backdrop {
  background: rgba(11, 21, 16, 0.45);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px;
}

.modal-title {
  margin: 0;
  font-size: 1.125rem;
  color: var(--text-h);
}

.modal-desc {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
}

.modal-choices {
  display: flex;
  gap: 12px;
  margin: 0;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.modal-legend {
  padding: 0 4px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-h);
}

.modal-choice {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
}

.modal-choice:has(input:checked) {
  border-color: var(--accent);
  background: var(--accent-bg);
  color: var(--text-h);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  font: inherit;
  font-size: 0.875rem;
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-2);
  color: var(--text-h);
  cursor: pointer;
}

.btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.btn-primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--on-accent);
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
