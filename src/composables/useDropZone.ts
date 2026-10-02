import { computed, ref, watch } from 'vue'
import { DND_MIME } from './useKanban'

/**
 * Zone de dépôt HTML5 native (cellule, en-tête de ligne).
 * Ne pas appeler `preventDefault()` sur `dragover` = le navigateur refuse le dépôt.
 */
export function useDropZone(canDrop: () => boolean, onDrop: (id: string) => void) {
  /**
   * `dragenter` / `dragleave` se déclenchent aussi en survolant les enfants :
   * un compteur évite le clignotement de la surbrillance.
   */
  const depth = ref(0)
  const isOver = computed(() => canDrop() && depth.value > 0)

  watch(canDrop, (allowed) => {
    if (!allowed) depth.value = 0
  })

  const handlers = {
    dragenter(event: DragEvent) {
      if (!canDrop()) return
      event.preventDefault()
      depth.value++
    },
    dragover(event: DragEvent) {
      if (!canDrop()) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    },
    dragleave() {
      if (depth.value > 0) depth.value--
    },
    drop(event: DragEvent) {
      event.preventDefault()
      depth.value = 0
      const id = event.dataTransfer?.getData(DND_MIME)
      if (id) onDrop(id)
    },
  }

  return { isOver, handlers }
}
