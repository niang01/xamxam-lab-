# Guide d'utilisation — XAM-XAM LAB

## Premiers pas
1. **Créer un compte** (`/inscription`) : nom, adresse, mot de passe (10 caractères minimum), profil (élève, étudiant, enseignant, formateur, technicien, ingénieur, chercheur, entrepreneur, startup, mentor, entreprise, recruteur, sponsor, investisseur). Vos projets sont **privés par défaut**.
2. **Langue** : boutons `WO · FR · EN` en haut de l'écran. Le wolof est la langue de référence ; tant qu'un texte n'a pas été validé par un locuteur natif, il s'affiche dans votre langue de repli (Paramètres) et un bandeau l'indique. Changer de langue ne fait perdre aucun travail.
3. **Badges** : chaque valeur indique sa nature — `MESURE` (appareil réel), `CALCUL`, `SIMULATION` (moteur et version), `DONNÉE MODÉLISÉE` (NASA POWER), `PRÉDICTION` (Meteomatics), `MESURE SIMULÉE` (démonstration). Une fonction non disponible est affichée comme telle avec sa phase.

## Projets (Project & Research Studio)
Créer un projet → fiche (problématique, objectifs, cahier des charges), membres (éditeur, commentateur, lecteur), tâches (kanban ; « Créer les étapes du mémoire » pour un mémoire), objets liés (schémas, calculs, simulations, appareils), **Rapport** imprimable séparant calculé / simulé / mesuré. Dans chaque laboratoire, le sélecteur de projet rattache vos calculs au projet choisi.

## Laboratoires
- **Electrical Lab** : loi d'Ohm, puissances, courant d'emploi, chute de tension, bilan de puissance ; section de câble à partir d'un tableau normatif saisi par l'administrateur. Un champ vide = paramètre manquant (jamais remplacé par une valeur par défaut).
- **Electronics Lab** : ajouter des composants, les glisser, cliquer deux broches pour les relier ; la vérification électrique (ERC) s'affiche en direct ; choisir l'analyse (point de fonctionnement, transitoire, balayage DC, fréquentielle) puis **Simuler** (ngspice). « Exemples pédagogiques » : pont diviseur, circuit RC. **Enregistrer** crée une nouvelle version.
- **Solar Energy Lab** : saisir latitude/longitude (ou « Ma position »), importer la climatologie NASA POWER, calculer la production ; **simulation horaire pvlib** sur une année réelle (inclinaison, azimut, puissance crête, coefficients du module, pertes, onduleur) ; associations série/parallèle, batteries, pompage, rentabilité.
- **Refrigeration & HVAC Lab** : cycle frigorifique avec fluide réel (CoolProp) et diagramme log p–h ; COP de Carnot et mesuré ; flux par les parois.
- **Mechanical Lab**, **Computer & Network Lab** : couple, engrenages, vérins ; sous-réseaux et VLSM.
- **Bibliothèque de composants** : rechercher, filtrer, ouvrir une fiche, « Expliquer ce composant » (IA), ajouter une référence réelle avec sa fiche technique (statut « à vérifier »).
- **Studio 2D/3D/4D** : rejouer une simulation, la **comparer à des mesures réelles** d'un appareil (écarts calculés), ouvrir un modèle 3D STL.

## XAM-XAM AI CORE
Posez une question en wolof, français ou anglais, ou choisissez des agents. Sous chaque réponse : le **journal d'exécution** (outil, agent, état). Une action au-delà de votre niveau d'autonomie (Paramètres) est **mise en attente** : l'approuver ou la refuser dans « Actions en attente ». L'IA ne commande jamais un équipement : elle propose ; une personne confirme. Sans clé IA sur le serveur, un moteur de règles répond (signalé) : sous-réseaux, loi d'Ohm (« U=12 R=470 »), irradiation (« irradiation solaire 14.69, -17.44 »), « mes appareils », « mes projets ». Boutons **Dicter** / **Écouter** : selon les voix disponibles sur l'appareil.

## Appareils et opérations
- **IoT Gateway** : « Ajouter un appareil » (matériel, liaison HTTPS / MQTT / série, environnement virtuel / banc / réel, grandeurs, commandes autorisées avec durée maximale). Le **jeton** n'est affiché qu'une fois : copiez-le dans le firmware ou l'agent local. Mesures en graphique ; mesures simulées de démonstration clairement marquées.
- **IoT & Embedded Lab** : lecture série dans Chrome/Edge et relais des lignes « grandeur=valeur » ; modèle de firmware ESP32.
- **Automation Studio** : construire un scénario (déclencheur, condition avec **votre** seuil, action, temporisation, vérification, plafond quotidien), lancer l'**essai à blanc**, puis l'activer. Une commande proposée par un scénario attend votre confirmation (sauf préautorisation de niveau 5).
- **Remote Control Center** : ouvrir une session (check-list ; habilitation et autorisation en réel), commander, **ARRÊT D'URGENCE**, transférer le contrôle, consulter le journal. « Exécutée » n'apparaît qu'après l'accusé de l'appareil.
- **Earth & Space Intelligence** : séries NASA POWER, climatologie, prévisions Meteomatics, export CSV.

## Apprendre et collaborer
- **Academy** : suivre un cours, lire les leçons, ouvrir le TP dans le laboratoire, répondre au QCM (corrigé par le serveur) ; certificat vérifiable publiquement au-delà du seuil. Les enseignants créent des cours et suivent les résultats.
- **Collaborative Engineering** : messagerie du projet, **réunion vidéo** (audio, vidéo, partage d'écran) réservée aux membres, résumé par l'IA.

## Écosystème
Startups (fiche, mises en relation acceptées des deux côtés), Concours (dépôt d'une version figée de votre projet, jury humain, classement publié), Mentors (réservation de créneaux), Talents & Carrières (offres, candidatures ; recherche limitée aux profils publics), Tech News & annonces (contenu sponsorisé identifié, signalement). **Mon portfolio** : rendez-le public pour qu'il apparaisse aux recruteurs.

## XAM-XAM MARKETPLACE
- **Publier** : titre, catégorie (composant, kit, équipement, outil, service, logiciel, formation, offre de projet), état pour le matériel, prix en FCFA (vide = « prix sur demande »), quantité, localisation, modes de remise, caractéristiques (une par ligne : `nom = valeur`). Les caractéristiques sont affichées comme **déclarées par le vendeur**. Vous pouvez enregistrer un brouillon.
- **Parcourir** : recherche (titre, description, caractéristiques), catégorie, prix minimum et maximum, tri ; ♡ pour les favoris.
- **Demandes** : « Contacter le vendeur » ouvre un échange privé entre vous deux. Le vendeur accepte ou décline ; chacun peut clore.
- **Gérer** : passer l'annonce en réservée, vendue ou retirée (vendue et retirée sont définitives ; les demandes ouvertes sont alors closes et les acheteurs prévenus). Une annonce qui a reçu des demandes ne se supprime pas : retirez-la.
- **Aucun paiement en ligne** : convenez des modalités directement et ne payez jamais avant d'avoir vérifié l'article ou la prestation. Signalez toute annonce douteuse (« Signaler l'annonce »).

## Double authentification
Paramètres → **Double authentification** : scannez le QR code avec une application d'authentification (Google Authenticator, Aegis, FreeOTP, 2FAS…), saisissez le code à 6 chiffres, puis **conservez les 10 codes de secours hors ligne** (affichés une seule fois, chacun utilisable une fois si vous perdez votre téléphone). À la connexion, le code est demandé après le mot de passe. Désactiver ou régénérer les codes exige le mot de passe et un code.

## Interface
Thème **sombre** (par défaut), **clair** ou **système** dans la barre supérieure ; bouton **✦ AI** pour ouvrir le panneau XAM-XAM AI dans n'importe quelle rubrique ; la **barre d'état** en bas indique la connexion, l'état du serveur, le mode de l'IA, les appareils vus et ce qui attend votre confirmation.

## Paramètres
Profil, langue et langue de repli, niveau d'autonomie de l'IA (1 à 5), mot de passe (déconnecte toutes vos sessions), **export de toutes vos données**, suppression du compte.

## Sur téléphone
Ouvrir le site dans le navigateur puis « Ajouter à l'écran d'accueil » (PWA), ou installer l'application Android/iOS fournie par votre administrateur.
