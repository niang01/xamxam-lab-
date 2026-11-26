/**
 * Symboles graphiques conventionnels des schémas, dessinés pour XAM-XAM LAB d'après les formes normalisées :
 * CEI 60617 (électrotechnique et électronique), ISO 1219 (pneumatique et hydraulique), ISO 14617 (pompes, vannes),
 * ISA 5.1 (bulles d'instrumentation). Chaque symbole n'utilise que des polylignes et des textes, pour être rendu
 * identiquement à l'écran (SVG), dans la planche PDF et dans l'export DXF.
 *
 * Repère local : x ∈ [-30, 30], y ∈ [-20, 20], unité = unité du schéma ; bornes de circulation à gauche et à droite.
 * Les équipements complexes (automate, serveur, passerelle…) n'ont pas de symbole propre : ils restent représentés
 * par l'« élément fonctionnel » rectangulaire de la CEI 60617 (rectangle portant le repère), déjà dessiné par l'éditeur.
 */

export type Pt = [number, number];
export interface Glyph { key: string; title: string; norm: string; lines: Pt[][]; texts: { x: number; y: number; s: string; size: number }[] }

const L = (...p: Pt[]): Pt[] => p;
const circle = (cx: number, cy: number, r: number, n = 24): Pt[] => Array.from({ length: n + 1 }, (_, i) => [Math.round((cx + r * Math.cos((2 * Math.PI * i) / n)) * 100) / 100, Math.round((cy + r * Math.sin((2 * Math.PI * i) / n)) * 100) / 100]);
const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n = 12): Pt[] => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [Math.round((cx + r * Math.cos(a)) * 100) / 100, Math.round((cy + r * Math.sin(a)) * 100) / 100]; });
const ellipse = (cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = 2 * Math.PI, n = 20): Pt[] => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [Math.round((cx + rx * Math.cos(a)) * 100) / 100, Math.round((cy + ry * Math.sin(a)) * 100) / 100]; });
const rect = (x1: number, y1: number, x2: number, y2: number): Pt[] => [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]];
const T = (x: number, y: number, s: string, size = 8) => ({ x, y, s, size });
const leads = (a = 10): Pt[][] => [L([-30, 0], [-a, 0]), L([a, 0], [30, 0])];
const arrowHead = (x: number, y: number, dx: number, dy: number, s = 4): Pt[] => {
  const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  return L([x - s * ux + s * 0.6 * uy, y - s * uy - s * 0.6 * ux], [x, y], [x - s * ux - s * 0.6 * uy, y - s * uy + s * 0.6 * ux]);
};

type G = Omit<Glyph, "key">;
const g = (title: string, norm: string, lines: Pt[][], texts: Glyph["texts"] = []): G => ({ title, norm, lines, texts });
const NO: Pt[][] = [...leads(), L([-10, 0], [10, -10])];
const CEI = "CEI 60617", ISO = "ISO 1219 / ISO 14617", ISA = "ISA 5.1";

const motor = (sub: string, title: string) => g(title, CEI, [L([-30, 0], [-14, 0]), L([14, 0], [30, 0]), circle(0, 0, 14)], [T(0, -1, "M", 11), T(0, 10, sub, 7)]);

/** Bibliothèque des symboles dessinés. */
export const GLYPHS: Record<string, G> = {
  contact_no: g("Contact à fermeture (NO)", CEI, NO),
  contact_nc: g("Contact à ouverture (NF)", CEI, [...leads(), L([10, 0], [10, -8]), L([-10, 0], [13, -9])]),
  push_no: g("Bouton-poussoir à fermeture", CEI, [...NO, L([0, -5], [0, -15]), L([-5, -19], [-5, -15], [5, -15], [5, -19])]),
  emergency: g("Arrêt d'urgence (coup de poing, accrochage)", CEI, [...leads(), L([10, 0], [10, -8]), L([-10, 0], [13, -9]), L([1, -4], [1, -13]), arc(1, -13, 7, Math.PI, 2 * Math.PI)]),
  push_nc: g("Bouton-poussoir à ouverture", CEI, [...leads(), L([10, 0], [10, -8]), L([-10, 0], [13, -9]), L([1, -4], [1, -15]), L([-4, -19], [-4, -15], [6, -15], [6, -19])]),
  contactor: g("Contacteur (contacts principaux, tripolaire)", CEI, [...NO, arc(10, -3, 3, -Math.PI / 2, Math.PI / 2, 8), L([-24, 4], [-20, -4]), L([-20, 4], [-16, -4]), L([-16, 4], [-12, -4])]),
  switch: g("Interrupteur", CEI, [...NO, L([10, 0], [10, -3])]),
  breaker: g("Disjoncteur", CEI, [...NO, L([7, -3], [13, 3]), L([7, 3], [13, -3])]),
  rcd: g("Disjoncteur ou interrupteur différentiel", CEI, [...NO, L([7, -3], [13, 3]), L([7, 3], [13, -3]), circle(0, 9, 5), L([0, 4], [0, -5])], [T(18, 14, "IΔ", 7)]),
  disconnector: g("Sectionneur", CEI, [...NO, L([10, -4], [10, 4])]),
  fuse: g("Fusible", CEI, [L([-30, 0], [30, 0]), rect(-12, -5, 12, 5)]),
  fuse_disconnector: g("Sectionneur porte-fusibles", CEI, [...leads(), L([-10, 0], [10, -10]), L([10, -4], [10, 4]), [[-6, -6], [4, -11], [6, -7], [-4, -2], [-6, -6]]]),
  coil: g("Bobine de relais ou de contacteur", CEI, [...leads(12), rect(-12, -8, 12, 8)]),
  coil_delay: g("Bobine temporisée", CEI, [...leads(12), rect(-12, -8, 12, 8), rect(-12, -8, -5, 8), L([-12, -8], [-5, 8]), L([-12, 8], [-5, -8])]),
  impulse_relay: g("Télérupteur (relais à impulsion)", CEI, [...leads(12), rect(-12, -8, 12, 8), L([-12, 0], [12, 0])]),
  thermal_relay: g("Relais thermique (déclencheur à maximum de courant thermique)", CEI, [...leads(12), rect(-12, -8, 12, 8), L([-8, 3], [-4, 3], [-4, -3], [4, -3], [4, 3], [8, 3])]),
  surge: g("Parafoudre", CEI, [L([0, -20], [0, -10]), rect(-5, -10, 5, 8), L([0, -6], [0, 4]), arrowHead(0, 4, 0, 1), L([0, 8], [0, 13]), L([-8, 13], [8, 13]), L([-5, 16], [5, 16]), L([-2, 19], [2, 19])]),
  motor3: motor("3~", "Moteur asynchrone triphasé"),
  motor1: motor("1~", "Moteur asynchrone monophasé"),
  motor_dc: motor("=", "Moteur à courant continu"),
  motor_step: motor("pas", "Moteur pas à pas"),
  motor_bl: motor("BL", "Moteur sans balais"),
  servo: motor("SV", "Servomoteur"),
  generator: g("Générateur / groupe électrogène", CEI, [L([-30, 0], [-14, 0]), L([14, 0], [30, 0]), circle(0, 0, 14)], [T(0, -1, "G", 11), T(0, 10, "~", 8)]),
  transformer: g("Transformateur à deux enroulements", CEI, [L([-30, 0], [-17, 0]), L([17, 0], [30, 0]), circle(-7, 0, 10), circle(7, 0, 10)]),
  lamp: g("Lampe, voyant, point lumineux", CEI, [...leads(10), circle(0, 0, 10), L([-7, -7], [7, 7]), L([-7, 7], [7, -7])]),
  socket: g("Prise de courant", CEI, [L([-30, 0], [0, 0], [0, -4]), arc(0, -4, 10, Math.PI, 2 * Math.PI), L([-10, -4], [10, -4])]),
  earth: g("Terre", CEI, [L([0, -16], [0, 0]), L([-12, 0], [12, 0]), L([-8, 5], [8, 5]), L([-4, 10], [4, 10])]),
  chassis: g("Masse", CEI, [L([0, -16], [0, 0]), L([-12, 0], [12, 0]), L([-12, 0], [-16, 6]), L([-4, 0], [-8, 6]), L([4, 0], [0, 6]), L([12, 0], [8, 6])]),
  battery: g("Batterie d'accumulateurs", CEI, [L([-30, 0], [-4, 0]), L([4, 0], [30, 0]), L([-4, -12], [-4, 12]), L([4, -6], [4, 6]), L([3.5, -6], [3.5, 6])], [T(-10, -12, "+", 9), T(10, -12, "−", 9)]),
  pv: g("Module photovoltaïque", CEI, [...leads(14), rect(-14, -10, 14, 10), L([-14, 10], [14, -10]), L([-26, -20], [-17, -13]), arrowHead(-17, -13, 1, 0.8), L([-20, -20], [-11, -13]), arrowHead(-11, -13, 1, 0.8)]),
  inverter: g("Onduleur (convertisseur continu/alternatif)", CEI, [...leads(12), rect(-12, -12, 12, 12), L([-12, 12], [12, -12])], [T(-6, -3, "=", 9), T(6, 9, "~", 9)]),
  rectifier: g("Redresseur (convertisseur alternatif/continu)", CEI, [...leads(12), rect(-12, -12, 12, 12), L([-12, 12], [12, -12])], [T(-6, -3, "~", 9), T(6, 9, "=", 9)]),
  dcdc: g("Convertisseur continu/continu, régulateur de charge", CEI, [...leads(12), rect(-12, -12, 12, 12), L([-12, 12], [12, -12])], [T(-6, -3, "=", 9), T(6, 9, "=", 9)]),
  vfd: g("Variateur de fréquence (convertisseur de fréquence)", CEI, [...leads(12), rect(-12, -12, 12, 12), L([-12, 12], [12, -12])], [T(-6, -3, "f1", 7), T(6, 9, "f2", 7)]),
  meter: g("Compteur d'énergie", CEI, [...leads(14), rect(-14, -10, 14, 10)], [T(0, 4, "Wh", 9)]),
  resistor: g("Résistance", CEI, [...leads(12), rect(-12, -5, 12, 5)]),
  heater: g("Élément chauffant", CEI, [...leads(12), rect(-12, -5, 12, 5), L([-6, -5], [-6, 5]), L([0, -5], [0, 5]), L([6, -5], [6, 5])]),
  capacitor: g("Condensateur", CEI, [L([-30, 0], [-3, 0]), L([3, 0], [30, 0]), L([-3, -11], [-3, 11]), L([3, -11], [3, 11])]),
  inductor: g("Bobine (inductance)", CEI, [L([-30, 0], [-16, 0]), L([16, 0], [30, 0]), ...[-12, -4, 4, 12].map((c) => arc(c, 0, 4, Math.PI, 2 * Math.PI, 8))]),
  diode: g("Diode", CEI, [...leads(6), [[-6, -7], [-6, 7], [6, 0], [-6, -7]], L([6, -7], [6, 7])]),
  zener: g("Diode Zener", CEI, [...leads(6), [[-6, -7], [-6, 7], [6, 0], [-6, -7]], L([3, -9], [6, -7], [6, 7], [9, 9])]),
  led: g("Diode électroluminescente (LED)", CEI, [...leads(6), [[-6, -7], [-6, 7], [6, 0], [-6, -7]], L([6, -7], [6, 7]), L([2, -9], [9, -16]), arrowHead(9, -16, 1, -1), L([7, -6], [14, -13]), arrowHead(14, -13, 1, -1)]),
  npn: g("Transistor bipolaire NPN", CEI, [circle(0, 0, 14), L([-30, 0], [-5, 0]), L([-5, -9], [-5, 9]), L([-5, -4], [8, -12], [8, -20]), L([-5, 4], [8, 12], [8, 20]), arrowHead(8, 12, 1, 0.6)]),
  nmos: g("Transistor MOSFET à canal N (enrichissement)", CEI, [circle(0, 0, 14), L([-30, 4], [-8, 4]), L([-8, -8], [-8, 8]), L([-4, -9], [-4, -5]), L([-4, -2], [-4, 2]), L([-4, 5], [-4, 9]), L([-4, -7], [8, -7], [8, -20]), L([-4, 7], [8, 7], [8, 20]), L([-4, 0], [8, 0], [8, 7]), arrowHead(-4, 0, -1, 0)]),
  opamp: g("Amplificateur opérationnel", CEI, [[[-14, -14], [-14, 14], [14, 0], [-14, -14]], L([-30, -7], [-14, -7]), L([-30, 7], [-14, 7]), L([14, 0], [30, 0])], [T(-9, -4, "−", 8), T(-9, 10, "+", 8)]),
  vsource: g("Source de tension", CEI, [...leads(10), circle(0, 0, 10)], [T(-4, 3, "+", 8), T(5, 3, "−", 8)]),
  isource: g("Source de courant", CEI, [...leads(10), circle(0, 0, 10), L([-6, 0], [6, 0]), arrowHead(6, 0, 1, 0)]),
  buzzer: g("Avertisseur sonore", CEI, [L([-30, 0], [-8, 0]), L([8, 0], [30, 0]), arc(0, 4, 9, Math.PI, 2 * Math.PI), L([-9, 4], [9, 4])]),
  limit_switch: g("Interrupteur de position (fin de course)", CEI, [...NO, L([0, -5], [0, -11]), circle(0, -14, 3, 12)]),
  proximity: g("Détecteur de proximité", CEI, [...leads(12), rect(-12, -12, 12, 12), [[0, -9], [9, 0], [0, 9], [-9, 0], [0, -9]]]),
  pump: g("Pompe", ISO, [L([-30, 0], [-12, 0]), L([12, 0], [30, 0]), circle(0, 0, 12), L([-6, -10], [12, 0], [-6, 10])]),
  valve: g("Vanne (robinet d'arrêt)", ISO, [L([-30, 0], [-12, 0]), L([12, 0], [30, 0]), [[-12, -8], [12, 8], [12, -8], [-12, 8], [-12, -8]]]),
  solenoid_valve: g("Électrovanne", ISO, [L([-30, 0], [-12, 0]), L([12, 0], [30, 0]), [[-12, -6], [12, 6], [12, -6], [-12, 6], [-12, -6]], L([0, 0], [0, -11]), rect(-6, -19, 6, -11), L([-6, -11], [6, -19])]),
  check_valve: g("Clapet anti-retour", ISO, [L([-30, 0], [-12, 0]), L([10, 0], [30, 0]), L([-6, -9], [4, 0], [-6, 9]), circle(4, 0, 5, 12)]),
  regulating_valve: g("Vanne de régulation, détendeur, réducteur de pression", ISO, [L([-30, 0], [-12, 0]), L([12, 0], [30, 0]), [[-12, -8], [12, 8], [12, -8], [-12, 8], [-12, -8]], L([-10, 12], [10, -12]), arrowHead(10, -12, 1, -1.2)]),
  cylinder: g("Vérin double effet", ISO, [rect(-22, -9, 12, 9), L([-6, -9], [-6, 9]), L([-6, 0], [28, 0]), L([-16, 9], [-16, 14]), L([6, 9], [6, 14])]),
  valve_52: g("Distributeur 5/2", ISO, [rect(-24, -10, 0, 10), rect(0, -10, 24, 10), L([-20, 6], [-4, -6]), arrowHead(-4, -6, 1, -0.75), L([-4, 6], [-20, -6]), arrowHead(-20, -6, -1, -0.75), L([4, 6], [4, -6]), arrowHead(4, -6, 0, -1), L([20, -6], [20, 6]), arrowHead(20, 6, 0, 1)]),
  air_source: g("Source de pression (air comprimé)", ISO, [L([10, 0], [30, 0]), circle(0, 0, 10), [[0, -7], [6, 4], [-6, 4], [0, -7]]]),
  filter: g("Filtre", ISO, [L([-30, 0], [-12, 0]), L([12, 0], [30, 0]), [[0, -12], [12, 0], [0, 12], [-12, 0], [0, -12]], L([0, -12], [0, -8]), L([0, -5], [0, -1]), L([0, 2], [0, 6]), L([0, 9], [0, 12])]),
  manometer: g("Manomètre", ISO, [L([0, 20], [0, 10]), circle(0, 0, 10), L([-6, 6], [6, -6]), arrowHead(6, -6, 1, -1)]),
  fan: g("Ventilateur", ISO, [L([-30, 0], [-12, 0]), L([12, 0], [30, 0]), circle(0, 0, 12), [[0, 0], [-4, -10], [4, -10], [0, 0]], [[0, 0], [-4, 10], [4, 10], [0, 0]]]),
  compressor: g("Compresseur", ISO, [L([-30, 0], [-12, 0]), L([12, 0], [30, 0]), circle(0, 0, 12), L([-10, -6], [10, -3]), L([-10, 6], [10, 3])]),
  exchanger: g("Échangeur de chaleur, évaporateur, condenseur", ISO, [...leads(14), rect(-14, -10, 14, 10), L([-14, 0], [-9, -6], [-3, 6], [3, -6], [9, 6], [14, 0])]),
  tank: g("Réservoir, cuve, ballon", ISO, [L([-14, -14], [-14, 12], [14, 12], [14, -14]), L([-14, -2], [-9, -4], [-4, -2], [1, -4], [6, -2], [11, -4], [14, -2])]),
  solar_collector: g("Capteur solaire thermique", ISO, [...leads(14), rect(-14, -10, 14, 10), L([-10, 6], [-6, -6], [-2, 6], [2, -6], [6, 6], [10, -6]), L([-26, -20], [-17, -13]), arrowHead(-17, -13, 1, 0.8)]),
  instrument: g("Instrument de mesure (bulle d'instrumentation)", ISA, [L([-30, 0], [-12, 0]), circle(0, 0, 12)]),
  mcu: g("Circuit intégré, carte à microcontrôleur", CEI, [rect(-16, -11, 16, 11), ...[-12, -6, 0, 6, 12].flatMap((x) => [L([x, -11], [x, -15]), L([x, 11], [x, 15])])]),
  antenna: g("Antenne", CEI, [L([0, 18], [0, -6]), L([-9, -16], [0, -6], [9, -16]), L([-9, -16], [9, -16])]),
  radio: g("Module radio (émetteur-récepteur)", CEI, [rect(-14, -6, 10, 14), L([4, -6], [4, -16]), L([-1, -20], [4, -16], [9, -20])]),
  database: g("Base de données", "Usage courant (organigrammes)", [ellipse(0, -12, 12, 4), L([-12, -12], [-12, 12]), L([12, -12], [12, 12]), ellipse(0, 12, 12, 4, 0, Math.PI)]),
};

/** Règles de choix : le NOM de l'équipement prime (les codes de repère sont ambigus : Q, V…), puis le code. */
const BY_NAME: [RegExp, string][] = [
  // Ensembles et équipements sans symbole élémentaire : élément fonctionnel rectangulaire.
  [/d[ée]marreur|optocoupleur|gradateur|r[ée]gulateur de tension|syst[èe]me de gestion de batterie|\bbms\b|driver|relais statique|contr[ôo]leur de pompe|lecteur de carte|carte m[èe]re|agitateur/, ""],
  [/^chargeur de batterie secteur|^alimentation (\d|de pc)|bloc d.alimentation/, "rectifier"], [/^chargeur de batterie/, "dcdc"],
  [/permutateur|va.et.vient/, "switch"],
  // Éléments dérivés d'un appareil : la fonction du contact prime sur le code de l'appareil (KM1 13-14 = contact, pas bobine).
  [/bouton.*(arr[eê]t|\(nf\))/, "push_nc"], [/bouton.*(marche|\(no\))/, "push_no"], [/^bobine/, "coil"],
  [/contact (d.auto.maintien|de signalisation|auxiliaire [àa] fermeture)|\(no\)$/, "contact_no"],
  [/contact du relais thermique|contact .*[àa] ouverture|\(nf\)$/, "contact_nc"],
  [/^contacteur(?! auxiliaire)/, "contactor"], [/parc de batteries/, "battery"],
  [/source d.air|air comprim/, "air_source"], [/^filtre(?! [àa] h2s)/, "filter"],
  [/arr[eê]t d.urgence/, "emergency"], [/fin de course|interrupteur de position/, "limit_switch"],
  [/bouton.poussoir|bouton poussoir/, "push_no"], [/d[ée]tecteur de proximit|d[ée]tecteur photo/, "proximity"],
  [/disjoncteur.*diff|interrupteur diff/, "rcd"], [/disjoncteur/, "breaker"],
  [/porte.fusible/, "fuse_disconnector"], [/sectionneur/, "disconnector"], [/fusible/, "fuse"],
  [/relais thermique/, "thermal_relay"], [/parafoudre/, "surge"], [/t[ée]l[ée]rupteur/, "impulse_relay"],
  [/temporis|minuterie/, "coil_delay"], [/contacteur|relais [ée]lectrom|module relais|relais de s[ée]curit|^relais$/, "coil"],
  [/moteur asynchrone triphas/, "motor3"], [/moteur asynchrone monophas/, "motor1"], [/^moteur pas [àa] pas/, "motor_step"],
  [/sans balais|brushless/, "motor_bl"], [/servomoteur/, "servo"], [/moteur [àa] courant continu/, "motor_dc"],
  [/groupe [ée]lectrog/, "generator"], [/transformateur/, "transformer"],
  [/variateur de (vitesse|fr[ée]quence)/, "vfd"], [/onduleur(?! autonome sans)/, "inverter"], [/^ups$|alimentation sans interruption/, "inverter"],
  [/pont de diodes|redresseur/, "rectifier"], [/r[ée]gulateur de charge|convertisseur dc.?dc|convertisseur continu|abaisseur|[ée]l[ée]vateur/, "dcdc"],
  [/compteur (d.[ée]nergie|divisionnaire)|compteur [ée]lectrique/, "meter"],
  [/voyant|luminaire|point lumineux|lampe/, "lamp"], [/^led$|ruban led|diode [ée]lectrolumin/, "led"],
  [/prise (de courant|sp[ée]cialis|connect)/, "socket"], [/piquet de terre|barrette de coupure de terre/, "earth"], [/^masse$/, "chassis"],
  [/^batterie(?! de condensateurs)|accumulateur/, "battery"], [/module photovolta/, "pv"],
  [/r[ée]sistance chauffante|thermoplongeur|[ée]l[ée]ment chauffant/, "heater"], [/^r[ée]sistance$/, "resistor"],
  [/condensateur/, "capacitor"], [/bobine \(inductance\)|inductance/, "inductor"],
  [/zener|tvs/, "zener"], [/diode/, "diode"], [/transistor.*npn|bipolaire npn|^transistor npn/, "npn"], [/mosfet/, "nmos"],
  [/amplificateur op[ée]rationnel/, "opamp"], [/source de tension/, "vsource"], [/source de courant/, "isource"],
  [/buzzer|avertisseur sonore|sir[èe]ne/, "buzzer"],
  [/[ée]lectrovanne/, "solenoid_valve"], [/clapet anti.retour/, "check_valve"],
  [/vanne de r[ée]gulation|d[ée]tendeur|r[ée]ducteur de pression/, "regulating_valve"], [/vanne|robinet/, "valve"],
  [/v[ée]rin/, "cylinder"], [/distributeur pneumatique 5\/2|distributeur 5\/2/, "valve_52"], [/manom[èe]tre/, "manometer"],
  [/^pompe(?! [àa] chaleur)|^circulateur/, "pump"], [/ventilateur|a[ée]rateur/, "fan"], [/^compresseur/, "compressor"],
  [/[ée]changeur|[ée]vaporateur|condenseur/, "exchanger"],
  [/^(r[ée]servoir|citerne|cuve|ballon|vase d.expansion|chauffe.eau|digesteur)/, "tank"], [/capteur solaire|capteur [àa] tubes/, "solar_collector"],
  [/base de donn[ée]es/, "database"],
  [/^antenne$/, "antenna"], [/module (lora|gsm|nb.iot|5g|bluetooth|zigbee|z.wave|4g)|radio de t[ée]l[ée]m|balise bluetooth|liaison radio/, "radio"],
  [/^(carte (esp|arduino|stm32|de calcul)|seeed xiao|esp32|raspberry|arduino)|microcontr|processeur/, "mcu"],
  [/capteur|sonde|d[ée]bitm[èe]tre|transmetteur|an[ée]mom[èe]tre|pluviom|pyranom|girouette|tensiom[èe]tre|thermocouple|pt100|pressostat|thermostat|d[ée]tecteur|t[ée]l[ée]m[èe]tre|codeur rotatif|pince amp/, "instrument"],
  [/interrupteur|commutateur(?! ethernet| \(switch\))|s[ée]lecteur/, "switch"],
];
const BY_CODE: Record<string, string> = {
  QF: "breaker", QM: "breaker", ID: "rcd", FU: "fuse", KM: "coil", KA: "coil", K: "coil", KT: "coil_delay", KL: "impulse_relay",
  M3: "motor3", M1: "motor1", MDC: "motor_dc", MS: "motor_step", MB: "motor_bl", SV: "servo", GE: "generator", T: "transformer",
  H: "lamp", E: "lamp", XS: "socket", X: "socket", GND: "chassis", BAT: "battery", PV: "pv", INV: "inverter", VFD: "vfd", MPPT: "dcdc", PWM: "dcdc",
  Wh: "meter", R: "resistor", C: "capacitor", L: "inductor", D: "diode", DZ: "zener", LED: "led", I: "isource", HA: "buzzer",
  SQ: "limit_switch", S: "push_no", YV: "solenoid_valve", CY: "cylinder", Y: "valve_52", PI: "manometer", PU: "pump", FAN: "fan",
  RES: "tank", ANT: "antenna", MCU: "mcu", SBC: "mcu", DB: "database", TSDB: "database", F: "thermal_relay",
};

const norm = (s: string) => s.toLowerCase().normalize("NFC").trim();

/** Symbole conventionnel d'un équipement, ou null (élément fonctionnel rectangulaire). */
export function glyphFor(name: string, code: string): Glyph | null {
  const n = norm(name);
  for (const [re, key] of BY_NAME) if (re.test(n)) return key ? withKey(key, key === "instrument" ? code : null) : null;
  const key = BY_CODE[code];
  return key ? withKey(key, null) : null;
}

function withKey(key: string, tag: string | null): Glyph {
  const base = GLYPHS[key];
  // Bulle ISA : le repère fonctionnel de l'instrument (TT, PT, FT…) est inscrit dans le cercle.
  return { key, ...base, texts: tag ? [...base.texts, T(0, 3, tag.slice(0, 4), tag.length > 2 ? 7 : 9)] : base.texts };
}

/** Transformation du repère local vers le schéma : centre (cx, cy), rotation en degrés, échelle. */
export function placeGlyph(gl: Glyph, cx: number, cy: number, rot = 0, scale = 1): { lines: Pt[][]; texts: Glyph["texts"] } {
  const r = (rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const tr = ([x, y]: Pt): Pt => [Math.round((cx + scale * (x * c - y * s)) * 100) / 100, Math.round((cy + scale * (x * s + y * c)) * 100) / 100];
  return { lines: gl.lines.map((l) => l.map(tr)), texts: gl.texts.map((t) => { const [x, y] = tr([t.x, t.y]); return { ...t, x, y, size: t.size * scale }; }) };
}

/** Fragment SVG (polylignes et textes) d'un symbole placé. */
export function glyphSvg(gl: Glyph, cx: number, cy: number, rot = 0, scale = 1, color = "#111"): string {
  const p = placeGlyph(gl, cx, cy, rot, scale);
  const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
  return p.lines.map((l) => `<polyline points="${l.map(([x, y]) => `${x},${y}`).join(" ")}" fill="none" stroke="${color}" stroke-width="${1.4 * scale}" stroke-linejoin="round"/>`).join("")
    + p.texts.map((t) => `<text x="${t.x}" y="${t.y}" font-size="${t.size}" text-anchor="middle" fill="${color}">${esc(t.s)}</text>`).join("");
}
