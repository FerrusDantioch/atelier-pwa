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
- Règles communes de l'écosystème : la version de référence est dans le
  dépôt privé `omni-socle` (`SOCLE.md`). Ferrus n'a pas encore dit si une
  copie adaptée doit figurer ici (ce dépôt est public) : **ne pas la
  recopier sans son accord**.

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
  40). Pas d'ombres calculées.
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
  commande affiche « application fictive ».
- **Portraits** (visio, commandes) : `moteur.photographier()` dessine une
  autre scène dans un coin de la toile et la recopie dans la même tâche
  (`js/monde/portrait.js`) : pas de second moteur 3D.
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
(jalon 2) l'horloge, le sommeil, les habitants et les dialogues, et
(jalon 3) l'ordinateur, la visio, l'atelier, la livraison et les comptes.
Dans les textes affichés, la typographie met des espaces fines insécables
avant « : ! ? » : normaliser les espaces (`\s+`) avant de comparer.
Petit serveur local : `node outils/serveur.mjs`.
