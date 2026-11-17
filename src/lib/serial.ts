/** Ligne série « grandeur=valeur » ou « grandeur:valeur » → mesure (autres lignes : affichées, non transmises). */
export function parseSerialLine(line: string): { metric: string; value: number } | null {
  const m = line.trim().match(/^([a-z0-9_.-]{1,40})\s*[=:]\s*(-?\d+(?:\.\d+)?(?:e-?\d+)?)\s*$/i);
  return m ? { metric: m[1], value: Number(m[2]) } : null;
}
