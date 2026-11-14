// =============================================================================
// pointage.js — le doigt et la souris sur la scène 3D
// -----------------------------------------------------------------------------
//   - toucher (ou cliquer) : aller là, ou vers le meuble touché ;
//   - glisser un doigt (ou la souris, bouton enfoncé) : déplacer la vue ;
//   - pincer à deux doigts, ou la molette : zoomer ;
//   - survoler à la souris : la case visée est entourée.
// Un toucher reste un toucher même si le doigt bouge un tout petit peu
// (tremblements) : il faut dépasser 12 pixels pour que ce soit un glissé.
// Aucun geste n'est obligatoire : « Aller à… » et les boutons de caméra font
// la même chose.
// =============================================================================

const SEUIL_GLISSER = 12; // pixels

/**
 * Branche les gestes sur la zone de dessin. « actions » :
 *   toucher(x, y)       un toucher / clic (coordonnées dans la toile)
 *   glisser(dx, dy)     déplacer la vue
 *   zoomer(facteur)     zoomer (facteur > 1 : plus près)
 *   survoler(x, y)      la souris passe (null quand elle sort)
 * Renvoie une fonction qui débranche tout.
 */
export function brancherPointage(obtenirToile, actions) {
  const pointeurs = new Map(); // pointeurs en cours (doigts, souris)
  let glisse = false;
  let pincement = null;
  let toile = null;

  const position = (evenement) => {
    const rect = toile.getBoundingClientRect();
    return { x: evenement.clientX - rect.left, y: evenement.clientY - rect.top };
  };
  const ecart = () => {
    const [a, b] = [...pointeurs.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  function appui(evenement) {
    if (evenement.pointerType === 'mouse' && evenement.button !== 0) return;
    // La scène prend la main : un bouton qui avait le focus ne réagira pas
    // à la touche Entrée destinée au jeu.
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    toile.setPointerCapture?.(evenement.pointerId);
    const point = position(evenement);
    pointeurs.set(evenement.pointerId, { ...point, depart: point, derniere: point });
    if (pointeurs.size === 2) {
      pincement = { ecart: ecart() };
      glisse = true; // un pincement n'est jamais un toucher
    } else if (pointeurs.size === 1) {
      glisse = false;
    }
    actions.survoler?.(null);
  }

  function mouvement(evenement) {
    const point = position(evenement);
    const pointeur = pointeurs.get(evenement.pointerId);
    if (!pointeur) {
      if (evenement.pointerType === 'mouse') actions.survoler?.(point.x, point.y);
      return;
    }
    pointeur.x = point.x;
    pointeur.y = point.y;
    if (pointeurs.size >= 2 && pincement) {
      const nouvelEcart = ecart();
      if (pincement.ecart > 0 && nouvelEcart > 0) actions.zoomer(nouvelEcart / pincement.ecart);
      pincement.ecart = nouvelEcart;
      return;
    }
    if (!glisse && Math.hypot(point.x - pointeur.depart.x, point.y - pointeur.depart.y) > SEUIL_GLISSER) {
      glisse = true;
    }
    if (glisse) actions.glisser(point.x - pointeur.derniere.x, point.y - pointeur.derniere.y);
    pointeur.derniere = point;
  }

  function relache(evenement) {
    const pointeur = pointeurs.get(evenement.pointerId);
    if (!pointeur) return;
    pointeurs.delete(evenement.pointerId);
    if (pointeurs.size < 2) pincement = null;
    if (!glisse && pointeurs.size === 0 && evenement.type === 'pointerup') {
      actions.toucher(pointeur.depart.x, pointeur.depart.y);
    }
    if (pointeurs.size === 0) glisse = false;
  }

  function molette(evenement) {
    evenement.preventDefault();
    // Pincement sur un pavé tactile : la molette arrive avec Ctrl.
    const force = evenement.ctrlKey ? 0.01 : 0.0015;
    actions.zoomer(Math.exp(-evenement.deltaY * force));
  }

  function sortie() {
    actions.survoler?.(null);
  }

  function brancher(nouvelle) {
    if (toile === nouvelle) return;
    debrancher();
    toile = nouvelle;
    toile.addEventListener('pointerdown', appui);
    toile.addEventListener('pointermove', mouvement);
    toile.addEventListener('pointerup', relache);
    toile.addEventListener('pointercancel', relache);
    toile.addEventListener('pointerleave', sortie);
    toile.addEventListener('wheel', molette, { passive: false });
    toile.addEventListener('contextmenu', empecher);
  }

  function empecher(evenement) {
    evenement.preventDefault();
  }

  function debrancher() {
    if (!toile) return;
    toile.removeEventListener('pointerdown', appui);
    toile.removeEventListener('pointermove', mouvement);
    toile.removeEventListener('pointerup', relache);
    toile.removeEventListener('pointercancel', relache);
    toile.removeEventListener('pointerleave', sortie);
    toile.removeEventListener('wheel', molette);
    toile.removeEventListener('contextmenu', empecher);
    pointeurs.clear();
    toile = null;
  }

  brancher(obtenirToile());
  return {
    // La toile peut être remplacée (changement de qualité graphique).
    actualiser() { brancher(obtenirToile()); },
    debrancher,
  };
}
