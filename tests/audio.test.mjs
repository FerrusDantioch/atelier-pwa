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

test('aucune note n\'est empilée tant que AudioContext n\'est pas « running », puis fondu à l\'arrêt', async () => {
  const oscillateurs = [];
  const gains = [];
  let etatContexte = 'suspended';
  const creerGain = () => {
    const cibles = [];
    const noeud = {
      cibles,
      gain: {
        setValueAtTime: () => {},
        setTargetAtTime: (valeur) => cibles.push(valeur),
        exponentialRampToValueAtTime: () => {},
        cancelScheduledValues: () => {},
      },
      connect: () => {},
      disconnect: () => {},
    };
    gains.push(noeud);
    return noeud;
  };
  const ancien = globalThis.AudioContext;
  const ancienAdd = self.addEventListener;
  const ecouteurs = [];
  self.addEventListener = (type, fn) => ecouteurs.push({ type, fn });
  globalThis.AudioContext = class FauxAudioContext {
    constructor() {
      this.currentTime = 1;
      this.destination = {};
    }
    get state() { return etatContexte; }
    createGain() { return creerGain(); }
    createOscillator() {
      const osc = {
        type: 'sine',
        frequency: { value: 0 },
        connect: () => {},
        disconnect: () => {},
        start: () => {},
        stop: () => {},
      };
      oscillateurs.push(osc);
      return osc;
    }
    resume() { return Promise.resolve(); }
    suspend() { etatContexte = 'suspended'; return Promise.resolve(); }
  };
  try {
    const reglages = await import('../js/noyau/reglages.js');
    reglages.chargerReglages();
    const audio = await import('../js/noyau/audio.js?mock=1');
    audio.initialiserAudio();
    // Premier geste alors que le contexte reste suspendu/interrompu : rien n'est programmé.
    ecouteurs.find((e) => e.type === 'pointerup').fn();
    audio.definirAmbiance(true);
    assert.equal(oscillateurs.length, 0, 'aucun accord empilé en état suspended');
    assert.equal(audio.jouerEffet('achat'), false, 'aucun effet programmé hors running');

    etatContexte = 'interrupted';
    audio.definirAmbiance(true);
    assert.equal(oscillateurs.length, 0, 'aucun accord empilé en état interrupted');

    // Passage à running : l'ambiance démarre et les effets fonctionnent.
    etatContexte = 'running';
    audio.definirAmbiance(true);
    assert.equal(oscillateurs.length, 4, 'un accord de 4 notes est joué');
    assert.equal(audio.jouerEffet('achat'), true);
    assert.equal(oscillateurs.length, 6);

    // Arrêt de l'ambiance : le gain dédié retombe à 0 en douceur.
    const gainAmbiance = gains[4];
    audio.definirAmbiance(false);
    assert.equal(gainAmbiance.cibles.at(-1), 0);
  } finally {
    globalThis.AudioContext = ancien;
    self.addEventListener = ancienAdd;
  }
});
