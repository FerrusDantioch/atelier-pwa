// =============================================================================
// aides-navigateur.mjs — outils communs aux tests dans un vrai navigateur
// -----------------------------------------------------------------------------
// Ces tests ouvrent le jeu dans Chromium, piloté par Playwright, avec un
// écran de tablette (1180 × 820, tactile).
//
// Installation (une seule fois) :
//   cd tests/navigateur && npm install && npx playwright install chromium
// Lancement (depuis la racine du dépôt) :
//   node --test "tests/navigateur/*.test.mjs"
// =============================================================================

import { createRequire } from 'node:module';
import { demarrerServeur } from '../../outils/serveur.mjs';

// Playwright installé dans tests/navigateur, ou globalement.
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

export const TABLETTE = { viewport: { width: 1180, height: 820 }, hasTouch: true, locale: 'fr-FR' };

// Lance un serveur et un navigateur. Renvoie de quoi ouvrir des pages.
export async function preparer({ remplacer } = {}) {
  const serveur = await demarrerServeur(0, { remplacer });
  const adresse = `http://localhost:${serveur.address().port}/`;
  const navigateur = await chromium.launch();
  return {
    adresse,
    navigateur,
    async contexte(options = {}) {
      return navigateur.newContext({ ...TABLETTE, ...options });
    },
    async fermer() {
      await navigateur.close();
      await new Promise((resoudre) => serveur.close(resoudre));
    },
  };
}

// Ouvre le jeu et garde la trace des erreurs (console, code) et des demandes
// réseau, pour pouvoir vérifier qu'il n'y en a pas.
export async function ouvrirJeu(contexte, adresse, { passerBienvenue = true } = {}) {
  const page = await contexte.newPage();
  page.erreurs = [];
  page.demandes = [];
  page.on('console', (message) => {
    if (message.type() === 'error') page.erreurs.push(message.text());
  });
  page.on('pageerror', (erreur) => page.erreurs.push(erreur.message));
  page.on('request', (demande) => page.demandes.push(demande.url()));
  await page.goto(adresse);
  await page.locator('#chargement').waitFor({ state: 'hidden' });
  if (passerBienvenue) await fermerBienvenueSiPresente(page);
  return page;
}

export async function fermerBienvenueSiPresente(page) {
  const bouton = page.getByRole('button', { name: 'Garder les réglages par défaut' });
  if (await bouton.isVisible().catch(() => false)) await bouton.click();
}

export async function nouvellePartie(page) {
  await page.getByRole('button', { name: /^Nouvelle partie/ }).click();
  const confirmation = page.getByRole('dialog', { name: 'Commencer une nouvelle partie ?' });
  if (await confirmation.isVisible().catch(() => false)) {
    await confirmation.getByRole('button', { name: 'Nouvelle partie' }).click();
  }
  await page.locator('.barre-haut').waitFor();
}

// Le texte de la barre fixe, sur une seule ligne.
export async function texteBarre(page) {
  return (await page.locator('.barre-haut').innerText()).replace(/\s+/g, ' ');
}

// Rapport de contraste entre deux couleurs (règle WCAG).
export function contraste(couleurA, couleurB) {
  const luminance = (couleur) => {
    const [r, g, b] = couleur.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [claire, sombre] = [luminance(couleurA), luminance(couleurB)].sort((a, b) => b - a);
  return (claire + 0.05) / (sombre + 0.05);
}
