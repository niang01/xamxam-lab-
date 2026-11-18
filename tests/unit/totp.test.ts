import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, formatRecoveryCode, hotp, normalizeRecoveryCode, otpauthUri, totp, verifyTotp } from "@/lib/totp";
import { decryptSecret, encryptSecret } from "@/server/security/crypto";

// Secrets et valeurs de référence de la RFC 6238, annexe B (et RFC 4226, annexe D).
const SHA1 = Buffer.from("12345678901234567890");
const SHA256 = Buffer.from("12345678901234567890123456789012");
const SHA512 = Buffer.from("1234567890123456789012345678901234567890123456789012345678901234");

describe("TOTP (RFC 6238)", () => {
  it("HOTP : vecteurs de la RFC 4226", () => {
    expect([0, 1, 2, 3, 9].map((c) => hotp(SHA1, c))).toEqual(["755224", "287082", "359152", "969429", "520489"]);
  });
  it("TOTP à 8 chiffres : vecteurs de l'annexe B (SHA-1, SHA-256, SHA-512)", () => {
    const cases: [number, string, string, string][] = [
      [59, "94287082", "46119246", "90693936"],
      [1111111109, "07081804", "68084774", "25091201"],
      [1111111111, "14050471", "67062674", "99943326"],
      [1234567890, "89005924", "91819424", "93441116"],
      [2000000000, "69279037", "90698825", "38618901"],
      [20000000000, "65353130", "77737706", "47863826"],
    ];
    for (const [time, s1, s256, s512] of cases) {
      expect(totp(SHA1, time, 8, "sha1"), `sha1 ${time}`).toBe(s1);
      expect(totp(SHA256, time, 8, "sha256"), `sha256 ${time}`).toBe(s256);
      expect(totp(SHA512, time, 8, "sha512"), `sha512 ${time}`).toBe(s512);
    }
  });
  it("vérification : fenêtre ±1 pas, rien au-delà, anti-rejeu, format strict", () => {
    const t = 1234567890;
    const step = Math.floor(t / 30);
    expect(verifyTotp(SHA1, totp(SHA1, t), t)).toBe(step);
    expect(verifyTotp(SHA1, totp(SHA1, t - 30), t)).toBe(step - 1);
    expect(verifyTotp(SHA1, totp(SHA1, t + 30), t)).toBe(step + 1);
    expect(verifyTotp(SHA1, totp(SHA1, t - 90), t)).toBeNull();
    expect(verifyTotp(SHA1, totp(SHA1, t), t, { afterStep: step })).toBeNull();
    expect(verifyTotp(SHA1, "12345", t)).toBeNull();
    expect(verifyTotp(SHA1, "abcdef", t)).toBeNull();
  });
  it("base32 (RFC 4648) aller-retour et URI otpauth", () => {
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    expect(base32Decode("MZXW 6YTB OI======").toString()).toBe("foobar");
    const uri = otpauthUri("JBSWY3DPEHPK3PXP", "ana@exemple.sn");
    expect(uri).toBe("otpauth://totp/XAM-XAM%20LAB:ana%40exemple.sn?secret=JBSWY3DPEHPK3PXP&issuer=XAM-XAM+LAB&algorithm=SHA1&digits=6&period=30");
  });
  it("codes de secours lisibles et normalisés", () => {
    const c = formatRecoveryCode(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(c).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);
    expect(normalizeRecoveryCode(c.toLowerCase().replace("-", " "))).toBe(c.replace("-", ""));
  });
  it("secret chiffré au repos (AES-256-GCM) : aller-retour, contexte et altération détectés", () => {
    const enc = encryptSecret(SHA1, "totp");
    expect(enc.startsWith("xxe1:")).toBe(true);
    expect(enc).not.toContain(SHA1.toString("base64url"));
    expect(decryptSecret(enc, "totp").equals(SHA1)).toBe(true);
    expect(() => decryptSecret(enc, "autre-usage")).toThrow();
    const parts = enc.split(":"); parts[2] = parts[2].slice(0, -2) + (parts[2].endsWith("A") ? "BB" : "AA");
    expect(() => decryptSecret(parts.join(":"), "totp")).toThrow();
  });
});
