// =============================================================================
// a-propos.js — la fenêtre « À propos »
// -----------------------------------------------------------------------------
// Sur le modèle commun aux applications de Ferrus Dantioch (omni-texte) :
// nom, version, auteur, licence, confidentialité, contact, lien vers
// l'Omni-système, et les licences des fichiers d'autres auteurs.
//
// Les adresses (contact, site) viennent de js/config.js ; les phrases, de
// data/textes.json (groupe « aPropos »).
//
// TODO (jalon 6) : ajouter les mentions légales. Les champs à compléter
// (éditeur, directeur de la publication…) attendent la décision de Ferrus :
// aucune identité civile ne doit être écrite dans le code ni les données.
// =============================================================================

import { t } from '../noyau/textes.js';
import { el } from './dom.js';
import { ouvrirFenetre } from './fenetres.js';
import { icone } from './icones.js';

// Lien vers un autre site : s'ouvre dans un nouvel onglet, seulement si la
// personne le touche (rien n'est contacté sans son geste).
function lienExterne(adresse, texte) {
  return el('a', { href: adresse, target: '_blank', rel: 'noopener noreferrer' },
    texte, ' ', icone('lienExterne'), el('span', { class: 'visuellement-cache' }, t('commun.nouvelOnglet')));
}

// Lien vers un fichier du jeu (disponible hors ligne).
function lienLocal(adresse, texte) {
  return el('a', { href: adresse, target: '_blank', rel: 'noopener' }, texte);
}

export function ouvrirAPropos() {
  const config = self.CONFIG_JEU;
  const contenu = el('div', { class: 'a-propos' },
    el('img', {
      class: 'a-propos-logo',
      src: 'assets/logo-omni-systeme.webp',
      width: 104,
      height: 104,
      alt: t('aPropos.logoAlt'),
    }),
    el('h3', {}, config.nom),
    el('p', {}, t('aPropos.version', { version: config.version })),
    el('p', {}, t('aPropos.realisation', { auteur: config.auteur })),
    el('p', {},
      t('aPropos.licenceDebut', { auteur: config.auteur }), ' ',
      lienExterne('https://creativecommons.org/licenses/by-nc-nd/4.0/deed.fr', t('aPropos.licenceNom')),
      t('aPropos.licenceFin'), ' ',
      lienLocal('LICENSE', t('aPropos.licenceTexte'))),
    el('p', {}, t('aPropos.confidentialite')),
    el('p', { class: 'texte-doux' }, t('aPropos.tiers'), ' ', lienLocal('licences-tierces.txt', t('aPropos.tiersLien'))),
    el('p', {}, t('aPropos.contact'), ' ', el('a', { href: `mailto:${config.contact}` }, config.contact)),
    el('p', {}, lienExterne(config.siteOmni, t('aPropos.omni'))));
  return ouvrirFenetre({ titre: t('aPropos.titre'), contenu });
}
