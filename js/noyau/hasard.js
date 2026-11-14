// =============================================================================
// hasard.js — des tirages au sort reproductibles (« à graine »)
// -----------------------------------------------------------------------------
// Au début de chaque partie, on tire un nombre au hasard : la « graine ».
// Tous les tirages du jeu (quêtes aléatoires…) partent de cette graine : une
// même partie donne toujours les mêmes tirages. C'est utile pour comprendre
// un souci signalé par quelqu'un (« avec ma sauvegarde, il se passe ceci »).
//
// Méthode « mulberry32 » : courte, rapide et suffisante pour un jeu.
// =============================================================================

// Renvoie une fonction qui donne un nombre entre 0 (compris) et 1 (exclu),
// toujours la même suite pour une même graine.
export function creerHasard(graine) {
  let etat = graine >>> 0;
  return function suivant() {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let x = etat;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// Mélange plusieurs nombres en une nouvelle graine (ex. graine de la partie
// + numéro du jour) : chaque jour a ses propres tirages, toujours les mêmes.
export function combinerGraines(...nombres) {
  let h = 0x811c9dc5;
  for (const nombre of nombres) {
    h = Math.imul(h ^ (nombre >>> 0), 0x01000193) >>> 0;
    h ^= h >>> 13;
  }
  return h >>> 0;
}

// Une graine vraiment au hasard, pour une nouvelle partie.
export function nouvelleGraine() {
  if (globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 4294967296);
}

// Un entier entre min et max (compris).
export function entierEntre(hasard, min, max) {
  return min + Math.floor(hasard() * (max - min + 1));
}

// Un élément d'une liste.
export function choisirDans(hasard, liste) {
  return liste[Math.floor(hasard() * liste.length)];
}
