// =============================================================================
// notifications.js — les messages discrets (« Partie sauvegardée »…)
// -----------------------------------------------------------------------------
// - Pas de clignotement, pas de son obligatoire : une icône, un texte clair.
// - Le message reste le temps de le lire (plus il est long, plus il reste),
//   et ne part pas tant qu'on le survole ou qu'il a le focus.
// - Il est aussi lu par les lecteurs d'écran.
// - Quand une fenêtre est ouverte, le reste de la page ne répond plus : le
//   message s'affiche alors dans la fenêtre, juste au-dessus de ses boutons.
// - Un message « persistant » (ex. « Nouvelle version disponible ») reste
//   jusqu'à ce qu'on le traite, et suit les fenêtres qui s'ouvrent.
// =============================================================================

import { ecouter } from '../noyau/evenements.js';
import { t } from '../noyau/textes.js';
import { el } from './dom.js';
import { fenetreDuDessus } from './fenetres.js';
import { icone } from './icones.js';

const MAXIMUM_VISIBLES = 3;
const persistantes = new Set();

function conteneur() {
  return fenetreDuDessus()?.zoneMessages || document.getElementById('notifications');
}

// Fait lire un texte par les lecteurs d'écran, sans rien afficher.
export function direAuxLecteurs(texte) {
  const zone = fenetreDuDessus()?.annonces || document.getElementById('annonces');
  if (!zone) return;
  zone.textContent = '';
  // Petit délai : certains lecteurs d'écran ignorent un texte remplacé trop vite.
  setTimeout(() => { zone.textContent = texte; }, 60);
}

/**
 * Affiche un message.
 *   type        'info' | 'succes' | 'attention' | 'erreur' (icône différente)
 *   action      { texte, surClic } : un bouton dans le message
 *   persistante true : le message reste jusqu'à ce qu'on le ferme
 */
export function notifier(texte, { type = 'info', action = null, persistante = false } = {}) {
  let minuteur = null;
  const element = el('div', { class: 'notification', 'data-type': type });

  function retirer() {
    clearTimeout(minuteur);
    persistantes.delete(element);
    element.remove();
  }

  element.append(
    icone(type, 'notification-icone'),
    el('p', { class: 'notification-texte' }, texte),
  );
  if (action) {
    element.append(el('button', {
      class: 'bouton bouton-principal',
      type: 'button',
      onClick: () => { retirer(); action.surClic(); },
    }, action.texte));
  }
  element.append(el('button', {
    class: 'bouton bouton-icone bouton-discret',
    type: 'button',
    'aria-label': t('notifications.masquer'),
    title: t('notifications.masquer'),
    onClick: retirer,
  }, icone('fermer')));

  const zone = conteneur();
  zone.append(element);
  // Pas plus de trois messages à la fois : les plus anciens partent.
  const anciens = [...zone.children].filter((noeud) => !persistantes.has(noeud) && noeud !== element);
  while (zone.children.length > MAXIMUM_VISIBLES && anciens.length > 0) anciens.shift().remove();

  direAuxLecteurs(texte);

  if (persistante || action) {
    persistantes.add(element);
  } else {
    const duree = Math.max(5000, 3500 + texte.length * 70);
    const lancer = () => {
      clearTimeout(minuteur);
      minuteur = setTimeout(retirer, duree);
    };
    const suspendre = () => clearTimeout(minuteur);
    element.addEventListener('pointerenter', suspendre);
    element.addEventListener('pointerleave', lancer);
    element.addEventListener('focusin', suspendre);
    element.addEventListener('focusout', lancer);
    lancer();
  }
  return { retirer };
}

// Les messages persistants suivent la fenêtre du dessus (ou reviennent sur
// la page quand elle se ferme), pour rester utilisables.
function deplacerPersistantes() {
  const zone = conteneur();
  for (const element of persistantes) zone.append(element);
}

export function initialiserNotifications() {
  ecouter('fenetre:ouverte', deplacerPersistantes);
  ecouter('fenetre:fermee', deplacerPersistantes);
}
