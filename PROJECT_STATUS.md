# XAM-XAM LAB — état du projet (point de reprise)

Mis à jour à chaque étape. **Reprendre à partir de ce fichier, sans recommencer le projet.**
Dépôt : `niang01/xamxam-lab-` (branche `main`). Indépendant de SUUF (aucun fichier, service, base ni secret partagé).
En ligne : https://xamxam-lab.onrender.com (Render, plan free, déploiement automatique depuis `main` ; base Neon `xamxam-db`).

## Vérifié (exécuté, preuves dans docs/RAPPORT_DE_TESTS.md)
| Contrôle | Résultat |
|---|---|
| Typage strict, lint | ✅ 0 erreur |
| Tests unitaires + intégration | ✅ 296/296 (38 fichiers, 26/11) |
| Parcours de bout en bout (Playwright) | ✅ 20/20 en local (ordinateur + Pixel 7) ; en production le 26/11 : laboratoire IoT, dimensionnement, téléphone, espaces, interface, marketplace, mots de passe, rubriques |
| Production : inscription, profil, connexion, déconnexion, session, tableau de bord | ✅ téléphone, tablette, ordinateur (23/11) |
| APK Android (debug, relié à l'adresse publique) | ✅ compilé ; ❌ non essayé sur un vrai téléphone |

## Réalisé le 26/11 (exécution intégrale)
- 27 logiciels de dimensionnement ; Aláji : 25 agents, outils `list_software` et `run_study`.
- Laboratoire IoT : compilation Arduino réelle sur le serveur (avr-gcc, cœur Arduino : image Docker et CI), simulation avr8js, .hex.
- Plans cotés et en calques (PDF, DXF) ; lecture technique des documents ; maquette 3D depuis une étude.
- Boutique : 31 rayons, tri, import CSV, retours. Banque : dossier de 35 rubriques, progression.
- Tableau final : docs/CONFORMITE_CAHIER_DES_CHARGES.md (interventions restantes en fin de document).

## Réalisé le 23/11 (audit complet demandé par l'exploitant)
1. **Comptes** : clés serveur générées et conservées en base si absentes ; administrateur principal (XX_ADMIN_EMAILS, secours : code des journaux → /installation) ; configuration du profil (/bienvenue) ; mot de passe oublié / réinitialisation (/mot-de-passe-oublie, /reinitialisation) ; vérification d'adresse ; verrouillage après 5 échecs ; messages en français.
2. **Licences** : essai 90 jours, catégories, clés hachées, postes, attribution, renouvellement, révocation, historique, intégrité HMAC, contrôle serveur (HTTP 402) ; administration par onglets ; page /licence. Paiement : non intégré (architecture prête : `issueLicences`).
3. **Aláji IA** : renommage, fournisseur configurable (Anthropic / compatible OpenAI), analyse des demandes, agent vérificateur réel, rapports et suivi de projets, historique.
4. **Espaces** : Schémas 2D multidisciplines (/schemas) ; Studio : scénarios 4D (énergie, réservoir, chambre froide, bilans de conservation), maquette 3D paramétrique (masse, CdG, STL).
5. **Bibliothèque** : 127 composants génériques, 12 disciplines, paramètres avec unités.
6. **Projets** : 10 modèles × 6 niveaux, dossier complet, composants et budget, rapport et présentation (.md).
7. **Guides intégrés** (/guide) : première connexion, tableau de bord, Aláji IA, 2D, 3D/4D, bibliothèques, projets IoT, disciplines, licence, administrateur.
Audit détaillé : docs/AUDIT_DISCIPLINES.md.

## Réalisé le 24/11 — profil et mots de passe
- Profil professionnel : nom complet, fonction, spécialité, organisation, pays, « Présentation de moi » (dès l'inscription), présentation professionnelle ; carte « Mon profil » (affichage + modification) dans Paramètres ; migration 0010.
- Œil d'affichage sur tous les champs de mot de passe (inscription, confirmation, connexion, changement, réinitialisation, double authentification) : affichage temporaire (re-masqué au 2e appui, après 30 s, à l'envoi du formulaire ou en quittant la page) ; indicateur de robustesse et de concordance. Mots de passe jamais en clair (scrypt), absents des réponses, journaux et base — test automatique.

## Réalisé le 25/11 — audit exhaustif (tableau : docs/TABLEAU_DE_CONTROLE.md)
- Documents traités par Aláji IA (/documents) : extraction (PDF, Word, Excel, PowerPoint, OCR, DXF, STL), exercices résolus et corrigés, exports PDF, Word, Excel et Markdown.
- 9 générateurs de schémas (éditeur 2D et Aláji IA).
- Bibliothèque : 190 composants, 23 disciplines, 20 filières.
- Banque de 190 projets, dont 100 IoT, avec 11 programmes compilés.
- 19 modèles d'exercices et épreuves.
- Boutique : 15 rayons, panier, commandes, stock, vendeurs, administration ; paiement hors plateforme.
- FAD : ressources, devoirs, notes, progression.
- Licences : appareils autorisés (migration 0016), suspension et réactivation protégées par l'étiquette d'intégrité.
- 6 guides ajoutés.
- Incident de production du 25/11 (≈06:33–06:49 UTC) corrigé dans le commit 27a28f1.

## Cahier des charges général (25/11, en cours — par lots)
- Fait : 7 logiciels de dimensionnement (électricité, PV, pompage, solaire thermique, séchage, biogaz, compostage) ; bibliothèque 397 composants sans doublon ; banque 305 projets dont 215 IoT dans 35 secteurs ; Marème IA ; Aláji avec contexte d'étude et historique supprimable ; planches PDF A4–A1 avec cartouche et DXF ; sauvegarde complète. Conformité : docs/CONFORMITE_CAHIER_DES_CHARGES.md.
- À suivre : logiciels des autres disciplines (génie civil, télécoms, robotique, automatisme…) ; éditeur de code et simulation embarquée IoT ; plans d'installation cotés ; lecture de plans/photos ; agents spécialisés supplémentaires ; rayons de boutique manquants.

## Action de l'exploitant
- Se connecter avec l'adresse déclarée dans `XX_ADMIN_EMAILS` (Render) : le compte devient administrateur principal.
- Facultatif : fournisseur de courriel (XX_MAIL_*) et d'IA (AI_PROVIDER…) — voir docs/GUIDE_INSTALLATION.md.
- Proposer la révocation de la clé d'API Render après le déploiement (lecture seule utilisée).

## Non disponible / non validé (affiché comme tel)
CAO volumique, éléments finis, dynamique des solides, émulation réseau, calcul réglementaire de structures, paiement en ligne, livraison par transporteur, circuits imprimés, extraction d'images des documents, IA générative sans fournisseur configuré, drones : armement / décollage non validés sur SITL (aucun drone réel pilotable), Sentinel-2 / NDVI (lecture des bandes vérifiée, non intégrée).

## Prochaine tâche exacte
1. Vérifier en production les appareils et la suspension après déploiement.
2. Lots suivants : étendre la banque de projets (190, objectif : plusieurs centaines) et les modèles d'exercices, puis ajouter des cours FAD rédigés ou fournis par des formateurs.
3. Sentinel-2 (recherche STAC et NDVI) ; validation des drones sur simulateur SITL.
