// =============================================================================
// reglages.js — les réglages de confort (affichage, son, mouvement…)
// -----------------------------------------------------------------------------
// Les réglages valent pour toutes les parties : ils sont rangés à part de la
// sauvegarde, dans le « localStorage » du navigateur, sous la clé
// « atelier-pwa.reglages ». Ils doivent être lus AVANT le premier affichage
// (voir js/avant-affichage.js, qui sait les appliquer à la page).
//
// Chaque modification est appliquée tout de suite, enregistrée, puis
// annoncée (« reglages:modifies ») pour que le son, la 3D… s'adaptent.
// =============================================================================

import { annoncer } from './evenements.js';

// Valeurs possibles de chaque réglage (la première est la valeur par défaut,
// sauf exceptions calculées dans reglagesParDefaut).
export const CHOIX = {
  theme: ['omni', 'sombre', 'clair', 'auto'],
  texte: [1, 2, 3, 4],
  contraste: ['normal', 'eleve'],
  police: ['lisible', 'dyslexie', 'systeme'],
  espacement: ['normal', 'aere'],
  animations: ['auto', 'reduites', 'normales'],
  daltonisme: ['aucun', 'rouge-vert', 'bleu-jaune'],
  modeCalme: [false, true],
  sonCoupe: [false, true],
  luminosite: ['normale', 'douce', 'vive'],
  qualite: ['standard', 'economie', 'haute'],
  vitesseTemps: ['normale', 'lente', 'arretee'],
};

export const CANAUX_SON = ['musique', 'effets', 'voix'];

// Les réglages de départ. Si l'appareil demande déjà un contraste élevé,
// on le respecte dès le premier lancement.
export function reglagesParDefaut(appareil = {}) {
  return {
    version: 1,
    theme: 'omni',
    texte: 1,
    contraste: appareil.contrasteEleve ? 'eleve' : 'normal',
    police: 'lisible',
    espacement: 'normal',
    animations: 'auto',
    daltonisme: 'aucun',
    modeCalme: false,
    sonCoupe: false,
    luminosite: 'normale',
    qualite: 'standard',
    vitesseTemps: 'normale',
    volumes: { musique: 40, effets: 70, voix: 60 },
    premierLancementFait: false,
  };
}

function volumeValide(valeur, defaut) {
  const nombre = Number(valeur);
  if (!Number.isFinite(nombre)) return defaut;
  return Math.min(100, Math.max(0, Math.round(nombre / 10) * 10));
}

// Repart des réglages par défaut et ne garde, des réglages lus, que les
// valeurs connues. Des réglages abîmés ne peuvent donc pas gêner le jeu.
export function nettoyerReglages(brut, appareil = {}) {
  const propres = reglagesParDefaut(appareil);
  if (!brut || typeof brut !== 'object') return propres;
  for (const [cle, valeurs] of Object.entries(CHOIX)) {
    if (cle in brut && valeurs.includes(brut[cle])) propres[cle] = brut[cle];
  }
  if (brut.volumes && typeof brut.volumes === 'object') {
    for (const canal of CANAUX_SON) {
      propres.volumes[canal] = volumeValide(brut.volumes[canal], propres.volumes[canal]);
    }
  }
  propres.premierLancementFait = brut.premierLancementFait === true;
  return propres;
}

// --- Lecture, enregistrement, application (dans le navigateur) -------------

let reglages = null;

function cle() {
  return `${self.CONFIG_JEU.idStockage}.reglages`;
}

function lireAppareil() {
  const demande = (requete) => Boolean(self.matchMedia?.(requete).matches);
  return { contrasteEleve: demande('(prefers-contrast: more)') };
}

export function chargerReglages() {
  let brut = null;
  try {
    const texte = self.localStorage.getItem(cle());
    brut = texte ? JSON.parse(texte) : null;
  } catch {
    brut = null; // stockage indisponible ou abîmé : réglages par défaut
  }
  reglages = nettoyerReglages(brut, lireAppareil());
  appliquer();
  if (typeof self !== 'undefined') {
    self.surChangementAppareilAffichage = () => {
      if (!reglages) return;
      mettreAJourCouleurNavigateur();
      annoncer('reglages:modifies', { cle: 'appareil', valeur: null, reglages });
    };
  }
  return reglages;
}

function enregistrer() {
  try {
    self.localStorage.setItem(cle(), JSON.stringify(reglages));
    return true;
  } catch {
    return false; // navigation privée… : les réglages valent pour cette visite
  }
}

function mettreAJourCouleurNavigateur() {
  if (typeof document === 'undefined') return;
  const fond = getComputedStyle(document.documentElement).getPropertyValue('--fond').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && fond) meta.setAttribute('content', fond);
}

// Pose les réglages sur la page, puis accorde la couleur de la barre du
// navigateur (theme-color) au fond du thème choisi.
function appliquer() {
  self.appliquerReglagesAffichage?.(reglages);
  mettreAJourCouleurNavigateur();
}

export function obtenirReglages() {
  return reglages;
}

// Animations à réduire ? (réglage « auto » : suit l'appareil)
export function animationsReduites() {
  return document.documentElement.getAttribute('data-animations') === 'reduites';
}

export function modifierReglage(nom, valeur) {
  if (nom === 'volumes') {
    reglages.volumes = { ...reglages.volumes, ...valeur };
  } else {
    reglages[nom] = valeur;
  }
  reglages = nettoyerReglages(reglages, lireAppareil());
  appliquer();
  enregistrer();
  annoncer('reglages:modifies', { cle: nom, valeur, reglages });
}

export function retablirReglages() {
  const premierLancementFait = reglages.premierLancementFait;
  reglages = { ...reglagesParDefaut(lireAppareil()), premierLancementFait };
  appliquer();
  enregistrer();
  annoncer('reglages:modifies', { cle: '*', valeur: null, reglages });
}
