// =============================================================================
// reperes.js — les repères dessinés dans la 3D
// -----------------------------------------------------------------------------
//   - la destination : un anneau au sol, là où le personnage se rend ;
//   - le survol (souris) : le contour de la case visée ;
//   - l'objet ciblé : un losange au-dessus du meuble qu'on peut examiner.
// Ils prennent la couleur du contour de focus du thème (var(--focus)) : ils
// restent bien visibles en contraste élevé et en mode daltonien. Ils ne
// clignotent pas et ne bougent pas : ils apparaissent, puis disparaissent.
// =============================================================================

import {
  BackSide, BufferGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineLoop, Mesh, MeshBasicMaterial,
  OctahedronGeometry, RingGeometry,
} from '../../lib/three/three.module.js';
import { couleurDuTheme } from '../modeles/palette.js';
import { TAILLE_CASE } from './grille.js';

export function creerReperes() {
  const groupe = new Group();
  groupe.name = 'reperes';
  const matiere = new MeshBasicMaterial({ color: couleurDuTheme('--focus', '#ffd166'), depthTest: true });
  const matiereSombre = new MeshBasicMaterial({ color: couleurDuTheme('--fond', '#171126') });
  const matiereTrait = new LineBasicMaterial({ color: couleurDuTheme('--focus', '#ffd166') });

  // Destination : un anneau posé au sol (au-dessus des tapis et des ombres,
  // avec un fin liseré sombre dessous, visible sur les sols clairs comme foncés).
  const destination = new Group();
  const anneau = new Mesh(new RingGeometry(0.13, 0.21, 24), matiere);
  const lisere = new Mesh(new RingGeometry(0.11, 0.23, 24), matiereSombre);
  for (const [forme, hauteur] of [[lisere, 0.022], [anneau, 0.026]]) {
    forme.rotation.x = -Math.PI / 2;
    forme.position.y = hauteur;
    destination.add(forme);
  }
  destination.visible = false;
  groupe.add(destination);

  // Survol : le contour d'une case.
  const contour = new BufferGeometry();
  const m = 0.03;
  contour.setAttribute('position', new Float32BufferAttribute([
    m, 0.028, m, TAILLE_CASE - m, 0.028, m, TAILLE_CASE - m, 0.028, TAILLE_CASE - m, m, 0.028, TAILLE_CASE - m,
  ], 3));
  const survol = new LineLoop(contour, matiereTrait);
  survol.visible = false;
  groupe.add(survol);

  // Objet ciblé : un losange (octaèdre) au-dessus, entouré d'un contour
  // sombre (les faces arrière d'un losange un peu plus grand).
  const cible = new Group();
  const losange = new Mesh(new OctahedronGeometry(0.11), matiere);
  losange.scale.set(1, 1.5, 1);
  const matiereContour = new MeshBasicMaterial({ color: couleurDuTheme('--fond', '#171126'), side: BackSide });
  const contourLosange = new Mesh(new OctahedronGeometry(0.135), matiereContour);
  contourLosange.scale.set(1, 1.5, 1);
  cible.add(contourLosange, losange);
  cible.visible = false;
  groupe.add(cible);

  return {
    groupe,

    montrerDestination(x, z) {
      destination.position.set((x + 0.5) * TAILLE_CASE, 0, (z + 0.5) * TAILLE_CASE);
      destination.visible = true;
    },
    cacherDestination() {
      destination.visible = false;
    },

    montrerSurvol(x, z) {
      survol.position.set(x * TAILLE_CASE, 0, z * TAILLE_CASE);
      survol.visible = true;
    },
    cacherSurvol() {
      survol.visible = false;
    },
    get survolVisible() { return survol.visible; },

    // Au-dessus d'une boîte (Box3) : le meuble ou la porte ciblés.
    montrerCible(boite) {
      cible.position.set((boite.min.x + boite.max.x) / 2, boite.max.y + 0.35, (boite.min.z + boite.max.z) / 2);
      cible.visible = true;
    },
    cacherCible() {
      cible.visible = false;
    },

    // Le thème a changé : nouvelles couleurs.
    actualiserCouleurs() {
      matiere.color.copy(couleurDuTheme('--focus', '#ffd166'));
      matiereTrait.color.copy(couleurDuTheme('--focus', '#ffd166'));
      matiereSombre.color.copy(couleurDuTheme('--fond', '#171126'));
      matiereContour.color.copy(couleurDuTheme('--fond', '#171126'));
    },

    liberer() {
      groupe.traverse((objet) => objet.geometry?.dispose());
      matiere.dispose();
      matiereSombre.dispose();
      matiereContour.dispose();
      matiereTrait.dispose();
    },
  };
}
