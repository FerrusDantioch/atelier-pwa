// Tests : le personnage du joueur (prénom, apparence, Ferrus).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lireJson } from './aides.mjs';
import {
  CHAMPS_APPARENCE, apparenceAuHasard, apparenceDuJoueur, creerJoueur, nettoyerApparence, nettoyerPrenom, nomDuJoueur,
} from '../js/jeu/personnage.js';
import { creerHasard, choisirDans } from '../js/noyau/hasard.js';

const personnages = lireJson('data/personnages.json');

test('le prénom est nettoyé sans être censuré', () => {
  assert.equal(nettoyerPrenom('  Camille   Rose '), 'Camille Rose');
  assert.equal(nettoyerPrenom('Zoé\n\t'), 'Zoé');
  assert.equal(nettoyerPrenom('Lou​‮'), 'Lou');
  assert.equal(nettoyerPrenom('Anne-Sophie'), 'Anne-Sophie');
  assert.equal(nettoyerPrenom('N\'Golo'), 'N\'Golo');
  assert.equal(nettoyerPrenom('x'.repeat(100)).length, 24);
  assert.equal(nettoyerPrenom('   '), '');
  assert.equal(nettoyerPrenom(undefined), '');
});

test('une apparence inconnue ou incomplète reprend les valeurs par défaut', () => {
  const apparence = nettoyerApparence({ teint: 'brun', coiffure: 'crete', aide: 'fauteuil' }, personnages);
  assert.deepEqual(Object.keys(apparence), CHAMPS_APPARENCE);
  assert.equal(apparence.teint, 'brun');
  assert.equal(apparence.coiffure, personnages.defaut.coiffure);
  assert.equal(apparence.aide, 'fauteuil');
  assert.deepEqual(nettoyerApparence(null, personnages), personnages.defaut);
});

test('Ferrus garde l\'apparence décrite dans les données (jamais copiée dans la partie)', () => {
  const ferrus = creerJoueur({ modele: 'ferrus', nom: 'Quelqu\'un d\'autre' }, personnages);
  assert.deepEqual(ferrus, { modele: 'ferrus', nom: personnages.ferrus.nom, apparence: null, position: null });
  assert.deepEqual(apparenceDuJoueur(ferrus, personnages), personnages.ferrus.apparence);
  assert.equal(nomDuJoueur(ferrus, personnages), personnages.ferrus.nom);
});

test('un personnage créé garde son prénom et son apparence', () => {
  const joueur = creerJoueur({ modele: 'perso', nom: ' Sacha ', apparence: { teint: 'clair' } }, personnages, { x: 1, z: 2, angle: 0 });
  assert.equal(joueur.nom, 'Sacha');
  assert.equal(joueur.apparence.teint, 'clair');
  assert.deepEqual(joueur.position, { x: 1, z: 2, angle: 0 });
  // Sans prénom, le premier prénom proposé.
  assert.equal(creerJoueur({ modele: 'perso', nom: '' }, personnages).nom, personnages.prenomsProposes[0]);
});

test('« Tout au hasard » ne change jamais l\'aide à la mobilité', () => {
  const hasard = creerHasard(42);
  const tirer = (liste) => choisirDans(hasard, liste);
  for (let i = 0; i < 20; i += 1) {
    const apparence = apparenceAuHasard(personnages, tirer, { aide: 'canne' });
    assert.equal(apparence.aide, 'canne');
    assert.deepEqual(nettoyerApparence(apparence, personnages), apparence);
  }
});
