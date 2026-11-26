import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, throttle } from "@/server/api";
import { compileUno, toolchainStatus } from "@/server/firmware";

/** État de la chaîne de compilation du serveur. */
export const GET = endpoint(async (req) => { await mustBeSignedIn(req); return ok({ board: "Arduino Uno (ATmega328P)", ...toolchainStatus() }); });

/** Compilation d'un croquis Arduino Uno → fichier .hex (le programme n'est jamais exécuté sur le serveur). */
export const POST = endpoint(async (req) => {
  await mustBeSignedIn(req);
  throttle(req, "iot-compile", 20);
  const b = await readInput(req, z.object({ source: z.string().min(1).max(100_000) }));
  return ok(await compileUno(b.source));
});
