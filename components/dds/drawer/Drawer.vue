<script setup lang="ts">
import type { Dossier, StageId } from '~/domain/workflow'

/**
 * Drawer de détail d'une DDS : drawer générique (UiDrawer) + identifiant, badges et titre
 * de la DDS + contenu (DdsDrawerBody). Ouvert tant que `dossier` est renseigné.
 */
defineProps<{
  dossier: Dossier | null
  /** `YYYY-MM-DD` */
  today: string
}>()

defineEmits<{
  /** `outside` : clic hors du drawer, le focus reste là où l'utilisateur a cliqué. */
  close: [outside: boolean]
  move: [id: string, target: StageId]
  reschedule: [id: string, date: string]
  hold: [id: string, motif: string | null]
  fas: [id: string, fas: boolean]
  urgence: [id: string, urgent: boolean, motif: string | null]
}>()

/**
 * Clics qui ne ferment pas le drawer : une carte (elle ouvre son propre détail), une
 * modale ouverte depuis le drawer, le bandeau de rappel.
 */
const IGNORE_OUTSIDE = '.card, dialog, .toast'
</script>

<template>
  <UiDrawer
    :item="dossier"
    close-label="Fermer le détail de la DDS"
    :ignore-outside="IGNORE_OUTSIDE"
    @close="$emit('close', $event)"
  >
    <template #meta="{ item }">
      <span class="dds-id">{{ item.id }}</span>
      <span v-if="item.urgent" class="badge badge-urgent">Urgente</span>
      <span v-if="item.fas" class="badge badge-fas">FAS</span>
      <span v-if="item.attente" class="badge badge-hold">En attente</span>
    </template>

    <template #title="{ item }">{{ item.titre }}</template>

    <template #default="{ item }">
      <DdsDrawerBody
        :dossier="item"
        :today="today"
        @move="(id, target) => $emit('move', id, target)"
        @reschedule="(id, date) => $emit('reschedule', id, date)"
        @hold="(id, motif) => $emit('hold', id, motif)"
        @fas="(id, fas) => $emit('fas', id, fas)"
        @urgence="(id, urgent, motif) => $emit('urgence', id, urgent, motif)"
      />
    </template>
  </UiDrawer>
</template>

<style scoped>
.dds-id {
  font-family: var(--mono);
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.badge {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.badge-urgent {
  color: #fff;
  background: var(--alerte);
}

.badge-fas {
  color: var(--declaratif);
  background: var(--declaratif-bg);
}

.badge-hold {
  color: var(--vigilance-fg);
  background: var(--vigilance-soft);
}
</style>
