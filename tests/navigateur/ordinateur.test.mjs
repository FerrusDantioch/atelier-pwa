// Tests navigateur (jalon 3) : l'ordinateur du bureau, la visio avec le
// mentor, le mini-jeu de création, l'argent et la réputation.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { attendre, lirePartieEnCours, nouvellePartie, ouvrirJeu, preparer, texteBarre } from './aides-navigateur.mjs';

let outils;
before(async () => { outils = await preparer(); });
after(async () => { await outils.fermer(); });

// Toucher l'objectif mène au bureau ; on y allume l'ordinateur.
async function allumerOrdinateur(page) {
  await page.locator('.objectif').click();
  const bouton = page.getByRole('button', { name: "Utiliser l'ordinateur" });
  await bouton.waitFor({ timeout: 20000 });
  await bouton.click();
  const fenetre = page.getByRole('dialog', { name: 'Ton ordinateur' });
  await fenetre.waitFor();
  return fenetre;
}

// L'appel de bienvenue a déjà eu lieu (et, si demandé, des commandes sont livrées).
async function apresLaVisio(page, { livrees = [], reputation = 0 } = {}) {
  await page.evaluate(async ({ livrees, reputation }) => {
    const { modifierPartie } = await import('/js/noyau/etat.js');
    modifierPartie((partie) => {
      partie.drapeaux['visio-accueil'] = true;
      for (const id of livrees) partie.commandes.livrees.push({ id, note: 'parfait', jour: 1, argent: 10, reputation: 1 });
      partie.reputation = reputation;
    });
  }, { livrees, reputation });
}

const choisir = (fenetre, texte) => fenetre.getByText(texte, { exact: true }).click();

// Le texte affiché, avec des espaces ordinaires (la typographie française
// met des espaces fines insécables avant « : ! ? »).
const lireTexte = async (localisateur) => (await localisateur.innerText()).replace(/\s+/g, ' ');
const texteActif = (page) => page.evaluate(() => document.activeElement.textContent.replace(/\s+/g, ' '));

test('premier allumage : Ferrus appelle en visio (le temps s\'arrête), puis la commande d\'essai arrive', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  assert.match(await texteBarre(page), /Objectif : allume ton ordinateur, au bureau/);

  const fenetre = await allumerOrdinateur(page);
  await fenetre.getByRole('heading', { name: 'Ferrus t\'appelle en visio.' }).waitFor();
  const minute = (await lirePartieEnCours(page)).temps.minute;
  await page.waitForTimeout(1500);
  assert.equal((await lirePartieEnCours(page)).temps.minute, minute, 'le temps est arrêté pendant l\'appel');

  await fenetre.getByRole('button', { name: 'Décrocher' }).click();
  await fenetre.getByRole('heading', { name: 'Visio avec Ferrus' }).waitFor();
  // Le portrait 3D : une vraie image (beaucoup de couleurs différentes), décrite.
  const portrait = fenetre.getByRole('img', { name: 'Portrait de Ferrus' });
  await portrait.waitFor();
  const couleurs = await portrait.evaluate((toile) => {
    const { data } = toile.getContext('2d').getImageData(0, 0, toile.width, toile.height);
    const vues = new Set();
    for (let i = 0; i < data.length; i += 4 * 37) vues.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    return vues.size;
  });
  assert.ok(couleurs > 30, `portrait trop uniforme (${couleurs} couleurs)`);
  assert.match(await lireTexte(fenetre.locator('figcaption')), /Ferrus, en visio/);
  assert.match(await lireTexte(fenetre.locator('.dialogue-fil')), /Bonjour [^!]+ ! Ici Ferrus/);

  // Le tutoriel, réplique après réplique, à son rythme.
  for (let i = 0; i < 5; i += 1) await fenetre.getByRole('button', { name: 'Suivant' }).click();
  assert.equal(await fenetre.locator('.dialogue-fil .replique').count(), 6);
  await fenetre.getByRole('button', { name: 'Raccrocher' }).click();
  await fenetre.getByRole('heading', { name: /Que veux-tu faire/ }).waitFor();
  await fenetre.locator('.notification-texte', { hasText: /Nouvelle commande\s:\sFerrus, «\sMa liste de courses\s»/ }).waitFor();
  assert.match(await lireTexte(fenetre.getByRole('button', { name: /^Commandes/ })), /1 nouvelle commande/);
  assert.equal((await lirePartieEnCours(page)).drapeaux['visio-accueil'], true);

  await page.keyboard.press('Escape');
  await fenetre.waitFor({ state: 'detached' });
  assert.match(await texteBarre(page), /Objectif : choisis une commande, au bureau/);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('accepter, tester, livrer : « Parfait », l\'argent et la réputation montent, d\'autres commandes arrivent', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await apresLaVisio(page);
  const fenetre = await allumerOrdinateur(page);
  await fenetre.getByRole('button', { name: /^Commandes/ }).click();
  await fenetre.getByRole('button', { name: 'Lire la commande : Ma liste de courses' }).click();
  await fenetre.getByText('Cocher ce que j\'ai déjà pris').waitFor();
  await fenetre.getByRole('button', { name: 'Accepter la commande' }).click();
  await fenetre.getByRole('heading', { name: 'Atelier : Ma liste de courses' }).waitFor();
  assert.match(await lireTexte(fenetre.locator('.atelier-apercu .jauge-texte')), /choisis un modèle/);

  await choisir(fenetre, 'Liste à cocher');
  await choisir(fenetre, 'Partage');
  assert.match(await lireTexte(fenetre.locator('.atelier-apercu .jauge-texte')), /2 sur 5 \(légère\)/);
  assert.match(await lireTexte(fenetre.locator('.apercu-ecran')), /Ma liste de courses[\s\S]*Pain[\s\S]*Partager/);

  // Le projet est rangé dans la partie à chaque choix.
  const projet = (await lirePartieEnCours(page)).commandes.enCours['essai-courses'];
  assert.equal(projet.modele, 'liste');
  assert.deepEqual(projet.fonctions, ['partage']);

  await fenetre.getByRole('button', { name: 'Tester comme Ferrus' }).click();
  const test = page.getByRole('dialog', { name: 'Ce qu\'en pense Ferrus' });
  assert.match(await lireTexte(test), /Si tu livres maintenant : Parfait/);
  await test.getByRole('button', { name: 'Retour à l\'atelier' }).click();

  await fenetre.getByRole('button', { name: 'Livrer' }).click();
  const livraison = page.getByRole('dialog', { name: 'Livraison : parfait !' });
  await livraison.waitFor();
  const texte = await lireTexte(livraison);
  assert.match(texte, /Tu gagnes 25 pièces et 5 points de réputation/);
  // La première vraie cliente, Halaé, présente sa commande de vive voix.
  assert.match(texte, /Halaé a une demande pour toi : va lui parler/);
  await livraison.getByRole('button', { name: 'Continuer' }).click();
  await fenetre.getByRole('heading', { name: 'Commandes', exact: true }).waitFor();

  const partie = await lirePartieEnCours(page);
  assert.equal(partie.argent, 125);
  assert.equal(partie.reputation, 5);
  assert.deepEqual(partie.commandes.enCours, {});
  assert.deepEqual(partie.commandes.livrees.map((l) => [l.id, l.note]), [['essai-courses', 'parfait']]);
  assert.equal(await fenetre.getByRole('button', { name: /^Lire la commande/ }).count(), 0);
  assert.match(await lireTexte(fenetre), /Halaé a une demande pour toi/);
  await fenetre.locator('.fenetre-pied').getByRole('button', { name: 'Fermer', exact: true }).click();
  assert.match(await texteBarre(page), /125 pièces/);
  assert.match(await texteBarre(page), /Objectif : parle à Halaé/);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('« À retravailler » : rien n\'est perdu, le projet reste tel quel (même après rechargement)', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await apresLaVisio(page, { livrees: ['essai-courses', 'halae-planning'], reputation: 15 });
  let fenetre = await allumerOrdinateur(page);
  await fenetre.getByRole('button', { name: /^Commandes/ }).click();
  await fenetre.getByRole('button', { name: 'Lire la commande : Mes médicaments' }).click();
  await fenetre.getByRole('button', { name: 'Accepter la commande' }).click();
  await choisir(fenetre, 'Liste à cocher');
  await choisir(fenetre, 'Rappels à l\'écran');
  await choisir(fenetre, 'Statistiques détaillées');
  await fenetre.getByRole('button', { name: 'Livrer' }).click();
  const resultat = page.getByRole('dialog', { name: 'À retravailler' });
  await resultat.waitFor();
  const texte = await lireTexte(resultat);
  assert.match(texte, /Gênant/);
  assert.match(texte, /Pas de graphiques/);
  assert.match(texte, /Statistiques détaillées/);
  assert.match(texte, /Ton projet est gardé tel quel/);
  await resultat.getByRole('button', { name: 'Retour à l\'atelier' }).click();
  assert.equal((await lirePartieEnCours(page)).argent, 100, 'rien n\'est gagné');
  assert.match(await texteBarre(page), /reprends l'appli de Madeleine/);

  // On recharge la page : le projet est toujours là.
  await page.evaluate(async () => (await import('/js/noyau/etat.js')).sauvegarderMaintenant());
  await page.reload();
  await page.locator('#chargement').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: /^Continuer/ }).click();
  await page.locator('.barre-haut').waitFor();
  fenetre = await allumerOrdinateur(page);
  await fenetre.getByRole('button', { name: /^Commandes/ }).click();
  assert.match(await lireTexte(fenetre), /à retravailler/);
  await fenetre.getByRole('button', { name: 'Reprendre le projet : Mes médicaments' }).click();
  assert.equal(await fenetre.getByRole('checkbox', { name: /Statistiques détaillées/ }).isChecked(), true);

  // On corrige : sans les graphiques, avec un texte grand et contrasté.
  await choisir(fenetre, 'Statistiques détaillées');
  for (const [groupe, valeur] of [['Taille du texte', 'Grande'], ['Contraste', 'Élevé'], ['Police', 'Très lisible']]) {
    await fenetre.getByRole('group', { name: groupe }).getByText(valeur, { exact: true }).click();
  }
  assert.match(await fenetre.locator('.apercu-ecran').getAttribute('class'), /apercu-contraste-eleve/);
  await fenetre.getByRole('button', { name: 'Livrer' }).click();
  await page.getByRole('dialog', { name: 'Livraison : parfait !' }).getByRole('button', { name: 'Continuer' }).click();
  const partie = await lirePartieEnCours(page);
  assert.equal(partie.argent, 170);
  assert.deepEqual(partie.commandes.livrees.map((l) => l.id), ['essai-courses', 'halae-planning', 'madeleine-medicaments']);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('Halaé, la première cliente, présente sa commande de vive voix ; elle arrive ensuite sur l\'ordinateur', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await apresLaVisio(page, { livrees: ['essai-courses'], reputation: 5 });
  assert.match(await texteBarre(page), /Objectif : parle à Halaé/);
  // Toucher l'objectif mène à Halaé.
  await page.locator('.objectif').click();
  const parler = page.getByRole('button', { name: /Parler à Halaé/ });
  await parler.waitFor({ timeout: 20000 });
  await parler.click();
  const dialogue = page.getByRole('dialog', { name: 'Halaé' });
  await dialogue.getByRole('button', { name: /Tu as besoin d'une application/ }).click();
  const texte = await lireTexte(dialogue);
  assert.match(texte, /Halaé : « Je publie une vidéo par semaine/);
  assert.match(texte, /Sa commande t'attend sur ton ordinateur/);
  await dialogue.locator('.notification-texte', { hasText: /Nouvelle commande\s:\sHalaé, «\sMon planning de vidéos\s»/ }).waitFor();
  assert.equal(await dialogue.getByRole('button', { name: /Tu as besoin d'une application/ }).count(), 0, 'la question est posée une seule fois');
  assert.equal((await lirePartieEnCours(page)).drapeaux['proposee-halae-planning'], true);
  await dialogue.getByRole('button', { name: /À plus tard/ }).click();
  assert.match(await texteBarre(page), /Objectif : choisis une commande, au bureau/);

  const fenetre = await allumerOrdinateur(page);
  await fenetre.getByRole('button', { name: /^Commandes/ }).click();
  await fenetre.getByRole('button', { name: 'Lire la commande : Mon planning de vidéos' }).click();
  assert.match(await lireTexte(fenetre), /Commande de Halaé/);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('jouer Ferrus : le mentor en visio est « le vrai Ferrus, depuis le monde réel »', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page, { modele: 'ferrus' });
  const fenetre = await allumerOrdinateur(page);
  await fenetre.getByRole('button', { name: 'Décrocher' }).click();
  assert.match(await lireTexte(fenetre.locator('figcaption')), /Ferrus, en direct depuis le monde réel/);
  assert.match(await lireTexte(fenetre.locator('.dialogue-fil')), /Ici Ferrus, le vrai, depuis le monde réel/);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('au clavier : on navigue, on rappelle le mentor pour un conseil, Échap ferme et rend le focus', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await apresLaVisio(page);
  const fenetre = await allumerOrdinateur(page);
  // À l'arrivée sur un écran, le focus est sur son titre.
  assert.equal(await texteActif(page), 'Que veux-tu faire ?');
  await fenetre.getByRole('button', { name: /Appeler Ferrus en visio/ }).focus();
  await page.keyboard.press('Enter');
  await fenetre.getByRole('heading', { name: 'Visio avec Ferrus' }).waitFor();
  assert.equal(await texteActif(page), 'Un conseil ?');
  await page.keyboard.press('Enter');
  assert.match(await lireTexte(fenetre.locator('.dialogue-fil')), /Toi : « Un conseil \? »/);
  await page.keyboard.press('Escape');
  await fenetre.waitFor({ state: 'detached' });
  assert.equal(await texteActif(page), "Utiliser l'ordinateur");
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('sur téléphone : l\'atelier tient dans l\'écran, sans défilement de côté', async () => {
  const contexte = await outils.contexte({ viewport: { width: 390, height: 844 } });
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await apresLaVisio(page, { livrees: ['essai-courses', 'halae-planning'], reputation: 15 });
  const fenetre = await allumerOrdinateur(page);
  await fenetre.getByRole('button', { name: /^Commandes/ }).click();
  await fenetre.getByRole('button', { name: 'Lire la commande : Les fournées' }).click();
  await fenetre.getByRole('button', { name: 'Accepter la commande' }).click();
  await choisir(fenetre, 'Minuteur');
  const mesures = await page.evaluate(() => {
    const corps = document.querySelector('.fenetre-ordinateur .fenetre-corps');
    const pied = document.querySelector('.fenetre-ordinateur .fenetre-pied');
    const lignes = new Set([...pied.querySelectorAll('.bouton')].map((bouton) => bouton.offsetTop));
    return {
      debordement: corps.scrollWidth - corps.clientWidth,
      lignesDuPied: lignes.size,
      bandeau: getComputedStyle(document.querySelector('.atelier-bandeau')).display,
    };
  });
  assert.ok(mesures.debordement <= 1, `défilement de côté : ${mesures.debordement} px`);
  assert.ok(mesures.lignesDuPied <= 2, `les boutons du bas prennent ${mesures.lignesDuPied} lignes`);
  assert.notEqual(mesures.bandeau, 'none', 'la jauge reste visible en haut');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});
