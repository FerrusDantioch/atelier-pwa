// =============================================================================
// lieux.js — les lieux débloqués, les pièces à ouvrir, les trajets (jalon 5)
// -----------------------------------------------------------------------------
// Le joueur commence à son domicile. Avec des pièces et de la réputation, il
// loue les bureaux de l'atelier (boutique.js, article de sorte « lieu »),
// puis ouvre leurs pièces une à une (articles de sorte « piece ») : salle
// de pause, salle de réunion, coin calme…
//
// Ce qui est « ouvert » dans une partie : les lieux débloqués
// (partie.lieux.debloques) et les pièces achetées. Une pièce d'un lieu
// marquée « ouverture » (data/lieux/*.json) reste fermée tant que cette
// ouverture n'est pas achetée :
//   - on ne peut pas y entrer (son sol est un chantier, sa porte est fermée) ;
//   - ses meubles et ses points n'apparaissent qu'une fois ouverte ;
//   - un point marqué « fermee » (devant la porte) n'existe que tant
//     qu'elle est fermée : on peut l'examiner pour savoir comment l'ouvrir.
// Un créneau de routine marqué « si » (data/pnj.json) n'a lieu que si
// cette ouverture est faite : un personnage ne vient aux bureaux qu'une fois
// qu'ils existent.
//
// JavaScript pur (sans page ni 3D) : testé par tests/lieux-ouverts.test.mjs.
// =============================================================================

import { POINT_D_ARRIVEE } from './routines.js';

// Tout ce qui est ouvert dans la partie : les lieux débloqués et les pièces
// achetées (identifiants des articles de la boutique).
export function ouvertures(partie) {
  const ouvertes = new Set(partie.lieux.debloques);
  for (const possession of partie.possessions || []) {
    if (possession.sorte === 'piece' || possession.sorte === 'lieu') ouvertes.add(possession.article);
  }
  return ouvertes;
}

// Les ouvertures qu'un lieu prévoit (ses pièces à ouvrir).
export function ouverturesDuLieu(lieu) {
  return [...new Set(lieu.pieces.map((piece) => piece.ouverture).filter(Boolean))];
}

// Les cases d'une pièce.
function casesDeLaPiece(piece) {
  const cases = new Set();
  for (const [x0, z0, l, p] of piece.zones) {
    for (let x = x0; x < x0 + l; x += 1) for (let z = z0; z < z0 + p; z += 1) cases.add(`${x},${z}`);
  }
  return cases;
}

// Les cases de part et d'autre d'une ouverture (porte, fenêtre).
function casesDeChaqueCote([x1, z1], [x2, z2]) {
  const cases = [];
  if (z1 === z2) {
    for (let x = Math.min(x1, x2); x < Math.max(x1, x2); x += 1) cases.push(`${x},${z1 - 1}`, `${x},${z1}`);
  } else {
    for (let z = Math.min(z1, z2); z < Math.max(z1, z2); z += 1) cases.push(`${x1 - 1},${z}`, `${x1},${z}`);
  }
  return cases;
}

/**
 * Le lieu tel qu'il est avec ces ouvertures (une copie si quelque chose
 * change) : les pièces encore fermées sont marquées « verrouillee » (sans
 * sol praticable), leurs meubles et leurs points sont retirés, et leurs
 * portes deviennent des « porte-fermee » (un mur avec une porte close).
 * Les points « fermee » disparaissent quand leur pièce est ouverte.
 */
export function lieuSelonOuvertures(lieu, ouvertes) {
  const fermees = lieu.pieces.filter((piece) => piece.ouverture && !ouvertes.has(piece.ouverture));
  const aRetirer = (lieu.points || []).some((point) => point.fermee && ouvertes.has(point.fermee));
  if (fermees.length === 0 && !aRetirer) return lieu;
  const casesFermees = new Set(fermees.flatMap((piece) => [...casesDeLaPiece(piece)]));
  const idsFermees = new Set(fermees.map((piece) => piece.id));
  const dedans = (x, z) => casesFermees.has(`${x},${z}`);
  return {
    ...lieu,
    pieces: lieu.pieces.map((piece) => (idsFermees.has(piece.id) ? { ...piece, verrouillee: true } : piece)),
    meubles: lieu.meubles.filter((place) => !dedans(place.x, place.z)),
    points: (lieu.points || []).filter((point) => !dedans(point.x, point.z) && !(point.fermee && ouvertes.has(point.fermee))),
    ouvertures: lieu.ouvertures.map((ouverture) => {
      if (ouverture.type !== 'porte') return ouverture;
      const versFermee = casesDeChaqueCote(ouverture.de, ouverture.a).some((cle) => casesFermees.has(cle));
      return versFermee ? { ...ouverture, type: 'porte-fermee' } : ouverture;
    }),
  };
}

// Les états d'un lieu à vérifier : tout fermé, chaque pièce ouverte seule,
// et tout ouvert. Renvoie [{ nom, ouvertes: Set }] (« nom » pour les messages).
export function etatsAVerifier(lieu) {
  const liste = ouverturesDuLieu(lieu);
  if (liste.length === 0) return [{ nom: null, ouvertes: new Set() }];
  return [
    { nom: 'tout fermé', ouvertes: new Set() },
    ...liste.map((id) => ({ nom: `${id} ouvert`, ouvertes: new Set([id]) })),
    ...(liste.length > 1 ? [{ nom: 'tout ouvert', ouvertes: new Set(liste) }] : []),
  ];
}

/**
 * Où l'on arrive en entrant dans un lieu : devant la porte d'entrée, le dos
 * à la porte (sinon, le point de départ du lieu). { x, z, angle }.
 */
export function arriveeDans(lieu) {
  const porte = (lieu.points || []).find((point) => point.id === POINT_D_ARRIVEE);
  if (!porte) return { x: lieu.depart.x, z: lieu.depart.z, angle: lieu.depart.angle };
  return { x: porte.x, z: porte.z, angle: (porte.angle + 180) % 360 };
}

/**
 * L'heure d'arrivée après un trajet de « duree » minutes, sans dépasser la
 * fin de la journée (à cette heure-là, le temps s'arrête de toute façon).
 */
export function heureApresTrajet(minute, duree, fin) {
  return Math.max(minute, Math.min(fin, minute + Math.max(0, duree)));
}

// Les autres lieux où l'on peut aller depuis « actuel » (débloqués, dans
// l'ordre de data/lieux/index.json).
export function lieuxOuOnPeutAller(partie, index) {
  return index.filter((entree) => entree.id !== partie.lieux.actuel && partie.lieux.debloques.includes(entree.id))
    .map((entree) => entree.id);
}
