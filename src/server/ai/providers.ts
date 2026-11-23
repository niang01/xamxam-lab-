/**
 * Fournisseurs d'IA configurables pour Aláji IA (variables serveur, aucun secret côté client) :
 *   AI_PROVIDER=anthropic          ANTHROPIC_API_KEY, AI_MODEL (facultatif)
 *   AI_PROVIDER=openai_compatible  AI_BASE_URL (ex. https://api.groq.com/openai/v1, https://router.huggingface.co/v1,
 *                                  https://generativelanguage.googleapis.com/v1beta/openai, http://localhost:11434/v1),
 *                                  AI_API_KEY (facultatif pour un serveur local), AI_MODEL (obligatoire)
 * Sans configuration : mode sans clé (moteur de règles), toujours signalé. Aucun abonnement n'est souscrit par la
 * plateforme : l'exploitant choisit un fournisseur et une offre (gratuite ou non) et fournit la clé.
 */
import { outboundFetch } from "../outbound";

export type ProviderKind = "anthropic" | "openai_compatible" | "none";
export interface ProviderConfig { kind: ProviderKind; model: string | null; baseUrl: string | null; reason?: string }

export function providerConfig(): ProviderConfig {
  const wanted = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (wanted === "openai_compatible") {
    const baseUrl = (process.env.AI_BASE_URL ?? "").trim().replace(/\/+$/, "");
    const model = (process.env.AI_MODEL ?? "").trim();
    if (!/^https?:\/\//.test(baseUrl) || !model) return { kind: "none", model: null, baseUrl: null, reason: "AI_PROVIDER=openai_compatible exige AI_BASE_URL et AI_MODEL : mode sans clé en attendant." };
    return { kind: "openai_compatible", model, baseUrl };
  }
  if ((wanted === "anthropic" || !wanted) && process.env.ANTHROPIC_API_KEY) return { kind: "anthropic", model: process.env.AI_MODEL ?? "claude-opus-5-5", baseUrl: null };
  return { kind: "none", model: null, baseUrl: null, reason: "Aucun fournisseur d'IA configuré sur le serveur (AI_PROVIDER) : Aláji IA fonctionne en mode sans clé — analyse de la demande, orientation, calculs, rapports et vérification par règles déterministes (ce n'est pas une IA générative)." };
}

export interface OaTool { name: string; description: string; parameters: Record<string, unknown> }
type OaMsg = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[]; tool_call_id?: string };

/** Boucle d'outils au format « chat completions » (fournisseurs compatibles OpenAI). */
export async function openAiCompatibleLoop(o: {
  system: string; history: { role: "user" | "assistant"; content: string }[]; question: string; tools: OaTool[];
  runTool: (name: string, input: unknown) => Promise<{ content: string }>; fetchImpl?: typeof fetch; maxTurns?: number;
}): Promise<string> {
  const c = providerConfig();
  if (c.kind !== "openai_compatible") throw new Error("Fournisseur compatible OpenAI non configuré");
  const f = o.fetchImpl ?? outboundFetch;
  const msgs: OaMsg[] = [{ role: "system", content: o.system }, ...o.history.map((h) => ({ role: h.role, content: h.content })), { role: "user", content: o.question }];
  let answer = "";
  for (let turn = 0; turn < (o.maxTurns ?? 8); turn++) {
    const r = await f(`${c.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.AI_API_KEY ? { Authorization: `Bearer ${process.env.AI_API_KEY}` } : {}) },
      body: JSON.stringify({ model: c.model, messages: msgs, tools: o.tools.map((t) => ({ type: "function", function: t })), tool_choice: "auto", max_tokens: 4000 }),
    });
    if (!r.ok) throw new Error(`Fournisseur IA : HTTP ${r.status}`);
    const data = await r.json() as { choices?: { message: OaMsg; finish_reason: string }[] };
    const m = data.choices?.[0]?.message;
    if (!m) throw new Error("Réponse du fournisseur IA sans contenu");
    if (m.content) answer = m.content;
    msgs.push({ role: "assistant", content: m.content ?? null, ...(m.tool_calls?.length ? { tool_calls: m.tool_calls } : {}) });
    if (!m.tool_calls?.length) break;
    for (const call of m.tool_calls) {
      let input: unknown = {};
      try { input = JSON.parse(call.function.arguments || "{}"); } catch { input = {}; }
      const res = await o.runTool(call.function.name, input);
      msgs.push({ role: "tool", tool_call_id: call.id, content: res.content });
    }
  }
  return answer;
}
