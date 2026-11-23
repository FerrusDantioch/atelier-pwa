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
import { jouerVoix } from '../noyau/audio.js';
import { modifierPartie, partieEnCours } from '../noyau/etat.js';
import { t, typographier } from '../noyau/textes.js';
import { el, vider } from './dom.js';
import { ouvrirFenetre } from './fenetres.js';

// Une réplique : « Halaé : « … » ».
function replique(nom, texte, classe = '') {
  return el('p', { class: ['replique', classe] },
    el('strong', {}, typographier(`${nom} : `)), typographier(`« ${texte} »`));
}

/**
 * Ouvre le dialogue avec un PNJ.
 *   infos          ce que le monde sait de lui (nom…)
 *   pnj            sa fiche (data/pnj.json)
 *   creneau        son créneau de routine en cours (ou null)
 *   demande        { commande, surProposee() } si elle a une commande à présenter
 *   sujets         [{ question, replique, surDit() }] : les questions de quête
 *   obtenirActions () → { demande, sujets } : recalcule les questions après un choix
 *   surFermeture   appelée à la fin de la conversation
 */
export function ouvrirDialogue({
  infos, pnj, creneau, demande = null, sujets = [], obtenirActions = null, surFermeture,
}) {
  const partie = partieEnCours();
  const moment = { graine: partie.graine, jour: partie.temps.jour, minute: partie.temps.minute };
  const drapeau = drapeauDeRencontre(pnj);
  const accueil = repliqueDAccueil(pnj, { dejaRencontre: Boolean(partie.drapeaux[drapeau]), ...moment });
  if (accueil.premiereFois) modifierPartie((p) => { p.drapeaux[drapeau] = true; });
  jouerVoix(pnj.id);

  const fil = el('div', { class: 'dialogue-fil', 'aria-live': 'polite' }, replique(infos.nom, accueil.texte));
  const activite = repliqueDActivite(pnj, creneau, moment);
  let activitePosee = false;
  let demandeActuelle = demande;
  let sujetsActuels = [...sujets];
  let fenetre = null;

  const ajouterLignes = (...lignes) => {
    fil.append(...lignes);
    lignes[lignes.length - 1]?.scrollIntoView({ block: 'nearest' });
  };

  function bouton(texte, surClic, { principal = false } = {}) {
    return el('button', {
      class: ['bouton', principal && 'bouton-principal'],
      type: 'button',
      onClick: surClic,
    }, texte);
  }

  function actualiserBoutons({ focaliser = true } = {}) {
    const etat = obtenirActions ? obtenirActions() : { demande: demandeActuelle, sujets: sujetsActuels };
    const boutons = [];
    for (const sujet of etat.sujets || []) {
      const question = typographier(sujet.question);
      boutons.push(bouton(question, () => {
        ajouterLignes(
          replique(t('dialogue.toi'), sujet.question, 'replique-joueur'),
          replique(infos.nom, sujet.replique),
        );
        jouerVoix(pnj.id);
        if (!obtenirActions) sujetsActuels = sujetsActuels.filter((s) => s !== sujet);
        sujet.surDit();
        actualiserBoutons();
      }));
    }
    if (etat.demande) {
      const d = etat.demande;
      const question = t('dialogue.besoin');
      boutons.push(bouton(question, () => {
        ajouterLignes(
          replique(t('dialogue.toi'), question, 'replique-joueur'),
          replique(infos.nom, d.commande.demande),
          el('p', { class: 'aide' }, t('dialogue.commandeEnvoyee')),
        );
        jouerVoix(pnj.id);
        if (!obtenirActions) demandeActuelle = null;
        d.surProposee();
        actualiserBoutons();
      }));
    }
    if (activite && !activitePosee) {
      const question = t('dialogue.queFais');
      boutons.push(bouton(question, () => {
        activitePosee = true;
        ajouterLignes(
          replique(t('dialogue.toi'), question, 'replique-joueur'),
          replique(infos.nom, activite.texte),
        );
        jouerVoix(pnj.id);
        actualiserBoutons();
      }));
    }
    const fermer = bouton(t('dialogue.aPlusTard'), () => fenetre.fermer(), { principal: true });
    boutons.push(fermer);
    vider(fenetre.pied).append(...boutons);
    if (focaliser) {
      // Si une nouvelle question de quête ou commande est disponible, on la
      // propose d'abord ; sinon on rend le focus à « À plus tard ! ».
      const prioritaire = ((etat.sujets?.length || 0) > 0 || Boolean(etat.demande)) ? boutons[0] : fermer;
      prioritaire.focus();
    }
    return boutons;
  }

  fenetre = ouvrirFenetre({
    titre: infos.nom,
    contenu: [el('p', { class: 'aide' }, typographier(pnj.presentation)), fil],
    actions: [],
    boutonFermer: false,
    focus: (f) => {
      fenetre = f;
      const boutons = actualiserBoutons({ focaliser: false });
      return boutons[0] || f.titre;
    },
    surFermeture,
  });
  return fenetre;
}
