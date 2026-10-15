// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-10-15',
  devtools: { enabled: true },

  /*
   * Rendu dans le navigateur uniquement (mode SPA) : le POC n'a pas de back-end, ses DDS
   * de démonstration vivent en mémoire et ses jalons sont calculés par rapport au jour du
   * poste. À repasser à `true` avec l'API : l'état devra alors venir du serveur.
   */
  ssr: false,

  experimental: {
    /*
     * Manifeste d'application : sert aux pages pré-rendues côté serveur, sans objet en SPA.
     * Activé, il provoque au démarrage de `nuxt dev` (après un `nuxt build`, onglet ouvert)
     * des erreurs « Failed to resolve import "#app-manifest" ».
     */
    appManifest: false,
  },

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'Usine de Pilotage',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        // Polices et icônes de la maquette « Usine de Pilotage ».
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=block',
        },
      ],
    },
  },

  typescript: {
    strict: true,
    tsConfig: {
      compilerOptions: {
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
      },
    },
  },
})
