// Test navigateur : une nouvelle version est proposée, jamais imposée.
// On simule la publication d'une nouvelle version en servant un config.js
// dont le numéro de version a changé.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chargerConfig } from '../aides.mjs';
import { nouvellePartie, ouvrirJeu, preparer } from './aides-navigateur.mjs';

const config = chargerConfig();
const NOUVELLE = '9.9.9';
let versionServie = config.version;
let outils;

before(async () => {
  outils = await preparer({
    remplacer: (chemin, lireTexte) => (chemin === '/js/config.js'
      ? lireTexte().replace(`version: '${config.version}'`, `version: '${versionServie}'`)
      : undefined),
  });
});
after(async () => { await outils.fermer(); });

test('mise à jour : proposée avec sa version, partie sauvegardée, puis rechargement', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 30000 });
  await nouvellePartie(page);
  await page.getByRole('button', { name: /Gagner 10 pièces/ }).click();

  // « Publication » d'une nouvelle version, puis retour sur le jeu.
  versionServie = NOUVELLE;
  await page.reload();
  const message = page.locator('.notification-texte', { hasText: `La version ${NOUVELLE} du jeu est prête.` });
  await message.waitFor({ timeout: 30000 });
  // Le message est aussi annoncé aux lecteurs d'écran.
  await page.waitForFunction((v) => document.getElementById('annonces').textContent.includes(v), NOUVELLE);
  // Rien n'a changé tout seul : on est toujours sur l'ancienne version.
  assert.match(await page.locator('.version').innerText(), new RegExp(config.version.replace(/\./g, '\\.')));

  await page.getByRole('button', { name: 'Mettre à jour' }).click();
  await page.waitForFunction((v) => document.querySelector('.version')?.textContent.includes(v), NOUVELLE, { timeout: 30000 });
  // La partie est intacte.
  await page.getByRole('button', { name: /Continuer/ }).click();
  assert.match(await page.locator('.barre-haut').innerText(), /110/);
  const noms = await page.evaluate(() => caches.keys());
  assert.deepEqual(noms, [`atelier-pwa-${NOUVELLE}`], 'l\'ancienne réserve est effacée');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});
