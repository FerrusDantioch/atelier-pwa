// =============================================================================
// embarquer-tiers.mjs — copie dans le dépôt les fichiers d'autres auteurs
// -----------------------------------------------------------------------------
// Le jeu ne charge rien depuis internet : Three.js et les polices sont copiés
// dans le dépôt. Ce petit outil de développement le fait proprement :
//
//   1. il télécharge chaque paquet depuis npm (« npm pack » vérifie au passage
//      que le paquet reçu est bien celui publié) dans un dossier temporaire ;
//   2. il copie seulement les fichiers utiles à leur place dans le jeu ;
//   3. il écrit leurs empreintes SHA-256 dans licences-tierces.txt.
//
// Les tests (tests/tiers.test.js) recalculent ces empreintes : si un de ces
// fichiers est modifié par erreur, les tests le signalent.
//
// Lancement (depuis la racine du dépôt) : node outils/embarquer-tiers.mjs
// Il faut Node.js, npm et la commande « tar » (présente sur Linux, macOS et
// Windows 10 ou plus récent).
//
// Pour changer de version : modifier PAQUETS ci-dessous, relancer l'outil,
// puis mettre à jour les numéros de version écrits dans licences-tierces.txt.
// =============================================================================

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

// Chaque paquet : son nom npm, sa version exacte, et les fichiers à copier
// ([chemin dans le paquet, chemin dans le jeu]).
const PAQUETS = [
  {
    nom: 'three',
    version: '0.187.0',
    fichiers: [
      // three.module.js charge three.core.js : il faut les deux.
      ['build/three.module.js', 'lib/three/three.module.js'],
      ['build/three.core.js', 'lib/three/three.core.js'],
      ['LICENSE', 'lib/three/LICENSE'],
    ],
  },
  {
    nom: '@fontsource/atkinson-hyperlegible-next',
    version: '5.3.0',
    fichiers: [
      // « latin » couvre le français courant (é, à, ç, œ, «, », €…),
      // « latin-ext » les caractères plus rares (Ÿ…). Gras (700) et normal (400).
      ['files/atkinson-hyperlegible-next-latin-400-normal.woff2', 'assets/polices/atkinson-hyperlegible-next-latin-400-normal.woff2'],
      ['files/atkinson-hyperlegible-next-latin-700-normal.woff2', 'assets/polices/atkinson-hyperlegible-next-latin-700-normal.woff2'],
      ['files/atkinson-hyperlegible-next-latin-ext-400-normal.woff2', 'assets/polices/atkinson-hyperlegible-next-latin-ext-400-normal.woff2'],
      ['files/atkinson-hyperlegible-next-latin-ext-700-normal.woff2', 'assets/polices/atkinson-hyperlegible-next-latin-ext-700-normal.woff2'],
      ['LICENSE', 'assets/polices/LICENCE-Atkinson-Hyperlegible-Next.txt'],
    ],
  },
  {
    nom: '@fontsource/opendyslexic',
    version: '5.3.0',
    fichiers: [
      ['files/opendyslexic-latin-400-normal.woff2', 'assets/polices/opendyslexic-latin-400-normal.woff2'],
      ['files/opendyslexic-latin-700-normal.woff2', 'assets/polices/opendyslexic-latin-700-normal.woff2'],
      ['LICENSE', 'assets/polices/LICENCE-OpenDyslexic.txt'],
    ],
  },
];

const DEBUT = '# --- début des empreintes (écrites par outils/embarquer-tiers.mjs) ---';
const FIN = '# --- fin des empreintes ---';

function empreinte(chemin) {
  return createHash('sha256').update(readFileSync(chemin)).digest('hex');
}

const temporaire = mkdtempSync(join(tmpdir(), 'atelier-pwa-tiers-'));
const lignes = [];

try {
  for (const paquet of PAQUETS) {
    const reference = `${paquet.nom}@${paquet.version}`;
    console.log(`Téléchargement de ${reference}…`);
    const dossier = join(temporaire, paquet.nom.replace(/[@/]/g, '_'));
    mkdirSync(dossier, { recursive: true });
    // « npm pack » télécharge l'archive du paquet et vérifie son intégrité.
    const archive = execFileSync('npm', ['pack', reference, '--silent'], {
      cwd: dossier,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    }).trim().split('\n').pop();
    execFileSync('tar', ['-xzf', archive], { cwd: dossier });

    for (const [depuis, vers] of paquet.fichiers) {
      const destination = join(RACINE, vers);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(join(dossier, 'package', depuis), destination);
      lignes.push(`${empreinte(destination)}  ${vers}`);
      console.log(`  copié : ${vers}`);
    }
  }

  // Remplace le bloc des empreintes dans licences-tierces.txt.
  const cheminLicences = join(RACINE, 'licences-tierces.txt');
  const texte = readFileSync(cheminLicences, 'utf8');
  const debut = texte.indexOf(DEBUT);
  const fin = texte.indexOf(FIN);
  if (debut === -1 || fin === -1 || fin < debut) {
    throw new Error('licences-tierces.txt : repères des empreintes introuvables.');
  }
  const nouveau = `${texte.slice(0, debut)}${DEBUT}\n${lignes.join('\n')}\n${texte.slice(fin)}`;
  writeFileSync(cheminLicences, nouveau);
  console.log('Empreintes écrites dans licences-tierces.txt.');

  // Met aussi à jour VERSION_TIERS dans sw.js à partir des empreintes triées,
  // pour que les joueurs retéléchargent les fichiers tiers si l'un d'eux change.
  const versionTiers = createHash('sha256')
    .update(lignes.map((ligne) => {
      const [h, chemin] = ligne.split('  ');
      return `${chemin}:${h}`;
    }).sort().join('\n'))
    .digest('hex')
    .slice(0, 12);
  const cheminSw = join(RACINE, 'sw.js');
  const sw = readFileSync(cheminSw, 'utf8');
  if (!/const VERSION_TIERS = '[^']+';/.test(sw)) {
    throw new Error('sw.js : constante VERSION_TIERS introuvable.');
  }
  writeFileSync(cheminSw, sw.replace(/const VERSION_TIERS = '[^']+';/, `const VERSION_TIERS = '${versionTiers}';`));
  console.log(`VERSION_TIERS mis à jour dans sw.js : ${versionTiers}.`);
} finally {
  rmSync(temporaire, { recursive: true, force: true });
}
