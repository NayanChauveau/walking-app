# Roadmap Incrémentale - Génération de route walking (Mapbox + H3)

Objectif: implémenter progressivement le pipeline de génération/sélection de route, avec validation et commit après chaque étape.

## Règles de travail

- Travailler étape par étape, sans sauter de point.
- À la fin de chaque étape: check local (lint/tests + test manuel), puis commit.
- Respecter DDD/Hexa:
  - `domain`: règles métier de scoring/sélection (pur).
  - `application`: use cases + ports.
  - `infrastructure`: implémentations Mapbox/H3/persistance.
  - UI: appelle les use cases uniquement.

## Étape 1 - Départ utilisateur

- **But**: fiabiliser le point de départ utilisateur (source unique de vérité).
- **À faire**
  - Définir/valider le modèle de `UserStartPoint` côté `domain` si absent.
  - Ajouter un use case `GetUserStartPointUseCase` (ou clarifier l’existant).
  - Brancher l’UI pour lancer la génération depuis ce point.
- **Check**
  - Le point de départ affiché = celui utilisé pour lancer la génération.
  - Gestion d’erreur propre si position indisponible.
- **Commit suggéré**
  - `feat(route): stabilize user start point flow`

## Étape 2 - Générer 20-50 candidats de waypoints

- **But**: créer un générateur de candidats autour du départ.
- **À faire**
  - Ajouter une règle `domain` (rayon, distribution, contraintes de distance cible).
  - Implémenter `GenerateWaypointCandidatesUseCase`.
  - Paramétrer min/max candidats (20-50).
- **Check**
  - Retourne un ensemble de candidats valide et borné.
  - Pas de doublons exacts.
- **Commit suggéré**
  - `feat(route): generate waypoint candidates pool`

## Étape 3 - Pré-score local H3

- **But**: classer vite les candidats sans appeler Mapbox.
- **À faire**
  - Définir un port `H3ScoringPort` côté `application`.
  - Implémenter l’adapter `infrastructure` H3.
  - Créer une fonction de pré-score (distance cible, diversité, qualité locale).
- **Check**
  - Chaque candidat reçoit un score déterministe.
  - Le pré-score fonctionne offline (hors appel Directions).
- **Commit suggéré**
  - `feat(route): add local h3 pre-scoring`

## Étape 4 - Garder 3-5 candidats

- **But**: réduire le coût réseau avant routing réel.
- **À faire**
  - Implémenter la sélection top-K (K configurable 3-5).
  - Ajouter tie-breakers explicites pour stabilité.
- **Check**
  - Toujours entre 3 et 5 candidats (ou fallback documenté).
  - Sélection stable à entrées identiques.
- **Commit suggéré**
  - `feat(route): keep top-k candidates before routing`

## Étape 5 - Appeler Mapbox Walking pour chaque candidat retenu

- **But**: récupérer les routes réelles candidates.
- **À faire**
  - Définir un port `WalkingDirectionsPort` (application).
  - Implémenter adapter Mapbox Directions walking (infrastructure).
  - Gérer erreurs partielles (si 1 candidat échoue, continuer).
- **Check**
  - Requêtes directions émises pour tous les candidats retenus.
  - Timeouts/erreurs gérés sans crash.
- **Commit suggéré**
  - `feat(route): request mapbox walking routes for shortlisted candidates`

## Étape 6 - Scorer les routes retournées

- **But**: scorer sur données réelles de route.
- **À faire**
  - Ajouter `domain` scoring final (distance, durée, simplicité, etc.).
  - Implémenter `ScoreGeneratedRoutesUseCase`.
- **Check**
  - Les routes sont scorées et ordonnées.
  - Règles de scoring testées unitairement.
- **Commit suggéré**
  - `feat(route): score routed candidates`

## Étape 7 - Afficher la meilleure route

- **But**: rendre la meilleure candidate visible dans l’UI.
- **À faire**
  - Exposer la route gagnante via l’application.
  - Mettre à jour la vue carte.
  - Afficher les métriques clés (distance/temps/score).
- **Check**
  - L’utilisateur voit la meilleure route avant démarrage.
  - État loading/erreur clair.
- **Commit suggéré**
  - `feat(route): render best generated route`

## Étape 8 - Bouton "Démarrer" -> SDK Navigation

- **But**: transmettre la route sélectionnée au SDK Navigation.
- **À faire**
  - Définir un port d’intégration navigation si nécessaire.
  - Mapper la route Mapbox vers le format attendu SDK.
  - Démarrer la navigation depuis l’UI.
- **Check**
  - Le clic démarre bien une session de navigation.
  - La route transmise correspond à la route affichée.
- **Commit suggéré**
  - `feat(nav): start sdk navigation with selected mapbox route`

## Étape 9 - Navigation + rerouting gérés par Mapbox

- **But**: déléguer guidage et recalcule dynamique.
- **À faire**
  - Configurer callbacks navigation/reroute.
  - Synchroniser l’état applicatif avec l’état SDK.
- **Check**
  - Le reroute est effectif en cas de sortie d’itinéraire.
  - L’UI reste cohérente pendant navigation.
- **Commit suggéré**
  - `feat(nav): integrate mapbox navigation rerouting lifecycle`

## Étape 10 - Récupérer/reconstruire la trace réelle de fin

- **But**: obtenir la trajectoire effectivement réalisée.
- **À faire**
  - Capturer la trace brute (points GPS / events SDK).
  - Ajouter une reconstruction si nécessaire (nettoyage + normalisation).
- **Check**
  - Une trace finale exploitable est disponible en fin de session.
  - Données minimales garanties (timestamps, coords).
- **Commit suggéré**
  - `feat(history): capture actual walked trace`

## Étape 11 - Enregistrer H3 + historique

- **But**: persister le résultat pour historique/analytics.
- **À faire**
  - Définir modèle d’historique (`domain`) et port de persistance (`application`).
  - Adapter infra pour stockage local/remote selon architecture.
  - Sauvegarder trace + indexation H3.
- **Check**
  - Session persistée et relisible.
  - H3 stocké et exploitable pour analyses futures.
- **Commit suggéré**
  - `feat(history): persist session history with h3 indexing`

## Boucle de livraison par étape

1. Implémenter uniquement l’étape en cours.
2. Vérifier:
   - lint/typecheck/tests ciblés.
   - test manuel fonctionnel de l’étape.
3. Commit.
4. Repartir sur l’étape suivante.

## Commandes de vérification (à ajuster selon scripts dispo)

- `npm run lint`
- `npm run test`
- `npm run typecheck`

