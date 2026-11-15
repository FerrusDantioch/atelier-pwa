# Atelier PWA *(titre provisoire)*

Un jeu de simulation calme, en 3D « low-poly » vue de trois quarts : tu crées
des applications pour aider tes voisins, tu gagnes ta vie, puis tu aménages
et modernises ton lieu de travail. Le jeu présente aussi les vraies
applications de **Ferrus Dantioch**, conçues pour aider les autres, en
particulier les personnes en situation de handicap.

- Pas de compte, pas de publicité, pas de suivi : tout reste sur l'appareil.
- Fonctionne **sans connexion** une fois installé.
- Pensé d'abord pour la **tablette** (tactile), jouable à la souris et au
  clavier (AZERTY).
- Pas de chronomètre, pas de partie perdue, pause possible à tout moment.

## Où en est le jeu ?

Le jeu se construit par étapes (« jalons »), chacune validée avant la suivante.
Le détail est dans [`docs/JOURNAL.md`](docs/JOURNAL.md), le plan complet dans
[`docs/PLAN.md`](docs/PLAN.md).

| Jalon | Contenu | État |
|---|---|---|
| J0 | Squelette : installation, hors ligne, réglages, sauvegarde | ✅ livré (version 0.1.0) |
| J1 | Le domicile en 3D, caméra, déplacements, choix du personnage | ✅ livré (version 0.2.0) |
| J2 | Personnages, routines, dialogues | ✅ livré (version 0.3.0) |
| J3 | L'ordinateur : commandes et création d'applications | 🧪 publié, à valider (version 0.4.1) |
| J4 | Quêtes et journal (premier livrable jouable) | à venir |
| J5 | Progression, bureaux, nouveaux lieux | à venir |
| J6 | Vitrine des vraies applications, À propos, finitions | à venir |

## Jouer

- **Ton personnage** : joue Ferrus Dantioch, ou crée ton personnage (prénom,
  apparence, et une aide à la mobilité facultative : fauteuil roulant ou
  canne, sans effet sur les règles du jeu).
- **Se déplacer** : touche (ou clique) le sol ou un meuble ; ou choisis une
  destination dans « Aller à… » ; ou utilise le clavier.
- **Examiner** : près d'un meuble, touche « Examiner » (ou Entrée).
- **Parler** : touche quelqu'un, puis « Parler à… » (ou Entrée). Les
  habitants suivent chacun leur journée, toujours la même.
- **Le temps** : une minute de jeu par seconde (réglable, ou arrêté) ; il
  s'arrête dès qu'une fenêtre est ouverte. Le soir, « Dormir » près du lit.
- **L'ordinateur** (au bureau, « Utiliser l'ordinateur ») : la visio avec
  Ferrus, les commandes des voisins (applications fictives), l'atelier de
  création et tes comptes. Toucher l'objectif, en haut, t'y emmène.
  Halaé, ta toute première cliente, vit avec toi : c'est en lui parlant
  qu'elle te présente sa commande.
- **Créer une application** : choisis un modèle, ajoute les fonctions utiles
  (pas trop : chaque fonction pèse dans la « charge »), règle le confort,
  teste comme la personne, puis livre. Parfait, Bien ou À retravailler :
  rien n'est jamais perdu, et il n'y a pas de chronomètre.
- **La vue** : glisse un doigt pour la déplacer, pince ou utilise la molette
  pour zoomer ; les boutons à droite tournent, zooment et recentrent.

| Clavier (AZERTY ; positions QWERTY acceptées) | Effet |
|---|---|
| Z Q S D ou flèches | se déplacer |
| A / E | tourner la vue d'un quart de tour |
| + / − | rapprocher / éloigner la vue |
| C | recentrer la vue |
| Entrée ou Espace | examiner l'objet proche |
| Échap | pause, ou fermer une fenêtre |

## Confort et accessibilité

Dès le premier lancement, puis à tout moment (menu Pause) :

- taille du texte (4 niveaux), contraste élevé, police très lisible
  (Atkinson Hyperlegible) ou OpenDyslexic, espacement du texte aéré ;
- thèmes violet nuit, sombre, clair ou automatique ;
- animations réduites (suit le réglage de l'appareil par défaut) ;
- son coupé, ou trois volumes séparés (musique, effets, voix) ;
- mode daltonien (rouge-vert, bleu-jaune) ;
- mode calme (pas d'événements imprévus, moins de mouvements) ;
- luminosité de la scène 3D et qualité graphique (« Économie » pour les
  appareils modestes et la batterie).

Le domicile est accessible en fauteuil roulant (passages d'au moins 1 m,
douche à l'italienne, espace de demi-tour dans chaque pièce) : le jeu le
vérifie lui-même pour chaque lieu. Tout ce que montre la 3D existe aussi en
texte (« Aller à… », descriptions, annonces pour les lecteurs d'écran).

Grands boutons (48 px), contour de focus bien visible, navigation complète au
clavier, Échap pour fermer une fenêtre, textes lus par les lecteurs d'écran.
Aucune information ne passe uniquement par la couleur ou par le son.

## Jouer et installer

Une fois publié sur GitHub Pages, le jeu sera à l'adresse
`https://ferrusdantioch.github.io/atelier-pwa/` *(à confirmer à la mise en ligne)*.

- **Android** : menu du navigateur (⋮), puis « Installer l'application ».
  Sur Chrome, une seule application de ce site peut parfois être installée :
  si une autre application de Ferrus est déjà installée, passer par Brave.
- **iPad / iPhone** : bouton Partager, puis « Sur l'écran d'accueil ».
- **Ordinateur** : icône d'installation dans la barre d'adresse.

## Ta partie

- Sauvegarde automatique sur l'appareil (après chaque événement important,
  régulièrement, et en quittant le jeu).
- **Copies de secours** automatiques (les 5 plus récentes) : une à chaque
  nouveau jour, et avant chaque import ou nouvelle partie.
- **Exporter / importer** la partie dans un fichier, pour la garder ailleurs
  ou changer d'appareil.

## Pour développer

Aucune étape de compilation : les fichiers du dépôt sont publiés tels quels.
Il faut seulement [Node.js](https://nodejs.org/) pour le petit serveur local
et les tests.

```bash
node outils/serveur.mjs             # puis ouvrir http://localhost:8080
node --test "tests/*.test.mjs"      # tests sans navigateur (rien à installer)

# Tests dans un vrai navigateur (une seule installation) :
cd tests/navigateur && npm install && npx playwright install chromium && cd ../..
node --test --test-concurrency=1 "tests/navigateur/*.test.mjs"
```

### Publier une nouvelle version

1. Augmenter `version` dans [`js/config.js`](js/config.js) (ex. 0.1.0 → 0.1.1).
   **Sans ce changement, les joueurs gardent l'ancienne version.**
2. Si un fichier a été ajouté au jeu : l'ajouter à la liste `FICHIERS` de
   [`sw.js`](sw.js) (les tests le vérifient).
3. Lancer les tests, puis envoyer sur la branche publiée par GitHub Pages.

Le jeu propose alors « Mettre à jour » aux joueurs : rien ne change sans leur
accord, et la partie est sauvegardée juste avant.

### Modifier le contenu sans coder

Tout le contenu (textes, équilibrage, lieux, meubles, personnages, couleurs
de la 3D, puis quêtes et applications) est dans `data/`. Mode d'emploi :
[`docs/CONTENU.md`](docs/CONTENU.md). Si un fichier contient une erreur, le
jeu ne démarre pas à moitié : il affiche la liste précise des problèmes.

### Organisation des fichiers

```
index.html, manifest.webmanifest, sw.js   la page, l'installation, le hors-ligne
css/          themes.css (seul fichier avec des couleurs), base.css, interface.css
js/config.js  nom, version, contact, préfixe de stockage
js/noyau/     données (et leur vérification), textes, réglages, sauvegarde, sons, mises à jour
js/jeu/       les règles du jeu, sans 3D (personnage…)
js/monde/     la 3D : moteur, caméra, lieu, grille, chemins, gestes, clavier
js/modeles/   les modèles 3D fabriqués par code (formes, meubles, personnage)
js/interface/ les écrans HTML (accueil, choix du personnage, jeu, réglages…)
data/         tout le contenu modifiable
lib/three/    Three.js (moteur 3D), copié tel quel
assets/       icônes, logo de l'Omni-système, polices
outils/       serveur local, mise à jour des fichiers tiers, icônes
tests/        tests automatiques
docs/         plan, journal, guide du contenu
```

Fichiers d'autres auteurs (Three.js, polices) : voir
[`licences-tierces.txt`](licences-tierces.txt), avec leurs empreintes.
Pour les mettre à jour : `node outils/embarquer-tiers.mjs`.

## Licence

© 2026 Ferrus Dantioch — code sous licence
[Creative Commons BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/deed.fr) :
partage autorisé en citant l'auteur, sans usage commercial ni modification.
Texte complet : [`LICENSE`](LICENSE). Le logo et les textes de l'Omni-système
sont protégés (tous droits réservés).

Jeu réalisé par Ferrus Dantioch, avec l'aide de l'intelligence artificielle.
