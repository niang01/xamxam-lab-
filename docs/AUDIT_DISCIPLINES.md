# Audit par discipline et par espace — XAM-XAM LAB (23/11/2026)

Méthode : chaque point a été vérifié dans le code et, sauf mention contraire, par un test automatique
(`npm test`, `npm run test:e2e`). « Non disponible » = absent de la plateforme et affiché comme tel dans l'interface.

## 1. Espaces 2D, 3D, 4D (état avant / après l'audit)

| Espace | Constaté avant | Ajouté et testé | Reste non disponible |
|---|---|---|---|
| 2D | Éditeur de circuits électroniques seulement (R, C, L, D, sources) + ngspice | **Schémas 2D multidisciplines** (`/schemas`) : blocs de la bibliothèque, broches, liaisons, paramètres avec unités, annotations, rotation, vérification (broches libres, liaisons invalides, doublons, paramètres vides), versions, exports SVG / PNG / JSON, report dans la nomenclature du projet | Simulation des schémas non électroniques ; vérification réglementaire |
| 3D | Visionneuse STL | **Maquette 3D paramétrique** (Studio) : blocs, cylindres, sphères cotés en mm, matériaux, masse et centre de gravité calculés, versions, export STL / JSON | CAO volumique (esquisses contraintes, congés), éléments finis |
| 4D | Rejeu de simulations ngspice, comparaison simulation / mesure | **Scénarios temporels** (moteur `xamxam-4d`, Euler explicite) : énergie solaire + batterie, réservoir + pompe, chambre froide avec coupure ; **bilan de conservation vérifié** (énergie / volume, résidu ≈ 0), lecture animée et curseur temporel, enregistrement dans les simulations | Moteur de dynamique des solides, jumeau numérique synchronisé |

## 2. Bibliothèques de composants

Avant : 27 composants génériques. Après : **127 composants génériques** répartis en **12 disciplines**
(électrique, électronique, solaire et stockage, pompes et hydraulique, capteurs et actionneurs IoT, cartes et modules,
moteurs / variateurs / automatismes, froid et climatisation, informatique et réseaux, mécanique et robotique, drones,
génie civil). Chaque composant : description, fonction, broches ou bornes, **paramètres configurables avec unités
(sans valeur : saisie d'après la fiche de la référence choisie)**, symbole 2D, précautions, documentation.
Utilisation : schémas 2D (tous), simulation ngspice (R, C, L, D, sources), scénarios 4D (PV, batteries, pompes,
réservoirs, chambres froides par leurs paramètres), modèles de projets. Références réelles : ajout avec fiche
technique, statut « à vérifier » jusqu'à validation. Aucune caractéristique de fabricant n'est inventée.

## 3. Disciplines (8 critères)

| Discipline | Outils | Bibliothèque | Conception | Calcul / dimensionnement | Schémas / modèles | Simulation | Rapports / exports | Guide |
|---|---|---|---|---|---|---|---|---|
| Électricité | Electrical Lab | 12 composants | Schémas 2D | Ohm, puissances, courant d'emploi, chute de tension, section (tableaux normatifs validés), bilan | 2D | — (pas de simulation de réseau BT) | Rapport projet, SVG | ✅ |
| Électronique | Electronics Lab | 14 | Éditeur de circuits | via simulation | Éditeur + versions | **ngspice** (op, tran, dc, ac) | Rapport, courbes | ✅ |
| Solaire | Solar Energy Lab | 9 | Schémas 2D | production, chaînes MPPT, batteries, pompe, économie ; NASA POWER ; pvlib | 2D | **4D énergie + batterie** ; pvlib horaire | Rapport | ✅ |
| Hydraulique | Solar Lab (pompe), Studio | 12 | Schémas 2D | puissance de pompe | 2D | **4D réservoir** | Rapport | ✅ |
| IoT / embarqué | IoT Lab, IoT Gateway, Automation | 17 + 11 cartes | Schémas 2D, firmware | — | 2D | essai à blanc des automatisations, mesures simulées signalées | Rapport, mesures | ✅ |
| Automatismes / moteurs | Electrical Lab | 12 | Schémas 2D | courant d'emploi, couple | 2D | — | Rapport | ✅ |
| Froid | Refrigeration Lab | 7 | Schémas 2D | COP, apports parois, **CoolProp** | 2D, diagramme log p–h | **4D chambre froide** | Rapport | ✅ |
| Réseaux | Network Lab | 9 | Schémas 2D | sous-réseaux, VLSM | 2D | non disponible (émulation) | Rapport | ✅ |
| Mécanique / robotique | Mechanical Lab, Studio 3D | 10 | Maquette 3D | couple, engrenages, vérin, masse / CdG | 3D | non disponible (dynamique) | STL, rapport | ✅ |
| Drones | Drone Command Center | 8 | Profil, missions | conditions de vol, autonomie | missions | liaison SITL établie ; armement / décollage **non validés** | journal | ✅ |
| Génie civil | Schémas 2D | 7 | 2D | non disponible (calcul réglementaire) | 2D | non disponible | — | ✅ (limites indiquées) |

## 4. Projets (mémoires, BTS, ingénieurs, R&D, fin de formation, start-up)

10 modèles (agriculture intelligente, irrigation automatique, surveillance environnementale, domotique, énergie
solaire, robotique, industrie, sécurité, santé connectée, chambre froide) × 6 niveaux. Le modèle crée : cahier des
charges, objectifs, méthodologie adaptée au niveau, architecture matérielle et logicielle, programmation, plan de
tests, nomenclature liée à la bibliothèque (sans prix), tâches. Le projet comporte en plus : résultats, conclusion,
budget prévisionnel (prix saisis, total par devise, total incomplet signalé), schémas, calculs, simulations,
mesures, rapport final (.md) et présentation (.md, Marp) générés **à partir des seules données enregistrées**.

## 5. Aláji IA

Cerveau central : analyse déterministe (disciplines, type de projet, intentions), sélection des agents, exécution
des outils sous gouvernance (journal `ai_steps`), **agent vérificateur réel** (étapes non exécutées, paramètres
manquants, valeurs non finies, unités absentes, mesures simulées), rapports et suivi de projets, historique des
conversations. Fournisseur configurable (Anthropic ou compatible OpenAI) ; sans fournisseur : mode sans clé signalé.
