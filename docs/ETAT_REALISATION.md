# XAM-XAM LAB — état de réalisation (25/11/2026)

Synthèse avant mise en production : [RAPPORT_FINAL.md](RAPPORT_FINAL.md).

Projet autonome (code, base, comptes, API, configuration propres), dans son propre dépôt `niang01/xamxam-lab-` (commit initial sans historique d'un autre projet). Preuves : [RAPPORT_DE_TESTS.md](RAPPORT_DE_TESTS.md) — 218 tests unitaires et d'intégration, 17 parcours de bout en bout (25/11), build sans avertissement.

## 1. Terminé et testé
Audit détaillé par discipline et par espace : [AUDIT_DISCIPLINES.md](AUDIT_DISCIPLINES.md).

| Domaine | Fonctions |
|---|---|
| Logiciels de dimensionnement (25/11) | Rubrique « Logiciels de dimensionnement » (/dimensionnement) : socle commun (moteur pur testé, références réelles de la bibliothèque, données manquantes signalées, nomenclature, schéma 2D, rapport PDF/Word/Excel/Markdown, envoi vers projet et boutique). **Installation électrique** (Ib, calibres normalisés, sections d'après le tableau normatif, chutes de tension, appareil général, unifilaire de tableau). **Photovoltaïque** (recherche de lieu avec autocomplétion, NASA POWER, plan incliné, besoins, chaînes, batteries, onduleur, câbles, protections, production, pertes). **Pompage** (besoins, HMT, Darcy-Weisbach/Colebrook-White, point de fonctionnement, NPSH, réseau/groupe/solaire). Bibliothèque portée à 401 composants (électricité domestique et industrielle, domotique, automatisme, PV, pompage, thermique, biomasse, compostage, cartes IoT, capteurs, actionneurs, communication, électronique). Laboratoire renommé « Électricité et Électrotechnique ». |
| Audit exhaustif (25/11) | Tableau de contrôle ligne par ligne : [TABLEAU_DE_CONTROLE.md](TABLEAU_DE_CONTROLE.md). **Documents** traités par Aláji IA (PDF, Word, Excel, PowerPoint, images et scans par OCR, texte, code, DXF, STL ; calculs vérifiés, corrigés, exports PDF, Word, Excel, Markdown). **9 générateurs de schémas**. **Bibliothèque** de 190 composants (23 disciplines, 20 filières). **Banque** de 190 projets, dont 100 IoT (17 rubriques, 11 programmes compilés). **19 modèles d'exercices** et épreuves sur 20. **Boutique** : 15 rayons, panier, commandes, stock, vendeurs, administration ; paiement hors plateforme. **FAD** : modules, ressources, devoirs, TD, TP et examens, notes, progression. **Licences** : appareils autorisés, suspension et réactivation. 6 guides ajoutés. |
| Comptes et licences (23/11) | Inscription, configuration du profil, connexion / déconnexion, verrouillage après 5 échecs, mot de passe oublié (fournisseur de courriel configurable, sinon lien généré par l'administrateur), vérification d'adresse, clés serveur générées et conservées en base si l'hébergeur ne les fournit pas, administrateur principal (XX_ADMIN_EMAILS ou code d'initialisation des journaux), **essai gratuit de 90 jours et licences** (catégories, clés 125 bits hachées, postes, attribution, renouvellement, révocation, historique, intégrité HMAC, contrôle serveur), tableau de bord d'administration, guides intégrés |
| Aláji IA (23/11) | Cerveau central renommé ; fournisseur configurable ; analyse des demandes ; agent vérificateur réel ; rapports et suivi de projets ; historique |
| Espaces 2D / 3D / 4D (23/11) | Schémas 2D multidisciplines ; maquette 3D paramétrique ; scénarios 4D avec bilans de conservation |
| Bibliothèque (23/11 → 25/11) | 190 composants génériques, 23 disciplines regroupées en 20 filières, paramètres avec unités |
| Projets structurés (23/11) | 10 modèles × 6 niveaux, dossier complet, budget, rapport et présentation exportés |
| Socle | Comptes (15 profils, administrateur par configuration), sessions révocables, projets privés par défaut, membres et rôles, notifications, paramètres, export et suppression des données, journal d'audit chaîné, sauvegarde/restauration, PostgreSQL 16 et PGlite, Docker Compose |
| Langues | Interface FR/EN complète (catalogue typé), wolof par traductions validées uniquement (import, brouillons, validation), repli signalé, changement de langue sans perte |
| Aláji IA (agents, outils) | 17 agents à liste blanche d'outils, 18 outils (dont la recherche en lecture seule dans la marketplace), gouvernance hors modèle (coupe-circuit, agents, niveaux 1–5, approbations), journal d'exécution, moteur de règles signalé, intégration Claude (format vérifié par test) |
| AI Command Center | Coupe-circuits, agents, opérations, équipements, automatisations, sessions, autonomie, ressources, audit |
| Engineering Lab | Electrical (calculs, tableaux normatifs saisis), Electronics (éditeur, ERC, versions, **ngspice réel**), Solar (NASA POWER, **pvlib horaire**, chaînes, batteries, pompage, rentabilité), Refrigeration (**CoolProp**, log p–h), Mechanical, Network, Component Library |
| Studio | Rejeu des simulations, comparaison simulation/mesure, visionneuse 3D STL |
| IoT | Passerelle HTTPS, **broker MQTT** (jeton, ACL), **agent local série**, Web Serial, mesures, commandes sûres (durée max, habilitations, expiration, accusé), arrêt d'urgence, firmware ESP32 compilé |
| Automation Studio / Remote Control | Scénarios avec essai à blanc et préautorisation niveau 5 ; sessions virtuel/banc/réel, check-list, transfert, journal |
| Drone Command Center | Règles de vol testées (profil constructeur, conditions prévues, mission : plafond, géorepérage, autonomie), API et page (enregistrement, télémétrie, profil, conditions 48 h, missions, commandes confirmées, arrêt d'urgence), pont MAVLink (pymavlink) avec liaison réelle établie vers ArduPilot SITL. **Armement/décollage non encore validés sur SITL ; aucun drone réel pilotable à ce stade** (voir PROJECT_STATUS.md) |
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
| Application iOS | Projet Xcode (Capacitor 7, SPM) ; workflow de compilation macOS prêt (`ios.yml`) mais **non exécuté** : GitHub a annulé la tâche faute de machine macOS attribuée (18/11) — iOS **non compilé** ; aucune version signée |
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
