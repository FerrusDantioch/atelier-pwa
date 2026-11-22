// =============================================================================
// affiches.js — les affiches collées aux murs, dessinées sur une toile
// -----------------------------------------------------------------------------
// Une affiche est une image plate posée contre un mur (lieu.js). Elle est
// dessinée ici une fois, sur une toile 2D, puis sert de « texture » (une
// image plaquée sur la forme 3D) :
//   « omni »  le logo de l'Omni-système, son nom et l'adresse de son site.
// Les textes viennent de data/textes.json, les couleurs de data/palette.json,
// et l'adresse de js/config.js (siteOmni) : jamais une adresse inventée.
// L'affiche est redessinée quand le logo et la police sont arrivés.
// =============================================================================

import { CanvasTexture, SRGBColorSpace } from '../../lib/three/three.module.js';
import { t } from '../noyau/textes.js';

const LARGEUR = 512; // en pixels de la toile ; la hauteur suit l'affiche
const POLICE = '"Atkinson Hyperlegible Next", system-ui, sans-serif';

// L'adresse, telle qu'on l'écrit sur une affiche (sans « https:// » ni « / »).
export function adresseLisible(adresse) {
  return adresse.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

// La plus grande taille (en pixels) à laquelle le texte tient dans la largeur.
function tailleQuiTient(contexte, texte, { graisse, maximum, largeur }) {
  let taille = maximum;
  contexte.font = `${graisse} ${taille}px ${POLICE}`;
  while (taille > 12 && contexte.measureText(texte).width > largeur) {
    taille -= 1;
    contexte.font = `${graisse} ${taille}px ${POLICE}`;
  }
  return taille;
}

function dessinerOmni(toile, logo, palette) {
  const contexte = toile.getContext('2d');
  const { width: l, height: h } = toile;
  const marge = l * 0.08;
  contexte.fillStyle = palette.texte('affiche-fond');
  contexte.fillRect(0, 0, l, h);
  contexte.strokeStyle = palette.texte('affiche-cadre');
  contexte.lineWidth = 10;
  contexte.strokeRect(16, 16, l - 32, h - 32);
  // Le logo (son fond est noir, comme celui de l'affiche).
  const cote = l - 2 * marge;
  if (logo.complete && logo.naturalWidth > 0) contexte.drawImage(logo, marge, marge * 0.9, cote, cote);
  contexte.textAlign = 'center';
  contexte.textBaseline = 'middle';
  // Le nom, en grand.
  const titre = t('decor.afficheOmni.titre');
  tailleQuiTient(contexte, titre, { graisse: 700, maximum: 76, largeur: l - 2 * marge });
  contexte.fillStyle = palette.texte('affiche-titre');
  contexte.fillText(titre, l / 2, marge * 0.9 + cote + (h - marge * 0.9 - cote) * 0.38);
  // L'adresse du site, en bas.
  const adresse = adresseLisible(self.CONFIG_JEU.siteOmni);
  tailleQuiTient(contexte, adresse, { graisse: 400, maximum: 30, largeur: l - 2 * marge });
  contexte.fillStyle = palette.texte('affiche-texte');
  contexte.fillText(adresse, l / 2, h - marge * 1.4);
}

/**
 * La texture d'une affiche (data/lieux/*.json › affiches).
 *   palette     les couleurs de la 3D
 *   redessiner  appelée quand l'image change (logo ou police arrivés)
 */
export function dessinerAffiche(affiche, { palette, redessiner }) {
  const toile = document.createElement('canvas');
  toile.width = LARGEUR;
  toile.height = Math.round(LARGEUR * (affiche.haut - affiche.bas) / affiche.largeur);
  const texture = new CanvasTexture(toile);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  let liberee = false;
  const logo = new Image();
  const dessiner = () => {
    if (liberee) return;
    dessinerOmni(toile, logo, palette);
    texture.needsUpdate = true;
    redessiner?.();
  };
  texture.addEventListener('dispose', () => {
    liberee = true;
    logo.removeEventListener('load', dessiner);
  });
  logo.addEventListener('load', dessiner);
  logo.src = 'assets/logo-omni-systeme.webp';
  dessiner();
  document.fonts?.load(`700 76px ${POLICE}`).then(dessiner).catch(() => {});
  return texture;
}
