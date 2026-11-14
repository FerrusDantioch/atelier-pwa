// =============================================================================
// formes.js — fabriquer des objets « low-poly » à partir de formes simples
// -----------------------------------------------------------------------------
// Tout le décor est fait de boîtes, de cylindres et de sphères à facettes,
// chacun d'une couleur unie. Pour que la tablette n'ait presque rien à faire,
// on « fusionne » toutes les formes d'un même objet (ou de tout le décor) en
// une seule géométrie : la couleur de chaque sommet est rangée dedans
// (« vertex colors »). Une seule matière suffit alors pour tout le décor, et
// la carte graphique dessine tout d'un coup.
//
// Les facettes bien visibles (« flat shading ») donnent le style low-poly.
// =============================================================================

import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, Euler, Float32BufferAttribute, IcosahedronGeometry,
  Matrix3, Matrix4, MeshLambertMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector3,
} from '../../lib/three/three.module.js';

const DEGRES = Math.PI / 180;

// La matière commune à tout le décor : chaque sommet porte sa couleur.
let matiere = null;
export function matiereDecor() {
  if (!matiere) matiere = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
  return matiere;
}

// Une matrice de placement : position, rotation (en degrés, ordre X Y Z), échelle.
export function matricePlacement(position = [0, 0, 0], rotation = [0, 0, 0], echelle = [1, 1, 1]) {
  const quaternion = new Quaternion().setFromEuler(new Euler(rotation[0] * DEGRES, rotation[1] * DEGRES, rotation[2] * DEGRES));
  return new Matrix4().compose(new Vector3(...position), quaternion, new Vector3(...echelle));
}

/**
 * Un « constructeur » accumule des formes, puis fabrique une seule géométrie.
 *   const c = creerConstructeur();
 *   c.boite([1, 0.5, 1], [0, 0.25, 0], couleur);
 *   const geometrie = c.construire();
 * Les couleurs sont des THREE.Color (voir palette.js).
 */
export function creerConstructeur() {
  const positions = [];
  const normales = [];
  const couleurs = [];
  const matriceNormales = new Matrix3();
  const v = new Vector3();

  // Ajoute une géométrie Three.js (déjà « à plat », sans index), déplacée par
  // « matrice ». « couleurDe(i) » donne la couleur du triangle n° i.
  function ajouterGeometrie(geometrie, matrice, couleurDe) {
    const aPlat = geometrie.index ? geometrie.toNonIndexed() : geometrie;
    const pos = aPlat.getAttribute('position');
    aPlat.computeVertexNormals();
    const nor = aPlat.getAttribute('normal');
    matriceNormales.getNormalMatrix(matrice);
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i).applyMatrix4(matrice);
      positions.push(v.x, v.y, v.z);
      v.fromBufferAttribute(nor, i).applyMatrix3(matriceNormales).normalize();
      normales.push(v.x, v.y, v.z);
      const couleur = couleurDe(Math.floor(i / 3));
      couleurs.push(couleur.r, couleur.g, couleur.b);
    }
    if (aPlat !== geometrie) aPlat.dispose();
    geometrie.dispose();
  }

  return {
    // Une boîte. « couleur » : une couleur, ou une par face
    // { px, nx, py, ny, pz, nz } (droite, gauche, dessus, dessous, avant, arrière).
    boite(taille, position, couleur, rotation) {
      const geometrie = new BoxGeometry(taille[0], taille[1], taille[2]);
      const ordre = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
      const parFace = couleur instanceof Color ? null : couleur;
      // BoxGeometry range ses faces dans cet ordre, 2 triangles par face.
      ajouterGeometrie(geometrie, matricePlacement(position, rotation),
        (triangle) => (parFace ? parFace[ordre[Math.floor(triangle / 2)]] : couleur));
    },

    // Un cylindre (ou un tronc de cône si rayonHaut ≠ rayon).
    cylindre({ rayon, rayonHaut = rayon, hauteur, cotes = 8 }, position, couleur, rotation) {
      ajouterGeometrie(new CylinderGeometry(rayonHaut, rayon, hauteur, cotes, 1),
        matricePlacement(position, rotation), () => couleur);
    },

    // Une sphère à facettes (icosaèdre : 20 faces, ou 80 avec details 1).
    sphere({ rayon, details = 0, echelle = [1, 1, 1] }, position, couleur, rotation) {
      ajouterGeometrie(new IcosahedronGeometry(rayon, details),
        matricePlacement(position, rotation, echelle), () => couleur);
    },

    // Un anneau (roues du fauteuil), à plat dans le plan XY.
    tore({ rayon, epaisseur, cotes = 16 }, position, couleur, rotation) {
      ajouterGeometrie(new TorusGeometry(rayon, epaisseur, 4, cotes), matricePlacement(position, rotation), () => couleur);
    },

    // Une partie de sphère (calotte, sphère ouverte devant…), pour les
    // cheveux et les couvre-chefs. Angles en radians, comme SphereGeometry.
    calotte({ rayon, phiDebut = 0, phiLongueur = Math.PI * 2, thetaDebut = 0, thetaLongueur = Math.PI / 2, segments = 10, anneaux = 4, echelle = [1, 1, 1] }, position, couleur, rotation) {
      const geometrie = new SphereGeometry(rayon, segments, anneaux, phiDebut, phiLongueur, thetaDebut, thetaLongueur);
      ajouterGeometrie(geometrie, matricePlacement(position, rotation, echelle), () => couleur);
    },

    // Un simple quadrilatère horizontal (sol), vu du dessus.
    dalle(x1, z1, x2, z2, y, couleur) {
      // Deux triangles, dans le sens qui les rend visibles d'en haut.
      positions.push(x1, y, z1, x1, y, z2, x2, y, z2, x1, y, z1, x2, y, z2, x2, y, z1);
      for (let i = 0; i < 6; i += 1) {
        normales.push(0, 1, 0);
        couleurs.push(couleur.r, couleur.g, couleur.b);
      }
    },

    // Ajoute une géométrie déjà fabriquée par un autre constructeur.
    ajouterConstruite(geometrie, matrice) {
      const pos = geometrie.getAttribute('position');
      const nor = geometrie.getAttribute('normal');
      const col = geometrie.getAttribute('color');
      matriceNormales.getNormalMatrix(matrice);
      for (let i = 0; i < pos.count; i += 1) {
        v.fromBufferAttribute(pos, i).applyMatrix4(matrice);
        positions.push(v.x, v.y, v.z);
        v.fromBufferAttribute(nor, i).applyMatrix3(matriceNormales).normalize();
        normales.push(v.x, v.y, v.z);
        couleurs.push(col.getX(i), col.getY(i), col.getZ(i));
      }
    },

    get vide() { return positions.length === 0; },

    construire() {
      const geometrie = new BufferGeometry();
      geometrie.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometrie.setAttribute('normal', new Float32BufferAttribute(normales, 3));
      geometrie.setAttribute('color', new Float32BufferAttribute(couleurs, 3));
      geometrie.computeBoundingBox();
      geometrie.computeBoundingSphere();
      return geometrie;
    },
  };
}

/**
 * Ajoute une « recette » de data/meubles.json (liste de formes) à un
 * constructeur. « palette » donne la couleur de chaque nom.
 */
export function ajouterRecette(constructeur, formes, palette) {
  for (const forme of formes) {
    const couleur = palette.couleur(forme.couleur);
    if (forme.forme === 'boite') {
      constructeur.boite(forme.taille, forme.position, couleur, forme.rotation);
    } else if (forme.forme === 'cylindre') {
      constructeur.cylindre(forme, forme.position, couleur, forme.rotation);
    } else if (forme.forme === 'sphere') {
      constructeur.sphere(forme, forme.position, couleur, forme.rotation);
    }
  }
}
