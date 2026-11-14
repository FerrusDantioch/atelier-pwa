// Tests : les fichiers de data/ sont bien écrits, et le vérificateur
// explique clairement les erreurs.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lire } from './aides.mjs';
import { analyserFichier } from '../js/noyau/donnees.js';
import { FICHIERS_DONNEES, SCHEMA_JEU } from '../js/noyau/schemas.js';
import { expliquerErreurJson, verifier } from '../js/noyau/verification.js';

test('chaque fichier de data/ est valide', () => {
  for (const description of FICHIERS_DONNEES) {
    const { problemes } = analyserFichier(lire(description.chemin), description);
    assert.deepEqual(problemes, [], `${description.chemin} :\n${problemes.join('\n')}`);
  }
});

test('une virgule oubliée est signalée avec sa ligne', () => {
  const description = FICHIERS_DONNEES.find((d) => d.nom === 'jeu');
  const texte = '{\n  "monnaie": { "singulier": "pièce" "pluriel": "pièces" }\n}';
  const { problemes } = analyserFichier(texte, description);
  assert.equal(problemes.length, 1);
  assert.match(problemes[0], /data\/jeu\.json : erreur d'écriture à la ligne 2/);
});

test('expliquerErreurJson calcule la ligne à partir d\'une position', () => {
  const message = expliquerErreurJson('{\n"a": 1,\n}', new SyntaxError('Unexpected token } in JSON at position 10'));
  assert.match(message, /ligne 3, colonne 1/);
});

test('les erreurs de contenu sont précises (champ manquant, mauvais type, faute de frappe)', () => {
  const jeu = JSON.parse(lire('data/jeu.json'));
  delete jeu.monnaie.pluriel;
  jeu.depart.argent = 'cent';
  jeu.depart.heure = '25:00';
  jeu.sauvegarde.copiesDeSecour = 3;
  const problemes = verifier(jeu, SCHEMA_JEU);
  assert.ok(problemes.some((p) => p.includes('monnaie : le champ « pluriel » manque')));
  assert.ok(problemes.some((p) => p.includes('depart › argent : un nombre est attendu (reçu : "cent")')));
  assert.ok(problemes.some((p) => p.includes('depart › heure : une heure « HH:MM » est attendue')));
  assert.ok(problemes.some((p) => p.includes('champ inconnu « copiesDeSecour »')));
});

test('les paliers de réputation doivent monter dans l\'ordre', () => {
  const description = FICHIERS_DONNEES.find((d) => d.nom === 'jeu');
  const jeu = JSON.parse(lire('data/jeu.json'));
  jeu.reputation.paliers[2].points = 10;
  const { problemes } = analyserFichier(JSON.stringify(jeu), description);
  assert.ok(problemes.some((p) => /n°3 : les points doivent augmenter/.test(p)), problemes.join('\n'));
});

test('un texte vide est refusé dans textes.json', () => {
  const description = FICHIERS_DONNEES.find((d) => d.nom === 'textes');
  const { problemes } = analyserFichier('{ "accueil": { "titre": "  " } }', description);
  assert.match(problemes[0], /accueil › titre : le texte est vide/);
});
