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
- **PNJ n°1** : sa fiche doit être validée avant toute publication. Ce dépôt
  est public : rien la concernant (nom, apparence, rôle, répliques) n'y est
  poussé avant la validation. Voir `docs/PLAN.md` § 5.
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
- **`css/themes.css` est le seul fichier avec des couleurs** (test). Les
  contrastes de toutes les combinaisons (thème × contraste élevé ×
  daltonisme) sont vérifiés par `tests/navigateur/themes.test.mjs`.
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
- **Les règles du jeu** (`js/jeu/`, à partir de J2) restent du JavaScript
  pur, sans 3D ni HTML, pour être testées avec `node --test`.
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
contrastes. Petit serveur local : `node outils/serveur.mjs`.
