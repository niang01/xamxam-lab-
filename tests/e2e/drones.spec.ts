import { expect, test } from "@playwright/test";
import { ALERT, signup } from "./helpers";

test("drones : enregistrement, télémétrie du pont, profil, mission validée, commande confirmée, refus de sécurité", async ({ page, request, baseURL }) => {
  await signup(page, `drone-${Date.now()}@e2e.local`, "engineer");
  await page.click("button[data-lang=fr]");
  await page.goto("/drones");

  // Enregistrement d'un drone virtuel : jeton affiché une seule fois
  await page.fill("input[name=drone-name]", "Quadri SITL");
  await page.selectOption("select[name=drone-env]", "virtual");
  await page.click("[data-testid=register-drone]");
  const token = (await page.locator("[data-testid=drone-token] code").textContent())!.trim();
  expect(token.length).toBeGreaterThan(30);

  // Sans pont : aucune valeur inventée
  await page.locator("[data-testid=drone-card]").first().click();
  await expect(page.locator("[data-testid=drone-telemetry]")).toContainText("pont MAVLink n'est pas connecté");

  // Le test joue le rôle du pont MAVLink (même requêtes que services/drone_bridge.py)
  const auth = { Authorization: `Bearer ${token}` };
  const st = await request.post(`${baseURL}/api/device/drone-state`, { headers: auth, data: { state: {
    armed: false, mode: "GUIDED", lat: 14.6928, lon: -17.4467, alt_rel_m: 0, groundspeed_ms: 0, battery_pct: 98, battery_v: 12.6, gps_fix: 6, satellites: 10,
    autopilot: "MAV_AUTOPILOT_ARDUPILOTMEGA", vehicle: "MAV_TYPE_QUADROTOR", home: { lat: 14.6928, lon: -17.4467, alt_msl_m: 10 }, last_text: ["EKF3 IMU0 is using GPS"] } } });
  expect(st.status()).toBe(200);
  await page.reload(); await page.click("button[data-lang=fr]");
  await page.locator("[data-testid=drone-card]").first().click();
  await expect(page.locator("[data-testid=drone-telemetry]")).toContainText("GUIDED");
  await expect(page.locator("[data-testid=drone-telemetry]")).toContainText("98 %");

  // Profil constructeur
  const values: Record<string, string> = { model: "Quadri 450", max_wind_ms: "10", max_gust_ms: "12", min_temp_c: "0", max_temp_c: "45", max_alt_m: "120", geofence_radius_m: "500", cruise_speed_ms: "8", endurance_min: "20", reserve_pct: "25", min_visibility_m: "3000" };
  for (const [k, v] of Object.entries(values)) await page.fill(`input[name=${k}]`, v);
  await page.selectOption("select[name=rain_allowed]", "false");
  await page.selectOption("select[name=night_allowed]", "false");
  await page.click("[data-testid=save-profile]");
  await expect(page.locator("[data-testid=drone-profile]")).toContainText("Enregistré");

  // Mission : un point valide, puis un point hors géorepérage
  await page.fill("input[name=mission-name]", "Tour du champ");
  await page.fill("textarea[name=waypoints]", "14.6950, -17.4467, 30\n14.6950, -17.4440, 30");
  await page.click("[data-testid=create-mission]");
  await expect(page.locator("[data-testid=drone-missions]")).toContainText("Validée");
  await page.fill("input[name=mission-name]", "Trop loin");
  await page.fill("textarea[name=waypoints]", "14.75, -17.4467, 30");
  await page.click("[data-testid=create-mission]");
  await expect(page.locator("[data-testid=drone-missions]")).toContainText("géorepérage");

  // Commande confirmée : transmise au pont, qui la récupère
  await page.check("input[name=confirm]");
  await page.click("[data-testid=cmd-arm]");
  await expect(page.locator("[data-testid=drone-commands]")).toContainText("confirmée");
  const cmds = await (await request.get(`${baseURL}/api/device/commands`, { headers: auth })).json() as { commands: { action: string }[] };
  expect(cmds.commands.map((c) => c.action)).toContain("arm");

  // Sécurité : décollage au-dessus du plafond refusé
  await page.fill("input[name=takeoff-alt]", "200");
  await page.click("[data-testid=cmd-takeoff]");
  await expect(page.locator("[data-testid=drone-commands]")).toContainText("plafond");

  // Arrêt d'urgence toujours disponible
  await page.click("[data-testid=estop]");
  await expect(page.locator("[data-testid=drone-commands]")).toContainText("Arrêt d'urgence envoyé");
  await expect(page.locator(ALERT)).toHaveCount(0); // l'arrêt d'urgence efface le message de refus précédent
});
