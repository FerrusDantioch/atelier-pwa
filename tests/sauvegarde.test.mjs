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

test('une partie du jalon 3 (format 2) est mise à niveau : commandes du jour, quêtes', () => {
  const ancienne = creer();
  delete ancienne.commandes.aleatoires;
  ancienne.versionFormat = 2;
  ancienne.commandes.livrees.push({ id: 'essai-courses', note: 'parfait', jour: 1, argent: 20, reputation: 5 });
  const lecture = lireFichierPartie(JSON.stringify(ancienne));
  assert.equal(lecture.ok, true, lecture.details);
  assert.equal(lecture.partie.versionFormat, VERSION_FORMAT);
  assert.deepEqual(lecture.partie.commandes.aleatoires, {});
  assert.equal(lecture.partie.commandes.livrees.length, 1, 'rien n\'est perdu');
  assert.deepEqual(lecture.partie.quetes, { actives: {}, finies: [], suivie: null });
});

test('les quêtes en cours sont vérifiées', () => {
  const partie = creer();
  partie.quetes.actives.bienvenue = { debut: { jour: 1, minute: 480 } };
  partie.quetes.suivie = 'bienvenue';
  assert.deepEqual(verifierPartie(partie), []);
  partie.quetes.actives.bienvenue = { debut: 'hier' };
  assert.match(verifierPartie(partie).join(), /quetes invalides/);
});

test('restaurerCopie met à jour la date et efface une copie d\'urgence plus ancienne', async () => {
  const { chargerConfig } = await import('./aides.mjs');
  const config = chargerConfig();
  const stockage = new Map();
  globalThis.localStorage = {
    getItem: (cle) => (stockage.has(cle) ? stockage.get(cle) : null),
    setItem: (cle, valeur) => stockage.set(cle, String(valeur)),
    removeItem: (cle) => stockage.delete(cle),
  };
  const sauvegarde = await import('../js/noyau/sauvegarde.js');
  await sauvegarde.ouvrirSauvegarde({ copiesDeSecours: 5 });

  const ancienne = creer();
  ancienne.argent = 150;
  ancienne.enregistreeLe = '2026-11-14T10:00:00.000Z';
  await sauvegarde.creerCopieDeSecours(ancienne, 'nouveau-jour');

  const actuelle = creer();
  actuelle.argent = 220;
  await sauvegarde.enregistrerPartie(actuelle);
  sauvegarde.ecrireCopieUrgence(actuelle);
  assert.ok(stockage.has(`${config.idStockage}.partie-urgence`));

  const [copie] = await sauvegarde.listerCopies();
  const restauree = await sauvegarde.restaurerCopie(copie.id, actuelle);
  assert.equal(restauree.argent, 150);
  assert.equal(restauree.versionJeu, config.version);
  assert.notEqual(restauree.enregistreeLe, '2026-11-14T10:00:00.000Z');
  assert.equal(stockage.has(`${config.idStockage}.partie-urgence`), false, 'la copie d\'urgence est effacée');
  sauvegarde.fermerSauvegarde();
});

test('sauvegarderMaintenant sérialise les appels concurrents et tolère fermerPartie()', async () => {
  const { chargerConfig } = await import('./aides.mjs');
  chargerConfig();
  const sauvegarde = await import('../js/noyau/sauvegarde.js');
  const etat = await import('../js/noyau/etat.js');
  await sauvegarde.ouvrirSauvegarde({ copiesDeSecours: 5 });

  const partie = creer();
  etat.chargerPartieEnCours(partie);
  const p1 = etat.sauvegarderMaintenant();
  etat.modifierPartie((p) => { p.argent = 333; });
  const p2 = etat.sauvegarderMaintenant();
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1, true);
  assert.equal(r2, true);
  const lue = await sauvegarde.lirePartie();
  assert.equal(lue.partie.argent, 333);

  // Fermer la partie pendant une sauvegarde ne lève aucune erreur.
  const p3 = etat.sauvegarderMaintenant();
  etat.fermerPartie();
  await p3;
  assert.equal(await etat.sauvegarderMaintenant(), false);
  sauvegarde.fermerSauvegarde();
});

test('verifierPartie refuse un lieu actuel absent des lieux débloqués', () => {
  const partie = creer();
  partie.lieux.actuel = 'bureaux';
  assert.match(verifierPartie(partie).join(), /lieux invalides/);
  partie.lieux.debloques.push('bureaux');
  assert.deepEqual(verifierPartie(partie), []);
});

test('sauvegarde:autre-onglet suspend les écritures pour ne pas écraser l\'autre onglet', async () => {
  const { chargerConfig } = await import('./aides.mjs');
  chargerConfig();
  const sauvegarde = await import('../js/noyau/sauvegarde.js');
  const etat = await import('../js/noyau/etat.js');
  const { annoncer } = await import('../js/noyau/evenements.js');
  await sauvegarde.ouvrirSauvegarde({ copiesDeSecours: 5 });

  const partie = creer();
  etat.chargerPartieEnCours(partie);
  assert.equal(etat.estSuspenduParAutreOnglet(), false);
  assert.equal(await etat.sauvegarderMaintenant(), true);

  annoncer('sauvegarde:autre-onglet', { raison: 'versionchange' });
  assert.equal(etat.estSuspenduParAutreOnglet(), true);
  etat.modifierPartie((p) => { p.argent = 999; }, { important: true });
  assert.equal(await etat.sauvegarderMaintenant(), false, 'aucune écriture tant que suspendu');
  const lue = await sauvegarde.lirePartie();
  assert.equal(lue.partie.argent, jeu.depart.argent, 'la base n\'a pas été écrasée');

  // Recharger une partie lève la suspension.
  etat.chargerPartieEnCours(creer());
  assert.equal(etat.estSuspenduParAutreOnglet(), false);
  etat.fermerPartie();
  sauvegarde.fermerSauvegarde();
});
