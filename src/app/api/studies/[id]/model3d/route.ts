import { ok, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { audit } from "@/server/audit";
import { myStudy } from "@/server/studies";
import { modelFromStudy } from "@/lib/studies/model3d";
import { assemblySchema } from "@/lib/assembly";

type Ctx = { params: Promise<{ id: string }> };

/** Crée la maquette 3D (Studio) d'une étude enregistrée, à partir des dimensions saisies ou calculées. */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const s = await myStudy(await uuidParam(ctx), u);
  const m = modelFromStudy(s.software, s.inputs, s.result);
  if (!m.assembly) throw new ApiFailure(422, m.missing.length ? `Maquette impossible — données manquantes : ${m.missing.join(", ")}` : m.note, "err.invalid");
  const graph = assemblySchema.parse(m.assembly);
  const row = (await sql<{ id: string }>("INSERT INTO schematics(project_id, owner_id, lab, title, graph) VALUES ($1,$2,'assembly',$3,$4) RETURNING id", [s.project_id, u.id, `Maquette — ${s.title}`, JSON.stringify(graph)]))[0];
  await sql("INSERT INTO schematic_versions(schematic_id, version, graph, message, created_by) VALUES ($1,1,$2,$3,$4)", [row.id, JSON.stringify(graph), `Générée depuis l'étude « ${s.title} »`, u.id]);
  await audit(u.id, "human", "assembly.create", { kind: "schematic", id: row.id }, { study: s.id });
  return ok({ id: row.id, note: m.note, parts: graph.parts.length }, 201);
});
