# XAM-XAM LAB — état du projet (point de reprise)

Mis à jour à chaque étape. **Reprendre à partir de ce fichier, sans recommencer le projet.**
Dépôt : `niang01/xamxam-lab-` (branche `main`). Indépendant de SUUF (aucun fichier, service, base ni secret partagé).

## Vérifié (exécuté, avec preuves dans docs/RAPPORT_DE_TESTS.md)
| Contrôle | Résultat |
|---|---|
| Typage strict, lint | ✅ 0 erreur |
| Tests unitaires + intégration | ✅ 123/123 (14 fichiers), moteurs ngspice, pvlib, CoolProp réellement exécutés |
| Parcours de bout en bout (Playwright) | ✅ 11/11, deux passages consécutifs (dont téléphone Pixel 7) |
| Build de production | ✅ |
| PostgreSQL 16 réel (Docker) | ✅ migrations, sauvegarde → restauration dans une base vide, HTTPS (Caddy) |
| Mémoire en production avec PostgreSQL | ✅ ≈ 140 Mo (offre gratuite Render : 512 Mo) |
| APK Android (debug, release signé avec clé de test, AAB) | ✅ compilés le 18/11 ; ❌ non essayés sur un téléphone |
| Firmware ESP32 | ✅ compilé ; ❌ non testé sur matériel |

## Fonctionnalités opérationnelles
Comptes et 15 profils, double authentification TOTP, projets et rôles, FR/EN (+ wolof validé seulement), XAM-XAM AI CORE (17 agents, 18 outils, moteur de règles sans clé), AI Command Center, Engineering Lab (électricité, électronique + ngspice, solaire + NASA POWER + pvlib, froid + CoolProp, mécanique, réseau, composants), Studio, IoT (HTTPS, MQTT, agent série, commandes sûres, arrêt d'urgence), Automation Studio, Remote Control Center, **Drone Command Center** (nouveau, voir ci-dessous), Earth & Space (NASA POWER), Academy, collaboration (messagerie, visioconférence WebRTC), écosystème, XAM-XAM MARKETPLACE (mise en relation, sans paiement), thèmes, barre d'état, panneau IA, sauvegardes.

## Drones — état exact
- ✅ Règles de vol (profil constructeur, évaluation des conditions, mission : plafond, géorepérage, autonomie avec réserve) : 9 tests unitaires.
- ✅ API et page « Drone Command Center » : enregistrement (jeton), télémétrie, profil, conditions 48 h, missions, commandes confirmées, arrêt d'urgence, refus de sécurité — parcours e2e.
- ✅ Pont MAVLink `services/drone_bridge.py` (pymavlink) écrit ; liaison MAVLink 2 **réellement établie avec ArduPilot SITL** (battement de cœur, lecture et écriture de paramètres).
- ❌ **Non validé** : armement / décollage / mission sur le SITL (le simulateur demandait une calibration de l'accéléromètre — « PreArm: 3D Accel calibration needed » ; travail suspendu à la demande de l'exploitant). **Aucun drone réel n'est pilotable** tant que ce test et un essai sur banc n'ont pas été faits.
- ⚠️ Conditions de vol : code Open-Meteo prêt et testé sur le format ; appel réel refusé depuis l'environnement de développement (« quota quotidien dépassé » sur l'adresse IP partagée) — fonctionnera depuis le serveur de production ou avec `OPEN_METEO_API_KEY`. Meteomatics : code prêt, compte requis.

## Correctif du 23/11 — port d'écoute (déploiement Render)
- Cause (journaux Render de l'exploitant) : l'image démarrait avec `-p 3100` fixé, Render attend `PORT` (10000) → « Port scan timeout ».
- Correction : `CMD next start -H 0.0.0.0` (port lu dans `PORT`, 10000 par défaut dans l'image) ; Docker Compose fixe `PORT=3100` ; `render.yaml` ne fixe plus le port.
- Vérifié localement sur l'image construite : écoute `0.0.0.0:10000` sans variable, `0.0.0.0:3100` avec `PORT=3100`, santé HTTP 200 dans les deux cas.

## Déploiement gratuit — état
- ✅ `render.yaml` : service web **plan free** (Francfort), aucune base Render ; `DATABASE_URL` (Neon) en champ sécurisé.
- ✅ Projet Neon `xamxam-db` créé par l'exploitant ; `neon init` exécuté (`neon.ts`, projet `delicate-bread-36592173`, branche `production`).
- ❌ **Bloqué** : la clé d'API Neon enregistrée est **rejetée par Neon** (HTTP 401) → impossible de lire l'adresse de connexion ; la connexion par navigateur (`neon login`) ne peut pas revenir vers le conteneur cloud.
- ❌ Service Render non créé (en attente de l'adresse Neon). Aucune ressource payante créée.

## Prochaine tâche exacte
1. L'exploitant copie l'adresse de connexion Neon (Neon Console → projet `xamxam-db` → *Connect* → chaîne **pooled**, avec `sslmode=require`) et soit :
   - la saisit lui-même dans Render (*New → Blueprint* → dépôt `niang01/xamxam-lab-` → vérifier **Free** → champ `DATABASE_URL`) ;
   - soit fournit une nouvelle clé d'API Neon valide (limitée au projet).
2. Ensuite : premier déploiement Render, vérification réelle (santé `"db":"postgres"`, inscription, connexion, tableau de bord sur téléphone), puis recompilation de l'APK avec l'adresse publique.
3. Reprendre la validation SITL (calibration accéléromètre du simulateur, armement, décollage 10 m, RTL).

## Limites connues
Voir `docs/RAPPORT_FINAL.md` § 8–9 (clés et comptes à fournir, fonctions non réalisées).
