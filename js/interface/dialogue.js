// =============================================================================
// dialogue.js — parler à un personnage
// -----------------------------------------------------------------------------
// Une fenêtre comme les autres (titre, Échap, Tab qui reste dedans) : le
// temps s'arrête pendant qu'on parle. On y lit :
//   - qui est la personne (une ligne de présentation) ;
//   - ce qu'elle dit (première rencontre, puis salutation) ;
//   - puis on peut lui demander « Qu'est-ce que tu fais ? », ou lui dire
//     « À plus tard ».
// Chaque nouvelle réplique est lue par les lecteurs d'écran. Rien n'est
// dit seulement à l'oral : tout est écrit.
// =============================================================================

import { drapeauDeRencontre, repliqueDAccueil, repliqueDActivite } from '../jeu/dialogues.js';
import { modifierPartie, partieEnCours } from '../noyau/etat.js';
import { t, typographier } from '../noyau/textes.js';
import { el } from './dom.js';
import { ouvrirFenetre } from './fenetres.js';

// Une réplique : « Halaé : « … » ».
function replique(nom, texte, classe = '') {
  return el('p', { class: ['replique', classe] },
    el('strong', {}, typographier(`${nom} : `)), typographier(`« ${texte} »`));
}

/**
 * Ouvre le dialogue avec un PNJ.
 *   infos        ce que le monde sait de lui (nom…)
 *   pnj          sa fiche (data/pnj.json)
 *   creneau      son créneau de routine en cours (ou null)
 *   surFermeture appelée à la fin de la conversation
 */
export function ouvrirDialogue({ infos, pnj, creneau, surFermeture }) {
  const partie = partieEnCours();
  const moment = { graine: partie.graine, jour: partie.temps.jour, minute: partie.temps.minute };
  const drapeau = drapeauDeRencontre(pnj);
  const accueil = repliqueDAccueil(pnj, { dejaRencontre: Boolean(partie.drapeaux[drapeau]), ...moment });
  if (accueil.premiereFois) modifierPartie((p) => { p.drapeaux[drapeau] = true; });

  const fil = el('div', { class: 'dialogue-fil', 'aria-live': 'polite' }, replique(infos.nom, accueil.texte));
  const activite = repliqueDActivite(pnj, creneau, moment);

  let fenetre = null;
  const actions = [];
  if (activite) {
    actions.push({
      texte: t('dialogue.queFais'),
      surClic: (f) => {
        fil.append(
          replique(t('dialogue.toi'), t('dialogue.queFais'), 'replique-joueur'),
          replique(infos.nom, activite.texte),
        );
        // La question est posée : le bouton disparaît, le focus va à « À plus tard ».
        const boutons = [...f.pied.querySelectorAll('button')];
        boutons[0].remove();
        boutons[boutons.length - 1].focus();
        return false;
      },
    });
  }
  actions.push({ texte: t('dialogue.aPlusTard'), principal: true, fermer: true });

  fenetre = ouvrirFenetre({
    titre: infos.nom,
    contenu: [el('p', { class: 'aide' }, typographier(pnj.presentation)), fil],
    actions,
    boutonFermer: false,
    focus: (f) => f.pied.querySelector('button'),
    surFermeture,
  });
  return fenetre;
}
