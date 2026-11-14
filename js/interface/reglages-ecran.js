// =============================================================================
// reglages-ecran.js — la fenêtre « Réglages »
// -----------------------------------------------------------------------------
// Accessible dès le premier lancement (accueil) et à tout moment (Pause).
// Chaque changement s'applique tout de suite : on voit le résultat avant de
// fermer. Les choix sont de grands boutons ; le choix actif est marqué par
// une coche, une bordure épaisse et du gras (pas seulement par la couleur).
// =============================================================================

import { jouerEssai } from '../noyau/audio.js';
import { CANAUX_SON, CHOIX, modifierReglage, obtenirReglages, retablirReglages } from '../noyau/reglages.js';
import { existe, t } from '../noyau/textes.js';
import { el, identifiant } from './dom.js';
import { confirmer, ouvrirFenetre } from './fenetres.js';
import { icone } from './icones.js';
import { notifier } from './notifications.js';

// Classe d'aperçu : chaque police est montrée dans son propre style.
const APERCUS_POLICE = { lisible: 'apercu-lisible', dyslexie: 'apercu-dyslexie', systeme: 'apercu-systeme' };

// Un groupe de choix (boutons radio dessinés comme de grands boutons).
function groupeDeChoix(nom, { surChangement } = {}) {
  const reglages = obtenirReglages();
  const idAide = identifiant('aide');
  const aEuneAide = existe(`reglages.${nom}.aide`);
  const options = CHOIX[nom].map((valeur) => {
    const entree = el('input', {
      class: 'option-entree',
      type: 'radio',
      name: `reglage-${nom}`,
      value: String(valeur),
      checked: reglages[nom] === valeur,
      onChange: () => {
        modifierReglage(nom, valeur);
        surChangement?.(valeur);
      },
    });
    return el('label', { class: 'option' },
      entree,
      el('span', { class: ['option-contenu', nom === 'police' && APERCUS_POLICE[valeur]] },
        icone('coche', 'option-coche'),
        t(`reglages.${nom}.valeurs.${valeur}`)));
  });
  return el('fieldset', { class: 'reglage', 'aria-describedby': aEuneAide ? idAide : null },
    el('legend', {}, t(`reglages.${nom}.titre`)),
    aEuneAide ? el('p', { class: 'aide', id: idAide }, t(`reglages.${nom}.aide`)) : null,
    el('div', { class: 'options' }, options));
}

// Un curseur de volume, avec son bouton « Écouter ».
function curseurDeVolume(canal) {
  const reglages = obtenirReglages();
  const id = identifiant(`volume-${canal}`);
  const texteValeur = (valeur) => t('reglages.volumes.valeur', { n: valeur });
  const sortie = el('output', { for: id }, texteValeur(reglages.volumes[canal]));
  const curseur = el('input', {
    id,
    type: 'range',
    min: 0,
    max: 100,
    step: 10,
    value: reglages.volumes[canal],
    'aria-valuetext': texteValeur(reglages.volumes[canal]),
    onInput: (evenement) => {
      const valeur = Number(evenement.target.value);
      sortie.textContent = texteValeur(valeur);
      evenement.target.setAttribute('aria-valuetext', texteValeur(valeur));
      modifierReglage('volumes', { [canal]: valeur });
    },
  });
  const ecouter = el('button', {
    class: 'bouton',
    type: 'button',
    'aria-label': t('reglages.volumes.ecouterCanal', { canal: t(`reglages.volumes.${canal}`) }),
    onClick: () => {
      const resultat = jouerEssai(canal);
      if (resultat !== 'ok') notifier(t(`reglages.essai.${resultat}`), { type: 'attention' });
    },
  }, icone('son'), t('reglages.volumes.ecouter'));
  return el('div', { class: 'curseur' },
    el('label', { for: id }, t(`reglages.volumes.${canal}`)),
    curseur, sortie, ecouter);
}

function section(nom, contenu) {
  return el('section', { class: 'section-reglages' },
    el('h3', {}, t(`reglages.sections.${nom}`)), contenu);
}

// « Rétablir les réglages par défaut » : à la fin du contenu (action rare,
// pas besoin qu'elle prenne de la place en permanence en bas de la fenêtre).
function boutonRetablir(surRetablis) {
  return el('button', {
    class: 'bouton',
    type: 'button',
    onClick: async () => {
      const accord = await confirmer({
        titre: t('reglages.retablir.titre'),
        message: t('reglages.retablir.message'),
        oui: t('reglages.retablir.oui'),
      });
      if (!accord) return;
      retablirReglages();
      surRetablis();
      notifier(t('reglages.retablir.fait'), { type: 'succes' });
    },
  }, icone('recharger'), t('reglages.retablir.bouton'));
}

function contenuReglages({ surRetablis }) {
  const noteSonCoupe = el('div', { class: 'encadre encadre-info', hidden: !obtenirReglages().sonCoupe },
    icone('sonCoupe'), el('p', {}, t('reglages.volumes.noteCoupe')));

  return [
    el('p', { class: 'aide' }, t('reglages.intro')),
    section('affichage', [
      groupeDeChoix('texte'),
      groupeDeChoix('theme'),
      groupeDeChoix('contraste'),
      groupeDeChoix('police'),
      groupeDeChoix('espacement'),
    ]),
    section('mouvement', [
      groupeDeChoix('animations'),
      groupeDeChoix('modeCalme'),
    ]),
    section('scene', [
      groupeDeChoix('luminosite'),
      groupeDeChoix('qualite'),
    ]),
    section('son', [
      groupeDeChoix('sonCoupe', { surChangement: (coupe) => { noteSonCoupe.hidden = !coupe; } }),
      el('div', { class: 'reglage' },
        el('p', { class: 'reglage-titre' }, t('reglages.volumes.titre')),
        el('p', { class: 'aide' }, t('reglages.volumes.aide')),
        noteSonCoupe,
        CANAUX_SON.map(curseurDeVolume)),
    ]),
    section('couleurs', [groupeDeChoix('daltonisme')]),
    section('retablir', [el('p', { class: 'aide' }, t('reglages.retablir.aide')), boutonRetablir(surRetablis)]),
  ];
}

export function ouvrirReglages() {
  let fenetre = null;
  fenetre = ouvrirFenetre({
    titre: t('reglages.titre'),
    // Après « Rétablir », on rouvre la fenêtre pour montrer les nouvelles valeurs.
    contenu: contenuReglages({ surRetablis: () => { fenetre.fermer(); ouvrirReglages(); } }),
    large: true,
  });
  return fenetre;
}
