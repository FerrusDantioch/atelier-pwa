// =============================================================================
// donnees.js — charge et vérifie les fichiers de data/
// -----------------------------------------------------------------------------
// Au démarrage, tous les fichiers listés dans schemas.js sont lus, puis
// vérifiés. Si l'un d'eux contient une erreur, le jeu ne démarre pas à
// moitié : l'écran de secours affiche la liste précise des problèmes.
// =============================================================================

import { FICHIERS_DONNEES } from './schemas.js';
import { expliquerErreurJson, verifier } from './verification.js';

export class ErreurDonnees extends Error {
  constructor(problemes) {
    super(`Les fichiers de données contiennent ${problemes.length} problème(s) :\n- ${problemes.join('\n- ')}`);
    this.name = 'ErreurDonnees';
    this.problemes = problemes;
  }
}

// Lit le texte d'un fichier et le vérifie. Renvoie { donnees, problemes }.
// (Utilisé aussi par les tests, sans navigateur.)
export function analyserFichier(texte, description) {
  let donnees;
  try {
    donnees = JSON.parse(texte);
  } catch (erreur) {
    return { donnees: null, problemes: [`${description.chemin} : ${expliquerErreurJson(texte, erreur)}`] };
  }
  const problemes = [
    ...verifier(donnees, description.schema),
    ...(description.enPlus ? description.enPlus(donnees) : []),
  ].map((probleme) => `${description.chemin} › ${probleme}`);
  return { donnees, problemes };
}

// Gèle un objet en profondeur : les données ne peuvent plus être modifiées
// par erreur pendant le jeu.
function geler(objet) {
  if (objet && typeof objet === 'object' && !Object.isFrozen(objet)) {
    Object.values(objet).forEach(geler);
    Object.freeze(objet);
  }
  return objet;
}

// Charge tous les fichiers de données. Renvoie { jeu, textes, … }.
export async function chargerDonnees() {
  const resultat = {};
  const problemes = [];
  await Promise.all(FICHIERS_DONNEES.map(async (description) => {
    let texte;
    try {
      const reponse = await fetch(description.chemin);
      if (!reponse.ok) throw new Error(`réponse ${reponse.status}`);
      texte = await reponse.text();
    } catch (erreur) {
      problemes.push(`${description.chemin} : fichier introuvable (${erreur.message})`);
      return;
    }
    const analyse = analyserFichier(texte, description);
    problemes.push(...analyse.problemes);
    resultat[description.nom] = analyse.donnees;
  }));
  if (problemes.length > 0) throw new ErreurDonnees(problemes);
  return geler(resultat);
}
