// Tests : le mini-jeu de création (évaluation des projets), les commandes
// (offres, acceptation, livraison) et l'argent / la réputation.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chargerDonneesDuDisque } from './aides.mjs';
import {
  chargeDuProjet, confortParDefaut, evaluerProjet, meilleurProjet, nettoyerProjet, projetVide,
} from '../js/jeu/creation.js';
import {
  DRAPEAU_VISIO_ACCUEIL, accepterCommande, commandesAProposer, etatDesCommandes, idsDesOffres, livrerProjet,
  nouvellesOffres, objectifDuMoment, proposerCommande,
} from '../js/jeu/commandes.js';
import { gagner, progressionReputation } from '../js/jeu/economie.js';
import { nouvellePartie, verifierPartie } from '../js/noyau/format-sauvegarde.js';

const donnees = await chargerDonneesDuDisque();
const { creation } = donnees;
const commandes = donnees.commandes.commandes;
const paliers = donnees.jeu.reputation.paliers;
const commande = (id) => commandes.find((c) => c.id === id);

function partieNeuve() {
  return nouvellePartie({ graine: 7, depart: donnees.jeu.depart, versionJeu: 'test' });
}

// Un projet complet, en partant des réglages par défaut.
function projet(modele, fonctions = [], confort = {}) {
  return { modele, fonctions, confort: { ...confortParDefaut(creation), ...confort } };
}

test('les données du mini-jeu sont chargées et vérifiées (aucune erreur)', () => {
  assert.ok(creation.modeles.length >= 4);
  assert.ok(creation.fonctions.length >= 8);
  assert.ok(commandes.length >= 6);
});

test('chaque commande peut être réussie « parfaitement »', () => {
  for (const c of commandes) {
    const meilleur = meilleurProjet(c, creation);
    assert.ok(meilleur, `${c.id} : aucune solution parfaite`);
    assert.equal(meilleur.evaluation.note, 'parfait');
    assert.ok(meilleur.evaluation.charge <= meilleur.evaluation.capacite, c.id);
  }
});

test('sans modèle, ou s\'il manque un besoin : « À retravailler », sans rien gagner', () => {
  const theo = commande('theo-changements');
  const vide = evaluerProjet(projet(null), theo, creation);
  assert.equal(vide.note, 'aRetravailler');
  assert.ok(vide.criteres.some((c) => c.sorte === 'modele' && c.etat === 'bloquant'));
  assert.deepEqual(vide.recompense, { argent: 0, reputation: 0 });

  const sansAnnonce = evaluerProjet(projet('agenda', [], { animations: 'reduites' }), theo, creation);
  assert.equal(sansAnnonce.note, 'aRetravailler');
  const manque = sansAnnonce.criteres.find((c) => c.sorte === 'besoin' && c.etat === 'bloquant');
  assert.equal(manque.apporte, 'prevoir');
});

test('une chose à éviter rend le projet « À retravailler » et nomme la fonction fautive', () => {
  const theo = commande('theo-changements');
  const resultat = evaluerProjet(projet('agenda', ['annonce-changements', 'alarme-sonore'], { animations: 'reduites' }), theo, creation);
  assert.equal(resultat.note, 'aRetravailler');
  const gene = resultat.criteres.find((c) => c.sorte === 'eviter');
  assert.equal(gene.source.id, 'alarme-sonore');
  // Une fonction gênante n'est pas comptée deux fois (pas aussi « inutile »).
  assert.ok(!resultat.criteres.some((c) => c.sorte === 'inutile' && c.fonction === 'alarme-sonore'));
});

test('un réglage de confort qui ne convient pas, ou une fonction inutile : « Bien »', () => {
  const theo = commande('theo-changements');
  const animee = evaluerProjet(projet('agenda', ['annonce-changements']), theo, creation);
  assert.equal(animee.note, 'bien');
  assert.ok(animee.criteres.some((c) => c.sorte === 'confort' && c.etat === 'mineur' && c.reglage === 'animations'));

  const karim = commande('karim-atelier');
  const avecSonnerie = evaluerProjet(projet('agenda', ['rappels-ecran', 'vibration', 'alarme-sonore'], { contraste: 'eleve' }), karim, creation);
  assert.equal(avecSonnerie.note, 'bien');
  const inutile = avecSonnerie.criteres.find((c) => c.sorte === 'inutile');
  assert.equal(inutile.fonction, 'alarme-sonore');
  assert.match(inutile.avis, /je ne l'entends pas/, 'l\'avis de la personne est repris');
});

test('la charge : un peu trop → « Bien », beaucoup trop → « À retravailler »', () => {
  const hugo = commande('hugo-notes');
  assert.equal(hugo.chargeMax, 1);
  const juste = evaluerProjet(projet('carnet', ['gros-bouton']), hugo, creation);
  assert.equal(juste.note, 'parfait');
  assert.equal(juste.capacite, 1, 'la limite de la personne remplace celle du modèle');

  const madeleine = commande('madeleine-medicaments');
  const confortMadeleine = { texte: 'tres-grand', contraste: 'eleve', police: 'lisible' };
  // Liste (capacité 5) : 1 + 2 + 2 + 1 = 6 → un peu chargée.
  const unPeu = evaluerProjet(projet('liste', ['rappels-ecran', 'lecture-voix', 'partage', 'historique'], confortMadeleine), madeleine, creation);
  const chargeUnPeu = unPeu.criteres.find((c) => c.sorte === 'charge');
  assert.equal(chargeUnPeu.etat, 'mineur');
  assert.equal(unPeu.note, 'bien');
  // 1 + 2 + 2 + 1 + 2 = 8 > 5 + 2 → trop chargée.
  const trop = evaluerProjet(projet('liste', ['rappels-ecran', 'lecture-voix', 'partage', 'historique', 'compte-en-ligne'], confortMadeleine), madeleine, creation);
  assert.equal(trop.criteres.find((c) => c.sorte === 'charge').etat, 'bloquant');
  assert.equal(trop.note, 'aRetravailler');
});

test('les récompenses : « Parfait » paie tout, « Bien » une part, les petits plus en sus', () => {
  const madeleine = commande('madeleine-medicaments');
  const confortMadeleine = { texte: 'grand', contraste: 'eleve', police: 'lisible' };
  const parfait = evaluerProjet(projet('liste', ['rappels-ecran'], confortMadeleine), madeleine, creation);
  assert.equal(parfait.note, 'parfait');
  assert.deepEqual(parfait.recompense, { argent: 70, reputation: 14 });
  const avecBonus = evaluerProjet(projet('liste', ['rappels-ecran', 'lecture-voix'], confortMadeleine), madeleine, creation);
  assert.equal(avecBonus.note, 'parfait');
  assert.equal(avecBonus.bonusObtenus, 1);
  assert.deepEqual(avecBonus.recompense, { argent: 80, reputation: 14 });
  const bien = evaluerProjet(projet('liste', ['rappels-ecran'], { ...confortMadeleine, police: 'standard' }), madeleine, creation);
  assert.equal(bien.note, 'bien');
  assert.deepEqual(bien.recompense, { argent: Math.round(70 * 0.7), reputation: Math.round(14 * 0.7) });
});

test('un projet venu d\'une ancienne sauvegarde est nettoyé (rien d\'inconnu ne passe)', () => {
  const propre = nettoyerProjet({
    modele: 'fusee', fonctions: ['vibration', 'teleportation', 'vibration'], confort: { texte: 'geant', contraste: 'eleve' }, essais: -3,
  }, creation);
  assert.equal(propre.modele, null);
  assert.deepEqual(propre.fonctions, ['vibration']);
  assert.equal(propre.confort.texte, 'normal');
  assert.equal(propre.confort.contraste, 'eleve');
  assert.equal(propre.essais, 0);
  assert.equal(chargeDuProjet(propre, creation), 1);
});

test('les commandes : appel du mentor, essai, puis les suivantes', () => {
  const partie = partieNeuve();
  assert.equal(objectifDuMoment(partie, commandes, paliers).cle, 'allumer');
  assert.equal(etatDesCommandes(partie, commandes, paliers).offres.length, 0, 'rien avant l\'appel du mentor');

  partie.drapeaux[DRAPEAU_VISIO_ACCUEIL] = true;
  let etat = etatDesCommandes(partie, commandes, paliers);
  assert.deepEqual(etat.offres.map((c) => c.id), ['essai-courses']);
  assert.equal(objectifDuMoment(partie, commandes, paliers).cle, 'choisir');

  const essai = commande('essai-courses');
  const nouveau = accepterCommande(partie, essai, creation);
  assert.deepEqual(nouveau, projetVide(creation, partie.temps));
  assert.equal(objectifDuMoment(partie, commandes, paliers).cle, 'terminer');
  assert.deepEqual(verifierPartie(partie), [], 'la partie reste bien formée');

  // Livraison « à retravailler » : le projet reste, rien n'est gagné.
  const rate = evaluerProjet(nouveau, essai, creation);
  assert.equal(livrerProjet(partie, essai, rate, paliers).livree, false);
  assert.equal(partie.commandes.enCours['essai-courses'].essais, 1);
  assert.equal(objectifDuMoment(partie, commandes, paliers).cle, 'retravailler');
  assert.equal(partie.argent, donnees.jeu.depart.argent);

  // Livraison réussie : argent, réputation, nouvelles offres.
  partie.commandes.enCours['essai-courses'].modele = 'liste';
  const avant = idsDesOffres(partie, commandes, paliers);
  const reussite = evaluerProjet(partie.commandes.enCours['essai-courses'], essai, creation);
  assert.equal(reussite.note, 'parfait');
  const livraison = livrerProjet(partie, essai, reussite, paliers);
  assert.equal(livraison.livree, true);
  assert.equal(partie.argent, donnees.jeu.depart.argent + 20);
  assert.equal(partie.reputation, 5);
  assert.deepEqual(partie.commandes.enCours, {});
  assert.equal(partie.commandes.livrees[0].note, 'parfait');
  // Halaé, la première cliente, présente sa commande de vive voix.
  assert.deepEqual(nouvellesOffres(avant, idsDesOffres(partie, commandes, paliers), commandes), []);
  const objectif = objectifDuMoment(partie, commandes, paliers);
  assert.equal(objectif.cle, 'parler');
  assert.equal(objectif.destination, 'halae');
  const halae = commande('halae-planning');
  assert.deepEqual(commandesAProposer(partie, commandes, paliers).map((c) => c.id), ['halae-planning']);
  proposerCommande(partie, halae);
  assert.deepEqual(commandesAProposer(partie, commandes, paliers), []);
  assert.deepEqual([...idsDesOffres(partie, commandes, paliers)], ['halae-planning']);
  assert.equal(objectifDuMoment(partie, commandes, paliers).cle, 'choisir');

  // Sa commande livrée, les suivantes arrivent.
  const projetHalae = accepterCommande(partie, halae, creation);
  Object.assign(projetHalae, { modele: 'agenda', fonctions: ['rappels-ecran', 'vue-semaine'] });
  const avantHalae = idsDesOffres(partie, commandes, paliers);
  const evaluationHalae = evaluerProjet(projetHalae, halae, creation);
  assert.equal(evaluationHalae.note, 'parfait');
  assert.equal(livrerProjet(partie, halae, evaluationHalae, paliers).livree, true);
  const nouvelles = nouvellesOffres(avantHalae, idsDesOffres(partie, commandes, paliers), commandes).map((c) => c.id);
  assert.deepEqual(nouvelles, ['madeleine-medicaments', 'samia-fournees', 'karim-atelier']);
  // Théo présente la sienne de vive voix, quand il passe à 16 h.
  assert.deepEqual(commandesAProposer(partie, commandes, paliers).map((c) => c.id), ['theo-changements']);
  assert.ok(!nouvelles.includes('hugo-notes'), 'Hugo attend le niveau 2 de réputation');
  assert.deepEqual(verifierPartie(partie), []);

  etat = etatDesCommandes(partie, commandes, paliers);
  assert.equal(etat.livrees.length, 2);
});

test('Hugo arrive avec le bouche-à-oreille (niveau 2 de réputation)', () => {
  const partie = partieNeuve();
  partie.drapeaux[DRAPEAU_VISIO_ACCUEIL] = true;
  partie.commandes.livrees.push({ id: 'essai-courses', note: 'parfait', jour: 1, argent: 20, reputation: 5 });
  partie.reputation = 29;
  assert.ok(!idsDesOffres(partie, commandes, paliers).has('hugo-notes'));
  const niveaux = gagner(partie, { argent: 0, reputation: 1 }, paliers);
  assert.deepEqual([niveaux.niveauAvant, niveaux.niveauApres], [1, 2]);
  assert.equal(niveaux.nomNiveau, 'Bouche-à-oreille');
  assert.ok(idsDesOffres(partie, commandes, paliers).has('hugo-notes'));
});

test('la progression de la réputation indique le palier suivant', () => {
  assert.deepEqual(progressionReputation(12, paliers), {
    niveau: 1, nom: 'Premiers pas', points: 12, suivant: paliers[1], reste: 18,
  });
  const max = progressionReputation(1000, paliers);
  assert.equal(max.suivant, null);
  assert.equal(max.reste, 0);
});

test('toutes les commandes livrées : l\'objectif le dit', () => {
  const partie = partieNeuve();
  partie.drapeaux[DRAPEAU_VISIO_ACCUEIL] = true;
  partie.commandes.livrees = commandes.map((c) => ({ id: c.id, note: 'bien', jour: 2, argent: 1, reputation: 1 }));
  assert.equal(objectifDuMoment(partie, commandes, paliers).cle, 'fini');
});

// Contraste entre deux couleurs « #rrggbb » (formule WCAG).
function contraste(premiere, seconde) {
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [claire, sombre] = [luminance(premiere), luminance(seconde)].sort((a, b) => b - a);
  return (claire + 0.05) / (sombre + 0.05);
}

test('l\'aperçu de l\'atelier reste lisible, en contraste normal comme élevé', async () => {
  const { lire } = await import('./aides.mjs');
  const themes = lire('css/themes.css');
  const couleur = (nom) => themes.match(new RegExp(`--apercu-${nom}:\\s*(#[0-9a-f]{6})`, 'i'))[1];
  assert.ok(contraste(couleur('texte'), couleur('fond')) >= 4.5);
  assert.ok(contraste(couleur('texte'), couleur('bloc')) >= 4.5);
  assert.ok(contraste(couleur('titre-texte'), couleur('titre-fond')) >= 4.5);
  assert.ok(contraste(couleur('accent-texte'), couleur('accent-fond')) >= 4.5);
  assert.ok(contraste(couleur('fort-texte'), couleur('fort-fond')) >= 20);
  // Le contraste « élevé » se voit vraiment : bien plus fort que le « normal ».
  assert.ok(contraste(couleur('fort-texte'), couleur('fort-fond')) > 2.5 * contraste(couleur('texte'), couleur('fond')));
});
