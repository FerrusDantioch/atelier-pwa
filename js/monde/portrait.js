// =============================================================================
// portrait.js — les portraits des personnages (visio, commandes)
// -----------------------------------------------------------------------------
// Une petite scène à part : le personnage vu de face, en buste, devant une
// bibliothèque (comme quelqu'un qui appelle depuis chez lui). Le moteur en
// prend une « photo » (moteur.photographier) : une image fixe, rien ne bouge,
// et la scène du jeu n'est jamais interrompue.
// Les photos sont gardées : un même personnage n'est photographié qu'une fois.
// =============================================================================

import { Box3, Color, Matrix4, Mesh, OrthographicCamera, Scene } from '../../lib/three/three.module.js';
import { ajouterRecette, creerConstructeur, matiereDecor } from '../modeles/formes.js';
import { construirePersonnage } from '../modeles/personnage.js';
import { creerLumieres } from './lumieres.js';

const HAUTEUR_VUE = 0.78; // mètres visibles : la tête et les épaules
const ANGLE = 14 * Math.PI / 180; // un peu de trois quarts

export function creerPortraits({ moteur, donnees, palette, luminosite = () => 'normale' }) {
  const scene = new Scene();
  scene.background = new Color(palette.couleur('beige'));
  const lumieres = creerLumieres();
  scene.add(lumieres.groupe);

  // Le décor : une bibliothèque derrière, à gauche (recette de data/meubles.json).
  const recette = (donnees.meubles.meubles || []).find((meuble) => meuble.id === 'bibliotheque');
  let decor = null;
  if (recette) {
    const meuble = creerConstructeur();
    ajouterRecette(meuble, recette.formes, palette);
    const fond = creerConstructeur();
    fond.ajouterConstruite(meuble.construire(), new Matrix4().makeTranslation(-0.75, 0, -0.9));
    decor = new Mesh(fond.construire(), matiereDecor());
    scene.add(decor);
  }

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 30);
  const photos = new Map();

  function photographier(apparence, { largeur, hauteur }) {
    const cle = `${JSON.stringify(apparence)}|${largeur}x${hauteur}`;
    if (photos.has(cle)) return photos.get(cle);
    const perso = construirePersonnage(apparence, donnees.personnages, palette);
    scene.add(perso.groupe);
    // Le haut de la tête décide du cadrage (debout, assis, grand ou petit).
    const boite = new Box3().setFromObject(perso.groupe);
    const haut = boite.max.y + 0.06;
    const centreY = haut - HAUTEUR_VUE / 2;
    const rapport = largeur / hauteur;
    camera.left = -HAUTEUR_VUE * rapport / 2;
    camera.right = HAUTEUR_VUE * rapport / 2;
    camera.top = HAUTEUR_VUE / 2;
    camera.bottom = -HAUTEUR_VUE / 2;
    camera.position.set(Math.sin(ANGLE) * 8, centreY + 0.25, Math.cos(ANGLE) * 8);
    camera.lookAt(0, centreY, 0);
    lumieres.regler({ luminosite: luminosite(), azimut: ANGLE });
    let photo = null;
    try {
      photo = moteur.photographier(scene, camera, largeur, hauteur);
    } catch (erreur) {
      console.error(erreur);
    }
    scene.remove(perso.groupe);
    perso.liberer();
    if (photo) photos.set(cle, photo);
    return photo;
  }

  return {
    // Une toile 2D avec le portrait (ou null si la 3D ne répond pas).
    // Une même toile ne peut être affichée qu'à un endroit : on en renvoie
    // une copie à chaque fois.
    photographier(apparence, taille) {
      const photo = photographier(apparence, taille);
      if (!photo) return null;
      const copie = document.createElement('canvas');
      copie.width = photo.width;
      copie.height = photo.height;
      copie.getContext('2d').drawImage(photo, 0, 0);
      return copie;
    },
    // Après un changement de luminosité, les photos sont refaites.
    oublier() {
      photos.clear();
    },
    liberer() {
      photos.clear();
      decor?.geometry.dispose();
    },
  };
}
