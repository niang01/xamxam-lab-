/**
 * Guides d'utilisation intégrés (français). Chaque guide décrit des écrans qui EXISTENT et ont été vérifiés ;
 * une fonction non disponible est signalée comme telle, jamais décrite comme opérationnelle.
 */
export interface GuideStep { title: string; body: string; link?: { href: string; label: string } }
export interface Guide { slug: string; title: string; audience: string; summary: string; steps: GuideStep[]; example?: string; limits?: string[] }

export const GUIDES: Guide[] = [
  {
    slug: "premiers-pas", title: "Première connexion et création du compte", audience: "Tous",
    summary: "Créer son compte, configurer son profil, se connecter depuis un téléphone, une tablette ou un ordinateur.",
    steps: [
      { title: "Ouvrir la plateforme", body: "Dans le navigateur (Chrome sur Android, Safari sur iPhone), ouvrez https://xamxam-lab.onrender.com. En offre gratuite, le premier chargement après une période d'inactivité peut prendre jusqu'à une minute : c'est normal." },
      { title: "Créer un compte", body: "Touchez « Créer un compte ». Saisissez votre nom, votre adresse électronique, un mot de passe d'au moins 10 caractères et votre profil (élève, étudiant, technicien, ingénieur…). Un essai gratuit de 90 jours démarre automatiquement.", link: { href: "/inscription", label: "Créer un compte" } },
      { title: "Configurer le profil", body: "L'écran « Bienvenue » s'ouvre : indiquez votre établissement ou entreprise, votre filière ou fonction, votre pays et vos compétences. Ces informations orientent Aláji IA et les modèles de projets. Touchez « Enregistrer et continuer ».", link: { href: "/bienvenue", label: "Mon profil" } },
      { title: "Se connecter et se déconnecter", body: "Page « Connexion » : adresse et mot de passe. La session reste ouverte 14 jours sur l'appareil. Le bouton « Déconnexion » en haut à droite ferme la session. Après 5 mots de passe incorrects, le compte est bloqué 15 minutes.", link: { href: "/connexion", label: "Connexion" } },
      { title: "Mot de passe oublié", body: "Sur la page de connexion, touchez « Mot de passe oublié ? ». Si l'envoi de courriels est activé, un lien valable 1 heure vous est envoyé. Sinon, l'administrateur génère un lien de réinitialisation (valable 24 h, usage unique) et vous le transmet." },
      { title: "Renforcer la sécurité", body: "Dans Paramètres → Sécurité, activez la double authentification (application de type Google Authenticator) et conservez vos codes de secours.", link: { href: "/settings", label: "Paramètres" } },
      { title: "Installer l'application", body: "Android : installez l'APK fourni par l'administrateur, ou dans Chrome, menu ⋮ → « Ajouter à l'écran d'accueil ». iPhone : Safari → Partager → « Sur l'écran d'accueil »." },
    ],
    example: "Exemple : Awa, étudiante en BTS électrotechnique, crée son compte avec le profil « Étudiant », indique son lycée technique et les compétences « électricité, Arduino », puis ouvre le guide du tableau de bord.",
  },
  {
    slug: "tableau-de-bord", title: "Le tableau de bord", audience: "Tous",
    summary: "Lire les compteurs, accéder aux actions rapides et retrouver ses travaux récents.",
    steps: [
      { title: "Les compteurs", body: "Projets, simulations, appareils connectés et hors ligne, commandes en attente, validations demandées par l'IA, tâches, cours. Chaque tuile ouvre la rubrique correspondante. Un tiret « — » signifie qu'aucune donnée n'est encore disponible." },
      { title: "Actions rapides", body: "Nouveau projet, nouveau schéma (Electronics Lab), connecter un appareil (passerelle IoT), poser une question à Aláji IA." },
      { title: "Travaux récents", body: "Les derniers projets et simulations s'affichent avec leur état (terminée, en cours, échec)." },
      { title: "Menu", body: "Sur téléphone, le bouton ☰ en haut à gauche ouvre le menu des rubriques ; sur ordinateur il est affiché à gauche. Le bouton ✦ ouvre le panneau d'Aláji IA sur n'importe quelle page." },
      { title: "Langue et thème", body: "Le sélecteur WO/FR/EN change la langue immédiatement. En wolof, seuls les textes validés par des locuteurs natifs s'affichent ; les autres apparaissent dans la langue de repli (français par défaut)." },
    ],
  },
  {
    slug: "alaji-ia", title: "Utiliser Aláji IA", audience: "Tous",
    summary: "Poser une demande, comprendre l'analyse, suivre les agents et les outils exécutés, générer un rapport.",
    steps: [
      { title: "Ouvrir Aláji IA", body: "Menu → Aláji IA, ou le bouton ✦ en haut de n'importe quelle page (panneau latéral, même fonctionnement).", link: { href: "/ai", label: "Aláji IA" } },
      { title: "Vérifier le mode", body: "Le bandeau indique le mode : « IA » avec le nom du modèle si un fournisseur est configuré par l'administrateur ; sinon « Mode sans clé » : Aláji analyse la demande et exécute les calculs, rapports et recherches par règles déterministes, mais ne rédige pas librement." },
      { title: "Poser la demande", body: "Écrivez en français, anglais ou wolof. Exemples compris en mode sans clé : « calcul pump flowM3h=5 headM=30 pumpEff=0.6 motorEff=0.85 dailyVolumeM3=20 », « U=12 R=470 », « 192.168.1.0/24 », « irradiation solaire 14.69, -17.44 », « rapport du projet Irrigation solaire », « suivi de mes projets », « explique le condensateur »." },
      { title: "Lire l'analyse", body: "Chaque réponse commence par l'analyse : disciplines détectées, type de projet (mémoire, BTS, ingénieur, R&D, start-up), intention, agents mobilisés, puis les laboratoires où travailler." },
      { title: "Choisir les agents (facultatif)", body: "Touchez des agents (électricité, solaire, IoT…) pour imposer les spécialistes ; le nombre après le nom indique leurs exécutions réelles. Sans choix, Aláji les sélectionne selon la demande." },
      { title: "Contrôler le journal", body: "« Journal d'exécution » liste chaque outil appelé et son état (exécutée, en attente, bloquée). L'agent vérificateur contrôle ensuite les résultats : paramètres manquants, valeurs non finies, unités, mesures simulées. Pastille « Vérifié » ou « N point(s) à vérifier »." },
      { title: "Approuver les actions", body: "Une action qui modifie des données au-delà de votre niveau d'autonomie (Paramètres) attend votre approbation dans « Actions de l'IA en attente ». Aucune commande d'équipement n'est exécutée par l'IA : elle est seulement proposée." },
      { title: "Historique", body: "« Historique des conversations » rouvre une conversation précédente ; elle reste liée au projet choisi en haut de page." },
    ],
    limits: ["Sans fournisseur d'IA configuré, la compréhension libre et la rédaction ne sont pas disponibles.", "Aláji n'invente aucune mesure, donnée satellite, référence ou prix : une valeur absente est signalée comme paramètre manquant."],
  },
  {
    slug: "schemas-2d", title: "Espace 2D : schémas multidisciplines", audience: "Tous",
    summary: "Dessiner un plan électrique, un câblage IoT, un circuit hydraulique ou frigorifique avec les composants de la bibliothèque.",
    steps: [
      { title: "Ouvrir l'éditeur", body: "Menu → Schémas 2D. Choisissez un projet en haut pour rattacher le schéma.", link: { href: "/schemas", label: "Schémas 2D" } },
      { title: "Ajouter des composants", body: "Dans la palette, choisissez une discipline (électrique, IoT, hydraulique…), puis touchez un composant : un bloc repéré (QF1, K1, MCU1…) apparaît avec ses broches. Depuis la Bibliothèque, « Utiliser dans un schéma 2D » fait de même." },
      { title: "Placer et orienter", body: "Faites glisser un bloc au doigt ou à la souris (aimanté sur la grille). « Pivoter » le tourne de 90°. Les boutons ＋ − ← → ↑ ↓ zooment et déplacent la vue." },
      { title: "Relier", body: "Touchez une broche (elle devient orange), puis une autre broche : la liaison est tracée. Touchez une liaison pour la sélectionner puis « Supprimer la liaison »." },
      { title: "Renseigner les paramètres", body: "Sélectionnez un bloc : saisissez son repère et ses paramètres (calibre, tension de bobine, débit…) avec leurs unités, d'après la fiche technique de la référence choisie." },
      { title: "Vérifier", body: "Le panneau « Vérification du schéma » signale les erreurs (liaison vers une broche inexistante, broche reliée à elle-même) et les avertissements (broches non raccordées, paramètres vides, repères en double)." },
      { title: "Enregistrer et exporter", body: "« Enregistrer » crée une version (v1, v2…). Exports : SVG (vectoriel, pour le rapport), PNG, JSON. « Ajouter à la nomenclature du projet » reporte les composants dans l'onglet Composants et budget du projet." },
    ],
    example: "Câblage d'irrigation : Carte ESP32 (MCU1), Module relais (K1), Électrovanne (YV1) ; relier MCU1.GND–K1.GND, MCU1.GPIO–K1.IN, K1.NO–YV1.bobine+.",
    limits: ["Le schéma 2D n'est pas simulé. La simulation électronique se fait dans l'Electronics Lab (ngspice), les scénarios temporels dans le Studio 4D.", "Aucune vérification de conformité réglementaire n'est faite : une installation électrique réelle est réalisée par une personne habilitée."],
  },
  {
    slug: "studio-3d-4d", title: "Espaces 3D et 4D : maquette et scénarios dans le temps", audience: "Tous",
    summary: "Modéliser un équipement en 3D, simuler l'évolution d'une installation dans le temps et la rejouer.",
    steps: [
      { title: "Ouvrir le Studio", body: "Menu → Studio de simulation 2D/3D/4D.", link: { href: "/studio", label: "Studio" } },
      { title: "Scénario 4D : choisir le modèle", body: "« Énergie solaire + batterie » (état de charge sur plusieurs jours), « Réservoir et pompe » (niveau, pompage, déficit), « Chambre froide » (température, coupure de courant)." },
      { title: "Saisir les paramètres", body: "Remplissez chaque champ avec les valeurs de votre projet (fiches techniques, calculs des labos, NASA POWER). « Remplir avec un exemple » sert seulement à découvrir l'outil. Un champ vide est signalé comme paramètre manquant : rien n'est deviné." },
      { title: "Lancer et lire les résultats", body: "Résumé (énergies, volumes, durées), courbes, et « Bilan … (doit être nul) » : il vérifie la conservation de l'énergie ou du volume. La simulation est enregistrée dans vos simulations et rattachée au projet choisi." },
      { title: "Rejouer dans le temps", body: "▶ Lecture anime l'état (jauge de batterie, niveau d'eau ou thermomètre) ; le curseur permet d'aller à un instant précis." },
      { title: "Maquette 3D", body: "Ajoutez des blocs, cylindres et sphères ; saisissez dimensions (mm), position, rotation, couleur et matériau. La masse et le centre de gravité sont calculés ; la vue se tourne au doigt. « Enregistrer » crée une version ; « STL » exporte pour l'impression 3D." },
      { title: "Comparer simulation et mesures", body: "Pour une simulation de circuit temporelle, choisissez un appareil et une grandeur mesurée : écarts moyen, maximal et quadratique calculés." },
    ],
    limits: ["Pas de CAO volumique (esquisses contraintes, congés) ni de calcul de résistance des matériaux.", "Pas de moteur de dynamique des solides (collisions, mécanismes)."],
  },
  {
    slug: "bibliotheques", title: "Bibliothèques de composants", audience: "Tous",
    summary: "Trouver un composant, lire ses connexions et paramètres, ajouter une référence réelle.",
    steps: [
      { title: "Rechercher", body: "Menu → Bibliothèque de composants : filtrez par discipline (12 disciplines) ou catégorie, ou recherchez par nom.", link: { href: "/components", label: "Bibliothèque" } },
      { title: "Lire la fiche", body: "Touchez un composant : description, fonction, broches ou bornes, paramètres configurables avec unités, précautions et documentation (où le calculer ou le simuler dans la plateforme)." },
      { title: "Utiliser", body: "« Utiliser dans un schéma 2D » l'ajoute à l'éditeur ; les composants R, C, L, D et sources sont simulables dans l'Electronics Lab ; « Demander à Aláji IA » l'explique." },
      { title: "Ajouter une référence réelle", body: "« Ajouter un composant » : fabricant, référence, lien https vers la fiche technique, caractéristiques. Le composant reste « à vérifier » jusqu'à validation par un administrateur." },
    ],
    limits: ["Les composants génériques n'ont aucune valeur de fabricant : les paramètres se saisissent d'après la fiche de la référence choisie."],
  },
  {
    slug: "projets-iot", title: "Créer un projet IoT, un mémoire ou un projet de start-up", audience: "Étudiants, techniciens, ingénieurs, porteurs de projet",
    summary: "Démarrer à partir d'un modèle et conduire le projet jusqu'au rapport et à la présentation.",
    steps: [
      { title: "Choisir un modèle", body: "Projets → « Nouveau à partir d'un modèle » : agriculture intelligente, irrigation automatique, surveillance environnementale, domotique, énergie solaire, robotique, industrie, sécurité, santé connectée, chambre froide.", link: { href: "/projects?modele=1", label: "Modèles de projets" } },
      { title: "Choisir le niveau", body: "Mémoire de technicien, BTS/DUT, ingénieur, recherche, fin de formation ou start-up : la méthodologie et les tâches s'adaptent (par exemple, état de l'art pour la recherche, entretiens clients et modèle économique pour une start-up)." },
      { title: "Compléter le dossier", body: "Onglet « Dossier du projet » → Modifier : cahier des charges, objectifs, méthodologie, architecture, programmation, tests, résultats, conclusion. Les champs [à compléter] sont à remplacer par vos données." },
      { title: "Composants et budget", body: "Onglet « Composants et budget » : quantités et prix unitaires (devis, marketplace). Le total est calculé par devise ; une ligne sans prix est signalée et le total marqué incomplet." },
      { title: "Concevoir, calculer, simuler", body: "Schéma 2D du câblage, calculs dans les laboratoires (rattachés au projet), scénario 4D, maquette 3D. Tout est enregistré dans le projet." },
      { title: "Suivre", body: "Onglet Tâches (à faire / en cours / terminé) ; Aláji IA : « suivi de mes projets »." },
      { title: "Rapport et présentation", body: "« Rapport final (.md) » et « Présentation (.md) » génèrent les documents à partir des données enregistrées (aucun contenu inventé) ; la présentation est au format Marp (diapositives séparées par ---)." },
    ],
  },
  {
    slug: "disciplines", title: "Guide par discipline", audience: "Tous",
    summary: "Ce que chaque laboratoire permet réellement de faire.",
    steps: [
      { title: "Électricité (Electrical Lab)", body: "Calculs : loi d'Ohm, puissances en alternatif, courant d'emploi, chute de tension, section de câble (tableaux normatifs saisis et validés), bilan de puissance. Schémas : Schémas 2D (discipline électrique).", link: { href: "/lab/electrical", label: "Electrical Lab" } },
      { title: "Électronique (Electronics Lab)", body: "Éditeur de circuits (R, C, L, D, sources), vérification électrique, simulation ngspice (point de fonctionnement, transitoire, continu, fréquentiel), enregistrement et versions.", link: { href: "/lab/electronics", label: "Electronics Lab" } },
      { title: "Énergie solaire (Solar Energy Lab)", body: "Gisement NASA POWER (donnée modélisée), production mensuelle et horaire (pvlib), chaînes PV et plage MPPT, batteries, pompe, étude économique ; scénario 4D énergie + batterie.", link: { href: "/lab/solar", label: "Solar Energy Lab" } },
      { title: "IoT et embarqué", body: "Connexion série dans le navigateur (Web Serial), firmware de référence, IoT Gateway (HTTPS, MQTT), commandes confirmées, automatisations, arrêt d'urgence.", link: { href: "/lab/iot", label: "IoT & Embedded Lab" } },
      { title: "Mécanique et robotique", body: "Couple, train d'engrenages, force de vérin ; maquette 3D paramétrique (masse, centre de gravité).", link: { href: "/lab/mechanical", label: "Mechanical Lab" } },
      { title: "Froid et climatisation", body: "COP de Carnot et COP mesuré, apports par les parois, cycle frigorifique avec propriétés réelles des fluides (CoolProp) ; scénario 4D chambre froide.", link: { href: "/lab/refrigeration", label: "Refrigeration Lab" } },
      { title: "Informatique et réseaux", body: "Sous-réseaux IPv4 et découpage VLSM ; schémas réseau en 2D.", link: { href: "/lab/network", label: "Network Lab" } },
      { title: "Drones", body: "Drone Command Center : profil constructeur, conditions de vol, missions vérifiées (plafond, géorepérage, autonomie), commandes confirmées et arrêt d'urgence via le pont MAVLink — validé jusqu'ici sur liaison avec le simulateur seulement.", link: { href: "/drones", label: "Drone Command Center" } },
      { title: "Hydraulique et génie civil", body: "Pompe (puissance) dans le Solar Energy Lab, scénario 4D réservoir, schémas 2D ; génie civil : composants documentés pour les plans, sans calcul réglementaire de structure." },
    ],
    limits: ["Non disponibles : émulation réseau, éléments finis, CAO volumique, calcul réglementaire de structures (béton armé)."],
  },
  {
    slug: "licence", title: "Essai gratuit et licence", audience: "Tous",
    summary: "Comprendre l'essai de 90 jours et activer une licence.",
    steps: [
      { title: "Essai gratuit", body: "Chaque compte dispose de 90 jours d'accès complet à partir de sa création. Les jours restants s'affichent dans un bandeau et dans Licence. Les dates sont contrôlées par le serveur.", link: { href: "/licence", label: "Ma licence" } },
      { title: "À la fin de l'essai", body: "Vos données sont conservées. Les fonctions de travail (laboratoires, IA, projets…) demandent une licence ; Paramètres, Licence et Guides restent accessibles." },
      { title: "Activer une clé", body: "Licence → saisissez la clé reçue (format XXL-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX) → Activer. Une clé ne peut servir qu'au nombre de postes prévu." },
      { title: "Obtenir une licence", body: "Contactez l'administrateur de la plateforme. Le paiement en ligne (mobile money, carte bancaire) n'est pas encore disponible." },
    ],
  },
  {
    slug: "administrateur", title: "Guide de l'administrateur : comptes et licences", audience: "Administrateurs",
    summary: "Initialiser l'administrateur principal, gérer les comptes, les rôles, les habilitations et les licences.",
    steps: [
      { title: "Devenir administrateur principal", body: "Voie recommandée : sur Render, service xamxam-lab → Environment → Add Environment Variable : XX_ADMIN_EMAILS = votre adresse → Save Changes. Une fois le redéploiement terminé, connectez-vous (ou créez le compte) avec cette adresse : il devient administrateur. Voie de secours (tant qu'aucun administrateur n'existe) : Render → Logs, recopiez le « Code d'initialisation » sur la page Installation.", link: { href: "/installation", label: "Installation" } },
      { title: "Gérer les comptes", body: "Administration → Comptes : recherche, profil (rôle), désactivation, nomination d'autres administrateurs, déblocage après trop d'essais, vérification manuelle de l'adresse, prolongation de l'essai.", link: { href: "/admin", label: "Administration" } },
      { title: "Réinitialiser un mot de passe", body: "Bouton « Lien de réinitialisation » : un lien valable 24 h et à usage unique s'affiche une seule fois. Transmettez-le à la personne par un canal sûr (en main propre, message privé)." },
      { title: "Habilitations", body: "Opération réelle, banc d'essai, télépilote de drone, validateur de traduction wolof, jury : attribuées avec un justificatif et une date de validité. Elles conditionnent les commandes d'équipements réels." },
      { title: "Créer une catégorie de licence", body: "Administration → Licences → Catégories : code (ex. etudiant-annuel), nom, durée en jours, nombre de postes, prix indicatif en FCFA (information seulement)." },
      { title: "Émettre et attribuer", body: "« Émettre des licences » : choisissez la catégorie, le nombre de clés, éventuellement une organisation. Les clés s'affichent UNE seule fois : copiez-les. Pour attribuer directement à un compte, indiquez son adresse : la licence est activée sur ce compte." },
      { title: "Contrôler, renouveler, révoquer", body: "Liste des licences : postes utilisés, échéance, titulaires. « Renouveler » prolonge de N jours ; « Libérer le poste » retire un titulaire ; « Révoquer » désactive définitivement la licence. Tout est inscrit dans l'historique." },
      { title: "Sauvegarde", body: "Administration → Traductions et sauvegarde → « Télécharger une sauvegarde » : fichier JSON complet, à conserver chiffré." },
    ],
    limits: ["Le paiement en ligne n'est pas intégré : l'architecture prévoit qu'un futur module de paiement émette les licences par la même fonction que l'administrateur.", "Sans fournisseur de courriel configuré (XX_MAIL_PROVIDER, XX_MAIL_API_KEY, XX_MAIL_FROM), aucun courriel n'est envoyé : utilisez les liens de réinitialisation."],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug) ?? null;
