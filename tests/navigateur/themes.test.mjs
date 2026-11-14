// Test navigateur : contrastes de tous les thèmes, avec et sans contraste
// élevé et modes daltoniens (mesurés sur les couleurs réellement appliquées).
//   texte principal ≥ 7 ; texte secondaire, liens, couleurs d'état ≥ 4,5 ;
//   bordures des commandes et contour de focus ≥ 3.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { contraste, ouvrirJeu, preparer } from './aides-navigateur.mjs';

let outils;
before(async () => { outils = await preparer(); });
after(async () => { await outils.fermer(); });

const COMBINAISONS = [];
for (const theme of ['omni', 'sombre', 'clair']) {
  for (const contrasteEleve of ['normal', 'eleve']) {
    for (const daltonisme of ['aucun', 'rouge-vert', 'bleu-jaune']) COMBINAISONS.push({ theme, contrasteEleve, daltonisme });
  }
}

test('contrastes suffisants dans toutes les combinaisons de réglages', async () => {
  const contexte = await outils.contexte();
  const page = await ouvrirJeu(contexte, outils.adresse);
  const problemes = [];
  for (const { theme, contrasteEleve, daltonisme } of COMBINAISONS) {
    const couleurs = await page.evaluate(({ theme, contrasteEleve, daltonisme }) => {
      const racine = document.documentElement;
      racine.dataset.theme = theme;
      racine.dataset.contraste = contrasteEleve;
      racine.dataset.daltonisme = daltonisme;
      // Lit la couleur réellement calculée pour chaque variable.
      const sonde = document.createElement('span');
      document.body.append(sonde);
      const lire = (variable) => {
        sonde.style.color = `var(${variable})`;
        return getComputedStyle(sonde).color;
      };
      const noms = ['--fond', '--surface', '--surface-2', '--surface-active', '--bordure', '--texte', '--texte-doux',
        '--accent', '--sur-accent', '--focus', '--succes', '--attention', '--erreur', '--info'];
      const resultat = Object.fromEntries(noms.map((nom) => [nom, lire(nom)]));
      sonde.remove();
      return resultat;
    }, { theme, contrasteEleve, daltonisme });

    const exiger = (premier, second, minimum) => {
      const rapport = contraste(couleurs[premier], couleurs[second]);
      if (rapport < minimum) problemes.push(`${theme}/${contrasteEleve}/${daltonisme} : ${premier} sur ${second} = ${rapport.toFixed(2)} (minimum ${minimum})`);
    };
    for (const fond of ['--fond', '--surface', '--surface-2']) {
      exiger('--texte', fond, 7);
      exiger('--texte-doux', fond, 4.5);
      exiger('--accent', fond, 4.5);
      for (const etat of ['--succes', '--attention', '--erreur', '--info']) exiger(etat, fond, 4.5);
      exiger('--bordure', fond, 3);
      exiger('--focus', fond, 3);
    }
    exiger('--sur-accent', '--accent', 4.5);
    exiger('--texte', '--surface-active', 4.5);
    exiger('--accent', '--surface-active', 3);
  }
  assert.deepEqual(problemes, []);
  await contexte.close();
});
