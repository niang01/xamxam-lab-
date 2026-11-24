/**
 * Agents spécialisés coordonnés par Aláji IA : configuration versionnée (domaine, outils autorisés, limites, vérification).
 * La spécialisation vient des outils et des consignes, pas d'un modèle différent.
 * Sélection déterministe (mots-clés) ou choisie par l'utilisateur ; un outil hors liste blanche est refusé.
 */
import type { ToolName } from "./tools";

export interface AgentDef { key: string; name: string; domain: string; tools: ToolName[]; limits: string; verify: string; keywords: RegExp }

const COMMON: ToolName[] = ["list_projects", "get_project", "recall", "remember", "list_calculations", "create_project", "add_project_task", "project_progress", "generate_project_report", "list_documents", "get_document_report", "generate_schematic"];

export const AGENTS: AgentDef[] = [
  { key: "electrical", name: "AI Electrical Engineer", domain: "Conception et analyse électrotechnique (mono/triphasé, protections, câbles, moteurs).", tools: ["run_calculation", "simulate_circuit", "save_schematic", "search_components"], limits: "Ne valide pas la conformité réglementaire d'une installation : intervention d'un professionnel habilité requise. Coefficients normatifs uniquement depuis les tableaux saisis.", verify: "Unités, protections présentes, paramètres manquants signalés.", keywords: /électri|electri|câble|cable|disjonct|contact|triphas|monophas|chute de tension|voltage drop|moteur|motor|puissance|power|section|courant|current|tension|voltage|ohm|résistance|resistance|watt|ampère|ampere/i },
  { key: "electronics", name: "AI Electronics Engineer", domain: "Circuits électroniques, composants, simulation SPICE, programmation.", tools: ["simulate_circuit", "save_schematic", "search_components", "run_calculation", "search_marketplace"], limits: "Modèles par défaut de ngspice pour la diode ; pas de modèle constructeur sans fiche vérifiée.", verify: "ERC sans erreur, résultats issus du moteur cités avec leur version.", keywords: /électroni|electroni|circuit|résistan|resist|condensa|capacit|diode|transistor|spice|simul|filtre|filter|rc\b|pont diviseur|divider/i },
  { key: "solar", name: "AI Solar Energy Engineer", domain: "Photovoltaïque, stockage, pompage solaire, rentabilité.", tools: ["get_solar_climatology", "run_calculation", "get_weather_forecast"], limits: "Caractéristiques d'équipement et prix fournis par l'utilisateur ; irradiation NASA POWER sur plan horizontal (régionale).", verify: "Plages MPPT, DoD, hypothèses de PR explicites.", keywords: /solaire|solar|photovolt|pv\b|panneau|panel|batter|onduleur|inverter|mppt|ensoleill|irradi|pompage|pump/i },
  { key: "iot", name: "AI IoT Engineer", domain: "Capteurs, microcontrôleurs, communications, automatisations.", tools: ["list_devices", "get_device_readings", "draft_automation", "propose_device_command", "search_components", "search_marketplace"], limits: "Commandes : proposition seulement. Mesures simulées jamais présentées comme réelles.", verify: "Âge des mesures, qualité, capacités déclarées.", keywords: /iot|capteur|sensor|esp32|xiao|arduino|raspberry|mesure|reading|appareil|device|automatis|scénario|scenario|seuil|threshold|irrigation/i },
  { key: "robotics", name: "AI Robotics Engineer", domain: "Robots, mouvements, automatisation.", tools: ["run_calculation", "list_devices", "propose_device_command"], limits: "Opérations réelles : pilote habilité requis ; pas de commande bas niveau.", verify: "Cohérence des couples et vitesses.", keywords: /robot|bras|arm|cinémat|kinemat|servo/i },
  { key: "drone", name: "AI Drone Engineer", domain: "Architecture, propulsion, navigation, télémétrie de drones.", tools: ["run_calculation", "list_devices", "get_weather_forecast"], limits: "Ne pilote pas : les commandes de vol passent par le Drone Command Center (confirmation humaine, habilitation télépilote, pont MAVLink validé sur simulateur seulement) ; opération réelle soumise à l'autorisation ANACIM.", verify: "Autonomie, météo, géorepérage.", keywords: /drone|uav|mavlink|px4|ardupilot|vol\b|flight/i },
  { key: "mechanical", name: "AI Mechanical Engineer", domain: "Mécanique, transmissions, vérins, contraintes.", tools: ["run_calculation"], limits: "Éléments finis non disponibles dans cette version.", verify: "Rendements fournis, unités.", keywords: /mécani|mechani|engrenage|gear|couple|torque|vérin|cylinder|transmission/i },
  { key: "refrigeration", name: "AI Refrigeration Engineer", domain: "Froid, climatisation, thermodynamique.", tools: ["run_calculation"], limits: "Propriétés de fluides réels via CoolProp dans le Refrigeration Lab (service de calcul) ; aucune approximation présentée comme exacte.", verify: "Températures en kelvins pour Carnot, COP réel < COP de Carnot.", keywords: /froid|frigo|refriger|clim|hvac|cop\b|chambre froide|cold room|pompe à chaleur|heat pump/i },
  { key: "network", name: "AI Computer & Network Engineer", domain: "Informatique, adressage, routage, serveurs.", tools: ["run_calculation"], limits: "Émulation réseau non disponible dans cette version.", verify: "Chevauchements d'adresses.", keywords: /réseau|network|ip\b|ipv4|sous-réseau|subnet|vlsm|vlan|routage|routing|serveur|server/i },
  { key: "cyber", name: "AI Cybersecurity Analyst", domain: "Protection et analyse des risques (défensif uniquement).", tools: ["run_calculation"], limits: "Aucune action offensive.", verify: "Menace, impact, mesure.", keywords: /sécurité informatique|cyber|pare-feu|firewall|attaque|attack|vulnérab|vulnerab|chiffr|encrypt/i },
  { key: "gis", name: "AI GIS & Satellite Analyst", domain: "Géographie, météo, données satellitaires.", tools: ["get_solar_climatology", "get_weather_forecast"], limits: "NASA POWER = donnée modélisée régionale ; Meteomatics = prédiction ; jamais présentées comme mesures.", verify: "Source, résolution, date d'acquisition.", keywords: /nasa|satellite|météo|meteo|weather|climat|climate|pluie|rain|température|temperature|prévision|forecast|ndvi|gis|carte|map/i },
  { key: "research", name: "AI Research Assistant", domain: "Méthodologie scientifique, structuration, mémoires.", tools: ["get_project"], limits: "Aucune référence bibliographique inventée : uniquement des références fournies ou vérifiables (DOI) — sinon le dire.", verify: "Distinction calculé / simulé / mesuré.", keywords: /mémoire|thesis|recherche|research|méthodolog|methodolog|problématique|bibliograph|soutenance|defen[cs]e/i },
  { key: "tutor", name: "AI Education Tutor", domain: "Explications adaptées au niveau, exercices.", tools: ["search_components", "simulate_circuit"], limits: "En évaluation : indices, pas de solution complète.", verify: "Niveau de l'apprenant pris en compte.", keywords: /explique|explain|apprend|learn|cours|course|exercice|exercise|élève|pupil|comment fonctionne|how does/i },
  { key: "startup", name: "AI Startup Mentor", domain: "Entrepreneuriat, modèle d'affaires, incubation.", tools: ["run_calculation", "search_marketplace"], limits: "Pas de conseil juridique ou financier certifié ; aucune donnée de marché inventée.", verify: "Hypothèses explicites.", keywords: /startup|entreprise|business|financ|investis|invest|incubat|marché|market|annonce|listing|acheter|buy|vendre|sell|à vendre|for sale/i },
  { key: "talent", name: "AI Talent & Career Assistant", domain: "Compétences, portfolios, recrutement.", tools: [], limits: "Aucun critère discriminatoire ; profils consentants uniquement.", verify: "Compétences prouvées par projets ou certificats.", keywords: /carrière|career|cv\b|emploi|job|stage|intern|recrut|recruit|compétence|skill/i },
  { key: "software", name: "AI Software Engineer", domain: "Logiciel, firmware, tableaux de bord.", tools: ["list_devices", "search_components"], limits: "Code produit = proposition à relire et tester.", verify: "Code testable, sécurité des secrets.", keywords: /code|programm|firmware|logiciel|software|dashboard|tableau de bord/i },
  { key: "verifier", name: "Agent vérificateur", domain: "Contrôle automatique de chaque réponse : étapes non exécutées, paramètres manquants, valeurs non finies, unités absentes, mesures simulées.", tools: [], limits: "Ne produit pas de résultat : contrôle ceux des autres agents (src/server/ai/analysis.ts, verifySteps).", verify: "—", keywords: /^$/ },
];

export function selectAgents(question: string, requested: string[] = []): AgentDef[] {
  const chosen = requested.length ? AGENTS.filter((a) => requested.includes(a.key)) : AGENTS.filter((a) => a.keywords.test(question));
  const list = chosen.length ? chosen : AGENTS.filter((a) => ["research", "tutor"].includes(a.key));
  return [...list.slice(0, 6), AGENTS.find((a) => a.key === "verifier")!];
}

export function toolsFor(agents: AgentDef[]): ToolName[] {
  return [...new Set([...COMMON, ...agents.flatMap((a) => a.tools)])];
}

/** Agent propriétaire d'un outil (attribution des étapes dans le journal). */
export function ownerOf(tool: ToolName, agents: AgentDef[]): string {
  return agents.find((a) => a.tools.includes(tool))?.key ?? "core";
}
