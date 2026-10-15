<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { NAV_ITEMS, getNavItem, type ViewId } from '../navigation'

/**
 * Bandeau de l'application, repris de la maquette « Usine de Pilotage ».
 * Les liens pointent vers l'ancre de chaque vue (`#/ceda`) : pas de routeur, cf. App.vue.
 */
const props = defineProps<{
  current: ViewId
}>()

/** La mascotte change avec la vue, comme dans la maquette. */
const mascotte = computed(() => `/mascottes/${getNavItem(props.current).mascotte}.jpg`)

/**
 * Profil de démonstration : l'architecte connecté. L'authentification se fait au niveau de
 * l'application ; chaque écran est borné à son périmètre (ses DDS), sans filtre par AS.
 */
const PROFIL = { role: 'Architecte', nom: 'C. Bernard', fonction: 'Architecte Solution' }

/** Cloche : aperçu du panneau de notifications in-app (catalogue N1 à N15 non branché). */
const notifOpen = ref(false)
const notifRoot = ref<HTMLElement | null>(null)

function onDocumentClick(event: MouseEvent) {
  if (notifOpen.value && !notifRoot.value?.contains(event.target as Node)) notifOpen.value = false
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <header class="app-bar">
    <div class="brand">
      <img :key="mascotte" class="brand-mascot" :src="mascotte" alt="" width="32" height="32" />
      <span class="brand-title">Usine de Pilotage</span>
    </div>

    <nav class="nav" aria-label="Navigation principale">
      <a
        v-for="item in NAV_ITEMS"
        :key="item.id"
        class="nav-item"
        :class="{ 'is-active': item.id === current }"
        :aria-current="item.id === current ? 'page' : undefined"
        :href="`#/${item.id}`"
        :title="item.label"
      >
        <span class="ms nav-icon" aria-hidden="true">{{ item.icon }}</span>
        <span class="nav-label">{{ item.label }}</span>
      </a>
    </nav>

    <div class="app-bar-end">
      <div ref="notifRoot" class="notif" @keydown.esc="notifOpen = false">
        <button
          type="button"
          class="icon-btn"
          :aria-expanded="notifOpen"
          aria-controls="notif-panel"
          aria-label="Notifications : 1 non lue"
          @click="notifOpen = !notifOpen"
        >
          <span class="ms" aria-hidden="true">notifications</span>
          <span class="icon-badge" aria-hidden="true">1</span>
        </button>
        <div v-if="notifOpen" id="notif-panel" class="notif-panel" role="region" aria-label="Notifications">
          <p class="notif-heading">Notifications</p>
          <ul class="notif-list">
            <li class="notif-item">
              <span class="notif-code">N1</span>
              <div>
                <p class="notif-title">Liste CSDA publiée</p>
                <p class="notif-text">
                  La liste priorisée de la session en préparation est publiée : vos dossiers demandés y ont
                  leur numéro d’ordre.
                </p>
              </div>
            </li>
          </ul>
          <p class="notif-foot">Aperçu : le catalogue des notifications (N1 à N15) sera branché dans un prochain lot.</p>
        </div>
      </div>

      <div class="profile" title="Profil de démonstration">
        <span class="profile-avatar" aria-hidden="true">{{ PROFIL.nom.charAt(0) }}</span>
        <span class="profile-text">
          <strong>{{ PROFIL.role }}</strong>
          <span>{{ PROFIL.nom }} — {{ PROFIL.fonction }}</span>
        </span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-bar {
  display: flex;
  flex-wrap: wrap;
  flex-shrink: 0;
  align-items: center;
  gap: 12px;
  padding: 4px 20px 5px;
  border-bottom: 1px solid var(--bordure-douce);
  background: linear-gradient(90deg, var(--jaune-300) 0%, var(--jaune-200) 100%);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mascot {
  display: block;
  width: 32px;
  height: 32px;
  border: 2px solid #fff;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 1px 4px rgba(20, 55, 119, 0.2);
}

.brand-title {
  font-family: var(--title);
  font-size: 1rem;
  font-weight: 700;
  color: var(--bleu-700);
}

.nav {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-left: 4px;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2px 6px;
  border-radius: 8px;
  color: #5a4a1f;
  text-decoration: none;
  white-space: nowrap;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.45);
}

.nav-item.is-active {
  background: rgba(255, 255, 255, 0.7);
  box-shadow: inset 0 -2px 0 var(--bleu-700);
  color: var(--bleu-700);
}

.nav-item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--bleu-100);
}

.nav-icon {
  font-size: 20px;
}

.nav-label {
  margin-top: -1px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 13px;
}

.nav-item.is-active .nav-label {
  font-weight: 700;
}

/* Cloche et profil, poussés à droite comme dans la maquette. */
.app-bar-end {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.notif {
  position: relative;
}

.icon-btn {
  position: relative;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.55);
  color: var(--bleu-700);
  cursor: pointer;
}

.icon-btn:hover,
.icon-btn[aria-expanded='true'] {
  background: rgba(255, 255, 255, 0.85);
}

.icon-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--bleu-100);
}

.icon-btn .ms {
  font-size: 20px;
}

.icon-badge {
  position: absolute;
  top: 1px;
  right: 1px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--alerte);
  font-size: 0.625rem;
  font-weight: 700;
  line-height: 16px;
  color: #fff;
  box-sizing: border-box;
}

.notif-panel {
  position: absolute;
  z-index: 30;
  top: calc(100% + 8px);
  right: 0;
  width: 320px;
  padding: 12px;
  border: 1px solid var(--bordure);
  border-radius: 14px;
  background: var(--carte);
  box-shadow: var(--ombre);
}

.notif-heading {
  margin: 0 0 8px;
  font-family: var(--title);
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--bleu-700);
}

.notif-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.notif-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  background: var(--bleu-100);
}

.notif-code {
  flex-shrink: 0;
  height: fit-content;
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--carte);
  font-family: var(--mono);
  font-size: 0.6875rem;
  color: var(--bleu-700);
}

.notif-title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--encre);
}

.notif-text {
  margin: 2px 0 0;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: #41485a;
}

.notif-foot {
  margin: 10px 0 0;
  font-size: 0.75rem;
  color: var(--gris-600);
}

.profile {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 12px 3px 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
}

.profile-avatar {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bleu-700);
  font-size: 0.8125rem;
  font-weight: 700;
  color: #fff;
}

.profile-text {
  display: flex;
  flex-direction: column;
  font-size: 0.6875rem;
  line-height: 1.25;
  color: #41485a;
}

.profile-text strong {
  font-size: 0.75rem;
  color: var(--encre);
}
</style>
