// =============================================================================
// commandes.js — les commandes reçues sur l'ordinateur
// -----------------------------------------------------------------------------
// Une commande (data/commandes.json) passe par trois états :
//   offre     débloquée, pas encore acceptée (rien n'expire : elle attend) ;
//   en cours  acceptée : son projet est rangé dans la partie
//             (partie.commandes.enCours[id]) ;
//   livrée    rangée dans partie.commandes.livrees avec sa note et ses gains.
// Une commande se débloque selon « debloquee » : un drapeau (l'appel de
// bienvenue du mentor), d'autres commandes livrées, un niveau de réputation.
// Une commande « enPersonne » (Halaé, qui vit au domicile) est d'abord
// demandée de vive voix : il faut parler à la personne pour qu'elle arrive
// sur l'ordinateur.
//
// JavaScript pur (sans page ni 3D) : testé par tests/creation.test.mjs.
// =============================================================================

import { niveauDeReputation } from '../noyau/format-sauvegarde.js';
import { projetVide } from './creation.js';
import { gagner } from './economie.js';

// Posé à la fin du premier appel en visio avec le mentor (le tutoriel).
export const DRAPEAU_VISIO_ACCUEIL = 'visio-accueil';

// Le meuble où l'on travaille (data/lieux/domicile.json).
export const ID_BUREAU = 'bureau';

// Le drapeau posé quand la personne a présenté sa commande de vive voix.
export function drapeauDeProposition(commande) {
  return `proposee-${commande.id}`;
}

// Les conditions de « debloquee » sont-elles remplies ?
function conditionsRemplies(commande, partie, paliers) {
  const condition = commande.debloquee || {};
  if (condition.drapeau && !partie.drapeaux[condition.drapeau]) return false;
  const livrees = new Set(partie.commandes.livrees.map((livraison) => livraison.id));
  if ((condition.apres || []).some((id) => !livrees.has(id))) return false;
  if (condition.niveau && niveauDeReputation(partie.reputation, paliers).niveau < condition.niveau) return false;
  return true;
}

export function commandeDebloquee(commande, partie, paliers) {
  if (!conditionsRemplies(commande, partie, paliers)) return false;
  return !commande.enPersonne || Boolean(partie.drapeaux[drapeauDeProposition(commande)]);
}

// Les commandes qu'une personne attend de présenter de vive voix.
export function commandesAProposer(partie, commandes, paliers) {
  const livrees = new Set(partie.commandes.livrees.map((livraison) => livraison.id));
  return commandes.filter((commande) => commande.enPersonne
    && !partie.drapeaux[drapeauDeProposition(commande)]
    && !livrees.has(commande.id) && !partie.commandes.enCours[commande.id]
    && conditionsRemplies(commande, partie, paliers));
}

// La personne a présenté sa commande : elle arrive sur l'ordinateur.
export function proposerCommande(partie, commande) {
  partie.drapeaux[drapeauDeProposition(commande)] = true;
}

// Les commandes rangées par état, dans l'ordre de data/commandes.json.
export function etatDesCommandes(partie, commandes, paliers) {
  const livrees = new Map(partie.commandes.livrees.map((livraison) => [livraison.id, livraison]));
  const etat = { offres: [], enCours: [], livrees: [] };
  for (const commande of commandes) {
    if (livrees.has(commande.id)) etat.livrees.push({ commande, livraison: livrees.get(commande.id) });
    else if (partie.commandes.enCours[commande.id]) etat.enCours.push({ commande, projet: partie.commandes.enCours[commande.id] });
    else if (commandeDebloquee(commande, partie, paliers)) etat.offres.push(commande);
  }
  return etat;
}

// Les identifiants des offres du moment (pour repérer les nouvelles).
export function idsDesOffres(partie, commandes, paliers) {
  return new Set(etatDesCommandes(partie, commandes, paliers).offres.map((commande) => commande.id));
}

// Les offres apparues entre deux moments.
export function nouvellesOffres(avant, apres, commandes) {
  return commandes.filter((commande) => apres.has(commande.id) && !avant.has(commande.id));
}

// Accepte une offre : un projet vide l'attend (rien ne se passe si la
// commande est déjà en cours). La partie est modifiée sur place.
export function accepterCommande(partie, commande, creation) {
  if (!partie.commandes.enCours[commande.id]) {
    partie.commandes.enCours[commande.id] = projetVide(creation, partie.temps);
  }
  return partie.commandes.enCours[commande.id];
}

/**
 * Livre le projet d'une commande, d'après son évaluation (creation.js).
 *   « À retravailler » : le projet reste en cours, tel quel (rien n'est perdu).
 *   Sinon : la commande est livrée, l'argent et la réputation sont gagnés.
 * Renvoie { livree, niveauAvant, niveauApres, nomNiveau } (ou null).
 */
export function livrerProjet(partie, commande, evaluation, paliers) {
  const projet = partie.commandes.enCours[commande.id];
  if (!projet) return null;
  if (evaluation.note === 'aRetravailler') {
    projet.essais += 1;
    projet.resultat = 'aRetravailler';
    return { livree: false };
  }
  delete partie.commandes.enCours[commande.id];
  partie.commandes.livrees.push({
    id: commande.id,
    note: evaluation.note,
    jour: partie.temps.jour,
    argent: evaluation.recompense.argent,
    reputation: evaluation.recompense.reputation,
  });
  return { livree: true, ...gagner(partie, evaluation.recompense, paliers) };
}

/**
 * L'objectif affiché en haut de l'écran (en attendant le journal des quêtes).
 * Renvoie { cle, commande?, destination? } :
 *   allumer       le premier appel du mentor attend sur l'ordinateur ;
 *   retravailler  un projet est à reprendre ;
 *   terminer      un projet est en cours ;
 *   parler        quelqu'un veut présenter sa commande de vive voix ;
 *   choisir       des commandes attendent d'être acceptées ;
 *   attendre      il faut plus de réputation pour les suivantes ;
 *   fini          toutes les commandes sont livrées.
 */
export function objectifDuMoment(partie, commandes, paliers) {
  if (!partie.drapeaux[DRAPEAU_VISIO_ACCUEIL]) return { cle: 'allumer', destination: ID_BUREAU };
  const etat = etatDesCommandes(partie, commandes, paliers);
  const aReprendre = etat.enCours.find((element) => element.projet.resultat === 'aRetravailler');
  if (aReprendre) return { cle: 'retravailler', commande: aReprendre.commande, destination: ID_BUREAU };
  if (etat.enCours.length > 0) return { cle: 'terminer', commande: etat.enCours[0].commande, destination: ID_BUREAU };
  const aProposer = commandesAProposer(partie, commandes, paliers);
  if (aProposer.length > 0) return { cle: 'parler', commande: aProposer[0], destination: aProposer[0].client };
  if (etat.offres.length > 0) return { cle: 'choisir', destination: ID_BUREAU };
  if (etat.livrees.length === commandes.length) return { cle: 'fini' };
  return { cle: 'attendre' };
}
