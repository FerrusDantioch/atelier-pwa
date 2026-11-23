// Tests : la grille des lieux, la recherche de chemin et l'accessibilité.
// Le domicile doit être entièrement accessible à pied ET en fauteuil roulant.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chargerDonneesDuDisque } from './aides.mjs';

const { creerGrille, empriseTournee, centreDeCase, caseDuPoint, angleVers } = await import('../js/monde/grille.js');
const {
  trouverChemin, lisserChemin, ligneLibre, caseAtteignableLaPlusProche, casesPourAtteindre,
  casesTraversees, distancesDepuis, longueurChemin,
} = await import('../js/monde/chemin.js');
const { verifierCoherence } = await import('../js/noyau/coherence.js');

const donnees = await chargerDonneesDuDisque();
const catalogue = new Map(donnees.meubles.meubles.map((meuble) => [meuble.id, meuble]));

// Un petit lieu de test : deux pièces de 4 × 4 cases séparées par un mur,
// avec une porte de largeur réglable.
function petitLieu({ porte = 2, meubles = [] } = {}) {
  return {
    id: 'essai',
    nom: 'Essai',
    designation: 'l\'essai',
    chemin: 'essai.json',
    taille: [8, 4],
    hauteurMurs: 2.5,
    depart: { x: 0, z: 0, angle: 0 },
    pieces: [
      { id: 'gauche', nom: 'Gauche', designation: 'la gauche', zones: [[0, 0, 4, 4]], sol: { motif: 'uni', couleurs: ['parquet'] } },
      { id: 'droite', nom: 'Droite', designation: 'la droite', zones: [[4, 0, 4, 4]], sol: { motif: 'uni', couleurs: ['parquet'] } },
    ],
    murs: [{ de: [4, 0], a: [4, 4] }],
    ouvertures: porte > 0 ? [{ type: 'porte', de: [4, 1], a: [4, 1 + porte] }] : [],
    meubles,
    points: [],
  };
}

test('toutes les données (lieux compris) se chargent et s\'accordent', () => {
  assert.ok(donnees.lieux.domicile, 'le domicile est chargé');
  assert.deepEqual(verifierCoherence(donnees), []);
});

test('l\'emprise d\'un meuble tourne avec lui', () => {
  assert.deepEqual(empriseTournee([3, 1], 0), { largeur: 3, profondeur: 1 });
  assert.deepEqual(empriseTournee([3, 1], 90), { largeur: 1, profondeur: 3 });
  assert.deepEqual(empriseTournee([3, 1], 180), { largeur: 3, profondeur: 1 });
  assert.deepEqual(empriseTournee([3, 1], 270), { largeur: 1, profondeur: 3 });
});

test('conversions entre cases, mètres et angles', () => {
  assert.deepEqual(centreDeCase(0, 0), { x: 0.25, z: 0.25 });
  assert.deepEqual(caseDuPoint(1.3, 0.2), { x: 2, z: 0 });
  assert.equal(angleVers(0, 1), 0); // vers le sud
  assert.equal(angleVers(1, 0), 90); // vers l'est
  assert.equal(angleVers(0, -1), 180); // vers le nord
  assert.equal(angleVers(-1, 0), 270); // vers l'ouest
  assert.equal(angleVers(0, 0), null);
});

test('un mur bloque, une porte laisse passer', () => {
  const grille = creerGrille(petitLieu({ porte: 2 }), catalogue);
  assert.equal(grille.murEntre(3, 0, 4, 0), true);
  assert.equal(grille.murEntre(3, 1, 4, 1), false);
  assert.equal(grille.peutAller(3, 0, 4, 0), false);
  assert.equal(grille.peutAller(3, 1, 4, 1), true);
  // Une diagonale ne coupe pas le coin du mur.
  assert.equal(grille.peutAller(3, 0, 4, 1), false);
  // Hors de la grille ou sans sol : impossible.
  assert.equal(grille.peutAller(0, 0, -1, 0), false);
});

test('en fauteuil, il faut un passage d\'au moins 1 m (2 cases)', () => {
  const large = creerGrille(petitLieu({ porte: 2 }), catalogue);
  assert.ok(trouverChemin(large, { x: 0, z: 0 }, { x: 7, z: 3 }, 'fauteuil'), 'porte de 1 m : passage possible');
  const etroite = creerGrille(petitLieu({ porte: 1 }), catalogue);
  assert.ok(trouverChemin(etroite, { x: 0, z: 0 }, { x: 7, z: 3 }, 'pieton'), 'porte de 50 cm : à pied, ça passe');
  assert.equal(trouverChemin(etroite, { x: 0, z: 0 }, { x: 7, z: 3 }, 'fauteuil'), null, 'porte de 50 cm : en fauteuil, non');
});

test('A* trouve le plus court chemin et le lissage garde un chemin possible', () => {
  const grille = creerGrille(petitLieu({ porte: 2 }), catalogue);
  const chemin = trouverChemin(grille, { x: 0, z: 0 }, { x: 7, z: 0 });
  assert.deepEqual(chemin[0], { x: 0, z: 0 });
  assert.deepEqual(chemin.at(-1), { x: 7, z: 0 });
  // Deux diagonales pour contourner le mur : 5 pas droits + 2 diagonales.
  assert.ok(Math.abs(longueurChemin(chemin) - (5 + 2 * Math.SQRT2)) < 1e-9, `longueur ${longueurChemin(chemin)}`);
  const lisse = lisserChemin(grille, chemin);
  assert.ok(lisse.length < chemin.length);
  for (let i = 1; i < lisse.length; i += 1) assert.ok(ligneLibre(grille, lisse[i - 1], lisse[i]));
  assert.equal(ligneLibre(grille, { x: 0, z: 0 }, { x: 7, z: 0 }), false, 'la ligne directe traverse le mur');
});

test('les cases traversées par une ligne droite', () => {
  assert.deepEqual(casesTraversees({ x: 0, z: 0 }, { x: 3, z: 0 }).map((c) => [c.x, c.z]), [[0, 0], [1, 0], [2, 0], [3, 0]]);
  assert.deepEqual(casesTraversees({ x: 0, z: 0 }, { x: 2, z: 2 }).map((c) => [c.x, c.z]), [[0, 0], [1, 1], [2, 2]]);
  const pente = casesTraversees({ x: 0, z: 0 }, { x: 4, z: 1 });
  assert.deepEqual(pente.at(-1), { x: 4, z: 1 });
  for (let i = 1; i < pente.length; i += 1) {
    assert.ok(Math.abs(pente[i].x - pente[i - 1].x) <= 1 && Math.abs(pente[i].z - pente[i - 1].z) <= 1);
  }
});

test('une cible inaccessible mène à la case atteignable la plus proche', () => {
  const lieu = petitLieu({ porte: 2, meubles: [{ id: 'armoire', meuble: 'armoire', x: 0, z: 3, rotation: 0 }] });
  const grille = creerGrille(lieu, catalogue);
  assert.equal(grille.occupant(1, 3), 'armoire');
  assert.deepEqual(caseAtteignableLaPlusProche(grille, { x: 0, z: 0 }, { x: 1, z: 3 }), { x: 1, z: 2 });
  // Pour utiliser l'armoire : les cases qui la touchent, la plus proche d'abord.
  const cases = casesPourAtteindre(grille, grille.emprises.get('armoire'), { x: 0, z: 0 });
  assert.deepEqual(cases.map((c) => [c.x, c.z]).slice(0, 3), [[0, 2], [1, 2], [2, 2]]);
  assert.ok(cases.every((c) => grille.libre(c.x, c.z)));
});

test('le domicile : chaque pièce et chaque meuble à examiner, à pied et en fauteuil', () => {
  const lieu = donnees.lieux.domicile;
  const grille = creerGrille(lieu, catalogue);
  for (const profil of ['pieton', 'fauteuil']) {
    const distances = distancesDepuis(grille, lieu.depart, profil);
    for (const piece of lieu.pieces) {
      const zone = piece.zones[0];
      const dedans = [...distances.keys()].some((cle) => {
        const [x, z] = cle.split(',').map(Number);
        return x >= zone[0] && z >= zone[1] && x < zone[0] + zone[2] && z < zone[1] + zone[3];
      });
      assert.ok(dedans, `${piece.id} (${profil})`);
    }
    for (const place of lieu.meubles.filter((p) => catalogue.get(p.meuble).description)) {
      const cases = casesPourAtteindre(grille, grille.emprises.get(place.id), lieu.depart, profil, distances);
      assert.ok(cases.length > 0, `${place.id} (${profil})`);
    }
  }
  // Chaque pièce a un espace de demi-tour en fauteuil (carré libre de 1,5 m).
  for (const piece of lieu.pieces) {
    const [zx, zz, zl, zp] = piece.zones[0];
    let trouve = false;
    for (let x = zx; x <= zx + zl - 3 && !trouve; x += 1) {
      for (let z = zz; z <= zz + zp - 3 && !trouve; z += 1) {
        let libre = true;
        for (let dx = 0; dx < 3; dx += 1) for (let dz = 0; dz < 3; dz += 1) if (!grille.libre(x + dx, z + dz)) libre = false;
        trouve = libre;
      }
    }
    assert.ok(trouve, `espace de demi-tour dans ${piece.id}`);
  }
});

test('la vérification des données repère les erreurs de lieu, avec des messages clairs', () => {
  const lieu = petitLieu({
    porte: 1,
    meubles: [
      { id: 'lit', meuble: 'lit-double', x: 0, z: 0, rotation: 0 },
      { id: 'mystere', meuble: 'meuble-inconnu', x: 5, z: 0, rotation: 0 },
      { id: 'chevet', meuble: 'table-chevet', x: 1, z: 1, rotation: 0 },
    ],
  });
  lieu.ouvertures.push({ type: 'fenetre', de: [1, 1], a: [2, 1] });
  const problemes = verifierCoherence({ ...donnees, lieux: { essai: lieu } });
  const texte = problemes.join('\n');
  assert.match(texte, /essai\.json › meubles › mystere : le meuble « meuble-inconnu » n'existe pas/);
  assert.match(texte, /essai\.json › meubles › chevet : la case 1,1 est déjà occupée par « lit »/);
  assert.match(texte, /essai\.json › ouvertures › n°2 \(fenetre\) : l'ouverture doit être posée sur un mur/);

  // Un lieu bien formé, mais dont la porte est trop étroite pour un fauteuil.
  const etroit = petitLieu({ porte: 1, meubles: [{ id: 'bureau', meuble: 'bureau', x: 5, z: 3, rotation: 0 }] });
  const problemesEtroit = verifierCoherence({ ...donnees, lieux: { essai: etroit } }).join('\n');
  assert.match(problemesEtroit, /pieces › droite : impossible d'y entrer en fauteuil roulant/);
  assert.match(problemesEtroit, /meubles › bureau : impossible de s'en approcher en fauteuil roulant/);
  assert.doesNotMatch(problemesEtroit, /à pied/);
});

test('une couleur ou une option de personnage inconnue est signalée', () => {
  const meubles = structuredClone(donnees.meubles);
  meubles.meubles[0].formes[0].couleur = 'bois-introuvable';
  const personnages = structuredClone(donnees.personnages);
  personnages.options.coiffure.push({ id: 'crete', nom: 'Crête' });
  personnages.defaut.teint = 'vert-pomme';
  const problemes = verifierCoherence({ ...donnees, meubles, personnages }).join('\n');
  assert.match(problemes, /data\/meubles\.json › lit-double › formes › n°1 : la couleur « bois-introuvable » n'existe pas/);
  assert.match(problemes, /options › coiffure : « crete » n'est pas une forme connue du jeu/);
  assert.match(problemes, /defaut › teint : « vert-pomme » n'existe pas/);
});

test('les places des personnages sont atteignables avec LEUR façon de se déplacer', () => {
  // Halaé (fauteuil roulant) ne peut pas entrer dans le recoin d'une case
  // entre les deux chaises et la table de la cuisine.
  const pnj = structuredClone(donnees.pnj);
  const lieu = structuredClone(donnees.lieux.domicile);
  lieu.points.push({ id: 'recoin', x: 14, z: 6, angle: 90 });
  pnj.pnj.find((p) => p.id === 'halae').routine[0].point = 'recoin';
  const problemes = verifierCoherence({ ...donnees, pnj, lieux: { ...donnees.lieux, domicile: lieu } }).join('\n');
  assert.match(problemes, /pnj › halae › routine › n°1 : le point « recoin » n'est pas atteignable en fauteuil roulant/);
  // Théo, à pied, y arriverait.
  pnj.pnj.find((p) => p.id === 'halae').routine[0].point = 'table-cuisine';
  pnj.pnj.find((p) => p.id === 'theo').routine.find((c) => c.lieu === 'domicile').point = 'recoin';
  assert.deepEqual(verifierCoherence({ ...donnees, pnj, lieux: { ...donnees.lieux, domicile: lieu } }), []);
});

test('on ne peut pas examiner un meuble à travers un mur', () => {
  const lieu = petitLieu({ porte: 2, meubles: [{ id: 'plante', meuble: 'plante', x: 4, z: 0, rotation: 0 }] });
  const grille = creerGrille(lieu, catalogue);
  const cases = casesPourAtteindre(grille, grille.emprises.get('plante'), { x: 0, z: 0 });
  // La case (3, 0) est de l'autre côté du mur x = 4 : exclue.
  assert.equal(cases.some((c) => c.x === 3 && c.z === 0), false);
  assert.ok(cases.some((c) => c.x === 4 && c.z === 1));
});

test('en fauteuil, une ligne oblique ne frôle pas le coin d\'un obstacle', () => {
  const lieu = {
    id: 'essai', nom: 'Essai', designation: 'l\'essai', chemin: 'essai.json',
    taille: [8, 8], hauteurMurs: 2.3, depart: { x: 1, z: 1, angle: 0 },
    pieces: [{ id: 'salle', nom: 'Salle', designation: 'la salle', zones: [[0, 0, 8, 8]], sol: { motif: 'uni', couleurs: ['parquet'] } }],
    murs: [], ouvertures: [],
    meubles: [{ id: 'pilier', meuble: 'plante', x: 3, z: 2, rotation: 0 }],
    points: [],
  };
  const grille = creerGrille(lieu, catalogue);
  // De (1, 1) à (5, 3), la ligne droite frôle le pilier (3, 2) : refusée en fauteuil.
  assert.equal(ligneLibre(grille, { x: 1, z: 1 }, { x: 5, z: 3 }, 'fauteuil'), false);
  const chemin = trouverChemin(grille, { x: 1, z: 1 }, { x: 5, z: 3 }, 'fauteuil');
  const lisse = lisserChemin(grille, chemin, 'fauteuil');
  assert.ok(lisse.length > 2, 'le lissage garde un point de contournement');
});

test('la vérification repère une pièce sans espace de demi-tour et plus de deux PNJ simultanés', () => {
  const etroit = {
    id: 'etroit', nom: 'Étroit', designation: 'l\'étroit', chemin: 'etroit.json',
    taille: [6, 2], hauteurMurs: 2.3, depart: { x: 0, z: 0, angle: 0 },
    pieces: [{ id: 'couloir', nom: 'Couloir', designation: 'le couloir', zones: [[0, 0, 6, 2]], sol: { motif: 'uni', couleurs: ['parquet'] } }],
    murs: [], ouvertures: [], meubles: [], points: [],
  };
  const problemesDemiTour = verifierCoherence({ ...donnees, lieux: { ...donnees.lieux, etroit } }).join('\n');
  assert.match(problemesDemiTour, /etroit\.json › pieces › couloir : aucun espace de demi-tour en fauteuil roulant/);

  const pnj = structuredClone(donnees.pnj);
  // 3 personnages en même temps au domicile à 10 h (Halaé + Ferrus + Théo).
  pnj.pnj.find((p) => p.id === 'theo').routine.unshift({
    de: '10:00', a: '11:00', lieu: 'domicile', point: 'table-cuisine-est', activite: 'visite',
  });
  const problemesLimite = verifierCoherence({ ...donnees, pnj }).join('\n');
  assert.match(problemesLimite, /domicile à 10:00 : 3 personnages ensemble/);
});

test('la salle d\'eau est fermée par des parois hautes (les autres pièces restent ouvertes)', () => {
  const pieces = donnees.lieux.domicile.pieces;
  assert.equal(pieces.find((p) => p.id === 'salle-d-eau').paroisHautes, true);
  assert.deepEqual(pieces.filter((p) => p.paroisHautes).map((p) => p.id), ['salle-d-eau']);
});

test('une affiche se pose sur un mur extérieur, sans ouverture derrière, avec un point à examiner', () => {
  const domicile = donnees.lieux.domicile;
  assert.deepEqual(domicile.affiches.map((affiche) => affiche.id), ['affiche-omni']);
  const point = domicile.points.find((p) => p.id === 'affiche-omni');
  assert.equal(point.lien, 'siteOmni', 'l\'adresse vient de js/config.js, jamais des données');
  const copie = JSON.parse(JSON.stringify(domicile));
  copie.affiches.push(
    { id: 'interieure', dessin: 'omni', de: [10, 1], a: [10, 3], largeur: 0.6, bas: 1, haut: 1.8 },
    { id: 'sur-fenetre', dessin: 'omni', de: [3, 0], a: [6, 0], largeur: 0.6, bas: 1, haut: 1.8 },
    { id: 'trop-large', dessin: 'omni', de: [0, 19], a: [0, 20], largeur: 2, bas: 1, haut: 1.8 },
    { id: 'trop-haute', dessin: 'omni', de: [0, 19], a: [0, 21], largeur: 0.6, bas: 1, haut: 3.5 },
    { id: 'sans-point', dessin: 'omni', de: [0, 19], a: [0, 21], largeur: 0.6, bas: 1, haut: 1.8, point: 'nulle-part' },
  );
  const texte = verifierCoherence({ ...donnees, lieux: { ...donnees.lieux, domicile: copie } }).join('\n');
  assert.match(texte, /affiches › interieure : une affiche se pose sur un mur extérieur/);
  assert.match(texte, /affiches › sur-fenetre : une porte ou une fenêtre est derrière l'affiche/);
  assert.match(texte, /affiches › trop-large : l'affiche \(2 m\) est plus large que son morceau de mur \(0\.5 m\)/);
  assert.match(texte, /affiches › trop-haute : « bas » doit être sous « haut », et « haut » sous le plafond/);
  assert.match(texte, /affiches › sans-point › point : « nulle-part » n'est pas un point à examiner/);
});
