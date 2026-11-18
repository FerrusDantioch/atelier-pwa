// =============================================================================
// habitants.js — les personnages non joueurs (PNJ) présents dans un lieu
// -----------------------------------------------------------------------------
// Chaque PNJ suit sa routine (data/pnj.json, voir js/jeu/routines.js) :
//   - à l'heure de son créneau, il se rend à son point (ex. le bureau de
//     montage) ; s'il arrive de l'extérieur, il entre par la porte d'entrée ;
//   - quand son dernier créneau se termine, il repart par la porte ;
//   - quand on lui parle, il s'arrête et se tourne vers nous.
// Il se déplace comme le joueur : avec la recherche de chemin, et en
// fauteuil roulant par des passages d'au moins 1 m.
//
// Au chargement d'une partie (ou au réveil), chacun est posé directement à
// sa place : personne ne « traverse » la maison pour rien.
// =============================================================================

import { Box3, Vector3 } from '../../lib/three/three.module.js';
import { apparenceDuJoueur, nettoyerApparence } from '../jeu/personnage.js';
import { POINT_D_ARRIVEE, presenceDans } from '../jeu/routines.js';
import { animerPersonnage, construirePersonnage } from '../modeles/personnage.js';
import { distancesDepuis, lisserChemin, trouverChemin } from './chemin.js';
import { creerDeplacement } from './deplacement.js';
import { TAILLE_CASE, angleVers, profilDeDeplacement } from './grille.js';

/**
 * Crée les habitants d'un lieu.
 *   scene, lieu, grille, donnees, palette
 *   joueur()   le joueur actuel (Ferrus ou non : le mentor n'est pas là si on joue Ferrus)
 */
export function creerHabitants({ scene, lieu, grille: grilleDeDepart, donnees, palette, joueur }) {
  // La grille change quand un meuble est posé ou rangé (changerGrille).
  let grille = grilleDeDepart;
  const points = new Map((lieu.points || []).map((point) => [point.id, point]));
  const vitesse = donnees.jeu.deplacement.vitesse;
  const personnages = donnees.personnages;

  // Seuls les PNJ dont la routine passe par ce lieu.
  const habitants = donnees.pnj.pnj
    .filter((pnj) => pnj.routine.some((creneau) => creneau.lieu === lieu.id))
    .map((pnj) => {
      const ferrus = pnj.modele === 'ferrus';
      const apparence = ferrus ? apparenceDuJoueur({ modele: 'ferrus' }, personnages) : nettoyerApparence(pnj.apparence, personnages);
      const perso = construirePersonnage(apparence, personnages, palette);
      perso.groupe.visible = false;
      scene.add(perso.groupe);
      return {
        id: pnj.id,
        nom: ferrus ? personnages.ferrus.nom : pnj.nom,
        pnj,
        perso,
        profil: profilDeDeplacement(apparence.aide),
        deplacement: null,
        present: false,
        creneau: null,
        sortant: false, // il marche vers la porte pour partir
        parle: false, // on lui parle : il ne bouge pas
        boite: new Box3(),
      };
    });

  function placerModele(habitant) {
    const { x, z } = habitant.deplacement.position;
    habitant.perso.groupe.position.set(x, 0, z);
    habitant.perso.groupe.rotation.y = habitant.deplacement.angle * Math.PI / 180;
    habitant.boite.set(new Vector3(x - 0.3, 0, z - 0.3), new Vector3(x + 0.3, 1.8, z + 0.3));
  }

  // Les cases déjà prises (joueur, autres PNJ), à éviter comme destination.
  function casesPrises(sauf, caseJoueur) {
    const prises = new Set();
    if (caseJoueur) prises.add(`${caseJoueur.x},${caseJoueur.z}`);
    for (const autre of habitants) {
      if (autre === sauf || !autre.present) continue;
      const destination = autre.deplacement.destination || autre.deplacement.case;
      prises.add(`${destination.x},${destination.z}`);
    }
    return prises;
  }

  // La case où se tenir pour ce créneau : le point prévu, ou la case libre
  // la plus proche si quelqu'un l'occupe déjà.
  function caseDuCreneau(habitant, creneau, caseJoueur, depuis) {
    const point = points.get(creneau.point);
    const prises = casesPrises(habitant, caseJoueur);
    if (!prises.has(`${point.x},${point.z}`)) return { x: point.x, z: point.z, angle: point.angle };
    const distances = distancesDepuis(grille, depuis || point, habitant.profil);
    let meilleure = null;
    let ecart = Infinity;
    for (const cle of distances.keys()) {
      if (prises.has(cle)) continue;
      const [x, z] = cle.split(',').map(Number);
      const d = Math.hypot(x - point.x, z - point.z);
      if (d < ecart) { ecart = d; meilleure = { x, z, angle: point.angle }; }
    }
    return meilleure || { x: point.x, z: point.z, angle: point.angle };
  }

  function apparaitre(habitant, x, z, angle) {
    habitant.deplacement = creerDeplacement({ depart: { x, z, angle }, vitesse });
    habitant.present = true;
    habitant.sortant = false;
    habitant.perso.groupe.visible = true;
    placerModele(habitant);
  }

  function disparaitre(habitant) {
    habitant.present = false;
    habitant.sortant = false;
    habitant.creneau = null;
    habitant.perso.groupe.visible = false;
  }

  function marcherVers(habitant, arrivee) {
    const depuis = habitant.deplacement.case;
    const chemin = trouverChemin(grille, depuis, arrivee, habitant.profil);
    if (!chemin) {
      // Pas de chemin (ne devrait pas arriver : les données sont vérifiées) :
      // il apparaît directement à sa place.
      habitant.deplacement.teleporter(arrivee.x, arrivee.z, arrivee.angle ?? habitant.deplacement.angle);
      placerModele(habitant);
      return;
    }
    habitant.deplacement.suivre(lisserChemin(grille, chemin, habitant.profil));
    habitant.angleFinal = arrivee.angle;
  }

  return {
    get liste() { return habitants; },

    // Un meuble a été posé ou rangé : les chemins se cherchent sur la
    // nouvelle grille.
    changerGrille(nouvelle) {
      grille = nouvelle;
    },

    // Pose chacun directement à sa place pour cette heure (chargement, réveil).
    placer(minute, caseJoueur) {
      for (const habitant of habitants) {
        const creneau = presenceDans(habitant.pnj, lieu.id, minute, joueur());
        if (!creneau) {
          disparaitre(habitant);
          continue;
        }
        habitant.creneau = creneau;
        habitant.parle = false;
        const place = caseDuCreneau(habitant, creneau, caseJoueur);
        apparaitre(habitant, place.x, place.z, place.angle);
      }
    },

    /**
     * L'heure a avancé : chacun suit sa routine. Renvoie les arrivées et les
     * départs ([{ type: 'arrive' | 'part', nom }]) pour les annoncer.
     */
    suivre(minute, caseJoueur) {
      const evenements = [];
      for (const habitant of habitants) {
        const creneau = presenceDans(habitant.pnj, lieu.id, minute, joueur());
        if (creneau === habitant.creneau) continue;
        if (habitant.parle) continue; // on reprendra après la conversation
        if (!creneau) {
          if (habitant.present && !habitant.sortant) {
            const porte = points.get(POINT_D_ARRIVEE);
            habitant.sortant = true;
            habitant.creneau = null;
            marcherVers(habitant, { x: porte.x, z: porte.z, angle: porte.angle });
            evenements.push({ type: 'part', nom: habitant.nom });
          }
          continue;
        }
        if (!habitant.present) {
          const porte = points.get(POINT_D_ARRIVEE);
          apparaitre(habitant, porte.x, porte.z, (porte.angle + 180) % 360);
          evenements.push({ type: 'arrive', nom: habitant.nom });
        }
        habitant.sortant = false;
        habitant.creneau = creneau;
        marcherVers(habitant, caseDuCreneau(habitant, creneau, caseJoueur, habitant.deplacement.case));
      }
      return evenements;
    },

    // Fait avancer ceux qui marchent. Renvoie true si quelqu'un bouge encore.
    avancer(dt, reduit) {
      let bouge = false;
      for (const habitant of habitants) {
        if (!habitant.present) continue;
        const resultat = habitant.deplacement.avancer(dt, { tournerInstantanement: reduit });
        if (resultat.arrive) {
          if (habitant.sortant) {
            disparaitre(habitant);
            continue;
          }
          if (typeof habitant.angleFinal === 'number') habitant.deplacement.regarder(habitant.angleFinal, { instantane: reduit });
        }
        placerModele(habitant);
        const anime = animerPersonnage(habitant.perso, { dt, distance: resultat.distance, reduit });
        if (habitant.deplacement.enRoute || anime || resultat.tourne) bouge = true;
      }
      return bouge;
    },

    // Ce qu'on peut toucher : les PNJ présents (qui ne sont pas en train de partir).
    cibles() {
      return habitants
        .filter((habitant) => habitant.present && !habitant.sortant)
        .map((habitant) => ({ type: 'pnj', id: habitant.id, examinable: true, boite: habitant.boite }));
    },

    trouver(id) {
      return habitants.find((habitant) => habitant.id === id) || null;
    },

    // La case d'un PNJ (où il est, ou là où il va s'il marche).
    caseDe(id) {
      const habitant = this.trouver(id);
      return habitant?.present ? habitant.deplacement.case : null;
    },

    // Là où il s'arrêtera : la fin de son trajet s'il marche, sinon sa case.
    destinationDe(id) {
      const habitant = this.trouver(id);
      if (!habitant?.present) return null;
      return habitant.deplacement.destination || habitant.deplacement.case;
    },

    // On lui parle : il s'arrête au centre de sa case et se tourne vers nous.
    arreter(id, versX, versZ, reduit) {
      const habitant = this.trouver(id);
      if (!habitant?.present) return;
      habitant.parle = true;
      if (habitant.deplacement.enRoute) habitant.deplacement.revenirAuCentre();
      const { x, z } = habitant.deplacement.position;
      const angle = angleVers(versX - x, versZ - z);
      if (angle !== null) habitant.deplacement.regarder(angle, { instantane: reduit });
    },

    // Fin de la conversation : il reprend sa routine.
    reprendre(id, minute, caseJoueur) {
      const habitant = this.trouver(id);
      if (!habitant) return;
      habitant.parle = false;
      habitant.creneau = undefined; // force le recalcul
      this.suivre(minute, caseJoueur);
    },

    // Où se trouve le centre d'un PNJ (en mètres) ?
    position(id) {
      const habitant = this.trouver(id);
      return habitant?.present ? habitant.deplacement.position : null;
    },

    liberer() {
      for (const habitant of habitants) {
        scene.remove(habitant.perso.groupe);
        habitant.perso.liberer();
      }
    },
  };
}

// La distance (en cases) entre une case et le centre d'un PNJ.
export function ecartEnCases(caseJoueur, position) {
  return Math.hypot(caseJoueur.x + 0.5 - position.x / TAILLE_CASE, caseJoueur.z + 0.5 - position.z / TAILLE_CASE);
}
