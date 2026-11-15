// =============================================================================
// coherence.js — les fichiers de data/ s'accordent-ils entre eux ?
// -----------------------------------------------------------------------------
// Chaque fichier est d'abord vérifié seul (schemas.js). Ici, on vérifie ce
// qui relie les fichiers entre eux, avec des messages précis :
//   - chaque couleur citée existe dans data/palette.json ;
//   - chaque meuble posé dans un lieu existe dans data/meubles.json ;
//   - les options du personnage existent et le code sait les dessiner ;
//   - chaque lieu tient debout : pièces, murs, portes et meubles dans la
//     grille, meubles qui ne se chevauchent pas…
//   - ACCESSIBILITÉ : depuis le point de départ, chaque pièce, chaque meuble
//     qu'on peut examiner et chaque point d'intérêt est atteignable à pied
//     ET en fauteuil roulant (passages d'au moins 1 m) ;
//   - chaque commande (jalon 3) cite des clients, des apports et des
//     réglages qui existent, peut être réussie « parfaitement », et finit
//     par se débloquer même si l'on n'obtient que des « Bien ».
//
// Ce module n'utilise ni la 3D ni la page (testé avec node --test).
// =============================================================================

import { etatDesCommandes } from '../jeu/commandes.js';
import { meilleurProjet, recompensePour } from '../jeu/creation.js';
import { CHAMPS_APPARENCE, CHAMPS_COULEUR, FORMES_CONNUES } from '../jeu/personnage.js';
import { POINT_D_ARRIVEE, verifierRoutine } from '../jeu/routines.js';
import { heureEnMinutes } from './format-sauvegarde.js';
import { casesPourAtteindre, distancesDepuis } from '../monde/chemin.js';
import { PROFILS, creerGrille, empriseTournee, profilDeDeplacement } from '../monde/grille.js';

const NOMS_PROFILS = { pieton: 'à pied', fauteuil: 'en fauteuil roulant (passages d\'au moins 1 m)' };

function verifierCouleurs(donnees, signaler) {
  const couleurs = donnees.palette?.couleurs || {};
  const existe = (nom) => Object.prototype.hasOwnProperty.call(couleurs, nom);
  (donnees.meubles?.meubles || []).forEach((meuble) => {
    meuble.formes.forEach((forme, n) => {
      if (!existe(forme.couleur)) {
        signaler('data/meubles.json', `${meuble.id} › formes › n°${n + 1} : la couleur « ${forme.couleur} » n'existe pas dans data/palette.json`);
      }
    });
  });
  for (const [champ, options] of Object.entries(donnees.personnages?.options || {})) {
    for (const option of options) {
      if (option.couleur && !existe(option.couleur)) {
        signaler('data/personnages.json', `options › ${champ} › ${option.id} : la couleur « ${option.couleur} » n'existe pas dans data/palette.json`);
      }
    }
  }
  for (const lieu of Object.values(donnees.lieux || {})) {
    for (const piece of lieu.pieces) {
      for (const couleur of piece.sol.couleurs) {
        if (!existe(couleur)) {
          signaler(lieu.chemin, `pieces › ${piece.id} › sol : la couleur « ${couleur} » n'existe pas dans data/palette.json`);
        }
      }
    }
  }
}

function verifierPersonnages(personnages, signaler) {
  if (!personnages) return;
  const chemin = 'data/personnages.json';
  for (const champ of CHAMPS_APPARENCE) {
    const options = personnages.options[champ] || [];
    const ids = options.map((option) => option.id);
    if (new Set(ids).size !== ids.length) signaler(chemin, `options › ${champ} : un identifiant est en double`);
    if (FORMES_CONNUES[champ]) {
      for (const id of ids) {
        if (!FORMES_CONNUES[champ].includes(id)) {
          signaler(chemin, `options › ${champ} : « ${id} » n'est pas une forme connue du jeu (possibles : ${FORMES_CONNUES[champ].join(', ')})`);
        }
      }
    }
    if (CHAMPS_COULEUR.includes(champ)) {
      for (const option of options) {
        if (!option.couleur) signaler(chemin, `options › ${champ} › ${option.id} : il faut une « couleur »`);
      }
    }
    for (const [ou, apparence] of [['defaut', personnages.defaut], ['ferrus › apparence', personnages.ferrus.apparence]]) {
      if (!ids.includes(apparence[champ])) {
        signaler(chemin, `${ou} › ${champ} : « ${apparence[champ]} » n'existe pas dans options › ${champ}`);
      }
    }
  }
}

// Le segment va-t-il d'un point à un autre en ligne droite (horizontale ou
// verticale), dans la grille ?
function segmentValide([x1, z1], [x2, z2], largeur, profondeur) {
  const droit = (x1 === x2) !== (z1 === z2);
  const dedans = [x1, x2].every((x) => x <= largeur) && [z1, z2].every((z) => z <= profondeur);
  return droit && dedans;
}

// Les petits bords (d'une case de long) qui composent un segment.
function bordsDuSegment([x1, z1], [x2, z2]) {
  const bords = [];
  if (z1 === z2) for (let x = Math.min(x1, x2); x < Math.max(x1, x2); x += 1) bords.push(`h ${x},${z1}`);
  else for (let z = Math.min(z1, z2); z < Math.max(z1, z2); z += 1) bords.push(`v ${x1},${z}`);
  return bords;
}

function verifierLieu(lieu, donnees, signaler) {
  const chemin = lieu.chemin;
  const [largeur, profondeur] = lieu.taille;
  const catalogue = new Map((donnees.meubles?.meubles || []).map((meuble) => [meuble.id, meuble]));
  let problemesDeStructure = 0;
  const probleme = (message) => { problemesDeStructure += 1; signaler(chemin, message); };

  // Pièces : identifiants uniques, zones dans la grille, sans chevauchement.
  const casesDePiece = new Map();
  const idsPieces = new Set();
  for (const piece of lieu.pieces) {
    if (idsPieces.has(piece.id)) probleme(`pieces › ${piece.id} : identifiant en double`);
    idsPieces.add(piece.id);
    piece.zones.forEach(([x, z, l, p], n) => {
      const ou = `pieces › ${piece.id} › zones › n°${n + 1}`;
      if (l < 1 || p < 1) probleme(`${ou} : largeur et profondeur doivent valoir au moins 1`);
      if (x + l > largeur || z + p > profondeur) probleme(`${ou} : la zone dépasse de la grille (${largeur} × ${profondeur} cases)`);
      for (let cx = x; cx < x + l; cx += 1) {
        for (let cz = z; cz < z + p; cz += 1) {
          const cle = `${cx},${cz}`;
          if (casesDePiece.has(cle) && casesDePiece.get(cle) !== piece.id) {
            probleme(`${ou} : la case ${cle} appartient déjà à la pièce « ${casesDePiece.get(cle)} »`);
          }
          casesDePiece.set(cle, piece.id);
        }
      }
    });
  }

  // Murs et ouvertures.
  const bordsDeMur = new Set();
  lieu.murs.forEach((mur, n) => {
    if (!segmentValide(mur.de, mur.a, largeur, profondeur)) {
      probleme(`murs › n°${n + 1} : un mur doit être horizontal ou vertical, non vide, et rester dans la grille`);
      return;
    }
    for (const bord of bordsDuSegment(mur.de, mur.a)) bordsDeMur.add(bord);
  });
  lieu.ouvertures.forEach((ouverture, n) => {
    const ou = `ouvertures › n°${n + 1} (${ouverture.type})`;
    if (!segmentValide(ouverture.de, ouverture.a, largeur, profondeur)) {
      probleme(`${ou} : une ouverture doit être horizontale ou verticale, non vide, et rester dans la grille`);
      return;
    }
    if (!bordsDuSegment(ouverture.de, ouverture.a).every((bord) => bordsDeMur.has(bord))) {
      probleme(`${ou} : l'ouverture doit être posée sur un mur`);
    }
  });

  // Meubles : connus, dans la grille, sur un sol, sans chevauchement.
  const ids = new Set();
  const occupees = new Map();
  for (const place of lieu.meubles) {
    const ou = `meubles › ${place.id}`;
    if (ids.has(place.id)) probleme(`${ou} : identifiant en double`);
    ids.add(place.id);
    const meuble = catalogue.get(place.meuble);
    if (!meuble) {
      probleme(`${ou} : le meuble « ${place.meuble} » n'existe pas dans data/meubles.json`);
      continue;
    }
    const { largeur: l, profondeur: p } = empriseTournee(meuble.emprise, place.rotation);
    if (place.x + l > largeur || place.z + p > profondeur) {
      probleme(`${ou} : le meuble dépasse de la grille`);
      continue;
    }
    for (let x = place.x; x < place.x + l; x += 1) {
      for (let z = place.z; z < place.z + p; z += 1) {
        const cle = `${x},${z}`;
        if (!casesDePiece.has(cle)) probleme(`${ou} : la case ${cle} n'est dans aucune pièce`);
        if (meuble.bloque !== false) {
          if (occupees.has(cle)) probleme(`${ou} : la case ${cle} est déjà occupée par « ${occupees.get(cle)} »`);
          occupees.set(cle, place.id);
        }
      }
    }
    // Un mur ne doit pas traverser un meuble.
    for (let x = place.x; x < place.x + l; x += 1) {
      for (let z = place.z + 1; z < place.z + p; z += 1) {
        if (bordsDeMur.has(`h ${x},${z}`)) probleme(`${ou} : un mur traverse le meuble`);
      }
    }
    for (let z = place.z; z < place.z + p; z += 1) {
      for (let x = place.x + 1; x < place.x + l; x += 1) {
        if (bordsDeMur.has(`v ${x},${z}`)) probleme(`${ou} : un mur traverse le meuble`);
      }
    }
  }
  for (const point of lieu.points || []) {
    if (ids.has(point.id)) probleme(`points › ${point.id} : identifiant déjà utilisé par un meuble ou un point`);
    ids.add(point.id);
    if (point.description && !(point.nom && point.designation)) {
      probleme(`points › ${point.id} : un point avec une description doit avoir un « nom » et une « designation »`);
    }
    if (point.x >= largeur || point.z >= profondeur || !casesDePiece.has(`${point.x},${point.z}`)) {
      probleme(`points › ${point.id} : la case ${point.x},${point.z} n'est dans aucune pièce`);
    }
  }

  // L'accessibilité ne se vérifie que si le lieu tient debout.
  if (problemesDeStructure > 0) return;
  const grille = creerGrille(lieu, catalogue);
  const depart = { x: lieu.depart.x, z: lieu.depart.z };
  for (const profil of PROFILS) {
    const facon = NOMS_PROFILS[profil];
    if (!grille.caseAccessible(depart.x, depart.z, profil)) {
      signaler(chemin, `depart : la case ${depart.x},${depart.z} n'est pas libre ${facon}`);
      continue;
    }
    const distances = distancesDepuis(grille, depart, profil);
    for (const piece of lieu.pieces) {
      const atteinte = [...distances.keys()].some((cle) => {
        const [x, z] = cle.split(',').map(Number);
        return grille.piece(x, z) === piece.id;
      });
      if (!atteinte) signaler(chemin, `pieces › ${piece.id} : impossible d'y entrer ${facon}`);
    }
    for (const place of lieu.meubles) {
      const meuble = catalogue.get(place.meuble);
      if (!(place.description || meuble.description)) continue;
      const emprise = grille.emprises.get(place.id);
      if (casesPourAtteindre(grille, emprise, depart, profil, distances).length === 0) {
        signaler(chemin, `meubles › ${place.id} : impossible de s'en approcher ${facon}`);
      }
    }
    for (const point of (lieu.points || []).filter((p) => p.description)) {
      if (!distances.has(`${point.x},${point.z}`)) {
        signaler(chemin, `points › ${point.id} : la case ${point.x},${point.z} n'est pas atteignable ${facon}`);
      }
    }
  }
}

/**
 * Vérifie l'accord entre les fichiers. « donnees » contient jeu, palette,
 * meubles, personnages, indexLieux et lieux (rangés par id, chacun avec son
 * « chemin »). Renvoie la liste des problèmes (« fichier › détail »).
 */
export function verifierCoherence(donnees) {
  const problemes = [];
  const signaler = (fichier, message) => problemes.push(`${fichier} › ${message}`);

  verifierCouleurs(donnees, signaler);
  verifierPersonnages(donnees.personnages, signaler);

  const index = donnees.indexLieux?.lieux || [];
  const idsLieux = index.map((entree) => entree.id);
  if (new Set(idsLieux).size !== idsLieux.length) signaler('data/lieux/index.json', 'un identifiant de lieu est en double');
  for (const entree of index) {
    const lieu = donnees.lieux?.[entree.id];
    if (lieu && lieu.id !== entree.id) {
      signaler(entree.fichier, `id : « ${lieu.id} » ne correspond pas à l'identifiant « ${entree.id} » de data/lieux/index.json`);
    }
  }
  if (donnees.jeu && !idsLieux.includes(donnees.jeu.depart.lieu)) {
    signaler('data/jeu.json', `depart › lieu : le lieu « ${donnees.jeu.depart.lieu} » n'existe pas dans data/lieux/index.json`);
  }
  for (const lieu of Object.values(donnees.lieux || {})) verifierLieu(lieu, donnees, signaler);
  verifierPnj(donnees, signaler);
  verifierCommandes(donnees, signaler);
  return problemes;
}

// Les commandes : tout ce qu'elles citent existe, chacune peut être
// parfaite, et toutes finissent par se débloquer (même avec des « Bien »).
function verifierCommandes(donnees, signaler) {
  const chemin = 'data/commandes.json';
  const creation = donnees.creation;
  const commandes = donnees.commandes?.commandes;
  if (!creation || !commandes) return;
  const clients = new Set((donnees.pnj?.pnj || []).map((pnj) => pnj.id));
  const modeles = new Set(creation.modeles.map((modele) => modele.id));
  const fonctions = new Set(creation.fonctions.map((fonction) => fonction.id));
  const apportsConnus = new Set([...creation.modeles, ...creation.fonctions].flatMap((element) => element.apporte));
  const reglages = new Map(creation.confort.map((reglage) => [reglage.id, new Set(reglage.valeurs.map((v) => v.id))]));
  const ids = new Set(commandes.map((commande) => commande.id));
  const niveauMax = donnees.jeu?.reputation.paliers.length || 1;

  for (const commande of commandes) {
    const ou = `commandes › ${commande.id}`;
    if (!clients.has(commande.client)) signaler(chemin, `${ou} › client : « ${commande.client} » n'existe pas dans data/pnj.json`);
    const client = (donnees.pnj?.pnj || []).find((pnj) => pnj.id === commande.client);
    if (commande.enPersonne && client && client.routine.length === 0) {
      signaler(chemin, `${ou} › enPersonne : ${commande.client} ne vient dans aucun lieu (routine vide), on ne pourra jamais lui parler`);
    }
    for (const groupe of ['besoins', 'bonus', 'aEviter']) {
      for (const attente of commande[groupe]) {
        if (!apportsConnus.has(attente.apporte)) {
          signaler(chemin, `${ou} › ${groupe} : aucun modèle ni aucune fonction n'apporte « ${attente.apporte} » (data/creation.json)`);
        }
      }
    }
    for (const attente of commande.confort) {
      const valeurs = reglages.get(attente.reglage);
      if (!valeurs) signaler(chemin, `${ou} › confort : le réglage « ${attente.reglage} » n'existe pas dans data/creation.json`);
      else for (const valeur of attente.valeurs) {
        if (!valeurs.has(valeur)) signaler(chemin, `${ou} › confort › ${attente.reglage} : la valeur « ${valeur} » n'existe pas`);
      }
    }
    for (const id of Object.keys(commande.avis || {})) {
      if (!fonctions.has(id)) signaler(chemin, `${ou} › avis : la fonction « ${id} » n'existe pas dans data/creation.json`);
    }
    for (const id of Object.keys(commande.apercu || {})) {
      if (!modeles.has(id)) signaler(chemin, `${ou} › apercu : le modèle « ${id} » n'existe pas dans data/creation.json`);
    }
    for (const id of commande.debloquee?.apres || []) {
      if (!ids.has(id)) signaler(chemin, `${ou} › debloquee › apres : la commande « ${id} » n'existe pas`);
    }
    if ((commande.debloquee?.niveau || 1) > niveauMax) {
      signaler(chemin, `${ou} › debloquee › niveau : il n'y a que ${niveauMax} niveaux de réputation (data/jeu.json)`);
    }
    if (!meilleurProjet(commande, creation)) {
      signaler(chemin, `${ou} : aucune application ne peut la réussir « parfaitement » (besoins impossibles à couvrir, ou trop chargés)`);
    }
  }

  // Une partie qui n'obtiendrait que des « Bien » : tout doit se débloquer.
  if (!donnees.jeu) return;
  const paliers = donnees.jeu.reputation.paliers;
  const partie = {
    drapeaux: new Proxy({}, { get: () => true }), // tous les drapeaux (appel du mentor…)
    reputation: donnees.jeu.depart.reputation,
    commandes: { enCours: {}, livrees: [] },
  };
  for (let tour = 0; tour <= commandes.length; tour += 1) {
    const { offres } = etatDesCommandes(partie, commandes, paliers);
    if (offres.length === 0) break;
    for (const commande of offres) {
      partie.reputation += recompensePour('bien', commande, 0, creation.bareme).reputation;
      partie.commandes.livrees.push({ id: commande.id });
    }
  }
  const livrees = new Set(partie.commandes.livrees.map((livraison) => livraison.id));
  for (const commande of commandes) {
    if (!livrees.has(commande.id)) {
      signaler(chemin, `commandes › ${commande.id} : ne se débloque jamais si l'on n'obtient que des « Bien » (vérifier « debloquee »)`);
    }
  }
}

// Les personnages non joueurs : apparence connue, routine dans la journée,
// et chaque point de leur routine atteignable depuis l'entrée du lieu, avec
// LEUR façon de se déplacer (en fauteuil roulant : passages d'au moins 1 m).
function verifierPnj(donnees, signaler) {
  const chemin = 'data/pnj.json';
  const personnages = donnees.personnages;
  const catalogue = new Map((donnees.meubles?.meubles || []).map((meuble) => [meuble.id, meuble]));
  const journee = donnees.jeu ? {
    debut: heureEnMinutes(donnees.jeu.temps.debutJournee), fin: heureEnMinutes(donnees.jeu.temps.finJournee),
  } : null;
  const grilles = new Map();
  const grilleDe = (lieu) => {
    if (!grilles.has(lieu.id)) grilles.set(lieu.id, creerGrille(lieu, catalogue));
    return grilles.get(lieu.id);
  };
  for (const pnj of donnees.pnj?.pnj || []) {
    const ou = `pnj › ${pnj.id}`;
    const apparence = pnj.modele === 'ferrus' ? personnages?.ferrus?.apparence : pnj.apparence;
    if (pnj.apparence && personnages) {
      for (const champ of CHAMPS_APPARENCE) {
        if (!personnages.options[champ].some((option) => option.id === pnj.apparence[champ])) {
          signaler(chemin, `${ou} › apparence › ${champ} : « ${pnj.apparence[champ]} » n'existe pas dans data/personnages.json`);
        }
      }
    }
    if (journee) for (const message of verifierRoutine(pnj.routine, journee)) signaler(chemin, `${ou} › ${message}`);
    const profil = profilDeDeplacement(apparence?.aide);
    pnj.routine.forEach((creneau, n) => {
      if (creneau.lieu === 'ailleurs') return;
      const lieu = donnees.lieux?.[creneau.lieu];
      const ici = `${ou} › routine › n°${n + 1}`;
      if (!lieu) {
        signaler(chemin, `${ici} : le lieu « ${creneau.lieu} » n'existe pas`);
        return;
      }
      const points = new Map((lieu.points || []).map((p) => [p.id, p]));
      const arrivee = points.get(POINT_D_ARRIVEE);
      const point = points.get(creneau.point);
      if (!arrivee) signaler(lieu.chemin, `points : il manque le point « ${POINT_D_ARRIVEE} », par où arrivent les visiteurs`);
      if (!point) {
        signaler(chemin, `${ici} : le point « ${creneau.point} » n'existe pas dans ${lieu.chemin}`);
        return;
      }
      if (!arrivee) return;
      const grille = grilleDe(lieu);
      if (!grille.caseAccessible(arrivee.x, arrivee.z, profil)
        || !distancesDepuis(grille, arrivee, profil).has(`${point.x},${point.z}`)) {
        signaler(chemin, `${ici} : le point « ${creneau.point} » n'est pas atteignable ${NOMS_PROFILS[profil]} depuis l'entrée`);
      }
    });
  }
}
