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

// Nouvelle partie : confirmation éventuelle, choix du personnage, puis jeu.
//   modele : 'perso' (personnage proposé) ou 'ferrus'
//   aide   : aide à la mobilité du personnage ('aucune', 'fauteuil', 'canne')
export async function nouvellePartie(page, { modele = 'perso', aide = null } = {}) {
  await page.getByRole('button', { name: /^Nouvelle partie/ }).click();
  const confirmation = page.getByRole('dialog', { name: /Commencer une nouvelle partie/ });
  const titre = page.getByRole('heading', { name: /Qui veux-tu incarner/ });
  await Promise.race([confirmation.waitFor(), titre.waitFor()]);
  if (await confirmation.isVisible().catch(() => false)) {
    await confirmation.getByRole('button', { name: 'Nouvelle partie' }).click();
  }
  await titre.waitFor();
  if (modele === 'ferrus') await page.getByRole('radio', { name: /Ferrus Dantioch/ }).check();
  if (aide) await page.getByRole('group', { name: 'Aide', exact: true }).getByRole('radio', { name: aide }).check();
  await page.getByRole('button', { name: /C'est parti/ }).click();
  await page.locator('.barre-haut').waitFor();
  await attendreMonde(page);
}

// Attend qu'une condition (fonction exécutée dans la page, qui peut être
// « async » et importer les modules du jeu) devienne vraie.
// (page.waitForFunction n'attend pas les fonctions async : on interroge la
// page nous-mêmes.)
export async function attendre(page, condition, argument, { timeout = 15000 } = {}) {
  const limite = Date.now() + timeout;
  for (;;) {
    if (await page.evaluate(condition, argument)) return;
    if (Date.now() > limite) throw new Error(`condition jamais remplie : ${condition.toString().slice(0, 160)}`);
    await new Promise((resoudre) => { setTimeout(resoudre, 100); });
  }
}

// Attend que la scène 3D soit prête (le monde est créé).
export async function attendreMonde(page) {
  await attendre(page, async () => {
    const ecran = await import('/js/interface/ecran-jeu.js');
    return Boolean(ecran.mondeAffiche());
  });
}

// Ajoute des pièces à la partie en cours, comme le fera le jeu (pour préparer
// un test : il n'y a pas encore de quoi gagner de l'argent au jalon 1).
export async function gagnerPieces(page, nombre) {
  await page.evaluate(async (n) => {
    const etat = await import('/js/noyau/etat.js');
    etat.modifierPartie((partie) => { partie.argent += n; });
  }, nombre);
}

// Passe au jour suivant comme le fera le jeu : copie de secours, puis jour + 1.
export async function jourSuivant(page) {
  await page.evaluate(async () => {
    const etat = await import('/js/noyau/etat.js');
    const sauvegarde = await import('/js/noyau/sauvegarde.js');
    await sauvegarde.creerCopieDeSecours(etat.partieEnCours(), 'nouveau-jour');
    etat.modifierPartie((partie) => { partie.temps.jour += 1; partie.temps.minute = 480; }, { important: true });
  });
}

// Règle l'heure de la partie (minutes depuis minuit). Les personnages
// réagissent à la minute suivante, quand l'horloge avance.
export async function definirHeure(page, minute) {
  await page.evaluate(async (m) => {
    const etat = await import('/js/noyau/etat.js');
    etat.modifierPartie((partie) => { partie.temps.minute = m; });
  }, minute);
}

// Les personnages non joueurs présents dans le lieu ([{ id, case, piece }]).
export async function habitantsPresents(page) {
  return page.evaluate(async () => (await import('/js/interface/ecran-jeu.js')).mondeAffiche().habitantsPresents);
}

// La partie en cours (copie), lue dans le jeu.
export async function lirePartieEnCours(page) {
  return page.evaluate(async () => {
    const etat = await import('/js/noyau/etat.js');
    return JSON.parse(JSON.stringify(etat.partieEnCours()));
  });
}

// Où se trouve, à l'écran, le centre d'une case du lieu (en pixels de page).
export async function positionDeCase(page, x, z) {
  return page.evaluate(async ([cx, cz]) => {
    const ecran = await import('/js/interface/ecran-jeu.js');
    return ecran.mondeAffiche().positionEcranDeCase(cx, cz);
  }, [x, z]);
}

// Attend que le personnage soit arrivé (plus de déplacement en cours).
export async function attendreArrivee(page, { x, z } = {}) {
  await attendre(page, async ([cx, cz]) => {
    const ecran = await import('/js/interface/ecran-jeu.js');
    const monde = ecran.mondeAffiche();
    const etat = await import('/js/noyau/etat.js');
    const position = etat.partieEnCours()?.joueur?.position;
    if (!monde || !position) return false;
    if (cx === undefined) return true;
    return position.x === cx && position.z === cz && monde.case.x === cx && monde.case.z === cz;
  }, [x, z]);
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
