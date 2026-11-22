# Atelier PWA — notes pour Claude

Jeu de simulation 3D low-poly (vue isométrique) en **HTML/CSS/JS pur, sans
compilation**, publié tel quel sur GitHub Pages. Il présente aussi les vraies
applications de Ferrus Dantioch. Le plan validé est dans `docs/PLAN.md`,
l'avancement dans `docs/JOURNAL.md`. Lire les deux avant de travailler.

## Façon de travailler

- Ferrus veut comprendre ce qui se passe : réponses en français simple,
  chaque terme technique expliqué. Dire clairement ce qui est fragile.
- Le jeu avance **par jalons** (J0 à J6, voir le plan). À la fin de chaque
  jalon : commits clairs en français, une note dans `docs/JOURNAL.md`, les
  instructions de test sur tablette, puis **arrêt et validation** de Ferrus
  avant le jalon suivant.
- Avant tout changement important ou toute nouvelle bibliothèque, outil ou
  site contacté : l'expliquer et attendre l'accord.
- Règles communes de l'écosystème : version adaptée du socle commun
  ci-dessous (accord de Ferrus du 22 novembre 2026 ; la référence complète
  reste dans le dépôt privé `omni-socle`).

## Règles communes à l'écosystème Omni (version adaptée)

- **Esprit et public** : les outils servent à aider les autres, en priorité
  les personnes autistes et les personnes en situation de handicap, avec pour
  objectif d'être indépendant des comptes, des grandes plateformes et
  d'internet. Réponses en français simple, chaque terme technique expliqué,
  ton direct et honnête sur ce qui est fragile.
- **Règles non négociables** : pas de compte, pas de serveur distant
  (backend), pas d'IA intégrée ; fonctionnement **hors ligne systématique** ;
  zéro appel réseau sans accord préalable ; les données restent sur
  l'appareil ; les liens externes ne s'ouvrent que sur geste de la personne ;
  pas de CDN ni de téléchargement tiers pendant la publication (tout est
  embarqué avec sa licence et son empreinte vérifiée).
- **Identité, ton et mentions** : signature « Ferrus Dantioch » ; tutoiement
  partout ; « À propos » complet (nom, version, « réalisé par Ferrus
  Dantioch, avec l'aide de l'intelligence artificielle », licence
  CC BY-NC-ND 4.0, confidentialité, licences tierces, contact alias de
  l'Omni-système, lien « Découvrir l'Omni-système », logo Omni) ; thème
  violet nuit (Omni) par défaut, plus Sombre, Clair et Auto.
- **Sécurité et origine partagée** : CSP stricte ; toutes les applications
  partageant la même adresse de base (`ferrusdantioch.github.io`), chacune
  garde son propre préfixe (`atelier-pwa`) pour caches, IndexedDB et
  localStorage, et son identité propre dans le manifeste
  (`"id": "/atelier-pwa/"`, `"scope": "./"` — ne plus changer). Mentionner
  Brave comme palliatif d'installation sur Android.
- **Hors ligne et versions** : tout est copié à l'installation puis servi
  « cache d'abord », avec plan B en cas d'échec réseau et réutilisation
  locale des gros fichiers tiers inchangés (`DURABLES` dans `sw.js`).
  Vérification de mise à jour au retour au premier plan, proposition claire
  jamais imposée, source unique de numéro de version (`js/config.js`).
- **Accessibilité minimum** : cibles tactiles ≥ 44 px (48 px ici), contraste
  ≥ 4,5 (7 pour le texte principal), contour de focus clavier toujours
  visible, respect des animations réduites, un seul `<h1>` visible, Échap
  ferme les fenêtres, Tab reste dans la fenêtre, thème appliqué avant le
  premier affichage (pas d'éclair).
- **Tests et livraison** : test automatique de chaque nouvelle fonction
  (et vérification CI dans `.github/workflows/tests.yml`), vérification hors
  ligne, téléphone/tablette, « À propos » et absence de requête réseau ;
  documentation tenue à jour. HTML/CSS/JS pur sans compilation, publié sur
  GitHub Pages.

## Vie privée et contenu (impératif)

- **Jamais l'identité civile de Ferrus** dans le code, les données, la
  documentation ou les commits. Les mentions légales (jalon 6) utiliseront
  des champs à compléter par lui.
- **PNJ n°1 (Halaé)** : sa fiche a été validée par elle le 14/11/2026.
  Toute modification ou tout ajout la concernant (apparence, rôle, journée,
  répliques, quêtes) doit de nouveau être validé par elle, via Ferrus,
  avant d'être poussé : ce dépôt est public. Voir `docs/PLAN.md` § 5.
- **Rien d'inventé sur Ferrus** : les répliques du mentor sur les vraies
  applications reprennent le portfolio et sont marquées à valider ; tout ce
  qui est personnel reste un emplacement « À ÉCRIRE PAR FERRUS ».
- **Jamais d'adresse inventée** pour les vraies applications : `TODO_URL`
  tant que Ferrus ne l'a pas confirmée.
- Applications fictives (commandes, quêtes) toujours étiquetées
  « application fictive », distinctes des vraies.
- Ton : tutoiement, textes épicènes, humour léger qui ne vise jamais le
  handicap.

## ⚠️ Avant de publier : augmenter la version

`version` dans `js/config.js` est la **seule** source du numéro de version.
Ce fichier est lu par la page et par `sw.js` (via `importScripts`) : changer
la version change le nom de la réserve hors ligne, ce qui déclenche la mise
à jour chez les joueurs. Sans ce changement, ils gardent l'ancienne version.

## Règles techniques à respecter

- **`idStockage: 'atelier-pwa'` ne doit jamais changer** : il préfixe la base
  IndexedDB, les clés localStorage (`atelier-pwa.reglages`,
  `atelier-pwa.partie-urgence`) et les réserves hors ligne
  (`atelier-pwa-<version>`). Le changer rendrait les parties invisibles.
- **Tout nouveau fichier du jeu va dans `FICHIERS` (`sw.js`)**, sinon il
  manque hors ligne. `tests/hors-ligne.test.mjs` vérifie la liste.
- **CSP stricte** dans `index.html` : aucun script ni style écrit
  directement dans le HTML, pas de `style="…"`, pas de `innerHTML`, pas de
  `eval`. Les styles passent par les classes CSS ou `element.style.x = …`
  (`tests/securite.test.mjs`).
- **`css/themes.css` est le seul fichier CSS avec des couleurs** (test). Les
  contrastes de toutes les combinaisons (thème × contraste élevé ×
  daltonisme) sont vérifiés par `tests/navigateur/themes.test.mjs`. Les
  couleurs de la **3D** sont dans `data/palette.json` ; les repères 3D
  (destination, objet ciblé) et le fond de scène reprennent les variables
  du thème (`--focus`, `--fond-scene`).
- **Tous les textes visibles sont dans `data/textes.json`** et passent par
  `t('groupe.cle')` (typographie française automatique). Exception voulue :
  « Chargement… » et l'écran de secours dans `index.html`. Les tests
  vérifient que chaque clé utilisée existe.
- **Chaque fichier de `data/` a un schéma** dans `js/noyau/schemas.js`,
  vérifié au démarrage (écran de secours avec la liste des erreurs) et par
  les tests.
- **Fichiers tiers** (Three.js r187, polices) : copiés par
  `outils/embarquer-tiers.mjs`, avec leurs empreintes SHA-256 dans
  `licences-tierces.txt` (vérifiées par `tests/tiers.test.mjs`). Jamais de
  CDN, jamais de téléchargement pendant la publication.
- **Les règles du jeu** (`js/jeu/`) restent du JavaScript pur, sans 3D ni
  HTML, pour être testées avec `node --test`. Même chose pour
  `js/monde/grille.js`, `chemin.js` et `deplacement.js` (grille de 50 cm,
  A*, avancée pas à pas).
- **3D** (Three.js) : chargée seulement au moment de jouer
  (`preparer3D()` dans `main.js`), un seul moteur pour tout le jeu. Le
  moteur ne redessine que si quelque chose bouge (`moteur.animer()`,
  `moteur.redessiner()`). Le décor fixe est fusionné en une géométrie
  (couleurs par sommet) : garder peu de dessins par image (test : moins de
  40). Pas d'ombres calculées. Jamais deux faces exactement au même
  endroit (elles « scintillent » quand la vue bouge) : décaler d'au moins
  1 cm, comme les traverses des fenêtres (`DEPASSE` dans `lieu.js`).
- **Accessibilité des lieux** : `js/noyau/coherence.js` refuse au démarrage
  un lieu où une pièce ou un objet à examiner n'est pas atteignable à pied
  ET en fauteuil roulant (passages ≥ 1 m = 2 cases). Tout nouveau lieu ou
  meuble doit passer ce contrôle.
- **Le personnage « Ferrus »** a l'apparence décrite par lui (voir
  `docs/PLAN.md` § 7), teint clair choisi par lui. Ne rien changer
  ni ajouter sans sa demande. Son apparence n'est jamais copiée dans les
  parties.
- **Le temps et les habitants** : l'horloge (`js/jeu/temps.js`) ne tourne
  que si aucune fenêtre n'est ouverte ; les routines (`js/jeu/routines.js`)
  sont fixes et prévisibles (pas d'imprévu). Chaque place d'une routine
  doit être atteignable depuis `porte-entree` avec la façon de se déplacer
  du personnage (`coherence.js`).
- **L'ordinateur** (jalon 3) : une seule fenêtre à « écrans »
  (`js/interface/ordinateur.js` : `montrer`, `pied`), avec l'atelier
  (`atelier.js`) et la visio (`visio.js`). Les règles du mini-jeu sont en
  JavaScript pur, testées : `js/jeu/creation.js` (note, charge,
  récompense), `commandes.js` (offres, livraison, objectif du moment),
  `economie.js`. `coherence.js` refuse une commande impossible à réussir
  « parfaitement » ou qui ne se débloque jamais avec des « Bien ». Chaque
  commande affiche « application fictive ». Une commande « enPersonne »
  (Halaé, Théo) est d'abord présentée de vive voix dans le dialogue
  (drapeau `proposee-<id>`), puis arrive sur l'ordinateur.
- **Les quêtes** (jalon 4) : règles pures dans `js/jeu/quetes.js`
  (déblocage, étapes, fin et récompense, quête suivie, objectif du haut),
  appliquées par `js/interface/progression.js`, le seul endroit qui les
  fait avancer et les annonce (en **un seul message** : les lecteurs
  d'écran ne lisent que le dernier de deux messages d'affilée). Une étape
  faite est retenue par le drapeau `etape-<quête>-<étape>` : **ne jamais
  changer l'identifiant d'une quête ou d'une étape publiée**. Une étape
  « drapeau » n'attend qu'un drapeau de `DRAPEAUX_D_ETAPES` ; `coherence.js`
  refuse une quête impossible à finir (même avec des « Bien »). Les deux
  quêtes d'Halaé et « Mes sous-titres » sont validées par elle (15/11) : un
  test vérifie que leurs textes n'ont pas changé.
- **Commandes du jour** (`js/jeu/generateur.js`, `data/modeles-commandes.json`) :
  tirées avec la graine et le jour (reproductibles), identifiants
  `jour-<jour>-<n>`, recopiées dans la partie une fois acceptées
  (`commandes.aleatoires`) ; seules les associations réussissables
  « parfaitement » sont tirées. Les listes de commandes de l'interface
  passent par `commandesConnues()`.
- **Portraits** (visio, commandes) et **photos de la boutique** :
  `moteur.photographier()` dessine une autre scène dans un coin de la toile
  et la recopie dans la même tâche (`js/monde/portrait.js`) : pas de second
  moteur 3D.
- **Boutique et aménagement** (jalon 5) : règles pures dans
  `js/jeu/boutique.js` (acheter, niveau, matériel et son bonus,
  `catalogueEquipe()` qui remplace les formes d'un `element`) et
  `js/jeu/amenagement.js` (`verifierPlacement()` : mêmes règles
  d'accessibilité que `coherence.js`, via `problemesDAcces()`, plus
  l'espace de demi-tour de 1,50 m et le personnage jamais enfermé ; la
  raison de chaque refus est dite en toutes lettres). Achats dans
  `partie.possessions` (identifiants `achat-<n>`, jamais réutilisés),
  meubles posés dans `partie.lieux.amenagements` (format 4). Le monde
  reconstruit le lieu avec `actualiserLieu()` ; pendant l'aménagement, le
  temps est arrêté et le doigt et le clavier déplacent le meuble
  (`js/monde/fantome.js`, `js/interface/amenagement.js`). Au chargement,
  un meuble qui ne tient plus à sa place retourne dans les affaires.
- **Les bureaux** (jalon 5, `js/jeu/lieux.js`) : un lieu se loue (article
  « lieu » → `partie.lieux.debloques`), ses pièces marquées `ouverture`
  s'ouvrent une à une (articles « piece »). `lieuSelonOuvertures()` donne
  le lieu tel qu'il est : pièces fermées « verrouillee » (pas de sol
  praticable, sol de chantier), meubles et points retirés, portes
  « porte-fermee ». `coherence.js` vérifie chaque lieu tout fermé, pièce
  par pièce et tout ouvert ; un meuble posé ne doit pas bloquer une pièce
  future (`lieuComplet`). Un créneau de routine `si` n'a lieu qu'avec son
  ouverture. On change de lieu par la porte d'entrée (`voyager()` dans
  `ecran-jeu.js` : trajet de `jeu.deplacement.trajet` minutes, nouveau
  monde 3D) ; les objectifs mènent d'un lieu à l'autre. **Jamais plus de
  deux personnages à la fois dans un lieu** (9 dessins par personnage :
  test « moins de 40 dessins »).
- **Tests navigateur** : pour attendre une condition qui importe des modules
  du jeu, utiliser `attendre()` (aides-navigateur.mjs), pas
  `page.waitForFunction` (qui n'attend pas les fonctions async).
- **Fenêtres** : toujours `ouvrirFenetre()` (`js/interface/fenetres.js`) :
  titre + croix, contenu qui défile, boutons en bas, Échap, Tab qui reste
  dans la fenêtre, focus rendu à la fermeture. Une fenêtre ouverte rend le
  reste de la page inerte : les notifications s'affichent alors dans la
  fenêtre.
- **Sauvegarde** : IndexedDB (base `atelier-pwa`) + copie d'urgence
  instantanée dans localStorage en quittant + copies de secours. Toute
  évolution de la forme d'une partie passe par `VERSION_FORMAT` et
  `MIGRATIONS` (`js/noyau/format-sauvegarde.js`).
- **Les barres fixes ne changent pas de forme** quand un texte change
  souvent : l'heure garde la place de la plus large de la journée
  (`reserverPlaceDeLHeure()` dans `ecran-jeu.js`, mesurée dans la police
  choisie) ; un test vérifie la barre d'une minute à l'autre. Elles ne
  sont remesurées que si leurs textes changent, sans compter les boutons
  d'action ; **jamais de recentrage d'un coup de la caméra pendant le
  jeu** (la vue « saute ») : `definirMarges()` ne fait rien si les marges
  n'ont pas changé, et la caméra rejoint sa place en douceur.
- **Affiches** (`lieu › affiches`, `js/monde/affiches.js`) : dessinées sur
  une toile (textes de `data/textes.json`, couleurs de la palette), posées
  contre un mur extérieur, visibles quand il est entier. Une adresse ne
  s'écrit jamais dans les données : un point a un `lien` vers une clé de
  `js/config.js` (`LIENS_CONNUS` dans `schemas.js`), confirmée par Ferrus.
- Accessibilité : cibles ≥ 48 px, contour de focus visible, un seul `<h1>`
  visible, aucune information par la couleur ou le son seuls, animations
  réduites respectées, pas de clignotement ni de chronomètre punitif.

## Tests

```bash
node --test "tests/*.test.mjs"                                   # sans navigateur
node --test --test-concurrency=1 "tests/navigateur/*.test.mjs"   # avec Chromium
```

Les tests navigateur demandent Playwright (`cd tests/navigateur && npm
install && npx playwright install chromium`). Ils couvrent : démarrage,
accessibilité de base, réglages, sauvegarde/export/import/copies, copie
d'urgence, hors ligne, mise à jour proposée, absence de requête externe,
contrastes, et (jalon 1) la scène 3D, le toucher, le clavier, « Aller à… »,
« Examiner », la caméra, le choix du personnage, le petit écran,
(jalon 2) l'horloge, le sommeil, les habitants et les dialogues,
(jalon 3) l'ordinateur, la visio, l'atelier, la livraison et les comptes,
(jalon 4) le journal, la quête suivie, parler à Théo à 16 h, les étapes
facultatives et les commandes du jour, et (jalon 5) la boutique, le
matériel et son bonus, l'aménagement (refus expliqués, tourner, reprendre,
ranger, rechargement) et le panneau compact sur téléphone.
Dans les textes affichés, la typographie met des espaces fines insécables
avant « : ! ? » : normaliser les espaces (`\s+`) avant de comparer.
Petit serveur local : `node outils/serveur.mjs`.
