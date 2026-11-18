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
  tournerGauche: [['path', { d: 'M5.5 9.5a7.5 7.5 0 1 1 1.8 8.2' }], ['path', { d: 'M4.5 4.5v5h5' }]],
  tournerDroite: [['path', { d: 'M18.5 9.5a7.5 7.5 0 1 0-1.8 8.2' }], ['path', { d: 'M19.5 4.5v5h-5' }]],
  zoomPlus: [['circle', { cx: 10.5, cy: 10.5, r: 6.5 }], ['path', { d: 'M15.5 15.5L20.5 20.5M10.5 7.8v5.4M7.8 10.5h5.4' }]],
  zoomMoins: [['circle', { cx: 10.5, cy: 10.5, r: 6.5 }], ['path', { d: 'M15.5 15.5L20.5 20.5M7.8 10.5h5.4' }]],
  recentrer: [['circle', { cx: 12, cy: 12, r: 4.5 }], ['circle', { cx: 12, cy: 12, r: 1.2, fill: 'currentColor' }], ['path', { d: 'M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4' }]],
  allerA: [['path', { d: 'M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z' }], ['circle', { cx: 12, cy: 10, r: 2.4 }]],
  examiner: [['path', { d: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z' }], ['circle', { cx: 12, cy: 12, r: 3 }]],
  personnage: [['circle', { cx: 12, cy: 7.5, r: 3.5 }], ['path', { d: 'M5 20.5c0-4 3-6.5 7-6.5s7 2.5 7 6.5' }]],
  clavier: [['rect', { x: 2.5, y: 6, width: 19, height: 12, rx: 2 }], ['path', { d: 'M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M7.5 14h9' }]],
  retour: [['path', { d: 'M10 6l-6 6 6 6M4 12h16' }]],
  hasard: [
    ['rect', { x: 4, y: 4, width: 16, height: 16, rx: 3 }],
    ['circle', { cx: 9, cy: 9, r: 1.3, fill: 'currentColor' }],
    ['circle', { cx: 15, cy: 15, r: 1.3, fill: 'currentColor' }],
    ['circle', { cx: 15, cy: 9, r: 1.3, fill: 'currentColor' }],
    ['circle', { cx: 9, cy: 15, r: 1.3, fill: 'currentColor' }],
  ],
  lieu: [['path', { d: 'M4 11l8-7 8 7M6 9.5V20h12V9.5' }], ['path', { d: 'M10 20v-5h4v5' }]],
  lune: [['path', { d: 'M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z' }]],
  parler: [['path', { d: 'M4 5.5h16v10H10l-4.5 3.5v-3.5H4z' }], ['path', { d: 'M8 9.5h8M8 12.5h5' }]],
  // Jalon 3 : l'ordinateur, les commandes, la visio et les fonctions des applications.
  ordinateur: [['rect', { x: 3, y: 4, width: 18, height: 12, rx: 2 }], ['path', { d: 'M9 20h6M12 16v4' }]],
  enveloppe: [['rect', { x: 3, y: 5.5, width: 18, height: 13, rx: 2 }], ['path', { d: 'M3.5 7l8.5 6.5L20.5 7' }]],
  visio: [['rect', { x: 2.5, y: 6.5, width: 13, height: 11, rx: 2 }], ['path', { d: 'M15.5 10.5l6-3.5v10l-6-3.5z' }]],
  livrer: [['path', { d: 'M4 8l8-4 8 4v8l-8 4-8-4z' }], ['path', { d: 'M4 8l8 4 8-4M12 12v8' }]],
  cloche: [['path', { d: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z' }], ['path', { d: 'M10 20.5a2 2 0 0 0 4 0' }]],
  vibration: [['rect', { x: 8, y: 4, width: 8, height: 16, rx: 2 }], ['path', { d: 'M4.5 9v6M19.5 9v6M2 10.5v3M22 10.5v3' }]],
  calendrier: [['rect', { x: 4, y: 5.5, width: 16, height: 14.5, rx: 2 }], ['path', { d: 'M4 10h16M8.5 3.5v4M15.5 3.5v4' }]],
  graphique: [['path', { d: 'M4 4v16h16' }], ['path', { d: 'M8 16v-4M12 16V8M16 16v-6' }]],
  cadenas: [['rect', { x: 5, y: 11, width: 14, height: 9.5, rx: 2 }], ['path', { d: 'M8 11V8a4 4 0 0 1 8 0v3' }]],
  // Jalon 4 : le journal des quêtes, et la fonction « Sous-titres ».
  journal: [['path', { d: 'M5 4.5h11a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2z' }], ['path', { d: 'M5 18a2 2 0 0 1 2-2h11M9 8.5h5M9 11.5h5' }]],
  sousTitres: [['rect', { x: 3, y: 5, width: 18, height: 14, rx: 2 }], ['path', { d: 'M7 13.5h6M15 13.5h2M7 16h10' }]],
  // Jalon 5 : la boutique et l'aménagement.
  boutique: [['path', { d: 'M5 8.5h14l-1.2 11.5H6.2z' }], ['path', { d: 'M9 10.5V7a3 3 0 0 1 6 0v3.5' }]],
  amenager: [
    ['path', { d: 'M5 11V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2' }],
    ['path', { d: 'M3.5 12.5a1.5 1.5 0 0 1 3 0V14h11v-1.5a1.5 1.5 0 0 1 3 0V18h-17z' }],
    ['path', { d: 'M5.5 18v2M18.5 18v2' }],
  ],
  pivoter: [['path', { d: 'M19 12a7 7 0 1 1-2.05-4.95' }], ['path', { d: 'M19.5 4v4.5H15' }]],
  ranger: [['path', { d: 'M4 8l8-4 8 4v8.5l-8 4-8-4z' }], ['path', { d: 'M4 8l8 4 8-4M12 12v8.5' }]],
  flecheHaut: [['path', { d: 'M12 19V5M6 11l6-6 6 6' }]],
  flecheBas: [['path', { d: 'M12 5v14M6 13l6 6 6-6' }]],
  flecheGauche: [['path', { d: 'M19 12H5M11 6l-6 6 6 6' }]],
  flecheDroite: [['path', { d: 'M5 12h14M13 6l6 6-6 6' }]],
  cle: [['circle', { cx: 8, cy: 12, r: 4 }], ['path', { d: 'M12 12h9M18 12v3M21 12v2' }]],
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
