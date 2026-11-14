// =============================================================================
// pwa.js — installation du jeu et mises à jour
// -----------------------------------------------------------------------------
// - Enregistre le service worker (sw.js), qui garde le jeu sur l'appareil.
// - Cherche une nouvelle version au démarrage et chaque fois que le jeu
//   revient au premier plan. Si elle existe, le jeu l'annonce
//   (« pwa:mise-a-jour ») : rien ne change sans l'accord du joueur.
// - « Mettre à jour » : la partie est sauvegardée, puis le jeu se recharge.
// - Mémorise la proposition d'installation du navigateur (Chrome, Edge…)
//   pour l'offrir au bon moment via un bouton « Installer le jeu ».
// =============================================================================

import { annoncer } from './evenements.js';

let inscription = null;
let enAttente = null;            // la nouvelle version, prête
let rechargementDemande = false; // le joueur a touché « Mettre à jour »
let propositionInstallation = null;
let derniereVerification = 0;

const INTERVALLE_MINIMUM = 60 * 1000; // pas plus d'une vérification par minute

// Demande au service worker en attente quelle version il apporte.
function demanderVersion(travailleur) {
  return new Promise((resoudre) => {
    const canal = new MessageChannel();
    const delai = setTimeout(() => resoudre(null), 2000);
    canal.port1.onmessage = (evenement) => {
      clearTimeout(delai);
      resoudre(evenement.data?.version || null);
    };
    travailleur.postMessage({ type: 'version' }, [canal.port2]);
  });
}

async function signalerNouvelleVersion(travailleur) {
  enAttente = travailleur;
  const version = await demanderVersion(travailleur);
  annoncer('pwa:mise-a-jour', { version });
}

function surveiller(nouvelleInscription) {
  inscription = nouvelleInscription;
  // Une nouvelle version attendait déjà (préparée lors d'une visite précédente).
  if (inscription.waiting && navigator.serviceWorker.controller) {
    signalerNouvelleVersion(inscription.waiting);
  }
  inscription.addEventListener('updatefound', () => {
    const nouveau = inscription.installing;
    if (!nouveau) return;
    nouveau.addEventListener('statechange', () => {
      // « installed » + une ancienne version aux commandes = mise à jour prête.
      // (À la toute première visite, il n'y a pas d'ancienne version : rien à proposer.)
      if (nouveau.state === 'installed' && navigator.serviceWorker.controller) {
        signalerNouvelleVersion(nouveau);
      }
    });
  });
}

export function chercherMiseAJour() {
  if (!inscription) return;
  const maintenant = Date.now();
  if (maintenant - derniereVerification < INTERVALLE_MINIMUM) return;
  derniereVerification = maintenant;
  inscription.update().catch(() => { /* hors ligne : on réessaiera plus tard */ });
}

export async function initialiserPwa() {
  // Proposition d'installation (navigateurs qui la gèrent).
  self.addEventListener('beforeinstallprompt', (evenement) => {
    evenement.preventDefault();
    propositionInstallation = evenement;
    annoncer('pwa:installation', { possible: true });
  });
  self.addEventListener('appinstalled', () => {
    propositionInstallation = null;
    annoncer('pwa:installation', { possible: false, installe: true });
  });

  if (!('serviceWorker' in navigator)) return { disponible: false };

  // Le jeu ne se recharge que si le joueur l'a demandé (jamais par surprise).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (rechargementDemande) self.location.reload();
  });

  try {
    // « updateViaCache: 'none' » : la vérification des mises à jour ne se
    // laisse pas tromper par les copies gardées par le navigateur.
    const nouvelleInscription = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
    surveiller(nouvelleInscription);
  } catch (erreur) {
    console.warn('Service worker non enregistré (le jeu marche, mais pas hors ligne) :', erreur);
    return { disponible: false };
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') chercherMiseAJour();
  });
  return { disponible: true };
}

// À appeler APRÈS avoir sauvegardé la partie.
export function appliquerMiseAJour() {
  if (!enAttente) return false;
  rechargementDemande = true;
  enAttente.postMessage({ type: 'activer' });
  return true;
}

export function miseAJourEnAttente() {
  return Boolean(enAttente);
}

// --- Installation -------------------------------------------------------------

export function installationPossible() {
  return Boolean(propositionInstallation);
}

export function estInstalle() {
  return Boolean(self.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone);
}

// Ouvre la fenêtre d'installation du navigateur. Renvoie true si accepté.
export async function proposerInstallation() {
  if (!propositionInstallation) return false;
  const proposition = propositionInstallation;
  propositionInstallation = null;
  await proposition.prompt();
  const choix = await proposition.userChoice;
  annoncer('pwa:installation', { possible: false, installe: choix.outcome === 'accepted' });
  return choix.outcome === 'accepted';
}
