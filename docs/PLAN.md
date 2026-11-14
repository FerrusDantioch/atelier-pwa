# Plan du jeu « Atelier PWA » *(titre provisoire)*

Plan proposé par Claude et accepté par Ferrus Dantioch le 14 novembre 2026
(« Tu peux commencer »). Les points encore ouverts sont listés à la fin.
Ce document est la référence pour les jalons suivants : le mettre à jour
quand une décision change.

## 1. Principes

- **Aucune étape de compilation** : fichiers statiques, modules JavaScript
  que le navigateur charge tout seul, publiés tels quels sur GitHub Pages.
- **Three.js r187** copié tel quel dans `lib/three/` (pas de CDN). Les autres
  fichiers tiers (polices) sont aussi copiés, avec leur empreinte vérifiée.
- **Trois couches séparées** :
  1. les **règles** (`js/jeu/`) : JavaScript pur, sans 3D ni HTML, testable ;
  2. le **monde 3D** (`js/monde/`, `js/modeles/`) : affiche, ne décide rien ;
  3. l'**interface HTML** (`js/interface/`), par-dessus la 3D.
- **Tout le contenu est dans `data/`**. Ajouter un lieu = ajouter un fichier.
- Stockage préfixé **`atelier-pwa`** (cache, base de données, réglages) :
  toutes les applications de Ferrus partagent la même adresse de base.
- **Rien ne part sur internet**, sauf l'ouverture d'une vraie application de
  Ferrus quand le joueur le demande (nouvel onglet). CSP stricte.
- Textes au **tutoiement** et **épicènes** (sans accord masculin/féminin).
- Commentaires en français, petits fichiers.

## 2. Arborescence visée

```
index.html · manifest.webmanifest · sw.js · LICENSE · licences-tierces.txt
README.md · CLAUDE.md · .nojekyll
css/      themes.css (seules couleurs) · base.css · interface.css · ordinateur.css (J3)
js/       config.js · avant-affichage.js · secours.js · main.js
  noyau/      evenements, etat, donnees, schemas, coherence, verification,
              textes, reglages, hasard, format-sauvegarde, sauvegarde,
              audio, pwa
  jeu/        personnage (J1) ; (J2+) economie, commandes, creation, quetes,
              generateur, dialogues, routines, progression, amenagement
  monde/      (J1) moteur, camera-iso, lieu, lumieres, grille, chemin,
              deplacement, pointage, controles, reperes, studio, monde
  modeles/    (J1) formes, palette, meubles, personnage
  interface/  dom, icones, fenetres, notifications, accueil, reglages-ecran,
              sauvegarde-ecran, a-propos, installation, ecran-jeu
              (+ choix-perso J1, dialogue-ecran J2, ordinateur et
              atelier-app J3, journal J4, aller-a J1, fiche-app J6)
data/     jeu.json · textes.json (J0)
          personnages.json · palette.json · meubles.json (J1)
          pnj.json · dialogues.json (J2)
          commandes.json · creation.json (J3) · quetes.json · modeles-quetes.json (J4)
          prix et déblocages des meubles (J5) · apps.json · mentions.json (J6)
          lieux/index.json + un fichier par lieu (J1+)
lib/three/    three.module.js · three.core.js · LICENSE
assets/       icônes · logo de l'Omni-système · polices + licences
outils/       serveur local · embarquer-tiers · creer-icones (facultatifs)
tests/        node --test (logique) · navigateur/ (Playwright)
docs/         PLAN.md · CONTENU.md · JOURNAL.md
```

## 3. Modèle de données (aperçu)

Chaque fichier de `data/` est décrit par un schéma dans
`js/noyau/schemas.js` et vérifié au démarrage et par les tests.

- **jeu.json** : monnaie, valeurs de départ, paliers de réputation, sauvegarde.
- **textes.json** : tous les textes de l'interface, rangés par groupes.
- **personnages.json** : Ferrus (apparence à décrire par lui) et les options
  de personnalisation (teints, coiffures, barbe, lunettes, silhouette,
  tenues, couvre-chefs, aides à la mobilité : aucune, fauteuil roulant,
  canne), avec les valeurs par défaut.
- **palette.json** : les couleurs de la 3D, rangées par nom (« bois-clair »).
  Les couleurs de l'interface restent dans `css/themes.css`.
- **pnj.json** : identité, apparence, profil de confort, routine
  (`{ de, a, lieu, point, activite }`), besoins, répliques courtes.
  `"lieu": "ailleurs"` = un lieu non dessiné : le PNJ est simplement absent.
- **quetes.json** : quêtes écrites à l'avance, en étapes typées (parler,
  aller, commande, acheter, placer, réputation, voir-app, drapeau) ; une
  étape « facultative » ne bloque jamais.
- **modeles-quetes.json** : briques des quêtes aléatoires (client, besoin,
  contrainte, récompense), tirées avec la graine de la partie + le jour.
- **commandes.json** / **creation.json** : cahier des charges (attendus,
  bonus, à éviter, confort) et pièces du mini-jeu (modèles d'appli,
  fonctionnalités avec ce qu'elles « apportent » et leur « charge », barème).
- **meubles.json** : nom, description (à examiner), emprise au sol,
  « recette » 3D (liste de formes simples) ; prix, déblocage et effets au
  jalon 5.
- **lieux/*.json** : taille de la grille, pièces (zones et sol), murs,
  ouvertures (portes, porte d'entrée, fenêtres), meubles posés, points
  d'intérêt, point de départ ; plus tard, emplacements de la vitrine. Au
  démarrage, le jeu vérifie que chaque pièce et chaque objet à examiner est
  atteignable à pied et en fauteuil roulant.
- **apps.json** : vraies applications (id, nom, description, public, url,
  statut). Jamais d'adresse inventée : `TODO_URL` tant qu'elle n'est pas
  confirmée.
- **mentions.json** : mentions légales, champs à compléter (aucune identité
  civile écrite par Claude).

La **sauvegarde** (IndexedDB, base `atelier-pwa`, et fichier exporté de même
forme) : `format`, `versionFormat`, `versionJeu`, dates, `graine`, `joueur`,
`temps { jour, minute }`, `argent`, `reputation`, `quetes`, `commandes`,
`possessions`, `lieux { actuel, debloques, amenagements }`, `drapeaux`,
`vue { rotation, zoom }` (format 2, jalon 1). Le joueur :
`{ modele: 'ferrus' | 'perso', nom, apparence, position { x, z, angle } }`
(l'apparence de Ferrus n'est jamais copiée : elle vient des données).
Toute évolution de forme passe par `versionFormat` + une étape de migration.
Les **réglages** sont à part (localStorage `atelier-pwa.reglages`).

## 4. Systèmes clés

- **Mini-jeu de création** (sur l'ordinateur, sans chronomètre) : lire la
  commande → choisir un modèle d'appli → ajouter des fonctionnalités (jauge de
  « charge ») → régler le confort (aperçu en direct) → tester « comme le
  client » → livrer : Parfait / Bien / À retravailler, avec explications.
  « À retravailler » : on reprend le projet, rien n'est perdu. La note dépend
  seulement de l'adéquation au besoin.
- **Temps et routines** : 1 s réelle = 1 min de jeu (réglable, ou arrêté) ;
  journée de 7 h à 23 h ; le temps s'arrête dès qu'une fenêtre est ouverte ;
  rien n'expire (seules les offres aléatoires non acceptées se renouvellent).
- **Déplacements et accessibilité** : grille de 50 cm ; le fauteuil a besoin
  de passages d'au moins 1 m ; un meuble qui couperait un passage est refusé,
  avec une explication. Recherche de chemin A*.
- **Interface fixe** : en haut argent et réputation, objectif actif, heure et
  Pause ; en bas Journal, « Aller à… », action du moment, caméra.
  Clavier par position des touches (AZERTY affiché, QWERTY accepté) :
  Z Q S D / flèches, A / E tourner, + / − zoom, Entrée / Espace agir,
  J journal, Échap pause / fermer.
- **Réglages** : taille du texte (4 niveaux), thème, contraste élevé, police,
  espacement, animations réduites, mode calme, son coupé et trois volumes,
  mode daltonien ; plus tard : luminosité de la scène, qualité graphique,
  vitesse du temps.
- **Mode calme** : pas d'événements imprévus, pas de petits décors animés,
  lumière fixe, caméra sans mouvement automatique, nouveautés sans bruit.
- **Sauvegarde** : automatique, copie d'urgence instantanée en quittant,
  5 copies de secours, export/import avec résumé et confirmation, écran de
  secours si le jeu ne démarre pas.

## 5. Personnages

- **PNJ n°1** : fiche (nom fictif, apparence, activités, répliques) en
  attente de validation. **Rien la concernant n'est poussé dans le dépôt
  (public) avant cette validation.**
- **Ferrus, le mentor** : présent dans les lieux et en visio sur
  l'ordinateur ; présente l'activité de Ferrus Dantioch, sert de tutoriel,
  commente les vraies applications. Ses répliques sur les applications
  reprennent le portfolio et sont validées par Ferrus ; tout ce qui est
  personnel reste à écrire par lui (« À ÉCRIRE PAR FERRUS »).
- **Proposés** (fictifs, modifiables ; l'humour ne vise jamais le handicap) :
  Théo, étudiant autiste (prévisibilité, routines) — 3e PNJ du premier
  livrable ; Madeleine, retraitée malvoyante (lisibilité) ; Samia, boulangère
  (simplicité) ; Karim, menuisier sourd (rien de seulement sonore) ; Hugo,
  client pressé (moins, c'est mieux).
- **Premier livrable (J4)**, une quête par thème : « Bienvenue à l'atelier »
  (lisibilité), « Le planning de publication » (simplicité), « Des
  sous-titres pour tout le monde » (soutien au quotidien), « Un matin sans
  surprise » (aide à la routine), « Réviser sans se noyer » (charge
  cognitive).

## 6. Jalons

| Jalon | Version | Contenu |
|---|---|---|
| J0 | 0.1 | Squelette PWA, réglages, sauvegarde, export/import, tests |
| J1 | 0.2 | Domicile en 3D, caméra, déplacement, choix du personnage |
| J2 | 0.3 | PNJ, routines, chemins, dialogues |
| J3 | 0.4 | Ordinateur, mini-jeu, argent, réputation, visio |
| J4 | 0.5 | Quêtes et journal → premier livrable jouable |
| J5 | 0.6 à 0.9 | Achats, aménagement, bureaux, PNJ entre les lieux |
| J6 | 1.0 | Vitrine, À propos complet, finitions, tablette, GitHub Pages |

À la fin de chaque jalon : commits clairs, une note dans `docs/JOURNAL.md`,
les instructions de test sur tablette, puis **arrêt et validation** avant
le jalon suivant.

## 7. Décisions et questions

Décidé avec Ferrus (14 novembre 2026) :

- **Deux Ferrus** : si le joueur choisit Ferrus, le mentor n'apparaît qu'en
  visio, comme « le vrai Ferrus, depuis le monde réel ».
- **Test et publication** : tablette **Android** avec le navigateur
  **Brave** ; chaque jalon validé est **fusionné dans `main`**, publiée par
  GitHub Pages.
- **Apparence de Ferrus** (décrite par lui) : cheveux très courts, sombres
  voire noirs, lunettes rondes, chemise noire à rayures blanches verticales,
  pantalon bleu, pas de barbe ; teint non précisé, donc « neutre ».

Recommandations appliquées en attendant une réponse contraire :

- Monnaie fictive (« pièces ») plutôt que des euros, pour qu'aucun montant ne
  passe pour un tarif réel. Modifiable dans `data/jeu.json`.
- Le jeu fait partie de l'écosystème Omni : thème violet nuit par défaut,
  logo et lien « Découvrir l'Omni-système » dans l'À propos, même contact.
- Fichiers tiers signalés le 14/11 et utilisés : Three.js r187 (MIT),
  Atkinson Hyperlegible Next et OpenDyslexic (OFL 1.1) ; Playwright pour les
  tests (outil de développement).

Questions ouvertes (à trancher avant le jalon indiqué) :

1. *(Réglée : apparence de Ferrus, voir plus haut.)*
2. **PNJ n°1** (avant J2) : nom fictif choisi par Ferrus (gardé hors du
   dépôt) ; fiche complète (apparence, rôle, répliques) à faire valider par
   elle avant toute publication.
3. **Vraies applications** (avant J6) : pré-remplir `apps.json` depuis le
   portfolio ? lesquelles en affiche au domicile ? quels statuts ?
4. **Mentions légales** (avant J6) : statut et champs à compléter.
5. **Règles communes** : recopier une version adaptée du socle commun dans
   `CLAUDE.md` (dépôt public) ? En attente d'accord.
6. *(Réglée : tablette Android, Brave.)*
