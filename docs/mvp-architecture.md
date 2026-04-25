# Architecture MVP - Moteur de generation de parcours

## 1) Contexte produit

Le projet vise a resoudre un probleme simple: marcher regulierement sans refaire toujours les memes boucles. L'application propose automatiquement un parcours local, en boucle, autour d'un point de depart choisi (ou geolocalise), pour une duree cible d'environ une heure.

Objectifs fonctionnels:

- retour au point de depart garanti,
- variation quotidienne des trajets,
- parcours credibles pour la marche a pied,
- temps de calcul court (objectif inferieur a 3 secondes).

## 2) Principes de conception du MVP

Le MVP suit trois principes:

1. **Simplicite operationnelle**
   - Le plus possible de logique locale.
   - Tres peu d'appels a des APIs externes.

2. **Qualite percue**
   - Itineraires non repetitifs.
   - Boucles naturelles, pas de simple aller-retour deguises.

3. **Architecture evolutive**
   - Ports et adapters pour changer les implementations sans toucher la logique metier.
   - Separation claire entre domaine, application et infrastructure.

## 3) Pipeline de generation (vue d'ensemble)

Le pipeline se decompose en 6 etapes:

1. Generation de candidats geometriques (ellipses + waypoints).
2. Validation locale sur le reseau marchable.
3. Pre-filtrage local avec score de nouveaute.
4. Routing externe sur les meilleurs candidats.
5. Scoring final multi-criteres.
6. Selection et affichage du meilleur parcours.

L'idee cle est de faire les etapes couteuses (APIs de routing) uniquement sur un petit nombre de candidats deja prometteurs.

## 4) Details des etapes

### 4.1 Generation de candidats

- Plusieurs ellipses aleatoires sont creees autour du point de depart.
- Le point de depart est place sur l'ellipse pour garantir la fermeture de boucle.
- 2 a 3 waypoints sont projetes sur l'ellipse pour produire des parcours differents.
- Chaque candidat contient une geometrie theorique, pas encore routable.

### 4.2 Validation locale (sans API)

- Les waypoints sont "snappes" vers des segments marchables issus des donnees OSM locales.
- Les points trop loin d'un chemin valide sont rejetes.
- Turf.js est utilise pour les calculs geometriques (distance, projection, echantillonnage).

Cette etape agit comme un filtre de faisabilite rapide avant toute requete reseau.

### 4.3 Pre-filtrage local

- Chaque ellipse est echantillonnee en points regulierement espaces.
- Les points sont projetes dans une grille de cellules (~100 m).
- Un score de nouveaute est calcule selon l'historique utilisateur (zones deja visitees).
- Seuls les 3 a 5 meilleurs candidats passent a l'etape suivante.

### 4.4 Routing externe

- L'app appelle un provider de routing (OpenRouteService / GraphHopper, etc.).
- Le routage construit une boucle praticable a partir du depart + waypoints.
- Le nombre d'appels est limite (3 a 5 max) pour controler cout et latence.

### 4.5 Scoring final

Deux familles de score sont combinees:

- **Nouveaute:** favorise les zones peu explorees.
- **Qualite de boucle:** penalise les trajets en aller-retour et les geometries peu fluides.

Le candidat ayant le meilleur compromis est selectionne comme trajet final.

### 4.6 UX minimale

Le MVP expose un flux volontairement court:

- afficher la carte et le trace du parcours,
- `Generer` pour proposer une boucle,
- `Regenerer` pour demander une alternative,
- `Termine` pour enregistrer l'historique local.

## 5) Architecture logicielle

Le coeur du systeme est organise en couches:

- `domain/`
  - entites metier (`WalkRoute`, `WalkCandidate`, `Ellipse`, `Waypoint`),
  - services de domaine (generation d'ellipse, generation de waypoints, calcul distance),
  - ports abstraits (ex: aleatoire, generation).

- `application/`
  - use cases (`GenerateWalkRouteUseCase`, etc.),
  - orchestration du pipeline,
  - ports d'entree/sortie (routing, generation).

- `infrastructure/`
  - adapters techniques (random, generation, API routing),
  - implementations concretes branchees sur les ports.

Cette structure permet de tester facilement la logique metier et de remplacer un provider externe sans casser le domaine.

## 6) Performance et contraintes

Contraintes explicites du MVP:

- temps cible de generation: **< 3 secondes**,
- appels API strictement limites,
- logique locale prioritaire.

Le pre-filtrage local est la cle: il reduit fortement les appels externes tout en augmentant la pertinence des candidats routables.

## 7) Evolution apres MVP

Pistes prevues:

- detours intelligents (parcs, littoral, rues plus agreables),
- ajout de waypoints "intentionnels" pour guider le parcours,
- backend de centralisation (historique, scoring avance, analytics),
- personnalisation utilisateur (distance preferee, type de quartiers, niveau de variation).

## 8) Definition de succes

Le MVP est reussi si:

- l'utilisateur obtient rapidement une boucle coherent,
- les parcours semblent differents d'un jour a l'autre,
- l'experience est simple (peu d'ecrans, peu de friction),
- la base technique est suffisamment propre pour evoluer vers un moteur plus intelligent.
