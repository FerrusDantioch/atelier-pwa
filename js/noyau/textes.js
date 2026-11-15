// =============================================================================
// textes.js — tous les textes visibles viennent de data/textes.json
// -----------------------------------------------------------------------------
// Le code ne contient pas de phrases : il demande un texte par sa « clé ».
//   t('accueil.nouvellePartie')            → « Nouvelle partie »
//   t('hud.jour', { jour: 3 })             → « Jour 3 »  (texte « Jour {jour} »)
//   tPluriel('monnaie.montant', 1, {…})    → clé « monnaie.montant.un »
//   tPluriel('monnaie.montant', 5, {…})    → clé « monnaie.montant.plusieurs »
//
// Un texte manquant ne bloque pas le jeu : sa clé s'affiche entre crochets
// ([accueil.titre]) et un message est écrit dans la console. Les tests
// vérifient que chaque clé utilisée dans le code existe bien.
//
// La typographie française (espaces fines avant « ! ? : ; ») est ajoutée
// automatiquement : voir typographier().
// =============================================================================

let textes = {};

export function initialiserTextes(donnees) {
  textes = donnees || {};
}

function chercher(cle) {
  return cle.split('.').reduce((niveau, morceau) => (
    niveau && typeof niveau === 'object' ? niveau[morceau] : undefined
  ), textes);
}

// Remplace {nom} par la valeur correspondante. Un « de » juste avant suit
// la grammaire : « de Antoine » → « d'Antoine », « de Halaé » → « d'Halaé »,
// « de le lit » → « du lit », « de les toilettes » → « des toilettes ».
const ELISION = /^[aeiouyhàâäéèêëîïôöùûüÿæœ]/i;
export function remplir(modele, valeurs = {}) {
  return modele.replace(/(\b[Dd]e )?\{(\w+)\}/g, (morceau, de, nom) => {
    if (!Object.prototype.hasOwnProperty.call(valeurs, nom)) return morceau;
    const valeur = String(valeurs[nom]);
    if (!de) return valeur;
    const d = de[0]; // « d » ou « D » (en début de phrase)
    if (valeur.startsWith('les ')) return `${d}es ${valeur.slice(4)}`;
    if (valeur.startsWith('le ')) return `${d}u ${valeur.slice(3)}`;
    if (ELISION.test(valeur)) return `${d}'${valeur}`;
    return `${de}${valeur}`;
  });
}

// Typographie française : une espace fine insécable avant ! ? : ; % » et
// après «, pour qu'un signe ne se retrouve jamais seul en début de ligne.
// (Dans data/textes.json, on écrit simplement une espace normale.)
export function typographier(texte) {
  return texte
    .replace(/[  ]([!?:;%»])/g, ' $1')
    .replace(/«[  ]/g, '« ');
}

export function t(cle, valeurs) {
  const modele = chercher(cle);
  if (typeof modele !== 'string') {
    console.warn(`Texte manquant dans data/textes.json : « ${cle} »`);
    return `[${cle}]`;
  }
  return typographier(remplir(modele, valeurs));
}

// Singulier ou pluriel. En français : 0 et 1 au singulier (« 0 pièce »).
export function tPluriel(cle, nombre, valeurs = {}) {
  const forme = Math.abs(nombre) < 2 ? 'un' : 'plusieurs';
  return t(`${cle}.${forme}`, { n: formaterNombre(nombre), ...valeurs });
}

// Vrai si le texte existe (pour les textes facultatifs).
export function existe(cle) {
  return typeof chercher(cle) === 'string';
}

// Les noms des textes d'un groupe, dans l'ordre du fichier (pour les listes
// dont la longueur se règle dans data/textes.json).
export function clesDuGroupe(cle) {
  const groupe = chercher(cle);
  return groupe && typeof groupe === 'object' ? Object.keys(groupe) : [];
}

const formatNombre = new Intl.NumberFormat('fr-FR');
export function formaterNombre(nombre) {
  return formatNombre.format(nombre);
}

// « 8 h 05 » à partir d'un nombre de minutes depuis minuit.
export function formaterHeure(minutes) {
  const heures = Math.floor(minutes / 60) % 24;
  const reste = String(minutes % 60).padStart(2, '0');
  return t('format.heure', { h: heures, m: reste });
}

// Date et heure lisibles : « 14/11/2026 à 15:42 ».
export function formaterDate(dateIso) {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return '?';
  const jour = date.toLocaleDateString('fr-FR');
  const heure = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return t('format.dateHeure', { date: jour, heure });
}
