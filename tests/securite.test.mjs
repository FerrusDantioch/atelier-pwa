// Tests : règle de sécurité de la page (CSP) et bonnes habitudes du code.
// Le jeu ne doit contacter aucun autre site et ne jamais transformer un
// texte (venu d'un fichier importé, par exemple) en code.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lire, tousLesFichiers } from './aides.mjs';

const html = lire('index.html');

test('la page a une CSP stricte', () => {
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
  assert.ok(csp, 'CSP absente de index.html');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'(;|$)/, 'script-src doit être « self » seulement');
  assert.match(csp, /style-src 'self'(;|$)/, 'style-src doit être « self » seulement');
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|https?:/);
});

test('index.html ne contient ni script ni style écrits directement', () => {
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]);
  for (const attributs of scripts) assert.match(attributs, /\bsrc="/, 'script sans src dans index.html');
  assert.doesNotMatch(html, /<style\b/);
  assert.doesNotMatch(html, /\sstyle="/);
  assert.doesNotMatch(html, /\son[a-z]+="/, 'pas de onclick="…" dans le HTML');
});

test('aucun fichier du jeu n\'est chargé depuis un autre site', () => {
  const sources = tousLesFichiers().filter((f) => /\.(html|css)$/.test(f) && !f.startsWith('tests/') && !f.startsWith('docs/'));
  for (const fichier of sources) {
    const texte = lire(fichier);
    assert.doesNotMatch(texte, /(src|href)="https?:/, `${fichier} charge une ressource externe`);
    assert.doesNotMatch(texte, /url\(\s*['"]?https?:/, `${fichier} charge une ressource externe`);
    assert.doesNotMatch(texte, /@import\s+url\(\s*['"]?https?:/, `${fichier} importe une feuille externe`);
  }
});

test('le code ne fabrique jamais de HTML à partir de texte, ni de code à partir de texte', () => {
  const codes = tousLesFichiers().filter((f) => f.startsWith('js/') && f.endsWith('.js'));
  for (const fichier of codes) {
    const texte = lire(fichier).replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(texte, /\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write/, `${fichier} : HTML fabriqué à partir de texte`);
    assert.doesNotMatch(texte, /\beval\(|new Function\(/, `${fichier} : code fabriqué à partir de texte`);
    assert.doesNotMatch(texte, /setAttribute\(\s*['"]style['"]/, `${fichier} : style écrit en attribut (bloqué par la CSP)`);
  }
});

test('les liens externes s\'ouvrent dans un nouvel onglet, protégés', () => {
  const codes = tousLesFichiers().filter((f) => f.startsWith('js/') && f.endsWith('.js'));
  for (const fichier of codes) {
    const texte = lire(fichier);
    for (const ligne of texte.split('\n').filter((l) => /target: '_blank'/.test(l))) {
      assert.match(ligne, /rel: 'noopener/, `${fichier} : target _blank sans rel noopener`);
    }
  }
});
