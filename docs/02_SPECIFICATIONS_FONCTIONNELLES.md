# 2. Spécifications fonctionnelles détaillées

Cahier des charges fonctionnel, description de chaque module, de ses sous-rubriques et de la fonction de chaque bouton/outil.

## 2.0 Conventions communes à toutes les rubriques

**Éléments transverses (présents partout)**
| Élément | Fonction |
|---|---|
| Sélecteur `WO · FR · EN` | Change la langue de l'interface sans recharger ni perdre le travail en cours (état conservé côté client, brouillons enregistrés). Texte sans traduction validée → langue de repli affichée avec mention. |
| Bouton « Demander à XAM-XAM AI » | Ouvre le panneau IA contextualisé (projet, rubrique, objet sélectionné). L'IA voit seulement ce que l'utilisateur a le droit de voir. |
| Sélecteur de projet | Rattache tout objet créé à un projet (privé par défaut). |
| Badge de nature | `MESURE` / `CALCUL` / `SIMULATION` / `PRÉDICTION` / `DÉMO` / `NON DISPONIBLE`, avec source, date, moteur et version au survol. |
| Journal d'activité | Historique horodaté des actions humaines et IA sur l'objet. |
| Exporter | PDF, PNG/SVG, CSV/JSON selon l'objet ; export d'un rapport signé (empreinte). |
| Indicateur hors ligne | « Données du cache enregistrées le … » ; actions mises en file et synchronisées. |

**États d'une fonctionnalité** (affichés, jamais masqués) : `Disponible` · `Démo (données signalées)` · `Configuré, non testé` · `Nécessite matériel/clé` · `Non disponible (phase N)`. Un bouton d'une fonction non disponible est **désactivé avec la raison**, jamais décoratif.

**Objets fondamentaux** : Utilisateur, Organisation, Projet, Document, Schéma (2D), Modèle (3D), Simulation (exécution d'un moteur), Mesure, Appareil, Automatisation, Session de télépilotage, Tâche, Rapport, Cours, Concours, Startup, Offre.

---

## 2.1 Dashboard
**But** : point d'entrée adapté au profil.
| Sous-rubrique | Contenu / boutons |
|---|---|
| Vue d'ensemble | Cartes : projets actifs, simulations en cours (état réel du moteur), appareils connectés/déconnectés, alertes, tâches dues, cours en cours. Chaque carte → rubrique concernée. |
| Démarrage rapide | « Nouveau projet », « Nouveau schéma », « Connecter un appareil », « Poser une question à l'IA », « Reprendre là où j'étais » (dernier objet, synchronisé entre appareils). |
| Tableau par profil | Élève : progression ; Enseignant : classes et copies à corriger ; Startup : jalons ; Recruteur : candidatures ; Admin : santé plateforme. |
| Notifications | Liste, filtre, marquer lu ; préférences par canal (application, push, courriel, SMS). |

## 2.2 XAM-XAM AI CORE (espace de travail IA)
| Sous-rubrique | Boutons / outils |
|---|---|
| Conversation | Saisie texte, **Dicter** (micro ; wolof selon disponibilité réelle du service, voir doc 10), **Écouter** (synthèse), pièce jointe (schéma, photo, CSV), choix du projet. |
| Plan d'exécution | Affiche le plan proposé par l'orchestrateur (étapes, agents, outils, autorisations requises). Boutons **Approuver le plan**, **Modifier**, **Refuser**. Rien n'est exécuté au niveau ≥ 3 sans le plan approuvé (ou préautorisé). |
| Suivi des opérations | Fil en temps réel : étape, agent, outil appelé, entrée/sortie résumées, durée, coût, statut (`en attente`, `en cours`, `réussie`, `échouée`, `annulée`). Bouton **Suspendre** / **Annuler** par opération. |
| Résultats | Objets produits (schéma, calcul, simulation, rapport) avec badge de nature ; **Ouvrir dans le labo**, **Ajouter au projet**, **Vérifier** (relance la vérification par l'agent de contrôle). |
| Niveau d'autonomie | Affiche le niveau effectif (1–5) pour ce projet/appareil ; modification selon les droits. |
| Mémoire | Ce que l'IA retient du projet (décisions, hypothèses) ; **Oublier**, **Corriger**. |

## 2.3 AI Command Center (utilisateurs autorisés)
| Sous-rubrique | Boutons / outils |
|---|---|
| Agents | Liste des 15+ agents : actif/indisponible, missions en cours, taux d'échec, coût. **Désactiver un agent**, **Limiter ses outils**. |
| Opérations | Toutes les opérations IA en cours ; **Suspendre**, **Arrêter**, **Arrêt global IA** (coupe-circuit : toutes les opérations IA suspendues, aucun effet sur les sécurités matérielles qui restent actives). |
| Simulations | Files d'attente des moteurs, ressources consommées ; **Annuler un job**. |
| Équipements | Connectés/déconnectés, dernières commandes ; **Révoquer l'accès d'un appareil**. |
| Automatisations | Scénarios actifs, dernières exécutions ; **Désactiver**. |
| Sessions de télépilotage | Sessions en cours, pilote responsable ; **Demander la reprise**, **Arrêt d'urgence logiciel** (le matériel garde son arrêt câblé). |
| Alertes et incidents | Ouvrir/assigner/clore un incident ; rapport post-incident. |
| Permissions | Accordées à l'IA par projet/appareil/opération ; **Révoquer**. |
| Audit | Journal immuable (qui/quoi/quand/pourquoi/résultat), recherche, export. |
| Ressources | Consommation IA (jetons, coût), calcul (CPU·h, GPU·h), stockage, bande passante ; plafonds. |

## 2.4 Engineering Lab (laboratoire central)
Espace commun aux labos : **canevas** (2D/3D), **bibliothèque de composants**, **inspecteur** (propriétés de l'objet sélectionné), **panneau de calcul**, **panneau de simulation**, **panneau IA**, **historique des versions**.
| Bouton commun | Fonction |
|---|---|
| Nouveau / Ouvrir / Enregistrer une version | Création, ouverture, version nommée (diff visuel entre versions). |
| Vérifier le schéma (ERC/DRC) | Règles électriques/de conception : nœuds flottants, courts-circuits, protections absentes, incompatibilités de tension. |
| Calculer | Lance les calculs déterministes de la rubrique ; affiche formules, hypothèses, références normatives, paramètres manquants. |
| Simuler | Envoie au moteur adapté (doc 08) ; affiche file, progression, résultat, domaine de validité. |
| Mesurer (virtuel) | Sondes virtuelles (voltmètre, ampèremètre, oscilloscope) posées sur le schéma ; lecture issue de la simulation, badgée `SIMULATION`. |
| Comparer avec le réel | Superpose une mesure IoT (badge `MESURE`) à la simulation. |
| Générer le rapport | Rapport technique avec schéma, calculs, simulations, hypothèses et limites. |

### 2.4.1 Electrical Lab
- **Sous-rubriques** : Installations résidentielles ; Installations industrielles ; Monophasé/Triphasé ; Circuits de puissance ; Circuits de commande (contacteurs, relais, temporisations, auto-maintien) ; Distribution (TGBT, tableaux) ; Moteurs et variateurs ; Protections et sélectivité ; Mise à la terre (schémas TT/TN/IT).
- **Outils de calcul** : loi d'Ohm et puissance (P, Q, S, cos φ) ; courant d'emploi ; section de câble (courant admissible × facteurs de correction) ; chute de tension ; calibre de protection ; courant de court-circuit (méthode conventionnelle) ; bilan de puissance avec coefficients de simultanéité ; rendement ; compensation d'énergie réactive.
- **Règle** : les tableaux et coefficients normatifs (NF C 15-100, CEI 60364) ne sont pas inventés : ils sont saisis depuis la norme achetée, avec référence et validateur. Coefficient absent → calcul bloqué avec « paramètre manquant ».
- **Simulation** : circuits de commande (logique séquentielle simulée pas à pas) ; circuits électriques en régime permanent/transitoire via ngspice.
- **IA** : AI Electrical Engineer dessine (propose un schéma éditable), analyse, calcule via outils, vérifie.

### 2.4.2 Electronics Lab
- **Sous-rubriques** : Schéma ; Simulation ; Programmation (microcontrôleurs) ; Analyse de signaux ; Mesures virtuelles ; Circuit imprimé (export vers KiCad, phase ultérieure).
- **Outils** : placer/relier des composants, étiquettes de réseau ; analyses ngspice `.op`, `.dc`, `.ac`, `.tran` ; oscilloscope, multimètre, générateur de fonctions virtuels ; FFT ; détection d'erreurs (ERC, absence de masse, composants hors calibre selon fiche technique).
- **Programmation** : éditeur de code (Arduino/C++, MicroPython), compilation côté serveur (arduino-cli / PlatformIO en conteneur isolé), téléversement via Web Serial (navigateurs Chromium) ou agent local. Co-simulation microcontrôleur : à évaluer (ex. simulateurs AVR/ESP32 existants) — `Non disponible` tant que non intégré.

### 2.4.3 Solar Energy Lab
- **Sous-rubriques** : Site (coordonnées, ensoleillement) ; Consommation (bilan de charges) ; Champ PV ; Stockage ; Onduleur/régulateur ; Pompage solaire ; Hybride/micro-réseau ; Solaire thermique ; Éolien ; Rentabilité.
- **Outils** : import de l'irradiation du site (NASA POWER, Meteomatics) ; production (pvlib : position solaire, transposition, température de cellule, pertes) ; associations série/parallèle avec contrôle des plages MPPT de l'onduleur choisi (fiche technique) ; dimensionnement batterie (autonomie, profondeur de décharge, technologie) ; MPPT vs PWM ; pertes (câbles, poussière, température) ; pompage (HMT, débit, puissance hydraulique) ; rentabilité (CAPEX/OPEX saisis, coût actualisé, retour sur investissement) ; simulation horaire sur un an.
- **Règle** : prix et caractéristiques des équipements = saisie utilisateur ou catalogue vérifié ; aucun prix inventé.

### 2.4.4 IoT & Embedded Systems Lab
- **Sous-rubriques** : Cartes (Arduino, ESP32, XIAO, Raspberry Pi) ; Capteurs ; Réseaux de capteurs ; Domotique ; Agriculture intelligente ; Surveillance environnementale.
- **Outils** : assistant de câblage (brochage vérifié, compatibilité de tension 3,3/5 V) ; générateur de firmware à partir de modèles **testés** ; compilation ; téléversement ; enregistrement de l'appareil dans l'IoT Gateway (jeton) ; tableau de bord automatique des mesures.

### 2.4.5 Mechanical & Mechatronics Lab
- **Sous-rubriques** : Pièces ; Assemblages ; Engrenages et transmissions ; Moteurs et actionneurs ; Hydraulique ; Pneumatique ; Robots (cinématique).
- **Outils** : modélisation paramétrique (noyau CAO OpenCascade), import/export STEP/STL ; contraintes d'assemblage ; calculs (rapport de réduction, couple, puissance, efforts) ; simulation de mouvement et collisions (moteur physique) ; contraintes/déformations par éléments finis (CalculiX/Gmsh, job serveur) ; cinématique de bras robotiques.

### 2.4.6 Refrigeration & HVAC Lab
- **Sous-rubriques** : Réfrigérateurs/congélateurs ; Climatisation ; Chambres froides ; Pompes à chaleur ; Circuits frigorifiques.
- **Outils** : diagramme enthalpique (log p–h) d'un fluide réel (CoolProp) ; cycle à compression (points, COP, puissance frigorifique) ; bilan thermique d'une chambre froide (parois, renouvellement d'air, produits) ; échangeurs ; comparaison de fluides (avec rappel réglementaire GWP).

### 2.4.7 Computer & Network Lab
- **Sous-rubriques** : Architecture d'ordinateur ; Réseaux (topologies, adressage IP, VLAN, routage, commutation) ; Serveurs et virtualisation ; Cloud ; Cybersécurité.
- **Outils** : éditeur de topologie ; calculateur de sous-réseaux ; émulation réseau réelle en conteneurs isolés (Containerlab / équivalent, routeurs logiciels FRRouting) avec console ; simulation de flux (ns-3, phase ultérieure) ; scénarios de sécurité défensifs (pare-feu, segmentation) en environnement fermé.

### 2.4.8 Component Library
- **Fiche composant** : nom, image, symbole normalisé (CEI 60617 / IEEE 315), modèle 2D (empreinte), modèle 3D si disponible, description, fonction, caractéristiques, brochage, conditions d'utilisation, précautions, modèle de simulation (SPICE…), référence constructeur **vérifiée** (lien fiche technique), licence de la source, statut `vérifié`/`à vérifier`.
- **Boutons** : Rechercher (texte, catégorie, caractéristique), Filtrer, Glisser-déposer vers un canevas, Comparer, Voir en 3D, Ouvrir la fiche technique, Proposer une correction (circuit de validation), « Expliquer ce composant » (Education Tutor, selon niveau).
- **Sources** : bibliothèques KiCad (licence CC-BY-SA 4.0 avec exception, à confirmer), modèles SPICE constructeurs (licences au cas par cas). Aucune caractéristique inventée.

## 2.5 2D / 3D / 4D Simulation Studio
| Mode | Fonctions | Badge |
|---|---|---|
| 2D | Schémas, plans, circuits, dessins techniques, diagrammes ; cotation ; calques ; export SVG/PDF/DXF | — |
| 3D | Modélisation, assemblages, machines, installations, robots, drones, environnements (terrain réel via données géographiques) | — |
| 4D | Lecture temporelle : mouvements, paramètres dynamiques, événements, mesures ; **comparaison simulation/réalité** sur la même frise | `ANIMATION` (visuel seul), `PHYSIQUE TEMPS RÉEL` (approximation), `SIMULATION NUMÉRIQUE` (solveur), `MESURE` |
| Digital Twin | Jumeau numérique d'une installation : modèle + flux de mesures IoT + écarts + historique | état de synchronisation affiché |

Boutons : Lecture/Pause/Vitesse, Curseur temporel, Ajouter une sonde, Comparer deux exécutions, Exporter la vidéo, Exporter les données.

## 2.6 IoT Gateway
| Sous-rubrique | Boutons / outils |
|---|---|
| Appareils | Liste (identifiant, propriétaire, capacités, protocole, état, dernière mesure et son âge, firmware) ; **Ajouter**, **Révoquer**, **Mettre à jour le firmware** (signé). |
| Ajouter un appareil | Assistant : choisir le protocole (USB/série via Web Serial ou agent local, Wi-Fi/HTTP, MQTT, BLE via Web Bluetooth, LoRa via passerelle LoRaWAN, RS485/Modbus via agent local) → identification → génération du jeton → test de réception réelle. |
| Mesures | Flux temps réel, historique, qualité (`valid`, `suspect`, `simulated`), calibration. |
| Commandes | Commandes déclarées par la capacité de l'appareil ; envoi soumis au moteur de sécurité ; statut `proposée → confirmée → envoyée → accusée/expirée`. |
| Agent local | Téléchargement de l'agent (Windows/macOS/Linux/Raspberry Pi), appairage par code, état. |
| Journaux | Connexions, erreurs, reconnexions. |

## 2.7 Remote Control Center
| Sous-rubrique | Boutons / outils |
|---|---|
| Sélection du mode | **Simulation virtuelle** / **Banc d'essai physique** / **Opération réelle** — mode affiché en permanence (bandeau de couleur différente), changement de mode = nouvelle session avec contrôles propres. |
| Session | Vidéo en direct (WebRTC), télémétrie, position GPS (carte), batteries, liaison (latence, qualité), alertes. |
| Commandes | Commandes de haut niveau autorisées (armer, décoller, mission, retour, atterrir pour un drone ; marche/arrêt pour une pompe…), limites affichées. **ARRÊT D'URGENCE** (toujours actif, sans confirmation). |
| Transfert de contrôle | Demande/acceptation entre opérateurs, journalisé. |
| Préparation de mission | Plan de vol/de tâche, vérifications pré-vol (check-list), autorisations réglementaires (ANACIM pour les drones au Sénégal) jointes. |
| Historique | Rejouer une session (télémétrie + vidéo + commandes). |

## 2.8 Earth & Space Intelligence
| Sous-rubrique | Fonctions |
|---|---|
| Carte | Fonds cartographiques, couches NASA GIBS (tuiles d'imagerie), contours de projet. |
| Climat & météo | NASA POWER (températures, humidité, pluie, rayonnement, vent ; historique), Meteomatics (prévisions selon contrat), Open-Meteo/MET Norway. |
| Sols | SMAP (humidité régionale ~9 km, date de passage). |
| Végétation | NDVI MODIS/Landsat/Sentinel-2 (via Planetary Computer). |
| Analyse | Séries temporelles, anomalies climatiques, statistiques ; export CSV/GeoTIFF. |
| Fiche source | Résolution, fraîcheur réelle (date d'acquisition), licence, quota. Une donnée ancienne n'est jamais présentée comme instantanée. |
| Lien projet | « Utiliser dans le Solar Lab / l'Automation Studio / le rapport ». |

## 2.9 Project & Research Studio
| Sous-rubrique | Contenu |
|---|---|
| Fiche projet | Description, objectifs, problématique, cahier des charges, visibilité (privé par défaut). |
| Membres | Invitations, rôles projet (propriétaire, éditeur, commentateur, lecteur). |
| Documents / Schémas / Codes / Simulations / Résultats | Objets liés, versions. |
| Tâches & calendrier | Kanban, jalons, échéances. |
| Versions | Instantanés du projet ; comparaison. |
| Rapports | Générés à partir des objets, avec distinction **calculé / simulé / mesuré**. |
| Mémoire de fin d'études | Parcours guidé : problématique → plan → méthodologie → dimensionnement → schémas → simulations → expérimentation → analyse → rédaction → préparation de soutenance (diapositives, questions probables). L'IA assiste ; le texte est celui de l'étudiant (traçabilité des contributions IA, conformément aux règles des établissements). |
| Bibliographie | Références (DOI), recherche (Research Assistant) ; aucune référence inventée : chaque référence citée par l'IA doit être vérifiable (DOI/URL résolus). |

## 2.10 XAM-XAM Academy
| Sous-rubrique | Fonctions |
|---|---|
| Catalogue | Cours par domaine/niveau/langue ; filtres. |
| Cours | Leçons (texte, vidéo, schéma interactif), exercices, **TP dans les labos** (le TP ouvre un canevas préparé), quiz, évaluations. |
| Classes virtuelles | Séances en direct (visioconférence), tableau blanc, partage de canevas. |
| Espace enseignant | Créer cours/exercices/TP, barèmes, corriger, suivre les résultats, détecter les difficultés. |
| Progression | Compétences acquises, badges, certificats (vérifiables par lien et empreinte). |
| Tuteur IA | Education Tutor : explications adaptées au niveau, indices progressifs plutôt que solutions directes en évaluation. |

## 2.11 Collaborative Engineering
Visioconférence, audio, caméra, partage d'écran (WebRTC via SFU), messagerie de projet, tableau blanc, **édition simultanée** des schémas et modèles (CRDT), présence et curseurs, commentaires ancrés, tâches, historique, versions. IA : résumé de réunion (avec consentement à l'enregistrement), décisions **proposées** au compte rendu puis validées par un participant, création de tâches.

## 2.12 Global Startup Network
Fiche startup (nom, logo, pays, secteur, présentation, problème, solution, prototype lié au projet, équipe, avancement, besoins, partenaires recherchés, besoins financiers), recherche (cofondateurs, ingénieurs, développeurs, techniciens, partenaires, mentors, investisseurs), demandes de mise en relation (acceptées par les deux parties), recommandations IA expliquées (« pourquoi cette suggestion »).

## 2.13 Global Challenges
Création de concours (règlement, critères, calendrier, prix, sponsors), appels à projets, inscription individuelle/équipe, dépôt (lié à un projet, version figée), jurys (grilles, conflits d'intérêts déclarés), évaluation, classement publié avec détail des notes, certificats. IA : vérification de complétude, synthèses de dossiers pour le jury — **jamais de note ni de décision finale par l'IA**.

## 2.14 Mentor & Incubator
Profils de mentors (expertises, langues, disponibilités), réservation de créneaux, visioconférence, objectifs, suivi des jalons, évaluations, plans de progression. IA : préparation des rendez-vous (synthèse de l'avancement), relances.

## 2.15 Talent & Careers
Profil, CV, compétences (prouvées par projets/certificats de la plateforme), portfolio, réalisations ; offres (emploi, stage, mission), recherche de talents, candidatures, messagerie, constitution d'équipes. Consentement explicite à la visibilité du profil ; appariement IA expliqué, sans critère discriminatoire (sexe, âge, origine, religion, handicap exclus des modèles), audit des recommandations.

## 2.16 Tech News & Marketplace
Catégories (actualités, IA, numérique, énergies renouvelables, climat, environnement, innovation, formations, équipements, services, emplois, événements, appels à projets, financements), recherche, filtres, publication, **modération** (signalement, file de modération), contenu sponsorisé **identifié**. Marketplace : annonces et mise en relation (paiement intégré : phase ultérieure, à contractualiser).

## 2.17 My Portfolio
Page publique (si l'utilisateur l'active) regroupant projets publiés, certificats, réalisations, contributions ; lien partageable ; contrôle fin de ce qui est public.

## 2.18 Settings
Profil, langue (WO/FR/EN), sécurité (mot de passe, double authentification TOTP/clé d'accès, sessions actives, révocation), notifications, confidentialité, appareils de l'utilisateur, autonomie IA par défaut, abonnements et quotas, export de toutes ses données, suppression du compte.

## 2.19 Applications mobiles (Android, iOS)
Comptes, IA (texte + voix), projets, simulations compatibles (lancement et consultation ; calcul côté serveur), visionneuse 3D, supervision IoT, communications et visioconférence, formations, concours, notifications push, commandes autorisées d'équipements (avec les mêmes validations que le web). Mode hors connexion pour la consultation et la saisie ; synchronisation ultérieure. Limites matérielles réelles : voir doc 04 §3.
