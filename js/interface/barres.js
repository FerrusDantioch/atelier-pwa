// =============================================================================
// barres.js — mise en page stable des barres fixes (haut, bas, aménagement)
// -----------------------------------------------------------------------------
// - L'heure garde toujours la largeur de la plus large heure de la journée,
//   mesurée dans la police choisie, pour éviter que la barre du haut ne saute
//   d'une minute à l'autre.
// - Les barres passent en version « compacte » si elles dépassent une ligne.
// - La caméra reçoit les marges réelles sans compter les boutons d'action
//   qui vont et viennent en marchant (aucun saut de caméra).
// =============================================================================

import { formaterHeure, t } from '../noyau/textes.js';
import { el } from './dom.js';

export function creerGestionBarres({
  element, barre, barreBas, boutonPause, boutonAllerA, boutonsDuMoment,
  moment, argent, reputation, texteObjectif, amenagement, monde, surPolicesPretes,
}) {
  let hauteurBarreBas = null;
  let miseEnPage = null;
  let placeDeLHeure = null;

  function basDeLEcran() {
    return amenagement.actif ? amenagement.element : barreBas;
  }

  function reserverPlaceDeLHeure(jour) {
    const libelles = [[moment.valeur, t('hud.jour', { jour })], [moment.court, t('hud.jourCourt', { jour })]];
    const styles = libelles.map(([libelle]) => getComputedStyle(libelle));
    const cle = [jour, ...styles.map((s) => `${s.font}|${s.fontSize}|${s.fontFamily}|${s.letterSpacing}|${s.wordSpacing}`)].join('/');
    if (cle === placeDeLHeure) return;
    placeDeLHeure = cle;
    const mesure = el('span', { 'aria-hidden': 'true' });
    document.body.append(mesure);
    libelles.forEach(([libelle, debut], index) => {
      const style = styles[index];
      for (const propriete of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariantNumeric', 'letterSpacing', 'wordSpacing']) {
        mesure.style[propriete] = style[propriete];
      }
      mesure.style.position = 'absolute';
      mesure.style.visibility = 'hidden';
      mesure.style.whiteSpace = 'nowrap';
      let chiffre = '0';
      let plusLarge = 0;
      for (const essai of '0123456789') {
        mesure.textContent = essai;
        const largeur = mesure.getBoundingClientRect().width;
        if (largeur > plusLarge) {
          plusLarge = largeur;
          chiffre = essai;
        }
      }
      mesure.textContent = `${debut} · ${formaterHeure(23 * 60 + 59).replace(/\d/g, chiffre)}`;
      libelle.style.minWidth = `${Math.ceil(mesure.getBoundingClientRect().width) + 1}px`;
    });
    mesure.remove();
  }

  function placerAuDessusDeLaBarre() {
    const hauteur = basDeLEcran().offsetHeight;
    if (hauteur === hauteurBarreBas) return;
    hauteurBarreBas = hauteur;
    document.documentElement.style.setProperty('--hauteur-barre-bas', `${hauteur}px`);
  }

  function adapterBarres() {
    boutonsDuMoment.forEach((bouton) => { bouton.style.position = 'absolute'; });
    barre.classList.remove('compacte');
    barreBas.classList.remove('compacte');
    const hauteurLigne = boutonPause.offsetHeight || 48;
    if (barre.offsetHeight > hauteurLigne * 1.9) barre.classList.add('compacte');
    if (barreBas.offsetHeight > (boutonAllerA.offsetHeight || 48) * 1.9) barreBas.classList.add('compacte');
    if (amenagement.actif) {
      amenagement.element.classList.remove('compacte');
      if (amenagement.element.offsetHeight > window.innerHeight * 0.25) amenagement.element.classList.add('compacte');
    }
    const marges = { haut: barre.offsetHeight, bas: basDeLEcran().offsetHeight, gauche: 0, droite: 0 };
    boutonsDuMoment.forEach((bouton) => { bouton.style.position = ''; });
    document.documentElement.style.setProperty('--hauteur-barre-haut', `${marges.haut}px`);
    monde()?.definirMarges(marges);
    placerAuDessusDeLaBarre();
  }

  function adapterBarresSiBesoin() {
    const cle = [argent.valeur.textContent, reputation.valeur.textContent, texteObjectif.textContent,
      moment.valeur.style.minWidth, moment.court.style.minWidth].join('|');
    if (cle === miseEnPage) return;
    miseEnPage = cle;
    adapterBarres();
  }

  function reinitialiser() {
    miseEnPage = null;
  }

  const observateur = new ResizeObserver(() => adapterBarres());
  observateur.observe(element);
  observateur.observe(amenagement.element);

  let detruit = false;
  document.fonts?.ready.then(() => {
    if (detruit) return;
    placeDeLHeure = null;
    surPolicesPretes?.();
  });

  return {
    reserverPlaceDeLHeure,
    adapterBarres,
    adapterBarresSiBesoin,
    placerAuDessusDeLaBarre,
    reinitialiser,
    detruire() {
      detruit = true;
      observateur.disconnect();
    },
  };
}
