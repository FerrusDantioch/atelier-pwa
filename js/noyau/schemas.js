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
import { verifierRoutine } from '../jeu/routines.js';

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
    temps: {
      type: 'objet',
      champs: {
        debutJournee: { type: 'heure' },
        finJournee: { type: 'heure' },
        minutesParSeconde: { type: 'nombre', min: 0.1, max: 10 },
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
    forme: { type: 'choix', valeurs: ['boite', 'cylindre', 'sphere', 'anneau'] },
    position: troisNombres,
    couleur: texte,
    taille: { ...troisNombres, facultatif: true },
    rayon: { type: 'nombre', min: 0.001, max: 10, facultatif: true },
    rayonHaut: { type: 'nombre', min: 0, max: 10, facultatif: true },
    epaisseur: { type: 'nombre', min: 0.001, max: 2, facultatif: true },
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
          // Actions en plus de « Examiner » (ex. « dormir » pour un lit).
          actions: { type: 'liste', facultatif: true, element: { type: 'choix', valeurs: ['dormir', 'ordinateur'] } },
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
          // Des parois sur toute la hauteur (translucides au-dessus du genou),
          // pour une pièce qu'on veut bien séparer (la salle d'eau).
          paroisHautes: { type: 'booleen', facultatif: true },
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
    // Points : endroits à examiner (avec description) ou simples places où
    // se tiennent les personnages (routines de data/pnj.json).
    points: {
      type: 'liste',
      facultatif: true,
      element: {
        type: 'objet',
        champs: {
          id: texte,
          nom: { ...texte, facultatif: true },
          designation: { ...texte, facultatif: true },
          description: { ...texte, facultatif: true },
          x: coordonnee,
          z: coordonnee,
          angle,
        },
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
      const besoin = { boite: ['taille'], cylindre: ['rayon', 'hauteur'], sphere: ['rayon'], anneau: ['rayon', 'epaisseur'] }[forme.forme] || [];
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

// --- data/pnj.json : les personnages non joueurs -----------------------------
const listeDeTextes = { type: 'liste', min: 1, element: texte };
export const SCHEMA_PNJ = {
  type: 'objet',
  champs: {
    pnj: {
      type: 'liste',
      min: 1,
      element: {
        type: 'objet',
        champs: {
          id: texte,
          nom: { ...texte, facultatif: true },
          modele: { type: 'choix', valeurs: ['ferrus', 'perso'], facultatif: true },
          presentation: texte,
          aValider: { ...texte, facultatif: true },
          apparenceProvisoire: { type: 'booleen', facultatif: true },
          apparence: { ...SCHEMA_APPARENCE, facultatif: true },
          absentSiJoueur: { type: 'choix', valeurs: ['ferrus'], facultatif: true },
          routine: {
            type: 'liste',
            element: {
              type: 'objet',
              champs: {
                de: { type: 'heure' },
                a: { type: 'heure' },
                lieu: texte,
                point: { ...texte, facultatif: true },
                activite: { ...texte, facultatif: true },
              },
            },
          },
          // Activités et répliques : seulement pour qui vient dans un lieu.
          activites: {
            type: 'objet',
            facultatif: true,
            valeurs: { type: 'objet', champs: { description: texte, repliques: listeDeTextes } },
          },
          repliques: { type: 'objet', facultatif: true, champs: { rencontre: listeDeTextes, salut: listeDeTextes } },
          // Les appels en visio (le mentor, jalon 3).
          visio: {
            type: 'objet',
            facultatif: true,
            champs: {
              accueil: { type: 'objet', champs: { joueurFerrus: texte, autre: texte } },
              tutoriel: listeDeTextes,
              conseils: {
                type: 'objet',
                champs: { aRetravailler: listeDeTextes, enCours: listeDeTextes, offres: listeDeTextes, general: listeDeTextes },
              },
              auRevoir: texte,
            },
          },
        },
      },
    },
  },
};

// Vérifications des PNJ qu'un schéma ne sait pas faire (le reste, lié aux
// lieux, est dans coherence.js).
function verifierPnjEnPlus(fichier) {
  const erreurs = [];
  const vus = new Set();
  (fichier?.pnj || []).forEach((pnj) => {
    const ou = `pnj › ${pnj.id}`;
    if (vus.has(pnj.id)) erreurs.push(`${ou} : identifiant en double`);
    vus.add(pnj.id);
    const ferrus = pnj.modele === 'ferrus';
    if (!ferrus && !pnj.nom) erreurs.push(`${ou} : il faut un « nom »`);
    if (!ferrus && !pnj.apparence) erreurs.push(`${ou} : il faut une « apparence »`);
    for (const message of verifierRoutine(pnj.routine || [], { debut: 0, fin: 24 * 60 })) erreurs.push(`${ou} › ${message}`);
    if ((pnj.routine || []).length > 0 && !pnj.repliques) erreurs.push(`${ou} : il faut des « repliques » (rencontre, salut) pour qui vient dans un lieu`);
    (pnj.routine || []).forEach((creneau, n) => {
      if (creneau.activite && !pnj.activites?.[creneau.activite]) {
        erreurs.push(`${ou} › routine › n°${n + 1} : l'activité « ${creneau.activite} » n'est pas décrite dans « activites »`);
      }
    });
  });
  return erreurs;
}

// --- data/creation.json : les pièces du mini-jeu de création (jalon 3) -------
const listeDApports = { type: 'liste', min: 1, element: texte };
export const SCHEMA_CREATION = {
  type: 'objet',
  champs: {
    modeles: {
      type: 'liste',
      min: 1,
      element: {
        type: 'objet',
        champs: {
          id: texte,
          nom: texte,
          description: texte,
          apporte: listeDApports,
          capacite: { type: 'nombre', entier: true, min: 1, max: 20 },
          apercu: listeDeTextes,
        },
      },
    },
    fonctions: {
      type: 'liste',
      min: 1,
      element: {
        type: 'objet',
        champs: {
          id: texte,
          nom: texte,
          description: texte,
          apporte: listeDApports,
          charge: { type: 'nombre', entier: true, min: 0, max: 10 },
          icone: { ...texte, facultatif: true },
          apercu: texte,
        },
      },
    },
    confort: {
      type: 'liste',
      min: 1,
      element: {
        type: 'objet',
        champs: {
          id: texte,
          nom: texte,
          valeurs: { type: 'liste', min: 2, element: { type: 'objet', champs: { id: texte, nom: texte } } },
          defaut: texte,
        },
      },
    },
    bareme: {
      type: 'objet',
      champs: {
        toleranceCharge: { type: 'nombre', entier: true, min: 0, max: 10 },
        bien: {
          type: 'objet',
          champs: { argent: { type: 'nombre', min: 0, max: 1 }, reputation: { type: 'nombre', min: 0, max: 1 } },
        },
      },
    },
  },
};

function verifierCreationEnPlus(creation) {
  const erreurs = [];
  for (const groupe of ['modeles', 'fonctions', 'confort']) {
    const vus = new Set();
    for (const element of creation?.[groupe] || []) {
      if (vus.has(element.id)) erreurs.push(`${groupe} › ${element.id} : identifiant en double`);
      vus.add(element.id);
    }
  }
  for (const reglage of creation?.confort || []) {
    if (!(reglage.valeurs || []).some((valeur) => valeur.id === reglage.defaut)) {
      erreurs.push(`confort › ${reglage.id} › defaut : « ${reglage.defaut} » n'est pas une des valeurs`);
    }
  }
  return erreurs;
}

// --- data/commandes.json : les commandes des clients (jalon 3) ---------------
const SCHEMA_ATTENTE = { type: 'objet', champs: { apporte: texte, texte } };
export const SCHEMA_COMMANDES = {
  type: 'objet',
  champs: {
    aValider: { ...texte, facultatif: true },
    commandes: {
      type: 'liste',
      min: 1,
      element: {
        type: 'objet',
        champs: {
          id: texte,
          client: texte,
          titre: texte,
          resume: texte,
          demande: texte,
          besoins: { type: 'liste', min: 1, element: SCHEMA_ATTENTE },
          bonus: { type: 'liste', element: SCHEMA_ATTENTE },
          aEviter: { type: 'liste', element: SCHEMA_ATTENTE },
          avis: { type: 'objet', facultatif: true, valeurs: texte },
          chargeMax: { type: 'nombre', entier: true, min: 0, max: 20, facultatif: true },
          confort: {
            type: 'liste',
            element: {
              type: 'objet',
              champs: { reglage: texte, valeurs: { type: 'liste', min: 1, element: texte }, texte },
            },
          },
          apercu: { type: 'objet', facultatif: true, valeurs: listeDeTextes },
          recompense: {
            type: 'objet',
            champs: { argent: entierPositif, reputation: entierPositif, bonus: entierPositif },
          },
          debloquee: {
            type: 'objet',
            facultatif: true,
            champs: {
              drapeau: { ...texte, facultatif: true },
              apres: { type: 'liste', facultatif: true, element: texte },
              niveau: { type: 'nombre', entier: true, min: 1, facultatif: true },
            },
          },
          reactions: { type: 'objet', champs: { parfait: texte, bien: texte, aRetravailler: texte } },
        },
      },
    },
  },
};

function verifierCommandesEnPlus(fichier) {
  const erreurs = [];
  const vus = new Set();
  for (const commande of fichier?.commandes || []) {
    if (vus.has(commande.id)) erreurs.push(`commandes › ${commande.id} : identifiant en double`);
    vus.add(commande.id);
  }
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
  { nom: 'pnj', chemin: 'data/pnj.json', schema: SCHEMA_PNJ, enPlus: verifierPnjEnPlus },
  { nom: 'creation', chemin: 'data/creation.json', schema: SCHEMA_CREATION, enPlus: verifierCreationEnPlus },
  { nom: 'commandes', chemin: 'data/commandes.json', schema: SCHEMA_COMMANDES, enPlus: verifierCommandesEnPlus },
  { nom: 'indexLieux', chemin: 'data/lieux/index.json', schema: SCHEMA_INDEX_LIEUX },
];
