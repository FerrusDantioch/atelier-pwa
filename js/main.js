// =============================================================================
// main.js — le point de départ du jeu
// -----------------------------------------------------------------------------
// Il charge les données, prépare les réglages, la sauvegarde, le son et le
// fonctionnement hors ligne, puis passe d'un écran à l'autre :
//
//   accueil ──(Nouvelle partie)──▶ choix du personnage ──▶ jeu
//      │                                                    │ ▲
//      ├──(Continuer / Importer)───────────────────────────▶│ │ (Pause › Ton personnage)
//      ▲                                                    ▼ │
//      └───────────────(Pause › Retour à l'accueil)──── choix du personnage
//
// La 3D (Three.js, assez lourde) n'est chargée qu'au moment de jouer : l'accueil
// s'affiche vite, et il reste utilisable même si la 3D ne marche pas.
// Les autres fichiers ne se connaissent presque pas : main.js les relie.
// =============================================================================

import { initialiserAudio } from './noyau/audio.js';
import { chargerDonnees } from './noyau/donnees.js';
import {
  chargerPartieEnCours, demarrerSauvegardeAutomatique, fermerPartie, modifierPartie, partieEnCours, sauvegarderMaintenant,
} from './noyau/etat.js';
import { ecouter } from './noyau/evenements.js';
import { nouvellePartie, resumerPartie } from './noyau/format-sauvegarde.js';
import { nouvelleGraine } from './noyau/hasard.js';
import { appliquerMiseAJour, estInstalle, initialiserPwa } from './noyau/pwa.js';
import { chargerReglages, obtenirReglages } from './noyau/reglages.js';
import {
  creerCopieDeSecours, enregistrerPartie, estEnModeMemoire, lirePartie, ouvrirSauvegarde, remplacerPartie,
} from './noyau/sauvegarde.js';
import { formaterDate, initialiserTextes, t } from './noyau/textes.js';
import { ouvrirAPropos } from './interface/a-propos.js';
import { afficherAccueil, ouvrirBienvenue } from './interface/accueil.js';
import { afficherChoixPerso } from './interface/choix-perso.js';
import { afficherEcranJeu } from './interface/ecran-jeu.js';
import { messageDesQuetes, progresserQuetes } from './interface/progression.js';
import { confirmer, fermerToutes, informer } from './interface/fenetres.js';
import { installerLeJeu } from './interface/installation.js';
import { initialiserNotifications, notifier } from './interface/notifications.js';
import { ouvrirReglages } from './interface/reglages-ecran.js';
import { importerUnePartie, ouvrirSauvegarde as ouvrirFenetreSauvegarde } from './interface/sauvegarde-ecran.js';

const racine = document.getElementById('interface');
const zoneScene = document.getElementById('scene');
let donnees = null;
let ecran = null; // l'écran affiché : { detruire() }
let ecranJeu = null; // l'écran de jeu, s'il est affiché
let ecranPerso = null; // « Ton personnage » ouvert depuis la Pause

// La partie enregistrée, connue même quand on est sur l'accueil
// (pour le bouton « Continuer »).
let partieEnregistree = null;

function changerEcran(nouveau) {
  ecranPerso?.detruire();
  ecranPerso = null;
  ecran?.detruire();
  ecran = nouveau;
  ecranJeu = null;
}

// --- La 3D, chargée à la demande --------------------------------------------------

let trois = null;
let promesse3D = null;

// Prépare la 3D (une seule fois, même si deux clics rapprochés la demandent).
// Renvoie null si l'appareil ne peut pas l'afficher : un message l'explique,
// le reste du jeu continue de marcher.
async function preparer3D() {
  if (trois) return trois;
  if (promesse3D) return promesse3D;
  promesse3D = (async () => {
    try {
      const [moteurJs, paletteJs, mondeJs, studioJs, portraitJs] = await Promise.all([
        import('./monde/moteur.js'), import('./modeles/palette.js'), import('./monde/monde.js'), import('./monde/studio.js'),
        import('./monde/portrait.js'),
      ]);
      const moteur = moteurJs.creerMoteur(zoneScene, {
        qualite: obtenirReglages().qualite,
        surPerte: () => notifier(t('troisD.perdue'), { type: 'attention' }),
        surRetour: () => notifier(t('troisD.retrouvee'), { type: 'succes' }),
      });
      const palette = paletteJs.creerPalette(donnees.palette.couleurs);
      const studio = studioJs.creerStudio({
        moteur, donnees, palette, animationsReduites: () => document.documentElement.getAttribute('data-animations') === 'reduites',
      });
      // Les portraits (visio, commandes) : des photos prises par le même moteur.
      const portraits = portraitJs.creerPortraits({ moteur, donnees, palette, luminosite: () => obtenirReglages().luminosite });
      trois = { moteur, palette, studio, portraits, creerMonde: mondeJs.creerMonde };
      ecouter('reglages:modifies', ({ reglages }) => {
        trois.moteur.changerQualite(reglages.qualite);
        trois.studio.regler({ luminosite: reglages.luminosite });
        trois.portraits.oublier();
      });
      return trois;
    } catch (erreur) {
      console.error(erreur);
      await informer({ titre: t('troisD.indisponibleTitre'), message: [t('troisD.indisponible'), t('troisD.conseil')] });
      return null;
    } finally {
      promesse3D = null;
    }
  })();
  return promesse3D;
}

// Empêche deux transitions d'écran asynchrones de se chevaucher (double clic).
let enTransition = false;
async function avecTransition(tache) {
  if (enTransition) return;
  enTransition = true;
  try {
    await tache();
  } finally {
    enTransition = false;
  }
}

function montrerScene(oui) {
  zoneScene.hidden = !oui;
}

// --- Les écrans ------------------------------------------------------------------

// focaliser : place le focus sur le titre (quand on revient d'un autre écran,
// pour que le clavier et les lecteurs d'écran repartent du bon endroit).
function montrerAccueil({ focaliser = false } = {}) {
  fermerToutes();
  montrerScene(false);
  let element = null;
  const arretInstallation = ecouter('pwa:installation', ({ installe }) => {
    if (installe) element?.querySelector('[data-action="installer"]')?.remove();
  });
  changerEcran({
    detruire: () => {
      arretInstallation();
      element?.remove();
    },
  });
  element = afficherAccueil(racine, {
    resume: partieEnregistree ? resumerPartie(partieEnregistree) : null,
    jeu: donnees.jeu,
    installe: estInstalle(),
    surContinuer: () => avecTransition(() => jouer(partieEnregistree)),
    surNouvellePartie: demanderNouvellePartie,
    surImporter: () => importerUnePartie({
      jeu: donnees.jeu, aUnePartie: Boolean(partieEnregistree), surPartie: chargerAutrePartie,
    }),
    surReglages: ouvrirReglages,
    surInstaller: installerLeJeu,
    surAPropos: () => ouvrirAPropos({ surMiseAJour: lancerMiseAJour }),
  });
  const titre = element.querySelector('h1');
  titre?.setAttribute('tabindex', '-1');
  if (focaliser) titre?.focus();
}

// L'écran « Qui veux-tu incarner ? ». Renvoie false si la 3D est indisponible.
async function montrerChoixPerso({ mode, joueur, surValider, surAnnuler }) {
  const outils = await preparer3D();
  if (!outils) return false;
  fermerToutes();
  montrerScene(true);
  const options = {
    mode,
    personnages: donnees.personnages,
    palette: outils.palette,
    joueur,
    studio: outils.studio,
    surValider,
    surAnnuler,
  };
  if (mode === 'modification') {
    ecranPerso = afficherChoixPerso(racine, options);
  } else {
    let affiche = null;
    changerEcran({ detruire: () => affiche?.detruire() });
    affiche = afficherChoixPerso(racine, options);
  }
  return true;
}

// Si la partie venait d'une version avec un lieu supprimé ou renommé, on
// ramène le joueur dans le lieu de départ plutôt que de planter.
function normaliserLieuxDeLaPartie(partie) {
  const depart = donnees.jeu.depart.lieu;
  partie.lieux.debloques = partie.lieux.debloques.filter((id) => Boolean(donnees.lieux[id]));
  if (!partie.lieux.debloques.includes(depart)) partie.lieux.debloques.unshift(depart);
  if (!donnees.lieux[partie.lieux.actuel] || !partie.lieux.debloques.includes(partie.lieux.actuel)) {
    partie.lieux.actuel = depart;
    if (partie.joueur) partie.joueur.position = null;
  }
}

// Ouvre une partie : choix du personnage s'il n'existe pas encore (partie
// du jalon 0), puis le jeu.
async function jouer(partie) {
  if (!partie) return;
  normaliserLieuxDeLaPartie(partie);
  fermerToutes();
  chargerPartieEnCours(partie);
  partieEnregistree = partie;
  if (!partie.joueur) {
    const affiche = await montrerChoixPerso({
      mode: 'creation',
      joueur: null,
      surValider: (joueur) => avecTransition(async () => {
        modifierPartie((p) => { p.joueur = joueur; }, { important: true });
        await afficherJeu();
      }),
      surAnnuler: () => avecTransition(retournerAccueil),
    });
    if (!affiche) montrerAccueil({ focaliser: true });
    return;
  }
  await afficherJeu();
}

async function afficherJeu() {
  const outils = await preparer3D();
  if (!outils) {
    await retournerAccueil();
    return;
  }
  fermerToutes();
  montrerScene(true);
  changerEcran(null);
  ecranJeu = afficherEcranJeu(racine, {
    jeu: donnees.jeu,
    donnees,
    portrait: (apparence, taille) => outils.portraits.photographier(apparence, taille),
    photo: (meuble, taille) => outils.portraits.photographierMeuble(meuble, taille),
    creerMonde: (rappels) => outils.creerMonde({
      moteur: outils.moteur,
      donnees,
      palette: outils.palette,
      partie: partieEnCours(),
      reglages: obtenirReglages,
      rappels,
    }),
    menu: {
      surReglages: ouvrirReglages,
      surSauvegarde: () => ouvrirFenetreSauvegarde({ jeu: donnees.jeu, surPartie: chargerAutrePartie }),
      surAPropos: () => ouvrirAPropos({ surMiseAJour: lancerMiseAJour }),
      surAccueil: () => avecTransition(retournerAccueil),
      surPersonnage: () => avecTransition(modifierPersonnage),
    },
  });
  ecran = ecranJeu;
  // Le focus part du début de l'écran de jeu (titre invisible, lu par les
  // lecteurs d'écran).
  const titre = ecranJeu.element.querySelector('h1');
  titre?.setAttribute('tabindex', '-1');
  titre?.focus();
}

// « Ton personnage » depuis la Pause : l'écran de jeu est mis de côté, puis
// retrouvé tel quel (même position, même vue).
async function modifierPersonnage() {
  if (!ecranJeu) return;
  const jeu = ecranJeu;
  jeu.suspendre(true);
  const revenir = () => {
    ecranPerso?.detruire();
    ecranPerso = null;
    jeu.suspendre(false);
    const titre = jeu.element.querySelector('h1');
    titre?.focus();
  };
  const affiche = await montrerChoixPerso({
    mode: 'modification',
    joueur: partieEnCours().joueur,
    surValider: (joueur) => {
      modifierPartie((p) => { p.joueur = joueur; }, { important: true });
      jeu.monde?.changerJoueur(joueur);
      revenir();
      notifier(t('choixPerso.enregistre'), { type: 'succes' });
    },
    surAnnuler: revenir,
  });
  if (!affiche) jeu.suspendre(false);
}

async function retournerAccueil() {
  await sauvegarderMaintenant();
  partieEnregistree = partieEnCours() || partieEnregistree;
  fermerPartie();
  montrerAccueil({ focaliser: true });
}

// --- Nouvelle partie, import, copie de secours ---------------------------------

async function demanderNouvellePartie() {
  if (enTransition) return;
  if (partieEnregistree) {
    const accord = await confirmer({
      titre: t('nouvellePartie.titre'),
      message: [t('nouvellePartie.remplace'), t('nouvellePartie.copieGardee')],
      oui: t('nouvellePartie.oui'),
    });
    if (!accord) return;
  }
  await avecTransition(async () => {
    // Rien ne change tant que le personnage n'est pas choisi : « Retour »
    // ramène à l'accueil, l'ancienne partie intacte.
    const affiche = await montrerChoixPerso({
      mode: 'creation',
      joueur: null,
      surValider: (joueur) => avecTransition(async () => {
        if (partieEnregistree) await creerCopieDeSecours(partieEnregistree, 'avant-nouvelle-partie');
        const partie = nouvellePartie({
          graine: nouvelleGraine(),
          depart: donnees.jeu.depart,
          versionJeu: self.CONFIG_JEU.version,
          joueur,
        });
        await enregistrerPartie(partie);
        await jouer(partie);
        // La première quête commence : un seul message pour les deux nouvelles
        // (les lecteurs d'écran ne liraient que le second de deux messages).
        const quetes = messageDesQuetes(progresserQuetes({ annoncer: false }));
        notifier([t('nouvellePartie.commencee'), quetes].filter(Boolean).join(' '), { type: 'succes' });
      }),
      surAnnuler: () => montrerAccueil({ focaliser: true }),
    });
    if (!affiche) montrerAccueil({ focaliser: true });
  });
}

// Une autre partie remplace la partie en cours (import ou copie de secours).
async function chargerAutrePartie(partie, { dejaEnregistree = false } = {}) {
  await avecTransition(async () => {
    if (!dejaEnregistree) {
      await remplacerPartie(partie, partieEnCours() || partieEnregistree, 'avant-import');
    }
    await jouer(partie);
    // Une copie de secours a déjà son propre message (« Copie de secours reprise »).
    if (!dejaEnregistree) notifier(t('sauvegarde.import.reussi'), { type: 'succes' });
  });
}

// --- Démarrage ----------------------------------------------------------------------

async function lancerMiseAJour() {
  await sauvegarderMaintenant();
  if (!appliquerMiseAJour()) notifier(t('pwa.echec'), { type: 'erreur' });
}

function brancherMisesAJour() {
  let autreOngletSignale = false;
  ecouter('pwa:mise-a-jour', ({ version }) => {
    notifier(version ? t('pwa.disponibleVersion', { version }) : t('pwa.disponible'), {
      type: 'info',
      action: { texte: t('pwa.mettreAJour'), surClic: lancerMiseAJour },
    });
  });
  ecouter('sauvegarde:echec', () => notifier(t('sauvegarde.echec'), { type: 'erreur' }));
  ecouter('sauvegarde:copie-echec', () => notifier(t('sauvegarde.copieEchec'), { type: 'attention' }));
  ecouter('sauvegarde:autre-onglet', () => {
    if (autreOngletSignale) return;
    autreOngletSignale = true;
    notifier(t('sauvegarde.autreOnglet'), {
      type: 'attention',
      persistante: true,
      action: { texte: t('sauvegarde.recharger'), surClic: () => self.location.reload() },
    });
  });
}

async function demarrer() {
  donnees = await chargerDonnees();
  initialiserTextes(donnees.textes);
  chargerReglages();
  initialiserNotifications();
  initialiserAudio();
  brancherMisesAJour();

  await ouvrirSauvegarde({ copiesDeSecours: donnees.jeu.sauvegarde.copiesDeSecours });
  const lecture = await lirePartie();
  partieEnregistree = lecture.partie;
  demarrerSauvegardeAutomatique(donnees.jeu.sauvegarde.intervalleSecondes);

  montrerAccueil();
  document.getElementById('chargement').hidden = true;
  self.atelierDemarrageReussi?.();

  // Messages éventuels, une fois l'accueil affiché.
  if (lecture.etat === 'reparee') {
    notifier(t('sauvegarde.reparee', { date: formaterDate(lecture.copie.date) }), { type: 'attention', persistante: true });
  } else if (lecture.etat === 'perdue') {
    notifier(t('sauvegarde.perdue'), { type: 'erreur', persistante: true });
  }
  if (estEnModeMemoire()) {
    notifier(t('sauvegarde.modeMemoire'), { type: 'attention', persistante: true });
  }
  if (!obtenirReglages().premierLancementFait) {
    ouvrirBienvenue({ surReglages: ouvrirReglages });
  }

  // Le hors-ligne en dernier : le jeu est déjà utilisable.
  await initialiserPwa();
}

demarrer().catch((erreur) => {
  console.error(erreur);
  self.atelierEchecDemarrage?.(erreur?.message || String(erreur));
});
