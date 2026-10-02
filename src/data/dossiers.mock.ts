import { addDays, periodOf, todayIso } from '../domain/periods'
import { STAGES, type Dossier, type HistoryEvent, type StageId } from '../domain/workflow'

/*
 * Dossiers fictifs pour le POC, aucune donnée réelle.
 * Les dates sont relatives au jour d'ouverture : la démo montre toujours des
 * dossiers en retard et 3 semaines de comité bien remplies (en cours + 2 suivantes).
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

/**
 * Historique fictif : parcours depuis « DDS à traiter » jusqu'à `until`, la dernière
 * étape étant franchie le `lastMove`, environ deux semaines entre chaque étape.
 */
function parcours(until: StageId, lastMove: string, options: { sansDav0?: boolean } = {}): HistoryEvent[] {
  const path = STAGES.map((s) => s.id).filter((id) => !(options.sansDav0 && id === 'dav0'))
  const steps = path.slice(0, path.indexOf(until) + 1)

  return steps.map((to, i) => {
    const stepsBefore = steps.length - 1 - i
    const date = addDays(lastMove, -(stepsBefore * 13 + (stepsBefore % 3)))
    return {
      kind: 'stage',
      at: new Date(`${date}T09:30:00`).toISOString(),
      from: steps[i - 1] ?? null,
      to,
    }
  })
}

const CLAIRE = 'Claire Dubois'
const KARIM = 'Karim Benali'

export const DOSSIERS_MOCK: readonly Dossier[] = [
  // ─── Claire Dubois ───────────────────────────────────────────────
  {
    id: 'DA-2026-002',
    titre: 'Décommissionnement du mainframe facturation',
    description:
      'Reprise des fonctions de facturation du mainframe dans le progiciel de gestion, puis arrêt du système.',
    porteur: 'Bruno Perrin',
    direction: 'Direction Financière',
    architecte: CLAIRE,
    dateCsdaVisee: semaine(-5),
    type: 'formel',
    stage: 'valide',
    historique: parcours('valide', semaine(-5)),
  },
  {
    id: 'DA-2026-006',
    titre: 'Refonte du portail RH',
    description: 'Nouveau portail self-service pour les salariés : congés, notes de frais, documents RH.',
    porteur: 'Isabelle Garnier',
    direction: 'Direction des Ressources Humaines',
    architecte: CLAIRE,
    dateCsdaVisee: semaine(-3),
    type: 'declaratif',
    stage: 'valide',
    historique: parcours('valide', semaine(-3), { sansDav0: true }),
  },
  {
    id: 'DA-2026-011',
    titre: 'Plateforme d’échange de données partenaires',
    description: 'Exposition sécurisée d’API et d’échanges de fichiers avec les partenaires externes.',
    porteur: 'Julie Faure',
    direction: 'Direction Commerciale',
    architecte: CLAIRE,
    dateCsdaVisee: semaine(-2),
    type: null,
    stage: 'datm',
    historique: parcours('datm', addDays(semaine(-2), -10)),
  },
  {
    id: 'DA-2026-014',
    titre: 'Gestion électronique des documents RH',
    description:
      'Dématérialisation du dossier salarié et des documents RH, avec gestion des durées de conservation.',
    porteur: 'Isabelle Garnier',
    direction: 'Direction des Ressources Humaines',
    architecte: CLAIRE,
    dateCsdaVisee: semaine(-1),
    type: 'formel',
    stage: 'csda',
    historique: parcours('csda', addDays(semaine(-1), -8)),
  },
  {
    id: 'DA-2026-018',
    titre: 'Migration de la messagerie vers le cloud',
    description: 'Migration des boîtes aux lettres et de l’agenda vers une offre SaaS, avec archivage associé.',
    porteur: 'Pauline Marchand',
    direction: 'DSI – Poste de travail',
    architecte: CLAIRE,
    dateCsdaVisee: semaine(0),
    type: 'formel',
    stage: 'csda',
    historique: parcours('csda', ilYa(5)),
  },
  {
    id: 'DA-2026-021',
    titre: 'API de géolocalisation des agences',
    description: 'Service de recherche d’agences par proximité, consommé par le site web et l’application mobile.',
    porteur: 'Antoine Leroy',
    direction: 'Direction Relation Client',
    architecte: CLAIRE,
    dateCsdaVisee: semaine(0),
    type: null,
    stage: 'datm',
    historique: parcours('datm', ilYa(9), { sansDav0: true }),
  },
  {
    id: 'DA-2026-024',
    titre: 'Portail fournisseurs',
    description:
      'Portail web permettant aux fournisseurs de déposer leurs factures et de suivre leurs paiements.',
    porteur: 'Hélène Rousseau',
    direction: 'Direction des Achats',
    architecte: CLAIRE,
    dateCsdaVisee: semaine(1),
    type: 'declaratif',
    stage: 'datm',
    historique: parcours('datm', ilYa(6)),
  },
  {
    id: 'DA-2026-027',
    titre: 'Supervision unifiée des infrastructures',
    description: 'Consolidation des outils de supervision réseau, système et applicatif dans une plateforme unique.',
    porteur: 'Marc Fontaine',
    direction: 'DSI – Production',
    architecte: CLAIRE,
    dateCsdaVisee: semaine(0),
    type: 'formel',
    stage: 'dav1',
    historique: parcours('dav1', ilYa(12)),
  },
  {
    id: 'DA-2026-030',
    titre: 'Chatbot d’assistance aux utilisateurs',
    description:
      'Assistant conversationnel de premier niveau pour le support informatique, branché sur la base de connaissances.',
    porteur: 'Amandine Petit',
    direction: 'DSI – Support',
    architecte: CLAIRE,
    dateCsdaVisee: semaine(2),
    type: null,
    stage: 'dav1',
    historique: parcours('dav1', ilYa(7), { sansDav0: true }),
  },
  {
    id: 'DA-2026-033',
    titre: 'Data lake réglementaire',
    description: 'Socle de données centralisant les flux nécessaires aux reportings réglementaires trimestriels.',
    porteur: 'Camille Robin',
    direction: 'Direction Conformité',
    architecte: CLAIRE,
    dateCsdaVisee: semaine(0),
    type: 'formel',
    stage: 'dav0',
    historique: parcours('dav0', ilYa(10)),
  },
  {
    id: 'DA-2026-036',
    titre: 'Référentiel produits unifié',
    description: 'Référentiel unique des produits et tarifs, alimentant la vente en ligne et les agences.',
    porteur: 'Julie Faure',
    direction: 'Direction Commerciale',
    architecte: CLAIRE,
    dateCsdaVisee: semaine(1),
    type: null,
    stage: 'kickoff',
    historique: parcours('kickoff', ilYa(6)),
  },
  {
    id: 'DA-2026-039',
    titre: 'Prise de rendez-vous en agence',
    description: 'Module de prise de rendez-vous en ligne, synchronisé avec les agendas des conseillers.',
    porteur: 'Antoine Leroy',
    direction: 'Direction Relation Client',
    architecte: CLAIRE,
    dateCsdaVisee: semaine(0),
    type: 'declaratif',
    stage: 'ceda',
    historique: parcours('ceda', ilYa(4)),
  },
  {
    id: 'DA-2026-042',
    titre: 'Signature électronique des contrats',
    description:
      'Intégration d’un service de signature électronique qualifiée dans le circuit de validation des contrats.',
    porteur: 'Thomas Girard',
    direction: 'Direction Juridique',
    architecte: CLAIRE,
    dateCsdaVisee: semaine(1),
    type: null,
    stage: 'qualification',
    historique: parcours('qualification', ilYa(2)),
  },

  // ─── Karim Benali ────────────────────────────────────────────────
  {
    id: 'DA-2026-004',
    titre: 'Archivage légal à valeur probante',
    description: 'Système d’archivage électronique conforme NF Z42-013 pour les pièces comptables.',
    porteur: 'François Lambert',
    direction: 'Direction Financière',
    architecte: KARIM,
    dateCsdaVisee: semaine(-2),
    type: 'declaratif',
    stage: 'valide',
    historique: parcours('valide', semaine(-2)),
  },
  {
    id: 'DA-2026-009',
    titre: 'Mise en place d’un IAM centralisé',
    description:
      'Gestion centralisée des identités et des habilitations, avec fédération SSO pour les applications internes.',
    porteur: 'Olivier Chevalier',
    direction: 'DSI – Sécurité',
    architecte: KARIM,
    dateCsdaVisee: semaine(-1),
    type: 'formel',
    stage: 'dav1',
    historique: parcours('dav1', addDays(semaine(-1), -30)),
  },
  {
    id: 'DA-2026-012',
    titre: 'Modernisation de l’ETL comptable',
    description:
      'Remplacement des traitements batch de consolidation comptable par une chaîne d’intégration moderne.',
    porteur: 'Nicolas Mercier',
    direction: 'Direction Financière',
    architecte: KARIM,
    dateCsdaVisee: semaine(-3),
    type: 'declaratif',
    stage: 'csda',
    historique: parcours('csda', addDays(semaine(-3), -6), { sansDav0: true }),
  },
  {
    id: 'DA-2026-016',
    titre: 'Application mobile de suivi des interventions',
    description: 'Application terrain pour les techniciens : planning, comptes rendus d’intervention et photos.',
    porteur: 'Sandrine Blanc',
    direction: 'Direction des Opérations',
    architecte: KARIM,
    dateCsdaVisee: semaine(0),
    type: 'declaratif',
    stage: 'csda',
    historique: parcours('csda', ilYa(3)),
  },
  {
    id: 'DA-2026-019',
    titre: 'Paiement en ligne des factures clients',
    description: 'Paiement par carte et prélèvement depuis l’espace client, avec rapprochement automatique.',
    porteur: 'Nicolas Mercier',
    direction: 'Direction Financière',
    architecte: KARIM,
    dateCsdaVisee: semaine(1),
    type: 'formel',
    stage: 'datm',
    historique: parcours('datm', ilYa(8)),
  },
  {
    id: 'DA-2026-022',
    titre: 'Refonte de l’intranet',
    description: 'Nouvel intranet collaboratif : actualités, annuaire, espaces d’équipe et recherche unifiée.',
    porteur: 'Claire Morel',
    direction: 'Direction de la Communication',
    architecte: KARIM,
    dateCsdaVisee: semaine(2),
    type: null,
    stage: 'datm',
    historique: parcours('datm', ilYa(11), { sansDav0: true }),
  },
  {
    id: 'DA-2026-025',
    titre: 'Gestion des habilitations applicatives',
    description: 'Revue périodique des droits d’accès et workflow de demande d’habilitation.',
    porteur: 'Olivier Chevalier',
    direction: 'DSI – Sécurité',
    architecte: KARIM,
    dateCsdaVisee: semaine(1),
    type: 'formel',
    stage: 'dav1',
    historique: parcours('dav1', ilYa(14)),
  },
  {
    id: 'DA-2026-028',
    titre: 'Tableau de bord de pilotage commercial',
    description: 'Indicateurs de ventes consolidés par agence et par produit, rafraîchis quotidiennement.',
    porteur: 'Julie Faure',
    direction: 'Direction Commerciale',
    architecte: KARIM,
    dateCsdaVisee: semaine(1),
    type: null,
    stage: 'dav0',
    historique: parcours('dav0', ilYa(9)),
  },
  {
    id: 'DA-2026-031',
    titre: 'Plateforme de formation en ligne',
    description: 'Catalogue de formations, parcours e-learning et suivi des obligations réglementaires.',
    porteur: 'Isabelle Garnier',
    direction: 'Direction des Ressources Humaines',
    architecte: KARIM,
    dateCsdaVisee: semaine(2),
    type: 'declaratif',
    stage: 'dav1',
    historique: parcours('dav1', ilYa(5), { sansDav0: true }),
  },
  {
    id: 'DA-2026-034',
    titre: 'Coffre-fort numérique salariés',
    description: 'Mise à disposition des bulletins de paie et documents RH dans un coffre-fort personnel.',
    porteur: 'Isabelle Garnier',
    direction: 'Direction des Ressources Humaines',
    architecte: KARIM,
    dateCsdaVisee: semaine(1),
    type: 'formel',
    stage: 'kickoff',
    historique: parcours('kickoff', ilYa(8)),
  },
  {
    id: 'DA-2026-037',
    titre: 'Téléphonie IP des agences',
    description: 'Remplacement des autocommutateurs des agences par une solution de téléphonie IP centralisée.',
    porteur: 'Marc Fontaine',
    direction: 'DSI – Production',
    architecte: KARIM,
    dateCsdaVisee: semaine(2),
    type: null,
    stage: 'qualification',
    historique: parcours('qualification', ilYa(3)),
  },
  {
    id: 'DA-2026-040',
    titre: 'Gestion des contrats fournisseurs',
    description: 'Suivi du cycle de vie des contrats fournisseurs : échéances, avenants et renouvellements.',
    porteur: 'Hélène Rousseau',
    direction: 'Direction des Achats',
    architecte: KARIM,
    dateCsdaVisee: semaine(2),
    type: null,
    stage: 'ceda',
    historique: parcours('ceda', ilYa(5)),
  },
  {
    id: 'DA-2026-043',
    titre: 'Moteur de recherche documentaire',
    description: 'Recherche plein texte transverse sur la GED, l’intranet et les espaces de partage.',
    porteur: 'Claire Morel',
    direction: 'Direction de la Communication',
    architecte: KARIM,
    dateCsdaVisee: semaine(2),
    type: null,
    stage: 'demande',
    historique: parcours('demande', ilYa(1)),
  },
]
