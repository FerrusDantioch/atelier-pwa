// =============================================================================
// boutique.js — l'écran « Boutique » de l'ordinateur (jalon 5)
// -----------------------------------------------------------------------------
// Quatre rayons (data/boutique.json) :
//   Matériel pour ton bureau  il s'installe tout seul et rapporte quelques
//                             pièces de plus à chaque livraison ;
//   Meubles et décoration     ils t'attendent dans tes affaires, et se posent
//                             avec « Aménager » (menu Pause) ;
//   Les bureaux de l'atelier  un lieu à louer (on y va par la porte d'entrée) ;
//   Agrandir les bureaux      des pièces à ouvrir, une à une.
// Chaque article a sa photo (prise par le moteur 3D), son prix, et dit en
// toutes lettres s'il est disponible : sinon, le niveau qu'il faut ou
// l'argent qui manque. Un achat se confirme toujours avant d'être payé.
// Les règles (prix, niveau, bonus) sont dans js/jeu/boutique.js.
// =============================================================================

import {
  acheter, articlesDeLaBoutique, catalogueEquipe, etatDeLArticle, nombrePossedes,
} from '../jeu/boutique.js';
import { modifierPartie, partieEnCours } from '../noyau/etat.js';
import { niveauDeReputation } from '../noyau/format-sauvegarde.js';
import { t, typographier } from '../noyau/textes.js';
import { el } from './dom.js';
import { icone } from './icones.js';
import { phrasesDesQuetes, progresserQuetes } from './progression.js';

const TAILLE_PHOTO = { largeur: 160, hauteur: 120 };
const majuscule = (texte) => texte.charAt(0).toLocaleUpperCase('fr') + texte.slice(1);

/**
 * Affiche la boutique dans l'ordinateur.
 *   ctx        le contexte de l'ordinateur (ordinateur.js)
 *   photo      (meuble, taille) → toile 2D (ou null) : la photo d'un meuble
 *   surAchat   (possession, article) → appelée après chaque achat
 *   surPlacer  (id) → ferme l'ordinateur et commence à poser ce meuble
 */
export function ecranBoutique(ctx, { photo = null, surAchat = null, surPlacer = null } = {}) {
  const { donnees } = ctx;
  const meubles = donnees.meubles.meubles;
  const articles = articlesDeLaBoutique(donnees.boutique, meubles);

  // Le meuble à photographier : le meuble lui-même, ou, pour du matériel,
  // le meuble qui le porte (le bureau, la chaise), déjà équipé.
  function meubleDe(article) {
    if (article.sorte === 'meuble') return meubles.find((meuble) => meuble.id === article.id) || null;
    if (article.sorte !== 'materiel') return null; // un lieu, une pièce : pas de photo
    const porteur = meubles.find((meuble) => meuble.formes.some((forme) => forme.element === article.element));
    return porteur ? catalogueEquipe(meubles, [article]).get(porteur.id) : null;
  }

  // La désignation d'un article dans une phrase (« le cactus »).
  function designation(article) {
    if (article.sorte !== 'meuble') return article.designation;
    return meubles.find((meuble) => meuble.id === article.id)?.designation || article.nom;
  }

  // Le verbe de l'achat : acheter un meuble, louer un lieu, ouvrir une pièce.
  const verbe = (article) => ({ lieu: 'louer', piece: 'ouvrir' }[article.sorte] || 'acheter');
  const designationDuLieu = (id) => articles.find((article) => article.sorte === 'lieu' && article.id === id)?.designation
    || donnees.lieux[id]?.designation || id;

  function photoDe(article) {
    const meuble = meubleDe(article);
    const toile = photo && meuble ? photo(meuble, TAILLE_PHOTO) : null;
    if (!toile) return null;
    toile.classList.add('photo-article');
    toile.setAttribute('role', 'img');
    toile.setAttribute('aria-label', t('boutique.photo', { article: article.nom }));
    return toile;
  }

  // Ce que dit la carte sous le prix : disponible (bouton), sinon pourquoi pas.
  function etatDeLaCarte(article, partie) {
    const etat = etatDeLArticle(article, partie, ctx.paliers);
    if (etat.possible) {
      const texte = t(`boutique.${verbe(article)}`);
      return el('button', {
        class: 'bouton', type: 'button',
        'aria-label': `${texte} : ${article.nom}, ${t('boutique.acheterComplement', { prix: ctx.montant(article.prix) })}`,
        onClick: () => confirmer(article),
      }, icone(article.sorte === 'lieu' || article.sorte === 'piece' ? 'cle' : 'boutique'), texte);
    }
    if (etat.raison === 'installe') {
      const cle = { lieu: 'boutique.loue', piece: 'boutique.ouverte' }[article.sorte] || 'boutique.installe';
      return el('p', { class: 'carte-commande-livree' }, icone('coche'), t(cle));
    }
    if (etat.raison === 'lieu') {
      return el('p', { class: 'carte-article-verrou' }, icone('cadenas'), t('boutique.dAbordLouer', { lieu: designationDuLieu(etat.lieu) }));
    }
    if (etat.raison === 'niveau') {
      const palier = ctx.paliers.find((p) => p.niveau === etat.niveau);
      return el('p', { class: 'carte-article-verrou' }, icone('cadenas'), t('boutique.niveau', { niveau: etat.niveau, nom: palier?.nom || '' }));
    }
    return el('p', { class: 'carte-article-verrou' }, icone('piece'), t('boutique.manque', { argent: ctx.montant(etat.manque) }));
  }

  function carte(article, partie) {
    const possedes = article.sorte === 'meuble' ? nombrePossedes(partie, article.id) : 0;
    const image = photoDe(article);
    return el('li', {}, el('article', { class: 'carte-commande carte-article' },
      image ? el('div', { class: 'carte-article-photo' }, image) : null,
      el('div', { class: 'carte-commande-entete' }, el('h5', {}, typographier(article.nom))),
      el('p', {}, typographier(article.description)),
      el('p', { class: 'carte-article-prix' }, icone('piece'), t('boutique.prix', { prix: ctx.montant(article.prix) })),
      article.sorte === 'materiel' && article.bonus > 0
        ? el('p', { class: 'texte-doux' }, t('boutique.bonus', { argent: ctx.montant(article.bonus) })) : null,
      possedes > 0 ? el('p', { class: 'texte-doux' }, t('boutique.possedes', { n: possedes })) : null,
      etatDeLaCarte(article, partie)));
  }

  function rayon(sorte, partie) {
    const liste = articles.filter((article) => article.sorte === sorte);
    if (liste.length === 0) return null;
    return el('section', { class: 'groupe-commandes' },
      el('h4', {}, t(`boutique.rayons.${sorte}`)),
      el('p', { class: 'aide' }, t(`boutique.${sorte}Aide`)),
      el('ul', { class: 'liste-commandes-recues liste-articles' }, liste.map((article) => carte(article, partie))));
  }

  // --- La liste des articles -------------------------------------------------------
  function liste() {
    const partie = partieEnCours();
    const niveau = niveauDeReputation(partie.reputation, ctx.paliers);
    ctx.montrer({
      titre: t('boutique.titre'),
      contenu: [
        el('p', { class: 'aide' }, t('boutique.intro')),
        el('p', { class: 'ligne-compte' }, icone('piece'), t('boutique.argent', { argent: ctx.montant(partie.argent) })),
        el('p', { class: 'ligne-compte' }, icone('etoile'), t('boutique.niveauActuel', { niveau: niveau.niveau, nom: niveau.nom })),
        rayon('materiel', partie),
        rayon('meuble', partie),
        rayon('lieu', partie),
        rayon('piece', partie),
      ],
      actions: [{ texte: t('ordinateur.retour'), icone: 'retour', surClic: () => ctx.aller.accueil() }],
    });
  }

  // --- Confirmer, puis acheter -------------------------------------------------------
  function confirmer(article) {
    const partie = partieEnCours();
    const image = photoDe(article);
    const titres = { lieu: 'boutique.confirmerLouer', piece: 'boutique.confirmerOuvrir' };
    ctx.montrer({
      titre: t(titres[article.sorte] || 'boutique.confirmerTitre', { article: designation(article) }),
      contenu: [
        image ? el('div', { class: 'carte-article-photo carte-article-photo-grande' }, image) : null,
        el('p', {}, typographier(article.description)),
        el('p', { class: 'ligne-compte' }, icone('piece'), t('boutique.confirmer', {
          prix: ctx.montant(article.prix), reste: ctx.montant(partie.argent - article.prix),
        })),
        article.sorte === 'materiel' && article.bonus > 0
          ? el('p', { class: 'texte-doux' }, t('boutique.bonus', { argent: ctx.montant(article.bonus) })) : null,
      ],
      actions: [
        { texte: t('ordinateur.retour'), icone: 'retour', surClic: () => liste() },
        {
          texte: article.sorte === 'meuble' || article.sorte === 'materiel' ? t('boutique.confirmerOui') : t(`boutique.${verbe(article)}`),
          icone: article.sorte === 'meuble' || article.sorte === 'materiel' ? 'boutique' : 'cle',
          principal: true,
          surClic: () => payer(article),
        },
      ],
      focus: (boutons) => boutons[boutons.length - 1],
    });
  }

  function payer(article) {
    let possession = null;
    modifierPartie((partie) => { possession = acheter(partie, article, ctx.paliers); }, { important: true });
    if (!possession) {
      liste();
      return;
    }
    surAchat?.(possession, article);
    // Les quêtes avancent tout de suite (« achète un meuble ») : on le dit ici.
    const evenements = progresserQuetes({ annoncer: false });
    const messages = {
      materiel: () => t('boutique.acheteMateriel', { article: majuscule(designation(article)), bonus: ctx.montant(article.bonus) }),
      meuble: () => t('boutique.acheteMeuble', { article: majuscule(designation(article)) }),
      lieu: () => t('boutique.acheteLieu', { article: designation(article), minutes: ctx.jeu.deplacement.trajet ?? 10 }),
      piece: () => t('boutique.achetePiece', { article: designation(article), lieu: designationDuLieu(article.lieu) }),
    };
    const message = messages[article.sorte]();
    const actions = [{ texte: t('boutique.continuer'), icone: 'boutique', surClic: () => liste() }];
    if (article.sorte === 'meuble' && surPlacer) {
      actions.push({
        texte: t('boutique.placerMaintenant'),
        icone: 'amenager',
        principal: true,
        surClic: () => {
          ctx.fenetre.fermer();
          surPlacer(possession.id);
        },
      });
    }
    ctx.montrer({
      titre: t('boutique.acheteTitre'),
      contenu: [
        ctx.encadre('succes', 'succes', typographier(message)),
        ...phrasesDesQuetes(evenements).map((phrase) => ctx.encadre(phrase.icone, phrase.type, phrase.texte)),
        el('p', { class: 'ligne-compte' }, icone('piece'), t('boutique.argent', { argent: ctx.montant(partieEnCours().argent) })),
      ],
      actions,
      focus: (boutons) => boutons[boutons.length - 1],
    });
  }

  liste();
}
