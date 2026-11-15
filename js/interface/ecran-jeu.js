// =============================================================================
// ecran-jeu.js — l'écran de jeu : la 3D, les barres fixes et le menu Pause
// -----------------------------------------------------------------------------
// Toujours les mêmes informations aux mêmes places :
//   en haut   : l'argent, la réputation, l'objectif actif, le jour et
//               l'heure, le bouton Pause ;
//   en bas    : le journal des quêtes (J), « Aller à… », l'action du
//               moment (« Examiner le lit »), la pièce où l'on se trouve ;
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
import { commandesConnues, commandesDuJourOuvertes } from '../jeu/generateur.js';
import { etapesVers, objectifDeQuete, sujetsPour } from '../jeu/quetes.js';
import { prochainPassage } from '../jeu/routines.js';
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
import { ouvrirJournal } from './journal.js';
import { direAuxLecteurs, notifier } from './notifications.js';
import { ouvrirOrdinateur } from './ordinateur.js';
import { demarrerProgression, messageDesQuetes, progresserQuetes } from './progression.js';

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
  const paliers = jeu.reputation.paliers;
  const quetes = donnees?.quetes?.quetes || [];
  // Les personnes qu'on peut nommer : habitants, visiteurs, clientes et
  // clients des commandes du jour.
  const personnes = new Map([...(donnees?.pnj.pnj || []), ...(donnees?.modelesCommandes?.clients || [])]
    .map((personne) => [personne.id, personne]));
  const nomDe = (id) => {
    const personne = personnes.get(id);
    return personne?.modele === 'ferrus' ? donnees.personnages.ferrus.nom : personne?.nom || '';
  };
  // Le menu Pause, avec le journal en plus.
  const menuComplet = { ...menu, surJournal: () => ouvrirLeJournal() };

  // --- Barre du haut ---------------------------------------------------------------
  const argent = indicateur('piece', t('hud.argent'));
  const reputation = indicateur('etoile', t('hud.reputation'));
  const moment = indicateur('horloge', t('hud.moment'));

  // L'objectif : l'étape en cours de la quête suivie (sinon, ce qu'il y a à
  // faire avec les commandes). Le toucher mène là où il se joue.
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
    onClick: () => ouvrirMenuPause(menuComplet),
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
  // Sur petit écran (barre compacte), seule l'icône reste visible ; le mot
  // « Journal » reste lu par les lecteurs d'écran (et en bulle d'aide).
  const boutonJournal = el('button', {
    class: 'bouton bouton-journal',
    type: 'button',
    title: `${t('journal.bouton')} (${t('journal.raccourci')})`,
    'aria-keyshortcuts': 'J',
    onClick: () => ouvrirLeJournal(),
  }, icone('journal'), el('span', { class: 'libelle-journal' }, t('journal.bouton')),
  el('kbd', { class: 'raccourci', 'aria-hidden': 'true' }, t('journal.raccourci')));
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
    el('div', { class: 'barre-zone' }, boutonJournal, boutonAllerA, boutonAction, boutonDormir, boutonOrdinateur),
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
    // A-t-elle une commande à présenter de vive voix (Halaé, Théo) ?
    const partie = partieEnCours();
    const commande = donnees && partie
      ? commandesAProposer(partie, donnees.commandes.commandes, paliers).find((c) => c.client === id)
      : null;
    const demande = commande ? {
      commande,
      surProposee: () => {
        modifierPartie((p) => proposerCommande(p, commande), { important: true });
        // Un seul message (les lecteurs d'écran le lisent en entier).
        const message = [t('livraison.nouvelle', { client: infos.nom, titre: commande.titre }),
          messageDesQuetes(progresserQuetes({ annoncer: false }))].filter(Boolean).join(' ');
        notifier(message, { type: 'info' });
      },
    } : null;
    // Les questions de quête à lui poser (« Alors, cette application ? »).
    const sujets = partie ? sujetsPour(partie, quetes, id, paliers).map(({ quete, etape }) => ({
      question: etape.question,
      replique: etape.replique,
      surDit: () => progresserQuetes({ geste: { quete, etape } }),
    })) : [];
    ouvrirDialogue({
      infos, pnj: infos.pnj, creneau: infos.creneau, demande, sujets, surFermeture: () => mondeActuel?.finParler(id),
    });
  }

  // S'approcher d'un endroit qu'une quête attend (« regarde sa nouvelle
  // vidéo, à la télévision ») : l'étape est faite, et ce qu'on y voit est dit.
  function approcher(infos) {
    const partie = partieEnCours();
    if (!partie || infos.type === 'pnj') return;
    for (const { quete, etape } of etapesVers(partie, quetes, infos.id, paliers)) {
      const evenements = progresserQuetes({ geste: { quete, etape }, annoncer: false });
      const message = [etape.message ? typographier(etape.message) : '', messageDesQuetes(evenements)].filter(Boolean).join(' ');
      if (message) notifier(message, { type: 'succes' });
    }
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
    allerVers(objectifActuel?.destination || null);
  }

  // Aller là où se joue une étape (objectif du haut, « Y aller » du journal) :
  // un meuble, un endroit ou une personne. Une personne absente : on dit
  // quand elle revient (rien n'est caché, tout est prévisible).
  function allerVers(id) {
    const destination = id ? mondeActuel?.destinations().find((d) => d.id === id) : null;
    if (destination) {
      fermerBulle();
      if (mondeActuel.allerVers(destination)) direAuxLecteurs(t('jeu.enRoute', { destination: destination.designation }));
      return;
    }
    const pnj = id ? donnees?.pnj.pnj.find((p) => p.id === id) : null;
    const partie = partieEnCours();
    if (!pnj || !partie) {
      notifier(t('quetes.sansEndroit'), { type: 'info' });
      return;
    }
    const retour = prochainPassage(pnj, partie.lieux.actuel, partie.temps.minute, partie.joueur);
    const nom = nomDe(id);
    if (!retour) notifier(t('quetes.absentJamais', { nom }), { type: 'info' });
    else notifier(t(retour.demain ? 'quetes.absentDemain' : 'quetes.absent', { nom, heure: formaterHeure(retour.minute) }), { type: 'info' });
  }

  // Le journal des quêtes (bouton, touche J, Pause › Journal).
  function ouvrirLeJournal() {
    if (!donnees?.quetes) return;
    fermerBulle();
    ouvrirJournal({ donnees, nomDe, surAller: allerVers });
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
    // Les commandes du jour ont changé pendant la nuit.
    const nouvelles = donnees && commandesDuJourOuvertes(partieEnCours(), donnees.modelesCommandes, paliers);
    notifier(t(nouvelles ? 'temps.bonjourCommandes' : 'temps.bonjour', { jour: temps.jour }), { type: 'succes' });
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
        approcher(infos);
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
    reserverPlaceDeLHeure(partie.temps.jour);
    moment.valeur.textContent = `${t('hud.jour', { jour: partie.temps.jour })} · ${heure}`;
    // L'objectif : la quête suivie, sinon les commandes.
    objectifActuel = calculerObjectif(partie);
    if (!objectifActuel) texteObjectif.textContent = t('hud.aucunObjectif');
    else if (objectifActuel.cle) {
      texteObjectif.textContent = t(`objectifs.${objectifActuel.cle}`, {
        client: objectifActuel.commande ? nomDe(objectifActuel.commande.client) : '',
      });
    } else texteObjectif.textContent = typographier(objectifActuel.etape.texte);
    moment.court.textContent = `${t('hud.jourCourt', { jour: partie.temps.jour })} · ${heure}`;
    adapterBarres();
  }

  // L'heure garde toujours la même place : celle de l'heure la plus large de
  // la journée, écrite avec le chiffre le plus large de la police choisie.
  // Sinon, avec des chiffres de largeurs différentes (« 14 h 10 » est plus
  // étroit que « 14 h 46 »), la barre changerait de forme d'une minute à
  // l'autre, le bouton Pause passant d'une ligne à l'autre.
  let placeDeLHeure = null;
  function reserverPlaceDeLHeure(jour) {
    const libelles = [[moment.valeur, t('hud.jour', { jour })], [moment.court, t('hud.jourCourt', { jour })]];
    const styles = libelles.map(([libelle]) => getComputedStyle(libelle));
    const cle = [jour, ...styles.map((s) => `${s.font}|${s.fontSize}|${s.fontFamily}|${s.letterSpacing}|${s.wordSpacing}`)].join('/');
    if (cle === placeDeLHeure) return;
    placeDeLHeure = cle;
    const mesure = el('span', { 'aria-hidden': 'true' });
    document.body.append(mesure);
    libelles.forEach(([libelle, debut], index) => {
      const style = styles[index];
      for (const propriete of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariantNumeric', 'letterSpacing', 'wordSpacing']) {
        mesure.style[propriete] = style[propriete];
      }
      mesure.style.position = 'absolute';
      mesure.style.visibility = 'hidden';
      mesure.style.whiteSpace = 'nowrap';
      let chiffre = '0';
      let plusLarge = 0;
      for (const essai of '0123456789') {
        mesure.textContent = essai;
        const largeur = mesure.getBoundingClientRect().width;
        if (largeur > plusLarge) {
          plusLarge = largeur;
          chiffre = essai;
        }
      }
      mesure.textContent = `${debut} · ${formaterHeure(23 * 60 + 59).replace(/\d/g, chiffre)}`;
      libelle.style.minWidth = `${Math.ceil(mesure.getBoundingClientRect().width) + 1}px`;
    });
    mesure.remove();
  }
  // Une police tout juste chargée a d'autres largeurs : on remesure.
  document.fonts?.ready.then(() => {
    placeDeLHeure = null;
    rafraichir();
  });

  function calculerObjectif(partie) {
    if (!donnees) return null;
    const commandes = commandesConnues(partie, donnees);
    return objectifDeQuete(partie, { quetes, commandes, paliers })
      || objectifDuMoment(partie, commandes, paliers, {
        demain: commandesDuJourOuvertes(partie, donnees.modelesCommandes, paliers),
      });
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
  // J (même place sur un clavier AZERTY ou QWERTY) : le journal.
  function surTouche(evenement) {
    if (fenetreOuverte() || !ecranActif) return;
    if (evenement.code === 'KeyJ' && !evenement.ctrlKey && !evenement.metaKey && !evenement.altKey) {
      evenement.preventDefault();
      ouvrirLeJournal();
      return;
    }
    if (evenement.key !== 'Escape') return;
    evenement.preventDefault();
    if (!bulle.hidden) fermerBulle({ rendreFocus: true });
    else ouvrirMenuPause(menuComplet);
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
  // Les quêtes avancent toutes seules (progression.js) ; au début d'une
  // partie, la première commence.
  const arreterProgression = donnees?.quetes ? demarrerProgression(donnees) : () => {};
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
      arreterProgression();
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
        menu.surJournal ? ligne('journal', t('pause.journal'), () => {
          fenetre.fermer();
          menu.surJournal();
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
