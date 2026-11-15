// Tests : l'horloge du jeu, les routines des personnages et leurs répliques.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chargerDonneesDuDisque, lireJson } from './aides.mjs';
import { VITESSES, avancerHorloge, bornesDeLaJournee, lendemain } from '../js/jeu/temps.js';
import { creneauA, presenceDans, prochainPassage, verifierRoutine } from '../js/jeu/routines.js';
import { drapeauDeRencontre, repliqueDAccueil, repliqueDActivite } from '../js/jeu/dialogues.js';

const jeu = lireJson('data/jeu.json');
const { debut, fin } = bornesDeLaJournee(jeu.temps);
const donnees = await chargerDonneesDuDisque();
const pnj = (id) => donnees.pnj.pnj.find((p) => p.id === id);

test('la journée va de 7 h à 23 h (data/jeu.json)', () => {
  assert.equal(debut, 7 * 60);
  assert.equal(fin, 23 * 60);
  assert.deepEqual(lendemain({ jour: 3, minute: 22 * 60 }, jeu.temps), { jour: 4, minute: 7 * 60 });
});

test('l\'horloge garde les fractions de minute et s\'arrête à la fin de la journée', () => {
  let etat = { minute: 480, reste: 0 };
  for (let i = 0; i < 4; i += 1) {
    etat = avancerHorloge({ ...etat, secondes: 0.25, vitesse: VITESSES.normale, fin });
  }
  assert.equal(etat.minute, 481, '4 × 0,25 s = 1 minute de jeu');
  etat = avancerHorloge({ minute: 480, reste: 0, secondes: 1, vitesse: VITESSES.lente, fin });
  assert.equal(etat.minute, 480);
  assert.ok(Math.abs(etat.reste - 0.5) < 1e-9);
  etat = avancerHorloge({ minute: fin - 1, reste: 0, secondes: 5, vitesse: 1, fin });
  assert.deepEqual(etat, { minute: fin, reste: 0, finAtteinte: true });
  etat = avancerHorloge({ minute: 600, reste: 0.3, secondes: 10, vitesse: VITESSES.arretee, fin });
  assert.equal(etat.minute, 600, 'temps arrêté');
});

test('les créneaux d\'une routine : début compris, fin exclue', () => {
  const routine = pnj('theo').routine;
  assert.equal(creneauA(routine, 15 * 60 + 59), null);
  assert.equal(creneauA(routine, 16 * 60).activite, 'visite');
  assert.equal(creneauA(routine, 16 * 60 + 59).activite, 'visite');
  assert.equal(creneauA(routine, 17 * 60), null);
});

test('Halaé vit au domicile toute la journée ; le mentor ne vient pas si l\'on joue Ferrus', () => {
  for (let minute = debut; minute < fin; minute += 15) {
    assert.ok(presenceDans(pnj('halae'), 'domicile', minute, { modele: 'perso' }), `Halaé à ${minute}`);
  }
  assert.ok(presenceDans(pnj('ferrus'), 'domicile', 10 * 60 + 30, { modele: 'perso' }));
  assert.equal(presenceDans(pnj('ferrus'), 'domicile', 10 * 60 + 30, { modele: 'ferrus' }), null);
});

test('une routine mal écrite est expliquée', () => {
  const problemes = verifierRoutine([
    { de: '09:00', a: '08:00', lieu: 'domicile', point: 'montage' },
    { de: '06:00', a: '07:30', lieu: 'domicile' },
  ], { debut, fin }).join('\n');
  assert.match(problemes, /l'heure de fin doit être après l'heure de début/);
  assert.match(problemes, /le créneau doit rester dans la journée/);
  assert.match(problemes, /se suivre sans se chevaucher/);
  assert.match(problemes, /il faut un « point »/);
});

test('les répliques : rencontre la première fois, puis salutations ; toujours les mêmes pour un même moment', () => {
  const halae = pnj('halae');
  const moment = { graine: 42, jour: 1, minute: 500 };
  const premiere = repliqueDAccueil(halae, { dejaRencontre: false, ...moment });
  assert.equal(premiere.premiereFois, true);
  assert.ok(halae.repliques.rencontre.includes(premiere.texte));
  const ensuite = repliqueDAccueil(halae, { dejaRencontre: true, ...moment });
  assert.ok(halae.repliques.salut.includes(ensuite.texte));
  assert.deepEqual(repliqueDAccueil(halae, { dejaRencontre: true, ...moment }), ensuite);
  const activite = repliqueDActivite(halae, creneauA(halae.routine, 9 * 60), moment);
  assert.equal(activite.description, 'monte sa prochaine vidéo');
  assert.equal(repliqueDActivite(halae, null, moment), null);
  assert.equal(drapeauDeRencontre(halae), 'rencontre-halae');
});

test('quand une personne revient-elle ? (pour le dire quand elle n\'est pas là)', async () => {
  const { pnj } = await chargerDonneesDuDisque();
  const theo = pnj.pnj.find((p) => p.id === 'theo');
  assert.deepEqual(prochainPassage(theo, 'domicile', 10 * 60, null), { minute: 16 * 60, demain: false });
  assert.deepEqual(prochainPassage(theo, 'domicile', 17 * 60 + 30, null), { minute: 16 * 60, demain: true });
  assert.equal(prochainPassage(theo, 'bureaux', 10 * 60, null), null, 'il ne va pas ailleurs');
  const mentor = pnj.pnj.find((p) => p.id === 'ferrus');
  assert.equal(prochainPassage(mentor, 'domicile', 8 * 60, { modele: 'ferrus' }), null, 'pas quand on joue Ferrus');
});
