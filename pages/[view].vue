<script setup lang="ts">
import { getNavItem, isViewId } from '~/utils/navigation'

/*
 * Vues de la navigation pas encore implémentées (CEDA, Revue DATM…) : layout commun et
 * carte d'attente. Une adresse hors navigation mène à la page 404 de Nuxt.
 */
definePageMeta({
  validate: (route) => isViewId(String(route.params.view)),
})

const route = useRoute()
const item = computed(() => getNavItem(String(route.params.view)))

useHead({ title: () => item.value?.label })
</script>

<template>
  <PlaceholderView v-if="item" :key="item.id" :title="item.label" />
</template>
