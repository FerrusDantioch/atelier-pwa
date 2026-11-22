// =============================================================================
// progression.js — faire avancer les quêtes, et le dire
// -----------------------------------------------------------------------------
// Les règles sont dans js/jeu/quetes.js ; ce module les applique à la partie
// en cours, au bon moment :
//   - après un changement de la partie (commande livrée, appel du mentor…),
//     un instant plus tard, une seule fois même si plusieurs changements
//     arrivent d'un coup ;
//   - tout de suite quand un geste du joueur fait une étape (poser une
//     question, s'approcher de la télévision…).
// Ce qui s'est passé est annoncé en un seul message : les lecteurs d'écran
// le lisent en entier (deux messages d'affilée, ils ne liraient que le
// second).
// =============================================================================

import { empreinteDesQuetes, faireEtape, mettreAJourQuetes } from '../jeu/quetes.js';
import { jouerEffet } from '../noyau/audio.js';
import { ecouter } from '../noyau/evenements.js';
import { modifierPartie, partieEnCours, sauvegarderMaintenant } from '../noyau/etat.js';
import { t, tPluriel } from '../noyau/textes.js';
import { notifier } from './notifications.js';

let contexte = null; // { quetes, paliers, jeu }
let derniereEmpreinte = null;
let prevue = null;

/**
 * Démarre le suivi des quêtes pour l'écran de jeu. Renvoie arreter().
 *   donnees : toutes les données du jeu (quêtes, jeu.json…)
 */
export function demarrerProgression(donnees) {
  contexte = { quetes: donnees.quetes.quetes, paliers: donnees.jeu.reputation.paliers, jeu: donnees.jeu };
  derniereEmpreinte = null;
  const arrets = [
    ecouter('partie:modifiee', planifier),
    ecouter('partie:chargee', () => {
      derniereEmpreinte = null;
      planifier();
    }),
  ];
  planifier();
  return () => {
    arrets.forEach((arreter) => arreter());
    clearTimeout(prevue);
    prevue = null;
    contexte = null;
  };
}

// Une vérification un instant plus tard (après la fenêtre qui s'ouvre…).
function planifier() {
  if (prevue || !contexte) return;
  prevue = setTimeout(() => {
    prevue = null;
    progresserQuetes();
  }, 0);
}

/**
 * Fait avancer les quêtes maintenant. Renvoie ce qui s'est passé (voir
 * quetes.js › mettreAJourQuetes).
 *   geste    { quete, etape } : le joueur vient de faire cette étape
 *   annoncer false : ne rien afficher (l'appelant le dit lui-même, avec
 *            messageDesQuetes(), par exemple dans la fenêtre de livraison)
 */
export function progresserQuetes({ geste = null, annoncer = true } = {}) {
  const partie = partieEnCours();
  if (!partie || !contexte) return [];
  if (!geste && empreinteDesQuetes(partie) === derniereEmpreinte) return [];
  const evenements = [];
  modifierPartie((p) => {
    if (geste) evenements.push(...faireEtape(p, geste.quete, geste.etape, contexte.paliers));
    evenements.push(...mettreAJourQuetes(p, contexte.quetes, contexte.paliers));
  });
  derniereEmpreinte = empreinteDesQuetes(partieEnCours());
  if (evenements.length > 0) {
    sauvegarderMaintenant();
    const queteFinie = evenements.some((e) => e.type === 'finie');
    if (annoncer) {
      if (queteFinie) jouerEffet('quete', { calme: true });
      notifier(messageDesQuetes(evenements), { type: queteFinie ? 'succes' : 'info' });
    }
  }
  return evenements;
}

const montant = (n) => tPluriel('monnaie.montant', n, {
  singulier: contexte.jeu.monnaie.singulier, pluriel: contexte.jeu.monnaie.pluriel,
});
const points = (n) => tPluriel('reputation.points', n);

/**
 * Les phrases qui racontent ce qui s'est passé, dans l'ordre :
 * [{ texte, icone, type }] (une étape faite, une quête finie et ses gains,
 * une nouvelle quête). L'étape qui termine une quête n'est pas répétée.
 */
export function phrasesDesQuetes(evenements) {
  const finies = new Set(evenements.filter((e) => e.type === 'finie').map((e) => e.quete.id));
  const phrases = [];
  for (const evenement of evenements) {
    const { quete } = evenement;
    if (evenement.type === 'etape' && !finies.has(quete.id)) {
      const cle = evenement.etape.facultative ? 'quetes.etapeFacultative' : 'quetes.etape';
      phrases.push({ texte: t(cle, { etape: evenement.etape.texte }), icone: 'coche', type: 'succes' });
    } else if (evenement.type === 'finie') {
      const gains = quete.recompense.argent > 0 || quete.recompense.reputation > 0
        ? ` ${t('quetes.gains', { argent: montant(quete.recompense.argent), reputation: points(quete.recompense.reputation) })}`
        : '';
      phrases.push({ texte: `${t('quetes.finie', { titre: quete.titre })}${gains}`, icone: 'succes', type: 'succes' });
      if (evenement.niveauApres > evenement.niveauAvant) {
        phrases.push({ texte: t('livraison.niveau', { niveau: evenement.niveauApres, nom: evenement.nomNiveau }), icone: 'etoile', type: 'succes' });
      }
    } else if (evenement.type === 'nouvelle') {
      phrases.push({ texte: t('quetes.nouvelle', { titre: quete.titre }), icone: 'journal', type: 'info' });
    }
  }
  return phrases;
}

// Les mêmes phrases, en un seul texte (pour une notification).
export function messageDesQuetes(evenements) {
  return phrasesDesQuetes(evenements).map((phrase) => phrase.texte).join(' ');
}
