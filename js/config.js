// =============================================================================
// config.js — les réglages généraux du jeu
// -----------------------------------------------------------------------------
// C'est le SEUL endroit où changer le nom, la version, l'auteur ou le contact.
//
// Ce fichier est un script « classique » (pas un module) : il est lu à la fois
// par la page (index.html) et par le service worker (sw.js, via importScripts),
// qui s'en sert pour nommer sa copie hors ligne. Changer la version ici
// déclenche donc la mise à jour du jeu chez les joueurs.
// =============================================================================

self.CONFIG_JEU = Object.freeze({
  // Nom affiché partout (onglet, écran d'accueil, « À propos »…).
  // Attention : manifest.webmanifest contient aussi le nom (« name ») ;
  // un test vérifie que les deux restent identiques.
  nom: 'Atelier PWA',

  // Numéro de version : à augmenter à CHAQUE publication (ex. 0.1.0 → 0.1.1).
  // Sans ce changement, les joueurs gardent l'ancienne version.
  version: '0.5.0',

  // Auteur et contact affichés dans « À propos ».
  auteur: 'Ferrus Dantioch',
  contact: 'omni-systeme.choking513@passmail.net',
  siteOmni: 'https://ferrusdantioch.github.io/omni-systeme/',

  // Identifiant technique du stockage : préfixe de la base de données, des
  // réglages et des copies hors ligne. Toutes les applications de Ferrus
  // partagent la même adresse de base : ce préfixe évite qu'elles se mélangent.
  // NE JAMAIS LE CHANGER après la première publication : les parties déjà
  // enregistrées deviendraient invisibles.
  idStockage: 'atelier-pwa',
});
