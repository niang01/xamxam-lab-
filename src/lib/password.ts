/**
 * Indication de robustesse d'un mot de passe (calcul local, dans le navigateur ; rien n'est envoyé ni enregistré).
 * Score 0–4 : longueur, variété des caractères, motifs faibles (répétitions, suites, mots courants).
 * La règle imposée par le serveur reste : 10 caractères minimum.
 */
export type Strength = { score: 0 | 1 | 2 | 3 | 4; key: "empty" | "tooShort" | "weak" | "fair" | "good" | "strong"; tips: ("length" | "variety" | "pattern" | "common")[] };

const COMMON = ["motdepasse", "password", "azerty", "qwerty", "123456", "admin", "senegal", "dakar", "bonjour", "xamxam", "welcome", "abc123"];

export function passwordStrength(pw: string): Strength {
  if (!pw) return { score: 0, key: "empty", tips: [] };
  const tips: Strength["tips"] = [];
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  const lower = pw.toLowerCase();
  const common = COMMON.some((w) => lower.includes(w));
  const repeated = /(.)\1{2,}/.test(pw);
  const sequence = /(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|azer)/i.test(pw);
  let points = 0;
  if (pw.length >= 10) points++;
  if (pw.length >= 14) points++;
  if (pw.length >= 18) points++;
  if (classes >= 3) points++;
  if (classes === 4) points++;
  if (common) { points -= 2; tips.push("common"); }
  if (repeated || sequence) { points -= 1; tips.push("pattern"); }
  if (pw.length < 14) tips.push("length");
  if (classes < 3) tips.push("variety");
  if (pw.length < 10) return { score: 0, key: "tooShort", tips };
  const score = Math.max(1, Math.min(4, points)) as Strength["score"];
  return { score, key: (["weak", "weak", "fair", "good", "strong"] as const)[score], tips };
}
