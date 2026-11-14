// Tests : le hasard « à graine » est reproductible.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { choisirDans, combinerGraines, creerHasard, entierEntre, nouvelleGraine } from '../js/noyau/hasard.js';

const suite = (graine, n = 20) => {
  const hasard = creerHasard(graine);
  return Array.from({ length: n }, () => hasard());
};

test('même graine, mêmes tirages', () => {
  assert.deepEqual(suite(42), suite(42));
});

test('graines différentes, tirages différents', () => {
  assert.notDeepEqual(suite(42), suite(43));
});

test('les tirages restent entre 0 et 1', () => {
  for (const valeur of suite(7, 5000)) assert.ok(valeur >= 0 && valeur < 1);
});

test('combinerGraines : même entrée, même graine ; jour différent, graine différente', () => {
  assert.equal(combinerGraines(918273, 3), combinerGraines(918273, 3));
  assert.notEqual(combinerGraines(918273, 3), combinerGraines(918273, 4));
});

test('entierEntre et choisirDans restent dans les bornes', () => {
  const hasard = creerHasard(1);
  for (let i = 0; i < 1000; i += 1) {
    const n = entierEntre(hasard, 3, 6);
    assert.ok(n >= 3 && n <= 6 && Number.isInteger(n));
    assert.ok(['a', 'b', 'c'].includes(choisirDans(hasard, ['a', 'b', 'c'])));
  }
});

test('nouvelleGraine donne un entier positif sur 32 bits', () => {
  const graine = nouvelleGraine();
  assert.ok(Number.isInteger(graine) && graine >= 0 && graine < 2 ** 32);
});
