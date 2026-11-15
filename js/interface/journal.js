// =============================================================================
// journal.js — le journal des quêtes
// -----------------------------------------------------------------------------
// Une fenêtre (bouton « Journal » en bas, touche J, ou Pause › Journal) :
//   - les quêtes en cours : de qui elles viennent, leur principe
//     d'accessibilité, leurs étapes (faites, à faire maintenant, ensuite,
//     facultatives) et leur récompense ;
//   - les quêtes terminées, avec leur fin et ce qu'elles ont rapporté.
// On y choisit la quête « suivie » (son étape s'affiche en haut de l'écran),
// et « Y aller » emmène là où se joue une étape.
// Chaque statut est écrit en toutes lettres (jamais seulement une couleur).
// Comme toute fenêtre, le journal arrête le temps tant qu'il est ouvert.
// =============================================================================

import { destinationDEtape, etapesDeQuete, objectifDeQuete } from '../jeu/quetes.js';
import { modifierPartie, partieEnCours } from '../noyau/etat.js';
import { t, tPluriel, typographier } from '../noyau/textes.js';
import { ajouter, el, identifiant, vider } from './dom.js';
import { ouvrirFenetre } from './fenetres.js';
import { icone } from './icones.js';
import { notifier } from './notifications.js';
import { complement, encadre } from './ordinateur.js';

const majuscule = (texte) => texte.charAt(0).toLocaleUpperCase('fr') + texte.slice(1);

// Le statut d'une étape : sa clé de texte (journal.statuts.*), son icône et
// sa classe CSS.
function statutDe({ etape, faite, ouverte }) {
  if (faite) return etape.facultative ? ['facultativeFaite', 'coche', 'faite'] : ['faite', 'coche', 'faite'];
  if (etape.facultative) return ['facultative', 'plus', 'facultative'];
  return ouverte ? ['maintenant', 'cible', 'maintenant'] : ['ensuite', 'horloge', 'ensuite'];
}

/**
 * Ouvre le journal.
 *   donnees   toutes les données du jeu
 *   nomDe     (id) → nom d'une personne
 *   surAller  (id) → emmène le personnage là où se joue une étape
 */
export function ouvrirJournal({ donnees, nomDe, surAller }) {
  const { quetes, principes } = donnees.quetes;
  const commandes = donnees.commandes.commandes;
  const paliers = donnees.jeu.reputation.paliers;
  const { monnaie } = donnees.jeu;
  const montant = (n) => tPluriel('monnaie.montant', n, { singulier: monnaie.singulier, pluriel: monnaie.pluriel });
  const points = (n) => tPluriel('reputation.points', n);
  const titres = new Map();
  let fenetre = null;

  function suivre(quete) {
    modifierPartie((partie) => { partie.quetes.suivie = quete.id; });
    notifier(t('journal.nouvelleSuivie', { titre: quete.titre }), { type: 'info' });
    afficher(quete.id);
  }

  function yAller(quete, destination) {
    if (partieEnCours().quetes.actives[quete.id] && partieEnCours().quetes.suivie !== quete.id) {
      modifierPartie((partie) => { partie.quetes.suivie = quete.id; });
    }
    fenetre.fermer();
    surAller(destination);
  }

  // Les étapes, dans l'ordre, chacune avec son statut écrit.
  function listeDesEtapes(quete, partie) {
    const lignes = etapesDeQuete(quete, partie, paliers);
    const objectif = objectifDeQuete(partie, { quetes, commandes, paliers }, quete.id);
    return el('ol', { class: 'etapes-quete' }, lignes.map((ligne) => {
      const [cle, nomIcone, classe] = statutDe(ligne);
      const texte = typographier(majuscule(ligne.etape.texte));
      const destination = ligne.ouverte ? destinationDEtape(ligne.etape, commandes) : null;
      // Pour l'étape en cours : où en est la commande (« lis la commande… »).
      const precision = objectif?.etape === ligne.etape && objectif.cle
        ? t(`objectifs.${objectif.cle}`, { client: nomDe(objectif.commande.client) })
        : null;
      return el('li', { class: ['etape-quete', `etape-${classe}`] },
        el('span', { class: 'etape-statut' }, icone(nomIcone), t(`journal.statuts.${cle}`)),
        el('span', { class: 'etape-texte' }, texte),
        ligne.ouverte && ligne.etape.detail ? el('p', { class: 'aide' }, typographier(ligne.etape.detail)) : null,
        precision ? el('p', { class: 'aide' }, icone('cible'), majuscule(precision)) : null,
        destination ? el('button', {
          class: 'bouton', type: 'button', 'aria-label': `${t('journal.yAller')} : ${texte}`, onClick: () => yAller(quete, destination),
        }, icone('allerA'), t('journal.yAller')) : null);
    }));
  }

  function enTete(quete, etiquette = null) {
    const id = identifiant('quete');
    const titre = el('h4', { id, tabindex: '-1' }, typographier(quete.titre));
    titres.set(quete.id, titre);
    return {
      id,
      element: el('div', { class: 'carte-quete-entete' }, titre, etiquette),
      donneur: el('p', { class: 'carte-quete-donneur' }, t('journal.deLaPart', { nom: nomDe(quete.donneur) })),
    };
  }

  function carteEnCours(quete, partie) {
    const suivie = partie.quetes.suivie === quete.id;
    const principe = principes[quete.principe];
    const entete = enTete(quete, suivie ? el('span', { class: 'etiquette' }, icone('cible'), t('journal.etiquetteSuivie')) : null);
    return el('li', {}, el('article', { class: ['carte-quete', suivie && 'carte-quete-suivie'], 'aria-labelledby': entete.id },
      entete.element,
      entete.donneur,
      el('p', {}, typographier(quete.resume)),
      el('p', { class: 'carte-quete-principe' },
        el('strong', {}, t('journal.principe', { nom: principe.nom })), ' ', typographier(principe.explication)),
      el('h5', {}, t('journal.etapes')),
      listeDesEtapes(quete, partie),
      el('p', { class: 'texte-doux' }, t('journal.recompense', {
        argent: montant(quete.recompense.argent), reputation: points(quete.recompense.reputation),
      })),
      suivie
        ? el('p', { class: 'carte-quete-suivie-texte' }, icone('cible'), t('journal.suivie'))
        : el('button', { class: 'bouton', type: 'button', onClick: () => suivre(quete) },
          icone('cible'), el('span', {}, t('journal.suivre'), complement(t('journal.suivreComplement'))))));
  }

  function carteTerminee(quete, partie) {
    const entete = enTete(quete, el('span', { class: 'etiquette' }, icone('coche'), t('journal.etiquetteTerminee')));
    // Les étapes facultatives encore possibles.
    const restantes = etapesDeQuete(quete, partie, paliers).filter((ligne) => ligne.ouverte);
    return el('li', {}, el('article', { class: 'carte-quete carte-quete-terminee', 'aria-labelledby': entete.id },
      entete.element,
      entete.donneur,
      el('p', {}, typographier(quete.fin)),
      el('p', { class: 'texte-doux' }, t('journal.obtenue', {
        argent: montant(quete.recompense.argent), reputation: points(quete.recompense.reputation),
      })),
      restantes.length > 0 ? el('h5', {}, t('journal.encorePossible')) : null,
      restantes.length > 0 ? listeDesEtapes({ ...quete, etapes: restantes.map((ligne) => ligne.etape) }, partie) : null));
  }

  function contenu() {
    const partie = partieEnCours();
    titres.clear();
    // La quête suivie d'abord, puis les autres dans l'ordre du fichier.
    const enCours = quetes.filter((quete) => partie.quetes.actives[quete.id])
      .sort((a, b) => Number(b.id === partie.quetes.suivie) - Number(a.id === partie.quetes.suivie));
    const terminees = [...partie.quetes.finies].reverse()
      .map((id) => quetes.find((quete) => quete.id === id)).filter(Boolean);
    const blocs = [el('p', { class: 'aide' }, t('journal.intro')), el('h3', {}, t('journal.enCours'))];
    if (enCours.length > 0) blocs.push(el('ul', { class: 'liste-quetes' }, enCours.map((quete) => carteEnCours(quete, partie))));
    else if (terminees.length === quetes.length) blocs.push(encadre('succes', 'succes', t('journal.toutesFinies')));
    else blocs.push(el('p', {}, t(terminees.length === 0 ? 'journal.aucune' : 'journal.aucuneEnCours')));
    if (terminees.length > 0) {
      blocs.push(el('h3', {}, t('journal.terminees')),
        el('ul', { class: 'liste-quetes' }, terminees.map((quete) => carteTerminee(quete, partie))));
    }
    return blocs;
  }

  function afficher(focusSur = null) {
    ajouter(vider(fenetre.corps), contenu());
    if (focusSur) titres.get(focusSur)?.focus();
  }

  fenetre = ouvrirFenetre({ titre: t('journal.titre'), contenu: [], large: true });
  fenetre.element.classList.add('fenetre-journal');
  afficher();
  return fenetre;
}
