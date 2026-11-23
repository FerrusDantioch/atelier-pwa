// Tests navigateur (jalon 5) : la boutique de l'ordinateur, le matériel et son
// bonus, le mode « Aménager » (poser, refuser en disant pourquoi, tourner,
// reprendre, ranger), la sauvegarde des meubles posés, la quête qui le
// demande, et le téléphone avec un très grand texte.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  attendre, attendreMonde, lirePartieEnCours, nouvellePartie, ouvrirJeu, positionDeCase, preparer,
} from './aides-navigateur.mjs';

let outils;
before(async () => { outils = await preparer(); });
after(async () => { await outils.fermer(); });

const lireTexte = async (localisateur) => (await localisateur.innerText()).replace(/\s+/g, ' ');
const statut = (page) => lireTexte(page.locator('.amenagement-statut'));

// Prépare la partie : appel du mentor fait, de l'argent, une réputation, et
// des achats déjà faits (sans passer par la boutique).
async function preparerPartie(page, { argent = 500, reputation = 0, achats = [] } = {}) {
  await page.evaluate(async ({ argent, reputation, achats }) => {
    const { modifierPartie } = await import('/js/noyau/etat.js');
    modifierPartie((partie) => {
      partie.drapeaux['visio-accueil'] = true;
      partie.argent = argent;
      partie.reputation = reputation;
      achats.forEach((article, n) => partie.possessions.push({
        id: `achat-${n + 1}`, article, sorte: 'meuble', jour: 1, prix: 10,
      }));
    });
  }, { argent, reputation, achats });
}

async function ouvrirBoutique(page) {
  await page.evaluate(async () => {
    const { mondeAffiche } = await import('/js/interface/ecran-jeu.js');
    const monde = mondeAffiche();
    monde.allerVers(monde.destinations().find((d) => d.id === 'bureau'));
  });
  await page.getByRole('button', { name: 'Utiliser l\'ordinateur' }).click({ timeout: 30000 });
  await page.getByRole('button', { name: /^Boutique/ }).click();
  await page.getByRole('heading', { name: 'Boutique' }).waitFor();
}

async function ouvrirAmenagement(page) {
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Aménager ce lieu' }).click();
  await page.locator('.panneau-amenagement').waitFor();
}

async function toucherCase(page, x, z) {
  const position = await positionDeCase(page, x, z);
  await page.mouse.click(position.x, position.y);
}

test('la boutique : photo, prix, niveau, argent manquant ; acheter, puis placer tout de suite', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await preparerPartie(page, { argent: 100 });
  await ouvrirBoutique(page);
  const ordinateur = page.getByRole('dialog', { name: 'Ton ordinateur' });
  const texte = await lireTexte(ordinateur);
  assert.match(texte, /Ton argent : 100 pièces/);
  assert.match(texte, /Matériel pour ton bureau/);
  assert.match(texte, /Grand écran .* Prix : 90 pièces \+10 pièces à chaque livraison/);
  assert.match(texte, /Siège réglable .* À partir du niveau 2 \(Bouche-à-oreille\)/);
  assert.match(texte, /Aquarium .* À partir du niveau 3 \(Atelier reconnu\)/);
  assert.equal(await ordinateur.getByRole('img', { name: 'Photo : Cactus' }).count(), 1, 'chaque article a sa photo, décrite');
  // Pas assez d'argent : c'est dit, sans bouton.
  await page.evaluate(async () => {
    const { modifierPartie } = await import('/js/noyau/etat.js');
    modifierPartie((partie) => { partie.argent = 50; });
  });
  await page.getByRole('button', { name: 'Retour' }).click();
  await page.getByRole('button', { name: /^Boutique/ }).click();
  assert.match(await lireTexte(ordinateur), /Grand écran .* Il te manque 40 pièces\./);
  assert.equal(await page.getByRole('button', { name: /Acheter : Grand écran/ }).count(), 0);

  // Acheter le cactus : une confirmation d'abord.
  await page.getByRole('button', { name: /Acheter : Cactus, pour 10 pièces/ }).click();
  await page.getByRole('heading', { name: 'Acheter le cactus ?' }).waitFor();
  assert.match(await lireTexte(ordinateur), /Prix : 10 pièces\. Il te restera 40 pièces\./);
  await page.getByRole('button', { name: /^Acheter$/ }).click();
  await page.getByRole('heading', { name: 'C\'est acheté !' }).waitFor();
  assert.match(await lireTexte(ordinateur), /Le cactus t'attend dans tes affaires/);
  let partie = await lirePartieEnCours(page);
  assert.equal(partie.argent, 40);
  assert.deepEqual(partie.possessions, [{ id: 'achat-1', article: 'cactus', sorte: 'meuble', jour: 1, prix: 10 }]);

  // « Placer maintenant » : l'ordinateur se ferme, le mode Aménager s'ouvre,
  // avec le cactus à une place possible, près du personnage.
  await page.getByRole('button', { name: 'Placer maintenant' }).click();
  await page.locator('.panneau-amenagement').waitFor();
  assert.equal(await page.locator('.barre-bas').isVisible(), false, 'le panneau remplace la barre du bas');
  assert.match(await statut(page), /Le cactus, dans le séjour : ici, c'est possible\./);
  // Le temps est arrêté pendant l'aménagement.
  const minute = (await lirePartieEnCours(page)).temps.minute;
  await page.waitForTimeout(2200);
  assert.equal((await lirePartieEnCours(page)).temps.minute, minute, 'le temps ne passe pas');
  await page.getByRole('button', { name: 'Poser ici' }).click();
  assert.match(await statut(page), /Tu as posé le cactus\./);
  partie = await lirePartieEnCours(page);
  assert.equal(partie.lieux.amenagements.domicile.length, 1);
  assert.equal(partie.lieux.amenagements.domicile[0].id, 'achat-1');
  await page.getByRole('button', { name: 'Terminer' }).click();
  assert.equal(await page.locator('.barre-bas').isVisible(), true);

  // Après rechargement, le cactus est toujours là.
  await page.reload();
  await page.locator('#chargement').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: /^Continuer/ }).click();
  await attendreMonde(page);
  const pose = await page.evaluate(async () => {
    const { mondeAffiche } = await import('/js/interface/ecran-jeu.js');
    return mondeAffiche().grille.emprises.get('achat-1')?.meuble.id;
  });
  assert.equal(pose, 'cactus');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('le matériel s\'installe sur le bureau et rapporte 10 pièces de plus à chaque livraison', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await preparerPartie(page, { argent: 200 });
  const formesDuBureau = () => page.evaluate(async () => {
    const { mondeAffiche } = await import('/js/interface/ecran-jeu.js');
    return mondeAffiche().grille.emprises.get('bureau').meuble.formes.filter((forme) => forme.element === 'ecran').length;
  });
  assert.equal(await formesDuBureau(), 8);
  await ouvrirBoutique(page);
  await page.getByRole('button', { name: /Acheter : Grand écran/ }).click();
  await page.getByRole('button', { name: /^Acheter$/ }).click();
  const ordinateur = page.getByRole('dialog', { name: 'Ton ordinateur' });
  assert.match(await lireTexte(ordinateur), /Le grand écran est installé sur ton bureau\. Chaque livraison te rapporte maintenant 10 pièces de plus\./);
  assert.equal(await page.getByRole('button', { name: 'Placer maintenant' }).count(), 0, 'le matériel ne se pose pas');
  assert.equal(await formesDuBureau(), 9, 'le grand écran est sur le bureau');
  await page.getByRole('button', { name: 'Continuer mes achats' }).click();
  assert.match(await lireTexte(ordinateur), /Grand écran .* Installé sur ton bureau/);

  // La commande d'essai : le paiement compte le matériel.
  await page.getByRole('button', { name: 'Retour' }).click();
  await page.getByRole('button', { name: /^Commandes/ }).click();
  await page.getByRole('button', { name: /Lire la commande : Ma liste de courses/ }).click();
  await page.getByRole('button', { name: /Accepter/ }).click();
  await ordinateur.getByText('Liste à cocher', { exact: true }).click();
  await ordinateur.getByText('Partage', { exact: true }).click();
  const argentAvant = (await lirePartieEnCours(page)).argent;
  await page.getByRole('button', { name: 'Livrer' }).click();
  const livraison = page.getByRole('dialog', { name: 'Livraison : parfait !' });
  await livraison.waitFor();
  const { recompense, bonusEcran } = await page.evaluate(async () => {
    const [rCommandes, rBoutique] = await Promise.all([fetch('/data/commandes.json'), fetch('/data/boutique.json')]);
    const commandes = (await rCommandes.json()).commandes;
    const materiel = (await rBoutique.json()).materiel;
    return {
      recompense: commandes.find((c) => c.id === 'essai-courses').recompense,
      bonusEcran: materiel.find((m) => m.id === 'grand-ecran').bonus,
    };
  });
  assert.match(await lireTexte(livraison), new RegExp(`Dont ${bonusEcran} pièces grâce à ton matériel\\.`));
  const partie = await lirePartieEnCours(page);
  assert.equal(partie.commandes.livrees[0].argent, recompense.argent + recompense.bonus + bonusEcran);
  assert.ok(partie.argent - argentAvant >= partie.commandes.livrees[0].argent, 'l\'argent a bien été gagné');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('aménager : un meuble qui gêne est refusé, avec la raison ; tourner, poser, reprendre, ranger', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await preparerPartie(page, { achats: ['fauteuil', 'cactus', 'cactus'] });
  // Les messages de bienvenue/étape couvrent le haut de la scène (devant la porte de la chambre).
  while (await page.getByRole('button', { name: 'Masquer ce message' }).count() > 0) {
    await page.getByRole('button', { name: 'Masquer ce message' }).first().click();
  }
  await ouvrirAmenagement(page);
  assert.match(await statut(page), /Choisis un meuble dans tes affaires/);
  const affaires = page.locator('.liste-affaires');
  assert.deepEqual(await affaires.getByRole('button').allInnerTexts(), ['Fauteuil', 'Cactus × 2']);

  await affaires.getByRole('button', { name: 'Fauteuil' }).click();
  await toucherCase(page, 19, 15);
  assert.match(await statut(page), /Le fauteuil : impossible ici\. La place est prise par le canapé\./);
  // Devant la porte de la chambre : la raison parle du fauteuil roulant.
  await toucherCase(page, 6, 9);
  assert.match(await statut(page), /impossible ici\. En fauteuil roulant, on ne pourrait plus atteindre la chambre : il faut des passages d'au moins 1 m\./);
  // « Poser ici » ne pose rien tant que c'est impossible.
  await page.getByRole('button', { name: 'Poser ici' }).click();
  assert.deepEqual((await lirePartieEnCours(page)).lieux.amenagements, {});

  // Au milieu du séjour : possible ; R le tourne.
  await toucherCase(page, 10, 12);
  assert.match(await statut(page), /Le fauteuil, dans le séjour : ici, c'est possible\./);
  const fantome = () => page.evaluate(async () => (await import('/js/interface/ecran-jeu.js')).mondeAffiche().fantome);
  assert.equal((await fantome()).rotation, 0);
  await page.keyboard.press('KeyR');
  assert.equal((await fantome()).rotation, 90);
  await page.keyboard.press('Enter');
  assert.match(await statut(page), /Tu as posé le fauteuil\./);
  let partie = await lirePartieEnCours(page);
  assert.deepEqual(partie.lieux.amenagements.domicile.map((p) => [p.id, p.rotation]), [['achat-1', 90]]);
  assert.deepEqual(await affaires.getByRole('button').allInnerTexts(), ['Cactus × 2']);

  // Toucher le fauteuil le reprend ; « Annuler » le remet à sa place.
  const place = partie.lieux.amenagements.domicile[0];
  await toucherCase(page, place.x, place.z);
  assert.match(await statut(page), /Le fauteuil, dans le séjour : ici, c'est possible\./);
  await page.getByRole('button', { name: 'Annuler' }).click();
  assert.match(await statut(page), /Le fauteuil reprend sa place\./);
  assert.deepEqual((await lirePartieEnCours(page)).lieux.amenagements.domicile, [place]);
  // Le reprendre encore, puis « Ranger » : il retourne dans les affaires.
  await toucherCase(page, place.x, place.z);
  await page.getByRole('button', { name: 'Ranger' }).click();
  assert.match(await statut(page), /Tu as rangé le fauteuil dans tes affaires\./);
  partie = await lirePartieEnCours(page);
  assert.deepEqual(partie.lieux.amenagements, {});
  // Un meuble de la maison ne bouge pas.
  await toucherCase(page, 19, 15);
  assert.match(await statut(page), /Le canapé fait partie de la maison : il reste à sa place\./);
  // Échap termine l'aménagement.
  await page.keyboard.press('Escape');
  await page.locator('.panneau-amenagement').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('.barre-bas').isVisible(), true);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('la quête « Un intérieur où tout le monde passe » : l\'objectif mène à la boutique, puis à l\'aménagement', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await page.evaluate(async () => {
    const { modifierPartie } = await import('/js/noyau/etat.js');
    modifierPartie((partie) => {
      partie.drapeaux['visio-accueil'] = true;
      partie.drapeaux['proposee-halae-planning'] = true;
      for (const id of ['essai-courses', 'halae-planning']) partie.commandes.livrees.push({ id, note: 'parfait', jour: 1, argent: 10, reputation: 1 });
      partie.argent = 100;
    });
  });
  await attendre(page, async () => (await import('/js/noyau/etat.js')).partieEnCours().quetes.actives['interieur-pour-tous']);
  await page.evaluate(async () => {
    const { modifierPartie } = await import('/js/noyau/etat.js');
    modifierPartie((partie) => { partie.quetes.suivie = 'interieur-pour-tous'; });
  });
  const objectif = page.locator('.objectif');
  await attendre(page, () => document.querySelector('.objectif').textContent.includes('achète un meuble'));
  await ouvrirBoutique(page);
  await page.getByRole('button', { name: /Acheter : Pouf/ }).click();
  await page.getByRole('button', { name: /^Acheter$/ }).click();
  const ordinateur = page.getByRole('dialog', { name: 'Ton ordinateur' });
  assert.match(await lireTexte(ordinateur), /Étape terminée : achète un meuble, dans la boutique de l'ordinateur/);
  await page.getByRole('button', { name: 'Fermer' }).last().click();
  await attendre(page, () => document.querySelector('.objectif').textContent.includes('place-le chez toi'));
  // Toucher l'objectif ouvre l'aménagement.
  await objectif.click();
  await page.locator('.panneau-amenagement').waitFor();
  await page.locator('.liste-affaires').getByRole('button', { name: 'Pouf' }).click();
  await toucherCase(page, 10, 12);
  await page.getByRole('button', { name: 'Poser ici' }).click();
  assert.match(await statut(page), /Tu as posé le pouf\. Quête terminée : « Un intérieur où tout le monde passe »/);
  assert.ok((await lirePartieEnCours(page)).quetes.finies.includes('interieur-pour-tous'));
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('téléphone et texte « Énorme » : le panneau compact garde des boutons de 48 px et laisse voir la scène', async () => {
  const contexte = await outils.contexte({ viewport: { width: 390, height: 844 } });
  const page = await ouvrirJeu(contexte, outils.adresse);
  await page.evaluate(async () => {
    const reglages = await import('/js/noyau/reglages.js');
    reglages.modifierReglage('texte', 4);
  });
  await nouvellePartie(page);
  await preparerPartie(page, { achats: ['fauteuil'] });
  await ouvrirAmenagement(page);
  await page.locator('.liste-affaires').getByRole('button', { name: 'Fauteuil' }).click();
  await page.waitForTimeout(300);
  const mesures = await page.evaluate(() => ({
    compacte: document.querySelector('.panneau-amenagement').classList.contains('compacte'),
    haut: document.querySelector('.barre-haut').offsetHeight,
    panneau: document.querySelector('.panneau-amenagement').offsetHeight,
    debordement: document.documentElement.scrollWidth > window.innerWidth,
    boutons: [...document.querySelectorAll('.panneau-amenagement button')].map((bouton) => {
      const cadre = bouton.getBoundingClientRect();
      return Math.min(cadre.width, cadre.height);
    }),
  }));
  assert.equal(mesures.compacte, true);
  assert.equal(mesures.debordement, false);
  assert.ok(mesures.boutons.every((cote) => cote >= 48), `boutons : ${mesures.boutons.join(', ')}`);
  assert.ok(mesures.haut + mesures.panneau < 844 * 0.75, `barre ${mesures.haut} px + panneau ${mesures.panneau} px`);
  // Le nom des boutons secondaires reste lu.
  assert.equal(await page.getByRole('button', { name: 'Tourner', exact: true }).count(), 1);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});
