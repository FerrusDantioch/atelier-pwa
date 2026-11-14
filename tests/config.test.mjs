// Tests : réglages généraux (js/config.js), fiche d'installation, icônes.
// Lancement : node --test tests/

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { RACINE, chargerConfig, lire, lireJson } from './aides.mjs';

const config = chargerConfig();

// Largeur et hauteur d'une image PNG (lues dans son en-tête).
function taillePng(chemin) {
  const octets = readFileSync(join(RACINE, chemin));
  assert.equal(octets.toString('ascii', 1, 4), 'PNG', `${chemin} n'est pas une image PNG`);
  return [octets.readUInt32BE(16), octets.readUInt32BE(20)];
}

test('config.js contient les réglages attendus', () => {
  assert.ok(config.nom.trim().length > 0);
  assert.match(config.version, /^\d+\.\d+\.\d+$/, 'version au format 1.2.3');
  assert.equal(config.auteur, 'Ferrus Dantioch');
  assert.match(config.contact, /^[^@\s]+@[^@\s]+\.[a-z]+$/);
  assert.match(config.siteOmni, /^https:\/\//);
  // Ne jamais changer : les parties enregistrées deviendraient invisibles.
  assert.equal(config.idStockage, 'atelier-pwa');
  assert.ok(Object.isFrozen(config));
});

test('le nom est le même dans config.js, le manifeste et le titre de la page', () => {
  const manifeste = lireJson('manifest.webmanifest');
  assert.equal(manifeste.name, config.nom);
  assert.match(lire('index.html'), new RegExp(`<title>${config.nom}</title>`));
});

test('le manifeste permet l\'installation, sans bloquer l\'orientation', () => {
  const manifeste = lireJson('manifest.webmanifest');
  assert.equal(manifeste.start_url, './');
  assert.equal(manifeste.scope, './');
  assert.equal(manifeste.display, 'standalone');
  assert.equal(manifeste.lang, 'fr');
  assert.equal(manifeste.orientation, 'any', 'paysage et portrait doivent rester possibles');
  const tailles = manifeste.icons.map((icone) => `${icone.sizes} ${icone.purpose}`);
  for (const attendu of ['192x192 any', '512x512 any', '192x192 maskable', '512x512 maskable']) {
    assert.ok(tailles.includes(attendu), `icône ${attendu} manquante`);
  }
});

test('les icônes ont la bonne taille', () => {
  const manifeste = lireJson('manifest.webmanifest');
  for (const icone of manifeste.icons) {
    const [largeur, hauteur] = taillePng(icone.src);
    assert.equal(`${largeur}x${hauteur}`, icone.sizes, icone.src);
  }
  assert.deepEqual(taillePng('assets/icones/apple-touch-icon.png'), [180, 180]);
  assert.deepEqual(taillePng('assets/icones/favicon-32.png'), [32, 32]);
});

test('la licence est celle des autres dépôts de Ferrus Dantioch', () => {
  const licence = lire('LICENSE');
  assert.match(licence, /^© 2026 Ferrus Dantioch/);
  assert.match(licence, /CC BY-NC-ND 4\.0/);
});
