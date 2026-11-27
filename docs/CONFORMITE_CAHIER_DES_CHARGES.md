# Conformité au cahier des charges général — tableau final (27/11/2026)

Reprise du cahier des charges **point par point**, après l'exécution intégrale demandée.

## Lecture du tableau

Colonnes : **Exigence** · **Réalisation** · **Installation** (outil, bibliothèque ou moteur mis en place) · **Configuration** (base, service, variable) · **Tests** · **Résultat**.

Statuts (partie 20) :
- **Absent** ;
- **Présent mais non fonctionnel** ;
- **Partiellement fonctionnel** ;
- **Fonctionnel** ;
- **Testé et validé** : vérifié par des tests automatiques exécutés, et en production lorsque c'est indiqué « prod ».

Pour une installation réelle, les résultats de calcul restent à faire vérifier par une personne compétente.

Preuves : `tests/unit`, `tests/integration`, `tests/e2e`, et [RAPPORT_DE_TESTS.md](RAPPORT_DE_TESTS.md).

Production : https://xamxam-lab.onrender.com (Render gratuit, base **Neon** `xamxam-db`), commit `2b7991f` et suivants (vérifiée le 27/11/2026 sur ordinateur et Pixel 7).

## Synthèse chiffrée (comptée dans le code)

| Élément | Début du cahier des charges | Aujourd'hui |
|---|---|---|
| Composants de la bibliothèque (sans doublon, test) | 190 | **389** (23 disciplines, 20 filières) |
| Logiciels de dimensionnement | 0 | **27** |
| Générateurs de schémas | 9 | **10** |
| Banque de projets | 190, dont 100 IoT | **305**, dont **215 IoT**, dans **35 secteurs** ; dossier de **35 rubriques** |
| Agents d'Aláji IA | 17 | **25**, + outils `list_software` et `run_study` |
| Rayons de la boutique | 15 | **31** |
| Programmes Arduino compilés et simulés en ligne | 0 | **4 exemples** + code libre de l'utilisateur |
| Symboles normalisés dessinés (CEI 60617, ISO 1219, ISA 5.1) | 0 | **69** (éditeur, bibliothèque, PDF, DXF) |
| Programmes d'automate d'exemple (Ladder, Grafcet) | 0 | **7 + 4**, éditeur et simulateur |
| Cours intégrés | 0 (cours créés par les formateurs seulement) | **12** (60 leçons, 72 questions) |
| Travaux pratiques guidés | 0 | **21** ; 10 schémas types illustrés ; 22 simulations prêtes |
| Tests unitaires et d'intégration | 218 | **334** (45 fichiers) |
| Parcours de bout en bout (ordinateur et Pixel 7) | 17 | **26** |

## Partie 1 — Laboratoire Électricité et Électrotechnique

| Exigence | Réalisation | Installation | Configuration | Tests | Résultat |
|---|---|---|---|---|---|
| Nom « Électricité et Électrotechnique » | Menu, Aláji, guides | — | — | e2e `interface` | Testé et validé |
| Matériel domestique, industriel, domotique et automatisme | Types génériques avec paramètres et unités | Bibliothèque (389) | Migrations, fusion des doublons en base | `espaces`, unicité de la bibliothèque | Testé et validé. Références de fabricant à saisir avec leur fiche |
| Unifilaire, puissance et commande | Générateurs : démarrage direct, étoile-triangle, inversion, unifilaire de tableau et PV | `schematics-gen` | — | `schematics-gen` (conduction vérifiée) | Testé et validé |
| Plans cotés, calques, implantation | Éditeur 2D : cotation à l'échelle (mm/unité), calques affichables, impression | — | — | `plans` (cotes, calques, DXF), e2e `dimensionnement` (cotation, DXF calque COTES) prod | Testé et validé. Plan architectural du bâtiment non généré automatiquement |
| Dimensionnement des conducteurs et protections, nomenclature, rapport | Logiciel « Installation électrique » | — | Tableau normatif saisi par l'administrateur | `etudes` (recalcul à la main) | Testé et validé. Le tableau normatif reste à saisir en production (voir interventions) |
| Simulation des circuits | ngspice (électronique) ; scénarios 4D ; **schémas de commande simulés en Ladder** (démarrage direct, étoile-triangle, télérupteur, minuterie) | ngspice WebAssembly, moteur Ladder | — | `spice-i18n`, `automate` (comportements vérifiés) ; e2e `automatisme` prod | Testé et validé pour la commande. Pas de simulation transitoire des grandeurs de puissance (courants de démarrage) |

## Partie 2 et partie 5 — Photovoltaïque et un logiciel par discipline

| Exigence | Réalisation | Installation | Configuration | Tests | Résultat |
|---|---|---|---|---|---|
| Lieu avec autocomplétion et coordonnées GPS | Open-Meteo Geocoding | — | Gratuit, sans clé | `etudes` (`fetchImpl` explicite) ; prod (Thiès) | Testé et validé |
| Irradiation et température | NASA POWER mensuel ; plan incliné | pvlib (calcul horaire du Solar Lab) | Gratuit, sans clé | Duffie & Beckman 1.10.1 ; prod | Testé et validé |
| Chaîne complète : besoins, crête, modules, batteries, onduleur, régulateur, chaînes, câbles, protections, production, pertes, schéma, nomenclature, rapport | Logiciel « Photovoltaïque » | — | — | `etudes`, e2e prod (calcul, export Word, schéma, PDF A3) | Testé et validé |
| Maquette 3D du champ | « Générer la maquette 3D » d'après les dimensions du module | Three.js | — | `etudes` (model3d), e2e prod | Testé et validé. Si une dimension manque, elle est signalée |
| Un logiciel par discipline (25) | **27 logiciels** : électricité, PV, pompage, solaire thermique, séchage, biomasse, compostage, électronique, électronique de puissance, automatisme, instrumentation, nœud IoT, biomédical, informatique, réseau, télécoms, mécanique, génie industriel, génie civil, bâtiment, froid, plomberie, robotique, drone, irrigation, domotique, bilan carbone | — | — | `disciplines` (16), `etudes` (30), e2e mobile (chaque page sur téléphone) prod | Testé et validé. Les coefficients normatifs ou de fiche absents sont demandés, jamais supposés |

## Partie 3 — Laboratoire IoT et électronique

| Exigence | Réalisation | Installation | Configuration | Tests | Résultat |
|---|---|---|---|---|---|
| Cartes, capteurs, actionneurs, modules de communication | 17 cartes, 64 capteurs, 21 actionneurs, 18 modules et plateformes | Bibliothèque | — | `espaces` | Testé et validé |
| Éditeur de schémas électroniques | Placement, rotation, fils, broches, vérification | — | — | e2e `espaces` | Testé et validé |
| Symboles conventionnels illustrés | 69 symboles CEI 60617 / ISO 1219 / ISA 5.1, choisis selon la fonction (contact NF/NO, bobine, contacts principaux…) ; vignettes dans la bibliothèque et la palette ; calque SYMBOLES du DXF | — | — | `symboles` (6), e2e `espaces`, `dimensionnement` prod | Testé et validé. Équipements complexes : élément fonctionnel rectangulaire (forme CEI) |
| Automatisme : programmation d'automates (Ladder CEI 61131-3) | Éditeur d'échelons, contacts NO/NF/fronts, SET/RST, TON/TOF/TP, CTU/CTD, simulation au cycle de 10 ms avec circulation du courant, 7 exemples, programmes enregistrés et versionnés | Moteur pur `src/lib/plc/ladder.ts` | Table `schematics` (lab ladder) | `automate` (9), `automate-api` (2), e2e prod | Testé et validé. Automate générique : ressaisie nécessaire dans le logiciel du constructeur |
| Grafcet (CEI 60848) | Étapes, transitions, réceptivités (. + / ↑ t/Xn/…), divergences/convergences en ET, simulation, 4 exemples | Moteur pur `grafcet.ts` | Table `schematics` (lab grafcet) | `automate` (4), e2e prod | Testé et validé |
| Informatique industrielle : Modbus | Trames RTU (CRC-16) et TCP (MBAP), décodage des réponses et exceptions | `modbus.ts` | — | trame de référence « 01 03 00 00 00 0A C5 CD », e2e prod | Testé et validé. Liaison avec un équipement réel : passerelle IoT ou convertisseur RS-485 |
| Éditeur de code et compilation | Éditeur CodeMirror (C++), compilation réelle sur le serveur | **avr-gcc, binutils-avr, avr-libc, cœur Arduino AVR** dans l'image Docker et la CI ; CodeMirror 6 | Aucune ; compatibilité avr-gcc 5 (Debian) traitée | `iot-simulation` (5) ; e2e `iot` ; prod (2 832 octets) | Testé et validé |
| Simulation embarquée (programme et capteurs) | Émulateur ATmega328P : entrées 0–5 V sur A0–A5, entrées D2–D5, sorties D2–D13, moniteur série, temps simulé | **avr8js 0.20.1** (MIT) | — | `iot-simulation` : clignotement, seuil avec hystérésis, alarme temporisée, sécurité pompe ; binaire de prod simulé ; e2e prod | Testé et validé pour l'Arduino Uno. Non émulés : minuteries 1 et 2, I2C, SPI, ESP32 |
| Téléversement sur carte | Téléchargement du .hex ; lecture série Web Serial | — | — | e2e (.hex) | Fonctionnel. Pas de téléversement depuis le navigateur |
| Tests réels sur carte (MQTT, agent série) | Passerelle MQTT et agent local | Broker MQTT, serialport | Jetons par appareil | e2e `iot` | Testé et validé sur la passerelle. Matériel réel non branché ici |

## Partie 4 — IoT dans tous les secteurs

| Exigence | Réalisation | Tests | Résultat |
|---|---|---|---|
| 32 secteurs demandés + 3 | 215 projets IoT, filtre « Secteur » ; l'agriculture représente moins de 20 % des projets | `banque` (35 secteurs, au moins 2 projets chacun) ; prod (inventaire 305/215) | Testé et validé |
| Sécurité IoT (partie 17) dans chaque projet | Authentification, chiffrement, mode dégradé, journalisation, mises à jour, sauvegarde ; aucun secret dans les programmes | `banque` | Testé et validé |
| Applications critiques | Avertissement « prototype » (santé : ni dispositif médical ni diagnostic ; ATEX ; drones…) | `banque` | Testé et validé |

## Parties 6 à 10 — Pompage, séchage, biomasse, compostage, solaire thermique

| Logiciel | Réalisation | Tests | Résultat |
|---|---|---|---|
| Pompage de A à Z | Besoins, HMT, Colebrook-White, point de fonctionnement, NPSH, électrique, groupe, solaire, schéma, nomenclature, rapport | `etudes`, e2e prod | Testé et validé |
| Séchage solaire | Direct, indirect, mixte, hybride ; psychrométrie ; maquette 3D (chambre, claies, capteur) | `etudes` | Testé et validé. La cinétique de séchage exige un essai |
| Biomasse et biogaz | Digesteur, biogaz, cogénération, digestat, combustion | `etudes` | Testé et validé. Potentiels méthanogènes saisis par l'utilisateur |
| Compostage | C/N, humidité, andains, aération, calendrier | `etudes` | Testé et validé |
| Solaire thermique | Besoins, η0/a1/a2, couverture, ballon, circuit, économies | `etudes` | Testé et validé. Méthode mensuelle |

## Partie 11 — Conception automatique 2D/3D, plans, impression, exports

| Exigence | Réalisation | Tests | Résultat |
|---|---|---|---|
| Lecture de documents : PDF, Word, Excel, PowerPoint, images, scans | Extraction et OCR (français, anglais) ; Poppler et Tesseract installés | `documents` | Testé et validé |
| Lecture technique de plans et cahiers des charges | Équipements de la bibliothèque, repères (QF1, KM1…), dimensions et grandeurs avec unités, générateur adapté, informations manquantes | `documents` (cahier de pompage) | Testé et validé sur le texte. Le dessin d'un plan scanné n'est pas vectorisé |
| Génération 2D | 10 générateurs ; génération depuis une étude, un document ou Aláji | `schematics-gen`, e2e prod | Testé et validé |
| Génération 3D | Maquette depuis une étude (PV, séchage, froid, génie civil) ; éditeur 3D, masses, STL | `etudes`, e2e `espaces` et `dimensionnement` prod | Testé et validé. Pas de 3D depuis un document ; vues éclatées et plans de fabrication absents |
| Cotation, calques, légende, nomenclature | Cotes à l'échelle, calques, notes, nomenclature | `plans`, e2e prod | Testé et validé |
| Impression A4–A1, orientation, cartouche, aperçu, PDF | Planche PDF avec cartouche | `plans`, e2e prod | Testé et validé |
| Formats SVG, PNG, PDF, DXF | DXF R12 par calque, calque COTES | `plans`, e2e prod | Testé et validé |
| Format DWG | — | — | **Absent** : format propriétaire, sans outil libre fiable. Ouvrir le DXF dans un logiciel de DAO puis l'enregistrer en DWG |

## Partie 12 — Banque de projets

| Exigence | Réalisation | Tests | Résultat |
|---|---|---|---|
| Des centaines de projets distincts | 305 projets, 20 filières, 6 niveaux | `banque`, prod | Testé et validé |
| Dossier de 35 rubriques | Généré depuis les données du projet ; rubriques sans donnée signalées « à compléter » ; exports Markdown, Word, PDF | `banque` ; prod (35 rubriques, Word 200) | Testé et validé |
| Progression : en cours, terminé, réinitialiser, filtre | Table `bank_progress` | `banque` ; prod (statut conservé en base Neon) | Testé et validé |
| Code, schéma, réalisation en projet, offres de la boutique | Programmes compilés (PlatformIO), générateurs | `banque`, e2e `rubriques` prod | Testé et validé. Programmes non essayés sur matériel réel |

## Partie 13 — Boutique technique et Marème IA

| Exigence | Réalisation | Tests | Résultat |
|---|---|---|---|
| Catégories | 31 rayons | `boutique` | Testé et validé |
| Produits, composants, équipements et images | Articles sans photo illustrés par leur symbole normalisé (mention « photo non fournie ») ; onglet « Équipements de référence » : 389 types avec caractéristiques à vérifier, recherche en rayon, mise en vente ; Marème y renvoie | e2e `banques` prod | Testé et validé. Prix, stocks et photos réels : déclarés par les vendeurs uniquement (catalogue de production vide tant qu'aucun vendeur ne publie) |
| Fiches, photos (appareil photo sur téléphone), stocks, prix déclarés, tri, panier, commande, suivi | Prix, stocks et images déclarés par les vendeurs (rien d'inventé) | `boutique`, e2e `rubriques` prod | Testé et validé. Le catalogue de production est vide tant qu'aucun vendeur ne publie |
| Import de catalogue | CSV : modèle, vérification sans écriture, import des lignes valides ; profil vendeur exigé | `boutique-plus` ; prod (modèle servi, profil vendeur exigé) | Testé et validé |
| Retours | Demande motivée, puis acceptation (stock réintégré) ou refus motivé | `boutique-plus` | Testé et validé |
| Paiement en ligne | Statut réel affiché partout (« paiement en ligne non disponible ») ; règlement avec le vendeur | `mareme`, e2e `rubriques` | **Absent** : aucun prestataire choisi (voir interventions). Rien n'est annoncé comme payé |
| Livraison | Modes déclarés par le vendeur ; la plateforme ne livre pas | `boutique` | Fonctionnel |
| Alibaba et Amazon | — | — | **Absent** : accès partenaire requis (voir interventions) |
| Marème IA : accueil, recherche, comparaison, conseil, panier, livraison, suivi, retours, orientation | Mode « règles » signalé, sur données réelles uniquement | `mareme`, e2e prod | Testé et validé. La rédaction libre exige un fournisseur d'IA |

## Parties 14 à 16 — Aláji IA, intégration des modules, architecture des données

| Exigence | Réalisation | Tests | Résultat |
|---|---|---|---|
| Aláji présent dans tous les laboratoires et rubriques | Panneau ✦ avec la rubrique ouverte | e2e `interface` prod | Testé et validé |
| Agents spécialisés | 25 agents, dont solaire thermique, bioénergie, génie civil, industriel, télécoms, agritech, environnement, médical | `alaji` | Testé et validé |
| Aláji lance les logiciels | Mode règles : envoi vers le logiciel adapté ; outils `list_software` et `run_study` pour un modèle de langage | `alaji` (orientation, `run_study` exécuté par le moteur, donnée absente signalée ; boucle du modèle de langage testée avec un `fetchImpl` explicite) | Testé et validé. En production, le mode règles est actif tant qu'aucun fournisseur d'IA n'est configuré |
| Contexte d'étude, historique supprimable, vérificateur | Autorisations vérifiées ; suppression journalisée | `alaji`, `etudes` | Testé et validé |
| Parcours laboratoire → calcul → schéma → nomenclature → projet → boutique → Marème → Aláji | Liens et envois réels entre modules | `etudes`, e2e `dimensionnement` prod | Testé et validé |
| Données : disciplines, composants, références, études, projets, boutique, IoT, progression | Migrations 0001 à 0019 (jamais modifiées après publication) ; sauvegarde complète | `backup`, prod (Neon) | Testé et validé |

## Rectification du 27/11/2026 — éléments demandés intégrés

| Exigence | Réalisation | Tests | Résultat |
|---|---|---|---|
| Commandes « Retour » manquantes | Bouton « Retour » sur toutes les pages internes : page précédente réelle (historique interne de l'onglet), sinon rubrique parente ; une vue détaillée (projet, annonce, épreuve, onglet de boutique, fiche de TP) est d'abord refermée | e2e `navigation` (ordinateur et Pixel 7) prod | Testé et validé |
| Reconnexion automatique des comptes | Cause : un serveur en veille (hébergement gratuit) ou une erreur réseau étaient pris pour « non connecté » et renvoyaient à la connexion. Correction : nouvelles tentatives avec message « réveil du serveur », session glissante renouvelée tant que le compte est actif, page de connexion qui mène directement à la suite si la session est valable ; révocation toujours effective | `session` (3), e2e `navigation` (indisponibilité simulée) prod | Testé et validé |
| Banque de cours | 12 cours intégrés originaux (électricité, électrotechnique, installations, électronique, automatisme, informatique industrielle, IoT, photovoltaïque, pompage, froid, réseaux, mécanique), quiz et certificat ; migration 0020 | `cours`, `cours-integres`, e2e prod | Testé et validé |
| Banque de TP, de schémas et de simulations | 21 TP ouvrant le laboratoire sur le bon cas ; 10 schémas types illustrés ; 22 simulations prêtes | `tp` (5, résultats recalculés), e2e prod | Testé et validé |
| Existant conservé | Aucune fonctionnalité retirée ; suites complètes repassées (334 tests, 26 parcours) ; parcours existants rejoués en production | rapport de tests | Testé et validé |

## Partie 17 — Sécurité

| Exigence | Réalisation | Tests | Résultat |
|---|---|---|---|
| Secrets | Aucun secret dans le code, le dépôt ou l'interface ; variables Render et clés générées et chiffrées en base | `verifier-config`, revue | Testé et validé |
| Comptes, droits administrateur | Rôles, verrouillage, double authentification, licences signées ; actions d'administration refusées à un compte ordinaire | e2e `comptes`, `mfa` ; prod (sauvegarde et liens de réinitialisation refusés à un compte non administrateur : 403) | Testé et validé |
| Compilation de code utilisateur | Processus sans shell, chemin d'exécution restreint, 60 s, sortie limitée, dossier temporaire supprimé ; le programme n'est jamais exécuté sur le serveur ; 20 compilations par période | `iot-simulation` | Testé et validé |
| IoT | Jetons par appareil, TLS, commandes confirmées par une personne, accusés réels | e2e `iot` | Testé et validé |

## Parties 18 à 20 — Déploiement, tests, conformité

| Exigence | Réalisation | Installation et configuration | Tests | Résultat |
|---|---|---|---|---|
| Production | Render gratuit (Docker) et Neon gratuit ; déploiement automatique depuis `main` | Image : Node 22, Python 3.12 (pvlib, CoolProp), Poppler, Tesseract, avr-gcc | `/api/health` prod : base postgres, secrets configurés, administrateur existant | Testé et validé |
| Ordinateur et téléphone | Interface adaptative | — | e2e Pixel 7 en prod : aucune page plus large que l'écran (rubriques et 27 logiciels) | Testé et validé |
| Persistance | Base Neon | — | prod : progression conservée et relue, études enregistrées | Testé et validé |
| Tests obligatoires | Typage strict, lint, 296 tests unitaires et d'intégration, 20 parcours de bout en bout ; CI GitHub (avec la chaîne AVR) | — | voir rapport | Testé et validé |
| Indépendance vis-à-vis de SUUF NAZA | Aucun fichier, service, base ou secret de SUUF NAZA modifié | — | `docs/AUDIT_SEPARATION.md` | Respecté |

## Interventions nécessaires de l'exploitant (une seule action chacune)

| Blocage réel | Pourquoi je ne peux pas le lever | Intervention unique |
|---|---|---|
| Tableau normatif des courants admissibles (NF C 15-100 / CEI 60364) | Norme protégée par le droit d'auteur : aucune valeur ne doit être inventée | Avec un compte administrateur, saisir le tableau dans Laboratoire Électricité et Électrotechnique → « Tableaux normatifs (courants admissibles) », depuis votre exemplaire de la norme |
| Rédaction libre d'Aláji et de Marème | Fournisseur d'IA payant, ou jeton gratuit à créer à votre nom | Dans les variables d'environnement Render : `ANTHROPIC_API_KEY` (payant), ou `AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL` et `AI_API_KEY` pour un service compatible OpenAI (par exemple un jeton gratuit Hugging Face, quotas limités) |
| Paiement en ligne | Contrat avec un prestataire (Wave, Orange Money, carte) à votre nom ; aucun prestataire n'est intégré tant qu'il n'est pas choisi | Choisir le prestataire et ouvrir le compte marchand. L'adaptateur (confirmation par webhook signé) sera ensuite développé et testé avec son environnement de test |
| Catalogues Alibaba et Amazon | Programmes partenaires soumis à approbation | Demander l'accès développeur ou affilié, puis transmettre les identifiants |
| Format DWG | Format propriétaire | Aucune : utiliser l'export DXF |
| Essais sur matériel réel (cartes, capteurs, pompes) | Pas de matériel branché à cet environnement | Téléverser le .hex ou le programme PlatformIO sur votre banc d'essai |
