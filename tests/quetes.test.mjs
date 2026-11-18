// Tests : les quêtes (jalon 4) — déblocage, étapes constatées ou faites par
// le joueur, étapes facultatives, fin et récompense, quête suivie, objectif
// affiché en haut, partie d'une ancienne version, et vérification des données.
// Jalon 5 : les étapes « acheter » et « placer ».

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chargerDonneesDuDisque } from './aides.mjs';
import {
  DRAPEAU_VISIO_ACCUEIL, accepterCommande, livrerProjet, proposerCommande,
} from '../js/jeu/commandes.js';
import { evaluerProjet, meilleurProjet } from '../js/jeu/creation.js';
import {
  DRAPEAU_TEXTE_AGRANDI, empreinteDesQuetes, etapeCourante, etapesDeQuete, etapesVers, faireEtape,
  mettreAJourQuetes, objectifDeQuete, queteDebloquee, sujetsPour,
} from '../js/jeu/quetes.js';
import { verifierCoherence } from '../js/noyau/coherence.js';
import { nouvellePartie, verifierPartie } from '../js/noyau/format-sauvegarde.js';

const donnees = await chargerDonneesDuDisque();
const { creation } = donnees;
const commandes = donnees.commandes.commandes;
const quetes = donnees.quetes.quetes;
const paliers = donnees.jeu.reputation.paliers;
const contexte = { quetes, commandes, paliers };
const quete = (id) => quetes.find((q) => q.id === id);
const commande = (id) => commandes.find((c) => c.id === id);
const types = (evenements) => evenements.map((e) => `${e.type}:${e.quete.id}${e.etape ? `/${e.etape.id}` : ''}`);

function partieNeuve() {
  return nouvellePartie({ graine: 11, depart: donnees.jeu.depart, versionJeu: 'test' });
}

// Livre une commande « parfaitement » (la meilleure solution possible).
function livrer(partie, id) {
  const c = commande(id);
  const projet = accepterCommande(partie, c, creation);
  Object.assign(projet, meilleurProjet(c, creation).projet);
  const resultat = livrerProjet(partie, c, evaluerProjet(projet, c, creation), paliers);
  assert.equal(resultat.livree, true, id);
}

test('les quêtes du premier livrable sont chargées : cinq, une par principe', () => {
  const premierLivrable = quetes.slice(0, 5);
  assert.deepEqual(new Set(premierLivrable.map((q) => q.principe)), new Set(Object.keys(donnees.quetes.principes)));
  assert.deepEqual(premierLivrable.map((q) => q.titre), [
    'Bienvenue à l\'atelier', 'Le planning de publication', 'Un matin sans surprise',
    'Des sous-titres pour tout le monde', 'Réviser sans se noyer',
  ]);
  // Jalon 5 : aménager la maison.
  assert.deepEqual(quetes.slice(5).map((q) => q.titre), ['Un intérieur où tout le monde passe', 'Un vrai local', 'Un coin pour souffler']);
});

test('les textes validés par Halaé n\'ont pas changé', () => {
  const planning = quete('planning-publication');
  assert.equal(planning.resume, 'Halaé publie une vidéo par semaine. Entre le tournage, le montage et les commentaires, elle s\'y perd un peu : aide-la à s\'organiser, simplement.');
  assert.equal(planning.fin, 'Halaé a son planning : chaque étape de sa semaine, un rappel pour chacune, et rien de plus.');
  const sousTitres = quete('sous-titres');
  assert.equal(sousTitres.resume, 'Karim, qui est sourd, aimerait suivre les vidéos d\'Halaé, mais elles n\'ont pas de sous-titres. Aide Halaé à en ajouter : ils serviront à bien d\'autres personnes.');
  assert.equal(sousTitres.fin, 'Les vidéos d\'Halaé ont leurs sous-titres : Karim peut les suivre, et toutes les personnes qui regardent sans le son aussi.');
  assert.equal(sousTitres.etapes.find((e) => e.id === 'television').message, 'La nouvelle vidéo d\'Halaé défile, avec des sous-titres bien lisibles.');
  assert.equal(sousTitres.etapes.find((e) => e.id === 'theo').replique, 'Oui, dans le bus, sans le son. Grâce aux sous-titres, j\'ai tout compris !');
  assert.equal(commande('halae-sous-titres').demande, 'Karim m\'a écrit : il aimerait suivre mes vidéos, mais il est sourd, et je ne mets jamais de sous-titres. Les écrire à la main me prend des heures… Tu pourrais m\'aider ?');
});

test('une nouvelle partie : la quête de bienvenue commence et s\'affiche en haut', () => {
  const partie = partieNeuve();
  assert.deepEqual(types(mettreAJourQuetes(partie, quetes, paliers)), ['nouvelle:bienvenue']);
  assert.equal(partie.quetes.suivie, 'bienvenue');
  assert.deepEqual(Object.keys(partie.quetes.actives), ['bienvenue']);
  const objectif = objectifDeQuete(partie, contexte);
  assert.equal(objectif.etape.id, 'appel');
  assert.equal(objectif.etape.texte, 'allume ton ordinateur, au bureau');
  assert.equal(objectif.destination, 'bureau');
  assert.deepEqual(verifierPartie(partie), [], 'la partie reste bien formée');
  // Rien ne change si l'on recommence : pas d'événement en double.
  assert.deepEqual(mettreAJourQuetes(partie, quetes, paliers), []);
});

test('l\'objectif suit la commande de l\'étape : à accepter, à terminer, à reprendre', () => {
  const partie = partieNeuve();
  mettreAJourQuetes(partie, quetes, paliers);
  partie.drapeaux[DRAPEAU_VISIO_ACCUEIL] = true;
  assert.deepEqual(types(mettreAJourQuetes(partie, quetes, paliers)), ['etape:bienvenue/appel']);
  assert.equal(objectifDeQuete(partie, contexte).cle, 'accepter');
  const projet = accepterCommande(partie, commande('essai-courses'), creation);
  assert.equal(objectifDeQuete(partie, contexte).cle, 'terminer');
  projet.resultat = 'aRetravailler';
  const objectif = objectifDeQuete(partie, contexte);
  assert.equal(objectif.cle, 'retravailler');
  assert.equal(objectif.commande.id, 'essai-courses');
  assert.equal(objectif.destination, 'bureau');
});

test('une quête finie donne sa récompense une seule fois, et la suivante commence', () => {
  const partie = partieNeuve();
  mettreAJourQuetes(partie, quetes, paliers);
  partie.drapeaux[DRAPEAU_VISIO_ACCUEIL] = true;
  mettreAJourQuetes(partie, quetes, paliers);
  livrer(partie, 'essai-courses');
  const argent = partie.argent;
  const reputation = partie.reputation;
  const evenements = mettreAJourQuetes(partie, quetes, paliers);
  assert.deepEqual(types(evenements), ['etape:bienvenue/essai', 'finie:bienvenue', 'nouvelle:planning-publication']);
  assert.equal(partie.argent, argent + 20);
  assert.equal(partie.reputation, reputation + 5);
  assert.deepEqual(partie.quetes.finies, ['bienvenue']);
  assert.equal(partie.quetes.suivie, 'planning-publication', 'la quête suivante est suivie');
  // Une seconde mise à jour ne redonne rien.
  assert.deepEqual(mettreAJourQuetes(partie, quetes, paliers), []);
  assert.equal(partie.argent, argent + 20);
  // Halaé : il faut lui parler.
  const objectif = objectifDeQuete(partie, contexte);
  assert.equal(objectif.etape.type, 'demande');
  assert.equal(objectif.etape.texte, 'parle à Halaé');
  assert.equal(objectif.destination, 'halae');
});

test('une étape facultative ne bloque jamais, et reste possible après la fin', () => {
  const partie = partieNeuve();
  mettreAJourQuetes(partie, quetes, paliers);
  partie.drapeaux[DRAPEAU_VISIO_ACCUEIL] = true;
  livrer(partie, 'essai-courses');
  mettreAJourQuetes(partie, quetes, paliers);
  assert.ok(partie.quetes.finies.includes('bienvenue'), 'finie sans l\'étape facultative');
  const lignes = etapesDeQuete(quete('bienvenue'), partie, paliers);
  const facultative = lignes.find((l) => l.etape.id === 'texte-agrandi');
  assert.equal(facultative.faite, false);
  assert.equal(facultative.ouverte, true, 'encore possible');
  partie.drapeaux[DRAPEAU_TEXTE_AGRANDI] = true;
  assert.deepEqual(types(mettreAJourQuetes(partie, quetes, paliers)), ['etape:bienvenue/texte-agrandi']);
});

test('les quêtes de Théo : vive voix à 16 h, livraison, puis des nouvelles', () => {
  const partie = partieNeuve();
  partie.drapeaux[DRAPEAU_VISIO_ACCUEIL] = true;
  livrer(partie, 'essai-courses');
  proposerCommande(partie, commande('halae-planning'));
  livrer(partie, 'halae-planning');
  const evenements = mettreAJourQuetes(partie, quetes, paliers);
  assert.deepEqual(types(evenements).filter((e) => e.startsWith('nouvelle') || e.startsWith('finie')),
    ['finie:bienvenue', 'finie:planning-publication', 'nouvelle:matin-sans-surprise', 'nouvelle:interieur-pour-tous']);
  assert.ok(!partie.quetes.actives['sous-titres'], 'la quête des sous-titres attend la commande de Karim');
  const matin = quete('matin-sans-surprise');
  assert.equal(objectifDeQuete(partie, contexte).destination, 'theo');
  // Avant la livraison, on ne peut pas encore lui demander des nouvelles.
  assert.deepEqual(sujetsPour(partie, quetes, 'theo', paliers), []);
  proposerCommande(partie, commande('theo-changements'));
  mettreAJourQuetes(partie, quetes, paliers);
  assert.equal(objectifDeQuete(partie, contexte).cle, 'accepter');
  livrer(partie, 'theo-changements');
  mettreAJourQuetes(partie, quetes, paliers);
  const sujets = sujetsPour(partie, quetes, 'theo', paliers);
  assert.deepEqual(sujets.map((s) => s.etape.id), ['nouvelles']);
  assert.equal(sujets[0].etape.question, 'Alors, cette application ?');
  assert.deepEqual(sujetsPour(partie, quetes, 'halae', paliers), [], 'rien à demander à Halaé');
  // Le joueur pose la question : l'étape est faite, la quête se termine.
  assert.deepEqual(types(faireEtape(partie, matin, sujets[0].etape, paliers)), ['etape:matin-sans-surprise/nouvelles']);
  assert.deepEqual(types(mettreAJourQuetes(partie, quetes, paliers)), ['finie:matin-sans-surprise', 'nouvelle:reviser-sans-se-noyer']);
  // Une étape déjà faite ne se refait pas.
  assert.deepEqual(faireEtape(partie, matin, sujets[0].etape, paliers), []);
});

test('les sous-titres : après Karim ; la télévision et Théo restent facultatifs', () => {
  const partie = partieNeuve();
  partie.drapeaux[DRAPEAU_VISIO_ACCUEIL] = true;
  livrer(partie, 'essai-courses');
  proposerCommande(partie, commande('halae-planning'));
  livrer(partie, 'halae-planning');
  livrer(partie, 'karim-atelier');
  mettreAJourQuetes(partie, quetes, paliers);
  assert.ok(partie.quetes.actives['sous-titres']);
  const sousTitres = quete('sous-titres');
  assert.deepEqual(etapesVers(partie, quetes, 'television', paliers), [], 'pas avant la livraison');
  partie.quetes.suivie = 'sous-titres';
  assert.equal(objectifDeQuete(partie, contexte).destination, 'halae');
  proposerCommande(partie, commande('halae-sous-titres'));
  livrer(partie, 'halae-sous-titres');
  const evenements = mettreAJourQuetes(partie, quetes, paliers);
  assert.ok(types(evenements).includes('finie:sous-titres'), 'finie sans les étapes facultatives');
  const tele = etapesVers(partie, quetes, 'television', paliers);
  assert.deepEqual(tele.map((e) => e.etape.id), ['television']);
  assert.deepEqual(types(faireEtape(partie, sousTitres, tele[0].etape, paliers)), ['etape:sous-titres/television']);
  assert.deepEqual(sujetsPour(partie, quetes, 'theo', paliers).map((s) => s.etape.id), ['theo']);
});

test('une partie d\'une ancienne version : ce qui est fait compte, sans annonce en double', () => {
  const partie = partieNeuve();
  partie.drapeaux[DRAPEAU_VISIO_ACCUEIL] = true;
  livrer(partie, 'essai-courses');
  proposerCommande(partie, commande('halae-planning'));
  livrer(partie, 'halae-planning');
  // Théo avait accepté sa commande avant qu'elle ne soit donnée de vive voix.
  accepterCommande(partie, commande('theo-changements'), creation);
  const argent = partie.argent;
  const evenements = mettreAJourQuetes(partie, quetes, paliers);
  assert.deepEqual(types(evenements), ['finie:bienvenue', 'finie:planning-publication', 'nouvelle:matin-sans-surprise',
    'nouvelle:interieur-pour-tous']);
  assert.equal(partie.argent, argent + 40, 'les deux récompenses');
  const matin = etapesDeQuete(quete('matin-sans-surprise'), partie, paliers);
  assert.equal(matin[0].faite, true, 'sa commande déjà acceptée vaut la demande');
  assert.equal(etapeCourante(quete('matin-sans-surprise'), partie, paliers).etape.id, 'livraison');
});

test('conditions : drapeau, niveau ; étape « réputation »', () => {
  const partie = partieNeuve();
  const essai = {
    id: 'essai', titre: 'Essai', principe: 'lisibilite', donneur: 'halae', resume: 'r', fin: 'f',
    recompense: { argent: 0, reputation: 0 },
    debloquee: { drapeau: DRAPEAU_VISIO_ACCUEIL, niveau: 1 },
    etapes: [{ id: 'niveau', type: 'reputation', niveau: 2, texte: 'atteins le niveau 2' }],
  };
  assert.equal(queteDebloquee(essai, partie, paliers), false);
  partie.drapeaux[DRAPEAU_VISIO_ACCUEIL] = true;
  assert.equal(queteDebloquee(essai, partie, paliers), true);
  mettreAJourQuetes(partie, [essai], paliers);
  assert.equal(objectifDeQuete(partie, { ...contexte, quetes: [essai] }).destination, 'bureau');
  partie.reputation = paliers[1].points;
  assert.deepEqual(types(mettreAJourQuetes(partie, [essai], paliers)), ['etape:essai/niveau', 'finie:essai']);
  assert.equal(partie.quetes.suivie, null, 'plus rien à suivre');
  assert.equal(objectifDeQuete(partie, { ...contexte, quetes: [essai] }), null);
});

test('l\'empreinte change avec ce qui compte, pas avec le temps qui passe', () => {
  const partie = partieNeuve();
  const avant = empreinteDesQuetes(partie);
  partie.temps.minute += 30;
  partie.joueur = { modele: 'perso', nom: 'X', apparence: null, position: { x: 1, z: 1, angle: 0 } };
  assert.equal(empreinteDesQuetes(partie), avant);
  partie.drapeaux[DRAPEAU_VISIO_ACCUEIL] = true;
  assert.notEqual(empreinteDesQuetes(partie), avant);
});

test('des données de quêtes fautives sont refusées avec une explication', () => {
  const copie = JSON.parse(JSON.stringify(donnees));
  const fautives = copie.quetes.quetes;
  fautives[0].etapes.push({ id: 'x', type: 'commande', commande: 'fusee', texte: 'livre la fusée' });
  fautives[1].etapes.push({ id: 'y', type: 'demande', commande: 'madeleine-medicaments', texte: 'parle à Madeleine' });
  fautives[2].etapes.push({ id: 'z', type: 'parler', pnj: 'ferrus', question: 'q', replique: 'r', texte: 'parle au mentor' });
  fautives[3].etapes.push({ id: 'w', type: 'aller', cible: 'piscine', texte: 'va à la piscine', facultative: true });
  fautives[4].debloquee = { quetes: ['reviser-sans-se-noyer'] };
  const problemes = verifierCoherence(copie).join('\n');
  assert.match(problemes, /la commande « fusee » n'existe pas/);
  assert.match(problemes, /« madeleine-medicaments » n'est pas « enPersonne »/);
  assert.match(problemes, /ferrus n'est pas là quand on joue « ferrus »/);
  assert.match(problemes, /la cible « piscine » n'est ni un meuble/);
  assert.match(problemes, /reviser-sans-se-noyer : ne commence ou ne se termine jamais/);
});

test('jalon 5 : acheter un meuble, le poser chez soi ; le matériel reste facultatif', () => {
  const partie = partieNeuve();
  partie.drapeaux[DRAPEAU_VISIO_ACCUEIL] = true;
  livrer(partie, 'essai-courses');
  mettreAJourQuetes(partie, quetes, paliers);
  proposerCommande(partie, commande('halae-planning'));
  livrer(partie, 'halae-planning');
  assert.ok(types(mettreAJourQuetes(partie, quetes, paliers)).includes('nouvelle:interieur-pour-tous'));
  const interieur = quete('interieur-pour-tous');
  assert.equal(etapeCourante(interieur, partie, paliers).etape.id, 'achat');
  assert.equal(objectifDeQuete(partie, contexte, 'interieur-pour-tous').destination, 'bureau', 'on achète sur l\'ordinateur');

  // Du matériel ne suffit pas : il faut un meuble.
  partie.possessions.push({ id: 'achat-1', article: 'grand-ecran', sorte: 'materiel', jour: 1, prix: 90 });
  assert.deepEqual(types(mettreAJourQuetes(partie, quetes, paliers)), ['etape:interieur-pour-tous/materiel'],
    'l\'étape facultative du matériel est faite');
  partie.possessions.push({ id: 'achat-2', article: 'cactus', sorte: 'meuble', jour: 1, prix: 10 });
  assert.deepEqual(types(mettreAJourQuetes(partie, quetes, paliers)), ['etape:interieur-pour-tous/achat']);
  assert.equal(objectifDeQuete(partie, contexte, 'interieur-pour-tous').destination, 'amenager', 'poser : le mode Aménager');

  // Posé ailleurs qu'au domicile, ça ne compte pas.
  partie.lieux.amenagements.bureaux = [{ id: 'achat-2', x: 1, z: 1, rotation: 0 }];
  assert.deepEqual(types(mettreAJourQuetes(partie, quetes, paliers)), []);
  partie.lieux.amenagements = { domicile: [{ id: 'achat-2', x: 9, z: 10, rotation: 0 }] };
  const argent = partie.argent;
  assert.deepEqual(types(mettreAJourQuetes(partie, quetes, paliers)), ['etape:interieur-pour-tous/pose', 'finie:interieur-pour-tous']);
  assert.equal(partie.argent, argent + interieur.recompense.argent);
  assert.deepEqual(verifierPartie(partie), []);
});

test('les étapes « acheter » et « placer » fautives sont refusées', () => {
  const copie = JSON.parse(JSON.stringify(donnees));
  const fautives = copie.quetes.quetes;
  fautives[5].etapes.push(
    { id: 'licorne', type: 'acheter', article: 'licorne', texte: 'achète une licorne', facultative: true },
    { id: 'ecran', type: 'placer', article: 'grand-ecran', texte: 'pose l\'écran', facultative: true },
    { id: 'lune', type: 'placer', lieu: 'lune', texte: 'pose un meuble sur la Lune', facultative: true },
    { id: 'rien', type: 'acheter', texte: 'achète', facultative: true },
  );
  const problemes = verifierCoherence(copie).join('\n');
  assert.match(problemes, /l'article « licorne » n'est pas vendu/);
  assert.match(problemes, /seuls les meubles se placent/);
  assert.match(problemes, /lieu : « lune » n'existe pas/);
});
