# Prérequis externes — XAM-XAM LAB

Ce que l'exploitant doit fournir pour activer chaque fonction en conditions réelles. Rien n'est remplacé par des données fictives en attendant : la fonction concernée est signalée comme indisponible.

| Besoin | Pour | Où le configurer | Coût indicatif |
|---|---|---|---|
| **Dépôt Git dédié `xamxam-lab`** | Séparer totalement le code (exigence d'indépendance) | Créer le dépôt vide sur GitHub, puis `bash scripts/extraire-depot.sh ../xamxam-lab-depot <url>` | Gratuit |
| **Option gratuite** : Render Free + Neon Free (voir GUIDE_INSTALLATION § 2 bis) | Première mise en ligne sans budget | `render.yaml`, champs sécurisés Render | 0 € |
| Serveur (VPS, 2 vCPU / 4 Go recommandés) + nom de domaine | Mise en ligne (HTTPS automatique inclus) | `.env` puis `docker compose --profile https up -d --build` | Quelques dizaines d'USD/mois |
| `SESSION_SECRET`, `XX_ADMIN_EMAILS`, `POSTGRES_PASSWORD` | Sécurité, administration | `.env` | — |
| Clé **Anthropic** (`ANTHROPIC_API_KEY`) | Compréhension libre WO/FR/EN, orchestration des agents | `.env` | Opus 5.5 : 4 $ / 20 $ par million de jetons (entrée/sortie) ; plafond `AI_DAILY_LIMIT` |
| Compte **Meteomatics** de XAM-XAM LAB | Prévisions (Earth & Space) | `METEOMATICS_USERNAME/PASSWORD` | Selon contrat |
| Compte NASA **Earthdata**, accès Copernicus / Planetary Computer | SMAP, NDVI (phase 7) | à intégrer | Gratuit |
| Serveur **TURN** (coturn ou service) | Réunions entre réseaux différents | `XX_TURN_URLS/USERNAME/CREDENTIAL` | Bande passante |
| Certificat TLS pour **MQTT** | Liaison MQTT chiffrée | `MQTTS_PORT`, `MQTT_TLS_CERT`, `MQTT_TLS_KEY` | Gratuit (Let's Encrypt) |
| **Locuteurs natifs wolof** (≥ 2) + relecteur scientifique | Interface et glossaire en wolof (aucune traduction inventée) | Administration → Traductions | Prestation de traduction |
| Normes **NF C 15-100 / CEI 60364** + ingénieur validateur | Choix de section de câble | Administration → Tableaux normatifs | Achat des normes |
| Fiches techniques constructeurs | Composants réels vérifiés, modèles SPICE | Bibliothèque de composants | — |
| Matériel de banc (XIAO ESP32-S3, relais, capteurs, charge de test) | Essais réels IoT / commandes | Firmware `firmware/xamxam-node` | Quelques dizaines d'USD |
| Habilitations et autorisations (ANACIM pour les drones) | Opérations réelles | Administration → Habilitations | Selon procédure |
| Clé de signature Android + compte Google Play | Publication Android | `XX_KEYSTORE_*`, Play Console | 25 USD (une fois) |
| Mac + Xcode + compte Apple Developer | Compilation et publication iOS | `mobile/ios` | 99 USD/an |
| Firebase (Android) et APNs (iOS) | Notifications push natives | à intégrer | Gratuit |
