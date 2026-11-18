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
// Le lieu montré est celui des données, avec ses pièces ouvertes ou encore
// fermées (js/jeu/lieux.js), les meubles posés par le joueur
// (js/jeu/amenagement.js) et le matériel installé sur le bureau
// (js/jeu/boutique.js) ; actualiserLieu() le reconstruit quand ils changent.
// En mode « Aménager », le doigt et le clavier déplacent le meuble choisi
// (fantome.js) au lieu du personnage.
//
// Le monde ne décide d'aucune règle du jeu : il montre et il déplace.
// =============================================================================

import { Color, Plane, Scene, Vector3 } from '../../lib/three/three.module.js';
import { lieuAmenage, meublesPoses } from '../jeu/amenagement.js';
import { catalogueEquipe, materielInstalle } from '../jeu/boutique.js';
import { lieuSelonOuvertures, ouvertures, ouverturesDuLieu } from '../jeu/lieux.js';
import { apparenceDuJoueur } from '../jeu/personnage.js';
import { POINT_D_ARRIVEE } from '../jeu/routines.js';
import { couleurDuTheme } from '../modeles/palette.js';
import { animerPersonnage, construirePersonnage } from '../modeles/personnage.js';
import { creerCameraIso } from './camera-iso.js';
import {
  caseAtteignableLaPlusProche, casesPourAtteindre, distancesDepuis, lisserChemin, trouverChemin,
} from './chemin.js';
import { brancherClavier } from './controles.js';
import { creerDeplacement, directionsPourAller } from './deplacement.js';
import { creerFantome } from './fantome.js';
import { TAILLE_CASE, angleVers, caseDuPoint, creerGrille, profilDeDeplacement } from './grille.js';
import { creerHabitants, ecartEnCases } from './habitants.js';
import { dessinerAffiche } from './affiches.js';
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
 *   rappels     { surArrivee, surPiece, surObjetProche, surPosition, surVue, surBloque, surVisite, actif() }
 */
export function creerMonde({ moteur, donnees, palette, partie, reglages, rappels }) {
  const lieuDeBase = donnees.lieux[partie.lieux.actuel] || donnees.lieux[donnees.jeu.depart.lieu];
  // Le catalogue d'origine (pour les meubles à poser) et celui du lieu, avec
  // le matériel installé sur le bureau.
  const catalogueDeBase = new Map(donnees.meubles.meubles.map((meuble) => [meuble.id, meuble]));
  const equiper = (p) => (donnees.boutique
    ? catalogueEquipe(donnees.meubles.meubles, materielInstalle(p, donnees.boutique))
    : catalogueDeBase);
  let catalogue = equiper(partie);
  // Ce qui est ouvert (lieux loués, pièces ouvertes), le lieu tel qu'il est
  // avec ces ouvertures, puis avec les meubles posés par le joueur.
  let ouvertes = ouvertures(partie);
  let lieuOuvert = lieuSelonOuvertures(lieuDeBase, ouvertes);
  let lieu = lieuAmenage(lieuOuvert, meublesPoses(partie, lieuDeBase.id));
  let grille = creerGrille(lieu, catalogue);
  const nomsPieces = new Map(lieu.pieces.map((piece) => [piece.id, piece]));

  const scene = new Scene();
  scene.background = new Color(couleurDuTheme('--fond-scene', '#1f1733'));
  const lumieres = creerLumieres();
  scene.add(lumieres.groupe);
  const construire = () => construireLieu({
    lieu, grille, catalogue, palette,
    dessinerAffiche: (affiche) => dessinerAffiche(affiche, { palette, redessiner: () => moteur.redessiner() }),
  });
  let construit = construire();
  scene.add(construit.groupe);
  const fantome = creerFantome({ catalogue: catalogueDeBase, palette });
  scene.add(fantome.groupe);
  const reperes = creerReperes();
  scene.add(reperes.groupe);

  const camera = creerCameraIso({ largeurLieu: construit.largeur, profondeurLieu: construit.profondeur, hauteurLieu: lieu.hauteurMurs });

  // --- Le personnage du joueur ---------------------------------------------------
  let joueurActuel = partie.joueur;
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
  let pnjAttendu = null; // la personne qu'on attend, là où elle va s'arrêter
  let margesActuelles = null; // les marges des barres, déjà données à la caméra
  let objetProche = null; // l'objet qu'on peut examiner, là où l'on est
  let directionClavier = null;
  let actif = true;
  // Pendant l'aménagement : { surToucher, surDirection, surAgir } (sinon null).
  let amenagement = null;

  const animationsReduites = () => document.documentElement.getAttribute('data-animations') === 'reduites';

  // --- Les personnages non joueurs (PNJ) ------------------------------------------
  let minuteActuelle = partie.temps.minute;
  const habitants = creerHabitants({
    scene, lieu, grille, donnees, palette, joueur: () => joueurActuel, ouvertes: () => ouvertes,
  });
  habitants.placer(minuteActuelle, deplacement.case);

  function placerPerso() {
    const { x, z } = deplacement.position;
    perso.groupe.position.set(x, 0, z);
    perso.groupe.rotation.y = deplacement.angle * Math.PI / 180;
  }
  placerPerso();

  // --- Ce qu'on peut examiner ----------------------------------------------------
  let cibles = construit.cibles;
  let cibleParId = new Map(cibles.map((cible) => [cible.id, cible]));
  let pointParId = new Map((lieu.points || []).map((point) => [point.id, point]));
  // Les meubles et points, plus les PNJ présents (qui bougent).
  const toutesLesCibles = () => [...cibles, ...habitants.cibles()];

  // Les informations d'un objet (meuble, point ou PNJ) pour l'interface.
  function infosObjet(cible) {
    if (cible.type === 'pnj') {
      const habitant = habitants.trouver(cible.id);
      const activite = habitant.creneau?.activite ? habitant.pnj.activites[habitant.creneau.activite] : null;
      return {
        id: habitant.id,
        type: 'pnj',
        nom: habitant.nom,
        designation: habitant.nom,
        description: habitant.pnj.presentation,
        activite: activite?.description || null,
        actions: [],
      };
    }
    if (cible.type === 'point') {
      const point = pointParId.get(cible.id);
      // La porte d'entrée : on sort par là pour aller dans un autre lieu.
      return {
        id: point.id, type: 'point', nom: point.nom, designation: point.designation, description: point.description,
        lien: point.lien || null, actions: point.id === POINT_D_ARRIVEE ? ['sortir'] : [],
      };
    }
    const emprise = grille.emprises.get(cible.id);
    const meuble = emprise.meuble;
    return {
      id: cible.id,
      type: 'meuble',
      nom: meuble.nom,
      designation: meuble.designation || meuble.nom,
      description: emprise.place.description || meuble.description || null,
      actions: [...(meuble.actions || [])],
    };
  }

  // Les cases d'où l'on peut examiner un objet (ou parler à quelqu'un).
  // versOuIlVa : pour quelqu'un qui marche, autour de là où il s'arrêtera
  // (pour le rejoindre) plutôt qu'autour de là où il est.
  function casesPourCible(cible, distances, { versOuIlVa = false } = {}) {
    const ici = deplacement.case;
    if (cible.type === 'pnj') {
      const caseHabitant = versOuIlVa ? habitants.destinationDe(cible.id) : habitants.caseDe(cible.id);
      if (!caseHabitant) return [];
      const cases = [];
      for (const [dx, dz] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const cle = `${caseHabitant.x + dx},${caseHabitant.z + dz}`;
        if (distances.has(cle)) cases.push({ x: caseHabitant.x + dx, z: caseHabitant.z + dz, trajet: distances.get(cle) });
      }
      return cases.sort((a, b) => a.trajet - b.trajet);
    }
    if (cible.type === 'point') {
      const point = pointParId.get(cible.id);
      return distances.has(`${point.x},${point.z}`) ? [{ x: point.x, z: point.z }] : [];
    }
    return casesPourAtteindre(grille, grille.emprises.get(cible.id), ici, profil, distances);
  }

  // L'angle pour regarder un objet depuis la case (x, z).
  function angleVersCible(cible, x, z) {
    if (cible.type === 'point') return pointParId.get(cible.id).angle;
    if (cible.type === 'pnj') {
      const position = habitants.position(cible.id);
      return position ? angleVers(position.x - (x + 0.5) * TAILLE_CASE, position.z - (z + 0.5) * TAILLE_CASE) : null;
    }
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
    for (const cible of toutesLesCibles()) {
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
    if (amenagement && cible) return; // pendant l'aménagement, rien à examiner
    if (cible === objetProche || (cible && objetProche && cible.type === 'pnj' && cible.id === objetProche.id)) return;
    objetProche = cible;
    if (cible) reperes.montrerCible(cible.boite);
    else reperes.cacherCible();
    rappels.surObjetProche?.(cible ? infosObjet(cible) : null);
    moteur.redessiner();
  }

  // --- Déplacements -------------------------------------------------------------
  function partir(chemin, destination) {
    if (!chemin || chemin.length === 0) return false;
    pnjAttendu = null;
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
    const cases = casesPourCible(cible, distances, { versOuIlVa: true });
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
        pnjAttendu = null;
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

  // Une personne qui marche : on va là où elle s'arrêtera. Si elle n'y est
  // pas encore, on l'attend (elle sera « proche » en arrivant) ; si elle a
  // changé de chemin, on la rejoint (quelques fois au plus, jamais sans fin).
  let poursuites = 0;
  const POURSUITES_MAX = 4;
  const aCote = (caseA, ici) => Boolean(caseA) && Math.max(Math.abs(caseA.x - ici.x), Math.abs(caseA.z - ici.z)) <= 1;

  // La personne attendue s'est-elle arrêtée à côté de nous ? Elle devient
  // alors « proche » (« Parler à Théo »), et on se tourne vers elle.
  function verifierPnjAttendu() {
    const ici = deplacement.case;
    const caseHabitant = habitants.caseDe(pnjAttendu.id);
    const ouIlVa = habitants.destinationDe(pnjAttendu.id);
    if (caseHabitant && ouIlVa && (ouIlVa.x !== caseHabitant.x || ouIlVa.z !== caseHabitant.z)) return; // elle marche encore
    const cible = pnjAttendu;
    pnjAttendu = null;
    if (!aCote(caseHabitant, ici)) return; // partie, ou arrêtée ailleurs
    arriveSurPlace(cible, ici.x, ici.z);
    definirObjetProche(cible);
    rappels.surArrivee?.(infosObjet(cible));
  }

  function quandArrive() {
    reperes.cacherDestination();
    const ici = deplacement.case;
    if (cibleVisee?.type === 'pnj' && !aCote(habitants.caseDe(cibleVisee.id), ici)) {
      const cible = cibleVisee;
      cibleVisee = null;
      if (aCote(habitants.destinationDe(cible.id), ici)) {
        // Elle arrive : on se tourne vers elle et on l'attend.
        arriveSurPlace(cible, ici.x, ici.z);
        pnjAttendu = cible;
        poursuites = 0;
        rappels.surPosition?.({ x: ici.x, z: ici.z, angle: Math.round(deplacement.angle) });
        return;
      }
      if (habitants.caseDe(cible.id) && poursuites < POURSUITES_MAX) {
        poursuites += 1;
        if (allerVersCible(cible)) return;
      }
    }
    poursuites = 0;
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

  // Pendant que les PNJ bougent, l'objet proche (quelqu'un à qui parler) est
  // revu de temps en temps.
  let attenteRevue = 0;
  function revoirObjetProche(dt) {
    attenteRevue -= dt;
    if (attenteRevue > 0 || deplacement.enRoute) return;
    attenteRevue = 0.3;
    if (objetProche?.type === 'pnj') {
      const position = habitants.position(objetProche.id);
      if (position && ecartEnCases(deplacement.case, position) < 1.6) return;
    }
    definirObjetProche(chercherObjetProche());
  }

  // --- L'image suivante -----------------------------------------------------------
  function image(dt) {
    const reduit = animationsReduites();
    const habitantsBougent = habitants.avancer(dt, reduit);
    if (pnjAttendu) verifierPnjAttendu();
    if (habitantsBougent || objetProche?.type === 'pnj') revoirObjetProche(dt);
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

    // Pendant l'aménagement, la caméra suit le meuble qu'on pose.
    const visee = amenagement && fantome.visible ? fantome.centre : deplacement.position;
    const cameraBouge = camera.mettreAJour(dt, visee);
    lumieres.regler({ azimut: camera.azimut });
    return deplacement.enRoute || persoBouge || cameraBouge || resultat.tourne || directionClavier !== null || habitantsBougent
      || pnjAttendu !== null;
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

  // Ce qui se trouve sous le doigt : un objet, sinon une case du sol.
  // Un meuble est touché seulement si le doigt est sur sa vraie forme : on
  // peut toucher le sol juste devant un canapé sans viser le canapé.
  function sousLeDoigt(x, y) {
    const lanceur = camera.rayon(x, y);
    const rayon = lanceur.ray;
    const point = new Vector3();
    const sol = rayon.intersectPlane(SOL, new Vector3());
    const distanceSol = sol ? rayon.origin.distanceTo(sol) : Infinity;
    let meilleure = null;
    let distanceMeilleure = distanceSol;
    for (const cible of toutesLesCibles()) {
      // D'abord la boîte (rapide), puis la forme exacte si besoin.
      if (!rayon.intersectBox(cible.boite, point)) continue;
      let distance = rayon.origin.distanceTo(point);
      if (cible.forme) {
        const touche = lanceur.intersectObject(cible.forme, false)[0];
        if (!touche) continue;
        distance = touche.distance;
      }
      if (distance < distanceMeilleure) {
        meilleure = cible;
        distanceMeilleure = distance;
      }
    }
    if (meilleure) return { cible: meilleure };
    if (sol) return { case: caseDuPoint(sol.x, sol.z) };
    return null;
  }

  // En aménagement : la case du sol sous le doigt, le meuble touché et les
  // meubles achetés posés sur cette case (un tapis, qu'on touche par le sol).
  function toucherPourAmenager(x, y) {
    const trouve = sousLeDoigt(x, y);
    const rayon = camera.rayon(x, y).ray;
    const sol = rayon.intersectPlane(SOL, new Vector3());
    const caseSol = sol ? caseDuPoint(sol.x, sol.z) : null;
    const achats = [];
    if (caseSol) {
      for (const emprise of grille.emprises.values()) {
        if (caseSol.x >= emprise.x && caseSol.x < emprise.x + emprise.largeur
          && caseSol.z >= emprise.z && caseSol.z < emprise.z + emprise.profondeur) achats.push(emprise.id);
      }
    }
    const meuble = trouve?.cible?.type === 'meuble' ? trouve.cible.id : null;
    const caseVisee = trouve?.case || caseSol;
    amenagement.surToucher({ id: meuble, case: caseVisee, sousLaCase: achats });
  }

  const pointage = brancherPointage(() => moteur.toile, {
    toucher(x, y) {
      if (!actif) return;
      if (amenagement) {
        toucherPourAmenager(x, y);
        return;
      }
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
      if (amenagement) {
        // Une case par appui, dans le sens de l'écran.
        if (direction) {
          const sol = camera.directionAuSol(direction.droite, direction.haut);
          const [pas] = directionsPourAller(sol.x, sol.z);
          if (pas) amenagement.surDirection({ dx: pas[0], dz: pas[1] });
        }
        return;
      }
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
      if (amenagement) amenagement.surAgir();
      else rappels.surAgir?.();
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
    fantome.actualiserCouleurs();
    moteur.redessiner();
  }

  // Les meubles posés ou le matériel ont changé : le lieu est reconstruit
  // (la caméra, le personnage et les habitants restent où ils sont).
  function actualiserLieu() {
    catalogue = equiper(partie);
    ouvertes = ouvertures(partie);
    lieuOuvert = lieuSelonOuvertures(lieuDeBase, ouvertes);
    lieu = lieuAmenage(lieuOuvert, meublesPoses(partie, lieuDeBase.id));
    grille = creerGrille(lieu, catalogue);
    pointParId = new Map((lieu.points || []).map((point) => [point.id, point]));
    scene.remove(construit.groupe);
    construit.liberer();
    construit = construire();
    scene.add(construit.groupe);
    construit.tournerMurs(camera.rotation);
    construit.montrerContours(reglages().contraste === 'eleve');
    cibles = construit.cibles;
    cibleParId = new Map(cibles.map((cible) => [cible.id, cible]));
    habitants.changerGrille(grille);
    habitants.changerLieu(lieu);
    cibleVisee = null;
    // Le personnage ne peut pas se retrouver dans un meuble (l'aménagement
    // l'empêche) ; par sécurité, il va à la case libre la plus proche.
    const ici = deplacement.case;
    if (!grille.caseAccessible(ici.x, ici.z, profil)) {
      const proche = plusProcheAccessible(ici);
      deplacement.teleporter(proche.x, proche.z);
      placerPerso();
    }
    objetProche = null;
    reperes.cacherCible();
    if (!amenagement) {
      const proche = chercherObjetProche();
      if (proche) definirObjetProche(proche);
      else rappels.surObjetProche?.(null);
    }
    moteur.animer(image);
  }

  // Démarrage : la vue de la partie, centrée sur le personnage.
  camera.definirRotation(partie.vue?.rotation || 0);
  construit.tournerMurs(camera.rotation);
  camera.recadrer(deplacement.position);
  appliquerReglages();
  moteur.afficher(scene, camera.camera);
  definirObjetProche(chercherObjetProche());

  return {
    get lieu() { return lieu; },
    get grille() { return grille; },
    get piece() { return nomsPieces.get(pieceActuelle) || null; },
    get objetProche() { return objetProche ? infosObjet(objetProche) : null; },
    get case() { return deplacement.case; },
    get enRoute() { return deplacement.enRoute; },
    get profil() { return profil; },

    // La liste de « Aller à… » : pièces, personnes présentes, meubles et
    // points à examiner.
    destinations() {
      const liste = lieu.pieces.filter((piece) => !piece.verrouillee)
        .map((piece) => ({ type: 'piece', id: piece.id, nom: piece.nom, designation: piece.designation, piece: piece.id }));
      for (const cible of habitants.cibles()) {
        const caseHabitant = habitants.caseDe(cible.id);
        liste.push({ ...infosObjet(cible), piece: grille.piece(caseHabitant.x, caseHabitant.z) });
      }
      for (const cible of cibles) {
        if (!cible.examinable) continue;
        const infos = infosObjet(cible);
        const caseObjet = cible.type === 'point' ? pointParId.get(cible.id) : grille.emprises.get(cible.id);
        liste.push({ ...infos, piece: grille.piece(caseObjet.x, caseObjet.z) });
      }
      return liste;
    },

    allerVers(destination) {
      poursuites = 0;
      if (destination.type === 'piece') return allerDansPiece(destination.id);
      const cible = destination.type === 'pnj'
        ? habitants.cibles().find((c) => c.id === destination.id)
        : cibleParId.get(destination.id);
      return cible ? allerVersCible(cible) : false;
    },

    // L'heure a changé : les PNJ suivent leur routine.
    definirHeure(minute) {
      minuteActuelle = minute;
      for (const evenement of habitants.suivre(minute, deplacement.case)) rappels.surVisite?.(evenement);
      moteur.animer(image);
    },

    // Un nouveau jour : chacun est posé directement à sa place du matin.
    nouvelleJournee(minute) {
      minuteActuelle = minute;
      habitants.placer(minute, deplacement.case);
      definirObjetProche(chercherObjetProche());
      moteur.animer(image);
    },

    // On parle à un PNJ : il s'arrête et se tourne vers nous (et nous vers lui).
    parler(id) {
      const cible = habitants.cibles().find((c) => c.id === id);
      if (!cible) return null;
      const { x, z } = deplacement.position;
      habitants.arreter(id, x, z, animationsReduites());
      const ici = deplacement.case;
      arriveSurPlace(cible, ici.x, ici.z);
      const habitant = habitants.trouver(id);
      return { ...infosObjet(cible), pnj: habitant.pnj, creneau: habitant.creneau };
    },

    finParler(id) {
      habitants.reprendre(id, minuteActuelle, deplacement.case);
      moteur.animer(image);
    },

    // Les PNJ présents (pour les tests et l'interface).
    get habitantsPresents() {
      return habitants.cibles().map((cible) => {
        const caseHabitant = habitants.caseDe(cible.id);
        return { id: cible.id, case: caseHabitant, piece: grille.piece(caseHabitant.x, caseHabitant.z) };
      });
    },

    allerVersCase,
    tourner,
    zoomer,
    recentrer,
    actualiserLieu,

    // --- Le mode « Aménager » -----------------------------------------------------
    // Le personnage s'arrête ; le doigt et le clavier s'adressent à
    // « rappelsAmenagement » : surToucher({ id, case, sousLaCase }),
    // surDirection({ dx, dz }), surAgir().
    commencerAmenagement(rappelsAmenagement) {
      amenagement = rappelsAmenagement;
      if (deplacement.enRoute) deplacement.revenirAuCentre();
      cibleVisee = null;
      pnjAttendu = null;
      directionClavier = null;
      clavier.toutRelacher();
      reperes.cacherDestination();
      definirObjetProche(null);
      moteur.animer(image);
    },
    finirAmenagement() {
      amenagement = null;
      fantome.cacher();
      camera.reprendreSuivi();
      definirObjetProche(chercherObjetProche());
      moteur.animer(image);
    },
    get enAmenagement() { return amenagement !== null; },
    // Un pas d'une case dans une direction de l'écran (droite, haut) :
    // { dx, dz } sur la grille (pour les flèches du panneau).
    pasVersEcran(droite, haut) {
      const sol = camera.directionAuSol(droite, haut);
      const [pas] = directionsPourAller(sol.x, sol.z);
      return pas ? { dx: pas[0], dz: pas[1] } : null;
    },
    // Le meuble qu'on pose : { meuble, x, z, rotation, valide }.
    montrerFantome(etat) {
      fantome.montrer(etat);
      camera.reprendreSuivi();
      moteur.animer(image);
    },
    cacherFantome() {
      fantome.cacher();
      moteur.animer(image);
    },
    get fantome() { return fantome.etat; },
    // Les personnes présentes (on ne pose rien sur elles) : le personnage,
    // et chaque habitant, là où il est et là où il va.
    casesOccupees() {
      const ici = deplacement.case;
      const cases = [{ x: ici.x, z: ici.z, joueur: true }];
      for (const habitant of habitants.liste) {
        if (!habitant.present) continue;
        for (const caseHabitant of [habitants.caseDe(habitant.id), habitants.destinationDe(habitant.id)]) {
          if (caseHabitant) cases.push({ x: caseHabitant.x, z: caseHabitant.z, nom: habitant.nom });
        }
      }
      return cases;
    },
    // Le lieu avec ses pièces ouvertes, sans les meubles posés par le joueur.
    get lieuOuvert() { return lieuOuvert; },
    // Le même, toutes ses pièces ouvertes : un meuble posé aujourd'hui ne
    // doit pas bloquer une pièce qui s'ouvrira demain.
    get lieuComplet() { return lieuSelonOuvertures(lieuDeBase, new Set(ouverturesDuLieu(lieuDeBase))); },
    get ouvertes() { return ouvertes; },
    get catalogueDeBase() { return catalogueDeBase; },

    // Examiner l'objet proche : on se tourne vers lui. Renvoie ses informations.
    examiner() {
      if (!objetProche) return null;
      const ici = deplacement.case;
      arriveSurPlace(objetProche, ici.x, ici.z);
      return infosObjet(objetProche);
    },

    // L'apparence a changé (écran « Ton personnage »).
    changerJoueur(joueur) {
      joueurActuel = joueur;
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
      // Jouer Ferrus ou non change qui est là (le mentor ne vient pas en personne).
      habitants.placer(minuteActuelle, deplacement.case);
      definirObjetProche(chercherObjetProche());
      moteur.redessiner();
    },

    // Les barres de l'interface cachent le haut et le bas de l'écran.
    // Rien ne change si les marges sont les mêmes ; sinon, la première fois
    // la vue se cale tout de suite, ensuite la caméra rejoint sa place en
    // douceur (un recentrage d'un coup ferait « sauter » la vue pendant
    // qu'on marche).
    definirMarges(marges) {
      const cle = `${marges.haut}/${marges.bas}/${marges.gauche}/${marges.droite}`;
      if (cle === margesActuelles) return;
      const premiereFois = margesActuelles === null;
      margesActuelles = cle;
      camera.definirMarges(marges);
      ajusterZoomAuto();
      if (premiereFois && !camera.libre) camera.recadrer(deplacement.position);
      moteur.animer(image);
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
    // Pour les tests : ce que la carte graphique a dessiné à la dernière image.
    get infosRendu() { return { ...moteur.infos.render }; },
    // Les affiches visibles (selon la rotation de la vue).
    get affichesVisibles() { return construit.affichesVisibles(); },

    liberer() {
      clearTimeout(minuteurVue);
      moteur.arreterAnimation(image);
      arreterTaille();
      pointage.debrancher();
      clavier.debrancher();
      perso.liberer();
      habitants.liberer();
      construit.liberer();
      fantome.liberer();
      reperes.liberer();
    },
  };
}
