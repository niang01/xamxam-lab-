/** Registre des logiciels de dimensionnement (un logiciel = un moteur pur testé). */
import type { Software } from "./types";
import { ELECTRICAL } from "./electrical";
import { PV } from "./pv";
import { PUMPING } from "./pumping";
import { DRYING } from "./drying";
import { BIOMASS } from "./biomass";
import { COMPOST } from "./compost";
import { SOLAR_THERMAL } from "./solar-thermal";

export const SOFTWARE: Software[] = [ELECTRICAL, PV, PUMPING, SOLAR_THERMAL, DRYING, BIOMASS, COMPOST];
export const softwareByKey = (k: string) => SOFTWARE.find((s) => s.key === k) ?? null;
/** Description publique (sans fonction) pour le client. */
export const softwareDef = (s: Software) => ({ key: s.key, title: s.title, discipline: s.discipline, lab: s.lab, summary: s.summary, sections: s.sections, example: s.example, needs: s.needs ?? [] });
