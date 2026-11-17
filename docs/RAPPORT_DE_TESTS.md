# Rapport de tests — XAM-XAM LAB

Campagne exécutée le **17/11/2026 (15:50 UTC)** dans l'environnement de développement (Linux, Node 22.23, Python 3.13 + pvlib 0.16.1 + CoolProp 8.0.0, Chromium 1243). Aucun résultat n'est reporté sans avoir été exécuté.

## Synthèse
| Contrôle | Commande | Résultat |
|---|---|---|
| Typage strict | `npm run typecheck` | ✅ 0 erreur |
| Lint | `npm run lint` | ✅ 0 erreur, 0 avertissement |
| Tests unitaires + intégration | `XX_PYTHON=… npm test` | ✅ **83/83** (8 fichiers) |
| Build de production | `npm run build` | ✅ 0 avertissement, 0 erreur |
| Parcours de bout en bout | `npm run test:e2e` | ✅ **7/7** (ordinateur + Pixel 7) |
| Journaux du serveur pendant les parcours | sortie du serveur | ✅ 0 erreur |
| Déploiement Docker (PostgreSQL 16) | `docker compose up -d --build` puis parcours avec `XX_E2E_BASE_URL` | ✅ pile saine, **7/7** parcours, 0 erreur dans les journaux |
| Sauvegarde / restauration | `npm run db:backup` / `db:restore`, `pg_dump` | ✅ aller-retour, chaîne d'audit intègre, écrasement refusé |
| Firmware nœud IoT | `pio run -e xiao_esp32s3` | ✅ compilé (RAM 13,2 %, Flash 20,3 %) |
| Application Android | `gradlew assembleDebug`, `assembleRelease bundleRelease` | ✅ APK debug, APK + AAB release signés ; contrôle `aapt2` et `apksigner` |
| Extraction en dépôt autonome | `scripts/extraire-depot.sh` puis `npm ci`, typage, lint, tests | ✅ |

## Tests unitaires (51)
- **Calculs** (`eng.test.ts`) : loi d'Ohm, puissances triphasées, courant d'emploi, résistivité en température, chute de tension (valeur recalculée à la main), refus de supposer la réactance, section depuis tableau normatif, bilan de puissance ; production PV, Voc à froid, associations série/parallèle, batteries, pompage, LCOE ; couple, engrenages, vérin, COP de Carnot, parois ; sous-réseaux /24, /31, /32, VLSM.
- **Sécurité** (`safety.test.ts`) : niveaux d'autonomie, coupe-circuit, liste blanche, approbation ; durées maximales, commandes non déclarées, arrêt toujours permis, habilitations banc/réel ; fraîcheur ; profils ; scénarios (données simulées/anciennes ignorées, temporisation, plafond, seuil obligatoire, essai à blanc).
- **Netlist, langues, divers** (`spice-i18n.test.ts`) : nœuds, netlist, ERC, **injection de directives SPICE refusée** ; interpolation simulation/mesure ; chaque texte FR/EN présent avec les mêmes paramètres ; aucun texte wolof dans le code ; clés dynamiques et toutes les clés `t("…")` du code présentes ; CSV (aller-retour, protection contre les formules) ; QCM ; classement ; JSON canonique ; lecture série.

## Tests d'intégration (32) — base PGlite neuve par fichier, routes réelles
- **Plateforme** : administrateur seulement par configuration ; révocation des sessions ; projets privés (non-membre → 404, lecteur → 403 en écriture) ; calculs tracés ; tableaux normatifs réservés ; **ngspice réel** (pont diviseur 10/3 V, charge RC ≈ 5(1−e⁻⁵)) ; ERC bloquant ; rapport ; import wolof (validation, paramètres, clés inconnues, brouillons invisibles) ; détection d'une altération du journal d'audit.
- **Opérations** : jeton haché, mauvais jeton refusé ; habilitation banc requise puis accordée ; exécution seulement sur accusé ; durée dépassée refusée ; expiration ; arrêt d'urgence prioritaire ; session réelle refusée sans habilitation ; coupe-circuit des commandes ; scénario (essai à blanc obligatoire, mesures simulées sans effet, proposition, préautorisation niveau 5) ; IA en moteur de règles ; arrêt global ; **mode Claude avec `fetch` explicite** (format de requête : modèle, `effort: medium`, `fallbacks: "default"`, pas de `tool_choice` ni `temperature` ; écriture mise en attente puis approuvée ; double approbation refusée) ; clé refusée → repli signalé ; liste blanche des agents ; Academy (réponses masquées, correction serveur, certificat vérifiable) ; concours (version figée, jury, conflit d'intérêts refusé, classement).
- **Moteur Python** : pressions de saturation du R134a cohérentes avec les tables, bilan d'énergie du cycle, COP < Carnot, rendement isentropique ; pvlib : aucune production sans rayonnement, production positive et PR < 1 avec rayonnement. *Ignorés automatiquement (et signalés) si Python/pvlib/CoolProp sont absents.*
- **Sauvegarde** : aller-retour vers une base neuve, chaîne d'audit recalculée, refus d'écraser, refus d'un fichier altéré.
- **Sécurité** : **chacune des méthodes des 82 routes** refuse l'accès sans session (sauf routes publiques listées) ; aucune fonction d'administration accessible à un compte ordinaire ; limitation de débit de la connexion ; mots de passe courts / adresses invalides refusés ; aucun hachage renvoyé.

## Parcours de bout en bout (7)
1. Inscription, langues WO/FR/EN, **ouverture des 27 rubriques + administration + notifications sans erreur**, loi d'Ohm, simulation ngspice dans l'éditeur, enregistrement d'un schéma, projet, appareil (jeton), IA, sauvegarde téléchargeable, Command Center (chaîne d'audit intègre).
2. Un élève n'accède ni au Command Center ni à la création de cours.
3. API protégées sans session, santé, **en-têtes de sécurité** (CSP, X-Frame-Options, nosniff, HSTS, pas de X-Powered-By).
4. **MQTT** : jeton invalide refusé, télémétrie enregistrée, commande confirmée publiée, accusé → « exécutée ».
5. **Agent local série** (port série factice officiel de *serialport*) : mesure, commande écrite sur le port, accusé.
6. **Visioconférence WebRTC** entre deux membres (caméras factices de Chromium) : vidéo reçue des deux côtés, intrus refusé, départ détecté.
7. **Téléphone (Pixel 7)** : menu, 27 rubriques sans erreur, aucune page plus large que l'écran.

## Non testé (et pourquoi)
| Élément | Raison |
|---|---|
| Mode Claude avec une vraie clé | Aucune clé Anthropic dans l'environnement (format vérifié par `fetch` de test) |
| Meteomatics avec les identifiants de XAM-XAM LAB | Aucun compte XAM-XAM LAB fourni (appel réel effectué plus tôt avec un accès d'environnement, retiré depuis) |
| Appareils réels (ESP32, relais, drone) | Aucun matériel connecté ; firmware compilé seulement |
| APK sur téléphone ou émulateur | Pas de virtualisation (KVM) dans l'environnement |
| Application iOS | Xcode n'existe que sur macOS |
| Réunions entre réseaux différents | Nécessite un serveur TURN |
| TLS de la passerelle MQTT | Certificat de production requis (option implémentée) |
