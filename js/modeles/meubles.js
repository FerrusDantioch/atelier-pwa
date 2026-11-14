// =============================================================================
// meubles.js — dessiner les meubles d'après leur « recette »
// -----------------------------------------------------------------------------
// Chaque meuble de data/meubles.json est décrit par une liste de formes
// simples, mesurées en mètres, autour du centre de son emprise au sol (y = 0
// au niveau du sol). Sa face avant regarde vers +z (le sud) quand la rotation
// vaut 0.
//
// La géométrie de chaque meuble est fabriquée une seule fois, puis recopiée
// à chaque endroit où il est posé.
// =============================================================================

import { Matrix4, Vector3 } from '../../lib/three/three.module.js';
import { TAILLE_CASE, empriseTournee } from '../monde/grille.js';
import { ajouterRecette, creerConstructeur } from './formes.js';

const DEGRES = Math.PI / 180;

export function creerAtelierDeMeubles(catalogue, palette) {
  const geometries = new Map();

  // La géométrie d'un meuble, autour de son centre (fabriquée une fois).
  function geometrie(idMeuble) {
    if (!geometries.has(idMeuble)) {
      const meuble = catalogue.get(idMeuble);
      const constructeur = creerConstructeur();
      ajouterRecette(constructeur, meuble.formes, palette);
      geometries.set(idMeuble, constructeur.construire());
    }
    return geometries.get(idMeuble);
  }

  // La matrice qui pose un meuble à sa place dans le lieu : on le tourne
  // autour de son centre, puis on amène ce centre au milieu de son emprise.
  function matrice(place) {
    const meuble = catalogue.get(place.meuble);
    const { largeur, profondeur } = empriseTournee(meuble.emprise, place.rotation || 0);
    const centre = new Vector3(
      (place.x + largeur / 2) * TAILLE_CASE,
      0,
      (place.z + profondeur / 2) * TAILLE_CASE,
    );
    return new Matrix4().makeRotationY((place.rotation || 0) * DEGRES).setPosition(centre);
  }

  return {
    geometrie,
    matrice,
    // Ajoute un meuble posé au constructeur du décor.
    poser(constructeur, place) {
      constructeur.ajouterConstruite(geometrie(place.meuble), matrice(place));
    },
    // La hauteur du meuble (pour le toucher du doigt et placer les repères).
    hauteur(idMeuble) {
      return geometrie(idMeuble).boundingBox.max.y;
    },
    liberer() {
      for (const geo of geometries.values()) geo.dispose();
      geometries.clear();
    },
  };
}
