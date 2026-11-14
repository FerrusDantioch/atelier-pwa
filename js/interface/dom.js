// =============================================================================
// dom.js — fabriquer des éléments HTML simplement et sans risque
// -----------------------------------------------------------------------------
//   el('button', { class: 'bouton', type: 'button', onClick: fonction }, 'Texte')
//
// Les textes sont toujours posés comme du texte (jamais comme du HTML) :
// un texte venu d'un fichier importé ne peut pas devenir du code.
// =============================================================================

export function el(balise, attributs = {}, ...enfants) {
  const element = document.createElement(balise);
  for (const [nom, valeur] of Object.entries(attributs || {})) {
    if (valeur === undefined || valeur === null || valeur === false) continue;
    if (nom.startsWith('on') && typeof valeur === 'function') {
      // onClick → « click », onKeydown → « keydown »…
      element.addEventListener(nom.slice(2).toLowerCase(), valeur);
    } else if (nom === 'class') {
      element.className = Array.isArray(valeur) ? valeur.filter(Boolean).join(' ') : valeur;
    } else if (nom === 'texte') {
      element.textContent = valeur;
    } else if (valeur === true) {
      element.setAttribute(nom, '');
    } else {
      element.setAttribute(nom, String(valeur));
    }
  }
  ajouter(element, enfants);
  return element;
}

// Ajoute des enfants : éléments, textes, listes (les vides sont ignorés).
export function ajouter(parent, enfants) {
  for (const enfant of [enfants].flat(Infinity)) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    parent.append(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
  }
  return parent;
}

export function vider(element) {
  element.replaceChildren();
  return element;
}

// Un identifiant unique, pour relier une étiquette à son champ.
let compteur = 0;
export function identifiant(prefixe = 'id') {
  compteur += 1;
  return `${prefixe}-${compteur}`;
}
