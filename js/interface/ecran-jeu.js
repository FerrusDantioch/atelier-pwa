// =============================================================================
// ecran-jeu.js — l'écran de jeu : la 3D, les barres fixes et le menu Pause
// -----------------------------------------------------------------------------
// Toujours les mêmes informations aux mêmes places :
//   en haut   : l'argent, la réputation, l'objectif actif, le jour et
//               l'heure, le bouton Pause ;
//   en bas    : « Aller à… », l'action du moment (« Examiner le lit »),
//               la pièce où l'on se trouve ;
//   à droite  : la caméra (tourner, zoomer, recentrer).
// Entre les barres : la scène 3D. On y touche le sol pour se déplacer, ou
// un meuble pour s'en approcher. Tout ce que montre la 3D a un équivalent
// ici (liste « Aller à… », bulle « Examiner », annonces pour les lecteurs
// d'écran) : le jeu se joue sans voir la scène.
//
// Si l'écran est étroit ou le texte très grand, la barre du haut passe en
// version « compacte » (libellés raccourcis) plutôt que de prendre la moitié
// de l'écran.
// =============================================================================

import { ecouter } from '../noyau/evenements.js';
import { niveauDeReputation } from '../noyau/format-sauvegarde.js';
import { modifierPartie, partieEnCours } from '../noyau/etat.js';
import { clesDuGroupe, formaterHeure, formaterNombre, t, tPluriel } from '../noyau/textes.js';
import { el } from './dom.js';
import { fenetreOuverte, ouvrirFenetre } from './fenetres.js';
import { icone } from './icones.js';
import { direAuxLecteurs, notifier } from './notifications.js';

// Le monde 3D affiché (pour les tests automatiques et la fenêtre « Aller à… »).
let mondeActuel = null;
export function mondeAffiche() {
  return mondeActuel;
}

// Première lettre en majuscule (« le lit » → « Le lit »).
const majuscule = (texte) => (texte ? texte[0].toLocaleUpperCase('fr-FR') + texte.slice(1) : texte);

function indicateur(nomIcone, libelle) {
  const valeur = el('span', { class: 'libelle-long' });
  const court = el('span', { class: 'libelle-court', 'aria-hidden': 'true' });
  const element = el('span', { class: 'indicateur' },
    icone(nomIcone), el('span', { class: 'visuellement-cache' }, libelle), valeur, court);
  return { element, valeur, court };
}

function boutonCamera(nomIcone, libelle, raccourci, surClic) {
  const nom = raccourci ? `${libelle} (${raccourci})` : libelle;
  return el('button', {
    class: 'bouton bouton-icone bouton-camera',
    type: 'button',
    'aria-label': nom,
    title: nom,
    onClick: surClic,
  }, icone(nomIcone));
}

/**
 * Affiche l'écran de jeu dans « parent ».
 *   jeu           data/jeu.json
 *   creerMonde    fabrique le monde 3D : creerMonde(rappels) → monde
 *   menu          { surReglages, surSauvegarde, surAPropos, surAccueil, surPersonnage }
 * Renvoie { element, monde, detruire() }.
 */
export function afficherEcranJeu(parent, { jeu, creerMonde, menu }) {
  // --- Barre du haut ---------------------------------------------------------------
  const argent = indicateur('piece', t('hud.argent'));
  const reputation = indicateur('etoile', t('hud.reputation'));
  const moment = indicateur('horloge', t('hud.moment'));

  const objectif = el('button', {
    class: 'bouton bouton-discret objectif',
    type: 'button',
    onClick: () => notifier(t('hud.journalBientot'), { type: 'info' }),
  }, icone('cible'), el('span', { class: 'objectif-texte' }, el('strong', {}, `${t('hud.objectif')} `), t('hud.aucunObjectif')));

  const boutonPause = el('button', {
    class: 'bouton bouton-pause',
    type: 'button',
    'aria-label': t('hud.pause'),
    onClick: () => ouvrirMenuPause(menu),
  }, icone('pause'), el('span', { class: 'libelle-pause', 'aria-hidden': 'true' }, t('hud.pause')));

  const barre = el('header', { class: 'barre-haut' },
    el('div', { class: 'barre-zone barre-gauche' }, argent.element, reputation.element),
    el('div', { class: 'barre-zone barre-centre' }, objectif),
    el('div', { class: 'barre-zone barre-droite' }, moment.element, boutonPause));

  // --- Bulle « Examiner » -------------------------------------------------------------
  const bulleTitre = el('h2', { class: 'bulle-titre', id: 'bulle-titre' });
  const bulleTexte = el('p', { class: 'bulle-texte' });
  const bulle = el('section', { class: 'bulle', 'aria-labelledby': 'bulle-titre', hidden: true },
    el('div', { class: 'bulle-contenu' }, bulleTitre, bulleTexte),
    el('button', {
      class: 'bouton bouton-icone',
      type: 'button',
      'aria-label': t('commun.fermer'),
      title: t('commun.fermer'),
      onClick: () => fermerBulle({ rendreFocus: true }),
    }, icone('fermer')));

  // --- Barre du bas -------------------------------------------------------------------
  const boutonAllerA = el('button', {
    class: 'bouton',
    type: 'button',
    onClick: () => ouvrirAllerA(),
  }, icone('allerA'), t('jeu.allerA'));

  const texteAction = el('span', {});
  const boutonAction = el('button', {
    class: 'bouton bouton-principal bouton-action',
    type: 'button',
    hidden: true,
    onClick: () => examiner(),
  }, icone('examiner'), texteAction, el('kbd', { class: 'raccourci', 'aria-hidden': 'true' }, t('jeu.toucheAgir')));

  const texteLieu = el('span', {});
  const lieuActuel = el('p', { class: 'lieu-actuel' },
    icone('lieu'), el('span', { class: 'visuellement-cache' }, t('jeu.lieuActuel')), texteLieu);

  const barreBas = el('footer', { class: 'barre-bas' },
    el('div', { class: 'barre-zone' }, boutonAllerA, boutonAction),
    lieuActuel);

  const camera = el('div', { class: 'commandes-camera', role: 'group', 'aria-label': t('jeu.camera.titre') },
    boutonCamera('tournerGauche', t('jeu.camera.tournerGauche'), t('jeu.camera.toucheGauche'), () => mondeActuel?.tourner(-1)),
    boutonCamera('tournerDroite', t('jeu.camera.tournerDroite'), t('jeu.camera.toucheDroite'), () => mondeActuel?.tourner(1)),
    boutonCamera('zoomMoins', t('jeu.camera.eloigner'), '−', () => mondeActuel?.zoomer(0.8)),
    boutonCamera('zoomPlus', t('jeu.camera.rapprocher'), '+', () => mondeActuel?.zoomer(1.25)),
    boutonCamera('recentrer', t('jeu.camera.recentrer'), t('jeu.camera.toucheRecentrer'), () => mondeActuel?.recentrer()));

  const element = el('div', { class: 'ecran-jeu' },
    el('h1', { class: 'visuellement-cache' }, self.CONFIG_JEU.nom),
    barre,
    el('main', { class: 'zone-monde', 'aria-label': t('jeu.zoneMonde') }, bulle),
    camera,
    barreBas);

  // --- Le monde 3D -------------------------------------------------------------------
  let objetProche = null;
  let ecranActif = true;

  function fermerBulle({ rendreFocus = false } = {}) {
    if (bulle.hidden) return;
    bulle.hidden = true;
    element.classList.remove('bulle-ouverte');
    if (rendreFocus && !boutonAction.hidden) boutonAction.focus();
  }

  function examiner() {
    const infos = mondeActuel?.examiner();
    if (!infos) {
      direAuxLecteurs(t('jeu.rienAProximite'));
      return;
    }
    bulleTitre.textContent = infos.nom;
    bulleTexte.textContent = infos.description || '';
    bulle.hidden = false;
    element.classList.add('bulle-ouverte');
    direAuxLecteurs(`${infos.nom}. ${infos.description || ''}`);
  }

  const rappels = {
    actif: () => ecranActif && !fenetreOuverte(),
    surPiece(piece) {
      texteLieu.textContent = piece.nom;
      direAuxLecteurs(t('jeu.dansPiece', { piece: piece.designation }));
    },
    surObjetProche(infos) {
      objetProche = infos;
      if (infos) {
        texteAction.textContent = t('jeu.examiner', { objet: infos.designation });
        boutonAction.hidden = false;
      } else {
        if (boutonAction === document.activeElement) boutonAction.blur();
        boutonAction.hidden = true;
        fermerBulle();
      }
    },
    surArrivee(infos) {
      if (infos) direAuxLecteurs(t('jeu.arriveDevant', { objet: infos.designation }));
    },
    surPosition(position) {
      modifierPartie((partie) => {
        if (partie.joueur) partie.joueur.position = position;
      });
    },
    surVue(vue) {
      modifierPartie((partie) => { partie.vue = vue; });
    },
    surBloque(infos) {
      notifier(t('jeu.inaccessible', { objet: infos.designation }), { type: 'attention' });
    },
    surAgir() {
      if (objetProche) examiner();
      else direAuxLecteurs(t('jeu.rienAProximite'));
    },
  };

  parent.append(element);
  mondeActuel = creerMonde(rappels);
  const piece = mondeActuel.piece;
  texteLieu.textContent = piece ? piece.nom : '';

  // --- La fenêtre « Aller à… » ----------------------------------------------------
  function ouvrirAllerA() {
    const destinations = mondeActuel.destinations();
    const pieces = destinations.filter((d) => d.type === 'piece');
    const ici = mondeActuel.piece?.id;
    let fenetre = null;
    const aller = (destination) => {
      fenetre.fermer();
      fermerBulle();
      if (mondeActuel.allerVers(destination)) {
        direAuxLecteurs(t('jeu.enRoute', { destination: destination.designation }));
      }
    };
    const contenu = pieces.map((piece) => {
      const objets = destinations.filter((d) => d.type !== 'piece' && d.piece === piece.id);
      return el('section', { class: 'groupe-destinations' },
        el('h3', {}, piece.nom, piece.id === ici ? el('span', { class: 'etiquette' }, t('jeu.tuEsIci')) : null),
        el('ul', { class: 'liste-destinations' },
          el('li', {}, el('button', { class: 'bouton', type: 'button', onClick: () => aller(piece) },
            icone('lieu'), t('jeu.allerDans', { piece: piece.designation }))),
          objets.map((objet) => el('li', {}, el('button', { class: 'bouton', type: 'button', onClick: () => aller(objet) },
            icone('allerA'), objet.nom)))));
    });
    fenetre = ouvrirFenetre({
      titre: t('jeu.allerATitre'),
      contenu: [el('p', { class: 'aide' }, t('jeu.allerAAide')), ...contenu],
      large: true,
    });
  }

  // --- Mise à jour de la barre du haut -----------------------------------------------
  function rafraichir() {
    const partie = partieEnCours();
    if (!partie) return;
    argent.valeur.textContent = tPluriel('monnaie.montant', partie.argent, {
      singulier: jeu.monnaie.singulier, pluriel: jeu.monnaie.pluriel,
    });
    argent.court.textContent = formaterNombre(partie.argent);
    const niveau = niveauDeReputation(partie.reputation, jeu.reputation.paliers);
    reputation.valeur.textContent = t('hud.niveau', { niveau: niveau.niveau, nom: niveau.nom });
    reputation.court.textContent = t('hud.niveauCourt', { niveau: niveau.niveau });
    const heure = formaterHeure(partie.temps.minute);
    moment.valeur.textContent = `${t('hud.jour', { jour: partie.temps.jour })} · ${heure}`;
    moment.court.textContent = `${t('hud.jourCourt', { jour: partie.temps.jour })} · ${heure}`;
    adapterBarres();
  }

  // Barre compacte si elle prend plus d'une ligne ; la caméra évite les barres.
  function adapterBarres() {
    barre.classList.remove('compacte');
    barreBas.classList.remove('compacte');
    const hauteurLigne = boutonPause.offsetHeight || 48;
    if (barre.offsetHeight > hauteurLigne * 1.9) barre.classList.add('compacte');
    if (barreBas.offsetHeight > (boutonAllerA.offsetHeight || 48) * 1.9) barreBas.classList.add('compacte');
    const marges = { haut: barre.offsetHeight, bas: barreBas.offsetHeight, gauche: 0, droite: 0 };
    document.documentElement.style.setProperty('--hauteur-barre-haut', `${marges.haut}px`);
    document.documentElement.style.setProperty('--hauteur-barre-bas', `${marges.bas}px`);
    mondeActuel?.definirMarges(marges);
  }
  const observateur = new ResizeObserver(() => adapterBarres());
  observateur.observe(element);

  // Échap : ferme d'abord la bulle, sinon ouvre le menu Pause.
  function surTouche(evenement) {
    if (evenement.key !== 'Escape' || fenetreOuverte() || !ecranActif) return;
    evenement.preventDefault();
    if (!bulle.hidden) fermerBulle({ rendreFocus: true });
    else ouvrirMenuPause(menu);
  }

  const arrets = [
    ecouter('partie:modifiee', rafraichir),
    ecouter('partie:chargee', rafraichir),
    ecouter('reglages:modifies', ({ reglages }) => {
      mondeActuel?.appliquerReglages(reglages);
      // La taille du texte change la hauteur des barres.
      requestAnimationFrame(adapterBarres);
    }),
  ];
  document.addEventListener('keydown', surTouche);
  document.body.classList.add('en-jeu');
  rafraichir();

  return {
    element,
    get monde() { return mondeActuel; },
    // Cache l'écran (pendant l'écran « Ton personnage ») ou le remontre.
    suspendre(oui) {
      ecranActif = !oui;
      element.hidden = oui;
      document.body.classList.toggle('en-jeu', !oui);
      mondeActuel?.activer(!oui);
      if (!oui) requestAnimationFrame(adapterBarres);
    },
    detruire() {
      arrets.forEach((arreter) => arreter());
      observateur.disconnect();
      document.removeEventListener('keydown', surTouche);
      document.body.classList.remove('en-jeu');
      mondeActuel?.liberer();
      mondeActuel = null;
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
