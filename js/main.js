// =============================================================================
// main.js — le point de départ du jeu
// -----------------------------------------------------------------------------
// Il charge les données, prépare les réglages, la sauvegarde, le son et le
// fonctionnement hors ligne, puis passe d'un écran à l'autre :
//
//   accueil ──(Continuer / Nouvelle partie / Importer)──▶ jeu
//      ▲                                                   │
//      └───────────────(Pause › Retour à l'accueil)────────┘
//
// Les autres fichiers ne se connaissent presque pas : main.js les relie.
// =============================================================================

import { initialiserAudio } from './noyau/audio.js';
import { chargerDonnees } from './noyau/donnees.js';
import {
  chargerPartieEnCours, demarrerSauvegardeAutomatique, fermerPartie, partieEnCours, sauvegarderMaintenant,
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
import { afficherEcranJeu } from './interface/ecran-jeu.js';
import { confirmer, fermerToutes } from './interface/fenetres.js';
import { installerLeJeu } from './interface/installation.js';
import { initialiserNotifications, notifier } from './interface/notifications.js';
import { ouvrirReglages } from './interface/reglages-ecran.js';
import { importerUnePartie, ouvrirSauvegarde as ouvrirFenetreSauvegarde } from './interface/sauvegarde-ecran.js';

const racine = document.getElementById('interface');
let donnees = null;
let ecran = null; // l'écran affiché : { detruire() }

// La partie enregistrée, connue même quand on est sur l'accueil
// (pour le bouton « Continuer »).
let partieEnregistree = null;

function changerEcran(nouveau) {
  ecran?.detruire();
  ecran = nouveau;
}

// --- Les deux écrans ------------------------------------------------------------

// focaliser : place le focus sur le titre (quand on revient d'un autre écran,
// pour que le clavier et les lecteurs d'écran repartent du bon endroit).
function montrerAccueil({ focaliser = false } = {}) {
  fermerToutes();
  let element = null;
  changerEcran({ detruire: () => element?.remove() });
  element = afficherAccueil(racine, {
    resume: partieEnregistree ? resumerPartie(partieEnregistree) : null,
    jeu: donnees.jeu,
    installe: estInstalle(),
    surContinuer: () => jouer(partieEnregistree),
    surNouvellePartie: demanderNouvellePartie,
    surImporter: () => importerUnePartie({ jeu: donnees.jeu, surPartie: chargerAutrePartie }),
    surReglages: ouvrirReglages,
    surInstaller: installerLeJeu,
    surAPropos: ouvrirAPropos,
  });
  const titre = element.querySelector('h1');
  titre?.setAttribute('tabindex', '-1');
  if (focaliser) titre?.focus();
}

function jouer(partie) {
  fermerToutes();
  chargerPartieEnCours(partie);
  partieEnregistree = partie;
  changerEcran(afficherEcranJeu(racine, {
    jeu: donnees.jeu,
    menu: {
      surReglages: ouvrirReglages,
      surSauvegarde: () => ouvrirFenetreSauvegarde({ jeu: donnees.jeu, surPartie: chargerAutrePartie }),
      surAPropos: ouvrirAPropos,
      surAccueil: retournerAccueil,
    },
  }));
  // Le focus part du début de l'écran de jeu (titre invisible, lu par les
  // lecteurs d'écran).
  const titre = ecran.element.querySelector('h1');
  titre?.setAttribute('tabindex', '-1');
  titre?.focus();
}

async function retournerAccueil() {
  await sauvegarderMaintenant();
  partieEnregistree = partieEnCours();
  fermerPartie();
  montrerAccueil({ focaliser: true });
}

// --- Nouvelle partie, import, copie de secours ---------------------------------

async function demanderNouvellePartie() {
  if (partieEnregistree) {
    const accord = await confirmer({
      titre: t('nouvellePartie.titre'),
      message: [t('nouvellePartie.remplace'), t('nouvellePartie.copieGardee')],
      oui: t('nouvellePartie.oui'),
    });
    if (!accord) return;
    await creerCopieDeSecours(partieEnregistree, 'avant-nouvelle-partie');
  }
  const partie = nouvellePartie({
    graine: nouvelleGraine(),
    depart: donnees.jeu.depart,
    versionJeu: self.CONFIG_JEU.version,
  });
  await enregistrerPartie(partie);
  jouer(partie);
  notifier(t('nouvellePartie.commencee'), { type: 'succes' });
}

// Une autre partie remplace la partie en cours (import ou copie de secours).
async function chargerAutrePartie(partie, { dejaEnregistree = false } = {}) {
  if (!dejaEnregistree) {
    await remplacerPartie(partie, partieEnCours() || partieEnregistree, 'avant-import');
  }
  jouer(partie);
  notifier(t('sauvegarde.import.reussi'), { type: 'succes' });
}

// --- Démarrage ----------------------------------------------------------------------

function brancherMisesAJour() {
  ecouter('pwa:mise-a-jour', ({ version }) => {
    notifier(version ? t('pwa.disponibleVersion', { version }) : t('pwa.disponible'), {
      type: 'info',
      action: {
        texte: t('pwa.mettreAJour'),
        surClic: async () => {
          await sauvegarderMaintenant();
          if (!appliquerMiseAJour()) notifier(t('pwa.echec'), { type: 'erreur' });
        },
      },
    });
  });
  ecouter('sauvegarde:echec', () => notifier(t('sauvegarde.echec'), { type: 'erreur' }));
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
