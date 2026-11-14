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
// Ce module n'utilise ni la 3D ni la page (testé avec node --test).
// =============================================================================

import { heureEnMinutes } from '../noyau/format-sauvegarde.js';

// Le point par où les visiteurs entrent et sortent, dans chaque lieu.
export const POINT_D_ARRIVEE = 'porte-entree';

// Le créneau en cours à cette minute (ou null : le PNJ n'est pas là).
export function creneauA(routine, minute) {
  const creneau = routine.find((c) => minute >= heureEnMinutes(c.de) && minute < heureEnMinutes(c.a));
  if (!creneau || creneau.lieu === 'ailleurs') return null;
  return creneau;
}

// Le PNJ est-il présent dans ce lieu à cette minute ? Renvoie son créneau.
export function presenceDans(pnj, lieu, minute, joueur) {
  if (pnj.absentSiJoueur && joueur?.modele === pnj.absentSiJoueur) return null;
  const creneau = creneauA(pnj.routine, minute);
  return creneau && creneau.lieu === lieu ? creneau : null;
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
