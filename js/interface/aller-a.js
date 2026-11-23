// =============================================================================
// aller-a.js — les fenêtres « Aller à… » et « Où aller ? » (voyages)
// -----------------------------------------------------------------------------
// Alternative 100 % textuelle au déplacement dans la scène 3D : liste les
// personnes présentes, chaque pièce, ses meubles examinables, et les autres
// lieux débloqués.
// =============================================================================

import { heureApresTrajet, lieuxOuOnPeutAller, ouvertures } from '../jeu/lieux.js';
import { presenceDans } from '../jeu/routines.js';
import { bornesDeLaJournee } from '../jeu/temps.js';
import { t } from '../noyau/textes.js';
import { el } from './dom.js';
import { ouvrirFenetre } from './fenetres.js';
import { icone } from './icones.js';

// Qui sera présent dans cet autre lieu à l'arrivée (après le trajet) ?
function nomsPresentsDans(idLieu, partie, donnees, minutes = null) {
  if (!partie || !donnees?.pnj?.pnj || !donnees?.jeu) return [];
  const { fin } = bornesDeLaJournee(donnees.jeu.temps);
  const trajet = minutes ?? donnees.jeu.deplacement?.trajet ?? 10;
  const arrivee = heureApresTrajet(partie.temps.minute, trajet, fin);
  const ouvertes = ouvertures(partie);
  return donnees.pnj.pnj
    .filter((pnj) => presenceDans(pnj, idLieu, arrivee, partie.joueur, ouvertes))
    .map((pnj) => (pnj.modele === 'ferrus' ? donnees.personnages.ferrus.nom : pnj.nom));
}

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

  // Les autres lieux débloqués : on y va par la porte d'entrée (avec les
  // personnes qu'on y trouvera à l'arrivée).
  const autres = partie && donnees?.indexLieux ? lieuxOuOnPeutAller(partie, donnees.indexLieux.lieux) : [];
  if (autres.length > 0) {
    contenu.push(el('section', { class: 'groupe-destinations' },
      el('h3', {}, t('jeu.autresLieux')),
      el('ul', { class: 'liste-destinations' }, autres.map((id) => {
        const presents = nomsPresentsDans(id, partie, donnees);
        return el('li', {}, el('button', {
          class: 'bouton',
          type: 'button',
          onClick: () => {
            fenetre.fermer();
            surAutreLieu(id);
          },
        }, icone('allerA'), el('span', {},
          t('jeu.allerVers', { vers: versDe(id) }),
          presents.length > 0 ? el('span', { class: 'texte-doux' }, ` · ${t('jeu.surPlace', { noms: presents.join(', ') })}`) : null)));
      }))));
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
      el('ul', { class: 'menu-liste' }, autres.map((id) => {
        const presents = nomsPresentsDans(id, partie, donnees, minutes);
        return el('li', {}, el('button', {
          class: 'bouton bouton-menu',
          type: 'button',
          onClick: () => {
            fenetre.fermer();
            surLieu(id);
          },
        }, icone('allerA'), el('span', { class: 'bouton-textes' },
          t('jeu.allerVers', { vers: versDe(id) }),
          presents.length > 0 ? el('span', { class: 'bouton-detail' }, t('jeu.surPlace', { noms: presents.join(', ') })) : null)));
      }))];
  fenetre = ouvrirFenetre({ titre: t('voyage.titre'), contenu });
  return fenetre;
}
