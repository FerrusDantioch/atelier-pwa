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

import { commandesAProposer, objectifDuMoment, proposerCommande } from '../jeu/commandes.js';
import { VITESSES, avancerHorloge, bornesDeLaJournee, lendemain } from '../jeu/temps.js';
import { ecouter } from '../noyau/evenements.js';
import { heureEnMinutes, niveauDeReputation } from '../noyau/format-sauvegarde.js';
import { modifierPartie, partieEnCours } from '../noyau/etat.js';
import { obtenirReglages } from '../noyau/reglages.js';
import { creerCopieDeSecours } from '../noyau/sauvegarde.js';
import { clesDuGroupe, formaterHeure, formaterNombre, t, tPluriel, typographier } from '../noyau/textes.js';
import { ouvrirDialogue } from './dialogue.js';
import { el } from './dom.js';
import { confirmer, fenetreOuverte, ouvrirFenetre } from './fenetres.js';
import { icone } from './icones.js';
import { direAuxLecteurs, notifier } from './notifications.js';
import { ouvrirOrdinateur } from './ordinateur.js';

// Le monde 3D affiché (pour les tests automatiques et la fenêtre « Aller à… »).
let mondeActuel = null;
export function mondeAffiche() {
  return mondeActuel;
}

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
 *   donnees       toutes les données (commandes, personnages…)
 *   portrait      (apparence, taille) → toile 2D : les portraits de la visio
 *   creerMonde    fabrique le monde 3D : creerMonde(rappels) → monde
 *   menu          { surReglages, surSauvegarde, surAPropos, surAccueil, surPersonnage }
 * Renvoie { element, monde, detruire() }.
 */
export function afficherEcranJeu(parent, { jeu, donnees, portrait = null, creerMonde, menu }) {
  // --- Barre du haut ---------------------------------------------------------------
  const argent = indicateur('piece', t('hud.argent'));
  const reputation = indicateur('etoile', t('hud.reputation'));
  const moment = indicateur('horloge', t('hud.moment'));

  // L'objectif du moment (en attendant le journal des quêtes) : le toucher
  // mène à l'endroit où il se joue (le bureau).
  const texteObjectif = el('span', {}, t('hud.aucunObjectif'));
  let objectifActuel = null;
  const objectif = el('button', {
    class: 'bouton bouton-discret objectif',
    type: 'button',
    onClick: () => allerVersObjectif(),
  }, icone('cible'), el('span', { class: 'objectif-texte' }, el('strong', {}, `${t('hud.objectif')} `), texteObjectif));

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

  // L'action du moment : « Examiner le lit » ou « Parler à Halaé » (Entrée),
  // et parfois une action en plus (« Dormir » près du lit).
  const texteAction = el('span', {});
  const iconeAction = el('span', { class: 'icone-action' }, icone('examiner'));
  const boutonAction = el('button', {
    class: 'bouton bouton-principal bouton-action',
    type: 'button',
    hidden: true,
    onClick: () => agir(),
  }, iconeAction, texteAction, el('kbd', { class: 'raccourci', 'aria-hidden': 'true' }, t('jeu.toucheAgir')));
  const boutonDormir = el('button', {
    class: 'bouton',
    type: 'button',
    hidden: true,
    onClick: () => dormir(),
  }, icone('lune'), t('actions.dormir'));
  const boutonOrdinateur = el('button', {
    class: 'bouton',
    type: 'button',
    hidden: true,
    onClick: () => utiliserOrdinateur(),
  }, icone('ordinateur'), t('actions.ordinateur'));

  const texteLieu = el('span', {});
  const lieuActuel = el('p', { class: 'lieu-actuel' },
    icone('lieu'), el('span', { class: 'visuellement-cache' }, t('jeu.lieuActuel')), texteLieu);

  const barreBas = el('footer', { class: 'barre-bas' },
    el('div', { class: 'barre-zone' }, boutonAllerA, boutonAction, boutonDormir, boutonOrdinateur),
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
    const description = typographier(infos.description || '');
    bulleTitre.textContent = infos.nom;
    bulleTexte.textContent = description;
    bulle.hidden = false;
    element.classList.add('bulle-ouverte');
    direAuxLecteurs(`${infos.nom}. ${description}`);
  }

  // Parler à un personnage : il s'arrête, la fenêtre de dialogue s'ouvre (et
  // le temps s'arrête tant qu'elle est ouverte).
  function parler(id) {
    const infos = mondeActuel?.parler(id);
    if (!infos) return;
    fermerBulle();
    // A-t-elle une commande à présenter de vive voix (Halaé) ?
    const partie = partieEnCours();
    const commande = donnees && partie
      ? commandesAProposer(partie, donnees.commandes.commandes, jeu.reputation.paliers).find((c) => c.client === id)
      : null;
    const demande = commande ? {
      commande,
      surProposee: () => {
        modifierPartie((p) => proposerCommande(p, commande), { important: true });
        notifier(t('livraison.nouvelle', { client: infos.nom, titre: commande.titre }), { type: 'info' });
      },
    } : null;
    ouvrirDialogue({ infos, pnj: infos.pnj, creneau: infos.creneau, demande, surFermeture: () => mondeActuel?.finParler(id) });
  }

  function agir() {
    if (objetProche?.type === 'pnj') parler(objetProche.id);
    else examiner();
  }

  // L'ordinateur du bureau : commandes, atelier de création, visio, comptes.
  function utiliserOrdinateur() {
    fermerBulle();
    ouvrirOrdinateur({ donnees, portrait });
  }

  // Toucher l'objectif : on part vers l'endroit où il se joue.
  function allerVersObjectif() {
    const destination = objectifActuel?.destination
      ? mondeActuel?.destinations().find((d) => d.id === objectifActuel.destination)
      : null;
    if (!destination) {
      notifier(t('hud.journalBientot'), { type: 'info' });
      return;
    }
    fermerBulle();
    if (mondeActuel.allerVers(destination)) direAuxLecteurs(t('jeu.enRoute', { destination: destination.designation }));
  }

  // Dormir : la journée suivante commence au matin (avec une copie de
  // secours de la partie, comme à chaque nouveau jour).
  async function dormir() {
    const accord = await confirmer({
      titre: t('temps.dormirTitre'),
      message: [
        t('temps.dormirMessage', { heure: formaterHeure(heureEnMinutes(jeu.temps.debutJournee)) }),
        t('temps.dormirCopie'),
      ],
      oui: t('temps.dormirOui'),
    });
    if (!accord || !partieEnCours()) return;
    fermerBulle();
    await creerCopieDeSecours(partieEnCours(), 'nouveau-jour');
    modifierPartie((partie) => { partie.temps = lendemain(partie.temps, jeu.temps); }, { important: true });
    horloge.reste = 0;
    horloge.tardAnnonce = false;
    const temps = partieEnCours().temps;
    mondeActuel?.nouvelleJournee(temps.minute);
    notifier(t('temps.bonjour', { jour: temps.jour }), { type: 'succes' });
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
        const personne = infos.type === 'pnj';
        texteAction.textContent = personne ? t('dialogue.parler', { nom: infos.nom }) : t('jeu.examiner', { objet: infos.designation });
        iconeAction.replaceChildren(icone(personne ? 'parler' : 'examiner'));
        boutonAction.hidden = false;
        boutonDormir.hidden = !infos.actions?.includes('dormir');
        boutonOrdinateur.hidden = !infos.actions?.includes('ordinateur');
      } else {
        for (const bouton of [boutonAction, boutonDormir, boutonOrdinateur]) {
          if (bouton === document.activeElement) bouton.blur();
          bouton.hidden = true;
        }
        fermerBulle();
      }
    },
    surVisite(evenement) {
      direAuxLecteurs(t(evenement.type === 'arrive' ? 'pnj.arrive' : 'pnj.part', { nom: evenement.nom }));
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
      if (objetProche) agir();
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
    fenetre = ouvrirFenetre({
      titre: t('jeu.allerATitre'),
      contenu: [el('p', { class: 'aide' }, t('jeu.allerAAide')), ...contenu],
      large: true,
    });
  }

  // --- L'horloge ---------------------------------------------------------------------
  // Le temps passe pendant qu'on joue ; il s'arrête dès qu'une fenêtre est
  // ouverte (Pause, dialogue…), quand le jeu est en arrière-plan, et à la fin
  // de la journée (rien ne presse : on va dormir quand on veut).
  const { fin } = bornesDeLaJournee(jeu.temps);
  const horloge = { reste: 0, derniereMesure: performance.now(), tardAnnonce: false, minuteur: null };
  function tic() {
    const maintenant = performance.now();
    const secondes = Math.min(1, (maintenant - horloge.derniereMesure) / 1000);
    horloge.derniereMesure = maintenant;
    const partie = partieEnCours();
    if (!partie || !ecranActif || fenetreOuverte() || document.hidden) return;
    const vitesse = (VITESSES[obtenirReglages().vitesseTemps] ?? 1) * jeu.temps.minutesParSeconde;
    const resultat = avancerHorloge({ minute: partie.temps.minute, reste: horloge.reste, secondes, vitesse, fin });
    horloge.reste = resultat.reste;
    if (resultat.minute !== partie.temps.minute) {
      modifierPartie((p) => { p.temps.minute = resultat.minute; });
      mondeActuel?.definirHeure(resultat.minute);
    }
    if (resultat.finAtteinte && !horloge.tardAnnonce) {
      horloge.tardAnnonce = true;
      notifier(t('temps.tard'), { type: 'info' });
    }
  }
  horloge.minuteur = setInterval(tic, 250);

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
    // L'objectif du moment.
    objectifActuel = donnees ? objectifDuMoment(partie, donnees.commandes.commandes, jeu.reputation.paliers) : null;
    const nomClient = (id) => {
      const pnj = donnees.pnj.pnj.find((p) => p.id === id);
      return pnj?.modele === 'ferrus' ? donnees.personnages.ferrus.nom : pnj?.nom || '';
    };
    texteObjectif.textContent = objectifActuel
      ? t(`objectifs.${objectifActuel.cle}`, { client: objectifActuel.commande ? nomClient(objectifActuel.commande.client) : '' })
      : t('hud.aucunObjectif');
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
      clearInterval(horloge.minuteur);
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
