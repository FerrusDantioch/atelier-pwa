// =============================================================================
// temps.js — l'heure du jeu
// -----------------------------------------------------------------------------
// Une journée va de « debutJournee » à « finJournee » (data/jeu.json, par
// défaut 7 h – 23 h). Par défaut, 1 seconde réelle = 1 minute de jeu ; le
// réglage « Vitesse du temps » peut la ralentir ou l'arrêter.
// À la fin de la journée, l'horloge s'arrête simplement : rien ne presse, on
// va dormir quand on veut (le lit), et la journée suivante commence au matin.
//
// Rien n'est pressé, rien n'expire : le temps sert à rythmer la vie des
// personnages, jamais à punir le joueur.
//
// Ce module n'utilise ni la 3D ni la page (testé avec node --test).
// =============================================================================

import { heureEnMinutes } from '../noyau/format-sauvegarde.js';

// Le réglage « Vitesse du temps » : minutes de jeu par seconde réelle, à
// multiplier par temps.minutesParSeconde (data/jeu.json).
export const VITESSES = { normale: 1, lente: 0.5, arretee: 0 };

// Les bornes de la journée, en minutes depuis minuit.
export function bornesDeLaJournee(reglesDuTemps) {
  return { debut: heureEnMinutes(reglesDuTemps.debutJournee), fin: heureEnMinutes(reglesDuTemps.finJournee) };
}

/**
 * Fait avancer l'horloge. « reste » garde les fractions de minute d'un appel
 * à l'autre. Renvoie { minute, reste, finAtteinte }.
 *   minute    l'heure actuelle (minutes depuis minuit)
 *   secondes  le temps réel écoulé
 *   vitesse   minutes de jeu par seconde réelle
 */
export function avancerHorloge({ minute, reste = 0, secondes, vitesse, fin }) {
  if (minute >= fin || vitesse <= 0 || secondes <= 0) {
    return { minute, reste: minute >= fin ? 0 : reste, finAtteinte: minute >= fin };
  }
  const total = reste + secondes * vitesse;
  const entieres = Math.floor(total);
  const nouvelle = Math.min(fin, minute + entieres);
  return { minute: nouvelle, reste: nouvelle >= fin ? 0 : total - entieres, finAtteinte: nouvelle >= fin };
}

// Le matin du jour suivant.
export function lendemain(temps, reglesDuTemps) {
  return { jour: temps.jour + 1, minute: heureEnMinutes(reglesDuTemps.debutJournee) };
}
