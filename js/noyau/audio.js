// =============================================================================
// audio.js — les sons du jeu, fabriqués par code (aucun fichier audio)
// -----------------------------------------------------------------------------
// Trois « canaux », chacun avec son volume dans les réglages :
//   - musique : la musique douce (à partir des jalons suivants) ;
//   - effets  : petits sons (pièce gagnée, message reçu…) ;
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
  if (contexte.state === 'suspended') contexte.resume();
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

// Une note douce : montée rapide, puis extinction progressive (pas de « clic »).
function note(canal, { frequence, debut, duree, forme = 'sine', volume = 0.2 }) {
  const oscillateur = contexte.createOscillator();
  oscillateur.type = forme;
  oscillateur.frequency.value = frequence;
  const enveloppe = contexte.createGain();
  enveloppe.gain.setValueAtTime(0.0001, debut);
  enveloppe.gain.exponentialRampToValueAtTime(volume, debut + 0.02);
  enveloppe.gain.exponentialRampToValueAtTime(0.0001, debut + duree);
  oscillateur.connect(enveloppe);
  enveloppe.connect(canaux[canal]);
  oscillateur.start(debut);
  oscillateur.stop(debut + duree + 0.05);
}

// Les sons d'essai de l'écran Réglages (« Écouter »).
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
  const reglages = obtenirReglages();
  if (reglages.sonCoupe) return 'coupe';
  if (reglages.volumes[canal] === 0) return 'muet';
  if (!preparer()) return 'indisponible';
  ESSAIS[canal](contexte.currentTime + 0.05);
  return 'ok';
}

export function initialiserAudio() {
  ecouter('reglages:modifies', ({ reglages }) => appliquerVolumes(reglages));
  // Prépare le son au premier geste (sans rien jouer).
  const auPremierGeste = () => {
    if (!obtenirReglages().sonCoupe) preparer();
  };
  self.addEventListener('pointerdown', auPremierGeste, { once: true });
  self.addEventListener('keydown', auPremierGeste, { once: true });
}
