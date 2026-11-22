// Tests : la boutique (jalon 5) — articles, achats, matériel et son bonus,
// et la sauvegarde des achats (format 4).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chargerDonneesDuDisque } from './aides.mjs';

const {
  acheter, articlesDeLaBoutique, bonusDuMateriel, catalogueEquipe, etatDeLArticle, materielInstalle, nombrePossedes,
  trouverArticle,
} = await import('../js/jeu/boutique.js');
const { evaluerProjet, meilleurProjet } = await import('../js/jeu/creation.js');
const { accepterCommande, livrerProjet } = await import('../js/jeu/commandes.js');
const { nouvellePartie, preparerPartie, verifierPartie, VERSION_FORMAT } = await import('../js/noyau/format-sauvegarde.js');
const { verifierCoherence } = await import('../js/noyau/coherence.js');

const donnees = await chargerDonneesDuDisque();
const { boutique, jeu, creation } = donnees;
const paliers = jeu.reputation.paliers;
const articles = articlesDeLaBoutique(boutique, donnees.meubles.meubles);

function partie({ argent = 500, reputation = 0 } = {}) {
  const p = nouvellePartie({ graine: 1, depart: jeu.depart, versionJeu: 'test', joueur: null });
  p.argent = argent;
  p.reputation = reputation;
  return p;
}

test('la boutique vend du matériel et des meubles, avec leur nom et leur description', () => {
  const materiel = articles.filter((article) => article.sorte === 'materiel');
  const meubles = articles.filter((article) => article.sorte === 'meuble');
  assert.deepEqual(materiel.map((article) => article.id), ['grand-ecran', 'clavier-confort', 'siege-reglable']);
  assert.ok(meubles.length >= 8);
  const cactus = trouverArticle(articles, 'cactus');
  assert.equal(cactus.nom, 'Cactus', 'le nom vient du catalogue des meubles');
  assert.match(cactus.description, /oublie d'arroser/, 'la description de la boutique');
  assert.match(trouverArticle(articles, 'fauteuil').description, /fauteuil profond/, 'sinon celle du meuble');
  for (const article of articles) assert.ok(article.prix > 0 && article.description, article.id);
});

test('acheter : le prix est payé, l\'achat est gardé avec un identifiant unique', () => {
  const p = partie({ argent: 100 });
  const cactus = trouverArticle(articles, 'cactus');
  const premier = acheter(p, cactus, paliers);
  const second = acheter(p, cactus, paliers);
  assert.equal(p.argent, 80);
  assert.deepEqual(premier, { id: 'achat-1', article: 'cactus', sorte: 'meuble', jour: 1, prix: 10 });
  assert.equal(second.id, 'achat-2');
  assert.equal(nombrePossedes(p, 'cactus'), 2, 'un meuble peut s\'acheter plusieurs fois');
});

test('un article se refuse poliment : niveau trop bas, pas assez d\'argent, matériel déjà installé', () => {
  const p = partie({ argent: 50 });
  const aquarium = trouverArticle(articles, 'aquarium');
  assert.deepEqual(etatDeLArticle(aquarium, p, paliers), { possible: false, raison: 'niveau', niveau: 3 });
  const ecran = trouverArticle(articles, 'grand-ecran');
  assert.deepEqual(etatDeLArticle(ecran, p, paliers), { possible: false, raison: 'argent', manque: 40 });
  assert.equal(acheter(p, ecran, paliers), null);
  assert.equal(p.argent, 50, 'rien n\'est payé');
  assert.deepEqual(p.possessions, []);
  p.argent = 200;
  assert.ok(acheter(p, ecran, paliers));
  assert.deepEqual(etatDeLArticle(ecran, p, paliers), { possible: false, raison: 'installe' });
  assert.equal(acheter(p, ecran, paliers), null, 'le matériel ne s\'achète qu\'une fois');
});

test('le matériel rapporte quelques pièces de plus à chaque livraison', () => {
  const p = partie({ argent: 1000, reputation: 100 });
  assert.equal(bonusDuMateriel(p, boutique), 0);
  acheter(p, trouverArticle(articles, 'grand-ecran'), paliers);
  acheter(p, trouverArticle(articles, 'clavier-confort'), paliers);
  const bonusAttendu = trouverArticle(articles, 'grand-ecran').bonus + trouverArticle(articles, 'clavier-confort').bonus;
  assert.equal(bonusAttendu, 20);
  assert.equal(bonusDuMateriel(p, boutique), bonusAttendu);
  assert.deepEqual(materielInstalle(p, boutique).map((article) => article.id), ['grand-ecran', 'clavier-confort']);

  const commande = donnees.commandes.commandes.find((c) => c.id === 'essai-courses');
  const { projet } = meilleurProjet(commande, creation);
  const sans = evaluerProjet(projet, commande, creation);
  const avec = evaluerProjet(projet, commande, creation, { bonusMateriel: bonusAttendu });
  assert.equal(avec.recompense.argent, sans.recompense.argent + bonusAttendu);
  assert.equal(avec.recompense.materiel, bonusAttendu);
  assert.equal(avec.recompense.reputation, sans.recompense.reputation, 'la réputation ne change pas');
  const rate = evaluerProjet({ modele: null, fonctions: [], confort: {} }, commande, creation, { bonusMateriel: bonusAttendu });
  assert.deepEqual([rate.recompense.argent, rate.recompense.materiel ?? 0], [0, 0], 'rien pour un projet à retravailler');

  accepterCommande(p, commande, creation);
  const argentAvant = p.argent;
  livrerProjet(p, commande, avec, paliers);
  assert.equal(p.argent, argentAvant + avec.recompense.argent);
  assert.equal(p.commandes.livrees[0].argent, avec.recompense.argent, 'le bonus est compté dans le paiement');
});

test('le matériel remplace les formes de son élément, sans toucher aux données', () => {
  const meubles = donnees.meubles.meubles;
  const bureau = meubles.find((meuble) => meuble.id === 'bureau');
  const ecran = boutique.materiel.find((article) => article.id === 'grand-ecran');
  const siege = boutique.materiel.find((article) => article.id === 'siege-reglable');
  const catalogue = catalogueEquipe(meubles, [ecran, siege]);
  const equipe = catalogue.get('bureau');
  const ecrans = (meuble) => meuble.formes.filter((forme) => forme.element === 'ecran');
  assert.equal(ecrans(equipe).length, ecran.formes.length, 'les formes du grand écran');
  assert.equal(equipe.formes.length, bureau.formes.length - ecrans(bureau).length + ecran.formes.length);
  assert.deepEqual(equipe.formes.filter((forme) => forme.element === 'clavier'), bureau.formes.filter((forme) => forme.element === 'clavier'),
    'le clavier reste celui d\'origine');
  assert.equal(catalogue.get('chaise-bureau').formes.length, siege.formes.length, 'la chaise devient le siège réglable');
  assert.equal(catalogue.get('lit-double'), meubles.find((meuble) => meuble.id === 'lit-double'), 'les autres meubles ne changent pas');
  assert.equal(ecrans(bureau).length, 8, 'les données d\'origine sont intactes');
});

test('la sauvegarde garde les achats et les meubles posés (format 4)', () => {
  assert.equal(VERSION_FORMAT, 4);
  const p = partie();
  acheter(p, trouverArticle(articles, 'cactus'), paliers);
  acheter(p, trouverArticle(articles, 'grand-ecran'), paliers);
  p.lieux.amenagements.domicile = [{ id: 'achat-1', x: 9, z: 9, rotation: 0 }];
  assert.deepEqual(verifierPartie(p), []);
  assert.deepEqual(preparerPartie(JSON.parse(JSON.stringify(p))).possessions, p.possessions);

  const abimee = (modifier) => {
    const copie = JSON.parse(JSON.stringify(p));
    modifier(copie);
    return verifierPartie(copie);
  };
  assert.deepEqual(abimee((c) => { c.possessions[0].id = 'vol-1'; }), ['possessions invalides', 'lieux invalides']);
  assert.deepEqual(abimee((c) => { c.possessions[1].id = 'achat-1'; }), ['possessions invalides']);
  assert.deepEqual(abimee((c) => { c.possessions[0].sorte = 'voiture'; }), ['possessions invalides', 'lieux invalides']);
  assert.deepEqual(abimee((c) => { c.lieux.amenagements.domicile[0].id = 'achat-2'; }), ['lieux invalides'], 'le matériel ne se pose pas');
  assert.deepEqual(abimee((c) => { c.lieux.amenagements.domicile[0].rotation = 45; }), ['lieux invalides']);
  assert.deepEqual(abimee((c) => { c.lieux.amenagements.bureaux = [{ id: 'achat-1', x: 1, z: 1, rotation: 0 }]; }), ['lieux invalides'],
    'un meuble n\'est posé qu\'à un seul endroit');
});

test('une partie du jalon 4 (format 3) passe au format 4 sans rien perdre', () => {
  const ancienne = partie({ argent: 240, reputation: 35 });
  ancienne.versionFormat = 3;
  ancienne.possessions = [];
  const migree = preparerPartie(JSON.parse(JSON.stringify(ancienne)));
  assert.equal(migree.versionFormat, 4);
  assert.deepEqual(migree.possessions, []);
  assert.deepEqual(migree.lieux.amenagements, {});
  assert.equal(migree.argent, 240);
  assert.equal(migree.reputation, 35);
});

test('une boutique fautive est refusée au démarrage, avec des messages clairs', () => {
  const fautive = structuredClone(boutique);
  fautive.meubles.push({ meuble: 'licorne', prix: 10 });
  fautive.meubles.push({ meuble: 'bureau', prix: 10 });
  fautive.materiel[0].element = 'antenne';
  fautive.materiel[1].formes[0].couleur = 'or-massif';
  fautive.materiel[2].niveau = 9;
  const texte = verifierCoherence({ ...donnees, boutique: fautive }).join('\n');
  assert.match(texte, /data\/boutique\.json › meubles › licorne : le meuble « licorne » n'existe pas/);
  assert.match(texte, /meubles › bureau : un meuble avec des actions \(dormir, ordinateur\) ne se vend pas/);
  assert.match(texte, /materiel › grand-ecran › element : aucun meuble de data\/meubles\.json n'a de formes « antenne »/);
  assert.match(texte, /materiel › clavier-confort › formes › n°1 : la couleur « or-massif » n'existe pas/);
  assert.match(texte, /materiel › siege-reglable › niveau : il n'y a que 5 niveaux/);
});
