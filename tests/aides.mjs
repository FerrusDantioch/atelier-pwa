// =============================================================================
// aides.mjs — petits outils communs aux tests (sans navigateur)
// -----------------------------------------------------------------------------
// Les modules du jeu s'attendent à tourner dans un navigateur (« self »,
// CONFIG_JEU…). Ici, on recrée juste ce qu'il faut pour les tester avec
// Node.js seul : aucune installation n'est nécessaire.
//
// Lancement de tous les tests sans navigateur : node --test tests/
// =============================================================================

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInThisContext } from 'node:vm';

export const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

export function lire(chemin) {
  return readFileSync(join(RACINE, chemin), 'utf8');
}

export function lireJson(chemin) {
  return JSON.parse(lire(chemin));
}

// Charge js/config.js comme le ferait le navigateur, et renvoie CONFIG_JEU.
export function chargerConfig() {
  globalThis.self = globalThis;
  if (!globalThis.CONFIG_JEU) runInThisContext(lire('js/config.js'), { filename: 'js/config.js' });
  return globalThis.CONFIG_JEU;
}

// Tous les fichiers du dépôt (chemins relatifs, avec des « / »), sans .git
// ni les dossiers d'outils installés.
export function tousLesFichiers(dossier = RACINE) {
  const resultat = [];
  for (const nom of readdirSync(dossier)) {
    if (nom === '.git' || nom === 'node_modules' || nom === 'test-results') continue;
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) resultat.push(...tousLesFichiers(chemin));
    else resultat.push(relative(RACINE, chemin).split(sep).join('/'));
  }
  return resultat;
}

// La liste FICHIERS écrite dans sw.js.
export function fichiersDuServiceWorker() {
  const texte = lire('sw.js');
  const bloc = texte.match(/const FICHIERS = \[([\s\S]*?)\];/);
  if (!bloc) throw new Error('liste FICHIERS introuvable dans sw.js');
  return [...bloc[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

// Charge toutes les données du jeu depuis le disque, avec les mêmes
// vérifications qu'au démarrage du jeu (fichier par fichier, puis accord
// entre les fichiers). Lève une erreur détaillée en cas de problème.
export async function chargerDonneesDuDisque() {
  chargerConfig();
  const { chargerDonnees } = await import('../js/noyau/donnees.js');
  return chargerDonnees(async (chemin) => lire(chemin));
}
