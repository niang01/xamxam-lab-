# XAM-XAM LAB — état de réalisation (18/11/2026)

Synthèse avant mise en production : [RAPPORT_FINAL.md](RAPPORT_FINAL.md).

Projet autonome (code, base, comptes, API, configuration propres), dans son propre dépôt `niang01/xamxam-lab-` (commit initial sans historique d'un autre projet). Preuves : [RAPPORT_DE_TESTS.md](RAPPORT_DE_TESTS.md) — 112 tests unitaires/intégration, 10 parcours de bout en bout, build sans avertissement.

## 1. Terminé et testé
| Domaine | Fonctions |
|---|---|
| Socle | Comptes (15 profils, administrateur par configuration), sessions révocables, projets privés par défaut, membres et rôles, notifications, paramètres, export et suppression des données, journal d'audit chaîné, sauvegarde/restauration, PostgreSQL 16 et PGlite, Docker Compose |
| Langues | Interface FR/EN complète (catalogue typé), wolof par traductions validées uniquement (import, brouillons, validation), repli signalé, changement de langue sans perte |
| XAM-XAM AI CORE | 17 agents à liste blanche d'outils, 18 outils (dont la recherche en lecture seule dans la marketplace), gouvernance hors modèle (coupe-circuit, agents, niveaux 1–5, approbations), journal d'exécution, moteur de règles signalé, intégration Claude (format vérifié par test) |
| AI Command Center | Coupe-circuits, agents, opérations, équipements, automatisations, sessions, autonomie, ressources, audit |
| Engineering Lab | Electrical (calculs, tableaux normatifs saisis), Electronics (éditeur, ERC, versions, **ngspice réel**), Solar (NASA POWER, **pvlib horaire**, chaînes, batteries, pompage, rentabilité), Refrigeration (**CoolProp**, log p–h), Mechanical, Network, Component Library |
| Studio | Rejeu des simulations, comparaison simulation/mesure, visionneuse 3D STL |
| IoT | Passerelle HTTPS, **broker MQTT** (jeton, ACL), **agent local série**, Web Serial, mesures, commandes sûres (durée max, habilitations, expiration, accusé), arrêt d'urgence, firmware ESP32 compilé |
| Automation Studio / Remote Control | Scénarios avec essai à blanc et préautorisation niveau 5 ; sessions virtuel/banc/réel, check-list, transfert, journal |
| Earth & Space | NASA POWER (journalier, climatologie, horaire), export CSV |
| Projets / Academy / Collaboration | Rapports calculé/simulé/mesuré, mémoire guidé ; cours, QCM corrigé serveur, certificats vérifiables ; messagerie, **visioconférence WebRTC** (audio, vidéo, partage d'écran) |
| XAM-XAM MARKETPLACE | Rubrique dédiée : annonces (8 catégories, état, prix en FCFA ou sur demande, quantité, remise, caractéristiques déclarées par le vendeur), recherche et filtres, favoris, demandes avec messagerie acheteur ↔ vendeur, cycle de vie (brouillon, publiée, réservée, vendue, retirée), signalements et modération humaine motivée, sponsorisé identifié, notifications, journal d'audit. **Aucun paiement** : mise en relation uniquement |
| Écosystème | Startups, concours (jury humain, conflits d'intérêts), mentors, offres et talents (consentement), actualités et annonces (sponsorisé identifié, modération), portfolio public |
| Déploiement | Docker Compose clé en main : PostgreSQL 16, HTTPS automatique (Caddy, Let's Encrypt), sauvegardes périodiques avec rétention, passerelle MQTT optionnelle (profil `iot`, TLS exigé), contrôle de configuration avant mise en ligne (`scripts/verifier-config.mjs`) ; vérifié à travers HTTPS |
| Mobile | PWA installable ; **projets Android et iOS Capacitor ; APK et AAB Android compilés et signés** |
| Séparation | Audit SUUF / boutique réalisé, couche API et accès base réécrits, extraction autonome vérifiée ([AUDIT_SEPARATION.md](AUDIT_SEPARATION.md)) |
| Identité et interface | Logo A appliqué, thèmes sombre/clair/système, polices auto-hébergées, icônes web/Android/iOS, panneau contextuel XAM-XAM AI, barre d'état à valeurs réelles ([IDENTITE_VISUELLE.md](IDENTITE_VISUELLE.md)) |
| Double authentification | TOTP (RFC 6238, compatible Google Authenticator, Aegis, FreeOTP, 2FAS) : activation par QR code, secret chiffré AES-256-GCM, anti-rejeu, 10 codes de secours hachés à usage unique, connexion en deux étapes (défi 5 min, 5 essais), désactivation par mot de passe + second facteur, notifications et journal d'audit |
| Sécurité | Toutes les routes protégées (test automatique), rôles, limitation de débit, en-têtes, injection SPICE bloquée, processus de calcul isolés |

## 2. Partiellement opérationnel
| Fonction | Ce qui manque |
|---|---|
| Application Android | Vérifiée par les outils Android, **non exécutée sur un appareil** (pas d'émulateur) ; à recompiler avec l'adresse réelle du serveur |
| Application iOS | Projet Xcode (Capacitor 7, SPM) ; compilation réelle sur macOS par GitHub Actions (`ios.yml`) — voir RAPPORT_FINAL § 7 bis ; aucune version signée |
| Visioconférence | Fonctionne en réseau local ; entre réseaux différents, un serveur TURN est nécessaire |
| Voix (dictée, lecture) | API du navigateur ; wolof selon l'appareil, aucun service vocal wolof validé intégré |
| Textes en français uniquement | Messages ERC, libellés internes de certains calculs, réponses du moteur de règles |

## 3. En attente d'une API, d'un compte ou d'un équipement
| Fonction | Élément attendu |
|---|---|
| IA générative (Claude) | `ANTHROPIC_API_KEY` |
| Prévisions Meteomatics | Compte Meteomatics de XAM-XAM LAB |
| Wolof dans l'interface | Fichiers de traduction validés par des locuteurs natifs |
| Section de câble | Tableaux de la norme achetée, saisis par un ingénieur |
| Essais réels IoT / commandes / drones | Matériel de banc, habilitations, autorisation ANACIM (aucun vol piloté : liaison MAVLink non réalisée) |
| MQTT chiffré | Certificat TLS |
| Publication mobile | Clé de signature, comptes Google Play et Apple Developer |

## 4. Non réalisé (affiché « non disponible » dans l'application, avec sa phase)
CAO paramétrique (OpenCascade) et éléments finis (Gmsh/CalculiX) ; physique temps réel (Rapier) ; Digital Twin synchronisé ; émulation réseau (Containerlab) ; MAVLink/PX4/ArduPilot et SITL ; vidéo des appareils ; BLE, LoRa, Modbus ; édition simultanée (CRDT) et tableau blanc ; SMAP, NDVI, couches GIBS ; notifications push natives ; clés matérielles et passkeys (WebAuthn) ; paiements en ligne et abonnements (la marketplace fonctionne en mise en relation) ; classes virtuelles planifiées.
