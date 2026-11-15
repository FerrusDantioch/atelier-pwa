# Modifier le contenu du jeu sans coder

Tout le contenu du jeu est rangé dans le dossier `data/`, dans des fichiers
au format JSON (du texte structuré, lisible avec n'importe quel éditeur de
texte). Ce guide s'enrichit à chaque jalon : textes, équilibrage, lieux,
meubles, personnages et couleurs de la 3D (jalon 1) ; personnages non
joueurs, quêtes et applications ensuite.

## Les règles d'écriture JSON, en bref

- Les textes sont **entre guillemets droits** : `"Bonjour"`.
- Les éléments sont **séparés par des virgules**, mais **pas de virgule après
  le dernier** d'un groupe.
- Une apostrophe s'écrit normalement (`"l'atelier"`) ; un guillemet droit dans
  un texte s'écrit `\"` (préférer les guillemets français « »).
- Les nombres s'écrivent sans guillemets : `"argent": 100`.

Pas d'inquiétude en cas d'erreur : au lancement, le jeu vérifie chaque
fichier. S'il y a un problème, il ne démarre pas à moitié : il affiche la
liste précise des erreurs, par exemple :

```
data/jeu.json : erreur d'écriture à la ligne 4, colonne 7 (virgule, guillemet ou accolade ?)
data/jeu.json › depart › argent : un nombre est attendu (reçu : "cent")
```

On peut aussi vérifier sans ouvrir le jeu : `node --test "tests/*.test.mjs"`.

## `data/textes.json` — les textes de l'interface

Les textes sont rangés par groupes (`accueil`, `reglages`, `sauvegarde`…).
On peut changer librement le texte entre guillemets, **jamais le nom à
gauche** (le code s'en sert pour retrouver le texte).

- `{nom}`, `{version}`, `{jour}`… sont remplacés par une valeur : les garder
  tels quels.
- Les textes au singulier et au pluriel ont deux formes : `un` et
  `plusieurs` (« 1 pièce », « 5 pièces » ; en français, 0 est au singulier).
- La typographie française est **automatique** : écrire simplement une
  espace avant `! ? : ; %` et après `«` ; le jeu la transforme en espace
  fine insécable (le signe ne se retrouve jamais seul en début de ligne).
- Le ton : **tutoiement**, et des phrases qui ne supposent pas le genre du
  joueur (« C'est parti ! » plutôt que « Tu es prêt ? »). Un test refuse
  « vous », « votre » et « vos ».

Seuls deux textes sont écrits ailleurs, dans `index.html` : « Chargement… »
et l'écran « Le jeu n'a pas pu démarrer », qui doivent s'afficher même si
`textes.json` est abîmé.

## `data/jeu.json` — l'équilibrage

| Champ | Rôle |
|---|---|
| `monnaie.singulier`, `monnaie.pluriel` | nom de la monnaie du jeu (« pièce », « pièces ») |
| `depart.argent`, `depart.reputation` | ce que le joueur a en commençant |
| `depart.lieu`, `depart.jour`, `depart.heure` | où et quand la partie commence (`"08:00"`) |
| `reputation.paliers` | les niveaux de réputation : `niveau` (1, 2, 3…), `nom`, `points` nécessaires ; le premier est à 0 point, les points augmentent d'un palier à l'autre |
| `sauvegarde.intervalleSecondes` | toutes les combien de secondes la partie est sauvegardée s'il y a du nouveau (5 à 600) |
| `sauvegarde.copiesDeSecours` | nombre de copies de secours gardées (1 à 20) |
| `deplacement.vitesse` | vitesse des personnages, en mètres par seconde (0,5 à 6) |

## Les lieux : `data/lieux/`

`data/lieux/index.json` liste les lieux (`id` et `fichier`). **Ajouter un
lieu** : créer son fichier, l'ajouter à l'index, et à la liste `FICHIERS` de
`sw.js` (pour le hors-ligne).

Un lieu est posé sur une **grille de cases de 50 cm** : `"taille": [20, 16]`
fait 10 m × 8 m. La case `x = 0, z = 0` est en haut à gauche du plan
(au nord-ouest) ; `x` va vers l'est, `z` vers le sud.

| Champ | Rôle |
|---|---|
| `id`, `nom`, `designation` | identifiant, nom affiché, nom dans une phrase (« ton domicile ») |
| `taille` | largeur et profondeur, en cases |
| `hauteurMurs` | hauteur des murs entiers, en mètres |
| `depart` | case d'arrivée (`x`, `z`) et direction du regard (`angle` : 0 sud, 90 est, 180 nord, 270 ouest) |
| `pieces` | chaque pièce : `id`, `nom`, `designation` (« la cuisine »), `zones` (rectangles `[x, z, largeur, profondeur]`), `sol` (`motif` : `uni`, `lames` ou `damier`, et une ou deux couleurs de la palette), et `paroisHautes` (facultatif) : des cloisons jusqu'au plafond, translucides au-dessus du genou, pour une pièce à bien séparer (la salle d'eau) |
| `murs` | segments sur les lignes de la grille : `{ "de": [x, z], "a": [x, z] }`, horizontaux ou verticaux |
| `ouvertures` | sur un mur : `porte` (passage libre), `porte-entree` (porte fermée), `fenetre` |
| `meubles` | `id` unique, `meuble` (du catalogue), case `x`, `z` (coin nord-ouest de l'emprise), `rotation` (0, 90, 180, 270), et une `description` facultative propre à ce lieu |
| `points` | endroits à examiner qui ne sont pas des meubles (porte d'entrée…) : `id`, `nom`, `designation`, `description`, case et `angle` |

Au démarrage (et dans les tests), le jeu vérifie que le lieu **tient
debout** (pièces dans la grille, ouvertures posées sur un mur, meubles qui
ne se chevauchent pas…) et qu'il est **accessible** : depuis le départ,
chaque pièce, chaque meuble à examiner et chaque point doivent être
atteignables à pied ET en fauteuil roulant. En fauteuil, il faut des
passages d'au moins 1 m (2 cases) : une porte de 50 cm est refusée avec un
message clair, par exemple :

```
data/lieux/domicile.json › pieces › chambre : impossible d'y entrer en fauteuil roulant (passages d'au moins 1 m)
```

## Le catalogue des meubles : `data/meubles.json`

| Champ | Rôle |
|---|---|
| `id`, `nom` | identifiant et nom affiché (« Lit ») |
| `designation`, `description` | facultatives ensemble : « le lit » et le texte de « Examiner ». Sans description, le meuble est un simple décor |
| `emprise` | largeur et profondeur au sol, en cases, face avant vers le sud |
| `bloque` | `false` pour un meuble qu'on peut traverser (tapis) |
| `formes` | la « recette » 3D, en mètres, autour du centre de l'emprise (`y = 0` au sol) |

Chaque forme : `"forme"` (`boite`, `cylindre` ou `sphere`), `"position"`
`[x, y, z]` (son centre), `"couleur"` (un nom de la palette), et :
`"taille"` `[largeur, hauteur, profondeur]` pour une boîte ; `"rayon"` et
`"hauteur"` pour un cylindre (`"rayonHaut"` pour un tronc de cône,
`"cotes"` pour le nombre de faces) ; `"rayon"` pour une sphère à facettes.
`"rotation"` `[x, y, z]` (en degrés) est facultative.

## Les personnages : `data/personnages.json`

- `ferrus` : le personnage de Ferrus (nom, présentation, apparence décrite
  par lui). `apparenceProvisoire: true` afficherait « apparence encore
  provisoire » sur l'écran de choix.
- `prenomsProposes` : les prénoms proposés au hasard (épicènes).
- `defaut` : l'apparence de départ d'un nouveau personnage.
- `options` : pour chaque élément (teint, coiffure, haut, motif du haut…),
  la liste des choix `{ "id", "nom", "couleur" }`. On peut retirer des choix, en ajouter
  de couleur, ou renommer ; les formes (coiffures, couvre-chefs, aides…)
  doivent être connues du jeu : le test le vérifie.

## Les personnages non joueurs : `data/pnj.json`

| Champ | Rôle |
|---|---|
| `id`, `nom` | identifiant et nom affiché (le mentor prend le nom de Ferrus : `"modele": "ferrus"`) |
| `presentation` | une phrase lue dans la fenêtre de dialogue |
| `apparence` | comme celle d'un personnage joueur (voir `data/personnages.json`) ; l'aide à la mobilité décide de la façon de se déplacer |
| `absentSiJoueur` | `"ferrus"` : absent quand on joue Ferrus (le mentor) |
| `routine` | les créneaux `{ "de": "08:00", "a": "12:00", "lieu": "domicile", "point": "montage", "activite": "montage" }`, dans l'ordre, entre 7 h et 23 h. Hors créneau : la personne n'est pas là |
| `activites` | pour chaque activité : `description` (« monte sa prochaine vidéo ») et ses `repliques` |
| `repliques` | `rencontre` (la première fois) et `salut` (ensuite) ; obligatoires pour qui vient dans un lieu |
| `visio` | (le mentor) les répliques de l'appel en visio : `accueil` (`joueurFerrus` quand on joue Ferrus, `autre` sinon, avec `{nom}`), `tutoriel` (une réplique par « Suivant »), `conseils` (`aRetravailler`, `enCours`, `offres`, `general`) et `auRevoir` |

Une cliente ou un client qui ne vient pas encore dans un lieu (Madeleine,
Samia, Karim, Hugo) a simplement une `routine` vide : il ou elle passe
commande sur l'ordinateur.

Les `point` sont des places définies dans le lieu (liste `points`, sans
description). Le jeu vérifie que chacune est atteignable **depuis la porte
d'entrée** avec la façon de se déplacer de la personne (en fauteuil
roulant : passages d'au moins 1 m). Les visiteurs entrent et sortent par
le point `porte-entree`.

Dans `data/jeu.json`, `temps` règle la journée : `debutJournee`,
`finJournee` et `minutesParSeconde` (1 = une minute de jeu par seconde).
Un meuble peut avoir des `actions` en plus de « Examiner » : `"dormir"`
pour un lit, `"ordinateur"` pour le bureau.

## Le mini-jeu de création : `data/creation.json`

- `modeles` : la base d'une application (`liste`, `agenda`, `minuteur`…),
  avec ce qu'elle `apporte` (des mots-clés, voir plus bas), sa `capacite`
  (la charge qu'elle supporte sans devenir fatigante) et les lignes de son
  `apercu`.
- `fonctions` : ce qu'on ajoute (rappels à l'écran, vibration…), avec ce
  qu'elle `apporte`, sa `charge`, son `icone` (facultative) et la ligne
  montrée dans l'aperçu.
- `confort` : les réglages de l'application (taille du texte, contraste,
  police, espacement, animations), leurs `valeurs` et le `defaut`.
- `bareme` : `toleranceCharge` (au-delà de la capacité : « un peu chargée »
  jusqu'à cette marge, puis « trop chargée ») et la part de la récompense
  pour une note « Bien ».

Les **apports** (`"cocher"`, `"rappel-ecran"`, `"prevoir"`…) relient tout :
une commande dit ce dont la personne a besoin avec ces mots-clés, les
modèles et les fonctions disent ce qu'ils apportent.

## Les commandes : `data/commandes.json`

| Champ | Rôle |
|---|---|
| `id`, `client` | identifiant, et la personne qui commande (un `id` de `data/pnj.json`) |
| `enPersonne` | facultatif : `true` si la personne présente sa commande de vive voix (il faut lui parler : « Tu as besoin d'une application ? ») avant qu'elle arrive sur l'ordinateur. La personne doit venir dans un lieu |
| `titre`, `resume`, `demande` | le nom de l'application, une ligne de résumé, et la demande dans les mots de la personne |
| `besoins` | `{ "apporte", "texte" }` : ce qui doit être couvert (sinon « À retravailler ») |
| `bonus` | les petits plus : ils ne changent pas la note, mais rapportent `recompense.bonus` pièces chacun |
| `aEviter` | ce qui gêne la personne (sinon « À retravailler ») |
| `avis` | facultatif : ce que la personne dit d'une fonction qui ne lui sert à rien (`"alarme-sonore": "…"`) |
| `chargeMax` | facultatif : une charge plus basse que celle du modèle (« le moins de boutons possible ») |
| `confort` | `{ "reglage", "valeurs", "texte" }` : les réglages qui conviennent (sinon « Bien » au mieux) |
| `apercu` | facultatif : les lignes de l'aperçu pour un modèle (`"liste": ["Matin · comprimé rond"]`) |
| `recompense` | `argent`, `reputation` et `bonus` (pièces par petit plus) |
| `debloquee` | facultatif : `drapeau` (`"visio-accueil"` = après l'appel du mentor), `apres` (commandes livrées avant) et `niveau` (de réputation) |
| `reactions` | ce que dit la personne pour chaque note : `parfait`, `bien`, `aRetravailler` |

Toutes ces applications sont **fictives** : le jeu l'affiche sur chaque
commande. Au démarrage, le jeu vérifie que chaque commande peut être
réussie « parfaitement », et que toutes finissent par se débloquer même si
l'on n'obtient que des « Bien ».

## Les couleurs de la 3D : `data/palette.json`

Toutes les couleurs des meubles, des sols, des murs et des personnages,
rangées par nom (`"bois-clair": "#dcb98e"`). Changer une couleur ici la
change partout. Les couleurs de l'interface (boutons, textes) sont à part,
dans `css/themes.css`.

## Après une modification

1. Recharger le jeu (ou lancer les tests) pour vérifier.
2. Avant de publier : augmenter `version` dans `js/config.js`, sinon les
   joueurs qui ont installé le jeu gardent l'ancienne version.

## Ajouter un nouveau fichier de données (pour le code)

1. Le décrire dans `js/noyau/schemas.js` (liste `FICHIERS_DONNEES`).
2. L'ajouter à la liste `FICHIERS` de `sw.js`, pour qu'il soit disponible
   hors ligne (un test le vérifie).
