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

import { CHAMPS_APPARENCE } from '../jeu/personnage.js';

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
    deplacement: {
      type: 'objet',
      champs: {
        vitesse: { type: 'nombre', min: 0.5, max: 6 },
      },
    },
  },
};

export const SCHEMA_TEXTES = { type: 'arbre-de-textes' };

// --- data/palette.json : les couleurs de la scène 3D --------------------------
export const SCHEMA_PALETTE = {
  type: 'objet',
  champs: {
    couleurs: { type: 'objet', valeurs: { type: 'couleur' } },
  },
};

// --- data/meubles.json : le catalogue des meubles -----------------------------
const troisNombres = { type: 'liste', element: { type: 'nombre' }, min: 3, max: 3 };
const SCHEMA_FORME = {
  type: 'objet',
  champs: {
    forme: { type: 'choix', valeurs: ['boite', 'cylindre', 'sphere'] },
    position: troisNombres,
    couleur: texte,
    taille: { ...troisNombres, facultatif: true },
    rayon: { type: 'nombre', min: 0.001, max: 10, facultatif: true },
    rayonHaut: { type: 'nombre', min: 0, max: 10, facultatif: true },
    hauteur: { type: 'nombre', min: 0.001, max: 10, facultatif: true },
    cotes: { type: 'nombre', entier: true, min: 3, max: 32, facultatif: true },
    details: { type: 'nombre', entier: true, min: 0, max: 2, facultatif: true },
    rotation: { ...troisNombres, facultatif: true },
  },
};

export const SCHEMA_MEUBLES = {
  type: 'objet',
  champs: {
    meubles: {
      type: 'liste',
      min: 1,
      element: {
        type: 'objet',
        champs: {
          id: texte,
          nom: texte,
          designation: { ...texte, facultatif: true },
          description: { ...texte, facultatif: true },
          emprise: { type: 'liste', element: { type: 'nombre', entier: true, min: 1, max: 20 }, min: 2, max: 2 },
          bloque: { type: 'booleen', facultatif: true },
          formes: { type: 'liste', min: 1, element: SCHEMA_FORME },
        },
      },
    },
  },
};

// --- data/personnages.json : Ferrus et les options du personnage --------------
const SCHEMA_APPARENCE = {
  type: 'objet',
  champs: Object.fromEntries(CHAMPS_APPARENCE.map((champ) => [champ, texte])),
};

const SCHEMA_OPTION = {
  type: 'objet',
  champs: { id: texte, nom: texte, couleur: { ...texte, facultatif: true } },
};

export const SCHEMA_PERSONNAGES = {
  type: 'objet',
  champs: {
    ferrus: {
      type: 'objet',
      champs: {
        nom: texte,
        nomComplet: texte,
        presentation: texte,
        apparenceProvisoire: { type: 'booleen' },
        aValider: { ...texte, facultatif: true },
        apparence: SCHEMA_APPARENCE,
      },
    },
    prenomsProposes: { type: 'liste', min: 1, element: texte },
    defaut: SCHEMA_APPARENCE,
    options: {
      type: 'objet',
      champs: Object.fromEntries(CHAMPS_APPARENCE.map((champ) => [champ, { type: 'liste', min: 1, element: SCHEMA_OPTION }])),
    },
  },
};

// --- data/lieux/index.json et data/lieux/*.json : les lieux -------------------
export const SCHEMA_INDEX_LIEUX = {
  type: 'objet',
  champs: {
    lieux: {
      type: 'liste',
      min: 1,
      element: { type: 'objet', champs: { id: texte, fichier: texte } },
    },
  },
};

const coordonnee = { type: 'nombre', entier: true, min: 0, max: 400 };
const pointDeGrille = { type: 'liste', element: coordonnee, min: 2, max: 2 };
const angle = { type: 'nombre', min: 0, max: 359 };

export const SCHEMA_LIEU = {
  type: 'objet',
  champs: {
    id: texte,
    nom: texte,
    designation: texte,
    taille: { type: 'liste', element: { type: 'nombre', entier: true, min: 2, max: 200 }, min: 2, max: 2 },
    hauteurMurs: { type: 'nombre', min: 1.5, max: 6 },
    depart: { type: 'objet', champs: { x: coordonnee, z: coordonnee, angle } },
    pieces: {
      type: 'liste',
      min: 1,
      element: {
        type: 'objet',
        champs: {
          id: texte,
          nom: texte,
          designation: texte,
          zones: { type: 'liste', min: 1, element: { type: 'liste', element: coordonnee, min: 4, max: 4 } },
          sol: {
            type: 'objet',
            champs: {
              motif: { type: 'choix', valeurs: ['uni', 'lames', 'damier'] },
              couleurs: { type: 'liste', element: texte, min: 1, max: 2 },
            },
          },
        },
      },
    },
    murs: {
      type: 'liste',
      element: { type: 'objet', champs: { de: pointDeGrille, a: pointDeGrille } },
    },
    ouvertures: {
      type: 'liste',
      element: {
        type: 'objet',
        champs: {
          type: { type: 'choix', valeurs: ['porte', 'porte-entree', 'fenetre'] },
          de: pointDeGrille,
          a: pointDeGrille,
        },
      },
    },
    meubles: {
      type: 'liste',
      element: {
        type: 'objet',
        champs: {
          id: texte,
          meuble: texte,
          x: coordonnee,
          z: coordonnee,
          rotation: { type: 'choix', valeurs: [0, 90, 180, 270] },
          description: { ...texte, facultatif: true },
        },
      },
    },
    points: {
      type: 'liste',
      facultatif: true,
      element: {
        type: 'objet',
        champs: { id: texte, nom: texte, designation: texte, description: texte, x: coordonnee, z: coordonnee, angle },
      },
    },
  },
};

// Vérifications qu'un schéma ne sait pas faire pour les meubles : chaque
// forme a les mesures qu'il lui faut, et un meuble qu'on peut examiner a une
// désignation (« le lit ») pour les phrases du jeu.
function verifierMeublesEnPlus(fichier) {
  const erreurs = [];
  const vus = new Set();
  (fichier?.meubles || []).forEach((meuble, index) => {
    const ou = `meubles › n°${index + 1} (${meuble.id})`;
    if (vus.has(meuble.id)) erreurs.push(`${ou} : l'identifiant « ${meuble.id} » est déjà utilisé`);
    vus.add(meuble.id);
    if (meuble.description && !meuble.designation) {
      erreurs.push(`${ou} : un meuble avec une description doit avoir une « designation » (ex. « le lit »)`);
    }
    (meuble.formes || []).forEach((forme, n) => {
      const besoin = { boite: ['taille'], cylindre: ['rayon', 'hauteur'], sphere: ['rayon'] }[forme.forme] || [];
      for (const champ of besoin) {
        if (forme[champ] === undefined) erreurs.push(`${ou} › formes › n°${n + 1} : « ${champ} » manque pour une forme « ${forme.forme} »`);
      }
    });
  });
  return erreurs;
}

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

// La liste des fichiers de données chargés au démarrage. Les fichiers des
// lieux (data/lieux/*.json) sont ensuite chargés d'après data/lieux/index.json.
export const FICHIERS_DONNEES = [
  { nom: 'jeu', chemin: 'data/jeu.json', schema: SCHEMA_JEU, enPlus: verifierJeuEnPlus },
  { nom: 'textes', chemin: 'data/textes.json', schema: SCHEMA_TEXTES },
  { nom: 'palette', chemin: 'data/palette.json', schema: SCHEMA_PALETTE },
  { nom: 'meubles', chemin: 'data/meubles.json', schema: SCHEMA_MEUBLES, enPlus: verifierMeublesEnPlus },
  { nom: 'personnages', chemin: 'data/personnages.json', schema: SCHEMA_PERSONNAGES },
  { nom: 'indexLieux', chemin: 'data/lieux/index.json', schema: SCHEMA_INDEX_LIEUX },
];
