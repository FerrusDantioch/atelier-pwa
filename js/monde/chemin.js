// =============================================================================
// chemin.js — trouver un chemin d'une case à une autre
// -----------------------------------------------------------------------------
// On utilise l'algorithme « A* » (A étoile) : il explore les cases en
// commençant par celles qui semblent les plus proches de l'arrivée, et trouve
// toujours le chemin le plus court. Les pas en diagonale coûtent √2, les pas
// droits 1.
//
// Le chemin trouvé passe de case en case (en escalier). lisserChemin() le
// simplifie en lignes droites, quand elles ne traversent ni mur ni meuble :
// les personnages marchent alors de façon naturelle.
//
// Ce module n'utilise ni la 3D ni la page : il est testé avec node --test.
// =============================================================================

const cle = (x, z) => `${x},${z}`;

// Estimation de la distance restante (« octile ») : jamais trop optimiste,
// ce qui garantit que A* trouve le plus court chemin.
function estimation(x1, z1, x2, z2) {
  const dx = Math.abs(x1 - x2);
  const dz = Math.abs(z1 - z2);
  return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
}

// Une petite file de priorité (tas binaire) : rend toujours l'élément le
// moins coûteux.
class File {
  constructor() { this.elements = []; }

  get taille() { return this.elements.length; }

  ajouter(element, priorite) {
    const tas = this.elements;
    tas.push({ element, priorite });
    let i = tas.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (tas[parent].priorite <= tas[i].priorite) break;
      [tas[parent], tas[i]] = [tas[i], tas[parent]];
      i = parent;
    }
  }

  retirer() {
    const tas = this.elements;
    const premier = tas[0];
    const dernier = tas.pop();
    if (tas.length > 0) {
      tas[0] = dernier;
      let i = 0;
      for (;;) {
        const gauche = 2 * i + 1;
        const droite = gauche + 1;
        let plusPetit = i;
        if (gauche < tas.length && tas[gauche].priorite < tas[plusPetit].priorite) plusPetit = gauche;
        if (droite < tas.length && tas[droite].priorite < tas[plusPetit].priorite) plusPetit = droite;
        if (plusPetit === i) break;
        [tas[plusPetit], tas[i]] = [tas[i], tas[plusPetit]];
        i = plusPetit;
      }
    }
    return premier.element;
  }
}

/**
 * Le plus court chemin de « depart » à « arrivee » ({ x, z }), avec ce profil
 * (« pieton » ou « fauteuil »). Renvoie la liste des cases, départ et arrivée
 * compris, ou null s'il n'y a pas de chemin.
 */
export function trouverChemin(grille, depart, arrivee, profil = 'pieton') {
  if (!grille.caseAccessible(arrivee.x, arrivee.z, profil)) return null;
  if (depart.x === arrivee.x && depart.z === arrivee.z) return [{ x: depart.x, z: depart.z }];

  const couts = new Map([[cle(depart.x, depart.z), 0]]);
  const venantDe = new Map();
  const file = new File();
  file.ajouter({ x: depart.x, z: depart.z }, estimation(depart.x, depart.z, arrivee.x, arrivee.z));
  const fermees = new Set();

  while (file.taille > 0) {
    const actuelle = file.retirer();
    const cleActuelle = cle(actuelle.x, actuelle.z);
    if (fermees.has(cleActuelle)) continue;
    fermees.add(cleActuelle);

    if (actuelle.x === arrivee.x && actuelle.z === arrivee.z) {
      // On remonte le chemin à l'envers.
      const chemin = [{ x: actuelle.x, z: actuelle.z }];
      let etape = cleActuelle;
      while (venantDe.has(etape)) {
        const precedente = venantDe.get(etape);
        chemin.unshift(precedente);
        etape = cle(precedente.x, precedente.z);
      }
      return chemin;
    }

    for (const voisine of grille.voisines(actuelle.x, actuelle.z, profil)) {
      const cleVoisine = cle(voisine.x, voisine.z);
      if (fermees.has(cleVoisine)) continue;
      const cout = couts.get(cleActuelle) + voisine.cout;
      if (cout < (couts.get(cleVoisine) ?? Infinity)) {
        couts.set(cleVoisine, cout);
        venantDe.set(cleVoisine, { x: actuelle.x, z: actuelle.z });
        file.ajouter({ x: voisine.x, z: voisine.z }, cout + estimation(voisine.x, voisine.z, arrivee.x, arrivee.z));
      }
    }
  }
  return null;
}

/**
 * Toutes les cases atteignables depuis « depart », avec la longueur du plus
 * court chemin pour chacune (Map « x,z » → longueur).
 */
export function distancesDepuis(grille, depart, profil = 'pieton') {
  const distances = new Map([[cle(depart.x, depart.z), 0]]);
  const file = new File();
  file.ajouter({ x: depart.x, z: depart.z }, 0);
  const fermees = new Set();
  while (file.taille > 0) {
    const actuelle = file.retirer();
    const cleActuelle = cle(actuelle.x, actuelle.z);
    if (fermees.has(cleActuelle)) continue;
    fermees.add(cleActuelle);
    for (const voisine of grille.voisines(actuelle.x, actuelle.z, profil)) {
      const cleVoisine = cle(voisine.x, voisine.z);
      const distance = distances.get(cleActuelle) + voisine.cout;
      if (distance < (distances.get(cleVoisine) ?? Infinity)) {
        distances.set(cleVoisine, distance);
        file.ajouter({ x: voisine.x, z: voisine.z }, distance);
      }
    }
  }
  return distances;
}

const caseDeCle = (texte) => {
  const [x, z] = texte.split(',').map(Number);
  return { x, z };
};

/**
 * La case atteignable la plus proche de « cible » (à vol d'oiseau), quand la
 * cible elle-même ne l'est pas (dans un meuble, dehors, passage trop étroit…).
 * À distance égale, on préfère la case la plus vite atteinte.
 */
export function caseAtteignableLaPlusProche(grille, depart, cible, profil = 'pieton', distances = null) {
  const atteignables = distances || distancesDepuis(grille, depart, profil);
  let meilleure = null;
  let meilleurEcart = Infinity;
  let meilleurTrajet = Infinity;
  for (const [texte, trajet] of atteignables) {
    const position = caseDeCle(texte);
    const ecart = Math.hypot(position.x - cible.x, position.z - cible.z);
    if (ecart < meilleurEcart - 1e-9 || (Math.abs(ecart - meilleurEcart) < 1e-9 && trajet < meilleurTrajet)) {
      meilleure = position;
      meilleurEcart = ecart;
      meilleurTrajet = trajet;
    }
  }
  return meilleure;
}

/**
 * Les cases d'où l'on peut utiliser un meuble : celles qui le touchent par un
 * côté (pas en diagonale), atteignables, de la plus proche à la plus lointaine.
 * Pour un meuble qu'on peut traverser (tapis), ses propres cases comptent.
 */
export function casesPourAtteindre(grille, emprise, depart, profil = 'pieton', distances = null) {
  const atteignables = distances || distancesDepuis(grille, depart, profil);
  const candidates = [];
  const ajouter = (x, z) => {
    const texte = cle(x, z);
    if (atteignables.has(texte) && !candidates.some((c) => c.x === x && c.z === z)) {
      candidates.push({ x, z, trajet: atteignables.get(texte) });
    }
  };
  const { x: ex, z: ez, largeur, profondeur } = emprise;
  if (emprise.bloque === false) {
    for (let x = ex; x < ex + largeur; x += 1) for (let z = ez; z < ez + profondeur; z += 1) ajouter(x, z);
  }
  for (let x = ex; x < ex + largeur; x += 1) {
    ajouter(x, ez - 1);
    ajouter(x, ez + profondeur);
  }
  for (let z = ez; z < ez + profondeur; z += 1) {
    ajouter(ex - 1, z);
    ajouter(ex + largeur, z);
  }
  return candidates.sort((a, b) => a.trajet - b.trajet);
}

/**
 * Les cases traversées par la ligne droite qui relie les centres de deux
 * cases (méthode d'Amanatides et Woo). Quand la ligne passe exactement par
 * un coin, le pas est en diagonale.
 */
export function casesTraversees(a, b) {
  const cases = [{ x: a.x, z: a.z }];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const pasX = Math.sign(dx);
  const pasZ = Math.sign(dz);
  const deltaX = dx !== 0 ? 1 / Math.abs(dx) : Infinity;
  const deltaZ = dz !== 0 ? 1 / Math.abs(dz) : Infinity;
  let prochainX = dx !== 0 ? 0.5 / Math.abs(dx) : Infinity;
  let prochainZ = dz !== 0 ? 0.5 / Math.abs(dz) : Infinity;
  let x = a.x;
  let z = a.z;
  let garde = Math.abs(dx) + Math.abs(dz) + 2;
  while ((x !== b.x || z !== b.z) && garde > 0) {
    garde -= 1;
    if (Math.abs(prochainX - prochainZ) < 1e-9) {
      x += pasX;
      z += pasZ;
      prochainX += deltaX;
      prochainZ += deltaZ;
    } else if (prochainX < prochainZ) {
      x += pasX;
      prochainX += deltaX;
    } else {
      z += pasZ;
      prochainZ += deltaZ;
    }
    cases.push({ x, z });
  }
  return cases;
}

// La ligne droite entre deux cases ne traverse-t-elle ni mur ni meuble ?
export function ligneLibre(grille, a, b, profil = 'pieton') {
  const cases = casesTraversees(a, b);
  for (let i = 1; i < cases.length; i += 1) {
    const avant = cases[i - 1];
    const apres = cases[i];
    if (!grille.peutAller(avant.x, avant.z, apres.x, apres.z, profil)) return false;
  }
  return true;
}

/**
 * Simplifie un chemin case par case en quelques lignes droites. On garde le
 * départ, puis on saute aussi loin que possible tant que la ligne est libre.
 */
export function lisserChemin(grille, chemin, profil = 'pieton') {
  if (!chemin || chemin.length <= 2) return chemin;
  const resultat = [chemin[0]];
  let i = 0;
  while (i < chemin.length - 1) {
    let j = chemin.length - 1;
    while (j > i + 1 && !ligneLibre(grille, chemin[i], chemin[j], profil)) j -= 1;
    resultat.push(chemin[j]);
    i = j;
  }
  return resultat;
}

// La longueur d'un chemin (en cases), quelle que soit sa forme.
export function longueurChemin(chemin) {
  let total = 0;
  for (let i = 1; i < (chemin?.length || 0); i += 1) {
    total += Math.hypot(chemin[i].x - chemin[i - 1].x, chemin[i].z - chemin[i - 1].z);
  }
  return total;
}
