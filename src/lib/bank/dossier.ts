/**
 * Dossier complet d'un projet de la banque en 35 rubriques (partie 12.3 du cahier des charges).
 * Chaque rubrique est construite à partir des données du projet, de la bibliothèque (fonctions, précautions,
 * documentation des composants), des programmes compilés et des logiciels de dimensionnement : rien n'est inventé ;
 * une rubrique sans contenu propre l'indique explicitement (« non applicable » ou « à compléter »).
 */
import { LIBRARY, FILIERES } from "@/lib/library";
import { matchSoftware } from "@/lib/studies";
import { generatorByKind } from "@/lib/schematics-gen";
import { CODES } from "./codes";
import { BANK_LEVELS, type BankProject } from "./types";
import { IOT_SECURITY, SECTORS } from "./sectors";

const AUDIENCE: Record<string, string> = {
  debutant: "Élèves et apprenants débutants (initiation), clubs scientifiques", intermediaire: "Apprenants de l'enseignement technique (CAP, BEP, bac professionnel)", avance: "Apprenants confirmés, fin de cycle technique",
  technicien: "Techniciens et étudiants de BTS / DUT", ingenieur: "Élèves ingénieurs, ingénieurs en poste", recherche: "Chercheurs, doctorants, laboratoires", startup: "Porteurs de projet et jeunes entreprises",
};

export interface DossierSection { n: number; title: string; body: string[] }

export function bankDossier(p: BankProject): DossierSection[] {
  const lib = p.components.map(([n]) => LIBRARY.find((c) => c.name === n)).filter(Boolean) as typeof LIBRARY;
  const sws = matchSoftware(`${p.title} ${p.domain} ${p.problem}`);
  const gen = p.schematic ? generatorByKind(p.schematic) : null;
  const code = p.code ? CODES[p.code] : null;
  const codeNotes = code ? code.source.split("\n").filter((l) => /^\s*\/\//.test(l)).map((l) => l.replace(/^\s*\/\/\s?/, "")).filter((l) => l.length > 3).slice(0, 14) : [];
  const sector = SECTORS.find((s) => s.key === p.sector);
  const S = (n: number, title: string, body: string[]): DossierSection => ({ n, title, body: body.length ? body : ["Non applicable à ce projet."] });
  return [
    S(1, "Titre", [p.title]),
    S(2, "Discipline", [FILIERES.find((f) => f.key === p.filiere)?.label ?? p.filiere]),
    S(3, "Spécialité", [p.domain, ...(sector ? [`Secteur d'application : ${sector.label}`] : [])]),
    S(4, "Niveau", [BANK_LEVELS.find((l) => l.key === p.level)?.label ?? p.level]),
    S(5, "Public cible", [AUDIENCE[p.level] ?? "—"]),
    S(6, "Objectifs pédagogiques", p.objectives),
    S(7, "Problématique", [p.problem]),
    S(8, "Cahier des charges", p.specs),
    S(9, "Présentation", [`${p.theme} — ${p.domain}.`, p.principle]),
    S(10, "Principe de fonctionnement", [p.principle]),
    S(11, "Étude technique", [`Grandeurs et organes : ${lib.map((c) => `${c.name} (${c.fn})`).join(" ; ")}.`, "Paramètres de chaque composant à relever sur la fiche de la référence choisie (bibliothèque) :", ...lib.filter((c) => c.params.length).map((c) => `• ${c.name} : ${c.params.map((x) => `${x.label}${x.unit ? ` (${x.unit})` : ""}`).join(", ")}`)]),
    S(12, "Calculs et dimensionnements", sws.length ? sws.map((w) => `Logiciel « ${w.title} » : /dimensionnement/${w.key}`) : ["Calculs élémentaires dans les laboratoires (Électricité et Électrotechnique, Electronics Lab, Solar Energy Lab…) ; aucun logiciel de dimensionnement spécifique ne correspond directement."]),
    S(13, "Justification des équipements", lib.map((c) => `${c.name} : ${c.fn} — ${c.description}`)),
    S(14, "Liste des composants", p.components.map(([n]) => n)),
    S(15, "Quantités", p.components.map(([n, q]) => `${q} × ${n}`)),
    S(16, "Estimation du coût", ["Aucun prix n'est inventé : offres réelles de la boutique (« Voir les offres de la boutique ») ou devis des fournisseurs, reportés dans le budget du projet réalisé."]),
    S(17, "Schéma de principe", [`Chaîne fonctionnelle : ${p.principle}`]),
    S(18, "Schéma électrique ou technique", gen ? [`Généré et vérifié : « ${gen.title} » — /schemas?generer=${gen.kind}`] : ["À dessiner dans l'éditeur Schémas 2D (aucun modèle automatique pour ce projet)."]),
    S(19, "Plan 2D", ["Éditeur Schémas 2D : implantation et câblage ; impression A4–A1 avec cartouche, export PDF, SVG, DXF."]),
    S(20, "Modèle 3D", ["Maquette 3D paramétrique dans le Studio (/studio) : blocs cotés, masse, centre de gravité, export STL — à construire pour ce projet."]),
    S(21, "Simulation", p.simulation ? [`${p.simulation.label} : ${p.simulation.href}`] : ["Pas de simulation spécifique ; essais sur maquette."]),
    S(22, "Étapes de réalisation", p.steps.map((s, i) => `${i + 1}. ${s}`)),
    S(23, "Procédure de montage", ["Travailler hors tension ; vérifier chaque raccordement avant la mise sous tension.", ...lib.filter((c) => c.precautions).map((c) => `${c.name} : ${c.precautions}`)]),
    S(24, "Programmation et code", code ? [`Programme « ${code.title} » (C++ Arduino-ESP32, compilé avec PlatformIO) — téléchargeable depuis la fiche du projet.`] : []),
    S(25, "Explication du code", code ? [`Structure : setup() initialise les entrées/sorties${code.network ? " et la connexion Wi-Fi/HTTPS" : ""} ; loop() lit les mesures, applique la logique et publie ou commande.`, ...codeNotes] : []),
    S(26, "Mise en service", ["Contrôle visuel et continuité ; mise sous tension sans charge ; vérification des tensions d'alimentation ; essai de chaque capteur puis de chaque actionneur ; essai fonctionnel complet.", ...p.tests.slice(0, 3)]),
    S(27, "Tests", p.tests),
    S(28, "Résultats attendus", p.expected),
    S(29, "Diagnostic des pannes", p.faults.map(([s, c]) => `${s} → cause probable : ${c}`)),
    S(30, "Solutions correctives", p.faults.map(([s, , r]) => `${s} : ${r}`)),
    S(31, "Sécurité", [...new Set([...lib.filter((c) => c.precautions).map((c) => c.precautions!), ...(p.iot ? IOT_SECURITY : []), ...(sector?.note ? [sector.note] : []), ...(sector?.critical ? ["Application critique : prototype pédagogique ; validations, certifications et autorisations requises avant tout usage réel."] : [])])]),
    S(32, "Maintenance", ["Contrôles périodiques consignés : état des connexions, propreté des capteurs, étalonnage par comparaison à une référence, état des batteries et des protections.", ...p.faults.slice(0, 3).map(([s, , r]) => `Prévention — ${s} : ${r}`)]),
    S(33, "Applications réelles", p.applications),
    S(34, "Améliorations possibles", p.improvements),
    S(35, "Documentation et références", [...lib.filter((c) => c.doc).map((c) => `${c.name} : ${c.doc}`), "Fiches techniques des références réellement employées (à joindre)."]),
  ];
}

export function dossierMarkdown(p: BankProject): string {
  return [`# ${p.title}`, "", "Dossier de projet — XAM-XAM LAB (35 rubriques)", "", ...bankDossier(p).flatMap((s) => [`## ${s.n}. ${s.title}`, "", ...s.body.map((b) => (b.startsWith("•") || /^\d+\./.test(b) ? b : `- ${b}`)), ""])].join("\n");
}
