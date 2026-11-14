// =============================================================================
// studio.js — l'aperçu du personnage (écran de création)
// -----------------------------------------------------------------------------
// Une petite scène : le personnage sur un socle rond, vu de face, légèrement
// d'en haut. Chaque choix (teint, coiffure…) le redessine aussitôt. Les
// boutons « Tourner » le font pivoter par huitièmes de tour : pas de
// rotation automatique (rien ne bouge sans que le joueur le demande).
//
// L'écran de création couvre une partie de la zone de dessin : definirZone()
// indique où le personnage doit apparaître.
// =============================================================================

import { Color, Mesh, OrthographicCamera, Scene, Vector3 } from '../../lib/three/three.module.js';
import { creerConstructeur, matiereDecor } from '../modeles/formes.js';
import { couleurDuTheme } from '../modeles/palette.js';
import { construirePersonnage } from '../modeles/personnage.js';
import { creerLumieres } from './lumieres.js';

const ELEVATION = 12 * Math.PI / 180;
const HAUTEUR_VUE = 2.4; // mètres visibles en hauteur
const DUREE_ROTATION = 0.3;

export function creerStudio({ moteur, donnees, palette, animationsReduites }) {
  const scene = new Scene();
  scene.background = new Color(couleurDuTheme('--fond-scene', '#1f1733'));
  const lumieres = creerLumieres();
  scene.add(lumieres.groupe);

  const socle = creerConstructeur();
  socle.cylindre({ rayon: 0.62, hauteur: 0.1, cotes: 20 }, [0, -0.05, 0], palette.couleur('violet'));
  socle.cylindre({ rayon: 0.56, hauteur: 0.012, cotes: 20 }, [0, 0.004, 0], palette.couleur('lilas'));
  const meshSocle = new Mesh(socle.construire(), matiereDecor());
  scene.add(meshSocle);

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  const cible = new Vector3(0, 0.88, 0);
  let angle = 25 * Math.PI / 180; // de trois quarts, côté droit
  let animation = null;
  let personnage = null;
  const zone = { gauche: 0, haut: 0, largeur: 1, hauteur: 1 };
  const ecran = { largeur: 1, hauteur: 1 };

  function placer() {
    camera.position.set(
      cible.x + Math.sin(angle) * Math.cos(ELEVATION) * 10,
      cible.y + Math.sin(ELEVATION) * 10,
      cible.z + Math.cos(angle) * Math.cos(ELEVATION) * 10,
    );
    camera.lookAt(cible);
    lumieres.regler({ azimut: angle });
    // Taille : le personnage tient dans la zone libre.
    const pixelsParMetre = Math.max(40, Math.min(zone.hauteur / HAUTEUR_VUE, zone.largeur / 1.5));
    camera.left = -ecran.largeur / pixelsParMetre / 2;
    camera.right = ecran.largeur / pixelsParMetre / 2;
    camera.top = ecran.hauteur / pixelsParMetre / 2;
    camera.bottom = -ecran.hauteur / pixelsParMetre / 2;
    const centreX = zone.gauche + zone.largeur / 2;
    const centreY = zone.haut + zone.hauteur / 2;
    camera.setViewOffset(ecran.largeur, ecran.hauteur, ecran.largeur / 2 - centreX, ecran.hauteur / 2 - centreY, ecran.largeur, ecran.hauteur);
    camera.updateProjectionMatrix();
    moteur.redessiner();
  }

  const arreterTaille = moteur.quandTaille((largeur, hauteur) => {
    ecran.largeur = largeur;
    ecran.hauteur = hauteur;
    placer();
  });

  function animer(dt) {
    if (!animation) return false;
    animation.temps += dt;
    const t = Math.min(1, animation.temps / DUREE_ROTATION);
    angle = animation.depart + (animation.arrivee - animation.depart) * (1 - (1 - t) ** 3);
    placer();
    if (t >= 1) animation = null;
    return animation !== null;
  }

  return {
    // Montre le studio dans la zone de dessin.
    activer() {
      scene.background = new Color(couleurDuTheme('--fond-scene', '#1f1733'));
      moteur.afficher(scene, camera);
      placer();
    },

    montrer(apparence) {
      if (personnage) {
        scene.remove(personnage.groupe);
        personnage.liberer();
      }
      personnage = construirePersonnage(apparence, donnees.personnages, palette);
      scene.add(personnage.groupe);
      moteur.redessiner();
    },

    // Fait pivoter la vue d'un huitième de tour (sens : +1 ou -1).
    tourner(sens) {
      const depart = angle;
      const arrivee = (animation ? animation.arrivee : angle) + sens * Math.PI / 4;
      if (animationsReduites()) {
        angle = arrivee;
        animation = null;
        placer();
        return;
      }
      animation = { depart, arrivee, temps: 0 };
      moteur.animer(animer);
    },

    // La partie de l'écran où le personnage doit apparaître (pixels).
    definirZone(nouvelle) {
      Object.assign(zone, nouvelle);
      placer();
    },

    regler({ luminosite }) {
      lumieres.regler({ luminosite, azimut: angle });
      moteur.redessiner();
    },

    liberer() {
      arreterTaille();
      moteur.arreterAnimation(animer);
      personnage?.liberer();
      meshSocle.geometry.dispose();
    },
  };
}
