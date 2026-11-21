// =============================================================================
// creation.js — le mini-jeu de création d'applications (les règles)
// -----------------------------------------------------------------------------
// Un « projet » est l'application que le joueur prépare pour une commande :
//   modele     le modèle choisi (liste, agenda, minuteur…) ou null ;
//   fonctions  les fonctions ajoutées (rappels à l'écran, vibration…) ;
//   confort    les réglages de l'application (taille du texte, contraste…).
//
// La note dépend SEULEMENT de l'adéquation au besoin de la personne :
//   - « À retravailler » s'il manque un besoin, si une chose à éviter est là,
//     si aucun modèle n'est choisi ou si l'application est bien trop chargée ;
//   - « Bien » s'il reste de petits défauts : un réglage de confort qui ne
//     convient pas, une fonction qui n'apporte rien, une charge un peu haute ;
//   - « Parfait » sinon.
// Les « petits plus » (bonus) ne changent pas la note : ils rapportent
// quelques pièces de plus. Rien n'est jamais perdu : un projet « à
// retravailler » reste tel quel, on le corrige et on le livre à nouveau.
//
// JavaScript pur (sans page ni 3D) : testé par tests/creation.test.mjs.
// =============================================================================

export const NOTES = ['parfait', 'bien', 'aRetravailler'];

// Les réglages de confort par défaut (data/creation.json › confort).
export function confortParDefaut(creation) {
  return Object.fromEntries(creation.confort.map((reglage) => [reglage.id, reglage.defaut]));
}

// Un projet tout neuf, au moment où la commande est acceptée.
export function projetVide(creation, { jour, minute }) {
  return {
    acceptee: { jour, minute },
    modele: null,
    fonctions: [],
    confort: confortParDefaut(creation),
    essais: 0,
    resultat: null,
  };
}

// Un projet propre : ce qui n'existe pas (ou plus) dans les données est
// ignoré. Utile pour une partie importée ou enregistrée par une autre version.
export function nettoyerProjet(projet, creation) {
  const modeles = new Set(creation.modeles.map((modele) => modele.id));
  const fonctions = new Set(creation.fonctions.map((fonction) => fonction.id));
  const confort = confortParDefaut(creation);
  for (const reglage of creation.confort) {
    const valeur = projet?.confort?.[reglage.id];
    if (reglage.valeurs.some((v) => v.id === valeur)) confort[reglage.id] = valeur;
  }
  return {
    acceptee: projet?.acceptee || { jour: 1, minute: 0 },
    modele: modeles.has(projet?.modele) ? projet.modele : null,
    fonctions: [...new Set((projet?.fonctions || []).filter((id) => fonctions.has(id)))],
    confort,
    essais: Number.isInteger(projet?.essais) && projet.essais >= 0 ? projet.essais : 0,
    resultat: projet?.resultat === 'aRetravailler' ? 'aRetravailler' : null,
  };
}

const parId = (liste) => new Map(liste.map((element) => [element.id, element]));

// La charge : la somme de ce que « pèse » chaque fonction ajoutée.
export function chargeDuProjet(projet, creation) {
  const fonctions = parId(creation.fonctions);
  return projet.fonctions.reduce((total, id) => total + (fonctions.get(id)?.charge || 0), 0);
}

// Ce que l'application peut porter sans devenir fatigante : la capacité du
// modèle, ou moins si la personne le demande (« le moins de boutons possible »).
export function capaciteDuProjet(projet, commande, creation) {
  const modele = parId(creation.modeles).get(projet.modele);
  if (!modele) return null;
  return Number.isInteger(commande.chargeMax) ? Math.min(commande.chargeMax, modele.capacite) : modele.capacite;
}

// Tout ce que l'application apporte (modèle + fonctions), et qui l'apporte.
function apports(projet, creation) {
  const resultat = new Map(); // apport → [{ type, id }]
  const ajouter = (apport, source) => {
    if (!resultat.has(apport)) resultat.set(apport, []);
    resultat.get(apport).push(source);
  };
  const modele = parId(creation.modeles).get(projet.modele);
  for (const apport of modele?.apporte || []) ajouter(apport, { type: 'modele', id: modele.id });
  const fonctions = parId(creation.fonctions);
  for (const id of projet.fonctions) {
    for (const apport of fonctions.get(id)?.apporte || []) ajouter(apport, { type: 'fonction', id });
  }
  return resultat;
}

// La récompense selon la note (data/creation.json › bareme), plus les
// pièces des petits plus. Rien pour un projet à retravailler.
export function recompensePour(note, commande, bonusObtenus, bareme) {
  if (note === 'aRetravailler') return { argent: 0, reputation: 0 };
  const base = commande.recompense;
  const taux = note === 'parfait' ? { argent: 1, reputation: 1 } : bareme.bien;
  return {
    argent: Math.round(base.argent * taux.argent) + bonusObtenus * (base.bonus || 0),
    reputation: Math.round(base.reputation * taux.reputation),
  };
}

/**
 * Évalue un projet pour une commande.
 * Renvoie { note, charge, capacite, criteres, recompense } où chaque critère
 * est { sorte, etat, … } :
 *   sorte  modele | besoin | eviter | confort | inutile | charge | bonus
 *   etat   ok | mineur | bloquant (et « absent » pour un bonus non obtenu)
 * bonusMateriel : les pièces en plus grâce au matériel installé (jalon 5,
 * voir boutique.js), gagnées à chaque livraison (sauf « À retravailler ») ;
 * recompense.materiel dit combien (absent s'il n'y en a pas).
 */
export function evaluerProjet(projetBrut, commande, creation, { bonusMateriel = 0 } = {}) {
  const projet = nettoyerProjet(projetBrut, creation);
  const criteres = [];
  const presents = apports(projet, creation);
  const fonctions = parId(creation.fonctions);

  if (!projet.modele) criteres.push({ sorte: 'modele', etat: 'bloquant' });

  // Les besoins : chacun doit être couvert.
  for (const besoin of commande.besoins) {
    criteres.push({ sorte: 'besoin', etat: presents.has(besoin.apporte) ? 'ok' : 'bloquant', texte: besoin.texte, apporte: besoin.apporte });
  }

  // Ce qui gêne la personne : chaque source fautive est signalée.
  const aEviter = new Map((commande.aEviter || []).map((element) => [element.apporte, element]));
  const fautives = new Set();
  for (const [apport, sources] of presents) {
    const gene = aEviter.get(apport);
    if (!gene) continue;
    for (const source of sources) {
      fautives.add(source.id);
      criteres.push({ sorte: 'eviter', etat: 'bloquant', texte: gene.texte, apporte: apport, source });
    }
  }

  // Le confort : chaque attente de la personne doit être respectée.
  for (const attente of commande.confort || []) {
    const choisi = projet.confort[attente.reglage];
    criteres.push({
      sorte: 'confort',
      etat: attente.valeurs.includes(choisi) ? 'ok' : 'mineur',
      texte: attente.texte,
      reglage: attente.reglage,
      choisi,
    });
  }

  // Les fonctions qui n'apportent rien à la personne alourdissent l'application.
  const utiles = new Set([...commande.besoins, ...(commande.bonus || [])].map((element) => element.apporte));
  for (const id of projet.fonctions) {
    if (fautives.has(id)) continue; // déjà signalée comme gênante
    const fonction = fonctions.get(id);
    if (!fonction.apporte.some((apport) => utiles.has(apport))) {
      criteres.push({ sorte: 'inutile', etat: 'mineur', fonction: id, avis: commande.avis?.[id] || null });
    }
  }

  // La charge, comparée à ce que l'application peut porter.
  const charge = chargeDuProjet(projet, creation);
  const capacite = capaciteDuProjet(projet, commande, creation);
  if (capacite !== null) {
    let etat = 'ok';
    if (charge > capacite + creation.bareme.toleranceCharge) etat = 'bloquant';
    else if (charge > capacite) etat = 'mineur';
    criteres.push({ sorte: 'charge', etat, charge, capacite });
  }

  // Les petits plus : ils ne changent pas la note.
  let bonusObtenus = 0;
  for (const bonus of commande.bonus || []) {
    const obtenu = presents.has(bonus.apporte);
    if (obtenu) bonusObtenus += 1;
    criteres.push({ sorte: 'bonus', etat: obtenu ? 'ok' : 'absent', texte: bonus.texte, apporte: bonus.apporte });
  }

  let note = 'parfait';
  if (criteres.some((critere) => critere.etat === 'bloquant')) note = 'aRetravailler';
  else if (criteres.some((critere) => critere.etat === 'mineur')) note = 'bien';

  const recompense = recompensePour(note, commande, bonusObtenus, creation.bareme);
  const materiel = note === 'aRetravailler' ? 0 : Math.max(0, Math.round(bonusMateriel));
  if (materiel > 0) {
    recompense.materiel = materiel;
    recompense.argent += materiel;
  }
  return {
    note,
    charge,
    capacite,
    criteres,
    bonusObtenus,
    recompense,
  };
}

// Pour les vérifications : existe-t-il au moins un projet « parfait » pour
// cette commande ? (On essaie chaque modèle avec chaque groupe de fonctions
// utiles ; les fonctions inutiles ne peuvent qu'abaisser la note.)
export function meilleurProjet(commande, creation) {
  const utiles = new Set([...commande.besoins, ...(commande.bonus || [])].map((element) => element.apporte));
  const candidates = creation.fonctions.filter((fonction) => fonction.apporte.some((apport) => utiles.has(apport)));
  const confort = confortParDefaut(creation);
  for (const attente of commande.confort || []) confort[attente.reglage] = attente.valeurs[0];
  let meilleur = null;
  for (const modele of creation.modeles) {
    for (let masque = 0; masque < 2 ** candidates.length; masque += 1) {
      const fonctions = candidates.filter((_, index) => masque & (2 ** index)).map((fonction) => fonction.id);
      const projet = { modele: modele.id, fonctions, confort };
      const evaluation = evaluerProjet(projet, commande, creation);
      if (evaluation.note !== 'parfait') continue;
      if (!meilleur || evaluation.recompense.argent > meilleur.evaluation.recompense.argent) {
        meilleur = { projet, evaluation };
      }
    }
  }
  return meilleur;
}
