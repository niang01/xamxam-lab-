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

## Déploiement gratuit — état (vérifié le 23/11)
- ✅ Service Render `xamxam-lab-` (créé par l'exploitant) : **plan free**, déploiement automatique depuis `main`, **en ligne** : https://xamxam-lab.onrender.com (déploiement `2b5ca0d` « live »).
- ✅ HTTPS, HSTS, CSP ; `/api/health` → `"db":"postgres"` (base externe connectée) ; pages de connexion et d'inscription vérifiées sur téléphone (Pixel 7) : HTTP 200, aucun débordement.
- ❌ **Bloquant** : `session_secret: "missing"` et `admins_configured: false` → les variables `SESSION_SECRET`, `XX_ENCRYPTION_KEY` et `XX_ADMIN_EMAILS` ne sont pas définies sur le service. Inscription/connexion refusées proprement (HTTP 503, aucun compte créé — vérifié en production).
- La clé d'API Render disponible ne permet ni de lire ni d'écrire les variables d'environnement (`forbidden`) : réglage à faire dans le tableau de bord Render.

## Prochaine tâche exacte
1. Exploitant — Render → service `xamxam-lab-` → *Environment* → ajouter :
   - `SESSION_SECRET` : valeur aléatoire ≥ 32 caractères (bouton *Generate*, ou `openssl rand -base64 48`) ;
   - `XX_ENCRYPTION_KEY` : autre valeur aléatoire ≥ 32 caractères, différente de la précédente ;
   - `XX_ADMIN_EMAILS` : votre adresse électronique ;
   puis *Save, rebuild and deploy*.
2. Ensuite (Claude) : vérifier `/api/health` (`session_secret: configured`), inscription, connexion et tableau de bord en production sur téléphone ; recompiler l'APK Android avec `XX_APP_URL=https://xamxam-lab.onrender.com`.
3. Reprendre : Sentinel-2 (recherche + NDVI, lecture réelle des bandes déjà vérifiée), validation SITL des drones.

## Limites connues
Voir `docs/RAPPORT_FINAL.md` § 8–9 (clés et comptes à fournir, fonctions non réalisées).
