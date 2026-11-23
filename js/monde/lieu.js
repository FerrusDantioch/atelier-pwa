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
// Une pièce encore fermée (jalon 5, voir js/jeu/lieux.js) a un sol de
// chantier, sans meubles, et ses portes sont closes : vue de la pièce
// voisine, c'est un mur avec une porte fermée.
//
// Tout le décor fixe (socle, sol, meubles) forme UNE seule géométrie, et les
// murs une autre : deux dessins par image, c'est très léger pour la tablette.
// Les affiches (une image contre un mur extérieur, voir affiches.js) sont
// visibles quand leur mur est entier.
// =============================================================================

import {
  Box3, EdgesGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshLambertMaterial, PlaneGeometry, Vector3,
} from '../../lib/three/three.module.js';
import { creerConstructeur, matiereDecor, matiereParoi } from '../modeles/formes.js';
import { creerAtelierDeMeubles } from '../modeles/meubles.js';
import { TAILLE_CASE } from './grille.js';

const HAUTEUR_COUPEE = 0.35;
const EPAISSEUR = 0.12;
const MARGE_SOCLE = 0.6;
const BAS_FENETRE = 0.85;
const HAUT_OUVERTURE = 2.0;
const CHAPEAU_PAROI = 0.06; // le bord opaque en haut d'une paroi translucide
const DEPASSE = 0.015; // les traverses d'une fenêtre dépassent de 1,5 cm (voir plus bas)

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

  // Pour déterminer les murs extérieurs, on compte TOUTES les pièces du
  // bâtiment (y compris celles encore fermées) : une cloison intérieure qui
  // borde une pièce fermée ne doit jamais devenir une façade extérieure.
  const [largeur, profondeur] = lieu.taille;
  const dansBatiment = new Set();
  for (const piece of lieu.pieces) {
    for (const [zx, zz, zl, zp] of piece.zones) {
      for (let x = zx; x < zx + zl; x += 1) {
        for (let z = zz; z < zz + zp; z += 1) {
          if (x >= 0 && z >= 0 && x < largeur && z < profondeur) dansBatiment.add(`${x},${z}`);
        }
      }
    }
  }
  const solBatiment = (x, z) => dansBatiment.has(`${x},${z}`);
  const piecesHautes = new Set(lieu.pieces.filter((piece) => piece.paroisHautes).map((piece) => piece.id));
  const haute = (x, z) => piecesHautes.has(grille.piece(x, z));
  for (const [cle, bord] of bords) {
    const [avant, apres] = bord.sens === 'h'
      ? [solBatiment(bord.debut, bord.ligne - 1), solBatiment(bord.debut, bord.ligne)]
      : [solBatiment(bord.ligne - 1, bord.debut), solBatiment(bord.ligne, bord.debut)];
    bord.exterieur = avant !== apres;
    bord.haute = !bord.exterieur && (bord.sens === 'h'
      ? haute(bord.debut, bord.ligne - 1) || haute(bord.debut, bord.ligne)
      : haute(bord.ligne - 1, bord.debut) || haute(bord.ligne, bord.debut));
    // La normale pointe vers le dehors (le côté sans pièce).
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

  // Les bords perpendiculaires qui touchent chaque bout d'un tronçon : sert
  // à fermer les coins proprement sans superposition de faces (scintillement).
  const bordsPerpendiculaires = (sens, x, z) => (sens === 'h'
    ? [bords.get(`v ${x},${z - 1}`), bords.get(`v ${x},${z}`)]
    : [bords.get(`h ${x - 1},${z}`), bords.get(`h ${x},${z}`)]).filter(Boolean);
  for (const troncon of troncons) {
    const [xDebut, zDebut, xFin, zFin] = troncon.sens === 'h'
      ? [troncon.debut, troncon.ligne, troncon.fin, troncon.ligne]
      : [troncon.ligne, troncon.debut, troncon.ligne, troncon.fin];
    troncon.perpDebut = bordsPerpendiculaires(troncon.sens, xDebut, zDebut);
    troncon.perpFin = bordsPerpendiculaires(troncon.sens, xFin, zFin);
  }
  return { troncons, bords };
}

/**
 * Construit le lieu. Renvoie :
 *   groupe            le groupe 3D à ajouter à la scène
 *   cibles            ce qu'on peut toucher du doigt : [{ type, id, boite }]
 *   tournerMurs(r)    reconstruit les murs pour la rotation r de la caméra
 *   montrerContours(oui)  traits sombres autour des formes (contraste élevé)
 *   liberer()
 */
// dessinerAffiche(affiche) → la texture d'une affiche (affiches.js) ; sans
// elle (tests sans navigateur), les affiches ne sont pas posées.
export function construireLieu({ lieu, grille, catalogue, palette, dessinerAffiche = null }) {
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
  // Le sol de chantier des pièces encore fermées.
  for (const piece of lieu.pieces.filter((p) => p.verrouillee)) {
    for (const [zx, zz, zl, zp] of piece.zones) {
      for (let x = zx; x < zx + zl; x += 1) {
        for (let z = zz; z < zz + zp; z += 1) {
          const couleur = c((x + z) % 2 === 0 ? 'beton' : 'beton-2');
          decor.dalle(x * TAILLE_CASE, z * TAILLE_CASE, (x + 1) * TAILLE_CASE, (z + 1) * TAILLE_CASE, 0, couleur);
        }
      }
    }
  }
  for (const place of lieu.meubles) atelier.poser(decor, place);

  const meshDecor = new Mesh(decor.construire(), matiereDecor());
  meshDecor.name = 'decor';
  groupe.add(meshDecor);

  const { troncons, bords } = preparerTroncons(lieu, grille);

  // Quel mur extérieur regarde un point (ex. porte d'entrée) ? Sert à adapter
  // la hauteur de sa boîte de clic quand son mur est coupé.
  function normaleDuMurDePoint(point) {
    const dx = Math.round(Math.sin(point.angle * Math.PI / 180));
    const dz = Math.round(Math.cos(point.angle * Math.PI / 180));
    let bord = null;
    if (dx === -1) bord = bords.get(`v ${point.x},${point.z}`);
    else if (dx === 1) bord = bords.get(`v ${point.x + 1},${point.z}`);
    else if (dz === -1) bord = bords.get(`h ${point.x},${point.z}`);
    else if (dz === 1) bord = bords.get(`h ${point.x},${point.z + 1}`);
    return bord?.exterieur ? bord.normale : null;
  }

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
    const boiteForme = new Box3().setFromObject(forme);
    const boite = boiteForme.isEmpty()
      ? new Box3(
        new Vector3(emprise.x * TAILLE_CASE, 0, emprise.z * TAILLE_CASE),
        new Vector3((emprise.x + emprise.largeur) * TAILLE_CASE, hauteur, (emprise.z + emprise.profondeur) * TAILLE_CASE),
      )
      : boiteForme;
    cibles.push({
      type: 'meuble',
      id,
      examinable,
      hauteur,
      forme,
      boite,
    });
  }
  const ciblesPoints = [];
  for (const point of (lieu.points || []).filter((p) => p.description)) {
    const angle = point.angle * Math.PI / 180;
    const boiteCoupee = new Box3(
      new Vector3(point.x * TAILLE_CASE, 0, point.z * TAILLE_CASE),
      new Vector3((point.x + 1) * TAILLE_CASE, HAUTEUR_COUPEE, (point.z + 1) * TAILLE_CASE),
    );
    boiteCoupee.expandByPoint(new Vector3(
      (point.x + 0.5 + Math.sin(angle) * 0.75) * TAILLE_CASE,
      0,
      (point.z + 0.5 + Math.cos(angle) * 0.75) * TAILLE_CASE,
    ));
    const boiteEntiere = boiteCoupee.clone();
    boiteEntiere.max.y = HAUT_OUVERTURE;
    const cible = { type: 'point', id: point.id, examinable: true, hauteur: HAUTEUR_COUPEE, boite: boiteCoupee.clone() };
    cibles.push(cible);
    ciblesPoints.push({ cible, boiteCoupee, boiteEntiere, normale: normaleDuMurDePoint(point) });
  }

  // --- Les affiches : une image contre un mur extérieur ------------------------
  // Posée 1,5 cm devant le mur (deux faces au même endroit scintilleraient).
  // Toucher l'affiche mène au point d'où on l'examine (seulement quand son mur est entier).
  const affiches = [];
  for (const affiche of dessinerAffiche ? lieu.affiches || [] : []) {
    const [x1, z1] = affiche.de;
    const [x2, z2] = affiche.a;
    const leLongDeZ = x1 === x2;
    const ligne = (leLongDeZ ? x1 : z1) * TAILLE_CASE;
    const milieu = ((leLongDeZ ? z1 + z2 : x1 + x2) / 2) * TAILLE_CASE;
    const versInterieur = ligne === 0 ? 1 : -1;
    const ecart = EPAISSEUR / 2 + DEPASSE;
    const mesh = new Mesh(
      new PlaneGeometry(affiche.largeur, affiche.haut - affiche.bas),
      new MeshLambertMaterial({ map: dessinerAffiche(affiche) }),
    );
    mesh.name = `affiche-${affiche.id}`;
    const y = (affiche.bas + affiche.haut) / 2;
    if (leLongDeZ) {
      mesh.position.set(ligne + versInterieur * ecart, y, milieu);
      mesh.rotation.y = versInterieur * Math.PI / 2;
    } else {
      mesh.position.set(milieu, y, ligne + versInterieur * ecart);
      mesh.rotation.y = versInterieur > 0 ? 0 : Math.PI;
    }
    mesh.updateMatrixWorld(true);
    groupe.add(mesh);
    // La direction vers l'extérieur du mur (pour savoir s'il est entier).
    const normale = leLongDeZ ? { x: -versInterieur, z: 0 } : { x: 0, z: -versInterieur };
    affiches.push({ id: affiche.id, mesh, normale });
    const entreePoint = affiche.point ? ciblesPoints.find((p) => p.cible.id === affiche.point) : null;
    if (entreePoint) {
      entreePoint.boiteEntiere.union(new Box3().setFromObject(mesh));
      if (!entreePoint.normale) entreePoint.normale = normale;
    }
  }

  // --- Les murs (selon la rotation de la caméra) ------------------------------
  const hauteurMurs = lieu.hauteurMurs;
  let meshMurs = null;
  let rotationMurs = null;

  function construireMurs(rotation) {
    const camera = directionCamera(rotation);
    const murs = creerConstructeur();
    const mur = c('mur');
    const coupe = c('mur-coupe');
    const facade = c('facade');

    const estEntier = (bord) => bord.exterieur && (bord.normale.x * camera.x + bord.normale.z * camera.z) < 0;
    const hauteurDe = (bord) => {
      const ouv = bord.ouverture === null ? null : lieu.ouvertures[bord.ouverture];
      if (ouv && ouv.type === 'porte' && !estEntier(bord)) return 0;
      return estEntier(bord) ? hauteurMurs : HAUTEUR_COUPEE;
    };
    // Qui possède le poteau d'angle (EPAISSEUR × EPAISSEUR) à un bout de tronçon ?
    // Le mur le plus haut gagne ; à hauteur égale, le mur extérieur passe devant
    // une cloison intérieure ; à nature égale, le mur horizontal prolonge et le
    // mur vertical s'arrête au ras : zéro face superposée, zéro scintillement.
    const decalageBout = (troncon, hauteur, perp) => {
      if (perp.length === 0) return 0;
      const hMax = Math.max(...perp.map(hauteurDe));
      if (hMax === 0) return 0;
      if (hauteur > hMax) return EPAISSEUR / 2;
      if (hauteur < hMax) return -EPAISSEUR / 2;
      const perpExterieur = perp.some((p) => p.exterieur);
      if (troncon.exterieur && !perpExterieur) return EPAISSEUR / 2;
      if (!troncon.exterieur && perpExterieur) return -EPAISSEUR / 2;
      return troncon.sens === 'h' ? EPAISSEUR / 2 : -EPAISSEUR / 2;
    };
    // Si un mur extérieur se prolonge dans un angle extérieur, sa face de bout
    // donne sur la façade et prend la couleur « facade ».
    const facesDeBout = (troncon, decDebut, decFin) => {
      const faces = {};
      if (!troncon.exterieur) return faces;
      if (troncon.sens === 'h') {
        if (decDebut > 0 && troncon.perpDebut.some((p) => p.exterieur && p.normale.x < 0)) faces.nx = facade;
        if (decFin > 0 && troncon.perpFin.some((p) => p.exterieur && p.normale.x > 0)) faces.px = facade;
      } else {
        if (decDebut > 0 && troncon.perpDebut.some((p) => p.exterieur && p.normale.z < 0)) faces.nz = facade;
        if (decFin > 0 && troncon.perpFin.some((p) => p.exterieur && p.normale.z > 0)) faces.pz = facade;
      }
      return faces;
    };

    // Une boîte de mur entre deux hauteurs, sur une partie du tronçon.
    const morceau = (troncon, debut, fin, bas, haut, faces = {}) => {
      if (haut - bas <= 0.001 || fin - debut <= 0.001) return;
      const exterieur = troncon.exterieur ? troncon.normale : null;
      const couleurs = { px: mur, nx: mur, py: coupe, ny: mur, pz: mur, nz: mur, ...faces };
      if (exterieur) {
        if (exterieur.x > 0) couleurs.px = facade;
        if (exterieur.x < 0) couleurs.nx = facade;
        if (exterieur.z > 0) couleurs.pz = facade;
        if (exterieur.z < 0) couleurs.nz = facade;
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
      const entier = estEntier(troncon);
      const hauteur = entier ? hauteurMurs : HAUTEUR_COUPEE;
      const d = troncon.debut * TAILLE_CASE;
      const f = troncon.fin * TAILLE_CASE;
      const ouverture = troncon.ouverture === null ? null : lieu.ouvertures[troncon.ouverture];
      const decDebut = ouverture ? 0 : decalageBout(troncon, hauteur, troncon.perpDebut);
      const decFin = ouverture ? 0 : decalageBout(troncon, hauteur, troncon.perpFin);
      const debut = d - decDebut;
      const fin = f + decFin;
      const faces = facesDeBout(troncon, decDebut, decFin);

      if (troncon.haute) {
        // Paroi haute : le bord opaque du haut (en évitant de chevaucher un
        // mur extérieur entier ou une autre paroi haute perpendiculaire).
        const decalageChapeau = (perp) => {
          if (perp.some((p) => estEntier(p))) return -EPAISSEUR / 2;
          if (perp.some((p) => p.haute)) return troncon.sens === 'h' ? EPAISSEUR / 2 : -EPAISSEUR / 2;
          return 0;
        };
        const dCap = d - (ouverture ? 0 : decalageChapeau(troncon.perpDebut));
        const fCap = f + (ouverture ? 0 : decalageChapeau(troncon.perpFin));
        morceau(troncon, dCap, fCap, hauteurMurs - CHAPEAU_PAROI, hauteurMurs);
        if (ouverture) {
          element(troncon, d, d + 0.06, 0, HAUT_OUVERTURE, c('cadre'));
          element(troncon, f - 0.06, f, 0, HAUT_OUVERTURE, c('cadre'));
          element(troncon, d, f, HAUT_OUVERTURE - 0.06, HAUT_OUVERTURE, c('cadre'));
        }
      }
      if (!ouverture) {
        morceau(troncon, debut, fin, 0, hauteur, faces);
        continue;
      }
      const cadre = c('cadre');
      if (ouverture.type === 'fenetre') {
        if (!entier) {
          morceau(troncon, debut, fin, 0, hauteur, faces);
          continue;
        }
        morceau(troncon, debut, fin, 0, BAS_FENETRE, faces);
        morceau(troncon, debut, fin, HAUT_OUVERTURE, hauteur, faces);
        element(troncon, d, f, BAS_FENETRE, HAUT_OUVERTURE, c('vitre'), EPAISSEUR * 0.3);
        // Les traverses du bas et du haut dépassent un peu dans l'ouverture :
        // deux faces exactement au même endroit (le dessus du mur et celui de
        // l'appui) « scintilleraient » quand la vue bouge, la carte graphique
        // hésitant à chaque image entre les deux.
        element(troncon, d, f, BAS_FENETRE - 0.05, BAS_FENETRE + DEPASSE, cadre);
        element(troncon, d, f, HAUT_OUVERTURE - DEPASSE, HAUT_OUVERTURE + 0.05, cadre);
        element(troncon, d, d + 0.05, BAS_FENETRE, HAUT_OUVERTURE, cadre);
        element(troncon, f - 0.05, f, BAS_FENETRE, HAUT_OUVERTURE, cadre);
        if (f - d > 1.2) element(troncon, (d + f) / 2 - 0.025, (d + f) / 2 + 0.025, BAS_FENETRE, HAUT_OUVERTURE, cadre);
        continue;
      }
      // Porte : un passage libre (aucune marche). Sur un mur entier, un
      // linteau au-dessus et un cadre ; la porte d'entrée est fermée. La
      // porte d'une pièce encore fermée (« porte-fermee ») : un battant
      // clos sur un mur entier, ou un seuil de porte bois reconnaissable sur
      // une cloison coupée (sans mur opaque qui cacherait la pièce voisine).
      const close = ouverture.type === 'porte-entree' || ouverture.type === 'porte-fermee';
      if (ouverture.type === 'porte-fermee' && !entier) {
        element(troncon, d, d + 0.06, 0, hauteur, c('porte'));
        element(troncon, f - 0.06, f, 0, hauteur, c('porte'));
        element(troncon, d + 0.06, f - 0.06, 0, hauteur, c('bois'), EPAISSEUR * 0.65);
        continue;
      }
      if (entier) {
        morceau(troncon, debut, fin, HAUT_OUVERTURE, hauteur, faces);
        element(troncon, d, d + 0.06, 0, HAUT_OUVERTURE, c('porte'));
        element(troncon, f - 0.06, f, 0, HAUT_OUVERTURE, c('porte'));
        element(troncon, d, f, HAUT_OUVERTURE - 0.06, HAUT_OUVERTURE, c('porte'));
        if (close) {
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
  const epaisseurParoi = EPAISSEUR * 0.6;
  const decalageParoi = (troncon, perp) => {
    if (perp.some((p) => p.exterieur)) return -EPAISSEUR / 2;
    if (perp.some((p) => p.haute)) return troncon.sens === 'h' ? epaisseurParoi / 2 : -epaisseurParoi / 2;
    return 0;
  };
  for (const troncon of troncons.filter((t) => t.haute)) {
    const ouverture = troncon.ouverture === null ? null : lieu.ouvertures[troncon.ouverture];
    const bas = ouverture ? HAUT_OUVERTURE : HAUTEUR_COUPEE;
    const haut = hauteurMurs - CHAPEAU_PAROI;
    const debut = troncon.debut * TAILLE_CASE - (ouverture ? 0 : decalageParoi(troncon, troncon.perpDebut));
    const fin = troncon.fin * TAILLE_CASE + (ouverture ? 0 : decalageParoi(troncon, troncon.perpFin));
    const milieu = (debut + fin) / 2;
    const taille = troncon.sens === 'h' ? [fin - debut, haut - bas, epaisseurParoi] : [epaisseurParoi, haut - bas, fin - debut];
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
    // Une affiche et la boîte de clic d'une porte/affiche s'adaptent à la
    // hauteur réelle de leur mur (entier ou coupé à 35 cm).
    const camera = directionCamera(r);
    for (const { mesh, normale } of affiches) mesh.visible = normale.x * camera.x + normale.z * camera.z < 0;
    for (const entree of ciblesPoints) {
      const entier = entree.normale && (entree.normale.x * camera.x + entree.normale.z * camera.z) < 0;
      const source = entier ? entree.boiteEntiere : entree.boiteCoupee;
      entree.cible.boite.copy(source);
      entree.cible.hauteur = source.max.y;
    }
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
    // Les affiches visibles (pour les tests).
    affichesVisibles: () => affiches.filter((affiche) => affiche.mesh.visible).map((affiche) => affiche.id),
    liberer() {
      for (const { mesh } of affiches) {
        mesh.geometry.dispose();
        mesh.material.map?.dispose();
        mesh.material.dispose();
      }
      meshDecor.geometry.dispose();
      meshMurs?.geometry.dispose();
      meshParois?.geometry.dispose();
      montrerContours(false);
      matiereContour.dispose();
      atelier.liberer();
    },
  };
}
