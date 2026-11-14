// =============================================================================
// monde.js — le lieu en 3D, le personnage et ce qu'on peut y faire
// -----------------------------------------------------------------------------
// C'est le chef d'orchestre de la 3D pendant le jeu. Il relie :
//   la grille et les chemins (où peut-on aller ?),
//   le lieu en 3D, le personnage, les repères, la caméra, la lumière,
//   le doigt, la souris et le clavier.
// L'interface (js/interface/ecran-jeu.js) lui demande d'agir (« aller au
// bureau », « tourner la vue ») et il la prévient en retour (« arrivé »,
// « nouvelle pièce », « objet à examiner à côté »), par les « rappels ».
//
// Le monde ne décide d'aucune règle du jeu : il montre et il déplace.
// =============================================================================

import { Color, Plane, Scene, Vector3 } from '../../lib/three/three.module.js';
import { apparenceDuJoueur } from '../jeu/personnage.js';
import { couleurDuTheme } from '../modeles/palette.js';
import { animerPersonnage, construirePersonnage } from '../modeles/personnage.js';
import { creerCameraIso } from './camera-iso.js';
import {
  caseAtteignableLaPlusProche, casesPourAtteindre, distancesDepuis, lisserChemin, trouverChemin,
} from './chemin.js';
import { brancherClavier } from './controles.js';
import { creerDeplacement, directionsPourAller } from './deplacement.js';
import { TAILLE_CASE, angleVers, caseDuPoint, creerGrille, profilDeDeplacement } from './grille.js';
import { construireLieu } from './lieu.js';
import { creerLumieres } from './lumieres.js';
import { brancherPointage } from './pointage.js';
import { creerReperes } from './reperes.js';

const SOL = new Plane(new Vector3(0, 1, 0), 0);

/**
 * Crée le monde d'une partie.
 *   moteur      le moteur de dessin (moteur.js)
 *   donnees     toutes les données du jeu
 *   palette     les couleurs de la 3D
 *   partie      la partie en cours (lue seulement)
 *   reglages()  les réglages actuels
 *   rappels     { surArrivee, surPiece, surObjetProche, surPosition, surVue, surBloque, actif() }
 */
export function creerMonde({ moteur, donnees, palette, partie, reglages, rappels }) {
  const lieu = donnees.lieux[partie.lieux.actuel] || donnees.lieux[donnees.jeu.depart.lieu];
  const catalogue = new Map(donnees.meubles.meubles.map((meuble) => [meuble.id, meuble]));
  const grille = creerGrille(lieu, catalogue);
  const nomsPieces = new Map(lieu.pieces.map((piece) => [piece.id, piece]));

  const scene = new Scene();
  scene.background = new Color(couleurDuTheme('--fond-scene', '#1f1733'));
  const lumieres = creerLumieres();
  scene.add(lumieres.groupe);
  const construit = construireLieu({ lieu, grille, catalogue, palette });
  scene.add(construit.groupe);
  const reperes = creerReperes();
  scene.add(reperes.groupe);

  const camera = creerCameraIso({ largeurLieu: construit.largeur, profondeurLieu: construit.profondeur, hauteurLieu: lieu.hauteurMurs });

  // --- Le personnage du joueur ---------------------------------------------------
  let apparence = apparenceDuJoueur(partie.joueur, donnees.personnages);
  let profil = profilDeDeplacement(apparence.aide);
  let perso = construirePersonnage(apparence, donnees.personnages, palette);
  scene.add(perso.groupe);

  // Case de départ : celle de la sauvegarde si elle convient, sinon le départ
  // du lieu (ou la case accessible la plus proche).
  function caseDeDepart() {
    const sauvee = partie.joueur?.position;
    if (sauvee && grille.caseAccessible(sauvee.x, sauvee.z, profil)) return { ...sauvee };
    const depart = { x: lieu.depart.x, z: lieu.depart.z, angle: lieu.depart.angle };
    if (grille.caseAccessible(depart.x, depart.z, profil)) return depart;
    return { ...plusProcheAccessible(depart), angle: lieu.depart.angle };
  }
  function plusProcheAccessible(point) {
    let meilleure = null;
    let ecart = Infinity;
    for (let x = 0; x < grille.largeur; x += 1) {
      for (let z = 0; z < grille.profondeur; z += 1) {
        if (!grille.caseAccessible(x, z, profil)) continue;
        const d = Math.hypot(x - point.x, z - point.z);
        if (d < ecart) { ecart = d; meilleure = { x, z }; }
      }
    }
    return meilleure || { x: lieu.depart.x, z: lieu.depart.z };
  }

  const depart = caseDeDepart();
  const deplacement = creerDeplacement({ depart, vitesse: donnees.jeu.deplacement.vitesse });
  let pieceActuelle = grille.piece(depart.x, depart.z);
  let cibleVisee = null; // l'objet vers lequel on marche
  let objetProche = null; // l'objet qu'on peut examiner, là où l'on est
  let directionClavier = null;
  let actif = true;

  const animationsReduites = () => document.documentElement.getAttribute('data-animations') === 'reduites';

  function placerPerso() {
    const { x, z } = deplacement.position;
    perso.groupe.position.set(x, 0, z);
    perso.groupe.rotation.y = deplacement.angle * Math.PI / 180;
  }
  placerPerso();

  // --- Ce qu'on peut examiner ----------------------------------------------------
  const cibles = construit.cibles;
  const cibleParId = new Map(cibles.map((cible) => [cible.id, cible]));
  const pointParId = new Map((lieu.points || []).map((point) => [point.id, point]));

  // Les informations d'un objet (meuble ou point) pour l'interface.
  function infosObjet(cible) {
    if (cible.type === 'point') {
      const point = pointParId.get(cible.id);
      return { id: point.id, type: 'point', nom: point.nom, designation: point.designation, description: point.description };
    }
    const emprise = grille.emprises.get(cible.id);
    const meuble = emprise.meuble;
    return {
      id: cible.id,
      type: 'meuble',
      nom: meuble.nom,
      designation: meuble.designation || meuble.nom,
      description: emprise.place.description || meuble.description || null,
    };
  }

  // Les cases d'où l'on peut examiner un objet.
  function casesPourCible(cible, distances) {
    const ici = deplacement.case;
    if (cible.type === 'point') {
      const point = pointParId.get(cible.id);
      return distances.has(`${point.x},${point.z}`) ? [{ x: point.x, z: point.z }] : [];
    }
    return casesPourAtteindre(grille, grille.emprises.get(cible.id), ici, profil, distances);
  }

  // L'angle pour regarder un objet depuis la case (x, z).
  function angleVersCible(cible, x, z) {
    if (cible.type === 'point') return pointParId.get(cible.id).angle;
    const boite = cible.boite;
    const cx = (x + 0.5) * TAILLE_CASE;
    const cz = (z + 0.5) * TAILLE_CASE;
    const px = Math.min(Math.max(cx, boite.min.x), boite.max.x);
    const pz = Math.min(Math.max(cz, boite.min.z), boite.max.z);
    return angleVers(px - cx, pz - cz);
  }

  // Un objet examinable à côté de la case actuelle (celui qu'on regarde de
  // préférence).
  function chercherObjetProche() {
    const ici = deplacement.case;
    const distances = new Map([[`${ici.x},${ici.z}`, 0]]);
    let meilleur = null;
    let meilleurEcart = Infinity;
    for (const cible of cibles) {
      if (!cible.examinable) continue;
      if (casesPourCible(cible, distances).length === 0) continue;
      const angle = angleVersCible(cible, ici.x, ici.z);
      const ecart = angle === null ? 0 : Math.abs(((angle - deplacement.angle + 540) % 360) - 180);
      if (ecart < meilleurEcart) {
        meilleur = cible;
        meilleurEcart = ecart;
      }
    }
    return meilleur;
  }

  function definirObjetProche(cible) {
    if (cible === objetProche) return;
    objetProche = cible;
    if (cible) reperes.montrerCible(cible.boite);
    else reperes.cacherCible();
    rappels.surObjetProche?.(cible ? infosObjet(cible) : null);
    moteur.redessiner();
  }

  // --- Déplacements -------------------------------------------------------------
  function partir(chemin, destination) {
    if (!chemin || chemin.length === 0) return false;
    // Déjà dans la bonne case (peut-être entre deux) : on va à son centre.
    if (chemin.length === 1) deplacement.revenirAuCentre();
    else deplacement.suivre(lisserChemin(grille, chemin, profil));
    definirObjetProche(null);
    if (deplacement.enRoute) reperes.montrerDestination(destination.x, destination.z);
    camera.reprendreSuivi();
    moteur.animer(image);
    return true;
  }

  // La case de départ d'un nouveau chemin : celle où le personnage se trouve
  // (s'il marchait, il repart de là où il est).
  function caseDeDepartChemin() {
    const ici = deplacement.case;
    return grille.caseAccessible(ici.x, ici.z, profil) ? ici : plusProcheAccessible(ici);
  }

  function arriveSurPlace(cible, x, z) {
    const angle = angleVersCible(cible, x, z);
    if (angle !== null) deplacement.regarder(angle, { instantane: animationsReduites() });
    moteur.animer(image);
  }

  // Aller vers un objet (meuble, point) : jusqu'à la case la plus proche qui
  // permet de l'examiner.
  function allerVersCible(cible) {
    const depart = caseDeDepartChemin();
    const distances = distancesDepuis(grille, depart, profil);
    const cases = casesPourCible(cible, distances);
    if (cases.length === 0) {
      rappels.surBloque?.(infosObjet(cible));
      return false;
    }
    const arrivee = cases[0];
    cibleVisee = cible.examinable ? cible : null;
    if (arrivee.x === depart.x && arrivee.z === depart.z && !deplacement.enRoute) {
      arriveSurPlace(cible, arrivee.x, arrivee.z);
      if (cible.examinable) definirObjetProche(cible);
      cibleVisee = null;
      return true;
    }
    return partir(trouverChemin(grille, depart, arrivee, profil), arrivee);
  }

  function allerVersCase(x, z) {
    const occupant = grille.occupant(x, z);
    if (occupant && cibleParId.has(occupant)) return allerVersCible(cibleParId.get(occupant));
    const depart = caseDeDepartChemin();
    const distances = distancesDepuis(grille, depart, profil);
    const arrivee = distances.has(`${x},${z}`) ? { x, z } : caseAtteignableLaPlusProche(grille, depart, { x, z }, profil, distances);
    if (!arrivee) return false;
    cibleVisee = null;
    if (arrivee.x === depart.x && arrivee.z === depart.z) {
      if (!deplacement.enRoute) {
        // Déjà là : on se tourne simplement vers l'endroit touché.
        const angle = angleVers(x - depart.x, z - depart.z);
        if (angle !== null) deplacement.regarder(angle, { instantane: animationsReduites() });
        moteur.animer(image);
        return true;
      }
    }
    return partir(trouverChemin(grille, depart, arrivee, profil), arrivee);
  }

  // Aller dans une pièce : la case accessible de la pièce la plus proche de
  // son centre.
  function allerDansPiece(idPiece) {
    const piece = nomsPieces.get(idPiece);
    if (!piece) return false;
    const [zx, zz, zl, zp] = piece.zones[0];
    const centre = { x: zx + (zl - 1) / 2, z: zz + (zp - 1) / 2 };
    const depart = caseDeDepartChemin();
    const distances = distancesDepuis(grille, depart, profil);
    let meilleure = null;
    let ecart = Infinity;
    for (const cle of distances.keys()) {
      const [x, z] = cle.split(',').map(Number);
      if (grille.piece(x, z) !== idPiece) continue;
      const d = Math.hypot(x - centre.x, z - centre.z);
      if (d < ecart) { ecart = d; meilleure = { x, z }; }
    }
    if (!meilleure) return false;
    cibleVisee = null;
    return partir(trouverChemin(grille, depart, meilleure, profil), meilleure);
  }

  // Un pas au clavier, dans la direction voulue (si possible).
  function pasAuClavier() {
    if (!directionClavier) return;
    const sol = camera.directionAuSol(directionClavier.droite, directionClavier.haut);
    const ici = deplacement.case;
    for (const [dx, dz] of directionsPourAller(sol.x, sol.z)) {
      if (grille.peutAller(ici.x, ici.z, ici.x + dx, ici.z + dz, profil)) {
        cibleVisee = null;
        reperes.cacherDestination();
        deplacement.suivre([ici, { x: ici.x + dx, z: ici.z + dz }]);
        definirObjetProche(null);
        camera.reprendreSuivi();
        return;
      }
    }
    // Bloqué : on se tourne quand même dans la direction demandée.
    const angle = angleVers(sol.x, sol.z);
    if (angle !== null) deplacement.regarder(Math.round(angle / 45) * 45, { instantane: animationsReduites() });
  }

  function quandArrive() {
    reperes.cacherDestination();
    const ici = deplacement.case;
    if (cibleVisee) {
      arriveSurPlace(cibleVisee, ici.x, ici.z);
      const cible = cibleVisee;
      cibleVisee = null;
      definirObjetProche(cible);
      rappels.surArrivee?.(infosObjet(cible));
    } else {
      definirObjetProche(chercherObjetProche());
      rappels.surArrivee?.(null);
    }
    rappels.surPosition?.({ x: ici.x, z: ici.z, angle: Math.round(deplacement.angle) });
  }

  // --- L'image suivante -----------------------------------------------------------
  function image(dt) {
    const reduit = animationsReduites();
    const resultat = deplacement.avancer(dt, { tournerInstantanement: reduit });
    if (!deplacement.enRoute && directionClavier) pasAuClavier();
    placerPerso();
    const persoBouge = animerPersonnage(perso, { dt, distance: resultat.distance, reduit });

    if (resultat.caseChangee) {
      const ici = deplacement.case;
      const piece = grille.piece(ici.x, ici.z);
      if (piece && piece !== pieceActuelle) {
        pieceActuelle = piece;
        rappels.surPiece?.(nomsPieces.get(piece));
      }
    }
    if (resultat.arrive && !directionClavier) quandArrive();
    else if (resultat.arrive && directionClavier && !deplacement.enRoute) {
      // Les touches restent enfoncées mais le pas suivant est bloqué.
      quandArrive();
    }

    const cameraBouge = camera.mettreAJour(dt, deplacement.position);
    lumieres.regler({ azimut: camera.azimut });
    return deplacement.enRoute || persoBouge || cameraBouge || resultat.tourne || directionClavier !== null;
  }

  // --- La caméra ------------------------------------------------------------------
  // Tant que le joueur n'a pas zoomé lui-même, le zoom s'adapte à l'écran
  // (rotation de la tablette, taille du texte qui change la hauteur des barres).
  let zoomAuto = !partie.vue?.zoom;
  function sauverVue() {
    rappels.surVue?.({ rotation: camera.rotation, zoom: zoomAuto ? null : Math.round(camera.zoom) });
  }
  function ajusterZoomAuto() {
    if (zoomAuto) camera.definirZoom(camera.zoomDeDepart());
  }
  let minuteurVue = null;
  function sauverVuePlusTard() {
    clearTimeout(minuteurVue);
    minuteurVue = setTimeout(sauverVue, 600);
  }

  function tourner(sens) {
    camera.tourner(sens, { instantane: animationsReduites() });
    construit.tournerMurs(camera.rotation);
    moteur.animer(image);
    sauverVue();
  }

  function zoomer(facteur) {
    zoomAuto = false;
    camera.zoomer(facteur);
    moteur.redessiner();
    sauverVuePlusTard();
  }

  function recentrer() {
    camera.recadrer(deplacement.position);
    moteur.redessiner();
  }

  // --- Doigt, souris, clavier ------------------------------------------------------
  const rayonVers = (x, y) => camera.rayon(x, y).ray;

  // Ce qui se trouve sous le doigt : un objet, sinon une case du sol.
  function sousLeDoigt(x, y) {
    const rayon = rayonVers(x, y);
    const point = new Vector3();
    const sol = rayon.intersectPlane(SOL, new Vector3());
    const distanceSol = sol ? rayon.origin.distanceTo(sol) : Infinity;
    let meilleure = null;
    let distanceMeilleure = distanceSol;
    for (const cible of cibles) {
      if (rayon.intersectBox(cible.boite, point)) {
        const distance = rayon.origin.distanceTo(point);
        if (distance < distanceMeilleure) {
          meilleure = cible;
          distanceMeilleure = distance;
        }
      }
    }
    if (meilleure) return { cible: meilleure };
    if (sol) return { case: caseDuPoint(sol.x, sol.z) };
    return null;
  }

  const pointage = brancherPointage(() => moteur.toile, {
    toucher(x, y) {
      if (!actif) return;
      const trouve = sousLeDoigt(x, y);
      if (!trouve) return;
      if (trouve.cible) allerVersCible(trouve.cible);
      else allerVersCase(trouve.case.x, trouve.case.z);
    },
    glisser(dx, dy) {
      if (!actif) return;
      camera.glisser(dx, dy);
      moteur.redessiner();
    },
    zoomer(facteur) {
      if (!actif) return;
      zoomer(facteur);
    },
    survoler(x, y) {
      if (!actif || x === null || x === undefined) {
        if (reperes.survolVisible) {
          reperes.cacherSurvol();
          moteur.redessiner();
        }
        moteur.toile.classList.remove('scene-cliquable');
        return;
      }
      const trouve = sousLeDoigt(x, y);
      const surCase = trouve?.case && grille.libre(trouve.case.x, trouve.case.z);
      if (surCase) reperes.montrerSurvol(trouve.case.x, trouve.case.z);
      else reperes.cacherSurvol();
      moteur.toile.classList.toggle('scene-cliquable', Boolean(trouve?.cible?.examinable || surCase));
      moteur.redessiner();
    },
  });

  const clavier = brancherClavier({
    actif: () => actif && (rappels.actif ? rappels.actif() : true),
    direction(direction) {
      directionClavier = direction;
      if (direction) {
        if (deplacement.enRoute && deplacement.destination
          && (deplacement.destination.x !== deplacement.case.x || deplacement.destination.z !== deplacement.case.z)) {
          // Il marchait vers un endroit touché : il s'arrête au centre de sa case.
          deplacement.revenirAuCentre();
          reperes.cacherDestination();
          cibleVisee = null;
        }
        moteur.animer(image);
      }
    },
    tourner,
    zoomer,
    recentrer,
    agir() {
      rappels.surAgir?.();
    },
  });

  // --- Taille de l'écran, réglages, thème ------------------------------------------
  let zoomInitialFait = false;
  const arreterTaille = moteur.quandTaille((largeur, hauteur) => {
    camera.redimensionner(largeur, hauteur);
    if (!zoomInitialFait && largeur > 1) {
      zoomInitialFait = true;
      camera.definirZoom(partie.vue?.zoom || camera.zoomDeDepart());
      camera.recadrer(deplacement.position);
    } else {
      ajusterZoomAuto();
    }
    moteur.animer(image);
  });

  function appliquerReglages(r = reglages()) {
    lumieres.regler({ luminosite: r.luminosite, azimut: camera.azimut });
    camera.definirSuivi(animationsReduites() || r.modeCalme ? 'paliers' : 'doux');
    construit.montrerContours(r.contraste === 'eleve');
    moteur.changerQualite(r.qualite);
    pointage.actualiser();
    actualiserTheme();
  }

  function actualiserTheme() {
    scene.background = new Color(couleurDuTheme('--fond-scene', '#1f1733'));
    reperes.actualiserCouleurs();
    moteur.redessiner();
  }

  // Démarrage : la vue de la partie, centrée sur le personnage.
  camera.definirRotation(partie.vue?.rotation || 0);
  construit.tournerMurs(camera.rotation);
  camera.recadrer(deplacement.position);
  appliquerReglages();
  moteur.afficher(scene, camera.camera);
  definirObjetProche(chercherObjetProche());

  return {
    lieu,
    grille,
    get piece() { return nomsPieces.get(pieceActuelle) || null; },
    get objetProche() { return objetProche ? infosObjet(objetProche) : null; },
    get case() { return deplacement.case; },
    get profil() { return profil; },

    // La liste de « Aller à… » : pièces, meubles et points à examiner.
    destinations() {
      const liste = lieu.pieces.map((piece) => ({ type: 'piece', id: piece.id, nom: piece.nom, designation: piece.designation, piece: piece.id }));
      for (const cible of cibles) {
        if (!cible.examinable) continue;
        const infos = infosObjet(cible);
        const caseObjet = cible.type === 'point' ? pointParId.get(cible.id) : grille.emprises.get(cible.id);
        liste.push({ ...infos, piece: grille.piece(caseObjet.x, caseObjet.z) });
      }
      return liste;
    },

    allerVers(destination) {
      if (destination.type === 'piece') return allerDansPiece(destination.id);
      const cible = cibleParId.get(destination.id);
      return cible ? allerVersCible(cible) : false;
    },

    allerVersCase,
    tourner,
    zoomer,
    recentrer,

    // Examiner l'objet proche : on se tourne vers lui. Renvoie ses informations.
    examiner() {
      if (!objetProche) return null;
      const ici = deplacement.case;
      arriveSurPlace(objetProche, ici.x, ici.z);
      return infosObjet(objetProche);
    },

    // L'apparence a changé (écran « Ton personnage »).
    changerJoueur(joueur) {
      apparence = apparenceDuJoueur(joueur, donnees.personnages);
      profil = profilDeDeplacement(apparence.aide);
      scene.remove(perso.groupe);
      perso.liberer();
      perso = construirePersonnage(apparence, donnees.personnages, palette);
      scene.add(perso.groupe);
      const ici = deplacement.case;
      if (!grille.caseAccessible(ici.x, ici.z, profil)) {
        const proche = plusProcheAccessible(ici);
        deplacement.teleporter(proche.x, proche.z);
      }
      placerPerso();
      moteur.redessiner();
    },

    // Les barres de l'interface cachent le haut et le bas de l'écran.
    definirMarges(marges) {
      camera.definirMarges(marges);
      ajusterZoomAuto();
      if (!camera.libre) camera.recadrer(deplacement.position);
      moteur.redessiner();
    },

    appliquerReglages,
    actualiserTheme,

    // Met le monde en pause (fenêtre ouverte, autre écran) ou le relance.
    activer(oui) {
      actif = oui;
      if (!oui) {
        directionClavier = null;
        clavier.toutRelacher();
        reperes.cacherSurvol();
      } else {
        moteur.afficher(scene, camera.camera);
        appliquerReglages();
      }
    },

    // Pour les tests : où apparaît le centre d'une case à l'écran ?
    positionEcranDeCase(x, z) {
      return camera.versEcran((x + 0.5) * TAILLE_CASE, 0, (z + 0.5) * TAILLE_CASE);
    },
    positionEcranDuPoint(x, y, z) {
      return camera.versEcran(x, y, z);
    },
    get rotation() { return camera.rotation; },
    get zoom() { return camera.zoom; },

    liberer() {
      clearTimeout(minuteurVue);
      moteur.arreterAnimation(image);
      arreterTaille();
      pointage.debrancher();
      clavier.debrancher();
      perso.liberer();
      construit.liberer();
      reperes.liberer();
    },
  };
}
