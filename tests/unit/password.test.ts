import { describe, expect, it } from "vitest";
import { passwordStrength } from "@/lib/password";

describe("Robustesse du mot de passe (indication locale)", () => {
  it("vide, trop court, faible, moyen, bon, très bon", () => {
    expect(passwordStrength("").key).toBe("empty");
    expect(passwordStrength("abc").key).toBe("tooShort");
    expect(passwordStrength("motdepasse12").key).toBe("weak");          // mot courant
    expect(passwordStrength("aaaaaaaaaaaa").score).toBeLessThanOrEqual(1); // répétitions, une seule classe
    expect(passwordStrength("rivierebleue").key).toBe("weak");
    expect(passwordStrength("Riviere-bleue7").score).toBeGreaterThanOrEqual(3);
    expect(passwordStrength("Kt4R#w8Yp2-Nb6Vm0Qz").key).toBe("strong");
  });
  it("conseils pertinents", () => {
    expect(passwordStrength("azerty-azerty").tips).toContain("common");
    expect(passwordStrength("abcd1234efgh").tips).toEqual(expect.arrayContaining(["pattern", "variety", "length"]));
  });
});
