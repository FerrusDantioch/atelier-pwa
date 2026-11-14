// =============================================================================
// avant-affichage.js — applique les réglages d'affichage AVANT le premier dessin
// -----------------------------------------------------------------------------
// Ce petit script « classique » est chargé tout en haut de la page, avant les
// feuilles de style. Il lit les réglages enregistrés (thème, taille du texte,
// contraste…) et les pose sur la balise <html> sous forme d'attributs
// (data-theme="clair", data-texte="3"…). Les feuilles de style s'en servent.
//
// Sans lui, la page s'afficherait une fraction de seconde avec le mauvais
// thème ou la mauvaise taille de texte (un « éclair » désagréable).
//
// Il est dans un fichier séparé (et non écrit dans index.html) pour respecter
// la règle de sécurité de la page (CSP), qui interdit les scripts écrits
// directement dans le HTML.
//
// La fonction appliquerReglagesAffichage() est aussi utilisée par le reste du
// jeu (js/noyau/reglages.js) quand on change un réglage : un seul endroit sait
// comment les réglages se traduisent sur la page.
// =============================================================================

(function () {
  'use strict';

  var CLE = self.CONFIG_JEU.idStockage + '.reglages';

  // Valeurs acceptées pour chaque attribut (toute autre valeur est ignorée).
  var PERMIS = {
    theme: ['omni', 'sombre', 'clair', 'auto'],
    texte: ['1', '2', '3', '4'],
    contraste: ['normal', 'eleve'],
    police: ['lisible', 'dyslexie', 'systeme'],
    espacement: ['normal', 'aere'],
    animations: ['auto', 'reduites', 'normales'],
    daltonisme: ['aucun', 'rouge-vert', 'bleu-jaune'],
  };

  var sombreDemande = self.matchMedia ? self.matchMedia('(prefers-color-scheme: dark)') : null;
  var calmeDemande = self.matchMedia ? self.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var derniersReglages = {};

  function permis(nom, valeur) {
    var texte = String(valeur);
    return PERMIS[nom].indexOf(texte) !== -1 ? texte : null;
  }

  // « auto » suit le réglage de l'appareil (mode sombre, animations réduites).
  function themeEffectif(theme) {
    if (theme !== 'auto') return theme;
    return sombreDemande && !sombreDemande.matches ? 'clair' : 'sombre';
  }

  function animationsEffectives(animations) {
    if (animations !== 'auto') return animations;
    return calmeDemande && calmeDemande.matches ? 'reduites' : 'normales';
  }

  function appliquer(reglages) {
    derniersReglages = reglages || {};
    var racine = document.documentElement;
    var attributs = {
      theme: permis('theme', derniersReglages.theme || 'omni'),
      texte: permis('texte', derniersReglages.texte || 1),
      contraste: permis('contraste', derniersReglages.contraste || 'normal'),
      police: permis('police', derniersReglages.police || 'lisible'),
      espacement: permis('espacement', derniersReglages.espacement || 'normal'),
      animations: permis('animations', derniersReglages.animations || 'auto'),
      daltonisme: permis('daltonisme', derniersReglages.daltonisme || 'aucun'),
    };
    if (attributs.theme) attributs.theme = themeEffectif(attributs.theme);
    if (attributs.animations) attributs.animations = animationsEffectives(attributs.animations);
    for (var nom in attributs) {
      if (attributs[nom]) racine.setAttribute('data-' + nom, attributs[nom]);
    }
  }

  // Si l'appareil passe en mode sombre ou réduit ses animations pendant le
  // jeu, les réglages « auto » suivent aussitôt.
  function suivreAppareil(demande) {
    if (!demande) return;
    var reagir = function () { appliquer(derniersReglages); };
    if (demande.addEventListener) demande.addEventListener('change', reagir);
    else if (demande.addListener) demande.addListener(reagir);
  }

  var enregistres = {};
  try {
    var texte = self.localStorage.getItem(CLE);
    if (texte) enregistres = JSON.parse(texte) || {};
  } catch (erreur) {
    // Stockage indisponible (navigation privée…) ou réglages abîmés :
    // on garde les réglages par défaut, le jeu reste utilisable.
    enregistres = {};
  }

  appliquer(enregistres);
  suivreAppareil(sombreDemande);
  suivreAppareil(calmeDemande);

  self.appliquerReglagesAffichage = appliquer;
})();
