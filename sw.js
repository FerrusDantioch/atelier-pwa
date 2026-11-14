// =============================================================================
// sw.js — le « service worker » : il permet de jouer SANS connexion internet
// -----------------------------------------------------------------------------
// Un service worker est un petit programme que le navigateur garde de côté.
// Il se place entre le jeu et internet :
//
// - à l'installation, il copie TOUS les fichiers du jeu (liste FICHIERS) dans
//   une réserve propre à cette version (ex. « atelier-pwa-0.1.0 ») ;
// - ensuite, chaque fichier est servi depuis cette réserve (« cache d'abord ») :
//   le jeu se lance même en mode avion ;
// - quand la version change dans js/config.js, le navigateur prépare la
//   nouvelle version en arrière-plan. Le jeu propose alors « Mettre à jour » :
//   rien ne change sans l'accord du joueur, et la partie est sauvegardée avant.
//   Les anciennes réserves de CE jeu sont ensuite effacées (jamais celles des
//   autres applications du même site).
// =============================================================================

importScripts('js/config.js');

const CONFIG = self.CONFIG_JEU;
const PREFIXE = `${CONFIG.idStockage}-`;
const RESERVE = `${PREFIXE}${CONFIG.version}`;

// Tous les fichiers nécessaires pour jouer. Tout nouveau fichier du jeu doit
// être ajouté ici, sinon il manquera hors ligne : le test
// tests/hors-ligne.test.js vérifie que la liste est complète.
const FICHIERS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'LICENSE',
  'licences-tierces.txt',
  'css/polices.css',
  'css/themes.css',
  'css/base.css',
  'css/interface.css',
  'js/config.js',
  'js/avant-affichage.js',
  'js/secours.js',
  'js/main.js',
  'js/jeu/dialogues.js',
  'js/jeu/personnage.js',
  'js/jeu/routines.js',
  'js/jeu/temps.js',
  'js/noyau/audio.js',
  'js/noyau/coherence.js',
  'js/noyau/donnees.js',
  'js/noyau/etat.js',
  'js/noyau/evenements.js',
  'js/noyau/format-sauvegarde.js',
  'js/noyau/hasard.js',
  'js/noyau/pwa.js',
  'js/noyau/reglages.js',
  'js/noyau/sauvegarde.js',
  'js/noyau/schemas.js',
  'js/noyau/textes.js',
  'js/noyau/verification.js',
  'js/interface/a-propos.js',
  'js/interface/accueil.js',
  'js/interface/choix-perso.js',
  'js/interface/dialogue.js',
  'js/interface/dom.js',
  'js/interface/ecran-jeu.js',
  'js/interface/fenetres.js',
  'js/interface/icones.js',
  'js/interface/installation.js',
  'js/interface/notifications.js',
  'js/interface/reglages-ecran.js',
  'js/interface/sauvegarde-ecran.js',
  'js/modeles/formes.js',
  'js/modeles/meubles.js',
  'js/modeles/palette.js',
  'js/modeles/personnage.js',
  'js/monde/camera-iso.js',
  'js/monde/chemin.js',
  'js/monde/controles.js',
  'js/monde/deplacement.js',
  'js/monde/grille.js',
  'js/monde/habitants.js',
  'js/monde/lieu.js',
  'js/monde/lumieres.js',
  'js/monde/monde.js',
  'js/monde/moteur.js',
  'js/monde/pointage.js',
  'js/monde/reperes.js',
  'js/monde/studio.js',
  'data/jeu.json',
  'data/textes.json',
  'data/palette.json',
  'data/meubles.json',
  'data/personnages.json',
  'data/pnj.json',
  'data/lieux/index.json',
  'data/lieux/domicile.json',
  'lib/three/three.module.js',
  'lib/three/three.core.js',
  'lib/three/LICENSE',
  'assets/logo-omni-systeme.webp',
  'assets/icones/apple-touch-icon.png',
  'assets/icones/favicon-32.png',
  'assets/icones/icone-192.png',
  'assets/icones/icone-512.png',
  'assets/icones/icone-maskable-192.png',
  'assets/icones/icone-maskable-512.png',
  'assets/polices/atkinson-hyperlegible-next-latin-400-normal.woff2',
  'assets/polices/atkinson-hyperlegible-next-latin-700-normal.woff2',
  'assets/polices/atkinson-hyperlegible-next-latin-ext-400-normal.woff2',
  'assets/polices/atkinson-hyperlegible-next-latin-ext-700-normal.woff2',
  'assets/polices/opendyslexic-latin-400-normal.woff2',
  'assets/polices/opendyslexic-latin-700-normal.woff2',
  'assets/polices/LICENCE-Atkinson-Hyperlegible-Next.txt',
  'assets/polices/LICENCE-OpenDyslexic.txt',
];

// --- Installation : on copie tout ------------------------------------------
// « no-cache » : le navigateur redemande chaque fichier au serveur, qui
// répond « inchangé » (sans tout renvoyer) quand le fichier n'a pas bougé.
// On évite ainsi de ranger une vieille copie dans la nouvelle réserve.
self.addEventListener('install', (evenement) => {
  evenement.waitUntil((async () => {
    const reserve = await caches.open(RESERVE);
    await reserve.addAll(FICHIERS.map((fichier) => new Request(fichier, { cache: 'no-cache' })));
  })());
});

// --- Activation : on efface les anciennes réserves de CE jeu ---------------
self.addEventListener('activate', (evenement) => {
  evenement.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms
      .filter((nom) => nom.startsWith(PREFIXE) && nom !== RESERVE)
      .map((nom) => caches.delete(nom)));
    // Le service worker prend aussitôt en charge les pages ouvertes : dès la
    // première visite, le jeu est jouable hors ligne.
    await self.clients.claim();
  })());
});

// --- Chaque demande de fichier ---------------------------------------------
self.addEventListener('fetch', (evenement) => {
  const demande = evenement.request;
  if (demande.method !== 'GET') return;
  // Seulement les fichiers du jeu : les liens vers d'autres sites (les vraies
  // applications de Ferrus) ne passent jamais par ici.
  if (new URL(demande.url).origin !== self.location.origin) return;
  evenement.respondWith(repondre(demande));
});

async function repondre(demande) {
  const reserve = await caches.open(RESERVE);
  const copie = await reserve.match(demande, { ignoreSearch: true });
  if (copie) return copie;

  try {
    const reponse = await fetch(demande);
    // Plan B : un fichier absent de la liste est gardé pour la prochaine fois.
    if (reponse.ok && reponse.type === 'basic') {
      reserve.put(demande, reponse.clone());
    }
    return reponse;
  } catch (erreur) {
    // Sans connexion et sans copie : pour une page, on rend l'accueil du jeu ;
    // pour un autre fichier, un message clair plutôt qu'une erreur muette.
    if (demande.mode === 'navigate') {
      const accueil = (await reserve.match('index.html')) || (await reserve.match('./'));
      if (accueil) return accueil;
    }
    return new Response('Hors ligne : ce fichier n\'est pas disponible pour le moment.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

// --- Messages envoyés par le jeu -------------------------------------------
self.addEventListener('message', (evenement) => {
  const message = evenement.data || {};
  if (message.type === 'activer') {
    // Le joueur a touché « Mettre à jour » : la nouvelle version remplace
    // l'ancienne (le jeu se recharge ensuite).
    self.skipWaiting();
  } else if (message.type === 'version' && evenement.ports[0]) {
    // Le jeu demande quelle version ce service worker apporte.
    evenement.ports[0].postMessage({ version: CONFIG.version });
  }
});
