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

import { annoncer, ecouter } from './evenements.js';
import { ecrireCopieUrgence, enregistrerPartie } from './sauvegarde.js';

let partie = null;
let modifiee = false;
let forcerSauvegarde = false;
let suspenduParAutreOnglet = false;
let minuteur = null;
let enCours = null; // promesse de la file d'enregistrements en train de tourner
let arreterEcouteurs = null;

// Dès qu'un autre onglet enregistre la partie, cet onglet cesse d'écrire
// (sinon le rechargement ou la fermeture écraserait la partie la plus récente).
ecouter('sauvegarde:autre-onglet', () => {
  suspenduParAutreOnglet = true;
});

export function partieEnCours() {
  return partie;
}

export function estSuspenduParAutreOnglet() {
  return suspenduParAutreOnglet;
}

export function chargerPartieEnCours(nouvelle) {
  partie = nouvelle;
  modifiee = false;
  forcerSauvegarde = false;
  suspenduParAutreOnglet = false;
  annoncer('partie:chargee', partie);
}

export function fermerPartie() {
  partie = null;
  modifiee = false;
  forcerSauvegarde = false;
  suspenduParAutreOnglet = false;
}

// modification : une fonction qui reçoit la partie et la change.
export function modifierPartie(modification, { important = false } = {}) {
  if (!partie) return;
  modification(partie);
  modifiee = true;
  annoncer('partie:modifiee', partie);
  if (important && !suspenduParAutreOnglet) sauvegarderMaintenant();
}

export async function sauvegarderMaintenant() {
  if (!partie || suspenduParAutreOnglet) return false;
  // Si une sauvegarde tourne déjà, on demande un nouveau tour après elle
  // plutôt que d'écrire deux fois en même temps dans la base.
  forcerSauvegarde = true;
  if (enCours) return enCours;
  enCours = (async () => {
    let reussi = false;
    while (partie && !suspenduParAutreOnglet && (forcerSauvegarde || modifiee)) {
      const cible = partie;
      forcerSauvegarde = false;
      modifiee = false;
      reussi = await enregistrerPartie(cible);
      if (!reussi) {
        if (partie === cible) modifiee = true;
        break;
      }
    }
    return reussi;
  })();
  try {
    return await enCours;
  } finally {
    enCours = null;
  }
}

export function demarrerSauvegardeAutomatique(intervalleSecondes) {
  clearInterval(minuteur);
  arreterEcouteurs?.();
  minuteur = setInterval(() => {
    if (modifiee && !suspenduParAutreOnglet) sauvegarderMaintenant();
  }, intervalleSecondes * 1000);
  // En quittant : copie d'urgence immédiate si quelque chose a changé OU si
  // une écriture dans la base est encore en cours (elle peut être coupée
  // avant d'avoir fini), puis sauvegarde normale.
  const enQuittant = () => {
    if (!partie || suspenduParAutreOnglet || (!modifiee && !enCours)) return;
    ecrireCopieUrgence(partie);
    sauvegarderMaintenant();
  };
  const surVisibilite = () => {
    if (document.visibilityState === 'hidden') enQuittant();
  };
  document.addEventListener('visibilitychange', surVisibilite);
  self.addEventListener('pagehide', enQuittant);
  arreterEcouteurs = () => {
    document.removeEventListener('visibilitychange', surVisibilite);
    self.removeEventListener('pagehide', enQuittant);
  };
}
