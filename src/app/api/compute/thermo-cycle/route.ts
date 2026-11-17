import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn } from "@/server/api";
import { sql } from "@/server/db";
import { requireProject } from "@/server/access";
import { FLUIDS, runCompute } from "@/server/compute";

const schema = z.object({
  project_id: z.string().uuid().nullable().optional(),
  fluid: z.enum(FLUIDS), t_evap_c: z.number().min(-80).max(40), t_cond_c: z.number().min(-20).max(90),
  superheat_k: z.number().min(0).max(40), subcool_k: z.number().min(0).max(40), isentropic_eff: z.number().min(0.3).max(1),
  cooling_kw: z.number().positive().max(100000).nullable().optional(),
});

/** Cycle frigorifique à compression de vapeur — propriétés du fluide réel (CoolProp). Résultat enregistré comme calcul. */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const b = await readInput(req, schema);
  if (b.project_id) await requireProject(b.project_id, u, "editor");
  const { project_id, ...input } = b;
  const result = await runCompute<Record<string, unknown>>("thermo_cycle", input, 60000);
  const versions = await runCompute<Record<string, string>>("versions", {});
  await sql("INSERT INTO calc_runs(project_id, user_id, calc_kind, inputs, outputs, nature) VALUES ($1,$2,'thermo_cycle_coolprop',$3,$4,'calculation')", [project_id ?? null, u.id, JSON.stringify(input), JSON.stringify({ ...result, engine: `CoolProp ${versions.CoolProp}` })]);
  return ok({ nature: "calculation", engine: `CoolProp ${versions.CoolProp}`, result });
});
