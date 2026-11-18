// Tests : poser les meubles achetés (jalon 5). Un meuble ne se pose que là
// où il ne gêne personne, et le jeu dit pourquoi il refuse.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chargerDonneesDuDisque } from './aides.mjs';

const {
  aUnEspaceDeDemiTour, coinDepuisMilieu, lieuAmenage, meublesPoses, meublesRanges, milieuDepuisCoin, placeDe,
  placesDesHabitants, poserMeuble, problemesDAcces, retirerMeuble, trierMeublesPoses, trouverPlace, verifierPlacement,
} = await import('../js/jeu/amenagement.js');
const { creerGrille } = await import('../js/monde/grille.js');
const { nouvellePartie } = await import('../js/noyau/format-sauvegarde.js');

const donnees = await chargerDonneesDuDisque();
const catalogue = new Map(donnees.meubles.meubles.map((meuble) => [meuble.id, meuble]));
const domicile = donnees.lieux.domicile;
const habitants = placesDesHabitants(domicile, donnees.pnj.pnj, donnees.personnages);

const essai = (meuble, x, z, options = {}) => verifierPlacement({
  lieu: domicile, catalogue, habitants, place: { id: 'achat-99', meuble, x, z, rotation: 0, ...options.place }, ...options,
});

test('le domicile est accessible, avec un espace de demi-tour dans chaque pièce', () => {
  const grille = creerGrille(domicile, catalogue);
  assert.deepEqual(problemesDAcces(domicile, grille, catalogue), []);
  for (const piece of domicile.pieces) assert.ok(aUnEspaceDeDemiTour(grille, piece), piece.id);
});

test('les places des habitants, avec leur façon de se déplacer', () => {
  const halae = habitants.find((h) => h.id === 'halae');
  assert.equal(halae.profil, 'fauteuil');
  assert.ok(halae.points.some((point) => point.x === 10 && point.z === 14), 'sa place au bureau de montage');
  assert.equal(habitants.find((h) => h.id === 'theo').profil, 'pieton');
  assert.equal(habitants.find((h) => h.id === 'ferrus').nom, 'Ferrus', 'le mentor prend le nom de Ferrus');
  assert.equal(habitants.some((h) => h.id === 'madeleine'), false, 'qui ne vient pas n\'a pas de place');
});

test('un meuble se pose au milieu du séjour', () => {
  assert.deepEqual(essai('cactus', 9, 10), { ok: true });
  assert.deepEqual(essai('fauteuil', 8, 9), { ok: true });
  assert.deepEqual(essai('tapis-rond', 6, 9), { ok: true });
});

test('les refus simples : dehors, mur, place prise, quelqu\'un là', () => {
  assert.equal(essai('cactus', 25, 3).raison, 'dehors');
  assert.equal(essai('fauteuil', 3, 6).raison, 'mur', 'à cheval sur le mur de la chambre');
  const surCanape = essai('pouf', 14, 10);
  assert.equal(surCanape.raison, 'chevauche');
  assert.equal(surCanape.designation, 'le canapé');
  assert.equal(essai('tapis-rond', 15, 9).raison, 'chevauche', 'un tapis ne va pas sur un autre tapis');
  assert.equal(essai('cactus', 17, 9).ok, true, 'un meuble peut aller sur un tapis');
  const personne = essai('cactus', 9, 10, { occupants: [{ x: 9, z: 10, nom: 'Halaé' }] });
  assert.deepEqual(personne, { ok: false, raison: 'personne', nom: 'Halaé', joueur: false });
  assert.equal(essai('cactus', 9, 10, { occupants: [{ x: 9, z: 10, joueur: true }] }).joueur, true);
  assert.equal(essai('tapis-rond', 8, 9, { occupants: [{ x: 9, z: 10, joueur: true }] }).ok, true, 'un tapis passe sous les pieds');
});

test('un meuble qui couperait un passage est refusé, en disant ce qui deviendrait inaccessible', () => {
  // Devant la porte de la chambre.
  const porte = essai('etagere-basse', 5, 7);
  assert.equal(porte.ok, false);
  assert.equal(porte.raison, 'acces');
  assert.equal(porte.profil, 'pieton', 'plus personne ne passe');
  assert.equal(porte.designation, 'la chambre');
  // Quelque part, un petit meuble ne gêne qu'en fauteuil roulant (il laisse
  // un passage de 50 cm, trop étroit).
  let seulementEnFauteuil = null;
  for (let x = 0; x < 20 && !seulementEnFauteuil; x += 1) {
    for (let z = 0; z < 16 && !seulementEnFauteuil; z += 1) {
      const resultat = essai('cactus', x, z);
      if (resultat.raison === 'acces' && resultat.profil === 'fauteuil') seulementEnFauteuil = resultat;
    }
  }
  assert.ok(seulementEnFauteuil, 'un endroit où seul le fauteuil est gêné');
  assert.ok(seulementEnFauteuil.designation);
});

test('la place d\'un habitant reste libre et atteignable', () => {
  const resultat = essai('cactus', 10, 14);
  assert.deepEqual(resultat, { ok: false, raison: 'place', nom: 'Halaé' });
});

test('chaque pièce garde un espace de demi-tour en fauteuil', () => {
  let demiTour = null;
  for (let x = 8; x < 13 && !demiTour; x += 1) {
    for (let z = 0; z < 7 && !demiTour; z += 1) {
      const resultat = essai('cactus', x, z);
      if (resultat.raison === 'demiTour') demiTour = resultat;
    }
  }
  assert.ok(demiTour, 'dans la salle d\'eau, un cactus mal placé supprime le dernier espace de demi-tour');
  assert.equal(demiTour.designation, 'la salle d\'eau');
});

test('le personnage ne se retrouve jamais enfermé', () => {
  // Une petite pièce : on ferme le coin où se tient le personnage.
  const lieu = {
    id: 'essai', nom: 'Essai', designation: 'l\'essai', taille: [6, 6], hauteurMurs: 2.5,
    depart: { x: 4, z: 4, angle: 0 },
    pieces: [{ id: 'piece', nom: 'Pièce', designation: 'la pièce', zones: [[0, 0, 6, 6]], sol: { motif: 'uni', couleurs: ['parquet'] } }],
    murs: [], ouvertures: [], meubles: [], points: [],
  };
  const joueur = { x: 0, z: 0, profil: 'pieton' };
  const etagere = { id: 'achat-1', meuble: 'etagere-basse', x: 1, z: 0, rotation: 90 };
  assert.deepEqual(verifierPlacement({ lieu, catalogue, place: etagere, joueur }), { ok: true });
  const pouf = { id: 'achat-2', meuble: 'pouf', x: 0, z: 1, rotation: 0 };
  assert.deepEqual(verifierPlacement({ lieu, catalogue, poses: [etagere], place: pouf, joueur }), { ok: false, raison: 'coince' });
});

test('poser, déplacer, ranger : la partie garde où est chaque meuble', () => {
  const partie = nouvellePartie({ graine: 1, depart: donnees.jeu.depart, versionJeu: 'test' });
  partie.possessions.push(
    { id: 'achat-1', article: 'cactus', sorte: 'meuble', jour: 1, prix: 10 },
    { id: 'achat-2', article: 'pouf', sorte: 'meuble', jour: 1, prix: 20 },
    { id: 'achat-3', article: 'grand-ecran', sorte: 'materiel', jour: 1, prix: 90 },
  );
  assert.deepEqual(meublesRanges(partie).map((p) => p.id), ['achat-1', 'achat-2'], 'le matériel n\'est jamais « rangé »');
  poserMeuble(partie, 'domicile', { id: 'achat-1', x: 9, z: 10, rotation: 0 });
  assert.deepEqual(meublesPoses(partie, 'domicile'), [{ id: 'achat-1', meuble: 'cactus', x: 9, z: 10, rotation: 0 }]);
  poserMeuble(partie, 'domicile', { id: 'achat-1', x: 8, z: 11, rotation: 90 });
  assert.equal(partie.lieux.amenagements.domicile.length, 1, 'déplacé, pas copié');
  assert.deepEqual(placeDe(partie, 'achat-1'), { lieu: 'domicile', place: { id: 'achat-1', x: 8, z: 11, rotation: 90 } });
  assert.deepEqual(meublesRanges(partie).map((p) => p.id), ['achat-2']);
  retirerMeuble(partie, 'achat-1');
  assert.deepEqual(partie.lieux.amenagements, {});
  assert.equal(placeDe(partie, 'achat-1'), null);
  const lieu = lieuAmenage(domicile, [{ id: 'achat-2', meuble: 'pouf', x: 9, z: 9, rotation: 0 }]);
  assert.equal(lieu.meubles.length, domicile.meubles.length + 1);
  assert.equal(domicile.meubles.some((m) => m.id === 'achat-2'), false, 'le lieu d\'origine ne change pas');
});

test('tourner un meuble le fait pivoter autour de sa case du milieu', () => {
  const fauteuil = catalogue.get('fauteuil');
  const etagere = catalogue.get('etagere-basse');
  assert.deepEqual(coinDepuisMilieu(etagere, 0, { x: 5, z: 5 }), { x: 5, z: 5 });
  assert.deepEqual(coinDepuisMilieu(etagere, 90, { x: 5, z: 5 }), { x: 5, z: 5 });
  assert.deepEqual(coinDepuisMilieu(catalogue.get('tapis-rond'), 0, { x: 5, z: 5 }), { x: 4, z: 4 });
  assert.deepEqual(milieuDepuisCoin(fauteuil, 0, { x: 4, z: 4 }), { x: 4, z: 4 });
  assert.deepEqual(milieuDepuisCoin(catalogue.get('tapis-rond'), 0, { x: 4, z: 4 }), { x: 5, z: 5 });
});

test('la place libre la plus proche est trouvée tout de suite', () => {
  const debut = performance.now();
  const place = trouverPlace({
    lieu: domicile, catalogue, habitants, place: { id: 'achat-1', meuble: 'fauteuil' }, depuis: { x: 9, z: 12 },
    joueur: { x: 9, z: 12, profil: 'fauteuil' }, occupants: [{ x: 9, z: 12, joueur: true }],
  });
  assert.ok(place, 'une place est trouvée');
  assert.ok(Math.hypot(place.x - 9, place.z - 12) < 4, 'près du personnage');
  assert.equal(verifierPlacement({
    lieu: domicile, catalogue, habitants, place: { id: 'achat-1', meuble: 'fauteuil', ...place },
  }).ok, true);
  assert.ok(performance.now() - debut < 2000, 'en moins de 2 secondes, même sur un ordinateur lent');
});

test('au chargement, un meuble qui ne tient plus à sa place est rangé (rien n\'est perdu)', () => {
  const poses = [
    { id: 'achat-1', meuble: 'cactus', x: 9, z: 10, rotation: 0 },
    { id: 'achat-2', meuble: 'pouf', x: 3, z: 1, rotation: 0 }, // sur le lit
    { id: 'achat-3', meuble: 'pouf', x: 9, z: 10, rotation: 0 }, // sur le cactus
  ];
  const { gardes, retires } = trierMeublesPoses({ lieu: domicile, catalogue, poses, habitants });
  assert.deepEqual(gardes.map((p) => p.id), ['achat-1']);
  assert.deepEqual(retires.map((p) => p.id), ['achat-2', 'achat-3']);
});
