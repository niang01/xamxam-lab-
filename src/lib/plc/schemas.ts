/** Validation des programmes d'automate enregistrés (Ladder, Grafcet). */
import { z } from "zod";

const io = z.array(z.object({ v: z.string().regex(/^(I|Q|M)\d{1,2}$/), label: z.string().max(80) })).max(64);
export const ladderSchema = z.object({
  title: z.string().max(160), description: z.string().max(1000).default(""), inputs: io, outputs: io,
  rungs: z.array(z.object({
    branches: z.array(z.array(z.object({ kind: z.enum(["NO", "NC", "P", "N"]), v: z.string().max(4) })).max(12)).min(1).max(8),
    out: z.object({ kind: z.enum(["OUT", "NOT", "SET", "RST", "TON", "TOF", "TP", "CTU", "CTD", "CRES"]), v: z.string().max(4), preset: z.number().int().min(0).max(86_400_000).optional() }),
    comment: z.string().max(200).optional(),
  })).max(100),
});
export const grafcetSchema = z.object({
  title: z.string().max(160), description: z.string().max(1000).default(""), inputs: io, outputs: io,
  steps: z.array(z.object({ id: z.number().int().min(0).max(999), initial: z.boolean().optional(), actions: z.array(z.object({ kind: z.enum(["N", "S", "R"]), v: z.string().max(4) })).max(12), comment: z.string().max(200).optional() })).min(1).max(100),
  transitions: z.array(z.object({ id: z.number().int().min(0).max(999), from: z.array(z.number().int()).min(1).max(10), to: z.array(z.number().int()).min(1).max(10), cond: z.string().min(1).max(300) })).max(150),
});
export const plcSchema = z.discriminatedUnion("kind", [z.object({ kind: z.literal("ladder"), program: ladderSchema }), z.object({ kind: z.literal("grafcet"), program: grafcetSchema })]);
