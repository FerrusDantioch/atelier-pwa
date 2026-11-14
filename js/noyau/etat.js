// =============================================================================
// etat.js — la partie en cours, rangée à un seul endroit
// -----------------------------------------------------------------------------
// Tous les modules lisent la partie ici et la modifient par modifierPartie().
// La sauvegarde est automatique :
//   - tout de suite après un événement important (livraison, achat…) ;
//   - sinon, toutes les N secondes s'il y a du nouveau (data/jeu.json) ;
//   - dès que le jeu passe en arrière-plan ou se ferme (avec une copie
//     d'urgence instantanée, voir sauvegarde.js).
// =============================================================================

import { annoncer } from './evenements.js';
import { ecrireCopieUrgence, enregistrerPartie } from './sauvegarde.js';

let partie = null;
let modifiee = false;
let minuteur = null;
let enCours = null; // sauvegarde en train de se faire

export function partieEnCours() {
  return partie;
}

export function chargerPartieEnCours(nouvelle) {
  partie = nouvelle;
  modifiee = false;
  annoncer('partie:chargee', partie);
}

export function fermerPartie() {
  partie = null;
  modifiee = false;
}

// modification : une fonction qui reçoit la partie et la change.
export function modifierPartie(modification, { important = false } = {}) {
  if (!partie) return;
  modification(partie);
  modifiee = true;
  annoncer('partie:modifiee', partie);
  if (important) sauvegarderMaintenant();
}

export async function sauvegarderMaintenant() {
  if (!partie) return false;
  // Si une sauvegarde est déjà en cours, on attend qu'elle finisse, puis on
  // en refait une (la partie a pu changer entre-temps).
  if (enCours) await enCours;
  modifiee = false;
  enCours = enregistrerPartie(partie);
  const reussi = await enCours;
  enCours = null;
  if (!reussi) modifiee = true;
  return reussi;
}

export function demarrerSauvegardeAutomatique(intervalleSecondes) {
  clearInterval(minuteur);
  minuteur = setInterval(() => {
    if (modifiee) sauvegarderMaintenant();
  }, intervalleSecondes * 1000);
  // En quittant : copie d'urgence immédiate, puis sauvegarde normale (qui
  // n'a pas toujours le temps de finir, d'où la copie d'urgence).
  const enQuittant = () => {
    if (!modifiee) return;
    ecrireCopieUrgence(partie);
    sauvegarderMaintenant();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') enQuittant();
  });
  self.addEventListener('pagehide', enQuittant);
}
