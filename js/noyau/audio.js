// =============================================================================
// audio.js — les sons du jeu, fabriqués par code (aucun fichier audio)
// -----------------------------------------------------------------------------
// Trois « canaux », chacun avec son volume dans les réglages :
//   - musique : boucle d'accords lents et doux pendant le jeu (coupée en
//               mode calme et quand l'application passe en arrière-plan) ;
//   - effets  : petits sons doux (livraison, achat, pose d'un meuble, quête) ;
//   - voix    : le petit « bavardage » des personnages quand ils parlent
//               (il n'y a pas de voix enregistrées : les dialogues sont
//               toujours écrits à l'écran).
// « Couper tout le son » passe avant tout le reste.
//
// Aucun son n'est indispensable : chaque information sonore a toujours un
// équivalent visuel (texte, icône).
//
// Les navigateurs n'autorisent le son qu'après un geste de la personne
// (toucher, clic, touche) : le son est donc préparé au premier geste.
// =============================================================================

import { ecouter } from './evenements.js';
import { CANAUX_SON, obtenirReglages } from './reglages.js';

let contexte = null;
let sortie = null;
const canaux = {};
let gesteRecu = false;
let ambianceActive = false;
let minuteurMusique = null;
let indexAccord = 0;

// Quatre accords doux et lents (Do maj7 → La min7 → Fa maj7 → Sol sus4).
const ACCORDS = [
  [261.63, 329.63, 392.0, 493.88],
  [220.0, 261.63, 329.63, 392.0],
  [174.61, 220.0, 261.63, 329.63],
  [196.0, 261.63, 293.66, 392.0],
];
const DUREE_ACCORD_MS = 4800;

// Un canal peut-il jouer maintenant, d'après les réglages ?
// « calme: true » : son d'ambiance ou d'événement non sollicité, donc coupé
// quand le mode calme est activé.
export function peutJouer(canal, reglages = obtenirReglages(), { calme = false } = {}) {
  if (!reglages || reglages.sonCoupe) return false;
  if (calme && reglages.modeCalme) return false;
  return (reglages.volumes?.[canal] || 0) > 0;
}

// Hauteur de base (en Hz) d'un personnage pour son petit bavardage.
export function hauteurDeVoix(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 997;
  return 290 + (h % 130);
}

function preparer() {
  if (!contexte) {
    const Contexte = self.AudioContext || self.webkitAudioContext;
    if (!Contexte) return null;
    contexte = new Contexte();
    sortie = contexte.createGain();
    sortie.connect(contexte.destination);
    for (const canal of CANAUX_SON) {
      canaux[canal] = contexte.createGain();
      canaux[canal].connect(sortie);
    }
    appliquerVolumes(obtenirReglages());
  }
  if (contexte.state === 'suspended') contexte.resume().catch(() => {});
  return contexte;
}

function appliquerVolumes(reglages) {
  if (!contexte) return;
  const maintenant = contexte.currentTime;
  sortie.gain.setTargetAtTime(reglages.sonCoupe ? 0 : 1, maintenant, 0.02);
  for (const canal of CANAUX_SON) {
    const volume = reglages.volumes[canal] / 100;
    // L'oreille perçoit le volume de façon « courbe » : on élève au carré
    // pour que 50 % sonne vraiment comme « à moitié ».
    canaux[canal].gain.setTargetAtTime(volume * volume, maintenant, 0.02);
  }
}

// Une note douce : montée progressive, puis extinction (pas de « clic »).
function note(canal, { frequence, debut, duree, attaque = 0.02, forme = 'sine', volume = 0.2 }) {
  const oscillateur = contexte.createOscillator();
  oscillateur.type = forme;
  oscillateur.frequency.value = frequence;
  const enveloppe = contexte.createGain();
  enveloppe.gain.setValueAtTime(0.0001, debut);
  enveloppe.gain.exponentialRampToValueAtTime(volume, debut + Math.min(attaque, duree * 0.45));
  enveloppe.gain.exponentialRampToValueAtTime(0.0001, debut + duree);
  oscillateur.connect(enveloppe);
  enveloppe.connect(canaux[canal]);
  oscillateur.start(debut);
  oscillateur.stop(debut + duree + 0.05);
}

// --- Musique d'ambiance douce ------------------------------------------------

function jouerAccordSuivant() {
  if (!ambianceActive || document.hidden || !peutJouer('musique', obtenirReglages(), { calme: true })) {
    arreterMusique();
    return;
  }
  if (!preparer()) return;
  const accord = ACCORDS[indexAccord % ACCORDS.length];
  indexAccord += 1;
  const debut = contexte.currentTime + 0.08;
  accord.forEach((frequence, i) => {
    note('musique', {
      frequence,
      debut: debut + i * 0.22,
      duree: 4.2,
      attaque: 0.75,
      forme: i === 0 ? 'sine' : 'triangle',
      volume: i === 0 ? 0.055 : 0.038,
    });
  });
}

function arreterMusique() {
  if (minuteurMusique !== null) {
    clearInterval(minuteurMusique);
    minuteurMusique = null;
  }
}

function mettreAJourMusique() {
  const doitJouer = ambianceActive && gesteRecu && (typeof document === 'undefined' || !document.hidden)
    && peutJouer('musique', obtenirReglages(), { calme: true });
  if (!doitJouer) {
    arreterMusique();
    return;
  }
  if (minuteurMusique !== null) return;
  jouerAccordSuivant();
  minuteurMusique = setInterval(jouerAccordSuivant, DUREE_ACCORD_MS);
}

// Active (en jeu) ou arrête (accueil, pause d'écran) la musique douce.
export function definirAmbiance(active) {
  ambianceActive = Boolean(active);
  mettreAJourMusique();
}

// --- Effets sonores et bavardage en jeu --------------------------------------

const EFFETS = {
  livraisonParfaite: (debut) => [523.25, 659.25, 783.99, 1046.5].forEach((frequence, i) => {
    note('effets', { frequence, debut: debut + i * 0.09, duree: 0.55, forme: 'triangle', volume: 0.14 });
  }),
  livraisonBien: (debut) => [523.25, 659.25].forEach((frequence, i) => {
    note('effets', { frequence, debut: debut + i * 0.11, duree: 0.45, forme: 'triangle', volume: 0.14 });
  }),
  // Jamais de bruit punitif : deux notes calmes et neutres.
  livraisonARetravailler: (debut) => [392.0, 349.23].forEach((frequence, i) => {
    note('effets', { frequence, debut: debut + i * 0.14, duree: 0.35, forme: 'sine', volume: 0.11 });
  }),
  achat: (debut) => {
    note('effets', { frequence: 783.99, debut, duree: 0.28, forme: 'sine', volume: 0.13 });
    note('effets', { frequence: 1046.5, debut: debut + 0.08, duree: 0.42, forme: 'sine', volume: 0.12 });
  },
  pose: (debut) => {
    note('effets', { frequence: 220, debut, duree: 0.14, attaque: 0.01, forme: 'triangle', volume: 0.14 });
    note('effets', { frequence: 330, debut: debut + 0.05, duree: 0.16, attaque: 0.01, forme: 'sine', volume: 0.09 });
  },
  refus: (debut) => {
    note('effets', { frequence: 240, debut, duree: 0.18, forme: 'sine', volume: 0.1 });
  },
  quete: (debut) => [440, 554.37, 659.25].forEach((frequence, i) => {
    note('effets', { frequence, debut: debut + i * 0.1, duree: 0.5, forme: 'triangle', volume: 0.12 });
  }),
};

export function jouerEffet(nom, { calme = false } = {}) {
  const recette = EFFETS[nom];
  if (!recette || !gesteRecu) return false;
  if (!peutJouer('effets', obtenirReglages(), { calme })) return false;
  if (!preparer()) return false;
  recette(contexte.currentTime + 0.02);
  return true;
}

// Petit bavardage doux (3 syllabes) quand un personnage dit une réplique.
export function jouerVoix(id = '') {
  if (!gesteRecu) return false;
  if (!peutJouer('voix', obtenirReglages())) return false;
  if (!preparer()) return false;
  const base = hauteurDeVoix(id);
  const debut = contexte.currentTime + 0.02;
  [1, 1.12, 0.96, 1.06].forEach((rapport, i) => {
    note('voix', {
      frequence: base * rapport,
      debut: debut + i * 0.085,
      duree: 0.075,
      attaque: 0.015,
      forme: 'triangle',
      volume: 0.11,
    });
  });
  return true;
}

// --- Sons d'essai des réglages (« Écouter ») ---------------------------------

const ESSAIS = {
  // Un accord qui s'égrène doucement.
  musique: (debut) => [261.63, 329.63, 392.0, 523.25].forEach((frequence, i) => {
    note('musique', { frequence, debut: debut + i * 0.28, duree: 1.3, forme: 'triangle', volume: 0.16 });
  }),
  // Un petit « ding » clair.
  effets: (debut) => {
    note('effets', { frequence: 880, debut, duree: 0.6, volume: 0.2 });
    note('effets', { frequence: 1318.5, debut: debut + 0.08, duree: 0.7, volume: 0.12 });
  },
  // Un bavardage : quelques syllabes très courtes.
  voix: (debut) => [330, 392, 349, 415, 370, 349].forEach((frequence, i) => {
    note('voix', { frequence, debut: debut + i * 0.1, duree: 0.09, forme: 'triangle', volume: 0.14 });
  }),
};

// Joue le son d'essai d'un canal. Renvoie ce qui s'est passé, pour que
// l'interface puisse l'expliquer : 'ok' | 'coupe' | 'muet' | 'indisponible'.
export function jouerEssai(canal) {
  gesteRecu = true;
  const reglages = obtenirReglages();
  if (reglages.sonCoupe) return 'coupe';
  if (reglages.volumes[canal] === 0) return 'muet';
  if (!preparer()) return 'indisponible';
  ESSAIS[canal](contexte.currentTime + 0.05);
  return 'ok';
}

export function initialiserAudio() {
  ecouter('reglages:modifies', ({ reglages }) => {
    appliquerVolumes(reglages);
    mettreAJourMusique();
  });
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', mettreAJourMusique);
  }
  // Prépare le son au premier geste (sans rien jouer de surprenant).
  const auPremierGeste = () => {
    gesteRecu = true;
    if (!obtenirReglages().sonCoupe) preparer();
    mettreAJourMusique();
  };
  self.addEventListener('pointerdown', auPremierGeste, { once: true });
  self.addEventListener('keydown', auPremierGeste, { once: true });
}
