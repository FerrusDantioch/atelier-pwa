# Journal du projet — Atelier PWA

## 🧪 Jalon 4 — Les quêtes et le journal (version 0.5.1) — publié, à valider

Fusionné dans `main` le 15 novembre 2026 à la demande de Ferrus (version
0.5.0), pour l'essayer. Version 0.5.1 : les corrections demandées après son
essai sur téléphone (la barre du haut qui changeait de forme, les fenêtres
qui scintillaient, les saccades en marchant) et l'affiche de l'Omni-système
qu'il a demandée. Validation en attente. Les deux quêtes d'Halaé,
et sa nouvelle commande « Mes sous-titres », ont été validées par elle (via
Ferrus) le 15 novembre 2026, telles que proposées.

### Ce qui est fait

- **Cinq quêtes**, une par principe d'accessibilité (`data/quetes.json`) :
  - « Bienvenue à l'atelier » (lisibilité, le mentor) : allumer
    l'ordinateur, livrer la liste de courses ; en facultatif, essayer un
    texte plus grand dans l'atelier ;
  - « Le planning de publication » (simplicité, Halaé) : lui parler,
    livrer son planning ;
  - « Un matin sans surprise » (aide à la routine, Théo) : lui parler à
    16 h (il présente maintenant sa commande de vive voix), la livrer, puis
    lui demander des nouvelles ;
  - « Des sous-titres pour tout le monde » (soutien au quotidien, Halaé,
    pour Karim) : après la commande de Karim, sa commande « Mes
    sous-titres » ; en facultatif, regarder sa nouvelle vidéo à la
    télévision, et en parler à Théo ;
  - « Réviser sans se noyer » (charge cognitive, Théo) : sa seconde
    commande, « Une chose à la fois », puis ses nouvelles.

  Une quête commence toute seule ; elle se termine quand ses étapes
  obligatoires sont faites, et rapporte des pièces et de la réputation.
  Une étape facultative ne bloque jamais et reste possible ensuite. Rien
  n'expire.
- **Le journal** (bouton « Journal » en bas, touche J, ou Pause › Journal
  des quêtes) : les quêtes en cours, leur principe expliqué, leurs étapes
  (« Faite », « Maintenant », « Ensuite », « Facultative », toujours écrit
  en toutes lettres) et leur récompense. « Suivre » choisit la quête dont
  l'étape s'affiche en haut ; « Y aller » emmène là où se joue une étape.
  Les quêtes terminées gardent leur fin.
- **L'objectif en haut** : l'étape en cours de la quête suivie, précisée
  selon la commande (« lis la commande de Théo, au bureau », « termine… »,
  « reprends… »). Si la personne n'est pas là, le jeu dit quand elle
  revient : « Théo n'est pas là pour l'instant : retour prévu à 16 h. »
- **Les commandes du jour** (`data/modeles-commandes.json`) : à partir du
  niveau 3 (« Atelier reconnu »), deux commandes chaque matin, assemblées
  à partir de 8 personnes, 10 sujets et 9 contraintes, toujours
  réussissables « parfaitement ». Celles qu'on n'accepte pas sont
  remplacées le lendemain ; une commande acceptée reste jusqu'à sa
  livraison.
- Une nouvelle fonction dans l'atelier : « Sous-titres ».
- **Un seul message** quand plusieurs choses arrivent ensemble (les
  lecteurs d'écran le lisent en entier) ; la fenêtre de livraison dit aussi
  la fin d'une quête et le début de la suivante.
- **Rejoindre quelqu'un qui marche** : le personnage va là où la personne
  va s'arrêter et l'y attend. Avant, il allait là où elle était, et
  annonçait « Devant Théo » alors que Théo était déjà plus loin.
- Sur un petit écran avec un très grand texte, le bouton « Journal » ne
  garde que son icône (son nom reste lu par les lecteurs d'écran).
- Le français des noms insérés : « Commande d'Antoine », « lis la commande
  d'Halaé », « Impossible de t'approcher du lit » (au lieu de « de le
  lit », une faute qui datait du jalon 1).
- Sauvegarde au format 3 (les commandes du jour acceptées) : une partie de
  la 0.4 est mise à niveau, et ce qui est déjà fait compte (les premières
  quêtes se terminent toutes seules, avec leur récompense).
- **0.5.1 — la barre du haut ne saute plus** : les chiffres de la police
  n'ont pas tous la même largeur (« 14 h 10 » est plus étroit que
  « 14 h 46 ») ; selon l'heure, le bouton Pause tenait sur la première
  ligne ou passait à la suivante, et toute la barre changeait de forme
  chaque minute, en faisant bouger la scène. L'heure garde maintenant la
  place de la plus large de la journée (mesurée dans la police choisie,
  OpenDyslexic compris), et sur petit écran l'objectif et Pause partagent
  la deuxième ligne : une ligne de moins qu'avant.
- **0.5.1 — les fenêtres ne scintillent plus** : le dessus du mur sous la
  fenêtre et celui de l'appui étaient exactement à la même hauteur ; la
  carte graphique hésitait entre les deux à chaque image, d'où des
  rayures qui bougeaient avec la vue. Les traverses dépassent maintenant
  de 1,5 cm.
- **0.5.1 — plus de saccades en marchant** : chaque minute de jeu (une
  seconde réelle), les barres étaient remesurées et la caméra recentrée
  d'un coup sur le personnage, alors qu'elle le suivait en douceur : la
  vue sautait de 15 à 19 pixels (sur tablette, la maison tient entière à
  l'écran et la caméra ne bouge pas : on ne le voyait pas). Les barres ne
  sont plus remesurées que si leurs textes changent, la caméra rejoint sa
  place en douceur, et les boutons d'action (« Examiner… ») ne changent
  plus la place laissée à la scène.
- **0.5.1 — l'affiche de l'Omni-système**, à la demande de Ferrus : près
  de la porte d'entrée (le porte-manteau passe de l'autre côté de la
  porte), avec le logo, le nom et l'adresse du site (celle déjà donnée
  dans « À propos », dans `js/config.js`). On peut la toucher et
  l'examiner : la bulle propose « Découvrir l'Omni-système », qui s'ouvre
  dans un nouvel onglet. Elle se voit quand son mur est entier (dans deux
  des quatre angles de vue).

### Vérifications faites

- 117 tests sans navigateur, dont 23 nouveaux : les affiches (0.5.1), les quêtes (déblocage,
  étapes, facultatives, récompense donnée une seule fois, quête suivie,
  objectif, partie d'une ancienne version, textes validés par Halaé
  inchangés, données fautives refusées), les commandes du jour
  (reproductibles, 300 jours tous réussissables, renouvelées, gardées une
  fois acceptées, fichier trafiqué refusé), la mise à niveau du format 2,
  l'heure de retour d'une personne et le « de » devant un nom (« d'Antoine »).
- 53 tests dans Chromium, dont 8 nouveaux : la barre du haut qui garde
  sa forme d'une minute à l'autre, une marche sans à-coup sur téléphone,
  l'affiche (examiner, lien, mur coupé) (0.5.1), le journal (bouton, touche J,
  Pause, « Y aller »), Théo à 16 h (absent, puis sa commande, puis ses
  nouvelles et la fin de la quête), suivre une autre quête et la
  télévision, les commandes du jour (niveau 3, puis le lendemain), le
  téléphone avec le texte « Énorme ».

### Comment tester sur tablette

1. Nouvelle partie : un message annonce la quête « Bienvenue à
   l'atelier ». Touche « Journal » en bas (ou J) et lis-la.
2. Suis l'objectif en haut : l'appel de Ferrus, puis sa liste de courses.
   Dans l'atelier, essaie un texte plus grand (étape facultative). À la
   livraison, la quête se termine et « Le planning de publication »
   commence.
3. Parle à Halaé, livre son planning. L'objectif devient « parle à Théo,
   vers 16 h » : touche-le avant 16 h pour voir le message, puis attends
   16 h (ou règle « Vitesse du temps »).
4. Parle à Théo : sa commande ; une fois livrée, « Alors, cette
   application ? ».
5. Livre la commande de Karim : la quête des sous-titres commence. Dans le
   journal, « Suivre » change l'objectif du haut.
6. Plus tard (niveau 3), regarde « Commandes du jour » sur l'ordinateur ;
   dors une nuit : celles que tu n'as pas acceptées ont changé.
7. En reprenant une partie de la 0.4.1 : les quêtes déjà faites se
   terminent toutes seules, avec leur récompense.

### Limites connues

- Madeleine, Samia, Karim, Hugo et les personnes des commandes du jour ne
  viennent pas encore au domicile.
- L'argent ne sert pas encore : les achats arrivent au jalon 5.
- L'objectif du haut suit la quête choisie : un projet en cours pour une
  autre commande se retrouve sur l'ordinateur.
- Lors de sa visite, le mentor dit toujours « Bientôt, ton ordinateur
  recevra les premières commandes ».

### En attente

- La validation du jalon 4 par Ferrus.
- Son avis sur les textes de la quête du mentor (« Bienvenue à
  l'atelier ») ; ceux de Théo (personnage fictif) sont à relire s'il le
  souhaite.

## ✅ Jalon 3 — L'ordinateur, les commandes et la création d'applications (version 0.4.1, 15 novembre 2026)

Validé par Ferrus le 15 novembre 2026 (« Tout est bon »), répliques du
mentor en visio comprises. Publié en deux temps dans `main` : la version
0.4.0 le 14 novembre, pour l'essayer sur sa tablette, puis la 0.4.1 le
15 novembre, avec les corrections demandées après cet essai (parois de la
salle d'eau, cheveux d'Halaé, sa commande donnée de vive voix).

### Ce qui est fait

- **L'ordinateur**, au bureau (« Utiliser l'ordinateur ») : une seule
  fenêtre, plusieurs écrans : Commandes, Visio avec Ferrus, Tes comptes.
  Le temps s'arrête tant qu'il est ouvert. En haut, **l'objectif du
  moment** dit quoi faire (« allume ton ordinateur, au bureau ») et y
  emmène d'un toucher.
- **La visio** : au premier allumage, Ferrus appelle. On voit son portrait
  en 3D (une image fixe prise par le moteur du jeu, devant une
  bibliothèque) et il explique l'atelier, une réplique à la fois
  (« Suivant »). Si l'on joue Ferrus, c'est « le vrai Ferrus, depuis le
  monde réel ». On peut le rappeler ensuite : un conseil adapté à la
  situation, ou revoir les explications.
- **Les commandes** (`data/commandes.json`), toutes étiquetées
  « application fictive », chacune autour d'un principe d'accessibilité :
  l'essai du mentor (une liste de courses), Théo (les changements annoncés
  la veille), Madeleine (ses médicaments, très lisibles), Samia (un minuteur
  lancé d'un seul geste), Karim (des rappels qui se voient et se sentent :
  il est sourd), puis Hugo (le strict minimum), qui arrive par le
  bouche-à-oreille (niveau 2 de réputation). Rien n'expire.
- **L'atelier**, le mini-jeu, sans chronomètre : 1. le modèle (liste,
  agenda, minuteur, carnet, fiche) ; 2. les fonctions, avec la **jauge de
  charge** (légère, équilibrée, un peu chargée, trop chargée : en mots ET
  en barre) ; 3. le confort de l'application (taille du texte, contraste,
  police, espacement, animations). L'aperçu, un téléphone, change à chaque
  choix. « Tester comme… » montre ce qu'en pense la personne, point par
  point ; « Livrer » donne **Parfait**, **Bien** ou **À retravailler**,
  avec les explications. Le projet est enregistré à chaque choix, et un
  projet « à retravailler » reste tel quel.
- **L'argent et la réputation** montent à chaque livraison (moins pour un
  « Bien », un peu plus pour chaque petit plus) ; un nouveau niveau est
  annoncé ; « Tes comptes » montre la progression et l'historique.
- **Les clients** Madeleine, Samia, Karim et Hugo (fictifs, proposés dans le
  plan) sont dans `data/pnj.json` ; ils ne viennent pas encore au domicile.
- Au démarrage, le jeu vérifie que chaque commande peut être réussie
  « parfaitement », et que toutes se débloquent même avec des « Bien ».
- **Les visages**, à la demande de Ferrus : la tête est maintenant bien
  ronde, sans arêtes (cheveux, barbe, lunettes et couvre-chefs aussi), avec
  un petit nez et un reflet clair dans les yeux (visibles sur tous les
  teints). La lumière qui « remonte du sol » est plus chaude : la peau
  n'a plus de reflet violet. Le corps garde son style à facettes.
- **La salle d'eau a ses parois**, à la demande de Ferrus : ses cloisons
  montent jusqu'au plafond, opaques jusqu'au genou et translucides
  au-dessus, avec un cadre de porte. On voit bien la séparation, et on
  voit encore à travers (des murs pleins cacheraient les pièces voisines
  dans la vue de trois quarts). Les autres cloisons restent coupées au
  genou.
- **Halaé, la toute première cliente** : quand on lui parle, on peut lui
  demander « Tu as besoin d'une application ? ». Elle présente alors sa
  commande, « Mon planning de vidéos » (validée par elle), qui arrive
  ensuite sur l'ordinateur. Les commandes de Théo, Madeleine, Samia et
  Karim arrivent après la sienne. L'objectif « parle à Halaé » mène
  jusqu'à elle.
- **Halaé a ses cheveux** : longs et noirs (son choix, le 15/11).
- **Teint clair** pour Ferrus et pour Halaé : leur choix (le teint
  « neutre », lilas, avait été mis faute d'information ; il reste au choix
  des joueurs).

### Vérifications faites

- 94 tests sans navigateur, dont les notes (besoin manquant, chose qui
  gêne, confort, fonction inutile, charge), les récompenses, un projet
  importé nettoyé, le déblocage des commandes (celle d'Halaé d'abord
  présentée de vive voix), le niveau 2, les parois de la salle d'eau, et
  la lisibilité des couleurs de l'aperçu (contraste normal et élevé).
- 45 tests dans Chromium, dont 7 nouveaux : premier allumage (temps
  arrêté, portrait, tutoriel, commande d'essai), livraison « Parfait »
  (argent, réputation, nouvelles commandes), « À retravailler » gardé même
  après rechargement puis corrigé, Halaé qui présente sa commande de vive
  voix, jouer Ferrus (« le vrai Ferrus »), clavier (focus, Échap),
  téléphone (pas de défilement de côté, boutons du bas sur deux lignes,
  jauge toujours visible).

### Comment tester sur tablette

1. Nouvelle partie : touche l'objectif en haut ; ton personnage va au
   bureau. Touche « Utiliser l'ordinateur ».
2. « Décrocher » : écoute Ferrus (« Suivant »), puis « Raccrocher ».
3. « Commandes » › « Lire la commande » › « Accepter » : choisis « Liste à
   cocher », ajoute « Partage », puis « Tester comme Ferrus » et « Livrer ».
4. Touche l'objectif « parle à Halaé », puis « Parler à Halaé » › « Tu as
   besoin d'une application ? ». Sa commande arrive sur l'ordinateur :
   prépare-lui son planning (un agenda avec des rappels à l'écran).
5. Prends ensuite la commande de Madeleine et ajoute « Statistiques détaillées » :
   « À retravailler » explique pourquoi. Corrige (texte grand, contraste
   élevé, police très lisible) et livre à nouveau.
6. Regarde l'argent et la réputation monter (en haut, et dans « Tes
   comptes »). Regarde aussi la salle d'eau et ses parois.

### Limites connues

- L'argent ne sert pas encore : les achats arrivent au jalon 5.
- Madeleine, Samia, Karim et Hugo ne viennent pas encore au domicile.
- Le portrait de la visio est une image fixe.
- Lors de sa visite, le mentor dit toujours « Bientôt, ton ordinateur
  recevra les premières commandes », même quand elles sont arrivées
  (phrase validée : à reformuler si Ferrus le souhaite).

## ✅ Jalon 2 — Les habitants et le temps qui passe (version 0.3.0, 14 novembre 2026)

Validé par Ferrus et Halaé le 14 novembre 2026 (fiche d'Halaé et répliques
du mentor comprises), puis fusionné dans `main`. D'éventuelles corrections
seront vues plus tard.

### Ce qui est fait

- **Le temps passe** : 1 seconde = 1 minute de jeu (réglage « Vitesse du
  temps » : normale, lente, arrêtée). L'horloge s'arrête dès qu'une fenêtre
  est ouverte (Pause, dialogue…) et quand le jeu est en arrière-plan. La
  journée va de 7 h à 23 h ; à 23 h l'horloge s'arrête simplement, avec un
  message doux. **Dormir** (près du lit) mène au matin suivant, avec une
  copie de secours de la partie.
- **Les habitants** (`data/pnj.json`), chacun avec sa routine fixe et
  prévisible :
  - **Halaé** vit au domicile et sera la première cliente : petit-déjeuner,
    montage de ses vidéos le matin, tournage l'après-midi (nouveaux coin
    tournage et bureau de montage), repas, détente, repos. Elle se déplace
    en fauteuil roulant rouge (passages d'au moins 1 m, vérifiés).
    Apparence détaillée à venir (neutre en attendant).
  - **Théo**, étudiant voisin, passe chaque jour de 16 h à 17 h.
  - **Ferrus, le mentor**, passe de 10 h à 11 h, sauf quand on joue Ferrus
    (il ne viendra alors qu'en visio, au jalon 3).
  Les visiteurs entrent et sortent par la porte d'entrée ; leurs arrivées
  et départs sont annoncés aux lecteurs d'écran.
- **Parler** : toucher quelqu'un, puis « Parler à Halaé » (ou Entrée). La
  personne s'arrête et se tourne vers toi ; la première fois elle se
  présente, ensuite elle te salue ; « Qu'est-ce que tu fais ? » donne son
  activité du moment. Les personnes présentes sont dans « Aller à… ».
- Les textes des données (descriptions, répliques) suivent maintenant la
  typographie française (espaces fines avant « : ! ? »).

### Vérifications faites

- 80 tests sans navigateur, dont l'horloge (fractions de minute, arrêt à
  23 h, vitesses), les routines, les répliques (toujours les mêmes pour un
  même moment), et les places de chaque personnage atteignables avec SA
  façon de se déplacer (un recoin trop étroit pour un fauteuil est refusé).
- 38 tests dans Chromium, dont : le temps passe et s'arrête en Pause,
  vitesse « arrêtée », 23 h puis « Dormir » (jour 2, copie de secours),
  parler à Halaé (rencontre puis salutation), Théo qui arrive à 16 h et
  repart à 17 h, le mentor absent quand on joue Ferrus.

### Comment tester sur tablette

1. Nouvelle partie : regarde l'heure avancer en haut à droite.
2. « Aller à… » › Halaé, puis « Parler à Halaé » et « Qu'est-ce que tu fais ? ».
3. Attends 10 h (ou règle « Vitesse du temps ») : le mentor passe près du
   bureau (si tu ne joues pas Ferrus).
4. Vers 16 h, Théo entre par la porte et s'installe dans la cuisine.
5. Le soir, va au lit : « Dormir » › le jour 2 commence à 7 h.

### Limites connues

- Les personnages peuvent se croiser ou se frôler en marchant (ils ne
  s'évitent pas encore).
- Pas encore de commandes ni d'argent à gagner : l'ordinateur arrive au
  jalon 3.

### Plus tard

- La description de l'apparence d'Halaé, quand elle le souhaite (neutre en
  attendant). Toute modification de ce qui la concerne lui sera de nouveau
  soumise avant publication.

## ✅ Jalon 1 — Le domicile en 3D (version 0.2.0, 14 novembre 2026)

Validé par Ferrus le 14 novembre 2026, puis fusionné dans `main`.

### Ce qui est fait

- **Choix du personnage** au début d'une partie : jouer **Ferrus Dantioch**
  (cheveux très courts et noirs, lunettes rondes, chemise noire à rayures
  blanches, pantalon bleu, d'après sa description) ou **son personnage** :
  prénom, teint (dont un teint « neutre »), coiffure, couleur des cheveux,
  barbe, lunettes, silhouette, taille, haut (uni ou à rayures), bas
  (pantalon, jupe, short),
  couvre-chef (bonnet, casquette, foulard) et une **aide à la mobilité
  facultative** (fauteuil roulant, canne) avec sa couleur. Aperçu 3D mis à
  jour à chaque choix, bouton « Tout au hasard » (qui ne touche jamais à
  l'aide à la mobilité). Modifiable à tout moment : Pause › Ton personnage.
- **Le domicile en 3D**, vu de trois quarts : chambre, salle d'eau, cuisine
  ouverte et séjour avec le coin bureau ; 25 meubles dessinés par code
  (`data/meubles.json`). Portes de 1 m sans marche, douche à l'italienne,
  lavabo et évier sous lesquels on glisse les genoux, espace de demi-tour
  dans chaque pièce. Les murs du devant et les cloisons sont « coupés » pour
  voir à l'intérieur ; ceux du fond restent entiers, avec leurs fenêtres.
- **Caméra** : 4 angles (boutons ou A / E), zoom limité (pincer, molette,
  + / −, boutons), « Recentrer » (C). Quand toute la maison tient à l'écran,
  la caméra ne bouge pas ; sinon elle suit le personnage, doucement, ou par
  paliers (sans glissement) avec les animations réduites ou le mode calme.
- **Déplacements** : toucher (ou cliquer) le sol ou un meuble, le
  personnage trouve son chemin ; glisser pour déplacer la vue ; clavier
  Z Q S D ou flèches (positions QWERTY acceptées) ; « Aller à… » liste les
  pièces et les objets. En fauteuil roulant, le chemin ne passe que par des
  passages d'au moins 1 m.
- **Examiner** : près d'un meuble, « Examiner le lit » (ou Entrée) ouvre une
  bulle de description. Tout est aussi annoncé aux lecteurs d'écran (pièce
  où l'on entre, objet devant soi, description).
- **Barres fixes** posées sur la 3D ; version **compacte** automatique sur
  petit écran ou avec un très grand texte (libellés courts, objectif sur sa
  propre ligne, valeurs complètes toujours lues par les lecteurs d'écran).
- **Réglages** : luminosité de la scène, qualité graphique (économie,
  standard, haute).
- **Commandes** : fenêtre d'aide (Pause › Commandes) pour le doigt, la
  souris et le clavier.
- **Sauvegarde** (format 2) : personnage, position, angle et zoom de la vue.
  Une partie du jalon 0 est mise à niveau : le personnage est choisi en la
  reprenant.
- **Données vérifiées au démarrage** : lieux, meubles, personnages et
  couleurs de la 3D (`data/`), y compris l'accessibilité : chaque pièce et
  chaque objet à examiner doit être atteignable à pied ET en fauteuil
  roulant, sinon le jeu explique précisément ce qui coince.

### Vérifications faites

- 73 tests sans navigateur, dont : grille, recherche de chemin, passages
  de 1 m en fauteuil, accessibilité complète du domicile (pièces, meubles,
  demi-tour), vérification croisée des données avec messages clairs,
  personnage (prénom, apparence, Ferrus), déplacement pas à pas, sauvegarde
  au format 2 et mise à niveau du format 1.
- 32 tests dans Chromium (tablette tactile 1180 × 820) : scène 3D dessinée,
  toucher le sol puis rechargement (position gardée), toucher un meuble puis
  « Examiner » (bouton, Entrée, Échap), « Aller à… » en fauteuil roulant,
  clavier, boutons de caméra, Ferrus, « Ton personnage » depuis la Pause,
  « Retour » sans rien perdre, qualité « Économie » en cours de partie,
  téléphone avec texte « Énorme », partie du jalon 0 reprise, animations
  réduites et mode calme, et tous les tests du jalon 0 (hors ligne, mise à
  jour, sauvegarde, contrastes…).
- Captures : tablette en paysage et en portrait, téléphone avec texte
  « Énorme », contraste élevé avec thème clair (les meubles ont alors un
  contour sombre).
- Légèreté : environ 14 dessins et 6 000 triangles par image ; rien n'est
  redessiné quand rien ne bouge (la batterie est ménagée).

### Comment tester sur tablette

1. **Nouvelle partie** : crée ton personnage (essaie le fauteuil roulant,
   « Tout au hasard », les flèches pour tourner l'aperçu), ou choisis Ferrus.
2. **Se déplacer** : touche le sol ; touche le lit. Quand « Examiner le lit »
   apparaît en bas, touche-le : la bulle s'ouvre.
3. **La vue** : glisse un doigt pour la déplacer, pince pour zoomer, essaie
   les boutons à droite (tourner, éloigner, rapprocher, recentrer).
4. **Aller à…** : choisis « Douche », puis « Aller dans la cuisine ».
5. **Pause › Ton personnage** : change de coiffure, puis « Enregistrer » ;
   le personnage reste au même endroit.
6. **Sauvegarde** : ferme le jeu, rouvre-le : « Continuer » te remet au même
   endroit, avec le même angle de vue.
7. **Réglages › Scène 3D** : « Économie » si la tablette chauffe ou rame ;
   essaie aussi la luminosité, le contraste élevé et le mode calme.
8. **Hors ligne** : en mode avion, tout marche (la 3D est gardée sur la
   tablette).
9. **Clavier** (si un clavier est branché) : Z Q S D, A / E, + / −, C,
   Entrée, Échap.

### Limites connues

- Le temps ne passe pas encore (jour 1, 8 h 00) : il arrive au jalon 2 avec
  les personnages et leurs routines (le lit servira alors à dormir).
- Ferrus garde un **teint neutre** (lilas), qu'il n'a pas précisé ; il peut
  en demander un autre à tout moment.
- La porte d'entrée ne mène encore nulle part (les bureaux arrivent au
  jalon 5).
- Sur téléphone en portrait avec le texte « Énorme », les barres prennent
  encore environ 40 % de la hauteur de l'écran.
- Testé dans Chromium, le moteur de Brave sur Android (la tablette de
  Ferrus).

### En attente de Ferrus

- La fiche de la PNJ n°1, validée par elle (avant le jalon 2) : rien la
  concernant n'est poussé dans ce dépôt public avant.

## ✅ Jalon 0 — Squelette PWA (version 0.1.0, 14 novembre 2026)

### Ce qui est fait

- **Installation et hors ligne** : fiche d'installation (`manifest.webmanifest`),
  icônes dessinées par code, service worker qui garde une copie de tout le
  jeu (Three.js et polices compris) dès la première visite. Une nouvelle
  version est **proposée** (« Mettre à jour »), jamais imposée ; la partie
  est sauvegardée avant le rechargement.
- **Accueil** : Continuer (avec le résumé de la partie), Nouvelle partie,
  Importer une partie, Réglages, Installer le jeu (avec une aide pour chaque
  appareil), À propos.
- **Bienvenue** au premier lancement : propose de régler le confort et de
  choisir le son (activé ou coupé).
- **Réglages** complets : taille du texte (4 niveaux), thème (violet nuit,
  sombre, clair, auto), contraste élevé, police (très lisible, OpenDyslexic,
  celle de l'appareil), espacement aéré, animations réduites, mode calme,
  son coupé + trois volumes séparés avec « Écouter », mode daltonien
  (rouge-vert, bleu-jaune), « Rétablir les réglages par défaut ». Appliqués
  tout de suite, et avant le premier affichage aux lancements suivants.
- **Sauvegarde** : automatique (IndexedDB), copie d'urgence instantanée en
  quittant, 5 copies de secours, export et import d'un fichier JSON (résumé +
  confirmation, fichiers invalides refusés poliment), reprise d'une copie de
  secours, sauvegarde abîmée remplacée par la dernière copie lisible.
- **Écran de jeu provisoire** : la barre fixe (argent, réputation, objectif,
  jour et heure, Pause), le menu Pause (Échap), et deux boutons de test
  (« Gagner 10 pièces », « Passer au jour suivant ») pour vérifier la
  sauvegarde. Ils disparaîtront au jalon 1.
- **À propos** sur le modèle d'omni-texte : version, « Jeu réalisé par
  Ferrus Dantioch, avec l'aide de l'intelligence artificielle », licence
  CC BY-NC-ND 4.0, confidentialité, crédits des fichiers tiers, contact,
  « Découvrir l'Omni-système ». Les mentions légales viendront au jalon 6.
- **Écran de secours** si le jeu ne démarre pas (avec le détail du problème,
  par exemple une erreur dans un fichier de `data/`).
- **Données** : `data/jeu.json` (équilibrage) et `data/textes.json` (tous les
  textes), vérifiés au démarrage.
- **Documentation** : `README.md`, `CLAUDE.md`, `docs/PLAN.md`,
  `docs/CONTENU.md`, ce journal.

### Vérifications faites

- 51 tests sans navigateur (`node --test "tests/*.test.mjs"`) : réglages,
  format de sauvegarde, import piégé, hasard reproductible, textes présents,
  liste hors ligne complète, CSP, empreintes des fichiers tiers…
- 19 tests dans Chromium, écran de tablette tactile 1180 × 820
  (`tests/navigateur/`) : premier lancement, cibles ≥ 44 px, focus visible,
  Tab qui reste dans les fenêtres, Échap, réglages appliqués et gardés,
  thème « Auto », animations réduites de l'appareil, sauvegarde après
  rechargement, export puis import, copies de secours, copie d'urgence,
  **jeu relancé en mode avion**, **mise à jour proposée puis appliquée**,
  aucune requête vers un autre site, contrastes des 18 combinaisons de
  thèmes (texte ≥ 7, texte secondaire ≥ 4,5, bordures et focus ≥ 3).
- Essai sur un écran de téléphone (360 px) avec le texte « Énorme » : rien
  ne déborde.

### Comment tester sur tablette

Le hors-ligne ne fonctionne que sur une adresse sécurisée (https) : le plus
simple est GitHub Pages.

1. **Mettre le jeu en ligne** (au choix) :
   - activer GitHub Pages sur la branche de travail : dépôt *atelier-pwa* →
     *Settings* → *Pages* → *Branch* : la branche du jalon, dossier `/ (root)` ;
   - ou fusionner la branche dans `main` et publier `main`.
   L'adresse sera `https://ferrusdantioch.github.io/atelier-pwa/`.
2. **Premier lancement** : la fenêtre de bienvenue s'ouvre. Choisir « Régler
   le confort maintenant », essayer chaque réglage (taille du texte, thème,
   contraste, police, espacement, sons avec « Écouter »).
3. **Installer** : bouton « Installer le jeu » de l'accueil (ou menu du
   navigateur). Ouvrir le jeu depuis son icône.
4. **Hors ligne** : passer la tablette en mode avion, fermer puis rouvrir le
   jeu. Il doit se lancer normalement.
5. **Sauvegarde** : Nouvelle partie → « Gagner 10 pièces » deux fois →
   fermer le jeu (le balayer des applications récentes) → le rouvrir :
   « Continuer » doit afficher 120 pièces.
6. **Export / import** : Pause → Sauvegarde → « Exporter ma partie » (un
   fichier est enregistré) → Nouvelle partie → Pause → Sauvegarde →
   « Importer une partie » → choisir le fichier → « Remplacer ma partie ».
7. **Copies de secours** : « Passer au jour suivant », puis Sauvegarde →
   Copies de secours → « Reprendre cette copie ».
8. **Clavier** (si un clavier est branché) : Tab pour avancer, Entrée pour
   valider, Échap pour fermer une fenêtre ou ouvrir la Pause.

### Limites connues

- Sur un téléphone en portrait avec le texte « Énorme », la barre du haut
  prend beaucoup de place. Elle sera repensée au jalon 1, quand elle passera
  par-dessus la scène 3D.
- La musique n'existe pas encore (seulement les sons d'essai des réglages).
- Les réglages de luminosité, de qualité graphique et de vitesse du temps
  arriveront avec la 3D (jalons 1 et 2).

### En attente de Ferrus

Voir `docs/PLAN.md` § 7 : les deux Ferrus (avant J1), la PNJ n°1 (avant J2),
la tablette de test et la mise en ligne, puis les vraies applications et les
mentions légales (avant J6), et l'accord pour recopier les règles communes.
