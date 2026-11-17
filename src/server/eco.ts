/**
 * Écosystème : startups, concours, mentors, offres, actualités, annonces — modèle commun (eco_items / eco_links)
 * avec un schéma de données et un droit de publication propres à chaque type.
 * Règles : contenu sponsorisé toujours identifié ; décisions de concours prises par un jury humain (classement =
 * moyenne des notes du jury, détail publié) ; mises en relation acceptées des deux côtés ; signalements → modération.
 */
import { z } from "zod";
import type { Capability } from "@/lib/profiles";

const str = (max: number) => z.string().trim().max(max);
export const ECO_KINDS = ["startup", "challenge", "mentor", "job", "post", "listing"] as const;
export type EcoKind = (typeof ECO_KINDS)[number];

export const ECO_CAPABILITY: Record<EcoKind, Capability> = { startup: "publish_startup", challenge: "create_challenge", mentor: "mentor", job: "post_jobs", post: "publish_news", listing: "publish_news" };

export const ECO_DATA: Record<EcoKind, z.ZodType> = {
  startup: z.object({ country: str(80), sector: str(80), pitch: str(3000), problem: str(3000), solution: str(3000), stage: z.enum(["idea", "prototype", "pilot", "market", "growth"]), team: str(1000), needs: str(2000), partners_sought: str(1000), funding_need: str(200).nullable(), website: z.string().url().max(300).nullable() }),
  challenge: z.object({ description: str(5000), rules: str(5000), criteria: z.array(str(200)).min(1).max(10), deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), prizes: str(1000), sponsor: str(160).nullable() }),
  mentor: z.object({ expertise: z.array(str(80)).min(1).max(15), languages: z.array(z.enum(["wo", "fr", "en"])).min(1), bio: str(2000), slots: z.array(z.string().datetime({ offset: true })).max(50) }),
  job: z.object({ company: str(160), contract: z.enum(["job", "internship", "mission", "cofounder"]), location: str(160), remote: z.boolean(), description: str(5000), skills: z.array(str(60)).max(20) }),
  post: z.object({ category: z.enum(["tech", "ai", "digital", "renewables", "climate", "environment", "innovation", "training", "events", "calls", "funding"]), body: str(10000), source_url: z.string().url().max(400).nullable() }),
  listing: z.object({ category: z.enum(["equipment", "services", "training"]), body: str(5000), price: str(80).nullable(), location: str(160), contact_via_platform: z.literal(true) }),
};

export const linkSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("application"), data: z.object({ message: str(3000) }) }),
  z.object({ kind: z.literal("entry"), data: z.object({ project_id: z.string().uuid(), note: str(2000) }) }),
  z.object({ kind: z.literal("booking"), data: z.object({ slot: z.string().datetime({ offset: true }), topic: str(1000) }) }),
  z.object({ kind: z.literal("connection"), data: z.object({ message: str(2000) }) }),
  z.object({ kind: z.literal("report"), data: z.object({ reason: str(1000) }) }),
  z.object({ kind: z.literal("score"), data: z.object({ entry_id: z.string().uuid(), score: z.number().min(0).max(20), comment: str(2000) }) }),
  z.object({ kind: z.literal("jury"), data: z.object({ email: z.string().email(), conflict_declared: z.literal(false) }) }),
]);

export const ALLOWED_LINKS: Record<EcoKind, string[]> = {
  startup: ["connection", "report"], challenge: ["entry", "score", "jury", "report"], mentor: ["booking", "report"],
  job: ["application", "report"], post: ["report"], listing: ["connection", "report"],
};

/** Classement d'un concours : moyenne des notes du jury par dossier (notes nominatives publiées). */
export function ranking(entries: { id: string; user: string }[], scores: { entry_id: string; score: number }[]) {
  return entries.map((e) => {
    const s = scores.filter((x) => x.entry_id === e.id).map((x) => x.score);
    return { entry_id: e.id, user: e.user, scores: s.length, average: s.length ? s.reduce((a, b) => a + b, 0) / s.length : null };
  }).sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
}
