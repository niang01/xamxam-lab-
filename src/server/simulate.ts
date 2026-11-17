/** Exécution d'une simulation de circuit : ERC → netlist → ngspice → enregistrement traçable. */
import { sql } from "./db";
import { toNetlist, type Analysis, type Graph } from "@/lib/spice/netlist";
import { runSpice } from "./spice";

export function analysisLabel(a: Analysis) {
  switch (a.kind) {
    case "op": return "Point de fonctionnement (.op)";
    case "tran": return `Transitoire (.tran ${a.step} ${a.stop})`;
    case "dc": return `Balayage DC de V${a.source} (${a.start} → ${a.stop}, pas ${a.step})`;
    case "ac": return `Analyse fréquentielle (.ac dec ${a.points} ${a.fstart} ${a.fstop})`;
  }
}

export async function simulateGraph(graph: Graph, analysis: Analysis, ctx: { userId: string; projectId: string | null; schematicId: string | null; by: "human" | "ai"; title?: string }) {
  let net: { netlist: string; issues: ReturnType<typeof toNetlist>["issues"] };
  try { net = toNetlist(graph, analysis, ctx.title); } catch (e) { return { ok: false as const, issues: [{ level: "error" as const, message: e instanceof Error ? e.message : String(e) }] }; }
  if (!net.netlist) return { ok: false as const, issues: net.issues };
  const r = await runSpice(net.netlist);
  const row = (await sql<{ id: string }>(`INSERT INTO simulations(project_id, user_id, schematic_id, engine, engine_version, kind, analysis, input, input_hash, status, result, errors, duration_ms, initiated_by)
    VALUES ($1,$2,$3,'ngspice',$4,'numerical_solver',$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [ctx.projectId, ctx.userId, ctx.schematicId, r.engine, analysisLabel(analysis), net.netlist, r.inputHash, r.ok ? "done" : "failed", r.ok ? JSON.stringify({ traces: r.traces, points: r.points, complex: r.complex }) : null, JSON.stringify(r.errors), r.durationMs, ctx.by]))[0];
  return { ok: r.ok, id: row.id, issues: net.issues, netlist: net.netlist, engine: r.engine, errors: r.errors, traces: r.traces, points: r.points, complex: r.complex, durationMs: r.durationMs, inputHash: r.inputHash, nature: "simulation" as const };
}
