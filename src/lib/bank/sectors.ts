/**
 * Banque IoT MULTISECTORIELLE (cahier des charges du 25/11/2026, partie 4) : 35 secteurs d'activité (les 32 demandés
 * + patrimoine et archives, sport et équipements collectifs, services publics), plusieurs projets distincts par secteur.
 * Composants : uniquement ceux de la bibliothèque. Programmes : ceux de la banque, compilés (PlatformIO).
 * Exigences de sécurité IoT (partie 17) ajoutées à chaque projet ; secteurs critiques : avertissement « prototype
 * pédagogique non certifié ». Aucun seuil, prix ni mesure n'est fixé à la place de l'utilisateur.
 */
import type { CodeKey } from "./codes";
import { derivedFaults, derivedTests, STEPS, type BankLevel, type BankProject } from "./types";

export interface Sector { key: string; label: string; critical: boolean; note?: string }
export const SECTORS: Sector[] = [
  { key: "agriculture", label: "Agriculture et agro-industrie", critical: false },
  { key: "elevage", label: "Élevage et santé animale", critical: false, note: "Outil de suivi et d'assistance : ne remplace pas le diagnostic vétérinaire." },
  { key: "industrie", label: "Industrie et usine intelligente", critical: true },
  { key: "electricite", label: "Électricité et électrotechnique", critical: true },
  { key: "enr", label: "Énergies renouvelables", critical: false },
  { key: "batiment", label: "Bâtiments et domotique", critical: false },
  { key: "sante", label: "Santé et secteur médical", critical: true, note: "Prototype pédagogique : ni dispositif médical certifié, ni outil de diagnostic ; confidentialité des données de santé obligatoire." },
  { key: "hopitaux", label: "Hôpitaux et établissements de santé", critical: true, note: "Prototype pédagogique : validation par le service biomédical et la direction technique avant tout usage réel." },
  { key: "transport", label: "Transports et mobilité", critical: true },
  { key: "logistique", label: "Logistique, entrepôts et chaîne d'approvisionnement", critical: false },
  { key: "commerce", label: "Commerce et grande distribution", critical: false },
  { key: "ville", label: "Villes intelligentes et collectivités", critical: false },
  { key: "eau", label: "Eau, assainissement et hydraulique", critical: false },
  { key: "peche", label: "Pêche, aquaculture et ressources marines", critical: false },
  { key: "environnement", label: "Environnement et climat", critical: false },
  { key: "mines", label: "Mines et carrières", critical: true },
  { key: "petrole_gaz", label: "Pétrole, gaz et installations énergétiques", critical: true, note: "Atmosphères explosives : seul un matériel certifié (ATEX/IECEx) est admis sur site ; ce projet est un prototype de laboratoire." },
  { key: "telecom", label: "Télécommunications et réseaux informatiques", critical: false },
  { key: "datacenter", label: "Centres de données et informatique", critical: false },
  { key: "education", label: "Éducation et formation", critical: false },
  { key: "securite", label: "Sécurité des personnes et des biens", critical: true, note: "Données personnelles et images : information des personnes et règles de protection des données applicables." },
  { key: "tourisme", label: "Hôtels, restaurants et tourisme", critical: false },
  { key: "tertiaire", label: "Banques, bureaux et bâtiments tertiaires", critical: false },
  { key: "recherche", label: "Laboratoires et recherche scientifique", critical: false },
  { key: "smart_grid", label: "Énergies et réseaux électriques intelligents", critical: true },
  { key: "construction", label: "Construction et génie civil", critical: true },
  { key: "froid", label: "Froid, climatisation et installations thermiques", critical: false },
  { key: "robotique", label: "Robotique et systèmes autonomes", critical: false },
  { key: "drones", label: "Drones et systèmes aériens", critical: true, note: "Aucun pilotage réel sans intégration matérielle validée et autorisation de vol ; télémétrie uniquement." },
  { key: "grand_public", label: "Équipements ménagers et objets grand public", critical: false },
  { key: "ports_aeroports", label: "Ports, aéroports et infrastructures de transport", critical: true },
  { key: "dechets", label: "Déchets et économie circulaire", critical: false },
  { key: "patrimoine", label: "Patrimoine, musées et archives", critical: false },
  { key: "sport", label: "Sport et équipements collectifs", critical: false },
  { key: "services_publics", label: "Administration et services publics", critical: false },
];

/** Exigences de sécurité et de fiabilité IoT (partie 17), reprises dans chaque projet. */
export const IOT_SECURITY = [
  "Authentification de l'appareil par jeton propre (jamais partagé) ; Wi-Fi, mots de passe et jetons hors du code publié",
  "Communications chiffrées (HTTPS/TLS ou MQTT sur TLS) ; autorisations par appareil",
  "Mémoire tampon locale et fonctionnement dégradé en cas de perte de connexion ; reprise automatique",
  "Journalisation des mesures, commandes et alarmes ; surveillance des anomalies",
  "Mises à jour du programme documentées ; sauvegarde des données ; gestion de l'énergie et de la mémoire",
];

const C: Record<string, string> = {
  E: "Carte ESP32", S3: "ESP32-S3 DevKit", C3: "ESP32-C3 DevKit", UNO: "Carte Arduino (famille Uno)", MEGA: "Carte Arduino Mega", PICO: "Raspberry Pi Pico W", RPI: "Raspberry Pi", MKR: "Arduino MKR WAN 1310", CAM: "ESP32-CAM",
  TH: "Capteur de température et d'humidité de l'air", TS: "Sonde de température étanche", SOIL: "Capteur d'humidité du sol capacitif", FLOW: "Débitmètre à effet Hall", US: "Capteur de niveau à ultrasons", FLT: "Capteur de niveau à flotteur",
  PR: "Capteur de pression", CUR: "Capteur de courant", LUX: "Capteur de luminosité", GAS: "Capteur de gaz", PIR: "Détecteur de mouvement infrarouge", GPS: "Module GNSS", PH: "Capteur de pH",
  REL: "Module relais", BUZ: "Buzzer", LORA: "Module LoRa", GSM: "Module GSM/4G", VIB: "Capteur de vibration (accéléromètre)", IMU: "Accéléromètre et gyroscope (centrale inertielle)",
  RFID: "Lecteur RFID 13,56 MHz", UHF: "Lecteur RFID UHF", BLE: "Balise Bluetooth LE", ILS: "Contact d'ouverture magnétique (ILS)", CO2: "Capteur de CO2 (NDIR)", PM: "Capteur de particules fines (PM2,5 / PM10)",
  CO: "Capteur de monoxyde de carbone (CO)", VOC: "Capteur de qualité de l'air (COV)", SMK: "Capteur de fumée optique", RAIN: "Capteur de pluie", SND: "Capteur de niveau sonore", NTU: "Capteur de turbidité",
  EC: "Capteur de conductivité (TDS / EC)", DO: "Capteur d'oxygène dissous", ORP: "Capteur de potentiel redox (ORP)", EM: "Module de mesure d'énergie monophasé", CT: "Pince ampèremétrique non invasive (TC)",
  VS: "Capteur de tension continue (diviseur)", INA: "Moniteur de courant et tension I2C", LOAD: "Capteur de force (jauge de contrainte)", HX: "Amplificateur de pesée (HX711)", HALL: "Capteur à effet Hall (magnétisme)",
  TOF: "Capteur de distance laser (temps de vol)", SSR: "Relais statique (SSR)", GACHE: "Gâche électrique", OLED: "Écran OLED I2C", LCD: "Afficheur LCD 16×2 I2C", FAN: "Ventilateur 12 V", PUMP: "Pompe à eau 12 V",
  LED: "Ruban LED adressable", RS485: "Convertisseur RS485 (MAX485)", CAN: "Contrôleur et transceiver CAN", ETH: "Module Ethernet (W5500)", ROUTER: "Routeur 4G industriel", NB: "Module NB-IoT / LTE-M",
  BAT: "Batterie Li-ion 18650", CHG: "Chargeur de batterie Li-ion (module)", PV: "Module photovoltaïque", BUCK: "Convertisseur abaisseur (buck)", MQTT: "Courtier MQTT", DASH: "Tableau de bord de supervision",
  TSDB: "Base de données de séries temporelles", RG: "Pluviomètre à augets", ANEMO: "Anémomètre", PYR: "Capteur de rayonnement solaire (pyranomètre)", RTC: "Module horloge temps réel", SD: "Lecteur de carte microSD",
  ENC: "Codeur rotatif", MOT: "Moteur à courant continu (petit)", DRV: "Driver de moteur DC double pont en H", SERVO: "Servomoteur", BARO: "Capteur de pression atmosphérique (baromètre)", PT100: "Sonde Pt100",
  TX: "Transmetteur 4-20 mA", EV: "Électrovanne", QR: "Lecteur de codes-barres / QR", EPD: "Écran e-paper", LIN: "Actionneur linéaire électrique", GW: "Passerelle LoRaWAN", OPC: "Serveur OPC UA", MB: "Passerelle Modbus RTU / TCP",
};

type Def = [title: string, level: BankLevel, comps: string, code: CodeKey, problem: string, expected: string];
const P = (sector: string, defs: Def[], apps: string[], improvements: string[]) => ({ sector, defs, apps, improvements });

const DATA = [
  P("agriculture", [
    ["Surveillance de la salinité des parcelles irriguées", "technicien", "E SOIL EC TS LORA", "telemetry_http", "La salinité monte dans les parcelles irriguées sans que l'exploitant le voie avant la baisse de rendement.", "Carte de conductivité et d'humidité des parcelles, mise à jour chaque jour."],
    ["Fertigation : dosage asservi à la conductivité", "ingenieur", "E EC PH FLOW REL EV", "threshold_relay", "Les doses d'engrais injectées dans l'eau d'irrigation sont réglées à l'estime.", "Injection coupée dès que la conductivité dépasse la consigne fixée par l'agronome."],
    ["Silo connecté : température et humidité des céréales", "technicien", "E TS TH LORA", "ntc_temperature", "Les échauffements dans les silos sont découverts trop tard (moisissures, insectes).", "Profil de température par sonde et alerte d'échauffement."],
    ["Géolocalisation et heures moteur des tracteurs", "intermediaire", "E GPS CUR GSM", "telemetry_http", "Les heures de fonctionnement et la position des machines partagées ne sont pas suivies.", "Trajets et heures moteur enregistrés pour planifier l'entretien."],
  ], ["Exploitations irriguées", "Coopératives agricoles", "Silos de stockage"], ["Prévisions météo intégrées (prédictions affichées comme telles)", "Tableau de bord par parcelle"]),
  P("elevage", [
    ["Collier GNSS de suivi de troupeau", "ingenieur", "MKR GPS IMU BAT CHG", "telemetry_http", "Les troupeaux en transhumance s'éloignent et des animaux sont perdus.", "Positions transmises par LoRaWAN avec une autonomie mesurée sur batterie."],
    ["Abreuvoir connecté : niveau et consommation d'eau", "intermediaire", "E FLT FLOW REL EV", "pulse_counter", "Les abreuvoirs vides ou qui débordent ne sont pas détectés à temps.", "Volume consommé par jour et remplissage automatique."],
    ["Couveuse : température, humidité et retournement", "technicien", "E TH SSR SERVO OLED", "threshold_relay", "Les taux d'éclosion varient avec les dérives de température de la couveuse.", "Température et humidité tenues autour des consignes saisies, retournement périodique."],
    ["Poulailler : ambiance (NH3, CO2, température)", "technicien", "E TH CO2 GAS FAN REL", "threshold_relay", "L'ammoniac et la chaleur dégradent la santé des volailles.", "Ventilation commandée par les mesures et historique d'ambiance."],
    ["Pesée connectée des animaux", "intermediaire", "E LOAD HX RFID OLED", "telemetry_http", "Les pesées manuelles sont rares et non enregistrées.", "Poids horodatés par animal (identification RFID)."],
  ], ["Élevages bovins, ovins, avicoles", "Couvoirs"], ["Détection de comportements inhabituels à partir des données (avec données suffisantes)", "Alimentation automatique"]),
  P("industrie", [
    ["Comptage de production et temps de cycle", "technicien", "E HALL OLED ETH", "pulse_counter", "La cadence réelle d'une ligne n'est connue qu'en fin de poste.", "Pièces produites, cadence et temps de cycle en temps réel."],
    ["Suivi des arrêts machines (TRS)", "ingenieur", "E CT ETH DASH TSDB", "current_monitor", "Les micro-arrêts ne sont pas enregistrés et le TRS est estimé.", "Durées de marche/arrêt calculées à partir du courant moteur."],
    ["Surveillance de compresseur d'air", "technicien", "E PR TS CT RS485", "telemetry_http", "Les fuites et surchauffes de compresseur coûtent de l'énergie et des pannes.", "Pression, température et courant historisés ; alerte de dérive."],
    ["Passerelle Modbus vers supervision", "ingenieur", "E RS485 MB MQTT DASH", "telemetry_http", "Les compteurs et variateurs Modbus de l'atelier ne sont pas centralisés.", "Valeurs Modbus publiées vers la supervision (lecture seule)."],
  ], ["Ateliers de production", "PME industrielles"], ["Maintenance prédictive (avec historique suffisant)", "Jumeau numérique (données et modèles validés requis)"]),
  P("electricite", [
    ["Compteur divisionnaire connecté", "technicien", "E EM OLED", "telemetry_http", "La consommation par départ d'un bâtiment n'est pas connue.", "Énergie par départ, puissance, facteur de puissance."],
    ["Surveillance des déséquilibres triphasés", "ingenieur", "E CT CT CT ETH", "current_monitor", "Un déséquilibre de charge provoque des échauffements du neutre.", "Courants des trois phases et taux de déséquilibre calculé."],
    ["Détection de surtension et de sous-tension", "technicien", "E EM REL BUZ", "threshold_relay", "Les variations de tension du réseau endommagent les équipements.", "Déconnexion des charges sensibles hors de la plage fixée par l'exploitant."],
    ["Surveillance d'un groupe électrogène", "technicien", "E VS TS FLT GSM", "telemetry_http", "Les pannes de groupe (batterie, carburant, surchauffe) sont découvertes lors d'une coupure.", "Tension batterie, niveau de carburant, température et état transmis."],
    ["Délestage intelligent de charges", "ingenieur", "E EM REL REL", "threshold_relay", "La puissance souscrite est dépassée aux heures de pointe.", "Charges non prioritaires coupées selon les priorités et la puissance mesurée."],
  ], ["Bâtiments", "Petites industries", "Sites isolés"], ["Télérelève vers le gestionnaire (si autorisé)", "Analyse des harmoniques (instrument adapté)"]),
  P("enr", [
    ["Surveillance de chaînes photovoltaïques", "technicien", "E INA INA LORA", "telemetry_http", "Une chaîne PV défaillante passe inaperçue dans une installation de plusieurs chaînes.", "Courant de chaque chaîne comparé aux autres ; alerte d'écart."],
    ["Mesure de l'état de charge de batteries", "technicien", "E INA TS OLED", "battery_monitor", "Les batteries sont déchargées trop profondément faute de mesure.", "Tension, courant, énergie entrée/sortie et température des batteries."],
    ["Petite éolienne : vent, vitesse et production", "ingenieur", "E ANEMO HALL INA", "pulse_counter", "Le productible réel d'une petite éolienne est inconnu.", "Courbe production-vent établie à partir des mesures."],
    ["Station de référence PV (rayonnement, température)", "recherche", "E PYR TS TH SD", "telemetry_http", "On ne peut pas comparer la production réelle à la ressource solaire du site.", "Rayonnement et températures pour calculer le ratio de performance réel."],
  ], ["Mini-réseaux", "Centrales solaires", "Sites isolés"], ["Gestion d'un système hybride (avec autorisations)", "Détection automatique des salissures"]),
  P("batiment", [
    ["Volets roulants pilotés par la luminosité", "intermediaire", "E LUX REL REL", "threshold_relay", "Les pièces surchauffent l'après-midi faute de fermeture des volets.", "Fermeture automatique au-dessus du seuil de luminosité fixé."],
    ["Détection de fuite d'eau avec coupure", "technicien", "E RAIN EV BUZ", "alarm_inputs", "Une fuite sous un évier inonde le logement en l'absence des occupants.", "Électrovanne fermée et alerte à la détection d'eau."],
    ["Qualité de l'air intérieur (CO2, COV)", "intermediaire", "E CO2 VOC TH OLED", "telemetry_http", "Les salles fermées deviennent mal ventilées sans que personne ne s'en rende compte.", "Indicateur de confinement et historique de qualité de l'air."],
    ["Régulation de climatisation par présence", "technicien", "E PIR TH REL", "threshold_relay", "La climatisation fonctionne dans des pièces vides.", "Climatisation coupée après une absence prolongée (durée réglable)."],
  ], ["Logements", "Bureaux", "Hôtels"], ["Commande vocale locale", "Gestion énergétique globale du bâtiment"]),
  P("sante", [
    ["Réfrigérateur de vaccins : chaîne du froid", "technicien", "E TS TS GSM BUZ", "ntc_temperature", "Les ruptures de chaîne du froid des vaccins sont découvertes après coup.", "Températures enregistrées en continu, alerte au-delà de la plage fixée par le responsable."],
    ["Salle de stockage des médicaments : température et humidité", "intermediaire", "E TH SD RTC", "telemetry_http", "Les conditions de stockage ne sont pas tracées.", "Registre horodaté de température et d'humidité."],
    ["Appel malade connecté (prototype)", "technicien", "E LED BUZ", "alarm_inputs", "Les appels des patients ne sont pas tracés ni hiérarchisés.", "Appel horodaté transmis au poste de soins, acquittement tracé."],
    ["Suivi de l'alimentation électrique d'équipements médicaux", "ingenieur", "E CT EM GSM", "current_monitor", "Les coupures d'alimentation des équipements ne sont pas tracées.", "Historique des coupures et des consommations par équipement."],
  ], ["Centres de santé", "Pharmacies", "Laboratoires"], ["Intégration au système d'information (avec validation)", "Traçabilité réglementaire"]),
  P("hopitaux", [
    ["Localisation des fauteuils roulants et du matériel", "ingenieur", "E BLE BLE MQTT", "telemetry_http", "Le personnel perd du temps à chercher le matériel mobile.", "Dernière zone de détection de chaque équipement."],
    ["Surveillance de la salle des groupes électrogènes", "technicien", "E TH VS FLT GSM", "telemetry_http", "Les défauts des groupes de secours ne sont pas vus avant leur besoin.", "État, carburant, température et tension batterie transmis."],
    ["Chambre froide de la morgue ou de la banque de sang", "technicien", "E TS TS ILS GSM", "ntc_temperature", "Les ouvertures prolongées et dérives de température ne sont pas détectées.", "Température et durée d'ouverture de porte tracées, alerte."],
  ], ["Hôpitaux", "Cliniques"], ["Maintenance assistée par les données", "Gestion énergétique des bâtiments hospitaliers"]),
  P("transport", [
    ["Gestion de flotte : position et kilométrage", "technicien", "E GPS GSM", "telemetry_http", "Les déplacements des véhicules de service ne sont pas suivis.", "Trajets, kilométrage et temps d'arrêt par véhicule (règles de confidentialité respectées)."],
    ["Surveillance de batterie et de température moteur", "technicien", "E VS TS GSM", "battery_monitor", "Les pannes de batterie immobilisent les véhicules.", "Tension de batterie au repos et au démarrage suivie, alerte de dérive."],
    ["Comptage de passagers d'un bus", "ingenieur", "E TOF TOF GPS GSM", "pulse_counter", "Le taux de remplissage des lignes est inconnu.", "Montées et descentes par arrêt (estimation à valider)."],
    ["Parking : détection des places libres", "intermediaire", "E US LORA LED", "ultrasonic_level", "Les conducteurs tournent pour trouver une place.", "Occupation de chaque place affichée et transmise."],
    ["Borne de recharge : suivi de l'énergie délivrée", "ingenieur", "E EM RFID ETH", "telemetry_http", "L'énergie délivrée par borne et par utilisateur n'est pas tracée.", "Sessions de charge horodatées par badge."],
  ], ["Flottes d'entreprise", "Transports publics", "Parkings"], ["Optimisation des itinéraires", "Interface avec le bus CAN du véhicule (selon autorisations)"]),
  P("logistique", [
    ["Conteneur frigorifique : température et ouverture", "technicien", "E TS ILS GPS GSM", "telemetry_http", "Les ruptures de chaîne du froid pendant le transport sont contestées.", "Température, position et ouvertures horodatées tout le trajet."],
    ["Inventaire RFID des palettes", "ingenieur", "RPI UHF ETH", "telemetry_http", "Les inventaires manuels sont longs et erronés.", "Palettes détectées aux portes de quai et stock mis à jour."],
    ["Quai de chargement : occupation et durée", "intermediaire", "E TOF LED ETH", "ultrasonic_level", "L'attente des camions aux quais n'est pas mesurée.", "Taux d'occupation et durée de chargement par quai."],
  ], ["Entrepôts", "Transporteurs", "Chaînes du froid"], ["Prévision des retards", "Traçabilité de bout en bout"]),
  P("commerce", [
    ["Congélateurs du magasin : alarme de température", "intermediaire", "E TS TS BUZ GSM", "ntc_temperature", "Une panne de congélateur la nuit fait perdre la marchandise.", "Alerte en cas de dérive et historique pour l'hygiène alimentaire."],
    ["Comptage de fréquentation", "intermediaire", "E TOF OLED", "pulse_counter", "Les horaires d'affluence ne sont pas connus pour adapter le personnel.", "Entrées par heure et par jour."],
    ["Rayonnage connecté : détection de rupture", "ingenieur", "E LOAD HX LORA", "telemetry_http", "Les ruptures de stock en rayon sont vues tardivement.", "Masse en rayon transmise, alerte au-dessous du seuil fixé."],
  ], ["Supérettes", "Grandes surfaces", "Boutiques"], ["Étiquettes électroniques", "Gestion énergétique du magasin"]),
  P("ville", [
    ["Bac à ordures connecté : taux de remplissage", "intermediaire", "E US LORA BAT", "ultrasonic_level", "Les tournées de collecte passent devant des bacs vides et oublient les pleins.", "Taux de remplissage de chaque bac pour optimiser les tournées."],
    ["Lampadaire intelligent : commande et consommation", "technicien", "E LUX PIR EM REL", "threshold_relay", "L'éclairage public fonctionne à pleine puissance toute la nuit.", "Allumage selon la luminosité et la présence ; consommation mesurée."],
    ["Station de bruit urbain", "intermediaire", "E SND LORA", "telemetry_http", "Les plaintes pour bruit ne s'appuient sur aucune mesure.", "Niveaux sonores relatifs horodatés (mesure indicative, non réglementaire)."],
    ["Surveillance de crue d'un canal", "technicien", "E US RG GSM", "ultrasonic_level", "Les débordements des canaux surprennent les riverains.", "Niveau d'eau et pluie transmis ; alerte de montée."],
  ], ["Communes", "Quartiers", "Collectivités"], ["Plateforme de données ouvertes", "Optimisation des tournées par calcul"]),
  P("eau", [
    ["Télérelève de compteurs d'eau", "technicien", "E FLOW LORA", "pulse_counter", "Les relevés manuels des compteurs sont rares et erronés.", "Index transmis chaque jour, détection de consommation nocturne anormale."],
    ["Détection de fuite par pression du réseau", "ingenieur", "E PR PR GSM", "telemetry_http", "Les ruptures de conduite ne sont signalées que par les usagers.", "Chute de pression détectée et localisée entre deux capteurs."],
    ["Qualité de l'eau : pH, turbidité, conductivité", "technicien", "E PH NTU EC LORA", "telemetry_http", "La qualité de l'eau distribuée n'est contrôlée qu'occasionnellement.", "Mesures continues (indicatives, à confirmer par analyses de laboratoire)."],
    ["Station de pompage télégérée", "ingenieur", "E CT FLT PR GSM REL", "threshold_relay", "Les stations de pompage isolées tombent en panne sans alerte.", "État des pompes, niveaux et pression ; commandes confirmées par une personne."],
  ], ["Régies et sociétés de l'eau", "Forages villageois", "Stations d'épuration"], ["Modélisation hydraulique du réseau", "Suivi de la chloration (instrumentation dédiée)"]),
  P("peche", [
    ["Bassin piscicole : oxygène dissous et aération", "technicien", "E DO TS REL", "threshold_relay", "Les poissons meurent par manque d'oxygène la nuit.", "Aérateur commandé par l'oxygène dissous et la température."],
    ["Pirogue connectée : position et alerte", "ingenieur", "E GPS GSM BUZ BAT", "telemetry_http", "Les familles ne savent pas où se trouvent les pirogues en cas d'incident.", "Positions transmises et bouton d'alerte (couverture du réseau à vérifier)."],
    ["Chambre froide de débarquement", "technicien", "E TS TS ILS GSM", "ntc_temperature", "Le poisson se dégrade dans des chambres froides mal surveillées.", "Températures et ouvertures tracées ; alerte."],
  ], ["Piscicultures", "Quais de pêche", "Mareyeurs"], ["Alimentation automatique des poissons", "Prévisions de conditions marines (prédictions)"]),
  P("environnement", [
    ["Station de qualité de l'air extérieur", "technicien", "E PM CO2 TH LORA", "telemetry_http", "La pollution aux particules n'est pas mesurée près des écoles.", "Concentrations de particules (capteur à faible coût, à comparer à une station de référence)."],
    ["Détection précoce de feux de végétation", "ingenieur", "E SMK TH GAS LORA PV", "alarm_inputs", "Les feux de brousse sont détectés tardivement.", "Alerte de fumée et de hausse rapide de température (prototype à valider sur site)."],
    ["Suivi de l'érosion côtière (distance au trait de côte)", "recherche", "E TOF GPS SD", "telemetry_http", "Le recul du trait de côte n'est pas mesuré régulièrement.", "Série temporelle de distances et positions."],
  ], ["Collectivités", "Parcs naturels", "Observatoires"], ["Fusion avec les données satellitaires (Earth)", "Réseau de stations maillé"]),
  P("mines", [
    ["Détection de gaz dans une galerie (prototype)", "ingenieur", "E GAS CO LORA BUZ", "alarm_inputs", "Les accumulations de gaz sont détectées trop tard.", "Alerte locale et à distance (instrument certifié obligatoire sur site réel)."],
    ["Surveillance vibratoire d'un convoyeur", "ingenieur", "E VIB CT RS485", "vibration_rms", "Les ruptures de convoyeur arrêtent la production.", "Niveau vibratoire et courant suivis ; alerte de dérive."],
    ["Niveau d'eau d'exhaure", "technicien", "E US REL GSM", "ultrasonic_level", "La montée des eaux d'exhaure menace les engins.", "Niveau transmis et pompe commandée par seuils."],
  ], ["Carrières", "Mines"], ["Géolocalisation des engins", "Gestion énergétique de la ventilation"]),
  P("petrole_gaz", [
    ["Mesure de niveau de cuve de carburant (prototype hors zone ATEX)", "technicien", "E US GSM", "ultrasonic_level", "Les ruptures de carburant des groupes électrogènes surprennent les exploitants.", "Niveau et consommation estimée transmis."],
    ["Surveillance de pression de pipeline (maquette)", "ingenieur", "E TX PR LORA", "telemetry_http", "Les chutes de pression ne sont pas corrélées aux incidents.", "Pression enregistrée et alerte de chute (maquette de laboratoire)."],
    ["Surveillance d'un compresseur de gaz (maquette)", "ingenieur", "E VIB TS CT", "vibration_rms", "Les défauts de compresseur sont détectés lors de la panne.", "Vibration, température et courant historisés."],
  ], ["Dépôts", "Stations-service", "Laboratoires de formation"], ["Interface avec les automates de sécurité (homologués)", "Télégestion"]),
  P("telecom", [
    ["Site radio isolé : énergie et température de baie", "technicien", "E VS TH GSM", "telemetry_http", "Les pannes d'énergie des sites radio isolés provoquent des coupures de réseau.", "Tension batterie, température et ouverture de porte transmises."],
    ["Supervision de liaisons (disponibilité)", "intermediaire", "RPI ETH TSDB DASH", "telemetry_http", "Les coupures de liaison ne sont pas mesurées.", "Taux de disponibilité par liaison et alertes."],
    ["Onduleur et batteries de secours d'un local réseau", "technicien", "E INA TS ETH", "battery_monitor", "L'autonomie réelle des batteries de secours est inconnue.", "Courbe de décharge mesurée lors des coupures."],
  ], ["Opérateurs", "Entreprises", "Campus"], ["Supervision SNMP centralisée", "Prévision de fin de vie des batteries"]),
  P("datacenter", [
    ["Températures en entrée et sortie de baie", "technicien", "E TS TS TS ETH", "ntc_temperature", "Des points chauds apparaissent dans la salle serveurs.", "Cartographie des températures des baies."],
    ["Détection d'eau sous plancher technique", "intermediaire", "E RAIN BUZ ETH", "alarm_inputs", "Une fuite de climatisation sous le plancher peut détruire les équipements.", "Alerte immédiate et localisation de la zone."],
    ["Accès à la salle serveurs par badge", "technicien", "E RFID GACHE ILS", "access_control", "Les accès à la salle serveurs ne sont pas tracés.", "Journal des accès et alerte de porte restée ouverte."],
  ], ["Centres de données", "Salles informatiques"], ["Indicateur d'efficacité énergétique (PUE)", "Corrélation charge / température"]),
  P("education", [
    ["Salle de classe intelligente (CO2, lumière, présence)", "intermediaire", "E CO2 LUX PIR REL", "threshold_relay", "Les salles sont mal ventilées et l'éclairage reste allumé après les cours.", "Alerte d'aération et extinction après absence."],
    ["Banc d'essai connecté pour TP d'électricité", "technicien", "E EM INA OLED", "telemetry_http", "Les mesures de TP sont recopiées à la main.", "Mesures horodatées exportées vers le compte rendu."],
    ["Suivi des équipements pédagogiques (RFID)", "intermediaire", "E RFID OLED", "access_control", "Le matériel prêté aux élèves n'est pas tracé.", "Registre des prêts et retours."],
  ], ["Écoles", "Lycées techniques", "Universités"], ["Tableau de bord de l'établissement", "Kits pédagogiques connectés"]),
  P("securite", [
    ["Alarme intrusion connectée", "technicien", "E PIR ILS BUZ GSM", "alarm_inputs", "Les cambriolages de locaux ne sont signalés qu'au matin.", "Alerte immédiate avec temporisation d'entrée et de sortie."],
    ["Caméra de détection de présence (prototype)", "ingenieur", "CAM PIR", "telemetry_http", "Les zones de stockage isolées ne sont pas surveillées.", "Image capturée lors d'une détection (information des personnes obligatoire)."],
    ["Bouton d'alerte pour travailleur isolé", "intermediaire", "E GPS GSM BUZ BAT", "alarm_inputs", "Un travailleur isolé ne peut pas appeler à l'aide rapidement.", "Alerte avec position transmise (couverture réseau à vérifier)."],
  ], ["Entreprises", "Logements", "Chantiers"], ["Vérification d'alarme à distance", "Intégration aux secours (protocoles officiels)"]),
  P("tourisme", [
    ["Chambre d'hôtel : climatisation coupée à l'ouverture de fenêtre", "intermediaire", "E ILS PIR REL", "threshold_relay", "La climatisation fonctionne fenêtres ouvertes.", "Climatisation coupée à l'ouverture et en l'absence du client."],
    ["Cuisine de restaurant : températures des chambres froides", "intermediaire", "E TS TS OLED", "ntc_temperature", "Le registre HACCP des températures est rempli à la main.", "Registre automatique et alertes."],
    ["Piscine : pH et température de l'eau", "technicien", "E PH ORP TS", "telemetry_http", "Les dérives de traitement de l'eau ne sont vues qu'aux contrôles.", "pH, potentiel redox et température suivis (indicatif)."],
  ], ["Hôtels", "Restaurants", "Campements"], ["Gestion énergétique de l'établissement", "Consommation d'eau par chambre"]),
  P("tertiaire", [
    ["Salle des onduleurs d'une agence", "technicien", "E TH INA ETH", "telemetry_http", "Les onduleurs vieillissants ne sont pas surveillés.", "Températures et état des batteries suivis."],
    ["Occupation des salles de réunion", "intermediaire", "E PIR CO2 OLED", "telemetry_http", "Les salles réservées restent vides.", "Taux d'occupation réel par salle."],
    ["Éclairage des bureaux selon la lumière du jour", "intermediaire", "E LUX PIR SSR", "threshold_relay", "L'éclairage reste allumé en plein jour.", "Éclairage modulé selon la lumière naturelle et la présence."],
  ], ["Banques", "Bureaux", "Administrations"], ["Gestion technique centralisée", "Facturation énergétique par étage"]),
  P("recherche", [
    ["Enregistreur multivoies pour expériences", "recherche", "E TS TS TH SD RTC", "telemetry_http", "Les expériences longues sont suivies par relevés manuels.", "Données horodatées exportables en CSV."],
    ["Incubateur de laboratoire régulé", "technicien", "E TS SSR FAN OLED", "threshold_relay", "Les dérives de température faussent les cultures.", "Température tenue autour de la consigne et tracée."],
    ["Chambre climatique : humidité et température", "ingenieur", "E TH SSR FAN REL", "threshold_relay", "Les essais de vieillissement exigent des conditions stables.", "Conditions enregistrées pendant tout l'essai."],
  ], ["Laboratoires universitaires", "Centres de recherche"], ["Plan d'expérience automatisé", "Publication des données (FAIR)"]),
  P("smart_grid", [
    ["Micro-réseau : bilan production/consommation", "ingenieur", "E EM INA LORA DASH", "telemetry_http", "Le gestionnaire d'un mini-réseau ne connaît pas l'équilibre en temps réel.", "Bilan production, stockage et consommation par abonné."],
    ["Télérelève de compteurs électriques (prototype)", "technicien", "E EM LORA", "telemetry_http", "Les relevés manuels coûtent cher dans les zones dispersées.", "Index transmis (prototype, sans valeur de facturation)."],
    ["Poste de transformation : température et charge", "ingenieur", "E TS CT GSM", "current_monitor", "Les transformateurs surchargés vieillissent prématurément.", "Charge et température suivies ; alerte de surcharge."],
  ], ["Mini-réseaux", "Distributeurs", "Zones rurales"], ["Gestion de la demande", "Recharge intelligente des véhicules"]),
  P("construction", [
    ["Maturité du béton par température", "ingenieur", "E TS TS SD", "ntc_temperature", "Le décoffrage est décidé sans connaître le durcissement réel du béton.", "Historique de température du béton pour la méthode de maturité (loi à étalonner)."],
    ["Surveillance de fissure (déplacement)", "recherche", "E TOF SD LORA", "telemetry_http", "L'évolution d'une fissure d'un bâtiment n'est pas mesurée.", "Ouverture de la fissure suivie dans le temps."],
    ["Vibrations de chantier près des habitations", "ingenieur", "E VIB SD GSM", "vibration_rms", "Les riverains se plaignent des vibrations des engins.", "Niveaux vibratoires enregistrés (indicatifs)."],
  ], ["Chantiers", "Ouvrages d'art", "Bâtiments anciens"], ["Surveillance des ponts", "Suivi des engins de chantier"]),
  P("froid", [
    ["Chambre froide : température, porte et dégivrage", "technicien", "E TS TS ILS GSM", "ntc_temperature", "Les portes mal fermées et les givrages provoquent des pertes.", "Températures, ouvertures et alertes."],
    ["Climatiseur : courant du compresseur et rendement", "ingenieur", "E CT TS TS", "current_monitor", "Les climatiseurs encrassés consomment davantage.", "Courant et écart de température suivis pour planifier l'entretien."],
    ["Surveillance de pression frigorifique (prototype)", "ingenieur", "E TX PR OLED", "telemetry_http", "Les fuites de fluide sont détectées tardivement.", "Pressions suivies (intervention réservée aux personnes habilitées)."],
  ], ["Commerces", "Entrepôts frigorifiques", "Bâtiments climatisés"], ["Maintenance conditionnelle", "Régulation optimisée"]),
  P("robotique", [
    ["Robot mobile télécommandé avec télémétrie", "technicien", "E MOT MOT DRV TOF BAT", "robot_obstacle", "Les inspections de zones difficiles exposent les techniciens.", "Robot évitant les obstacles et transmettant ses mesures."],
    ["Bras robotisé éducatif connecté", "intermediaire", "E SERVO SERVO SERVO OLED", "telemetry_http", "Les démonstrations de robotique manquent d'enregistrement des mouvements.", "Positions enregistrées et rejouées."],
    ["Supervision d'une flotte de robots de nettoyage", "ingenieur", "E INA IMU MQTT DASH", "telemetry_http", "Les robots tombent en panne de batterie hors de leur base.", "État de batterie et position estimée de chaque robot."],
  ], ["Écoles", "Entrepôts", "Bâtiments"], ["Navigation autonome (capteurs et algorithmes validés)", "Communication robot-cloud sécurisée"]),
  P("drones", [
    ["Télémétrie de drone vers tableau de bord (sol)", "ingenieur", "E LORA GPS DASH", "telemetry_http", "Les données de vol ne sont pas archivées.", "Position, altitude et batterie archivées (télémétrie seulement)."],
    ["Surveillance de batteries de drones au sol", "technicien", "E INA TS OLED", "battery_monitor", "Les batteries LiPo endommagées sont réutilisées.", "Historique de charge et alerte de déséquilibre (selon mesures disponibles)."],
    ["Charge utile de mesure environnementale", "recherche", "E TH PM GPS SD", "telemetry_http", "Les profils verticaux de pollution sont inconnus.", "Mesures géoréférencées enregistrées pendant le vol."],
  ], ["Agriculture", "Inspection d'infrastructures", "Recherche"], ["Gestion de flotte (avec intégration validée)", "Cartographie"]),
  P("grand_public", [
    ["Prise connectée avec mesure de consommation", "intermediaire", "E EM REL", "telemetry_http", "Les appareils en veille consomment sans qu'on le sache.", "Consommation par appareil et commande à distance."],
    ["Machine à laver : notification de fin de cycle", "debutant", "E CT BUZ", "current_monitor", "Le linge reste mouillé dans la machine.", "Notification quand le courant retombe en fin de cycle."],
    ["Réfrigérateur domestique : alerte de porte et température", "debutant", "E TS ILS BUZ", "ntc_temperature", "Une porte mal fermée gâte les aliments.", "Alarme sonore et température consultable."],
  ], ["Foyers", "Résidences"], ["Commande vocale locale", "Tableau de bord familial"]),
  P("ports_aeroports", [
    ["Suivi de conteneurs au port (position)", "ingenieur", "E GPS NB", "telemetry_http", "Les conteneurs mal placés retardent les chargements.", "Position de chaque conteneur équipé."],
    ["Surveillance vibratoire d'une grue", "ingenieur", "E VIB CT RS485", "vibration_rms", "Les défauts de roulements de grue provoquent des arrêts longs.", "Niveau vibratoire suivi ; alerte de dérive."],
    ["Parking aéroport : occupation", "intermediaire", "E US LORA LED", "ultrasonic_level", "L'occupation des parkings n'est pas affichée.", "Places libres par zone."],
  ], ["Ports", "Aéroports", "Gares"], ["Maintenance des équipements de piste", "Supervision centralisée"]),
  P("dechets", [
    ["Composteur connecté : température à cœur", "intermediaire", "E TS TS LORA", "ntc_temperature", "L'hygiénisation du compost n'est pas prouvée.", "Courbe de température à cœur et durée au-dessus du seuil fixé."],
    ["Digesteur de biogaz : pression et température (prototype)", "ingenieur", "E PR TS GAS GSM", "telemetry_http", "Les dérives du digesteur sont détectées tardivement.", "Pression, température et alerte de fuite (matériel certifié requis sur site)."],
    ["Pesée des déchets apportés en centre de tri", "technicien", "E LOAD HX RFID OLED", "telemetry_http", "Les apports ne sont pas pesés ni attribués.", "Masses par apporteur (badge) enregistrées."],
  ], ["Centres de tri", "Collectivités", "Exploitations agricoles"], ["Optimisation des tournées de collecte", "Traçabilité des déchets industriels"]),
  P("patrimoine", [
    ["Conservation préventive : climat des réserves de musée", "technicien", "E TH LUX SD", "telemetry_http", "Les variations d'humidité dégradent les collections.", "Historique climatique et alertes de dérive."],
    ["Archives : détection d'eau et d'incendie", "intermediaire", "E RAIN SMK BUZ GSM", "alarm_inputs", "Les sinistres dans les archives détruisent des documents uniques.", "Alerte rapide (détecteurs certifiés obligatoires en complément)."],
  ], ["Musées", "Bibliothèques", "Archives"], ["Éclairage adapté aux œuvres", "Rapport de conservation"]),
  P("sport", [
    ["Arrosage d'un terrain de sport selon l'humidité du sol", "technicien", "E SOIL RG REL EV", "threshold_relay", "Les terrains sont arrosés même après la pluie.", "Arrosage commandé par l'humidité du sol et la pluie mesurée."],
    ["Éclairage de stade : commande et consommation", "technicien", "E EM REL LUX", "threshold_relay", "L'éclairage reste allumé sans activité.", "Commande programmée et consommation mesurée."],
  ], ["Stades", "Salles de sport", "Équipements collectifs"], ["Réservation des créneaux", "Gestion de l'eau"]),
  P("services_publics", [
    ["File d'attente d'un service public", "intermediaire", "E TOF OLED ETH", "pulse_counter", "Les usagers attendent sans information.", "Nombre de personnes et temps d'attente estimé affichés."],
    ["Consommation énergétique des bâtiments administratifs", "technicien", "E EM EM LORA DASH", "telemetry_http", "Les factures d'énergie publiques ne sont pas analysées par bâtiment.", "Tableau de bord par bâtiment et dérives signalées."],
  ], ["Mairies", "Administrations", "Guichets"], ["Données ouvertes", "Plan de sobriété"]),
];

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const SCHEMATIC: Partial<Record<CodeKey, string>> = { telemetry_http: "architecture_iot", threshold_relay: "iot_capteurs", ultrasonic_level: "iot_capteurs", ntc_temperature: "iot_capteurs", alarm_inputs: "iot_capteurs", current_monitor: "iot_capteurs", battery_monitor: "iot_capteurs", pulse_counter: "iot_capteurs", access_control: "iot_capteurs", vibration_rms: "iot_capteurs" };

export const SECTOR_PROJECTS: BankProject[] = DATA.flatMap(({ sector, defs, apps, improvements }) => {
  const s = SECTORS.find((x) => x.key === sector)!;
  return defs.map(([title, level, comps, code, problem, expected]): BankProject => {
    const counts = new Map<string, number>();
    for (const a of comps.split(" ")) { const n = C[a]; if (!n) throw new Error(`Composant inconnu : ${a}`); counts.set(n, (counts.get(n) ?? 0) + 1); }
    const components = [...counts.entries()] as [string, number][];
    return {
      id: `iot-sec-${sector}-${slug(title)}`, title, filiere: "iot", domain: s.label, level, iot: true, theme: s.label, sector,
      objectives: ["Concevoir une chaîne complète capteurs → carte → communication → plateforme → tableau de bord et alertes", "Mettre en œuvre les exigences de sécurité des objets connectés", "Valider les mesures par comparaison à une référence"],
      problem,
      specs: ["Grandeurs mesurées, périodes et seuils fixés par l'utilisateur après étalonnage", ...IOT_SECURITY, ...(s.critical ? ["Application critique : prototype pédagogique ; validations, certifications et autorisations requises avant tout usage réel."] : []), ...(s.note ? [s.note] : [])],
      components, principle: `Les capteurs (${components.map(([n]) => n).filter((n) => !/Carte|DevKit|Arduino|Raspberry|ESP32-CAM/.test(n)).join(", ")}) sont lus par la carte, qui publie les mesures vers XAM-XAM LAB (IoT Gateway), où elles sont historisées, affichées et comparées aux seuils de l'utilisateur ; toute commande d'actionneur est proposée puis confirmée par une personne.`,
      steps: [...STEPS.iot], code, simulation: null, schematic: SCHEMATIC[code] ?? null,
      expected: [expected, "Mesures horodatées et alertes consultables ; comportement vérifié après coupure de réseau et d'alimentation"],
      tests: [...derivedTests(components), "Essai de perte de connexion : mise en mémoire tampon puis reprise de l'envoi", "Essai d'authentification : un jeton invalide est refusé par la plateforme"],
      faults: derivedFaults(components), applications: apps, improvements,
    };
  });
});

/** Secteur d'un projet IoT thématique de la banque d'origine. */
export const THEME_SECTOR: Record<string, string> = {
  "Surveillance et commande à distance": "securite", "Gestion intelligente de l'énergie": "electricite", "Monitoring photovoltaïque": "enr", "Surveillance des batteries": "enr",
  "Irrigation intelligente": "agriculture", "Agriculture connectée": "agriculture", "Domotique": "batiment", "Contrôle d'accès": "securite", "Détection d'incendie et de fumée": "securite",
  "Surveillance de température et d'humidité": "froid", "Gestion des réservoirs d'eau": "eau", "Pompage intelligent": "eau", "Robotique connectée": "robotique", "Surveillance industrielle": "industrie",
  "Maintenance préventive et conditionnelle": "industrie", "Systèmes d'alerte": "environnement", "Télécommande et automatisation": "industrie", "Réseaux de capteurs": "environnement",
  "Acquisition et traitement de données": "recherche", "Supervision des équipements": "industrie",
};
