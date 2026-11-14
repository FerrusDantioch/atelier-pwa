// =============================================================================
// visio.js — l'appel en visio avec le mentor, sur l'écran de l'ordinateur
// -----------------------------------------------------------------------------
// Au premier allumage de l'ordinateur, Ferrus appelle : c'est le tutoriel,
// réplique après réplique (« Suivant »), à son rythme. À la fin de l'appel,
// la première commande (d'essai) arrive. Ensuite, on peut le rappeler quand
// on veut : un conseil adapté à la situation, ou revoir les explications.
//
// Si l'on joue Ferrus, le mentor est « le vrai Ferrus, depuis le monde
// réel » (décision de Ferrus). Ses répliques sont dans data/pnj.json (visio).
// Tout est écrit : rien ne passe seulement par le son ou l'image.
// =============================================================================

import { DRAPEAU_VISIO_ACCUEIL, idsDesOffres, nouvellesOffres } from '../jeu/commandes.js';
import { nomDuJoueur } from '../jeu/personnage.js';
import { modifierPartie, partieEnCours } from '../noyau/etat.js';
import { remplir, t, typographier } from '../noyau/textes.js';
import { el } from './dom.js';
import { icone } from './icones.js';
import { notifier } from './notifications.js';

const TAILLE_VISIO = { largeur: 320, hauteur: 240 };

function replique(nom, texte, classe = '') {
  return el('p', { class: ['replique', classe] }, el('strong', {}, typographier(`${nom} : `)), typographier(`« ${texte} »`));
}

export function ecranVisio(ctx, { appelEntrant = false } = {}) {
  const { donnees } = ctx;
  const mentor = donnees.pnj.pnj.find((pnj) => pnj.visio);
  const visio = mentor.visio;
  const nom = ctx.nomDe(mentor.id);
  const partie = partieEnCours();
  const joueurFerrus = partie.joueur?.modele === 'ferrus';

  const image = ctx.portraitDe(mentor.id, TAILLE_VISIO);
  const cadre = el('figure', { class: 'visio-cadre' },
    image || el('div', { class: 'visio-sans-image' }, icone('visio')),
    el('figcaption', {}, t(joueurFerrus ? 'visio.enDirect' : 'visio.enVisio', { nom })));

  if (appelEntrant) {
    ctx.montrer({
      titre: t('visio.appelEntrant', { nom }),
      contenu: [el('p', { class: 'aide' }, t('visio.appelEntrantAide')), el('div', { class: 'visio' }, cadre)],
      actions: [
        { texte: t('visio.plusTard'), surClic: () => ctx.aller.accueil() },
        { texte: t('visio.decrocher'), icone: 'visio', principal: true, surClic: () => ecranVisio(ctx) },
      ],
      focus: (boutons) => boutons[1],
    });
    return;
  }

  const fil = el('div', { class: 'dialogue-fil', 'aria-live': 'polite' });
  function ajouterLigne(ligne) {
    fil.append(ligne);
    ligne.scrollIntoView({ block: 'nearest' });
  }
  const dire = (texte) => ajouterLigne(replique(nom, texte));

  // La fin du premier appel : la commande d'essai arrive sur l'ordinateur.
  function finDuPremierAppel() {
    const commandes = ctx.listeCommandes;
    const avant = idsDesOffres(partieEnCours(), commandes, ctx.paliers);
    modifierPartie((p) => { p.drapeaux[DRAPEAU_VISIO_ACCUEIL] = true; }, { important: true });
    const nouvelles = nouvellesOffres(avant, idsDesOffres(partieEnCours(), commandes, ctx.paliers), commandes);
    ctx.aller.accueil();
    for (const offre of nouvelles) {
      notifier(t('livraison.nouvelle', { client: ctx.nomDe(offre.client), titre: offre.titre }), { type: 'info' });
    }
  }

  function raccrocher() {
    if (!partieEnCours().drapeaux[DRAPEAU_VISIO_ACCUEIL]) {
      finDuPremierAppel();
      return;
    }
    ctx.aller.accueil();
    notifier(typographier(`${nom} : « ${visio.auRevoir} »`), { type: 'info' });
  }

  // Les explications, une réplique à la fois (« Suivant »), puis « surFin ».
  function expliquer(lignes, surFin) {
    let index = 0;
    dire(lignes[index]);
    const etape = () => {
      if (index < lignes.length - 1) {
        const [suivant] = ctx.pied([{ texte: t('visio.suivant'), principal: true, surClic: avancer }]);
        return suivant;
      }
      return surFin();
    };
    function avancer() {
      index += 1;
      dire(lignes[index]);
      etape()?.focus();
    }
    return etape();
  }

  // Les conseils : d'abord celui qui colle à la situation, puis les autres.
  let prochainConseil = 0;
  function conseils() {
    const etat = ctx.etat();
    const liste = [];
    if (etat.enCours.some((element) => element.projet.resultat === 'aRetravailler')) liste.push(...visio.conseils.aRetravailler);
    else if (etat.enCours.length > 0) liste.push(...visio.conseils.enCours);
    else if (etat.offres.length > 0) liste.push(...visio.conseils.offres);
    const general = visio.conseils.general;
    const decalage = (partieEnCours().temps.jour - 1) % general.length;
    return [...liste, ...general.slice(decalage), ...general.slice(0, decalage)];
  }

  function boutonsHabituels() {
    return ctx.pied([
      {
        texte: t('visio.conseil'),
        icone: 'aide',
        surClic: () => {
          const liste = conseils();
          ajouterLigne(replique(t('dialogue.toi'), t('visio.conseil'), 'replique-joueur'));
          dire(liste[prochainConseil % liste.length]);
          prochainConseil += 1;
        },
      },
      {
        texte: [t('visio.revoir'), ctx.complement(t('visio.revoirComplement'))],
        icone: 'recharger',
        surClic: () => expliquer(visio.tutoriel, boutonsHabituels)?.focus(),
      },
      { texte: t('visio.raccrocher'), icone: 'fermer', principal: true, surClic: raccrocher },
    ])[0];
  }

  const premiereFois = !partie.drapeaux[DRAPEAU_VISIO_ACCUEIL];
  ctx.montrer({
    titre: t('visio.titre', { nom }),
    contenu: [el('div', { class: 'visio' }, cadre, fil)],
  });
  if (premiereFois) {
    const accueil = joueurFerrus
      ? visio.accueil.joueurFerrus
      : remplir(visio.accueil.autre, { nom: nomDuJoueur(partie.joueur, donnees.personnages) });
    expliquer([accueil, ...visio.tutoriel], () => ctx.pied([
      { texte: t('visio.raccrocher'), icone: 'fermer', principal: true, surClic: raccrocher },
    ])[0])?.focus();
  } else {
    dire(mentor.repliques?.salut?.[0] || visio.auRevoir);
    boutonsHabituels().focus();
  }
}
