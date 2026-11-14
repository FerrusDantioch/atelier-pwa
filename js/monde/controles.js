// =============================================================================
// controles.js — jouer au clavier
// -----------------------------------------------------------------------------
// Les touches sont repérées par leur POSITION sur le clavier, pas par la
// lettre imprimée : sur un clavier AZERTY on utilise Z Q S D, et les mêmes
// touches (W A S D) fonctionnent sur un clavier QWERTY.
//
//   Z Q S D ou flèches   se déplacer (dans le sens de l'écran)
//   A / E                tourner la vue d'un quart de tour
//   + / −                zoomer / dézoomer
//   C                    recentrer la vue sur le personnage
//   Entrée ou Espace     agir (examiner l'objet proche)
//   Échap                pause (géré par l'écran de jeu)
//
// Rien ne se passe quand une fenêtre est ouverte, quand on écrit dans un
// champ, ou avec Ctrl / Alt / Cmd (raccourcis du navigateur).
// =============================================================================

// Codes de position (noms QWERTY) → direction à l'écran.
const DIRECTIONS = {
  KeyW: [0, 1], ArrowUp: [0, 1],
  KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

const CHAMPS = 'input, textarea, select, [contenteditable]';
// Sur ces éléments, Entrée et Espace gardent leur rôle habituel.
const COMMANDES = 'button, a[href], input, textarea, select, summary, [role="button"], [contenteditable]';

/**
 * actions : {
 *   actif()                    le jeu écoute-t-il le clavier ?
 *   direction(droite, haut)    touches de déplacement enfoncées (null si aucune)
 *   tourner(sens)  zoomer(facteur)  recentrer()  agir()
 * }
 * Renvoie une fonction qui débranche le clavier.
 */
export function brancherClavier(actions) {
  const enfoncees = new Set();

  function signalerDirection() {
    let droite = 0;
    let haut = 0;
    for (const code of enfoncees) {
      droite += DIRECTIONS[code][0];
      haut += DIRECTIONS[code][1];
    }
    actions.direction(droite === 0 && haut === 0 ? null : { droite: Math.sign(droite), haut: Math.sign(haut) });
  }

  function toucheEnfoncee(evenement) {
    if (evenement.defaultPrevented || evenement.ctrlKey || evenement.metaKey || evenement.altKey) return;
    if (!actions.actif()) return;
    const cible = evenement.target;
    if (cible instanceof Element && cible.closest(CHAMPS)) return;

    if (DIRECTIONS[evenement.code]) {
      evenement.preventDefault(); // pas de défilement de la page
      if (!enfoncees.has(evenement.code)) {
        enfoncees.add(evenement.code);
        signalerDirection();
      }
      return;
    }
    if (evenement.repeat) return;
    const touche = evenement.key;
    if (evenement.code === 'KeyQ') actions.tourner(-1);
    else if (evenement.code === 'KeyE') actions.tourner(1);
    else if (evenement.code === 'KeyC') actions.recentrer();
    else if (touche === '+' || touche === '=' || evenement.code === 'NumpadAdd') actions.zoomer(1.25);
    else if (touche === '-' || touche === '_' || evenement.code === 'NumpadSubtract') actions.zoomer(0.8);
    else if (touche === 'Enter' || touche === ' ') {
      if (cible instanceof Element && cible.closest(COMMANDES)) return;
      evenement.preventDefault();
      actions.agir();
    } else {
      return;
    }
    evenement.preventDefault();
  }

  function toucheRelachee(evenement) {
    if (enfoncees.delete(evenement.code)) signalerDirection();
  }

  // Si la fenêtre perd le focus (changement d'appli), on relâche tout.
  function toutRelacher() {
    if (enfoncees.size === 0) return;
    enfoncees.clear();
    signalerDirection();
  }

  document.addEventListener('keydown', toucheEnfoncee);
  document.addEventListener('keyup', toucheRelachee);
  self.addEventListener('blur', toutRelacher);
  return {
    toutRelacher,
    debrancher() {
      document.removeEventListener('keydown', toucheEnfoncee);
      document.removeEventListener('keyup', toucheRelachee);
      self.removeEventListener('blur', toutRelacher);
      enfoncees.clear();
    },
  };
}
