// Tests : les réglages de confort se nettoient bien, et la page sait les
// appliquer avant le premier affichage (js/avant-affichage.js).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chargerConfig, lire } from './aides.mjs';

chargerConfig();
const { CHOIX, nettoyerReglages, reglagesParDefaut } = await import('../js/noyau/reglages.js');

test('sans réglages enregistrés : les valeurs par défaut', () => {
  const reglages = nettoyerReglages(null);
  assert.deepEqual(reglages, reglagesParDefaut());
  assert.equal(reglages.theme, 'omni');
  assert.equal(reglages.texte, 1);
  assert.equal(reglages.sonCoupe, false);
  assert.equal(reglages.premierLancementFait, false);
});

test('si l\'appareil demande un contraste élevé, il est activé dès le départ', () => {
  assert.equal(nettoyerReglages(null, { contrasteEleve: true }).contraste, 'eleve');
});

test('des réglages abîmés ou inconnus ne gênent pas le jeu', () => {
  const reglages = nettoyerReglages({
    theme: 'rose-fluo', texte: 9, police: 'dyslexie', sonCoupe: 'oui',
    volumes: { musique: 47, effets: 250, voix: 'fort' }, premierLancementFait: true, inconnu: 1,
  });
  assert.equal(reglages.theme, 'omni');
  assert.equal(reglages.texte, 1);
  assert.equal(reglages.police, 'dyslexie');
  assert.equal(reglages.sonCoupe, false);
  assert.deepEqual(reglages.volumes, { musique: 50, effets: 100, voix: 60 });
  assert.equal(reglages.premierLancementFait, true);
  assert.equal('inconnu' in reglages, false);
});

test('au moins 3 tailles de texte et toutes les options demandées', () => {
  assert.ok(CHOIX.texte.length >= 3);
  for (const nom of ['theme', 'contraste', 'police', 'espacement', 'animations', 'daltonisme', 'modeCalme', 'sonCoupe']) {
    assert.ok(CHOIX[nom], `réglage ${nom} absent`);
  }
});

test('avant-affichage.js accepte exactement les mêmes valeurs que reglages.js', () => {
  const texte = lire('js/avant-affichage.js');
  const bloc = texte.match(/var PERMIS = \{([\s\S]*?)\};/)[1];
  for (const nom of ['theme', 'contraste', 'police', 'espacement', 'animations', 'daltonisme']) {
    const ligne = bloc.match(new RegExp(`${nom}: \\[([^\\]]*)\\]`))[1];
    const valeurs = [...ligne.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(valeurs, CHOIX[nom].map(String), `valeurs de « ${nom} » différentes`);
  }
  const tailles = bloc.match(/texte: \[([^\]]*)\]/)[1];
  assert.deepEqual([...tailles.matchAll(/'([^']+)'/g)].map((m) => Number(m[1])), CHOIX.texte);
});

test('chaque taille de texte et chaque police ont leur règle dans les styles', () => {
  const base = lire('css/base.css');
  for (const taille of CHOIX.texte.slice(1)) assert.match(base, new RegExp(`\\[data-texte="${taille}"\\]`));
  for (const police of ['dyslexie', 'systeme']) assert.match(base, new RegExp(`\\[data-police="${police}"\\]`));
  assert.match(base, /\[data-animations="reduites"\]/);
  assert.match(base, /\[data-espacement="aere"\]/);
  const themes = lire('css/themes.css');
  for (const theme of ['omni', 'sombre', 'clair']) assert.match(themes, new RegExp(`\\[data-theme="${theme}"\\]`));
  for (const mode of ['rouge-vert', 'bleu-jaune']) assert.match(themes, new RegExp(`\\[data-daltonisme="${mode}"\\]`));
  assert.match(themes, /\[data-contraste="eleve"\]/);
});

test('les couleurs ne sont écrites que dans themes.css', async () => {
  const { tousLesFichiers } = await import('./aides.mjs');
  const feuilles = tousLesFichiers().filter((f) => f.startsWith('css/') && f.endsWith('.css') && f !== 'css/themes.css');
  assert.ok(feuilles.length >= 5, 'feuilles CSS attendues');
  for (const fichier of feuilles) {
    const sansCommentaires = lire(fichier).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(sansCommentaires, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, `${fichier} contient une couleur écrite en dur`);
  }
});
