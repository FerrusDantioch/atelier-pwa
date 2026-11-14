// =============================================================================
// personnage.js — le personnage du joueur : Ferrus ou un personnage créé
// -----------------------------------------------------------------------------
// Dans la partie, le joueur est rangé ainsi :
//   joueur: {
//     modele: 'ferrus' | 'perso',
//     nom: 'Camille',
//     apparence: { teint, coiffure, … } (seulement pour « perso »),
//     position: { x, z, angle } ou null (case du lieu actuel, angle en degrés)
//   }
// L'apparence de Ferrus n'est pas copiée dans la partie : elle est lue dans
// data/personnages.json, pour qu'une correction s'applique partout.
//
// Les valeurs de l'apparence sont des identifiants d'options
// (data/personnages.json › options). Une valeur inconnue (fichier importé
// abîmé, option retirée) est remplacée par la valeur par défaut : le jeu ne
// plante jamais pour une apparence.
//
// Ce module n'utilise ni la 3D ni la page (testé avec node --test).
// =============================================================================

// Les champs de l'apparence, dans l'ordre de l'écran de création.
export const CHAMPS_APPARENCE = [
  'teint', 'lunettes',
  'coiffure', 'cheveux', 'barbe',
  'silhouette', 'taille',
  'haut', 'styleBas', 'bas', 'couvreChef', 'couleurCouvreChef',
  'aide', 'couleurAide',
];

// Les champs dont les options sont des couleurs (data/palette.json).
export const CHAMPS_COULEUR = ['teint', 'cheveux', 'haut', 'bas', 'couleurCouvreChef', 'couleurAide'];

// Les formes que le code sait dessiner (js/modeles/personnage.js). Le fichier
// de données peut en proposer moins, jamais d'autres.
export const FORMES_CONNUES = {
  lunettes: ['aucune', 'rondes', 'carrees'],
  coiffure: ['aucune', 'rasee', 'courte', 'mi-longue', 'longue', 'chignon', 'boucles'],
  barbe: ['aucune', 'courte', 'longue'],
  silhouette: ['fine', 'moyenne', 'large'],
  taille: ['petite', 'moyenne', 'grande'],
  styleBas: ['pantalon', 'jupe', 'short'],
  couvreChef: ['aucun', 'bonnet', 'casquette', 'foulard'],
  aide: ['aucune', 'fauteuil', 'canne'],
};

// Longueur maximale d'un prénom (assez pour les prénoms composés).
export const LONGUEUR_PRENOM = 24;

/**
 * Nettoie un prénom tapé par le joueur : espaces en trop retirés, caractères
 * invisibles (retours à la ligne, tabulations…) enlevés, longueur limitée.
 * Renvoie une chaîne vide si rien ne reste.
 */
export function nettoyerPrenom(texte) {
  return String(texte ?? '')
    // Caractères de contrôle et invisibles (retours à la ligne, sens de lecture…)
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LONGUEUR_PRENOM)
    .trim();
}

// L'apparence complète et valide, à partir de n'importe quoi.
export function nettoyerApparence(brute, personnages) {
  const resultat = {};
  for (const champ of CHAMPS_APPARENCE) {
    const options = personnages.options[champ] || [];
    const valeur = brute && typeof brute === 'object' ? brute[champ] : undefined;
    resultat[champ] = options.some((option) => option.id === valeur) ? valeur : personnages.defaut[champ];
  }
  return resultat;
}

// L'apparence à dessiner pour un joueur (Ferrus ou personnage créé).
export function apparenceDuJoueur(joueur, personnages) {
  if (joueur?.modele === 'ferrus') return nettoyerApparence(personnages.ferrus.apparence, personnages);
  return nettoyerApparence(joueur?.apparence, personnages);
}

// Le nom affiché d'un joueur.
export function nomDuJoueur(joueur, personnages) {
  if (joueur?.modele === 'ferrus') return personnages.ferrus.nom;
  return nettoyerPrenom(joueur?.nom) || personnages.prenomsProposes[0];
}

// Fabrique le joueur à ranger dans la partie.
export function creerJoueur({ modele, nom, apparence }, personnages, position = null) {
  if (modele === 'ferrus') {
    return { modele: 'ferrus', nom: personnages.ferrus.nom, apparence: null, position };
  }
  return {
    modele: 'perso',
    nom: nettoyerPrenom(nom) || personnages.prenomsProposes[0],
    apparence: nettoyerApparence(apparence, personnages),
    position,
  };
}

// Une apparence tirée au hasard (bouton « Tout au hasard »). « tirer » est
// une fonction qui choisit un élément dans une liste. L'aide à la mobilité
// n'est jamais tirée au hasard : c'est un choix, on garde celle d'avant.
export function apparenceAuHasard(personnages, tirer, actuelle = null) {
  const resultat = {};
  for (const champ of CHAMPS_APPARENCE) {
    resultat[champ] = tirer(personnages.options[champ]).id;
  }
  resultat.aide = actuelle?.aide ?? personnages.defaut.aide;
  return nettoyerApparence(resultat, personnages);
}
