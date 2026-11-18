// =============================================================================
// quetes.js — les quêtes : ce que les gens autour de toi attendent
// -----------------------------------------------------------------------------
// Une quête (data/quetes.json) est une petite histoire en étapes, écrite à
// l'avance. Elle commence toute seule dès que ses conditions sont remplies
// (« debloquee » : d'autres quêtes finies, des commandes livrées, un niveau
// de réputation), et se termine quand toutes ses étapes obligatoires sont
// faites : sa récompense est alors gagnée, une seule fois. Rien n'expire.
//
// Les étapes se font dans l'ordre. Une étape « facultative » ne bloque
// jamais : elle reste possible, même après la fin de la quête.
//
// Les types d'étapes (et leurs champs : js/noyau/schemas.js › CHAMPS_DES_ETAPES) :
//   demande     parler à la personne, qui présente sa commande de vive voix
//               (commande « enPersonne », voir commandes.js) ;
//   commande    livrer une commande (quelle que soit la note) ;
//   drapeau     un drapeau posé par le jeu (DRAPEAUX_D_ETAPES) ;
//   reputation  atteindre un niveau de réputation ;
//   parler      lui poser une question dans le dialogue (« question »),
//               elle répond (« replique ») ;
//   aller       s'approcher d'un meuble ou d'un endroit (« cible ») ; un
//               petit « message » dit ce qu'on y voit ;
//   acheter     (jalon 5) avoir acheté un « article », ou n'importe quel
//               article d'une « sorte » (meuble, materiel) ;
//   placer      (jalon 5) avoir posé un meuble acheté (un « article »
//               précis ou n'importe lequel), dans un « lieu » ou ailleurs.
// « parler » et « aller » sont des gestes du joueur, retenus au moment où il
// les fait ; les autres se constatent dans la partie.
//
// Une étape faite est retenue dans les drapeaux de la partie :
// « etape-<quête>-<étape> ». ⚠️ Ne jamais changer l'identifiant d'une quête
// ou d'une étape déjà publiée : les parties en cours le perdraient.
//
// Dans la partie (partie.quetes) :
//   actives  { [id]: { debut: { jour, minute } } }  les quêtes en cours ;
//   finies   [id, …]                                 dans l'ordre de fin ;
//   suivie   id ou null       la quête dont l'étape s'affiche en haut.
//
// JavaScript pur (sans page ni 3D) : testé par tests/quetes.test.mjs.
// =============================================================================

import { niveauDeReputation } from '../noyau/format-sauvegarde.js';
import {
  DRAPEAU_VISIO_ACCUEIL, ID_BUREAU, commandeDebloquee, commandesAProposer, drapeauDeProposition,
} from './commandes.js';
import { gagner } from './economie.js';

// Les étapes qui se constatent dans la partie (les autres sont des gestes).
const CONSTATEES = new Set(['demande', 'commande', 'drapeau', 'reputation', 'acheter', 'placer']);

// La « destination » d'une étape « placer » : le mode Aménager.
export const DESTINATION_AMENAGER = 'amenager';

// Posé quand on choisit un texte plus grand dans l'atelier (atelier.js).
export const DRAPEAU_TEXTE_AGRANDI = 'atelier-texte-agrandi';

// Les drapeaux qu'une étape « drapeau » peut attendre : chacun est posé
// quelque part par le jeu (sinon la quête attendrait pour toujours).
export const DRAPEAUX_D_ETAPES = [DRAPEAU_VISIO_ACCUEIL, DRAPEAU_TEXTE_AGRANDI];

export function drapeauDEtape(quete, etape) {
  return `etape-${quete.id}-${etape.id}`;
}

const livree = (partie, id) => partie.commandes.livrees.some((livraison) => livraison.id === id);

// L'étape est-elle remplie, d'après l'état de la partie ?
function constatee(etape, partie, paliers) {
  switch (etape.type) {
    case 'demande':
      // Présentée de vive voix, ou déjà acceptée, ou déjà livrée (une partie
      // d'une ancienne version a pu la recevoir autrement).
      return Boolean(partie.drapeaux[drapeauDeProposition({ id: etape.commande })])
        || Boolean(partie.commandes.enCours[etape.commande]) || livree(partie, etape.commande);
    case 'commande':
      return livree(partie, etape.commande);
    case 'drapeau':
      return Boolean(partie.drapeaux[etape.drapeau]);
    case 'reputation':
      return niveauDeReputation(partie.reputation, paliers).niveau >= etape.niveau;
    case 'acheter':
      return (partie.possessions || []).some((possession) => (!etape.article || possession.article === etape.article)
        && (!etape.sorte || possession.sorte === etape.sorte));
    case 'placer': {
      const possessions = new Map((partie.possessions || []).map((possession) => [possession.id, possession]));
      return Object.entries(partie.lieux?.amenagements || {}).some(([lieu, places]) => (!etape.lieu || lieu === etape.lieu)
        && places.some((place) => {
          const possession = possessions.get(place.id);
          return Boolean(possession) && (!etape.article || possession.article === etape.article);
        }));
    }
    default:
      return false;
  }
}

export function etapeFaite(quete, etape, partie, paliers) {
  return Boolean(partie.drapeaux[drapeauDEtape(quete, etape)])
    || (CONSTATEES.has(etape.type) && constatee(etape, partie, paliers));
}

// 'future' (pas encore commencée), 'active' ou 'finie'.
export function etatDeQuete(quete, partie) {
  if (partie.quetes.finies.includes(quete.id)) return 'finie';
  if (partie.quetes.actives[quete.id]) return 'active';
  return 'future';
}

/**
 * Les étapes d'une quête et où elles en sont : [{ etape, faite, ouverte }].
 * « ouverte » : elle peut se faire maintenant (la quête a commencé, et les
 * étapes obligatoires d'avant sont faites).
 */
export function etapesDeQuete(quete, partie, paliers) {
  const commencee = etatDeQuete(quete, partie) !== 'future';
  let precedentesFaites = commencee;
  return quete.etapes.map((etape) => {
    const faite = commencee && etapeFaite(quete, etape, partie, paliers);
    const ouverte = precedentesFaites && !faite;
    if (!etape.facultative && !faite) precedentesFaites = false;
    return { etape, faite, ouverte };
  });
}

// La première étape obligatoire pas encore faite (null si toutes le sont).
export function etapeCourante(quete, partie, paliers) {
  return etapesDeQuete(quete, partie, paliers).find((ligne) => !ligne.faite && !ligne.etape.facultative) || null;
}

export function queteDebloquee(quete, partie, paliers) {
  const condition = quete.debloquee || {};
  if (condition.drapeau && !partie.drapeaux[condition.drapeau]) return false;
  if ((condition.quetes || []).some((id) => !partie.quetes.finies.includes(id))) return false;
  if ((condition.commandes || []).some((id) => !livree(partie, id))) return false;
  if (condition.niveau && niveauDeReputation(partie.reputation, paliers).niveau < condition.niveau) return false;
  return true;
}

/**
 * Fait avancer les quêtes d'après l'état de la partie (modifiée sur place) :
 *   - une quête débloquée commence (ce qui est déjà fait compte, sans bruit) ;
 *   - une étape constatée est retenue ;
 *   - une quête dont les étapes obligatoires sont faites se termine, et sa
 *     récompense est gagnée (une seule fois) ; d'autres peuvent alors
 *     commencer ;
 *   - la quête suivie reste une quête en cours (sinon : la première).
 * Renvoie ce qui s'est passé, pour l'annoncer :
 *   { type: 'nouvelle', quete }
 *   { type: 'etape', quete, etape }
 *   { type: 'finie', quete, niveauAvant, niveauApres, nomNiveau }
 */
export function mettreAJourQuetes(partie, quetes, paliers) {
  const evenements = [];
  let encore = true;
  for (let tour = 0; encore && tour <= quetes.length + 1; tour += 1) {
    encore = false;
    for (const quete of quetes) {
      if (etatDeQuete(quete, partie) === 'future') {
        if (!queteDebloquee(quete, partie, paliers)) continue;
        partie.quetes.actives[quete.id] = { debut: { jour: partie.temps.jour, minute: partie.temps.minute } };
        for (const etape of quete.etapes) {
          if (CONSTATEES.has(etape.type) && constatee(etape, partie, paliers)) partie.drapeaux[drapeauDEtape(quete, etape)] = true;
        }
        evenements.push({ type: 'nouvelle', quete });
        encore = true;
      }
      // Les étapes constatées (même les facultatives d'une quête finie).
      for (const etape of quete.etapes) {
        const drapeau = drapeauDEtape(quete, etape);
        if (partie.drapeaux[drapeau] || !CONSTATEES.has(etape.type) || !constatee(etape, partie, paliers)) continue;
        partie.drapeaux[drapeau] = true;
        evenements.push({ type: 'etape', quete, etape });
      }
      if (etatDeQuete(quete, partie) === 'active' && !etapeCourante(quete, partie, paliers)) {
        delete partie.quetes.actives[quete.id];
        partie.quetes.finies.push(quete.id);
        evenements.push({ type: 'finie', quete, ...gagner(partie, quete.recompense, paliers) });
        encore = true;
      }
    }
  }
  if (!partie.quetes.suivie || !partie.quetes.actives[partie.quetes.suivie]) {
    partie.quetes.suivie = quetes.find((quete) => partie.quetes.actives[quete.id])?.id || null;
  }
  // Une quête commencée et finie d'un coup (partie d'une ancienne version) :
  // seule sa fin est annoncée.
  const finies = new Set(evenements.filter((e) => e.type === 'finie').map((e) => e.quete.id));
  return evenements.filter((e) => !(e.type === 'nouvelle' && finies.has(e.quete.id)));
}

/**
 * Le joueur vient de faire une étape « parler » ou « aller » : elle est
 * retenue si elle était ouverte. Renvoie [{ type: 'etape', quete, etape }]
 * (ou [] si elle ne l'était pas). Appeler ensuite mettreAJourQuetes().
 */
export function faireEtape(partie, quete, etape, paliers) {
  const ligne = etapesDeQuete(quete, partie, paliers).find((l) => l.etape.id === etape.id);
  if (!ligne?.ouverte) return [];
  partie.drapeaux[drapeauDEtape(quete, etape)] = true;
  return [{ type: 'etape', quete, etape }];
}

// Les étapes ouvertes d'un type donné, qui répondent à « garder(etape) ».
function etapesOuvertes(partie, quetes, paliers, type, garder) {
  const resultat = [];
  for (const quete of quetes) {
    for (const { etape, ouverte } of etapesDeQuete(quete, partie, paliers)) {
      if (ouverte && etape.type === type && garder(etape)) resultat.push({ quete, etape });
    }
  }
  return resultat;
}

// Les questions à poser à cette personne pour faire avancer une quête.
export function sujetsPour(partie, quetes, idPnj, paliers) {
  return etapesOuvertes(partie, quetes, paliers, 'parler', (etape) => etape.pnj === idPnj);
}

// Les étapes « aller » qui attendent qu'on s'approche de cette cible.
export function etapesVers(partie, quetes, cible, paliers) {
  return etapesOuvertes(partie, quetes, paliers, 'aller', (etape) => etape.cible === cible);
}

// Où se joue une étape : un meuble, un endroit ou une personne (son id).
export function destinationDEtape(etape, commandes) {
  switch (etape.type) {
    case 'demande': return commandes.find((commande) => commande.id === etape.commande)?.client || null;
    case 'commande':
    case 'reputation':
    case 'acheter': return ID_BUREAU;
    case 'placer': return DESTINATION_AMENAGER;
    case 'drapeau': return etape.destination || null;
    case 'parler': return etape.pnj;
    case 'aller': return etape.cible;
    default: return null;
  }
}

/**
 * L'objectif affiché en haut de l'écran : l'étape en cours de la quête
 * suivie (ou d'une autre quête en cours, « id »). Renvoie null si elle
 * n'est pas en cours, sinon { quete, etape, destination, cle?, commande? }.
 * Pour une étape « commande », « cle » dit où en est la commande
 * (data/textes.json › objectifs : accepter, terminer, retravailler,
 * parler) ; sans « cle », on affiche le texte de l'étape.
 */
export function objectifDeQuete(partie, { quetes, commandes, paliers }, id = partie.quetes.suivie) {
  const quete = quetes.find((q) => q.id === id && partie.quetes.actives[q.id]);
  if (!quete) return null;
  const courante = etapeCourante(quete, partie, paliers);
  if (!courante) return null;
  const { etape } = courante;
  const objectif = { quete, etape, destination: destinationDEtape(etape, commandes) };
  if (etape.type !== 'commande') return objectif;
  const commande = commandes.find((c) => c.id === etape.commande);
  if (!commande) return objectif;
  const projet = partie.commandes.enCours[commande.id];
  if (projet) return { ...objectif, commande, cle: projet.resultat === 'aRetravailler' ? 'retravailler' : 'terminer' };
  if (commandeDebloquee(commande, partie, paliers)) return { ...objectif, commande, cle: 'accepter' };
  if (commandesAProposer(partie, [commande], paliers).length > 0) {
    return { ...objectif, commande, cle: 'parler', destination: commande.client };
  }
  return objectif;
}

// Une « empreinte » de tout ce qui peut faire avancer les quêtes. Si elle
// n'a pas changé, inutile de tout revérifier (le temps qui passe, les pas
// du personnage n'y changent rien).
export function empreinteDesQuetes(partie) {
  return [
    Object.keys(partie.drapeaux).length,
    partie.commandes.livrees.length,
    Object.keys(partie.commandes.enCours).join(','),
    partie.reputation,
    partie.quetes.finies.length,
    Object.keys(partie.quetes.actives).join(','),
    partie.quetes.suivie,
    (partie.possessions || []).length,
    Object.values(partie.lieux?.amenagements || {}).map((places) => places.length).join(','),
  ].join('|');
}
