// =============================================================================
// deplacement.js — faire avancer un personnage le long d'un chemin
// -----------------------------------------------------------------------------
// Le personnage a une position en mètres (il glisse d'une case à l'autre) et
// une case « actuelle ». On lui donne :
//   - un chemin (liste de cases, déjà lissé) : il le suit à vitesse constante ;
//   - ou des pas au clavier : une case à la fois, dans une direction.
// Il se tourne vers où il va (tout de suite si les animations sont réduites).
//
// Ce module n'utilise ni la 3D ni la page (testé avec node --test).
// =============================================================================

import { angleVers, caseDuPoint, centreDeCase } from './grille.js';

const VITESSE_DE_ROTATION = 720; // degrés par seconde

// Le plus court écart entre deux angles, de -180 à 180 degrés.
function ecartAngle(de, vers) {
  return ((vers - de + 540) % 360) - 180;
}

/**
 * Crée le déplacement d'un personnage.
 *   depart   : { x, z, angle } (case et angle en degrés)
 *   vitesse  : mètres par seconde
 */
export function creerDeplacement({ depart, vitesse }) {
  const centre = centreDeCase(depart.x, depart.z);
  const etat = {
    x: centre.x,
    z: centre.z,
    case: { x: depart.x, z: depart.z },
    angle: depart.angle || 0,
    angleVise: depart.angle || 0,
    etapes: [], // les prochains points à atteindre (en mètres)
    destination: null,
  };

  return {
    get position() { return { x: etat.x, z: etat.z }; },
    get case() { return { ...etat.case }; },
    get angle() { return etat.angle; },
    get enRoute() { return etat.etapes.length > 0; },
    get destination() { return etat.destination; },

    /**
     * Suit un chemin de cases (la première est la case de départ). Si le
     * personnage est entre deux cases, il part de là où il est.
     */
    suivre(chemin) {
      etat.etapes = (chemin || []).slice(1).map((c) => centreDeCase(c.x, c.z));
      etat.destination = chemin && chemin.length > 0 ? { ...chemin[chemin.length - 1] } : null;
      if (etat.etapes.length === 0) etat.destination = null;
    },

    // Va au centre de la case actuelle (avant de repartir au clavier).
    revenirAuCentre() {
      const centreCase = centreDeCase(etat.case.x, etat.case.z);
      etat.etapes = [centreCase];
      etat.destination = { ...etat.case };
    },

    // S'arrête après la prochaine étape (pour changer de chemin proprement).
    arreter() {
      etat.etapes = etat.etapes.slice(0, 1);
      if (etat.etapes.length === 0) etat.destination = null;
      else etat.destination = caseDuPoint(etat.etapes[0].x, etat.etapes[0].z);
    },

    // Tourne le personnage vers un angle (en degrés).
    regarder(angle, { instantane = false } = {}) {
      etat.angleVise = ((angle % 360) + 360) % 360;
      if (instantane) etat.angle = etat.angleVise;
    },

    // Place le personnage sur une case, sans animation.
    teleporter(x, z, angle = etat.angle) {
      const point = centreDeCase(x, z);
      etat.x = point.x;
      etat.z = point.z;
      etat.case = { x, z };
      etat.angle = angle;
      etat.angleVise = angle;
      etat.etapes = [];
      etat.destination = null;
    },

    /**
     * Avance pendant « dt » secondes. Renvoie ce qui s'est passé :
     *   distance      mètres parcourus (pour l'animation de marche)
     *   caseChangee   le personnage est entré dans une autre case
     *   arrive        il vient d'atteindre la fin de son chemin
     *   tourne        il est encore en train de se tourner
     */
    avancer(dt, { tournerInstantanement = false } = {}) {
      let reste = vitesse * dt;
      let distance = 0;
      let arrive = false;
      const caseAvant = { ...etat.case };
      while (reste > 0 && etat.etapes.length > 0) {
        const etape = etat.etapes[0];
        const dx = etape.x - etat.x;
        const dz = etape.z - etat.z;
        const longueur = Math.hypot(dx, dz);
        const direction = angleVers(dx, dz);
        if (direction !== null && longueur > 0.001) etat.angleVise = direction;
        if (longueur <= reste) {
          etat.x = etape.x;
          etat.z = etape.z;
          reste -= longueur;
          distance += longueur;
          etat.etapes.shift();
          if (etat.etapes.length === 0) {
            arrive = true;
            etat.destination = null;
          }
        } else {
          etat.x += dx / longueur * reste;
          etat.z += dz / longueur * reste;
          distance += reste;
          reste = 0;
        }
      }
      etat.case = caseDuPoint(etat.x, etat.z);
      const ecart = ecartAngle(etat.angle, etat.angleVise);
      let tourne = false;
      if (Math.abs(ecart) > 0.5) {
        const pas = tournerInstantanement ? Math.abs(ecart) : VITESSE_DE_ROTATION * dt;
        etat.angle = (etat.angle + Math.sign(ecart) * Math.min(Math.abs(ecart), pas) + 360) % 360;
        tourne = Math.abs(ecartAngle(etat.angle, etat.angleVise)) > 0.5;
      } else {
        etat.angle = etat.angleVise;
      }
      return {
        distance,
        arrive,
        tourne,
        caseChangee: caseAvant.x !== etat.case.x || caseAvant.z !== etat.case.z,
      };
    },
  };
}

// Les 8 directions de la grille, dans l'ordre des angles (0 = sud, 45 = sud-est…).
const HUIT_DIRECTIONS = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];

/**
 * Pour le clavier : les directions de la grille à essayer, de la meilleure à
 * la moins bonne, pour aller dans la direction (x, z) demandée. La première
 * qui est possible est choisie : le personnage « glisse » le long des murs au
 * lieu de rester bloqué.
 */
export function directionsPourAller(x, z) {
  const angle = angleVers(x, z);
  if (angle === null) return [];
  const arrondi = Math.round(angle / 45);
  const indice = arrondi % 8;
  const ecart = angle - arrondi * 45; // de quel côté on penche
  const premier = ecart >= 0 ? 1 : -1;
  return [0, premier, -premier].map((decalage) => HUIT_DIRECTIONS[(indice + decalage + 8) % 8]);
}
