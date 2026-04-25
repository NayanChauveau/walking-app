# Walking App

Application mobile Expo / React Native qui genere automatiquement des parcours de marche en boucle autour d'un point de depart. L'utilisateur revient au meme endroit apres environ 1 heure de marche (environ 10 000 pas), avec un objectif central: proposer un trajet different chaque jour pour eviter la monotonie.

## Vision du projet

Le produit cherche a construire un moteur de generation de parcours:

- non repetitifs (score de nouveaute base sur l'historique),
- agreables (qualite de boucle et limitation des aller-retour),
- locaux (zone proche du point de depart),
- rapides (cible de generation inferieure a 3 secondes).

Le MVP privilegie la simplicite: maximum de calcul local, peu d'appels reseau, et une UX minimale orientee action.

## Fonctionnement du MVP

1. **Generation de candidats**
   - Creation de plusieurs ellipses aleatoires autour du depart.
   - Generation de 2 a 3 waypoints par ellipse.
   - Depart positionne sur l'ellipse pour garantir une boucle.

2. **Validation locale (sans API)**
   - Snap des points sur un reseau marchable local (OpenStreetMap).
   - Rejet des points trop eloignes d'un chemin valide.
   - Geometrie locale avec Turf.js (distances, projections).

3. **Pre-filtrage local**
   - Echantillonnage des ellipses en points intermediaires.
   - Conversion en grille de cellules (environ 100 m).
   - Calcul d'un score de nouveaute base sur l'historique utilisateur.
   - Conservation des 3 a 5 meilleurs candidats seulement.

4. **Routing externe**
   - Appels a une API de routing (ex: OpenRouteService ou GraphHopper).
   - Generation des boucles completes.
   - Nombre d'appels limite (max 3 a 5) pour maitriser latence et cout.

5. **Scoring final**
   - Score de nouveaute (zones peu explorees).
   - Score de qualite de boucle (eviter les segments aller-retour).
   - Selection du meilleur trajet a afficher.

6. **UX minimale**
   - Affichage carte + trace du parcours.
   - Boutons `Generer`, `Regenerer`, `Termine`.
   - Stockage local de l'historique de marche.

## Architecture technique

- **Mobile only (MVP):** pas de backend obligatoire.
- **Domain layer isolee:** logique metier separee de l'UI et des APIs.
- **Calcul local prioritaire:** generation, validation et pre-scoring sur device.
- **Routing externalise:** service dedie uniquement a la construction de trajets complets.

Le module principal est situe dans `src/modules/walk-route`, avec une separation claire:

- `domain/` pour les entites et services metier,
- `application/` pour les use cases et ports,
- `infrastructure/` pour les adapters (random, generation, routing).

## Lancer le projet

```bash
npm install
npm run start
```

Scripts utiles:

- `npm run ios`
- `npm run android`
- `npm run web`
- `npm run lint`

## Documentation complementaire

- `docs/mvp-architecture.md`: detail du pipeline de generation, scoring, contraintes et evolutions futures.
