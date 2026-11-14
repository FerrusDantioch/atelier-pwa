# Journal du projet — Atelier PWA

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
