// =============================================================================
// fantome.js — le meuble qu'on est en train de poser (mode « Aménager »)
// -----------------------------------------------------------------------------
// Pendant l'aménagement, le meuble choisi suit le doigt (ou le clavier) sous
// la forme d'un « fantôme » : le meuble lui-même, et sa place au sol
// entourée d'un cadre.
//   - Ici, c'est possible : le meuble est plein, le cadre est simple.
//   - Impossible : le meuble est à demi transparent, et une grande croix
//     barre sa place.
// La forme change, pas seulement la couleur (les couleurs sont celles du
// contour de focus du thème, comme les autres repères) ; et la raison est
// toujours écrite en toutes lettres dans le panneau de l'aménagement.
// =============================================================================

import {
  BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial,
} from '../../lib/three/three.module.js';
import { couleurDuTheme } from '../modeles/palette.js';
import { creerAtelierDeMeubles } from '../modeles/meubles.js';
import { matiereDecor } from '../modeles/formes.js';
import { TAILLE_CASE, empriseTournee } from './grille.js';

const EPAISSEUR_TRAIT = 0.045; // mètres
const HAUTEUR_TRAIT = 0.03; // au-dessus des tapis (1,6 cm au plus)

// Des bandes plates posées au sol : chaque bande va d'un point à un autre
// (en mètres), avec une largeur donnée.
function bandesAuSol(segments, largeur, hauteur) {
  const positions = [];
  for (const [[x1, z1], [x2, z2]] of segments) {
    const longueur = Math.hypot(x2 - x1, z2 - z1) || 1;
    // La perpendiculaire, pour donner de la largeur au trait.
    const px = (-(z2 - z1) / longueur) * (largeur / 2);
    const pz = ((x2 - x1) / longueur) * (largeur / 2);
    const a = [x1 + px, hauteur, z1 + pz];
    const b = [x1 - px, hauteur, z1 - pz];
    const c = [x2 - px, hauteur, z2 - pz];
    const d = [x2 + px, hauteur, z2 + pz];
    // Deux triangles visibles d'en haut, dans les deux sens (on ne sait pas
    // dans quel ordre tournent les coins).
    positions.push(...a, ...b, ...c, ...a, ...c, ...d, ...a, ...c, ...b, ...a, ...d, ...c);
  }
  const geometrie = new BufferGeometry();
  geometrie.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return geometrie;
}

export function creerFantome({ catalogue, palette }) {
  const groupe = new Group();
  groupe.name = 'fantome';
  groupe.visible = false;
  const atelier = creerAtelierDeMeubles(catalogue, palette);
  const matiereCadre = new MeshBasicMaterial({ color: couleurDuTheme('--focus', '#ffd166') });
  const matiereLisere = new MeshBasicMaterial({ color: couleurDuTheme('--fond', '#171126') });
  // Le meuble à demi transparent, quand la place ne convient pas.
  const matiereRefus = new MeshLambertMaterial({
    vertexColors: true, flatShading: true, transparent: true, opacity: 0.45, depthWrite: false,
  });

  let meuble = null; // le Mesh du meuble
  let cadre = null; // les traits au sol (cadre, et croix si refusé)
  let lisere = null;
  let actuel = null; // { meuble, x, z, rotation, valide }

  function viderCadre() {
    for (const objet of [cadre, lisere]) {
      if (!objet) continue;
      groupe.remove(objet);
      objet.geometry.dispose();
    }
    cadre = null;
    lisere = null;
  }

  function dessinerCadre({ x, z, largeur, profondeur, valide }) {
    viderCadre();
    const marge = EPAISSEUR_TRAIT / 2 + 0.01;
    const x1 = x * TAILLE_CASE + marge;
    const z1 = z * TAILLE_CASE + marge;
    const x2 = (x + largeur) * TAILLE_CASE - marge;
    const z2 = (z + profondeur) * TAILLE_CASE - marge;
    const segments = [[[x1, z1], [x2, z1]], [[x2, z1], [x2, z2]], [[x2, z2], [x1, z2]], [[x1, z2], [x1, z1]]];
    if (!valide) segments.push([[x1, z1], [x2, z2]], [[x2, z1], [x1, z2]]);
    // Un liseré sombre, un peu plus large et un peu plus bas : le trait se
    // voit sur un sol clair comme sur un sol foncé.
    lisere = new Mesh(bandesAuSol(segments, EPAISSEUR_TRAIT + 0.03, HAUTEUR_TRAIT - 0.005), matiereLisere);
    cadre = new Mesh(bandesAuSol(segments, EPAISSEUR_TRAIT, HAUTEUR_TRAIT), matiereCadre);
    groupe.add(lisere, cadre);
  }

  return {
    groupe,

    /**
     * Montre le meuble « idMeuble » à sa place (x, z : coin nord-ouest),
     * tourné de « rotation » degrés. « valide » : la place convient-elle ?
     */
    montrer({ meuble: idMeuble, x, z, rotation, valide }) {
      const fiche = catalogue.get(idMeuble);
      if (!fiche) return;
      const memeMeuble = actuel?.meuble === idMeuble;
      if (!memeMeuble) {
        if (meuble) groupe.remove(meuble);
        meuble = new Mesh(atelier.geometrie(idMeuble), matiereDecor());
        meuble.matrixAutoUpdate = false;
        groupe.add(meuble);
      }
      meuble.material = valide ? matiereDecor() : matiereRefus;
      meuble.renderOrder = valide ? 0 : 2;
      meuble.matrix.copy(atelier.matrice({ meuble: idMeuble, x, z, rotation }));
      meuble.matrixWorldNeedsUpdate = true;
      const { largeur, profondeur } = empriseTournee(fiche.emprise, rotation);
      dessinerCadre({ x, z, largeur, profondeur, valide });
      actuel = { meuble: idMeuble, x, z, rotation, valide };
      groupe.visible = true;
    },

    cacher() {
      groupe.visible = false;
      actuel = null;
      if (meuble) groupe.remove(meuble);
      meuble = null;
      viderCadre();
    },

    get visible() { return groupe.visible; },
    get etat() { return actuel; },

    // Le centre du meuble au sol (en mètres), pour que la caméra le suive.
    get centre() {
      if (!actuel) return null;
      const fiche = catalogue.get(actuel.meuble);
      const { largeur, profondeur } = empriseTournee(fiche.emprise, actuel.rotation);
      return { x: (actuel.x + largeur / 2) * TAILLE_CASE, z: (actuel.z + profondeur / 2) * TAILLE_CASE };
    },

    actualiserCouleurs() {
      matiereCadre.color.copy(couleurDuTheme('--focus', '#ffd166'));
      matiereLisere.color.copy(couleurDuTheme('--fond', '#171126'));
    },

    liberer() {
      this.cacher();
      atelier.liberer();
      matiereCadre.dispose();
      matiereLisere.dispose();
      matiereRefus.dispose();
    },
  };
}
