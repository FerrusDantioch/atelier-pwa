// =============================================================================
// grille.js — le sol d'un lieu découpé en cases de 50 cm
// -----------------------------------------------------------------------------
// Chaque lieu (data/lieux/*.json) est posé sur une grille : une case fait
// 50 cm de côté. La grille sait :
//   - quelles cases ont un sol (elles appartiennent à une pièce) ;
//   - quelles cases sont occupées par un meuble ;
//   - où sont les murs (ils passent ENTRE les cases, sur les lignes de la
//     grille), et où les portes les interrompent ;
//   - si l'on peut passer d'une case à sa voisine, à pied ou en fauteuil.
//
// Deux façons de se déplacer (« profils ») :
//   - « pieton » (à pied, avec ou sans canne) : une case libre suffit ;
//   - « fauteuil » (fauteuil roulant) : il faut au moins 1 m de large,
//     soit un carré libre de 2 × 2 cases autour du passage. Une porte ou un
//     couloir de 50 cm ne passe pas ; une porte de 1 m, oui.
//
// Coordonnées : x vers la droite (est), z vers le bas du plan (sud).
// La case (x, z) couvre, dans la scène 3D, le carré
//   [x × 0,5 m ; (x + 1) × 0,5 m] × [z × 0,5 m ; (z + 1) × 0,5 m].
//
// Ce module n'utilise ni la 3D ni la page : il est testé avec node --test.
// =============================================================================

export const TAILLE_CASE = 0.5; // mètres

export const PROFILS = ['pieton', 'fauteuil'];

// Le profil de déplacement selon l'aide à la mobilité choisie.
export function profilDeDeplacement(aide) {
  return aide === 'fauteuil' ? 'fauteuil' : 'pieton';
}

// L'emprise au sol d'un meuble posé, en cases, selon sa rotation.
// rotation 0 : la face avant regarde le sud (+z) ; 90 : l'est ; 180 : le
// nord ; 270 : l'ouest. Les rotations de 90 et 270 échangent largeur et
// profondeur.
export function empriseTournee(emprise, rotation) {
  const [largeur, profondeur] = emprise;
  return rotation === 90 || rotation === 270
    ? { largeur: profondeur, profondeur: largeur }
    : { largeur, profondeur };
}

const cle = (x, z) => `${x},${z}`;

/**
 * Fabrique la grille d'un lieu.
 *   lieu       : le contenu d'un fichier data/lieux/*.json
 *   catalogue  : les meubles de data/meubles.json, rangés par id (Map ou objet)
 */
export function creerGrille(lieu, catalogue) {
  const [largeur, profondeur] = lieu.taille;
  const trouverMeuble = (id) => (catalogue instanceof Map ? catalogue.get(id) : catalogue[id]);

  const dansLaGrille = (x, z) => x >= 0 && z >= 0 && x < largeur && z < profondeur;

  // --- Pièces : quelle pièce (et donc quel sol) pour chaque case -----------
  // Une pièce encore fermée (« verrouillee », voir js/jeu/lieux.js) n'a pas
  // de sol praticable : on n'y entre pas.
  const pieces = new Array(largeur * profondeur).fill(null);
  for (const piece of lieu.pieces) {
    if (piece.verrouillee) continue;
    for (const [zx, zz, zl, zp] of piece.zones) {
      for (let x = zx; x < zx + zl; x += 1) {
        for (let z = zz; z < zz + zp; z += 1) {
          if (dansLaGrille(x, z)) pieces[z * largeur + x] = piece.id;
        }
      }
    }
  }

  // --- Murs : bords bloqués entre deux cases --------------------------------
  // « h x,z » : bord horizontal sur la ligne z, entre les cases (x, z-1) et (x, z)
  // « v x,z » : bord vertical sur la ligne x, entre les cases (x-1, z) et (x, z)
  const bordsBloques = new Set();
  const parcourirSegment = (de, a, action) => {
    const [x1, z1] = de;
    const [x2, z2] = a;
    if (z1 === z2) {
      for (let x = Math.min(x1, x2); x < Math.max(x1, x2); x += 1) action(`h ${cle(x, z1)}`);
    } else if (x1 === x2) {
      for (let z = Math.min(z1, z2); z < Math.max(z1, z2); z += 1) action(`v ${cle(x1, z)}`);
    }
  };
  for (const mur of lieu.murs) parcourirSegment(mur.de, mur.a, (bord) => bordsBloques.add(bord));
  for (const ouverture of lieu.ouvertures || []) {
    if (ouverture.type === 'porte' || ouverture.type === 'porte-entree') {
      parcourirSegment(ouverture.de, ouverture.a, (bord) => bordsBloques.delete(bord));
    }
  }

  // Y a-t-il un mur entre deux cases voisines (côte à côte) ?
  function murEntre(x1, z1, x2, z2) {
    if (z1 === z2 && Math.abs(x1 - x2) === 1) return bordsBloques.has(`v ${cle(Math.max(x1, x2), z1)}`);
    if (x1 === x2 && Math.abs(z1 - z2) === 1) return bordsBloques.has(`h ${cle(x1, Math.max(z1, z2))}`);
    return false;
  }

  // --- Meubles : emprises au sol ----------------------------------------------
  const occupants = new Array(largeur * profondeur).fill(null);
  const emprises = new Map();
  for (const place of lieu.meubles || []) {
    const meuble = trouverMeuble(place.meuble);
    if (!meuble) continue; // signalé par la vérification des données
    const { largeur: l, profondeur: p } = empriseTournee(meuble.emprise, place.rotation || 0);
    const bloque = meuble.bloque !== false;
    emprises.set(place.id, { id: place.id, x: place.x, z: place.z, largeur: l, profondeur: p, bloque, place, meuble });
    if (!bloque) continue;
    for (let x = place.x; x < place.x + l; x += 1) {
      for (let z = place.z; z < place.z + p; z += 1) {
        if (dansLaGrille(x, z)) occupants[z * largeur + x] = place.id;
      }
    }
  }

  const piece = (x, z) => (dansLaGrille(x, z) ? pieces[z * largeur + x] : null);
  const occupant = (x, z) => (dansLaGrille(x, z) ? occupants[z * largeur + x] : null);
  // Une case libre : elle a un sol et aucun meuble ne la bloque.
  const libre = (x, z) => piece(x, z) !== null && occupant(x, z) === null;

  // Passage d'une case à sa voisine directe (sans diagonale), à pied.
  const passageDroit = (x1, z1, x2, z2) => libre(x2, z2) && libre(x1, z1) && !murEntre(x1, z1, x2, z2);

  // --- Carrés de 2 × 2 cases libres (pour le fauteuil) -----------------------
  // Le carré « (bx, bz) » couvre les cases bx..bx+1 × bz..bz+1. Il est libre si
  // ses quatre cases sont libres et qu'aucun mur ne le traverse.
  const carres = new Array(largeur * profondeur).fill(false);
  for (let bx = 0; bx < largeur - 1; bx += 1) {
    for (let bz = 0; bz < profondeur - 1; bz += 1) {
      carres[bz * largeur + bx] = libre(bx, bz) && libre(bx + 1, bz) && libre(bx, bz + 1) && libre(bx + 1, bz + 1)
        && !murEntre(bx, bz, bx + 1, bz) && !murEntre(bx, bz + 1, bx + 1, bz + 1)
        && !murEntre(bx, bz, bx, bz + 1) && !murEntre(bx + 1, bz, bx + 1, bz + 1);
    }
  }
  const carreLibre = (bx, bz) => bx >= 0 && bz >= 0 && bx < largeur - 1 && bz < profondeur - 1 && carres[bz * largeur + bx];

  /**
   * Peut-on aller de la case (x1, z1) à sa voisine (x2, z2) ?
   * Les diagonales ne « coupent » jamais un coin de mur ou de meuble.
   */
  function peutAller(x1, z1, x2, z2, profil = 'pieton') {
    const dx = x2 - x1;
    const dz = z2 - z1;
    if (Math.abs(dx) > 1 || Math.abs(dz) > 1 || (dx === 0 && dz === 0)) return false;
    if (!libre(x2, z2)) return false;
    const diagonale = dx !== 0 && dz !== 0;

    if (profil === 'fauteuil') {
      if (diagonale) return carreLibre(Math.min(x1, x2), Math.min(z1, z2));
      if (dz === 0) {
        const bx = Math.min(x1, x2);
        return carreLibre(bx, z1 - 1) || carreLibre(bx, z1);
      }
      const bz = Math.min(z1, z2);
      return carreLibre(x1 - 1, bz) || carreLibre(x1, bz);
    }

    if (!diagonale) return passageDroit(x1, z1, x2, z2);
    // Diagonale à pied : les deux chemins « en L » doivent être possibles.
    return passageDroit(x1, z1, x2, z1) && passageDroit(x2, z1, x2, z2)
      && passageDroit(x1, z1, x1, z2) && passageDroit(x1, z2, x2, z2);
  }

  // Une case où l'on peut se tenir avec ce profil.
  function caseAccessible(x, z, profil = 'pieton') {
    if (!libre(x, z)) return false;
    if (profil !== 'fauteuil') return true;
    return carreLibre(x - 1, z - 1) || carreLibre(x, z - 1) || carreLibre(x - 1, z) || carreLibre(x, z);
  }

  // Les cases voisines atteignables depuis (x, z), avec le coût du pas.
  const DIRECTIONS = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
  ];
  function voisines(x, z, profil = 'pieton') {
    const resultat = [];
    for (const [dx, dz, cout] of DIRECTIONS) {
      if (peutAller(x, z, x + dx, z + dz, profil)) resultat.push({ x: x + dx, z: z + dz, cout });
    }
    return resultat;
  }

  return {
    largeur,
    profondeur,
    lieu,
    emprises,
    dansLaGrille,
    piece,
    occupant,
    libre,
    murEntre,
    peutAller,
    caseAccessible,
    voisines,
    // Les bords bloqués (pour les tests et l'affichage de mise au point).
    bordsBloques,
  };
}

// --- Conversions entre cases et mètres ------------------------------------------

// Le centre d'une case, en mètres.
export function centreDeCase(x, z) {
  return { x: (x + 0.5) * TAILLE_CASE, z: (z + 0.5) * TAILLE_CASE };
}

// La case qui contient un point (en mètres).
export function caseDuPoint(px, pz) {
  return { x: Math.floor(px / TAILLE_CASE), z: Math.floor(pz / TAILLE_CASE) };
}

// L'angle (en degrés, 0 = vers le sud, 90 = vers l'est) d'un déplacement.
// Même convention que la rotation des meubles.
export function angleVers(dx, dz) {
  if (dx === 0 && dz === 0) return null;
  const degres = Math.atan2(dx, dz) * 180 / Math.PI;
  return (degres + 360) % 360;
}
