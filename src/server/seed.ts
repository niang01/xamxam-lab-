/**
 * Données de référence : composants GÉNÉRIQUES (fonction et usage, sans caractéristique de fabricant).
 * Aucune valeur constructeur n'est inventée : un composant réel s'ajoute avec sa référence et sa fiche technique
 * (statut « à vérifier » jusqu'à vérification).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Db } from "./db";
import { LIBRARY } from "@/lib/library";
import { BUILTIN_COURSES } from "@/lib/courses-builtin";

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

/** Anciens noms des composants génériques (renommés dans src/lib/library.ts) : renommés en place, sans doublon. */
const RENAMED: Record<string, string> = {
  "Diode (modèle générique)": "Diode", "Transistor bipolaire NPN": "Transistor NPN", "Transistor MOSFET canal N": "MOSFET canal N",
  "Batterie": "Batterie plomb", "Onduleur": "Onduleur autonome", "Relais": "Module relais",
};
/** Doublons retirés de la bibliothèque (25/11/2026) : fusionnés dans l'entrée d'origine, références reportées. */
const MERGED: Record<string, string> = {
  "ESP32 DevKit (ESP32-WROOM-32)": "Carte ESP32", "Seeed Studio XIAO ESP32S3": "Seeed XIAO ESP32-S3", "ESP8266 NodeMCU": "Carte ESP8266",
  "Transistor bipolaire NPN": "Transistor NPN",
  "Transistor MOSFET canal N": "MOSFET canal N",
  "Régulateur linéaire de tension": "Régulateur de tension linéaire",
  "Convertisseur abaisseur (buck)": "Convertisseur DC-DC abaisseur",
  "LED et résistance de limitation": "LED",
  "Variateur de fréquence": "Variateur de vitesse",
  "Module 4G LTE (Cat-1 / Cat-M)": "Module GSM/4G",
  "Routeur 4G industriel": "Modem / routeur 4G",
  "Arduino Uno": "Carte Arduino (famille Uno)", "Arduino Mega 2560": "Carte Arduino Mega", "Carte STM32 Nucleo": "Carte STM32 (Nucleo)",
};
const SIMULABLE = new Set(["R", "C", "L", "D", "V", "I", "GND"]);

/** Chargement de la bibliothèque générique. Une erreur ici ne doit jamais rendre la plateforme indisponible. */
export async function seed(db: Db) {
  try { await seedLibrary(db); }
  catch (e) { console.error("[xamxam] bibliothèque non mise à jour (la plateforme reste disponible) :", e instanceof Error ? e.message : e); }
  try { await seedCatalogue(db); }
  catch (e) { console.error("[xamxam] catalogue de références non mis à jour (la plateforme reste disponible) :", e instanceof Error ? e.message : e); }
  try { await seedCourses(db); }
  catch (e) { console.error("[xamxam] cours intégrés non mis à jour (la plateforme reste disponible) :", e instanceof Error ? e.message : e); }
}

/** Cours intégrés : insérés ou mis à jour par leur clé (l'identifiant, donc les inscriptions et certificats, est conservé). */
async function seedCourses(db: Db) {
  const fingerprint = createHash("sha256").update(JSON.stringify(BUILTIN_COURSES)).digest("hex");
  const done = (await db.query<{ value: string }>("SELECT value FROM server_keys WHERE name='courses_version'")).rows[0]?.value;
  if (done === fingerprint) return;
  for (const c of BUILTIN_COURSES) {
    await db.query(
      `INSERT INTO courses(author_id, builtin_key, title, domain, level, lang, summary, lessons, quiz, pass_mark, lab_link, published)
       VALUES (NULL,$1,$2,$3,$4,'fr',$5,$6,$7,$8,$9,true)
       ON CONFLICT (builtin_key) DO UPDATE SET title=EXCLUDED.title, domain=EXCLUDED.domain, level=EXCLUDED.level, summary=EXCLUDED.summary,
         lessons=EXCLUDED.lessons, quiz=EXCLUDED.quiz, pass_mark=EXCLUDED.pass_mark, lab_link=EXCLUDED.lab_link, published=true`,
      [c.key, c.title, c.domain, c.level, c.summary, JSON.stringify(c.lessons), JSON.stringify(c.quiz), c.pass_mark, c.lab_link]);
  }
  await db.query("INSERT INTO server_keys(name, value) VALUES ('courses_version',$1) ON CONFLICT (name) DO UPDATE SET value=EXCLUDED.value", [fingerprint]);
}

async function seedLibrary(db: Db) {
  // La bibliothèque n'est réécrite que si son contenu a changé (empreinte conservée en base).
  const fingerprint = createHash("sha256").update(JSON.stringify(LIBRARY)).digest("hex");
  const done = (await db.query<{ value: string }>("SELECT value FROM server_keys WHERE name='library_version'")).rows[0]?.value;
  if (done === fingerprint) return;
  const generic = async (name: string) => (await db.query<{ id: string; category: string }>("SELECT id, category FROM components WHERE name=$1 AND mpn='generic' ORDER BY created_at", [name])).rows;
  // Ancienne liste (avant src/lib/library.ts) : insérée seulement si aucun composant générique de ce nom (ou de son nouveau nom) n'existe.
  for (const [category, name, symbol, description, fn, pins, precautions] of GENERIC_COMPONENTS) {
    if ((await generic(name)).length || (RENAMED[name] && (await generic(RENAMED[name])).length) || LIBRARY.some((c) => c.name === name)) continue;
    await db.query(
      `INSERT INTO components(category, name, symbol_kind, description, function, pins, precautions, status, source, mpn)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'generic','Composant générique XAM-XAM LAB (aucune caractéristique de fabricant)','generic')
       ON CONFLICT (category, name, mpn) DO NOTHING`, [category, name, symbol, description, fn, JSON.stringify(pins), precautions]);
  }
  for (const [from, to] of Object.entries(RENAMED)) {
    await db.query("UPDATE components SET name=$2 WHERE name=$1 AND mpn='generic' AND NOT EXISTS (SELECT 1 FROM components WHERE name=$2 AND mpn='generic')", [from, to]);
  }
  for (const [from, to] of Object.entries(MERGED)) {
    const old = await generic(from), keep = (await generic(to))[0];
    for (const r of old) {
      if (keep) {
        await db.query("UPDATE project_components SET component_id=$2 WHERE component_id=$1", [r.id, keep.id]);
        await db.query("UPDATE market_listings SET component_id=$2 WHERE component_id=$1", [r.id, keep.id]);
        await db.query("DELETE FROM components WHERE id=$1", [r.id]);
      } else await db.query("UPDATE components SET name=$2 WHERE id=$1", [r.id, to]);
    }
  }
  for (const c of LIBRARY) {
    // Doublons hérités (même nom, catégories différentes) : fusion sur une seule ligne, références reportées.
    const rows = await generic(c.name);
    if (rows.length > 1) {
      const keep = rows.find((r) => r.category === c.category) ?? rows[0];
      for (const r of rows) if (r.id !== keep.id) {
        await db.query("UPDATE project_components SET component_id=$2 WHERE component_id=$1", [r.id, keep.id]);
        await db.query("UPDATE market_listings SET component_id=$2 WHERE component_id=$1", [r.id, keep.id]);
        await db.query("DELETE FROM components WHERE id=$1", [r.id]);
      }
    }
    const values = [c.category, c.name, SIMULABLE.has(c.symbol) ? c.symbol : null, c.description, c.fn, JSON.stringify(c.pins), c.precautions, c.discipline, JSON.stringify(c.params), c.symbol, c.doc || null];
    const updated = await db.query(
      `UPDATE components SET category=$1, symbol_kind=COALESCE(symbol_kind, $3), description=$4, function=$5, pins=$6, precautions=$7, discipline=$8, params=$9, symbol2d=$10, doc=$11
        WHERE name=$2 AND mpn='generic' RETURNING id`, values);
    if (!updated.rows.length) {
      await db.query(
        `INSERT INTO components(category, name, symbol_kind, description, function, pins, precautions, discipline, params, symbol2d, doc, status, source, mpn)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'generic','Composant générique XAM-XAM LAB (aucune caractéristique de fabricant)','generic')
         ON CONFLICT (category, name, mpn) DO NOTHING`, values);
    }
  }
  await db.query("INSERT INTO server_keys(name, value) VALUES ('library_version', $1) ON CONFLICT (name) DO UPDATE SET value=EXCLUDED.value", [fingerprint]);
}

/** Référence du catalogue (data/catalogue/references.json, construit par scripts/catalogue/build.py). */
export interface CatalogueRef {
  key: string; model: string; manufacturer: string | null; manufacturer_source: string | null; discipline: string; category: string; subcategory: string;
  code: string | null; description_en: string; keywords: string; datasheet: string; footprint: string | null;
  pins: { n: string; name: string; type: string }[]; variants: string[];
  photos: { file: string; author: string; license: string; license_url: string | null; source: string; title: string; view?: string }[];
  model3d: string | null; sources: { label: string; url: string | null; license?: string }[]; board?: string;
}
export function loadCatalogue(): CatalogueRef[] {
  const file = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "catalogue", "references.json");
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as CatalogueRef[]) : [];
}
const SIMULABLE_CODES: Record<string, string> = { D: "D", DZ: "D", LED: "D" };

/**
 * Catalogue de références réelles : ajout ou mise à jour par clé stable. Rien n'est supprimé (les références ajoutées
 * par les utilisateurs, et celles retirées d'une future version du fichier, sont conservées).
 */
async function seedCatalogue(db: Db) {
  const refs = loadCatalogue();
  if (!refs.length) return;
  const fingerprint = createHash("sha256").update(JSON.stringify(refs)).digest("hex");
  const done = (await db.query<{ value: string }>("SELECT value FROM server_keys WHERE name='catalogue_version'")).rows[0]?.value;
  if (done === fingerprint) return;
  for (const r of refs) {
    const desc = `${r.subcategory} ${r.model}${r.manufacturer ? ` (${r.manufacturer})` : ""}.${r.description_en ? ` Description de la bibliothèque KiCad (en anglais) : ${r.description_en}` : ""}`;
    const specs: Record<string, string> = {};
    if (r.footprint) specs["Empreinte (KiCad)"] = r.footprint;
    if (r.keywords) specs["Mots-clés"] = r.keywords;
    if (r.manufacturer_source) specs["Fabricant déduit de"] = r.manufacturer_source;
    if (r.variants.length) specs["Variantes"] = r.variants.slice(0, 12).join(", ");
    const pins = [...new Set(r.pins.map((p) => p.name && p.name !== "~" ? p.name : p.n))].slice(0, 60);
    await db.query(
      `INSERT INTO components(catalogue_key, category, subcategory, name, description, function, manufacturer, mpn, datasheet_url, specs, pins, pinout,
         symbol_kind, symbol2d, discipline, status, source, photos, model3d, footprint, sources, variants)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'catalogue',$16,$17,$18,$19,$20,$21)
       ON CONFLICT (catalogue_key) DO UPDATE SET category=EXCLUDED.category, subcategory=EXCLUDED.subcategory, name=EXCLUDED.name, description=EXCLUDED.description,
         function=EXCLUDED.function, manufacturer=EXCLUDED.manufacturer, mpn=EXCLUDED.mpn, datasheet_url=EXCLUDED.datasheet_url, specs=EXCLUDED.specs,
         pins=EXCLUDED.pins, pinout=EXCLUDED.pinout, symbol_kind=EXCLUDED.symbol_kind, symbol2d=EXCLUDED.symbol2d, discipline=EXCLUDED.discipline,
         source=EXCLUDED.source, photos=EXCLUDED.photos, model3d=EXCLUDED.model3d, footprint=EXCLUDED.footprint, sources=EXCLUDED.sources, variants=EXCLUDED.variants`,
      [r.key, r.category, r.subcategory, r.model, desc, r.subcategory, r.manufacturer, r.model, r.datasheet || null, JSON.stringify(specs), JSON.stringify(pins),
        JSON.stringify(r.board ? { board: r.board, pins: r.pins } : { pins: r.pins }), r.code ? SIMULABLE_CODES[r.code] ?? null : null, r.code, r.discipline,
        r.sources.map((x) => x.label).join(" ; "), JSON.stringify(r.photos), r.model3d, r.footprint, JSON.stringify(r.sources), JSON.stringify(r.variants)]);
  }
  await db.query("INSERT INTO server_keys(name, value) VALUES ('catalogue_version',$1) ON CONFLICT (name) DO UPDATE SET value=EXCLUDED.value", [fingerprint]);
}
