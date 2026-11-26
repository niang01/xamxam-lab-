# Conformité au cahier des charges général (25/11/2026)

Statuts utilisés (partie 20) :
- **Absent** ;
- **Présent mais non fonctionnel** ;
- **Partiellement fonctionnel** ;
- **Fonctionnel** ;
- **Testé et validé** : fonctionne et a été vérifié par des tests automatiques. Pour une installation réelle, il reste en plus à faire vérifier les résultats par une personne compétente.

Preuves : fichiers de tests du dépôt (`tests/unit`, `tests/integration`, `tests/e2e`) et `docs/RAPPORT_DE_TESTS.md`. Les volumes sont calculés depuis le code.

## Synthèse chiffrée

| Élément | Avant ce cahier des charges | Après |
|---|---|---|
| Composants de la bibliothèque | 190 | **397** (23 disciplines, 20 filières), sans doublon |
| Logiciels de dimensionnement | 0 (calculs isolés) | **7** : installation électrique, photovoltaïque, pompage, solaire thermique, séchage solaire, biomasse/biogaz, compostage |
| Générateurs de schémas | 9 | **10** (+ unifilaire de tableau électrique) |
| Banque de projets | 190, dont 100 IoT | **305**, dont **215 IoT** répartis dans **35 secteurs** |
| Programmes IoT compilés (PlatformIO, ESP32-S3) | 11 | 11 (réutilisés par les projets sectoriels) |
| Tests unitaires et d'intégration | 218 | **262** |
| Parcours de bout en bout (ordinateur et Pixel 7) | 17 | **19** |

## Partie 1 — Laboratoire Électricité et Électrotechnique

| Exigence | État initial | Travail réalisé | État final | Test effectué | Résultat | Limitation | Action restante |
|---|---|---|---|---|---|---|---|
| Nom « Électricité et Électrotechnique » | Electrical Lab | Renommé dans le menu, le panneau Aláji et les guides | Testé et validé | e2e `interface` | ✅ | — | — |
| Domestique : interrupteurs, va-et-vient, permutateurs, prises, points lumineux, boîtes, gaines, goulottes, chemins de câbles, conducteurs, protections, tableaux, compteurs, télérupteurs, minuteries… | 11 éléments | +30 types génériques avec paramètres et unités | Testé et validé | `espaces` (bibliothèque) | ✅ | Types génériques : les références de fabricant sont ajoutées avec leur fiche | Saisie de références réelles |
| Industriel : moteurs, contacteurs, relais thermiques, disjoncteurs moteurs, sectionneurs, démarreurs, variateurs, transformateurs, armoires, sécurité | Partiel | +16 types | Testé et validé | idem | ✅ | idem | idem |
| Domotique et automatismes : modules, capteurs, Zigbee, Z-Wave, entrées/sorties d'automate, détecteurs, distributeurs, passerelles Modbus, IHM | Partiel | +25 types | Testé et validé | idem | ✅ | idem | idem |
| Unifilaire, développé, puissance et commande | 4 générateurs | Unifilaire de tableau généré à partir de l'étude | Testé et validé | `schematics-gen`, `etudes` | ✅ | — | — |
| Multifilaire, plans d'installation, implantation | — | — | Absent | — | — | Aucun outil de plan coté | Développer un éditeur de plans |
| Dimensionnement des conducteurs et des protections, calculs, nomenclature, rapport | Calculs séparés | Logiciel « Installation électrique » : Ib, calibres normalisés, section par tableau normatif, chute de tension, appareil général, nomenclature, rapport PDF/Word/Excel | Testé et validé | `etudes` (valeurs recalculées à la main) | ✅ | Tableau normatif à saisir par un administrateur depuis la norme ; court-circuit non vérifié | Saisir le tableau en production |
| Simulation des circuits | ngspice (électronique) | — | Partiellement fonctionnel | `spice-i18n` | ✅ | Pas de simulation des installations de puissance | — |

## Parties 2 et 5 — Photovoltaïque et logiciels par discipline

| Exigence | État initial | Travail réalisé | État final | Test | Résultat | Limitation | Action restante |
|---|---|---|---|---|---|---|---|
| Bibliothèque PV : modules mono/poly/bifaciaux, batteries LiFePO4/AGM/GEL/plomb/NMC, BMS, onduleurs, régulateurs, protections DC, MC4, câbles, structures | 9 éléments | +20 types, paramètres de fiche (Voc, Vmp, Isc, coefficients…) | Testé et validé | `espaces` | ✅ | Aucune fiche de fabricant intégrée sans source | Références réelles |
| Lieu (pays, région, ville) avec autocomplétion, coordonnées GPS | — | Recherche Open-Meteo Geocoding (gratuite, sans clé), dès 2 lettres | Fonctionnel | `etudes` (fetch explicite) | ✅ | Non vérifié en production depuis cet environnement (réseau) | Vérification en production |
| Irradiation, température, orientation, inclinaison | Climatologie NASA POWER | Bouton NASA POWER ; plan incliné (Erbs, Liu-Jordan, Rb intégré) | Testé et validé | H0 de l'exemple 1.10.1 de Duffie & Beckman, Rb comparé à Klein | ✅ | Modèle mensuel (estimation) | — |
| Besoins, puissance crête, panneaux, batteries, autonomie, onduleur, régulateur, tensions et courants, chaînes, câbles, protections, production, pertes, rendement, schéma, nomenclature, rapport | Calculs séparés | Logiciel « Photovoltaïque » complet | Testé et validé | `etudes` (6 tests), e2e `dimensionnement` | ✅ | Schéma automatique pour les installations avec batteries | Générateur raccordé au réseau |
| Équipements de la bibliothèque → calculs | — | Choix d'une référence réelle : ses caractéristiques remplissent les champs | Fonctionnel | Revue du code et de l'interface | ✅ | Aucune référence réelle enregistrée aujourd'hui en production | Saisie de références |
| Un logiciel par discipline (25) | — | 7 logiciels complets + calculateurs existants (électronique, mécanique, froid, réseaux) | Partiellement fonctionnel | `etudes` | ✅ | Absents : génie civil, télécoms, robotique, drones, technologies médicales, informatique, automatisme, instrumentation | Prochains lots |

## Partie 3 — Laboratoire IoT et électronique

| Exigence | État initial | Travail réalisé | État final | Test | Résultat | Limitation | Action restante |
|---|---|---|---|---|---|---|---|
| Cartes : ESP32, S3, C3, CAM, ESP8266, Arduino Uno/Mega/Nano/Leonardo, Raspberry Pi/Pico/Pico W, STM32, XIAO, MKR WAN, contrôleur industriel | 8 | **17** cartes (faits constructeur et documentation) | Testé et validé | `espaces` | ✅ | Brochage et mémoire exacts : documentation officielle de chaque révision | — |
| Capteurs physiques, environnementaux, électriques, de localisation, industriels | ≈ 30 | **64** types | Testé et validé | `espaces` | ✅ | — | — |
| Actionneurs et affichage | ≈ 10 | **21** | Testé et validé | idem | ✅ | — | — |
| Communication : Wi-Fi, BLE, GSM, 4G, 5G, NB-IoT, LoRa, LoRaWAN, Zigbee, Z-Wave, RS232, RS485/Modbus, CAN, Ethernet, OPC UA, MQTT, HTTP, passerelles | Partiel | **18** modules + plateformes (MQTT, OPC UA, base de séries temporelles, tableau de bord) | Testé et validé | idem | ✅ | — | — |
| Éditeur de schémas électroniques, placement, rotation, fils, broches | Présent | — | Fonctionnel | e2e `espaces` | ✅ | — | — |
| Architecture IoT (capteur → passerelle → serveur → tableau de bord) | Générateur | Utilisé par les projets sectoriels | Fonctionnel | `schematics-gen` | ✅ | — | — |
| Programmation : éditeur, exemples, compilation | 11 programmes compilés hors ligne | — | Partiellement fonctionnel | `npm run bank:compile` (local) | ✅ | Pas d'éditeur ni de compilation en ligne | Éditeur de code et compilation à la demande |
| Simulation embarquée (programme + capteurs) | — | — | Absent | — | — | Aucun émulateur de microcontrôleur intégré | Étudier un émulateur libre |
| Tests réels sur carte (MQTT, agent série) | Présent | — | Testé et validé (passerelle) / À tester sur matériel réel | e2e `iot` | ✅ | Cartes réelles non branchées ici | Essais sur matériel |

## Partie 4 — Secteurs d'application de l'IoT

| Exigence | État initial | Travail réalisé | État final | Test | Résultat |
|---|---|---|---|---|---|
| 32 secteurs (agriculture, élevage, industrie, électricité, énergies, bâtiments, santé, hôpitaux, transports, logistique, commerce, villes, eau, pêche, environnement, mines, pétrole-gaz, télécoms, centres de données, éducation, sécurité, tourisme, tertiaire, recherche, réseaux intelligents, construction, froid, robotique, drones, grand public, ports-aéroports, déchets) + 3 secteurs supplémentaires (patrimoine et archives, sport, services publics) | IoT surtout agricole | **115 projets sectoriels** + 100 thématiques rattachés à un secteur ; filtre « Secteur » | Testé et validé | `banque` : 35 secteurs, au moins 2 projets chacun ; l'agriculture représente moins de 20 % des projets IoT |
| Sécurité IoT (partie 17) dans chaque projet | — | Authentification, chiffrement, mémoire tampon, journalisation, mises à jour ; essai de jeton invalide et de coupure | Testé et validé | `banque` |
| Applications critiques signalées comme prototypes | — | Avertissement dans les 11 secteurs critiques ; santé : « ni dispositif médical, ni diagnostic » ; vétérinaire ; ATEX ; drones | Testé et validé | `banque` |

Inventaire de la banque IoT par secteur : industrie 24, sécurité 18, eau 14, agriculture 14, énergies renouvelables 14, environnement 13, électricité 10, bâtiment 9, froid 8, recherche 8, robotique 8, élevage 5, transports 5, santé 4, ville 4, et 3 pour chacun des autres secteurs, sauf patrimoine, sport et services publics (2 chacun).
- Tous les projets IoT de la banque sont **complets** : 17 rubriques, sécurité, essais et pannes.
- 226 projets de la banque ont un programme d'exemple, compilé mais non essayé sur matériel réel.

## Parties 6 à 10 — Pompage, séchage, biomasse, compostage, solaire thermique

| Logiciel | État initial | État final | Test | Limitation |
|---|---|---|---|---|
| Pompage de A à Z : besoins, HMT, pertes de charge, point de fonctionnement, NPSH, électrique, groupe, solaire, schémas, nomenclature, rapport | Puissance seule | Testé et validé | `etudes` (Colebrook comparé à Haaland, point de fonctionnement exact, NPSH, solaire), e2e | Plan d'implantation et modèle 3D absents |
| Séchage solaire : direct, indirect, mixte, hybride, convection naturelle ou forcée | Absent | Testé et validé | `etudes` (bilan de masse, enthalpie conservée) | Cinétique de séchage non modélisée (essai nécessaire) ; plans de fabrication absents |
| Biomasse et biogaz : digesteur, biogaz, cogénération, digestat, combustion | Absent | Testé et validé | `etudes` | Potentiels méthanogènes saisis par l'utilisateur ; gazéification non modélisée |
| Compostage : C/N, humidité, andains, bacs, aération, calendrier | Absent | Testé et validé | `etudes` (ajustement exact du C/N) | Suivi en temps réel : via les projets IoT « compost » |
| Solaire thermique : besoins, capteurs (η0, a1, a2), couverture, ballon, circuit, économies | Absent | Testé et validé | `etudes` | Méthode mensuelle simplifiée ; thermosiphon non calculé |
| Bibliothèques associées : chambres, claies, capteurs à air, ventilateurs, digesteurs, gazomètres, brûleurs, torchères, composteurs, retourneurs, capteurs thermiques, ballons, circulateurs… | Absent | Testé et validé | `espaces` | — |

## Partie 11 — Conception automatique 2D/3D et plans

| Exigence | État final | Test | Limitation / action |
|---|---|---|---|
| Analyse de documents (PDF, Word, images, scans) | Fonctionnel (lot A) | `documents` | Extraction des images et lecture de plans ou de photos : **absent** |
| Génération de schémas | Testé et validé (10 générateurs) | `schematics-gen` | Plans mécaniques, de construction et vues éclatées : **absent** |
| Modèles 3D | Partiellement fonctionnel (maquette paramétrique) | e2e `espaces` | Pas de génération 3D à partir d'un document |
| Édition, annotation, légende, nomenclature, enregistrement | Fonctionnel | e2e | Cotation et calques : **absent** |
| Impression A4–A1, portrait/paysage, échelle, marges, cartouche (numéro, date, projet, concepteur), légende, aperçu, PDF | **Testé et validé** (nouveau) | `plans` (formats ISO exacts, cartouche), e2e | Échelle « ajustée à la feuille » (schémas sans cote réelle) |
| Formats SVG, PNG, PDF, DXF | **Testé et validé** (DXF R12 nouveau) | `plans` | DWG : **absent** (format propriétaire, pas d'outil libre fiable intégré) |

## Parties 12 et 13 — Projets et boutique

| Exigence | État final | Test | Limitation / action |
|---|---|---|---|
| Centaines de projets distincts | Fonctionnel : 305 projets | `banque` | Plusieurs disciplines ont moins de 10 projets ; dossier à 17 rubriques et non 35 |
| Progression (débutant → avancé), réalisés / en cours | Partiellement fonctionnel (favoris, réalisation en projet) | `banque` | Statut terminé/en cours par projet de la banque : à ajouter |
| 27 catégories de la boutique | Partiellement fonctionnel (15 rayons) | `boutique` | Ajouter les rayons manquants (Arduino, ESP32, batteries, pompes, laboratoire…) |
| Fiches, photos, stocks, prix réels, panier, commande, suivi | Testé et validé | `boutique`, e2e | Catalogue de production vide tant qu'aucun vendeur ne publie ; paiement en ligne et retours non intégrés |
| Connexion Alibaba / Amazon | Absent | — | Exige des interfaces et autorisations des fournisseurs |
| **Marème IA** : accueillir, rechercher, comparer, conseiller, panier, livraison, suivi des commandes, orientation vers le vendeur ou l'administrateur | **Testé et validé** (mode sans clé, données réelles uniquement) | `mareme` (4 tests), e2e `rubriques` | Rédaction libre : nécessite un fournisseur d'IA configuré |

## Parties 14 à 16 — Aláji IA, intégration, données

| Exigence | État final | Test | Limitation / action |
|---|---|---|---|
| Aláji dans chaque rubrique (panneau ✦ avec la rubrique ouverte) | Fonctionnel | e2e `interface` | — |
| Contexte d'une étude (résultats, alertes, données manquantes) transmis à Aláji, avec autorisation vérifiée | **Testé et validé** (nouveau) | `etudes` (refus pour un autre compte) | — |
| Modes spécialisés (26) | Partiellement fonctionnel (17 agents) | `alaji` | Agents à créer : séchage, biomasse, compostage, solaire thermique, IoT par secteur |
| Historique supprimable | **Testé et validé** (nouveau : une conversation ou tout l'historique, journalisé) | `alaji` | — |
| Parcours laboratoire → calcul → schéma → nomenclature → projet → boutique → Marème → Aláji | **Testé et validé** | `etudes`, e2e `dimensionnement` | — |
| Architecture des données (disciplines, composants, références, études, projets, boutique, IoT) | Fonctionnel | migrations 0001–0017 | — |
| Sauvegarde complète | **Corrigé** : 27 tables récentes manquaient (licences, boutique, documents, FAD…) ; ajoutées, essais et licences re-signés à la restauration | `backup` | — |

## Partie 17 — Sécurité IoT

Exigences de sécurité intégrées à chacun des 115 projets sectoriels et testées :
- authentification et jetons hors du code ;
- chiffrement ;
- mode dégradé en cas de perte de connexion ;
- journalisation ;
- mises à jour ;
- sauvegarde.

Aucun identifiant Wi-Fi, mot de passe ou jeton n'apparaît dans les programmes : ils sont remplacés par des emplacements à renseigner.

## Dépendances externes et coûts

| Dépendance | Usage | Coût | État |
|---|---|---|---|
| NASA POWER | Irradiation et températures mensuelles | Gratuit, sans clé | Intégré |
| Open-Meteo Geocoding | Recherche de lieux | Gratuit, sans clé | Intégré |
| Fournisseur d'IA (Anthropic ou compatible OpenAI) | Rédaction libre d'Aláji et de Marème | Payant | Non configuré (aucune dépense engagée) |
| Prestataire de paiement (mobile money, carte) | Paiement en ligne | Commissions | Non configuré ; paiement hors plateforme affiché |
| Fournisseurs Alibaba, Amazon | Catalogues externes | Accords et API | Non disponible |
| PlatformIO | Compilation des programmes | Gratuit | Utilisé hors ligne (pas de compilation en ligne) |
