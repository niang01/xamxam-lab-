/** Registre des logiciels de dimensionnement (un logiciel = un moteur pur testé). */
import type { Software } from "./types";
import { ELECTRICAL } from "./electrical";
import { PV } from "./pv";
import { PUMPING } from "./pumping";
import { DRYING } from "./drying";
import { BIOMASS } from "./biomass";
import { COMPOST } from "./compost";
import { SOLAR_THERMAL } from "./solar-thermal";
import { AUTOMATION, ELECTRONICS, INSTRUMENTATION, IOT_NODE, MEDICAL, POWER } from "./disc-electronics";
import { INDUSTRIAL, IT, MECHANICAL, NETWORK, TELECOM } from "./disc-it-meca";
import { BUILDING, CARBON, CIVIL, COLD, DOMOTICS, DRONE, IRRIGATION, PLUMBING, ROBOT } from "./disc-building";

export const SOFTWARE: Software[] = [ELECTRICAL, PV, PUMPING, SOLAR_THERMAL, DRYING, BIOMASS, COMPOST, ELECTRONICS, POWER, AUTOMATION, INSTRUMENTATION, IOT_NODE, MEDICAL, IT, NETWORK, TELECOM, MECHANICAL, INDUSTRIAL, CIVIL, BUILDING, COLD, PLUMBING, ROBOT, DRONE, IRRIGATION, DOMOTICS, CARBON];
export const softwareByKey = (k: string) => SOFTWARE.find((s) => s.key === k) ?? null;
/** Description publique (sans fonction) pour le client. */
export const softwareDef = (s: Software) => ({ key: s.key, title: s.title, discipline: s.discipline, lab: s.lab, summary: s.summary, sections: s.sections, example: s.example, needs: s.needs ?? [] });

/** Mots-clés de chaque logiciel (orientation d'une demande vers le bon logiciel). */
const KEYWORDS: Record<string, RegExp> = {
  "installation-electrique": /installation électrique|tableau électrique|disjoncteur|section de câble|chute de tension|circuits? (prises|éclairage)/i,
  photovoltaique: /photovolta|panneaux? solaires?|\bpv\b|onduleur|batteries? solaires?/i,
  pompage: /pompage|pompe|forage|hmt|hauteur manométrique|château d'eau/i,
  "solaire-thermique": /chauffe-eau solaire|solaire thermique|eau chaude solaire|capteurs? (plans?|thermiques?)/i,
  "sechage-solaire": /séch(age|oir)|sech(age|oir)|déshydrat/i,
  "biomasse-biogaz": /biogaz|méthanis|digesteur|biomasse/i,
  compostage: /compost/i,
  electronique: /régulateur linéaire|résistance de (la )?led|pont diviseur|filtre rc|alimentation régulée/i,
  "electronique-puissance": /redresseur|hacheur|buck|convertisseur dc|électronique de puissance/i,
  automatisme: /automate|entrées? ?\/? ?sorties|vérins?|pneumatique|grafcet/i,
  instrumentation: /4[- ]?20 ?ma|boucle de courant|incertitude|étalonnage|instrumentation/i,
  "objet-connecte": /autonomie (de|d'un) (capteur|objet|nœud|noeud)|bilan énergétique.*(iot|capteur)|objet connecté|deep sleep/i,
  "technologies-medicales": /ecg|biomédic|signal physiologique|chaîne d'acquisition/i,
  informatique: /raid|stockage|sauvegarde|onduleur informatique|serveur/i,
  reseaux: /adressage|vlsm|sous-réseau|fibre optique|commutateur|switch|câblage réseau/i,
  telecommunications: /bilan de liaison|lora|fresnel|antenne|portée radio/i,
  mecanique: /réducteur|transmission|arbre|roulement|couple de sortie/i,
  "genie-industriel": /\btrs\b|oee|takt|wilson|stock de sécurité|équilibrage de ligne/i,
  "genie-civil": /poutre|semelle|descente de charges|béton|fondation/i,
  batiment: /climatisation d'un local|déperdition|bilan thermique|éclairage d'un local|luminaires/i,
  froid: /chambre froide|bilan frigorifique|congél/i,
  plomberie: /plomberie|canalisation|débit probable|pression d'eau|eau chaude sanitaire/i,
  robotique: /robot mobile|motorisation d'un robot|robotique/i,
  drones: /drone|poussée|multirotor|quadri/i,
  irrigation: /irrigation|goutte-à-goutte|évapotranspiration|\bet0\b|arrosage/i,
  domotique: /domotique|maison intelligente|économies? d'énergie/i,
  environnement: /bilan carbone|émissions?|co2|gaz à effet de serre/i,
};
export function matchSoftware(question: string): Software[] {
  return SOFTWARE.filter((s) => KEYWORDS[s.key]?.test(question)).slice(0, 4);
}
