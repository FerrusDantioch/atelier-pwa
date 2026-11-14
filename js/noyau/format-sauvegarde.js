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

export const FORMAT = 'atelier-pwa-partie';
export const VERSION_FORMAT = 1;

// Taille maximale d'un fichier importé (une partie fait quelques kilo-octets).
export const TAILLE_MAXIMALE_IMPORT = 5 * 1024 * 1024;

// « 08:30 » → 510 minutes depuis minuit.
export function heureEnMinutes(heure) {
  const [h, m] = heure.split(':').map(Number);
  return h * 60 + m;
}

// Une partie toute neuve, à partir des valeurs de départ de data/jeu.json.
export function nouvellePartie({ graine, depart, versionJeu, maintenant = new Date() }) {
  const date = maintenant.toISOString();
  return {
    format: FORMAT,
    versionFormat: VERSION_FORMAT,
    versionJeu,
    creeeLe: date,
    enregistreeLe: date,
    graine: graine >>> 0,
    // Le personnage sera choisi au jalon 1 (écran de choix du personnage).
    joueur: null,
    temps: { jour: depart.jour, minute: heureEnMinutes(depart.heure) },
    argent: depart.argent,
    reputation: depart.reputation,
    quetes: { actives: {}, finies: [], suivie: null },
    commandes: { enCours: {}, livrees: [] },
    possessions: [],
    lieux: { actuel: depart.lieu, debloques: [depart.lieu], amenagements: {} },
    drapeaux: {},
  };
}

// --- Vérification -----------------------------------------------------------

const estObjet = (valeur) => typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);
const estEntier = (valeur, min = 0) => Number.isInteger(valeur) && valeur >= min;
const estListeDeTextes = (valeur) => Array.isArray(valeur) && valeur.every((v) => typeof v === 'string');

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
  exiger(partie.joueur === null || estObjet(partie.joueur), 'joueur invalide');
  exiger(estObjet(partie.temps) && estEntier(partie.temps.jour, 1)
    && estEntier(partie.temps.minute) && partie.temps.minute < 24 * 60, 'temps invalide');
  exiger(estEntier(partie.argent), 'argent invalide');
  exiger(estEntier(partie.reputation), 'reputation invalide');
  exiger(estObjet(partie.quetes) && estObjet(partie.quetes.actives)
    && estListeDeTextes(partie.quetes.finies)
    && (partie.quetes.suivie === null || typeof partie.quetes.suivie === 'string'), 'quetes invalides');
  exiger(estObjet(partie.commandes) && estObjet(partie.commandes.enCours)
    && Array.isArray(partie.commandes.livrees), 'commandes invalides');
  exiger(estListeDeTextes(partie.possessions), 'possessions invalides');
  exiger(estObjet(partie.lieux) && typeof partie.lieux.actuel === 'string'
    && estListeDeTextes(partie.lieux.debloques) && estObjet(partie.lieux.amenagements), 'lieux invalides');
  exiger(estObjet(partie.drapeaux), 'drapeaux invalides');
  return problemes;
}

// --- Mise à niveau des anciennes parties -----------------------------------
// MIGRATIONS[n] transforme une partie au format n en partie au format n + 1.
// (Aucune pour l'instant : le format 1 est le premier.)
const MIGRATIONS = {};

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
