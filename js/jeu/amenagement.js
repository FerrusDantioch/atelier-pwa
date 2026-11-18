// =============================================================================
// amenagement.js — poser les meubles achetés dans un lieu (jalon 5)
// -----------------------------------------------------------------------------
// Un meuble acheté (boutique.js) est soit « rangé » (dans tes affaires),
// soit posé dans un lieu :
//   partie.lieux.amenagements = { domicile: [{ id: 'achat-3', x, z, rotation }] }
// x et z : la case du coin nord-ouest de son emprise (comme dans
// data/lieux/*.json), rotation : 0, 90, 180 ou 270.
//
// Un meuble ne se pose que là où il ne gêne personne. verifierPlacement()
// le refuse, en disant pourquoi, s'il :
//   - sort des pièces, ou si un mur le traverse ;
//   - prend la place d'un autre meuble, ou de quelqu'un ;
//   - rend une pièce, un objet à examiner ou la place d'un habitant
//     inaccessible à pied OU en fauteuil roulant (passages d'au moins 1 m) ;
//   - supprime le dernier espace de demi-tour en fauteuil d'une pièce (un
//     carré libre de 1,50 m) ;
//   - enferme le personnage là où il se trouve.
// Ce sont les mêmes règles que pour les lieux écrits à l'avance
// (coherence.js) : la maison reste accessible quoi qu'on y pose.
//
// JavaScript pur (sans page ni 3D) : testé par tests/amenagement.test.mjs.
// =============================================================================

import { casesPourAtteindre, distancesDepuis } from '../monde/chemin.js';
import { PROFILS, creerGrille, empriseTournee, profilDeDeplacement } from '../monde/grille.js';
import { POINT_D_ARRIVEE } from './routines.js';

export const ROTATIONS = [0, 90, 180, 270];

// Le côté (en cases) de l'espace de demi-tour en fauteuil : 3 × 50 cm.
export const COTE_DEMI_TOUR = 3;

// --- Ce qui est posé, ce qui est rangé ----------------------------------------------

/**
 * Les meubles posés par le joueur dans un lieu, comme ceux d'un fichier de
 * lieu : [{ id, meuble, x, z, rotation }]. Un achat inconnu (partie d'une
 * autre version) est ignoré.
 */
export function meublesPoses(partie, idLieu) {
  const possessions = new Map(partie.possessions.map((possession) => [possession.id, possession]));
  return (partie.lieux.amenagements[idLieu] || []).flatMap((place) => {
    const possession = possessions.get(place.id);
    if (possession?.sorte !== 'meuble') return [];
    return [{ id: place.id, meuble: possession.article, x: place.x, z: place.z, rotation: place.rotation }];
  });
}

// Le lieu avec, en plus, les meubles posés par le joueur (une copie).
export function lieuAmenage(lieu, poses) {
  return poses.length === 0 ? lieu : { ...lieu, meubles: [...lieu.meubles, ...poses] };
}

// Les meubles achetés qui ne sont posés nulle part (dans tes affaires).
export function meublesRanges(partie) {
  const poses = new Set(Object.values(partie.lieux.amenagements).flat().map((place) => place.id));
  return partie.possessions.filter((possession) => possession.sorte === 'meuble' && !poses.has(possession.id));
}

// Où est posé cet achat ? { lieu, place } ou null (rangé).
export function placeDe(partie, id) {
  for (const [lieu, places] of Object.entries(partie.lieux.amenagements)) {
    const place = places.find((p) => p.id === id);
    if (place) return { lieu, place };
  }
  return null;
}

// Pose (ou déplace) un achat dans un lieu. La partie est modifiée sur place.
export function poserMeuble(partie, idLieu, { id, x, z, rotation }) {
  retirerMeuble(partie, id);
  if (!partie.lieux.amenagements[idLieu]) partie.lieux.amenagements[idLieu] = [];
  partie.lieux.amenagements[idLieu].push({ id, x, z, rotation });
}

// Range un achat : il n'est plus posé nulle part.
export function retirerMeuble(partie, id) {
  for (const [lieu, places] of Object.entries(partie.lieux.amenagements)) {
    const restantes = places.filter((place) => place.id !== id);
    if (restantes.length === 0) delete partie.lieux.amenagements[lieu];
    else if (restantes.length !== places.length) partie.lieux.amenagements[lieu] = restantes;
  }
}

// L'emprise d'un meuble dont on connaît la case du milieu (celle qu'on
// touche du doigt) : la case du coin nord-ouest. Tourner le meuble le fait
// pivoter autour de cette case.
export function coinDepuisMilieu(meuble, rotation, milieu) {
  const { largeur, profondeur } = empriseTournee(meuble.emprise, rotation);
  return { x: milieu.x - Math.floor((largeur - 1) / 2), z: milieu.z - Math.floor((profondeur - 1) / 2) };
}

export function milieuDepuisCoin(meuble, rotation, coin) {
  const { largeur, profondeur } = empriseTournee(meuble.emprise, rotation);
  return { x: coin.x + Math.floor((largeur - 1) / 2), z: coin.z + Math.floor((profondeur - 1) / 2) };
}

// --- L'accessibilité d'un lieu -------------------------------------------------------

// La désignation d'un meuble posé (« le lit »).
function designationDuMeuble(emprise) {
  return emprise.meuble.designation || emprise.meuble.nom;
}

/**
 * Ce qui n'est pas accessible dans un lieu, depuis son point de départ, à
 * pied et en fauteuil roulant. Renvoie, dans l'ordre :
 *   [{ profil, type: 'depart' | 'piece' | 'meuble' | 'point', id, designation }]
 * (aussi utilisé par coherence.js pour les lieux écrits à l'avance).
 */
export function problemesDAcces(lieu, grille, catalogue) {
  const problemes = [];
  const depart = { x: lieu.depart.x, z: lieu.depart.z };
  for (const profil of PROFILS) {
    if (!grille.caseAccessible(depart.x, depart.z, profil)) {
      problemes.push({ profil, type: 'depart', id: null, designation: lieu.designation });
      continue;
    }
    const distances = distancesDepuis(grille, depart, profil);
    for (const piece of lieu.pieces) {
      const atteinte = [...distances.keys()].some((cle) => {
        const [x, z] = cle.split(',').map(Number);
        return grille.piece(x, z) === piece.id;
      });
      if (!atteinte) problemes.push({ profil, type: 'piece', id: piece.id, designation: piece.designation });
    }
    for (const place of lieu.meubles) {
      const meuble = catalogue.get(place.meuble);
      if (!meuble || !(place.description || meuble.description)) continue;
      const emprise = grille.emprises.get(place.id);
      if (casesPourAtteindre(grille, emprise, depart, profil, distances).length === 0) {
        problemes.push({ profil, type: 'meuble', id: place.id, designation: designationDuMeuble(emprise) });
      }
    }
    for (const point of (lieu.points || []).filter((p) => p.description)) {
      if (!distances.has(`${point.x},${point.z}`)) {
        problemes.push({ profil, type: 'point', id: point.id, designation: point.designation, x: point.x, z: point.z });
      }
    }
  }
  return problemes;
}

// La pièce a-t-elle un espace de demi-tour en fauteuil (un carré libre de
// 1,50 m de côté, entièrement dans la pièce) ?
export function aUnEspaceDeDemiTour(grille, piece) {
  const cote = COTE_DEMI_TOUR;
  for (const [zx, zz, zl, zp] of piece.zones) {
    for (let x = zx; x <= zx + zl - cote; x += 1) {
      for (let z = zz; z <= zz + zp - cote; z += 1) {
        let libre = true;
        for (let dx = 0; dx < cote && libre; dx += 1) {
          for (let dz = 0; dz < cote && libre; dz += 1) {
            libre = grille.piece(x + dx, z + dz) === piece.id && grille.libre(x + dx, z + dz);
          }
        }
        if (libre) return true;
      }
    }
  }
  return false;
}

/**
 * Les places où se tiennent les habitants dans ce lieu (data/pnj.json), et
 * leur façon de se déplacer : [{ id, nom, profil, points: [{ x, z }] }].
 */
export function placesDesHabitants(lieu, pnj, personnages) {
  const points = new Map((lieu.points || []).map((point) => [point.id, point]));
  return pnj.flatMap((personne) => {
    const ids = [...new Set(personne.routine.filter((c) => c.lieu === lieu.id).map((c) => c.point))];
    if (ids.length === 0) return [];
    const ferrus = personne.modele === 'ferrus';
    const apparence = ferrus ? personnages.ferrus.apparence : personne.apparence;
    return [{
      id: personne.id,
      nom: ferrus ? personnages.ferrus.nom : personne.nom,
      profil: profilDeDeplacement(apparence?.aide),
      points: ids.map((id) => points.get(id)).filter(Boolean).map((point) => ({ x: point.x, z: point.z })),
    }];
  });
}

// --- Peut-on poser ce meuble ici ? ------------------------------------------------------

// Les cases couvertes par un meuble posé.
function casesDe(place, meuble) {
  const { largeur, profondeur } = empriseTournee(meuble.emprise, place.rotation);
  const cases = [];
  for (let x = place.x; x < place.x + largeur; x += 1) {
    for (let z = place.z; z < place.z + profondeur; z += 1) cases.push({ x, z });
  }
  return cases;
}

// Les vérifications rapides, sans recherche de chemin : dans les pièces,
// sans mur au milieu, sur une place libre, sans personne dessous.
function verifierPlace(grille, place, meuble, occupants) {
  const cases = casesDe(place, meuble);
  if (cases.some(({ x, z }) => grille.piece(x, z) === null)) return { ok: false, raison: 'dehors' };
  const dedans = new Set(cases.map(({ x, z }) => `${x},${z}`));
  for (const { x, z } of cases) {
    if ((dedans.has(`${x + 1},${z}`) && grille.murEntre(x, z, x + 1, z)) || (dedans.has(`${x},${z + 1}`) && grille.murEntre(x, z, x, z + 1))) {
      return { ok: false, raison: 'mur' };
    }
  }
  const bloque = meuble.bloque !== false;
  for (const emprise of grille.emprises.values()) {
    // Un meuble bloquant ne va pas sur un autre meuble bloquant ; un tapis
    // ne va pas sur un autre tapis (on peut poser un meuble sur un tapis).
    if (emprise.bloque !== bloque) continue;
    const touche = cases.some(({ x, z }) => x >= emprise.x && x < emprise.x + emprise.largeur
      && z >= emprise.z && z < emprise.z + emprise.profondeur);
    if (touche) return { ok: false, raison: 'chevauche', id: emprise.id, designation: designationDuMeuble(emprise) };
  }
  if (bloque) {
    const personne = occupants.find((occupant) => dedans.has(`${occupant.x},${occupant.z}`));
    if (personne) return { ok: false, raison: 'personne', nom: personne.nom || null, joueur: Boolean(personne.joueur) };
  }
  return { ok: true };
}

// Les vérifications qui demandent de chercher des chemins, sur le lieu tel
// qu'il serait avec le meuble posé.
function verifierAcces({ lieu, catalogue, avant, apres, place, habitants, joueur }) {
  // D'abord à pied (si quelque chose devient inaccessible à pied, ça l'est
  // aussi en fauteuil), puis en fauteuil roulant.
  const problemes = problemesDAcces(lieu, apres, catalogue);
  const probleme = problemes.find((p) => p.profil === 'pieton') || problemes.find((p) => p.profil === 'fauteuil');
  if (probleme) return { ok: false, raison: probleme.type === 'depart' ? 'arrivee' : 'acces', ...probleme };

  // Les places des habitants, depuis la porte d'entrée, avec LEUR façon
  // de se déplacer.
  const entree = (lieu.points || []).find((point) => point.id === POINT_D_ARRIVEE);
  if (entree) {
    for (const habitant of habitants) {
      const distances = distancesDepuis(apres, entree, habitant.profil);
      if (habitant.points.some(({ x, z }) => !distances.has(`${x},${z}`))) {
        return { ok: false, raison: 'place', nom: habitant.nom };
      }
    }
  }

  // L'espace de demi-tour : une pièce qui en avait un le garde.
  const touchees = new Set(casesDe(place, catalogue.get(place.meuble)).map(({ x, z }) => apres.piece(x, z)));
  for (const piece of lieu.pieces) {
    if (touchees.has(piece.id) && aUnEspaceDeDemiTour(avant, piece) && !aUnEspaceDeDemiTour(apres, piece)) {
      return { ok: false, raison: 'demiTour', designation: piece.designation };
    }
  }

  // Le personnage ne doit pas se retrouver enfermé.
  if (joueur) {
    const distances = distancesDepuis(apres, lieu.depart, joueur.profil);
    if (!distances.has(`${joueur.x},${joueur.z}`)) return { ok: false, raison: 'coince' };
  }
  return { ok: true };
}

/**
 * Peut-on poser ce meuble là ?
 *   lieu        le lieu d'origine (data/lieux/*.json)
 *   catalogue   Map id → meuble (data/meubles.json)
 *   poses       les AUTRES meubles posés par le joueur dans ce lieu
 *   place       { id, meuble, x, z, rotation } (x, z : coin nord-ouest)
 *   occupants   [{ x, z, nom, joueur }] les personnes présentes
 *   habitants   placesDesHabitants() de ce lieu
 *   joueur      { x, z, profil } : là où se trouve le personnage
 * Renvoie { ok: true } ou { ok: false, raison, … } (raisons : dehors, mur,
 * chevauche, personne, acces, arrivee, place, demiTour, coince, inconnu).
 */
export function verifierPlacement({ lieu, catalogue, poses = [], place, occupants = [], habitants = [], joueur = null }) {
  const meuble = catalogue.get(place.meuble);
  if (!meuble) return { ok: false, raison: 'inconnu' };
  const avant = creerGrille(lieuAmenage(lieu, poses), catalogue);
  const rapide = verifierPlace(avant, place, meuble, occupants);
  if (!rapide.ok) return rapide;
  const lieuApres = lieuAmenage(lieu, [...poses, place]);
  const apres = creerGrille(lieuApres, catalogue);
  return verifierAcces({ lieu: lieuApres, catalogue, avant, apres, place, habitants, joueur });
}

/**
 * La place la plus proche de « depuis » où ce meuble peut aller (en
 * essayant d'abord sa rotation, puis les autres). Renvoie { x, z, rotation }
 * (coin nord-ouest) ou null. Pour rester rapide, on ne cherche les chemins
 * que pour les places qui passent les vérifications simples, et pas plus
 * de « essaisMax » fois.
 */
export function trouverPlace({ depuis, rotation = 0, essaisMax = 60, ...options }) {
  const { lieu, catalogue, poses = [], place, occupants = [] } = options;
  const meuble = catalogue.get(place.meuble);
  if (!meuble) return null;
  const avant = creerGrille(lieuAmenage(lieu, poses), catalogue);
  const [largeur, profondeur] = lieu.taille;
  const cases = [];
  for (let x = 0; x < largeur; x += 1) for (let z = 0; z < profondeur; z += 1) cases.push({ x, z });
  cases.sort((a, b) => Math.hypot(a.x - depuis.x, a.z - depuis.z) - Math.hypot(b.x - depuis.x, b.z - depuis.z));
  const rotations = [rotation, ...ROTATIONS.filter((r) => r !== rotation)];
  let essais = 0;
  for (const milieu of cases) {
    for (const r of rotations) {
      const coin = coinDepuisMilieu(meuble, r, milieu);
      const candidate = { ...place, x: coin.x, z: coin.z, rotation: r };
      if (coin.x < 0 || coin.z < 0 || !verifierPlace(avant, candidate, meuble, occupants).ok) continue;
      essais += 1;
      if (verifierPlacement({ ...options, place: candidate }).ok) return { x: coin.x, z: coin.z, rotation: r };
      if (essais >= essaisMax) return null;
    }
  }
  return null;
}

/**
 * Au chargement d'une partie : les meubles posés tiennent-ils encore à leur
 * place ? (Les données du jeu ont pu changer d'une version à l'autre.)
 * Renvoie { gardes, retires } : les meubles qui ne conviennent plus sont
 * à ranger (rien n'est perdu).
 */
export function trierMeublesPoses({ lieu, catalogue, poses, habitants = [] }) {
  const gardes = [];
  const retires = [];
  for (const place of poses) {
    const resultat = verifierPlacement({ lieu, catalogue, poses: gardes, place, habitants });
    if (resultat.ok) gardes.push(place);
    else retires.push(place);
  }
  return { gardes, retires };
}

/**
 * Au chargement d'une partie : dans chaque lieu, les meubles posés qui ne
 * tiennent plus à leur place (données changées d'une version à l'autre,
 * lieu disparu) sont rangés dans les affaires. La partie est modifiée sur
 * place ; renvoie le nombre de meubles rangés.
 */
export function rangerCeQuiNeTientPlus(partie, { lieux, meubles, pnj, personnages }) {
  const catalogue = new Map(meubles.map((meuble) => [meuble.id, meuble]));
  let ranges = 0;
  for (const idLieu of Object.keys(partie.lieux.amenagements)) {
    const lieu = lieux[idLieu];
    const poses = meublesPoses(partie, idLieu);
    const aRanger = lieu
      ? trierMeublesPoses({ lieu, catalogue, poses, habitants: placesDesHabitants(lieu, pnj, personnages) }).retires
      : poses;
    // Un achat inconnu (absent des possessions) ne compte pas comme posé.
    const connus = new Set(poses.map((place) => place.id));
    for (const place of partie.lieux.amenagements[idLieu].filter((p) => !connus.has(p.id))) retirerMeuble(partie, place.id);
    for (const place of aRanger) {
      retirerMeuble(partie, place.id);
      ranges += 1;
    }
  }
  return ranges;
}
