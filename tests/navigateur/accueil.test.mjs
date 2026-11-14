// Tests navigateur : démarrage, bienvenue, accueil, accessibilité de base.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fermerBienvenueSiPresente, nouvellePartie, ouvrirJeu, preparer } from './aides-navigateur.mjs';

let outils;
before(async () => { outils = await preparer(); });
after(async () => { await outils.fermer(); });

// Toutes les commandes visibles font au moins 44 × 44 px.
async function verifierCibles(page, ou) {
  const petites = await page.evaluate(() => {
    const commandes = [...document.querySelectorAll('button, a.bouton, .option-contenu, input[type="range"]')];
    return commandes
      .filter((element) => element.offsetParent !== null || element.closest('dialog[open]'))
      .map((element) => ({ texte: element.textContent.trim() || element.getAttribute('aria-label'), rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && (rect.width < 44 || rect.height < 44))
      .map(({ texte, rect }) => `${texte} (${Math.round(rect.width)}×${Math.round(rect.height)})`);
  });
  assert.deepEqual(petites, [], `cibles trop petites (${ou})`);
}

test('premier lancement : bienvenue, puis accueil, sans erreur', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse, { passerBienvenue: false });
  const bienvenue = page.getByRole('dialog', { name: 'Bienvenue !'.replace(' ', ' ') });
  await bienvenue.waitFor();
  await verifierCibles(page, 'bienvenue');
  await fermerBienvenueSiPresente(page);
  await assert.doesNotReject(page.getByRole('heading', { level: 1, name: 'Atelier PWA' }).waitFor());
  // La bienvenue ne revient pas au lancement suivant.
  await page.reload();
  await page.locator('#chargement').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('un seul titre principal visible, des boutons nommés et assez grands', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  assert.equal(await page.locator('h1:visible').count(), 1);
  await verifierCibles(page, 'accueil');
  const sansNom = await page.evaluate(() => [...document.querySelectorAll('button')]
    .filter((b) => !(b.textContent.trim() || b.getAttribute('aria-label'))).length);
  assert.equal(sansNom, 0, 'bouton sans nom accessible');

  await nouvellePartie(page);
  // Le titre de l'écran de jeu est invisible à l'œil mais lu par les lecteurs
  // d'écran ; celui de l'écran de secours, caché, ne compte pas.
  assert.equal(await page.locator('h1:visible').count(), 1);
  await verifierCibles(page, 'écran de jeu');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Pause' }).waitFor();
  await verifierCibles(page, 'pause');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('au clavier : le focus est bien visible', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await page.keyboard.press('Tab');
  const contour = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement);
    return { balise: document.activeElement.tagName, style: style.outlineStyle, largeur: parseFloat(style.outlineWidth) };
  });
  assert.equal(contour.balise, 'BUTTON');
  assert.notEqual(contour.style, 'none');
  assert.ok(contour.largeur >= 2, 'contour de focus d\'au moins 2 px');
  await contexte.close();
});

test('« À propos » : auteur, licence, confidentialité, contact', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await page.getByRole('button', { name: 'À propos' }).click();
  const fenetre = page.getByRole('dialog', { name: 'À propos' });
  const texte = await fenetre.innerText();
  assert.match(texte, /Jeu réalisé par Ferrus Dantioch, avec l'aide de l'intelligence artificielle\./);
  assert.match(texte, /© 2026 Ferrus Dantioch/);
  assert.match(texte, /Creative Commons BY-NC-ND 4\.0/);
  assert.match(texte, /aucune donnée envoyée/);
  assert.match(texte, /Découvrir l'Omni-système/);
  // Les liens vers d'autres sites s'ouvrent dans un nouvel onglet, protégés.
  for (const lien of await fenetre.locator('a[href^="http"]').all()) {
    assert.equal(await lien.getAttribute('target'), '_blank');
    assert.match(await lien.getAttribute('rel'), /noopener/);
  }
  await contexte.close();
});
