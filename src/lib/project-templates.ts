/**
 * Modèles de projets (IoT, énergie, robotique…) × niveaux (mémoire de technicien, BTS, ingénieur, R&D, fin de
 * formation, start-up). Un modèle fournit une STRUCTURE et des consignes de rédaction — jamais de résultat, de
 * mesure ou de prix : les champs entre crochets sont à compléter par l'étudiant ou l'équipe.
 * Les composants proposés sont des composants GÉNÉRIQUES de la bibliothèque (src/lib/library.ts).
 */
export type Level = "memoire_technicien" | "projet_bts" | "projet_ingenieur" | "recherche" | "fin_formation" | "startup";
export const LEVELS: { key: Level; label: string; kind: "thesis" | "engineering" | "research" | "startup" }[] = [
  { key: "memoire_technicien", label: "Mémoire de fin d'études de technicien", kind: "thesis" },
  { key: "projet_bts", label: "Projet de technicien supérieur (BTS, DUT, DTS)", kind: "thesis" },
  { key: "projet_ingenieur", label: "Projet d'ingénieur", kind: "engineering" },
  { key: "recherche", label: "Projet de recherche et développement", kind: "research" },
  { key: "fin_formation", label: "Projet de fin de formation", kind: "thesis" },
  { key: "startup", label: "Projet de start-up / prototype innovant", kind: "startup" },
];

export interface Template {
  key: string; title: string; domain: string; summary: string;
  specs: string; objectives: string; architecture: string; programming: string; tests: string;
  components: [name: string, qty: number][];
  tasks: string[];
}

const TODO = "[à compléter]";

export const TEMPLATES: Template[] = [
  {
    key: "agriculture-intelligente", title: "Agriculture intelligente : suivi de parcelle connecté", domain: "Agriculture",
    summary: "Mesurer l'humidité du sol, la température et l'humidité de l'air d'une parcelle et transmettre les données à la plateforme.",
    specs: `Besoin : suivre en continu l'état d'une parcelle de ${TODO} (culture : ${TODO}, surface : ${TODO} m²).\nFonctions : mesurer l'humidité du sol (${TODO} points), la température et l'humidité de l'air ; transmettre toutes les ${TODO} min ; alerter au-delà de seuils fixés par l'exploitant.\nContraintes : alimentation autonome (${TODO}), étanchéité ${TODO}, portée radio ${TODO} m, budget ${TODO} FCFA.`,
    objectives: `- Concevoir un nœud capteur autonome.\n- Transmettre les mesures à XAM-XAM LAB (IoT Gateway).\n- Étalonner le capteur d'humidité du sol sur le sol réel.\n- Comparer les mesures à une observation de terrain.`,
    architecture: `Matériel : carte ESP32 → capteurs (humidité du sol, température/humidité de l'air) ; alimentation : module PV + batterie + régulateur.\nLogiciel : firmware (firmware/xamxam-node) → HTTPS ou MQTT → IoT Gateway → tableaux de bord et automatisations.`,
    programming: `Firmware PlatformIO (firmware/xamxam-node) : lecture des capteurs, mise en veille, envoi signé par le jeton de l'appareil.\nConfiguration : intervalle ${TODO}, Wi-Fi ou LoRa ${TODO}.`,
    tests: `1. Banc : lecture des capteurs, comparaison à un instrument de référence.\n2. Étalonnage du capteur de sol (sec / saturé).\n3. Essai d'autonomie sur ${TODO} jours.\n4. Essai de transmission (taux de perte).`,
    components: [["Carte ESP32", 1], ["Capteur d'humidité du sol capacitif", 2], ["Capteur de température et d'humidité de l'air", 1], ["Module photovoltaïque", 1], ["Régulateur de charge PWM", 1], ["Batterie lithium-fer-phosphate", 1], ["Convertisseur DC-DC abaisseur", 1]],
    tasks: ["Analyse du besoin et cahier des charges", "Choix des composants (bibliothèque) et budget", "Schéma de câblage 2D", "Bilan énergétique (Solar Energy Lab)", "Programmation et essais au banc", "Étalonnage du capteur de sol", "Installation sur la parcelle", "Analyse des mesures", "Rapport final", "Présentation"],
  },
  {
    key: "irrigation-automatique", title: "Irrigation automatique par pompage solaire", domain: "Agriculture / hydraulique",
    summary: "Commander une pompe et des électrovannes selon l'humidité du sol, avec un champ photovoltaïque.",
    specs: `Besoin journalier en eau : ${TODO} m³/j (culture ${TODO}, surface ${TODO} m²).\nSource : forage / puits / bassin (${TODO}) ; hauteur manométrique totale : ${TODO} m.\nCommande : automatique selon seuils fixés par l'exploitant + manuelle ; arrêt d'urgence ; protection marche à sec.`,
    objectives: `- Dimensionner la pompe et le champ PV.\n- Concevoir la commande (carte IoT + relais + électrovannes).\n- Simuler le niveau du réservoir sur 24 h (Studio 4D).\n- Mettre en service et mesurer le débit réel.`,
    architecture: `Énergie : modules PV → (variateur solaire ou régulateur + onduleur) → pompe.\nHydraulique : pompe → clapet anti-retour → réservoir → filtre → électrovannes → goutte-à-goutte.\nCommande : ESP32 + module relais + capteurs de sol, de niveau et débitmètre → IoT Gateway (commandes confirmées).`,
    programming: `Automatisation XAM-XAM (Automation Studio) : seuil d'humidité ${TODO}, durée maximale d'arrosage ${TODO} min, fenêtre horaire ${TODO}.\nSécurités : niveau bas du réservoir, durée maximale, arrêt d'urgence.`,
    tests: `1. Calculs : pump, pv_production, battery (si stockage).\n2. Simulation 4D du réservoir.\n3. Essai à vide des électrovannes.\n4. Mesure du débit réel (débitmètre) et comparaison au calcul.`,
    components: [["Pompe immergée de forage", 1], ["Module photovoltaïque", 1], ["Régulateur de charge MPPT", 1], ["Électrovanne", 2], ["Clapet anti-retour", 1], ["Réservoir / château d'eau", 1], ["Filtre à disques / tamis", 1], ["Goutteur / ligne de goutte-à-goutte", 1], ["Carte ESP32", 1], ["Module relais", 1], ["Capteur d'humidité du sol capacitif", 2], ["Capteur de niveau à flotteur", 1], ["Débitmètre à effet Hall", 1]],
    tasks: ["Besoin en eau et relevé du site", "Calcul de la pompe (Solar Energy Lab)", "Dimensionnement du champ PV", "Schéma hydraulique et électrique 2D", "Simulation du réservoir (Studio 4D)", "Programmation et automatisation", "Essais et mesure du débit", "Rapport et présentation"],
  },
  {
    key: "surveillance-environnementale", title: "Surveillance environnementale (qualité de l'air, météo locale)", domain: "Environnement",
    summary: "Station de mesure de température, humidité, luminosité et gaz, avec historisation.",
    specs: `Grandeurs : ${TODO}. Fréquence : ${TODO}. Lieu : ${TODO}. Alimentation : ${TODO}.\nExigence : distinguer clairement mesures (capteur) et données modélisées (NASA POWER, Earth & Space).`,
    objectives: `- Concevoir la station.\n- Comparer ses mesures aux données modélisées NASA POWER du lieu.\n- Publier un tableau de bord.`,
    architecture: `Capteurs → ESP32 → Wi-Fi/LoRa → IoT Gateway ; comparaison avec Earth & Space (données modélisées).`,
    programming: `Firmware de référence ; métriques déclarées dans les capacités de l'appareil.`,
    tests: `Essai comparatif avec un instrument de référence sur ${TODO} jours ; analyse des écarts.`,
    components: [["Carte ESP32", 1], ["Capteur de température et d'humidité de l'air", 1], ["Capteur de luminosité", 1], ["Capteur de gaz", 1], ["Module horloge temps réel", 1], ["Lecteur de carte microSD", 1]],
    tasks: ["Cahier des charges", "Choix des capteurs", "Schéma 2D", "Programmation", "Essai comparatif", "Analyse mesures / données modélisées", "Rapport"],
  },
  {
    key: "domotique", title: "Domotique : éclairage, prises et alarmes connectés", domain: "Bâtiment",
    summary: "Commander l'éclairage et des prises, détecter présence et fumée, depuis la plateforme.",
    specs: `Pièces : ${TODO}. Charges commandées : ${TODO} (puissance ${TODO} W). Scénarios : ${TODO}.\nSécurité électrique : installation par une personne habilitée ; protections conformes.`,
    objectives: `- Commander des charges à distance avec confirmation.\n- Détecter présence et fumée.\n- Mesurer la consommation.`,
    architecture: `Tableau (disjoncteurs, différentiel) → modules relais commandés par ESP32 → IoT Gateway ; capteurs de mouvement, de gaz, de courant.`,
    programming: `Scénarios dans Automation Studio (désactivés par défaut, essai à blanc avant activation).`,
    tests: `Essais hors tension puis sous tension par une personne habilitée ; mesure de consommation.`,
    components: [["Carte ESP32", 1], ["Module relais", 2], ["Détecteur de mouvement infrarouge", 1], ["Capteur de gaz", 1], ["Capteur de courant", 1], ["Disjoncteur", 2], ["Interrupteur différentiel", 1], ["Luminaire", 2]],
    tasks: ["Relevé de l'installation existante", "Bilan de puissance (Electrical Lab)", "Schéma électrique 2D", "Programmation des scénarios", "Essais", "Rapport"],
  },
  {
    key: "energie-solaire", title: "Installation solaire autonome", domain: "Énergie",
    summary: "Dimensionner et simuler une installation PV avec stockage pour un site isolé.",
    specs: `Charges : ${TODO} (bilan journalier ${TODO} Wh/j). Autonomie : ${TODO} jours. Site : ${TODO} (coordonnées pour NASA POWER).`,
    objectives: `- Bilan de puissance et d'énergie.\n- Dimensionner champ PV, batteries, régulateur, onduleur, câbles et protections.\n- Simuler l'état de charge sur plusieurs jours (Studio 4D).\n- Étude économique (LCOE, temps de retour).`,
    architecture: `Modules PV → coffret DC → régulateur MPPT → batteries → onduleur → tableau AC → charges.`,
    programming: `Supervision facultative : mesure tension/courant batterie par ESP32 → IoT Gateway.`,
    tests: `Calculs : power_balance, pv_production, string_sizing, battery, cable_section, economics ; simulation 4D de l'état de charge ; essais de réception.`,
    components: [["Module photovoltaïque", 4], ["Coffret de protection DC", 1], ["Régulateur de charge MPPT", 1], ["Batterie lithium-fer-phosphate", 2], ["Onduleur autonome", 1], ["Câble électrique", 1], ["Disjoncteur", 2], ["Structure de support PV", 1]],
    tasks: ["Bilan des charges", "Gisement solaire (NASA POWER)", "Dimensionnement (Solar Energy Lab)", "Schéma unifilaire 2D", "Simulation 4D de l'état de charge", "Étude économique", "Rapport et présentation"],
  },
  {
    key: "robotique", title: "Robot mobile autonome", domain: "Robotique",
    summary: "Robot à deux roues motrices évitant les obstacles.",
    specs: `Masse ${TODO} kg, vitesse ${TODO} m/s, autonomie ${TODO} min, détection d'obstacles à ${TODO} m.`,
    objectives: `- Concevoir le châssis (maquette 3D).\n- Dimensionner les moteurs (couple, Mechanical Lab).\n- Programmer l'évitement d'obstacles.`,
    architecture: `Batterie → pont en H → moteurs à courant continu ; capteur ultrasons ; carte de commande.`,
    programming: `Boucle de commande : lecture distance → décision → consignes moteurs ; arrêt d'urgence.`,
    tests: `Essais sur piste ; mesure de la vitesse et de l'autonomie.`,
    components: [["Carte Arduino (famille Uno)", 1], ["Pont en H", 1], ["Moteur à courant continu", 2], ["Capteur de niveau à ultrasons", 1], ["Batterie lithium-fer-phosphate", 1], ["Profilé aluminium", 2]],
    tasks: ["Cahier des charges", "Maquette 3D du châssis", "Calcul du couple", "Schéma 2D", "Programmation", "Essais", "Rapport"],
  },
  {
    key: "industrie", title: "Supervision d'une machine industrielle", domain: "Industrie",
    summary: "Mesurer courant, température et état d'un moteur, détecter les anomalies.",
    specs: `Machine : ${TODO}. Grandeurs : courant, température, état marche/arrêt. Alarmes : seuils de l'exploitant.`,
    objectives: `- Acquérir les grandeurs sans perturber la commande existante.\n- Détecter les dérives (comparaison à l'historique).`,
    architecture: `Capteurs de courant et de température → carte → passerelle → IoT Gateway ; automate existant inchangé.`,
    programming: `Acquisition périodique ; aucune commande de la machine par la plateforme sans habilitation et confirmation.`,
    tests: `Essai en fonctionnement normal puis comparaison.`,
    components: [["Moteur asynchrone triphasé", 1], ["Variateur de vitesse", 1], ["Capteur de courant", 3], ["Sonde de température étanche", 1], ["Carte ESP32", 1], ["Alimentation 24 V DC", 1]],
    tasks: ["Relevé de la machine", "Choix des capteurs", "Schéma 2D", "Acquisition", "Analyse", "Rapport"],
  },
  {
    key: "securite", title: "Système d'alarme et de contrôle d'accès", domain: "Sécurité",
    summary: "Détection d'intrusion, sirène et notification.",
    specs: `Zones : ${TODO}. Détecteurs : ${TODO}. Alimentation secourue : ${TODO}.`,
    objectives: `- Détecter une intrusion et notifier.\n- Journaliser les événements.`,
    architecture: `Détecteurs → carte → IoT Gateway (notifications) ; sirène via relais.`,
    programming: `Armement/désarmement ; temporisations ; journal.`,
    tests: `Essais de détection et de notification.`,
    components: [["Carte ESP32", 1], ["Détecteur de mouvement infrarouge", 2], ["Buzzer", 1], ["Module relais", 1], ["Module GSM/4G", 1]],
    tasks: ["Analyse des risques", "Schéma 2D", "Programmation", "Essais", "Rapport"],
  },
  {
    key: "sante-connectee", title: "Chaîne du froid connectée pour produits de santé", domain: "Santé",
    summary: "Surveiller la température d'un réfrigérateur de vaccins ou de médicaments et alerter en cas d'écart.",
    specs: `Plage de conservation : ${TODO} °C (selon les produits). Fréquence : ${TODO}. Alerte : ${TODO}.\nCe système de surveillance ne remplace pas les dispositifs et procédures réglementaires du centre de santé.`,
    objectives: `- Mesurer et historiser la température.\n- Alerter en cas de sortie de plage.\n- Simuler la remontée en température lors d'une coupure (Studio 4D).`,
    architecture: `Sonde étanche → ESP32 (+ batterie de secours) → IoT Gateway → notifications.`,
    programming: `Mesure toutes les ${TODO} min ; mémoire locale en cas de coupure réseau.`,
    tests: `Comparaison avec un thermomètre de référence ; essai de coupure.`,
    components: [["Sonde de température étanche", 2], ["Carte ESP32", 1], ["Module horloge temps réel", 1], ["Lecteur de carte microSD", 1], ["Batterie lithium-fer-phosphate", 1]],
    tasks: ["Cahier des charges avec le personnel de santé", "Schéma 2D", "Programmation", "Simulation 4D de la coupure", "Essais", "Rapport"],
  },
  {
    key: "chambre-froide", title: "Chambre froide solaire connectée", domain: "Froid",
    summary: "Conserver des produits agricoles avec une chambre froide supervisée.",
    specs: `Volume ${TODO} m³, température ${TODO} °C, produits ${TODO}, apports ${TODO}.`,
    objectives: `- Bilan thermique (wall_load) et choix de l'équipement.\n- Simulation de la température (Studio 4D).\n- Supervision connectée.`,
    architecture: `Groupe frigorifique (compresseur, condenseur, détendeur, évaporateur) + régulateur ; sondes → IoT Gateway.`,
    programming: `Supervision ; alarmes ; aucune commande directe du groupe par l'IA.`,
    tests: `Mesure de descente en température et de stabilité.`,
    components: [["Chambre froide", 1], ["Compresseur frigorifique", 1], ["Condenseur à air", 1], ["Détendeur thermostatique", 1], ["Évaporateur", 1], ["Thermostat / régulateur de froid", 1], ["Sonde de température étanche", 2], ["Carte ESP32", 1]],
    tasks: ["Bilan thermique (Refrigeration Lab)", "Choix des équipements", "Schéma 2D", "Simulation 4D", "Supervision", "Rapport"],
  },
];

const LEVEL_METHOD: Record<Level, string> = {
  memoire_technicien: "Démarche : 1. analyse du besoin ; 2. choix et justification des composants ; 3. schémas ; 4. réalisation et câblage ; 5. essais et mesures ; 6. rapport et soutenance.",
  projet_bts: "Démarche : 1. étude du besoin et cahier des charges ; 2. dimensionnement par le calcul ; 3. schémas et nomenclature ; 4. programmation ; 5. simulation ; 6. réalisation du prototype ; 7. protocole d'essais et comparaison calculé / simulé / mesuré ; 8. rapport et soutenance.",
  projet_ingenieur: "Démarche : 1. analyse fonctionnelle et cahier des charges ; 2. étude de solutions et critères de choix ; 3. dimensionnement et calculs justifiés ; 4. modélisation et simulation (2D/3D/4D) ; 5. prototype ; 6. validation expérimentale avec analyse des écarts ; 7. étude économique ; 8. rapport, présentation.",
  recherche: "Démarche : 1. état de l'art (références vérifiables uniquement) ; 2. hypothèses ; 3. protocole expérimental ; 4. modélisation et simulation ; 5. expérimentation ; 6. analyse statistique des résultats ; 7. discussion et limites ; 8. publication / rapport.",
  fin_formation: "Démarche : 1. présentation du contexte ; 2. objectifs ; 3. réalisation pas à pas ; 4. essais ; 5. bilan des compétences acquises ; 6. rapport.",
  startup: "Démarche : 1. problème client et proposition de valeur ; 2. étude de marché (sources citées) ; 3. prototype minimal (MVP) ; 4. essais avec des utilisateurs ; 5. modèle économique et coûts ; 6. plan de développement ; 7. présentation aux partenaires.",
};
const LEVEL_TASKS: Partial<Record<Level, string[]>> = {
  recherche: ["État de l'art (références vérifiables)", "Protocole expérimental"],
  startup: ["Entretiens clients", "Modèle économique (Business Model Canvas)", "Étude des coûts et prix", "Présentation aux partenaires (pitch)"],
  projet_ingenieur: ["Analyse fonctionnelle", "Étude économique"],
};

export function instantiate(t: Template, level: Level) {
  return {
    methodology: LEVEL_METHOD[level],
    tasks: [...(LEVEL_TASKS[level] ?? []), ...t.tasks],
    kind: LEVELS.find((l) => l.key === level)!.kind,
  };
}
export const templateByKey = (k: string) => TEMPLATES.find((t) => t.key === k) ?? null;
