/**
 * Listes de valeurs (référentiels) des saisies du board. Fictives pour la maquette :
 * dans l'application cible, elles seront administrées dans l'écran Référentiels.
 */

/** Motifs de décalage d'un jalon (spec D4 : motif issu d'un référentiel). */
export const MOTIFS_DECALAGE = [
  'Dossier non prêt (instruction à poursuivre)',
  'Entrants du demandeur en retard',
  'Absence de l’architecte',
  'Non retenu par le DATM',
  'Pré-DATM ou Revue DATM non tenu',
  'Session CSDA décalée ou annulée',
  'Jalon avancé',
  'Autre',
] as const

/** Porteur du décalage : partie à l'origine du changement de date. */
export const PORTEURS_DECALAGE = [
  'Architecte (DA)',
  'Demandeur (MOA / MOE)',
  'Partenaire DATM',
  'Partenaire MAE / DS',
  'Coordination',
] as const

/** Interlocuteurs du Département Sécurité proposés au kick-off. */
export const INTERLOCUTEURS_DS = ['A. Morel', 'L. Garnier', 'S. Henry'] as const

/** Architectes techniques DATM (affectés par la Partenaire DATM). */
export const AT_DATM = ['R. Petit', 'J. Caron', 'S. Blanchard'] as const

/** Ressources MAE (architectes d'exploitation). */
export const RESSOURCES_MAE = ['T. Nguyen', 'M. Lopez'] as const

/** Architectes du département DA proposables en contributeurs. */
export const ARCHITECTES_DA = ['C. Bernard', 'J. Moreau', 'X. Guyot', 'M. Bertin', 'A. Brunet'] as const
