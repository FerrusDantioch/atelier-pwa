// Tests : les commandes du jour (jalon 4) — tirage reproductible, toujours
// réussissable « parfaitement », renouvelées chaque matin si on ne les
// accepte pas, gardées dans la partie une fois acceptées.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chargerDonneesDuDisque } from './aides.mjs';
import { accepterCommande, etatDesCommandes, livrerProjet, objectifDuMoment } from '../js/jeu/commandes.js';
import { evaluerProjet, meilleurProjet } from '../js/jeu/creation.js';
import {
  associationsPossibles, commandesConnues, commandesDuJour, commandesDuJourOuvertes, offresDuJour,
} from '../js/jeu/generateur.js';
import { nouvellePartie, preparerPartie, verifierPartie } from '../js/noyau/format-sauvegarde.js';
import { SCHEMA_COMMANDE } from '../js/noyau/schemas.js';
import { verifier } from '../js/noyau/verification.js';

const donnees = await chargerDonneesDuDisque();
const { creation, modelesCommandes: modeles } = donnees;
const paliers = donnees.jeu.reputation.paliers;
const niveau3 = paliers.find((palier) => palier.niveau === modeles.debloquee.niveau).points;

function partieReconnue(graine = 5) {
  const partie = nouvellePartie({ graine, depart: donnees.jeu.depart, versionJeu: 'test' });
  partie.reputation = niveau3;
  return partie;
}

test('les commandes du jour attendent que l\'atelier soit reconnu (niveau 3)', () => {
  const partie = partieReconnue();
  partie.reputation = niveau3 - 1;
  assert.equal(commandesDuJourOuvertes(partie, modeles, paliers), false);
  assert.deepEqual(offresDuJour(partie, modeles, creation, paliers), []);
  partie.reputation = niveau3;
  const offres = offresDuJour(partie, modeles, creation, paliers);
  assert.equal(offres.length, modeles.parJour);
  assert.deepEqual(offres.map((c) => c.id), ['jour-1-1', 'jour-1-2']);
});

test('même graine et même jour : mêmes commandes ; un autre jour : d\'autres', () => {
  const lundi = commandesDuJour({ graine: 42, jour: 3 }, modeles, creation);
  assert.deepEqual(commandesDuJour({ graine: 42, jour: 3 }, modeles, creation), lundi);
  const autresJours = [4, 5, 6, 7].map((jour) => commandesDuJour({ graine: 42, jour }, modeles, creation));
  assert.ok(autresJours.some((jour) => jour.map((c) => c.titre).join() !== lundi.map((c) => c.titre).join()));
  const autrePartie = commandesDuJour({ graine: 43, jour: 3 }, modeles, creation);
  assert.notDeepEqual(autrePartie.map((c) => [c.client, c.titre]), lundi.map((c) => [c.client, c.titre]));
});

test('sur 300 jours : chaque commande est bien formée, réussissable, et tout finit par sortir', () => {
  const idsPnj = new Set(donnees.pnj.pnj.map((pnj) => pnj.id));
  const clientsVus = new Set();
  const sujetsVus = new Set();
  for (let jour = 1; jour <= 300; jour += 1) {
    const offres = commandesDuJour({ graine: 2026, jour }, modeles, creation);
    assert.equal(offres.length, modeles.parJour);
    assert.equal(new Set(offres.map((c) => c.client)).size, offres.length, 'une personne différente par commande');
    assert.equal(new Set(offres.map((c) => c.titre)).size, offres.length, 'un sujet différent par commande');
    for (const commande of offres) {
      assert.deepEqual(verifier(commande, SCHEMA_COMMANDE), [], commande.id);
      assert.ok(meilleurProjet(commande, creation), `${commande.id} : réussissable « parfaitement »`);
      assert.ok(!idsPnj.has(commande.client), 'jamais un personnage de data/pnj.json');
      const [min, max] = modeles.recompense.argent;
      assert.ok(commande.recompense.argent >= min && commande.recompense.argent <= max && commande.recompense.argent % 5 === 0);
      clientsVus.add(commande.client);
      sujetsVus.add(commande.titre);
    }
  }
  assert.equal(clientsVus.size, modeles.clients.length, 'chaque personne finit par passer commande');
  assert.equal(sujetsVus.size, modeles.sujets.length, 'chaque sujet finit par sortir');
});

test('une commande du jour acceptée reste ; les autres laissent leur place le lendemain', () => {
  const partie = partieReconnue();
  partie.drapeaux['visio-accueil'] = true;
  const [premiere, seconde] = offresDuJour(partie, modeles, creation, paliers);
  accepterCommande(partie, premiere, creation);
  assert.deepEqual(Object.keys(partie.commandes.aleatoires), [premiere.id]);
  assert.deepEqual(partie.commandes.aleatoires[premiere.id], premiere, 'recopiée telle quelle');
  assert.deepEqual(verifierPartie(partie), []);
  assert.deepEqual(offresDuJour(partie, modeles, creation, paliers).map((c) => c.id), [seconde.id]);

  // Le lendemain : la commande acceptée est toujours là, la seconde a disparu.
  partie.temps.jour = 2;
  const connues = commandesConnues(partie, donnees);
  const etat = etatDesCommandes(partie, connues, paliers);
  assert.deepEqual(etat.enCours.map((e) => e.commande.id), [premiere.id]);
  assert.ok(!connues.some((c) => c.id === seconde.id));
  assert.deepEqual(etat.offres.filter((c) => c.id.startsWith('jour-')).map((c) => c.id), ['jour-2-1', 'jour-2-2']);

  // Livrée : elle reste dans l'historique, sans revenir dans les offres.
  const projet = partie.commandes.enCours[premiere.id];
  Object.assign(projet, meilleurProjet(premiere, creation).projet);
  assert.equal(livrerProjet(partie, premiere, evaluerProjet(projet, premiere, creation), paliers).livree, true);
  const apres = etatDesCommandes(partie, commandesConnues(partie, donnees), paliers);
  assert.deepEqual(apres.livrees.map((e) => e.commande.id), [premiere.id]);
  assert.deepEqual(verifierPartie(partie), []);
});

test('une commande du jour trafiquée dans un fichier importé est refusée', () => {
  const partie = partieReconnue();
  const [offre] = offresDuJour(partie, modeles, creation, paliers);
  accepterCommande(partie, offre, creation);
  assert.ok(preparerPartie(JSON.parse(JSON.stringify(partie))));
  const sansBesoins = JSON.parse(JSON.stringify(partie));
  delete sansBesoins.commandes.aleatoires[offre.id].besoins;
  assert.match(verifierPartie(sansBesoins).join(), /commandes invalides/);
  const mauvaisId = JSON.parse(JSON.stringify(partie));
  mauvaisId.commandes.aleatoires['essai-courses'] = { ...offre, id: 'essai-courses' };
  assert.match(verifierPartie(mauvaisId).join(), /commandes invalides/);
});

test('tout est livré et les commandes du jour ont commencé : « demain »', () => {
  const partie = partieReconnue();
  partie.drapeaux['visio-accueil'] = true;
  const liste = donnees.commandes.commandes;
  partie.commandes.livrees = liste.map((c) => ({ id: c.id, note: 'bien', jour: 1, argent: 1, reputation: 1 }));
  assert.equal(objectifDuMoment(partie, liste, paliers).cle, 'fini');
  assert.equal(objectifDuMoment(partie, liste, paliers, { demain: true }).cle, 'demain');
});

test('associationsPossibles garde son résultat en mémoire pour les mêmes données', () => {
  const premiere = associationsPossibles(modeles, creation);
  const seconde = associationsPossibles(modeles, creation);
  assert.equal(premiere, seconde);
});
