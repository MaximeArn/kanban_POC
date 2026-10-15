import { addDays, periodOf, todayIso } from '../domain/periods'
import { ARCHITECTES_DA, AT_DATM, INTERLOCUTEURS_DS, RESSOURCES_MAE } from '../domain/referentiels'
import {
  STAGES,
  VALIDATED_STAGES,
  type Dossier,
  type Externalisation,
  type HistoryEvent,
  type PrioritePhase,
  type StageId,
  type Visibilite,
} from '../domain/workflow'

/** Champs saisis par les règles de statut : complétés plus bas, selon l’avancement de chaque DDS. */
type DossierSource = Omit<
  Dossier,
  | 'j08Initial'
  | 'j08Reel'
  | 'kickoff'
  | 'cadrageTechnique'
  | 'cadrageSecurite'
  | 'revueDatm'
  | 'attente'
  | 'visibilite'
  | 'prioritePhase'
  | 'service'
  | 'palier'
  | 'modeAgile'
  | 'externalisation'
  | 'contributeurs'
  | 'partenaires'
>

/*
 * DDS fictives : extrait du jeu de données de la maquette « Usine de Pilotage »
 * (référent : C. Bernard, l’architecte connecté). Liste générée ; les champs des règles de statut
 * sont complétés par `completer` en fin de fichier.
 *
 * Les jalons sont recalés autour du jour d'ouverture : la démo montre toujours des DDS
 * en retard, 4 semaines de comité remplies (dont des DDS sans J0.8) et une archive.
 * L'ordre des J0.8 et les écarts J0.2 / soumission de la maquette sont conservés.
 */

const TODAY = todayIso()

/**
 * CSDA visé dans la semaine n (le comité se tient le jeudi) : 0 = semaine en cours,
 * 1 = suivante, -1 = précédente. Jamais avant aujourd'hui pour les semaines à venir.
 */
function semaine(n: number): string {
  const thursday = addDays(periodOf(TODAY).start, n * 7)
  return n >= 0 && thursday < TODAY ? TODAY : thursday
}

function ilYa(days: number): string {
  return addDays(TODAY, -days)
}

function decale(date: string, days: number): string {
  return addDays(date, days)
}

/**
 * Historique fictif : parcours depuis « A pré-qualifier » jusqu'à `until`, la dernière
 * étape étant franchie le `lastMove`, environ deux semaines entre chaque étape.
 * Avec `sortie`, un dernier événement mène au statut de sortie (abandon, cadrage terminé).
 */
function parcours(
  until: StageId,
  lastMove: string,
  options: { sortie?: StageId; motif?: string } = {},
): HistoryEvent[] {
  const path = STAGES.map((s) => s.id)
  const steps: StageId[] = [...path.slice(0, path.indexOf(until) + 1), ...(options.sortie ? [options.sortie] : [])]

  return steps.map((to, i) => {
    const stepsBefore = steps.length - 1 - i
    const date = addDays(lastMove, -(stepsBefore * 13 + (stepsBefore % 3)))
    const event: HistoryEvent = {
      kind: 'stage',
      at: new Date(`${date}T09:30:00`).toISOString(),
      from: steps[i - 1] ?? null,
      to,
    }
    if (to === options.sortie && options.motif) event.motif = options.motif
    return event
  })
}

const SOURCE: readonly DossierSource[] = [
  // ─── A pré-qualifier sans J0.8 : semaine en cours
  {
    id: "DDS-2026-0001",
    titre: "Sécurisation des flux Imagerie",
    cercle: "Bénéficiaires",
    domaine: "Imagerie",
    typeDds: "DA V0",
    offre: "Mise à jour DA évolutive",
    demandeur: "Dr. Yasmine Kaddour",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: ilYa(4),
    j02: null,
    j08: null,
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: false,
    stage: "demande",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("demande", ilYa(2)),
  },
  {
    id: "DDS-2026-0004",
    titre: "Migration du référentiel Biologie médicale",
    cercle: "Bénéficiaires",
    domaine: "Biologie médicale",
    typeDds: "Carto",
    offre: "Dossier majeur",
    demandeur: "Mme Julie Chevalier",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: ilYa(7),
    j02: null,
    j08: null,
    urgent: true,
    motifUrgence: "Bascule technique imminente",
    meteo: { statut: "Orange", commentaire: "Léger retard, sous surveillance." },
    fas: false,
    stage: "demande",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("demande", ilYa(5)),
  },
  {
    id: "DDS-2026-0012",
    titre: "Nouveau connecteur Biologie médicale",
    cercle: "Bénéficiaires",
    domaine: "Biologie médicale",
    typeDds: "DA V1",
    offre: "Dossier majeur",
    demandeur: "Mme Isabelle Gauthier",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: ilYa(6),
    j02: null,
    j08: null,
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: false,
    stage: "demande",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("demande", ilYa(3)),
  },

  // ─── En retard (J0.8 dépassé)
  {
    id: "DDS-2026-0009",
    titre: "Automatisation du reporting Biologie médicale",
    cercle: "Bénéficiaires",
    domaine: "Biologie médicale",
    typeDds: "DA V1",
    offre: "Mise à jour DA corrective",
    demandeur: "Dr. Élise Vasseur",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(-1), -200),
    j02: null,
    j08: semaine(-1),
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: false,
    stage: "demandeCsda",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("demandeCsda", decale(semaine(-1), -10)),
  },
  {
    id: "DDS-2026-0223",
    titre: "Interface Biologie médicale — passerelle inter-applicative",
    cercle: "Bénéficiaires",
    domaine: "Biologie médicale",
    typeDds: "DA V1",
    offre: "Cartographie",
    demandeur: "M. Nicolas Aubin",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(-1), -200),
    j02: decale(semaine(-1), -194),
    j08: semaine(-1),
    urgent: true,
    motifUrgence: "Demande de la Direction Générale",
    meteo: null,
    fas: false,
    stage: "preDatm",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("preDatm", decale(semaine(-1), -10)),
  },
  {
    id: "DDS-2026-0002",
    titre: "Interface Parcours patient — passerelle inter-applicative",
    cercle: "Bénéficiaires",
    domaine: "Parcours patient",
    typeDds: "DA V0",
    offre: "Dossier standard",
    demandeur: "Mme Laura Girard",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(-2), -200),
    j02: null,
    j08: semaine(-2),
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: true,
    stage: "demandeCsda",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("demandeCsda", decale(semaine(-2), -10)),
  },

  // ─── Actives : 4 semaines de comité à venir
  {
    id: "DDS-2026-0006",
    titre: "Socle API Parcours patient",
    cercle: "Bénéficiaires",
    domaine: "Parcours patient",
    typeDds: "Carto",
    offre: "Dossier standard",
    demandeur: "M. Antoine Roussel",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(0), -108),
    j02: decale(semaine(0), -12),
    j08: semaine(0),
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: false,
    stage: "cadrage",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("cadrage", ilYa(8)),
  },
  {
    id: "DDS-2026-0271",
    titre: "Portail Imagerie v2",
    cercle: "Bénéficiaires",
    domaine: "Imagerie",
    typeDds: "DA V1",
    offre: "Mise à jour DA corrective",
    demandeur: "Dr. Yasmine Kaddour",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(0), -82),
    j02: decale(semaine(0), -14),
    j08: semaine(0),
    urgent: false,
    motifUrgence: null,
    meteo: { statut: "Rouge", commentaire: "Retard significatif, remobilisation nécessaire." },
    fas: false,
    stage: "kickoff",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("kickoff", ilYa(13)),
  },
  {
    id: "DDS-2026-0158",
    titre: "Cartographie des flux Imagerie",
    cercle: "Bénéficiaires",
    domaine: "Imagerie",
    typeDds: "DA V1",
    offre: "Migration technique",
    demandeur: "Dr. Marc Ibanez",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(0), -150),
    j02: null,
    j08: semaine(0),
    urgent: true,
    motifUrgence: "Demande de la Direction Générale",
    meteo: null,
    fas: false,
    stage: "demandeCsda",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("demandeCsda", ilYa(12)),
  },
  {
    id: "DDS-2026-0265",
    titre: "Extension de capacité Biologie médicale",
    cercle: "Bénéficiaires",
    domaine: "Biologie médicale",
    typeDds: "Carto",
    offre: "Mise à jour DA corrective",
    demandeur: "Mme Sophie Delattre",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(0), -148),
    j02: decale(semaine(0), -104),
    j08: semaine(0),
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: false,
    stage: "instruction",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("instruction", ilYa(7)),
  },
  {
    id: "DDS-2026-0011",
    titre: "Automatisation du reporting Parcours patient",
    cercle: "Bénéficiaires",
    domaine: "Parcours patient",
    typeDds: "DA V1",
    offre: "Cartographie",
    demandeur: "Dr. Paul Servant",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(0), -116),
    j02: null,
    j08: semaine(0),
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: false,
    stage: "kickoff",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("kickoff", ilYa(13)),
  },
  {
    id: "DDS-2026-0162",
    titre: "Portail Parcours patient v2",
    cercle: "Bénéficiaires",
    domaine: "Parcours patient",
    typeDds: "DA V0",
    offre: "Dossier standard",
    demandeur: "M. Baptiste Colin",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(1), -171),
    j02: null,
    j08: semaine(1),
    urgent: false,
    motifUrgence: null,
    meteo: { statut: "Vert", commentaire: "Avancement conforme au planning." },
    fas: false,
    stage: "preinstruction",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("preinstruction", ilYa(4)),
  },
  {
    id: "DDS-2026-0193",
    titre: "Refonte du flux Biologie médicale",
    cercle: "Bénéficiaires",
    domaine: "Biologie médicale",
    typeDds: "DA V0",
    offre: "Dossier standard",
    demandeur: "Mme Claire Bonnet",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(1), -161),
    j02: null,
    j08: semaine(1),
    urgent: false,
    motifUrgence: null,
    meteo: { statut: "Orange", commentaire: "Léger retard, sous surveillance." },
    fas: false,
    stage: "cadrage",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("cadrage", ilYa(11)),
  },
  {
    id: "DDS-2026-0197",
    titre: "Consolidation des habilitations Parcours patient",
    cercle: "Bénéficiaires",
    domaine: "Parcours patient",
    typeDds: "DA V0",
    offre: "Mise à jour DA corrective",
    demandeur: "Dr. Paul Servant",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(1), -170),
    j02: null,
    j08: semaine(1),
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: false,
    stage: "cadrage",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("cadrage", ilYa(3)),
  },
  {
    id: "DDS-2026-0151",
    titre: "Modernisation de l'infrastructure Parcours patient",
    cercle: "Bénéficiaires",
    domaine: "Parcours patient",
    typeDds: "DA V0",
    offre: "Cartographie",
    demandeur: "M. Xavier Perret",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(1), -152),
    j02: decale(semaine(1), -120),
    j08: semaine(1),
    urgent: false,
    motifUrgence: null,
    meteo: { statut: "Vert", commentaire: "Avancement conforme au planning." },
    fas: false,
    stage: "preinstruction",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("preinstruction", ilYa(5)),
  },
  {
    id: "DDS-2026-0022",
    titre: "Modernisation de l'infrastructure Imagerie",
    cercle: "Bénéficiaires",
    domaine: "Imagerie",
    typeDds: "DA V1",
    offre: "Mise à jour DA évolutive",
    demandeur: "Mme Manon Rousseau",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(2), -93),
    j02: null,
    j08: semaine(2),
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: false,
    stage: "qualifie",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("qualifie", ilYa(12)),
  },
  {
    id: "DDS-2026-0021",
    titre: "Sécurisation des flux Biologie médicale",
    cercle: "Bénéficiaires",
    domaine: "Biologie médicale",
    typeDds: "FAS",
    offre: "Dossier majeur",
    demandeur: "Mme Laura Girard",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(2), -81),
    j02: null,
    j08: semaine(2),
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: false,
    stage: "demande",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("demande", ilYa(11)),
  },
  {
    id: "DDS-2026-0018",
    titre: "Consolidation des habilitations Parcours patient",
    cercle: "Bénéficiaires",
    domaine: "Parcours patient",
    typeDds: "Carto",
    offre: "Mise à jour DA évolutive",
    demandeur: "Dr. Yasmine Kaddour",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(2), -72),
    j02: decale(semaine(2), -24),
    j08: semaine(2),
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: false,
    stage: "demande",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("demande", ilYa(8)),
  },
  {
    id: "DDS-2026-0015",
    titre: "Modernisation de l'infrastructure Imagerie",
    cercle: "Bénéficiaires",
    domaine: "Imagerie",
    typeDds: "DA V1",
    offre: "Mise à jour DA évolutive",
    demandeur: "Dr. Alexandre Poirier",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(2), -196),
    j02: null,
    j08: semaine(2),
    urgent: false,
    motifUrgence: null,
    meteo: { statut: "Vert", commentaire: "Avancement conforme au planning." },
    fas: false,
    stage: "cadrage",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("cadrage", ilYa(5)),
  },
  {
    id: "DDS-2026-0248",
    titre: "Pré-étude API Imagerie",
    cercle: "Bénéficiaires",
    domaine: "Imagerie",
    typeDds: "FAS",
    offre: "Migration technique",
    demandeur: "Mme Claire Bonnet",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(2), -200),
    j02: null,
    j08: semaine(2),
    urgent: false,
    motifUrgence: null,
    meteo: { statut: "Vert", commentaire: "Avancement conforme au planning." },
    fas: false,
    stage: "preDatm",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("preDatm", ilYa(2)),
  },
  {
    id: "DDS-2026-0003",
    titre: "Cadrage entrepôt de données Biologie médicale",
    cercle: "Bénéficiaires",
    domaine: "Biologie médicale",
    typeDds: "DA V1",
    offre: "Cartographie",
    demandeur: "M. Damien Leroy",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(3), -200),
    j02: null,
    j08: semaine(3),
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: false,
    stage: "instruction",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("instruction", ilYa(5)),
  },
  {
    id: "DDS-2026-0054",
    titre: "Modernisation de l'infrastructure Parcours patient",
    cercle: "Bénéficiaires",
    domaine: "Parcours patient",
    typeDds: "DA V1",
    offre: "Mise à jour DA évolutive",
    demandeur: "Dr. Yasmine Kaddour",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(3), -200),
    j02: null,
    j08: semaine(3),
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: false,
    stage: "instruction",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("instruction", ilYa(8)),
  },
  {
    id: "DDS-2026-0016",
    titre: "Refonte du flux Parcours patient",
    cercle: "Bénéficiaires",
    domaine: "Parcours patient",
    typeDds: "DA V1",
    offre: "Dossier majeur",
    demandeur: "M. Damien Leroy",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(3), -164),
    j02: null,
    j08: semaine(3),
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: false,
    stage: "kickoff",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("kickoff", ilYa(6)),
  },
  {
    id: "DDS-2026-0008",
    titre: "Extension de capacité Imagerie",
    cercle: "Bénéficiaires",
    domaine: "Imagerie",
    typeDds: "DA V1",
    offre: "Dossier standard",
    demandeur: "Dr. Guillaume Dutronc",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(3), -131),
    j02: decale(semaine(3), -15),
    j08: semaine(3),
    urgent: true,
    motifUrgence: "Engagement réglementaire",
    meteo: null,
    fas: false,
    stage: "qualifie",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("qualifie", ilYa(10)),
  },

  // ─── Sorties : archive « Terminés »
  {
    id: "DDS-2026-0010",
    titre: "MAJ DA — annuaire Parcours patient",
    cercle: "Bénéficiaires",
    domaine: "Parcours patient",
    typeDds: "DA V1",
    offre: "Dossier standard",
    demandeur: "Mme Aurélie Fontaine",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(-4), -126),
    j02: decale(semaine(-4), -67),
    j08: semaine(-4),
    urgent: false,
    motifUrgence: null,
    meteo: { statut: "Vert", commentaire: "Avancement conforme au planning." },
    fas: false,
    stage: "valideCsda",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("valideCsda", semaine(-4)),
  },
  {
    id: "DDS-2026-0014",
    titre: "Cartographie des flux Biologie médicale",
    cercle: "Bénéficiaires",
    domaine: "Biologie médicale",
    typeDds: "DA V1",
    offre: "Migration technique",
    demandeur: "Dr. Nadia Cheref",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(-7), -55),
    j02: null,
    j08: semaine(-7),
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: false,
    stage: "production",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("production", semaine(-7)),
  },
  {
    id: "DDS-2026-0238",
    titre: "Revue des accès prestataires Imagerie",
    cercle: "Bénéficiaires",
    domaine: "Imagerie",
    typeDds: "DA V0",
    offre: "Cartographie",
    demandeur: "Dr. Nadia Cheref",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(-3), -123),
    j02: decale(semaine(-3), -66),
    j08: semaine(-3),
    urgent: false,
    motifUrgence: null,
    meteo: { statut: "Vert", commentaire: "Avancement conforme au planning." },
    fas: true,
    stage: "valideCsda",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("valideCsda", semaine(-3)),
  },
  {
    id: "DDS-2026-0055",
    titre: "Revue des accès prestataires Biologie médicale",
    cercle: "Bénéficiaires",
    domaine: "Biologie médicale",
    typeDds: "DA V0",
    offre: "Cartographie",
    demandeur: "M. Sébastien Caron",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(-6), -84),
    j02: decale(semaine(-6), -27),
    j08: semaine(-6),
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: true,
    stage: "production",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours("production", semaine(-6)),
  },
  {
    id: "DDS-2026-0019",
    titre: "Passerelle Biologie médicale vers l'entrepôt central",
    cercle: "Bénéficiaires",
    domaine: "Biologie médicale",
    typeDds: "DA V0",
    offre: "Dossier standard",
    demandeur: "M. Frédéric Noël",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(-9), -37),
    j02: null,
    j08: semaine(-9),
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: false,
    stage: "cadrageTermine",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours('cadrage', semaine(-9), { sortie: 'cadrageTermine' }),
  },
  {
    id: "DDS-2026-0279",
    titre: "MAJ DA — annuaire Biologie médicale",
    cercle: "Bénéficiaires",
    domaine: "Biologie médicale",
    typeDds: "Carto",
    offre: "Dossier majeur",
    demandeur: "Dr. Yasmine Kaddour",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(-5), -29),
    j02: null,
    j08: semaine(-5),
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: false,
    stage: "cadrageTermine",
    statutAvantAbandon: null,
    motifAbandon: null,
    historique: parcours('cadrage', semaine(-5), { sortie: 'cadrageTermine' }),
  },
  {
    id: "DDS-2026-0020",
    titre: "Dématérialisation du parcours Imagerie",
    cercle: "Bénéficiaires",
    domaine: "Imagerie",
    typeDds: "DA V1",
    offre: "Dossier majeur",
    demandeur: "Dr. Karim Belkacem",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(-8), -96),
    j02: decale(semaine(-8), -53),
    j08: semaine(-8),
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: false,
    stage: "abandonnee",
    statutAvantAbandon: "cadrage",
    motifAbandon: "Fusionnée avec une autre DDS",
    historique: parcours("cadrage", semaine(-8), { sortie: 'abandonnee', motif: "Fusionnée avec une autre DDS" }),
  },
  {
    id: "DDS-2026-0205",
    titre: "MAJ DA — annuaire Imagerie",
    cercle: "Bénéficiaires",
    domaine: "Imagerie",
    typeDds: "DA V1",
    offre: "Dossier standard",
    demandeur: "M. Frédéric Noël",
    direction: "Direction des Soins",
    architecte: "C. Bernard",
    dateSoumission: decale(semaine(-10), -55),
    j02: null,
    j08: semaine(-10),
    urgent: false,
    motifUrgence: null,
    meteo: null,
    fas: false,
    stage: "abandonnee",
    statutAvantAbandon: "instruction",
    motifAbandon: "Priorité revue par le métier",
    historique: parcours("instruction", semaine(-10), { sortie: 'abandonnee', motif: "Priorité revue par le métier" }),
  },
]

/** DDS mises en attente (DDS-2026-0022 : même motif que dans la maquette). */
const ATTENTES: Record<string, string> = {
  'DDS-2026-0022': 'En attente de disponibilité ressource',
  'DDS-2026-0015': 'Entrants du demandeur incomplets',
}

/** DDS dont le J0.8 a déjà été décalé une fois, de `jours` : exemples d'historique des décalages. */
const DECALAGES: Record<string, { jours: number; motif: string; porteur: string; commentaire: string }> = {
  'DDS-2026-0002': {
    jours: 7,
    motif: 'Pré-DATM ou Revue DATM non tenu',
    porteur: 'Partenaire DATM',
    commentaire: 'Revue DATM annulée faute d’AT disponible.',
  },
  'DDS-2026-0003': {
    jours: 14,
    motif: 'Dossier non prêt (instruction à poursuivre)',
    porteur: 'Architecte (DA)',
    commentaire: 'Scénarios d’hébergement encore en cours d’étude.',
  },
}

const VISIBILITES: readonly Visibilite[] = ['1 - Normal', '2 - Important', '2 - Important', '3 - Stratégique']
const PRIORITES: readonly PrioritePhase[] = ['Normale', 'Haute', 'Normale', 'Basse']
const EXTERNALISATIONS: readonly Externalisation[] = ['Aucune', 'Aucune', 'Aucune', 'Cadrage', 'Instruction', 'Aucune']

/** Valeur stable dérivée du n° de DDS, pour varier les données sans hasard. */
function graine(id: string): number {
  return [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

const ORDRE: readonly StageId[] = STAGES.map((s) => s.id)

/** Dernier statut du board atteint ; pour une sortie, celui d'où la DDS est sortie. */
function statutAtteint(d: DossierSource): StageId | null {
  if (d.stage === 'abandonnee') return d.statutAvantAbandon
  if (d.stage === 'cadrageTermine') return 'cadrage'
  return d.stage
}

/** Jour (`YYYY-MM-DD`) où la DDS est entrée dans `stage`, d'après son historique. */
function entreeDans(d: DossierSource, stage: StageId): string {
  const event = d.historique.find((e) => e.kind === 'stage' && e.to === stage)
  return event ? event.at.slice(0, 10) : TODAY
}

/** Horodatage ISO d'un jour donné, à heure fixe. */
function horodatage(jour: string, heure: string): string {
  return new Date(`${jour}T${heure}:00`).toISOString()
}

/**
 * Complète une DDS avec ce que ses règles de statut auraient fait saisir : une DDS en
 * Instruction a un J0.2, une DDS validée un J0.8 réel, etc.
 */
function completer(d: DossierSource): Dossier {
  const atteint = statutAtteint(d)
  const franchi = (stage: StageId) => atteint !== null && ORDRE.indexOf(atteint) >= ORDRE.indexOf(stage)
  const g = graine(d.id)
  const historique = [...d.historique]

  let j08Initial = d.j08
  const decalage = DECALAGES[d.id]
  if (decalage && d.j08) {
    j08Initial = addDays(d.j08, -decalage.jours)
    const jour = [addDays(j08Initial, -3), ilYa(2)].sort()[0]!
    const { motif, porteur, commentaire } = decalage
    historique.push({ kind: 'date', at: horodatage(jour, '14:00'), from: j08Initial, to: d.j08, motif, porteur, commentaire })
  }

  const motifAttente = ATTENTES[d.id]
  const debutAttente = horodatage(ilYa(3), '10:15')
  if (motifAttente) historique.push({ kind: 'attente', at: debutAttente, enAttente: true, motif: motifAttente })

  historique.sort((a, b) => a.at.localeCompare(b.at))

  const kickoff = franchi('kickoff')
    ? { date: addDays(entreeDans(d, 'kickoff'), 9), interlocuteurDs: INTERLOCUTEURS_DS[g % INTERLOCUTEURS_DS.length]! }
    : null
  const autres = ARCHITECTES_DA.filter((nom) => nom !== d.architecte)

  return {
    ...d,
    fas: d.fas || d.typeDds === 'FAS',
    j02: d.j02 ?? (franchi('instruction') && d.j08 ? addDays(d.j08, -35) : null),
    j08Initial,
    j08Reel: VALIDATED_STAGES.includes(d.stage) ? d.j08 : null,
    kickoff,
    visibilite: VISIBILITES[g % VISIBILITES.length]!,
    prioritePhase: PRIORITES[(g >> 1) % PRIORITES.length]!,
    service: d.domaine,
    palier: `Palier ${(g % 3) + 1}`,
    modeAgile: g % 5 === 0,
    externalisation: franchi('qualifie') ? EXTERNALISATIONS[g % EXTERNALISATIONS.length]! : 'Aucune',
    contributeurs: g % 3 === 0 ? [autres[g % autres.length]!] : [],
    // Partenaires positionnés après la qualification CEDA ; l'interlocuteur DS du kick-off côté DS.
    partenaires: {
      datm: franchi('qualifie') ? AT_DATM[g % AT_DATM.length]! : null,
      mae: franchi('kickoff') && g % 2 === 0 ? RESSOURCES_MAE[g % RESSOURCES_MAE.length]! : null,
      ds: kickoff?.interlocuteurDs ?? null,
    },
    cadrageTechnique: franchi('cadrage') ? g % 2 === 0 : null,
    cadrageSecurite: franchi('cadrage') ? g % 3 !== 0 : null,
    revueDatm: franchi('preDatm') && d.j08 ? addDays(periodOf(d.j08).start, -2) : null,
    attente: motifAttente ? { motif: motifAttente, depuis: debutAttente } : null,
    historique,
  }
}

export const DOSSIERS_MOCK: readonly Dossier[] = SOURCE.map(completer)
