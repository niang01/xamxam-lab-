# 11. Planning, stratégie de tests et périmètre du MVP

## 11.1 Planning (estimations à confirmer selon l'équipe réellement disponible)
Hypothèse : équipe noyau de 6–8 personnes la 1ʳᵉ année (2 full-stack TS, 1 mobile, 1 Python/scientifique, 1 IoT/embarqué, 1 DevOps/sécurité, 1 UX/UI, + validateurs de langue et experts métier à temps partiel), renforcée ensuite.

| Phase | Contenu | Durée indicative | Point de validation |
|---|---|---|---|
| 0 | Dossier de conception (ce document) | fait (v0.1) | **Validation de l'exploitant (décisions D1–D7)** |
| 1 | Fondations : monorepo, identité visuelle, comptes/rôles/organisations, projets, i18n WO/FR/EN, base de données, shell web + mobile, AI CORE initial (conversation, outils, journal) | 2–3 mois | Recette des parcours de base sur web + Android |
| 2 | IA : orchestrateur, plans approuvables, 5 premiers agents, mémoire, permissions, Command Center v1 | 2 mois | Jeux d'évaluation des agents |
| 3 | Engineering Lab : Component Library, éditeur 2D, Electrical, Electronics (ngspice), Solar (pvlib + NASA POWER), IoT Lab | 3–4 mois | Comparaison avec cas de référence publiés |
| 4 | Simulation immersive : 3D, 4D, Digital Twin, CAO, FEA, physique | 4–6 mois | Cas de validation par moteur |
| 5 | Connexion physique : IoT Gateway, MQTT, agent local, USB/BLE, télémétrie | 3 mois (en partie parallèle à 3) | Banc d'essai réel |
| 6 | Automatisation et télépilotage : Automation Studio, Remote Control, SITL, banc, commandes sécurisées | 4–6 mois | Essais SITL → banc → audit de sécurité → opérations réelles |
| 7 | Earth & Space : NASA/Meteomatics/satellite étendus, cartographie, analyses | 2 mois | Vérification des sources |
| 8 | Academy, classes virtuelles, visioconférence, collaboration temps réel, mentorat | 4 mois | Pilote avec un établissement |
| 9 | Écosystème : startups, concours, sponsors, incubation, entreprises, recrutement, marketplace | 4 mois | Pilote avec un incubateur |

Plusieurs phases se chevauchent ; durée totale de la vision complète : **≈ 30 à 42 mois**.

## 11.2 Périmètre du MVP (≈ 6 mois : phases 1, 2 partielle, 3 partielle, 5 partielle)
Objectif : démontrer de bout en bout « IMAGINE → CONÇOIS → SIMULE → CONNECTE » sur un vrai cas (pompage solaire + capteurs), en WO/FR/EN, sur web et Android.

| Inclus | Détail |
|---|---|
| Comptes, profils (15 profils créés, 5 tableaux de bord : élève, étudiant, enseignant, ingénieur, administrateur), organisations, projets privés | |
| Langues WO/FR/EN | Infrastructure complète + circuit de validation ; textes wolof selon livraisons des validateurs |
| AI CORE v1 | Conversation, plan approuvable, moteur d'outils + politiques, journal, 5 agents : Electrical, Electronics, Solar, IoT, Education Tutor ; niveaux d'autonomie 1–3 |
| Component Library v1 | ~100 composants de base **vérifiés** (sources et licences tracées) |
| Éditeur 2D de schémas | Placement, liaison, ERC, versions, collaboration simple |
| Electrical Lab v1 | Calculs : courant, puissance, chute de tension ; section de câble dès que les tableaux normatifs sont saisis et validés |
| Electronics Lab v1 | ngspice `.op/.dc/.tran`, oscilloscope/multimètre virtuels |
| Solar Lab v1 | NASA POWER + pvlib : production, champ PV, batterie, pompage, rentabilité simple |
| IoT Gateway v1 | MQTT + HTTPS, XIAO ESP32-S3, mesures temps réel, comparaison avec la simulation ; Web Serial pour le téléversement |
| Command Center v1 | Opérations IA, appareils, audit, arrêt global |
| Android (Expo) | Comptes, IA, projets, supervision IoT, notifications |
| Earth & Space v1 | Réalisé (voir ETAT_REALISATION) |

| Exclu du MVP (prévu, affiché « non disponible — phase N ») | |
|---|---|
| Commandes physiques automatiques (niveaux 4–5), télépilotage réel, drones | Phase 6 |
| 3D/4D avancé, CAO, FEA, Digital Twin | Phase 4 |
| Mechanical, Refrigeration, Network Labs | Phases 3–4 (après MVP) |
| iOS | Après validation Android (même code Expo) |
| Visioconférence, Academy complète, écosystème | Phases 8–9 |

## 11.3 Stratégie de tests
| Niveau | Outils | Exigence |
|---|---|---|
| Unitaires (calculs purs, politiques) | Vitest ; pytest (services Python) | 100 % des fonctions de calcul ; cas de référence publiés (exemples de normes, exemples pvlib, tables CoolProp) |
| Intégration | PostgreSQL réel (une base par fichier), conteneurs des moteurs | Chaque route × rôle ; jobs de simulation complets |
| Contrats | Schémas zod/OpenAPI partagés | Web, mobile, services |
| Bout en bout | Playwright (web, bureau + mobile) ; Maestro ou Detox (mobile natif) | Parcours P1–P8 |
| IA | Jeux d'évaluation, tests d'injection, `fetchImpl` explicites | Aucun outil hors liste blanche, aucune action physique sans validation |
| Matériel | Banc : XIAO, capteurs, relais sur charge de test ; SITL pour les drones | Chaque commande : accusé réel, expiration, arrêt sur perte de liaison |
| Langues | Clés, rendu, statut | Doc 10 §10.7 |
| Sécurité | SAST, dépendances, test d'intrusion | Doc 09 §9.4 |
| Performance | k6 (API), mesures de rendu 3D sur téléphones d'entrée de gamme | Budgets définis par écran |
| Accessibilité | axe-core | Niveau AA visé |

Règle de livraison : aucune version déclarée terminée sans tests verts, recette des parcours et mise à jour du registre d'état (format `IMPLEMENTATION_STATUS.md` : réel / démo / configuré non testé / indisponible).
