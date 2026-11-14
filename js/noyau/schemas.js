// =============================================================================
// schemas.js — ce que doit contenir chaque fichier de data/
// -----------------------------------------------------------------------------
// Pour chaque fichier : son chemin, son schéma (voir verification.js) et,
// si besoin, des vérifications supplémentaires qu'un schéma ne sait pas
// exprimer (paliers dans l'ordre…).
//
// Pour ajouter un fichier de données : l'ajouter ici, puis dans la liste
// FICHIERS de sw.js (pour qu'il soit disponible hors ligne).
// =============================================================================

const texte = { type: 'texte' };
const entierPositif = { type: 'nombre', entier: true, min: 0 };

export const SCHEMA_JEU = {
  type: 'objet',
  champs: {
    monnaie: {
      type: 'objet',
      champs: { singulier: texte, pluriel: texte },
    },
    depart: {
      type: 'objet',
      champs: {
        argent: entierPositif,
        reputation: entierPositif,
        lieu: texte,
        jour: { type: 'nombre', entier: true, min: 1 },
        heure: { type: 'heure' },
      },
    },
    reputation: {
      type: 'objet',
      champs: {
        paliers: {
          type: 'liste',
          min: 1,
          element: {
            type: 'objet',
            champs: {
              niveau: { type: 'nombre', entier: true, min: 1 },
              nom: texte,
              points: entierPositif,
            },
          },
        },
      },
    },
    sauvegarde: {
      type: 'objet',
      champs: {
        intervalleSecondes: { type: 'nombre', entier: true, min: 5, max: 600 },
        copiesDeSecours: { type: 'nombre', entier: true, min: 1, max: 20 },
      },
    },
  },
};

export const SCHEMA_TEXTES = { type: 'arbre-de-textes' };

// Vérifications qu'un schéma ne sait pas faire : les paliers de réputation
// doivent commencer à 0 point, au niveau 1, et monter dans l'ordre.
function verifierJeuEnPlus(jeu) {
  const erreurs = [];
  const paliers = jeu?.reputation?.paliers;
  if (!Array.isArray(paliers) || paliers.length === 0) return erreurs;
  if (paliers[0].points !== 0) erreurs.push('reputation › paliers : le premier palier doit être à 0 point');
  paliers.forEach((palier, index) => {
    if (palier.niveau !== index + 1) {
      erreurs.push(`reputation › paliers › n°${index + 1} : le niveau devrait être ${index + 1}`);
    }
    if (index > 0 && palier.points <= paliers[index - 1].points) {
      erreurs.push(`reputation › paliers › n°${index + 1} : les points doivent augmenter d'un palier à l'autre`);
    }
  });
  return erreurs;
}

// La liste des fichiers de données chargés au démarrage.
export const FICHIERS_DONNEES = [
  { nom: 'jeu', chemin: 'data/jeu.json', schema: SCHEMA_JEU, enPlus: verifierJeuEnPlus },
  { nom: 'textes', chemin: 'data/textes.json', schema: SCHEMA_TEXTES },
];
