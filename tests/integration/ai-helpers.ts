import { toolDef } from "@/server/ai/tools";
import { sql } from "@/server/db";
/** Exécute directement un outil de l'IA (comme le ferait un agent autorisé), pour tester son effet réel. */
export async function executeStepForTest(name: string, input: unknown) {
  const u = (await sql<Record<string, unknown>>("SELECT * FROM users LIMIT 1"))[0];
  const def = toolDef(name);
  return def.run(def.schema.parse(input), { user: u as never, projectId: null, conversationId: null } as never);
}
