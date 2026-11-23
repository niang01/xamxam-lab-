/**
 * Aláji IA — cerveau central de XAM-XAM LAB : analyse de la demande, orchestrateur d'agents, moteur d'exécution
 * d'outils, vérification et gouvernance.
 *  - Mode « llm » : fournisseur configurable (Anthropic ou compatible OpenAI, voir providers.ts), boucle d'outils ;
 *  - mode « rules » (sans clé) : moteur de règles déterministe, TOUJOURS signalé comme tel (pas une IA générative).
 *  - Dans les deux modes : analyse déterministe de la demande (disciplines, type de projet, intentions) et contrôle
 *    des résultats par l'agent vérificateur, inscrit dans le journal ai_steps.
 *  - Chaque appel d'outil passe par la gouvernance (coupe-circuit, agent activé, liste blanche, niveau d'autonomie)
 *    et est inscrit dans ai_steps ; le compte rendu des opérations est construit à partir de ce journal.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { sql, sqlOne } from "../db";
import { env } from "../env";
import type { User } from "../api";
import { getSetting } from "../settings";
import { audit } from "../audit";
import { decide, effectiveLevel, EFFECT_LEVEL } from "@/lib/autonomy";
import { AGENTS, ownerOf, selectAgents, toolsFor, type AgentDef } from "./agents";
import { CALCS, CALC_KINDS } from "../calc";
import { TOOLS, toolDef, toolJsonSchema, type ToolCtx, type ToolName } from "./tools";
import { analyseRequest, DISCIPLINE_LINKS, INTENT_LABEL, PROJECT_TYPE_LABEL, verificationText, verifySteps, type RequestAnalysis } from "./analysis";
import { openAiCompatibleLoop, providerConfig } from "./providers";

export interface Step { id: string; agent_key: string; tool: string; status: string; error: string | null; required_level: number; output?: unknown }
export interface CoreAnswer { conversationId: string; mode: "llm" | "rules"; model: string | null; answer: string; agents: string[]; steps: Step[]; warning?: string; level: number; analysis?: RequestAnalysis; verification?: { ok: boolean; checked: number; issues: string[] } }

const SUPPORTED_FALLBACK = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-2", "claude-fable-5-1", "claude-sonnet-5-5"]);
const fallbackParams = (model: string) => (SUPPORTED_FALLBACK.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {});

export const SYSTEM_PROMPT = `Tu es Aláji IA, le cerveau central de XAM-XAM LAB, plateforme internationale d'ingénierie, de simulation, de formation et d'innovation née au Sénégal.
Tu coordonnes des agents spécialisés (listés ci-dessous) et tu utilises UNIQUEMENT les outils fournis.

Règles impératives :
- N'invente jamais une mesure, une donnée NASA ou satellitaire, un coefficient normatif, une caractéristique de composant, un prix ou une référence bibliographique. Si une donnée manque, dis-le, demande-la, ou passe null à l'outil : il listera les paramètres manquants.
- Tous les calculs passent par run_calculation ou simulate_circuit : ne refais aucun calcul de tête ; cite les résultats, unités, formules, hypothèses et le moteur (avec sa version) renvoyés par l'outil.
- Distingue toujours : fait, mesure (capteur, datée), donnée modélisée (NASA POWER, régionale), prédiction (Meteomatics), calcul, simulation, recommandation, décision.
- Ne dis jamais qu'une opération a été réalisée si l'outil ne l'a pas confirmée. Une action « en attente d'approbation » n'est PAS réalisée : dis-le.
- Équipements : tu ne fais que PROPOSER (propose_device_command). Une personne habilitée confirme ; l'appareil applique ses propres limites ; « exécutée » seulement sur accusé de l'appareil.
- Les seuils d'automatisation sont fixés par l'utilisateur, jamais par toi.
- Sécurité physique et réglementation : rappelle quand une installation exige un professionnel habilité ou une autorisation (ANACIM pour les drones).
- Pour une demande complexe : analyse → informations manquantes → plan (agents, outils) → exécution → vérification (unités, cohérence) → synthèse.
- Réponds de façon structurée et concise.`;

const LANG_NAMES: Record<string, string> = { wo: "wolof", fr: "français", en: "English" };

async function languageInstruction(lang: string): Promise<string> {
  if (lang === "fr") return "Langue de réponse : français.";
  if (lang === "en") return "Response language: English.";
  const gl = await sql<{ key: string; text: string }>("SELECT key, text FROM translations WHERE lang='wo' AND key LIKE 'gloss.%' AND status='validated' LIMIT 300");
  return `Langue demandée : wolof. Réponds en wolof si tu le maîtrises suffisamment, sinon en français en le disant. Commence par la ligne en français : « Réponse générée en wolof, non validée par un locuteur natif. » N'invente pas de terme wolof pour une notion scientifique : garde le terme scientifique et explique-le. Garde chiffres et unités inchangés.${gl.length ? ` Glossaire VALIDÉ à utiliser : ${gl.map((g) => `${g.key.slice(6)} → ${g.text}`).join(" ; ")}.` : " Aucun glossaire wolof validé n'existe encore."}`;
}

async function conversation(user: User, id: string | null | undefined, projectId: string | null, title: string) {
  if (id) {
    const c = await sqlOne<{ id: string }>("SELECT id FROM ai_conversations WHERE id=$1 AND user_id=$2", [id, user.id]);
    if (c) return c.id;
  }
  return (await sql<{ id: string }>("INSERT INTO ai_conversations(user_id, project_id, title) VALUES ($1,$2,$3) RETURNING id", [user.id, projectId, title.slice(0, 120)]))[0].id;
}

export async function governanceState() {
  const aiEnabled = await getSetting("ai_enabled", true);
  const disabled = new Set((await sql<{ key: string }>("SELECT key FROM ai_agents WHERE enabled=false")).map((r) => r.key));
  return { aiEnabled, disabled };
}

export async function levelFor(user: User, projectId: string | null) {
  const p = projectId ? await sqlOne<{ autonomy_level: number | null }>("SELECT autonomy_level FROM projects WHERE id=$1", [projectId]) : null;
  return effectiveLevel(user.autonomy_level, p?.autonomy_level ?? null);
}

/** Exécute (ou met en attente, ou bloque) un appel d'outil ; tout passe par le journal ai_steps. */
export async function executeStep(name: string, input: unknown, ctx: ToolCtx & { agents: AgentDef[]; allowed: ToolName[]; level: number }): Promise<Step> {
  const def = toolDef(name);
  const agentKey = def ? ownerOf(name as ToolName, ctx.agents) : "core";
  const gov = await governanceState();
  const effect = def?.effect ?? "read";
  const d = !def ? { kind: "blocked" as const, reason: "Outil inconnu" }
    : decide({ effect, level: ctx.level as 1, aiEnabled: gov.aiEnabled, agentEnabled: !gov.disabled.has(agentKey), toolAllowed: ctx.allowed.includes(name as ToolName) });
  const base = [ctx.conversationId, ctx.user.id, agentKey, name, JSON.stringify(input ?? {}), EFFECT_LEVEL[effect]] as const;
  if (d.kind !== "execute") {
    const status = d.kind === "approval" ? "awaiting_approval" : "blocked";
    const id = (await sql<{ id: string }>("INSERT INTO ai_steps(conversation_id, user_id, agent_key, tool, input, required_level, status, error) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id", [...base, status, d.reason]))[0].id;
    return { id, agent_key: agentKey, tool: name, status, error: d.reason, required_level: EFFECT_LEVEL[effect] };
  }
  const t0 = Date.now();
  try {
    const parsed = def!.schema.parse(input);
    const output = await def!.run(parsed, ctx);
    const id = (await sql<{ id: string }>("INSERT INTO ai_steps(conversation_id, user_id, agent_key, tool, input, required_level, status, output, duration_ms) VALUES ($1,$2,$3,$4,$5,$6,'done',$7,$8) RETURNING id", [...base, JSON.stringify(output ?? null), Date.now() - t0]))[0].id;
    if (effect !== "read") await audit(ctx.user.id, "ai", `ai.tool.${name}`, { kind: "ai_step", id }, { agent: agentKey });
    return { id, agent_key: agentKey, tool: name, status: "done", error: null, required_level: EFFECT_LEVEL[effect], output };
  } catch (e) {
    const msg = e instanceof z.ZodError ? `Entrée invalide : ${e.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(" ; ")}` : e instanceof Error ? e.message : String(e);
    const id = (await sql<{ id: string }>("INSERT INTO ai_steps(conversation_id, user_id, agent_key, tool, input, required_level, status, error, duration_ms) VALUES ($1,$2,$3,$4,$5,$6,'failed',$7,$8) RETURNING id", [...base, msg, Date.now() - t0]))[0].id;
    return { id, agent_key: agentKey, tool: name, status: "failed", error: msg, required_level: EFFECT_LEVEL[effect] };
  }
}

/** Exécution d'une étape mise en attente, après approbation humaine (même moteur, même journal). */
export async function approveStep(stepId: string, user: User, approve: boolean) {
  const s = await sqlOne<{ id: string; user_id: string; tool: string; input: unknown; status: string; conversation_id: string }>("SELECT * FROM ai_steps WHERE id=$1", [stepId]);
  if (!s || s.user_id !== user.id) throw new Error("Étape introuvable");
  if (s.status !== "awaiting_approval") throw new Error(`Étape déjà traitée (${s.status})`);
  if (!approve) {
    await sql("UPDATE ai_steps SET status='rejected', decided_by=$2, decided_at=now() WHERE id=$1", [stepId, user.id]);
    await audit(user.id, "human", "ai.step.reject", { kind: "ai_step", id: stepId });
    return { status: "rejected" };
  }
  const gov = await governanceState();
  if (!gov.aiEnabled) throw new Error("Arrêt global de l'IA activé dans le Command Center");
  const def = toolDef(s.tool);
  const conv = await sqlOne<{ project_id: string | null }>("SELECT project_id FROM ai_conversations WHERE id=$1", [s.conversation_id]);
  try {
    const out = await def.run(def.schema.parse(s.input), { user, projectId: conv?.project_id ?? null, conversationId: s.conversation_id });
    await sql("UPDATE ai_steps SET status='approved', output=$2, decided_by=$3, decided_at=now() WHERE id=$1", [stepId, JSON.stringify(out ?? null), user.id]);
    await audit(user.id, "human", "ai.step.approve", { kind: "ai_step", id: stepId }, { tool: s.tool });
    return { status: "approved", output: out };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sql("UPDATE ai_steps SET status='failed', error=$2, decided_by=$3, decided_at=now() WHERE id=$1", [stepId, msg, user.id]);
    return { status: "failed", error: msg };
  }
}

export function aiStatus() {
  const c = providerConfig();
  return c.kind !== "none" ? { mode: "llm" as const, provider: c.kind, model: c.model } : { mode: "rules" as const, provider: "none" as const, model: null, reason: c.reason };
}

/** Contrôle des résultats par l'agent vérificateur, inscrit au journal. */
async function recordVerification(steps: Step[], ctx: { user: User; conversationId: string }) {
  const v = verifySteps(steps);
  if (!v.checked) return v;
  await sql("INSERT INTO ai_steps(conversation_id, user_id, agent_key, tool, input, required_level, status, output, duration_ms) VALUES ($1,$2,'verifier','verify_results',$3,1,'done',$4,0)",
    [ctx.conversationId, ctx.user.id, JSON.stringify({ steps: steps.length }), JSON.stringify(v)]);
  return v;
}

export async function askCore(question: string, opts: { user: User; conversationId?: string | null; projectId?: string | null; lang?: string; agents?: string[]; fetchImpl?: typeof fetch }): Promise<CoreAnswer> {
  const user = opts.user;
  const projectId = opts.projectId ?? null;
  const lang = opts.lang && LANG_NAMES[opts.lang] ? opts.lang : "fr";
  const conversationId = await conversation(user, opts.conversationId, projectId, question);
  const agents = selectAgents(question, opts.agents);
  const allowed = toolsFor(agents);
  const level = await levelFor(user, projectId);
  const history = (await sql<{ role: "user" | "assistant"; content: string }>("SELECT role, content FROM ai_messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 12", [conversationId])).reverse();
  await sql("INSERT INTO ai_messages(conversation_id, role, content, lang) VALUES ($1,'user',$2,$3)", [conversationId, question, lang]);
  const ctx = { user, projectId, conversationId, agents, allowed, level };
  const gov = await governanceState();
  const analysis = analyseRequest(question);
  const finish = async (r: Omit<CoreAnswer, "conversationId" | "agents" | "level">) => {
    const verification = await recordVerification(r.steps, { user, conversationId });
    r = { ...r, answer: r.answer + verificationText(verification), analysis, verification };
    await sql("INSERT INTO ai_messages(conversation_id, role, content, mode, model, agents, lang) VALUES ($1,'assistant',$2,$3,$4,$5,$6)", [conversationId, r.answer, r.mode, r.model, JSON.stringify(agents.map((a) => a.key)), lang]);
    return { ...r, steps: r.steps.map(({ output: _o, ...x }) => { void _o; return x; }), conversationId, agents: agents.map((a) => a.key), level };
  };
  if (!gov.aiEnabled) return finish({ mode: "rules", model: null, answer: "L'IA est suspendue (arrêt global activé dans le AI Command Center). Aucune opération n'a été exécutée.", steps: [] });

  const status = aiStatus();
  if (status.mode === "rules") return finish(await rulesCore(question, ctx, analysis));
  const used = (await sqlOne<{ n: number }>("SELECT COUNT(*)::int n FROM ai_messages WHERE role='assistant' AND mode='llm' AND created_at > now() - interval '24 hours'"))?.n ?? 0;
  if (used >= env.aiDailyLimit) {
    const r = await rulesCore(question, ctx, analysis);
    return finish({ ...r, warning: `Plafond quotidien d'appels IA atteint (${env.aiDailyLimit}) : réponse du moteur de règles.` });
  }

  const steps: Step[] = [];
  const roster = agents.map((a) => `- ${a.name} (${a.key}) : ${a.domain} Outils : ${a.tools.join(", ") || "aucun"}. Limites : ${a.limits} Vérification : ${a.verify}`).join("\n");
  const analysisLine = `Analyse préalable (déterministe) : disciplines = ${analysis.disciplines.map((x) => x.key).join(", ") || "non déterminées"} ; type de projet = ${analysis.projectType ?? "non précisé"} ; intentions = ${analysis.intents.join(", ") || "non déterminées"}.`;
  const system = `${SYSTEM_PROMPT}\n\n${analysisLine}\n\nAgents mobilisés pour cette demande :\n${roster}\n\nNiveau d'autonomie effectif : ${level}/5 (les actions au-delà sont mises en attente d'approbation humaine).${projectId ? `\nProjet courant : ${projectId}.` : ""}\n\n${await languageInstruction(lang)}`;
  if (status.provider === "openai_compatible") {
    try {
      const answer = await openAiCompatibleLoop({
        system, history: history.filter((h, i) => i > 0 || h.role === "user"), question, fetchImpl: opts.fetchImpl,
        tools: allowed.map((n) => ({ name: n, description: TOOLS[n].description, parameters: toolJsonSchema(n) })),
        runTool: async (name, input) => {
          const s = await executeStep(name, input, ctx);
          steps.push(s);
          return { content: s.status === "done" ? JSON.stringify(s.output).slice(0, 30000)
            : s.status === "awaiting_approval" ? `NON EXÉCUTÉ — en attente d'approbation humaine (étape ${s.id}) : ${s.error}` : `NON EXÉCUTÉ — ${s.status} : ${s.error}` };
        },
      });
      return finish({ mode: "llm", model: status.model, answer: answer || "(aucune réponse textuelle)", steps });
    } catch (e) {
      const r = await rulesCore(question, ctx, analysis);
      return finish({ ...r, steps: [...steps, ...r.steps], warning: `Fournisseur IA indisponible (${e instanceof Error ? e.message : String(e)}) : réponse du mode sans clé.` });
    }
  }
  try {
    const client = new Anthropic({ apiKey: env.anthropicKey!, maxRetries: 2, timeout: 180000, ...(opts.fetchImpl ? { fetch: opts.fetchImpl } : {}) });
    const msgs: Anthropic.Beta.BetaMessageParam[] = [];
    for (const h of history) { if (!msgs.length && h.role !== "user") continue; msgs.push({ role: h.role, content: h.content }); }
    msgs.push({ role: "user", content: question });
    const tools: Anthropic.Beta.BetaTool[] = allowed.map((n) => ({ name: n, description: TOOLS[n].description, input_schema: toolJsonSchema(n) as Anthropic.Beta.BetaTool.InputSchema }));
    let answer = "";
    for (let turn = 0; turn < 10; turn++) {
      const res = await client.beta.messages.create({
        model: status.model!, max_tokens: 16000, system, tools, messages: msgs,
        output_config: { effort: "medium" },
        ...fallbackParams(status.model!),
      });
      if (res.stop_reason === "refusal") { answer = "La demande n'a pas pu être traitée par le fournisseur IA. Reformulez-la."; break; }
      msgs.push({ role: "assistant", content: res.content });
      const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
      if (text) answer = text;
      if (res.stop_reason === "pause_turn") continue;
      const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (res.stop_reason !== "tool_use" || !uses.length) break;
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const u of uses) {
        const s = await executeStep(u.name, u.input, ctx);
        steps.push(s);
        const content = s.status === "done" ? JSON.stringify(s.output).slice(0, 60000)
          : s.status === "awaiting_approval" ? `NON EXÉCUTÉ — en attente d'approbation humaine (étape ${s.id}) : ${s.error}`
          : `NON EXÉCUTÉ — ${s.status === "blocked" ? "bloqué" : "échec"} : ${s.error}`;
        results.push({ type: "tool_result", tool_use_id: u.id, content, ...(s.status === "done" ? {} : { is_error: true }) });
      }
      msgs.push({ role: "user", content: results });
    }
    return finish({ mode: "llm", model: status.model, answer: answer || "(aucune réponse textuelle)", steps });
  } catch (e) {
    const msg = e instanceof Anthropic.AuthenticationError ? "clé du fournisseur IA refusée" : e instanceof Anthropic.RateLimitError ? "quota du fournisseur IA atteint" : e instanceof Anthropic.APIError ? `erreur du fournisseur IA (${e.status})` : e instanceof Error ? e.message : String(e);
    const r = await rulesCore(question, ctx, analysis);
    return finish({ ...r, steps: [...steps, ...r.steps], warning: `Fournisseur IA indisponible (${msg}) : réponse du mode sans clé.` });
  }
}

// ===================== Moteur de règles (sans IA générative) =====================
const fmt = (o: { outputs: Record<string, { value: number; unit: string; label: string }>; missing: string[]; warnings: string[] }) =>
  [...Object.values(o.outputs).map((v) => `- ${v.label} : ${v.value} ${v.unit}`), ...o.missing.map((m) => `- Paramètre manquant : ${m}`), ...o.warnings.map((w) => `- ${w}`)].join("\n");
const n = (s: string | undefined) => (s == null ? null : Number(s.replace(",", ".")));

/** Paramètres « nom=valeur » trouvés dans la question pour un calcul donné (aucune valeur devinée : absent → null). */
export function extractCalcInput(kind: string, question: string): Record<string, unknown> | null {
  const def = (CALCS as Record<string, { schema: z.ZodType }>)[kind];
  const shape = (def?.schema as unknown as { shape?: Record<string, z.ZodType> }).shape;
  if (!shape) return null;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(shape)) {
    const m = question.match(new RegExp(`\\b${key}\\s*[=:]\\s*(-?\\d+(?:[.,]\\d+)?|[a-zA-Z_]+)`, "i"));
    if (!m) { out[key] = null; continue; }
    const raw = m[1];
    out[key] = /^-?\d/.test(raw) ? Number(raw.replace(",", ".")) : raw;
  }
  return out;
}

async function rulesCore(question: string, ctx: Parameters<typeof executeStep>[2], analysis: RequestAnalysis): Promise<Omit<CoreAnswer, "conversationId" | "agents" | "level">> {
  const head = "**Aláji IA — mode sans clé** (moteur de règles déterministe, pas une IA générative : aucun fournisseur d'IA n'est configuré sur le serveur).\n\n";
  const orient = [
    "**Analyse de la demande**",
    `- Disciplines : ${analysis.disciplines.map((d) => d.name).join(", ") || "non déterminées"}`,
    `- Type de projet : ${analysis.projectType ? PROJECT_TYPE_LABEL[analysis.projectType] : "non précisé"}`,
    `- Intention : ${analysis.intents.map((i) => INTENT_LABEL[i]).join(", ") || "non déterminée"}`,
    `- Agents mobilisés : ${ctx.agents.map((a) => a.name).join(", ")}`,
  ].join("\n");
  const links = [...new Map(analysis.disciplines.flatMap((d) => DISCIPLINE_LINKS[d.key] ?? []).map((l) => [l.href, l])).values()];
  const go = links.length ? `\n\n**Où travailler** : ${links.map((l) => `${l.label} (${l.href})`).join(" · ")}` : "";
  const steps: Step[] = [];
  const call = async (tool: string, input: unknown) => { const s = await executeStep(tool, input, { ...ctx, allowed: [...new Set([...ctx.allowed, "run_calculation", "get_solar_climatology", "list_devices", "list_projects", "search_components", "search_marketplace", "project_progress", "generate_project_report"] as ToolName[])] }); steps.push(s); return s; };
  const out = (answer: string) => ({ mode: "rules" as const, model: null, answer: `${head}${orient}\n\n${answer}${go}`, steps });
  const qn = question.toLowerCase();

  // Calcul explicitement nommé : « calcul pump flowM3h=5 headM=30 … »
  const named = CALC_KINDS.find((k) => new RegExp(`\\b${k}\\b`, "i").test(question));
  if (named && named !== "subnet" && named !== "vlsm") {
    const input = extractCalcInput(named, question)!;
    const s = await call("run_calculation", { kind: named, input });
    return out(s.status === "done" ? `Calcul **${named}** (${CALCS[named].description}) :\n${fmt((s.output as { result: Parameters<typeof fmt>[0] }).result)}` : `Calcul non exécuté : ${s.error}`);
  }

  const cidr = question.match(/\b(\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2})\b/);
  if (cidr) { const s = await call("run_calculation", { kind: "subnet", input: { cidr: cidr[1] } }); return out(s.status === "done" ? `Calcul du sous-réseau ${cidr[1]} :\n${fmt((s.output as { result: Parameters<typeof fmt>[0] }).result)}` : `Calcul non exécuté : ${s.error}`); }

  const U = question.match(/\bU\s*=\s*(-?\d+(?:[.,]\d+)?)/i)?.[1], I = question.match(/\bI\s*=\s*(-?\d+(?:[.,]\d+)?)/i)?.[1], R = question.match(/\bR\s*=\s*(-?\d+(?:[.,]\d+)?)/i)?.[1];
  if ([U, I, R].filter(Boolean).length >= 2) { const s = await call("run_calculation", { kind: "ohm", input: { u: n(U), i: n(I), r: n(R) } }); return out(s.status === "done" ? `Loi d'Ohm :\n${fmt((s.output as { result: Parameters<typeof fmt>[0] }).result)}` : `Calcul non exécuté : ${s.error}`); }

  const coords = question.match(/(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)/);
  if (coords && /solaire|solar|irradi|ensoleill|nasa|pv/i.test(qn)) {
    const s = await call("get_solar_climatology", { lat: n(coords[1]), lon: n(coords[2]) });
    if (s.status !== "done") return out(`Données NASA POWER non obtenues : ${s.error}`);
    const g = s.output as { parameters: Record<string, { values: { value: number | null }[] }>; resolution: string; period: string };
    const v = g.parameters.ALLSKY_SFC_SW_DWN.values.map((x) => x.value);
    return out(`Irradiation globale horizontale moyenne (NASA POWER, **donnée modélisée régionale**, ${g.period}) en kWh/m²/j, de janvier à décembre :\n${v.join(" · ")}\n\nRésolution : ${g.resolution}. Pour la production, ouvrez le Solar Energy Lab (puissance crête et ratio de performance à fournir).`);
  }

  // Rapport d'un projet existant (titre cité dans la demande)
  if (analysis.intents.includes("rapport")) {
    const ps = await call("list_projects", {});
    const list = (ps.output as { id: string; title: string }[] | undefined) ?? [];
    const target = list.find((p) => qn.includes(p.title.toLowerCase())) ?? (ctx.projectId ? list.find((p) => p.id === ctx.projectId) : undefined) ?? (list.length === 1 ? list[0] : undefined);
    if (!target) return out(list.length ? `Pour quel projet ? Citez son titre : ${list.map((p) => `« ${p.title} »`).join(", ")}.` : "Aucun projet : créez-en un (Projets → Nouveau projet, ou à partir d'un modèle), puis demandez son rapport.");
    const r = await call("generate_project_report", { project_id: target.id });
    return out(r.status === "done" ? `Rapport du projet « ${target.title} » (à partir des données enregistrées ; téléchargeable depuis la page du projet) :\n\n${(r.output as { markdown: string }).markdown}` : `Rapport non généré : ${r.error}`);
  }
  if (analysis.intents.includes("suivi")) {
    const s = await call("project_progress", {});
    const ps = (s.output as { title: string; tasks: number; done: number; last_calc: string | null; last_sim: string | null }[]) ?? [];
    return out(ps.length ? `**Suivi des projets**\n${ps.map((p) => `- ${p.title} : ${p.done}/${p.tasks} tâche(s) terminée(s)${p.last_calc ? ` · dernier calcul ${new Date(p.last_calc).toLocaleDateString("fr-FR")}` : ""}${p.last_sim ? ` · dernière simulation ${new Date(p.last_sim).toLocaleDateString("fr-FR")}` : ""}`).join("\n")}` : "Aucun projet à suivre.");
  }
  if (/appareil|device|capteur|sensor/i.test(qn) && !analysis.intents.includes("composants")) {
    const s = await call("list_devices", {});
    const ds = (s.output as { name: string; environment: string; last_seen: string | null; latest: { metric: string; value: number; unit: string | null; ts: string; quality: string }[] | null }[]) ?? [];
    return out(ds.length ? ds.map((d) => `- ${d.name} (${d.environment}) — dernière communication : ${d.last_seen ? new Date(d.last_seen).toLocaleString("fr-FR") : "jamais"}${(d.latest ?? []).map((l) => `\n  · ${l.metric} = ${l.value} ${l.unit ?? ""} (${new Date(l.ts).toLocaleString("fr-FR")}${l.quality === "simulated" ? ", SIMULÉE" : ""})`).join("")}`).join("\n") : "Aucun appareil enregistré. Ajoutez-en un dans IoT Gateway.");
  }
  if (/mes projets|my projects|liste des projets/i.test(qn)) {
    const s = await call("list_projects", {});
    const ps = (s.output as { title: string; kind: string }[]) ?? [];
    return out(ps.length ? ps.map((p) => `- ${p.title} (${p.kind})`).join("\n") : "Aucun projet. Créez-en un dans Projets (des modèles complets sont proposés).");
  }
  const market = question.match(/(?:marketplace|annonces?|acheter|à vendre|for sale|buy)\s*:?\s*(?:un |une |des |le |la |les |a |an |the )?([\p{L}\d -]{2,40})?/iu);
  if (market) {
    const query = (market[1] ?? "").trim().split(/\s+/).slice(0, 3).join(" ");
    const s = await call("search_marketplace", { query });
    const ls = ((s.output as { listings: { title: string; price_xof: number | null; location: string | null; seller: string; link: string }[] } | undefined)?.listings) ?? [];
    return out(ls.length ? `Annonces de XAM-XAM MARKETPLACE${query ? ` pour « ${query} »` : ""} (caractéristiques déclarées par les vendeurs ; aucun paiement via la plateforme) :\n${ls.map((l) => `- ${l.title} — ${l.price_xof === null ? "prix sur demande" : `${l.price_xof} FCFA`}${l.location ? ` · ${l.location}` : ""} · ${l.seller} (${l.link})`).join("\n")}` : `Aucune annonce publiée${query ? ` pour « ${query} »` : ""} dans XAM-XAM MARKETPLACE.`);
  }
  const comp = question.match(/(?:composant|component|explique[- ]moi|explique|explain|qu'est-ce qu'une?|c'est quoi une?)\s*:?\s*(?:le |la |l'|un |une |the )?([\p{L}\d -]{3,40})/iu);
  if (comp) {
    const word = comp[1].trim().split(/\s+/)[0];
    const s = await call("search_components", { query: word });
    const cs = (s.output as { name: string; description: string; function: string | null; precautions: string | null }[]) ?? [];
    return out(cs.length ? cs.slice(0, 3).map((c) => `**${c.name}** — ${c.description}${c.function ? `\nFonction : ${c.function}` : ""}${c.precautions ? `\nPrécautions : ${c.precautions}` : ""}`).join("\n\n") : `Aucun composant « ${word} » dans la bibliothèque.`);
  }
  const calcHints = analysis.disciplines.flatMap((d) => CALC_KINDS.filter((k) => CALCS[k].lab === d.key || (d.key === "robotics" && CALCS[k].lab === "mechanical"))).slice(0, 8);
  return out([
    analysis.projectType ? `Pour un ${PROJECT_TYPE_LABEL[analysis.projectType].toLowerCase()}, créez le projet à partir d'un **modèle** (Projets → Nouveau à partir d'un modèle) : cahier des charges, objectifs, méthodologie, architecture, composants, budget, tests et rapport sont structurés d'avance.` : "",
    calcHints.length ? `Calculs disponibles pour ces disciplines (écrivez par exemple « calcul ${calcHints[0]} » suivi des paramètres nom=valeur) :\n${calcHints.map((k) => `- ${k} : ${CALCS[k].description}`).join("\n")}` : "",
    "Demandes comprises sans IA générative : « 192.168.1.0/24 », « U=12 R=470 », « calcul pump flowM3h=5 headM=30 pumpEff=0.6 motorEff=0.85 dailyVolumeM3=20 », « irradiation solaire 14.69, -17.44 », « rapport du projet <titre> », « suivi de mes projets », « mes appareils », « explique le condensateur », « annonces relais ».",
    "Pour la compréhension libre (wolof, français, anglais) et la rédaction, l'administrateur peut configurer un fournisseur d'IA (AI_PROVIDER — Anthropic ou tout service compatible OpenAI, y compris des offres gratuites ou un serveur local).",
  ].filter(Boolean).join("\n\n"));
}

export { AGENTS };
