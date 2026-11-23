// =============================================================================
// fenetres.js — les fenêtres (réglages, sauvegarde, confirmations…)
// -----------------------------------------------------------------------------
// Toujours la même forme, pour que ce soit prévisible :
//   - en haut : le titre et une croix « Fermer » ;
//   - au milieu : le contenu, seul à défiler ;
//   - en bas : les boutons, dont « Fermer », toujours visibles.
// Échap ferme la fenêtre. Tant qu'elle est ouverte, le clavier reste dedans
// (le reste de la page ne répond plus), puis le focus revient là où il était.
// Un clic à côté de la fenêtre ne la ferme pas (pas de fermeture par erreur).
//
// On utilise la balise <dialog> du navigateur, prévue pour ça.
// =============================================================================

import { annoncer } from '../noyau/evenements.js';
import { t } from '../noyau/textes.js';
import { el, identifiant } from './dom.js';
import { icone } from './icones.js';

const pile = [];

// Ce qu'on peut atteindre avec Tab dans une fenêtre.
const FOCALISABLES = 'button, [href], input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';

export function fenetreDuDessus() {
  return pile.length > 0 ? pile[pile.length - 1] : null;
}

export function fenetreOuverte() {
  return pile.length > 0;
}

// Ferme toutes les fenêtres (ex. quand une autre partie est chargée).
export function fermerToutes() {
  for (const fenetre of [...pile].reverse()) fenetre.fermer();
}

// Un bouton d'action. surClic peut renvoyer false pour garder la fenêtre
// ouverte même si « fermer: true ».
function boutonAction(action, fenetre) {
  return el('button', {
    class: ['bouton', action.principal && 'bouton-principal'],
    type: 'button',
    onClick: async () => {
      const resultat = await action.surClic?.(fenetre);
      if (action.fermer && resultat !== false) fenetre.fermer();
    },
  }, action.icone ? icone(action.icone) : null, action.texte);
}

/**
 * Ouvre une fenêtre.
 * options :
 *   titre        texte du titre
 *   contenu      élément(s) à afficher
 *   actions      [{ texte, icone, principal, fermer, surClic(fenetre) }]
 *   large        fenêtre plus large sur tablette (réglages…)
 *   fermable     false pour une fenêtre qu'on doit quitter par un bouton
 *   boutonFermer false pour ne pas ajouter le bouton « Fermer » en bas
 *   surFermeture fonction appelée à la fermeture
 *   focus        (fenetre) => élément à sélectionner à l'ouverture
 *                (par défaut : le titre, lu par les lecteurs d'écran)
 */
export function ouvrirFenetre(options) {
  const {
    titre, contenu, actions = [], large = false, fermable = true, boutonFermer = true,
    surFermeture, focus,
  } = options;
  const declencheur = document.activeElement;
  const idTitre = identifiant('titre-fenetre');

  const dialogue = el('dialog', { class: ['fenetre', large && 'fenetre-large'], 'aria-labelledby': idTitre });
  const titreElement = el('h2', { class: 'fenetre-titre', id: idTitre, tabindex: '-1' }, titre);
  const corps = el('div', { class: 'fenetre-corps' }, contenu);
  const zoneMessages = el('div', { class: 'fenetre-notifications' });
  const annonces = el('div', { class: 'visuellement-cache', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const pied = el('div', { class: 'fenetre-pied' });

  let fermee = false;
  const fenetre = { element: dialogue, titre: titreElement, corps, pied, zoneMessages, annonces, fermer };

  function fermer() {
    if (fermee) return;
    fermee = true;
    if (dialogue.open) dialogue.close();
    dialogue.remove();
    const index = pile.indexOf(fenetre);
    if (index !== -1) pile.splice(index, 1);
    if (declencheur?.isConnected && typeof declencheur.focus === 'function') declencheur.focus();
    annoncer('fenetre:fermee', { element: dialogue });
    surFermeture?.();
  }

  const entete = el('div', { class: 'fenetre-entete' }, titreElement, fermable ? el('button', {
    class: 'bouton bouton-icone bouton-discret',
    type: 'button',
    'aria-label': t('commun.fermer'),
    title: t('commun.fermer'),
    onClick: fermer,
  }, icone('fermer')) : null);

  for (const action of actions) pied.append(boutonAction(action, fenetre));
  if (fermable && boutonFermer) {
    pied.append(el('button', { class: 'bouton', type: 'button', onClick: fermer }, t('commun.fermer')));
  }

  dialogue.append(entete, corps, zoneMessages, annonces, pied);

  // Échap : fermer (si la fenêtre le permet), sans autre effet.
  dialogue.addEventListener('cancel', (evenement) => {
    evenement.preventDefault();
    if (fermable) fermer();
  });

  // Tab ne sort pas de la fenêtre : après le dernier élément, on revient au
  // premier (et inversement avec Maj + Tab).
  dialogue.addEventListener('keydown', (evenement) => {
    if (evenement.key !== 'Tab') return;
    const focalisables = [...dialogue.querySelectorAll(FOCALISABLES)]
      .filter((element) => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length > 0);
    if (focalisables.length === 0) return;
    const premier = focalisables[0];
    const dernier = focalisables[focalisables.length - 1];
    const actif = document.activeElement;
    // Le titre (tabindex -1) compte comme le début de la fenêtre.
    const auDebut = actif === premier || actif === titreElement || !dialogue.contains(actif);
    if (evenement.shiftKey && auDebut) {
      evenement.preventDefault();
      dernier.focus();
    } else if (!evenement.shiftKey && actif === dernier) {
      evenement.preventDefault();
      premier.focus();
    }
  });

  document.body.append(dialogue);
  dialogue.showModal();
  pile.push(fenetre);
  (focus?.(fenetre) || titreElement).focus();
  annoncer('fenetre:ouverte', { element: dialogue });
  return fenetre;
}

// Paragraphes à partir d'un texte ou d'une liste de textes.
export function paragraphes(texteOuListe) {
  return [texteOuListe].flat().map((texte) => el('p', {}, texte));
}

// Demande une confirmation. Renvoie une promesse : true (oui) ou false.
// Le bouton « non » (sans risque) est sélectionné par défaut.
export function confirmer({ titre, message, oui, non }) {
  return new Promise((resoudre) => {
    let reponse = false;
    ouvrirFenetre({
      titre,
      contenu: paragraphes(message),
      boutonFermer: false,
      actions: [
        { texte: non || t('commun.annuler'), fermer: true, surClic: () => { reponse = false; } },
        { texte: oui, principal: true, fermer: true, surClic: () => { reponse = true; } },
      ],
      focus: (fenetre) => fenetre.pied.querySelector('button'),
      surFermeture: () => resoudre(reponse),
    });
  });
}

// Une simple information, avec un bouton « D'accord ».
export function informer({ titre, message, contenu }) {
  return new Promise((resoudre) => {
    ouvrirFenetre({
      titre,
      contenu: contenu || paragraphes(message),
      boutonFermer: false,
      actions: [{ texte: t('commun.daccord'), principal: true, fermer: true }],
      focus: (fenetre) => fenetre.pied.querySelector('button'),
      surFermeture: resoudre,
    });
  });
}
