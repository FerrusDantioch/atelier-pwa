// =============================================================================
// palette.js — les couleurs de la scène 3D (data/palette.json)
// -----------------------------------------------------------------------------
// Les couleurs de la 3D sont rangées par nom dans data/palette.json : un même
// nom (« bois-clair ») sert à tous les meubles. Changer une couleur dans ce
// fichier la change partout.
//
// Les couleurs de l'INTERFACE (boutons, textes…) sont ailleurs, dans
// css/themes.css. Les repères dessinés dans la 3D (destination, objet
// ciblé) reprennent la couleur du contour de focus du thème : ils restent
// donc bien visibles en contraste élevé.
// =============================================================================

import { Color } from '../../lib/three/three.module.js';

export function creerPalette(couleurs) {
  const cache = new Map();
  return {
    // Une THREE.Color (les couleurs sont converties pour l'éclairage).
    couleur(nom) {
      if (!cache.has(nom)) {
        const texte = couleurs[nom];
        if (!texte) console.warn(`Couleur absente de data/palette.json : « ${nom} »`);
        cache.set(nom, new Color(texte || '#ff00ff'));
      }
      return cache.get(nom);
    },
    // Le texte « #rrggbb » (pour l'interface : pastilles de couleur).
    texte(nom) {
      return couleurs[nom] || '#ff00ff';
    },
  };
}

// Lit une couleur du thème de l'interface (variable CSS), par exemple
// « --focus » ou « --fond-scene ».
export function couleurDuTheme(variable, secours = '#808080') {
  const valeur = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  try {
    return new Color(valeur || secours);
  } catch {
    return new Color(secours);
  }
}
