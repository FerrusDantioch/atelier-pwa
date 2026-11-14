// Tests navigateur : le temps qui passe, dormir, et les personnages non
// joueurs (Halaé, Théo, le mentor) qui suivent leur routine.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  attendre, definirHeure, habitantsPresents, lirePartieEnCours, nouvellePartie, ouvrirJeu, preparer,
} from './aides-navigateur.mjs';

let outils;
before(async () => { outils = await preparer(); });
after(async () => { await outils.fermer(); });

const minuteDuJeu = async (page) => (await lirePartieEnCours(page)).temps.minute;
const present = async (page, id) => (await habitantsPresents(page)).some((h) => h.id === id);

test('le temps passe en jouant, et s\'arrête quand une fenêtre est ouverte', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  const depart = await minuteDuJeu(page);
  await page.waitForTimeout(2600);
  const ensuite = await minuteDuJeu(page);
  assert.ok(ensuite >= depart + 2, `de ${depart} à ${ensuite}`);
  assert.match(await page.locator('.barre-haut').innerText(), /8 h 0\d/);
  await page.getByRole('button', { name: 'Pause' }).click();
  const enPause = await minuteDuJeu(page);
  await page.waitForTimeout(2000);
  assert.equal(await minuteDuJeu(page), enPause, 'rien ne bouge pendant la pause');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('« Vitesse du temps : arrêtée » : l\'heure ne bouge plus', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await page.evaluate(async () => {
    const reglages = await import('/js/noyau/reglages.js');
    reglages.modifierReglage('vitesseTemps', 'arretee');
  });
  await nouvellePartie(page);
  const depart = await minuteDuJeu(page);
  await page.waitForTimeout(2000);
  assert.equal(await minuteDuJeu(page), depart);
  await contexte.close();
});

test('à 23 h, l\'horloge s\'arrête ; dormir mène au matin suivant, avec une copie de secours', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await definirHeure(page, 22 * 60 + 58);
  await page.locator('.notification-texte', { hasText: /La journée est finie/ }).waitFor({ timeout: 10000 });
  assert.equal(await minuteDuJeu(page), 23 * 60);
  await page.getByRole('button', { name: /Aller à/ }).click();
  await page.getByRole('dialog', { name: /Aller à/ }).getByRole('button', { name: 'Lit', exact: true }).click();
  await page.getByRole('button', { name: 'Dormir' }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Dormir' }).click();
  await page.getByRole('dialog', { name: /Dormir jusqu'à demain/ }).getByRole('button', { name: 'Dormir' }).click();
  await attendre(page, async () => {
    const etat = await import('/js/noyau/etat.js');
    return etat.partieEnCours().temps.jour === 2;
  });
  const partie = await lirePartieEnCours(page);
  assert.equal(partie.temps.minute, 7 * 60);
  assert.match(await page.locator('.barre-haut').innerText(), /Jour 2 · 7 h 0\d/);
  const raisons = await page.evaluate(async () => {
    const sauvegarde = await import('/js/noyau/sauvegarde.js');
    return (await sauvegarde.listerCopies()).map((copie) => copie.raison);
  });
  assert.ok(raisons.includes('nouveau-jour'));
  // Au réveil, Halaé prend son petit-déjeuner.
  assert.ok(await present(page, 'halae'));
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('parler à Halaé : sa rencontre, puis une salutation ; elle s\'arrête pour répondre', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await page.getByRole('button', { name: /Aller à/ }).click();
  const allerA = page.getByRole('dialog', { name: /Aller à/ });
  assert.match(await allerA.innerText(), /Personnes présentes/);
  await allerA.getByRole('button', { name: /Halaé/ }).click();
  const parler = page.getByRole('button', { name: /Parler à Halaé/ });
  await parler.waitFor({ timeout: 15000 });
  await parler.click();
  let dialogue = page.getByRole('dialog', { name: 'Halaé' });
  assert.match(await dialogue.innerText(), /je cherche une appli pour organiser mes vidéos/);
  await dialogue.getByRole('button', { name: /Qu'est-ce que tu fais/ }).click();
  assert.match(await dialogue.innerText(), /Je monte ma prochaine vidéo/);
  await dialogue.getByRole('button', { name: /À plus tard/ }).click();
  assert.equal((await lirePartieEnCours(page)).drapeaux['rencontre-halae'], true);
  // La deuxième fois : une salutation.
  await page.keyboard.press('Enter');
  dialogue = page.getByRole('dialog', { name: 'Halaé' });
  await dialogue.waitFor();
  assert.doesNotMatch(await dialogue.innerText(), /je cherche une appli/);
  await page.keyboard.press('Escape');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('Théo arrive à 16 h par la porte d\'entrée, et repart à 17 h', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  assert.equal(await present(page, 'theo'), false);
  await definirHeure(page, 15 * 60 + 59);
  await attendre(page, async () => {
    const ecran = await import('/js/interface/ecran-jeu.js');
    return ecran.mondeAffiche().habitantsPresents.some((h) => h.id === 'theo');
  });
  await page.waitForFunction(() => document.getElementById('annonces').textContent.includes('Théo arrive.'));
  await definirHeure(page, 16 * 60 + 59);
  await page.waitForFunction(() => document.getElementById('annonces').textContent.includes('Théo s\'en va.'), null, { timeout: 10000 });
  await attendre(page, async () => {
    const ecran = await import('/js/interface/ecran-jeu.js');
    return !ecran.mondeAffiche().habitantsPresents.some((h) => h.id === 'theo');
  }, undefined, { timeout: 30000 });
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('le mentor passe à 10 h, sauf quand on joue Ferrus (il ne vient alors qu\'en visio)', async () => {
  for (const [modele, attendu] of [['perso', true], ['ferrus', false]]) {
    const contexte = await outils.contexte();
    const page = await ouvrirJeu(contexte, outils.adresse);
    await nouvellePartie(page, { modele });
    await definirHeure(page, 9 * 60 + 59);
    await page.waitForTimeout(2500);
    assert.equal(await present(page, 'ferrus'), attendu, `en jouant « ${modele} »`);
    await contexte.close();
  }
});
