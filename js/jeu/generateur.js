// =============================================================================
// generateur.js — les commandes du jour, assemblées au hasard
// -----------------------------------------------------------------------------
// Une fois l'atelier reconnu (data/modeles-commandes.json › debloquee),
// chaque matin apporte de nouvelles commandes, assemblées à partir de
// « briques » : une personne (clients), un sujet (ce dont elle a besoin),
// une contrainte (une chose à éviter, un réglage de confort ou une charge
// maximale) et une récompense. Seules les associations qu'on peut réussir
// « parfaitement » sont tirées.
//
// Le tirage dépend de la graine de la partie et du jour : le même jour
// d'une même partie donne toujours les mêmes commandes (pas de hasard caché,
// rien ne change si l'on recharge la partie).
//
// Rien n'expire, sauf ces offres-là : une commande du jour qu'on n'accepte
// pas laisse sa place le lendemain. Une commande acceptée est recopiée dans
// la partie (commandes.js › accepterCommande) et reste jusqu'à sa livraison.
//
// JavaScript pur (sans page ni 3D) : testé par tests/generateur.test.mjs.
// =============================================================================

import { choisirDans, combinerGraines, creerHasard, entierEntre } from '../noyau/hasard.js';
import { PREFIXE_DU_JOUR, commandeDebloquee } from './commandes.js';
import { meilleurProjet } from './creation.js';

// Un nombre mélangé à la graine, pour que ce tirage ne ressemble à aucun autre.
const SEL = 0x6a6f7572;

// Ce que donnent un sujet et une contrainte (sans personne ni récompense).
function assembler(sujet, contrainte) {
  const commande = {
    titre: sujet.titre,
    resume: sujet.resume,
    demande: sujet.demande,
    besoins: sujet.besoins,
    bonus: sujet.bonus,
    aEviter: contrainte.aEviter ? [contrainte.aEviter] : [],
    confort: contrainte.confort ? [contrainte.confort] : [],
  };
  if (Number.isInteger(contrainte.chargeMax)) commande.chargeMax = contrainte.chargeMax;
  if (sujet.apercu) commande.apercu = sujet.apercu;
  return commande;
}

/**
 * Les associations sujet + contrainte qu'on peut réussir « parfaitement » :
 * la contrainte ne doit pas interdire ce que le sujet demande, et la charge
 * doit tenir. Renvoie [{ sujet, contraintes: [...] }] (les sujets sans
 * aucune contrainte possible sont laissés de côté).
 */
export function associationsPossibles(modeles, creation) {
  const resultat = [];
  for (const sujet of modeles.sujets) {
    const demandes = new Set([...sujet.besoins, ...sujet.bonus].map((attente) => attente.apporte));
    const contraintes = modeles.contraintes.filter((contrainte) => {
      if (contrainte.aEviter && demandes.has(contrainte.aEviter.apporte)) return false;
      const essai = {
        id: 'essai', client: 'essai', ...assembler(sujet, contrainte), recompense: { argent: 1, reputation: 1, bonus: 0 },
      };
      return Boolean(meilleurProjet(essai, creation));
    });
    if (contraintes.length > 0) resultat.push({ sujet, contraintes });
  }
  return resultat;
}

// Les associations ne changent pas pendant le jeu : calculées une seule fois.
const enMemoire = new WeakMap();
function associations(modeles, creation) {
  if (!enMemoire.has(modeles)) enMemoire.set(modeles, associationsPossibles(modeles, creation));
  return enMemoire.get(modeles);
}

/**
 * Les commandes proposées un jour donné d'une partie : « nombre » commandes
 * (« parJour » par défaut), chacune avec une personne et un sujet
 * différents. Leurs identifiants : « jour-<jour>-<numéro> ». Les premières
 * ne dépendent pas du nombre : une commande en plus s'ajoute aux autres
 * sans les changer.
 */
export function commandesDuJour({ graine, jour, nombre = null }, modeles, creation) {
  const combien = nombre ?? modeles.parJour;
  const hasard = creerHasard(combinerGraines(graine, jour, SEL));
  const sujets = [...associations(modeles, creation)];
  const clients = [...modeles.clients];
  const [argentMin, argentMax] = modeles.recompense.argent;
  const [reputationMin, reputationMax] = modeles.recompense.reputation;
  const resultat = [];
  for (let numero = 1; numero <= combien && sujets.length > 0 && clients.length > 0; numero += 1) {
    const { sujet, contraintes } = sujets.splice(Math.floor(hasard() * sujets.length), 1)[0];
    const contrainte = choisirDans(hasard, contraintes);
    const client = clients.splice(Math.floor(hasard() * clients.length), 1)[0];
    resultat.push({
      id: `${PREFIXE_DU_JOUR}${jour}-${numero}`,
      client: client.id,
      ...assembler(sujet, contrainte),
      recompense: {
        // Des montants ronds (de 5 en 5).
        argent: 5 * entierEntre(hasard, Math.ceil(argentMin / 5), Math.floor(argentMax / 5)),
        reputation: entierEntre(hasard, reputationMin, reputationMax),
        bonus: modeles.recompense.bonus,
      },
      reactions: {
        parfait: choisirDans(hasard, modeles.reactions.parfait),
        bien: choisirDans(hasard, modeles.reactions.bien),
        aRetravailler: choisirDans(hasard, modeles.reactions.aRetravailler),
      },
    });
  }
  return resultat;
}

// Les commandes du jour ont-elles commencé ? (Mêmes conditions qu'une
// commande : drapeau, commandes livrées, niveau de réputation.)
export function commandesDuJourOuvertes(partie, modeles, paliers) {
  return Boolean(modeles) && commandeDebloquee({ debloquee: modeles.debloquee }, partie, paliers);
}

// Combien de commandes du jour : « parJour », et quelques-unes de plus une
// fois les bureaux loués (« enPlus », jalon 5).
export function nombreDuJour(partie, modeles) {
  const enPlus = modeles.enPlus && partie.lieux?.debloques?.includes(modeles.enPlus.lieu) ? modeles.enPlus.parJour : 0;
  return modeles.parJour + enPlus;
}

// Les offres d'aujourd'hui qui ne sont ni acceptées ni livrées.
export function offresDuJour(partie, modeles, creation, paliers) {
  if (!commandesDuJourOuvertes(partie, modeles, paliers)) return [];
  const prises = new Set([
    ...Object.keys(partie.commandes.aleatoires),
    ...partie.commandes.livrees.map((livraison) => livraison.id),
  ]);
  return commandesDuJour({ graine: partie.graine, jour: partie.temps.jour, nombre: nombreDuJour(partie, modeles) }, modeles, creation)
    .filter((commande) => !prises.has(commande.id));
}

/**
 * Toutes les commandes que la partie connaît, dans cet ordre : celles de
 * data/commandes.json, les commandes du jour acceptées (en cours ou
 * livrées), puis les offres du jour.
 *   donnees : { commandes, modelesCommandes, creation, jeu } (voir donnees.js)
 */
export function commandesConnues(partie, donnees) {
  return [
    ...donnees.commandes.commandes,
    ...Object.values(partie.commandes.aleatoires),
    ...offresDuJour(partie, donnees.modelesCommandes, donnees.creation, donnees.jeu.reputation.paliers),
  ];
}
