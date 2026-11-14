// =============================================================================
// donnees.js — charge et vérifie les fichiers de data/
// -----------------------------------------------------------------------------
// Au démarrage, tous les fichiers listés dans schemas.js sont lus, puis ceux
// des lieux (d'après data/lieux/index.json). Chacun est vérifié seul, puis on
// vérifie qu'ils s'accordent entre eux (coherence.js). Si l'un d'eux contient
// une erreur, le jeu ne démarre pas à moitié : l'écran de secours affiche la
// liste précise des problèmes.
// =============================================================================

import { verifierCoherence } from './coherence.js';
import { FICHIERS_DONNEES, SCHEMA_LIEU } from './schemas.js';
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

// Dans le navigateur, les fichiers sont demandés au serveur (ou au service
// worker, hors ligne).
async function lireParReseau(chemin) {
  const reponse = await fetch(chemin);
  if (!reponse.ok) throw new Error(`réponse ${reponse.status}`);
  return reponse.text();
}

/**
 * Charge tous les fichiers de données. Renvoie { jeu, textes, palette,
 * meubles, personnages, indexLieux, lieux: { domicile: {…}, … } }.
 * « lire » permet aux tests de lire les fichiers sur le disque.
 */
export async function chargerDonnees(lire = lireParReseau) {
  const resultat = {};
  const problemes = [];

  async function charger(description) {
    let texte;
    try {
      texte = await lire(description.chemin);
    } catch (erreur) {
      problemes.push(`${description.chemin} : fichier introuvable (${erreur.message})`);
      return null;
    }
    const analyse = analyserFichier(texte, description);
    problemes.push(...analyse.problemes);
    return analyse.problemes.length === 0 ? analyse.donnees : null;
  }

  await Promise.all(FICHIERS_DONNEES.map(async (description) => {
    resultat[description.nom] = await charger(description);
  }));

  // Les lieux, d'après l'index.
  resultat.lieux = {};
  await Promise.all((resultat.indexLieux?.lieux || []).map(async (entree) => {
    const lieu = await charger({ chemin: entree.fichier, schema: SCHEMA_LIEU });
    if (lieu) resultat.lieux[entree.id] = { ...lieu, chemin: entree.fichier };
  }));

  // Les liens entre fichiers ne se vérifient que si chacun est bien écrit.
  if (problemes.length === 0) problemes.push(...verifierCoherence(resultat));
  if (problemes.length > 0) throw new ErreurDonnees(problemes);
  return geler(resultat);
}
