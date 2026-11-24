/**
 * AI TOOL EXECUTION ENGINE — registre des outils d'Aláji IA.
 * Chaque outil : schéma d'entrée (zod → JSON Schema), effet (read / compute / write / physical) qui fixe le niveau
 * d'autonomie requis, et exécution déterministe. L'IA ne calcule rien elle-même et ne commande aucun équipement :
 * l'outil physique ne fait que PROPOSER (confirmation humaine dans le Remote Control Center).
 */
import { z } from "zod";
import { sql, sqlOne } from "../db";
import type { User } from "../api";
import { ApiFailure } from "../api";
import { CALCS, CALC_KINDS, runCalc } from "../calc";
import { simulateGraph } from "../simulate";
import { analysisSchema, graphSchema } from "../schemas";
import { powerClimatology, meteomaticsForecast } from "../integrations/geo";
import { proposeCommand } from "../iot";
import { projectRole } from "../access";
import type { DeviceRow } from "../access";
import { audit } from "../audit";
import { automationSpec } from "@/lib/automation";
import { MARKET_CATEGORIES } from "@/lib/market";
import type { ToolEffect } from "@/lib/autonomy";
import { projectReportMarkdown } from "./analysis";
import { GENERATORS, generatorByKind, resolveParams } from "@/lib/schematics-gen";
import { projectReportData } from "../projects";

export interface ToolCtx { user: User; projectId: string | null; conversationId: string }

interface ToolDef<S extends z.ZodType> { description: string; effect: ToolEffect; schema: S; run: (i: z.infer<S>, ctx: ToolCtx) => Promise<unknown> }
const tool = <S extends z.ZodType>(d: ToolDef<S>) => d;

async function writableProject(id: string | null | undefined, u: User) {
  if (!id) return null;
  const r = await projectRole(id, u);
  if (!r || !["owner", "editor"].includes(r)) throw new ApiFailure(403, "Projet inaccessible en écriture", "err.forbidden");
  return id;
}

async function myDevice(id: string, u: User): Promise<DeviceRow> {
  const d = await sqlOne<DeviceRow>("SELECT * FROM devices WHERE id=$1", [id]);
  if (!d) throw new Error("Appareil introuvable");
  if (d.owner_id !== u.id && !(d.project_id && (await projectRole(d.project_id, u)))) throw new Error("Appareil introuvable");
  return d;
}

export const TOOLS = {
  list_projects: tool({
    description: "Liste les projets de l'utilisateur (titre, type, rôle).", effect: "read", schema: z.object({}),
    run: async (_i, c) => sql(`SELECT p.id, p.title, p.kind, p.visibility FROM projects p WHERE p.owner_id=$1 OR EXISTS (SELECT 1 FROM project_members m WHERE m.project_id=p.id AND m.user_id=$1) ORDER BY updated_at DESC LIMIT 50`, [c.user.id]),
  }),
  get_project: tool({
    description: "Détail d'un projet : fiche, tâches, schémas, calculs et simulations enregistrés.", effect: "read", schema: z.object({ project_id: z.string().uuid() }),
    run: async (i, c) => {
      if (!(await projectRole(i.project_id, c.user))) throw new Error("Projet introuvable");
      return {
        project: await sqlOne("SELECT id, title, description, objectives, problem, specs, kind FROM projects WHERE id=$1", [i.project_id]),
        tasks: await sql("SELECT title, status, due_date FROM project_tasks WHERE project_id=$1", [i.project_id]),
        calcs: await sql("SELECT calc_kind, outputs, missing, created_at FROM calc_runs WHERE project_id=$1 ORDER BY created_at DESC LIMIT 20", [i.project_id]),
        sims: await sql("SELECT id, engine_version, analysis, status, created_at FROM simulations WHERE project_id=$1 ORDER BY created_at DESC LIMIT 20", [i.project_id]),
      };
    },
  }),
  list_calculations: tool({
    description: "Catalogue des calculs d'ingénierie disponibles (identifiant et description). À consulter avant run_calculation.", effect: "read", schema: z.object({}),
    run: async () => CALC_KINDS.map((k) => ({ kind: k, lab: CALCS[k].lab, description: CALCS[k].description, input_schema: z.toJSONSchema(CALCS[k].schema) })),
  }),
  run_calculation: tool({
    description: "Exécute un calcul déterministe testé (électrotechnique, solaire, mécanique, froid, réseau). Les champs inconnus doivent être null : le résultat liste alors les paramètres manquants. Ne jamais inventer une valeur d'entrée.",
    effect: "compute", schema: z.object({ kind: z.enum(CALC_KINDS as [string, ...string[]]), input: z.record(z.string(), z.unknown()), project_id: z.string().uuid().nullable().optional() }),
    run: async (i, c) => runCalc(i.kind, i.input, { userId: c.user.id, projectId: await writableProject(i.project_id ?? c.projectId, c.user), by: "ai" }),
  }),
  simulate_circuit: tool({
    description: "Simule un circuit avec ngspice (analyses op, tran, dc, ac). Composants R, C, L, V, I, D, GND ; chaque fil relie deux broches (part, pin 0/1). Retourne les courbes ou les erreurs ERC.",
    effect: "compute", schema: z.object({ graph: graphSchema, analysis: analysisSchema, project_id: z.string().uuid().nullable().optional() }),
    run: async (i, c) => {
      const r = await simulateGraph(i.graph, i.analysis, { userId: c.user.id, projectId: await writableProject(i.project_id ?? c.projectId, c.user), schematicId: null, by: "ai" });
      if (!("traces" in r) || !r.traces) return r;
      // Résumé compact pour le modèle : valeurs initiale/finale/min/max par trace (données complètes conservées en base).
      return { ...r, traces: r.traces.map((t) => ({ name: t.name, type: t.type, points: t.values.length, first: t.values[0], last: t.values.at(-1), min: Math.min(...t.values), max: Math.max(...t.values) })) };
    },
  }),
  search_components: tool({
    description: "Recherche dans la bibliothèque de composants (fonction, brochage, précautions, statut de vérification).", effect: "read", schema: z.object({ query: z.string().max(80) }),
    run: async (i) => sql("SELECT name, category, description, function, pins, precautions, status, manufacturer, mpn, specs FROM components WHERE name ILIKE '%'||$1||'%' OR description ILIKE '%'||$1||'%' OR category ILIKE '%'||$1||'%' LIMIT 20", [i.query]),
  }),
  search_marketplace: tool({
    description: "Recherche dans XAM-XAM MARKETPLACE les annonces publiées et visibles (titre, catégorie, état, prix en FCFA ou null = sur demande, quantité, localisation, vendeur). Les caractéristiques sont DÉCLARÉES par le vendeur, non vérifiées. Aucun achat ni paiement n'est possible par l'IA : l'utilisateur contacte le vendeur lui-même.",
    effect: "read",
    schema: z.object({ query: z.string().max(80).default(""), category: z.enum(MARKET_CATEGORIES).nullable().optional(), max_price_xof: z.number().int().min(0).nullable().optional() }),
    run: async (i) => {
      const rows = await sql<{ id: string; price_xof: number | null }>(`SELECT l.id, l.title, l.category, l.condition, l.price_xof::float8 AS price_xof, l.quantity, l.location, l.specs, s.display_name AS seller
        FROM market_listings l JOIN users s ON s.id=l.seller_id
        WHERE l.status='published' AND l.moderation='visible'
          AND ($1='' OR l.title ILIKE '%'||$1||'%' OR l.description ILIKE '%'||$1||'%' OR l.specs::text ILIKE '%'||$1||'%')
          AND ($2::text IS NULL OR l.category=$2) AND ($3::bigint IS NULL OR l.price_xof <= $3)
        ORDER BY l.sponsored DESC, l.created_at DESC LIMIT 15`, [i.query, i.category ?? null, i.max_price_xof ?? null]);
      return { listings: rows.map((r) => ({ ...r, link: `/marketplace?annonce=${r.id}`, specs_note: "déclarées par le vendeur" })), note: "Mise en relation uniquement : aucun paiement via la plateforme." };
    },
  }),
  get_solar_climatology: tool({
    description: "Climatologie mensuelle NASA POWER (irradiation globale horizontale kWh/m²/j, températures) d'un point. Donnée MODÉLISÉE à échelle régionale.", effect: "read",
    schema: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }),
    run: async (i) => powerClimatology(i.lat, i.lon, ["ALLSKY_SFC_SW_DWN", "T2M_MAX", "T2M_MIN"]),
  }),
  get_weather_forecast: tool({
    description: "Prévisions journalières Meteomatics (PRÉDICTIONS) d'un point, 1 à 10 jours.", effect: "read",
    schema: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), days: z.number().int().min(1).max(10) }),
    run: async (i) => meteomaticsForecast(i.lat, i.lon, i.days),
  }),
  list_devices: tool({
    description: "Appareils IoT accessibles : environnement (virtuel/banc/réel), capacités, dernière mesure datée de chaque grandeur.", effect: "read", schema: z.object({}),
    run: async (_i, c) => sql(`SELECT d.id, d.name, d.hardware, d.environment, d.status, d.capabilities, d.last_seen,
      (SELECT json_agg(x) FROM (SELECT DISTINCT ON (metric) metric, value, unit, ts, quality FROM measurements m WHERE m.device_id=d.id ORDER BY metric, ts DESC) x) latest
      FROM devices d WHERE d.owner_id=$1 OR d.project_id IN (SELECT project_id FROM project_members WHERE user_id=$1)`, [c.user.id]),
  }),
  get_device_readings: tool({
    description: "Statistiques des mesures d'un appareil sur une période (valides et simulées séparées).", effect: "read",
    schema: z.object({ device_id: z.string().uuid(), metric: z.string().max(40), hours: z.number().int().min(1).max(24 * 90) }),
    run: async (i, c) => {
      await myDevice(i.device_id, c.user);
      return sql(`SELECT quality, COUNT(*)::int n, MIN(value) min, MAX(value) max, AVG(value) avg, MIN(ts) first, MAX(ts) last, MAX(unit) unit FROM measurements
        WHERE device_id=$1 AND metric=$2 AND ts > now() - ($3 || ' hours')::interval GROUP BY quality`, [i.device_id, i.metric, String(i.hours)]);
    },
  }),
  create_project: tool({
    description: "Crée un projet privé (titre, description, problématique, objectifs).", effect: "write",
    schema: z.object({ title: z.string().min(2).max(160), description: z.string().max(5000).nullable(), problem: z.string().max(5000).nullable(), objectives: z.string().max(5000).nullable(), kind: z.enum(["engineering", "thesis", "research", "startup", "course"]) }),
    run: async (i, c) => {
      const p = (await sql<{ id: string }>("INSERT INTO projects(owner_id, title, description, problem, objectives, kind) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", [c.user.id, i.title, i.description, i.problem, i.objectives, i.kind]))[0];
      await sql("INSERT INTO project_members(project_id, user_id, role) VALUES ($1,$2,'owner')", [p.id, c.user.id]);
      await audit(c.user.id, "ai", "project.create", { kind: "project", id: p.id }, { title: i.title });
      return { project_id: p.id, url: `/projects/${p.id}` };
    },
  }),
  add_project_task: tool({
    description: "Ajoute une tâche à un projet.", effect: "write", schema: z.object({ project_id: z.string().uuid(), title: z.string().min(1).max(300) }),
    run: async (i, c) => {
      await writableProject(i.project_id, c.user);
      const t = (await sql<{ id: string }>("INSERT INTO project_tasks(project_id, title, created_by) VALUES ($1,$2,$3) RETURNING id", [i.project_id, i.title, c.user.id]))[0];
      return { task_id: t.id };
    },
  }),
  save_schematic: tool({
    description: "Enregistre un schéma (même format que simulate_circuit) pour qu'il soit ouvert et modifié dans l'Electronics Lab.", effect: "write",
    schema: z.object({ title: z.string().min(1).max(160), graph: graphSchema, project_id: z.string().uuid().nullable().optional() }),
    run: async (i, c) => {
      const pid = await writableProject(i.project_id ?? c.projectId, c.user);
      const s = (await sql<{ id: string }>("INSERT INTO schematics(project_id, owner_id, lab, title, graph) VALUES ($1,$2,'electronics',$3,$4) RETURNING id", [pid, c.user.id, i.title, JSON.stringify(i.graph)]))[0];
      await sql("INSERT INTO schematic_versions(schematic_id, version, graph, message, created_by) VALUES ($1,1,$2,'Proposé par Aláji IA',$3)", [s.id, JSON.stringify(i.graph), c.user.id]);
      return { schematic_id: s.id, url: `/lab/electronics?schema=${s.id}` };
    },
  }),
  draft_automation: tool({
    description: "Crée un scénario d'automatisation DÉSACTIVÉ (l'utilisateur fait l'essai à blanc puis l'active). Le seuil doit avoir été donné par l'utilisateur.", effect: "write",
    schema: z.object({ name: z.string().min(2).max(120), spec: automationSpec }),
    run: async (i, c) => {
      await myDevice(i.spec.trigger.device_id, c.user);
      const a = (await sql<{ id: string }>("INSERT INTO automations(owner_id, name, spec) VALUES ($1,$2,$3) RETURNING id", [c.user.id, i.name, JSON.stringify(i.spec)]))[0];
      await audit(c.user.id, "ai", "automation.create", { kind: "automation", id: a.id }, { name: i.name });
      return { automation_id: a.id, enabled: false, url: "/automation" };
    },
  }),
  remember: tool({
    description: "Mémorise dans le projet une décision ou une information AFFIRMÉE par l'utilisateur (jamais une supposition).", effect: "write",
    schema: z.object({ content: z.string().min(3).max(2000), project_id: z.string().uuid().nullable().optional() }),
    run: async (i, c) => {
      const pid = await writableProject(i.project_id ?? c.projectId, c.user);
      const m = (await sql<{ id: string }>("INSERT INTO ai_memory(user_id, project_id, content, source) VALUES ($1,$2,$3,'user_statement') RETURNING id", [c.user.id, pid, i.content]))[0];
      return { memory_id: m.id };
    },
  }),
  recall: tool({
    description: "Relit la mémoire du projet (décisions et informations affirmées par l'utilisateur).", effect: "read", schema: z.object({ project_id: z.string().uuid().nullable().optional() }),
    run: async (i, c) => sql("SELECT content, created_at FROM ai_memory WHERE user_id=$1 AND ($2::uuid IS NULL OR project_id=$2) ORDER BY created_at DESC LIMIT 50", [c.user.id, i.project_id ?? c.projectId]),
  }),
  generate_project_report: tool({
    description: "Génère le rapport technique Markdown d'un projet à partir de ses seules données enregistrées (sections, composants, budget, calculs, simulations, mesures, tâches). Ne rédige aucun contenu inventé.",
    effect: "read", schema: z.object({ project_id: z.string().uuid() }),
    run: async (i, c) => {
      if (!(await projectRole(i.project_id, c.user))) throw new Error("Projet introuvable");
      return { project_id: i.project_id, markdown: projectReportMarkdown(await projectReportData(i.project_id)), url: `/projects/${i.project_id}` };
    },
  }),
  project_progress: tool({
    description: "Suivi des projets de l'utilisateur : tâches terminées / restantes, dernières activités (calculs, simulations).", effect: "read", schema: z.object({}),
    run: async (_i, c) => sql(`SELECT p.id, p.title, p.level,
        (SELECT COUNT(*)::int FROM project_tasks t WHERE t.project_id=p.id) AS tasks,
        (SELECT COUNT(*)::int FROM project_tasks t WHERE t.project_id=p.id AND t.status='done') AS done,
        (SELECT MAX(created_at) FROM calc_runs r WHERE r.project_id=p.id) AS last_calc,
        (SELECT MAX(created_at) FROM simulations s WHERE s.project_id=p.id) AS last_sim
      FROM projects p WHERE p.owner_id=$1 OR EXISTS (SELECT 1 FROM project_members m WHERE m.project_id=p.id AND m.user_id=$1) ORDER BY p.updated_at DESC LIMIT 30`, [c.user.id]),
  }),
  list_documents: tool({
    description: "Liste les documents déposés par l'utilisateur (énoncés, devoirs, fichiers techniques) et analysés.", effect: "read", schema: z.object({}),
    run: async (_i, c) => sql("SELECT id, filename, kind, pages, ocr, created_at FROM documents WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30", [c.user.id]),
  }),
  get_document_report: tool({
    description: "Rapport d'analyse d'un document déposé : exercices, données extraites, calculs, contrôles, réponses corrigées, points à valider, et texte extrait (tronqué).", effect: "read",
    schema: z.object({ document_id: z.string().uuid() }),
    run: async (i, c) => {
      const d = await sqlOne<{ filename: string; report: unknown; extracted_text: string }>("SELECT filename, report, extracted_text FROM documents WHERE id=$1 AND user_id=$2", [i.document_id, c.user.id]);
      if (!d) throw new Error("Document introuvable");
      return { filename: d.filename, report: d.report, text: d.extracted_text.slice(0, 12000) };
    },
  }),
  generate_schematic: tool({
    description: `Génère un schéma technique paramétré et vérifié (logique des circuits contrôlée sur le graphe). Types : ${GENERATORS.map((g) => `${g.kind} (${g.title}; paramètres : ${g.params.map((p) => `${p.key} ${p.unit}`.trim()).join(", ") || "aucun"})`).join(" | ")}. Retourne le lien d'ouverture dans l'éditeur 2D et les contrôles.`,
    effect: "compute", schema: z.object({ kind: z.string().max(40), params: z.record(z.string(), z.union([z.number(), z.string()])).default({}) }),
    run: async (i) => {
      const g = generatorByKind(i.kind);
      if (!g) throw new Error(`Type de schéma inconnu : ${i.kind}`);
      const { values, errors } = resolveParams(g, i.params);
      if (errors.length) throw new Error(errors.join(" ; "));
      const r = g.build(values);
      return { title: r.title, description: r.description, checks: r.checks, warnings: r.warnings, blocks: r.diagram.blocks.length, wires: r.diagram.wires.length, url: `/schemas?generer=${g.kind}&p=${encodeURIComponent(JSON.stringify(values))}` };
    },
  }),
  propose_device_command: tool({
    description: "PROPOSE une commande d'équipement (jamais exécutée par l'IA). Une personne habilitée la confirme dans le Remote Control Center ; l'appareil applique ses limites ; « exécutée » seulement sur accusé.",
    effect: "physical", schema: z.object({ device_id: z.string().uuid(), action: z.string().regex(/^[a-z0-9_]{1,30}$/), duration_s: z.number().int().positive().nullable(), reason: z.string().max(300) }),
    run: async (i, c) => {
      const d = await myDevice(i.device_id, c.user);
      const cmd = await proposeCommand(d, i.action, i.duration_s, "ai", c.user.id, i.reason);
      return { command_id: cmd.id, status: "proposed", note: "En attente de confirmation humaine dans le Remote Control Center." };
    },
  }),
} as const;

export type ToolName = keyof typeof TOOLS;
export const TOOL_NAMES = Object.keys(TOOLS) as ToolName[];

export function toolDef(name: string) { return (TOOLS as Record<string, ToolDef<z.ZodType>>)[name]; }

export function toolJsonSchema(name: ToolName) {
  const s = z.toJSONSchema(TOOLS[name].schema) as Record<string, unknown>;
  delete s.$schema;
  return s;
}
