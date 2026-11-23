// =============================================================================
// format-sauvegarde.js — la forme d'une partie enregistrée
// -----------------------------------------------------------------------------
// Une partie est un simple objet, rangé dans le navigateur (IndexedDB) et
// exportable dans un fichier JSON de la même forme. Ce module sait :
//   - créer une nouvelle partie ;
//   - vérifier qu'une partie est bien formée ;
//   - mettre à niveau une partie enregistrée par une ancienne version du jeu ;
//   - lire un fichier importé, en refusant poliment ce qui n'est pas une partie.
//
// Il n'utilise ni la page ni le navigateur (testé par tests/sauvegarde.test.js).
//
// ⚠️ Si la forme change (nouveau champ obligatoire…), augmenter VERSION_FORMAT
// et ajouter une étape dans MIGRATIONS : les anciennes parties restent lisibles.
// =============================================================================

import { SCHEMA_COMMANDE } from './schemas.js';
import { verifier } from './verification.js';

export const FORMAT = 'atelier-pwa-partie';
export const VERSION_FORMAT = 4;

// Taille maximale d'un fichier importé (une partie fait quelques kilo-octets).
export const TAILLE_MAXIMALE_IMPORT = 5 * 1024 * 1024;

// « 08:30 » → 510 minutes depuis minuit.
export function heureEnMinutes(heure) {
  const [h, m] = heure.split(':').map(Number);
  return h * 60 + m;
}

// Une partie toute neuve, à partir des valeurs de départ de data/jeu.json.
// joueur : le personnage choisi (voir js/jeu/personnage.js).
export function nouvellePartie({ graine, depart, versionJeu, joueur = null, maintenant = new Date() }) {
  const date = maintenant.toISOString();
  return {
    format: FORMAT,
    versionFormat: VERSION_FORMAT,
    versionJeu,
    creeeLe: date,
    enregistreeLe: date,
    graine: graine >>> 0,
    joueur,
    temps: { jour: depart.jour, minute: heureEnMinutes(depart.heure) },
    argent: depart.argent,
    reputation: depart.reputation,
    quetes: { actives: {}, finies: [], suivie: null },
    // aleatoires : les commandes du jour acceptées, recopiées (jalon 4).
    commandes: { enCours: {}, livrees: [], aleatoires: {} },
    // Les achats (jalon 5, voir js/jeu/boutique.js) et les meubles posés
    // dans chaque lieu (js/jeu/amenagement.js).
    possessions: [],
    lieux: { actuel: depart.lieu, debloques: [depart.lieu], amenagements: {} },
    drapeaux: {},
    // La caméra : rotation (0 à 3, par quarts de tour) et zoom (en pixels
    // par mètre ; null = zoom de départ adapté à l'écran).
    vue: { rotation: 0, zoom: null },
  };
}

// --- Vérification -----------------------------------------------------------

const estObjet = (valeur) => typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);
const estEntier = (valeur, min = 0) => Number.isInteger(valeur) && valeur >= min;
const estListeDeTextes = (valeur) => Array.isArray(valeur) && valeur.every((v) => typeof v === 'string');
const estNombre = (valeur) => typeof valeur === 'number' && Number.isFinite(valeur);

// Le joueur : null (pas encore choisi) ou { modele, nom, apparence, position }.
// Les valeurs de l'apparence sont vérifiées plus tard, à l'usage
// (js/jeu/personnage.js remplace une valeur inconnue par celle par défaut).
function joueurValide(joueur) {
  if (joueur === null) return true;
  if (!estObjet(joueur)) return false;
  const position = joueur.position;
  return ['ferrus', 'perso'].includes(joueur.modele)
    && typeof joueur.nom === 'string' && joueur.nom.length <= 200
    && (joueur.apparence === null || (estObjet(joueur.apparence)
      && Object.values(joueur.apparence).every((valeur) => typeof valeur === 'string')))
    && (position === null || (estObjet(position) && estEntier(position.x) && estEntier(position.z)
      && estNombre(position.angle)));
}

// Un projet d'application en cours (jalon 3, voir js/jeu/creation.js). Les
// identifiants inconnus (modèle, fonctions) sont ignorés à l'usage.
function projetValide(projet) {
  return estObjet(projet)
    && estObjet(projet.acceptee) && estEntier(projet.acceptee.jour, 1) && estEntier(projet.acceptee.minute)
    && (projet.modele === null || typeof projet.modele === 'string')
    && estListeDeTextes(projet.fonctions)
    && estObjet(projet.confort) && Object.values(projet.confort).every((valeur) => typeof valeur === 'string')
    && estEntier(projet.essais)
    && (projet.resultat === null || projet.resultat === 'aRetravailler');
}

// Une commande livrée : sa note et ce qu'elle a rapporté.
function livraisonValide(livraison) {
  return estObjet(livraison) && typeof livraison.id === 'string'
    && ['parfait', 'bien'].includes(livraison.note)
    && estEntier(livraison.jour, 1) && estEntier(livraison.argent) && estEntier(livraison.reputation);
}

// Une commande du jour acceptée, recopiée dans la partie : elle doit avoir
// la forme d'une commande, et son identifiant celui d'une commande du jour.
function commandeDuJourValide(id, commande) {
  return estObjet(commande) && commande.id === id && id.startsWith('jour-')
    && verifier(commande, SCHEMA_COMMANDE).length === 0;
}

// Un achat (jalon 5) : { id: 'achat-3', article, sorte, jour, prix }. Un
// article inconnu (retiré des données) est ignoré à l'usage.
const ID_ACHAT = /^achat-\d+$/;
function possessionValide(possession) {
  return estObjet(possession) && typeof possession.id === 'string' && ID_ACHAT.test(possession.id)
    && typeof possession.article === 'string' && ['meuble', 'materiel', 'lieu', 'piece'].includes(possession.sorte)
    && estEntier(possession.jour, 1) && estEntier(possession.prix);
}

function possessionsValides(possessions) {
  if (!Array.isArray(possessions) || !possessions.every(possessionValide)) return false;
  return new Set(possessions.map((possession) => possession.id)).size === possessions.length;
}

// Les meubles posés : { lieu: [{ id, x, z, rotation }] }. Chacun est un
// meuble acheté, posé une seule fois.
function amenagementsValides(amenagements, possessions) {
  if (!estObjet(amenagements)) return false;
  const meubles = new Set((Array.isArray(possessions) ? possessions : [])
    .filter((possession) => possession?.sorte === 'meuble').map((possession) => possession.id));
  const poses = new Set();
  return Object.values(amenagements).every((places) => Array.isArray(places) && places.every((place) => {
    const valide = estObjet(place) && meubles.has(place.id) && !poses.has(place.id)
      && estEntier(place.x) && estEntier(place.z) && [0, 90, 180, 270].includes(place.rotation);
    if (valide) poses.add(place.id);
    return valide;
  }));
}

// Une quête en cours : depuis quand.
function queteActiveValide(quete) {
  return estObjet(quete) && estObjet(quete.debut) && estEntier(quete.debut.jour, 1) && estEntier(quete.debut.minute);
}

// Renvoie la liste des problèmes (vide si la partie est bien formée).
export function verifierPartie(partie) {
  const problemes = [];
  const exiger = (condition, message) => { if (!condition) problemes.push(message); };
  if (!estObjet(partie)) return ['la partie n\'est pas un objet'];
  exiger(partie.format === FORMAT, 'format inconnu');
  exiger(estEntier(partie.versionFormat, 1), 'versionFormat invalide');
  exiger(typeof partie.versionJeu === 'string', 'versionJeu invalide');
  exiger(typeof partie.creeeLe === 'string', 'creeeLe invalide');
  exiger(typeof partie.enregistreeLe === 'string', 'enregistreeLe invalide');
  exiger(estEntier(partie.graine), 'graine invalide');
  exiger(joueurValide(partie.joueur), 'joueur invalide');
  exiger(estObjet(partie.temps) && estEntier(partie.temps.jour, 1)
    && estEntier(partie.temps.minute) && partie.temps.minute < 24 * 60, 'temps invalide');
  exiger(estEntier(partie.argent), 'argent invalide');
  exiger(estEntier(partie.reputation), 'reputation invalide');
  exiger(estObjet(partie.quetes) && estObjet(partie.quetes.actives)
    && Object.values(partie.quetes.actives).every(queteActiveValide)
    && estListeDeTextes(partie.quetes.finies)
    && (partie.quetes.suivie === null || typeof partie.quetes.suivie === 'string'), 'quetes invalides');
  exiger(estObjet(partie.commandes) && estObjet(partie.commandes.enCours)
    && Object.values(partie.commandes.enCours).every(projetValide)
    && Array.isArray(partie.commandes.livrees) && partie.commandes.livrees.every(livraisonValide)
    && estObjet(partie.commandes.aleatoires)
    && Object.entries(partie.commandes.aleatoires).every(([id, commande]) => commandeDuJourValide(id, commande)), 'commandes invalides');
  exiger(possessionsValides(partie.possessions), 'possessions invalides');
  exiger(estObjet(partie.lieux) && typeof partie.lieux.actuel === 'string'
    && estListeDeTextes(partie.lieux.debloques)
    && partie.lieux.debloques.includes(partie.lieux.actuel)
    && amenagementsValides(partie.lieux.amenagements, partie.possessions), 'lieux invalides');
  exiger(estObjet(partie.drapeaux), 'drapeaux invalides');
  exiger(estObjet(partie.vue) && estEntier(partie.vue.rotation) && partie.vue.rotation <= 3
    && (partie.vue.zoom === null || (estNombre(partie.vue.zoom) && partie.vue.zoom > 0)), 'vue invalide');
  return problemes;
}

// --- Mise à niveau des anciennes parties -----------------------------------
// MIGRATIONS[n] transforme une partie au format n en partie au format n + 1.
const MIGRATIONS = {
  // Format 1 (jalon 0) → 2 (jalon 1) : la caméra est gardée dans la partie.
  // Le joueur restait à null au jalon 0 : il sera choisi en reprenant la partie.
  1: (partie) => ({ ...partie, vue: { rotation: 0, zoom: null } }),
  // Format 2 → 3 (jalon 4) : les commandes du jour acceptées sont gardées.
  // Les quêtes commencent toutes seules en reprenant la partie : ce qui est
  // déjà fait (commandes livrées…) compte.
  2: (partie) => ({
    ...partie,
    commandes: estObjet(partie.commandes) ? { ...partie.commandes, aleatoires: {} } : partie.commandes,
  }),
  // Format 3 → 4 (jalon 5) : les achats deviennent des fiches (article,
  // sorte, jour, prix), et les meubles posés sont rangés par lieu. Rien ne
  // pouvait s'acheter avant : les listes repartent vides.
  3: (partie) => ({
    ...partie,
    possessions: [],
    lieux: estObjet(partie.lieux) ? { ...partie.lieux, amenagements: {} } : partie.lieux,
  }),
};

export class ErreurSauvegarde extends Error {
  // code : clé du message à afficher (data/textes.json › sauvegarde.erreurs)
  constructor(code, details = '') {
    super(`${code}${details ? ` : ${details}` : ''}`);
    this.name = 'ErreurSauvegarde';
    this.code = code;
    this.details = details;
  }
}

export function migrerPartie(partie) {
  let actuelle = partie;
  if (!estEntier(actuelle?.versionFormat, 1)) throw new ErreurSauvegarde('abimee', 'versionFormat');
  if (actuelle.versionFormat > VERSION_FORMAT) throw new ErreurSauvegarde('tropRecente');
  while (actuelle.versionFormat < VERSION_FORMAT) {
    const etape = MIGRATIONS[actuelle.versionFormat];
    if (!etape) throw new ErreurSauvegarde('abimee', `pas de migration depuis ${actuelle.versionFormat}`);
    actuelle = { ...etape(actuelle), versionFormat: actuelle.versionFormat + 1 };
  }
  return actuelle;
}

// Recopie une partie en passant par du texte JSON : seules des données
// simples (textes, nombres, listes, objets) passent. Rien d'étrange venu d'un
// fichier ne peut se glisser dans le jeu.
function recopier(partie) {
  return JSON.parse(JSON.stringify(partie));
}

// Vérifie, met à niveau et renvoie une partie propre (ou lève ErreurSauvegarde).
export function preparerPartie(brute) {
  if (!estObjet(brute) || brute.format !== FORMAT) throw new ErreurSauvegarde('pasUnePartie');
  const partie = migrerPartie(recopier(brute));
  const problemes = verifierPartie(partie);
  if (problemes.length > 0) throw new ErreurSauvegarde('abimee', problemes.join(', '));
  return partie;
}

// Lit le contenu d'un fichier importé.
// Renvoie { ok: true, partie } ou { ok: false, code, details }.
export function lireFichierPartie(texte) {
  if (typeof texte !== 'string' || texte.length === 0) return { ok: false, code: 'vide' };
  if (texte.length > TAILLE_MAXIMALE_IMPORT) return { ok: false, code: 'tropGros' };
  let brute;
  try {
    brute = JSON.parse(texte);
  } catch {
    return { ok: false, code: 'pasJson' };
  }
  try {
    return { ok: true, partie: preparerPartie(brute) };
  } catch (erreur) {
    if (erreur instanceof ErreurSauvegarde) return { ok: false, code: erreur.code, details: erreur.details };
    throw erreur;
  }
}

// Le texte du fichier exporté (lisible par un humain : indenté).
export function serialiserPartie(partie) {
  return `${JSON.stringify(partie, null, 2)}\n`;
}

// « atelier-pwa-partie-2026-11-14.json »
export function nomFichierExport(date = new Date()) {
  const deux = (n) => String(n).padStart(2, '0');
  return `${FORMAT}-${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}.json`;
}

// Le niveau de réputation atteint, d'après les paliers de data/jeu.json.
export function niveauDeReputation(points, paliers) {
  let atteint = paliers[0];
  for (const palier of paliers) {
    if (points >= palier.points) atteint = palier;
  }
  const index = paliers.indexOf(atteint);
  return { ...atteint, suivant: paliers[index + 1] || null };
}

// Les informations utiles pour présenter une partie en une ligne.
export function resumerPartie(partie) {
  return {
    jour: partie.temps.jour,
    minute: partie.temps.minute,
    argent: partie.argent,
    reputation: partie.reputation,
    enregistreeLe: partie.enregistreeLe,
    versionJeu: partie.versionJeu,
    nomJoueur: partie.joueur?.nom || null,
  };
}
