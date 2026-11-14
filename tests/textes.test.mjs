// Tests : chaque texte demandé par le code existe dans data/textes.json.
// (Sinon le jeu afficherait la clé entre crochets, ex. [accueil.titre].)

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chargerConfig, lire, lireJson, tousLesFichiers } from './aides.mjs';

chargerConfig();
const { CANAUX_SON, CHOIX } = await import('../js/noyau/reglages.js');
const { initialiserTextes, t, tPluriel, typographier } = await import('../js/noyau/textes.js');

const textes = lireJson('data/textes.json');
const existe = (cle) => typeof cle.split('.').reduce((n, m) => (n && typeof n === 'object' ? n[m] : undefined), textes) === 'string';

const codes = tousLesFichiers().filter((f) => f.startsWith('js/') && f.endsWith('.js'));
const sources = Object.fromEntries(codes.map((f) => [f, lire(f)]));

test('chaque clé écrite en toutes lettres dans le code existe', () => {
  const manquantes = [];
  for (const [fichier, texte] of Object.entries(sources)) {
    for (const [, fonction, cle] of texte.matchAll(/\b(t|tPluriel|existe)\(\s*'([^']+)'/g)) {
      const cles = fonction === 'tPluriel' ? [`${cle}.un`, `${cle}.plusieurs`] : [cle];
      for (const c of cles) if (fonction !== 'existe' && !existe(c)) manquantes.push(`${c} (${fichier})`);
    }
  }
  assert.deepEqual(manquantes, []);
});

test('les textes des réglages existent pour chaque choix', () => {
  const manquantes = [];
  for (const [nom, valeurs] of Object.entries(CHOIX)) {
    if (!existe(`reglages.${nom}.titre`)) manquantes.push(`reglages.${nom}.titre`);
    for (const valeur of valeurs) {
      if (!existe(`reglages.${nom}.valeurs.${valeur}`)) manquantes.push(`reglages.${nom}.valeurs.${valeur}`);
    }
  }
  for (const canal of CANAUX_SON) if (!existe(`reglages.volumes.${canal}`)) manquantes.push(`reglages.volumes.${canal}`);
  for (const resultat of ['coupe', 'muet', 'indisponible']) {
    if (!existe(`reglages.essai.${resultat}`)) manquantes.push(`reglages.essai.${resultat}`);
  }
  for (const section of ['affichage', 'mouvement', 'son', 'couleurs', 'retablir']) {
    if (!existe(`reglages.sections.${section}`)) manquantes.push(`reglages.sections.${section}`);
  }
  assert.deepEqual(manquantes, []);
});

test('chaque erreur de sauvegarde et chaque raison de copie a son texte', () => {
  const tout = Object.values(sources).join('\n');
  const codesErreur = new Set([
    ...[...tout.matchAll(/ErreurSauvegarde\('([^']+)'/g)].map((m) => m[1]),
    ...[...tout.matchAll(/code: '([^']+)'/g)].map((m) => m[1]),
  ]);
  const raisons = new Set([
    ...[...tout.matchAll(/(?:creerCopieDeSecours|remplacerPartie)\(.*?,\s*'([^']+)'\)/g)].map((m) => m[1]),
  ]);
  assert.ok(codesErreur.size >= 5, 'codes d\'erreur non trouvés dans le code');
  assert.ok(raisons.size >= 3, 'raisons non trouvées dans le code');
  for (const code of codesErreur) assert.ok(existe(`sauvegarde.erreurs.${code}`), `sauvegarde.erreurs.${code}`);
  for (const raison of raisons) assert.ok(existe(`sauvegarde.raisons.${raison}`), `sauvegarde.raisons.${raison}`);
  for (const appareil of ['android', 'ipad', 'ordinateur']) {
    assert.ok(existe(`installation.${appareil}.titre`) && existe(`installation.${appareil}.etapes`), appareil);
  }
});

test('remplacement des valeurs, pluriel et typographie française', () => {
  initialiserTextes(textes);
  assert.equal(t('hud.jour', { jour: 3 }), 'Jour 3');
  assert.equal(tPluriel('monnaie.montant', 1, { singulier: 'pièce', pluriel: 'pièces' }), '1 pièce');
  assert.equal(tPluriel('monnaie.montant', 0, { singulier: 'pièce', pluriel: 'pièces' }), '0 pièce');
  assert.equal(tPluriel('monnaie.montant', 1500, { singulier: 'pièce', pluriel: 'pièces' }), '1 500 pièces');
  assert.equal(typographier('Bienvenue ! « Oui » : 50 %'), 'Bienvenue ! « Oui » : 50 %');
  assert.equal(typographier('15:42'), '15:42', 'une heure écrite « 15:42 » ne change pas');
  assert.equal(t('cle.qui.nexiste.pas'), '[cle.qui.nexiste.pas]');
});

test('le tutoiement est respecté (pas de « vous » dans les textes)', () => {
  const tous = JSON.stringify(textes);
  assert.doesNotMatch(tous, /\b[Vv]ous\b|\b[Vv]otre\b|\b[Vv]os\b/);
});
