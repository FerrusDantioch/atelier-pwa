// =============================================================================
// creer-icones.mjs — dessine les icônes du jeu (outil de développement)
// -----------------------------------------------------------------------------
// Comme les modèles du jeu, l'icône est fabriquée par code à partir de boîtes
// vues « en isométrique » (vue de trois quarts, sans perspective) : un sol,
// un bureau, un écran allumé et une plante, sur le fond violet nuit de
// l'Omni-système.
//
// L'outil écrit assets/icones/icone.svg, puis le transforme en images PNG
// aux tailles demandées par les téléphones et tablettes, grâce au navigateur
// Chromium piloté par Playwright.
//
// Lancement : node outils/creer-icones.mjs
// (il faut Playwright : npm install playwright && npx playwright install chromium)
// Les images produites sont versées dans le dépôt : inutile de relancer
// l'outil tant que le dessin ne change pas.
// =============================================================================

import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = join(RACINE, 'assets', 'icones');

// --- Petite géométrie isométrique -------------------------------------------

const UNITE = 40;           // taille d'un « mètre » en pixels (dessin en 512 × 512)
const CENTRE = [256, 292];  // où tombe le point (0, 0, 0)
const COS30 = Math.cos(Math.PI / 6);

// Passe d'un point 3D (x, y : le sol ; z : la hauteur) à un point de l'image.
function iso([x, y, z]) {
  return [CENTRE[0] + (x - y) * UNITE * COS30, CENTRE[1] + (x + y) * UNITE * 0.5 - z * UNITE];
}

function eclaircir(hex, facteur) {
  const n = parseInt(hex.slice(1), 16);
  const canal = (decalage) => Math.max(0, Math.min(255, Math.round(((n >> decalage) & 255) * facteur)));
  return `#${[16, 8, 0].map((d) => canal(d).toString(16).padStart(2, '0')).join('')}`;
}

function polygone(points, couleur) {
  const d = points.map(iso).map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
  return `<polygon points="${d}" fill="${couleur}"/>`;
}

// Une boîte : on dessine les trois faces visibles (dessus, face gauche, face droite).
function boite([x0, x1], [y0, y1], [z0, z1], couleur, faceAvant) {
  const dessus = [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const gauche = [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]; // face « y max »
  const droite = [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]; // face « x max »
  return [
    polygone(dessus, couleur),
    polygone(gauche, faceAvant || eclaircir(couleur, 0.78)),
    polygone(droite, eclaircir(couleur, 0.6)),
  ].join('');
}

// --- La scène ---------------------------------------------------------------

function scene() {
  const bois = '#d08f5c';
  const pieds = '#8a5a3a';
  return [
    // Le sol, une dalle épaisse.
    boite([-3, 3], [-3, 3], [-0.45, 0], '#7c66c9'),
    // Pieds arrière du bureau, puis plateau, puis pieds avant.
    boite([-2.1, -1.85], [-1.45, -1.2], [0, 1.3], pieds),
    boite([1.3, 1.55], [-1.45, -1.2], [0, 1.3], pieds),
    boite([-2.2, 1.65], [-1.6, 0.45], [1.3, 1.55], bois),
    boite([-2.1, -1.85], [0.1, 0.35], [0, 1.3], pieds),
    boite([1.3, 1.55], [0.1, 0.35], [0, 1.3], pieds),
    // Pied de l'écran, puis l'écran (sa face avant est allumée).
    boite([-0.55, -0.2], [-1.25, -0.95], [1.55, 2.0], '#3a3550'),
    boite([-1.75, 1.05], [-1.35, -1.1], [2.0, 3.55], '#2c2840'),
    polygone([[-1.6, -1.1, 2.15], [0.9, -1.1, 2.15], [0.9, -1.1, 3.4], [-1.6, -1.1, 3.4]], '#ffd166'),
    // Deux lignes de « code » sur l'écran.
    polygone([[-1.35, -1.1, 3.05], [-0.1, -1.1, 3.05], [-0.1, -1.1, 3.17], [-1.35, -1.1, 3.17]], '#c9842f'),
    polygone([[-1.35, -1.1, 2.75], [0.45, -1.1, 2.75], [0.45, -1.1, 2.87], [-1.35, -1.1, 2.87]], '#c9842f'),
    // Une plante en pot, à droite.
    boite([2.0, 2.6], [-2.6, -2.0], [0, 0.65], '#d9734a'),
    boite([1.85, 2.75], [-2.75, -1.85], [0.65, 1.75], '#5fbf77'),
    boite([2.05, 2.55], [-2.55, -2.05], [1.75, 2.35], '#7fd894'),
  ].join('');
}

// Le fond : carré arrondi (icône normale) ou plein cadre (icône « maskable »,
// que le téléphone découpe lui-même en rond ou en goutte).
function svg({ arrondi, echelle }) {
  const fond = arrondi
    ? '<rect x="0" y="0" width="512" height="512" rx="104" fill="url(#degrade)"/>'
    : '<rect x="0" y="0" width="512" height="512" fill="url(#degrade)"/>';
  const decalage = 256 * (1 - echelle);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs><linearGradient id="degrade" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#33245c"/><stop offset="1" stop-color="#171126"/></linearGradient></defs>
${fond}
<g transform="translate(${decalage.toFixed(1)} ${decalage.toFixed(1)}) scale(${echelle})">${scene()}</g>
</svg>
`;
}

// --- Fabrication des fichiers ------------------------------------------------

const ICONES = [
  { fichier: 'icone-192.png', taille: 192, arrondi: true, echelle: 0.92 },
  { fichier: 'icone-512.png', taille: 512, arrondi: true, echelle: 0.92 },
  // « maskable » : le dessin reste dans le cercle central (zone sûre de 80 %).
  { fichier: 'icone-maskable-192.png', taille: 192, arrondi: false, echelle: 0.72 },
  { fichier: 'icone-maskable-512.png', taille: 512, arrondi: false, echelle: 0.72 },
  // iPhone et iPad arrondissent eux-mêmes les coins : fond plein.
  { fichier: 'apple-touch-icon.png', taille: 180, arrondi: false, echelle: 0.84 },
  { fichier: 'favicon-32.png', taille: 32, arrondi: true, echelle: 0.98 },
];

mkdirSync(DOSSIER, { recursive: true });
writeFileSync(join(DOSSIER, 'icone.svg'), svg({ arrondi: true, echelle: 0.92 }));
console.log('écrit : assets/icones/icone.svg');

// Playwright peut être installé dans le projet ou globalement.
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  console.error('Playwright est introuvable : npm install playwright, puis relancer.');
  process.exit(1);
}

const navigateur = await playwright.chromium.launch();
try {
  for (const icone of ICONES) {
    const page = await navigateur.newPage({ viewport: { width: icone.taille, height: icone.taille } });
    const contenu = svg(icone).replace('width="512" height="512"', `width="${icone.taille}" height="${icone.taille}"`);
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${contenu}</body></html>`);
    await page.screenshot({
      path: join(DOSSIER, icone.fichier),
      omitBackground: icone.arrondi,
      clip: { x: 0, y: 0, width: icone.taille, height: icone.taille },
    });
    await page.close();
    console.log(`écrit : assets/icones/${icone.fichier}`);
  }
} finally {
  await navigateur.close();
}
