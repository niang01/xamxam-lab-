# Rapport de tests — XAM-XAM LAB

Campagne exécutée le **18/11/2026** (dépôt `niang01/xamxam-lab-`) dans l'environnement de développement (Linux, Node 22.23, Python 3.13 + pvlib 0.16.1 + CoolProp 8.0.0, Chromium 1243). Aucun résultat n'est reporté sans avoir été exécuté.

## Campagne du 25/11/2026 (suite) — logiciels de dimensionnement, bibliothèque étendue
| Contrôle | Résultat |
|---|---|
| Typage strict, lint | ✅ 0 erreur |
| Tests unitaires + intégration | ✅ **244/244** (33 fichiers). Nouveaux : `etudes` unitaires (21 : socle, installation électrique recalculée à la main, géométrie solaire — H0 de l'exemple 1.10.1 de Duffie & Beckman, Rb comparé à la formule de Klein, symétrie est/ouest —, photovoltaïque, hydraulique — viscosité, pression de vapeur, Colebrook-White comparé à Haaland, point de fonctionnement —, pompage) ; `etudes` intégration (4 : tableau normatif, enregistrement, exports Word/Excel/PDF/Markdown, projet, boutique, accès refusé à un tiers, géocodage avec `fetchImpl` explicite) |
| Parcours de bout en bout | ✅ **19/19** (ordinateur + Pixel 7), dont `dimensionnement.spec.ts` (photovoltaïque et pompage : données manquantes signalées, exemple, calcul, enregistrement, export Word, schéma 2D). |
| Défauts trouvés et corrigés | (1) Sur téléphone, les tableaux de saisie élargissaient la page (673 px pour un écran de 412 px) : corrigé (`min-w-0`). Le test « aucune page plus large que l'écran » comparait la page à la fenêtre (qui s'élargit aussi quand le téléphone dézoome) : il compare désormais à la largeur de l'ÉCRAN, ce qui a révélé un débordement de 33 px sur /exercices, corrigé. (2) Échecs intermittents des parcours : limitation de débit (429) atteinte par la suite de tests, qui crée des dizaines de comptes depuis une seule adresse → multiplicateur `XX_RATE_LIMIT_FACTOR` réservé au serveur local des tests (refusé par `verifier-config`) ; saisie avant hydratation dans `comptes.spec.ts` → attente du chargement. |

## Campagne du 25/11/2026 (audit exhaustif : documents, schémas, banque, exercices, boutique, FAD, appareils et suspension)
| Contrôle | Résultat |
|---|---|
| Typage strict, lint | ✅ 0 erreur |
| Tests unitaires + intégration | ✅ **218/218** (31 fichiers). Nouveaux fichiers :<br>• `documents` (unitaire 9, intégration 4 : unités, exercices, corrigés, exports Word, Excel, PDF et Markdown, OCR d'image et de PDF scanné, cas limites 15 Mo, signature, vide)<br>• `schematics-gen` (4 : logique de démarrage vérifiée par conduction)<br>• `banque` (unitaire 8, intégration 3 : 190 projets, 17 rubriques, codes, favoris, réalisation, exercices, épreuve sur 20)<br>• `boutique` (5 : rôles, stock, mise en rayon, commande, administration)<br>• `fad` (2 : ressources contrôlées, devoirs, retard, notation)<br>• `bibliotheque-maj` (2 : non-régression de la panne du 25/11)<br>• `appareils` (4 : limite d'appareils, retrait, réinitialisation, suspension et réactivation, altération du statut détectée)<br>• `guides` (2 : chaque lien de guide mène à une page existante) |
| Défauts trouvés par les tests et corrigés | (1) La suspension ne recalculait pas l'étiquette d'intégrité : remettre `status='active'` en base contournait la suspension. Corrigé : l'étiquette couvre le statut suspendu, et la réactivation est refusée si la licence a été altérée. (2) Le cookie d'appareil était émis avant celui de session ; il est maintenant émis après. (3) Les sessions ouvertes avant la mise à jour n'avaient pas d'identifiant d'appareil ; `/api/auth/me` l'attribue désormais. |
| Build de production | ✅ |
| Parcours de bout en bout | ✅ **17/17** sur 3 exécutions consécutives. Nouveau parcours `rubriques.spec.ts`, sur ordinateur **et** Pixel 7 : dépôt et analyse d'un document, export Word valide, réalisation d'un projet de la banque, exercice corrigé, commande en boutique confirmée par le vendeur (stock 4 → 3), paiement annoncé hors ligne, FAD, « Mes appareils ». ⚠️ Une exécution antérieure a présenté 1 échec isolé (assertion `toContainText`) qui n'a pas été reproduit ensuite ; il est signalé, pas masqué. |
| Compilation des programmes de la banque | ✅ 11/11 compilés avec PlatformIO (ESP32-S3) ; une collision de nom (`alarm`) a été révélée par la compilation, puis corrigée. Programmes non essayés sur matériel réel. |
| Incident de production | Le 25/11, entre ≈06:33 et 06:49 UTC, la mise à jour de la bibliothèque a violé une contrainte d'unicité lors du chargement (doublons hérités). Le service était indisponible pendant cette période. Corrigé dans le commit 27a28f1 (fusion des doublons, chargement isolé), avec un test de non-régression. |
| Production (commit bec3d85, 25/11 ≈07:40 UTC) | ✅ Pixel 7 et ordinateur : inscription et profil ; cookie d'appareil httpOnly + Secure ; « Mes appareils » ; document analysé et export Word valide ; banque de 190 projets ; paiement de la boutique annoncé hors ligne ; guides FAD et Licence ; aucun débordement ; comptes de test supprimés (HTTP 200). Défaut constaté puis corrigé (commit bec3d85) : pendant le chargement, la banque affichait « 0 projet(s) » au lieu de « Chargement… ». Non vérifié en production : la suspension et la limite d'appareils, qui exigent un compte administrateur (vérifiées par les tests d'intégration). |
| Production (commit 27a28f1) | ✅ documents (exports, OCR), schéma, banque de 190 projets, réalisation, exercice, message de paiement de la boutique, FAD, schéma demandé à Aláji IA, aucun débordement sur téléphone, suppression de compte (200). Limite observée : l'OCR n'a pas reconnu une ligne « Réponse » (le texte est corrigeable). |

## Campagne du 24/11/2026 (profil, mots de passe)
✅ 165/165 tests unitaires et d'intégration (dont `password.test.ts`, `profil.test.ts` : champs du profil, mot de passe absent des réponses, des journaux et de la base), ✅ 15/15 parcours dont `mot-de-passe.spec.ts` exécuté sur ordinateur **et** Pixel 7 (œil sur inscription, confirmation, connexion, changement, réinitialisation ; robustesse ; concordance ; profil affiché et modifié ; aucune page plus large que l'écran).

## Campagne du 23/11/2026 (comptes, licences, Aláji IA, espaces 2D/3D/4D, bibliothèque, projets)
| Contrôle | Résultat |
|---|---|
| Typage strict, lint | ✅ 0 erreur |
| Tests unitaires + intégration | ✅ **161/161** (19 fichiers) — dont `suppression.test.ts` (défaut antérieur corrigé : suppression d'un compte ayant créé des tâches bloquée par des clés étrangères ; suppression par l'administrateur avec confirmation), dont `accounts.test.ts` (13 : clés en base, admin, verrouillage, réinitialisation, vérification d'adresse, courriel avec `fetchImpl` explicite, code d'initialisation, essai, fraude sur les dates, licences : émission, activation, postes, renouvellement, révocation), `alaji.test.ts` (8 : analyse, vérificateur, mode sans clé, rapport, fournisseur compatible OpenAI avec `fetchImpl` explicite), `espaces.test.ts` (unitaires 8 + intégration 6 : bibliothèque, modèles, schémas 2D, bilans 4D, maquette 3D, budget, exports) |
| Build de production | ✅ |
| Parcours de bout en bout | ✅ **13/13** — dont `comptes.spec.ts` (inscription → profil → déconnexion → mot de passe oublié → lien administrateur → nouvelle connexion → activation de licence) et `espaces.spec.ts` (modèle de projet, budget, bibliothèque, schéma 2D relié et enregistré, scénario 4D au bilan nul, maquette 3D avec masse) |
| Production (https://xamxam-lab.onrender.com) | ✅ inscription, configuration du profil, guide, tableau de bord, déconnexion, reconnexion, session conservée après rechargement, sur téléphone Android (Pixel 7), tablette (Galaxy Tab S4) et ordinateur (émulation Playwright), sans débordement ; comptes de test supprimés |
| Non vérifiable ici | Fournisseur d'IA réel (aucun configuré ; le routeur Hugging Face est bloqué par le réseau de développement) ; envoi réel de courriel (aucun fournisseur configuré) |

## Synthèse (campagne du 18/11/2026)
| Contrôle | Commande | Résultat |
|---|---|---|
| Typage strict | `npm run typecheck` | ✅ 0 erreur |
| Lint | `npm run lint` | ✅ 0 erreur, 0 avertissement |
| Tests unitaires + intégration | `XX_PYTHON=… npm test` | ✅ **112/112** (13 fichiers) |
| Build de production | `npm run build` | ✅ 0 avertissement, 0 erreur |
| Parcours de bout en bout | `npm run test:e2e` | ✅ **10/10** (ordinateur + Pixel 7) |
| Journaux du serveur pendant les parcours | sortie du serveur | ✅ 0 erreur |
| Déploiement Docker (PostgreSQL 16) | `docker compose up -d --build` puis parcours avec `XX_E2E_BASE_URL` | ✅ pile saine, 4 migrations appliquées, **10/10** parcours (`XX_E2E_BASE_URL`, `XX_E2E_ADMIN`), 0 erreur dans les journaux ; sauvegarde incluant marketplace et double authentification |
| Déploiement HTTPS (Caddy) + sauvegardes automatiques | `verifier-config`, `docker compose --profile https up -d`, parcours avec `XX_E2E_BASE_URL=https://localhost:8443` | ✅ **10/10** parcours à travers HTTPS, sauvegardes périodiques, rétention appliquée, 0 erreur |
| Sauvegarde / restauration | `npm run db:backup` / `db:restore`, `pg_dump` | ✅ aller-retour, chaîne d'audit intègre, écrasement refusé |
| Firmware nœud IoT | `pio run -e xiao_esp32s3` | ✅ compilé (RAM 13,2 %, Flash 20,3 %) |
| Application Android | `gradlew assembleDebug`, `assembleRelease bundleRelease` | ✅ APK debug, APK + AAB release signés ; contrôle `aapt2` et `apksigner` ; APK recompilé le 18/11 avec les icônes de l'identité A (vérifiées dans `res/mipmap-*`) |
| Extraction en dépôt autonome | `scripts/extraire-depot.sh` puis `npm ci`, typage, lint, tests | ✅ |

## Tests unitaires (68)
- **Configuration de production** (`deploiement.test.ts`) : lecture `.env`, secrets manquants/courts/d'exemple refusés sans afficher leur valeur, clé de chiffrement distincte, administrateurs valides, cookies sécurisés, TLS MQTT cohérent, domaine.
- **TOTP** (`totp.test.ts`) : vecteurs officiels RFC 4226 (HOTP) et RFC 6238 annexe B (SHA-1, SHA-256, SHA-512, 6 instants), fenêtre ±1 pas, anti-rejeu, base32 RFC 4648, URI otpauth, codes de secours ; chiffrement AES-256-GCM du secret (contexte et altération détectés).
- **Calculs** (`eng.test.ts`) : loi d'Ohm, puissances triphasées, courant d'emploi, résistivité en température, chute de tension (valeur recalculée à la main), refus de supposer la réactance, section depuis tableau normatif, bilan de puissance ; production PV, Voc à froid, associations série/parallèle, batteries, pompage, LCOE ; couple, engrenages, vérin, COP de Carnot, parois ; sous-réseaux /24, /31, /32, VLSM.
- **Sécurité** (`safety.test.ts`) : niveaux d'autonomie, coupe-circuit, liste blanche, approbation ; durées maximales, commandes non déclarées, arrêt toujours permis, habilitations banc/réel ; fraîcheur ; profils ; scénarios (données simulées/anciennes ignorées, temporisation, plafond, seuil obligatoire, essai à blanc).
- **Marketplace** (`market.test.ts`) : état exigé pour un matériel et interdit pour une prestation, prix entier positif, cycle de vie (vendu/retiré définitifs), droits sur les demandes, visibilité, refus (propre annonce, quantité, indisponible), format FCFA.
- **Netlist, langues, divers** (`spice-i18n.test.ts`) : nœuds, netlist, ERC, **injection de directives SPICE refusée** ; interpolation simulation/mesure ; chaque texte FR/EN présent avec les mêmes paramètres ; aucun texte wolof dans le code ; clés dynamiques et toutes les clés `t("…")` du code présentes ; CSV (aller-retour, protection contre les formules) ; QCM ; classement ; JSON canonique ; lecture série.

## Tests d'intégration (44) — base PGlite neuve par fichier, routes réelles
- **Double authentification** (`mfa.test.ts`) : secret chiffré en base, premier code exigé, codes de secours hachés ; pas de session après le mot de passe seul ; code réutilisé refusé ; défi consommé ; 5 essais au plus ; code de secours à usage unique ; désactivation exigeant mot de passe et second facteur.
- **Marketplace** (`marketplace.test.ts`) : publication, brouillon invisible, état incohérent refusé, filtres prix/catégorie ; modification réservée au vendeur ; demande sur sa propre annonce refusée, quantité excessive refusée, doublon refusé, notification du vendeur ; fil accessible aux deux seules parties ; seul le vendeur accepte ; vente déclarée → demandes closes et acheteur prévenu, plus de retour en vente ni de suppression ; outil IA `search_marketplace` limité aux annonces publiées et visibles ; signalement unique, file de modération réservée aux administrateurs, motif obligatoire, annonce masquée et vendeur informé, rétablissement et sponsorisé tracés, chaîne d'audit intègre.
- **Plateforme** : administrateur seulement par configuration ; révocation des sessions ; projets privés (non-membre → 404, lecteur → 403 en écriture) ; calculs tracés ; tableaux normatifs réservés ; **ngspice réel** (pont diviseur 10/3 V, charge RC ≈ 5(1−e⁻⁵)) ; ERC bloquant ; rapport ; import wolof (validation, paramètres, clés inconnues, brouillons invisibles) ; détection d'une altération du journal d'audit.
- **Opérations** : jeton haché, mauvais jeton refusé ; habilitation banc requise puis accordée ; exécution seulement sur accusé ; durée dépassée refusée ; expiration ; arrêt d'urgence prioritaire ; session réelle refusée sans habilitation ; coupe-circuit des commandes ; scénario (essai à blanc obligatoire, mesures simulées sans effet, proposition, préautorisation niveau 5) ; IA en moteur de règles ; arrêt global ; **mode Claude avec `fetch` explicite** (format de requête : modèle, `effort: medium`, `fallbacks: "default"`, pas de `tool_choice` ni `temperature` ; écriture mise en attente puis approuvée ; double approbation refusée) ; clé refusée → repli signalé ; liste blanche des agents ; Academy (réponses masquées, correction serveur, certificat vérifiable) ; concours (version figée, jury, conflit d'intérêts refusé, classement).
- **Moteur Python** : pressions de saturation du R134a cohérentes avec les tables, bilan d'énergie du cycle, COP < Carnot, rendement isentropique ; pvlib : aucune production sans rayonnement, production positive et PR < 1 avec rayonnement. *Ignorés automatiquement (et signalés) si Python/pvlib/CoolProp sont absents.*
- **Sauvegarde** : aller-retour vers une base neuve, chaîne d'audit recalculée, refus d'écraser, refus d'un fichier altéré.
- **Sécurité** : **chacune des méthodes des 95 routes** refuse l'accès sans session (sauf routes publiques listées) ; aucune fonction d'administration accessible à un compte ordinaire ; limitation de débit de la connexion ; mots de passe courts / adresses invalides refusés ; aucun hachage renvoyé.

## Parcours de bout en bout (7)
1. Inscription, langues WO/FR/EN, **ouverture de toutes les rubriques (28) + administration + notifications sans erreur**, loi d'Ohm, simulation ngspice dans l'éditeur, enregistrement d'un schéma, projet, appareil (jeton), IA, sauvegarde téléchargeable, Command Center (chaîne d'audit intègre).
2. Un élève n'accède ni au Command Center ni à la création de cours.
3. API protégées sans session, santé, **en-têtes de sécurité** (CSP, X-Frame-Options, nosniff, HSTS, pas de X-Powered-By).
4. **MQTT** : jeton invalide refusé, télémétrie enregistrée, commande confirmée publiée, accusé → « exécutée ».
5. **Agent local série** (port série factice officiel de *serialport*) : mesure, commande écrite sur le port, accusé.
6. **Visioconférence WebRTC** entre deux membres (caméras factices de Chromium) : vidéo reçue des deux côtés, intrus refusé, départ détecté.
7. **Téléphone (Pixel 7)** : menu, 28 rubriques sans erreur, aucune page plus large que l'écran.
8. **Interface** : logo vectoriel, favicon, polices locales, thème sombre par défaut puis clair mémorisé, barre d'état (serveur, base, mode IA, appareils), panneau XAM-XAM AI depuis un laboratoire.
10. **Double authentification** : activation par QR code (code calculé RFC 6238), déconnexion, mot de passe seul insuffisant, code faux refusé, connexion par code de secours, 9 codes restants.
9. **Marketplace** (deux comptes) : publication avec caractéristiques, recherche, demande avec quantité, réponse, acceptation, vente déclarée, demande close côté acheteur.

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
