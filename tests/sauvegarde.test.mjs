// Tests : forme d'une partie, export/import, mise à niveau, résumé.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lireJson } from './aides.mjs';
import {
  FORMAT, VERSION_FORMAT, heureEnMinutes, lireFichierPartie, niveauDeReputation, nomFichierExport,
  nouvellePartie, preparerPartie, resumerPartie, serialiserPartie, verifierPartie,
} from '../js/noyau/format-sauvegarde.js';

const jeu = lireJson('data/jeu.json');
const creer = () => nouvellePartie({
  graine: 123456, depart: jeu.depart, versionJeu: '0.1.0', maintenant: new Date('2026-11-14T10:00:00Z'),
});

test('une nouvelle partie est bien formée et suit data/jeu.json', () => {
  const partie = creer();
  assert.deepEqual(verifierPartie(partie), []);
  assert.equal(partie.format, FORMAT);
  assert.equal(partie.versionFormat, VERSION_FORMAT);
  assert.equal(partie.argent, jeu.depart.argent);
  assert.equal(partie.temps.jour, jeu.depart.jour);
  assert.equal(partie.temps.minute, heureEnMinutes(jeu.depart.heure));
  assert.equal(partie.lieux.actuel, jeu.depart.lieu);
  assert.equal(partie.graine, 123456);
});

test('exporter puis importer redonne exactement la même partie', () => {
  const partie = creer();
  partie.argent = 420;
  partie.temps.jour = 3;
  const lecture = lireFichierPartie(serialiserPartie(partie));
  assert.equal(lecture.ok, true);
  assert.deepEqual(lecture.partie, partie);
});

test('les fichiers qui ne sont pas des parties sont refusés poliment', () => {
  assert.equal(lireFichierPartie('').code, 'vide');
  assert.equal(lireFichierPartie('ceci n\'est pas du JSON').code, 'pasJson');
  assert.equal(lireFichierPartie('{"bonjour": 1}').code, 'pasUnePartie');
  assert.equal(lireFichierPartie('[1, 2, 3]').code, 'pasUnePartie');
  assert.equal(lireFichierPartie('x'.repeat(6 * 1024 * 1024)).code, 'tropGros');
});

test('une partie d\'une version plus récente du jeu est refusée avec une explication', () => {
  const partie = { ...creer(), versionFormat: VERSION_FORMAT + 1 };
  assert.equal(lireFichierPartie(JSON.stringify(partie)).code, 'tropRecente');
});

test('une partie abîmée est refusée', () => {
  const partie = creer();
  partie.argent = -5;
  partie.temps.minute = 5000;
  const lecture = lireFichierPartie(JSON.stringify(partie));
  assert.equal(lecture.code, 'abimee');
  assert.match(lecture.details, /argent invalide/);
  assert.match(lecture.details, /temps invalide/);
});

test('un fichier piégé ne peut pas modifier le fonctionnement du jeu', () => {
  const texte = serialiserPartie(creer()).replace('{', '{"__proto__": {"pirate": true},');
  const lecture = lireFichierPartie(texte);
  assert.equal(lecture.ok, true);
  assert.equal({}.pirate, undefined);
  assert.equal(Object.getPrototypeOf(lecture.partie), Object.prototype);
});

test('preparerPartie renvoie une copie (la partie d\'origine n\'est pas partagée)', () => {
  const partie = creer();
  const copie = preparerPartie(partie);
  copie.argent = 999;
  assert.equal(partie.argent, jeu.depart.argent);
});

test('nom du fichier exporté', () => {
  assert.equal(nomFichierExport(new Date(2026, 10, 4)), 'atelier-pwa-partie-2026-11-04.json');
});

test('niveau de réputation selon les paliers', () => {
  const paliers = jeu.reputation.paliers;
  assert.equal(niveauDeReputation(0, paliers).niveau, 1);
  assert.equal(niveauDeReputation(29, paliers).niveau, 1);
  assert.equal(niveauDeReputation(30, paliers).niveau, 2);
  assert.equal(niveauDeReputation(30, paliers).suivant.niveau, 3);
  assert.equal(niveauDeReputation(10000, paliers).suivant, null);
});

test('résumé d\'une partie', () => {
  const resume = resumerPartie(creer());
  assert.equal(resume.jour, 1);
  assert.equal(resume.argent, jeu.depart.argent);
  assert.equal(resume.nomJoueur, null);
});

test('une partie du jalon 0 (format 1) est mise à niveau', () => {
  const ancienne = creer();
  delete ancienne.vue;
  ancienne.versionFormat = 1;
  const lecture = lireFichierPartie(JSON.stringify(ancienne));
  assert.equal(lecture.ok, true, lecture.details);
  assert.equal(lecture.partie.versionFormat, VERSION_FORMAT);
  assert.deepEqual(lecture.partie.vue, { rotation: 0, zoom: null });
  assert.equal(lecture.partie.joueur, null, 'le personnage sera choisi en reprenant la partie');
});

test('le joueur et la vue sont vérifiés', () => {
  const partie = creer();
  partie.joueur = { modele: 'perso', nom: 'Camille', apparence: { teint: 'mat' }, position: { x: 3, z: 4, angle: 90 } };
  partie.vue = { rotation: 2, zoom: 80 };
  assert.deepEqual(verifierPartie(partie), []);
  assert.equal(resumerPartie(partie).nomJoueur, 'Camille');
  partie.joueur = { modele: 'pirate', nom: 'X', apparence: null, position: null };
  assert.match(verifierPartie(partie).join(), /joueur invalide/);
  partie.joueur = { modele: 'perso', nom: 'X', apparence: { teint: { piege: true } }, position: null };
  assert.match(verifierPartie(partie).join(), /joueur invalide/);
  partie.joueur = { modele: 'ferrus', nom: 'Ferrus', apparence: null, position: { x: -1, z: 0, angle: 0 } };
  assert.match(verifierPartie(partie).join(), /joueur invalide/);
  partie.joueur = null;
  partie.vue = { rotation: 7, zoom: null };
  assert.match(verifierPartie(partie).join(), /vue invalide/);
});
