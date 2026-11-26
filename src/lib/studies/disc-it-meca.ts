/**
 * Logiciels : informatique (stockage, sauvegarde, onduleur), réseaux (adressage, câblage, budget optique,
 * commutateurs), télécommunications (bilan de liaison radio), mécanique (transmission, arbre, roulements),
 * génie industriel (TRS, takt time, stocks). Moteurs purs ; caractéristiques des équipements saisies.
 */
import { vlsm } from "@/lib/eng/network";
import { empty, finish, grab, nf, num, r2, req, rows, type Software, type StudyResult } from "./types";

const RAID: Record<string, { min: number; usable: (n: number, c: number) => number; tol: string }> = {
  "0": { min: 2, usable: (n, c) => n * c, tol: "aucune panne de disque" },
  "1": { min: 2, usable: (_n, c) => c, tol: "n − 1 disques (miroir)" },
  "5": { min: 3, usable: (n, c) => (n - 1) * c, tol: "1 disque" },
  "6": { min: 4, usable: (n, c) => (n - 2) * c, tol: "2 disques" },
  "10": { min: 4, usable: (n, c) => (n / 2) * c, tol: "1 disque par miroir" },
};

export const IT: Software = {
  key: "informatique", title: "Informatique : stockage (RAID), croissance, sauvegardes, onduleur", discipline: "informatique", lab: "network",
  summary: "Capacité utile d'une grappe de disques selon le niveau RAID, besoin à l'horizon choisi, volume de sauvegarde (complète + incrémentales sur la durée de rétention), puissance et autonomie de l'onduleur.",
  sections: [
    { title: "1. Stockage", fields: [nf("disks", "Nombre de disques", ""), nf("disk_tb", "Capacité d'un disque", "To"), { key: "raid", label: "Niveau RAID", type: "select", options: Object.keys(RAID).map((k) => ({ v: k, l: `RAID ${k}` })) }, nf("data_tb", "Données actuelles", "To"), nf("growth", "Croissance annuelle", "%"), nf("years", "Horizon", "ans")] },
    { title: "2. Sauvegardes", fields: [nf("change", "Taux de modification quotidien", "%"), nf("retention", "Rétention", "jours"), nf("fulls", "Sauvegardes complètes conservées", "")] },
    { title: "3. Onduleur", equipment: [{ label: "Onduleur", names: ["Alimentation sans interruption (UPS)"], map: {} }], fields: [nf("load_w", "Puissance des équipements protégés", "W"), nf("pf", "Facteur de puissance de l'onduleur (fiche)", ""), nf("bat_wh", "Énergie des batteries de l'onduleur (fiche)", "Wh"), nf("eta_ups", "Rendement de l'onduleur", "%"), nf("t_need", "Autonomie demandée", "min")] },
  ],
  example: { disks: 6, disk_tb: 4, raid: "6", data_tb: 6, growth: 25, years: 3, change: 3, retention: 30, fulls: 2, load_w: 600, pf: 0.9, bat_wh: 432, eta_ups: 90, t_need: 15 },
  run: (input): StudyResult => {
    const res = empty();
    const v = grab(res, input, { disks: ["nombre de disques", { positive: true }], disk_tb: ["capacité d'un disque (To)", { positive: true }], data_tb: ["données actuelles (To)", { min: 0 }], growth: ["croissance annuelle (%)", { min: 0 }], years: ["horizon (ans)", { min: 0 }], change: ["taux de modification quotidien (%)", { min: 0, max: 100 }], retention: ["rétention (jours)", { positive: true }], fulls: ["sauvegardes complètes conservées", { positive: true }], load_w: ["puissance protégée (W)", { positive: true }], pf: ["facteur de puissance", { positive: true, max: 1 }], bat_wh: ["énergie des batteries (Wh)", { positive: true }], eta_ups: ["rendement (%)", { positive: true, max: 100 }], t_need: ["autonomie demandée (min)", { positive: true }] });
    const rd = RAID[String(input.raid ?? "")]; if (!rd) res.missing.push("niveau RAID");
    if (!res.missing.length && v.disks < rd.min) res.missing.push(`au moins ${rd.min} disques pour ce niveau RAID`);
    if (!res.missing.length && String(input.raid) === "10" && v.disks % 2) res.missing.push("nombre pair de disques pour le RAID 10");
    if (res.missing.length) return finish(res);
    const usable = rd.usable(v.disks, v.disk_tb), need = v.data_tb * (1 + v.growth / 100) ** v.years;
    res.steps.push({ title: "1. Stockage", ok: usable >= need, lines: [{ label: "Capacité brute", value: v.disks * v.disk_tb, unit: "To" }, { label: "Capacité utile", value: r2(usable, 4), unit: "To", formula: `RAID ${input.raid}` }, { label: "Tolérance aux pannes", value: rd.tol }, { label: "Besoin à l'horizon", value: r2(need, 4), unit: "To", formula: "D × (1 + g)ⁿ" }, { label: "Taux de remplissage à l'horizon", value: r2((100 * need) / usable, 3), unit: "%" }] });
    if (usable < need) res.warnings.push("Capacité utile insuffisante à l'horizon choisi");
    const backup = v.fulls * need + need * (v.change / 100) * v.retention;
    res.steps.push({ title: "2. Sauvegardes", lines: [{ label: "Volume de sauvegarde", value: r2(backup, 4), unit: "To", formula: "complètes × V + V × taux × rétention (sans compression ni déduplication)" }] });
    const va = v.load_w / v.pf, minutes = (v.bat_wh * (v.eta_ups / 100) / v.load_w) * 60;
    res.steps.push({ title: "3. Onduleur", ok: minutes >= v.t_need, lines: [{ label: "Puissance apparente minimale", value: r2(va, 4), unit: "VA", formula: "P / facteur de puissance" }, { label: "Autonomie estimée", value: r2(minutes, 3), unit: "min", formula: "E_bat × η / P (décharge à puissance constante, batteries neuves)" }] });
    if (minutes < v.t_need) res.warnings.push("Autonomie de l'onduleur insuffisante : batteries supplémentaires");
    res.bom = [{ name: "Disque SSD", qty: v.disks, unit: "u", spec: `${v.disk_tb} To (ou disques durs de même capacité)` }, { name: "Serveur", qty: 1, unit: "u", spec: `${v.disks} baies, contrôleur RAID ${input.raid}` }, { name: "Alimentation sans interruption (UPS)", qty: 1, unit: "u", spec: `≥ ${Math.ceil(va)} VA, ≥ ${v.t_need} min à ${v.load_w} W` }];
    res.summary = [{ label: "Capacité utile", value: r2(usable, 3), unit: "To" }, { label: "Autonomie de l'onduleur", value: r2(minutes, 3), unit: "min" }];
    return finish(res);
  },
};

export const NETWORK: Software = {
  key: "reseaux", title: "Réseaux : plan d'adressage VLSM, câblage, budget optique, commutateurs", discipline: "reseau", lab: "network",
  summary: "Plan d'adressage IPv4 par sous-réseau (VLSM), vérification des liens cuivre (100 m) et du budget de puissance des liaisons optiques, nombre de commutateurs ; schéma en étoile et nomenclature.",
  sections: [
    { title: "1. Adressage", fields: [{ key: "block", label: "Bloc d'adresses", type: "text", hint: "ex. 192.168.0.0/22" }, { key: "lans", label: "Sous-réseaux", type: "rows", cols: [{ key: "name", label: "Nom", type: "text" }, { key: "hosts", label: "Hôtes", type: "int" }] }] },
    { title: "2. Liens", fields: [{ key: "links", label: "Liens", type: "rows", cols: [{ key: "name", label: "Lien", type: "text" }, { key: "medium", label: "Support", type: "select", options: [{ v: "cuivre", l: "Cuivre (paires torsadées)" }, { v: "fibre", l: "Fibre optique" }] }, { key: "length", label: "Longueur", unit: "m", type: "number" }, { key: "connectors", label: "Connecteurs", type: "int" }, { key: "splices", label: "Épissures", type: "int" }] }, nf("att", "Affaiblissement de la fibre (fiche)", "dB/km"), nf("conn_loss", "Perte par connecteur", "dB"), nf("splice_loss", "Perte par épissure", "dB"), nf("tx", "Puissance d'émission du module optique", "dBm"), nf("rx", "Sensibilité du récepteur", "dBm"), nf("margin", "Marge exigée", "dB")] },
    { title: "3. Commutateurs", fields: [nf("ports", "Ports par commutateur", ""), nf("uplinks", "Ports réservés aux liaisons montantes", ""), nf("spare", "Réserve de ports", "%")] },
  ],
  example: { block: "192.168.0.0/22", lans: [{ name: "Administration", hosts: 60 }, { name: "Salles de TP", hosts: 200 }, { name: "Wi-Fi invités", hosts: 120 }, { name: "Caméras", hosts: 25 }], links: [{ name: "Bâtiment A → B", medium: "fibre", length: 450, connectors: 2, splices: 1 }, { name: "Salle TP 1", medium: "cuivre", length: 78, connectors: 2, splices: 0 }], att: 3.5, conn_loss: 0.5, splice_loss: 0.1, tx: -5, rx: -20, margin: 3, ports: 24, uplinks: 2, spare: 20 },
  run: (input): StudyResult => {
    const res = empty();
    const v = grab(res, input, { att: ["affaiblissement de la fibre (dB/km)", { positive: true }], conn_loss: ["perte par connecteur (dB)", { min: 0 }], splice_loss: ["perte par épissure (dB)", { min: 0 }], tx: ["puissance d'émission (dBm)"], rx: ["sensibilité du récepteur (dBm)"], margin: ["marge exigée (dB)", { min: 0 }], ports: ["ports par commutateur", { positive: true }], uplinks: ["ports de liaison montante", { min: 0 }], spare: ["réserve de ports (%)", { min: 0 }] });
    const lans = rows(input.lans).map((x) => ({ name: String(x.name || "LAN"), hosts: num(x.hosts) ?? 0 })).filter((x) => x.hosts > 0);
    if (!lans.length) res.missing.push("au moins un sous-réseau avec un nombre d'hôtes");
    if (!String(input.block ?? "").includes("/")) res.missing.push("bloc d'adresses en notation CIDR");
    if (res.missing.length) return finish(res);
    const plan = vlsm(String(input.block), lans);
    if (!plan.subnets?.length) { res.warnings.push(...plan.warnings, ...plan.missing); return finish(res); }
    res.steps.push({ title: "1. Plan d'adressage (VLSM)", lines: plan.subnets.map((s) => ({ label: s.name, value: `${s.network}/${s.prefix}`, formula: `${s.first} – ${s.last} (${s.hosts} hôtes utilisables)` })) });
    if (plan.warnings.length) res.warnings.push(...plan.warnings.filter((w) => !/ : \d+\.\d+/.test(w)));
    const budget = v.tx - v.rx;
    for (const l of rows(input.links)) {
      const n = String(l.name || "lien"), len = num(l.length);
      if (!req(res, len, `${n} : longueur (m)`, { positive: true })) continue;
      if (l.medium === "fibre") {
        const loss = (len / 1000) * v.att + (num(l.connectors) ?? 0) * v.conn_loss + (num(l.splices) ?? 0) * v.splice_loss;
        const ok = budget - loss >= v.margin;
        res.steps.push({ title: `2. ${n} (fibre)`, ok, lines: [{ label: "Pertes du lien", value: r2(loss, 3), unit: "dB", formula: "L × α + connecteurs + épissures" }, { label: "Budget du module", value: r2(budget, 3), unit: "dB", formula: "Ptx − sensibilité" }, { label: "Marge", value: r2(budget - loss, 3), unit: "dB", formula: `≥ ${v.margin} dB exigés` }] });
        if (!ok) res.warnings.push(`${n} : marge optique insuffisante`);
      } else {
        const ok = len <= 100;
        res.steps.push({ title: `2. ${n} (cuivre)`, ok, lines: [{ label: "Longueur du canal", value: len, unit: "m", formula: "≤ 100 m (canal Ethernet sur paires torsadées)" }] });
        if (!ok) res.warnings.push(`${n} : plus de 100 m — fibre ou commutateur intermédiaire`);
      }
    }
    const hosts = lans.reduce((a, l) => a + l.hosts, 0), perSwitch = v.ports - v.uplinks;
    const sw = Math.ceil((hosts * (1 + v.spare / 100)) / perSwitch);
    res.steps.push({ title: "3. Commutateurs d'accès", lines: [{ label: "Hôtes", value: hosts }, { label: "Commutateurs", value: sw, formula: `⌈hôtes × (1 + réserve) / (${v.ports} − ${v.uplinks})⌉ (hôtes filaires ; Wi-Fi : points d'accès)` }] });
    const fibreM = rows(input.links).filter((l) => l.medium === "fibre").reduce((a, l) => a + (num(l.length) ?? 0), 0), cuM = rows(input.links).filter((l) => l.medium !== "fibre").reduce((a, l) => a + (num(l.length) ?? 0), 0);
    res.bom = [{ name: "Commutateur (switch)", qty: sw, unit: "u", spec: `${v.ports} ports` }, { name: "Routeur", qty: 1, unit: "u", spec: `${lans.length} sous-réseaux (VLAN)` }, { name: "Pare-feu", qty: 1, unit: "u", spec: "" }, ...(cuM ? [{ name: "Câble à paires torsadées (RJ45)", qty: cuM, unit: "m", spec: "catégorie selon le débit visé" }] : []), ...(fibreM ? [{ name: "Fibre optique", qty: fibreM, unit: "m", spec: `${v.att} dB/km` }, { name: "Répartiteur optique (ODF)", qty: 2, unit: "u", spec: "" }] : [])];
    res.references.push("Longueur maximale d'un canal Ethernet sur paires torsadées : 100 m (ISO/CEI 11801, TIA-568)");
    res.summary = [{ label: "Sous-réseaux", value: plan.subnets.length }, { label: "Commutateurs", value: sw }];
    res.diagram = { kind: "reseau_etoile", params: { hosts: Math.min(16, Math.max(1, sw * 2)), cidr: `${plan.subnets[0].network}/${plan.subnets[0].prefix}` } };
    return finish(res);
  },
};

export const TELECOM: Software = {
  key: "telecommunications", title: "Télécommunications : bilan de liaison radio, zone de Fresnel, portée", discipline: "telecom", lab: "network",
  summary: "Bilan de liaison en espace libre (point à point, LoRa, Wi-Fi, 4G) : affaiblissement, puissance reçue, marge, rayon de la première zone de Fresnel et portée maximale théorique.",
  sections: [{ title: "1. Liaison", equipment: [{ label: "Antenne", names: ["Antenne"], map: {} }], fields: [nf("f", "Fréquence", "MHz"), nf("d", "Distance", "km"), nf("ptx", "Puissance d'émission", "dBm"), nf("gtx", "Gain d'antenne émission", "dBi"), nf("grx", "Gain d'antenne réception", "dBi"), nf("lc", "Pertes câbles et connecteurs (total)", "dB"), nf("srx", "Sensibilité du récepteur (fiche)", "dBm"), nf("fade", "Marge d'évanouissement exigée", "dB")] }],
  example: { f: 868, d: 5, ptx: 14, gtx: 2, grx: 6, lc: 2, srx: -137, fade: 15 },
  run: (input): StudyResult => {
    const res = empty();
    const v = grab(res, input, { f: ["fréquence (MHz)", { positive: true }], d: ["distance (km)", { positive: true }], ptx: ["puissance d'émission (dBm)"], gtx: ["gain d'émission (dBi)"], grx: ["gain de réception (dBi)"], lc: ["pertes câbles (dB)", { min: 0 }], srx: ["sensibilité (dBm)"], fade: ["marge exigée (dB)", { min: 0 }] });
    if (res.missing.length) return finish(res);
    const fspl = 20 * Math.log10(v.d) + 20 * Math.log10(v.f) + 32.44;
    const prx = v.ptx + v.gtx + v.grx - v.lc - fspl, margin = prx - v.srx;
    const r1 = 17.32 * Math.sqrt(v.d / (4 * (v.f / 1000)));
    const dMax = 10 ** ((v.ptx + v.gtx + v.grx - v.lc - v.srx - v.fade - 32.44 - 20 * Math.log10(v.f)) / 20);
    res.steps.push({ title: "1. Bilan de liaison", ok: margin >= v.fade, lines: [
      { label: "Affaiblissement en espace libre", value: r2(fspl, 4), unit: "dB", formula: "20 log d(km) + 20 log f(MHz) + 32,44" },
      { label: "Puissance reçue", value: r2(prx, 4), unit: "dBm", formula: "Ptx + Gtx + Grx − pertes − FSPL" }, { label: "Marge", value: r2(margin, 4), unit: "dB", formula: `≥ ${v.fade} dB exigés` },
      { label: "Rayon de la 1re zone de Fresnel (milieu)", value: r2(r1, 4), unit: "m", formula: "17,32 √(d / (4 f[GHz])) ; dégager au moins 60 %" },
      { label: "Portée maximale théorique (espace libre)", value: r2(dMax, 4), unit: "km" },
    ] });
    if (margin < v.fade) res.warnings.push("Marge insuffisante : antennes plus directives, mât plus haut ou distance réduite");
    res.warnings.push("Espace libre : obstacles, végétation, relief et réglementation locale (puissance, cycle d'utilisation) à prendre en compte");
    res.bom = [{ name: "Antenne", qty: 2, unit: "u", spec: `${v.gtx} dBi et ${v.grx} dBi, ${v.f} MHz` }, { name: "Câble coaxial", qty: 1, unit: "lot", spec: `pertes totales ≤ ${v.lc} dB` }, { name: "Liaison radio point à point", qty: 1, unit: "paire", spec: `${v.f} MHz, sensibilité ${v.srx} dBm` }];
    res.summary = [{ label: "Puissance reçue", value: r2(prx, 3), unit: "dBm" }, { label: "Marge", value: r2(margin, 3), unit: "dB" }];
    return finish(res);
  },
};

export const MECHANICAL: Software = {
  key: "mecanique", title: "Mécanique : transmission, couple, diamètre d'arbre, durée de vie des roulements", discipline: "mecanique", lab: "mechanical",
  summary: "Transmission par réducteur ou courroie (rapport, couple et puissance de sortie avec facteur de service), diamètre minimal d'un arbre en torsion, durée de vie nominale L10 des roulements.",
  sections: [
    { title: "1. Transmission", fields: [nf("p_kw", "Puissance du moteur", "kW"), nf("n_in", "Vitesse du moteur", "tr/min"), nf("n_out", "Vitesse de sortie souhaitée", "tr/min"), { key: "kind", label: "Transmission", type: "select", options: [{ v: "reducteur", l: "Réducteur à engrenages" }, { v: "courroie", l: "Courroie et poulies" }] }, nf("eta", "Rendement de la transmission (fiche)", "%"), nf("ks", "Facteur de service (selon l'application)", "")] },
    { title: "2. Arbre de sortie", fields: [nf("tau", "Contrainte de cisaillement admissible du matériau", "MPa")] },
    { title: "3. Roulements", fields: [nf("c_kn", "Charge dynamique de base C (fiche)", "kN"), nf("p_bear", "Charge équivalente P", "kN"), { key: "btype", label: "Type", type: "select", options: [{ v: "billes", l: "À billes (p = 3)" }, { v: "rouleaux", l: "À rouleaux (p = 10/3)" }] }, nf("life_h", "Durée de vie exigée", "h")] },
  ],
  example: { p_kw: 5.5, n_in: 1450, n_out: 145, kind: "reducteur", eta: 94, ks: 1.4, tau: 40, c_kn: 25.5, p_bear: 3.2, btype: "billes", life_h: 20000 },
  run: (input): StudyResult => {
    const res = empty();
    const v = grab(res, input, { p_kw: ["puissance (kW)", { positive: true }], n_in: ["vitesse d'entrée (tr/min)", { positive: true }], n_out: ["vitesse de sortie (tr/min)", { positive: true }], eta: ["rendement (%)", { positive: true, max: 100 }], ks: ["facteur de service", { min: 1, max: 4 }], tau: ["contrainte admissible (MPa)", { positive: true }], c_kn: ["charge dynamique C (kN)", { positive: true }], p_bear: ["charge équivalente P (kN)", { positive: true }], life_h: ["durée de vie exigée (h)", { positive: true }] });
    if (res.missing.length) return finish(res);
    const i = v.n_in / v.n_out, pOut = v.p_kw * 1000 * v.eta / 100, cOut = pOut / (2 * Math.PI * v.n_out / 60), cDesign = cOut * v.ks;
    res.steps.push({ title: "1. Transmission", lines: [{ label: "Rapport de réduction", value: r2(i, 4), formula: "i = n_entrée / n_sortie" }, { label: "Puissance de sortie", value: r2(pOut / 1000, 4), unit: "kW" }, { label: "Couple de sortie", value: r2(cOut, 4), unit: "N·m", formula: "C = P / ω" }, { label: "Couple de dimensionnement", value: r2(cDesign, 4), unit: "N·m", formula: "C × facteur de service" }] });
    const d = Math.cbrt((16 * cDesign) / (Math.PI * v.tau * 1e6)) * 1000;
    res.steps.push({ title: "2. Arbre (torsion seule)", lines: [{ label: "Diamètre minimal", value: r2(d, 4), unit: "mm", formula: "d = ∛(16 C / (π τ_adm))" }] });
    res.warnings.push("Arbre : flexion combinée, concentrations de contrainte (clavettes, épaulements) et fatigue à vérifier");
    const p = input.btype === "rouleaux" ? 10 / 3 : 3, l10 = (v.c_kn / v.p_bear) ** p, l10h = (l10 * 1e6) / (60 * v.n_out);
    res.steps.push({ title: "3. Roulements de sortie", ok: l10h >= v.life_h, lines: [{ label: "Durée L10", value: r2(l10, 4), unit: "millions de tours", formula: `(C / P)^${input.btype === "rouleaux" ? "10/3" : "3"}` }, { label: "Durée L10h", value: Math.round(l10h), unit: "h", formula: "L10 × 10⁶ / (60 n)" }] });
    if (l10h < v.life_h) res.warnings.push("Durée de vie des roulements insuffisante");
    res.references.push("Durée nominale des roulements : ISO 281 (L10 = (C/P)^p)");
    res.bom = [{ name: input.kind === "courroie" ? "Courroie et poulies" : "Réducteur à engrenages", qty: 1, unit: "u", spec: `i = ${r2(i, 3)}, ≥ ${r2(cDesign, 3)} N·m` }, { name: "Roulement à billes", qty: 2, unit: "u", spec: `C ≥ ${v.c_kn} kN` }, { name: "Moteur asynchrone triphasé", qty: 1, unit: "u", spec: `${v.p_kw} kW, ${v.n_in} tr/min` }];
    res.summary = [{ label: "Couple de sortie", value: r2(cOut, 4), unit: "N·m" }, { label: "Diamètre d'arbre minimal", value: r2(d, 3), unit: "mm" }, { label: "L10h", value: Math.round(l10h), unit: "h" }];
    return finish(res);
  },
};

export const INDUSTRIAL: Software = {
  key: "genie-industriel", title: "Génie industriel : TRS, takt time, équilibrage de ligne, stocks", discipline: "mecanique", lab: "mechanical",
  summary: "Taux de rendement synthétique (disponibilité × performance × qualité), takt time et nombre minimal de postes, quantité économique de commande (Wilson), stock de sécurité et point de commande.",
  sections: [
    { title: "1. TRS", fields: [nf("planned", "Temps d'ouverture", "min"), nf("down", "Arrêts", "min"), nf("cycle", "Temps de cycle idéal", "s"), nf("count", "Pièces produites", ""), nf("good", "Pièces bonnes", "")] },
    { title: "2. Ligne", fields: [nf("demand", "Demande", "pièces/poste"), nf("avail", "Temps disponible par poste", "min"), { key: "tasks", label: "Opérations", type: "rows", cols: [{ key: "name", label: "Opération", type: "text" }, { key: "t", label: "Durée", unit: "s", type: "number" }] }] },
    { title: "3. Stocks", fields: [nf("d_year", "Demande annuelle", "unités"), nf("s_order", "Coût de passation d'une commande", "FCFA"), nf("h_hold", "Coût de possession unitaire annuel", "FCFA"), nf("d_day", "Demande moyenne journalière", "unités"), nf("sigma", "Écart-type de la demande journalière", "unités"), nf("lead", "Délai d'approvisionnement", "jours"), nf("z", "Coefficient de service z", "", { hint: "Choisi selon le taux de service visé" })] },
  ],
  example: { planned: 480, down: 45, cycle: 30, count: 780, good: 760, demand: 800, avail: 450, tasks: [{ name: "Découpe", t: 25 }, { name: "Perçage", t: 18 }, { name: "Assemblage", t: 40 }, { name: "Contrôle", t: 12 }], d_year: 12000, s_order: 50000, h_hold: 1200, d_day: 48, sigma: 9, lead: 7, z: 1.65 },
  run: (input): StudyResult => {
    const res = empty();
    const v = grab(res, input, { planned: ["temps d'ouverture (min)", { positive: true }], down: ["arrêts (min)", { min: 0 }], cycle: ["temps de cycle idéal (s)", { positive: true }], count: ["pièces produites", { min: 0 }], good: ["pièces bonnes", { min: 0 }], demand: ["demande par poste", { positive: true }], avail: ["temps disponible (min)", { positive: true }], d_year: ["demande annuelle", { positive: true }], s_order: ["coût de commande", { positive: true }], h_hold: ["coût de possession", { positive: true }], d_day: ["demande journalière", { min: 0 }], sigma: ["écart-type journalier", { min: 0 }], lead: ["délai (jours)", { min: 0 }], z: ["coefficient z", { min: 0, max: 5 }] });
    if (!res.missing.length && (v.down > v.planned || v.good > v.count)) res.missing.push("arrêts ≤ temps d'ouverture et pièces bonnes ≤ pièces produites");
    if (res.missing.length) return finish(res);
    const run = v.planned - v.down, A = run / v.planned, P = (v.cycle * v.count) / (run * 60), Q = v.count ? v.good / v.count : 0;
    res.steps.push({ title: "1. TRS", lines: [{ label: "Disponibilité", value: r2(100 * A, 4), unit: "%" }, { label: "Performance", value: r2(100 * P, 4), unit: "%", formula: "temps de cycle idéal × pièces / temps de marche" }, { label: "Qualité", value: r2(100 * Q, 4), unit: "%" }, { label: "TRS", value: r2(100 * A * P * Q, 4), unit: "%", formula: "D × P × Q" }] });
    if (P > 1) res.warnings.push("Performance > 100 % : temps de cycle idéal surestimé");
    const takt = (v.avail * 60) / v.demand, sum = rows(input.tasks).reduce((a, t) => a + (num(t.t) ?? 0), 0);
    const over = rows(input.tasks).filter((t) => (num(t.t) ?? 0) > takt).map((t) => String(t.name));
    res.steps.push({ title: "2. Takt time et postes", ok: !over.length, lines: [{ label: "Takt time", value: r2(takt, 4), unit: "s", formula: "temps disponible / demande" }, { label: "Contenu de travail", value: sum, unit: "s" }, { label: "Nombre minimal de postes", value: Math.ceil(sum / takt), formula: "⌈Σ t / takt⌉" }] });
    if (over.length) res.warnings.push(`Opérations plus longues que le takt (à dédoubler) : ${over.join(", ")}`);
    const eoq = Math.sqrt((2 * v.d_year * v.s_order) / v.h_hold), ss = v.z * v.sigma * Math.sqrt(v.lead);
    res.steps.push({ title: "3. Stocks", lines: [{ label: "Quantité économique (Wilson)", value: Math.round(eoq), unit: "unités", formula: "√(2 D S / H)" }, { label: "Commandes par an", value: r2(v.d_year / eoq, 3) }, { label: "Stock de sécurité", value: Math.ceil(ss), unit: "unités", formula: "z σ √L" }, { label: "Point de commande", value: Math.ceil(v.d_day * v.lead + ss), unit: "unités", formula: "d L + SS" }] });
    res.summary = [{ label: "TRS", value: r2(100 * A * P * Q, 3), unit: "%" }, { label: "Takt time", value: r2(takt, 3), unit: "s" }, { label: "Quantité économique", value: Math.round(eoq) }];
    return finish(res);
  },
};
