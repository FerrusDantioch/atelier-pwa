// =============================================================================
// evenements.js — la messagerie interne du jeu
// -----------------------------------------------------------------------------
// Un module « annonce » qu'il s'est passé quelque chose (« partie modifiée »,
// « réglages modifiés »…) ; les modules intéressés « écoutent ». Ainsi, les
// modules n'ont pas besoin de se connaître : on peut en ajouter un sans
// toucher aux autres.
//
// Noms d'événements utilisés (à compléter au fil des jalons) :
//   reglages:modifies   { cle, valeur, reglages }
//   partie:chargee      partie
//   partie:modifiee     partie
//   sauvegarde:faite    { date }
//   sauvegarde:echec    { erreur }
//   fenetre:ouverte     { element }
//   fenetre:fermee      { element }
//   pwa:mise-a-jour     { version }
//   pwa:installation    { possible }
// =============================================================================

const abonnes = new Map();

// S'abonner à un événement. Renvoie une fonction pour se désabonner.
export function ecouter(nom, fonction) {
  if (!abonnes.has(nom)) abonnes.set(nom, new Set());
  abonnes.get(nom).add(fonction);
  return () => abonnes.get(nom)?.delete(fonction);
}

// Prévenir tous les abonnés. Une erreur chez un abonné n'empêche pas les
// autres d'être prévenus.
export function annoncer(nom, details) {
  const liste = abonnes.get(nom);
  if (!liste) return;
  for (const fonction of [...liste]) {
    try {
      fonction(details);
    } catch (erreur) {
      console.error(`Erreur pendant l'événement « ${nom} » :`, erreur);
    }
  }
}
