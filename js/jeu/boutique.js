// =============================================================================
// boutique.js — acheter des meubles et du matériel (jalon 5)
// -----------------------------------------------------------------------------
// La boutique (data/boutique.json) vend deux sortes d'articles :
//   meuble    un meuble du catalogue (data/meubles.json), à poser où l'on
//             veut avec « Aménager » (voir amenagement.js) ;
//   materiel  le matériel du poste de travail (grand écran, clavier,
//             siège) : il s'installe tout seul sur le bureau, à la place
//             d'un « élément » (les formes marquées « element » dans
//             data/meubles.json), et rapporte quelques pièces de plus à
//             chaque livraison (« bonus »). Il ne s'achète qu'une fois.
// Un article se débloque avec un niveau de réputation (« niveau »).
//
// Dans la partie, chaque achat est une « possession » :
//   { id: 'achat-3', article: 'cactus', sorte: 'meuble', jour: 4, prix: 10 }
// L'identifiant ne sert qu'une fois : les meubles posés le citent.
//
// JavaScript pur (sans page ni 3D) : testé par tests/boutique.test.mjs.
// =============================================================================

import { niveauDeReputation } from '../noyau/format-sauvegarde.js';

export const SORTES = ['meuble', 'materiel'];
export const PREFIXE_ACHAT = 'achat-';

// Tous les articles de la boutique, avec leur sorte : [{ id, sorte, … }].
// Un meuble à vendre prend son nom et sa description dans le catalogue.
export function articlesDeLaBoutique(boutique, meubles) {
  const catalogue = new Map(meubles.map((meuble) => [meuble.id, meuble]));
  return [
    ...boutique.materiel.map((article) => ({ ...article, sorte: 'materiel' })),
    ...boutique.meubles.map((article) => {
      const meuble = catalogue.get(article.meuble);
      return {
        ...article,
        id: article.meuble,
        sorte: 'meuble',
        nom: meuble?.nom || article.meuble,
        description: article.description || meuble?.description || '',
      };
    }),
  ];
}

export function trouverArticle(articles, id) {
  return articles.find((article) => article.id === id) || null;
}

// Combien d'exemplaires de cet article sont déjà achetés ?
export function nombrePossedes(partie, id) {
  return partie.possessions.filter((possession) => possession.article === id).length;
}

/**
 * Peut-on acheter cet article maintenant ? Renvoie { possible, raison, … } :
 *   raison 'niveau'  il faut un niveau de réputation plus haut (niveau) ;
 *          'installe' du matériel déjà acheté ;
 *          'argent'  il manque des pièces (manque).
 */
export function etatDeLArticle(article, partie, paliers) {
  if (article.niveau && niveauDeReputation(partie.reputation, paliers).niveau < article.niveau) {
    return { possible: false, raison: 'niveau', niveau: article.niveau };
  }
  if (article.sorte === 'materiel' && nombrePossedes(partie, article.id) > 0) {
    return { possible: false, raison: 'installe' };
  }
  if (partie.argent < article.prix) return { possible: false, raison: 'argent', manque: article.prix - partie.argent };
  return { possible: true };
}

// Un identifiant d'achat jamais utilisé dans cette partie.
function nouvelIdentifiant(partie) {
  const numeros = partie.possessions
    .map((possession) => Number(possession.id.slice(PREFIXE_ACHAT.length)))
    .filter((n) => Number.isInteger(n));
  return `${PREFIXE_ACHAT}${Math.max(0, ...numeros) + 1}`;
}

/**
 * Achète un article (la partie est modifiée sur place). Renvoie la
 * possession créée, ou null si l'achat n'est pas possible.
 */
export function acheter(partie, article, paliers) {
  if (!etatDeLArticle(article, partie, paliers).possible) return null;
  const possession = {
    id: nouvelIdentifiant(partie),
    article: article.id,
    sorte: article.sorte,
    jour: partie.temps.jour,
    prix: article.prix,
  };
  partie.argent -= article.prix;
  partie.possessions.push(possession);
  return possession;
}

// Le matériel acheté (articles connus de la boutique seulement).
export function materielInstalle(partie, boutique) {
  const ids = new Set(partie.possessions.filter((p) => p.sorte === 'materiel').map((p) => p.article));
  return boutique.materiel.filter((article) => ids.has(article.id));
}

// Les pièces en plus à chaque livraison, grâce au matériel installé.
export function bonusDuMateriel(partie, boutique) {
  return materielInstalle(partie, boutique).reduce((total, article) => total + article.bonus, 0);
}

/**
 * Le catalogue des meubles, avec le matériel installé : dans chaque meuble,
 * les formes d'un élément remplacé (« element »: « ecran »…) laissent la
 * place à celles du matériel. Renvoie une Map id → meuble (copies : les
 * données d'origine ne changent pas).
 */
export function catalogueEquipe(meubles, materiel = []) {
  const parElement = new Map(materiel.map((article) => [article.element, article]));
  return new Map(meubles.map((meuble) => {
    if (!meuble.formes.some((forme) => parElement.has(forme.element))) return [meuble.id, meuble];
    const formes = [];
    const remplaces = new Set();
    for (const forme of meuble.formes) {
      const article = parElement.get(forme.element);
      if (!article) {
        formes.push(forme);
      } else if (!remplaces.has(article.element)) {
        // Les formes du matériel prennent la place de la première forme de
        // l'élément ; les autres formes de cet élément disparaissent.
        remplaces.add(article.element);
        formes.push(...article.formes.map((nouvelle) => ({ ...nouvelle, element: article.element })));
      }
    }
    return [meuble.id, { ...meuble, formes }];
  }));
}
