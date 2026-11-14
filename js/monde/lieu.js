// =============================================================================
// lieu.js — construire un lieu en 3D (sol, murs, portes, fenêtres, meubles)
// -----------------------------------------------------------------------------
// Le lieu est posé sur un socle d'herbe, comme une maison de poupée vue de
// trois quarts. Pour voir à l'intérieur, les murs sont « coupés » :
//   - les deux murs extérieurs du fond (ceux qui tournent le dos à la
//     caméra) sont entiers, avec leurs fenêtres et la porte d'entrée ;
//   - tous les autres (murs de devant, cloisons intérieures) sont coupés à
//     hauteur de genou : ils montrent le plan sans rien cacher ;
//   - les cloisons d'une pièce à « paroisHautes » (la salle d'eau) montent
//     jusqu'au plafond : opaques jusqu'au genou, translucides au-dessus (on
//     voit bien la séparation, sans rien cacher derrière).
// Quand la caméra tourne, les murs coupés changent : ils sont reconstruits.
//
// Tout le décor fixe (socle, sol, meubles) forme UNE seule géométrie, et les
// murs une autre : deux dessins par image, c'est très léger pour la tablette.
// =============================================================================

import {
  Box3, EdgesGeometry, Group, LineBasicMaterial, LineSegments, Mesh, Vector3,
} from '../../lib/three/three.module.js';
import { creerConstructeur, matiereDecor, matiereParoi } from '../modeles/formes.js';
import { creerAtelierDeMeubles } from '../modeles/meubles.js';
import { TAILLE_CASE } from './grille.js';

const HAUTEUR_COUPEE = 0.45;
const EPAISSEUR = 0.12;
const MARGE_SOCLE = 0.6;
const BAS_FENETRE = 0.9;
const HAUT_OUVERTURE = 2.1;
const CHAPEAU_PAROI = 0.06; // le bord opaque en haut d'une paroi translucide

// La direction de la caméra (vue de dessus) pour une rotation donnée : 0 =
// caméra au sud-est, puis par quarts de tour.
export function directionCamera(rotation) {
  const angle = (45 + 90 * rotation) * Math.PI / 180;
  return { x: Math.sin(angle), z: Math.cos(angle) };
}

// Les murs découpés en petits bords d'une case, regroupés en « tronçons »
// identiques (même ligne, même ouverture, même côté extérieur).
function preparerTroncons(lieu, grille) {
  const ouvertureDuBord = new Map();
  lieu.ouvertures.forEach((ouverture, index) => {
    const [x1, z1] = ouverture.de;
    const [x2, z2] = ouverture.a;
    if (z1 === z2) for (let x = Math.min(x1, x2); x < Math.max(x1, x2); x += 1) ouvertureDuBord.set(`h ${x},${z1}`, index);
    else for (let z = Math.min(z1, z2); z < Math.max(z1, z2); z += 1) ouvertureDuBord.set(`v ${x1},${z}`, index);
  });

  const bords = new Map();
  for (const mur of lieu.murs) {
    const [x1, z1] = mur.de;
    const [x2, z2] = mur.a;
    if (z1 === z2) {
      for (let x = Math.min(x1, x2); x < Math.max(x1, x2); x += 1) bords.set(`h ${x},${z1}`, { sens: 'h', ligne: z1, debut: x });
    } else {
      for (let z = Math.min(z1, z2); z < Math.max(z1, z2); z += 1) bords.set(`v ${x1},${z}`, { sens: 'v', ligne: x1, debut: z });
    }
  }

  // Pour chaque bord : extérieur ? de quel côté ? quelle ouverture ? paroi
  // haute (il borde une pièce à « paroisHautes ») ?
  const sol = (x, z) => grille.piece(x, z) !== null;
  const piecesHautes = new Set(lieu.pieces.filter((piece) => piece.paroisHautes).map((piece) => piece.id));
  const haute = (x, z) => piecesHautes.has(grille.piece(x, z));
  for (const [cle, bord] of bords) {
    const [avant, apres] = bord.sens === 'h'
      ? [sol(bord.debut, bord.ligne - 1), sol(bord.debut, bord.ligne)]
      : [sol(bord.ligne - 1, bord.debut), sol(bord.ligne, bord.debut)];
    bord.exterieur = avant !== apres;
    bord.haute = !bord.exterieur && (bord.sens === 'h'
      ? haute(bord.debut, bord.ligne - 1) || haute(bord.debut, bord.ligne)
      : haute(bord.ligne - 1, bord.debut) || haute(bord.ligne, bord.debut));
    // La normale pointe vers le dehors (le côté sans sol).
    if (bord.exterieur) {
      const signe = avant ? 1 : -1;
      bord.normale = bord.sens === 'h' ? { x: 0, z: signe } : { x: signe, z: 0 };
    }
    bord.ouverture = ouvertureDuBord.has(cle) ? ouvertureDuBord.get(cle) : null;
  }

  // Regroupement des bords voisins identiques.
  const troncons = [];
  const tries = [...bords.values()].sort((a, b) => (a.sens.localeCompare(b.sens)) || (a.ligne - b.ligne) || (a.debut - b.debut));
  for (const bord of tries) {
    const dernier = troncons[troncons.length - 1];
    const memeNormale = (a, b) => (!a && !b) || (a && b && a.x === b.x && a.z === b.z);
    if (dernier && dernier.sens === bord.sens && dernier.ligne === bord.ligne && dernier.fin === bord.debut
      && dernier.ouverture === bord.ouverture && dernier.exterieur === bord.exterieur && dernier.haute === bord.haute
      && memeNormale(dernier.normale, bord.normale)) {
      dernier.fin += 1;
    } else {
      troncons.push({ ...bord, fin: bord.debut + 1 });
    }
  }

  // Un tronçon se prolonge d'une demi-épaisseur à chaque bout qui touche un
  // mur perpendiculaire : les coins sont bien fermés.
  const murPerpendiculaire = (sens, x, z) => (sens === 'h'
    ? bords.has(`v ${x},${z - 1}`) || bords.has(`v ${x},${z}`)
    : bords.has(`h ${x - 1},${z}`) || bords.has(`h ${x},${z}`));
  for (const troncon of troncons) {
    const [xDebut, zDebut, xFin, zFin] = troncon.sens === 'h'
      ? [troncon.debut, troncon.ligne, troncon.fin, troncon.ligne]
      : [troncon.ligne, troncon.debut, troncon.ligne, troncon.fin];
    troncon.prolongeDebut = murPerpendiculaire(troncon.sens, xDebut, zDebut) ? EPAISSEUR / 2 : 0;
    troncon.prolongeFin = murPerpendiculaire(troncon.sens, xFin, zFin) ? EPAISSEUR / 2 : 0;
  }
  return troncons;
}

/**
 * Construit le lieu. Renvoie :
 *   groupe            le groupe 3D à ajouter à la scène
 *   cibles            ce qu'on peut toucher du doigt : [{ type, id, boite }]
 *   tournerMurs(r)    reconstruit les murs pour la rotation r de la caméra
 *   montrerContours(oui)  traits sombres autour des formes (contraste élevé)
 *   liberer()
 */
export function construireLieu({ lieu, grille, catalogue, palette }) {
  const groupe = new Group();
  groupe.name = `lieu-${lieu.id}`;
  const atelier = creerAtelierDeMeubles(catalogue, palette);
  const c = (nom) => palette.couleur(nom);
  const [largeur, profondeur] = lieu.taille;
  const L = largeur * TAILLE_CASE;
  const P = profondeur * TAILLE_CASE;

  // --- Le décor fixe : socle, sol, meubles -----------------------------------
  const decor = creerConstructeur();
  decor.boite(
    [L + 2 * MARGE_SOCLE, 0.3, P + 2 * MARGE_SOCLE],
    [L / 2, -0.155, P / 2],
    { px: c('terre'), nx: c('terre'), py: c('herbe'), ny: c('terre'), pz: c('terre'), nz: c('terre') },
  );

  const solDe = new Map(lieu.pieces.map((piece) => [piece.id, piece.sol]));
  for (let x = 0; x < largeur; x += 1) {
    for (let z = 0; z < profondeur; z += 1) {
      const piece = grille.piece(x, z);
      if (!piece) continue;
      const sol = solDe.get(piece);
      let indice = 0;
      if (sol.motif === 'damier') indice = (x + z) % 2;
      else if (sol.motif === 'lames') indice = (z + Math.floor((x + (z % 2) * 2) / 4)) % 2;
      const couleur = c(sol.couleurs[Math.min(indice, sol.couleurs.length - 1)]);
      decor.dalle(x * TAILLE_CASE, z * TAILLE_CASE, (x + 1) * TAILLE_CASE, (z + 1) * TAILLE_CASE, 0, couleur);
    }
  }
  for (const place of lieu.meubles) atelier.poser(decor, place);

  const meshDecor = new Mesh(decor.construire(), matiereDecor());
  meshDecor.name = 'decor';
  groupe.add(meshDecor);

  // --- Ce qu'on peut toucher : meubles et points d'intérêt -------------------
  const cibles = [];
  for (const [id, emprise] of grille.emprises) {
    const meuble = emprise.meuble;
    const examinable = Boolean(emprise.place.description || meuble.description);
    if (!emprise.bloque && !examinable) continue; // un tapis : on marche dessus
    const hauteur = Math.max(atelier.hauteur(meuble.id), 0.3);
    // Pour savoir précisément si le doigt touche le meuble, on garde sa
    // vraie forme (pas seulement la boîte qui l'entoure).
    const forme = new Mesh(atelier.geometrie(meuble.id), matiereDecor());
    forme.matrixAutoUpdate = false;
    forme.matrix.copy(atelier.matrice(emprise.place));
    forme.updateMatrixWorld(true);
    cibles.push({
      type: 'meuble',
      id,
      examinable,
      hauteur,
      forme,
      boite: new Box3(
        new Vector3(emprise.x * TAILLE_CASE, 0, emprise.z * TAILLE_CASE),
        new Vector3((emprise.x + emprise.largeur) * TAILLE_CASE, hauteur, (emprise.z + emprise.profondeur) * TAILLE_CASE),
      ),
    });
  }
  for (const point of (lieu.points || []).filter((p) => p.description)) {
    const angle = point.angle * Math.PI / 180;
    const boite = new Box3(
      new Vector3(point.x * TAILLE_CASE, 0, point.z * TAILLE_CASE),
      new Vector3((point.x + 1) * TAILLE_CASE, HAUT_OUVERTURE, (point.z + 1) * TAILLE_CASE),
    );
    // La boîte s'étend vers ce que le point regarde (la porte dans le mur).
    boite.expandByPoint(new Vector3((point.x + 0.5 + Math.sin(angle) * 1.1) * TAILLE_CASE, 0, (point.z + 0.5 + Math.cos(angle) * 1.1) * TAILLE_CASE));
    cibles.push({ type: 'point', id: point.id, examinable: true, hauteur: HAUT_OUVERTURE, boite });
  }

  // --- Les murs (selon la rotation de la caméra) ------------------------------
  const troncons = preparerTroncons(lieu, grille);
  const hauteurMurs = lieu.hauteurMurs;
  let meshMurs = null;
  let rotationMurs = null;

  function construireMurs(rotation) {
    const camera = directionCamera(rotation);
    const murs = creerConstructeur();
    const mur = c('mur');
    const coupe = c('mur-coupe');

    // Une boîte de mur entre deux hauteurs, sur une partie du tronçon.
    const morceau = (troncon, debut, fin, bas, haut, faces = {}) => {
      if (haut - bas <= 0.001 || fin - debut <= 0.001) return;
      const exterieur = troncon.exterieur ? troncon.normale : null;
      const couleurs = { px: mur, nx: mur, py: coupe, ny: mur, pz: mur, nz: mur, ...faces };
      if (exterieur) {
        if (exterieur.x > 0) couleurs.px = c('facade');
        if (exterieur.x < 0) couleurs.nx = c('facade');
        if (exterieur.z > 0) couleurs.pz = c('facade');
        if (exterieur.z < 0) couleurs.nz = c('facade');
      }
      const milieu = (debut + fin) / 2;
      const longueur = fin - debut;
      if (troncon.sens === 'h') {
        murs.boite([longueur, haut - bas, EPAISSEUR], [milieu, (bas + haut) / 2, troncon.ligne * TAILLE_CASE], couleurs);
      } else {
        murs.boite([EPAISSEUR, haut - bas, longueur], [troncon.ligne * TAILLE_CASE, (bas + haut) / 2, milieu], couleurs);
      }
    };

    // Un petit élément (cadre, vitre, porte) placé dans l'épaisseur du mur.
    const element = (troncon, debut, fin, bas, haut, couleur, epaisseur = EPAISSEUR * 1.15) => {
      const milieu = (debut + fin) / 2;
      const longueur = fin - debut;
      if (troncon.sens === 'h') {
        murs.boite([longueur, haut - bas, epaisseur], [milieu, (bas + haut) / 2, troncon.ligne * TAILLE_CASE], couleur);
      } else {
        murs.boite([epaisseur, haut - bas, longueur], [troncon.ligne * TAILLE_CASE, (bas + haut) / 2, milieu], couleur);
      }
    };

    for (const troncon of troncons) {
      const entier = troncon.exterieur
        && (troncon.normale.x * camera.x + troncon.normale.z * camera.z) < 0;
      const hauteur = entier ? hauteurMurs : HAUTEUR_COUPEE;
      const debut = troncon.debut * TAILLE_CASE - troncon.prolongeDebut;
      const fin = troncon.fin * TAILLE_CASE + troncon.prolongeFin;
      const ouverture = troncon.ouverture === null ? null : lieu.ouvertures[troncon.ouverture];

      const d = troncon.debut * TAILLE_CASE;
      const f = troncon.fin * TAILLE_CASE;
      if (troncon.haute) {
        // Paroi haute : le bord opaque du haut, et le cadre d'une porte.
        morceau(troncon, debut, fin, hauteurMurs - CHAPEAU_PAROI, hauteurMurs);
        if (ouverture) {
          element(troncon, d, d + 0.06, 0, HAUT_OUVERTURE, c('cadre'));
          element(troncon, f - 0.06, f, 0, HAUT_OUVERTURE, c('cadre'));
          element(troncon, d, f, HAUT_OUVERTURE - 0.06, HAUT_OUVERTURE, c('cadre'));
        }
      }
      if (!ouverture) {
        morceau(troncon, debut, fin, 0, hauteur);
        continue;
      }
      const cadre = c('cadre');
      if (ouverture.type === 'fenetre') {
        if (!entier) {
          morceau(troncon, debut, fin, 0, hauteur);
          continue;
        }
        morceau(troncon, debut, fin, 0, BAS_FENETRE);
        morceau(troncon, debut, fin, HAUT_OUVERTURE, hauteur);
        element(troncon, d, f, BAS_FENETRE, HAUT_OUVERTURE, c('vitre'), EPAISSEUR * 0.3);
        element(troncon, d, f, BAS_FENETRE - 0.05, BAS_FENETRE, cadre);
        element(troncon, d, f, HAUT_OUVERTURE, HAUT_OUVERTURE + 0.05, cadre);
        element(troncon, d, d + 0.05, BAS_FENETRE, HAUT_OUVERTURE, cadre);
        element(troncon, f - 0.05, f, BAS_FENETRE, HAUT_OUVERTURE, cadre);
        if (f - d > 1.2) element(troncon, (d + f) / 2 - 0.025, (d + f) / 2 + 0.025, BAS_FENETRE, HAUT_OUVERTURE, cadre);
        continue;
      }
      // Porte : un passage libre (aucune marche). Sur un mur entier, un
      // linteau au-dessus et un cadre ; la porte d'entrée est fermée.
      if (entier) {
        morceau(troncon, debut, fin, HAUT_OUVERTURE, hauteur);
        element(troncon, d, d + 0.06, 0, HAUT_OUVERTURE, c('porte'));
        element(troncon, f - 0.06, f, 0, HAUT_OUVERTURE, c('porte'));
        element(troncon, d, f, HAUT_OUVERTURE - 0.06, HAUT_OUVERTURE, c('porte'));
        if (ouverture.type === 'porte-entree') {
          element(troncon, d + 0.06, f - 0.06, 0, HAUT_OUVERTURE - 0.06, c('bois'), EPAISSEUR * 0.5);
          // La poignée, du côté intérieur.
          const dedans = troncon.normale ? -1 : 1;
          const decalage = (EPAISSEUR * 0.25 + 0.03) * dedans;
          const positionPoignee = f - 0.2;
          if (troncon.sens === 'h') {
            murs.boite([0.12, 0.03, 0.04], [positionPoignee, 1.0, troncon.ligne * TAILLE_CASE + decalage * troncon.normale.z], c('poignee'));
          } else {
            murs.boite([0.04, 0.03, 0.12], [troncon.ligne * TAILLE_CASE + decalage * troncon.normale.x, 1.0, positionPoignee], c('poignee'));
          }
        }
      }
    }
    return murs.construire();
  }

  // --- Les parois translucides (elles ne dépendent pas de la caméra) ---------
  const parois = creerConstructeur();
  for (const troncon of troncons.filter((t) => t.haute)) {
    const ouverture = troncon.ouverture === null ? null : lieu.ouvertures[troncon.ouverture];
    const bas = ouverture ? HAUT_OUVERTURE : HAUTEUR_COUPEE;
    const haut = hauteurMurs - CHAPEAU_PAROI;
    const debut = troncon.debut * TAILLE_CASE - troncon.prolongeDebut;
    const fin = troncon.fin * TAILLE_CASE + troncon.prolongeFin;
    const milieu = (debut + fin) / 2;
    const taille = troncon.sens === 'h' ? [fin - debut, haut - bas, EPAISSEUR * 0.6] : [EPAISSEUR * 0.6, haut - bas, fin - debut];
    const position = troncon.sens === 'h'
      ? [milieu, (bas + haut) / 2, troncon.ligne * TAILLE_CASE]
      : [troncon.ligne * TAILLE_CASE, (bas + haut) / 2, milieu];
    parois.boite(taille, position, c('mur'));
  }
  let meshParois = null;
  if (!parois.vide) {
    meshParois = new Mesh(parois.construire(), matiereParoi());
    meshParois.name = 'parois';
    meshParois.renderOrder = 1; // après le reste (elle est translucide)
    groupe.add(meshParois);
  }

  function tournerMurs(rotation) {
    const r = ((rotation % 4) + 4) % 4;
    if (r === rotationMurs) return false;
    rotationMurs = r;
    const geometrie = construireMurs(r);
    if (meshMurs) {
      meshMurs.geometry.dispose();
      meshMurs.geometry = geometrie;
    } else {
      meshMurs = new Mesh(geometrie, matiereDecor());
      meshMurs.name = 'murs';
      groupe.add(meshMurs);
    }
    if (contours) mettreAJourContours();
    return true;
  }

  // --- Contours (contraste élevé) ---------------------------------------------
  let contours = null;
  const matiereContour = new LineBasicMaterial({ color: c('contour') });
  function mettreAJourContours() {
    if (contours) {
      contours.children.forEach((ligne) => ligne.geometry.dispose());
      groupe.remove(contours);
    }
    contours = new Group();
    contours.name = 'contours';
    for (const mesh of [meshDecor, meshMurs, meshParois]) {
      if (!mesh) continue;
      contours.add(new LineSegments(new EdgesGeometry(mesh.geometry, 30), matiereContour));
    }
    groupe.add(contours);
  }
  function montrerContours(oui) {
    if (oui && !contours) mettreAJourContours();
    if (!oui && contours) {
      contours.children.forEach((ligne) => ligne.geometry.dispose());
      groupe.remove(contours);
      contours = null;
    }
  }

  return {
    groupe,
    cibles,
    largeur: L,
    profondeur: P,
    hauteurMurs,
    tournerMurs,
    montrerContours,
    liberer() {
      meshDecor.geometry.dispose();
      meshMurs?.geometry.dispose();
      meshParois?.geometry.dispose();
      montrerContours(false);
      matiereContour.dispose();
      atelier.liberer();
    },
  };
}
