// Tests : les bureaux (jalon 5) — pièces à ouvrir, lieux à louer, routines
// conditionnelles, trajets, commandes du jour en plus, et les vérifications
// des données qui vont avec.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chargerDonneesDuDisque } from './aides.mjs';

const {
  arriveeDans, etatsAVerifier, heureApresTrajet, lieuSelonOuvertures, lieuxOuOnPeutAller, ouvertures, ouverturesDuLieu,
} = await import('../js/jeu/lieux.js');
const { creneauA, ouEst, presenceDans, prochainPassage } = await import('../js/jeu/routines.js');
const { acheter, articlesDeLaBoutique, etatDeLArticle, trouverArticle } = await import('../js/jeu/boutique.js');
const { commandesDuJour, nombreDuJour, offresDuJour } = await import('../js/jeu/generateur.js');
const { placesDesHabitants, verifierPlacement } = await import('../js/jeu/amenagement.js');
const { creerGrille } = await import('../js/monde/grille.js');
const { nouvellePartie, verifierPartie } = await import('../js/noyau/format-sauvegarde.js');
const { verifierCoherence } = await import('../js/noyau/coherence.js');

const donnees = await chargerDonneesDuDisque();
const bureaux = donnees.lieux.bureaux;
const catalogue = new Map(donnees.meubles.meubles.map((meuble) => [meuble.id, meuble]));
const paliers = donnees.jeu.reputation.paliers;
const articles = articlesDeLaBoutique(donnees.boutique, donnees.meubles.meubles);
const pnj = (id) => donnees.pnj.pnj.find((p) => p.id === id);

function partie({ argent = 2000, reputation = 200 } = {}) {
  const p = nouvellePartie({ graine: 5, depart: donnees.jeu.depart, versionJeu: 'test' });
  p.argent = argent;
  p.reputation = reputation;
  return p;
}

test('les bureaux : trois pièces à ouvrir, vérifiées fermées, une à une et toutes ouvertes', () => {
  assert.deepEqual(ouverturesDuLieu(bureaux).sort(), ['coin-calme', 'salle-pause', 'salle-reunion']);
  assert.deepEqual(etatsAVerifier(bureaux).map((etat) => etat.nom),
    ['tout fermé', 'salle-reunion ouvert', 'salle-pause ouvert', 'coin-calme ouvert', 'tout ouvert']);
  assert.deepEqual(etatsAVerifier(donnees.lieux.domicile).map((etat) => etat.nom), [null], 'le domicile n\'a rien à ouvrir');
});

test('une pièce fermée : pas de sol praticable, ni meubles, ni places ; une porte close ; un point pour savoir comment l\'ouvrir', () => {
  const ferme = lieuSelonOuvertures(bureaux, new Set());
  assert.ok(ferme.pieces.find((p) => p.id === 'coin-calme').verrouillee);
  assert.equal(ferme.pieces.find((p) => p.id === 'accueil').verrouillee, undefined);
  assert.equal(ferme.meubles.some((m) => m.id === 'calme-fauteuil'), false);
  assert.ok(ferme.meubles.some((m) => m.id === 'comptoir'));
  assert.equal(ferme.points.some((p) => p.id === 'calme-pres-du-fauteuil'), false);
  assert.ok(ferme.points.some((p) => p.id === 'porte-calme'), 'on peut examiner la porte fermée');
  const porte = ferme.ouvertures.find((o) => o.de[0] === 21 && o.de[1] === 10);
  assert.equal(porte.type, 'porte-fermee');
  const grille = creerGrille(ferme, catalogue);
  assert.equal(grille.piece(22, 4), null, 'on n\'entre pas dans une pièce fermée');
  assert.equal(grille.libre(22, 4), false);

  const ouvert = lieuSelonOuvertures(bureaux, new Set(['coin-calme']));
  assert.equal(ouvert.pieces.find((p) => p.id === 'coin-calme').verrouillee, undefined);
  assert.ok(ouvert.meubles.some((m) => m.id === 'calme-fauteuil'));
  assert.equal(ouvert.points.some((p) => p.id === 'porte-calme'), false, 'le point de la porte fermée disparaît');
  assert.equal(ouvert.ouvertures.find((o) => o.de[0] === 21 && o.de[1] === 10).type, 'porte');
  assert.equal(creerGrille(ouvert, catalogue).piece(22, 4), 'coin-calme');
  assert.equal(lieuSelonOuvertures(donnees.lieux.domicile, new Set()), donnees.lieux.domicile, 'rien ne change au domicile');
});

test('louer les bureaux, puis ouvrir une pièce : dans l\'ordre, une seule fois', () => {
  const p = partie({ reputation: 0 });
  const louer = trouverArticle(articles, 'bureaux');
  const pause = trouverArticle(articles, 'salle-pause');
  assert.equal(louer.sorte, 'lieu');
  assert.deepEqual(etatDeLArticle(louer, p, paliers), { possible: false, raison: 'niveau', niveau: 3 });
  assert.deepEqual(etatDeLArticle(pause, p, paliers), { possible: false, raison: 'lieu', lieu: 'bureaux' }, 'd\'abord, louer');
  p.reputation = 200;
  assert.ok(acheter(p, louer, paliers));
  assert.deepEqual(p.lieux.debloques, ['domicile', 'bureaux']);
  assert.deepEqual(etatDeLArticle(louer, p, paliers), { possible: false, raison: 'installe' });
  assert.ok(acheter(p, pause, paliers));
  assert.deepEqual(etatDeLArticle(pause, p, paliers), { possible: false, raison: 'installe' });
  assert.deepEqual([...ouvertures(p)].sort(), ['bureaux', 'domicile', 'salle-pause']);
  assert.deepEqual(lieuxOuOnPeutAller(p, donnees.indexLieux.lieux), ['bureaux']);
  p.lieux.actuel = 'bureaux';
  assert.deepEqual(lieuxOuOnPeutAller(p, donnees.indexLieux.lieux), ['domicile']);
  assert.deepEqual(verifierPartie(p), []);
});

test('les routines : un créneau « si » n\'a lieu qu\'avec son ouverture', () => {
  const theo = pnj('theo');
  const rien = new Set();
  const coin = new Set(['bureaux', 'coin-calme']);
  assert.equal(creneauA(theo.routine, 14 * 60, rien), null);
  assert.equal(creneauA(theo.routine, 14 * 60, coin).lieu, 'bureaux');
  assert.equal(presenceDans(theo, 'bureaux', 14 * 60, null, coin).point, 'calme-pres-du-fauteuil');
  assert.equal(presenceDans(theo, 'domicile', 16 * 60 + 10, null, coin).point, 'table-cuisine-est', 'et toujours chez toi à 16 h');
  assert.deepEqual(ouEst(theo, 14 * 60, null, coin)?.lieu, 'bureaux');
  assert.deepEqual(prochainPassage(theo, null, 9 * 60, null, coin), { minute: 13 * 60 + 30, lieu: 'bureaux', demain: false });
  assert.deepEqual(prochainPassage(theo, null, 9 * 60, null, rien), { minute: 16 * 60, lieu: 'domicile', demain: false });
  const mentor = pnj('ferrus');
  assert.equal(presenceDans(mentor, 'bureaux', 14 * 60 + 30, null, new Set(['bureaux'])).activite, 'visite-bureaux');
  assert.equal(presenceDans(mentor, 'bureaux', 14 * 60 + 30, { modele: 'ferrus' }, new Set(['bureaux'])), null, 'pas quand on joue Ferrus');
  // Les clients viennent aux bureaux, une fois la pièce ouverte.
  assert.equal(presenceDans(pnj('karim'), 'bureaux', 11 * 60 + 30, null, new Set(['bureaux'])), null);
  assert.equal(presenceDans(pnj('karim'), 'bureaux', 11 * 60 + 30, null, new Set(['bureaux', 'salle-reunion'])).activite, 'plans');
  assert.equal(presenceDans(pnj('hugo'), 'bureaux', 17 * 60 + 35, null, new Set(['bureaux'])).point, 'accueil-attente');
});

test('les trajets : on arrive devant la porte, le temps passe sans dépasser la fin de journée', () => {
  assert.deepEqual(arriveeDans(bureaux), { x: 0, z: 18, angle: 90 });
  assert.deepEqual(arriveeDans(donnees.lieux.domicile), { x: 0, z: 16, angle: 90 });
  assert.equal(heureApresTrajet(9 * 60, 10, 23 * 60), 9 * 60 + 10);
  assert.equal(heureApresTrajet(22 * 60 + 55, 10, 23 * 60), 23 * 60);
  assert.equal(heureApresTrajet(23 * 60, 10, 23 * 60), 23 * 60);
});

test('avec les bureaux, une commande du jour en plus (les autres ne changent pas)', () => {
  const p = partie();
  const modeles = donnees.modelesCommandes;
  assert.equal(nombreDuJour(p, modeles), 2);
  p.lieux.debloques.push('bureaux');
  assert.equal(nombreDuJour(p, modeles), 3);
  const deux = commandesDuJour({ graine: p.graine, jour: 4 }, modeles, donnees.creation);
  const trois = commandesDuJour({ graine: p.graine, jour: 4, nombre: 3 }, modeles, donnees.creation);
  assert.deepEqual(trois.slice(0, 2), deux);
  assert.equal(trois.length, 3);
  p.drapeaux['visio-accueil'] = true;
  p.temps.jour = 4;
  assert.equal(offresDuJour(p, modeles, donnees.creation, paliers).length, 3);
});

test('aux bureaux, un meuble posé ne doit pas bloquer une pièce qui s\'ouvrira plus tard', () => {
  const ferme = lieuSelonOuvertures(bureaux, new Set(['bureaux']));
  const complet = lieuSelonOuvertures(bureaux, new Set(ouverturesDuLieu(bureaux)));
  // Une étagère juste devant la porte (encore fermée) du coin calme.
  const place = { id: 'achat-1', meuble: 'etagere-basse', x: 21, z: 10, rotation: 0 };
  assert.equal(verifierPlacement({
    lieu: ferme, catalogue, place, habitants: placesDesHabitants(ferme, donnees.pnj.pnj, donnees.personnages, new Set(['bureaux'])),
  }).ok, false, 'elle cache le point « porte du coin calme »');
  const plusTard = verifierPlacement({
    lieu: complet, catalogue, place, habitants: placesDesHabitants(complet, donnees.pnj.pnj, donnees.personnages),
  });
  assert.equal(plusTard.ok, false);
  assert.match(`${plusTard.raison} ${plusTard.designation || plusTard.nom}`, /acces|place|coin calme|Théo/);
});

test('les données fautives des bureaux sont refusées, avec des messages clairs', () => {
  const copie = JSON.parse(JSON.stringify(donnees));
  copie.lieux.bureaux.pieces.find((p) => p.id === 'coin-calme').ouverture = 'jacuzzi';
  copie.lieux.bureaux.points.push({ id: 'porte-sauna', nom: 'Porte', designation: 'la porte', description: 'Fermée.', fermee: 'sauna', x: 1, z: 10, angle: 0 });
  copie.pnj.pnj.find((p) => p.id === 'hugo').routine[0].si = undefined;
  copie.pnj.pnj.find((p) => p.id === 'samia').routine[0].si = 'piscine';
  copie.boutique.lieux.push({ id: 'chateau', nom: 'Château', designation: 'le château', description: 'Un château.', prix: 9000 });
  copie.quetes.quetes.find((q) => q.id === 'un-vrai-local').etapes.push({ id: 'lune', type: 'lieu', lieu: 'lune', texte: 'va sur la Lune', facultative: true });
  const texte = verifierCoherence(copie).join('\n');
  assert.match(texte, /pieces › coin-calme › ouverture : « jacuzzi » n'est pas une pièce à ouvrir/);
  assert.match(texte, /data\/boutique\.json › pieces › coin-calme : aucune pièce de data\/lieux\/bureaux\.json ne s'ouvre avec « coin-calme »/);
  assert.match(texte, /points › porte-sauna › fermee : aucune pièce de ce lieu ne s'ouvre avec « sauna »/);
  assert.match(texte, /pnj › hugo › routine › n°1 : « bureaux » se loue ; il faut « si »: « bureaux »/);
  assert.match(texte, /pnj › samia › routine › n°1 › si : « piscine » n'est ni un lieu à louer, ni une pièce à ouvrir/);
  assert.match(texte, /lieux › chateau : le lieu « chateau » n'existe pas/);
  assert.match(texte, /etapes › lune › lieu : « lune » n'existe pas/);
});

test('une porte bouchée aux bureaux est repérée, même quand la pièce est encore fermée', () => {
  const copie = JSON.parse(JSON.stringify(donnees));
  // Une bibliothèque devant la porte de la salle de pause, côté espace de travail.
  copie.lieux.bureaux.meubles.push({ id: 'bouchon', meuble: 'bibliotheque', x: 14, z: 10, rotation: 0 });
  const texte = verifierCoherence(copie).join('\n');
  assert.match(texte, /bureaux\.json › pieces › salle-pause : impossible d'y entrer .*\(salle-pause ouvert\)/);
});

test('jamais plus de deux personnages à la fois dans un lieu (la tablette reste fluide)', () => {
  // Chaque personnage, c'est 9 dessins par image ; avec le joueur et le
  // décor, deux visiteurs à la fois gardent la scène sous 40 dessins.
  const heure = (texte) => Number(texte.slice(0, 2)) * 60 + Number(texte.slice(3));
  for (const idLieu of Object.keys(donnees.lieux)) {
    let pire = 0;
    for (let minute = 7 * 60; minute < 23 * 60; minute += 1) {
      const presents = donnees.pnj.pnj.filter((personne) => personne.routine
        .some((c) => c.lieu === idLieu && heure(c.de) <= minute && minute < heure(c.a))).length;
      pire = Math.max(pire, presents);
    }
    assert.ok(pire <= 2, `${idLieu} : ${pire} personnages à la fois`);
  }
});
