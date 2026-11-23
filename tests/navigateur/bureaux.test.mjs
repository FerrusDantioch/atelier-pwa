// Tests navigateur (jalon 5) : les bureaux de l'atelier — les louer, sortir
// par la porte d'entrée, y arriver, une pièce encore fermée, un rechargement,
// et un objectif qui emmène d'un lieu à l'autre jusqu'à la bonne personne.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  attendre, attendreMonde, habitantsPresents, lirePartieEnCours, nouvellePartie, ouvrirJeu, preparer,
} from './aides-navigateur.mjs';

let outils;
before(async () => { outils = await preparer(); });
after(async () => { await outils.fermer(); });

const lireTexte = async (localisateur) => (await localisateur.innerText()).replace(/\s+/g, ' ');
const lieuActuel = async (page) => (await lirePartieEnCours(page)).lieux.actuel;

test('louer les bureaux, sortir par la porte d\'entrée, y arriver ; une pièce fermée ; le rechargement', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await page.evaluate(async () => {
    const { modifierPartie } = await import('/js/noyau/etat.js');
    modifierPartie((partie) => {
      partie.drapeaux['visio-accueil'] = true;
      partie.argent = 500;
      partie.reputation = 100;
    });
    const { mondeAffiche } = await import('/js/interface/ecran-jeu.js');
    const monde = mondeAffiche();
    monde.allerVers(monde.destinations().find((d) => d.id === 'bureau'));
  });
  await page.getByRole('button', { name: 'Utiliser l\'ordinateur' }).click({ timeout: 30000 });
  await page.getByRole('button', { name: /^Boutique/ }).click();
  const ordinateur = page.getByRole('dialog', { name: 'Ton ordinateur' });
  assert.match(await lireTexte(ordinateur), /Salle de pause .* D'abord, loue les bureaux de l'atelier\./);
  await page.getByRole('button', { name: /Louer : Les bureaux de l'atelier, pour 300 pièces/ }).click();
  await page.getByRole('heading', { name: 'Louer les bureaux de l\'atelier ?' }).waitFor();
  await page.getByRole('button', { name: /^Louer$/ }).click();
  assert.match(await lireTexte(ordinateur), /C'est loué : les bureaux de l'atelier\. Pour t'y rendre, sors par la porte d'entrée ; le trajet prend 10 minutes\./);
  await page.getByRole('button', { name: 'Fermer' }).last().click();

  // Jusqu'à la porte d'entrée : « Sortir… ».
  await page.getByRole('button', { name: 'Aller à…' }).click();
  await page.getByRole('dialog', { name: 'Aller à…' }).getByRole('button', { name: 'Porte d\'entrée' }).click();
  const sortir = page.getByRole('button', { name: 'Sortir…' });
  await sortir.waitFor({ timeout: 30000 });
  const minuteAvant = (await lirePartieEnCours(page)).temps.minute;
  await sortir.click();
  const fenetre = page.getByRole('dialog', { name: 'Où aller ?' });
  assert.match(await lireTexte(fenetre), /Le trajet prend 10 minutes/);
  await fenetre.getByRole('button', { name: 'Aller aux bureaux de l\'atelier' }).click();
  await page.locator('.notification-texte', { hasText: /Te voici aux bureaux de l'atelier\./ }).waitFor();
  const partie = await lirePartieEnCours(page);
  assert.equal(partie.lieux.actuel, 'bureaux');
  assert.equal(partie.temps.minute, minuteAvant + 10, 'le trajet prend 10 minutes');
  assert.deepEqual(partie.joueur.position, { x: 0, z: 18, angle: 90 }, 'devant la porte, le dos à la porte');
  assert.match(await lireTexte(page.locator('.lieu-actuel')), /Accueil/);
  // Une pièce encore fermée : on peut examiner sa porte.
  await page.getByRole('button', { name: 'Aller à…' }).click();
  const allerA = page.getByRole('dialog', { name: 'Aller à…' });
  assert.match(await lireTexte(allerA), /Autres lieux Aller chez toi/);
  assert.doesNotMatch(await lireTexte(allerA), /Aller dans la salle de pause/, 'une pièce fermée n\'est pas une destination');
  await allerA.getByRole('button', { name: 'Porte de la salle de pause' }).click();
  const examiner = page.getByRole('button', { name: /Examiner la porte de la salle de pause/ });
  await examiner.waitFor({ timeout: 30000 });
  await examiner.click();
  assert.match(await lireTexte(page.locator('.bulle')), /La salle de pause n'est pas encore aménagée\. Tu peux l'ouvrir dans la boutique, sur l'ordinateur\./);

  // Après rechargement, on est toujours aux bureaux.
  await page.reload();
  await page.locator('#chargement').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: /^Continuer/ }).click();
  await attendreMonde(page);
  const lieu = await page.evaluate(async () => (await import('/js/interface/ecran-jeu.js')).mondeAffiche().lieu.id);
  assert.equal(lieu, 'bureaux');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('un objectif emmène jusqu\'à Théo, au coin calme des bureaux ; il répond, la quête se termine', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  // Les bureaux loués, le coin calme ouvert, la quête de Théo en cours.
  await page.evaluate(async () => {
    const { modifierPartie } = await import('/js/noyau/etat.js');
    modifierPartie((partie) => {
      partie.drapeaux['visio-accueil'] = true;
      partie.reputation = 200;
      partie.lieux.debloques.push('bureaux');
      partie.possessions.push(
        { id: 'achat-1', article: 'bureaux', sorte: 'lieu', jour: 1, prix: 300 },
        { id: 'achat-2', article: 'coin-calme', sorte: 'piece', jour: 1, prix: 150 },
      );
      partie.quetes.finies.push('bienvenue', 'planning-publication', 'matin-sans-surprise', 'reviser-sans-se-noyer',
        'interieur-pour-tous', 'un-vrai-local');
      partie.quetes.actives = { 'coin-pour-souffler': { debut: { jour: 1, minute: 480 } } };
      partie.quetes.suivie = 'coin-pour-souffler';
      partie.drapeaux['etape-coin-pour-souffler-ecouter'] = true;
      partie.temps.minute = 13 * 60 + 45;
    });
  });
  await attendre(page, () => document.querySelector('.objectif').textContent.includes('rends visite à Théo'));
  // Théo n'est pas au domicile : l'objectif le dit, et y emmène.
  await page.locator('.objectif').click();
  await page.locator('.notification-texte', { hasText: /Théo est aux bureaux de l'atelier en ce moment\s:\sen route\s!/ }).waitFor();
  await attendre(page, async () => (await import('/js/noyau/etat.js')).partieEnCours().lieux.actuel === 'bureaux', undefined, { timeout: 40000 });
  const presents = await habitantsPresents(page);
  assert.ok(presents.some((habitant) => habitant.id === 'theo' && habitant.piece === 'coin-calme'), JSON.stringify(presents));
  const rendu = await page.evaluate(async () => (await import('/js/interface/ecran-jeu.js')).mondeAffiche().infosRendu);
  assert.ok(rendu.calls < 40, `toujours peu de dessins par image : ${rendu.calls}`);
  // Arrivé aux bureaux, le personnage continue jusqu'à Théo.
  const parler = page.getByRole('button', { name: 'Parler à Théo' });
  await parler.waitFor({ timeout: 40000 });
  await parler.click();
  const dialogue = page.getByRole('dialog', { name: /Théo/ });
  await dialogue.getByRole('button', { name: 'Alors, ce coin calme ?' }).click();
  assert.match(await lireTexte(dialogue), /j'ai révisé deux heures d'affilée\. Un record !/);
  await attendre(page, async () => (await import('/js/noyau/etat.js')).partieEnCours().quetes.finies.includes('coin-pour-souffler'));
  assert.equal(await lieuActuel(page), 'bureaux');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});
