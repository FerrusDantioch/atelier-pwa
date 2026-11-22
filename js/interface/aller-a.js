// =============================================================================
// aller-a.js — les fenêtres « Aller à… » et « Où aller ? » (voyages)
// -----------------------------------------------------------------------------
// Alternative 100 % textuelle au déplacement dans la scène 3D : liste les
// personnes présentes, chaque pièce, ses meubles examinables, et les autres
// lieux débloqués.
// =============================================================================

import { lieuxOuOnPeutAller } from '../jeu/lieux.js';
import { t } from '../noyau/textes.js';
import { el } from './dom.js';
import { ouvrirFenetre } from './fenetres.js';
import { icone } from './icones.js';

export function ouvrirAllerA({ monde, donnees, partie, versDe, surDestination, surAutreLieu }) {
  const destinations = monde.destinations();
  const pieces = destinations.filter((d) => d.type === 'piece');
  const ici = monde.piece?.id;
  let fenetre = null;

  const aller = (destination) => {
    fenetre.fermer();
    surDestination(destination);
  };
  const nomDePiece = (id) => pieces.find((p) => p.id === id)?.nom || '';
  const personnes = destinations.filter((d) => d.type === 'pnj');

  const contenu = pieces.map((piece) => {
    const objets = destinations.filter((d) => d.type !== 'piece' && d.type !== 'pnj' && d.piece === piece.id);
    return el('section', { class: 'groupe-destinations' },
      el('h3', {}, piece.nom, piece.id === ici ? el('span', { class: 'etiquette' }, t('jeu.tuEsIci')) : null),
      el('ul', { class: 'liste-destinations' },
        el('li', {}, el('button', { class: 'bouton', type: 'button', onClick: () => aller(piece) },
          icone('lieu'), t('jeu.allerDans', { piece: piece.designation }))),
        objets.map((objet) => el('li', {}, el('button', { class: 'bouton', type: 'button', onClick: () => aller(objet) },
          icone('allerA'), objet.nom)))));
  });

  if (personnes.length > 0) {
    contenu.unshift(el('section', { class: 'groupe-destinations' },
      el('h3', {}, t('jeu.personnes')),
      el('ul', { class: 'liste-destinations' }, personnes.map((personne) => el('li', {},
        el('button', { class: 'bouton', type: 'button', onClick: () => aller(personne) },
          icone('personnage'), t('jeu.personneOu', { nom: personne.nom, piece: nomDePiece(personne.piece) })))))));
  }

  // Les autres lieux débloqués : on y va par la porte d'entrée.
  const autres = partie && donnees?.indexLieux ? lieuxOuOnPeutAller(partie, donnees.indexLieux.lieux) : [];
  if (autres.length > 0) {
    contenu.push(el('section', { class: 'groupe-destinations' },
      el('h3', {}, t('jeu.autresLieux')),
      el('ul', { class: 'liste-destinations' }, autres.map((id) => el('li', {}, el('button', {
        class: 'bouton',
        type: 'button',
        onClick: () => {
          fenetre.fermer();
          surAutreLieu(id);
        },
      }, icone('allerA'), t('jeu.allerVers', { vers: versDe(id) })))))));
  }

  fenetre = ouvrirFenetre({
    titre: t('jeu.allerATitre'),
    contenu: [el('p', { class: 'aide' }, t('jeu.allerAAide')), ...contenu],
    large: true,
  });
  return fenetre;
}

// « Sortir… » (à la porte d'entrée) : où aller ?
export function ouvrirVoyage({ partie, donnees, minutes, versDe, surLieu }) {
  if (!partie) return null;
  const autres = lieuxOuOnPeutAller(partie, donnees.indexLieux.lieux);
  let fenetre = null;
  const contenu = autres.length === 0
    ? [el('p', {}, t('voyage.aucun'))]
    : [el('p', { class: 'aide' }, t('voyage.aide', { minutes })),
      el('ul', { class: 'menu-liste' }, autres.map((id) => el('li', {}, el('button', {
        class: 'bouton bouton-menu',
        type: 'button',
        onClick: () => {
          fenetre.fermer();
          surLieu(id);
        },
      }, icone('allerA'), t('jeu.allerVers', { vers: versDe(id) })))))];
  fenetre = ouvrirFenetre({ titre: t('voyage.titre'), contenu });
  return fenetre;
}
