// =============================================================================
// personnage.js — un personnage low-poly fabriqué d'après son apparence
// -----------------------------------------------------------------------------
// Le personnage est un assemblage de formes simples (boîtes, sphères à
// facettes). Les parties qui bougent (jambes, genoux, bras, roues) sont des
// groupes séparés, que animer() fait pivoter.
//
// Repères : les pieds touchent le sol (y = 0) et le personnage regarde vers
// +z. Il mesure environ 1,74 m (taille « moyenne »).
//
// L'aide à la mobilité est neutre : elle change le dessin et la posture,
// jamais les règles du jeu (seule la largeur des passages compte pour le
// fauteuil, voir grille.js).
// =============================================================================

import {
  CircleGeometry, Group, Mesh, MeshBasicMaterial,
} from '../../lib/three/three.module.js';
import { creerConstructeur, matiereDecor } from './formes.js';

const ECHELLES_TAILLE = { petite: 0.92, moyenne: 1, grande: 1.07 };
const LARGEURS = { fine: 0.85, moyenne: 1, large: 1.28 };

// Hauteur des hanches debout et assis (fauteuil roulant).
const HANCHES_DEBOUT = 0.86;
const HANCHES_ASSIS = 0.56;

let matiereOmbre = null;

// La couleur choisie pour un champ de l'apparence (ex. teint → peau-3).
function couleurDe(champ, apparence, personnages, palette) {
  const option = personnages.options[champ].find((o) => o.id === apparence[champ]) || personnages.options[champ][0];
  return palette.couleur(option.couleur || 'gris');
}

function mesh(constructeur) {
  return new Mesh(constructeur.construire(), matiereDecor());
}

// --- La tête : visage, cheveux, barbe, lunettes, couvre-chef -------------------
function construireTete(apparence, couleurs) {
  const tete = creerConstructeur();
  tete.sphere({ rayon: 0.15, details: 1, echelle: [1, 1.08, 1] }, [0, 0, 0], couleurs.peau);
  // Les yeux : ils montrent dans quelle direction le personnage regarde.
  tete.boite([0.035, 0.05, 0.02], [-0.055, 0.015, 0.138], couleurs.yeux);
  tete.boite([0.035, 0.05, 0.02], [0.055, 0.015, 0.138], couleurs.yeux);

  const cheveux = couleurs.cheveux;
  const foulard = apparence.couvreChef === 'foulard';
  // Les cheveux : une calotte sur le dessus (jusqu'au front), puis l'arrière
  // et les côtés plus bas. Le visage (devant, +z) reste toujours dégagé.
  const OUVERTURE_VISAGE = Math.PI * 0.75;
  const calotte = (rayon, longueur = 0.55) => {
    tete.calotte({ rayon, thetaLongueur: Math.PI * 0.3, segments: 10, anneaux: 3, echelle: [1, 1.08, 1] }, [0, 0, -0.004], cheveux);
    tete.calotte({
      rayon,
      phiDebut: Math.PI / 2 + OUVERTURE_VISAGE / 2,
      phiLongueur: Math.PI * 2 - OUVERTURE_VISAGE,
      thetaLongueur: Math.PI * longueur,
      segments: 10,
      anneaux: 4,
      echelle: [1, 1.08, 1],
    }, [0, 0, -0.004], cheveux);
  };
  if (!foulard) {
    switch (apparence.coiffure) {
      case 'rasee':
        calotte(0.153, 0.48);
        break;
      case 'tres-courte':
        calotte(0.158, 0.5);
        break;
      case 'courte':
        calotte(0.162);
        tete.boite([0.2, 0.05, 0.06], [0, 0.135, 0.1], cheveux, [35, 0, 0]);
        break;
      case 'mi-longue':
        calotte(0.165);
        tete.boite([0.3, 0.26, 0.1], [0, -0.05, -0.1], cheveux);
        tete.boite([0.05, 0.22, 0.14], [-0.145, -0.04, 0.0], cheveux);
        tete.boite([0.05, 0.22, 0.14], [0.145, -0.04, 0.0], cheveux);
        break;
      case 'longue':
        calotte(0.165);
        tete.boite([0.31, 0.5, 0.1], [0, -0.17, -0.11], cheveux);
        tete.boite([0.05, 0.36, 0.13], [-0.15, -0.1, 0.0], cheveux);
        tete.boite([0.05, 0.36, 0.13], [0.15, -0.1, 0.0], cheveux);
        break;
      case 'chignon':
        calotte(0.158);
        tete.sphere({ rayon: 0.075, details: 1 }, [0, 0.12, -0.13], cheveux);
        break;
      case 'boucles': {
        calotte(0.17, 0.6);
        const boucles = [[0, 0.16, 0], [0.1, 0.12, 0.05], [-0.1, 0.12, 0.05], [0.13, 0.04, -0.05],
          [-0.13, 0.04, -0.05], [0, 0.1, -0.12], [0.08, 0.0, -0.13], [-0.08, 0.0, -0.13], [0.06, 0.15, -0.07], [-0.06, 0.15, -0.07]];
        for (const position of boucles) tete.sphere({ rayon: 0.075 }, position, cheveux);
        break;
      }
      default:
        break;
    }
  }

  if (apparence.barbe === 'courte') {
    tete.boite([0.22, 0.08, 0.06], [0, -0.11, 0.11], cheveux);
    tete.boite([0.04, 0.1, 0.1], [-0.12, -0.06, 0.07], cheveux);
    tete.boite([0.04, 0.1, 0.1], [0.12, -0.06, 0.07], cheveux);
  } else if (apparence.barbe === 'longue') {
    tete.boite([0.2, 0.18, 0.08], [0, -0.15, 0.1], cheveux);
    tete.boite([0.04, 0.12, 0.1], [-0.12, -0.07, 0.07], cheveux);
    tete.boite([0.04, 0.12, 0.1], [0.12, -0.07, 0.07], cheveux);
  }

  // Lunettes : seulement la monture (on voit les yeux à travers), pour ne
  // pas ressembler à des lunettes de soleil.
  const monture = couleurs.monture;
  if (apparence.lunettes === 'rondes') {
    for (const x of [-0.058, 0.058]) tete.tore({ rayon: 0.04, epaisseur: 0.007, cotes: 12 }, [x, 0.015, 0.152], monture);
    tete.boite([0.034, 0.01, 0.01], [0, 0.025, 0.154], monture);
  } else if (apparence.lunettes === 'carrees') {
    for (const x of [-0.058, 0.058]) {
      tete.boite([0.085, 0.011, 0.012], [x, 0.046, 0.152], monture);
      tete.boite([0.085, 0.011, 0.012], [x, -0.016, 0.152], monture);
      tete.boite([0.011, 0.062, 0.012], [x - 0.037, 0.015, 0.152], monture);
      tete.boite([0.011, 0.062, 0.012], [x + 0.037, 0.015, 0.152], monture);
    }
    tete.boite([0.034, 0.01, 0.01], [0, 0.025, 0.154], monture);
  }

  const chapeau = couleurs.couvreChef;
  if (apparence.couvreChef === 'bonnet') {
    tete.calotte({ rayon: 0.172, thetaLongueur: Math.PI * 0.5, echelle: [1, 1.12, 1] }, [0, 0.01, 0], chapeau);
    tete.cylindre({ rayon: 0.176, hauteur: 0.05, cotes: 12 }, [0, 0.02, 0], chapeau);
    tete.sphere({ rayon: 0.045 }, [0, 0.2, 0], chapeau);
  } else if (apparence.couvreChef === 'casquette') {
    tete.calotte({ rayon: 0.168, thetaLongueur: Math.PI * 0.5, echelle: [1, 1.05, 1] }, [0, 0.02, 0], chapeau);
    tete.boite([0.2, 0.02, 0.13], [0, 0.04, 0.2], chapeau, [-6, 0, 0]);
  } else if (foulard) {
    // Un foulard ouvert devant le visage, qui tombe sur les épaules.
    tete.calotte({
      rayon: 0.175, phiDebut: Math.PI / 2 + Math.PI * 0.32, phiLongueur: Math.PI * 1.36,
      thetaLongueur: Math.PI * 0.82, segments: 12, anneaux: 6, echelle: [1, 1.08, 1],
    }, [0, 0, -0.005], chapeau);
    tete.calotte({ rayon: 0.176, thetaLongueur: Math.PI * 0.35, echelle: [1, 1.08, 1] }, [0, 0, -0.005], chapeau);
    tete.cylindre({ rayon: 0.24, rayonHaut: 0.13, hauteur: 0.2, cotes: 10 }, [0, -0.2, -0.01], chapeau);
  }
  return mesh(tete);
}

/**
 * Fabrique le personnage. Renvoie { groupe, parties, assis, liberer() }.
 *   apparence    : apparence complète (js/jeu/personnage.js › nettoyerApparence)
 *   personnages  : data/personnages.json
 *   palette      : voir palette.js
 */
export function construirePersonnage(apparence, personnages, palette) {
  const couleurs = {
    peau: couleurDe('teint', apparence, personnages, palette),
    cheveux: couleurDe('cheveux', apparence, personnages, palette),
    haut: couleurDe('haut', apparence, personnages, palette),
    motif: couleurDe('couleurMotif', apparence, personnages, palette),
    bas: couleurDe('bas', apparence, personnages, palette),
    couvreChef: couleurDe('couleurCouvreChef', apparence, personnages, palette),
    aide: couleurDe('couleurAide', apparence, personnages, palette),
    yeux: palette.couleur('yeux'),
    monture: palette.couleur('noir'),
    chaussures: palette.couleur('chaussures'),
    pneu: palette.couleur('pneu'),
    metal: palette.couleur('metal'),
    assise: palette.couleur('anthracite'),
  };
  const assis = apparence.aide === 'fauteuil';
  const largeur = LARGEURS[apparence.silhouette] || 1;
  const epaisseur = 1 + (largeur - 1) * 0.6;
  const jambesNues = apparence.styleBas !== 'pantalon';

  const groupe = new Group();
  groupe.name = 'personnage';
  const echelle = ECHELLES_TAILLE[apparence.taille] || 1;
  const corps = new Group();
  corps.scale.setScalar(echelle);
  groupe.add(corps);
  const hanches = assis ? HANCHES_ASSIS : HANCHES_DEBOUT;
  if (assis) corps.position.z = -0.04;

  // Bassin, buste, cou.
  const buste = creerConstructeur();
  buste.boite([0.32 * largeur, 0.15, 0.19 * epaisseur], [0, hanches, 0], couleurs.bas);
  buste.boite([0.36 * largeur, 0.48, 0.21 * epaisseur], [0, hanches + 0.3, 0], couleurs.haut);
  buste.cylindre({ rayon: 0.055, hauteur: 0.1, cotes: 8 }, [0, hanches + 0.57, 0], couleurs.peau);
  const rayures = apparence.motifHaut === 'rayures';
  if (rayures) {
    // Rayures verticales devant, derrière et sur les côtés du buste.
    const devant = 0.105 * epaisseur + 0.003;
    const cote = 0.18 * largeur + 0.003;
    for (const x of [-0.135, -0.045, 0.045, 0.135]) {
      for (const z of [devant, -devant]) buste.boite([0.022, 0.47, 0.006], [x * largeur, hanches + 0.3, z], couleurs.motif);
    }
    for (const z of [-0.045, 0.045]) {
      for (const x of [cote, -cote]) buste.boite([0.006, 0.47, 0.022], [x, hanches + 0.3, z * epaisseur], couleurs.motif);
    }
  }
  if (apparence.styleBas === 'jupe') {
    if (assis) buste.boite([0.38 * largeur, 0.13, 0.46], [0, hanches - 0.02, 0.18], couleurs.bas);
    else buste.cylindre({ rayon: 0.25 * largeur, rayonHaut: 0.17 * largeur, hauteur: 0.36, cotes: 10 }, [0, hanches - 0.16, 0], couleurs.bas);
  }
  corps.add(mesh(buste));

  // Tête.
  const tete = construireTete(apparence, couleurs);
  tete.position.set(0, hanches + 0.74, 0);
  corps.add(tete);

  // Jambes : un pivot à la hanche, un autre au genou.
  const jambes = [];
  const genoux = [];
  for (const cote of [-1, 1]) {
    const jambe = new Group();
    jambe.position.set(0.085 * largeur * cote, hanches - 0.02, 0);
    const cuisse = creerConstructeur();
    const couleurCuisse = apparence.styleBas === 'jupe' ? couleurs.peau : couleurs.bas;
    cuisse.boite([0.13, 0.42, 0.14], [0, -0.21, 0], couleurCuisse);
    jambe.add(mesh(cuisse));
    const genou = new Group();
    genou.position.y = -0.42;
    const tibia = creerConstructeur();
    tibia.boite([0.12, 0.38, 0.13], [0, -0.19, 0], jambesNues ? couleurs.peau : couleurs.bas);
    tibia.boite([0.13, 0.08, 0.22], [0, -0.4, 0.04], couleurs.chaussures);
    genou.add(mesh(tibia));
    jambe.add(genou);
    corps.add(jambe);
    jambes.push(jambe);
    genoux.push(genou);
    if (assis) {
      jambe.rotation.x = -Math.PI / 2;
      genou.rotation.x = Math.PI / 2;
    }
  }

  // Bras : un pivot à l'épaule.
  const bras = [];
  for (const cote of [-1, 1]) {
    const unBras = new Group();
    unBras.position.set((0.18 * largeur + 0.05) * cote, hanches + 0.49, 0);
    unBras.rotation.z = 0.03 * cote;
    const forme = creerConstructeur();
    forme.boite([0.1, 0.34, 0.11], [0, -0.17, 0], couleurs.haut);
    forme.boite([0.09, 0.24, 0.1], [0, -0.46, 0], couleurs.haut);
    forme.boite([0.085, 0.09, 0.09], [0, -0.625, 0], couleurs.peau);
    if (rayures) {
      for (const z of [0.058, -0.058]) {
        forme.boite([0.018, 0.33, 0.004], [0, -0.17, z], couleurs.motif);
        forme.boite([0.016, 0.23, 0.004], [0, -0.46, z * 0.92], couleurs.motif);
      }
      forme.boite([0.004, 0.33, 0.018], [0.052 * cote, -0.17, 0], couleurs.motif);
      forme.boite([0.004, 0.23, 0.016], [0.047 * cote, -0.46, 0], couleurs.motif);
    }
    unBras.add(mesh(forme));
    corps.add(unBras);
    bras.push(unBras);
    if (assis) unBras.rotation.x = -0.35;
  }

  // La canne, tenue dans la main droite (côté +x).
  let canne = null;
  if (apparence.aide === 'canne') {
    canne = new Group();
    canne.position.set(0, -0.625, 0.02);
    const forme = creerConstructeur();
    forme.cylindre({ rayon: 0.014, hauteur: 0.74, cotes: 6 }, [0, -0.37, 0.02], couleurs.aide);
    forme.boite([0.03, 0.03, 0.12], [0, 0.0, 0.05], couleurs.aide);
    canne.add(mesh(forme));
    bras[1].add(canne);
  }

  // Le fauteuil roulant.
  const roues = [];
  if (assis) {
    const fauteuil = creerConstructeur();
    const tube = couleurs.aide;
    fauteuil.boite([0.44, 0.05, 0.42], [0, 0.48, -0.02], couleurs.assise);
    fauteuil.boite([0.42, 0.4, 0.05], [0, 0.72, -0.24], couleurs.assise);
    for (const x of [-0.235, 0.235]) {
      fauteuil.boite([0.03, 0.03, 0.46], [x, 0.47, 0], tube);
      fauteuil.boite([0.03, 0.62, 0.03], [x, 0.66, -0.25], tube, [-6, 0, 0]);
      fauteuil.boite([0.03, 0.03, 0.1], [x, 0.96, -0.3], tube);
      fauteuil.boite([0.03, 0.42, 0.03], [x, 0.28, 0.2], tube, [12, 0, 0]);
      fauteuil.cylindre({ rayon: 0.055, hauteur: 0.035, cotes: 8 }, [x * 0.82, 0.055, 0.26], couleurs.pneu, [0, 0, 90]);
    }
    fauteuil.boite([0.36, 0.025, 0.14], [0, 0.1, 0.33], tube);
    const meshFauteuil = mesh(fauteuil);
    meshFauteuil.name = 'fauteuil';
    groupe.add(meshFauteuil);
    for (const x of [-0.29, 0.29]) {
      const roue = new Group();
      roue.position.set(x, 0.3, -0.06);
      // Une roue « ajourée » : pneu, jante, main courante, rayons et moyeu.
      const forme = creerConstructeur();
      const dehors = x > 0 ? 1 : -1;
      forme.tore({ rayon: 0.275, epaisseur: 0.027 }, [0, 0, 0], couleurs.pneu, [0, 90, 0]);
      forme.tore({ rayon: 0.245, epaisseur: 0.012 }, [0, 0, 0], couleurs.metal, [0, 90, 0]);
      forme.tore({ rayon: 0.26, epaisseur: 0.01 }, [dehors * 0.04, 0, 0], couleurs.metal, [0, 90, 0]);
      for (const angle of [0, 60, 120]) forme.boite([0.012, 0.49, 0.016], [0, 0, 0], couleurs.metal, [angle, 0, 0]);
      forme.cylindre({ rayon: 0.04, hauteur: 0.06, cotes: 8 }, [0, 0, 0], tube, [0, 0, 90]);
      roue.add(mesh(forme));
      groupe.add(roue);
      roues.push(roue);
    }
  }

  // Une ombre douce sous le personnage.
  if (!matiereOmbre) {
    matiereOmbre = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
  }
  const ombre = new Mesh(new CircleGeometry(assis ? 0.42 : 0.3, 16), matiereOmbre);
  ombre.rotation.x = -Math.PI / 2;
  ombre.position.y = 0.006;
  ombre.renderOrder = -1;
  groupe.add(ombre);

  return {
    groupe,
    assis,
    parties: { corps, jambes, genoux, bras, roues, canne },
    etat: { phase: 0, roue: 0 },
    liberer() {
      groupe.traverse((objet) => {
        if (objet.isMesh) objet.geometry.dispose();
      });
    },
  };
}

// Rapproche doucement une valeur d'une autre (retour au repos).
function vers(valeur, cible, facteur) {
  return valeur + (cible - valeur) * facteur;
}

/**
 * Anime le personnage pendant une image.
 *   dt         temps écoulé (secondes)
 *   distance   distance parcourue pendant cette image (mètres)
 *   reduit     animations réduites : pas de balancement du corps
 */
export function animerPersonnage(perso, { dt, distance, reduit }) {
  const { corps, jambes, genoux, bras, roues, canne } = perso.parties;
  const etat = perso.etat;
  const enMouvement = distance > 0.0001;
  const retour = Math.min(1, dt * 10);

  if (perso.assis) {
    etat.roue += distance / 0.3;
    for (const roue of roues) roue.rotation.x = etat.roue;
    if (enMouvement) {
      etat.phase += distance * 4.2;
      const poussee = Math.sin(etat.phase) * 0.3;
      bras[0].rotation.x = -0.35 + poussee;
      bras[1].rotation.x = -0.35 + poussee;
    } else {
      bras[0].rotation.x = vers(bras[0].rotation.x, -0.35, retour);
      bras[1].rotation.x = vers(bras[1].rotation.x, -0.35, retour);
    }
    return enMouvement || Math.abs(bras[0].rotation.x + 0.35) > 0.001;
  }

  if (enMouvement) {
    // Un cycle de marche (deux pas) tous les 1,1 m environ.
    etat.phase += distance * (Math.PI * 2 / 1.1);
    const s = Math.sin(etat.phase);
    jambes[0].rotation.x = s * 0.5;
    jambes[1].rotation.x = -s * 0.5;
    genoux[0].rotation.x = Math.max(0, -s) * 0.6;
    genoux[1].rotation.x = Math.max(0, s) * 0.6;
    bras[0].rotation.x = -s * 0.4;
    bras[1].rotation.x = canne ? s * 0.15 : s * 0.4;
    corps.position.y = reduit ? 0 : Math.abs(Math.cos(etat.phase)) * 0.025;
    return true;
  }
  let bouge = false;
  for (const partie of [...jambes, ...genoux, ...bras]) {
    partie.rotation.x = vers(partie.rotation.x, 0, retour);
    if (Math.abs(partie.rotation.x) > 0.001) bouge = true;
    else partie.rotation.x = 0;
  }
  corps.position.y = vers(corps.position.y, 0, retour);
  return bouge;
}
