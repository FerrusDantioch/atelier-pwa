// =============================================================================
// lumieres.js — l'éclairage des scènes
// -----------------------------------------------------------------------------
// Deux lumières seulement (c'est léger) :
//   - une lumière « ciel / sol » douce, partout ;
//   - un « soleil » qui vient d'en haut à gauche de l'écran : les faces
//     tournées vers lui sont plus claires, les autres un peu plus sombres. Il
//     tourne avec la caméra, pour que la scène garde le même relief sous
//     tous les angles.
// Pas d'ombres calculées (trop lourdes pour une tablette).
// Le réglage « Luminosité de la scène » fait varier leur force.
// =============================================================================

import { DirectionalLight, Group, HemisphereLight } from '../../lib/three/three.module.js';

const FORCES = { douce: 0.8, normale: 1, vive: 1.22 };

export function creerLumieres() {
  const groupe = new Group();
  groupe.name = 'lumieres';
  const ciel = new HemisphereLight(0xfff8ee, 0x7d7094, 2.1);
  const soleil = new DirectionalLight(0xfff1dc, 1.7);
  groupe.add(ciel, soleil);
  let luminosite = 'normale';
  let azimut = Math.PI / 4;

  function placerSoleil() {
    // Un peu à gauche de la caméra, assez haut.
    const angle = azimut - Math.PI / 3;
    const hauteur = 1.25;
    soleil.position.set(Math.sin(angle), hauteur, Math.cos(angle));
  }

  function appliquer() {
    const force = FORCES[luminosite] || 1;
    ciel.intensity = 2.1 * force;
    soleil.intensity = 1.7 * force;
  }

  placerSoleil();
  appliquer();

  return {
    groupe,
    regler({ luminosite: nouvelle, azimut: nouvelAzimut } = {}) {
      if (nouvelle) luminosite = nouvelle;
      if (typeof nouvelAzimut === 'number') azimut = nouvelAzimut;
      placerSoleil();
      appliquer();
    },
  };
}
