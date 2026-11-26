/** Banque de projets pratiques : structure commune (17 rubriques) et éléments déduits des composants. */
import type { CodeKey } from "./codes";

export type BankLevel = "debutant" | "intermediaire" | "avance" | "technicien" | "ingenieur" | "recherche" | "startup";
export const BANK_LEVELS: { key: BankLevel; label: string }[] = [
  { key: "debutant", label: "Débutant" }, { key: "intermediaire", label: "Intermédiaire" }, { key: "avance", label: "Avancé" },
  { key: "technicien", label: "Technicien" }, { key: "ingenieur", label: "Ingénieur" }, { key: "recherche", label: "Recherche" }, { key: "startup", label: "Start-up" },
];

export interface BankProject {
  id: string; title: string; filiere: string; domain: string; level: BankLevel; iot: boolean; theme: string; sector?: string;
  objectives: string[]; problem: string; specs: string[]; components: [string, number][];
  principle: string; steps: string[]; code: CodeKey | null; simulation: { label: string; href: string } | null; schematic: string | null;
  expected: string[]; tests: string[]; faults: [string, string, string][]; applications: string[]; improvements: string[];
}

/** Pannes courantes par composant : [symptôme, cause probable, solution]. */
export const FAULTS: [RegExp, [string, string, string]][] = [
  [/humidité du sol/, ["Valeur figée ou incohérente", "Capteur mal enfoncé, sol mal tassé ou absence d'étalonnage", "Repositionner, tasser le sol autour, refaire l'étalonnage sec / saturé"]],
  [/température et d'humidité de l'air/, ["Mesures aberrantes intermittentes", "Câble trop long, alimentation bruitée", "Raccourcir la liaison, ajouter un condensateur de découplage"]],
  [/Sonde de température|Pt100|Thermocouple|CTN/, ["Température décalée", "Erreur de câblage ou de compensation", "Vérifier le montage (3 fils, soudure froide) et comparer à une référence"]],
  [/Débitmètre|Pluviomètre|Compteur d'eau/, ["Comptage nul", "Entrée sans résistance de tirage ou coefficient non renseigné", "Activer INPUT_PULLUP, renseigner le coefficient d'étalonnage"]],
  [/ultrasons/, ["Mesure invalide (pas d'écho)", "Condensation, mousse, obstacle dans le cône", "Nettoyer, déplacer le capteur, filtrer les valeurs"]],
  [/flotteur|Pressostat|fin de course|Contact d'ouverture/, ["Contact sans effet", "Contact collé ou câble coupé", "Tester la continuité au multimètre, remplacer"]],
  [/Capteur de courant/, ["Courant nul alors que la charge fonctionne", "Tore placé sur les deux conducteurs", "N'entourer qu'un seul conducteur (phase)"]],
  [/Module relais|Contacteur/, ["La charge ne démarre pas", "Commande insuffisante, contacts usés ou calibre dépassé", "Vérifier la tension de commande, le calibre et l'état des contacts"]],
  [/ESP32|ESP8266|Arduino|STM32|Pico|Raspberry/, ["Redémarrages inopinés", "Alimentation insuffisante lors des émissions radio", "Alimentation dimensionnée, condensateur de réserve, câble USB court"]],
  [/Module GSM|LoRa|Antenne|Liaison radio|Radio de télémétrie/, ["Perte de liaison", "Couverture ou antenne inadaptée", "Mesurer le niveau de signal, repositionner l'antenne"]],
  [/Pompe/, ["Débit faible ou nul", "Désamorçage, filtre colmaté, marche à sec", "Réamorcer, nettoyer le filtre, installer une protection de niveau"]],
  [/Électrovanne/, ["Vanne ne s'ouvre pas", "Pression insuffisante ou bobine HS", "Vérifier la pression minimale et la résistance de la bobine"]],
  [/Module photovoltaïque/, ["Production faible", "Ombrage, salissure, connexion défaillante", "Nettoyer, supprimer les ombrages, contrôler les connecteurs"]],
  [/Batterie/, ["Autonomie réduite", "Décharges profondes répétées, vieillissement", "Respecter la profondeur de décharge, contrôler la capacité"]],
  [/Régulateur de charge|Onduleur/, ["Coupures intempestives", "Protection en surtension ou sous-tension", "Contrôler les tensions d'entrée et les réglages"]],
  [/Disjoncteur|Différentiel|Fusible/, ["Déclenchements répétés", "Surcharge, défaut d'isolement ou calibre inadapté", "Mesurer le courant et l'isolement, revoir le calibre"]],
  [/Moteur/, ["Échauffement anormal", "Surcharge, tension déséquilibrée ou ventilation obstruée", "Mesurer courants et tensions, dégager la ventilation"]],
  [/Variateur|Démarreur progressif/, ["Défaut affiché", "Paramétrage ou surcharge", "Consulter le code défaut et la notice, vérifier la plaque du moteur"]],
  [/Compresseur|Climatiseur|Chambre froide|Évaporateur/, ["Froid insuffisant", "Manque de fluide, givrage, condenseur encrassé", "Intervention d'une personne habilitée : contrôle de charge, dégivrage, nettoyage"]],
  [/Commutateur|Routeur|Point d'accès|RJ45|Fibre/, ["Pas de connexion", "Câble ou port défectueux, adresse IP en conflit", "Tester le câble, vérifier le plan d'adressage"]],
  [/Servomoteur|pas à pas|Pont en H|courant continu/, ["Mouvement saccadé ou absent", "Alimentation insuffisante, masse non commune", "Alimentation séparée dimensionnée, masses reliées"]],
  [/Vérin/, ["Vérin lent ou sans force", "Fuite d'air, pression trop faible", "Rechercher les fuites, régler la pression"]],
  [/Capteur de gaz|particules|CO2/, ["Mesures dérivent", "Préchauffage insuffisant ou vieillissement", "Respecter le temps de préchauffage, réétalonner"]],
  [/Caméra|IA embarquée/, ["Détection peu fiable", "Éclairage ou jeu d'apprentissage inadapté", "Améliorer l'éclairage, enrichir les données d'apprentissage"]],
];

/** Contrôles systématiques selon les composants employés. */
export const TESTS: [RegExp, string][] = [
  [/ESP32|ESP8266|Arduino|STM32|Pico|Raspberry/, "Vérifier les tensions d'alimentation (3,3 V / 5 V) avant de raccorder les modules"],
  [/Capteur|Sonde|Débitmètre|Pluviomètre|Tensiomètre|Anémomètre|Thermomètre/, "Comparer chaque mesure à un instrument de référence et consigner l'écart"],
  [/Module relais|Contacteur|Électrovanne/, "Essai à vide de la commande (sans charge), puis en charge sous surveillance"],
  [/Module photovoltaïque|Batterie|Régulateur/, "Mesurer tension et courant côté PV et côté batterie ; comparer à la production calculée"],
  [/Disjoncteur|Différentiel|Tableau/, "Essai de déclenchement du différentiel (bouton test) et contrôle de continuité de la terre"],
  [/Pompe|Réservoir/, "Mesurer le débit réel (volume / temps) et le comparer au calcul"],
  [/Moteur|Variateur/, "Mesurer courant et vitesse en charge ; vérifier le sens de rotation"],
  [/Commutateur|Routeur|Point d'accès/, "Test de connectivité (ping) et de débit entre deux postes"],
  [/Module GSM|LoRa|Courtier MQTT|Serveur web/, "Vérifier la réception des messages côté plateforme (IoT Gateway) et le comportement en cas de coupure réseau"],
];

export function derivedFaults(components: [string, number][]): [string, string, string][] {
  const out: [string, string, string][] = [];
  for (const [name] of components) for (const [re, f] of FAULTS) if (re.test(name) && !out.some((x) => x[0] === f[0])) out.push(f);
  return out.slice(0, 8);
}
export function derivedTests(components: [string, number][]): string[] {
  const out: string[] = [];
  for (const [re, t] of TESTS) if (components.some(([n]) => re.test(n))) out.push(t);
  return out;
}

/** Étapes types selon la nature du projet (complétées par les étapes propres à chaque projet). */
export const STEPS: Record<string, string[]> = {
  iot: ["Lire le cahier des charges et lister les grandeurs à mesurer ou à commander", "Choisir les composants dans la bibliothèque et établir le schéma de câblage (Schémas 2D)", "Câbler sur plaque d'essai, carte hors tension", "Téléverser le programme d'exemple et l'adapter (broches, seuils, coefficients)", "Étalonner les capteurs et fixer les seuils avec l'utilisateur", "Enregistrer l'appareil dans IoT Gateway et vérifier la réception des mesures", "Essais en conditions réelles, puis rapport"],
  elec: ["Établir le bilan de puissance et calculer les courants (Electrical Lab)", "Choisir protections et sections (tableaux normatifs validés)", "Dessiner les schémas (unifilaire, développé) dans Schémas 2D", "Réaliser le câblage hors tension, consigné", "Contrôles avant mise sous tension (continuité, isolement)", "Mise sous tension et essais fonctionnels", "Dossier technique et rapport"],
  meca: ["Analyser le besoin et les efforts en jeu", "Dimensionner (Mechanical Lab) : couple, rapports, forces", "Réaliser la maquette 3D (Studio) et vérifier l'encombrement", "Fabriquer ou assembler", "Essais et mesures", "Rapport"],
  info: ["Analyser le besoin et l'existant", "Concevoir l'architecture (Schémas 2D, générateur d'architecture ou de réseau)", "Installer et configurer", "Sécuriser (comptes, mises à jour, sauvegardes)", "Tester et documenter"],
  general: ["Analyser le besoin", "Concevoir et dimensionner", "Réaliser", "Tester", "Rédiger le rapport"],
};
