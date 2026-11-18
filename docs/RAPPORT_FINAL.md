# XAM-XAM LAB — rapport final avant mise en production (18/11/2026)

Dépôt : **`niang01/xamxam-lab-`** (branche `main`). Chaque résultat ci-dessous a été **exécuté** pendant cette campagne ; ce qui n'a pas pu l'être est indiqué comme tel.

## 1. Indépendance vis-à-vis de SUUF — terminée
| Contrôle | Résultat |
|---|---|
| SUUF non modifié pendant la campagne | arbre de travail propre ; `main` = `7dbfab8`, branche de travail = `9ff8a29` (inchangés) ; aucune mention de XAM-XAM dans `main` de SUUF |
| Dépôt XAM-XAM | une seule racine `16eeabc` sans parent ; aucun ancêtre commun avec SUUF ; seul distant `niang01/xamxam-lab-` |
| Code | 0 référence à SUUF hors documentation d'audit ; 0 chemin local ; 0 dépendance locale ou Git |
| Comptes et secrets | environnement cloud « xamxam-lab » sans variable ni secret ; services de SUUF refusés (403) depuis XAM-XAM |

Détail et preuves : [AUDIT_SEPARATION.md](AUDIT_SEPARATION.md).

## 2. Clone propre et vérifications automatiques
Clone GitHub neuf (`/home/user/xamxam-final`, commit `3907810`), installation sans cache :
| Contrôle | Résultat |
|---|---|
| `npm ci` (registre npm, cache vide) ; Python 3 + pvlib 0.16.1 + CoolProp 8.0.0 | ✅ |
| Typage strict, lint | ✅ 0 erreur, 0 avertissement |
| Tests unitaires et d'intégration | ✅ **111/111**, aucun ignoré (puis **112/112** après correction Meteomatics) |
| Build de production | ✅ 83 pages, 0 avertissement |
| Parcours de bout en bout | ✅ **10/10**, puis **30/30 sur 3 passages indépendants** (stabilité) |

**Défaut trouvé et corrigé** : le parcours de double authentification échouait 2 fois sur 10 — le test lisait les codes de secours avant la réponse du serveur (défaut du test, pas de l'application). Corrigé, puis 10/10 répétitions réussies.
**Constat (pas un défaut)** : répéter la suite sur un même serveur déclenche la limitation anti-abus des inscriptions (20 par adresse IP / 10 min) — la protection fonctionne.

## 3. Moteurs scientifiques et API — appels réels
| Moteur / API | Vérification réelle | Résultat |
|---|---|---|
| **NASA POWER** (climatologie) | Dakar 14,69 N / 17,44 O | ✅ irradiation 4,86 à 6,85 kWh/m²/j selon le mois (période 2001–2025), marquée « modélisée » |
| **pvlib** horaire sur données NASA POWER horaires 2023 | 5 kWc, 15°, sud | ✅ 8 760 h, 0 h manquante, **7 783 kWh/an**, 1 557 kWh/kWc, PR 0,763 |
| **CoolProp** | cycle R134a −10 °C / 40 °C | ✅ COP **2,92** < COP de Carnot 5,26 |
| **ngspice** (eecircuit-engine 1.9.0) | pont diviseur, charge RC (tests d'intégration) | ✅ |
| 19 calculs d'ingénierie (électricité, solaire, mécanique, thermique, réseau) | tests unitaires avec valeurs recalculées | ✅ |
| **Meteomatics** | sans compte | ✅ refus explicite, **aucun appel sortant** (corrigé pendant la campagne : auparavant un appel non authentifié partait) |
| **IA (Claude)** | sans clé | ✅ moteur de règles signalé comme tel ; format d'appel Claude vérifié par test (pas de clé réelle) |
| 95 routes API | test automatique : chacune refuse l'accès sans session (sauf routes publiques listées) | ✅ |

## 4. Drones et boutique e-commerce — mise au point
- **Drones** : présent et testé — agent *AI Drone Engineer* (calculs, météo, appareils), appareils de type drone dans IoT Gateway, sessions de télépilotage avec habilitation `telepilote_drone`, référence d'autorisation ANACIM obligatoire en environnement réel, commandes à durée maximale confirmées par une personne. **Non réalisé** : liaison MAVLink / PX4 / ArduPilot et simulation SITL (affiché « non disponible » dans le Remote Control Center). Aucun vol n'a été piloté.
- **Boutique e-commerce** : XAM-XAM LAB **ne contient pas** de boutique e-commerce avec paiement. « BOUTIQUE E-COMMERCE » est un **projet distinct** (développé dans une autre session, dépôt `boutique-Ecommerce` inaccessible à cette session). XAM-XAM LAB contient **XAM-XAM MARKETPLACE** : annonces, recherche, demandes et messagerie, modération — **mise en relation sans paiement**, entièrement testée (intégration + parcours à deux comptes).

## 5. Sécurité, permissions, sauvegardes, base de données
| Contrôle | Résultat |
|---|---|
| Dépendances de production (`npm audit --omit=dev`) | ✅ **0 vulnérabilité** |
| Dépendances de développement | ⚠️ 16 alertes « high », **une seule cause** : ReDoS de `picomatch` (GHSA-fc5q-39xc-vjpf), dans ESLint/Vitest uniquement, **absent de l'image de production** ; **aucune version corrigée publiée** (toutes ≤ 4.0.7) — risque accepté, à revoir à la publication d'un correctif |
| Secrets dans tout l'historique Git | ✅ aucun (seules des valeurs factices de test, ex. `sk-ant-test`) ; aucun `.env`, `.pem`, `.jks` versionné |
| En-têtes (via HTTPS) | ✅ HSTS, CSP stricte, `X-Frame-Options: DENY`, `nosniff`, pas de `X-Powered-By` |
| Permissions | ✅ tests : projets privés, rôles lecteur/éditeur, administration réservée, habilitations, approbations IA, double authentification |
| Sauvegarde → **restauration dans une base PostgreSQL vide** | ✅ 22 tables, comptes identiques (12 utilisateurs, 37 entrées d'audit, marketplace, double authentification), chaîne d'audit intègre ; écrasement d'une base non vide **refusé** |
| Sauvegardes automatiques | ✅ produites à l'intervalle choisi, rétention appliquée (fichier de plus de 14 jours supprimé) |
| Migrations PostgreSQL 16 | ✅ 4 migrations appliquées au démarrage |

## 6. Déploiement sur votre domaine et votre serveur
Vérifié depuis un clone neuf du commit `55b20f7` : `verifier-config` accepte la configuration ; `docker compose --profile https up -d --build` → `db`, `app` (healthy), `backup`, `https` ; **10/10 parcours à travers HTTPS** (Caddy, cookies `Secure`, PostgreSQL), 0 erreur dans les journaux.

Procédure : [GUIDE_INSTALLATION.md](GUIDE_INSTALLATION.md) § 3 — serveur Linux avec Docker (2 vCPU / 4 Go recommandés), ports 80/443, DNS du domaine vers le serveur, `.env` rempli, `node scripts/verifier-config.mjs`, puis `docker compose --profile https up -d --build`. Le certificat Let's Encrypt est obtenu automatiquement **une fois le domaine réel pointé** (non testable ici : vérifié avec l'autorité locale de Caddy sur `localhost`).

## 7. Versions Web, Android, iOS
| Version | État réel |
|---|---|
| **Web** (navigateur, PWA installable) | ✅ compilée, démarrée, testée (ordinateur et téléphone Pixel 7 émulé par Chromium) |
| **Android** | ✅ **compilé** : APK de débogage (4,3 Mo), APK release (3,4 Mo) et AAB Play Store (3,2 Mo) ; signature vérifiée par `apksigner` avec une **clé de test jetable** ; paquet `sn.xamxam.lab`, cible SDK 35. ❌ Non exécuté sur un appareil ou émulateur (pas de virtualisation ici). **À produire** : version signée avec **votre** clé et l'adresse de **votre** domaine (`XX_APP_URL`) |
| **iOS** | Projet Xcode (Capacitor 7, Swift Package Manager) ; compilation réelle confiée à GitHub Actions sur macOS (`.github/workflows/ios.yml`, simulateur, sans signature) — résultat : voir § 7 bis. **À produire** : version App Store (compte Apple Developer, certificat, profil de distribution) |
| **Firmware ESP32** (XIAO ESP32-S3) | ✅ compilé (PlatformIO, RAM 13,2 %, Flash 20,3 %) avec la configuration d'exemple ; ❌ non testé sur matériel |

### 7 bis. Résultat de la compilation iOS
Exécution GitHub Actions n° 1 (run `44292065391`, commit `b62748e`) : **en file d'attente** au moment de la rédaction — aucune machine macOS attribuée. **La compilation iOS n'est donc pas encore confirmée.** Suivi : onglet *Actions* du dépôt, workflow « XAM-XAM LAB iOS ».

## 8. Services externes exigeant vos propres clés ou comptes
| Service | Pour | Variable / lieu | Sans lui |
|---|---|---|---|
| **Serveur + nom de domaine** | mise en ligne | DNS, `XX_DOMAIN` | pas de déploiement public |
| **Anthropic (Claude)** | IA générative WO/FR/EN, orchestration des agents | `ANTHROPIC_API_KEY` | moteur de règles (signalé) |
| **Meteomatics** | prévisions météo | `METEOMATICS_USERNAME/PASSWORD` | prévisions indisponibles (signalé) |
| **NASA POWER** | climatologie, séries journalières et horaires | aucune clé | — (fonctionne) |
| **Serveur TURN** (coturn ou service) | visioconférence entre réseaux différents | `XX_TURN_URLS/USERNAME/CREDENTIAL` | réunions limitées aux réseaux compatibles |
| **Certificat TLS pour MQTT** | appareils IoT chiffrés | `MQTTS_PORT`, `MQTT_TLS_CERT/KEY` | passerelle MQTT non activable (hors banc d'essai) |
| **Clé de signature Android + Google Play Console** | publication Android | `XX_KEYSTORE_*` | APK installable manuellement seulement |
| **Apple Developer + Mac/Xcode ou GitHub macOS** | publication iOS | certificat, profil | pas de version App Store |
| **Firebase / APNs** | notifications push natives | — | non réalisé |
| **NASA Earthdata, Copernicus** | SMAP, NDVI | — | non réalisé |
| Locuteurs natifs wolof | interface en wolof | Administration → Traductions | repli FR/EN signalé |
| Normes NF C 15-100 / CEI 60364 | section de câble | Administration → Tableaux normatifs | calcul refusé (pas de coefficient inventé) |

## 9. Bilan des fonctionnalités
**Terminées et testées** : comptes (15 profils), sessions, double authentification TOTP, projets et rôles, langues FR/EN (+ wolof validé), XAM-XAM AI CORE (17 agents, 18 outils, gouvernance, approbations), AI Command Center, Engineering Lab (électricité, électronique + ngspice, solaire + NASA POWER + pvlib, froid + CoolProp, mécanique, réseau, composants), Studio, IoT (HTTPS, MQTT, agent série, commandes sûres, arrêt d'urgence), Automation Studio, Remote Control Center, Earth & Space (NASA POWER), Academy (cours, QCM, certificats), collaboration (messagerie, visioconférence WebRTC), écosystème (startups, concours, mentors, talents, actualités), XAM-XAM MARKETPLACE, identité visuelle et thèmes, barre d'état, panneau IA, sauvegarde/restauration, déploiement HTTPS clé en main, application web, APK/AAB Android, firmware.

**Partiellement opérationnelles** : Android (compilé, non essayé sur appareil) ; iOS (voir § 7 bis ; pas de version signée) ; visioconférence (TURN requis entre réseaux) ; voix (selon le navigateur, pas de wolof vocal validé) ; certains textes internes en français seulement ; drones (gestion, habilitations, calculs — sans liaison de vol).

**En attente de vos clés ou comptes** : IA générative, Meteomatics, TURN, TLS MQTT, publication Android et iOS, traductions wolof, normes électriques (§ 8).

**Encore indisponibles (affichées « non disponible » dans l'application)** : CAO paramétrique et éléments finis, physique temps réel, jumeau numérique synchronisé, émulation réseau, MAVLink/PX4/SITL, vidéo des appareils, BLE/LoRa/Modbus, édition simultanée et tableau blanc, SMAP/NDVI/GIBS, notifications push natives, passkeys (WebAuthn), paiements en ligne, classes virtuelles planifiées.

## 10. Verdict
XAM-XAM LAB est **autonome, sécurisé, testé et déployable** sur votre propre serveur et domaine dès que vous fournissez le serveur, le domaine et le `.env` (secrets générés par vous). Les fonctions qui dépendent de services tiers restent signalées comme indisponibles tant que vos propres comptes ne sont pas configurés ; aucune n'est simulée.
