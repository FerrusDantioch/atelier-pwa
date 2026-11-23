// =============================================================================
// atelier.js — le mini-jeu de création, sur l'écran de l'ordinateur
// -----------------------------------------------------------------------------
// Trois étapes, sans chronomètre, dans l'ordre qu'on veut :
//   1. le modèle (liste, agenda, minuteur…) ;
//   2. les fonctions (rappels, vibration…), avec la jauge de « charge » ;
//   3. le confort (taille du texte, contraste, police…).
// L'aperçu (un téléphone) change à chaque choix. « Tester comme … » montre
// ce qu'en pense la personne ; « Livrer » donne la note : Parfait, Bien ou
// À retravailler (avec explications). Rien n'est jamais perdu : le projet
// est enregistré à chaque choix, et un projet à retravailler reste tel quel.
// Les règles sont dans js/jeu/creation.js (testées à part).
// =============================================================================

import { commandesAProposer, idsDesOffres, livrerProjet, nouvellesOffres } from '../jeu/commandes.js';
import { bonusDuMateriel } from '../jeu/boutique.js';
import { capaciteDuProjet, chargeDuProjet, evaluerProjet, nettoyerProjet } from '../jeu/creation.js';
import { DRAPEAU_TEXTE_AGRANDI } from '../jeu/quetes.js';
import { jouerEffet } from '../noyau/audio.js';
import { modifierPartie, partieEnCours } from '../noyau/etat.js';
import { t, typographier } from '../noyau/textes.js';
import { el, identifiant, vider } from './dom.js';
import { ouvrirFenetre } from './fenetres.js';
import { icone } from './icones.js';
import { phrasesDesQuetes, progresserQuetes } from './progression.js';

// L'état de la jauge, en mots (jamais seulement par la couleur).
function etatDeCharge(charge, capacite, tolerance) {
  if (capacite === null) return null;
  if (charge > capacite + tolerance) return 'trop';
  if (charge > capacite) return 'unPeu';
  if (charge * 2 <= capacite) return 'legere';
  return 'equilibree';
}

// Une carte à choisir (modèle : bouton radio ; fonction : case à cocher).
function carteChoix({ type, nom, valeur, coche, titre, texte, note, nomIcone, surChangement }) {
  const entree = el('input', {
    class: 'option-entree', type, name: nom, value: valeur, checked: coche,
    onChange: (evenement) => surChangement(evenement.target.checked),
  });
  return el('label', { class: 'carte-modele carte-choix' }, entree,
    el('span', { class: 'carte-modele-contenu' },
      el('span', { class: 'carte-modele-titre' }, icone('coche', 'option-coche'), nomIcone ? icone(nomIcone) : null, typographier(titre)),
      el('span', { class: 'carte-modele-texte' }, typographier(texte)),
      note ? el('span', { class: 'carte-modele-note' }, note) : null));
}

// Ce que la personne dit de chaque critère (voir creation.js › evaluerProjet).
const ETIQUETTES = { ok: 'succes', mineur: 'attention', bloquant: 'erreur', bonus: 'etoile', absent: 'plus' };
const ORDRE = { bloquant: 0, mineur: 1, ok: 2, bonus: 3, absent: 4 };

export function listeDesAvis(ctx, commande, evaluation, { seulementProblemes = false } = {}) {
  const { creation } = ctx;
  const client = ctx.nomDe(commande.client);
  const nomFonction = (id) => typographier(creation.fonctions.find((f) => f.id === id)?.nom || id);
  const nomModele = (id) => typographier(creation.modeles.find((m) => m.id === id)?.nom || id);
  const reglage = (id) => creation.confort.find((r) => r.id === id);

  function texte(critere) {
    switch (critere.sorte) {
      case 'modele': return t('test.modele');
      case 'besoin': return critere.etat === 'ok'
        ? t('test.besoinOk', { texte: critere.texte })
        : t('test.besoinManque', { texte: critere.texte });
      case 'eviter': return t('test.eviter', {
        texte: critere.texte,
        source: critere.source.type === 'modele' ? nomModele(critere.source.id) : nomFonction(critere.source.id),
      });
      case 'confort': {
        const r = reglage(critere.reglage);
        const valeur = r?.valeurs.find((v) => v.id === critere.choisi)?.nom || critere.choisi;
        return critere.etat === 'ok'
          ? t('test.confortOk', { reglage: r?.nom || critere.reglage, valeur: valeur.toLowerCase() })
          : t('test.confortManque', { texte: critere.texte, reglage: r?.nom || critere.reglage, valeur: valeur.toLowerCase() });
      }
      case 'inutile': return critere.avis
        ? t('test.inutileAvis', { fonction: nomFonction(critere.fonction), avis: critere.avis })
        : t('test.inutile', { fonction: nomFonction(critere.fonction), client });
      case 'charge': return t({ ok: 'test.chargeOk', mineur: 'test.chargeUnPeu', bloquant: 'test.chargeTrop' }[critere.etat], {
        charge: critere.charge, capacite: critere.capacite, client,
      });
      case 'bonus': return critere.etat === 'ok'
        ? t('test.bonusOk', { texte: critere.texte })
        : t('test.bonusAbsent', { texte: critere.texte });
      default: return '';
    }
  }

  const avis = evaluation.criteres
    .map((critere) => ({ critere, cle: critere.sorte === 'bonus' ? (critere.etat === 'ok' ? 'bonus' : 'absent') : critere.etat }))
    .filter(({ cle }) => !seulementProblemes || cle === 'bloquant' || cle === 'mineur')
    .sort((a, b) => ORDRE[a.cle] - ORDRE[b.cle]);
  return el('ul', { class: 'liste-avis' }, avis.map(({ critere, cle }) => el('li', { class: ['avis', `avis-${cle}`] },
    icone(ETIQUETTES[cle]),
    el('span', { class: 'avis-etiquette' }, t(`test.etiquettes.${cle}`)),
    el('span', { class: 'avis-texte' }, texte(critere)))));
}

const TYPES_DE_NOTE = { parfait: 'succes', bien: 'info', aRetravailler: 'attention' };

export function ecranAtelier(ctx, commande) {
  const { creation } = ctx;
  const client = ctx.nomDe(commande.client);
  const tolerance = creation.bareme.toleranceCharge;
  const lireProjet = () => partieEnCours().commandes.enCours[commande.id];
  if (!lireProjet()) {
    ctx.aller.commandes();
    return;
  }
  // Un projet propre (rien d'inconnu venu d'une ancienne sauvegarde).
  modifierPartie((partie) => {
    partie.commandes.enCours[commande.id] = nettoyerProjet(partie.commandes.enCours[commande.id], creation);
  });
  const projet = lireProjet();

  // Chaque choix est rangé aussitôt dans la partie (sauvegarde automatique).
  function changer(modification) {
    modifierPartie((partie) => modification(partie.commandes.enCours[commande.id]));
    rafraichir();
  }

  // --- 1. Le modèle ---------------------------------------------------------------
  const modeles = el('fieldset', { class: 'reglage atelier-modeles' },
    el('legend', {}, t('atelier.modele')),
    el('p', { class: 'aide' }, t('atelier.modeleAide')),
    el('div', { class: 'cartes-modele' }, creation.modeles.map((modele) => carteChoix({
      type: 'radio',
      nom: 'atelier-modele',
      valeur: modele.id,
      coche: projet.modele === modele.id,
      titre: modele.nom,
      texte: modele.description,
      note: t('atelier.capacite', { n: modele.capacite }),
      surChangement: () => changer((p) => { p.modele = modele.id; }),
    }))));

  // --- 2. Les fonctions -------------------------------------------------------------
  const ordreFonctions = new Map(creation.fonctions.map((fonction, index) => [fonction.id, index]));
  const fonctions = el('fieldset', { class: 'reglage atelier-fonctions' },
    el('legend', {}, t('atelier.fonctions')),
    el('p', { class: 'aide' }, t('atelier.fonctionsAide')),
    el('div', { class: 'cartes-modele' }, creation.fonctions.map((fonction) => carteChoix({
      type: 'checkbox',
      nom: 'atelier-fonctions',
      valeur: fonction.id,
      coche: projet.fonctions.includes(fonction.id),
      titre: fonction.nom,
      texte: fonction.description,
      note: t('atelier.charge', { n: fonction.charge }),
      nomIcone: fonction.icone,
      surChangement: (coche) => changer((p) => {
        const choisies = new Set(p.fonctions);
        if (coche) choisies.add(fonction.id);
        else choisies.delete(fonction.id);
        p.fonctions = [...choisies].sort((a, b) => ordreFonctions.get(a) - ordreFonctions.get(b));
      }),
    }))));

  // --- 3. Le confort ----------------------------------------------------------------
  const confort = el('section', { class: 'atelier-confort' },
    el('h4', {}, t('atelier.confort')),
    el('p', { class: 'aide' }, t('atelier.confortAide')),
    creation.confort.map((reglage) => el('fieldset', { class: 'reglage' },
      el('legend', {}, reglage.nom),
      el('div', { class: 'options' }, reglage.valeurs.map((valeur) => el('label', { class: 'option' },
        el('input', {
          class: 'option-entree',
          type: 'radio',
          name: `atelier-confort-${reglage.id}`,
          value: valeur.id,
          checked: projet.confort[reglage.id] === valeur.id,
          onChange: () => {
            changer((p) => { p.confort[reglage.id] = valeur.id; });
            // Un texte plus grand essayé : une étape (facultative) de la quête de bienvenue.
            if (reglage.id === 'texte' && valeur.id !== reglage.defaut && !partieEnCours().drapeaux[DRAPEAU_TEXTE_AGRANDI]) {
              modifierPartie((partie) => { partie.drapeaux[DRAPEAU_TEXTE_AGRANDI] = true; });
            }
          },
        }),
        el('span', { class: 'option-contenu' }, icone('coche', 'option-coche'), valeur.nom)))))));

  // --- L'aperçu et la jauge --------------------------------------------------------------
  const idApercu = identifiant('apercu');
  // Deux jauges identiques : celle de l'aperçu (lue par les lecteurs d'écran),
  // et un bandeau qui reste en haut de l'écran quand l'aperçu est plus bas
  // (téléphone, tablette en hauteur).
  const jaugeTexte = el('p', { class: 'jauge-texte', 'aria-live': 'polite' });
  const bandeauTexte = el('p', { class: 'jauge-texte' });
  const barreDeJauge = () => {
    const remplissageBarre = el('span', { class: 'jauge-remplissage' });
    const repereBarre = el('span', { class: 'jauge-repere' });
    return { element: el('div', { class: 'jauge-barre', 'aria-hidden': 'true' }, remplissageBarre, repereBarre), remplissage: remplissageBarre, repere: repereBarre };
  };
  const barres = [barreDeJauge(), barreDeJauge()];
  const bandeau = el('div', { class: 'atelier-bandeau', 'aria-hidden': 'true' }, bandeauTexte, barres[1].element);
  const ecranApp = el('div', { class: 'apercu-ecran' });
  const resume = el('p', { class: 'visuellement-cache' });
  const apercu = el('aside', { class: 'atelier-apercu', 'aria-labelledby': idApercu },
    el('h4', { id: idApercu }, t('atelier.apercu')),
    el('div', { class: 'jauge' }, jaugeTexte, barres[0].element),
    el('div', { class: 'apercu-telephone', 'aria-hidden': 'true' }, ecranApp),
    resume);

  let derniereJauge = null;

  function rafraichir() {
    const actuel = nettoyerProjet(lireProjet(), creation);
    const modele = creation.modeles.find((m) => m.id === actuel.modele) || null;
    const choisies = actuel.fonctions.map((id) => creation.fonctions.find((f) => f.id === id));
    const charge = chargeDuProjet(actuel, creation);
    const capacite = capaciteDuProjet(actuel, commande, creation);
    const etat = etatDeCharge(charge, capacite, tolerance);

    // La jauge : la charge, et un trait à la limite de ce que l'appli supporte.
    const valeur = etat
      ? t('atelier.jaugeValeur', { charge, capacite, etat: t(`atelier.etats.${etat}`) })
      : t('atelier.jaugeSansModele');
    if (valeur !== derniereJauge) {
      derniereJauge = valeur;
      for (const texte of [jaugeTexte, bandeauTexte]) texte.replaceChildren(el('strong', {}, `${t('atelier.jauge')} : `), valeur);
    }
    const maximum = Math.max((capacite ?? 0) + tolerance + 1, charge, 1);
    for (const { remplissage, repere } of barres) {
      remplissage.style.width = `${Math.min(100, (charge / maximum) * 100)}%`;
      remplissage.dataset.etat = etat || 'aucun';
      repere.hidden = capacite === null;
      if (capacite !== null) repere.style.left = `${(capacite / maximum) * 100}%`;
    }

    // L'aperçu : l'application telle que la personne la verra.
    ecranApp.className = ['apercu-ecran',
      ...creation.confort.map((reglage) => `apercu-${reglage.id}-${actuel.confort[reglage.id]}`),
      modele && `apercu-modele-${modele.id}`].filter(Boolean).join(' ');
    vider(ecranApp);
    if (!modele) {
      ecranApp.append(el('p', { class: 'apercu-vide' }, t('atelier.apercuSansModele')));
      resume.textContent = t('atelier.apercuSansModele');
      return;
    }
    const lignes = commande.apercu?.[modele.id] || modele.apercu;
    ecranApp.append(
      el('p', { class: 'apercu-barre' }, typographier(commande.titre)),
      el('ul', { class: 'apercu-lignes' }, lignes.map((ligne) => el('li', {},
        modele.id === 'liste' ? el('span', { class: 'apercu-case' }) : null, typographier(ligne)))),
      ...choisies.map((fonction) => el('p', { class: 'apercu-fonction' }, icone(fonction.icone || 'plus'), typographier(fonction.apercu))),
    );
    resume.textContent = t('atelier.apercuResume', {
      modele: modele.nom,
      fonctions: choisies.map((fonction) => fonction.nom).join(', ') || t('atelier.apercuSansFonction'),
    });
  }

  // --- Tester, livrer --------------------------------------------------------------------
  function verdict(evaluation) {
    const note = t(`notes.${evaluation.note}`);
    return ctx.encadre(TYPES_DE_NOTE[evaluation.note], TYPES_DE_NOTE[evaluation.note],
      el('p', {}, el('strong', {}, t('test.verdict', { note }))),
      evaluation.note === 'aRetravailler' ? null : el('p', {}, t('test.gains', {
        argent: ctx.montant(evaluation.recompense.argent), reputation: ctx.points(evaluation.recompense.reputation),
      }), partMateriel(evaluation)));
  }

  // « Dont 10 pièces grâce à ton matériel. » (jalon 5), ou rien.
  function partMateriel(evaluation) {
    const materiel = evaluation.recompense.materiel || 0;
    return materiel > 0 ? ` ${t('boutique.dontMateriel', { argent: ctx.montant(materiel) })}` : '';
  }

  // L'évaluation, avec les pièces en plus du matériel installé (jalon 5).
  function evaluer() {
    const bonusMateriel = ctx.donnees.boutique ? bonusDuMateriel(partieEnCours(), ctx.donnees.boutique) : 0;
    return evaluerProjet(lireProjet(), commande, creation, { bonusMateriel });
  }

  function tester() {
    const evaluation = evaluer();
    ouvrirFenetre({
      titre: t('test.titre', { client }),
      contenu: el('div', { class: 'resultat-livraison' }, verdict(evaluation), listeDesAvis(ctx, commande, evaluation)),
      boutonFermer: false,
      actions: [{ texte: t('test.retour'), icone: 'retour', principal: true, fermer: true }],
    });
  }

  function livrer() {
    const evaluation = evaluer();
    const avant = idsDesOffres(partieEnCours(), ctx.listeCommandes, ctx.paliers);
    const aProposerAvant = new Set(commandesAProposer(partieEnCours(), ctx.listeCommandes, ctx.paliers).map((c) => c.id));
    let resultat = null;
    modifierPartie((partie) => { resultat = livrerProjet(partie, commande, evaluation, ctx.paliers); }, { important: true });
    if (!resultat) return;
    const effets = { parfait: 'livraisonParfaite', bien: 'livraisonBien', aRetravailler: 'livraisonARetravailler' };
    jouerEffet(effets[evaluation.note]);
    // Les quêtes avancent tout de suite : on le dit dans cette fenêtre.
    const evenementsQuetes = resultat.livree ? progresserQuetes({ annoncer: false }) : [];
    const contenu = [el('p', { class: 'replique' },
      el('strong', {}, typographier(`${client} : `)), typographier(`« ${commande.reactions[evaluation.note]} »`))];
    if (resultat.livree) {
      contenu.push(ctx.encadre('piece', 'succes', t('livraison.gains', {
        argent: ctx.montant(evaluation.recompense.argent), reputation: ctx.points(evaluation.recompense.reputation),
      }) + partMateriel(evaluation)));
      if (resultat.niveauApres > resultat.niveauAvant) {
        contenu.push(ctx.encadre('etoile', 'succes', t('livraison.niveau', { niveau: resultat.niveauApres, nom: resultat.nomNiveau })));
      }
      const apres = idsDesOffres(partieEnCours(), ctx.listeCommandes, ctx.paliers);
      for (const offre of nouvellesOffres(avant, apres, ctx.listeCommandes)) {
        contenu.push(ctx.encadre('enveloppe', 'info', t('livraison.nouvelle', { client: ctx.nomDe(offre.client), titre: offre.titre })));
      }
      // Quelqu'un veut présenter sa commande de vive voix (Halaé, Théo).
      for (const aProposer of commandesAProposer(partieEnCours(), ctx.listeCommandes, ctx.paliers)) {
        if (!aProposerAvant.has(aProposer.id)) {
          contenu.push(ctx.encadre('parler', 'info', t('livraison.aProposer', { client: ctx.nomDe(aProposer.client) })));
        }
      }
      for (const phrase of phrasesDesQuetes(evenementsQuetes)) contenu.push(ctx.encadre(phrase.icone, phrase.type, phrase.texte));
    } else {
      contenu.push(
        ctx.encadre('info', 'info', t('livraison.garde')),
        el('h3', { class: 'titre-remarques' }, t('test.remarques', { client })),
        listeDesAvis(ctx, commande, evaluation, { seulementProblemes: true }),
      );
    }
    ouvrirFenetre({
      titre: t(`livraison.titres.${evaluation.note}`),
      contenu: el('div', { class: 'resultat-livraison' }, contenu),
      boutonFermer: false,
      actions: [{
        texte: resultat.livree ? t('livraison.continuer') : t('test.retour'),
        icone: resultat.livree ? 'coche' : 'retour',
        principal: true,
        fermer: true,
      }],
      surFermeture: () => {
        if (resultat.livree && partieEnCours() && ctx.fenetre.element.open) ctx.aller.commandes();
      },
    });
  }

  ctx.montrer({
    titre: t('atelier.titre', { titre: typographier(commande.titre) }),
    atelier: true,
    contenu: [
      el('p', { class: 'carte-commande-client' }, t('atelier.pour', { client }), ' ',
        el('span', { class: 'etiquette' }, t('ordinateur.commandes.fictive'))),
      el('details', { class: 'rappel-commande' },
        el('summary', {}, t('atelier.relire')),
        el('blockquote', { class: 'replique' }, typographier(`« ${commande.demande} »`)),
        ctx.cahierDesCharges(commande)),
      bandeau,
      el('div', { class: 'atelier-grille' }, modeles, fonctions, apercu, confort),
      el('p', { class: 'aide' }, t('atelier.enregistre')),
    ],
    actions: [
      { texte: t('ordinateur.retour'), icone: 'retour', surClic: () => ctx.aller.commandes() },
      { texte: [t('atelier.tester'), ctx.complement(t('atelier.testerComplement', { client }))], icone: 'examiner', surClic: tester },
      { texte: t('atelier.livrer'), icone: 'livrer', principal: true, surClic: livrer },
    ],
  });
  rafraichir();
}
