// =============================================================================
// icones.js — les petites icônes de l'interface, dessinées par code
// -----------------------------------------------------------------------------
// Des traits simples, de la couleur du texte : elles suivent donc tous les
// thèmes, le contraste élevé et les modes daltoniens. Une icône n'est jamais
// seule : elle accompagne toujours un mot (ou un nom lu par les lecteurs
// d'écran pour les boutons sans texte visible).
// =============================================================================

const SVG = 'http://www.w3.org/2000/svg';

// Chaque icône : une liste de formes [balise, attributs], dans un carré 24 × 24.
const DESSINS = {
  piece: [['circle', { cx: 12, cy: 12, r: 9 }], ['circle', { cx: 12, cy: 12, r: 5 }]],
  etoile: [['path', { d: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z' }]],
  horloge: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7v5l3.5 2' }]],
  cible: [['circle', { cx: 12, cy: 12, r: 9 }], ['circle', { cx: 12, cy: 12, r: 5 }], ['circle', { cx: 12, cy: 12, r: 1.5, fill: 'currentColor' }]],
  pause: [['path', { d: 'M9 6v12M15 6v12', 'stroke-width': 3 }]],
  reglages: [
    ['path', { d: 'M4 6h16M4 12h16M4 18h16' }],
    ['circle', { cx: 9, cy: 6, r: 2.2, fill: 'currentColor' }],
    ['circle', { cx: 15, cy: 12, r: 2.2, fill: 'currentColor' }],
    ['circle', { cx: 7, cy: 18, r: 2.2, fill: 'currentColor' }],
  ],
  info: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 11v6' }], ['circle', { cx: 12, cy: 7.5, r: 1.2, fill: 'currentColor' }]],
  aide: [
    ['circle', { cx: 12, cy: 12, r: 9 }],
    ['path', { d: 'M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8v.5' }],
    ['circle', { cx: 12, cy: 17, r: 1.1, fill: 'currentColor' }],
  ],
  sauvegarde: [['path', { d: 'M5 4h11l3 3v13H5z' }], ['path', { d: 'M8 4v5h7V4M8 20v-6h8v6' }]],
  exporter: [['path', { d: 'M12 15V4M7.5 8.5L12 4l4.5 4.5M4 14v6h16v-6' }]],
  importer: [['path', { d: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M4 14v6h16v-6' }]],
  copies: [['rect', { x: 8, y: 8, width: 12, height: 12, rx: 2 }], ['path', { d: 'M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3' }]],
  fermer: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
  jouer: [['path', { d: 'M8 5l11 7-11 7z' }]],
  plus: [['path', { d: 'M12 5v14M5 12h14' }]],
  maison: [['path', { d: 'M4 11l8-7 8 7M6 9.5V20h12V9.5' }]],
  son: [['path', { d: 'M4 9h4l5-4v14l-5-4H4z' }], ['path', { d: 'M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11' }]],
  sonCoupe: [['path', { d: 'M4 9h4l5-4v14l-5-4H4z' }], ['path', { d: 'M16.5 9.5l5 5M21.5 9.5l-5 5' }]],
  coche: [['path', { d: 'M5 12.5l4.5 4.5L19 7.5', 'stroke-width': 2.6 }]],
  attention: [['path', { d: 'M12 3.5l9 16.5H3z' }], ['path', { d: 'M12 10v4.5' }], ['circle', { cx: 12, cy: 17.2, r: 1.1, fill: 'currentColor' }]],
  erreur: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M9 9l6 6M15 9l-6 6' }]],
  succes: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M8 12.5l2.8 2.8L16.5 9.5' }]],
  installer: [['rect', { x: 7, y: 3, width: 10, height: 18, rx: 2 }], ['path', { d: 'M12 7.5v6M9.5 11l2.5 2.5 2.5-2.5' }]],
  recharger: [['path', { d: 'M20 12a8 8 0 1 1-2.4-5.7' }], ['path', { d: 'M20 4v4.5h-4.5' }]],
  lienExterne: [['path', { d: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6' }]],
  calme: [['path', { d: 'M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0' }]],
};

// Renvoie une icône <svg>, cachée aux lecteurs d'écran (le mot à côté suffit).
export function icone(nom, classe = '') {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `icone ${classe}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const [balise, attributs] of DESSINS[nom] || DESSINS.info) {
    const forme = document.createElementNS(SVG, balise);
    for (const [cle, valeur] of Object.entries(attributs)) forme.setAttribute(cle, String(valeur));
    svg.append(forme);
  }
  return svg;
}
