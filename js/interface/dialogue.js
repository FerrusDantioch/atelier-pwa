// =============================================================================
// dialogue.js — parler à un personnage
// -----------------------------------------------------------------------------
// Une fenêtre comme les autres (titre, Échap, Tab qui reste dedans) : le
// temps s'arrête pendant qu'on parle. On y lit :
//   - qui est la personne (une ligne de présentation) ;
//   - ce qu'elle dit (première rencontre, puis salutation) ;
//   - puis on peut lui demander « Qu'est-ce que tu fais ? », ou lui dire
//     « À plus tard » ;
//   - si une quête attend qu'on lui parle, sa question est proposée
//     (« Alors, cette application ? ») : la personne répond, l'étape est faite ;
//   - si la personne a une commande à présenter de vive voix (Halaé, Théo),
//     on peut lui demander « Tu as besoin d'une application ? » : elle
//     explique sa demande, qui arrive ensuite sur l'ordinateur.
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
 *   demande      { commande, surProposee() } si elle a une commande à présenter
 *   sujets       [{ question, replique, surDit() }] : les questions de quête
 *   surFermeture appelée à la fin de la conversation
 */
export function ouvrirDialogue({ infos, pnj, creneau, demande = null, sujets = [], surFermeture }) {
  const partie = partieEnCours();
  const moment = { graine: partie.graine, jour: partie.temps.jour, minute: partie.temps.minute };
  const drapeau = drapeauDeRencontre(pnj);
  const accueil = repliqueDAccueil(pnj, { dejaRencontre: Boolean(partie.drapeaux[drapeau]), ...moment });
  if (accueil.premiereFois) modifierPartie((p) => { p.drapeaux[drapeau] = true; });

  const fil = el('div', { class: 'dialogue-fil', 'aria-live': 'polite' }, replique(infos.nom, accueil.texte));
  const activite = repliqueDActivite(pnj, creneau, moment);

  let fenetre = null;
  const actions = [];
  // Une question posée : son bouton disparaît, le focus va à « À plus tard ».
  const questionPosee = (f, texte) => {
    [...f.pied.querySelectorAll('button')].find((bouton) => bouton.textContent === texte)?.remove();
    const restants = [...f.pied.querySelectorAll('button')];
    restants[restants.length - 1].focus();
  };
  for (const sujet of sujets) {
    const question = typographier(sujet.question);
    actions.push({
      texte: question,
      surClic: (f) => {
        fil.append(
          replique(t('dialogue.toi'), sujet.question, 'replique-joueur'),
          replique(infos.nom, sujet.replique),
        );
        sujet.surDit();
        questionPosee(f, question);
        return false;
      },
    });
  }
  if (demande) {
    const question = t('dialogue.besoin');
    actions.push({
      texte: question,
      surClic: (f) => {
        fil.append(
          replique(t('dialogue.toi'), question, 'replique-joueur'),
          replique(infos.nom, demande.commande.demande),
          el('p', { class: 'aide' }, t('dialogue.commandeEnvoyee')),
        );
        demande.surProposee();
        questionPosee(f, question);
        return false;
      },
    });
  }
  if (activite) {
    const question = t('dialogue.queFais');
    actions.push({
      texte: question,
      surClic: (f) => {
        fil.append(
          replique(t('dialogue.toi'), question, 'replique-joueur'),
          replique(infos.nom, activite.texte),
        );
        questionPosee(f, question);
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
