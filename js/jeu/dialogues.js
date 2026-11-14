// =============================================================================
// dialogues.js — que dit un personnage quand on lui parle ?
// -----------------------------------------------------------------------------
//   - la première fois : sa réplique de rencontre (il se présente) ;
//   - ensuite : une salutation, tirée parmi les siennes ;
//   - « Qu'est-ce que tu fais ? » : une réplique sur son activité du moment
//     (le créneau de sa routine).
// Le tirage dépend de la graine de la partie, du jour et de l'heure : il
// varie d'un moment à l'autre, mais une même partie rejouée donne les mêmes
// répliques (pas de hasard caché).
//
// Ce module n'utilise ni la 3D ni la page (testé avec node --test).
// =============================================================================

import { choisirDans, combinerGraines, creerHasard } from '../noyau/hasard.js';

// Un nombre tiré d'un texte (pour mélanger l'identifiant à la graine).
function nombreDuTexte(texte) {
  let total = 0;
  for (const caractere of texte) total = (total * 31 + caractere.codePointAt(0)) >>> 0;
  return total;
}

// Le drapeau de la partie qui retient qu'on a déjà rencontré ce PNJ.
export function drapeauDeRencontre(pnj) {
  return `rencontre-${pnj.id}`;
}

function hasardPour(pnj, { graine, jour, minute }, sel) {
  return creerHasard(combinerGraines(graine, jour, minute, nombreDuTexte(pnj.id), sel));
}

/**
 * La réplique d'accueil. Renvoie { texte, premiereFois }.
 *   moment : { graine, jour, minute } (de la partie)
 */
export function repliqueDAccueil(pnj, { dejaRencontre, ...moment }) {
  if (!dejaRencontre) return { texte: choisirDans(hasardPour(pnj, moment, 1), pnj.repliques.rencontre), premiereFois: true };
  return { texte: choisirDans(hasardPour(pnj, moment, 2), pnj.repliques.salut), premiereFois: false };
}

// Ce que fait le PNJ (créneau en cours) : { description, texte } ou null.
export function repliqueDActivite(pnj, creneau, moment) {
  const activite = creneau?.activite ? pnj.activites[creneau.activite] : null;
  if (!activite) return null;
  return { description: activite.description, texte: choisirDans(hasardPour(pnj, moment, 3), activite.repliques) };
}
