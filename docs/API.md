# API de XAM-XAM LAB

Document généré par `npm run docs:api` (95 routes). Toutes les réponses sont en JSON ; les erreurs ont la forme `{ "error": "message", "key": "clé traduisible", "details": … }`. Les corps sont validés (zod) : données invalides → 400 avec le détail des champs. Session : cookie `xx_session` (httpOnly) obtenu par `POST /api/auth/login`. Appareils : en-tête `Authorization: Bearer <jeton>`.

## admin

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| GET | `/api/admin/backup` | administrateur | Téléchargement d'une sauvegarde complète (administrateur). Contient des données personnelles : à conserver chiffrée. |
| PATCH | `/api/admin/market/listings/[id]` | administrateur | Actions d'administration sur une annonce : masquer / rétablir (motif obligatoire), marquer sponsorisée (toujours affiché). |
| PATCH | `/api/admin/market/reports/[id]` | administrateur | Décision humaine sur un signalement : retenu (annonce masquée, vendeur prévenu avec le motif) ou rejeté. |
| GET | `/api/admin/market` | administrateur | Modération : signalements ouverts et récents, annonces masquées. |
| POST | `/api/admin/users/[id]/clearances` | administrateur | Habilitation nominative : justificatif obligatoire (référence de formation, autorisation, attestation), date d'expiration facultative. |
| DELETE | `/api/admin/users/[id]/clearances` | administrateur |  |
| GET | `/api/admin/users` | administrateur |  |
| PATCH | `/api/admin/users` | administrateur | Désactivation / réactivation (révocation immédiate des sessions). |

## ai

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| POST | `/api/ai/chat` | session |  |
| GET | `/api/ai/conversations/[id]` | session |  |
| GET | `/api/ai/conversations` | session |  |
| GET | `/api/ai/status` | session |  |
| POST | `/api/ai/steps/[id]` | session |  |
| GET | `/api/ai/steps` | session | Actions de l'IA en attente d'approbation humaine. |

## auth

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| POST | `/api/auth/login` | public |  |
| POST | `/api/auth/logout` | public |  |
| GET | `/api/auth/me` | public |  |
| POST | `/api/auth/mfa` | session | Seconde étape de connexion : code de l'application d'authentification ou code de secours. |
| POST | `/api/auth/register` | public |  |

## automations

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| POST | `/api/automations/[id]/dry-run` | session | Essai à blanc : rejoue l'historique RÉEL (mesures valides) et montre ce qui aurait été déclenché. Aucune action. |
| PATCH | `/api/automations/[id]` | session | Activation (essai à blanc préalable obligatoire) et préautorisation de niveau 5 : réservée au propriétaire de niveau d'autonomie 5, autorisé à confirmer des commandes, avec l'habilitation exigée par l'environnement de l'appareil cible. |
| DELETE | `/api/automations/[id]` | session |  |
| GET | `/api/automations` | session |  |
| POST | `/api/automations` | session | Création : le scénario est créé DÉSACTIVÉ ; l'essai à blanc est obligatoire avant activation. |

## calc

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| POST | `/api/calc/[kind]` | session |  |

## command-center

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| GET | `/api/command-center` | administrateur | AI Command Center (administrateurs) : état réel de la plateforme, coupe-circuits, révocations, audit. |
| POST | `/api/command-center` | administrateur |  |

## commands

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| POST | `/api/commands/[id]/cancel` | session |  |
| POST | `/api/commands/[id]/confirm` | session |  |

## components

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| PATCH | `/api/components/[id]` | administrateur | Vérification d'un composant (administrateur) : contrôle des caractéristiques contre la fiche technique. |
| GET | `/api/components` | session |  |
| POST | `/api/components` | session | Ajout d'un composant réel : référence et fiche technique obligatoires ; statut « à vérifier » jusqu'à vérification. |

## compute

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| POST | `/api/compute/pv-hourly` | session | Simulation photovoltaïque HORAIRE (pvlib) sur une année réelle de données NASA POWER (modélisées, régionales). Tous les paramètres de conception sont fournis par l'utilisateur (aucune valeur par défaut). |
| GET | `/api/compute/saturation` | session |  |
| GET | `/api/compute/status` | session | Disponibilité réelle du moteur Python (versions de pvlib et CoolProp). |
| POST | `/api/compute/thermo-cycle` | session | Cycle frigorifique à compression de vapeur — propriétés du fluide réel (CoolProp). Résultat enregistré comme calcul. |

## courses

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| POST | `/api/courses/[id]/enroll` | session |  |
| POST | `/api/courses/[id]/lesson` | session |  |
| GET | `/api/courses/[id]/results` | session | Suivi des apprenants (auteur du cours). |
| GET | `/api/courses/[id]` | session | Les bonnes réponses du quiz ne sont transmises qu'à l'auteur. |
| PUT | `/api/courses/[id]` | session |  |
| POST | `/api/courses/[id]/submit` | session | Correction côté serveur ; certificat délivré au premier score ≥ seuil (empreinte vérifiable publiquement). |
| GET | `/api/courses` | session |  |
| POST | `/api/courses` | session |  |

## dashboard

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| GET | `/api/dashboard` | session | Vue d'ensemble de l'utilisateur : uniquement des comptages réels de ses données. |

## device

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| POST | `/api/device/ack` | jeton d'appareil (Bearer) | Accusé d'exécution : seule source autorisée pour déclarer une commande « exécutée ». |
| GET | `/api/device/commands` | jeton d'appareil (Bearer) | L'appareil récupère ses commandes confirmées ; il applique ensuite ses propres limites matérielles. |
| POST | `/api/device/ingest` | jeton d'appareil (Bearer) | Ingestion HTTPS des mesures par l'appareil (jeton propre à l'appareil). |
| GET | `/api/device/whoami` | jeton d'appareil (Bearer) | Identité de l'appareil porteur du jeton (utilisée par la passerelle MQTT pour authentifier une connexion). |

## devices

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| POST | `/api/devices/[id]/commands` | session | Commande initiée par une personne : proposée puis, si demandé et autorisé, confirmée par cette même personne. |
| POST | `/api/devices/[id]/estop` | session | Arrêt d'urgence logiciel : toujours disponible, sans confirmation. |
| GET | `/api/devices/[id]/measurements` | session |  |
| POST | `/api/devices/[id]/measurements` | session | Mesures relayées depuis le navigateur (Web Serial) par l'utilisateur connecté. |
| GET | `/api/devices/[id]` | session |  |
| PATCH | `/api/devices/[id]` | session | Modification (propriétaire) : capacités et durées maximales, environnement, état (désactiver = révoquer l'accès). |
| POST | `/api/devices/[id]/simulate` | session | Mesures SIMULÉES (démonstration) : marquées « simulated », affichées comme telles, exclues des rapports mesurés et ne déclenchant aucune automatisation. Les valeurs sont celles fournies par l'utilisateur. |
| POST | `/api/devices/[id]/token` | session | Nouveau jeton : l'ancien cesse immédiatement de fonctionner. |
| GET | `/api/devices` | session |  |
| POST | `/api/devices` | session | Enregistrement : le jeton n'est affiché qu'une fois ; seule son empreinte SHA-256 est conservée. |

## eco

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| POST | `/api/eco/[id]/links` | session |  |
| GET | `/api/eco/[id]` | session |  |
| PATCH | `/api/eco/[id]` | session | Propriétaire : publier / clore ; administrateur : modération (masquer / rétablir). |
| GET | `/api/eco` | session |  |
| POST | `/api/eco` | session |  |

## eco-links

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| PATCH | `/api/eco-links/[id]` | session | Réponse du propriétaire à une candidature, réservation ou mise en relation. Acceptée : coordonnées échangées (double consentement). |

## geo

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| GET | `/api/geo/climatology` | session |  |
| GET | `/api/geo/daily` | session |  |
| GET | `/api/geo/forecast` | session |  |

## health

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| GET | `/api/health` | public | Santé : base, secrets, mode IA. Aucune valeur secrète renvoyée. |

## i18n

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| GET | `/api/i18n/catalog` | public | Textes d'une langue nationale : UNIQUEMENT les traductions validées (jamais les brouillons ni les traductions automatiques non relues). |
| GET | `/api/i18n/entries` | session | Brouillons à relire (validateurs wolof et administrateurs). |
| PATCH | `/api/i18n/entries` | session | Validation ligne à ligne par un locuteur natif habilité (nom du validateur enregistré). |
| GET | `/api/i18n/export` | administrateur | Export de toutes les clés (référence française et anglaise, texte actuel, statut) pour les traducteurs. |
| POST | `/api/i18n/import` | administrateur | Import d'un fichier fourni par l'exploitant (décision du 16/11/2026) : les cellules remplies sont VALIDÉES automatiquement (« Fichier importé par l'administrateur », inscrit au journal), ou importées en brouillon à relire. Clés acceptées : clés de l'interface, et « gloss.<terme> » (glossaire scientifique). Paramètres {x} conservés obligatoirement. |

## market

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| POST | `/api/market/inquiries/[id]/messages` | session |  |
| GET | `/api/market/inquiries/[id]` | session | Fil d'une demande (réservé aux deux parties). |
| PATCH | `/api/market/inquiries/[id]` | session | Le vendeur accepte ou décline ; l'une ou l'autre partie clôt. Accepter n'engage aucun paiement via la plateforme. |
| GET | `/api/market/inquiries` | session | Mes demandes : envoyées (acheteur) et reçues (vendeur), avec le dernier message. |
| POST | `/api/market/listings/[id]/favorite` | session | Ajoute ou retire une annonce des favoris de l'utilisateur. |
| POST | `/api/market/listings/[id]/inquiries` | session | Demande d'un acheteur, avec un premier message au vendeur. Aucun engagement de paiement n'est pris par la plateforme. |
| POST | `/api/market/listings/[id]/report` | session | Signalement d'une annonce à la modération (une fois par utilisateur tant qu'il n'est pas traité). |
| GET | `/api/market/listings/[id]` | session | Détail d'une annonce : pour le vendeur, les demandes reçues ; pour un acheteur, sa demande en cours. |
| PATCH | `/api/market/listings/[id]` | session |  |
| DELETE | `/api/market/listings/[id]` | session | Suppression : uniquement sans demande reçue (sinon, retirer l'annonce pour garder l'historique des échanges). |
| GET | `/api/market/listings` | session | Parcours des annonces (visibles), de mes annonces (tous états) ou de mes favoris. Le sponsorisé est signalé, jamais caché. |
| POST | `/api/market/listings` | session |  |

## me

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| GET | `/api/me/mfa` | session |  |
| POST | `/api/me/mfa` | session | Activation (préparation puis vérification d'un premier code), désactivation et nouveaux codes de secours (mot de passe + code). |
| PATCH | `/api/me` | session |  |
| GET | `/api/me` | session | Export de toutes les données personnelles (portabilité). |
| DELETE | `/api/me` | session | Suppression du compte et de ses données (cascade). |

## normative-tables

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| GET | `/api/normative-tables` | administrateur | Tableaux normatifs saisis par un ingénieur depuis la norme achetée (référence et validateur obligatoires). |
| POST | `/api/normative-tables` | administrateur |  |

## notifications

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| GET | `/api/notifications` | session |  |
| POST | `/api/notifications` | session | Marquer comme lu (toutes ou une). |

## projects

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| POST | `/api/projects/[id]/members` | session | Inviter un utilisateur inscrit (par adresse) avec un rôle. |
| DELETE | `/api/projects/[id]/members` | session |  |
| GET | `/api/projects/[id]/messages` | session | Messagerie de projet (Collaborative Engineering). `after` : messages postérieurs (actualisation périodique). |
| POST | `/api/projects/[id]/messages` | session |  |
| GET | `/api/projects/[id]/report` | session | Rapport de projet : sections séparées par nature (calculé / simulé / mesuré), chaque élément avec sa source. |
| GET | `/api/projects/[id]` | session |  |
| PATCH | `/api/projects/[id]` | session |  |
| DELETE | `/api/projects/[id]` | session |  |
| POST | `/api/projects/[id]/tasks` | session |  |
| GET | `/api/projects` | session |  |
| POST | `/api/projects` | session |  |

## public

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| GET | `/api/public/certificates/[id]` | public | Vérification publique d'un certificat : recalcul de l'empreinte à partir des données enregistrées. |
| GET | `/api/public/portfolio/[id]` | public | Portfolio public : seulement si le titulaire l'a activé ; seuls les projets publics et les certificats figurent. |

## rc

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| POST | `/api/rc/sessions/[id]/end` | session |  |
| POST | `/api/rc/sessions/[id]/handover` | session | Transfert de contrôle vers un autre pilote disposant des mêmes habilitations requises (journalisé). |
| GET | `/api/rc/sessions/[id]` | session | Détail : journal, commandes de la session et télémétrie récente (mesures datées). |
| GET | `/api/rc/sessions` | session |  |
| POST | `/api/rc/sessions` | session | Ouverture d'une session : le mode est celui de l'appareil (virtuel, banc, réel) — une session ne change jamais de mode. Banc : habilitation banc ou opération réelle. Réel : habilitation « opération réelle », référence d'autorisation (et habilitation télépilote pour un drone). Check-list pré-opération entièrement cochée. |

## rooms

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| POST | `/api/rooms/[id]/join` | session | Rejoindre la salle du projet (membres uniquement) : renvoie l'identifiant de pair et les participants présents. |
| POST | `/api/rooms/[id]/leave` | session |  |
| GET | `/api/rooms/[id]/signal` | session | Relevé : présence (battement), participants, messages adressés à ce pair après `after`. |
| POST | `/api/rooms/[id]/signal` | session | Envoi d'une offre, d'une réponse ou d'un candidat ICE à un autre participant de la même salle. |

## rtc

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| GET | `/api/rtc/config` | session |  |

## schematics

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| GET | `/api/schematics/[id]` | session |  |
| PUT | `/api/schematics/[id]` | session | Enregistre une nouvelle version (le contrôle de version optimiste évite d'écraser une modification concurrente). |
| GET | `/api/schematics` | session |  |
| POST | `/api/schematics` | session |  |

## simulate

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| POST | `/api/simulate` | session |  |

## simulations

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| GET | `/api/simulations/[id]` | session |  |
| GET | `/api/simulations` | session |  |

## talents

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| GET | `/api/talents` | session | Recherche de talents : uniquement les profils rendus publics par leur titulaire (consentement), sur les compétences et réalisations. Aucun critère personnel sensible (âge, sexe, origine…) n'est stocké ni filtrable. |

## tasks

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| PATCH | `/api/tasks/[id]` | session |  |
| DELETE | `/api/tasks/[id]` | session |  |
