/**
 * Données de référence : composants GÉNÉRIQUES (fonction et usage, sans caractéristique de fabricant).
 * Aucune valeur constructeur n'est inventée : un composant réel s'ajoute avec sa référence et sa fiche technique
 * (statut « à vérifier » jusqu'à vérification).
 */
import type { Db } from "./db";

type C = [category: string, name: string, symbol: string | null, description: string, fn: string, pins: string[], precautions: string | null];

export const GENERIC_COMPONENTS: C[] = [
  ["passif", "Résistance", "R", "Dipôle qui s'oppose au passage du courant (loi d'Ohm U = R·I).", "Limiter un courant, diviser une tension, polariser un montage.", ["1", "2"], "Respecter la puissance dissipable indiquée par le fabricant."],
  ["passif", "Condensateur", "C", "Dipôle qui stocke de l'énergie sous forme de champ électrique (i = C·du/dt).", "Filtrer, découpler, temporiser, coupler un signal.", ["1", "2"], "Condensateurs polarisés : respecter le sens et la tension maximale."],
  ["passif", "Bobine (inductance)", "L", "Dipôle qui stocke de l'énergie sous forme de champ magnétique (u = L·di/dt).", "Filtrer, lisser un courant, convertir l'énergie (alimentations à découpage).", ["1", "2"], "Surtension à l'ouverture d'un circuit inductif : prévoir une protection."],
  ["source", "Source de tension", "V", "Source idéale imposant une tension (continue, impulsion, sinusoïde) entre ses bornes.", "Alimenter un circuit simulé.", ["+", "−"], null],
  ["source", "Source de courant", "I", "Source idéale imposant un courant.", "Modéliser une alimentation en courant ou une charge active.", ["1", "2"], null],
  ["semi-conducteur", "Diode (modèle générique)", "D", "Composant laissant passer le courant dans un seul sens (anode → cathode). Simulation : modèle par défaut de ngspice, non représentatif d'une référence réelle.", "Redresser, protéger contre l'inversion de polarité, roue libre.", ["anode", "cathode"], "Respecter le courant direct et la tension inverse maximale de la référence choisie."],
  ["référence", "Masse", "GND", "Nœud de référence (0 V) du circuit.", "Référence des tensions ; obligatoire en simulation.", ["0"], null],
  ["semi-conducteur", "Transistor bipolaire NPN", null, "Composant à trois broches (base, collecteur, émetteur) dont le courant de collecteur est commandé par le courant de base.", "Amplifier, commuter une charge.", ["B", "C", "E"], "Simulation disponible dès qu'un modèle SPICE vérifié du fabricant est ajouté."],
  ["semi-conducteur", "Transistor MOSFET canal N", null, "Transistor à effet de champ commandé en tension (grille, drain, source).", "Commuter des charges de puissance, convertisseurs.", ["G", "D", "S"], "Tension grille-source maximale à respecter ; dissipation thermique."],
  ["circuit intégré", "Amplificateur opérationnel", null, "Amplificateur différentiel à très grand gain utilisé avec contre-réaction.", "Amplifier, filtrer, comparer, conditionner un capteur.", ["IN+", "IN−", "OUT", "V+", "V−"], "Plage d'alimentation et de mode commun selon la référence."],
  ["microcontrôleur", "Carte ESP32", null, "Carte à microcontrôleur avec Wi-Fi et Bluetooth intégrés.", "Objets connectés, acquisition de capteurs, commande de relais.", [], "Entrées/sorties en logique 3,3 V : ne pas appliquer 5 V directement."],
  ["microcontrôleur", "Seeed XIAO ESP32-S3", null, "Carte miniature à microcontrôleur ESP32-S3 (Wi-Fi, Bluetooth LE). Utilisée par le nœud capteur de référence de XAM-XAM LAB (firmware/xamxam-node).", "Nœud capteur IoT basse consommation.", [], "Entrées/sorties en logique 3,3 V."],
  ["microcontrôleur", "Carte Arduino (famille Uno)", null, "Carte à microcontrôleur programmable par USB, très répandue en enseignement.", "Prototypage, apprentissage, commande de capteurs et actionneurs.", [], "Vérifier la logique (5 V ou 3,3 V) de la carte utilisée."],
  ["ordinateur", "Raspberry Pi", null, "Ordinateur monocarte sous Linux avec broches d'entrées/sorties.", "Passerelle IoT, agent local, traitement embarqué.", [], "Entrées/sorties en logique 3,3 V."],
  ["capteur", "Capteur d'humidité du sol capacitif", null, "Capteur dont la capacité varie avec la teneur en eau du sol ; sortie analogique.", "Irrigation automatique, suivi agronomique.", ["VCC", "GND", "AOUT"], "Étalonnage obligatoire sur le sol réel ; aucune valeur absolue sans étalonnage."],
  ["capteur", "Capteur de température et d'humidité de l'air", null, "Capteur numérique de température et d'humidité relative.", "Stations météo, serres, surveillance de locaux.", ["VCC", "GND", "DATA"], null],
  ["capteur", "Débitmètre à effet Hall", null, "Capteur délivrant des impulsions proportionnelles au débit d'eau.", "Mesure du débit de pompage et d'irrigation.", ["VCC", "GND", "PULSE"], "Coefficient impulsions/litre à prendre dans la fiche du fabricant ou à étalonner."],
  ["électrotechnique", "Disjoncteur", null, "Appareil de protection qui coupe automatiquement le circuit en cas de surcharge ou de court-circuit.", "Protection des canalisations et des personnes (avec dispositif différentiel).", [], "Calibre choisi d'après le courant d'emploi et la section ; pouvoir de coupure ≥ courant de court-circuit."],
  ["électrotechnique", "Contacteur", null, "Interrupteur électromécanique commandé par une bobine, prévu pour de nombreuses manœuvres en charge.", "Commande de moteurs, de pompes, d'éclairage.", ["A1", "A2", "L1", "T1"], "Catégorie d'emploi (AC-1, AC-3…) adaptée à la charge."],
  ["électrotechnique", "Relais", null, "Interrupteur commandé électriquement, pour faibles puissances ou isolement de commande.", "Interface entre microcontrôleur et charge.", ["bobine+", "bobine−", "COM", "NO", "NC"], "Diode de roue libre sur la bobine commandée en continu."],
  ["électrotechnique", "Transformateur", null, "Machine statique qui modifie la tension alternative par induction (rapport des spires).", "Adaptation de tension, isolement galvanique.", [], null],
  ["électrotechnique", "Moteur asynchrone triphasé", null, "Moteur à courant alternatif robuste, le plus répandu dans l'industrie.", "Pompes, ventilateurs, convoyeurs.", ["U", "V", "W", "PE"], "Couplage étoile/triangle selon la plaque signalétique et le réseau."],
  ["électrotechnique", "Variateur de vitesse", null, "Convertisseur électronique qui règle la fréquence et la tension d'alimentation d'un moteur.", "Réglage de débit de pompe, démarrage progressif, économies d'énergie.", [], null],
  ["solaire", "Module photovoltaïque", null, "Ensemble de cellules convertissant le rayonnement solaire en courant continu.", "Production d'électricité, pompage solaire.", ["+", "−"], "Caractéristiques STC (Pmax, Voc, Vmp, Isc, coefficients de température) à prendre dans la fiche technique."],
  ["solaire", "Régulateur de charge MPPT", null, "Convertisseur qui suit le point de puissance maximale du champ PV et régule la charge de la batterie.", "Systèmes autonomes avec batterie.", [], "Respecter la tension PV maximale et le courant de charge."],
  ["solaire", "Onduleur", null, "Convertisseur continu → alternatif (autonome, réseau ou hybride).", "Alimenter des charges alternatives depuis un champ PV ou des batteries.", [], "Plage MPPT, tension DC maximale et puissance selon la fiche technique."],
  ["solaire", "Batterie", null, "Accumulateur électrochimique stockant l'énergie (plomb, lithium-fer-phosphate…).", "Autonomie des systèmes solaires.", ["+", "−"], "Profondeur de décharge et courant maximal selon la technologie et le fabricant."],
];

export async function seed(db: Db) {
  for (const [category, name, symbol, description, fn, pins, precautions] of GENERIC_COMPONENTS) {
    await db.query(
      `INSERT INTO components(category, name, symbol_kind, description, function, pins, precautions, status, source, mpn)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'generic','Composant générique XAM-XAM LAB (aucune caractéristique de fabricant)','generic')
       ON CONFLICT (category, name, mpn) DO NOTHING`, [category, name, symbol, description, fn, JSON.stringify(pins), precautions]);
  }
}
