// =============================================================================
// routines.js — l'emploi du temps des personnages non joueurs (PNJ)
// -----------------------------------------------------------------------------
// Chaque PNJ de data/pnj.json a une routine : une liste de créneaux
//   { "de": "08:00", "a": "12:00", "lieu": "domicile", "point": "montage",
//     "activite": "montage" }
// Hors de ses créneaux (ou avec « lieu »: « ailleurs »), le PNJ n'est pas là.
// Les routines sont fixes et prévisibles : le même PNJ fait la même chose à
// la même heure chaque jour (aucune surprise, mode calme ou non).
//
// Un créneau marqué « si » (jalon 5) n'a lieu que si cette ouverture est
// faite dans la partie (voir lieux.js › ouvertures) : « si »: « bureaux »
// une fois les bureaux loués, « si »: « coin-calme » une fois le coin calme
// ouvert. Sans ces ouvertures (paramètre « ouvertes », un Set), seuls les
// créneaux sans « si » comptent.
//
// Ce module n'utilise ni la 3D ni la page (testé avec node --test).
// =============================================================================

import { heureEnMinutes } from '../noyau/format-sauvegarde.js';

// Le point par où les visiteurs entrent et sortent, dans chaque lieu.
export const POINT_D_ARRIVEE = 'porte-entree';

// Un créneau a-t-il lieu avec ces ouvertures ?
export function creneauPossible(creneau, ouvertes = null) {
  return !creneau.si || Boolean(ouvertes?.has(creneau.si));
}

// Les créneaux qui ont lieu avec ces ouvertures.
function creneauxPossibles(routine, ouvertes) {
  return routine.filter((creneau) => creneauPossible(creneau, ouvertes));
}

// Le créneau en cours à cette minute (ou null : le PNJ n'est pas là).
export function creneauA(routine, minute, ouvertes = null) {
  const creneau = creneauxPossibles(routine, ouvertes)
    .find((c) => minute >= heureEnMinutes(c.de) && minute < heureEnMinutes(c.a));
  if (!creneau || creneau.lieu === 'ailleurs') return null;
  return creneau;
}

// Le PNJ est-il présent dans ce lieu à cette minute ? Renvoie son créneau.
export function presenceDans(pnj, lieu, minute, joueur, ouvertes = null) {
  if (pnj.absentSiJoueur && joueur?.modele === pnj.absentSiJoueur) return null;
  const creneau = creneauA(pnj.routine, minute, ouvertes);
  return creneau && creneau.lieu === lieu ? creneau : null;
}

// Où est la personne à cette minute ? Son créneau (avec son lieu), ou null.
export function ouEst(pnj, minute, joueur, ouvertes = null) {
  if (pnj.absentSiJoueur && joueur?.modele === pnj.absentSiJoueur) return null;
  return creneauA(pnj.routine, minute, ouvertes);
}

// Quand la personne revient-elle dans ce lieu (ou dans n'importe quel lieu,
// avec « lieu » à null) ? Renvoie { minute, demain, lieu } : sa prochaine
// arrivée aujourd'hui, sinon la première de demain. null si elle n'y vient
// jamais (ou pas quand on joue ce personnage-là).
export function prochainPassage(pnj, lieu, minute, joueur, ouvertes = null) {
  if (pnj.absentSiJoueur && joueur?.modele === pnj.absentSiJoueur) return null;
  const creneaux = creneauxPossibles(pnj.routine, ouvertes)
    .filter((c) => c.lieu !== 'ailleurs' && (lieu === null || c.lieu === lieu))
    .map((c) => ({ minute: heureEnMinutes(c.de), lieu: c.lieu }))
    .sort((a, b) => a.minute - b.minute);
  if (creneaux.length === 0) return null;
  const plusTard = creneaux.find((c) => c.minute > minute);
  return plusTard ? { ...plusTard, demain: false } : { ...creneaux[0], demain: true };
}

/**
 * Les problèmes d'une routine : heures dans l'ordre, dans la journée, sans
 * chevauchement. Renvoie une liste de messages.
 */
export function verifierRoutine(routine, { debut, fin }) {
  const problemes = [];
  let precedente = null;
  routine.forEach((creneau, index) => {
    const de = heureEnMinutes(creneau.de);
    const a = heureEnMinutes(creneau.a);
    const ou = `routine › n°${index + 1} (${creneau.de}-${creneau.a})`;
    if (a <= de) problemes.push(`${ou} : l'heure de fin doit être après l'heure de début`);
    if (de < debut || a > fin) problemes.push(`${ou} : le créneau doit rester dans la journée`);
    if (precedente !== null && de < precedente) problemes.push(`${ou} : les créneaux doivent se suivre sans se chevaucher`);
    if (creneau.lieu !== 'ailleurs' && !creneau.point) problemes.push(`${ou} : il faut un « point » où se tenir`);
    precedente = a;
  });
  return problemes;
}
