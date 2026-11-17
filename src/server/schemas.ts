/** Schémas de validation (zod) partagés par les routes. */
import { z } from "zod";

export const projectSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).nullable().optional(),
  objectives: z.string().trim().max(5000).nullable().optional(),
  problem: z.string().trim().max(5000).nullable().optional(),
  specs: z.string().trim().max(20000).nullable().optional(),
  kind: z.enum(["engineering", "thesis", "research", "startup", "course"]).default("engineering"),
  visibility: z.enum(["private", "members", "public"]).default("private"),
  autonomy_level: z.number().int().min(1).max(5).nullable().optional(),
});


const part = z.object({
  id: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,15}$/),
  type: z.enum(["R", "C", "L", "V", "I", "D", "GND"]),
  x: z.number().finite(), y: z.number().finite(), rot: z.number().int().min(0).max(270),
  value: z.string().max(200),
});
const wireEnd = z.object({ part: z.string().max(16), pin: z.number().int().min(0).max(1) });
export const graphSchema = z.object({ parts: z.array(part).max(200), wires: z.array(z.object({ a: wireEnd, b: wireEnd })).max(600) });

export const analysisSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("op") }),
  z.object({ kind: z.literal("tran"), step: z.string().max(20), stop: z.string().max(20) }),
  z.object({ kind: z.literal("dc"), source: z.string().max(16), start: z.string().max(20), stop: z.string().max(20), step: z.string().max(20) }),
  z.object({ kind: z.literal("ac"), points: z.number().int().min(1).max(1000), fstart: z.string().max(20), fstop: z.string().max(20) }),
]);

export const capabilitiesSchema = z.object({
  metrics: z.array(z.object({ metric: z.string().trim().regex(/^[a-z0-9_.-]{1,40}$/i), unit: z.string().max(20).nullable().optional(), max_age_s: z.number().int().min(10).max(86400).nullable().optional() })).max(40).default([]),
  commands: z.array(z.object({ action: z.string().trim().regex(/^[a-z0-9_]{1,30}$/), label: z.string().max(60).optional(), max_duration_s: z.number().int().positive().max(86400).nullable(), requires_duration: z.boolean() })).max(20).default([]),
});
export const deviceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  hardware: z.enum(["esp32", "xiao_esp32s3", "arduino", "raspberry_pi", "plc", "drone", "robot", "weather_station", "inverter", "pump_controller", "other"]),
  protocol: z.enum(["https", "web_serial", "mqtt", "ble", "lora", "modbus"]),
  environment: z.enum(["virtual", "bench", "real"]),
  project_id: z.string().uuid().nullable().optional(),
  capabilities: capabilitiesSchema,
});
export const readingsSchema = z.object({ readings: z.array(z.object({ metric: z.string().trim().regex(/^[a-z0-9_.-]{1,40}$/i), value: z.number(), unit: z.string().max(20).nullable().optional(), ts: z.string().datetime({ offset: true }).nullable().optional() })).min(1).max(500), firmware: z.string().max(40).optional() });

export const courseSchema = z.object({
  title: z.string().trim().min(3).max(160), domain: z.string().trim().min(2).max(60), level: z.enum(["pupil", "student", "professional"]), lang: z.enum(["wo", "fr", "en"]),
  summary: z.string().trim().max(2000).nullable().optional(),
  lessons: z.array(z.object({ title: z.string().trim().min(1).max(160), body: z.string().max(20000) })).max(50),
  quiz: z.array(z.object({ q: z.string().trim().min(3).max(500), choices: z.array(z.string().trim().min(1).max(200)).min(2).max(6), answer: z.number().int().min(0) })).max(50)
    .refine((qs) => qs.every((x) => x.answer < x.choices.length), "Bonne réponse hors des choix"),
  pass_mark: z.number().int().min(1).max(100).default(70),
  lab_link: z.string().regex(/^\/lab\/[a-z]+$|^\/components$|^\/studio$/).nullable().optional(),
  published: z.boolean().default(false),
});
