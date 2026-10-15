# Usine de Pilotage — POC Kanban DDS

Maquette de la vue **DDS** de l'Usine de Pilotage : suivi des demandes d'architecture par
statut (colonnes) et par semaine de CSDA visé (lignes). Nuxt 3 + Vue 3 + TypeScript, sans
autre bibliothèque. Données de démonstration en mémoire, recalées sur le jour d'ouverture.

## Lancer le projet

```bash
npm install      # lance aussi `nuxt prepare` (types générés dans .nuxt/)
npm run dev      # http://localhost:3000
```

| Script              | Rôle                                                       |
| ------------------- | ---------------------------------------------------------- |
| `npm run dev`       | serveur de développement                                   |
| `npm run build`     | vérification des types (`nuxt typecheck`) puis build       |
| `npm run generate`  | site statique (`.output/public`)                           |
| `npm run preview`   | prévisualisation du build                                  |
| `npm run typecheck` | vérification des types seule                               |

`nuxt build` refuse de tourner pendant `nuxt dev` dans le même dossier : arrêter le serveur
de développement avant de builder.

## Organisation (conventions Nuxt 3)

```
app.vue               racine : layout + page courante, modèle de titre d'onglet
error.vue             page d'erreur (404) dans le layout commun
layouts/default.vue   bandeau de l'application + zone de la vue
pages/
  index.vue           redirige vers /dds
  dds.vue             vue DDS (KanbanBoard)
  [view].vue          autres vues de la navigation, pas encore implémentées
components/           composants (importés automatiquement par Nuxt)
composables/          useKanban (état et règles du board), useDropZone, useToday
utils/                format (dates, durées), navigation (vues du bandeau)
domain/               règles métier pures : workflow (statuts, règles, phases), périodes, référentiels
data/                 DDS de démonstration
assets/css/main.css   thème de la maquette (jetons de couleur, polices, icônes)
public/               favicon, mascottes
```

- **Imports automatiques** : API Vue (`ref`, `computed`…), composants, `composables/` et
  `utils/`. Les modules de `domain/` et `data/` s'importent explicitement via l'alias `~/`.
- **Rendu côté navigateur** (`ssr: false` dans `nuxt.config.ts`) : pas de back-end pour
  l'instant, l'état vit en mémoire. À revoir avec l'arrivée de l'API.
- **Règles métier** : toutes dans `domain/workflow.ts` (`canMoveTo`, `STAGE_RULES`,
  `PHASES`…) ; l'interface ne fait que l'interroger.
