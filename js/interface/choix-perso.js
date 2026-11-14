// =============================================================================
// choix-perso.js — l'écran « Qui veux-tu incarner ? »
// -----------------------------------------------------------------------------
// Au début d'une partie (et à tout moment depuis la Pause) :
//   - jouer Ferrus Dantioch, qui a imaginé le jeu ;
//   - ou créer son personnage : prénom, teint, coiffure, tenue, et une aide
//     à la mobilité facultative (fauteuil roulant, canne), qui ne change rien
//     aux règles du jeu.
// L'aperçu 3D se met à jour à chaque choix. Chaque groupe de choix est une
// vraie liste de boutons radio : utilisable au clavier (flèches) et lue par
// les lecteurs d'écran ; une couleur a toujours son nom écrit à côté.
// =============================================================================

import {
  CHAMPS_COULEUR, LONGUEUR_PRENOM, apparenceAuHasard, apparenceDuJoueur, creerJoueur, nettoyerApparence, nettoyerPrenom,
} from '../jeu/personnage.js';
import { t } from '../noyau/textes.js';
import { el, identifiant } from './dom.js';
import { icone } from './icones.js';
import { direAuxLecteurs } from './notifications.js';

// Les sections de l'éditeur et leurs champs.
const SECTIONS = [
  ['visage', ['teint', 'lunettes']],
  ['cheveux', ['coiffure', 'cheveux', 'barbe']],
  ['silhouette', ['silhouette', 'taille']],
  ['tenue', ['haut', 'motifHaut', 'couleurMotif', 'styleBas', 'bas', 'couvreChef', 'couleurCouvreChef']],
  ['aide', ['aide', 'couleurAide']],
];

const tirer = (liste) => liste[Math.floor(Math.random() * liste.length)];

/**
 * Affiche l'écran dans « parent ».
 *   mode         'creation' (nouvelle partie) ou 'modification' (depuis la Pause)
 *   personnages  data/personnages.json
 *   palette      les couleurs (pour les pastilles)
 *   joueur       le joueur actuel (modification) ou null
 *   studio       l'aperçu 3D (ou null si la 3D est indisponible)
 *   surValider(joueur), surAnnuler()
 */
export function afficherChoixPerso(parent, { mode, personnages, palette, joueur, studio, surValider, surAnnuler }) {
  const ferrus = personnages.ferrus;
  let modele = joueur?.modele || 'perso';
  let apparence = joueur?.modele === 'perso'
    ? nettoyerApparence(joueur.apparence, personnages)
    : nettoyerApparence(personnages.defaut, personnages);
  const prenomDeDepart = joueur?.modele === 'perso' ? joueur.nom : tirer(personnages.prenomsProposes);

  // --- Choix du modèle : Ferrus ou ton personnage -----------------------------------
  const carte = (valeur, titre, texte, note) => el('label', { class: 'carte-modele' },
    el('input', {
      class: 'option-entree',
      type: 'radio',
      name: 'modele',
      value: valeur,
      checked: modele === valeur,
      onChange: () => choisirModele(valeur),
    }),
    el('span', { class: 'carte-modele-contenu' },
      el('span', { class: 'carte-modele-titre' }, icone('coche', 'option-coche'), titre),
      el('span', { class: 'carte-modele-texte' }, texte),
      note ? el('span', { class: 'carte-modele-note' }, note) : null));

  const choixModele = el('fieldset', { class: 'reglage choix-modele' },
    el('legend', { class: 'visuellement-cache' }, t('choixPerso.modeleLegende')),
    el('div', { class: 'cartes-modele' },
      carte('ferrus', ferrus.nomComplet, ferrus.presentation, ferrus.apparenceProvisoire ? t('choixPerso.ferrusProvisoire') : null),
      carte('perso', t('choixPerso.persoTitre'), t('choixPerso.persoTexte'))));

  // --- Prénom --------------------------------------------------------------------------
  const idPrenom = identifiant('prenom');
  const idErreur = identifiant('erreur-prenom');
  const champPrenom = el('input', {
    id: idPrenom,
    class: 'champ-texte',
    type: 'text',
    value: prenomDeDepart,
    maxlength: LONGUEUR_PRENOM,
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-describedby': idErreur,
    onInput: () => { erreurPrenom.textContent = ''; },
  });
  const erreurPrenom = el('p', { class: 'erreur-champ', id: idErreur, 'aria-live': 'polite' });
  const blocPrenom = el('div', { class: 'reglage' },
    el('label', { class: 'reglage-titre', for: idPrenom }, t('choixPerso.prenom')),
    el('div', { class: 'rangee-champ' },
      champPrenom,
      el('button', {
        class: 'bouton',
        type: 'button',
        onClick: () => {
          const autres = personnages.prenomsProposes.filter((p) => p !== champPrenom.value);
          champPrenom.value = tirer(autres.length ? autres : personnages.prenomsProposes);
          erreurPrenom.textContent = '';
          direAuxLecteurs(t('choixPerso.prenomPropose', { prenom: champPrenom.value }));
        },
      }, icone('hasard'), t('choixPerso.autrePrenom'))),
    erreurPrenom);

  // --- Groupes d'options -------------------------------------------------------------
  const groupes = new Map();
  function groupeDOptions(champ) {
    const nom = `perso-${champ}`;
    const options = personnages.options[champ].map((option) => {
      const entree = el('input', {
        class: 'option-entree',
        type: 'radio',
        name: nom,
        value: option.id,
        checked: apparence[champ] === option.id,
        onChange: () => changer(champ, option.id),
      });
      let pastille = null;
      if (CHAMPS_COULEUR.includes(champ)) {
        pastille = el('span', { class: 'pastille', 'aria-hidden': 'true' });
        pastille.style.backgroundColor = palette.texte(option.couleur);
      }
      return el('label', { class: 'option' }, entree,
        el('span', { class: 'option-contenu' }, icone('coche', 'option-coche'), pastille, option.nom));
    });
    const groupe = el('fieldset', { class: 'reglage' },
      el('legend', {}, t(`choixPerso.champs.${champ}`)),
      el('div', { class: 'options' }, options));
    groupes.set(champ, groupe);
    return groupe;
  }

  const sections = SECTIONS.map(([section, champs]) => el('section', { class: 'section-reglages' },
    el('h2', {}, t(`choixPerso.sections.${section}`)),
    section === 'aide' ? el('p', { class: 'aide' }, t('choixPerso.aideMobilite')) : null,
    champs.map(groupeDOptions)));

  const boutonHasard = el('button', {
    class: 'bouton',
    type: 'button',
    onClick: () => {
      apparence = apparenceAuHasard(personnages, tirer, apparence);
      for (const [champ, groupe] of groupes) {
        for (const entree of groupe.querySelectorAll('input')) entree.checked = entree.value === apparence[champ];
      }
      actualiser();
      direAuxLecteurs(t('choixPerso.hasardFait'));
    },
  }, icone('hasard'), t('choixPerso.toutAuHasard'));

  const editeur = el('div', { class: 'editeur-perso' },
    blocPrenom,
    el('p', { class: 'rangee-boutons' }, boutonHasard),
    sections);

  // --- Boutons du bas ---------------------------------------------------------------
  const creation = mode === 'creation';
  const boutonValider = el('button', {
    class: 'bouton bouton-principal',
    type: 'button',
    onClick: valider,
  }, icone(creation ? 'jouer' : 'coche'), t(creation ? 'choixPerso.commencer' : 'choixPerso.enregistrer'));
  const boutonRetour = el('button', {
    class: 'bouton',
    type: 'button',
    onClick: () => surAnnuler(),
  }, icone('retour'), t(creation ? 'choixPerso.retour' : 'commun.annuler'));

  const titre = el('h1', { tabindex: '-1' }, t(creation ? 'choixPerso.titre' : 'choixPerso.titreModification'));
  const panneau = el('section', { class: 'perso-panneau', 'aria-labelledby': 'titre-perso' },
    el('div', { class: 'perso-defilement' },
      titre,
      el('p', { class: 'aide' }, t('choixPerso.intro')),
      choixModele,
      editeur),
    el('div', { class: 'perso-actions' }, boutonRetour, boutonValider));
  titre.id = 'titre-perso';

  const apercu = el('div', { class: 'perso-apercu' });
  const tourner = el('div', { class: 'perso-tourner', role: 'group', 'aria-label': t('choixPerso.tournerApercu') },
    el('button', {
      class: 'bouton bouton-icone bouton-camera',
      type: 'button',
      'aria-label': t('choixPerso.tournerGauche'),
      title: t('choixPerso.tournerGauche'),
      onClick: () => studio?.tourner(-1),
    }, icone('tournerGauche')),
    el('button', {
      class: 'bouton bouton-icone bouton-camera',
      type: 'button',
      'aria-label': t('choixPerso.tournerDroite'),
      title: t('choixPerso.tournerDroite'),
      onClick: () => studio?.tourner(1),
    }, icone('tournerDroite')));

  const element = el('div', { class: ['ecran-perso', !studio && 'sans-apercu'] }, apercu, panneau, studio ? tourner : null);

  // --- Comportement -------------------------------------------------------------
  function apparenceAffichee() {
    return modele === 'ferrus' ? apparenceDuJoueur({ modele: 'ferrus' }, personnages) : apparence;
  }

  // Les couleurs qui n'ont pas de sens sont masquées (couleur des cheveux
  // sans cheveux, couleur d'une aide absente…).
  function actualiser() {
    groupes.get('cheveux').hidden = apparence.coiffure === 'aucune' && apparence.barbe === 'aucune';
    groupes.get('couleurCouvreChef').hidden = apparence.couvreChef === 'aucun';
    groupes.get('couleurMotif').hidden = apparence.motifHaut === 'uni';
    groupes.get('couleurAide').hidden = apparence.aide === 'aucune';
    editeur.hidden = modele !== 'perso';
    studio?.montrer(apparenceAffichee());
  }

  function changer(champ, valeur) {
    apparence = { ...apparence, [champ]: valeur };
    actualiser();
  }

  function choisirModele(valeur) {
    modele = valeur;
    actualiser();
  }

  function valider() {
    const nom = nettoyerPrenom(champPrenom.value);
    if (modele === 'perso' && !nom) {
      erreurPrenom.textContent = t('choixPerso.prenomVide');
      champPrenom.focus();
      return;
    }
    surValider(creerJoueur({ modele, nom, apparence }, personnages, joueur?.position ?? null));
  }

  function placerApercu() {
    if (!studio) return;
    const rect = apercu.getBoundingClientRect();
    studio.definirZone({ gauche: rect.left, haut: rect.top, largeur: rect.width, hauteur: rect.height });
  }

  function surTouche(evenement) {
    if (evenement.key === 'Escape' && !creation && !document.querySelector('dialog[open]')) {
      evenement.preventDefault();
      surAnnuler();
    }
  }

  parent.append(element);
  const observateur = new ResizeObserver(placerApercu);
  observateur.observe(apercu);
  document.addEventListener('keydown', surTouche);
  studio?.activer();
  actualiser();
  placerApercu();
  titre.focus();

  return {
    element,
    detruire() {
      observateur.disconnect();
      document.removeEventListener('keydown', surTouche);
      element.remove();
    },
  };
}
