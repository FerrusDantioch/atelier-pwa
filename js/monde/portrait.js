// =============================================================================
// portrait.js — les portraits des personnages (visio, commandes)
// -----------------------------------------------------------------------------
// Une petite scène à part : le personnage vu de face, en buste, devant une
// bibliothèque (comme quelqu'un qui appelle depuis chez lui). Le moteur en
// prend une « photo » (moteur.photographier) : une image fixe, rien ne bouge,
// et la scène du jeu n'est jamais interrompue.
// Les photos sont gardées : un même personnage n'est photographié qu'une fois.
//
// Même principe pour les photos des meubles de la boutique (jalon 5) : le
// meuble seul, vu de trois quarts comme dans le jeu, sur un fond clair.
// =============================================================================

import { Box3, Color, Matrix4, Mesh, OrthographicCamera, Scene, Vector3 } from '../../lib/three/three.module.js';
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
    const geometrieMeuble = meuble.construire();
    const fond = creerConstructeur();
    fond.ajouterConstruite(geometrieMeuble, new Matrix4().makeTranslation(-0.75, 0, -0.9));
    geometrieMeuble.dispose();
    decor = new Mesh(fond.construire(), matiereDecor());
    scene.add(decor);
  }

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 30);
  const photos = new Map();

  // --- Les meubles (boutique) ---------------------------------------------------
  const sceneMeubles = new Scene();
  sceneMeubles.background = new Color(palette.couleur('creme'));
  const lumieresMeubles = creerLumieres();
  sceneMeubles.add(lumieresMeubles.groupe);
  const cameraMeubles = new OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
  // Vu de trois quarts, d'en haut, comme dans le jeu (un peu plus de face).
  const direction = new Vector3(0.75, 0.9, 1.2).normalize();

  function photographierMeuble(meuble, { largeur, hauteur }) {
    const cle = `meuble|${meuble.id}|${JSON.stringify(meuble.formes)}|${largeur}x${hauteur}`;
    if (photos.has(cle)) return photos.get(cle);
    const constructeur = creerConstructeur();
    ajouterRecette(constructeur, meuble.formes, palette);
    const forme = new Mesh(constructeur.construire(), matiereDecor());
    sceneMeubles.add(forme);
    // Le cadrage : les huit coins de la boîte, vus par la caméra.
    const boite = new Box3().setFromObject(forme);
    const centre = boite.getCenter(new Vector3());
    cameraMeubles.position.copy(centre).addScaledVector(direction, 10);
    cameraMeubles.lookAt(centre);
    cameraMeubles.updateMatrixWorld(true);
    let gauche = Infinity; let droite = -Infinity; let bas = Infinity; let haut = -Infinity;
    for (const x of [boite.min.x, boite.max.x]) {
      for (const y of [boite.min.y, boite.max.y]) {
        for (const z of [boite.min.z, boite.max.z]) {
          const point = new Vector3(x, y, z).applyMatrix4(cameraMeubles.matrixWorldInverse);
          gauche = Math.min(gauche, point.x); droite = Math.max(droite, point.x);
          bas = Math.min(bas, point.y); haut = Math.max(haut, point.y);
        }
      }
    }
    const marge = 1.12;
    const rapport = largeur / hauteur;
    let demiLargeur = ((droite - gauche) / 2) * marge;
    let demiHauteur = ((haut - bas) / 2) * marge;
    if (demiLargeur / demiHauteur > rapport) demiHauteur = demiLargeur / rapport;
    else demiLargeur = demiHauteur * rapport;
    const milieuX = (gauche + droite) / 2;
    const milieuY = (bas + haut) / 2;
    cameraMeubles.left = milieuX - demiLargeur;
    cameraMeubles.right = milieuX + demiLargeur;
    cameraMeubles.top = milieuY + demiHauteur;
    cameraMeubles.bottom = milieuY - demiHauteur;
    lumieresMeubles.regler({ luminosite: luminosite(), azimut: Math.atan2(direction.x, direction.z) });
    let photo = null;
    try {
      photo = moteur.photographier(sceneMeubles, cameraMeubles, largeur, hauteur);
    } catch (erreur) {
      console.error(erreur);
    }
    sceneMeubles.remove(forme);
    forme.geometry.dispose();
    if (photo) photos.set(cle, photo);
    return photo;
  }

  const copier = (photo) => {
    if (!photo) return null;
    const copie = document.createElement('canvas');
    copie.width = photo.width;
    copie.height = photo.height;
    copie.getContext('2d').drawImage(photo, 0, 0);
    return copie;
  };

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
      return copier(photographier(apparence, taille));
    },
    // La photo d'un meuble (une recette de data/meubles.json), pour la boutique.
    photographierMeuble(meuble, taille) {
      return copier(photographierMeuble(meuble, taille));
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
