// =============================================================================
// accueil.js — l'écran d'accueil et la fenêtre de bienvenue
// -----------------------------------------------------------------------------
// L'accueil propose toujours les mêmes choix, dans le même ordre :
//   Continuer (s'il y a une partie) · Nouvelle partie · Importer une partie
//   · Réglages · Installer le jeu · À propos
//
// Au tout premier lancement, une fenêtre de bienvenue propose de régler le
// confort (taille du texte, son…) avant de jouer.
// =============================================================================

import { modifierReglage, obtenirReglages } from '../noyau/reglages.js';
import { formaterHeure, t, tPluriel } from '../noyau/textes.js';
import { el } from './dom.js';
import { ouvrirFenetre } from './fenetres.js';
import { icone } from './icones.js';

function boutonMenu({ icone: nomIcone, texte, detail, principal, surClic }) {
  return el('li', {}, el('button', {
    class: ['bouton', 'bouton-menu', principal && 'bouton-principal'],
    type: 'button',
    onClick: surClic,
  }, icone(nomIcone), el('span', { class: 'bouton-textes' },
    texte, detail ? el('span', { class: 'bouton-detail' }, detail) : null)));
}

/**
 * Affiche l'accueil dans « parent ». Renvoie l'élément créé.
 *   resume : résumé de la partie enregistrée (ou null)
 *   jeu    : data/jeu.json (nom de la monnaie)
 *   surContinuer, surNouvellePartie, surImporter, surReglages,
 *   surInstaller, surAPropos : les actions des boutons
 *   installe : vrai si le jeu est déjà installé (bouton caché)
 */
export function afficherAccueil(parent, options) {
  const { resume, jeu, installe } = options;
  const config = self.CONFIG_JEU;
  const boutons = [];

  if (resume) {
    boutons.push(boutonMenu({
      icone: 'jouer',
      texte: t('accueil.continuer'),
      detail: `${t('hud.jour', { jour: resume.jour })}, ${formaterHeure(resume.minute)} · ${
        tPluriel('monnaie.montant', resume.argent, { singulier: jeu.monnaie.singulier, pluriel: jeu.monnaie.pluriel })}`,
      principal: true,
      surClic: options.surContinuer,
    }));
  }
  boutons.push(
    boutonMenu({ icone: 'plus', texte: t('accueil.nouvellePartie'), principal: !resume, surClic: options.surNouvellePartie }),
    boutonMenu({ icone: 'importer', texte: t('accueil.importer'), surClic: options.surImporter }),
    boutonMenu({ icone: 'reglages', texte: t('accueil.reglages'), surClic: options.surReglages }),
  );
  if (!installe) {
    boutons.push(boutonMenu({ icone: 'installer', texte: t('accueil.installer'), surClic: options.surInstaller }));
  }
  boutons.push(boutonMenu({ icone: 'info', texte: t('accueil.aPropos'), surClic: options.surAPropos }));

  const element = el('main', { class: 'accueil' },
    el('div', { class: 'accueil-carte' },
      el('img', { class: 'accueil-logo', src: 'assets/icones/icone-192.png', width: 96, height: 96, alt: '' }),
      el('h1', { class: 'titre-jeu' }, config.nom),
      el('p', { class: 'accroche' }, t('accueil.accroche')),
      el('nav', { class: 'menu-accueil', 'aria-label': t('accueil.menu') }, el('ul', {}, boutons)),
      el('p', { class: 'version' }, t('accueil.version', { version: config.version }))));
  parent.append(element);
  return element;
}

// La fenêtre de bienvenue (premier lancement seulement).
export function ouvrirBienvenue({ surReglages }) {
  const sonCoupe = obtenirReglages().sonCoupe;
  const choixSon = [false, true].map((coupe) => el('label', { class: 'option' },
    el('input', {
      class: 'option-entree',
      type: 'radio',
      name: 'bienvenue-son',
      checked: sonCoupe === coupe,
      onChange: () => modifierReglage('sonCoupe', coupe),
    }),
    el('span', { class: 'option-contenu' },
      icone('coche', 'option-coche'), icone(coupe ? 'sonCoupe' : 'son'),
      t(`reglages.sonCoupe.valeurs.${coupe}`))));

  let reglerEnsuite = false;
  return ouvrirFenetre({
    titre: t('bienvenue.titre'),
    contenu: [
      el('p', {}, t('bienvenue.intro')),
      el('p', {}, t('bienvenue.confort')),
      el('fieldset', { class: 'reglage' },
        el('legend', {}, t('bienvenue.son')),
        el('div', { class: 'options' }, choixSon)),
      el('p', { class: 'aide' }, t('bienvenue.plusTard')),
    ],
    boutonFermer: false,
    actions: [
      { texte: t('bienvenue.commencer'), fermer: true },
      { texte: t('bienvenue.regler'), icone: 'reglages', principal: true, fermer: true, surClic: () => { reglerEnsuite = true; } },
    ],
    surFermeture: () => {
      modifierReglage('premierLancementFait', true);
      if (reglerEnsuite) surReglages();
    },
  });
}
