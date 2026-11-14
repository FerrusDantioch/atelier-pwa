// =============================================================================
// ecran-jeu.js — l'écran de jeu : la barre fixe et le menu Pause
// -----------------------------------------------------------------------------
// La barre du haut montre toujours les mêmes informations aux mêmes places :
//   à gauche   : l'argent et la réputation ;
//   au centre  : l'objectif actif (le journal arrive au jalon 4) ;
//   à droite   : le jour et l'heure, et le bouton Pause.
//
// Jalon 0 : la scène 3D n'existe pas encore. Un panneau provisoire la
// remplace, avec deux boutons de test pour vérifier la sauvegarde
// (gagner des pièces, passer au jour suivant). Il disparaîtra au jalon 1.
// =============================================================================

import { ecouter } from '../noyau/evenements.js';
import { creerCopieDeSecours } from '../noyau/sauvegarde.js';
import { heureEnMinutes, niveauDeReputation } from '../noyau/format-sauvegarde.js';
import { modifierPartie, partieEnCours } from '../noyau/etat.js';
import { formaterHeure, t, tPluriel } from '../noyau/textes.js';
import { el } from './dom.js';
import { fenetreOuverte, ouvrirFenetre } from './fenetres.js';
import { icone } from './icones.js';
import { notifier } from './notifications.js';

function indicateur(nomIcone, libelle) {
  const valeur = el('span', {});
  const element = el('span', { class: 'indicateur' },
    icone(nomIcone), el('span', { class: 'visuellement-cache' }, libelle), valeur);
  return { element, valeur };
}

/**
 * Affiche l'écran de jeu dans « parent ».
 *   jeu    : data/jeu.json
 *   menu   : { surReglages, surSauvegarde, surAPropos, surAccueil }
 * Renvoie { element, detruire() }.
 */
export function afficherEcranJeu(parent, { jeu, menu }) {
  const argent = indicateur('piece', t('hud.argent'));
  const reputation = indicateur('etoile', t('hud.reputation'));
  const moment = indicateur('horloge', t('hud.moment'));

  const objectif = el('button', {
    class: 'bouton bouton-discret objectif',
    type: 'button',
    onClick: () => notifier(t('hud.journalBientot'), { type: 'info' }),
  }, icone('cible'), el('span', {}, el('strong', {}, `${t('hud.objectif')} `), t('hud.aucunObjectif')));

  const boutonPause = el('button', {
    class: 'bouton',
    type: 'button',
    onClick: () => ouvrirMenuPause(menu),
  }, icone('pause'), t('hud.pause'));

  const barre = el('header', { class: 'barre-haut' },
    el('div', { class: 'barre-zone barre-gauche' }, argent.element, reputation.element),
    el('div', { class: 'barre-zone barre-centre' }, objectif),
    el('div', { class: 'barre-zone barre-droite' }, moment.element, boutonPause));

  // Panneau provisoire (jalon 0) avec les boutons de test de la sauvegarde.
  const panneau = el('section', { class: 'panneau-provisoire', 'aria-labelledby': 'titre-provisoire' },
    el('h2', { id: 'titre-provisoire' }, t('provisoire.titre')),
    el('p', {}, t('provisoire.texte')),
    el('p', { class: 'aide' }, t('provisoire.testsExplication')),
    el('div', { class: 'rangee-boutons' },
      el('button', {
        class: 'bouton',
        type: 'button',
        onClick: () => modifierPartie((partie) => { partie.argent += 10; }),
      }, icone('piece'), t('provisoire.gagner')),
      el('button', {
        class: 'bouton',
        type: 'button',
        onClick: async () => {
          // Comme le fera le vrai jeu : une copie de secours à chaque nouveau jour.
          await creerCopieDeSecours(partieEnCours(), 'nouveau-jour');
          modifierPartie((partie) => {
            partie.temps.jour += 1;
            partie.temps.minute = heureEnMinutes(jeu.depart.heure);
          }, { important: true });
        },
      }, icone('horloge'), t('provisoire.jourSuivant'))));

  const element = el('div', { class: 'ecran-jeu' },
    el('h1', { class: 'visuellement-cache' }, self.CONFIG_JEU.nom),
    barre,
    el('main', { class: 'zone-centrale' }, panneau));

  // Met la barre à jour avec la partie en cours.
  function rafraichir() {
    const partie = partieEnCours();
    if (!partie) return;
    argent.valeur.textContent = tPluriel('monnaie.montant', partie.argent, {
      singulier: jeu.monnaie.singulier, pluriel: jeu.monnaie.pluriel,
    });
    const niveau = niveauDeReputation(partie.reputation, jeu.reputation.paliers);
    reputation.valeur.textContent = t('hud.niveau', { niveau: niveau.niveau, nom: niveau.nom });
    moment.valeur.textContent = `${t('hud.jour', { jour: partie.temps.jour })} · ${formaterHeure(partie.temps.minute)}`;
  }

  // Échap ouvre le menu Pause (quand aucune fenêtre n'est ouverte).
  function surTouche(evenement) {
    if (evenement.key === 'Escape' && !fenetreOuverte()) {
      evenement.preventDefault();
      ouvrirMenuPause(menu);
    }
  }

  const arrets = [ecouter('partie:modifiee', rafraichir), ecouter('partie:chargee', rafraichir)];
  document.addEventListener('keydown', surTouche);
  parent.append(element);
  rafraichir();

  return {
    element,
    detruire() {
      arrets.forEach((arreter) => arreter());
      document.removeEventListener('keydown', surTouche);
      element.remove();
    },
  };
}

// Le menu Pause : le jeu s'arrête tant qu'il est ouvert.
export function ouvrirMenuPause(menu) {
  const ligne = (nomIcone, texte, surClic) => el('li', {}, el('button', {
    class: 'bouton bouton-menu',
    type: 'button',
    onClick: surClic,
  }, icone(nomIcone), texte));

  const fenetre = ouvrirFenetre({
    titre: t('pause.titre'),
    contenu: [
      el('p', { class: 'aide' }, t('pause.explication')),
      el('ul', { class: 'menu-liste' },
        ligne('jouer', t('pause.reprendre'), () => fenetre.fermer()),
        ligne('reglages', t('pause.reglages'), () => menu.surReglages()),
        ligne('sauvegarde', t('pause.sauvegarde'), () => menu.surSauvegarde()),
        ligne('info', t('pause.aPropos'), () => menu.surAPropos()),
        ligne('maison', t('pause.accueil'), () => {
          fenetre.fermer();
          menu.surAccueil();
        })),
    ],
    boutonFermer: false,
    focus: (f) => f.corps.querySelector('button'),
  });
  return fenetre;
}
