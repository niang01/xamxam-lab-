# XAM-XAM LAB — Tableau de contrôle exhaustif (audit du 25/11/2026)

Chaque ligne reprend une exigence de la mission « Audit exhaustif, vérification et finalisation » (sections 2 à 14) ou des demandes antérieures.
Le tableau n'utilise que les six états autorisés :
- **FV** : Fonctionnel et vérifié.
- **PF** : Partiellement fonctionnel.
- **PNO** : Présent mais non opérationnel.
- **A** : Absent.
- **BDE** : Bloqué par une dépendance externe.
- **MR** : À tester sur matériel réel.

Les preuves renvoient aux fichiers de test du dépôt (`tests/unit`, `tests/integration`, `tests/e2e`), aux vérifications faites en production (voir `docs/RAPPORT_DE_TESTS.md`) ou au code.
« Test final » donne le résultat de la dernière exécution, celle de ce commit :
- typage strict et lint : 0 erreur ;
- tests unitaires et d'intégration : 218/218 (31 fichiers) ;
- parcours de bout en bout : 17/17 (ordinateur et Pixel 7).

## A. Rubriques de la plateforme (section 2)

| N° | Exigence initiale | Rubrique concernée | État réel | Preuve de vérification | Problème constaté | Correction réalisée | Test final |
|---|---|---|---|---|---|---|---|
| 1 | Tableau de bord général | `/` | FV | e2e `parcours.spec.ts` (tuiles, actions rapides) | — | — | ✅ e2e |
| 2 | Profil utilisateur et gestion des comptes | `/settings`, `/bienvenue`, `/admin` | FV | `accounts`, `profil`, `platform`, `suppression` (intégration) ; e2e `comptes`, `mot-de-passe` | — | Profil professionnel, œil sur les mots de passe (24/11) | ✅ |
| 3 | Espace personnel et projets | `/projects`, `/portfolio` | FV | `platform` (accès membre), `espaces` (création depuis un modèle) ; e2e `espaces` | — | — | ✅ |
| 4 | Aláji IA, intelligence centrale | `/ai`, panneau ✦ | PF | `alaji.test.ts` (10 tests) | Sans fournisseur d'IA, pas de rédaction libre | Mode sans clé, déterministe et signalé ; fournisseur configurable (Anthropic ou compatible OpenAI) | ✅ (mode sans clé) ; BDE pour la rédaction libre |
| 5 | Laboratoires d'ingénierie et de conception | `/lab/*` | FV | `eng.test.ts` (22), `spice-i18n.test.ts` (ngspice), `compute.test.ts` (pvlib, CoolProp) | — | — | ✅ |
| 6 | Bibliothèques de composants par discipline | `/components` | FV | `espaces.test.ts` (23 disciplines), `bibliotheque-maj.test.ts` | Doublons hérités ; le 25/11, le chargement faisait tomber la production | Fusion des doublons, chargement isolé (commit 27a28f1) et test de non-régression | ✅ |
| 7 | Projets pratiques et projets IoT | `/banque-projets` | FV | `banque.test.ts` (unitaire et intégration) ; e2e `rubriques` | Absents avant l'audit | Banque de 190 projets, dont 100 IoT | ✅ |
| 8 | Atelier de conception et de réalisation | `/projects/[id]` (dossier, nomenclature, budget, tâches) | FV | `espaces.test.ts` ; e2e `espaces` | — | — | ✅ |
| 9 | Laboratoires de simulation 2D, 3D, 4D | `/schemas`, `/studio` | PF | voir section F | Pas de conception assistée volumique ni d'éléments finis | — | voir F |
| 10 | Espace recherche et innovation | `/challenges`, `/projects` (types mémoire et recherche), `/earth` | PF | e2e `parcours` (rubriques ouvertes) | Aucun outil bibliographique ni gestion de publications | — | ✅ navigation |
| 11 | Espace formation et apprentissage | `/academy` | FV | e2e `parcours` (publication réservée au formateur) ; `fad.test.ts` | — | Modules, ressources, devoirs | ✅ |
| 12 | FAD, formation à distance | `/fad` | FV | `fad.test.ts` ; e2e `rubriques` | Absente avant l'audit | Parcours apprenant, devoirs, notes, corrections | ✅ |
| 13 | Bibliothèque de cours, exercices et documents | `/academy`, `/exercices`, `/documents` | PF | `banque.test.ts` (exercices), `documents.test.ts` | 19 modèles d'exercices, pas des centaines ; pas de ressources sénégalaises sourcées | Exercices originaux à variantes chiffrées | ✅ ce qui existe |
| 14 | Espace examens, devoirs et évaluations | `/exercices` (épreuve sur 20), devoirs FAD, quiz Academy | FV | `banque.test.ts` (note serveur), `fad.test.ts` (correction bornée au barème) | — | — | ✅ |
| 15 | Espace boutique XAM-XAM LAB | `/boutique` | PF | `boutique.test.ts` (5) ; e2e `rubriques` (commande confirmée, stock décrémenté) | Pas de paiement ni de livraison intégrés | Paiement « à convenir », affiché comme tel | ✅ ; BDE pour le paiement |
| 16 | Communauté et collaboration | `/collab`, `/marketplace`, `/mentors`, `/news` | FV | e2e `meeting` (visioconférence WebRTC), `marketplace` ; `marketplace.test.ts` | — | — | ✅ |
| 17 | Entrepreneurs et startups | `/startups`, `/careers`, projets « start-up » | PF | e2e `parcours` | Annuaire et projets seulement : pas de financement ni de suivi d'incubation | — | ✅ navigation |
| 18 | Centre de gestion des drones | `/drones` | MR | e2e `drones` (pont simulé, missions validées) ; `drone.test.ts` (conditions de vol) | Armement et décollage non validés sur simulateur ni sur drone réel | — | MR |
| 19 | Licences et abonnements | `/licence`, Administration → Licences | FV | `accounts.test.ts`, `appareils.test.ts` | Appareils et suspension absents ; faille : la suspension était contournable en base | Ajout des appareils autorisés et de la suspension ; étiquette d'intégrité couvrant le statut | ✅ |
| 20 | Administration générale | `/admin` (comptes, licences, boutique, habilitations, traductions, sauvegarde) | FV | `security.test.ts` (aucun accès non administrateur), `accounts`, `boutique` | — | Onglet Boutique, réinitialisation des appareils | ✅ |
| 21 | Paramètres, sécurité, assistance, documentation | `/settings`, `/guide` | FV | `mfa`, `security` ; `guides.test.ts` (liens valides) ; e2e `mfa` | — | 6 guides ajoutés (16 au total) | ✅ |

## B. Bibliothèque de composants (section 3)

| N° | Exigence initiale | Rubrique | État réel | Preuve | Problème constaté | Correction | Test final |
|---|---|---|---|---|---|---|---|
| 22 | Couverture des 20 filières demandées | `/components` (filtre Filière) | FV | `FILIERES` = 20 dans `src/lib/library.ts` ; `espaces.test.ts` | 12 disciplines avant l'audit | 23 disciplines regroupées en 20 filières | ✅ |
| 23 | Composants et équipements, non fictifs | `/components` | FV | 190 composants génériques (types réels), paramètres sans valeur inventée (test) | — | — | ✅ |
| 24 | Symboles normalisés | Schémas 2D (palette) | PF | Symboles dessinés dans `DiagramEditor` | Symboles de type CEI simplifiés, sans certification de conformité | — | ✅ affichage |
| 25 | Caractéristiques, références, unités | fiche composant | FV | `espaces.test.ts` (paramètres avec unités) | — | — | ✅ |
| 26 | Schémas de raccordement | générateurs (section E) | PF | `schematics-gen.test.ts` | Seulement pour les 9 modèles de schéma | — | ✅ |
| 27 | Fiches techniques | boutique (fiche du vendeur), fiche composant | PF | `boutique.test.ts` (URL de fiche) | Aucune fiche constructeur intégrée (droits, références génériques) | — | ✅ |
| 28 | Modèles 2D/3D | 2D : symboles ; 3D : maquette paramétrique | PF | e2e `espaces` (maquette 3D) | Aucun modèle 3D par composant | — | — |
| 29 | Paramètres de simulation | composants ngspice (Electronics Lab) | PF | `spice-i18n.test.ts` | Seulement pour l'électronique | — | ✅ |
| 30 | Exemples, exercices, projets par discipline | banque de projets et d'exercices, liens depuis le composant | FV | `banque.test.ts` (projets → composants de la bibliothèque) | — | Recherche des projets par composant | ✅ |
| 31 | Filtrable par discipline, niveau, fonction, type | `/components` | PF | API `components` (filière, discipline, recherche) | Pas de filtre « niveau » pour un composant (sans objet) ; la fonction passe par la recherche textuelle | — | ✅ |

## C. Banque de projets (section 4)

| N° | Exigence initiale | Rubrique | État réel | Preuve | Problème constaté | Correction | Test final |
|---|---|---|---|---|---|---|---|
| 32 | « Plusieurs centaines » de projets | `/banque-projets` | PF | `bankInventory()` = 190 (test « au moins 190 ») | 190 projets, pas plusieurs centaines | Phase 1 livrée ; suite par lots | ✅ 190 |
| 33 | Les 20 thèmes IoT demandés | idem (filtre IoT) | FV | 100 projets IoT couvrant les 20 thèmes (`src/lib/bank/iot.ts`) | — | — | ✅ |
| 34 | Toutes les filières | idem | FV | 20 filières (de 3 à 21 projets chacune, voir inventaire) | Santé (3) et drones (4) peu fournis | — | ✅ |
| 35 | Les 17 rubriques par projet | fiche projet | FV | test « 17 rubriques renseignées pour chaque projet » | — | — | ✅ |
| 36 | Coût estimatif | fiche → boutique | PF | Aucun prix inventé : renvoi aux offres réelles | Coût affiché seulement si des vendeurs publient | — | ✅ |
| 37 | Code source | fiche (.ino) | MR | 11 programmes compilés avec PlatformIO (ESP32-S3), 111 projets les utilisent | Compilés, non essayés sur chaque montage | Variable `alarm` renommée (collision révélée par la compilation) | ✅ compilation ; MR |
| 38 | Schéma technique | fiche → éditeur 2D | PF | 77 projets avec schéma généré | Les autres renvoient à l'éditeur manuel | — | ✅ |
| 39 | Simulation | fiche | PF | Lien vers les laboratoires quand c'est pertinent | Pas de simulation propre à chaque projet | — | — |
| 40 | Niveaux (débutant → startup) | filtre Niveau | FV | 7 niveaux présents (inventaire) | — | — | ✅ |
| 41 | Rechercher, filtrer, enregistrer, modifier, réaliser | `/banque-projets` | FV | `banque.test.ts` ; e2e `rubriques` (réalisation) | — | « Réaliser » crée un projet personnel modifiable | ✅ |

## D. Boutique (section 5)

| N° | Exigence initiale | Rubrique | État réel | Preuve | Problème constaté | Correction | Test final |
|---|---|---|---|---|---|---|---|
| 42 | 15 catégories | `/boutique` (rayons) | FV | `SHOP_SECTIONS` = 15 | — | — | ✅ |
| 43 | Catalogue, images, fiches | idem | FV | `boutique.test.ts` (image contrôlée par sa signature) | — | — | ✅ |
| 44 | Prix et disponibilité réels | idem | FV | Valeurs déclarées par le vendeur ; « prix sur demande » sinon ; aucune valeur inventée | Le catalogue de production est vide tant qu'aucun vendeur n'a publié | — | ✅ |
| 45 | Recherche et filtres | idem | FV | e2e `rubriques` | — | — | ✅ |
| 46 | Panier, commandes, suivi, historique | onglets Panier et Mes commandes | FV | `boutique.test.ts` ; e2e `rubriques` | — | — | ✅ |
| 47 | Comptes clients, vendeurs et fournisseurs | onglet Vendeur, administration | FV | profil vendeur obligatoire, vérification par l'administrateur (test) | — | — | ✅ |
| 48 | Gestion des stocks | confirmation par le vendeur | FV | stock décrémenté à la confirmation ; confirmation refusée si le stock manque (test et e2e) | — | — | ✅ |
| 49 | Gestion des livraisons | mode de remise, adresse, statuts expédiée et livrée | PF | test (mode vérifié, adresse exigée) | Aucun transporteur intégré | — | ✅ |
| 50 | Paiement | — | BDE | `paymentStatus()` = hors ligne, annoncé dans l'interface | Aucun prestataire (mobile money, carte) configuré ni autorisé | Non annoncé comme opérationnel | ✅ message |
| 51 | Espace administrateur | Administration → Boutique | FV | `boutique.test.ts` (vérification vendeur, désactivation) | — | — | ✅ |
| 52 | Composants d'un projet vers le panier | projet → `/boutique?projet=` | FV | `boutique.test.ts` (offres par composant) | — | — | ✅ |

## E. FAD (section 6)

| N° | Exigence initiale | Rubrique | État réel | Preuve | Problème constaté | Correction | Test final |
|---|---|---|---|---|---|---|---|
| 53 | Création et publication de cours par les formateurs | `/academy` | FV | e2e `parcours` (un élève ne peut pas publier) | — | — | ✅ |
| 54 | Modules et chapitres | page du cours | FV | leçons regroupées par `module` | — | Champ `module` | ✅ |
| 55 | Vidéos, documents PDF et Word, présentations | Ressources du cours | PF | `fad.test.ts` (signatures contrôlées, 8 Mo) | Vidéos non hébergées (liens https externes) | — | ✅ |
| 56 | Exercices, TD, TP, devoirs, examens | Devoirs du cours | FV | `fad.test.ts` (remise, retard, note bornée) | — | — | ✅ |
| 57 | Quiz interactifs, corrections, évaluations | quiz Academy, notation des devoirs | FV | correction côté serveur (route `submit`) | — | — | ✅ |
| 58 | Suivi de progression | `/fad` | FV | `/api/fad/me` ; e2e `rubriques` | — | — | ✅ |
| 59 | Gestion des apprenants et des formateurs | rôle par cours, remises à corriger | PF | `courseRole` (auteur, apprenant) | Pas de co-formateur ni de groupes ou classes | — | ✅ |
| 60 | Classes virtuelles | `/collab` (WebRTC) | FV | e2e `meeting` | Pair à pair : limité à de petits groupes | — | ✅ |
| 61 | Certificats | quiz réussi → certificat avec empreinte vérifiable | FV | route `courses/[id]/submit` | — | — | ✅ |
| 62 | Parcours par discipline et par niveau | `domain` et `level` du cours | PF | schéma `courses` | Aucun cours publié en production (pas de contenu inventé) | — | — |

## F. Documents traités par Aláji IA (section 7)

| N° | Exigence initiale | Rubrique | État réel | Preuve | Problème constaté | Correction | Test final |
|---|---|---|---|---|---|---|---|
| 63 | PDF, Word, Excel, PowerPoint | `/documents` | FV | `documents.test.ts` (Word et PDF : extraction et exports) | — | — | ✅ |
| 64 | Images et scans (reconnaissance optique) | idem | PF | test OCR (image et PDF scanné), Tesseract français et anglais | Reconnaissance imparfaite (en production, une ligne « Réponse » non reconnue) ; manuscrit non pris en charge | Texte corrigeable puis ré-analyse ; une unité illisible n'est jamais utilisée | ✅ |
| 65 | Texte, code, formats techniques | idem | PF | DXF (textes), STL (triangles, boîte englobante) | Pas de DWG, STEP ni Gerber | — | ✅ |
| 66 | Extraire texte et tableaux | idem | FV | test (tableaux Excel et Word) | — | — | ✅ |
| 67 | Extraire images et schémas | — | A | — | Images intégrées non extraites ; schémas non interprétés | — | — |
| 68 | Identifier questions et exercices | idem | FV | `splitExercises` (test) | — | — | ✅ |
| 69 | Résoudre pas à pas, calculs, unités | idem | PF | test : loi d'Ohm, courant d'emploi, chute de tension… | Seulement les calculs du registre testé | Les autres questions sont signalées « à rédiger et valider » | ✅ |
| 70 | Expliquer les méthodes | idem | PF | étapes et formules des calculs couverts | Explication libre seulement avec un fournisseur d'IA | — | BDE (fournisseur d'IA) |
| 71 | Corriger les réponses, détecter les incohérences | idem | FV | test « réponses corrigées », vérifications croisées | — | — | ✅ |
| 72 | Générer les schémas correspondants | bouton « Générer un schéma » | PF | `guessGenerator` (test) | Seulement pour les 9 modèles | — | ✅ |
| 73 | Rapport structuré ; distinguer extrait, hypothèse et calculé | rapport | FV | test « rapport séparant extrait, hypothèse et calcul » | — | — | ✅ |
| 74 | Export PDF, Word, Excel | idem | FV | test et e2e `rubriques` (Word valide) | — | — | ✅ |
| 75 | Cas limites : volumineux, faux format, vide | idem | FV | test « cas limites » (15 Mo, signature, vide) | — | — | ✅ |

## G. Schémas techniques (section 8)

| N° | Exigence initiale | Rubrique | État réel | Preuve | Problème constaté | Correction | Test final |
|---|---|---|---|---|---|---|---|
| 76 | Démarrage moteur, puissance et commande, développés | générateurs | FV | `schematics-gen.test.ts` (logique vérifiée : auto-maintien, relais thermique, étoile-triangle, inversion) | Étoile-triangle mal modélisé au départ | Vérification par couplage des bornes | ✅ |
| 77 | Unifilaire (photovoltaïque) | générateur | FV | test | — | — | ✅ |
| 78 | Multifilaire, industriel | — | PF | puissance triphasée dans les modèles moteur | Pas de générateur multifilaire général | — | — |
| 79 | Hydraulique, pneumatique, réseau, IoT, architecture logicielle | générateurs | FV | test | — | — | ✅ |
| 80 | Circuits imprimés | — | A | — | Aucun outil de routage intégré | — | — |
| 81 | Visualiser, modifier, exporter, télécharger | éditeur 2D | FV | `espaces.test.ts` (export SVG), PNG dans l'éditeur | — | — | ✅ |
| 82 | Depuis Aláji IA | outil `generate_schematic` | FV | `alaji.test.ts` | — | — | ✅ |

## H. Banque pédagogique (section 9)

| N° | Exigence initiale | Rubrique | État réel | Preuve | Problème constaté | Correction | Test final |
|---|---|---|---|---|---|---|---|
| 83 | Exercices corrigés et non corrigés | `/exercices` | FV | énoncé sans corrigé puis correction (test) | 19 modèles, pas des centaines | Variantes chiffrées illimitées par modèle | ✅ |
| 84 | Épreuves d'examen | idem | FV | épreuve de 5 exercices, note sur 20 calculée par le serveur | — | — | ✅ |
| 85 | Cours, fiches, TD, TP, études de cas, sujets de concours | — | A | — | Aucun contenu pédagogique rédigé à grande échelle ; création possible par les formateurs (Academy, FAD) | — | — |
| 86 | Référentiels du Sénégal et internationaux | — | BDE | — | Référentiels officiels non fournis ; ne seront pas inventés | Champ « référentiel » laissé au formateur | — |
| 87 | Droits d'auteur | toute la plateforme | FV | ressources originales ; aucun sujet officiel reproduit (mention affichée) | — | — | ✅ |

## I. 2D, 3D, 4D (section 10)

| N° | Exigence initiale | Rubrique | État réel | Preuve | Problème constaté | Correction | Test final |
|---|---|---|---|---|---|---|---|
| 88 | 2D : schémas, symboles, édition, export | `/schemas` | FV | `espaces` (unitaire et intégration), e2e `espaces` | — | — | ✅ |
| 89 | 2D : dessin technique, plans d'implantation | — | A | — | Pas de dessin technique coté | — | — |
| 90 | 3D : maquette paramétrique (masse, centre de gravité, STL) | `/studio` | PF | e2e `espaces` | Pas de conception volumique, d'assemblage ni de bâtiment | — | ✅ ce qui existe |
| 91 | 4D : scénarios temporels, comparaison, performances | `/studio` (énergie, réservoir, chambre froide) | FV | bilans de conservation vérifiés (test), e2e | Modèles de bilan, non validés par mesure | Libellé « modèle de bilan », jamais « simulation validée » | ✅ |
| 92 | Animation des mécanismes, processus industriels | — | A | — | — | — | — |
| 93 | Liens avec les projets et la bibliothèque | projets → schéma, nomenclature → bibliothèque | FV | `espaces.test.ts` | — | — | ✅ |

## J. Aláji IA (section 11)

| N° | Exigence initiale | Rubrique | État réel | Preuve | Problème constaté | Correction | Test final |
|---|---|---|---|---|---|---|---|
| 94 | Comprendre et orienter vers le bon laboratoire | `/ai` | FV | `alaji.test.ts` (disciplines, intentions) | — | — | ✅ |
| 95 | Analyser les fichiers, résoudre les exercices | `/documents` | PF | voir section F | — | — | ✅ |
| 96 | Concevoir, bibliothèques, schémas, rapports | outils de l'agent | FV | `alaji.test.ts` (outils, vérificateur, budget, schémas) | — | — | ✅ |
| 97 | Programmation IoT | banque de codes compilés | PF | 11 codes PlatformIO | Pas de génération de code libre sans fournisseur d'IA | — | BDE |
| 98 | Agents spécialisés, vérificateur | `src/server/ai/` | FV | agent vérificateur réel (test) | — | — | ✅ |
| 99 | Aucune IA simulée | toute la plateforme | FV | mode sans clé affiché ; aucune rédaction inventée | — | — | ✅ |

## K. Autres exigences (section 12)

| N° | Exigence initiale | Rubrique | État réel | Preuve | Problème constaté | Correction | Test final |
|---|---|---|---|---|---|---|---|
| 100 | Données environnementales et satellitaires | `/earth` | PF | NASA POWER, Open-Meteo (prévisions de vol) | Sentinel-2 et NDVI non intégrés (lecture des bandes seulement vérifiée) | — | — |
| 101 | Partage des projets, collaboration | membres de projet | FV | `platform.test.ts` (accès refusé aux non-membres) | — | — | ✅ |
| 102 | Guides et tutoriels de chaque module | `/guide` | FV | 16 guides, `guides.test.ts` | Guides absents pour les nouvelles rubriques | 6 guides ajoutés ; mise à jour des guides Licence et Administrateur | ✅ |
| 103 | Profils et permissions | rôles, habilitations | FV | `security`, `operations` (14 tests) | — | — | ✅ |
| 104 | Sécurité des données | chiffrement, hachage, journal d'audit | FV | `security`, `mfa`, `profil` (aucune trace du mot de passe) | — | — | ✅ |
| 105 | Mobile et ordinateur | toutes les pages | FV | e2e Pixel 7 (`mobile` : aucune page plus large que l'écran ; `rubriques`) | APK non essayé sur un vrai téléphone | — | ✅ navigateur ; MR (APK) |
| 106 | Français, anglais, wolof | sélecteur WO/FR/EN | PF | catalogue FR et EN typé (test des clés) | Aucune traduction wolof validée par un locuteur natif : repli sur le français | — | BDE (locuteurs) |
| 107 | Modes clair et sombre | barre d'état | FV | e2e `interface` | — | — | ✅ |
| 108 | Synchronisation et hors ligne | service worker `sw.js` | PF | pages en cache, signalement hors ligne | Pas d'édition hors ligne avec synchronisation | — | — |
| 109 | Exports et téléchargements | documents, schémas, projets, codes | FV | tests d'export | — | — | ✅ |
| 110 | Erreurs et sauvegardes | Administration → sauvegarde | FV | `backup.test.ts` (aller-retour complet) | — | — | ✅ |

## L. Comptes, licences, sécurité (section 13)

| N° | Exigence initiale | Rubrique | État réel | Preuve | Problème constaté | Correction | Test final |
|---|---|---|---|---|---|---|---|
| 111 | Inscription, connexion, déconnexion, mots de passe | `/inscription`, `/connexion` | FV | `accounts` ; e2e `comptes` | — | — | ✅ |
| 112 | Essai gratuit de 3 mois | `/licence` | FV | test : 90 jours, date altérée détectée | — | — | ✅ |
| 113 | Activation, attribution, renouvellement des clés | `/licence`, administration | FV | `accounts.test.ts` | — | — | ✅ |
| 114 | Durées et limites d'utilisation | catégories (durée, postes) | FV | test « postes » | — | — | ✅ |
| 115 | Gestion des appareils autorisés | `/licence` → Mes appareils ; administration | FV | `appareils.test.ts` : un 3e appareil est refusé, retirer un appareil libère une place, réinitialisation ; e2e `rubriques` | Absente | Migration 0016 : cookie d'appareil httpOnly dont seule l'empreinte est stockée | ✅ |
| 116 | Suspension et révocation | administration | FV | `appareils.test.ts` (suspension, réactivation, altération détectée), `accounts.test.ts` (révocation) | Suspension absente, puis contournable en remettant « active » en base | Étiquette d'intégrité couvrant le statut ; réactivation refusée si la licence est altérée | ✅ |
| 117 | Vérification côté serveur | `mustBeSignedIn` (HTTP 402) | FV | tests ci-dessus | — | — | ✅ |
| 118 | Sessions sécurisées | cookies httpOnly signés, version de session | FV | `platform` (révocation au changement de mot de passe), `mfa` | — | — | ✅ |
| 119 | Aucun secret dans le code | dépôt | FV | `deploiement.test.ts` ; clés en variables d'environnement ou en base serveur | — | — | ✅ |

## M. Tests obligatoires (section 14)

| N° | Test demandé | État réel | Preuve |
|---|---|---|---|
| 120 | 1. Création d'un compte | FV | e2e `parcours`, `comptes` ; production |
| 121 | 2. Connexion et déconnexion | FV | e2e `comptes` ; production |
| 122 | 3. Tableau de bord | FV | e2e `parcours` |
| 123 | 4. Navigation entre toutes les rubriques | FV | e2e `parcours`, `mobile` |
| 124 | 5. Consultation des bibliothèques | FV | e2e `espaces` |
| 125 | 6. Recherche de composants | FV | e2e `espaces`, intégration `espaces` |
| 126 | 7. Ouverture et réalisation d'un projet | FV | e2e `rubriques` (banque → projet), `espaces` |
| 127 | 8. Outils de conception | FV | e2e `espaces` (schéma 2D, liaisons) |
| 128 | 9. Simulation 2D, 3D, 4D | PF | e2e `espaces` (scénario 4D, maquette 3D) ; ngspice (unitaire) ; pas de 3D volumique |
| 129 | 10. Téléchargement d'un document | FV | e2e `rubriques` |
| 130 | 11. Analyse d'un document par Aláji IA | FV | e2e `rubriques`, intégration `documents` |
| 131 | 12. Résolution d'un exercice | FV | intégration `documents`, e2e `rubriques` (exercices) |
| 132 | 13. Génération d'un corrigé | FV | intégration `banque` (corrigé détaillé) |
| 133 | 14. Production d'un schéma | FV | `schematics-gen`, `alaji` |
| 134 | 15. Exportation d'un rapport | FV | e2e `rubriques` (Word), intégration (PDF, Excel, Markdown) |
| 135 | 16. Inscription à une formation FAD | FV | intégration `fad` |
| 136 | 17. Suivi d'un cours | FV | intégration `fad`, e2e `rubriques` (/fad) |
| 137 | 18. Consultation de la boutique | FV | e2e `rubriques` |
| 138 | 19. Ajout au panier | FV | e2e `rubriques` |
| 139 | 20. Gestion d'une commande (conditions réelles) | FV | e2e `rubriques` : commande confirmée par le vendeur, stock passé de 4 à 3 ; paiement hors plateforme |
| 140 | 21. Téléphone | FV | e2e Pixel 7 (`mobile`, `mot-de-passe`, `rubriques`) ; production Pixel 7 |
| 141 | 22. Ordinateur | FV | e2e bureau (17 parcours) |
| 142 | 23. Permissions et sécurité | FV | `security`, `operations`, `appareils`, e2e `parcours` (API protégées) |
| 143 | Fichiers volumineux, scans, entrées incorrectes | FV | intégration `documents` (cas limites, OCR) |

## Inventaire réel (calculé depuis le code, 25/11/2026)

- **Composants** : 190 génériques, répartis en 23 disciplines et 20 filières.
- **Banque de projets** : 190 projets, dont 100 IoT ; 111 avec code, 77 avec schéma généré.
  - Par filière : enr 21, domotique 18, agriculture 14, plomberie 14, électrotechnique 11, réseaux 11, électronique 11, iot 10, ia_robotique 10, mécanique 10, informatique 10, environnement 9, instrumentation 8, élec_bâtiment 6, puissance 5, logiciel 5, génie civil 5, froid 5, drones 4, santé 3.
  - Par niveau : débutant 33, intermédiaire 38, avancé 23, technicien 39, ingénieur 32, recherche 14, startup 11.
- **Programmes compilés** (PlatformIO, ESP32-S3) : 11.
- **Modèles d'exercices** : 19.
- **Générateurs de schémas** : 9.
- **Rayons de la boutique** : 15.
- **Guides intégrés** : 16.
- **Migrations** : 16.
- **Routes d'API** : 143.
- **Pages** : 52.
