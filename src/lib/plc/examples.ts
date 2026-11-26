/**
 * Programmes d'exemple du laboratoire Automatisme et informatique industrielle (cas pédagogiques classiques, écrits
 * pour XAM-XAM LAB). Chaque comportement annoncé est vérifié par simulation dans tests/unit/automate.test.ts.
 * Câblage de sécurité : boutons d'arrêt et contacts de relais thermique câblés en NF (entrée à 1 au repos), comme
 * l'imposent les règles de l'art (rupture de fil = arrêt).
 */
import type { LadderProgram } from "./ladder";
import type { GrafcetProgram } from "./grafcet";

const NO = (v: string) => ({ kind: "NO" as const, v }), NC = (v: string) => ({ kind: "NC" as const, v }), P = (v: string) => ({ kind: "P" as const, v });

export const LADDER_EXAMPLES: (LadderProgram & { key: string })[] = [
  {
    key: "demarrage-direct", title: "Démarrage direct d'un moteur avec auto-maintien",
    description: "Marche par impulsion (I1), arrêt prioritaire (I2, bouton NF), protection thermique (I3, contact 95-96 NF). Voyants de marche et de défaut.",
    inputs: [{ v: "I1", label: "S1 Marche (NO)" }, { v: "I2", label: "S0 Arrêt (NF : 1 au repos)" }, { v: "I3", label: "F1 relais thermique 95-96 (NF : 1 sans défaut)" }],
    outputs: [{ v: "Q1", label: "KM1 contacteur moteur" }, { v: "Q2", label: "H1 voyant marche" }, { v: "Q3", label: "H2 voyant défaut thermique" }],
    rungs: [
      { branches: [[NO("I1"), NO("I2"), NO("I3")], [NO("Q1"), NO("I2"), NO("I3")]], out: { kind: "OUT", v: "Q1" }, comment: "Marche, auto-maintien, arrêt et thermique prioritaires" },
      { branches: [[NO("Q1")]], out: { kind: "OUT", v: "Q2" }, comment: "Voyant de marche" },
      { branches: [[NC("I3")]], out: { kind: "OUT", v: "Q3" }, comment: "Voyant de défaut" },
    ],
  },
  {
    key: "etoile-triangle", title: "Démarrage étoile-triangle temporisé",
    description: "KM1 ligne et KM2 étoile au démarrage, puis KM3 triangle après 5 s ; verrouillage étoile/triangle.",
    inputs: [{ v: "I1", label: "S1 Marche" }, { v: "I2", label: "S0 Arrêt (NF)" }, { v: "I3", label: "F1 thermique (NF)" }],
    outputs: [{ v: "Q1", label: "KM1 ligne" }, { v: "Q2", label: "KM2 étoile" }, { v: "Q3", label: "KM3 triangle" }],
    rungs: [
      { branches: [[NO("I1"), NO("I2"), NO("I3")], [NO("M1"), NO("I2"), NO("I3")]], out: { kind: "OUT", v: "M1" }, comment: "Mémoire de marche" },
      { branches: [[NO("M1")]], out: { kind: "OUT", v: "Q1" }, comment: "Contacteur de ligne" },
      { branches: [[NO("M1")]], out: { kind: "TON", v: "T1", preset: 5000 }, comment: "Durée du couplage étoile" },
      { branches: [[NO("M1"), NC("T1"), NC("Q3")]], out: { kind: "OUT", v: "Q2" }, comment: "Étoile, verrouillée par le triangle" },
      { branches: [[NO("M1"), NO("T1"), NC("Q2")]], out: { kind: "OUT", v: "Q3" }, comment: "Triangle, verrouillé par l'étoile" },
    ],
  },
  {
    key: "feux", title: "Feux tricolores (cycle temporisé)",
    description: "Vert 5 s, orange 2 s, rouge 5 s, en boucle tant que la marche (I1) est active.",
    inputs: [{ v: "I1", label: "Marche du cycle" }],
    outputs: [{ v: "Q1", label: "Feu vert" }, { v: "Q2", label: "Feu orange" }, { v: "Q3", label: "Feu rouge" }],
    rungs: [
      { branches: [[NO("I1"), NC("T3")]], out: { kind: "TON", v: "T1", preset: 5000 }, comment: "Fin du vert" },
      { branches: [[NO("T1"), NC("T3")]], out: { kind: "TON", v: "T2", preset: 2000 }, comment: "Fin de l'orange" },
      { branches: [[NO("T2")]], out: { kind: "TON", v: "T3", preset: 5000 }, comment: "Fin du rouge : le cycle recommence" },
      { branches: [[NO("I1"), NC("T1")]], out: { kind: "OUT", v: "Q1" } },
      { branches: [[NO("T1"), NC("T2")]], out: { kind: "OUT", v: "Q2" } },
      { branches: [[NO("T2")]], out: { kind: "OUT", v: "Q3" } },
    ],
  },
  {
    key: "remplissage", title: "Remplissage automatique d'un réservoir",
    description: "La pompe démarre sous le niveau bas et s'arrête au niveau haut (SET/RST) ; alarme si le niveau bas persiste 10 s pompe en marche.",
    inputs: [{ v: "I1", label: "LSL sonde basse (1 = eau au-dessus)" }, { v: "I2", label: "LSH sonde haute (1 = eau au-dessus)" }, { v: "I3", label: "Sélecteur automatique" }],
    outputs: [{ v: "Q1", label: "Pompe" }, { v: "Q2", label: "Alarme niveau bas" }],
    rungs: [
      { branches: [[NO("I3"), NC("I1")]], out: { kind: "SET", v: "Q1" }, comment: "Niveau bas : marche" },
      { branches: [[NO("I2")], [NC("I3")]], out: { kind: "RST", v: "Q1" }, comment: "Niveau haut ou mode manuel : arrêt" },
      { branches: [[NO("Q1"), NC("I1")]], out: { kind: "TON", v: "T1", preset: 10000 }, comment: "Pompe sans effet (marche à sec, fuite)" },
      { branches: [[NO("T1")]], out: { kind: "OUT", v: "Q2" } },
    ],
  },
  {
    key: "comptage", title: "Comptage de pièces et lot complet",
    description: "Chaque pièce (front de I1) incrémente C1 ; à 10 pièces le convoyeur s'arrête et le voyant « lot complet » s'allume ; I2 remet à zéro.",
    inputs: [{ v: "I1", label: "Détecteur de pièce" }, { v: "I2", label: "Remise à zéro (carton changé)" }, { v: "I3", label: "Marche convoyeur" }],
    outputs: [{ v: "Q1", label: "Voyant lot complet" }, { v: "Q2", label: "Moteur du convoyeur" }],
    rungs: [
      { branches: [[NO("I1")]], out: { kind: "CTU", v: "C1", preset: 10 }, comment: "Comptage sur front montant" },
      { branches: [[NO("I2")]], out: { kind: "CRES", v: "C1" } },
      { branches: [[NO("C1")]], out: { kind: "OUT", v: "Q1" } },
      { branches: [[NO("I3"), NC("C1")]], out: { kind: "OUT", v: "Q2" } },
    ],
  },
  {
    key: "telerupteur", title: "Télérupteur (bascule par bouton-poussoir)",
    description: "Chaque appui sur le bouton (front montant de I1) inverse l'état de l'éclairage, quel que soit le nombre de boutons en parallèle.",
    inputs: [{ v: "I1", label: "Boutons-poussoirs (en parallèle)" }], outputs: [{ v: "Q1", label: "Éclairage" }],
    rungs: [
      { branches: [[P("I1")]], out: { kind: "OUT", v: "M1" }, comment: "Impulsion d'un cycle à l'appui" },
      { branches: [[NO("M1"), NC("Q1")]], out: { kind: "SET", v: "M2" } },
      { branches: [[NO("M1"), NO("Q1")]], out: { kind: "RST", v: "Q1" } },
      { branches: [[NO("M2")]], out: { kind: "SET", v: "Q1" } },
      { branches: [[NO("M2")]], out: { kind: "RST", v: "M2" } },
    ],
  },
  {
    key: "minuterie", title: "Minuterie d'escalier (retard au déclenchement)",
    description: "L'éclairage reste allumé 30 s après le dernier appui ; un nouvel appui relance la durée.",
    inputs: [{ v: "I1", label: "Boutons-poussoirs" }], outputs: [{ v: "Q1", label: "Éclairage" }],
    rungs: [{ branches: [[NO("I1")]], out: { kind: "TOF", v: "T1", preset: 30000 } }, { branches: [[NO("T1")]], out: { kind: "OUT", v: "Q1" } }],
  },
];

export const GRAFCET_EXAMPLES: (GrafcetProgram & { key: string })[] = [
  {
    key: "verin", title: "Cycle aller-retour d'un vérin",
    description: "Départ cycle (I1) vérin rentré (I2) : sortie jusqu'à 1S2 (I3), puis rentrée jusqu'à 1S1 (I2).",
    inputs: [{ v: "I1", label: "Départ cycle (dcy)" }, { v: "I2", label: "1S1 vérin rentré" }, { v: "I3", label: "1S2 vérin sorti" }],
    outputs: [{ v: "Q1", label: "1V1-14 sortie de tige" }, { v: "Q2", label: "1V1-12 rentrée de tige" }],
    steps: [{ id: 0, initial: true, actions: [], comment: "Attente" }, { id: 1, actions: [{ kind: "N", v: "Q1" }], comment: "Sortie de tige" }, { id: 2, actions: [{ kind: "N", v: "Q2" }], comment: "Rentrée de tige" }],
    transitions: [{ id: 1, from: [0], to: [1], cond: "I1.I2" }, { id: 2, from: [1], to: [2], cond: "I3" }, { id: 3, from: [2], to: [0], cond: "I2" }],
  },
  {
    key: "perceuse", title: "Poste de perçage avec temporisation en fond de trou",
    description: "Descente avec rotation jusqu'à la position basse, maintien 2 s (débourrage), remontée avec rotation jusqu'à la position haute.",
    inputs: [{ v: "I1", label: "Départ cycle" }, { v: "I2", label: "Position haute" }, { v: "I3", label: "Position basse" }],
    outputs: [{ v: "Q1", label: "Descente" }, { v: "Q2", label: "Rotation de la broche" }, { v: "Q3", label: "Montée" }],
    steps: [{ id: 0, initial: true, actions: [] }, { id: 1, actions: [{ kind: "N", v: "Q1" }, { kind: "N", v: "Q2" }], comment: "Descente" }, { id: 2, actions: [{ kind: "N", v: "Q2" }], comment: "Fond de trou" }, { id: 3, actions: [{ kind: "N", v: "Q3" }, { kind: "N", v: "Q2" }], comment: "Remontée" }],
    transitions: [{ id: 1, from: [0], to: [1], cond: "↑I1.I2" }, { id: 2, from: [1], to: [2], cond: "I3" }, { id: 3, from: [2], to: [3], cond: "t/X2/2s" }, { id: 4, from: [3], to: [0], cond: "I2" }],
  },
  {
    key: "pietons", title: "Passage piétons sur appel",
    description: "Vert voitures en attente d'appel ; orange 3 s ; rouge voitures et vert piétons 10 s.",
    inputs: [{ v: "I1", label: "Bouton d'appel piéton" }],
    outputs: [{ v: "Q1", label: "Vert voitures" }, { v: "Q2", label: "Orange voitures" }, { v: "Q3", label: "Rouge voitures" }, { v: "Q4", label: "Vert piétons" }],
    steps: [{ id: 0, initial: true, actions: [{ kind: "N", v: "Q1" }] }, { id: 1, actions: [{ kind: "N", v: "Q2" }] }, { id: 2, actions: [{ kind: "N", v: "Q3" }, { kind: "N", v: "Q4" }] }],
    transitions: [{ id: 1, from: [0], to: [1], cond: "I1" }, { id: 2, from: [1], to: [2], cond: "t/X1/3s" }, { id: 3, from: [2], to: [0], cond: "t/X2/10s" }],
  },
  {
    key: "melangeur", title: "Mélangeur : deux remplissages simultanés (divergence et convergence en ET)",
    description: "Les cuves A et B se remplissent en parallèle ; le mélange (5 s) ne démarre que lorsque les deux sont pleines.",
    inputs: [{ v: "I1", label: "Départ cycle" }, { v: "I2", label: "Cuve A pleine" }, { v: "I3", label: "Cuve B pleine" }],
    outputs: [{ v: "Q1", label: "Vanne A" }, { v: "Q2", label: "Vanne B" }, { v: "Q3", label: "Malaxeur" }],
    steps: [{ id: 0, initial: true, actions: [] }, { id: 1, actions: [{ kind: "N", v: "Q1" }] }, { id: 2, actions: [], comment: "A pleine, attente" }, { id: 3, actions: [{ kind: "N", v: "Q2" }] }, { id: 4, actions: [], comment: "B pleine, attente" }, { id: 5, actions: [{ kind: "N", v: "Q3" }] }],
    transitions: [{ id: 1, from: [0], to: [1, 3], cond: "I1" }, { id: 2, from: [1], to: [2], cond: "I2" }, { id: 3, from: [3], to: [4], cond: "I3" }, { id: 4, from: [2, 4], to: [5], cond: "1" }, { id: 5, from: [5], to: [0], cond: "t/X5/5s" }],
  },
];
