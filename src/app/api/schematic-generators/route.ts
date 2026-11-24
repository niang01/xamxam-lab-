import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, ApiFailure } from "@/server/api";
import { GENERATORS, generatorByKind, resolveParams } from "@/lib/schematics-gen";

/** Catalogue des générateurs de schémas. */
export const GET = endpoint(async (req) => {
  await mustBeSignedIn(req);
  return ok({ items: GENERATORS.map((g) => ({ kind: g.kind, title: g.title, discipline: g.discipline, params: g.params })) });
});

/** Génère un schéma (non enregistré : il s'ouvre dans l'éditeur 2D, où l'utilisateur le modifie et l'enregistre). */
export const POST = endpoint(async (req) => {
  await mustBeSignedIn(req);
  const b = await readInput(req, z.object({ kind: z.string().max(40), params: z.record(z.string(), z.union([z.number(), z.string()])).default({}) }));
  const g = generatorByKind(b.kind);
  if (!g) throw new ApiFailure(404, "Générateur inconnu", "err.notFound");
  const { values, errors } = resolveParams(g, b.params);
  if (errors.length) throw new ApiFailure(400, "Paramètres invalides", "err.invalid", errors.map((message) => ({ path: "params", message })));
  return ok({ kind: g.kind, params: values, ...g.build(values) });
});
