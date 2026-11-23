// =============================================================================
// camera-iso.js — la caméra « isométrique » (vue de trois quarts)
// -----------------------------------------------------------------------------
// Caméra orthographique : les objets lointains ne rapetissent pas, comme dans
// un plan d'architecte en relief. Elle regarde le lieu d'en haut, de biais
// (angle isométrique de 35°), depuis l'un des quatre coins : on la fait
// tourner par quarts de tour.
//
// Le zoom est exprimé en « pixels par mètre », limité entre deux bornes. La
// caméra suit le personnage :
//   - « doux »    : elle glisse doucement derrière lui ;
//   - « paliers » : elle ne bouge pas tant que le personnage reste bien
//                   visible, puis se recentre d'un coup (animations réduites
//                   ou mode calme : aucun mouvement de caméra continu).
// Quand tout le lieu tient à l'écran, la caméra ne suit pas : elle reste
// centrée sur le lieu (rien ne bouge inutilement).
// Si le joueur fait glisser la vue, le suivi s'arrête jusqu'au prochain
// déplacement ou jusqu'à « Recentrer ».
//
// Les barres de l'interface (en haut, en bas) cachent une partie de l'écran :
// « marges » décale le centre de la vue dans la zone vraiment visible.
// =============================================================================

import { OrthographicCamera, Raycaster, Vector2, Vector3 } from '../../lib/three/three.module.js';

const ELEVATION = Math.atan(1 / Math.SQRT2); // 35,26° : la vraie vue isométrique
const DISTANCE = 40;
export const ZOOM_MINIMUM = 26;
export const ZOOM_MAXIMUM = 190;
const DUREE_ROTATION = 0.35; // secondes

const azimut = (rotation) => (45 + 90 * rotation) * Math.PI / 180;
const adoucir = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

export function creerCameraIso({ largeurLieu, profondeurLieu, hauteurLieu = 2.5 }) {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const cible = new Vector3(largeurLieu / 2, 0.8, profondeurLieu / 2);
  const ecran = { largeur: 1, hauteur: 1 };
  const marges = { haut: 0, bas: 0, gauche: 0, droite: 0 };
  let rotation = 0; // de 0 à 3
  let angle = azimut(0); // azimut actuel (animé)
  let animationRotation = null;
  let pixelsParMetre = 78;
  let suivi = 'doux';
  let libre = false; // la vue a été déplacée à la main

  function placer() {
    const horizontal = Math.cos(ELEVATION) * DISTANCE;
    camera.position.set(
      cible.x + Math.sin(angle) * horizontal,
      cible.y + Math.sin(ELEVATION) * DISTANCE,
      cible.z + Math.cos(angle) * horizontal,
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(cible);
    const demiLargeur = ecran.largeur / pixelsParMetre / 2;
    const demiHauteur = ecran.hauteur / pixelsParMetre / 2;
    camera.left = -demiLargeur;
    camera.right = demiLargeur;
    camera.top = demiHauteur;
    camera.bottom = -demiHauteur;
    // Le centre de la vue va au milieu de la zone non cachée par les barres.
    camera.setViewOffset(
      ecran.largeur, ecran.hauteur,
      (marges.droite - marges.gauche) / 2, (marges.bas - marges.haut) / 2,
      ecran.largeur, ecran.hauteur,
    );
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  // Les deux directions au sol qui correspondent à « droite » et « haut » à l'écran.
  function axesAuSol() {
    return {
      droite: new Vector3(Math.cos(angle), 0, -Math.sin(angle)),
      avant: new Vector3(-Math.sin(angle), 0, -Math.cos(angle)),
    };
  }

  // La cible reste au-dessus du lieu (on ne se perd pas dans le vide).
  function garderDansLeLieu() {
    cible.x = Math.min(Math.max(cible.x, -1), largeurLieu + 1);
    cible.z = Math.min(Math.max(cible.z, -1), profondeurLieu + 1);
  }

  // Où apparaît un point du monde à l'écran (en pixels) ?
  const projete = new Vector3();
  function versEcran(x, y, z) {
    projete.set(x, y, z).project(camera);
    return { x: (projete.x + 1) / 2 * ecran.largeur, y: (1 - projete.y) / 2 * ecran.hauteur };
  }

  // Le zoom qui montre tout le lieu dans la zone visible.
  function zoomPourToutVoir() {
    const { droite, avant } = axesAuSol();
    const coins = [];
    for (const x of [0, largeurLieu]) for (const z of [0, profondeurLieu]) for (const y of [0, hauteurLieu]) coins.push([x, y, z]);
    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
    for (const [x, y, z] of coins) {
      const ex = x * droite.x + z * droite.z;
      // Hauteur à l'écran : profondeur au sol (raccourcie) + hauteur (presque entière).
      const ey = -(x * avant.x + z * avant.z) * Math.sin(ELEVATION) + y * Math.cos(ELEVATION);
      minX = Math.min(minX, ex); maxX = Math.max(maxX, ex);
      minY = Math.min(minY, ey); maxY = Math.max(maxY, ey);
    }
    const largeurUtile = Math.max(100, ecran.largeur - marges.gauche - marges.droite);
    const hauteurUtile = Math.max(100, ecran.hauteur - marges.haut - marges.bas);
    return 0.92 * Math.min(largeurUtile / (maxX - minX), hauteurUtile / (maxY - minY));
  }

  // Le point que la caméra doit viser : le centre du lieu s'il tient
  // entièrement à l'écran, sinon le personnage.
  function pointDeSuivi(personnage) {
    if (zoomPourToutVoir() >= pixelsParMetre) return { x: largeurLieu / 2, z: profondeurLieu / 2 };
    return personnage;
  }

  placer();

  return {
    camera,
    cible,
    get rotation() { return ((rotation % 4) + 4) % 4; },
    get zoom() { return pixelsParMetre; },
    get libre() { return libre; },
    get enRotation() { return animationRotation !== null; },

    redimensionner(largeur, hauteur) {
      ecran.largeur = Math.max(1, largeur);
      ecran.hauteur = Math.max(1, hauteur);
      placer();
    },

    definirMarges(nouvelles) {
      Object.assign(marges, nouvelles);
      placer();
    },

    definirSuivi(mode) {
      suivi = mode;
    },

    // Le zoom de départ : tout le lieu s'il tient à une taille confortable,
    // sinon assez grand (~78 px/m) pour bien voir les pièces et viser au doigt.
    zoomDeDepart() {
      return Math.min(ZOOM_MAXIMUM, Math.max(78, Math.min(zoomPourToutVoir(), 110)));
    },

    definirZoom(valeur) {
      pixelsParMetre = Math.min(ZOOM_MAXIMUM, Math.max(ZOOM_MINIMUM, valeur));
      placer();
      return pixelsParMetre;
    },

    zoomer(facteur) {
      return this.definirZoom(pixelsParMetre * facteur);
    },

    // Rotation immédiate (au chargement d'une partie).
    definirRotation(nouvelle) {
      rotation = ((nouvelle % 4) + 4) % 4;
      angle = azimut(rotation);
      animationRotation = null;
      placer();
    },

    // Un quart de tour (sens : +1 ou -1), animé sauf si « instantane ».
    // En cas d'appuis rapides, l'arrivée s'ajoute à la cible précédente pour
    // ne jamais repartir de 270° dans l'autre sens.
    tourner(sens, { instantane = false } = {}) {
      const depart = angle;
      const baseArrivee = animationRotation ? animationRotation.arrivee : angle;
      rotation = ((rotation + sens) % 4 + 4) % 4;
      if (instantane) {
        angle = azimut(rotation);
        animationRotation = null;
        placer();
        return;
      }
      animationRotation = { depart, arrivee: baseArrivee + sens * Math.PI / 2, temps: 0 };
    },

    // Fait glisser la vue (doigt ou souris), en pixels.
    glisser(dx, dy) {
      const { droite, avant } = axesAuSol();
      cible.addScaledVector(droite, -dx / pixelsParMetre);
      cible.addScaledVector(avant, dy / (pixelsParMetre * Math.sin(ELEVATION)));
      garderDansLeLieu();
      libre = true;
      placer();
    },

    // Recentre la vue sur un point (immédiatement).
    centrerSur(x, z) {
      cible.x = x;
      cible.z = z;
      libre = false;
      placer();
    },

    // Remet la vue « normale » (lieu entier ou personnage), immédiatement.
    recadrer(personnage) {
      const point = pointDeSuivi(personnage);
      this.centrerSur(point.x, point.z);
    },

    reprendreSuivi() {
      libre = false;
    },

    /**
     * Avance l'animation (rotation, suivi du personnage). Renvoie true tant
     * que la caméra bouge encore (il faut redessiner).
     */
    mettreAJour(dt, personnage) {
      let bouge = false;
      if (animationRotation) {
        animationRotation.temps += dt;
        const t = Math.min(1, animationRotation.temps / DUREE_ROTATION);
        angle = animationRotation.depart + (animationRotation.arrivee - animationRotation.depart) * adoucir(t);
        if (t >= 1) {
          angle = azimut(rotation);
          animationRotation = null;
        }
        bouge = true;
      }
      const visee = personnage && !libre ? pointDeSuivi(personnage) : null;
      if (visee) {
        if (suivi === 'doux') {
          const facteur = 1 - Math.exp(-dt * 5);
          const dx = visee.x - cible.x;
          const dz = visee.z - cible.z;
          if (Math.abs(dx) > 0.002 || Math.abs(dz) > 0.002) {
            cible.x += dx * facteur;
            cible.z += dz * facteur;
            bouge = true;
          }
        } else {
          // Par paliers : on recentre d'un coup si le personnage approche du
          // bord de la zone visible (ou si le lieu entier tient à l'écran).
          const point = versEcran(personnage.x, 0.9, personnage.z);
          const toutTient = visee !== personnage;
          const gauche = marges.gauche + (ecran.largeur - marges.gauche - marges.droite) * 0.2;
          const droite = ecran.largeur - marges.droite - (ecran.largeur - marges.gauche - marges.droite) * 0.2;
          const haut = marges.haut + (ecran.hauteur - marges.haut - marges.bas) * 0.2;
          const bas = ecran.hauteur - marges.bas - (ecran.hauteur - marges.haut - marges.bas) * 0.2;
          const decale = Math.abs(cible.x - visee.x) > 0.002 || Math.abs(cible.z - visee.z) > 0.002;
          if ((toutTient && decale) || (!toutTient && (point.x < gauche || point.x > droite || point.y < haut || point.y > bas))) {
            cible.x = visee.x;
            cible.z = visee.z;
            bouge = true;
          }
        }
      }
      if (bouge) placer();
      return animationRotation !== null || (suivi === 'doux' && visee !== null
        && (Math.abs(visee.x - cible.x) > 0.002 || Math.abs(visee.z - cible.z) > 0.002));
    },

    // Le rayon qui part du doigt (coordonnées dans le canvas, en pixels).
    rayon(x, y) {
      const rayon = new Raycaster();
      rayon.setFromCamera(new Vector2(x / ecran.largeur * 2 - 1, -(y / ecran.hauteur) * 2 + 1), camera);
      return rayon;
    },

    versEcran,

    // La direction au sol (x, z) qui correspond à une direction de l'écran
    // (droite = +x, haut = +y), pour le clavier.
    directionAuSol(versDroite, versHaut) {
      const { droite, avant } = axesAuSol();
      return { x: droite.x * versDroite + avant.x * versHaut, z: droite.z * versDroite + avant.z * versHaut };
    },

    // Azimut actuel (pour orienter la lumière avec la caméra).
    get azimut() { return angle; },
  };
}
