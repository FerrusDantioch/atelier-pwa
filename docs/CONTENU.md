# Modifier le contenu du jeu sans coder

Tout le contenu du jeu est rangé dans le dossier `data/`, dans des fichiers
au format JSON (du texte structuré, lisible avec n'importe quel éditeur de
texte). Ce guide s'enrichira à chaque jalon (personnages, quêtes, meubles,
lieux, applications…).

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

## Après une modification

1. Recharger le jeu (ou lancer les tests) pour vérifier.
2. Avant de publier : augmenter `version` dans `js/config.js`, sinon les
   joueurs qui ont installé le jeu gardent l'ancienne version.

## Ajouter un nouveau fichier de données (pour le code)

1. Le décrire dans `js/noyau/schemas.js` (liste `FICHIERS_DONNEES`).
2. L'ajouter à la liste `FICHIERS` de `sw.js`, pour qu'il soit disponible
   hors ligne (un test le vérifie).
