// =============================================================================
// serveur.mjs — un petit serveur local pour essayer le jeu sur l'ordinateur
// -----------------------------------------------------------------------------
// Le jeu est fait de fichiers ordinaires, mais les navigateurs refusent de
// charger des modules JavaScript ouverts directement depuis le disque
// (adresse « file:// »). Ce serveur, sans aucune dépendance, les sert comme
// le ferait GitHub Pages.
//
// Lancement (depuis la racine du dépôt) : node outils/serveur.mjs [port]
// puis ouvrir http://localhost:8080 dans le navigateur.
//
// Le fonctionnement hors ligne (service worker) marche sur « localhost ».
// Depuis une tablette du même réseau, il faut une adresse en https : le plus
// simple est de passer par GitHub Pages.
// =============================================================================

import { createReadStream, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = normalize(join(fileURLToPath(import.meta.url), '..', '..'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

// Démarre le serveur et renvoie l'objet serveur (utilisé aussi par les tests).
// port 0 : le système choisit un port libre (serveur.address().port).
// remplacer(chemin, lireTexte) : pour les tests seulement, permet de servir
// une version modifiée d'un fichier (ex. simuler une nouvelle version du
// jeu). lireTexte() donne le contenu d'origine ; renvoyer undefined pour
// servir le fichier tel quel.
export function demarrerServeur(port = 8080, { remplacer } = {}) {
  const serveur = createServer((demande, reponse) => {
    let chemin;
    try {
      chemin = decodeURIComponent(new URL(demande.url, 'http://localhost').pathname);
    } catch {
      reponse.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Requête invalide');
      return;
    }
    let fichier = normalize(join(RACINE, chemin));
    // Sécurité : jamais de fichier en dehors du dépôt.
    if (fichier !== RACINE && !fichier.startsWith(RACINE + sep)) {
      reponse.writeHead(403).end('Interdit');
      return;
    }
    try {
      if (statSync(fichier).isDirectory()) fichier = join(fichier, 'index.html');
      statSync(fichier);
    } catch {
      reponse.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Introuvable');
      return;
    }
    // LICENSE n'a pas d'extension : on le sert comme du texte.
    const type = TYPES[extname(fichier).toLowerCase()] || 'text/plain; charset=utf-8';
    const remplace = remplacer?.(chemin, () => readFileSync(fichier, 'utf8'));
    reponse.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    if (demande.method === 'HEAD') {
      reponse.end();
      return;
    }
    if (remplace !== undefined) {
      reponse.end(remplace);
    } else {
      createReadStream(fichier).on('error', () => reponse.destroy()).pipe(reponse);
    }
  });
  return new Promise((resoudre) => {
    serveur.listen(port, () => resoudre(serveur));
  });
}

// Lancé directement (node outils/serveur.mjs) : on démarre et on l'annonce.
if (process.argv[1] && normalize(process.argv[1]) === normalize(fileURLToPath(import.meta.url))) {
  const port = Number(process.argv[2]) || 8080;
  await demarrerServeur(port);
  console.log(`Le jeu est servi sur http://localhost:${port} (Ctrl+C pour arrêter).`);
}
