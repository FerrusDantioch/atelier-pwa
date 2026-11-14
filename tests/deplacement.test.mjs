// Tests : faire avancer un personnage le long d'un chemin (sans 3D).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { creerDeplacement, directionsPourAller } from '../js/monde/deplacement.js';

const proche = (a, b) => Math.abs(a - b) < 1e-9;

test('le personnage suit son chemin à vitesse constante, puis s\'arrête', () => {
  const deplacement = creerDeplacement({ depart: { x: 0, z: 0, angle: 0 }, vitesse: 1 });
  deplacement.suivre([{ x: 0, z: 0 }, { x: 4, z: 0 }]); // 2 m vers l'est
  assert.equal(deplacement.enRoute, true);
  let resultat = deplacement.avancer(1, { tournerInstantanement: true });
  assert.ok(proche(resultat.distance, 1));
  assert.ok(proche(deplacement.position.x, 1.25));
  assert.equal(deplacement.angle, 90, 'il regarde vers l\'est');
  assert.equal(resultat.arrive, false);
  resultat = deplacement.avancer(5);
  assert.equal(resultat.arrive, true);
  assert.ok(proche(resultat.distance, 1), 'il ne dépasse pas l\'arrivée');
  assert.deepEqual(deplacement.case, { x: 4, z: 0 });
  assert.equal(deplacement.enRoute, false);
});

test('il se tourne progressivement, ou d\'un coup si les animations sont réduites', () => {
  const deplacement = creerDeplacement({ depart: { x: 2, z: 2, angle: 0 }, vitesse: 1 });
  deplacement.regarder(90);
  deplacement.avancer(0.1);
  assert.ok(deplacement.angle > 0 && deplacement.angle < 90, `angle ${deplacement.angle}`);
  // Par le plus court chemin : de 10° à 350°, on tourne de 20°, pas de 340°.
  deplacement.regarder(10, { instantane: true });
  deplacement.regarder(350);
  deplacement.avancer(0.01);
  assert.ok(deplacement.angle < 10 || deplacement.angle > 340, `angle ${deplacement.angle}`);
  deplacement.regarder(180, { instantane: true });
  assert.equal(deplacement.angle, 180);
});

test('« revenir au centre » ramène au milieu de la case actuelle', () => {
  const deplacement = creerDeplacement({ depart: { x: 0, z: 0, angle: 0 }, vitesse: 1 });
  deplacement.suivre([{ x: 0, z: 0 }, { x: 0, z: 6 }]);
  deplacement.avancer(0.6); // entre deux cases
  deplacement.revenirAuCentre();
  deplacement.avancer(2);
  assert.equal(deplacement.enRoute, false);
  assert.ok(proche(deplacement.position.z % 0.5, 0.25));
});

test('au clavier : la meilleure direction d\'abord, puis ses voisines (glisser le long des murs)', () => {
  assert.deepEqual(directionsPourAller(0, 1)[0], [0, 1]); // sud
  assert.deepEqual(directionsPourAller(1, 1)[0], [1, 1]); // sud-est
  const presqueEst = directionsPourAller(1, 0.2);
  assert.deepEqual(presqueEst[0], [1, 0]);
  assert.deepEqual(presqueEst[1], [1, 1], 'puis la diagonale du côté où l\'on penche');
  assert.deepEqual(directionsPourAller(-0.01, -1)[0], [0, -1]);
  assert.deepEqual(directionsPourAller(0, 0), []);
});
