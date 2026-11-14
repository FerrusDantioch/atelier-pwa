// Tests navigateur : la fenêtre Réglages et l'application des réglages.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ouvrirJeu, preparer } from './aides-navigateur.mjs';

let outils;
before(async () => { outils = await preparer(); });
after(async () => { await outils.fermer(); });

const tailleRacine = (page) => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));

test('la taille du texte change tout de suite et reste après rechargement', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  const avant = await tailleRacine(page);
  await page.getByRole('button', { name: 'Réglages' }).click();
  await page.getByText('Énorme', { exact: true }).click();
  assert.equal(await page.getAttribute('html', 'data-texte'), '4');
  assert.ok(await tailleRacine(page) > avant * 1.5);
  // Après rechargement, le réglage est posé AVANT que le jeu démarre.
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  assert.equal(await page.getAttribute('html', 'data-texte'), '4');
  await contexte.close();
});

test('contraste élevé, thème clair, police, espacement, daltonisme, animations', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await page.getByRole('button', { name: 'Réglages' }).click();
  const fenetre = page.getByRole('dialog', { name: 'Réglages' });
  await fenetre.getByRole('group', { name: 'Contraste élevé' }).getByText('Oui').click();
  assert.equal(await page.getAttribute('html', 'data-contraste'), 'eleve');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(0, 0, 0)');
  await fenetre.getByText('Clair', { exact: true }).click();
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(255, 255, 255)');
  await fenetre.getByText('OpenDyslexic', { exact: true }).click();
  assert.match(await page.evaluate(() => getComputedStyle(document.body).fontFamily), /^"?OpenDyslexic/);
  await fenetre.getByText('Aéré', { exact: true }).click();
  assert.equal(await page.getAttribute('html', 'data-espacement'), 'aere');
  await fenetre.getByText('Rouge-vert', { exact: true }).click();
  assert.equal(await page.getAttribute('html', 'data-daltonisme'), 'rouge-vert');
  await fenetre.getByRole('group', { name: 'Réduire les animations' }).getByText('Oui').click();
  assert.equal(await page.getAttribute('html', 'data-animations'), 'reduites');
  // Tout est enregistré sur l'appareil.
  const enregistres = await page.evaluate(() => JSON.parse(localStorage.getItem('atelier-pwa.reglages')));
  assert.equal(enregistres.contraste, 'eleve');
  assert.equal(enregistres.theme, 'clair');
  await contexte.close();
});

test('« Auto » suit le mode sombre ou clair de l\'appareil', async () => {
  const contexte = await outils.contexte({ colorScheme: 'light' });
  const page = await ouvrirJeu(contexte, outils.adresse);
  await page.getByRole('button', { name: 'Réglages' }).click();
  await page.getByText('Auto', { exact: true }).first().click();
  assert.equal(await page.getAttribute('html', 'data-theme'), 'clair');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'sombre');
  await contexte.close();
});

test('l\'appareil qui demande moins d\'animations est respecté par défaut', async () => {
  const contexte = await outils.contexte({ reducedMotion: 'reduce' });
  const page = await ouvrirJeu(contexte, outils.adresse);
  assert.equal(await page.getAttribute('html', 'data-animations'), 'reduites');
  await contexte.close();
});

test('Échap ferme la fenêtre, le clavier reste dedans, le focus revient au bouton', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await page.getByRole('button', { name: 'Réglages' }).focus();
  await page.keyboard.press('Enter');
  const fenetre = page.getByRole('dialog', { name: 'Réglages' });
  await fenetre.waitFor();
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => Boolean(document.activeElement.closest('dialog[open]'))), 'le focus est sorti de la fenêtre');
  }
  await page.keyboard.press('Escape');
  await fenetre.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Réglages');
  await contexte.close();
});

test('volumes séparés, son coupé, et « Rétablir les réglages par défaut »', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await page.getByRole('button', { name: 'Réglages' }).click();
  const fenetre = page.getByRole('dialog', { name: 'Réglages' });
  const musique = fenetre.getByRole('slider', { name: 'Musique' });
  await musique.focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await musique.getAttribute('aria-valuetext'), '50 %');
  await fenetre.getByText('Son coupé', { exact: true }).click();
  await fenetre.getByRole('button', { name: /Écouter un exemple\s*:\s*Effets/ }).click();
  await fenetre.getByText(/Le son est coupé\. Réactive-le/).first().waitFor();
  let enregistres = await page.evaluate(() => JSON.parse(localStorage.getItem('atelier-pwa.reglages')));
  assert.equal(enregistres.volumes.musique, 50);
  assert.equal(enregistres.sonCoupe, true);

  await fenetre.getByRole('button', { name: 'Rétablir les réglages par défaut' }).click();
  await page.getByRole('dialog', { name: /Rétablir les réglages/ }).getByRole('button', { name: 'Rétablir' }).click();
  enregistres = await page.evaluate(() => JSON.parse(localStorage.getItem('atelier-pwa.reglages')));
  assert.equal(enregistres.volumes.musique, 40);
  assert.equal(enregistres.sonCoupe, false);
  assert.equal(enregistres.premierLancementFait, true, 'la bienvenue ne doit pas revenir');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});
