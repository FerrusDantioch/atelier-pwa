// Tests : règles audio en jeu (respect de sonCoupe, volumes, mode calme,
// voix par personnage, fonctionnement sûr sans AudioContext).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chargerConfig } from './aides.mjs';

chargerConfig();
const { definirAmbiance, hauteurDeVoix, jouerEffet, jouerVoix, peutJouer } = await import('../js/noyau/audio.js');
const { reglagesParDefaut } = await import('../js/noyau/reglages.js');

test('peutJouer respecte sonCoupe, le volume du canal et le mode calme', () => {
  const base = reglagesParDefaut();
  assert.equal(peutJouer('effets', base), true);
  assert.equal(peutJouer('musique', base, { calme: true }), true);
  assert.equal(peutJouer('effets', { ...base, sonCoupe: true }), false);
  assert.equal(peutJouer('effets', { ...base, volumes: { ...base.volumes, effets: 0 } }), false);
  assert.equal(peutJouer('musique', { ...base, modeCalme: true }, { calme: true }), false, 'la musique est coupée en mode calme');
  assert.equal(peutJouer('effets', { ...base, modeCalme: true }, { calme: true }), false, 'les effets non sollicités sont coupés en mode calme');
  assert.equal(peutJouer('effets', { ...base, modeCalme: true }, { calme: false }), true, 'un retour d\'action directe reste possible');
});

test('hauteurDeVoix reste douce, déterministe et différencie les personnages', () => {
  const h1 = hauteurDeVoix('halae');
  const h2 = hauteurDeVoix('theo');
  assert.equal(h1, hauteurDeVoix('halae'));
  assert.ok(h1 >= 290 && h1 < 420);
  assert.ok(h2 >= 290 && h2 < 420);
  assert.notEqual(h1, h2);
});

test('jouerEffet, jouerVoix et definirAmbiance restent silencieux sans geste ni AudioContext', () => {
  assert.equal(jouerEffet('achat'), false);
  assert.equal(jouerEffet('effetInconnu'), false);
  assert.equal(jouerVoix('ferrus'), false);
  assert.doesNotThrow(() => {
    definirAmbiance(true);
    definirAmbiance(false);
  });
});
