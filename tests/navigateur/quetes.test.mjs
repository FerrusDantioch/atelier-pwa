// Tests navigateur (jalon 4) : le journal des quêtes, l'objectif de la quête
// suivie, les étapes faites en parlant ou en s'approchant d'un endroit, et
// les commandes du jour.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  attendre, definirHeure, habitantsPresents, jourSuivant, lirePartieEnCours, nouvellePartie, ouvrirJeu, preparer, texteBarre,
} from './aides-navigateur.mjs';

let outils;
before(async () => { outils = await preparer(); });
after(async () => { await outils.fermer(); });

// Le texte affiché, avec des espaces ordinaires (la typographie française
// met des espaces fines insécables avant « : ! ? »).
const lireTexte = async (localisateur) => (await localisateur.innerText()).replace(/\s+/g, ' ');
const texteActif = (page) => page.evaluate(() => document.activeElement.textContent.replace(/\s+/g, ' ').trim());

// Prépare la partie : appel du mentor fait, commandes livrées, réputation.
async function preparerPartie(page, { livrees = [], proposees = [], reputation = 0 } = {}) {
  await page.evaluate(async ({ livrees, proposees, reputation }) => {
    const { modifierPartie } = await import('/js/noyau/etat.js');
    modifierPartie((partie) => {
      partie.drapeaux['visio-accueil'] = true;
      for (const id of proposees) partie.drapeaux[`proposee-${id}`] = true;
      for (const id of livrees) partie.commandes.livrees.push({ id, note: 'parfait', jour: 1, argent: 10, reputation: 1 });
      partie.reputation = reputation;
    });
  }, { livrees, proposees, reputation });
  // Les quêtes avancent un instant plus tard.
  await attendre(page, async (n) => {
    const { partieEnCours } = await import('/js/noyau/etat.js');
    return partieEnCours().quetes.finies.length >= n;
  }, livrees.includes('halae-planning') ? 2 : 0);
}

test('le journal : bouton, touche J, Pause ; la quête de bienvenue et ses étapes', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  // Un seul message : la partie commence, et la première quête avec elle.
  await page.locator('.notification-texte', {
    hasText: /Nouvelle partie commencée\.\sBienvenue\s!\sNouvelle quête\s:\s«\sBienvenue à l'atelier\s»/,
  }).waitFor();
  const partie = await lirePartieEnCours(page);
  assert.deepEqual(Object.keys(partie.quetes.actives), ['bienvenue']);
  assert.equal(partie.quetes.suivie, 'bienvenue');

  // Touche J.
  await page.keyboard.press('j');
  const journal = page.getByRole('dialog', { name: 'Journal' });
  await journal.waitFor();
  const texte = await lireTexte(journal);
  assert.match(texte, /En cours/);
  assert.match(texte, /Bienvenue à l'atelier suivie/);
  assert.match(texte, /De la part de Ferrus/);
  assert.match(texte, /Principe : Lisibilité\./);
  assert.match(texte, /Maintenant Allume ton ordinateur, au bureau/);
  assert.match(texte, /Facultative Dans l'atelier, essaie un texte plus grand/);
  assert.match(texte, /Ensuite Livre la liste de courses de Ferrus/);
  assert.match(texte, /Récompense : 20 pièces et 5 points de réputation/);
  assert.match(texte, /Quête suivie : son étape s'affiche en haut de l'écran/);
  await page.keyboard.press('Escape');
  await journal.waitFor({ state: 'detached' });

  // Le bouton de la barre du bas, et Pause › Journal des quêtes.
  const bouton = page.locator('.barre-bas').getByRole('button', { name: /^Journal/ });
  assert.equal(await bouton.getAttribute('aria-keyshortcuts'), 'J');
  await bouton.click();
  await journal.waitFor();
  // « Y aller » : on part vers le bureau, le journal se ferme.
  await journal.getByRole('button', { name: /Y aller : Allume ton ordinateur/ }).click();
  await journal.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: "Utiliser l'ordinateur" }).waitFor({ timeout: 20000 });
  await page.keyboard.press('Escape');
  const pause = page.getByRole('dialog', { name: 'Pause' });
  await pause.getByRole('button', { name: 'Journal des quêtes' }).click();
  await journal.waitFor();
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('Théo, à 16 h : il présente sa commande, puis donne des nouvelles de son application', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await preparerPartie(page, { livrees: ['essai-courses', 'halae-planning'], proposees: ['halae-planning'], reputation: 15 });
  assert.match(await texteBarre(page), /Objectif : parle à Théo, vers 16 h/);

  // À 8 h, Théo n'est pas là : on dit quand il revient.
  await page.locator('.objectif').click();
  await page.locator('.notification-texte', { hasText: /Théo n'est pas là pour l'instant\s:\sretour prévu à 16 h/ }).waitFor();

  // À 16 h, il arrive ; toucher l'objectif mène jusqu'à lui.
  await definirHeure(page, 16 * 60);
  await attendre(page, async () => {
    const ecran = await import('/js/interface/ecran-jeu.js');
    return ecran.mondeAffiche().habitantsPresents.some((h) => h.id === 'theo');
  }, null, { timeout: 20000 });
  assert.ok((await habitantsPresents(page)).some((h) => h.id === 'theo'));
  await page.locator('.objectif').click();
  const parler = page.getByRole('button', { name: /Parler à Théo/ });
  await parler.waitFor({ timeout: 25000 });
  await parler.click();
  let dialogue = page.getByRole('dialog', { name: 'Théo' });
  await dialogue.getByRole('button', { name: /Tu as besoin d'une application/ }).click();
  assert.match(await lireTexte(dialogue), /Théo : « Mes cours changent parfois d'horaire ou de salle/);
  await dialogue.locator('.notification-texte', { hasText: /Nouvelle commande\s:\sThéo, «\sPrévenu à l'avance\s»/ }).waitFor();
  await dialogue.getByRole('button', { name: /À plus tard/ }).click();
  assert.match(await texteBarre(page), /Objectif : lis la commande de Théo, au bureau/);

  // Sa commande livrée : on peut lui demander des nouvelles.
  await page.evaluate(async () => {
    const { modifierPartie } = await import('/js/noyau/etat.js');
    modifierPartie((partie) => { partie.commandes.livrees.push({ id: 'theo-changements', note: 'parfait', jour: 1, argent: 60, reputation: 12 }); });
  });
  await attendre(page, async () => {
    const { partieEnCours } = await import('/js/noyau/etat.js');
    return Boolean(partieEnCours().drapeaux['etape-matin-sans-surprise-livraison']);
  });
  assert.match(await texteBarre(page), /Objectif : demande à Théo si l'appli l'aide/);
  await parler.click();
  dialogue = page.getByRole('dialog', { name: 'Théo' });
  const argent = (await lirePartieEnCours(page)).argent;
  await dialogue.getByRole('button', { name: /Alors, cette application/ }).click();
  assert.match(await lireTexte(dialogue), /Théo : « Je l'ai installée tout de suite/);
  await dialogue.locator('.notification-texte', {
    hasText: /Quête terminée\s:\s«\sUn matin sans surprise\s»\s!\sTu gagnes 20 pièces/,
  }).waitFor();
  assert.match(await lireTexte(dialogue.locator('.notification-texte').last()), /Nouvelle quête : « Réviser sans se noyer »/);
  assert.equal(await dialogue.getByRole('button', { name: /Alors, cette application/ }).count(), 0, 'la question n\'est posée qu\'une fois');
  const partie = await lirePartieEnCours(page);
  assert.equal(partie.argent, argent + 20);
  assert.ok(partie.quetes.finies.includes('matin-sans-surprise'));
  assert.ok(partie.quetes.actives['reviser-sans-se-noyer']);
  // Sa seconde commande : il la présente dans la même conversation, s'il veut.
  assert.equal(await dialogue.getByRole('button', { name: /Tu as besoin d'une application/ }).count(), 1);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('suivre une autre quête ; « Y aller » vers la télévision fait l\'étape facultative', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await preparerPartie(page, {
    livrees: ['essai-courses', 'halae-planning', 'karim-atelier'], proposees: ['halae-planning'], reputation: 30,
  });
  await page.keyboard.press('j');
  const journal = page.getByRole('dialog', { name: 'Journal' });
  await journal.waitFor();
  const carte = journal.getByRole('article', { name: 'Des sous-titres pour tout le monde' });
  assert.match(await lireTexte(carte), /De la part d'Halaé/);
  await carte.getByRole('button', { name: 'Suivre cette quête' }).click();
  await journal.locator('.notification-texte', { hasText: /Tu suis maintenant\s«\sDes sous-titres pour tout le monde\s»/ }).waitFor();
  // Le focus reste sur la quête choisie, désormais en tête et « suivie ».
  assert.equal(await texteActif(page), 'Des sous-titres pour tout le monde');
  assert.match(await lireTexte(journal.getByRole('article').first()), /Des sous-titres pour tout le monde suivie/);
  await page.keyboard.press('Escape');
  assert.match(await texteBarre(page), /Objectif : parle à Halaé/);

  // Sa commande livrée, la quête se termine ; la télévision reste possible.
  await page.evaluate(async () => {
    const { modifierPartie } = await import('/js/noyau/etat.js');
    modifierPartie((partie) => {
      partie.drapeaux['proposee-halae-sous-titres'] = true;
      partie.commandes.livrees.push({ id: 'halae-sous-titres', note: 'parfait', jour: 1, argent: 60, reputation: 12 });
    });
  });
  await attendre(page, async () => {
    const { partieEnCours } = await import('/js/noyau/etat.js');
    return partieEnCours().quetes.finies.includes('sous-titres');
  });
  await page.keyboard.press('j');
  await journal.waitFor();
  const terminee = journal.getByRole('article', { name: 'Des sous-titres pour tout le monde' });
  assert.match(await lireTexte(terminee), /terminée/);
  assert.match(await lireTexte(terminee), /Encore possible/);
  await terminee.getByRole('button', { name: /Y aller : Regarde sa nouvelle vidéo, à la télévision/ }).click();
  await page.locator('.notification-texte', {
    hasText: /La nouvelle vidéo d'Halaé défile, avec des sous-titres bien lisibles\.\sÉtape facultative terminée/,
  }).waitFor({ timeout: 25000 });
  assert.equal((await lirePartieEnCours(page)).drapeaux['etape-sous-titres-television'], true);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('les commandes du jour : au niveau 3, renouvelées chaque matin, gardées une fois acceptées', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await preparerPartie(page, { livrees: ['essai-courses', 'halae-planning'], proposees: ['halae-planning'], reputation: 80 });
  const allerAuBureau = async () => {
    await page.getByRole('button', { name: 'Aller à…' }).click();
    await page.getByRole('dialog', { name: 'Aller à…' }).getByRole('button', { name: 'Bureau', exact: true }).click();
    const bouton = page.getByRole('button', { name: "Utiliser l'ordinateur" });
    await bouton.waitFor({ timeout: 20000 });
    await bouton.click();
    const fenetre = page.getByRole('dialog', { name: 'Ton ordinateur' });
    await fenetre.getByRole('button', { name: /^Commandes/ }).click();
    return fenetre;
  };
  let fenetre = await allerAuBureau();
  const section = fenetre.locator('section', { has: page.getByRole('heading', { name: 'Commandes du jour' }) });
  assert.match(await lireTexte(section), /Elles changent chaque matin/);
  const cartes = section.locator('.carte-commande');
  assert.equal(await cartes.count(), 2);
  assert.match(await lireTexte(cartes.first()), /application fictive/);
  const titres = await cartes.locator('h5').allInnerTexts();

  // On accepte la première : elle est recopiée dans la partie.
  await cartes.first().getByRole('button', { name: /^Lire la commande/ }).click();
  assert.match(await lireTexte(fenetre), /Commande de /);
  await fenetre.getByRole('button', { name: 'Accepter la commande' }).click();
  await fenetre.getByRole('heading', { name: /^Atelier :/ }).waitFor();
  const acceptee = Object.keys((await lirePartieEnCours(page)).commandes.aleatoires);
  assert.deepEqual(acceptee, ['jour-1-1']);
  await page.keyboard.press('Escape');
  await fenetre.waitFor({ state: 'detached' });

  // Le lendemain : elle est toujours en cours ; d'autres commandes du jour.
  await jourSuivant(page);
  fenetre = await allerAuBureau();
  const enCours = fenetre.locator('section', { has: page.getByRole('heading', { name: 'Projets en cours' }) });
  assert.match(await lireTexte(enCours), new RegExp(titres[0].replace(/[«»]/g, '.')));
  const nouvelles = await fenetre.locator('section', { has: page.getByRole('heading', { name: 'Commandes du jour' }) })
    .locator('h5').allInnerTexts();
  assert.equal(nouvelles.length, 2);
  const ids = (await lirePartieEnCours(page)).commandes.aleatoires;
  assert.deepEqual(Object.keys(ids), ['jour-1-1']);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('sur téléphone, texte « Énorme » : le journal tient dans l\'écran', async () => {
  const contexte = await outils.contexte({ viewport: { width: 390, height: 844 } });
  const page = await ouvrirJeu(contexte, outils.adresse);
  await page.evaluate(async () => {
    const reglages = await import('/js/noyau/reglages.js');
    reglages.modifierReglage('texte', 4);
  });
  await nouvellePartie(page);
  // Le message de bienvenue, très grand ici, couvre le bas de l'écran : on le masque.
  await page.getByRole('button', { name: 'Masquer ce message' }).first().click();
  // Le bouton « Journal » ne garde que son icône, mais son nom reste lu.
  const bouton = page.locator('.barre-bas').getByRole('button', { name: /^Journal/ });
  assert.equal(await bouton.locator('.libelle-journal').evaluate((mot) => getComputedStyle(mot).position), 'absolute');
  assert.ok((await bouton.boundingBox()).width < 120, 'seule l\'icône reste visible');
  await bouton.click();
  const journal = page.getByRole('dialog', { name: 'Journal' });
  await journal.waitFor();
  const mesures = await page.evaluate(() => {
    const corps = document.querySelector('.fenetre-journal .fenetre-corps');
    return { debordement: corps.scrollWidth - corps.clientWidth, page: document.documentElement.scrollWidth - window.innerWidth };
  });
  assert.ok(mesures.debordement <= 1, `défilement de côté : ${mesures.debordement} px`);
  assert.ok(mesures.page <= 0);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});
