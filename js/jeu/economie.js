// =============================================================================
// economie.js — l'argent et la réputation
// -----------------------------------------------------------------------------
// L'argent (des « pièces », monnaie fictive) et la réputation (des points)
// augmentent quand on livre une application. Les paliers de réputation
// (data/jeu.json) donnent un niveau (« Premiers pas », « Bouche-à-oreille »…)
// qui débloque de nouvelles commandes.
//
// JavaScript pur (sans page ni 3D) : testé par tests/creation.test.mjs.
// =============================================================================

import { niveauDeReputation } from '../noyau/format-sauvegarde.js';

// Où en est la réputation : niveau atteint, palier suivant, points manquants.
export function progressionReputation(points, paliers) {
  const niveau = niveauDeReputation(points, paliers);
  return {
    niveau: niveau.niveau,
    nom: niveau.nom,
    points,
    suivant: niveau.suivant,
    reste: niveau.suivant ? niveau.suivant.points - points : 0,
  };
}

// Ajoute un gain à la partie (modifiée sur place). Renvoie les niveaux avant
// et après, pour annoncer un nouveau niveau.
export function gagner(partie, { argent = 0, reputation = 0 }, paliers) {
  const avant = niveauDeReputation(partie.reputation, paliers).niveau;
  partie.argent += Math.max(0, Math.round(argent));
  partie.reputation += Math.max(0, Math.round(reputation));
  const apres = niveauDeReputation(partie.reputation, paliers);
  return { niveauAvant: avant, niveauApres: apres.niveau, nomNiveau: apres.nom };
}
