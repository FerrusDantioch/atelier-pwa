// =============================================================================
// verification.js — vérifie que les fichiers de données sont bien écrits
// -----------------------------------------------------------------------------
// Tout le contenu du jeu est dans data/*.json, modifiable à la main. Une
// virgule oubliée ou un nom mal orthographié arrive vite : ce module vérifie
// chaque fichier à partir d'un « schéma » (la description de ce qu'il doit
// contenir, voir schemas.js) et explique clairement ce qui ne va pas, avec
// l'endroit exact :
//
//   « data/jeu.json › depart › argent : un nombre est attendu (reçu : "cent") »
//
// Ce module n'utilise ni la page ni le navigateur : les tests automatiques
// s'en servent aussi (tests/donnees.test.js).
//
// Types de schéma :
//   { type: 'objet', champs: {…}, ouvert: false, valeurs: schéma }
//       champs  : les clés connues ; chaque champ peut être « facultatif: true »
//       valeurs : schéma commun aux clés libres (dictionnaire, ex. des textes)
//   { type: 'texte', min: 1 }               texte d'au moins « min » caractères
//   { type: 'nombre', min, max, entier }
//   { type: 'booleen' }
//   { type: 'liste', element: schéma, min, max }
//   { type: 'choix', valeurs: [...] }        une valeur parmi une liste
//   { type: 'couleur' }                      « #rrggbb »
//   { type: 'heure' }                        « HH:MM »
//   { type: 'arbre-de-textes' }              textes rangés dans des groupes
// =============================================================================

function decrire(valeur) {
  if (valeur === null) return 'rien (null)';
  if (Array.isArray(valeur)) return 'une liste';
  if (typeof valeur === 'object') return 'un objet';
  if (typeof valeur === 'string') return `"${valeur.length > 40 ? `${valeur.slice(0, 40)}…` : valeur}"`;
  return String(valeur);
}

function joindre(chemin, cle) {
  return chemin ? `${chemin} › ${cle}` : String(cle);
}

// Renvoie la liste des problèmes (vide si tout va bien).
export function verifier(valeur, schema, chemin = '') {
  const erreurs = [];
  const signaler = (message) => erreurs.push(`${chemin || '(racine)'} : ${message}`);

  switch (schema.type) {
    case 'objet': {
      if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) {
        signaler(`un objet { … } est attendu (reçu : ${decrire(valeur)})`);
        break;
      }
      const champs = schema.champs || {};
      for (const [cle, sousSchema] of Object.entries(champs)) {
        if (!Object.hasOwn(valeur, cle) || valeur[cle] === undefined) {
          if (!sousSchema.facultatif) signaler(`le champ « ${cle} » manque`);
          continue;
        }
        erreurs.push(...verifier(valeur[cle], sousSchema, joindre(chemin, cle)));
      }
      for (const cle of Object.keys(valeur)) {
        if (Object.hasOwn(champs, cle)) continue;
        if (schema.valeurs) {
          erreurs.push(...verifier(valeur[cle], schema.valeurs, joindre(chemin, cle)));
        } else if (!schema.ouvert) {
          signaler(`champ inconnu « ${cle} » (faute de frappe ?)`);
        }
      }
      break;
    }
    case 'texte':
      if (typeof valeur !== 'string') signaler(`un texte entre guillemets est attendu (reçu : ${decrire(valeur)})`);
      else if (valeur.trim().length < (schema.min ?? 1)) signaler('le texte est vide');
      break;
    case 'nombre':
      if (typeof valeur !== 'number' || !Number.isFinite(valeur)) {
        signaler(`un nombre est attendu (reçu : ${decrire(valeur)})`);
      } else {
        if (schema.entier && !Number.isInteger(valeur)) signaler(`un nombre entier est attendu (reçu : ${valeur})`);
        if (schema.min !== undefined && valeur < schema.min) signaler(`le nombre doit être au moins ${schema.min} (reçu : ${valeur})`);
        if (schema.max !== undefined && valeur > schema.max) signaler(`le nombre doit être au plus ${schema.max} (reçu : ${valeur})`);
      }
      break;
    case 'booleen':
      if (typeof valeur !== 'boolean') signaler(`true ou false est attendu (reçu : ${decrire(valeur)})`);
      break;
    case 'liste':
      if (!Array.isArray(valeur)) {
        signaler(`une liste [ … ] est attendue (reçu : ${decrire(valeur)})`);
        break;
      }
      if (schema.min !== undefined && valeur.length < schema.min) signaler(`la liste doit contenir au moins ${schema.min} élément(s)`);
      if (schema.max !== undefined && valeur.length > schema.max) signaler(`la liste doit contenir au plus ${schema.max} élément(s)`);
      valeur.forEach((element, index) => {
        erreurs.push(...verifier(element, schema.element, joindre(chemin, `n°${index + 1}`)));
      });
      break;
    case 'choix':
      if (!schema.valeurs.includes(valeur)) {
        signaler(`valeur inconnue ${decrire(valeur)} (valeurs possibles : ${schema.valeurs.join(', ')})`);
      }
      break;
    case 'couleur':
      if (typeof valeur !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(valeur)) {
        signaler(`une couleur « #rrggbb » est attendue (reçu : ${decrire(valeur)})`);
      }
      break;
    case 'heure':
      if (typeof valeur !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(valeur)) {
        signaler(`une heure « HH:MM » est attendue (reçu : ${decrire(valeur)})`);
      }
      break;
    case 'arbre-de-textes':
      // Des textes rangés dans des groupes, sur autant de niveaux qu'on veut.
      if (typeof valeur === 'string') {
        if (!valeur.trim()) signaler('le texte est vide');
      } else if (typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)) {
        for (const [cle, sousValeur] of Object.entries(valeur)) {
          erreurs.push(...verifier(sousValeur, schema, joindre(chemin, cle)));
        }
      } else {
        signaler(`un texte ou un groupe de textes est attendu (reçu : ${decrire(valeur)})`);
      }
      break;
    default:
      signaler(`type de schéma inconnu « ${schema.type} » (erreur dans schemas.js)`);
  }
  return erreurs;
}

// Explique une erreur de lecture JSON (virgule manquante…) avec la ligne et
// la colonne, quel que soit le navigateur.
export function expliquerErreurJson(texte, erreur) {
  const message = String(erreur && erreur.message ? erreur.message : erreur);
  const ligneColonne = message.match(/line (\d+) column (\d+)/i);
  if (ligneColonne) {
    return `erreur d'écriture à la ligne ${ligneColonne[1]}, colonne ${ligneColonne[2]} (virgule, guillemet ou accolade ?)`;
  }
  const position = message.match(/position (\d+)/i);
  if (position) {
    const avant = texte.slice(0, Number(position[1]));
    const ligne = avant.split('\n').length;
    const colonne = avant.length - avant.lastIndexOf('\n');
    return `erreur d'écriture à la ligne ${ligne}, colonne ${colonne} (virgule, guillemet ou accolade ?)`;
  }
  return `erreur d'écriture (virgule, guillemet ou accolade ?) : ${message}`;
}
