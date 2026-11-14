// Tests navigateur : le jeu marche sans connexion, et aucune donnée ne part
// vers un autre site.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chargerConfig, fichiersDuServiceWorker } from '../aides.mjs';
import { gagnerPieces, nouvellePartie, ouvrirJeu, preparer } from './aides-navigateur.mjs';

const config = chargerConfig();
let outils;
before(async () => { outils = await preparer(); });
after(async () => { await outils.fermer(); });

test('après une première visite, le jeu se lance en mode avion', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  // Le service worker prend la main dès la première visite.
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 30000 });
  const reserve = await page.evaluate(async () => {
    const noms = await caches.keys();
    const reserve = await caches.open(noms.find((nom) => nom.startsWith('atelier-pwa-')));
    return { noms, fichiers: (await reserve.keys()).map((demande) => new URL(demande.url).pathname) };
  });
  assert.deepEqual(reserve.noms, [`atelier-pwa-${config.version}`]);
  assert.equal(reserve.fichiers.length, fichiersDuServiceWorker().length, 'tous les fichiers sont gardés');

  await contexte.setOffline(true);
  await page.reload();
  await page.locator('#chargement').waitFor({ state: 'hidden' });
  await page.getByRole('heading', { level: 1, name: 'Atelier PWA' }).waitFor();
  await nouvellePartie(page);
  await gagnerPieces(page, 10);
  assert.match(await page.locator('.barre-haut').innerText(), /110/);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('aucune demande vers un autre site pendant une partie', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Pause' }).getByRole('button', { name: 'Réglages' }).click();
  await page.getByText('OpenDyslexic', { exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Pause' }).getByRole('button', { name: 'À propos' }).click();
  await page.waitForTimeout(300);
  const ailleurs = page.demandes.filter((url) => !url.startsWith(outils.adresse));
  assert.deepEqual(ailleurs, []);
  await contexte.close();
});
