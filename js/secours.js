// =============================================================================
// secours.js — l'écran de secours si le jeu n'arrive pas à démarrer
// -----------------------------------------------------------------------------
// Script « classique », chargé avant le jeu. Il surveille le démarrage :
// si une erreur survient avant que le jeu soit prêt (fichier manquant,
// fichier de données mal écrit…), il remplace l'écran « Chargement… » par un
// message clair, avec le détail du problème et un bouton « Recharger ».
//
// Le texte de cet écran est écrit dans index.html (et non dans
// data/textes.json) : il doit pouvoir s'afficher même si les données du jeu
// ne se chargent pas.
//
// Une fois le jeu prêt (atelierDemarrageReussi), les erreurs éventuelles ne
// remplacent plus l'écran : elles sont seulement notées dans la console.
// =============================================================================

(function () {
  'use strict';

  var pret = false;
  var erreurEnAttente = null;
  var DELAI_MAXIMUM = 45000; // 45 secondes : large, même avec une connexion lente.

  function afficherMaintenant(detail) {
    if (pret) return;
    var ecran = document.getElementById('erreur-demarrage');
    var zoneDetail = document.getElementById('erreur-detail');
    var chargement = document.getElementById('chargement');
    var interfaceJeu = document.getElementById('interface');
    if (!ecran) return false;
    if (zoneDetail) zoneDetail.textContent = String(detail || 'Erreur inconnue.');
    if (chargement) chargement.hidden = true;
    if (interfaceJeu) interfaceJeu.hidden = true;
    ecran.hidden = false;
    return true;
  }

  function montrer(detail) {
    if (pret) return;
    if (afficherMaintenant(detail)) return;
    // L'erreur s'est produite avant que le corps de la page soit lu : on
    // l'affichera dès que les éléments HTML existeront.
    if (erreurEnAttente === null) {
      document.addEventListener('DOMContentLoaded', function () {
        if (erreurEnAttente !== null) afficherMaintenant(erreurEnAttente);
      }, { once: true });
    }
    erreurEnAttente = detail;
  }

  // Erreurs du code, et fichiers (scripts, styles) qui n'ont pas pu se charger.
  function surErreur(evenement) {
    var cible = evenement.target;
    if (cible && cible !== self && (cible.src || cible.href)) {
      montrer('Fichier introuvable : ' + (cible.src || cible.href));
      return;
    }
    var lieu = evenement.filename ? ' (' + evenement.filename + ', ligne ' + evenement.lineno + ')' : '';
    montrer((evenement.message || 'Erreur') + lieu);
  }

  function surRejet(evenement) {
    var raison = evenement.reason;
    montrer((raison && (raison.message || raison)) || 'Erreur inconnue.');
  }

  self.addEventListener('error', surErreur, true);
  self.addEventListener('unhandledrejection', surRejet);

  var minuteur = setTimeout(function () {
    montrer('Le démarrage prend trop de temps. Vérifie la connexion, puis recharge la page.');
  }, DELAI_MAXIMUM);

  // Appelé par js/main.js quand tout est prêt.
  // Si le message « trop long » s'était affiché, le jeu reprend sa place.
  self.atelierDemarrageReussi = function () {
    pret = true;
    erreurEnAttente = null;
    clearTimeout(minuteur);
    self.removeEventListener('error', surErreur, true);
    self.removeEventListener('unhandledrejection', surRejet);
    var ecran = document.getElementById('erreur-demarrage');
    var interfaceJeu = document.getElementById('interface');
    if (ecran) ecran.hidden = true;
    if (interfaceJeu) interfaceJeu.hidden = false;
  };

  // Appelé par js/main.js quand il sait ce qui ne va pas (ex. données invalides).
  self.atelierEchecDemarrage = montrer;
})();
