// =============================================================================
// amenagement.js — le mode « Aménager » : poser les meubles achetés
// -----------------------------------------------------------------------------
// On y entre par Pause › Aménager ce lieu, par « Placer maintenant » après un
// achat, ou en touchant l'objectif d'une quête qui le demande. Pendant
// l'aménagement, le temps est arrêté et un panneau remplace la barre du bas :
//   - sans meuble choisi : « Tes affaires » (les meubles rangés) et
//     « Terminer » ; toucher un meuble acheté le reprend pour le déplacer ;
//   - avec un meuble choisi : le toucher du sol (ou les flèches) le déplace,
//     « Tourner », « Poser ici », « Ranger » (s'il était posé) et « Annuler ».
// À chaque position, la place est vérifiée (js/jeu/amenagement.js) : le
// panneau dit en toutes lettres si c'est possible, et sinon pourquoi. Ce
// texte est aussi lu par les lecteurs d'écran.
// =============================================================================

import {
  coinDepuisMilieu, meublesPoses, meublesRanges, milieuDepuisCoin, placeDe, placesDesHabitants, poserMeuble,
  retirerMeuble, ROTATIONS, trouverPlace, verifierPlacement,
} from '../jeu/amenagement.js';
import { PREFIXE_ACHAT } from '../jeu/boutique.js';
import { profilDeDeplacement } from '../monde/grille.js';
import { apparenceDuJoueur } from '../jeu/personnage.js';
import { modifierPartie, partieEnCours } from '../noyau/etat.js';
import { t, typographier } from '../noyau/textes.js';
import { el, vider } from './dom.js';
import { icone } from './icones.js';
import { direAuxLecteurs, notifier } from './notifications.js';
import { messageDesQuetes, progresserQuetes } from './progression.js';

const majuscule = (texte) => texte.charAt(0).toLocaleUpperCase('fr') + texte.slice(1);

/**
 * Prépare le mode « Aménager ».
 *   donnees   toutes les données du jeu
 *   monde()   le monde 3D affiché
 *   surDebut() / surFin()   l'écran de jeu cache ou remontre sa barre du bas
 * Renvoie { element, ouvrir({ achat }), fermer(), actif, surTouche(evenement) }.
 */
export function creerAmenagement({ donnees, monde, surDebut, surFin }) {
  const catalogue = () => monde().catalogueDeBase;
  let actif = false;
  let selection = null; // { id, meuble, rotation, milieu, origine, resultat }

  const titre = el('h2', { class: 'amenagement-titre', id: 'amenagement-titre' });
  const statut = el('p', { class: 'amenagement-statut', id: 'amenagement-statut', 'aria-live': 'polite' });
  const corps = el('div', { class: 'amenagement-corps' });
  const element = el('section', { class: 'panneau-amenagement', 'aria-labelledby': 'amenagement-titre', hidden: true },
    el('div', { class: 'amenagement-tete' }, titre, statut), corps);

  // --- Ce qu'il faut savoir pour vérifier une place --------------------------------
  const designation = (idMeuble) => {
    const meuble = catalogue().get(idMeuble);
    return meuble?.designation || meuble?.nom || idMeuble;
  };
  const possession = (id) => partieEnCours().possessions.find((p) => p.id === id) || null;

  function contexteDeVerification(id) {
    const partie = partieEnCours();
    const m = monde();
    const lieu = m.lieuOuvert;
    const apparence = apparenceDuJoueur(partie.joueur, donnees.personnages);
    const ici = m.case;
    return {
      lieu,
      catalogue: catalogue(),
      poses: meublesPoses(partie, lieu.id).filter((place) => place.id !== id),
      occupants: m.casesOccupees(),
      habitants: placesDesHabitants(lieu, donnees.pnj.pnj, donnees.personnages, m.ouvertes),
      joueur: { x: ici.x, z: ici.z, profil: profilDeDeplacement(apparence.aide) },
    };
  }

  // La même place, avec toutes les pièces du lieu ouvertes : un meuble posé
  // aujourd'hui ne doit pas bloquer la porte d'une pièce qui s'ouvrira demain.
  function verifierPourPlusTard(place) {
    const m = monde();
    const complet = m.lieuComplet;
    if (complet === m.lieuOuvert) return { ok: true };
    return verifierPlacement({
      lieu: complet,
      catalogue: catalogue(),
      poses: meublesPoses(partieEnCours(), complet.id).filter((p) => p.id !== place.id),
      place,
      habitants: placesDesHabitants(complet, donnees.pnj.pnj, donnees.personnages),
    });
  }

  // La raison d'un refus, en toutes lettres.
  function raison(resultat) {
    const cle = `amenagement.raisons.${resultat.raison}`;
    switch (resultat.raison) {
      case 'chevauche': return t(cle, { objet: resultat.designation });
      case 'personne': return resultat.joueur ? t('amenagement.raisons.joueur') : t(cle, { nom: resultat.nom });
      case 'acces': return t(resultat.profil === 'pieton' ? 'amenagement.raisons.accesPieton' : 'amenagement.raisons.accesFauteuil',
        { objet: resultat.designation });
      case 'arrivee':
      case 'demiTour': return t(cle, { objet: resultat.designation });
      case 'place': return t(cle, { nom: resultat.nom });
      default: return t(cle);
    }
  }

  // --- La place du meuble choisi ---------------------------------------------------
  function placeChoisie() {
    const meuble = catalogue().get(selection.meuble);
    const coin = coinDepuisMilieu(meuble, selection.rotation, selection.milieu);
    return { id: selection.id, meuble: selection.meuble, x: coin.x, z: coin.z, rotation: selection.rotation };
  }

  // Vérifie la place, montre le meuble, et dit si c'est possible.
  function verifierEtMontrer() {
    const place = placeChoisie();
    let resultat = verifierPlacement({ ...contexteDeVerification(selection.id), place });
    if (resultat.ok) resultat = verifierPourPlusTard(place);
    selection.resultat = resultat;
    monde().montrerFantome({ meuble: place.meuble, x: place.x, z: place.z, rotation: place.rotation, valide: resultat.ok });
    const nom = majuscule(designation(place.meuble));
    const piece = monde().grille.piece(selection.milieu.x, selection.milieu.z);
    const nomPiece = monde().lieuOuvert.pieces.find((p) => p.id === piece)?.designation || monde().lieuOuvert.designation;
    const texte = resultat.ok
      ? t('amenagement.possible', { meuble: nom, piece: nomPiece })
      : t('amenagement.impossible', { meuble: nom, raison: raison(resultat) });
    statut.textContent = typographier(texte);
  }

  // --- Les boutons -------------------------------------------------------------------
  // Sur un petit écran (panneau « compact »), les boutons secondaires ne
  // gardent que leur icône : leur nom reste lu par les lecteurs d'écran, et
  // s'affiche en bulle d'aide.
  let boutonPoser = null;
  const bouton = (nomIcone, texte, surClic, { principal = false, seulementIcone = false } = {}) => el('button', {
    class: ['bouton', principal && 'bouton-principal', seulementIcone && 'bouton-icone'],
    type: 'button',
    'aria-label': seulementIcone ? texte : null,
    title: principal ? null : texte,
    onClick: surClic,
  }, icone(nomIcone), seulementIcone ? null : el('span', { class: 'libelle-bouton' }, texte));

  // Le panneau sans meuble choisi : les affaires et « Terminer ».
  function afficherAffaires(message = null) {
    selection = null;
    boutonPoser = null;
    monde().cacherFantome();
    const ranges = meublesRanges(partieEnCours());
    // Un bouton par sorte de meuble (« Cactus × 2 »).
    const parArticle = new Map();
    for (const p of ranges) {
      if (!catalogue().has(p.article)) continue;
      if (!parArticle.has(p.article)) parArticle.set(p.article, []);
      parArticle.get(p.article).push(p);
    }
    const boutons = [...parArticle.entries()].map(([article, liste]) => {
      const nom = catalogue().get(article).nom;
      const texte = liste.length > 1 ? t('amenagement.nombre', { nom, n: liste.length }) : nom;
      return el('li', {}, bouton('plus', texte, () => choisir(liste[0].id)));
    });
    vider(corps).append(
      boutons.length > 0
        ? el('div', { class: 'amenagement-affaires' },
          el('h3', { class: 'amenagement-sous-titre' }, t('amenagement.affaires')),
          el('ul', { class: 'liste-affaires' }, boutons))
        : null,
      el('div', { class: 'amenagement-actions' }, bouton('coche', t('amenagement.boutons.terminer'), () => fermer(), { principal: true })),
    );
    statut.textContent = typographier(message || (boutons.length > 0 ? t('amenagement.choisir') : t('amenagement.aucun')));
  }

  // Le panneau avec un meuble choisi.
  function afficherCommandes() {
    const fleche = (nomIcone, cle, droite, haut) => bouton(nomIcone, t(`amenagement.boutons.${cle}`), () => {
      const pas = monde().pasVersEcran(droite, haut);
      if (pas) deplacer(pas.dx, pas.dz);
    }, { seulementIcone: true });
    boutonPoser = bouton('coche', t('amenagement.boutons.poser'), () => poser(), { principal: true });
    boutonPoser.setAttribute('aria-describedby', 'amenagement-statut');
    vider(corps).append(
      el('div', { class: 'amenagement-fleches', role: 'group', 'aria-label': t('amenagement.boutons.deplacer') },
        fleche('flecheGauche', 'gauche', -1, 0), fleche('flecheHaut', 'haut', 0, 1),
        fleche('flecheBas', 'bas', 0, -1), fleche('flecheDroite', 'droite', 1, 0)),
      el('div', { class: 'amenagement-actions' },
        bouton('pivoter', t('amenagement.boutons.tourner'), () => tourner()),
        selection.origine ? bouton('ranger', t('amenagement.boutons.ranger'), () => ranger()) : null,
        bouton('fermer', t('amenagement.boutons.annuler'), () => annuler())),
      el('div', { class: 'amenagement-poser' }, boutonPoser),
    );
  }

  // --- Les gestes -----------------------------------------------------------------------
  // Choisir un meuble (rangé, ou posé : il est alors repris pour le déplacer).
  function choisir(id) {
    const achat = possession(id);
    if (!achat || !catalogue().has(achat.article)) return;
    const posee = placeDe(partieEnCours(), id);
    const meuble = catalogue().get(achat.article);
    let milieu;
    let rotation = 0;
    let origine = null;
    if (posee && posee.lieu === monde().lieuOuvert.id) {
      origine = { x: posee.place.x, z: posee.place.z, rotation: posee.place.rotation };
      rotation = posee.place.rotation;
      milieu = milieuDepuisCoin(meuble, rotation, posee.place);
      // Le meuble est retiré du lieu le temps de le déplacer.
      modifierPartie((partie) => retirerMeuble(partie, id));
      monde().actualiserLieu();
    } else {
      // Un meuble rangé : la place libre la plus proche du personnage.
      const ici = monde().case;
      const trouvee = trouverPlace({ ...contexteDeVerification(id), place: { id, meuble: achat.article }, depuis: ici });
      milieu = trouvee ? milieuDepuisCoin(meuble, trouvee.rotation, trouvee) : { ...ici };
      rotation = trouvee?.rotation ?? 0;
    }
    selection = { id, meuble: achat.article, rotation, milieu, origine, resultat: null };
    afficherCommandes();
    verifierEtMontrer();
    boutonPoser?.focus();
  }

  function deplacer(dx, dz) {
    if (!selection) return;
    const [largeur, profondeur] = monde().lieuOuvert.taille;
    selection.milieu = {
      x: Math.min(largeur - 1, Math.max(0, selection.milieu.x + dx)),
      z: Math.min(profondeur - 1, Math.max(0, selection.milieu.z + dz)),
    };
    verifierEtMontrer();
  }

  function allerA(caseVisee) {
    if (!selection || !caseVisee) return;
    selection.milieu = { x: caseVisee.x, z: caseVisee.z };
    verifierEtMontrer();
  }

  function tourner() {
    if (!selection) return;
    selection.rotation = ROTATIONS[(ROTATIONS.indexOf(selection.rotation) + 1) % ROTATIONS.length];
    verifierEtMontrer();
  }

  // Poser le meuble, si la place convient (sinon, la raison est redite).
  function poser() {
    if (!selection) return;
    if (!selection.resultat?.ok) {
      verifierEtMontrer();
      direAuxLecteurs(statut.textContent);
      return;
    }
    const place = placeChoisie();
    const deplace = Boolean(selection.origine);
    modifierPartie((partie) => poserMeuble(partie, monde().lieuOuvert.id, place), { important: true });
    monde().actualiserLieu();
    const message = [
      t(deplace ? 'amenagement.deplace' : 'amenagement.pose', { meuble: designation(place.meuble) }),
      messageDesQuetes(progresserQuetes({ annoncer: false })),
    ].filter(Boolean).join(' ');
    afficherAffaires(message);
    focusSurPremier();
  }

  // Ranger un meuble qui était posé : il retourne dans les affaires.
  function ranger() {
    if (!selection) return;
    const { meuble } = selection;
    // Il a déjà été retiré du lieu en le choisissant : rien d'autre à faire.
    modifierPartie(() => {}, { important: true });
    afficherAffaires(t('amenagement.range', { meuble: designation(meuble) }));
    focusSurPremier();
  }

  // Annuler : un meuble qui était posé reprend sa place, un meuble rangé le reste.
  function annuler() {
    if (!selection) return;
    const { origine, id, meuble } = selection;
    let message = null;
    if (origine) {
      modifierPartie((partie) => poserMeuble(partie, monde().lieuOuvert.id, { id, ...origine }), { important: true });
      monde().actualiserLieu();
      message = t('amenagement.remis', { meuble: majuscule(designation(meuble)) });
    }
    afficherAffaires(message);
    focusSurPremier();
  }

  function focusSurPremier() {
    corps.querySelector('button')?.focus();
  }

  // Le doigt dans la scène : déplacer le meuble choisi, ou en choisir un.
  function surToucher({ id, case: caseVisee, sousLaCase }) {
    if (selection) {
      allerA(caseVisee);
      return;
    }
    const achete = [id, ...sousLaCase].find((ident) => ident?.startsWith(PREFIXE_ACHAT));
    if (achete) {
      choisir(achete);
      return;
    }
    if (id) {
      const meuble = monde().grille.emprises.get(id)?.meuble;
      statut.textContent = typographier(t('amenagement.fixe', { meuble: majuscule(meuble?.designation || meuble?.nom || '') }));
    }
  }

  // --- Entrer, sortir --------------------------------------------------------------------
  function ouvrir({ achat = null } = {}) {
    if (!monde()) return;
    if (!actif) {
      actif = true;
      monde().commencerAmenagement({
        surToucher,
        surDirection: ({ dx, dz }) => deplacer(dx, dz),
        surAgir: () => poser(),
      });
      titre.textContent = t('amenagement.titre', { lieu: monde().lieuOuvert.designation });
      element.hidden = false;
      surDebut?.();
    }
    if (achat) choisir(achat);
    else {
      afficherAffaires();
      focusSurPremier();
    }
  }

  function fermer({ silencieux = false } = {}) {
    if (!actif) return;
    // Un meuble en cours de déplacement reprend sa place.
    if (selection?.origine) annuler();
    selection = null;
    actif = false;
    element.hidden = true;
    monde()?.finirAmenagement();
    surFin?.();
    if (!silencieux) notifier(t('amenagement.fini'), { type: 'info' });
  }

  // Le clavier, en plus des flèches (gérées par le monde) : R pour tourner,
  // Suppr pour ranger, Échap pour annuler ou terminer.
  function surTouche(evenement) {
    if (!actif || evenement.ctrlKey || evenement.metaKey || evenement.altKey) return false;
    const cible = evenement.target;
    if (cible instanceof Element && cible.closest('input, textarea, select')) return false;
    if (evenement.code === 'KeyR') {
      tourner();
      return true;
    }
    if ((evenement.key === 'Delete' || evenement.key === 'Backspace') && selection?.origine) {
      ranger();
      return true;
    }
    if (evenement.key === 'Escape') {
      if (selection) annuler();
      else fermer();
      return true;
    }
    return false;
  }

  return {
    element,
    ouvrir,
    fermer,
    surTouche,
    get actif() { return actif; },
    get selection() { return selection ? { ...selection } : null; },
  };
}
