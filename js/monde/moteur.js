// =============================================================================
// moteur.js — le dessin de la 3D (Three.js) dans la page
// -----------------------------------------------------------------------------
// Le moteur ne dessine que quand c'est utile : si rien ne bouge, il ne fait
// rien (la tablette ne chauffe pas et la batterie dure). Les modules qui
// animent quelque chose (personnage qui marche, caméra qui tourne) se
// déclarent avec animer() ; les autres demandent un dessin avec redessiner().
//
// Qualité graphique (réglage) :
//   économie : 1 pixel du jeu par pixel CSS, sans lissage des bords ;
//   standard : jusqu'à 1,5 pixel par pixel CSS, bords lissés ;
//   haute    : jusqu'à 2 pixels par pixel CSS, bords lissés.
// Changer le lissage oblige à recréer la zone de dessin : c'est fait sans
// toucher au reste du jeu.
//
// Si la carte graphique « perd » la 3D (tablette en manque de mémoire,
// appli mise en veille), le navigateur la rend souvent quelques instants
// plus tard : on redessine alors simplement.
// =============================================================================

import { SRGBColorSpace, WebGLRenderer } from '../../lib/three/three.module.js';

const QUALITES = {
  economie: { pixelsMax: 1, lissage: false },
  standard: { pixelsMax: 1.5, lissage: true },
  haute: { pixelsMax: 2, lissage: true },
};

export class ErreurWebGL extends Error {
  constructor(cause) {
    super(`3D indisponible : ${cause?.message || cause}`);
    this.name = 'ErreurWebGL';
  }
}

/**
 * Crée le moteur dans « conteneur » (la balise #scene de index.html).
 * Lève ErreurWebGL si la 3D n'est pas disponible sur l'appareil.
 */
export function creerMoteur(conteneur, { qualite = 'standard', surPerte, surRetour } = {}) {
  let rendu = null;
  let reglage = QUALITES[qualite] ? qualite : 'standard';
  let scene = null;
  let camera = null;
  let besoinDeDessin = false;
  let enBoucle = false;
  let dernierTemps = 0;
  const animations = new Set();
  const surTaille = new Set();
  let largeur = 1;
  let hauteur = 1;

  function perdu(evenement) {
    evenement.preventDefault();
    surPerte?.();
  }
  function retrouve() {
    surRetour?.();
    redessiner();
  }

  function creerRendu() {
    const ancien = rendu;
    let nouveau;
    try {
      nouveau = new WebGLRenderer({
        antialias: QUALITES[reglage].lissage,
        powerPreference: 'default',
        preserveDrawingBuffer: false,
      });
    } catch (erreur) {
      if (!ancien) throw new ErreurWebGL(erreur);
      return; // on garde l'ancien rendu plutôt que de tout perdre
    }
    nouveau.outputColorSpace = SRGBColorSpace;
    const toile = nouveau.domElement;
    toile.classList.add('scene-toile');
    toile.setAttribute('aria-hidden', 'true');
    toile.addEventListener('webglcontextlost', perdu);
    toile.addEventListener('webglcontextrestored', retrouve);
    if (ancien) {
      ancien.domElement.removeEventListener('webglcontextlost', perdu);
      ancien.domElement.removeEventListener('webglcontextrestored', retrouve);
      ancien.domElement.replaceWith(toile);
      ancien.dispose();
      ancien.forceContextLoss();
    } else {
      conteneur.append(toile);
    }
    rendu = nouveau;
    ajusterTaille();
  }

  function ajusterTaille() {
    const rect = conteneur.getBoundingClientRect();
    largeur = Math.max(1, Math.round(rect.width));
    hauteur = Math.max(1, Math.round(rect.height));
    rendu.setPixelRatio(Math.min(self.devicePixelRatio || 1, QUALITES[reglage].pixelsMax));
    rendu.setSize(largeur, hauteur, false);
    for (const fonction of surTaille) fonction(largeur, hauteur);
    redessiner();
  }

  function boucle(temps) {
    const dt = dernierTemps ? Math.min(0.05, Math.max(0, (temps - dernierTemps) / 1000)) : 1 / 60;
    dernierTemps = temps;
    for (const animation of [...animations]) {
      let continuer = false;
      try {
        continuer = animation(dt);
      } catch (erreur) {
        console.error(erreur);
      }
      if (!continuer) animations.delete(animation);
    }
    if (scene && camera && rendu) rendu.render(scene, camera);
    besoinDeDessin = false;
    if (animations.size > 0 || besoinDeDessin) {
      self.requestAnimationFrame(boucle);
    } else {
      enBoucle = false;
      dernierTemps = 0;
    }
  }

  function demarrer() {
    if (enBoucle) return;
    enBoucle = true;
    self.requestAnimationFrame(boucle);
  }

  // Demande un dessin à la prochaine image.
  function redessiner() {
    besoinDeDessin = true;
    demarrer();
  }

  creerRendu();
  const observateur = new ResizeObserver(() => ajusterTaille());
  observateur.observe(conteneur);

  return {
    get toile() { return rendu.domElement; },
    get largeur() { return largeur; },
    get hauteur() { return hauteur; },
    get rendu() { return rendu; },

    // Ce qui est dessiné : une scène et une caméra.
    afficher(nouvelleScene, nouvelleCamera) {
      scene = nouvelleScene;
      camera = nouvelleCamera;
      redessiner();
    },

    redessiner,

    // « animation(dt) » est appelée à chaque image tant qu'elle renvoie true.
    animer(animation) {
      animations.add(animation);
      demarrer();
    },

    arreterAnimation(animation) {
      animations.delete(animation);
    },

    // « fonction(largeur, hauteur) » est appelée à chaque changement de taille.
    quandTaille(fonction) {
      surTaille.add(fonction);
      fonction(largeur, hauteur);
      return () => surTaille.delete(fonction);
    },

    changerQualite(nouvelle) {
      if (!QUALITES[nouvelle] || nouvelle === reglage) return;
      const lissageChange = QUALITES[nouvelle].lissage !== QUALITES[reglage].lissage;
      reglage = nouvelle;
      if (lissageChange) creerRendu();
      else ajusterTaille();
    },

    // Une « photo » d'une autre scène (le portrait de la visio…), rendue dans
    // un coin de la zone de dessin puis recopiée dans une petite toile 2D.
    // Tout se passe dans la même tâche : la scène du jeu est redessinée
    // aussitôt, l'écran n'a jamais le temps de montrer la photo à sa place.
    // Renvoie la toile 2D, ou null si la 3D n'est pas disponible.
    photographier(autreScene, autreCamera, largeurVoulue, hauteurVoulue) {
      const toile = rendu.domElement;
      const ratio = rendu.getPixelRatio();
      const l = Math.max(1, Math.min(Math.round(largeurVoulue * ratio), toile.width));
      const h = Math.max(1, Math.min(Math.round(hauteurVoulue * ratio), toile.height));
      if (rendu.getContext().isContextLost()) return null;
      autreCamera.updateProjectionMatrix();
      rendu.setScissorTest(true);
      rendu.setScissor(0, 0, l / ratio, h / ratio);
      rendu.setViewport(0, 0, l / ratio, h / ratio);
      rendu.render(autreScene, autreCamera);
      const photo = document.createElement('canvas');
      photo.width = l;
      photo.height = h;
      photo.getContext('2d').drawImage(toile, 0, toile.height - h, l, h, 0, 0, l, h);
      rendu.setScissorTest(false);
      rendu.setViewport(0, 0, largeur, hauteur);
      if (scene && camera) rendu.render(scene, camera);
      return photo;
    },

    // Les informations de la carte graphique (pour les tests).
    get infos() { return rendu.info; },

    liberer() {
      observateur.disconnect();
      animations.clear();
      rendu.dispose();
      rendu.domElement.remove();
    },
  };
}
