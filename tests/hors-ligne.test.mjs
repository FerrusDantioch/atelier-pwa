// Tests : la liste des fichiers gardés pour le jeu hors ligne (sw.js).
// Tout nouveau fichier du jeu doit être ajouté à FICHIERS dans sw.js.

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { RACINE, fichiersDuServiceWorker, lire, tousLesFichiers } from './aides.mjs';

// Fichiers et dossiers du dépôt qui ne servent pas à jouer.
const HORS_JEU = [
  /^\.gitignore$/, /^\.nojekyll$/, /^README\.md$/, /^CLAUDE\.md$/, /^sw\.js$/,
  /^\.github\//, /^docs\//, /^tests\//, /^outils\//,
  /^assets\/icones\/icone\.svg$/, // source des icônes PNG
];

test('chaque fichier listé dans sw.js existe', () => {
  for (const fichier of fichiersDuServiceWorker()) {
    if (fichier === './') continue;
    assert.ok(existsSync(join(RACINE, fichier)), `sw.js liste « ${fichier} », qui n'existe pas`);
  }
});

test('chaque fichier du jeu est listé dans sw.js (sinon il manquerait hors ligne)', () => {
  const listes = new Set(fichiersDuServiceWorker());
  const oublies = tousLesFichiers()
    .filter((fichier) => !HORS_JEU.some((motif) => motif.test(fichier)))
    .filter((fichier) => !listes.has(fichier));
  assert.deepEqual(oublies, [], `à ajouter dans FICHIERS (sw.js) : ${oublies.join(', ')}`);
});

test('la liste de sw.js n\'a pas de doublon et commence par la page', () => {
  const liste = fichiersDuServiceWorker();
  assert.equal(new Set(liste).size, liste.length, 'doublon dans FICHIERS');
  assert.equal(liste[0], './');
  assert.ok(liste.includes('index.html'));
});

test('chaque fichier durable de sw.js appartient à FICHIERS (Three.js et polices)', () => {
  const sw = lire('sw.js');
  const bloc = sw.match(/const DURABLES = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(bloc, 'liste DURABLES introuvable dans sw.js');
  const durables = [...bloc[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const listes = new Set(fichiersDuServiceWorker());
  assert.ok(durables.length > 0);
  for (const fichier of durables) assert.ok(listes.has(fichier), `DURABLES cite « ${fichier} » absent de FICHIERS`);
  assert.ok(durables.includes('lib/three/three.core.js'));
  assert.ok(durables.includes('lib/three/three.module.js'));
  assert.match(sw, /const VERSION_TIERS = '/);
});

test('le service worker lit sa version dans config.js et n\'efface que ses propres réserves', () => {
  const sw = lire('sw.js');
  assert.match(sw, /importScripts\('js\/config\.js'\)/);
  assert.match(sw, /startsWith\(PREFIXE\)/);
  assert.match(sw, /startsWith\(self\.registration\.scope\)/);
  // Pas de mise à jour imposée : à l'installation, la nouvelle version
  // attend l'accord du joueur (skipWaiting seulement sur le message « activer »).
  const installation = sw.slice(sw.indexOf("addEventListener('install'"), sw.indexOf("addEventListener('activate'"));
  assert.ok(installation.length > 0);
  assert.doesNotMatch(installation, /skipWaiting/);
  assert.match(sw, /message\.type === 'activer'\) \{[\s\S]*?self\.skipWaiting\(\)/);
});
