// Tests navigateur : le domicile en 3D, les déplacements (doigt, clavier,
// « Aller à… »), « Examiner », la caméra et le personnage.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  attendre, attendreArrivee, attendreMonde, lirePartieEnCours, nouvellePartie, ouvrirJeu, positionDeCase, preparer,
} from './aides-navigateur.mjs';

let outils;
before(async () => { outils = await preparer(); });
after(async () => { await outils.fermer(); });

// Le monde 3D affiché (lecture seule) : case du personnage, objet proche…
async function etatDuMonde(page) {
  return page.evaluate(async () => {
    const ecran = await import('/js/interface/ecran-jeu.js');
    const monde = ecran.mondeAffiche();
    return {
      case: monde.case, profil: monde.profil, objetProche: monde.objetProche,
      rotation: monde.rotation, zoom: monde.zoom, rendu: monde.infosRendu, piece: monde.piece?.id,
    };
  });
}

async function toucherCase(page, x, z) {
  const point = await positionDeCase(page, x, z);
  await page.touchscreen.tap(point.x, point.y);
}

test('le domicile est dessiné en 3D, sans erreur', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await page.waitForTimeout(300);
  const etat = await etatDuMonde(page);
  assert.ok(etat.rendu.calls > 0 && etat.rendu.calls < 40, `nombre de dessins : ${etat.rendu.calls}`);
  assert.ok(etat.rendu.triangles > 2000, `triangles : ${etat.rendu.triangles}`);
  assert.equal(etat.piece, 'sejour');
  assert.match(await page.locator('.lieu-actuel').innerText(), /Séjour/);
  // La scène est cachée aux lecteurs d'écran, l'interface non.
  assert.equal(await page.locator('#scene canvas').getAttribute('aria-hidden'), 'true');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('toucher le sol : le personnage y va, et sa position est gardée', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await toucherCase(page, 15, 14);
  await attendreArrivee(page, { x: 15, z: 14 });
  await page.reload();
  await page.locator('#chargement').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: /Continuer/ }).click();
  await attendreMonde(page);
  assert.deepEqual((await etatDuMonde(page)).case, { x: 15, z: 14 });
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('toucher un meuble : on s\'en approche, puis on l\'examine (bouton, Entrée, Échap)', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await toucherCase(page, 3, 1); // le lit
  const bouton = page.getByRole('button', { name: /Examiner le lit/ });
  await bouton.waitFor({ timeout: 15000 });
  assert.equal((await etatDuMonde(page)).objetProche.id, 'lit');
  // Entrée examine (le focus n'est sur aucun bouton après un toucher).
  await page.keyboard.press('Enter');
  const bulle = page.getByRole('region', { name: 'Lit' });
  await bulle.waitFor();
  assert.match(await bulle.innerText(), /à bonne hauteur/);
  await page.waitForFunction(() => document.getElementById('annonces').textContent.includes('Lit.'));
  // Échap ferme d'abord la bulle (et n'ouvre pas la Pause).
  await page.keyboard.press('Escape');
  await bulle.waitFor({ state: 'hidden' });
  assert.equal(await page.getByRole('dialog', { name: 'Pause' }).count(), 0);
  // Le bouton fait la même chose.
  await bouton.click();
  await bulle.waitFor();
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('« Aller à… » mène au bureau, en fauteuil roulant aussi', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page, { aide: 'Fauteuil roulant' });
  assert.equal((await etatDuMonde(page)).profil, 'fauteuil');
  await page.getByRole('button', { name: /Aller à/ }).click();
  const fenetre = page.getByRole('dialog', { name: /Aller à/ });
  assert.match(await fenetre.innerText(), /tu es ici/);
  await fenetre.getByRole('button', { name: 'Bureau', exact: true }).click();
  await page.getByRole('button', { name: /Examiner ton bureau/ }).waitFor({ timeout: 15000 });
  const etat = await etatDuMonde(page);
  assert.equal(etat.objetProche.id, 'bureau');
  // Puis la chambre : le personnage passe la porte (1 m) et y entre.
  await page.getByRole('button', { name: /Aller à/ }).click();
  await page.getByRole('dialog', { name: /Aller à/ }).getByRole('button', { name: /Aller dans la chambre/ }).click();
  await attendre(page, async () => {
    const ecran = await import('/js/interface/ecran-jeu.js');
    return ecran.mondeAffiche().piece?.id === 'chambre';
  });
  await page.waitForFunction(() => document.getElementById('annonces').textContent.includes('la chambre'));
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('au clavier : déplacer (Z Q S D), tourner (A/E), zoomer (+), et la vue est gardée', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  const depart = (await etatDuMonde(page)).case;
  await page.keyboard.down('d');
  await page.waitForTimeout(900);
  await page.keyboard.up('d');
  await attendre(page, async ([x, z]) => {
    const etat = await import('/js/noyau/etat.js');
    const position = etat.partieEnCours().joueur.position;
    return position && (position.x !== x || position.z !== z);
  }, [depart.x, depart.z]);

  await page.keyboard.press('e');
  const zoomAvant = (await etatDuMonde(page)).zoom;
  await page.keyboard.press('+');
  const etat = await etatDuMonde(page);
  assert.equal(etat.rotation, 1);
  assert.ok(etat.zoom > zoomAvant, 'le zoom a augmenté');
  await attendre(page, async () => {
    const e = await import('/js/noyau/etat.js');
    return e.partieEnCours().vue.rotation === 1 && e.partieEnCours().vue.zoom !== null;
  });
  // Échap : la Pause ; le clavier ne fait plus bouger le personnage.
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Pause' }).waitFor();
  const avant = (await etatDuMonde(page)).case;
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowLeft');
  assert.deepEqual((await etatDuMonde(page)).case, avant);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('les boutons de la caméra tournent et zooment la vue', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await page.getByRole('button', { name: /Tourner la vue vers la gauche/ }).click();
  assert.equal((await etatDuMonde(page)).rotation, 3);
  const zoom = (await etatDuMonde(page)).zoom;
  await page.getByRole('button', { name: 'Éloigner la vue' }).click();
  assert.ok((await etatDuMonde(page)).zoom < zoom);
  await page.getByRole('button', { name: /Recentrer la vue/ }).click();
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('jouer Ferrus : son apparence vient des données, jamais de la partie', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page, { modele: 'ferrus' });
  const partie = await lirePartieEnCours(page);
  assert.equal(partie.joueur.modele, 'ferrus');
  assert.equal(partie.joueur.nom, 'Ferrus');
  assert.equal(partie.joueur.apparence, null);
  await contexte.close();
});

test('« Ton personnage » depuis la Pause : changer d\'apparence sans perdre sa place', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await toucherCase(page, 12, 12);
  await attendreArrivee(page, { x: 12, z: 12 });
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('dialog', { name: 'Pause' }).getByRole('button', { name: 'Ton personnage' }).click();
  await page.getByRole('heading', { name: 'Ton personnage', level: 1 }).waitFor();
  await page.getByRole('textbox', { name: 'Prénom' }).fill('Zoé');
  await page.getByRole('group', { name: 'Aide', exact: true }).getByRole('radio', { name: 'Canne' }).check();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.locator('.barre-haut').waitFor();
  const partie = await lirePartieEnCours(page);
  assert.equal(partie.joueur.nom, 'Zoé');
  assert.equal(partie.joueur.apparence.aide, 'canne');
  assert.deepEqual((await etatDuMonde(page)).case, { x: 12, z: 12 });
  // Un prénom vide est refusé, avec une explication.
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('dialog', { name: 'Pause' }).getByRole('button', { name: 'Ton personnage' }).click();
  await page.getByRole('textbox', { name: 'Prénom' }).fill('   ');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  assert.match(await page.locator('.erreur-champ').innerText(), /Écris un prénom/);
  await page.getByRole('button', { name: 'Annuler' }).click();
  await page.locator('.barre-haut').waitFor();
  assert.equal((await lirePartieEnCours(page)).joueur.nom, 'Zoé');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('« Retour » depuis le choix du personnage ne touche pas à la partie en cours', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: /Retour à l'accueil/ }).click();
  await page.getByRole('button', { name: /^Nouvelle partie/ }).click();
  await page.getByRole('dialog', { name: /Commencer une nouvelle partie/ }).getByRole('button', { name: 'Nouvelle partie' }).click();
  await page.getByRole('heading', { name: /Qui veux-tu incarner/ }).waitFor();
  await page.getByRole('button', { name: 'Retour' }).click();
  await page.getByRole('heading', { level: 1, name: 'Atelier PWA' }).waitFor();
  assert.equal(await page.getByRole('button', { name: /Continuer/ }).count(), 1);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('qualité « Économie » en cours de partie : la 3D est recréée et répond toujours', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('dialog', { name: 'Pause' }).getByRole('button', { name: 'Réglages' }).click();
  const reglages = page.getByRole('dialog', { name: 'Réglages' });
  await reglages.getByRole('group', { name: 'Qualité graphique' }).getByText('Économie', { exact: true }).click();
  await reglages.getByRole('group', { name: 'Luminosité de la scène' }).getByText('Vive', { exact: true }).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#scene canvas').count(), 1, 'une seule zone de dessin');
  await toucherCase(page, 16, 14);
  await attendreArrivee(page, { x: 16, z: 14 });
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('téléphone et texte « Énorme » : barres compactes, rien ne déborde', async () => {
  const contexte = await outils.contexte({ viewport: { width: 390, height: 844 } });
  const page = await ouvrirJeu(contexte, outils.adresse);
  await page.evaluate(async () => {
    const reglages = await import('/js/noyau/reglages.js');
    reglages.modifierReglage('texte', 4);
  });
  await nouvellePartie(page);
  await page.waitForTimeout(300);
  const mesures = await page.evaluate(() => ({
    haut: document.querySelector('.barre-haut').offsetHeight,
    bas: document.querySelector('.barre-bas').offsetHeight,
    compacte: document.querySelector('.barre-haut').classList.contains('compacte'),
    debordement: document.documentElement.scrollWidth > window.innerWidth,
  }));
  assert.equal(mesures.compacte, true);
  assert.equal(mesures.debordement, false);
  assert.ok(mesures.haut + mesures.bas < 844 * 0.5, `barres : ${mesures.haut} + ${mesures.bas} px`);
  // Les valeurs complètes restent lues par les lecteurs d'écran.
  assert.match(await page.locator('.barre-haut').innerText(), /Niveau 1 · Premiers pas/);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('l\'affiche de l\'Omni-système : près de la porte, à examiner, avec le lien vers son site', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  const affichesVisibles = () => page.evaluate(async () => (await import('/js/interface/ecran-jeu.js')).mondeAffiche().affichesVisibles);
  assert.deepEqual(await affichesVisibles(), ['affiche-omni']);
  await page.getByRole('button', { name: 'Aller à…' }).click();
  await page.getByRole('dialog', { name: 'Aller à…' }).getByRole('button', { name: 'Affiche de l\'Omni-système' }).click();
  const examiner = page.getByRole('button', { name: /Examiner l'affiche de l'Omni-système/ });
  await examiner.waitFor({ timeout: 20000 });
  await examiner.click();
  const bulle = page.getByRole('region', { name: 'Affiche de l\'Omni-système' });
  await bulle.waitFor();
  assert.match(await bulle.innerText(), /la famille d'applications dont ce jeu fait partie/);
  // L'adresse est celle de js/config.js ; elle s'ouvre dans un nouvel onglet.
  const lien = bulle.getByRole('link', { name: /Découvrir l'Omni-système/ });
  assert.equal(await lien.getAttribute('href'), await page.evaluate(() => self.CONFIG_JEU.siteOmni));
  assert.equal(await lien.getAttribute('target'), '_blank');
  // La vue tourne d'un demi-tour : le mur de l'affiche est coupé, elle disparaît.
  await page.keyboard.press('Escape');
  await page.evaluate(async () => {
    const monde = (await import('/js/interface/ecran-jeu.js')).mondeAffiche();
    monde.tourner(1);
    monde.tourner(1);
  });
  await attendre(page, async () => (await import('/js/interface/ecran-jeu.js')).mondeAffiche().affichesVisibles.length === 0);
  assert.ok((await etatDuMonde(page)).rendu.calls < 40, 'toujours peu de dessins par image');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('sur téléphone, la vue suit le personnage sans à-coups pendant qu\'il marche', async () => {
  // Avant : chaque minute de jeu, les barres étaient remesurées et la caméra
  // recentrée d'un coup sur le personnage : la vue « sautait » en marchant.
  const contexte = await outils.contexte({ viewport: { width: 392, height: 870 } });
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  await page.getByRole('button', { name: 'Masquer ce message' }).first().click();
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const ecran = await import('/js/interface/ecran-jeu.js');
    const monde = ecran.mondeAffiche();
    window.recadrages = 0;
    const definirMarges = monde.definirMarges;
    monde.definirMarges = (marges) => { window.recadrages += 1; definirMarges(marges); };
    window.positions = [];
    const suivre = () => {
      window.positions.push(monde.positionEcranDeCase(10, 8));
      window.suivi = requestAnimationFrame(suivre);
    };
    window.suivi = requestAnimationFrame(suivre);
  });
  await page.getByRole('button', { name: 'Aller à…' }).click();
  await page.getByRole('dialog', { name: 'Aller à…' }).getByRole('button', { name: 'Lit', exact: true }).click();
  await page.waitForTimeout(500);
  await attendreArrivee(page);
  await page.waitForTimeout(800);
  const { positions, recadrages } = await page.evaluate(() => {
    cancelAnimationFrame(window.suivi);
    return { positions: window.positions, recadrages: window.recadrages };
  });
  const ecarts = positions.slice(1).map((p, i) => Math.hypot(p.x - positions[i].x, p.y - positions[i].y));
  assert.ok(Math.max(...ecarts) < 10, `la vue saute de ${Math.round(Math.max(...ecarts))} px d'une image à l'autre`);
  assert.equal(recadrages, 0, 'les barres n\'ont pas changé : la caméra n\'est pas recadrée');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('la barre du haut garde sa forme quand l\'heure change (chiffres de largeurs différentes)', async () => {
  // À cette largeur, « 14 h 10 » laissait Pause sur la première ligne, mais
  // pas « 14 h 46 » : la barre sautait d'une forme à l'autre chaque minute.
  const contexte = await outils.contexte({ viewport: { width: 380, height: 844 } });
  const page = await ouvrirJeu(contexte, outils.adresse);
  await nouvellePartie(page);
  const formes = await page.evaluate(async () => {
    const { modifierPartie } = await import('/js/noyau/etat.js');
    const vues = new Set();
    for (let minute = 7 * 60; minute <= 23 * 60; minute += 7) {
      modifierPartie((partie) => { partie.temps.minute = minute; partie.argent = 367; partie.reputation = 30; });
      const barre = document.querySelector('.barre-haut');
      const pause = document.querySelector('.bouton-pause');
      vues.add(`${barre.offsetHeight}/${pause.offsetTop}/${pause.offsetLeft}`);
    }
    return [...vues];
  });
  assert.equal(formes.length, 1, `la barre change de forme : ${formes.join(' | ')}`);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('une partie du jalon 0 (sans personnage) passe d\'abord par le choix du personnage', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  // Une partie au format 1, telle que l'exportait le jalon 0.
  const ancienne = await page.evaluate(async () => {
    const format = await import('/js/noyau/format-sauvegarde.js');
    const partie = format.nouvellePartie({ graine: 7, depart: { argent: 130, reputation: 0, lieu: 'domicile', jour: 3, heure: '08:00' }, versionJeu: '0.1.0' });
    delete partie.vue;
    partie.versionFormat = 1;
    return JSON.stringify(partie);
  });
  const [selecteur] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Importer une partie' }).click(),
  ]);
  await selecteur.setFiles({ name: 'ancienne.json', mimeType: 'application/json', buffer: Buffer.from(ancienne) });
  await page.getByRole('dialog', { name: /Importer cette partie/ }).getByRole('button', { name: /Charger cette partie|Remplacer ma partie/ }).click();
  await page.getByRole('heading', { name: /Qui veux-tu incarner/ }).waitFor();
  await page.getByRole('button', { name: /C'est parti/ }).click();
  await page.locator('.barre-haut').waitFor();
  await attendreMonde(page);
  const partie = await lirePartieEnCours(page);
  assert.equal(partie.versionFormat, 4, 'mise à niveau jusqu\'au format actuel');
  assert.equal(partie.argent, 130);
  assert.equal(partie.joueur.modele, 'perso');
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});

test('animations réduites et mode calme : la caméra ne glisse pas, on se déplace toujours', async () => {
  const contexte = await outils.contexte({ reducedMotion: 'reduce' });
  const page = await ouvrirJeu(contexte, outils.adresse);
  await page.evaluate(async () => {
    const reglages = await import('/js/noyau/reglages.js');
    reglages.modifierReglage('modeCalme', true);
  });
  await nouvellePartie(page);
  await page.getByRole('button', { name: 'Rapprocher la vue' }).click();
  await page.getByRole('button', { name: 'Rapprocher la vue' }).click();
  await toucherCase(page, 6, 12);
  await attendreArrivee(page, { x: 6, z: 12 });
  await page.getByRole('button', { name: /Tourner la vue vers la droite/ }).click();
  // Rotation instantanée : déjà terminée.
  assert.equal(await page.evaluate(async () => {
    const ecran = await import('/js/interface/ecran-jeu.js');
    return ecran.mondeAffiche().rotation;
  }), 1);
  assert.deepEqual(page.erreurs, []);
  await contexte.close();
});
