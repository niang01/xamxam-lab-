# 3. Rôles, permissions et parcours utilisateurs

## 3.1 Profils (15) et droits par défaut
Le profil détermine le tableau de bord et les droits **par défaut** ; les droits effectifs combinent : rôle plateforme × rôle dans l'organisation × rôle dans le projet × permissions d'appareil × niveau d'autonomie IA.

| Profil | Tableau de bord | Droits caractéristiques |
|---|---|---|
| Élève | Cours, TP, progression | Labos pédagogiques, simulations limitées, aucun équipement réel sans enseignant |
| Étudiant | Projets, mémoire, cours | Labos, simulations étudiantes, appareils personnels (banc) |
| Enseignant | Classes, copies, résultats | Créer cours/TP/évaluations, superviser les élèves, autoriser un banc d'essai |
| Formateur | Sessions, apprenants | Idem enseignant, hors cadre scolaire |
| Technicien | Installations, diagnostics | Appareils de son organisation, commandes autorisées |
| Ingénieur | Projets, simulations | Tous labos, simulations longues, opérations réelles selon habilitation |
| Chercheur | Données, expériences | Earth & Space avancé, exports, jeux de données |
| Entrepreneur | Projet d'entreprise, mentors | Startup Network, incubation |
| Startup (organisation) | Jalons, équipe, besoins | Fiche startup, candidatures concours, recrutement |
| Mentor | Rendez-vous, startups suivies | Lecture des projets partagés avec lui, évaluations |
| Entreprise | Offres, talents, labos privés | Labos privés, équipes, recrutement |
| Recruteur | Candidatures, recherches | Profils **consentants** uniquement |
| Sponsor | Concours financés, impact | Créer/financer des défis (jurys indépendants) |
| Investisseur | Startups suivies | Fiches startups publiques, mises en relation acceptées |
| Administrateur | Santé, modération, audit | Configuration, Command Center, gestion des rôles ; **pas d'accès aux contenus privés** sans procédure tracée |

Habilitations spécifiques (attribuées nominativement, avec date d'expiration) : `operation_reelle`, `telepilote_drone` (justificatif réglementaire), `validateur_traduction_wo`, `validateur_normes_electriques`, `jury_concours`.

## 3.2 Parcours principaux

### P1 — Élève : reconnaître un composant, dessiner, simuler
1. Academy → cours « Le transistor » (FR, ou WO si validé) → leçon interactive.
2. TP : ouvre l'Electronics Lab avec un canevas préparé ; glisse un transistor depuis la Component Library ; « Expliquer ce composant » (tuteur IA niveau élève).
3. Relie les composants ; « Vérifier le schéma » signale une base non polarisée.
4. « Simuler » (ngspice `.tran`) ; oscilloscope virtuel badgé `SIMULATION`.
5. Quiz → progression mise à jour ; l'enseignant voit le résultat.

### P2 — Étudiant : mémoire « pompage solaire d'une exploitation »
1. Project & Research Studio → nouveau projet « Mémoire » → parcours guidé.
2. IA : formulation de la problématique (proposition modifiable), plan, méthodologie.
3. Solar Lab : site par coordonnées → irradiation NASA POWER (source, résolution, période affichées) → besoin en eau (saisi par l'étudiant) → pompe, champ PV, onduleur → simulation horaire.
4. Banc réel : XIAO + capteur de débit connectés via IoT Gateway → mesures → « Comparer avec le réel ».
5. Rapport : sections calculé / simulé / mesuré séparées ; préparation de soutenance.

### P3 — Ingénieur : demande en langage naturel (exemple du cahier des charges §5.4)
« Conçois une installation solaire intelligente pour une exploitation agricole avec pompage automatique, capteurs IoT et surveillance par drone. »
1. Reasoning Engine analyse ; détecte les informations manquantes (localisation, besoin en eau, HMT, budget, surface) et **les demande** au lieu de les supposer.
2. Orchestrateur propose un plan : projet créé ; Solar, Electrical, IoT, Drone, GIS & Satellite, Software agents mobilisés ; outils et autorisations listés. L'utilisateur **approuve**.
3. Exécution suivie en direct : irradiation (outil NASA POWER), dimensionnement (pvlib), schéma électrique (proposition éditable + ERC), architecture IoT (capteurs, firmware modèle), plan de mission drone **en simulation** (PX4 SITL), tableau de bord généré.
4. Vérification croisée (agent vérificateur : unités, cohérences, hypothèses).
5. Résultat : objets dans le projet, rapport, liste de ce qui reste à faire **par des humains** (achats, installation, autorisation ANACIM, essais sur banc).

### P4 — Technicien : diagnostic d'une installation
Appareils de l'installation dans IoT Gateway → Digital Twin (production attendue vs mesurée) → IA : écarts, causes possibles classées, vérifications à faire sur site → intervention déclarée « réalisée » seulement après confirmation du technicien.

### P5 — Enseignant : TP virtuel collaboratif
Crée un TP (canevas de départ, consignes, barème) → classe virtuelle → élèves en binômes éditent le même schéma (CRDT) → évaluation → résultats.

### P6 — Startup : du prototype à l'investisseur
Projet (prototype) → fiche startup → mentor réservé → candidature à un concours (dépôt d'une version figée) → recrutement d'un ingénieur → mise en relation avec un investisseur (acceptée des deux côtés).

### P7 — Opération réelle : irrigation automatique supervisée
Automation Studio : scénario « humidité < seuil configuré → vérifier eau → vérifier pompe → vérifier autorisations → activer N min (≤ maximum fixé) → surveiller débit → arrêter → journaliser ». Niveau 4 : chaque déclenchement demande confirmation ; niveau 5 : préautorisé dans les limites (durée, plages horaires), surveillance continue ; toute anomalie → arrêt et notification.

### P8 — Changement d'appareil
Commence un schéma sur ordinateur → ouvre l'application Android → « Reprendre là où j'étais » → même version (synchronisation CRDT) ; hors connexion : consultation et annotations mises en file.
