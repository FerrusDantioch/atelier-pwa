// =============================================================================
// sauvegarde-ecran.js — la fenêtre « Sauvegarde » et l'import d'une partie
// -----------------------------------------------------------------------------
// - Sauvegarder maintenant (la sauvegarde est automatique, mais c'est
//   rassurant de pouvoir le faire soi-même).
// - Exporter sa partie dans un fichier (pour la garder ailleurs, ou la
//   reprendre sur un autre appareil).
// - Importer une partie depuis un fichier : un résumé est montré, et il faut
//   confirmer. La partie actuelle est gardée en copie de secours.
// - Reprendre une copie de secours.
// =============================================================================

import { sauvegarderMaintenant, partieEnCours } from '../noyau/etat.js';
import {
  TAILLE_MAXIMALE_IMPORT, lireFichierPartie, niveauDeReputation, resumerPartie,
} from '../noyau/format-sauvegarde.js';
import { estEnModeMemoire, exporterPartie, listerCopies, restaurerCopie } from '../noyau/sauvegarde.js';
import { formaterDate, formaterHeure, t, tPluriel } from '../noyau/textes.js';
import { el } from './dom.js';
import { confirmer, fenetreDuDessus, informer, ouvrirFenetre } from './fenetres.js';
import { icone } from './icones.js';
import { notifier } from './notifications.js';

// Le résumé d'une partie, sous forme de liste « intitulé : valeur ».
export function resumeEnListe(partie, jeu) {
  const resume = resumerPartie(partie);
  const niveau = niveauDeReputation(resume.reputation, jeu.reputation.paliers);
  const lignes = [
    [t('sauvegarde.resume.moment'), `${t('hud.jour', { jour: resume.jour })}, ${formaterHeure(resume.minute)}`],
    [t('sauvegarde.resume.argent'), tPluriel('monnaie.montant', resume.argent, {
      singulier: jeu.monnaie.singulier, pluriel: jeu.monnaie.pluriel,
    })],
    [t('sauvegarde.resume.reputation'), t('hud.niveau', { niveau: niveau.niveau, nom: niveau.nom })],
    [t('sauvegarde.resume.enregistree'), formaterDate(resume.enregistreeLe)],
    [t('sauvegarde.resume.version'), resume.versionJeu],
  ];
  return el('dl', { class: 'resume-partie' }, lignes.map(([intitule, valeur]) => [
    el('dt', {}, intitule), el('dd', {}, valeur),
  ]));
}

// Ouvre le sélecteur de fichier, lit le fichier choisi, montre un résumé et
// demande confirmation. surPartie(partie) est appelé si tout est bon.
export function importerUnePartie({ jeu, surPartie }) {
  const entree = el('input', { type: 'file', accept: '.json,application/json', class: 'visuellement-cache', tabindex: '-1' });
  entree.addEventListener('change', async () => {
    const fichier = entree.files?.[0];
    entree.remove();
    if (!fichier) return;
    let lecture;
    if (fichier.size > TAILLE_MAXIMALE_IMPORT) {
      lecture = { ok: false, code: 'tropGros' };
    } else {
      lecture = lireFichierPartie(await fichier.text());
    }
    if (!lecture.ok) {
      await informer({
        titre: t('sauvegarde.import.impossible'),
        message: [t(`sauvegarde.erreurs.${lecture.code}`), t('sauvegarde.import.rienChange')],
      });
      return;
    }
    const remplacer = Boolean(partieEnCours());
    const accord = await confirmerImport(lecture.partie, jeu, remplacer);
    if (accord) await surPartie(lecture.partie);
  }, { once: true });
  // Sélecteur fermé sans choisir de fichier : on range le champ.
  entree.addEventListener('cancel', () => entree.remove(), { once: true });
  // Le champ est placé dans la fenêtre ouverte (le reste de la page ne
  // répond pas tant qu'elle est ouverte).
  (fenetreDuDessus()?.element || document.body).append(entree);
  entree.click();
}

function confirmerImport(partie, jeu, remplacer) {
  return new Promise((resoudre) => {
    let accord = false;
    ouvrirFenetre({
      titre: t('sauvegarde.import.titre'),
      contenu: [
        el('p', {}, t('sauvegarde.import.trouvee')),
        resumeEnListe(partie, jeu),
        remplacer ? el('div', { class: 'encadre encadre-info' }, icone('copies'), el('p', {}, t('sauvegarde.import.copieGardee'))) : null,
      ],
      boutonFermer: false,
      actions: [
        { texte: t('commun.annuler'), fermer: true },
        {
          texte: remplacer ? t('sauvegarde.import.remplacer') : t('sauvegarde.import.charger'),
          principal: true,
          fermer: true,
          surClic: () => { accord = true; },
        },
      ],
      focus: (fenetre) => fenetre.pied.querySelector('button'),
      surFermeture: () => resoudre(accord),
    });
  });
}

// Les copies de secours, de la plus récente à la plus ancienne.
async function ouvrirCopies({ jeu, surPartie }) {
  const copies = await listerCopies();
  const contenu = copies.length === 0
    ? [el('p', {}, t('sauvegarde.copies.aucune'))]
    : [
      el('p', { class: 'aide' }, t('sauvegarde.copies.explication')),
      el('ul', { class: 'liste-simple' }, copies.map((copie) => el('li', { class: 'element-liste' },
        el('div', {},
          el('p', {}, el('strong', {}, formaterDate(copie.date))),
          el('p', { class: 'texte-doux' }, t(`sauvegarde.raisons.${copie.raison}`)),
          copie.resume ? el('p', { class: 'texte-doux' }, `${t('hud.jour', { jour: copie.resume.jour })} · ${
            tPluriel('monnaie.montant', copie.resume.argent, { singulier: jeu.monnaie.singulier, pluriel: jeu.monnaie.pluriel })}`) : null),
        el('button', {
          class: 'bouton',
          type: 'button',
          onClick: async () => {
            const accord = await confirmer({
              titre: t('sauvegarde.copies.reprendreTitre'),
              message: [t('sauvegarde.copies.reprendreMessage', { date: formaterDate(copie.date) }), t('sauvegarde.import.copieGardee')],
              oui: t('sauvegarde.copies.reprendre'),
            });
            if (!accord) return;
            try {
              const partie = await restaurerCopie(copie.id, partieEnCours());
              await surPartie(partie, { dejaEnregistree: true });
              notifier(t('sauvegarde.copies.reprise'), { type: 'succes' });
            } catch (erreur) {
              console.error(erreur);
              notifier(t('sauvegarde.erreurs.abimee'), { type: 'erreur' });
            }
          },
        }, icone('recharger'), t('sauvegarde.copies.reprendre'))))),
    ];
  ouvrirFenetre({ titre: t('sauvegarde.copies.titre'), contenu });
}

// La fenêtre « Sauvegarde ».
// surPartie(partie, options) : à appeler quand une autre partie doit être
// chargée (import, copie de secours) ; c'est main.js qui s'en occupe.
export function ouvrirSauvegarde({ jeu, surPartie }) {
  const partie = partieEnCours();
  const contenu = [];

  if (estEnModeMemoire()) {
    contenu.push(el('div', { class: 'encadre encadre-attention' },
      icone('attention'), el('p', {}, t('sauvegarde.modeMemoire'))));
  }

  if (partie) {
    contenu.push(el('h3', {}, t('sauvegarde.partieEnCours')), resumeEnListe(partie, jeu));
  } else {
    contenu.push(el('p', {}, t('sauvegarde.aucunePartie')));
  }

  const ligne = (iconeNom, texte, explication, surClic, disponible = true) => (disponible ? el('li', {},
    el('button', { class: 'bouton bouton-menu', type: 'button', onClick: surClic },
      icone(iconeNom),
      el('span', { class: 'bouton-textes' }, texte, el('span', { class: 'bouton-detail' }, explication)))) : null);

  contenu.push(el('ul', { class: 'menu-liste' },
    ligne('sauvegarde', t('sauvegarde.maintenant'), t('sauvegarde.maintenantDetail'), async () => {
      const reussi = await sauvegarderMaintenant();
      notifier(reussi ? t('sauvegarde.faite') : t('sauvegarde.echec'), { type: reussi ? 'succes' : 'erreur' });
    }, Boolean(partie)),
    ligne('exporter', t('sauvegarde.exporter'), t('sauvegarde.exporterDetail'), async () => {
      await sauvegarderMaintenant();
      const nom = exporterPartie(partieEnCours());
      notifier(t('sauvegarde.exportee', { fichier: nom }), { type: 'succes' });
    }, Boolean(partie)),
    ligne('importer', t('sauvegarde.importer'), t('sauvegarde.importerDetail'), () => importerUnePartie({ jeu, surPartie })),
    ligne('copies', t('sauvegarde.copies.titre'), t('sauvegarde.copies.detail'), () => ouvrirCopies({ jeu, surPartie })),
  ));

  contenu.push(el('p', { class: 'aide' }, t('sauvegarde.automatique')));
  return ouvrirFenetre({ titre: t('sauvegarde.titre'), contenu });
}
