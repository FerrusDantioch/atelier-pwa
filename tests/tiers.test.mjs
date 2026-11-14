// Tests : les fichiers d'autres auteurs (Three.js, polices) n'ont pas été
// modifiés, et chacun est crédité avec sa licence.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { RACINE, lire, tousLesFichiers } from './aides.mjs';

const licences = lire('licences-tierces.txt');
const empreintes = [...licences.matchAll(/^([0-9a-f]{64}) {2}(\S+)$/gm)].map((m) => ({ attendue: m[1], chemin: m[2] }));

test('les empreintes de licences-tierces.txt correspondent aux fichiers', () => {
  assert.ok(empreintes.length > 0, 'aucune empreinte trouvée');
  for (const { attendue, chemin } of empreintes) {
    const reelle = createHash('sha256').update(readFileSync(join(RACINE, chemin))).digest('hex');
    assert.equal(reelle, attendue, `${chemin} a été modifié (ou mettre à jour avec outils/embarquer-tiers.mjs)`);
  }
});

test('chaque fichier tiers est crédité avec son empreinte', () => {
  const credites = new Set(empreintes.map((e) => e.chemin));
  const tiers = tousLesFichiers().filter((f) => f.startsWith('lib/') || f.startsWith('assets/polices/'));
  for (const fichier of tiers) assert.ok(credites.has(fichier), `${fichier} absent de licences-tierces.txt`);
});

test('les licences des tiers sont présentes', () => {
  assert.match(lire('lib/three/LICENSE'), /The MIT License/);
  assert.match(lire('assets/polices/LICENCE-Atkinson-Hyperlegible-Next.txt'), /SIL OPEN FONT LICENSE/i);
  assert.match(lire('assets/polices/LICENCE-OpenDyslexic.txt'), /SIL OPEN FONT LICENSE/i);
});
