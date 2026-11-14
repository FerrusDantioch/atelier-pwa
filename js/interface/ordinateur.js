// =============================================================================
// ordinateur.js — l'ordinateur du bureau
// -----------------------------------------------------------------------------
// Une seule fenêtre, dont le contenu change d'« écran » :
//   accueil    Commandes, Visio avec Ferrus, Tes comptes ;
//   commandes  projets en cours, nouvelles commandes, commandes livrées ;
//   commande   ce que la personne demande, puis « Accepter la commande » ;
//   atelier    le mini-jeu de création (atelier.js) ;
//   visio      l'appel avec le mentor (visio.js) ;
//   comptes    l'argent, la réputation et les commandes livrées.
// Chaque écran a son titre (lu par les lecteurs d'écran en arrivant) et ses
// boutons en bas, toujours visibles ; « Retour » ramène à l'écran d'avant.
// Comme pour toute fenêtre, le temps du jeu s'arrête tant qu'elle est ouverte.
// =============================================================================

import { DRAPEAU_VISIO_ACCUEIL, accepterCommande, etatDesCommandes } from '../jeu/commandes.js';
import { progressionReputation } from '../jeu/economie.js';
import { apparenceDuJoueur, nettoyerApparence } from '../jeu/personnage.js';
import { modifierPartie, partieEnCours } from '../noyau/etat.js';
import { t, tPluriel, typographier } from '../noyau/textes.js';
import { ecranAtelier } from './atelier.js';
import { ajouter, el, identifiant, vider } from './dom.js';
import { ouvrirFenetre } from './fenetres.js';
import { icone } from './icones.js';
import { notifier } from './notifications.js';
import { ecranVisio } from './visio.js';

const TAILLE_PORTRAIT_CLIENT = { largeur: 128, hauteur: 128 };

function boutonMenu(nomIcone, texte, detail, surClic) {
  return el('li', {}, el('button', { class: 'bouton bouton-menu', type: 'button', onClick: surClic },
    icone(nomIcone), el('span', { class: 'bouton-textes' }, texte, el('span', { class: 'bouton-detail' }, detail))));
}

// La fin d'un libellé, cachée sur les petits écrans (« Tester » au lieu de
// « Tester comme Madeleine ») mais toujours lue par les lecteurs d'écran.
export function complement(texte) {
  return el('span', { class: 'complement-etroit' }, ` ${texte}`);
}

// Un encadré : icône + texte (la couleur n'est jamais la seule information).
export function encadre(nomIcone, type, ...contenu) {
  return el('div', { class: ['encadre', `encadre-${type}`] }, icone(nomIcone), el('div', {}, contenu.map((texte) => (
    typeof texte === 'string' ? el('p', {}, texte) : texte))));
}

/**
 * Ouvre l'ordinateur.
 *   donnees   toutes les données du jeu
 *   portrait  (apparence, { largeur, hauteur }) → toile 2D (ou null)
 * Au premier allumage, l'appel du mentor attend : c'est le tutoriel.
 */
export function ouvrirOrdinateur({ donnees, portrait = null, surFermeture } = {}) {
  const jeu = donnees.jeu;
  const pnjParId = new Map(donnees.pnj.pnj.map((pnj) => [pnj.id, pnj]));

  const fenetre = ouvrirFenetre({
    titre: t('ordinateur.titre'), contenu: [], large: true, boutonFermer: false, surFermeture,
  });
  fenetre.element.classList.add('fenetre-ordinateur');

  // Les boutons du bas : ceux de l'écran, puis « Fermer ».
  function pied(actions = []) {
    vider(fenetre.pied);
    const boutons = actions.map(({ texte, icone: nomIcone, principal, surClic }) => el('button', {
      class: ['bouton', principal && 'bouton-principal'], type: 'button', onClick: surClic,
    }, nomIcone ? icone(nomIcone) : null, texte));
    fenetre.pied.append(...boutons, el('button', { class: 'bouton', type: 'button', onClick: () => fenetre.fermer() }, t('commun.fermer')));
    return boutons;
  }

  // Affiche un écran ; le focus va sur son titre (ou sur « focus »).
  function montrer({ titre, contenu, actions = [], atelier = false, focus = null }) {
    const titreEcran = el('h3', { class: 'ecran-titre', tabindex: '-1' }, titre);
    ajouter(vider(fenetre.corps), [titreEcran, contenu]);
    fenetre.corps.scrollTop = 0;
    fenetre.element.classList.toggle('fenetre-atelier', atelier);
    const boutons = pied(actions);
    (focus?.(boutons) || titreEcran).focus();
    return boutons;
  }

  const ctx = {
    donnees,
    jeu,
    creation: donnees.creation,
    listeCommandes: donnees.commandes.commandes,
    paliers: jeu.reputation.paliers,
    fenetre,
    montrer,
    pied,
    montant: (n) => tPluriel('monnaie.montant', n, { singulier: jeu.monnaie.singulier, pluriel: jeu.monnaie.pluriel }),
    points: (n) => tPluriel('reputation.points', n),
    pnj: (id) => pnjParId.get(id),
    nomDe(id) {
      const pnj = pnjParId.get(id);
      return pnj?.modele === 'ferrus' ? donnees.personnages.ferrus.nom : (pnj?.nom || id);
    },
    apparenceDe(id) {
      const pnj = pnjParId.get(id);
      if (!pnj) return null;
      return pnj.modele === 'ferrus'
        ? apparenceDuJoueur({ modele: 'ferrus' }, donnees.personnages)
        : nettoyerApparence(pnj.apparence, donnees.personnages);
    },
    // Le portrait d'un personnage (une image fixe, décrite pour les lecteurs d'écran).
    portraitDe(id, taille) {
      const apparence = ctx.apparenceDe(id);
      const toile = portrait && apparence ? portrait(apparence, taille) : null;
      if (!toile) return null;
      toile.classList.add('portrait');
      toile.setAttribute('role', 'img');
      toile.setAttribute('aria-label', t('visio.portrait', { nom: ctx.nomDe(id) }));
      return toile;
    },
    etat: () => etatDesCommandes(partieEnCours(), donnees.commandes.commandes, jeu.reputation.paliers),
    cahierDesCharges,
    encadre,
    complement,
    aller: {
      accueil: ecranAccueil,
      commandes: ecranCommandes,
      commande: ecranCommande,
      atelier: (commande) => ecranAtelier(ctx, commande),
      visio: (options) => ecranVisio(ctx, options),
      comptes: ecranComptes,
    },
  };

  // --- Accueil -----------------------------------------------------------------
  function ecranAccueil() {
    const partie = partieEnCours();
    const niveau = progressionReputation(partie.reputation, ctx.paliers);
    const etat = ctx.etat();
    const details = [];
    if (etat.offres.length > 0) details.push(tPluriel('ordinateur.accueil.nouvelles', etat.offres.length));
    if (etat.enCours.length > 0) details.push(tPluriel('ordinateur.accueil.enCours', etat.enCours.length));
    montrer({
      titre: t('ordinateur.accueil.titre'),
      contenu: [
        el('p', { class: 'aide' }, t('ordinateur.accueil.etat', { argent: ctx.montant(partie.argent), niveau: niveau.niveau, nom: niveau.nom })),
        el('ul', { class: 'menu-liste' },
          boutonMenu('enveloppe', t('ordinateur.accueil.commandes'), details.join(' · ') || t('ordinateur.accueil.rien'), ecranCommandes),
          boutonMenu('visio', t('ordinateur.accueil.visio', { nom: donnees.personnages.ferrus.nom }), t('ordinateur.accueil.visioDetail'),
            () => ctx.aller.visio({})),
          boutonMenu('piece', t('ordinateur.accueil.comptes'), t('ordinateur.accueil.comptesDetail'), ecranComptes)),
      ],
    });
  }

  // --- Les commandes ---------------------------------------------------------------
  function carte(commande, { statut = null, livraison = null, recompense = false, bouton = null }) {
    const titre = typographier(commande.titre);
    return el('li', {}, el('article', { class: 'carte-commande' },
      el('div', { class: 'carte-commande-entete' },
        el('h5', {}, titre),
        el('span', { class: 'etiquette' }, t('ordinateur.commandes.fictive')),
        statut ? el('span', { class: 'etiquette etiquette-attention' }, icone('attention'), statut) : null),
      el('p', { class: 'carte-commande-client' }, t('ordinateur.commandes.de', { client: ctx.nomDe(commande.client) })),
      el('p', {}, typographier(commande.resume)),
      recompense ? el('p', { class: 'texte-doux' }, t('ordinateur.commandes.recompense', {
        argent: ctx.montant(commande.recompense.argent), reputation: ctx.points(commande.recompense.reputation),
      })) : null,
      livraison ? el('p', { class: 'carte-commande-livree' }, icone('succes'), t('ordinateur.commandes.livree', {
        note: t(`notes.${livraison.note}`), argent: ctx.montant(livraison.argent), jour: livraison.jour,
      })) : null,
      bouton ? el('button', {
        class: ['bouton', bouton.principal && 'bouton-principal'],
        type: 'button',
        'aria-label': `${bouton.texte} : ${titre}`,
        onClick: bouton.surClic,
      }, icone(bouton.icone), bouton.texte) : null));
  }

  function section(titre, cartes) {
    return el('section', { class: 'groupe-commandes' }, el('h4', {}, titre), el('ul', { class: 'liste-commandes-recues' }, cartes));
  }

  function ecranCommandes() {
    const partie = partieEnCours();
    const etat = ctx.etat();
    const contenu = [];
    if (!partie.drapeaux[DRAPEAU_VISIO_ACCUEIL]) {
      contenu.push(el('p', { class: 'aide' }, t('ordinateur.commandes.aucuneAvantVisio', { nom: donnees.personnages.ferrus.nom })));
    }
    if (etat.enCours.length > 0) {
      contenu.push(section(t('ordinateur.commandes.enCours'), etat.enCours.map(({ commande, projet }) => carte(commande, {
        statut: projet.resultat === 'aRetravailler' ? t('ordinateur.commandes.aReprendre') : null,
        bouton: { texte: t('ordinateur.commandes.reprendre'), icone: 'ordinateur', principal: true, surClic: () => ctx.aller.atelier(commande) },
      }))));
    }
    if (etat.offres.length > 0) {
      contenu.push(section(t('ordinateur.commandes.nouvelles'), etat.offres.map((commande) => carte(commande, {
        recompense: true,
        bouton: { texte: t('ordinateur.commandes.lire'), icone: 'enveloppe', surClic: () => ecranCommande(commande) },
      }))));
    } else if (partie.drapeaux[DRAPEAU_VISIO_ACCUEIL]) {
      const toutes = ctx.listeCommandes.length;
      if (etat.livrees.length === toutes) contenu.push(encadre('succes', 'succes', t('ordinateur.commandes.fini')));
      else if (etat.livrees.length + etat.enCours.length < toutes) contenu.push(el('p', { class: 'aide' }, t('ordinateur.commandes.attendre')));
    }
    if (etat.livrees.length > 0) {
      contenu.push(section(t('ordinateur.commandes.livrees'), etat.livrees.map(({ commande, livraison }) => carte(commande, { livraison }))));
    }
    montrer({
      titre: t('ordinateur.commandes.titre'),
      contenu,
      actions: [{ texte: t('ordinateur.retour'), icone: 'retour', surClic: ecranAccueil }],
    });
  }

  // Ce que demande la personne, rangé en petites listes faciles à relire.
  function cahierDesCharges(commande) {
    const liste = (titre, textes) => (textes.length === 0 ? null : el('div', { class: 'cahier-groupe' },
      el('h4', {}, titre),
      el('ul', { class: 'cahier-liste' }, textes.map((texte) => el('li', {}, typographier(texte))))));
    return el('div', { class: 'cahier' },
      liste(t('ordinateur.detail.besoins'), commande.besoins.map((b) => b.texte)),
      liste(t('ordinateur.detail.bonus'), commande.bonus.map((b) => b.texte)),
      liste(t('ordinateur.detail.aEviter'), commande.aEviter.map((b) => b.texte)),
      liste(t('ordinateur.detail.confort'), commande.confort.map((c) => c.texte)),
      Number.isInteger(commande.chargeMax) ? encadre('info', 'info', t('ordinateur.detail.chargeMax', { n: commande.chargeMax })) : null);
  }

  function ecranCommande(commande) {
    const client = ctx.nomDe(commande.client);
    const image = ctx.portraitDe(commande.client, TAILLE_PORTRAIT_CLIENT);
    montrer({
      titre: typographier(commande.titre),
      contenu: [
        el('p', { class: 'carte-commande-client' }, t('ordinateur.commandes.de', { client }), ' ',
          el('span', { class: 'etiquette' }, t('ordinateur.commandes.fictive'))),
        el('div', { class: 'demande' },
          image ? el('div', { class: 'demande-portrait' }, image) : null,
          el('div', { class: 'demande-texte' },
            el('p', { class: 'aide' }, typographier(ctx.pnj(commande.client)?.presentation || '')),
            el('p', {}, el('strong', {}, t('ordinateur.detail.demande', { client }))),
            el('blockquote', { class: 'replique' }, typographier(`« ${commande.demande} »`)))),
        cahierDesCharges(commande),
        el('p', {}, t('ordinateur.detail.recompense', {
          argent: ctx.montant(commande.recompense.argent), reputation: ctx.points(commande.recompense.reputation),
        })),
        commande.bonus.length > 0 && commande.recompense.bonus > 0
          ? el('p', { class: 'texte-doux' }, t('ordinateur.detail.recompenseBonus', { argent: ctx.montant(commande.recompense.bonus) }))
          : null,
      ],
      actions: [
        { texte: t('ordinateur.retour'), icone: 'retour', surClic: ecranCommandes },
        {
          texte: [t('ordinateur.detail.accepter'), complement(t('ordinateur.detail.accepterComplement'))],
          icone: 'coche',
          principal: true,
          surClic: () => {
            modifierPartie((partie) => { accepterCommande(partie, commande, ctx.creation); }, { important: true });
            // L'écran « Atelier » s'ouvre : son titre, lu en arrivant, suffit.
            ctx.aller.atelier(commande);
          },
        },
      ],
    });
  }

  // --- Les comptes ---------------------------------------------------------------
  function ecranComptes() {
    const partie = partieEnCours();
    const progression = progressionReputation(partie.reputation, ctx.paliers);
    const actuel = ctx.paliers.find((palier) => palier.niveau === progression.niveau);
    const etat = ctx.etat();
    const contenu = [
      el('p', { class: 'ligne-compte' }, icone('piece'), t('comptes.argent', { argent: ctx.montant(partie.argent) })),
      el('p', { class: 'ligne-compte' }, icone('etoile'), t('comptes.reputation', {
        points: ctx.points(partie.reputation), niveau: progression.niveau, nom: progression.nom,
      })),
    ];
    if (progression.suivant) {
      const id = identifiant('progression');
      contenu.push(
        el('label', { class: 'aide', for: id }, t('comptes.prochain', {
          reste: ctx.points(progression.reste), niveau: progression.suivant.niveau, nom: progression.suivant.nom,
        })),
        el('progress', {
          id, class: 'progression', max: progression.suivant.points - actuel.points, value: partie.reputation - actuel.points,
        }),
      );
    } else {
      contenu.push(el('p', { class: 'aide' }, t('comptes.maximum')));
    }
    contenu.push(el('h4', {}, t('comptes.historique')));
    contenu.push(etat.livrees.length === 0 ? el('p', { class: 'aide' }, t('comptes.aucune')) : el('ul', { class: 'liste-simple' },
      etat.livrees.map(({ commande, livraison }) => el('li', { class: 'element-liste' },
        el('p', {}, el('strong', {}, typographier(commande.titre)), ` · ${ctx.nomDe(commande.client)}`),
        el('p', { class: 'texte-doux' }, t('ordinateur.commandes.livree', {
          note: t(`notes.${livraison.note}`), argent: ctx.montant(livraison.argent), jour: livraison.jour,
        }))))));
    contenu.push(el('p', { class: 'aide' }, t('comptes.depenses')));
    montrer({
      titre: t('comptes.titre'),
      contenu,
      actions: [{ texte: t('ordinateur.retour'), icone: 'retour', surClic: ecranAccueil }],
    });
  }

  // Premier allumage : l'appel du mentor attend (le tutoriel).
  if (!partieEnCours().drapeaux[DRAPEAU_VISIO_ACCUEIL]) ctx.aller.visio({ appelEntrant: true });
  else ecranAccueil();
  return fenetre;
}
