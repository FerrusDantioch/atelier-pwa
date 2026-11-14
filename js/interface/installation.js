// =============================================================================
// installation.js — installer le jeu sur l'appareil
// -----------------------------------------------------------------------------
// Certains navigateurs (Chrome, Edge…) proposent leur propre fenêtre
// d'installation : le bouton « Installer le jeu » l'ouvre directement.
// Ailleurs (Safari sur iPad, Firefox…), on explique comment faire.
// =============================================================================

import { estInstalle, installationPossible, proposerInstallation } from '../noyau/pwa.js';
import { t } from '../noyau/textes.js';
import { el } from './dom.js';
import { ouvrirFenetre } from './fenetres.js';
import { notifier } from './notifications.js';

export function ouvrirAideInstallation() {
  const etapes = ['android', 'ipad', 'ordinateur'].map((appareil) => el('li', { class: 'element-liste' },
    el('div', {},
      el('p', {}, el('strong', {}, t(`installation.${appareil}.titre`))),
      el('p', {}, t(`installation.${appareil}.etapes`)))));
  return ouvrirFenetre({
    titre: t('installation.titre'),
    contenu: [
      el('p', {}, t('installation.intro')),
      el('ul', { class: 'liste-simple' }, etapes),
      el('h3', {}, t('installation.astuceTitre')),
      el('p', {}, t('installation.astuce')),
    ],
  });
}

// « Installer le jeu » : la fenêtre du navigateur si elle existe, sinon l'aide.
export async function installerLeJeu() {
  if (estInstalle()) {
    notifier(t('installation.dejaInstalle'), { type: 'info' });
    return;
  }
  if (installationPossible()) {
    const accepte = await proposerInstallation();
    if (accepte) notifier(t('installation.merci'), { type: 'succes' });
    return;
  }
  ouvrirAideInstallation();
}
