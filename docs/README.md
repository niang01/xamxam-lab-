# XAM-XAM LAB — Dossier de conception (phase 0)

**Global AI Engineering, Simulation, Innovation & Startup Ecosystem**
« De l'idée à la conception, de la conception à la simulation, de la simulation à la réalisation. »

Version 0.1 — 17/11/2026 — **document à valider par l'exploitant avant tout développement.**

> Statut (17/11/2026) : première version développée ([`README`](../README.md)) — état réel rubrique par rubrique : **[ETAT_REALISATION.md](ETAT_REALISATION.md)**. Ce dossier reste la spécification de référence.
> Chaque module est décrit avec son état cible et sa phase ; rien n'est présenté comme existant s'il ne l'est pas.

## Sommaire (les 21 documents demandés + matrice)

| # | Document demandé (cahier des charges §29) | Fichier |
|---|---|---|
| 1 | Vision stratégique | [01_VISION_ET_MODELE_ECONOMIQUE.md](01_VISION_ET_MODELE_ECONOMIQUE.md) |
| 18 | Modèle économique | idem |
| 2 | Cahier des charges fonctionnel | [02_SPECIFICATIONS_FONCTIONNELLES.md](02_SPECIFICATIONS_FONCTIONNELLES.md) |
| 3 | Description détaillée de chaque module | idem |
| 4 | Description de chaque sous-rubrique | idem |
| 5 | Fonction de chaque bouton et outil | idem |
| 6 | Parcours utilisateurs | [03_ROLES_ET_PARCOURS.md](03_ROLES_ET_PARCOURS.md) |
| 7 | Architecture technique | [04_ARCHITECTURE_TECHNIQUE.md](04_ARCHITECTURE_TECHNIQUE.md) |
| 10 | Diagrammes de communication | idem (§6) et [05_XAMXAM_AI_CORE.md](05_XAMXAM_AI_CORE.md) |
| 12 | Architecture des API | idem (§5) |
| 8 | Architecture multi-agents | [05_XAMXAM_AI_CORE.md](05_XAMXAM_AI_CORE.md) |
| 9 | Architecture de XAM-XAM AI CORE | idem |
| 11 | Schéma de base de données | [06_DONNEES.md](06_DONNEES.md) |
| 13 | Architecture de connexion matérielle | [07_MATERIEL_IOT_TELEPILOTAGE.md](07_MATERIEL_IOT_TELEPILOTAGE.md) |
| 14 | Architecture de télépilotage | idem |
| 15 | Architecture de simulation | [08_SIMULATION.md](08_SIMULATION.md) |
| 16 | Plan de cybersécurité | [09_SECURITE_GOUVERNANCE.md](09_SECURITE_GOUVERNANCE.md) |
| 17 | Plan multilingue (WO / FR / EN) | [10_MULTILINGUE.md](10_MULTILINGUE.md) |
| 19 | Planning | [11_PLANNING_TESTS_MVP.md](11_PLANNING_TESTS_MVP.md) |
| 20 | Stratégie de tests | idem |
| 21 | Périmètre du MVP | idem |
| — | Dépendances, difficultés, coûts, contraintes réelles | [12_CONTRAINTES_COUTS_RISQUES.md](12_CONTRAINTES_COUTS_RISQUES.md) |
| — | Matrice de traçabilité exigence → module → écran → service → agent → test | [13_MATRICE_TRACABILITE.md](13_MATRICE_TRACABILITE.md) |

## Synthèse de l'analyse

1. **La vision est conservée en entier** : les 26 rubriques, 10 sous-systèmes de l'AI CORE, 15 agents, 5 niveaux d'autonomie, 9 phases. Aucune rubrique n'est supprimée ni réduite à une illustration ; certaines sont **séquencées** dans le temps parce qu'elles dépendent d'autres (ex. le télépilotage réel dépend de la passerelle IoT, du moteur de sécurité et d'essais sur banc).
2. **Principe d'ingénierie central** : *l'IA orchestre, les moteurs reconnus calculent*. L'IA ne fait aucun calcul de tête ; elle appelle ngspice, pvlib, CoolProp, CalculiX, PX4 SITL, etc., et chaque résultat porte sa nature (`calculation`, `simulation`, `measurement`, `prediction`…), son moteur, sa version et son domaine de validité.
3. **La sécurité physique ne dépend jamais de l'IA** : limites matérielles dans le firmware/l'autopilote, arrêt d'urgence câblé, validation humaine selon le niveau d'autonomie, commandes « exécutées » uniquement sur accusé du matériel (modèle déjà en place pour les pompes : `src/lib/pumpControl.ts`).
4. **Le wolof est langue de référence de l'interface**, mais aucun texte wolof n'est généré par l'équipe ni par l'IA sans le circuit de validation humaine (règle du dépôt). L'infrastructure existe déjà ici (traductions validées, export/import, voix wolof MMS).
5. **Ampleur réelle** : la vision complète représente un programme pluriannuel (≈ 3 à 4 ans, plusieurs équipes ; voir doc 12). Le MVP proposé (doc 11) livre un premier parcours complet « idée → calcul → simulation → connexion d'un vrai capteur » en ≈ 6 mois.

## Décisions à valider avant la phase 1

| # | Décision | Recommandation | Alternatives |
|---|---|---|---|
| D1 | Emplacement du code | **Dépôt indépendant `xamxam-lab`** : code, base, comptes, API et configuration propres, sans aucun lien avec un autre projet | — |
| D2 | Mobile | **React Native (Expo)**, partage TypeScript avec le web | Flutter (doc 04 §3) |
| D3 | Calcul scientifique | **Services Python (FastAPI)** isolés à côté du cœur Next.js/TypeScript | Tout en Node.js (bibliothèques scientifiques insuffisantes) |
| D4 | Modèle d'IA | Claude par API (Haiku 5.5 routage, Sonnet 5.5 agents, Opus 5.5 planification), avec quotas par offre | Fournisseur unique au choix de l'exploitant |
| D5 | Périmètre MVP | Doc 11 §3 | À ajuster |
| D6 | Validateurs de langue | Désigner au moins deux locuteurs natifs wolof + un relecteur scientifique | — |
| D7 | Normes électriques de référence | NF C 15-100 / CEI 60364 (achat des normes ; coefficients saisis par un ingénieur qualifié) | — |
