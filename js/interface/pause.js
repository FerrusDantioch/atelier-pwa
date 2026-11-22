// =============================================================================
// pause.js — le menu Pause et la fenêtre d'aide « Commandes »
// -----------------------------------------------------------------------------
// Extrait d'ecran-jeu.js pour garder chaque module court et lisible.
// Le temps du jeu s'arrête automatiquement dès qu'une fenêtre est ouverte.
// =============================================================================

import { clesDuGroupe, t } from '../noyau/textes.js';
import { el } from './dom.js';
import { ouvrirFenetre } from './fenetres.js';
import { icone } from './icones.js';

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
        menu.surJournal ? ligne('journal', t('pause.journal'), () => {
          fenetre.fermer();
          menu.surJournal();
        }) : null,
        menu.surAmenager ? ligne('amenager', t('pause.amenager'), () => {
          fenetre.fermer();
          menu.surAmenager();
        }) : null,
        ligne('personnage', t('pause.personnage'), () => {
          fenetre.fermer();
          menu.surPersonnage();
        }),
        ligne('clavier', t('pause.commandes'), () => ouvrirCommandes()),
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

// La fenêtre « Commandes » : toucher, souris, clavier. Chaque liste vient
// d'un groupe de data/textes.json (commandes.clavier.deplacer.geste…).
export function ouvrirCommandes() {
  const liste = (cle) => el('dl', { class: 'liste-commandes' },
    clesDuGroupe(cle).map((nom) => [
      el('dt', {}, t(`${cle}.${nom}.geste`)),
      el('dd', {}, t(`${cle}.${nom}.effet`)),
    ]));
  return ouvrirFenetre({
    titre: t('commandes.titre'),
    contenu: [
      el('p', { class: 'aide' }, t('commandes.intro')),
      el('h3', {}, t('commandes.toucherTitre')), liste('commandes.toucher'),
      el('h3', {}, t('commandes.sourisTitre')), liste('commandes.souris'),
      el('h3', {}, t('commandes.clavierTitre')), el('p', { class: 'aide' }, t('commandes.clavierAide')), liste('commandes.clavier'),
    ],
    large: true,
  });
}
