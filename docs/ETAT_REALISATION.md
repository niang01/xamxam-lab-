# XAM-XAM LAB — état de réalisation (17/11/2026)

Projet autonome (code, base, comptes, API, configuration propres), dans son propre dépôt `niang01/xamxam-lab-` (commit initial sans historique d'un autre projet). Preuves : [RAPPORT_DE_TESTS.md](RAPPORT_DE_TESTS.md) — 83 tests unitaires/intégration, 7 parcours de bout en bout (serveur local et déploiement Docker sur PostgreSQL 16), build sans avertissement.

## 1. Terminé et testé
| Domaine | Fonctions |
|---|---|
| Socle | Comptes (15 profils, administrateur par configuration), sessions révocables, projets privés par défaut, membres et rôles, notifications, paramètres, export et suppression des données, journal d'audit chaîné, sauvegarde/restauration, PostgreSQL 16 et PGlite, Docker Compose |
| Langues | Interface FR/EN complète (catalogue typé), wolof par traductions validées uniquement (import, brouillons, validation), repli signalé, changement de langue sans perte |
| XAM-XAM AI CORE | 17 agents à liste blanche d'outils, 17 outils, gouvernance hors modèle (coupe-circuit, agents, niveaux 1–5, approbations), journal d'exécution, moteur de règles signalé, intégration Claude (format vérifié par test) |
| AI Command Center | Coupe-circuits, agents, opérations, équipements, automatisations, sessions, autonomie, ressources, audit |
| Engineering Lab | Electrical (calculs, tableaux normatifs saisis), Electronics (éditeur, ERC, versions, **ngspice réel**), Solar (NASA POWER, **pvlib horaire**, chaînes, batteries, pompage, rentabilité), Refrigeration (**CoolProp**, log p–h), Mechanical, Network, Component Library |
| Studio | Rejeu des simulations, comparaison simulation/mesure, visionneuse 3D STL |
| IoT | Passerelle HTTPS, **broker MQTT** (jeton, ACL), **agent local série**, Web Serial, mesures, commandes sûres (durée max, habilitations, expiration, accusé), arrêt d'urgence, firmware ESP32 compilé |
| Automation Studio / Remote Control | Scénarios avec essai à blanc et préautorisation niveau 5 ; sessions virtuel/banc/réel, check-list, transfert, journal |
| Earth & Space | NASA POWER (journalier, climatologie, horaire), export CSV |
| Projets / Academy / Collaboration | Rapports calculé/simulé/mesuré, mémoire guidé ; cours, QCM corrigé serveur, certificats vérifiables ; messagerie, **visioconférence WebRTC** (audio, vidéo, partage d'écran) |
| Écosystème | Startups, concours (jury humain, conflits d'intérêts), mentors, offres et talents (consentement), actualités et annonces (sponsorisé identifié, modération), portfolio public |
| Mobile | PWA installable ; **projets Android et iOS Capacitor ; APK et AAB Android compilés et signés** |
| Séparation | Audit SUUF / boutique réalisé, couche API et accès base réécrits, extraction autonome vérifiée ([AUDIT_SEPARATION.md](AUDIT_SEPARATION.md)) |
| Identité et interface | Logo A appliqué, thèmes sombre/clair/système, polices auto-hébergées, icônes web/Android/iOS, panneau contextuel XAM-XAM AI, barre d'état à valeurs réelles ([IDENTITE_VISUELLE.md](IDENTITE_VISUELLE.md)) |
| Sécurité | Toutes les routes protégées (test automatique), rôles, limitation de débit, en-têtes, injection SPICE bloquée, processus de calcul isolés |

## 2. Partiellement opérationnel
| Fonction | Ce qui manque |
|---|---|
| Application Android | Vérifiée par les outils Android, **non exécutée sur un appareil** (pas d'émulateur) ; à recompiler avec l'adresse réelle du serveur |
| Application iOS | Projet généré ; compilation sur macOS/Xcode non réalisée |
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
| Essais réels IoT / commandes / drones | Matériel de banc, habilitations, autorisation ANACIM |
| MQTT chiffré | Certificat TLS |
| Publication mobile | Clé de signature, comptes Google Play et Apple Developer |

## 4. Non réalisé (affiché « non disponible » dans l'application, avec sa phase)
CAO paramétrique (OpenCascade) et éléments finis (Gmsh/CalculiX) ; physique temps réel (Rapier) ; Digital Twin synchronisé ; émulation réseau (Containerlab) ; MAVLink/PX4/ArduPilot et SITL ; vidéo des appareils ; BLE, LoRa, Modbus ; édition simultanée (CRDT) et tableau blanc ; SMAP, NDVI, couches GIBS ; notifications push natives ; double authentification (TOTP, WebAuthn) ; paiements et abonnements ; classes virtuelles planifiées.
