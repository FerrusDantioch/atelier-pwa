// Tests navigateur : sauvegarde automatique, export, import, copies de secours.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { gagnerPieces, jourSuivant, nouvellePartie, ouvrirJeu, preparer, texteBarre } from './aides-navigateur.mjs';

let outils;
before(async () => { outils = await preparer(); });
after(async () => { await outils.fermer(); });

async function ouvrirFenetreSauvegarde(page) {
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('dialog', { name: 'Pause' }).getByRole('button', { name: 'Sauvegarde' }).click();
  return page.getByRole('dialog', { name: 'Sauvegarde' });
}

test('la partie est retrouvée après rechargement (« Continuer »)', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await gagnerPieces(page, 10);
  await gagnerPieces(page, 10);
  await jourSuivant(page);
  await page.waitForFunction(() => document.querySelector('.barre-haut').innerText.includes('Jour 2'));
  assert.match(await texteBarre(page), /120 pièces/);
  // Retour à l'accueil : la partie est sauvegardée.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Retour à l'accueil/ }).click();
  await page.reload();
  const continuer = page.getByRole('button', { name: /Continuer/ });
  assert.match(await continuer.innerText(), /Jour 2.*120 pièces/s);
  await continuer.click();
  assert.match(await texteBarre(page), /120 pièces/);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('une modification faite juste avant de fermer le jeu n\'est pas perdue', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await gagnerPieces(page, 10);
  // Rechargement immédiat, sans laisser le temps à la sauvegarde régulière.
  await page.reload();
  await page.locator('#chargement').waitFor({ state: 'hidden' });
  assert.match(await page.getByRole('button', { name: /Continuer/ }).innerText(), /110 pièces/);
  // La copie d'urgence a été reprise puis effacée.
  assert.equal(await page.evaluate(() => localStorage.getItem('atelier-pwa.partie-urgence')), null);
  await contexte.close();
});

test('exporter, puis réimporter la partie dans une nouvelle partie', async () => {
  const contexte = await outils.contexte({ acceptDownloads: true });
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await gagnerPieces(page, 10);

  // Export.
  let fenetre = await ouvrirFenetreSauvegarde(page);
  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    fenetre.getByRole('button', { name: /Exporter ma partie/ }).click(),
  ]);
  assert.match(telechargement.suggestedFilename(), /^atelier-pwa-partie-\d{4}-\d{2}-\d{2}\.json$/);
  const chemin = await telechargement.path();
  const exportee = JSON.parse(readFileSync(chemin, 'utf8'));
  assert.equal(exportee.format, 'atelier-pwa-partie');
  assert.equal(exportee.argent, 110);

  // Nouvelle partie (avec confirmation), qui repart à 100 pièces.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Retour à l'accueil/ }).click();
  await nouvellePartie(page);
  assert.match(await texteBarre(page), /100 pièces/);

  // Import du fichier exporté.
  fenetre = await ouvrirFenetreSauvegarde(page);
  const [selecteur] = await Promise.all([
    page.waitForEvent('filechooser'),
    fenetre.getByRole('button', { name: /Importer une partie/ }).click(),
  ]);
  await selecteur.setFiles(chemin);
  const confirmation = page.getByRole('dialog', { name: 'Importer cette partie ?' });
  assert.match(await confirmation.innerText(), /110 pièces/);
  await confirmation.getByRole('button', { name: 'Remplacer ma partie' }).click();
  await page.waitForFunction(() => document.querySelector('.barre-haut')?.innerText.includes('110'));

  // La partie remplacée est gardée en copie de secours.
  fenetre = await ouvrirFenetreSauvegarde(page);
  await fenetre.getByRole('button', { name: /Copies de secours/ }).click();
  const copies = page.getByRole('dialog', { name: 'Copies de secours' });
  const texteCopies = await copies.innerText();
  assert.match(texteCopies, /Avant un import/);
  assert.match(texteCopies, /Avant une nouvelle partie/);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('un fichier qui n\'est pas une partie est refusé, sans rien changer', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  const [selecteur] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Importer une partie' }).click(),
  ]);
  await selecteur.setFiles({ name: 'courses.json', mimeType: 'application/json', buffer: Buffer.from('{"lait": 2}') });
  const fenetre = page.getByRole('dialog', { name: 'Import impossible' });
  assert.match(await fenetre.innerText(), /ne contient pas une partie de ce jeu/);
  assert.match(await fenetre.innerText(), /Rien n'a été changé/);
  await contexte.close();
});

test('reprendre une copie de secours', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  // Jour 2 : une copie est faite au passage (état du jour 1, 100 pièces).
  await jourSuivant(page);
  await page.waitForFunction(() => document.querySelector('.barre-haut').innerText.includes('Jour 2'));
  await gagnerPieces(page, 10);
  const fenetre = await ouvrirFenetreSauvegarde(page);
  await fenetre.getByRole('button', { name: /Copies de secours/ }).click();
  await page.getByRole('dialog', { name: 'Copies de secours' }).getByRole('button', { name: 'Reprendre cette copie' }).first().click();
  await page.getByRole('dialog', { name: 'Reprendre cette copie ?' }).getByRole('button', { name: 'Reprendre cette copie' }).click();
  await page.waitForFunction(() => document.querySelector('.barre-haut')?.innerText.includes('Jour 1'));
  assert.match(await texteBarre(page), /100 pièces/);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});
